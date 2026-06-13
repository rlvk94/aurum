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

const TYPE = "challenge_off_track" as const;

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = todayIso();
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

      const dedupeKey = `${TYPE}:${instance.id}`;

      // targetAmount === 0 would make the ratio NaN/Infinity; treat as no signal.
      if (row.targetAmount === 0) {
        rearmed += await clearEpisode(db, TYPE, dedupeKey);
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
        rearmed += await clearEpisode(db, TYPE, dedupeKey);
        continue;
      }

      // Off-track: notify family members not already notified this episode.
      const recipients = await resolveFamilyMembers(db, row.familyId);
      const already = await loadNotifiedUserIds(db, TYPE, dedupeKey);
      const fresh = recipients.filter((r) => !already.has(r.userId));
      if (fresh.length === 0) continue;

      const payload: ChallengeOffTrackPayload = {
        challengeId: row.id,
        challengeName: row.name,
        instanceId: instance.id,
      };
      const summary = await dispatchNotification({
        type: TYPE,
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

  return NextResponse.json({ checked, notified, rearmed, errors });
}

export const GET = POST;
