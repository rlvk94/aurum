import "server-only";

import { db } from "~/server/db";
import { rotateAllChallenges } from "~/server/lib/challenge-service";

// Rotate every 6 hours. Lazy rotation on list/get is the safety net; this
// ensures instances close and spawn even if nobody opens the challenges page.
const INTERVAL_MS = 6 * 60 * 60 * 1000;

// Process-wide guard so hot reload / multiple imports don't schedule duplicates.
type SchedulerState = { started: boolean; timer: NodeJS.Timeout | null };
const globalForScheduler = globalThis as unknown as {
  __aurumChallengeScheduler?: SchedulerState;
};
const state: SchedulerState = globalForScheduler.__aurumChallengeScheduler ?? {
  started: false,
  timer: null,
};
globalForScheduler.__aurumChallengeScheduler = state;

async function runRotation(trigger: "startup" | "interval"): Promise<void> {
  try {
    const result = await rotateAllChallenges(db);
    if (result.processed > 0 || result.errors.length > 0) {
      console.info(
        `[challenge-scheduler] ${trigger}: processed=${result.processed} rotated=${result.rotated} errors=${result.errors.length}`,
      );
      for (const err of result.errors) {
        console.warn(
          `[challenge-scheduler] rotation error for ${err.challengeId}: ${err.message}`,
        );
      }
    }
  } catch (err) {
    console.error("[challenge-scheduler] unexpected failure:", err);
  }
}

export function startChallengeScheduler(): void {
  if (state.started) return;
  state.started = true;

  console.info(
    `[challenge-scheduler] started (interval=${INTERVAL_MS / 1000 / 60}min)`,
  );

  // Kick off one rotation at startup so missed periods catch up immediately.
  void runRotation("startup");

  state.timer = setInterval(() => {
    void runRotation("interval");
  }, INTERVAL_MS);

  // Don't keep the event loop alive just for this timer.
  state.timer.unref?.();
}
