export type TutorialPlacement = "top" | "bottom" | "left" | "right" | "auto";

export type TutorialStep = {
  id: string;
  targetSelector: string | null;
  titleKey: string;
  bodyKey: string;
  placement?: TutorialPlacement;
};

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: "welcome",
    targetSelector: null,
    titleKey: "steps.welcome.title",
    bodyKey: "steps.welcome.body",
  },
  {
    id: "stats",
    targetSelector: '[data-tour-id="stats"]',
    titleKey: "steps.stats.title",
    bodyKey: "steps.stats.body",
    placement: "bottom",
  },
  {
    id: "recent-transactions",
    targetSelector: '[data-tour-id="recent-transactions"]',
    titleKey: "steps.recentTransactions.title",
    bodyKey: "steps.recentTransactions.body",
    placement: "top",
  },
  {
    id: "challenges",
    targetSelector: '[data-tour-id="challenges"]',
    titleKey: "steps.challenges.title",
    bodyKey: "steps.challenges.body",
    placement: "top",
  },
  {
    id: "budgets",
    targetSelector: '[data-tour-id="budgets"]',
    titleKey: "steps.budgets.title",
    bodyKey: "steps.budgets.body",
    placement: "right",
  },
  {
    id: "navigation",
    targetSelector: '[data-tour-id="navigation"]',
    titleKey: "steps.navigation.title",
    bodyKey: "steps.navigation.body",
    placement: "right",
  },
  {
    id: "family-switcher",
    targetSelector: '[data-tour-id="family-switcher"]',
    titleKey: "steps.familySwitcher.title",
    bodyKey: "steps.familySwitcher.body",
    placement: "right",
  },
  {
    id: "settings",
    targetSelector: '[data-tour-id="settings"]',
    titleKey: "steps.settings.title",
    bodyKey: "steps.settings.body",
    placement: "right",
  },
] as const;
