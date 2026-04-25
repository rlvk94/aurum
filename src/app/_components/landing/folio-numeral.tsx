import { cn } from "~/app/_lib/utils";

export function FolioNumeral({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "font-display text-primary/30 leading-none select-none almanac-numerals",
        className,
      )}
    >
      {value}
    </span>
  );
}
