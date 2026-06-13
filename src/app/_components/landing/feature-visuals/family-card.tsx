import { SectionMarker } from "../section-marker";

const MEMBERS = [
  { initials: "MR", name: "Marie", role: "Ejer", color: "var(--primary)" },
  { initials: "JK", name: "Jakob", role: "Medlem", color: "var(--savings)" },
  { initials: "AR", name: "Astrid", role: "Medlem", color: "var(--income)" },
  {
    initials: "LV",
    name: "Lukas",
    role: "Inviteret",
    color: "var(--muted-foreground)",
  },
];

export function FamilyCard() {
  return (
    <div className="border-border bg-card shadow-card relative w-full rounded-lg border p-6">
      <div className="flex items-baseline justify-between">
        <SectionMarker>§ Husstanden</SectionMarker>
        <span className="almanac-numerals font-display text-muted-foreground text-sm">
          04 / ∞
        </span>
      </div>

      <div className="font-display text-foreground mt-5 text-2xl">
        Familien <span className="text-primary italic">Holm</span>
      </div>

      <div className="almanac-rule mt-5" />

      <ul className="mt-5 space-y-3">
        {MEMBERS.map((m) => (
          <li key={m.initials} className="flex items-center gap-3">
            <div
              aria-hidden
              className="font-display flex h-9 w-9 items-center justify-center rounded-full text-sm text-white"
              style={{ backgroundColor: m.color }}
            >
              {m.initials}
            </div>
            <div className="flex-1">
              <div className="text-foreground text-sm font-medium">
                {m.name}
              </div>
              <div className="almanac-smallcaps text-muted-foreground text-[9px] tracking-[0.18em]">
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
        className="almanac-smallcaps border-primary/40 text-primary/80 mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2 text-[10px] tracking-[0.22em]"
      >
        + Inviter medlem
      </button>
    </div>
  );
}
