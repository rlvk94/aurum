import { api, HydrateClient } from "~/trpc/server";
import { BillingForm } from "./_components/billing-form";

export default async function BillingSettingsPage() {
  await Promise.all([
    api.billing.current.prefetch(),
    api.family.current.prefetch(),
  ]);

  return (
    <HydrateClient>
      <BillingForm />
    </HydrateClient>
  );
}
