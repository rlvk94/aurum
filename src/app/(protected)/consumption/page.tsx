import { api, HydrateClient } from "~/trpc/server";
import { ConsumptionClient } from "./_components/consumption-client";

export default async function ConsumptionPage() {
  await Promise.all([
    api.consumption.listMeters.prefetch({ includeArchived: true }),
    api.consumption.getSettings.prefetch(),
  ]);

  return (
    <HydrateClient>
      <ConsumptionClient />
    </HydrateClient>
  );
}
