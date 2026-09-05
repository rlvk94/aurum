import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { api, HydrateClient } from "~/trpc/server";
import { MeterDetailClient } from "./_components/meter-detail-client";

export default async function MeterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await api.consumption.getMeter.prefetch({ id });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <HydrateClient>
      <MeterDetailClient id={id} />
    </HydrateClient>
  );
}
