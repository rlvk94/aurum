import { redirect } from "next/navigation";

import { api, HydrateClient } from "~/trpc/server";
import { BillingForm } from "./_components/billing-form";

export default async function BillingSettingsPage() {
  const family = await api.family.current();
  if (family?.role !== "owner") {
    redirect("/dashboard");
  }

  await api.billing.current.prefetch();

  return (
    <HydrateClient>
      <BillingForm />
    </HydrateClient>
  );
}
