import "server-only";

import { and, eq, gt } from "drizzle-orm";

import { db } from "~/server/db";
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
      await db.insert(usersToFamilies).values({
        userId,
        familyId: invite.familyId,
        role: "member",
      });
    }

    await db.delete(invitation).where(eq(invitation.id, invite.id));
  }

  if (!currentUser.activeFamilyId) {
    const last = invites[invites.length - 1]!;
    await db
      .update(user)
      .set({ activeFamilyId: last.familyId, updatedAt: new Date() })
      .where(eq(user.id, userId));
  }
}
