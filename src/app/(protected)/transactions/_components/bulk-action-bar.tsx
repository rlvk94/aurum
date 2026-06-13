"use client";

import { useTranslations } from "next-intl";
import { Eye, EyeOff, FolderHeart, Tag, X } from "lucide-react";

import { cn } from "~/app/_lib/utils";
import { Button } from "~/app/_components/button";

type Props = {
  selectedCount: number;
  hasProjects: boolean;
  disabled?: boolean;
  onClear: () => void;
  onCategorize: () => void;
  onExclude: () => void;
  onInclude: () => void;
  onAssignProject: () => void;
};

export function BulkActionBar({
  selectedCount,
  hasProjects,
  disabled,
  onClear,
  onCategorize,
  onExclude,
  onInclude,
  onAssignProject,
}: Props) {
  const t = useTranslations("transactions");

  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-3 z-30 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2",
        "bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]",
        "border-border bg-card shadow-elevated rounded-full border",
        "px-3 py-2 sm:px-4",
        "flex items-center gap-2",
      )}
      role="region"
      aria-label={t("title")}
    >
      <span className="almanac-numerals text-foreground pr-2 pl-1 text-sm font-medium whitespace-nowrap">
        {t("bulkSelected", { count: selectedCount })}
      </span>
      <div className="bg-border hidden h-5 w-px sm:block" />
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onCategorize}
        >
          <Tag />
          <span className="hidden sm:inline">{t("bulkCategorize")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onExclude}
        >
          <EyeOff />
          <span className="hidden sm:inline">{t("bulkExclude")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onInclude}
        >
          <Eye />
          <span className="hidden sm:inline">{t("bulkInclude")}</span>
        </Button>
        {hasProjects && (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onAssignProject}
          >
            <FolderHeart />
            <span className="hidden sm:inline">{t("bulkAssignProject")}</span>
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        aria-label={t("bulkClear")}
        className="h-8 w-8 shrink-0"
      >
        <X />
      </Button>
    </div>
  );
}
