import { api, HydrateClient } from "~/trpc/server";
import { NotificationsForm } from "./_components/notifications-form";

export default async function NotificationSettingsPage() {
  await Promise.all([
    api.notification.getPreferences.prefetch(),
    api.notification.listDevices.prefetch(),
  ]);

  return (
    <HydrateClient>
      <NotificationsForm />
    </HydrateClient>
  );
}
