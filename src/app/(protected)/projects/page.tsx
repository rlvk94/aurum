import { api, HydrateClient } from "~/trpc/server";
import { ProjectsClient } from "./_components/projects-client";

export default async function ProjectsPage() {
  await Promise.all([
    api.project.list.prefetch({ includeArchived: true }),
    api.category.list.prefetch(),
    api.financialAccount.list.prefetch(),
  ]);

  return (
    <HydrateClient>
      <ProjectsClient />
    </HydrateClient>
  );
}
