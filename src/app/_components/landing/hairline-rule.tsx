import { cn } from "~/app/_lib/utils";

export function HairlineRule({ className }: { className?: string }) {
  return <div aria-hidden className={cn("almanac-rule", className)} />;
}
