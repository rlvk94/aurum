import { api, HydrateClient } from "~/trpc/server";
import { AppearanceForm } from "./_components/appearance-form";

export default async function AppearanceSettingsPage() {
  await api.user.me.prefetch();

  return (
    <HydrateClient>
      <AppearanceForm />
    </HydrateClient>
  );
}
