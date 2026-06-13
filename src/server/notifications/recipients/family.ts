import "server-only";

import { eq } from "drizzle-orm";

import { defaultLocale } from "~/i18n/config";
import type { db as dbInstance } from "~/server/db";
import { user, usersToFamilies } from "~/server/db/schema";

import type { NotificationRecipient } from "../definitions/types";

/**
 * Every member of a family, shaped as notification recipients. Resolved live so
 * membership changes take effect immediately. Members without an email are
 * dropped (email is required to be a valid recipient).
 */
export async function resolveFamilyMembers(
  db: typeof dbInstance,
  familyId: string,
): Promise<NotificationRecipient[]> {
  const rows = await db
    .select({
      userId: usersToFamilies.userId,
      email: user.email,
      locale: user.locale,
    })
    .from(usersToFamilies)
    .innerJoin(user, eq(usersToFamilies.userId, user.id))
    .where(eq(usersToFamilies.familyId, familyId));

  return rows
    .filter((r): r is typeof r & { email: string } => Boolean(r.email))
    .map((r) => ({
      userId: r.userId,
      email: r.email,
      locale: r.locale ?? defaultLocale,
    }));
}
