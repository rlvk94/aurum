import {
  ArrowLeftRight,
  Calculator,
  CreditCard,
  Home,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  Palette,
  PieChart,
  Settings,
  Sparkles,
  Tag,
  Target,
  User,
  Users,
  Wallet,
} from "lucide-react";

export type RouteEntry = {
  /** Exact pathname this entry represents. */
  path: string;
  /** Translation key resolved with `useTranslations()` (full dotted path). */
  titleKey: string;
  /** Icon shown in command palette, favorites sidebar, breadcrumb leaf. */
  icon?: LucideIcon;
  /** Keyboard shortcut as a display string, e.g. "G D" or "⌘B". */
  shortcut?: string;
  /** Parent path for breadcrumb chaining. */
  parent?: string;
  /** Hide from the command palette navigation section. */
  hideFromPalette?: boolean;
};

export const ROUTES: RouteEntry[] = [
  {
    path: "/dashboard",
    titleKey: "nav.dashboard",
    icon: LayoutDashboard,
    shortcut: "G D",
  },
  {
    path: "/transactions",
    titleKey: "nav.transactions",
    icon: ArrowLeftRight,
    shortcut: "G T",
    parent: "/dashboard",
  },
  {
    path: "/accounts",
    titleKey: "nav.accounts",
    icon: Wallet,
    shortcut: "G A",
    parent: "/dashboard",
  },
  {
    path: "/budgets",
    titleKey: "nav.budgets",
    icon: PieChart,
    hideFromPalette: true,
    parent: "/dashboard",
  },
  {
    path: "/budgets/annual",
    titleKey: "nav.annualBudget",
    icon: PieChart,
    shortcut: "G B",
    parent: "/budgets",
  },
  {
    path: "/budgets/challenges",
    titleKey: "nav.challenges",
    icon: Target,
    shortcut: "G C",
    parent: "/budgets",
  },
  {
    path: "/assets",
    titleKey: "nav.assets",
    icon: Landmark,
    shortcut: "G S",
    parent: "/dashboard",
  },
  {
    path: "/debts",
    titleKey: "nav.debts",
    icon: CreditCard,
    shortcut: "G L",
    parent: "/dashboard",
  },
  {
    path: "/net-worth",
    titleKey: "nav.netWorthOverview",
    icon: Sparkles,
    shortcut: "G N",
    parent: "/dashboard",
  },
  {
    path: "/income-planner",
    titleKey: "nav.incomePlanner",
    icon: Calculator,
    shortcut: "G I",
    parent: "/dashboard",
  },
  {
    path: "/settings",
    titleKey: "common.settings",
    icon: Settings,
    shortcut: "⌘ ,",
    parent: "/dashboard",
  },
  {
    path: "/settings/profile",
    titleKey: "settings.nav.profile",
    icon: User,
    parent: "/settings",
  },
  {
    path: "/settings/family",
    titleKey: "settings.nav.familyGeneral",
    icon: Home,
    parent: "/settings",
  },
  {
    path: "/settings/members",
    titleKey: "settings.nav.members",
    icon: Users,
    parent: "/settings",
  },
  {
    path: "/settings/categories",
    titleKey: "settings.nav.categories",
    icon: Tag,
    parent: "/settings",
  },
  {
    path: "/settings/appearance",
    titleKey: "settings.nav.appearance",
    icon: Palette,
    parent: "/settings",
  },
];

const ROUTE_MAP = new Map(ROUTES.map((r) => [r.path, r]));

/**
 * Resolve a pathname to its registered route entry.
 * Exact match first, then longest prefix (for dynamic segments like /debts/[id]).
 */
export function findRoute(pathname: string): RouteEntry | undefined {
  const exact = ROUTE_MAP.get(pathname);
  if (exact) return exact;

  let best: RouteEntry | undefined;
  for (const route of ROUTES) {
    if (pathname.startsWith(`${route.path}/`) || pathname === route.path) {
      if (!best || route.path.length > best.path.length) best = route;
    }
  }
  return best;
}

/**
 * Build the breadcrumb trail (root → leaf) for a pathname.
 * Walks the `parent` chain of the matched route.
 * Returns an empty array if the pathname is not registered.
 */
export function buildBreadcrumb(pathname: string): RouteEntry[] {
  const leaf = findRoute(pathname);
  if (!leaf) return [];

  const chain: RouteEntry[] = [leaf];
  let cursor: string | undefined = leaf.parent;
  while (cursor) {
    const parent = ROUTE_MAP.get(cursor);
    if (!parent) break;
    chain.unshift(parent);
    cursor = parent.parent;
  }
  return chain;
}

/** Routes exposed in the command palette's Navigation section. */
export function getPaletteRoutes(): RouteEntry[] {
  return ROUTES.filter((r) => !r.hideFromPalette);
}
