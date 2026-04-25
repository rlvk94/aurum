import { cn } from "~/app/_lib/utils";

export function SectionMarker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "almanac-smallcaps text-[10px] tracking-[0.22em] text-primary/80",
        className,
      )}
    >
      {children}
    </span>
  );
}
