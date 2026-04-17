// Next.js calls register() once per server start (nodejs and edge runtimes).
// We start the in-app challenge scheduler on the nodejs runtime only.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startChallengeScheduler } = await import(
      "~/server/lib/challenge-scheduler"
    );
    startChallengeScheduler();
  }
}
