import { api, HydrateClient } from "~/trpc/server";
import { DebtDetailClient } from "./_components/debt-detail-client";

export default async function DebtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await api.debt.get.prefetch({ id });

  return (
    <HydrateClient>
      <DebtDetailClient id={id} />
    </HydrateClient>
  );
}
