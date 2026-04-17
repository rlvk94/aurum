import { api, HydrateClient } from "~/trpc/server";
import { MembersClient } from "./_components/members-client";

export default async function MembersSettingsPage() {
  await Promise.all([
    api.family.current.prefetch(),
    api.family.listMembers.prefetch(),
    api.invitation.list.prefetch(),
  ]);

  return (
    <HydrateClient>
      <MembersClient />
    </HydrateClient>
  );
}
