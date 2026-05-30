import { SectionMarker } from "../section-marker";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAJ", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"];
const MONTHS_SHORT = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const PLANNED = [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8];
const ACTUAL = [7.2, 7.9, 8.4, 6.32, 0, 0, 0, 0, 0, 0, 0, 0];
const CURRENT_INDEX = 3;

export function BudgetStrip() {
  const max = 10;
  return (
    <div className="relative w-full rounded-lg border border-border bg-card p-6 shadow-card">
      <div className="flex items-baseline justify-between">
        <div>
          <SectionMarker>§ Årsbudget · 2026</SectionMarker>
          <div className="mt-2 font-display text-xl text-foreground">Dagligvarer</div>
        </div>
        <div className="text-right">
          <div className="almanac-numerals text-2xl font-display text-foreground">
            29.820 <span className="text-base text-muted-foreground">kr.</span>
          </div>
          <div className="almanac-smallcaps mt-0.5 text-[10px] tracking-[0.18em] text-muted-foreground">
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
                      backgroundColor: isOver ? "var(--expense)" : "var(--income)",
                      opacity: isCurrent ? 1 : 0.55,
                    }}
                  />
                )}
                {isCurrent && (
                  <div
                    aria-hidden
                    className="absolute -top-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"
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
