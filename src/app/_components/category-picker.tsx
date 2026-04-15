"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { type RouterOutputs } from "~/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/_components/select";

type Category = RouterOutputs["category"]["list"][number];

const NONE = "__none__";

/**
 * Hierarchical category picker. Supports 2-level hierarchy.
 * Parents appear with their children grouped right after.
 */
export function CategoryPicker({
  value,
  onChange,
  categories,
  kind,
  placeholder,
  id,
  "aria-invalid": ariaInvalid,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  categories: Category[];
  kind: "expense" | "income";
  placeholder?: string;
  id?: string;
  "aria-invalid"?: boolean;
}) {
  const tCommon = useTranslations("common");

  const ordered = useMemo(() => {
    const filtered = categories.filter(
      (c) => c.kind === kind && !c.archived,
    );
    const topLevel = filtered.filter((c) => !c.parentId);
    const byParent = new Map<string, Category[]>();
    for (const c of filtered) {
      if (c.parentId) {
        const list = byParent.get(c.parentId) ?? [];
        list.push(c);
        byParent.set(c.parentId, list);
      }
    }

    const result: Array<{ category: Category; indented: boolean }> = [];
    for (const parent of topLevel) {
      result.push({ category: parent, indented: false });
      const children = byParent.get(parent.id) ?? [];
      for (const child of children) {
        result.push({ category: child, indented: true });
      }
    }
    return result;
  }, [categories, kind]);

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
    >
      <SelectTrigger id={id} aria-invalid={ariaInvalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>
          <span className="text-muted-foreground">—</span>
        </SelectItem>
        {ordered.map(({ category, indented }) => (
          <SelectItem key={category.id} value={category.id}>
            <span className={indented ? "pl-4" : ""}>
              {category.icon && <span className="mr-1.5">{category.icon}</span>}
              {category.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
