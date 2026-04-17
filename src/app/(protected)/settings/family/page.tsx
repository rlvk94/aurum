import { api, HydrateClient } from "~/trpc/server";
import { FamilyForm } from "./_components/family-form";

export default async function FamilySettingsPage() {
  await api.family.current.prefetch();

  return (
    <HydrateClient>
      <FamilyForm />
    </HydrateClient>
  );
}
