import { NextResponse, type NextRequest } from "next/server";
import { isNull } from "drizzle-orm";

import { env } from "~/env";
import { computeOnTrack } from "~/lib/challenge-on-track";
import { db } from "~/server/db";
import { challenge } from "~/server/db/schema";
import {
  computeProgress,
  rotateChallenge,
  todayIso,
} from "~/server/lib/challenge-service";
import { copenhagenToday } from "~/server/lib/consumption";
import {
  runConsumptionReminderSweep,
  type ConsumptionSweepResult,
} from "~/server/lib/consumption-reminder";
import {
  clearEpisode,
  dispatchNotification,
  loadNotifiedUserIds,
  resolveFamilyMembers,
  type ChallengeOffTrackPayload,
} from "~/server/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  if (!env.CRON_SECRET) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${env.CRON_SECRET}`;
}

const CHALLENGE_TYPE = "challenge_off_track" as const;

type ChallengeSweepResult = {
  checked: number;
  notified: number;
  rearmed: number;
  errors: { challengeId: string; message: string }[];
};

// Step 1: challenge off-track alerts (ADR-0025).
async function runChallengeOffTrackSweep(
  today: string,
): Promise<ChallengeSweepResult> {
  const rows = await db
    .select()
    .from(challenge)
    .where(isNull(challenge.archivedAt));

  let checked = 0;
  let notified = 0;
  let rearmed = 0;
  const errors: { challengeId: string; message: string }[] = [];

  for (const row of rows) {
    try {
      // Ensure the active instance is current before evaluating.
      const instance = await rotateChallenge(db, row);
      if (!instance) continue;
      checked++;

      const dedupeKey = `${CHALLENGE_TYPE}:${instance.id}`;

      // targetAmount === 0 would make the ratio NaN/Infinity; treat as no signal.
      if (row.targetAmount === 0) {
        rearmed += await clearEpisode(db, CHALLENGE_TYPE, dedupeKey);
        continue;
      }

      const progress = await computeProgress(db, row, instance, today);
      const ratio = progress / row.targetAmount;
      const onTrack = computeOnTrack({
        type: row.type,
        ratio,
        periodStartIso: instance.periodStart,
        periodEndIso: instance.periodEnd,
        todayIso: today,
      });

      // On-track / not-evaluable → clear any episode so a later flip re-notifies.
      if (onTrack !== false) {
        rearmed += await clearEpisode(db, CHALLENGE_TYPE, dedupeKey);
        continue;
      }

      // Off-track: notify family members not already notified this episode.
      const recipients = await resolveFamilyMembers(db, row.familyId);
      const already = await loadNotifiedUserIds(db, CHALLENGE_TYPE, dedupeKey);
      const fresh = recipients.filter((r) => !already.has(r.userId));
      if (fresh.length === 0) continue;

      const payload: ChallengeOffTrackPayload = {
        challengeId: row.id,
        challengeName: row.name,
        instanceId: instance.id,
      };
      const summary = await dispatchNotification({
        type: CHALLENGE_TYPE,
        recipients: fresh,
        payload,
        dedupeKey,
      });
      notified += summary.notifiedUserIds.length;
      for (const e of summary.errors) {
        errors.push({
          challengeId: row.id,
          message: `${e.channel}: ${e.message}`,
        });
      }
    } catch (err) {
      errors.push({
        challengeId: row.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { checked, notified, rearmed, errors };
}

// Each step is isolated so a failure in one never blocks the other. The
// response keeps the original top-level fields for the challenge step and
// nests the consumption step under `consumption`.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let challengeResult: ChallengeSweepResult;
  try {
    challengeResult = await runChallengeOffTrackSweep(todayIso());
  } catch (err) {
    challengeResult = {
      checked: 0,
      notified: 0,
      rearmed: 0,
      errors: [
        {
          challengeId: "*",
          message: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }

  let consumptionResult: ConsumptionSweepResult;
  try {
    consumptionResult = await runConsumptionReminderSweep(
      db,
      copenhagenToday(),
    );
  } catch (err) {
    consumptionResult = {
      familiesChecked: 0,
      familiesDue: 0,
      notified: 0,
      skipped: 0,
      errors: [
        {
          familyId: "*",
          message: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }

  return NextResponse.json({
    ...challengeResult,
    consumption: consumptionResult,
  });
}

export const GET = POST;
