import {
  Landmark,
  PiggyBank,
  Gift,
  ShieldCheck,
  Receipt,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type AccountType =
  | "checking"
  | "savings"
  | "gift"
  | "financial_freedom"
  | "fixed_costs"
  | "investment"
  | "other";

// CSS vars from globals.css. Mapping account types onto the finance palette so
// the segmented hero bar reads like a small spectrum of purpose-coloured money.
const PALETTE: Record<AccountType, { bg: string; ring: string; soft: string }> = {
  checking:          { bg: "hsl(220 20% 35%)", ring: "hsl(220 20% 35%)", soft: "hsl(220 20% 95%)" },
  savings:           { bg: "var(--savings)",   ring: "var(--savings)",   soft: "var(--savings-muted)" },
  gift:              { bg: "hsl(330 55% 60%)", ring: "hsl(330 55% 60%)", soft: "hsl(330 45% 96%)" },
  financial_freedom: { bg: "var(--primary)",   ring: "var(--primary)",   soft: "var(--accent)" },
  fixed_costs:       { bg: "var(--expense)",   ring: "var(--expense)",   soft: "var(--expense-muted)" },
  investment:        { bg: "var(--income)",    ring: "var(--income)",    soft: "var(--income-muted)" },
  other:             { bg: "hsl(260 30% 55%)", ring: "hsl(260 30% 55%)", soft: "hsl(260 30% 96%)" },
};

export function colorForAccountType(type: AccountType | null | undefined) {
  if (!type) return { bg: "hsl(220 10% 70%)", ring: "hsl(220 10% 70%)", soft: "hsl(220 10% 94%)" };
  return PALETTE[type];
}

export const ACCOUNT_TYPE_ICONS: Record<AccountType, LucideIcon> = {
  checking: Landmark,
  savings: PiggyBank,
  gift: Gift,
  financial_freedom: ShieldCheck,
  fixed_costs: Receipt,
  investment: TrendingUp,
  other: Wallet,
};
