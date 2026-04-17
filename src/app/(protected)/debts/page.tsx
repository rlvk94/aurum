import { api, HydrateClient } from "~/trpc/server";
import { DebtsClient } from "./_components/debts-client";

export default async function DebtsPage() {
  await Promise.all([api.debt.list.prefetch(), api.debt.summary.prefetch()]);

  return (
    <HydrateClient>
      <DebtsClient />
    </HydrateClient>
  );
}
