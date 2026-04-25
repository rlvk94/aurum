import {
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

import { openUpgradeModal } from "~/app/_components/billing/upgrade-modal-bus";

/**
 * Global mutation error hook: any tRPC mutation that throws
 * `plan_upgrade_required` (from `requireFeature` / `requireWithinLimit`)
 * surfaces the upgrade modal automatically. Per-call `onError` handlers
 * still run.
 */
function handleMutationError(error: unknown) {
  if (typeof error !== "object" || error === null) return;
  const e = error as { message?: unknown; data?: { cause?: { feature?: string } | null } };
  if (e.message === "plan_upgrade_required" || e.message === "plan_limit_reached") {
    const feature =
      typeof e.data?.cause?.feature === "string" ? e.data.cause.feature : undefined;
    openUpgradeModal(feature);
  }
}

export const createQueryClient = () =>
  new QueryClient({
    mutationCache: new MutationCache({
      onError: handleMutationError,
    }),
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
