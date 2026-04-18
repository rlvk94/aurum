import { api, HydrateClient } from "~/trpc/server";
import { AccountDetailClient } from "./_components/account-detail-client";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Window for the initial category-split fetch: last 12 months up to end of
  // the current month, in UTC (date-fns is local-time but the transaction.date
  // column is a bare DATE so timezone doesn't shift the bucket).
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
    .toISOString()
    .slice(0, 10);
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);

  await Promise.all([
    api.financialAccount.get.prefetch({ id }),
    api.financialAccount.stats.prefetch({ id, months: 12 }),
    api.financialAccount.categorySplit.prefetch({ id, from, to }),
    api.financialAccount.list.prefetch(),
    api.category.list.prefetch(),
    api.transaction.list.prefetch({ accountId: id }),
  ]);

  return (
    <HydrateClient>
      <AccountDetailClient id={id} />
    </HydrateClient>
  );
}
