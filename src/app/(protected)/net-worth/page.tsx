import { api, HydrateClient } from "~/trpc/server";
import { NetWorthClient } from "./_components/net-worth-client";

export default async function NetWorthPage() {
  await Promise.all([
    api.financialAccount.summary.prefetch(),
    api.asset.summary.prefetch(),
    api.debt.summary.prefetch(),
  ]);

  return (
    <HydrateClient>
      <NetWorthClient />
    </HydrateClient>
  );
}
