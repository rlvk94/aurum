import { api, HydrateClient } from "~/trpc/server";
import { BudgetsClient } from "./_components/budgets-client";

export default async function AnnualBudgetPage() {
  await Promise.all([
    api.budget.list.prefetch(),
    api.category.list.prefetch(),
  ]);

  return (
    <HydrateClient>
      <BudgetsClient />
    </HydrateClient>
  );
}
