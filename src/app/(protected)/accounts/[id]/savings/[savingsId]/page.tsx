import { api, HydrateClient } from "~/trpc/server";
import { SavingsDetailClient } from "./_components/savings-detail-client";

export default async function SavingsDetailPage({
  params,
}: {
  params: Promise<{ id: string; savingsId: string }>;
}) {
  const { id, savingsId } = await params;

  await Promise.all([
    api.savings.get.prefetch({ id: savingsId }),
    api.savings.listTransactions.prefetch({ savingsId }),
    api.financialAccount.get.prefetch({ id }),
  ]);

  return (
    <HydrateClient>
      <SavingsDetailClient accountId={id} savingsId={savingsId} />
    </HydrateClient>
  );
}
