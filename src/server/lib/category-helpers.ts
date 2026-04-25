import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or } from "drizzle-orm";

import type { db as dbInstance } from "~/server/db";
import { category } from "~/server/db/schema";

type DbOrTx =
  | typeof dbInstance
  | Parameters<Parameters<typeof dbInstance.transaction>[0]>[0];

type IdParentRow = { id: string; parentId: string | null };

/**
 * Pure: build a Map keyed by each requested id → its expansion (id + child ids).
 * - If the id is a top-level (parent) row, expansion is itself + every row whose
 *   parentId equals it.
 * - If the id is a leaf, expansion is just itself.
 * - Unknown ids are dropped from the map.
 */
export function buildExpansionMap(
  rows: IdParentRow[],
  requested: string[],
): Map<string, string[]> {
  const known = new Set(rows.map((r) => r.id));
  const childrenByParent = new Map<string, string[]>();
  for (const row of rows) {
    if (row.parentId) {
      const list = childrenByParent.get(row.parentId) ?? [];
      list.push(row.id);
      childrenByParent.set(row.parentId, list);
    }
  }
  const result = new Map<string, string[]>();
  for (const id of requested) {
    if (!known.has(id)) continue;
    const children = childrenByParent.get(id) ?? [];
    result.set(id, [id, ...children]);
  }
  return result;
}

/**
 * Pure: given an expansion map and per-tx-categoryId monthly totals, return
 * a Map keyed by the *requested* (line) id with summed-per-month arrays.
 * Each value is a length-12 number[] (Jan..Dec).
 */
export function rollupActuals(
  expansionMap: Map<string, string[]>,
  txTotals: Map<string, number[]>,
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  for (const [lineId, txIds] of expansionMap) {
    const summed = new Array<number>(12).fill(0);
    for (const txId of txIds) {
      const arr = txTotals.get(txId);
      if (!arr) continue;
      for (let i = 0; i < 12; i++) {
        summed[i] = (summed[i] ?? 0) + (arr[i] ?? 0);
      }
    }
    result.set(lineId, summed);
  }
  return result;
}

/**
 * Returns id + ids of children for each requested id, restricted to family.
 * Unknown / foreign ids are dropped. Single round-trip.
 */
export async function expandCategoryIdsMap(
  db: DbOrTx,
  familyId: string,
  ids: string[],
): Promise<Map<string, string[]>> {
  if (ids.length === 0) return new Map();
  const cond = or(
    inArray(category.id, ids),
    inArray(category.parentId, ids),
  );
  const rows = await db
    .select({ id: category.id, parentId: category.parentId })
    .from(category)
    .where(and(eq(category.familyId, familyId), cond ?? eq(category.id, "")));
  return buildExpansionMap(rows, ids);
}

/**
 * Flat de-duplicated list of expanded category ids. Returns [] if every
 * requested id is unknown.
 */
export async function expandCategoryIds(
  db: DbOrTx,
  familyId: string,
  ids: string[],
): Promise<string[]> {
  const map = await expandCategoryIdsMap(db, familyId, ids);
  const out = new Set<string>();
  for (const arr of map.values()) {
    for (const id of arr) out.add(id);
  }
  return Array.from(out);
}

/**
 * Throws BAD_REQUEST if `categoryId` points to a top-level (parent) category
 * that has any children. Throws NOT_FOUND if it doesn't belong to the family.
 * Pass-through for leaf ids.
 */
export async function assertCategoryIsLeaf(
  db: DbOrTx,
  familyId: string,
  categoryId: string,
): Promise<void> {
  const [own] = await db
    .select({ id: category.id })
    .from(category)
    .where(and(eq(category.id, categoryId), eq(category.familyId, familyId)));
  if (!own) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
  }
  const [child] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.parentId, categoryId))
    .limit(1);
  if (child) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Transactions must be assigned to a sub-category, not a top-level category",
    });
  }
}
