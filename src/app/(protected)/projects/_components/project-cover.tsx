import { cn } from "~/app/_lib/utils";
import type { ProjectPalette } from "../_lib/format";

type Size = "sm" | "md" | "lg" | "hero";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-12 rounded-md",
  md: "h-28",
  lg: "h-32 rounded-xl",
  hero: "h-48",
};

const EMOJI_SIZE: Record<Size, string> = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-4xl",
  hero: "text-7xl",
};

export function ProjectCover({
  palette,
  emoji,
  size = "md",
  className,
  children,
}: {
  palette: ProjectPalette;
  emoji: string;
  size?: Size;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-project-palette={palette}
      className={cn(
        "project-cover-shimmer relative isolate w-full overflow-hidden",
        SIZE_CLASSES[size],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "project-cover-emoji absolute left-4 top-3 leading-none",
          size === "hero" && "left-6 top-6",
          EMOJI_SIZE[size],
        )}
      >
        {emoji}
      </span>
      {children}
    </div>
  );
}
