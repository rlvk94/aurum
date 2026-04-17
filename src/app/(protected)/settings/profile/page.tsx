import { api, HydrateClient } from "~/trpc/server";
import { ProfileForm } from "./_components/profile-form";

export default async function ProfileSettingsPage() {
  await api.user.me.prefetch();

  return (
    <HydrateClient>
      <ProfileForm />
    </HydrateClient>
  );
}
