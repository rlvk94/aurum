import { SectionMarker } from "../section-marker";

const MEMBERS = [
  { initials: "MR", name: "Marie", role: "Ejer", color: "var(--primary)" },
  { initials: "JK", name: "Jakob", role: "Medlem", color: "var(--savings)" },
  { initials: "AR", name: "Astrid", role: "Medlem", color: "var(--income)" },
  { initials: "LV", name: "Lukas", role: "Inviteret", color: "var(--muted-foreground)" },
];

export function FamilyCard() {
  return (
    <div className="relative w-full rounded-lg border border-border bg-card p-6 shadow-card">
      <div className="flex items-baseline justify-between">
        <SectionMarker>§ Husstanden</SectionMarker>
        <span className="almanac-numerals font-display text-sm text-muted-foreground">04 / ∞</span>
      </div>

      <div className="mt-5 font-display text-2xl text-foreground">
        Familien <span className="italic text-primary">Holm</span>
      </div>

      <div className="almanac-rule mt-5" />

      <ul className="mt-5 space-y-3">
        {MEMBERS.map((m) => (
          <li key={m.initials} className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-full font-display text-sm text-white"
              style={{ backgroundColor: m.color }}
            >
              {m.initials}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">{m.name}</div>
              <div className="almanac-smallcaps text-[9px] tracking-[0.18em] text-muted-foreground">
                {m.role}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled
        aria-hidden
        className="almanac-smallcaps mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 px-3 py-2 text-[10px] tracking-[0.22em] text-primary/80"
      >
        + Inviter medlem
      </button>
    </div>
  );
}
