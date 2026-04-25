import type { db as dbInstance } from "~/server/db";
import { category } from "~/server/db/schema";
import type { Locale } from "~/i18n/config";
import { defaultCategories } from "./default-categories";

type Transaction = Parameters<
  Parameters<typeof dbInstance.transaction>[0]
>[0];

export async function seedDefaultCategories(
  tx: Transaction,
  familyId: string,
  locale: Locale,
) {
  for (const parent of defaultCategories) {
    const [parentRow] = await tx
      .insert(category)
      .values({
        familyId,
        name: parent.name[locale],
        icon: parent.icon,
        keywords: parent.keywords ?? [],
      })
      .returning({ id: category.id });

    if (!parentRow || !parent.children?.length) continue;

    await tx.insert(category).values(
      parent.children.map((child) => ({
        familyId,
        parentId: parentRow.id,
        name: child.name[locale],
        icon: child.icon,
        keywords: child.keywords ?? [],
      })),
    );
  }
}
