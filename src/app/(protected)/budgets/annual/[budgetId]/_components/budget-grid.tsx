"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { cn } from "~/app/_lib/utils";
import { Button } from "~/app/_components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/app/_components/tooltip";
import { formatMoney } from "~/app/(protected)/income-planner/_lib/format";
import {
  cellState,
  fillClass,
  parseMonthsLong,
  parseMonthsShort,
  sumArray,
  trackClass,
  varianceTextClass,
} from "../../_lib/budget-format";
import { buildBudgetTree, type CategoryGroup } from "../../_lib/budget-tree";
import { LineCell } from "./line-cell";
import type { DrillDownTarget } from "./budget-transactions-sheet";

function collectGroupCategoryIds(group: CategoryGroup): {
  ids: string[];
  includeUncategorized?: boolean;
} {
  if (group.id === "__orphan") return { ids: [], includeUncategorized: true };
  const ids = new Set<string>();
  if (group.category) ids.add(group.category.id);
  for (const sub of group.subgroups) {
    if (sub.category) ids.add(sub.category.id);
    for (const ln of sub.lines)
      if (ln.line.categoryId) ids.add(ln.line.categoryId);
  }
  for (const ln of group.lines)
    if (ln.line.categoryId) ids.add(ln.line.categoryId);
  return { ids: Array.from(ids) };
}

function collectAllCategoryIds(tree: CategoryGroup[]): {
  ids: string[];
  includeUncategorized?: boolean;
} {
  const ids = new Set<string>();
  let includeOrphan = false;
  for (const g of tree) {
    const part = collectGroupCategoryIds(g);
    part.ids.forEach((i) => ids.add(i));
    if (part.includeUncategorized) includeOrphan = true;
  }
  return {
    ids: Array.from(ids),
    includeUncategorized: includeOrphan || undefined,
  };
}

type BudgetDetail = RouterOutputs["budget"]["get"];
type Line = BudgetDetail["lines"][number];

// Unified summary cell: planned amount + thermometer + colour-coded variance.
// Used on every roll-up surface (category rows, sub-category rows, column
// month totals, and the row/year totals) so they read identically.
//
// When a `tooltip` is provided, the cell is wrapped in a hover tooltip
// revealing the richer breakdown (planned / actual / variance / % of plan).
function SummaryCell({
  planned,
  actual,
  size = "sm",
  align = "start",
  tooltip,
  onClick,
}: {
  planned: number;
  actual: number;
  size?: "sm" | "lg";
  align?: "start" | "end";
  tooltip?: { title: string; subtitle?: string };
  onClick?: () => void;
}) {
  const state = cellState(planned, actual);
  const ratio = planned > 0 ? actual / planned : actual > 0 ? 1 : 0;
  const fillPct = Math.min(100, Math.max(0, ratio * 100));
  const overshootPct =
    planned > 0 && actual > planned
      ? Math.min(40, ((actual - planned) / planned) * 100)
      : 0;
  const variance = actual - planned;
  const prefix = variance > 0 ? "+" : variance < 0 ? "−" : "";

  const plannedSize =
    size === "lg"
      ? "font-display text-xl leading-none"
      : "text-[11px] leading-tight";
  const varianceSize = size === "lg" ? "text-[12px]" : "text-[10px]";
  const barHeight = size === "lg" ? "h-[5px]" : "h-[4px]";
  const barWidth = align === "end" ? "w-20 self-end" : "";

  const inner = (
    <>
      <span
        className={`almanac-numerals truncate ${plannedSize} ${
          planned > 0 ? "text-foreground" : "text-muted-foreground/60"
        }`}
      >
        {planned > 0 ? formatMoney(planned) : "—"}
      </span>
      {(planned > 0 || actual > 0) && (
        <div
          className={`relative ${barHeight} ${barWidth} overflow-hidden rounded-full ${trackClass(
            state,
          )}`}
        >
          {fillPct > 0 && (
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-out ${fillClass(
                state,
              )}`}
              style={{ width: `${fillPct}%` }}
            />
          )}
          {overshootPct > 0 && (
            <div
              className="absolute inset-y-0 right-0 bg-expense/80"
              style={{ width: `${overshootPct}%` }}
            />
          )}
        </div>
      )}
      {actual > 0 && (
        <span
          className={`almanac-numerals truncate ${varianceSize} leading-none ${varianceTextClass(
            planned,
            actual,
          )}`}
        >
          {prefix}
          {formatMoney(Math.abs(variance))}
        </span>
      )}
    </>
  );

  const body = onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 text-right",
        "-m-1 w-full cursor-pointer rounded-md p-1 transition-colors",
        "hover:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
    >
      {inner}
    </button>
  ) : (
    <div
      className={cn(
        "flex flex-col gap-1 text-right",
        tooltip && "cursor-default",
      )}
    >
      {inner}
    </div>
  );

  if (!tooltip) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent side="top" className="p-0">
        <SummaryTooltip
          title={tooltip.title}
          subtitle={tooltip.subtitle}
          planned={planned}
          actual={actual}
        />
      </TooltipContent>
    </Tooltip>
  );
}

function SummaryTooltip({
  title,
  subtitle,
  planned,
  actual,
}: {
  title: string;
  subtitle?: string;
  planned: number;
  actual: number;
}) {
  const tT = useTranslations("budgets");
  const variance = actual - planned;
  const pctOfPlan =
    planned > 0 ? Math.round((actual / planned) * 100) : actual > 0 ? null : 0;
  const varianceLabel =
    variance > 0 ? tT("overBy") : variance < 0 ? tT("remaining") : tT("onBudget");
  const varianceColor =
    variance > 0
      ? "text-expense"
      : variance < 0
        ? "text-income"
        : "text-muted-foreground";

  const state = cellState(planned, actual);
  const ratio = planned > 0 ? actual / planned : actual > 0 ? 1 : 0;
  const fillPct = Math.min(100, Math.max(0, ratio * 100));
  const overshootPct =
    planned > 0 && actual > planned
      ? Math.min(40, ((actual - planned) / planned) * 100)
      : 0;

  return (
    <div className="w-64 px-4 py-3 text-left">
      <p className="almanac-smallcaps text-[10px] text-muted-foreground">
        {title}
      </p>
      {subtitle && (
        <p className="mt-0.5 truncate font-display text-base leading-tight text-foreground">
          {subtitle}
        </p>
      )}

      {(planned > 0 || actual > 0) && (
        <div className="mt-3 space-y-1.5">
          <div
            className={`relative h-2.5 overflow-hidden rounded-full ${trackClass(
              state,
            )}`}
          >
            {fillPct > 0 && (
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${fillClass(
                  state,
                )}`}
                style={{ width: `${fillPct}%` }}
              />
            )}
            {overshootPct > 0 && (
              <div
                className="absolute inset-y-0 right-0 bg-expense/80"
                style={{ width: `${overshootPct}%` }}
              />
            )}
          </div>
          {pctOfPlan !== null && actual > 0 && (
            <div className="flex items-center justify-between text-[10px] almanac-smallcaps">
              <span className="text-muted-foreground">{tT("pace")}</span>
              <span className={varianceColor}>
                {tT("usedPct", { pct: String(pctOfPlan) })}
              </span>
            </div>
          )}
        </div>
      )}

      <dl className="mt-3 space-y-1.5 text-[12px]">
        <Row label={tT("cellPlanned")} value={formatMoney(planned)} />
        {actual > 0 && (
          <Row
            label={tT("cellActual")}
            value={formatMoney(actual)}
            valueClass={varianceColor}
          />
        )}
        {actual > 0 && (
          <Row
            label={varianceLabel}
            value={formatMoney(Math.abs(variance))}
            valueClass={varianceColor}
          />
        )}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`almanac-numerals ${valueClass ?? "text-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}

export function BudgetGrid({
  budget,
  onEditLine,
  onDeleteLine,
  onUpdateCell,
  onAddLine,
  onDrillDown,
  currentMonthIndex,
}: {
  budget: BudgetDetail;
  onEditLine: (line: Line) => void;
  onDeleteLine: (line: Line) => void;
  onUpdateCell: (lineId: string, monthIndex: number, amount: number) => void;
  onAddLine: () => void;
  onDrillDown: (target: DrillDownTarget) => void;
  currentMonthIndex: number | null;
}) {
  const t = useTranslations("budgets");
  const months = useMemo(() => parseMonthsShort(t("monthsShort")), [t]);
  const monthsLong = useMemo(() => parseMonthsLong(t("monthsLong")), [t]);

  const { data: categories } = api.category.list.useQuery();

  const tree = useMemo(() => {
    return buildBudgetTree(
      budget.lines,
      categories ?? [],
      budget.categoryActuals,
      t("categoryDeleted"),
    );
  }, [budget.lines, budget.categoryActuals, categories, t]);

  const totals = useMemo(() => {
    const plannedByMonth = new Array<number>(12).fill(0);
    const actualByMonth = new Array<number>(12).fill(0);
    for (const g of tree) {
      for (let i = 0; i < 12; i++) {
        plannedByMonth[i]! += g.plannedByMonth[i] ?? 0;
        actualByMonth[i]! += g.actualByMonth[i] ?? 0;
      }
    }
    return {
      plannedByMonth,
      actualByMonth,
      plannedYear: sumArray(plannedByMonth),
      actualYear: sumArray(actualByMonth),
    };
  }, [tree]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalsTarget = useMemo(
    () => collectAllCategoryIds(tree),
    [tree],
  );

  const groupTarget = (
    group: CategoryGroup | null,
    monthIndex: number | null,
    label: string,
    planned: number,
    actual: number,
  ): DrillDownTarget => {
    const part =
      group === null ? totalsTarget : collectGroupCategoryIds(group);
    return {
      key: `${group?.id ?? "__totals"}::${monthIndex ?? "year"}`,
      label,
      icon: group?.icon ?? null,
      categoryIds: part.ids,
      includeUncategorized: part.includeUncategorized,
      monthIndex,
      year: budget.year,
      accountIds: budget.accountIds,
      planned,
      actual,
    };
  };

  if (budget.lines.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[14px] border border-dashed border-border bg-card px-6 py-16 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
        >
          <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-md">
          <p className="almanac-smallcaps text-[10px] text-primary/80">
            {t("firstEntry")}
          </p>
          <h3 className="mt-2 font-display text-2xl text-foreground">
            {t("linesEmptyHeadline")}
          </h3>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("linesEmptyDescription")}
          </p>
          <Button className="mt-6" onClick={onAddLine}>
            <Plus />
            {t("addFirstLine")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <MobileBudget
        tree={tree}
        totals={totals}
        months={months}
        monthsLong={monthsLong}
        currentMonthIndex={currentMonthIndex}
        expanded={expanded}
        onToggle={toggle}
        onEditLine={onEditLine}
        onDeleteLine={onDeleteLine}
        onUpdateCell={onUpdateCell}
        makeTarget={groupTarget}
        onDrillDown={onDrillDown}
      />
      <div className="relative hidden w-full min-w-0 max-w-full overflow-hidden rounded-[14px] border border-border bg-card shadow-card md:block">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-30 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, hsl(38 60% 50% / 0.5) 50%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-card to-transparent"
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <colgroup>
            <col className="w-[14rem]" />
            {months.map((m) => (
              <col key={m} className="w-[92px]" />
            ))}
            <col className="w-[128px]" />
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 bg-card px-4 py-3 text-left"
              >
                <span className="almanac-smallcaps text-[10px] text-muted-foreground">
                  {t("categoryLineHeader")}
                </span>
              </th>
              {months.map((m, i) => {
                const isCurrent = currentMonthIndex === i;
                return (
                  <th
                    key={m}
                    scope="col"
                    className={`px-2 py-3 text-left ${
                      isCurrent ? "bg-primary/[0.04]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={`almanac-smallcaps text-[10px] ${
                          isCurrent ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {m}
                      </span>
                      {isCurrent && (
                        <span
                          aria-hidden
                          className="h-1 w-1 rounded-full bg-primary"
                        />
                      )}
                    </div>
                  </th>
                );
              })}
              <th scope="col" className="px-4 py-3 text-right">
                <span className="almanac-smallcaps text-[10px] text-muted-foreground">
                  {t("yearTotal")}
                </span>
              </th>
              <th scope="col" className="px-1 py-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {tree.map((group) => (
              <GroupRows
                key={group.id}
                group={group}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                months={months}
                monthsLong={monthsLong}
                currentMonthIndex={currentMonthIndex}
                onEditLine={onEditLine}
                onDeleteLine={onDeleteLine}
                onUpdateCell={onUpdateCell}
                makeTarget={groupTarget}
                onDrillDown={onDrillDown}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary/30 bg-muted/50">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-muted px-4 py-3 text-left"
              >
                <span className="almanac-smallcaps text-[10px] text-muted-foreground">
                  {t("totals")}
                </span>
              </th>
              {months.map((m, i) => (
                <td
                  key={m}
                  className={`px-2 py-3 align-middle ${
                    currentMonthIndex === i ? "bg-primary/[0.03]" : ""
                  }`}
                >
                  <SummaryCell
                    planned={totals.plannedByMonth[i] ?? 0}
                    actual={totals.actualByMonth[i] ?? 0}
                    tooltip={{ title: monthsLong[i]!, subtitle: t("totals") }}
                    onClick={() =>
                      onDrillDown(
                        groupTarget(
                          null,
                          i,
                          t("totals"),
                          totals.plannedByMonth[i] ?? 0,
                          totals.actualByMonth[i] ?? 0,
                        ),
                      )
                    }
                  />
                </td>
              ))}
              <td className="px-4 py-3 align-middle text-right">
                <SummaryCell
                  planned={totals.plannedYear}
                  actual={totals.actualYear}
                  size="lg"
                  align="end"
                  tooltip={{ title: t("yearTotal"), subtitle: t("totals") }}
                  onClick={() =>
                    onDrillDown(
                      groupTarget(
                        null,
                        null,
                        t("totals"),
                        totals.plannedYear,
                        totals.actualYear,
                      ),
                    )
                  }
                />
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    </>
  );
}

function GroupRows({
  group,
  depth,
  expanded,
  onToggle,
  months,
  monthsLong,
  currentMonthIndex,
  onEditLine,
  onDeleteLine,
  onUpdateCell,
  makeTarget,
  onDrillDown,
}: {
  group: CategoryGroup;
  depth: 0 | 1;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  months: string[];
  monthsLong: string[];
  currentMonthIndex: number | null;
  onEditLine: (line: Line) => void;
  onDeleteLine: (line: Line) => void;
  onUpdateCell: (lineId: string, monthIndex: number, amount: number) => void;
  makeTarget: (
    group: CategoryGroup | null,
    monthIndex: number | null,
    label: string,
    planned: number,
    actual: number,
  ) => DrillDownTarget;
  onDrillDown: (target: DrillDownTarget) => void;
}) {
  const t = useTranslations("budgets");
  const isExpanded = expanded.has(group.id);
  const hasChildren = group.lines.length > 0 || group.subgroups.length > 0;
  const rowPlanned = sumArray(group.plannedByMonth);
  const rowActual = sumArray(group.actualByMonth);

  return (
    <>
      <tr
        className={`group/row border-t ${
          depth === 0
            ? "border-border"
            : "border-border/50 bg-muted/[0.15]"
        } transition-colors hover:bg-muted/40`}
      >
        <th
          scope="row"
          className={`sticky left-0 z-10 px-4 py-3 text-left align-middle ${
            depth === 0
              ? "bg-card group-hover/row:bg-muted"
              : "bg-muted group-hover/row:bg-muted"
          }`}
        >
          <button
            type="button"
            onClick={() => hasChildren && onToggle(group.id)}
            aria-expanded={isExpanded}
            className={`flex w-full items-center gap-2.5 text-left ${
              hasChildren ? "cursor-pointer" : "cursor-default"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-transform ${
                isExpanded ? "rotate-90" : ""
              } ${depth === 1 ? "ml-5" : ""}`}
            >
              {hasChildren && <ChevronRight className="h-3.5 w-3.5" />}
            </span>
            {group.icon ? (
              <span
                aria-hidden
                className={`flex shrink-0 items-center justify-center rounded-full bg-accent leading-none ${
                  depth === 0 ? "h-8 w-8 text-base" : "h-6 w-6 text-sm"
                }`}
              >
                {group.icon}
              </span>
            ) : (
              <span
                aria-hidden
                className={`flex shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[10px] uppercase text-muted-foreground ${
                  depth === 0 ? "h-8 w-8" : "h-6 w-6"
                }`}
              >
                ·
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div
                className={`truncate leading-tight ${
                  depth === 0
                    ? "font-display text-[15px] text-foreground"
                    : "font-medium text-sm text-foreground"
                } ${group.archived ? "text-muted-foreground line-through" : ""}`}
              >
                {group.label}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {t("lineCount", {
                  count:
                    group.lines.length +
                    group.subgroups.reduce((a, s) => a + s.lines.length, 0),
                })}
              </div>
            </div>
          </button>
        </th>
        {group.plannedByMonth.map((planned, i) => (
          <td
            key={i}
            className={cn(
              "px-2 py-2 align-middle",
              currentMonthIndex === i && "bg-primary/[0.02]",
            )}
          >
            <SummaryCell
              planned={planned}
              actual={group.actualByMonth[i] ?? 0}
              tooltip={{ title: monthsLong[i]!, subtitle: group.label }}
              onClick={() =>
                onDrillDown(
                  makeTarget(
                    group,
                    i,
                    group.label,
                    planned,
                    group.actualByMonth[i] ?? 0,
                  ),
                )
              }
            />
          </td>
        ))}
        <td className="px-4 py-3 align-middle">
          <SummaryCell
            planned={rowPlanned}
            actual={rowActual}
            align="end"
            tooltip={{ title: t("yearTotal"), subtitle: group.label }}
            onClick={() =>
              onDrillDown(
                makeTarget(group, null, group.label, rowPlanned, rowActual),
              )
            }
          />
        </td>
        <td aria-hidden className="px-1 py-3" />
      </tr>
      {isExpanded &&
        group.lines.map((ln, lineIdx) => (
          <LineRow
            key={ln.id}
            line={ln.line}
            depth={depth === 0 ? 1 : 2}
            animDelay={lineIdx * 30}
            months={months}
            currentMonthIndex={currentMonthIndex}
            onEditLine={onEditLine}
            onDeleteLine={onDeleteLine}
            onUpdateCell={onUpdateCell}
          />
        ))}
      {isExpanded &&
        group.subgroups.map((sub) => (
          <GroupRows
            key={sub.id}
            group={sub}
            depth={1}
            expanded={expanded}
            onToggle={onToggle}
            months={months}
            monthsLong={monthsLong}
            currentMonthIndex={currentMonthIndex}
            onEditLine={onEditLine}
            onDeleteLine={onDeleteLine}
            onUpdateCell={onUpdateCell}
            makeTarget={makeTarget}
            onDrillDown={onDrillDown}
          />
        ))}
    </>
  );
}

function LineRow({
  line,
  depth,
  animDelay,
  months,
  currentMonthIndex,
  onEditLine,
  onDeleteLine,
  onUpdateCell,
}: {
  line: Line;
  depth: 1 | 2;
  animDelay: number;
  months: string[];
  currentMonthIndex: number | null;
  onEditLine: (line: Line) => void;
  onDeleteLine: (line: Line) => void;
  onUpdateCell: (lineId: string, monthIndex: number, amount: number) => void;
}) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const rowTotal = sumArray(line.amounts);
  const indent = depth === 1 ? "pl-11" : "pl-16";

  return (
    <tr
      className="group/row border-t border-border/40 transition-colors hover:bg-muted/30"
      style={{
        animation: "almanac-rise 0.35s ease-out backwards",
        animationDelay: `${animDelay}ms`,
      }}
    >
      <th
        scope="row"
        className="sticky left-0 z-10 bg-card px-4 py-2 text-left align-middle group-hover/row:bg-muted"
      >
        <div className={`flex items-center gap-2 ${indent}`}>
          <div className="min-w-0">
            <div className="truncate text-[13px] leading-tight text-foreground">
              {line.name}
            </div>
            <div className="mt-0.5">
              <span className="inline-flex items-center rounded-sm bg-muted/70 px-1.5 py-px text-[9px] uppercase tracking-wider text-muted-foreground">
                {t(`recurrences.${line.recurrence}`)}
              </span>
            </div>
          </div>
        </div>
      </th>
      {line.amounts.map((planned, i) => (
        <td
          key={i}
          className={`p-0 align-middle ${
            currentMonthIndex === i ? "bg-primary/[0.02]" : ""
          }`}
        >
          <LineCell
            planned={planned}
            monthLabel={months[i]!}
            isCurrent={currentMonthIndex === i}
            onSave={(amount) => onUpdateCell(line.id, i, amount)}
          />
        </td>
      ))}
      <td className="px-4 py-2 align-middle text-right">
        <span className="almanac-numerals text-sm text-muted-foreground">
          {formatMoney(rowTotal)}
        </span>
      </td>
      <td className="px-1 py-2 align-middle">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-50 group-hover/row:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditLine(line)}>
              <Pencil />
              {tCommon("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDeleteLine(line)}
            >
              <Trash2 />
              {t("deleteLine")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Mobile layout — vertical cards driven by a single selected-month switcher.
// Renders below the md breakpoint; desktop table above continues to handle ≥md.
// ---------------------------------------------------------------------------

function MobileBudget({
  tree,
  totals,
  months,
  monthsLong,
  currentMonthIndex,
  expanded,
  onToggle,
  onEditLine,
  onDeleteLine,
  onUpdateCell,
  makeTarget,
  onDrillDown,
}: {
  tree: CategoryGroup[];
  totals: {
    plannedByMonth: number[];
    actualByMonth: number[];
    plannedYear: number;
    actualYear: number;
  };
  months: string[];
  monthsLong: string[];
  currentMonthIndex: number | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEditLine: (line: Line) => void;
  onDeleteLine: (line: Line) => void;
  onUpdateCell: (lineId: string, monthIndex: number, amount: number) => void;
  makeTarget: (
    group: CategoryGroup | null,
    monthIndex: number | null,
    label: string,
    planned: number,
    actual: number,
  ) => DrillDownTarget;
  onDrillDown: (target: DrillDownTarget) => void;
}) {
  const t = useTranslations("budgets");
  const initialMonth = currentMonthIndex ?? 0;
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);

  const goPrev = () => setSelectedMonth((m) => (m + 11) % 12);
  const goNext = () => setSelectedMonth((m) => (m + 1) % 12);

  return (
    <div className="space-y-3 md:hidden">
      <div className="flex items-center justify-between rounded-[12px] border border-border bg-card px-2 py-2 shadow-card">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("previousMonth")}
          onClick={goPrev}
          className="h-10 w-10"
        >
          <ChevronLeft />
        </Button>
        <div className="flex flex-col items-center">
          <span className="almanac-smallcaps text-[10px] text-muted-foreground">
            {months[selectedMonth]}
          </span>
          <span className="font-display text-lg leading-tight text-foreground">
            {monthsLong[selectedMonth]}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("nextMonth")}
          onClick={goNext}
          className="h-10 w-10"
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="rounded-[12px] border border-border bg-card px-4 py-3 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="almanac-smallcaps text-[10px] text-muted-foreground">
              {monthsLong[selectedMonth]} · {t("totals")}
            </p>
          </div>
          <SummaryCell
            planned={totals.plannedByMonth[selectedMonth] ?? 0}
            actual={totals.actualByMonth[selectedMonth] ?? 0}
            size="lg"
            align="end"
            onClick={() =>
              onDrillDown(
                makeTarget(
                  null,
                  selectedMonth,
                  t("totals"),
                  totals.plannedByMonth[selectedMonth] ?? 0,
                  totals.actualByMonth[selectedMonth] ?? 0,
                ),
              )
            }
          />
        </div>
        <div className="almanac-rule my-3" />
        <div className="flex items-center justify-between gap-3">
          <p className="almanac-smallcaps text-[10px] text-muted-foreground">
            {t("yearTotal")}
          </p>
          <SummaryCell
            planned={totals.plannedYear}
            actual={totals.actualYear}
            align="end"
            onClick={() =>
              onDrillDown(
                makeTarget(
                  null,
                  null,
                  t("totals"),
                  totals.plannedYear,
                  totals.actualYear,
                ),
              )
            }
          />
        </div>
      </div>

      {tree.map((group) => (
        <MobileGroupCard
          key={group.id}
          group={group}
          depth={0}
          selectedMonth={selectedMonth}
          monthsLong={monthsLong}
          months={months}
          expanded={expanded}
          onToggle={onToggle}
          onEditLine={onEditLine}
          onDeleteLine={onDeleteLine}
          onUpdateCell={onUpdateCell}
          makeTarget={makeTarget}
          onDrillDown={onDrillDown}
        />
      ))}
    </div>
  );
}

function MobileGroupCard({
  group,
  depth,
  selectedMonth,
  monthsLong,
  months,
  expanded,
  onToggle,
  onEditLine,
  onDeleteLine,
  onUpdateCell,
  makeTarget,
  onDrillDown,
}: {
  group: CategoryGroup;
  depth: 0 | 1;
  selectedMonth: number;
  monthsLong: string[];
  months: string[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEditLine: (line: Line) => void;
  onDeleteLine: (line: Line) => void;
  onUpdateCell: (lineId: string, monthIndex: number, amount: number) => void;
  makeTarget: (
    group: CategoryGroup | null,
    monthIndex: number | null,
    label: string,
    planned: number,
    actual: number,
  ) => DrillDownTarget;
  onDrillDown: (target: DrillDownTarget) => void;
}) {
  const t = useTranslations("budgets");
  const isExpanded = expanded.has(group.id);
  const hasChildren = group.lines.length > 0 || group.subgroups.length > 0;
  const lineCount =
    group.lines.length +
    group.subgroups.reduce((a, s) => a + s.lines.length, 0);
  const planned = group.plannedByMonth[selectedMonth] ?? 0;
  const actual = group.actualByMonth[selectedMonth] ?? 0;

  return (
    <div
      className={cn(
        depth === 0
          ? "rounded-[12px] border border-border bg-card shadow-card"
          : "rounded-[10px] border border-border/60 bg-muted/[0.25]",
      )}
    >
      <div className="flex items-stretch gap-2 px-3 py-3">
        <button
          type="button"
          onClick={() => hasChildren && onToggle(group.id)}
          aria-expanded={isExpanded}
          className={cn(
            "flex flex-1 items-center gap-3 text-left",
            hasChildren ? "cursor-pointer" : "cursor-default",
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-transform",
              isExpanded && "rotate-90",
            )}
          >
            {hasChildren && <ChevronRight className="h-4 w-4" />}
          </span>
          {group.icon ? (
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-base leading-none"
            >
              {group.icon}
            </span>
          ) : (
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[10px] uppercase text-muted-foreground"
            >
              ·
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "truncate leading-tight",
                depth === 0
                  ? "font-display text-[15px] text-foreground"
                  : "text-sm font-medium text-foreground",
                group.archived && "text-muted-foreground line-through",
              )}
            >
              {group.label}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {t("lineCount", { count: lineCount })}
            </div>
          </div>
        </button>
        <div className="shrink-0 self-center">
          <SummaryCell
            planned={planned}
            actual={actual}
            align="end"
            onClick={() =>
              onDrillDown(
                makeTarget(group, selectedMonth, group.label, planned, actual),
              )
            }
          />
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border/60">
          {group.lines.map((ln) => (
            <MobileLineRow
              key={ln.id}
              line={ln.line}
              selectedMonth={selectedMonth}
              monthLabel={monthsLong[selectedMonth] ?? ""}
              onEditLine={onEditLine}
              onDeleteLine={onDeleteLine}
              onUpdateCell={onUpdateCell}
            />
          ))}
          {group.subgroups.length > 0 && (
            <div className="space-y-2 px-2 py-2">
              {group.subgroups.map((sub) => (
                <MobileGroupCard
                  key={sub.id}
                  group={sub}
                  depth={1}
                  selectedMonth={selectedMonth}
                  monthsLong={monthsLong}
                  months={months}
                  expanded={expanded}
                  onToggle={onToggle}
                  onEditLine={onEditLine}
                  onDeleteLine={onDeleteLine}
                  onUpdateCell={onUpdateCell}
                  makeTarget={makeTarget}
                  onDrillDown={onDrillDown}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MobileLineRow({
  line,
  selectedMonth,
  monthLabel,
  onEditLine,
  onDeleteLine,
  onUpdateCell,
}: {
  line: Line;
  selectedMonth: number;
  monthLabel: string;
  onEditLine: (line: Line) => void;
  onDeleteLine: (line: Line) => void;
  onUpdateCell: (lineId: string, monthIndex: number, amount: number) => void;
}) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const planned = line.amounts[selectedMonth] ?? 0;

  return (
    <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] leading-tight text-foreground">
          {line.name}
        </div>
        <div className="mt-0.5">
          <span className="inline-flex items-center rounded-sm bg-muted/70 px-1.5 py-px text-[9px] uppercase tracking-wider text-muted-foreground">
            {t(`recurrences.${line.recurrence}`)}
          </span>
        </div>
      </div>
      <div className="w-24 shrink-0">
        <LineCell
          planned={planned}
          monthLabel={monthLabel}
          onSave={(amount) => onUpdateCell(line.id, selectedMonth, amount)}
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEditLine(line)}>
            <Pencil />
            {tCommon("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDeleteLine(line)}
          >
            <Trash2 />
            {t("deleteLine")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
