import { type LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  message,
}: {
  icon: LucideIcon;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
      <Icon className="h-10 w-10 text-muted-foreground/50" />
      <p className="mt-4 max-w-sm text-center text-sm text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
