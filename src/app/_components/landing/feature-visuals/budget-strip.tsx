import { SectionMarker } from "../section-marker";

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAJ",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OKT",
  "NOV",
  "DEC",
];
const MONTHS_SHORT = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];

const PLANNED = [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8];
const ACTUAL = [7.2, 7.9, 8.4, 6.32, 0, 0, 0, 0, 0, 0, 0, 0];
const CURRENT_INDEX = 3;

export function BudgetStrip() {
  const max = 10;
  return (
    <div className="border-border bg-card shadow-card relative w-full rounded-lg border p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <SectionMarker>§ Årsbudget · 2026</SectionMarker>
          <div className="font-display text-foreground mt-2 text-xl">
            Dagligvarer
          </div>
        </div>
        <div className="text-right">
          <div className="almanac-numerals font-display text-foreground text-2xl">
            29.820 <span className="text-muted-foreground text-base">kr.</span>
          </div>
          <div className="almanac-smallcaps text-muted-foreground mt-0.5 text-[10px] tracking-[0.18em]">
            År til dato
          </div>
        </div>
      </div>

      <div className="almanac-rule mt-5" />

      <div className="mt-5 flex items-end gap-1.5">
        {MONTHS.map((m, i) => {
          const planned = PLANNED[i] ?? 0;
          const actual = ACTUAL[i] ?? 0;
          const isCurrent = i === CURRENT_INDEX;
          const isOver = actual > planned;
          const plannedH = (planned / max) * 100;
          const actualH = (actual / max) * 100;
          return (
            <div key={m} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex h-24 w-full items-end justify-center">
                <div
                  aria-hidden
                  className="absolute bottom-0 left-1/2 w-2 -translate-x-1/2 rounded-sm bg-(--expense-muted)"
                  style={{ height: `${plannedH}%` }}
                />
                {actual > 0 && (
                  <div
                    aria-hidden
                    className="absolute bottom-0 left-1/2 w-2 -translate-x-1/2 rounded-sm"
                    style={{
                      height: `${actualH}%`,
                      backgroundColor: isOver
                        ? "var(--expense)"
                        : "var(--income)",
                      opacity: isCurrent ? 1 : 0.55,
                    }}
                  />
                )}
                {isCurrent && (
                  <div
                    aria-hidden
                    className="bg-primary absolute -top-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                  />
                )}
              </div>
              <div
                className={`almanac-smallcaps text-[9px] tracking-[0.14em] ${
                  isCurrent ? "text-primary" : "text-muted-foreground/70"
                }`}
              >
                <span className="sm:hidden">{MONTHS_SHORT[i]}</span>
                <span className="hidden sm:inline">{m}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
