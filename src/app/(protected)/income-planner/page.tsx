import { api, HydrateClient } from "~/trpc/server";
import { PlanListClient } from "./_components/plan-list-client";

export default async function IncomePlannerPage() {
  await api.incomePlan.list.prefetch();

  return (
    <HydrateClient>
      <PlanListClient />
    </HydrateClient>
  );
}
