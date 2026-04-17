import { api, HydrateClient } from "~/trpc/server";
import { ChallengesClient } from "./_components/challenges-client";

export default async function ChallengesPage() {
  await Promise.all([
    api.challenge.list.prefetch(),
    api.category.list.prefetch(),
    api.financialAccount.list.prefetch(),
    api.debt.list.prefetch(),
  ]);

  return (
    <HydrateClient>
      <ChallengesClient />
    </HydrateClient>
  );
}
