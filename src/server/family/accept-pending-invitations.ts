import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "~/server/db";
import { getFamilySubscription } from "~/server/billing/entitlements";
import { PLAN_FEATURES } from "~/server/billing/plans";
import { invitation, user, usersToFamilies } from "~/server/db/schema";

/**
 * Adds the given user to any family that has sent them a pending, non-expired
 * invitation (matched by email). Safe to run on every sign-in.
 */
export async function acceptPendingInvitationsFor(userId: string) {
  const [currentUser] = await db
    .select({ email: user.email, activeFamilyId: user.activeFamilyId })
    .from(user)
    .where(eq(user.id, userId));
  if (!currentUser) return;

  const email = currentUser.email.toLowerCase();
  const now = new Date();

  const invites = await db
    .select({ id: invitation.id, familyId: invitation.familyId })
    .from(invitation)
    .where(and(eq(invitation.email, email), gt(invitation.expiresAt, now)));

  if (invites.length === 0) return;

  let lastJoinedFamilyId: string | null = null;

  for (const invite of invites) {
    const [existing] = await db
      .select({ userId: usersToFamilies.userId })
      .from(usersToFamilies)
      .where(
        and(
          eq(usersToFamilies.userId, userId),
          eq(usersToFamilies.familyId, invite.familyId),
        ),
      );

    if (!existing) {
      // Re-check plan limit at acceptance time. Family may have been
      // downgraded between invite send and accept; honour the current cap.
      const sub = await getFamilySubscription(db, invite.familyId);
      const limit = PLAN_FEATURES[sub.plan].maxMembers;
      const [memberCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersToFamilies)
        .where(eq(usersToFamilies.familyId, invite.familyId));
      const memberCount = Number(memberCountRow?.count ?? 0);

      if (memberCount >= limit) {
        // Drop the invite without joining; user can be re-invited if family
        // upgrades later.
        await db.delete(invitation).where(eq(invitation.id, invite.id));
        continue;
      }

      await db.insert(usersToFamilies).values({
        userId,
        familyId: invite.familyId,
        role: "member",
      });
      lastJoinedFamilyId = invite.familyId;
    }

    await db.delete(invitation).where(eq(invitation.id, invite.id));
  }

  if (!currentUser.activeFamilyId && lastJoinedFamilyId) {
    await db
      .update(user)
      .set({ activeFamilyId: lastJoinedFamilyId, updatedAt: new Date() })
      .where(eq(user.id, userId));
  }
}
