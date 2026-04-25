"use client";

import { api } from "~/trpc/react";
import {
  PLAN_FEATURES,
  type BooleanFeatureKey,
  type NumericLimitKey,
  type PlanKey,
} from "~/server/billing/plans";

type Entitlements = {
  plan: PlanKey;
  isLoading: boolean;
  has: (feature: BooleanFeatureKey) => boolean;
  limit: (key: NumericLimitKey) => number;
};

export function useEntitlements(): Entitlements {
  const { data, isLoading } = api.billing.current.useQuery(undefined, {
    staleTime: 30 * 1000,
  });
  const plan: PlanKey = data?.plan ?? "individual";
  return {
    plan,
    isLoading,
    has: (feature) => PLAN_FEATURES[plan][feature] === true,
    limit: (key) => PLAN_FEATURES[plan][key],
  };
}
