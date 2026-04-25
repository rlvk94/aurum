import { SectionMarker } from "../section-marker";

const PERCENT = 62;

export function ChallengeDial() {
  const r = 60;
  const c = 2 * Math.PI * r;
  const dash = (PERCENT / 100) * c;

  return (
    <div className="relative w-full rounded-lg border border-border bg-card p-6 shadow-card">
      <div className="flex items-baseline justify-between">
        <SectionMarker>§ Udfordring · 20.–26. apr. 2026</SectionMarker>
        <span className="almanac-smallcaps text-[10px] tracking-[0.18em] text-warning">
          1 dag tilbage
        </span>
      </div>

      <div className="mt-3 font-display text-xl text-foreground">Take-away ≤ 500 kr.</div>

      <div className="mt-6 flex items-center gap-6">
        <div className="relative h-40 w-40 shrink-0">
          <svg viewBox="0 0 144 144" className="h-full w-full -rotate-90">
            <circle
              cx="72"
              cy="72"
              r={r}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="6"
            />
            <circle
              cx="72"
              cy="72"
              r={r}
              fill="none"
              stroke="var(--warning)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="almanac-numerals font-display text-3xl text-foreground">
              {PERCENT}
              <span className="text-lg text-muted-foreground">%</span>
            </div>
            <div className="almanac-smallcaps mt-1 text-[9px] tracking-[0.18em] text-muted-foreground">
              brugt
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 text-sm">
          <div>
            <div className="almanac-smallcaps text-[9px] tracking-[0.18em] text-muted-foreground">
              Brugt
            </div>
            <div className="almanac-numerals font-display text-lg text-foreground">
              310 kr.
            </div>
          </div>
          <div className="almanac-rule" />
          <div>
            <div className="almanac-smallcaps text-[9px] tracking-[0.18em] text-muted-foreground">
              Tilbage
            </div>
            <div className="almanac-numerals font-display text-lg text-warning">
              190 kr.
            </div>
          </div>
          <div className="almanac-rule" />
          <div>
            <div className="almanac-smallcaps text-[9px] tracking-[0.18em] text-muted-foreground">
              Mål
            </div>
            <div className="almanac-numerals font-display text-lg text-muted-foreground">
              500 kr.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
