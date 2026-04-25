"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, MinusCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "~/app/_lib/utils";
import { type RouterOutputs } from "~/trpc/react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/app/_components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/_components/popover";

type Category = RouterOutputs["category"]["list"][number];

export const UNCATEGORIZED_SENTINEL = "__uncategorized__";

type SharedProps = {
  categories: Category[];
  /**
   * "leaf-only" — top-level parent rows render as non-interactive group
   *               headings; only leaves are selectable.
   * "any"       — top-level parent rows render as selectable items above their
   *               children (filters/aggregations roll up server-side).
   */
  mode?: "leaf-only" | "any";
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  className?: string;
};

type SingleProps = SharedProps & {
  multiple?: false;
  value: string | null;
  onChange: (value: string | null) => void;
  /** Single mode only: render an "All" / "No category" sentinel. */
  emptyOption?: "none" | "all";
  /** Single mode only: render a top "Uncategorized" sentinel item. */
  uncategorizedOption?: boolean;
};

type MultiProps = SharedProps & {
  multiple: true;
  /**
   * Selected category ids. Empty array = "all" (no filter). May contain
   * `UNCATEGORIZED_SENTINEL` to represent rows with no category.
   */
  value: string[];
  onChange: (value: string[]) => void;
  /** Multi mode: render the "Uncategorized" sentinel item in the top group. */
  uncategorizedOption?: boolean;
};

type CategorySelectProps = SingleProps | MultiProps;

export function CategorySelect(props: CategorySelectProps) {
  const t = useTranslations("categories");
  const [open, setOpen] = useState(false);

  const {
    categories,
    mode = "leaf-only",
    placeholder,
    id,
    disabled,
    "aria-invalid": ariaInvalid,
    className,
  } = props;
  const isMulti = props.multiple === true;
  const uncategorizedOption = props.uncategorizedOption === true;

  const groups = useMemo(() => {
    const visible = categories.filter((c) => !c.archived);
    const topLevel = visible.filter((c) => !c.parentId);
    const childrenByParent = new Map<string, Category[]>();
    for (const c of visible) {
      if (c.parentId) {
        const list = childrenByParent.get(c.parentId) ?? [];
        list.push(c);
        childrenByParent.set(c.parentId, list);
      }
    }
    return topLevel.map((parent) => ({
      parent,
      children: childrenByParent.get(parent.id) ?? [],
    }));
  }, [categories]);

  const isSelected = (categoryId: string): boolean => {
    if (isMulti) return props.value.includes(categoryId);
    return props.value === categoryId;
  };

  const isUncategorizedSelected = isSelected(UNCATEGORIZED_SENTINEL);
  const selectedCount = isMulti ? props.value.length : props.value !== null ? 1 : 0;

  function toggleId(categoryId: string) {
    if (isMulti) {
      const next = props.value.includes(categoryId)
        ? props.value.filter((v) => v !== categoryId)
        : [...props.value, categoryId];
      props.onChange(next);
      return;
    }
    if (categoryId === UNCATEGORIZED_SENTINEL) {
      props.onChange(UNCATEGORIZED_SENTINEL);
    } else {
      props.onChange(categoryId);
    }
    setOpen(false);
  }

  function handleEmpty() {
    if (!isMulti) {
      props.onChange(null);
      setOpen(false);
    }
  }

  // ── Trigger label ──────────────────────────────────────────────────────────
  const sentinelLabel = !isMulti
    ? props.emptyOption === "all"
      ? t("allCategoriesOption")
      : props.emptyOption === "none"
        ? t("noCategoryOption")
        : null
    : null;

  let triggerNode: React.ReactNode;
  if (isMulti) {
    if (selectedCount === 0) {
      triggerNode = (
        <span className="truncate text-muted-foreground">
          {placeholder ?? t("allCategoriesOption")}
        </span>
      );
    } else if (selectedCount === 1) {
      const only = props.value[0]!;
      if (only === UNCATEGORIZED_SENTINEL) {
        triggerNode = (
          <span className="inline-flex items-center gap-1.5 truncate">
            <MinusCircle className="h-4 w-4 opacity-60" />
            <span className="truncate">{t("uncategorizedItem")}</span>
          </span>
        );
      } else {
        const cat = categories.find((c) => c.id === only);
        triggerNode = (
          <span className="inline-flex items-center gap-1.5 truncate">
            {cat?.icon && (
              <span className="text-base leading-none">{cat.icon}</span>
            )}
            <span className="truncate">{cat?.name ?? "—"}</span>
          </span>
        );
      }
    } else {
      triggerNode = (
        <span className="truncate">
          {t("nSelected", { count: selectedCount })}
        </span>
      );
    }
  } else {
    const selected = props.value
      ? props.value === UNCATEGORIZED_SENTINEL
        ? null
        : (categories.find((c) => c.id === props.value) ?? null)
      : null;
    if (props.value === UNCATEGORIZED_SENTINEL) {
      triggerNode = (
        <span className="inline-flex items-center gap-1.5 truncate">
          <MinusCircle className="h-4 w-4 opacity-60" />
          <span className="truncate">{t("uncategorizedItem")}</span>
        </span>
      );
    } else if (selected) {
      triggerNode = (
        <span className="inline-flex items-center gap-1.5 truncate">
          {selected.icon && (
            <span className="text-base leading-none">{selected.icon}</span>
          )}
          <span className="truncate">{selected.name}</span>
        </span>
      );
    } else {
      triggerNode = (
        <span className="truncate text-muted-foreground">
          {props.value === null && sentinelLabel
            ? sentinelLabel
            : (placeholder ?? t("searchPlaceholder"))}
        </span>
      );
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left">
            {triggerNode}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={t("searchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("noCategoriesMatch")}</CommandEmpty>

            {(((!isMulti && sentinelLabel) || uncategorizedOption) && (
              <>
                <CommandGroup>
                  {!isMulti && sentinelLabel && (
                    <CommandItem
                      value={`__empty__ ${sentinelLabel}`}
                      onSelect={handleEmpty}
                    >
                      <span className="text-muted-foreground">
                        {sentinelLabel}
                      </span>
                      {props.value === null && (
                        <Check className="ml-auto h-4 w-4" />
                      )}
                    </CommandItem>
                  )}
                  {uncategorizedOption && (
                    <CommandItem
                      value={`__uncategorized__ ${t("uncategorizedItem")}`}
                      onSelect={() => toggleId(UNCATEGORIZED_SENTINEL)}
                    >
                      <MinusCircle className="h-4 w-4 opacity-60" />
                      <span>{t("uncategorizedItem")}</span>
                      {isUncategorizedSelected && (
                        <Check className="ml-auto h-4 w-4" />
                      )}
                    </CommandItem>
                  )}
                </CommandGroup>
                <CommandSeparator />
              </>
            )) ||
              null}

            {groups.map(({ parent, children }) => (
              <CommandGroup
                key={parent.id}
                heading={
                  mode === "leaf-only" ? (
                    <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                      {parent.icon && <span>{parent.icon}</span>}
                      <span>{parent.name}</span>
                    </span>
                  ) : undefined
                }
              >
                {mode === "any" && (
                  <CommandItem
                    value={[parent.name, ...(parent.keywords ?? [])].join(" ")}
                    keywords={parent.keywords ?? []}
                    onSelect={() => toggleId(parent.id)}
                    className="font-medium"
                  >
                    {parent.icon && (
                      <span className="text-base leading-none">
                        {parent.icon}
                      </span>
                    )}
                    <span>{parent.name}</span>
                    {isSelected(parent.id) && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
                  </CommandItem>
                )}
                {children.map((child) => (
                  <CommandItem
                    key={child.id}
                    value={[
                      parent.name,
                      child.name,
                      ...(child.keywords ?? []),
                    ].join(" ")}
                    keywords={child.keywords ?? []}
                    onSelect={() => toggleId(child.id)}
                    className={cn(mode === "any" && "pl-7")}
                  >
                    {child.icon && (
                      <span className="text-base leading-none">
                        {child.icon}
                      </span>
                    )}
                    <span>{child.name}</span>
                    {isSelected(child.id) && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
