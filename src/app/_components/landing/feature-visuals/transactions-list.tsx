import { SectionMarker } from "../section-marker";

type Row = {
  name: string;
  date: string;
  category: string;
  categoryToken: string;
  amount: string;
  income?: boolean;
  suggested?: boolean;
};

const ROWS: Row[] = [
  { name: "REMA 1000 · Frederiksberg", date: "24. apr.", category: "Dagligvarer", categoryToken: "var(--expense)", amount: "−486 kr." },
  { name: "Løn — april", date: "23. apr.", category: "Indkomst", categoryToken: "var(--income)", amount: "+21.793 kr.", income: true },
  { name: "DSB Rejsekort", date: "22. apr.", category: "Transport", categoryToken: "var(--savings)", amount: "−240 kr." },
  { name: "Netflix", date: "20. apr.", category: "Abonnementer", categoryToken: "var(--debt)", amount: "−119 kr.", suggested: true },
  { name: "Bilka · Fields", date: "19. apr.", category: "Dagligvarer", categoryToken: "var(--expense)", amount: "−1.284 kr." },
  { name: "Overførsel · Opsparing", date: "18. apr.", category: "Opsparing", categoryToken: "var(--savings)", amount: "−2.000 kr." },
];

export function TransactionsList() {
  return (
    <div className="relative w-full rounded-lg border border-border bg-card shadow-card">
      <div className="flex items-baseline justify-between p-5 pb-3">
        <SectionMarker>§ Transaktioner · April 2026</SectionMarker>
        <span className="almanac-smallcaps text-[10px] tracking-[0.18em] text-muted-foreground">
          06 poster
        </span>
      </div>
      <div className="almanac-rule" />

      <ul className="divide-y divide-border">
        {ROWS.map((r, i) => (
          <li
            key={i}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3 text-sm"
          >
            <div className="almanac-numerals w-12 text-[11px] tracking-tight text-muted-foreground">
              {r.date}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">{r.name}</div>
              <div className="mt-0.5 flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: r.categoryToken }}
                />
                <span className="almanac-smallcaps text-[9px] tracking-[0.18em] text-muted-foreground">
                  {r.category}
                </span>
                {r.suggested && (
                  <span className="almanac-smallcaps rounded-sm border border-primary/40 bg-primary/5 px-1.5 py-0.5 text-[8px] tracking-[0.18em] text-primary">
                    Forslag
                  </span>
                )}
              </div>
            </div>
            <div
              className={`almanac-numerals font-display text-base tabular-nums ${
                r.income ? "text-income" : "text-foreground"
              }`}
            >
              {r.amount}
            </div>
          </li>
        ))}
      </ul>

      <div className="almanac-rule" />
      <div className="flex items-center justify-between p-4 text-sm">
        <span className="almanac-smallcaps text-[10px] tracking-[0.18em] text-muted-foreground">
          Netto · April
        </span>
        <span className="almanac-numerals font-display text-base text-income">
          +17.664 kr.
        </span>
      </div>
    </div>
  );
}
