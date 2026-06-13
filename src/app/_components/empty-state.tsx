import { type LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  message,
}: {
  icon: LucideIcon;
  message: string;
}) {
  return (
    <div className="border-border flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
      <Icon className="text-muted-foreground/50 h-10 w-10" />
      <p className="text-muted-foreground mt-4 max-w-sm text-center text-sm">
        {message}
      </p>
    </div>
  );
}
