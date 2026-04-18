import { api, HydrateClient } from "~/trpc/server";
import { PlanListClient } from "./_components/plan-list-client";

export default async function IncomePlannerPage() {
  await Promise.all([
    api.incomePlan.list.prefetch(),
    api.financialAccount.list.prefetch(),
  ]);

  return (
    <HydrateClient>
      <PlanListClient />
    </HydrateClient>
  );
}
