import { SectionMarker } from "../section-marker";

const POINTS = [
  { m: "J", v: 412 },
  { m: "F", v: 428 },
  { m: "M", v: 421 },
  { m: "A", v: 446 },
  { m: "M", v: 462 },
  { m: "J", v: 471 },
  { m: "J", v: 469 },
  { m: "A", v: 488 },
  { m: "S", v: 502 },
  { m: "O", v: 510 },
  { m: "N", v: 524 },
  { m: "D", v: 538 },
];

export function NetWorthChart() {
  const W = 600;
  const H = 220;
  const padX = 28;
  const padTop = 16;
  const padBottom = 28;
  const min = Math.min(...POINTS.map((p) => p.v));
  const max = Math.max(...POINTS.map((p) => p.v));
  const range = max - min || 1;

  const xs = POINTS.map(
    (_, i) => padX + (i * (W - padX * 2)) / (POINTS.length - 1),
  );
  const ys = POINTS.map(
    (p) => padTop + (1 - (p.v - min) / range) * (H - padTop - padBottom),
  );

  const line = POINTS.map((_, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${ys[i]}`).join(" ");
  const area = `${line} L ${xs[xs.length - 1]} ${H - padBottom} L ${xs[0]} ${H - padBottom} Z`;

  // Annotate the September peak transition
  const annotateIdx = 8;
  const ax = xs[annotateIdx]!;
  const ay = ys[annotateIdx]!;

  return (
    <div className="relative w-full rounded-lg border border-border bg-card p-6 shadow-card">
      <div className="flex items-baseline justify-between">
        <div>
          <SectionMarker>§ Formue · 2026</SectionMarker>
          <div className="mt-2 font-display text-xl text-foreground">Nettoformue</div>
        </div>
        <div className="text-right">
          <div className="almanac-numerals font-display text-2xl text-foreground">
            538.420 <span className="text-base text-muted-foreground">kr.</span>
          </div>
          <div className="almanac-smallcaps mt-0.5 text-[10px] tracking-[0.18em] text-income">
            +30,6 % i år
          </div>
        </div>
      </div>

      <div className="almanac-rule mt-5" />

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-48 w-full">
        <defs>
          <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* hairline base */}
        <line
          x1={padX}
          x2={W - padX}
          y1={H - padBottom}
          y2={H - padBottom}
          stroke="var(--border)"
          strokeWidth="1"
        />

        <path d={area} fill="url(#nw-fill)" />
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth="1.5" />

        {/* annotation leader */}
        <line
          x1={ax}
          x2={ax}
          y1={ay}
          y2={padTop + 4}
          stroke="var(--primary)"
          strokeWidth="0.8"
          strokeDasharray="2 3"
        />
        <circle cx={ax} cy={ay} r="3" fill="var(--primary)" />
        <circle cx={ax} cy={ay} r="6" fill="var(--primary)" fillOpacity="0.15" />

        <text
          x={ax}
          y={padTop - 2}
          fontSize="16"
          fill="var(--primary)"
          textAnchor="middle"
          className="almanac-smallcaps"
          style={{ letterSpacing: "0.18em", textTransform: "uppercase" }}
        >
          aktier · sep
        </text>

        {POINTS.map((p, i) => (
          <text
            key={i}
            x={xs[i]}
            y={H - 8}
            fontSize="18"
            fill="var(--muted-foreground)"
            textAnchor="middle"
            style={{ letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            {p.m}
          </text>
        ))}
      </svg>
    </div>
  );
}
