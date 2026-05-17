import { api, HydrateClient } from "~/trpc/server";
import { ChallengeDetailClient } from "./_components/challenge-detail-client";

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = await params;
  await Promise.all([
    api.challenge.get.prefetch({ id: challengeId }),
    api.category.list.prefetch(),
    api.financialAccount.list.prefetch(),
    api.debt.list.prefetch(),
  ]);

  return (
    <HydrateClient>
      <ChallengeDetailClient id={challengeId} />
    </HydrateClient>
  );
}
