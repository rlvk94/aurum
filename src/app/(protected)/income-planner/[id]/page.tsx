import { notFound } from "next/navigation";

import { api, HydrateClient } from "~/trpc/server";
import { TRPCError } from "@trpc/server";
import { PlanDetailClient } from "../_components/plan-detail-client";

export default async function IncomePlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await Promise.all([
      api.incomePlan.get.prefetch({ id }),
      api.financialAccount.list.prefetch(),
    ]);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <HydrateClient>
      <PlanDetailClient planId={id} />
    </HydrateClient>
  );
}
