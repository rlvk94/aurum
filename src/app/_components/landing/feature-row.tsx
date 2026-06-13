import { cn } from "~/app/_lib/utils";
import { FolioNumeral } from "./folio-numeral";
import { SectionMarker } from "./section-marker";

export function FeatureRow({
  folio,
  eyebrow,
  headline,
  body,
  side,
  visual,
}: {
  folio: string;
  eyebrow: string;
  headline: string;
  body: string;
  side: "left" | "right";
  visual: React.ReactNode;
}) {
  return (
    <article className="relative grid grid-cols-1 items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-20">
      <div
        className={cn(
          "relative",
          side === "right" ? "lg:order-2" : "lg:order-1",
        )}
      >
        <div className="flex items-baseline gap-4">
          <FolioNumeral value={folio} className="text-5xl" />
          <SectionMarker>{eyebrow}</SectionMarker>
        </div>
        <h3 className="font-display text-foreground mt-4 max-w-md text-3xl leading-tight sm:text-4xl">
          {headline}
        </h3>
        <p className="text-muted-foreground mt-4 max-w-md text-base leading-relaxed">
          {body}
        </p>
      </div>
      <div
        className={cn(
          "relative",
          side === "right" ? "lg:order-1" : "lg:order-2",
        )}
      >
        {visual}
      </div>
    </article>
  );
}
