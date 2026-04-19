import { api, HydrateClient } from "~/trpc/server";
import { BudgetDetailClient } from "./_components/budget-detail-client";

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ budgetId: string }>;
}) {
  const { budgetId } = await params;
  await Promise.all([
    api.budget.get.prefetch({ id: budgetId }),
    api.category.list.prefetch(),
  ]);

  return (
    <HydrateClient>
      <BudgetDetailClient budgetId={budgetId} />
    </HydrateClient>
  );
}
