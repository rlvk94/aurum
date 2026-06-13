/**
 * Source of truth for plan-based feature gating.
 *
 * Pure, dep-free so it can be imported from both server and client. Boolean
 * flags map to entitlement checks (`requireFeature`); numeric limits map to
 * `requireWithinLimit`.
 */

export const PLAN_FEATURES = {
  individual: {
    maxAccounts: 2,
    maxMembers: 1,
    annualBudgets: true,
    challenges: false,
    debts: false,
    assets: false,
    netWorth: false,
    incomePlanner: true,
    autoCategorisationRules: true,
    projects: false,
  },
  family: {
    maxAccounts: Number.POSITIVE_INFINITY,
    maxMembers: Number.POSITIVE_INFINITY,
    annualBudgets: true,
    challenges: true,
    debts: true,
    assets: true,
    netWorth: true,
    incomePlanner: true,
    autoCategorisationRules: true,
    projects: true,
  },
} as const;

export type PlanKey = keyof typeof PLAN_FEATURES;
export type FeatureKey = keyof (typeof PLAN_FEATURES)["individual"];

/**
 * Ordered display bullets per plan. Single source of truth for what each
 * plan advertises — both the landing-page pricing cards and the in-app
 * upgrade/onboarding surfaces render from this list. Each entry maps to a
 * translation key under `billing.planFeatures.<bullet>` (da/en).
 *
 * When you ship a new Family-only feature:
 *   1. add the boolean to PLAN_FEATURES above,
 *   2. add a bullet key here in the right plan's list,
 *   3. add the translation under `billing.planFeatures` in messages/{da,en}.json.
 */
export const PLAN_DISPLAY_BULLETS = {
  individual: [
    "members1",
    "accounts2",
    "manualEntry",
    "csvImport",
    "monthlyBudget",
    "annualBudget",
    "incomePlanner",
    "autoCategorisation",
  ],
  family: [
    "wholeFamily",
    "unlimitedAccounts",
    "challenges",
    "debts",
    "assets",
    "netWorth",
    "projects",
  ],
} as const satisfies Record<PlanKey, readonly string[]>;

export type PlanBulletKey =
  | (typeof PLAN_DISPLAY_BULLETS)["individual"][number]
  | (typeof PLAN_DISPLAY_BULLETS)["family"][number];

export type BooleanFeatureKey = {
  [K in FeatureKey]: (typeof PLAN_FEATURES)["family"][K] extends boolean
    ? K
    : never;
}[FeatureKey];

export type NumericLimitKey = {
  [K in FeatureKey]: (typeof PLAN_FEATURES)["family"][K] extends number
    ? K
    : never;
}[FeatureKey];

export function planHas(plan: PlanKey, feature: BooleanFeatureKey): boolean {
  return PLAN_FEATURES[plan][feature] === true;
}

export function planLimit(plan: PlanKey, key: NumericLimitKey): number {
  return PLAN_FEATURES[plan][key];
}
