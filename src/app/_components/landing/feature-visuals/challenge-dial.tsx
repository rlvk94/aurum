import { SectionMarker } from "../section-marker";

const PERCENT = 62;

export function ChallengeDial() {
  const r = 60;
  const c = 2 * Math.PI * r;
  const dash = (PERCENT / 100) * c;

  return (
    <div className="border-border bg-card shadow-card relative w-full rounded-lg border p-6">
      <div className="flex items-baseline justify-between">
        <SectionMarker>§ Udfordring · 20.–26. apr. 2026</SectionMarker>
        <span className="almanac-smallcaps text-warning text-[10px] tracking-[0.18em]">
          1 dag tilbage
        </span>
      </div>

      <div className="font-display text-foreground mt-3 text-xl">
        Take-away ≤ 500 kr.
      </div>

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
            <div className="almanac-numerals font-display text-foreground text-3xl">
              {PERCENT}
              <span className="text-muted-foreground text-lg">%</span>
            </div>
            <div className="almanac-smallcaps text-muted-foreground mt-1 text-[9px] tracking-[0.18em]">
              brugt
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 text-sm">
          <div>
            <div className="almanac-smallcaps text-muted-foreground text-[9px] tracking-[0.18em]">
              Brugt
            </div>
            <div className="almanac-numerals font-display text-foreground text-lg">
              310 kr.
            </div>
          </div>
          <div className="almanac-rule" />
          <div>
            <div className="almanac-smallcaps text-muted-foreground text-[9px] tracking-[0.18em]">
              Tilbage
            </div>
            <div className="almanac-numerals font-display text-warning text-lg">
              190 kr.
            </div>
          </div>
          <div className="almanac-rule" />
          <div>
            <div className="almanac-smallcaps text-muted-foreground text-[9px] tracking-[0.18em]">
              Mål
            </div>
            <div className="almanac-numerals font-display text-muted-foreground text-lg">
              500 kr.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
