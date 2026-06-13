import type { RouterOutputs } from "~/trpc/react";

type Budget = RouterOutputs["budget"]["get"];
type Line = Budget["lines"][number];
type Category = RouterOutputs["category"]["list"][number];

export type LineNode = {
  kind: "line";
  id: string;
  line: Line;
};

export type CategoryGroup = {
  kind: "cat" | "sub";
  id: string;
  category: Category | null;
  label: string;
  icon: string | null;
  archived: boolean;
  plannedByMonth: number[];
  actualByMonth: number[];
  lines: LineNode[];
  subgroups: CategoryGroup[];
};

const EMPTY_12 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function emptyMonths(): number[] {
  return [...EMPTY_12];
}

function addInto(a: number[], b: number[]) {
  for (let i = 0; i < 12; i++) a[i] = (a[i] ?? 0) + (b[i] ?? 0);
}

function makeGroup(
  kind: "cat" | "sub",
  id: string,
  category: Category | null,
  label: string,
): CategoryGroup {
  return {
    kind,
    id,
    category,
    label,
    icon: category?.icon ?? null,
    archived: category?.archived ?? false,
    plannedByMonth: emptyMonths(),
    actualByMonth: emptyMonths(),
    lines: [],
    subgroups: [],
  };
}

export function buildBudgetTree(
  lines: Line[],
  categories: Category[],
  categoryActuals: Record<string, number[]>,
  orphanLabel: string,
): CategoryGroup[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const topLevel = new Map<string, CategoryGroup>();

  const ensureTop = (
    id: string,
    category: Category | null,
    label: string,
  ): CategoryGroup => {
    let g = topLevel.get(id);
    if (!g) {
      g = makeGroup("cat", id, category, label);
      topLevel.set(id, g);
    }
    return g;
  };

  const ensureSub = (
    parent: CategoryGroup,
    subId: string,
    subCat: Category,
  ): CategoryGroup => {
    let sg = parent.subgroups.find((s) => s.id === subId);
    if (!sg) {
      sg = makeGroup("sub", subId, subCat, subCat.name);
      parent.subgroups.push(sg);
    }
    return sg;
  };

  for (const line of lines) {
    const cat = line.categoryId ? (byId.get(line.categoryId) ?? null) : null;

    if (!cat) {
      const top = ensureTop("__orphan", null, orphanLabel);
      top.lines.push({ kind: "line", id: line.id, line });
      continue;
    }

    const parentId = cat.parentId ?? null;
    if (parentId) {
      const parentCat = byId.get(parentId);
      const top = parentCat
        ? ensureTop(parentCat.id, parentCat, parentCat.name)
        : ensureTop(cat.id, cat, cat.name);
      if (parentCat) {
        const sub = ensureSub(top, cat.id, cat);
        sub.lines.push({ kind: "line", id: line.id, line });
      } else {
        top.lines.push({ kind: "line", id: line.id, line });
      }
    } else {
      const top = ensureTop(cat.id, cat, cat.name);
      top.lines.push({ kind: "line", id: line.id, line });
    }
  }

  // Roll up planned + actual from the bottom up.
  for (const top of topLevel.values()) {
    for (const sub of top.subgroups) {
      for (const ln of sub.lines) {
        addInto(sub.plannedByMonth, ln.line.amounts);
      }
      if (sub.category) {
        const actual = categoryActuals[sub.category.id];
        if (actual) {
          for (let i = 0; i < 12; i++) sub.actualByMonth[i] = actual[i] ?? 0;
        }
      }
    }

    for (const ln of top.lines) {
      addInto(top.plannedByMonth, ln.line.amounts);
    }
    for (const sub of top.subgroups) {
      addInto(top.plannedByMonth, sub.plannedByMonth);
    }

    if (top.category) {
      const actual = categoryActuals[top.category.id];
      if (actual) {
        for (let i = 0; i < 12; i++) top.actualByMonth[i] = actual[i] ?? 0;
      }
    }
    for (const sub of top.subgroups) {
      addInto(top.actualByMonth, sub.actualByMonth);
    }

    // Stable line ordering: by sortOrder then createdAt.
    const sortLines = (arr: LineNode[]) =>
      arr.sort((a, b) => {
        if (a.line.sortOrder !== b.line.sortOrder)
          return a.line.sortOrder - b.line.sortOrder;
        return (
          new Date(a.line.createdAt).getTime() -
          new Date(b.line.createdAt).getTime()
        );
      });
    sortLines(top.lines);
    for (const sub of top.subgroups) sortLines(sub.lines);
    top.subgroups.sort((a, b) => a.label.localeCompare(b.label));
  }

  return Array.from(topLevel.values()).sort((a, b) => {
    // Orphan goes last.
    if (a.id === "__orphan") return 1;
    if (b.id === "__orphan") return -1;
    return a.label.localeCompare(b.label);
  });
}

export function sumMonths(groups: CategoryGroup[]): {
  plannedByMonth: number[];
  actualByMonth: number[];
} {
  const planned = emptyMonths();
  const actual = emptyMonths();
  for (const g of groups) {
    addInto(planned, g.plannedByMonth);
    addInto(actual, g.actualByMonth);
  }
  return { plannedByMonth: planned, actualByMonth: actual };
}
