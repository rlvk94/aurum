import { Droplets, Flame, Gauge, Thermometer, Zap } from "lucide-react";

import type { MeterKind } from "~/lib/consumption-kinds";

/** Text colour token per kind, from the finance palette in globals.css. */
export const KIND_TINT: Record<MeterKind, string> = {
  electricity: "text-warning",
  water: "text-savings",
  gas: "text-debt",
  heat: "text-expense",
  other: "text-muted-foreground",
};

export function meterTint(kind: string): string {
  return KIND_TINT[kind as MeterKind] ?? KIND_TINT.other;
}

/** Lucide icon for a meter kind. A component (not a lookup) so callers never
 * create component references during render. */
export function MeterIcon({
  kind,
  className,
}: {
  kind: string;
  className?: string;
}) {
  switch (kind as MeterKind) {
    case "electricity":
      return <Zap className={className} />;
    case "water":
      return <Droplets className={className} />;
    case "gas":
      return <Flame className={className} />;
    case "heat":
      return <Thermometer className={className} />;
    default:
      return <Gauge className={className} />;
  }
}
