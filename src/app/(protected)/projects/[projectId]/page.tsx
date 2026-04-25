import { api, HydrateClient } from "~/trpc/server";
import { ProjectDetailClient } from "./_components/project-detail-client";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  await Promise.all([
    api.project.get.prefetch({ id: projectId }),
    api.category.list.prefetch(),
    api.financialAccount.list.prefetch(),
  ]);

  return (
    <HydrateClient>
      <ProjectDetailClient projectId={projectId} />
    </HydrateClient>
  );
}
