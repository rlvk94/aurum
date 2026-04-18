import type { Locale } from "~/i18n/config";

export type SeedCategoryLeaf = {
  name: Record<Locale, string>;
  icon?: string;
  keywords?: string[];
};

export type SeedCategoryParent = SeedCategoryLeaf & {
  children?: SeedCategoryLeaf[];
};

export type DefaultCategorySeed = {
  expense: SeedCategoryParent[];
  income: SeedCategoryParent[];
};

export const defaultCategories: DefaultCategorySeed = {
  expense: [
    // Add parent expense categories here. Example:
    // {
    //   name: { da: "Dagligvarer", en: "Groceries" },
    //   icon: "🛒",
    //   keywords: ["netto", "rema", "fakta"],
    //   children: [
    //     { name: { da: "Supermarked", en: "Supermarket" } },
    //   ],
    // },
  ],
  income: [
    // Add parent income categories here. Example:
    // { name: { da: "Løn", en: "Salary" }, icon: "💼" },
  ],
};
