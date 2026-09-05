"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { api } from "~/trpc/react";
import { formatMoney } from "~/app/(protected)/income-planner/_lib/format";
import { sumArray, yearToDateStatus } from "../_lib/budget-format";
import { YearRibbon } from "./year-ribbon";

// Summary surface for one annual budget: title, scope, four at-a-glance
// metrics and the twelve-month ribbon. Shared by the list page
// (one full-width card per budget) and the detail page hero so both always
// tell the same story from the same numbers.
export function BudgetSummary({
  name,
  year,
  description,
  accountIds,
  lineCount,
  plannedByMonth,
  actualByMonth,
  now,
  actions,
  headingLevel = 1,
  compact = false,
  className = "",
  style,
  children,
}: {
  name: string;
  year: number;
  description: string | null;
  accountIds: string[];
  lineCount: number;
  plannedByMonth: number[];
  actualByMonth: number[];
  now: Date;
  actions?: ReactNode;
  headingLevel?: 1 | 2;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
  // Overlays (e.g. a full-surface link) rendered above the backdrop but
  // below `actions`.
  children?: ReactNode;
}) {
  const t = useTranslations("budgets");

  const thisYear = now.getFullYear();
  const phase =
    year === thisYear ? "current" : year < thisYear ? "past" : "future";
  const currentMonthIndex = phase === "current" ? now.getMonth() : undefined;

  const plannedYear = useMemo(() => sumArray(plannedByMonth), [plannedByMonth]);
  const actualYear = useMemo(() => sumArray(actualByMonth), [actualByMonth]);
  const remaining = plannedYear - actualYear;
  const pctUsed =
    plannedYear > 0 ? Math.min(140, (actualYear / plannedYear) * 100) : 0;

  const status = useMemo(
    () => yearToDateStatus(plannedByMonth, actualYear, year, now),
    [plannedByMonth, actualYear, year, now],
  );

  const statusMetric = (() => {
    switch (status.kind) {
      case "not_started":
        return {
          label: t("ytdStatus"),
          value: t("budgetNotStarted"),
          accent: "muted" as const,
        };
      case "no_plan":
        return { label: t("ytdStatus"), value: "—", accent: "muted" as const };
      case "on_budget":
        return {
          label: status.phase === "ended" ? t("yearResult") : t("ytdStatus"),
          value: t("onBudget"),
          accent: "primary" as const,
        };
      case "under":
        return {
          label: status.phase === "ended" ? t("yearResult") : t("ytdStatus"),
          value: formatMoney(status.amount),
          supplemental: t("underBudget"),
          accent: "income" as const,
        };
      case "over":
        return {
          label: status.phase === "ended" ? t("yearResult") : t("ytdStatus"),
          value: formatMoney(status.amount),
          supplemental: t("overBudget"),
          accent: "expense" as const,
        };
    }
  })();

  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <section
      className={`almanac-grain border-border bg-card relative overflow-hidden rounded-[18px] border ${className}`}
      style={style}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-primary/10 absolute top-0 -left-24 h-72 w-72 rounded-full blur-3xl" />
        <div className="bg-accent absolute -right-24 bottom-0 h-56 w-56 rounded-full opacity-60 blur-3xl" />
      </div>

      {children}

      <div
        className={`relative ${
          compact
            ? "px-5 pt-6 pb-7 sm:px-8 sm:pt-7 sm:pb-8"
            : "px-6 pt-8 pb-10 md:px-10 md:pt-10 md:pb-12"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="almanac-smallcaps text-primary text-[11px]">
                {t("chapter")}
              </span>
              <span className="bg-primary/40 h-px w-10" />
              <span className="font-display text-foreground almanac-numerals text-lg">
                {year}
              </span>
              <PhasePill phase={phase} />
            </div>
            <Heading
              className={`font-display text-foreground mt-3 leading-[1.02] ${
                compact
                  ? "text-[clamp(1.75rem,3.5vw,2.75rem)]"
                  : "text-[clamp(2.25rem,4.5vw,3.75rem)]"
              }`}
            >
              {name}
            </Heading>
            {description && (
              <p className="text-muted-foreground mt-3 max-w-xl text-sm">
                {description}
              </p>
            )}
            <ScopeLine accountIds={accountIds} lineCount={lineCount} />
          </div>

          {actions && <div className="relative z-[2] shrink-0">{actions}</div>}
        </div>

        <div className="almanac-rule mt-8" />

        <dl
          className={`grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4 ${
            compact ? "mt-6" : "mt-8"
          }`}
        >
          <HeroMetric
            label={t("plannedForYear")}
            value={formatMoney(plannedYear)}
          />
          <HeroMetric
            label={t("spentToDate")}
            value={formatMoney(actualYear)}
            accent={
              actualYear > plannedYear
                ? "expense"
                : actualYear > 0
                  ? "income"
                  : "muted"
            }
          />
          <HeroMetric
            label={t("remainingForYear")}
            value={formatMoney(remaining)}
            accent={remaining < 0 ? "expense" : "muted"}
          />
          <HeroMetric
            label={statusMetric.label}
            value={statusMetric.value}
            supplemental={statusMetric.supplemental}
            accent={statusMetric.accent}
          />
        </dl>

        {plannedYear > 0 && (
          <div className={`space-y-3 ${compact ? "mt-8" : "mt-10"}`}>
            <div className="flex items-baseline justify-between">
              <span className="almanac-smallcaps text-muted-foreground text-[10px]">
                {t("twelveMonths")}
              </span>
              <span className="almanac-smallcaps text-muted-foreground text-[10px]">
                {t("usedPct", { pct: Math.round(pctUsed).toString() })}
              </span>
            </div>
            <div className="-mx-1">
              <YearRibbon
                planned={plannedByMonth}
                actual={actualByMonth}
                year={year}
                size="lg"
                currentMonthIndex={currentMonthIndex}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PhasePill({ phase }: { phase: "current" | "past" | "future" }) {
  const t = useTranslations("budgets");
  if (phase === "current") {
    return (
      <span className="bg-primary/10 text-primary almanac-smallcaps inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium">
        <span className="bg-primary h-1 w-1 animate-pulse rounded-full" />
        {t("current")}
      </span>
    );
  }
  return (
    <span className="bg-muted text-muted-foreground almanac-smallcaps inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium">
      {phase === "past" ? t("budgetEnded") : t("budgetUpcoming")}
    </span>
  );
}

function ScopeLine({
  accountIds,
  lineCount,
}: {
  accountIds: string[];
  lineCount: number;
}) {
  const t = useTranslations("budgets");
  const { data: accounts } = api.financialAccount.list.useQuery(undefined, {
    enabled: accountIds.length > 0,
  });

  const names = useMemo(() => {
    if (accountIds.length === 0 || !accounts) return null;
    const byId = new Map(accounts.map((a) => [a.id, a.name]));
    return accountIds
      .map((id) => byId.get(id))
      .filter((n): n is string => Boolean(n));
  }, [accountIds, accounts]);

  return (
    <p className="mt-4 flex flex-wrap items-center gap-2 text-xs">
      <span className="almanac-smallcaps text-muted-foreground text-[10px]">
        {t("scopedTo")}
      </span>
      {!names || names.length === 0 ? (
        <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5">
          {t("allAccounts")}
        </span>
      ) : (
        names.map((n) => (
          <span
            key={n}
            className="bg-accent text-accent-foreground inline-flex items-center rounded-full px-2 py-0.5"
          >
            {n}
          </span>
        ))
      )}
      <span aria-hidden className="text-muted-foreground/60">
        ·
      </span>
      <span className="almanac-numerals text-muted-foreground">
        {t("lineCount", { count: lineCount })}
      </span>
    </p>
  );
}

function HeroMetric({
  label,
  value,
  supplemental,
  accent = "muted",
}: {
  label: string;
  value: string;
  supplemental?: string;
  accent?: "muted" | "primary" | "income" | "expense";
}) {
  const color =
    accent === "income"
      ? "text-income"
      : accent === "expense"
        ? "text-expense"
        : accent === "primary"
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="min-w-0">
      <dt className="almanac-smallcaps text-muted-foreground text-[10px]">
        {label}
      </dt>
      <dd
        className={`font-display almanac-numerals mt-1.5 truncate text-[26px] leading-none ${color}`}
      >
        {value}
      </dd>
      {supplemental && (
        <p className={`almanac-numerals mt-1 text-[11px] ${color}`}>
          {supplemental}
        </p>
      )}
    </div>
  );
}
