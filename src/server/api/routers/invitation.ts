import { z } from "zod";
import { and, eq, gt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireWithinLimit } from "~/server/billing/entitlements";
import type { db as dbInstance } from "~/server/db";
import {
  family,
  invitation,
  user,
  usersToFamilies,
} from "~/server/db/schema";
import { getActiveFamilyMembership } from "~/server/api/routers/family";
import { sendFamilyInviteEmail } from "~/server/email";

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

async function requireOwner(db: typeof dbInstance, userId: string) {
  const m = await getActiveFamilyMembership(db, userId);
  if (m.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Owner role required",
    });
  }
  return m.familyId;
}

export const invitationRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { familyId } = await getActiveFamilyMembership(
      ctx.db,
      ctx.session.user.id,
    );
    const now = new Date();
    return ctx.db
      .select({
        id: invitation.id,
        email: invitation.email,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      })
      .from(invitation)
      .where(
        and(
          eq(invitation.familyId, familyId),
          gt(invitation.expiresAt, now),
        ),
      );
  }),

  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email().max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await requireOwner(ctx.db, ctx.session.user.id);
      const email = input.email.trim().toLowerCase();

      // Reject if email already belongs to a member of this family
      const [existingMember] = await ctx.db
        .select({ userId: usersToFamilies.userId })
        .from(usersToFamilies)
        .innerJoin(user, eq(user.id, usersToFamilies.userId))
        .where(
          and(
            eq(usersToFamilies.familyId, familyId),
            eq(user.email, email),
          ),
        );
      if (existingMember) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That person is already a member of this family",
        });
      }

      // Reject if a non-expired invitation already exists for this email
      const now = new Date();
      const [existingInvite] = await ctx.db
        .select({ id: invitation.id })
        .from(invitation)
        .where(
          and(
            eq(invitation.familyId, familyId),
            eq(invitation.email, email),
            gt(invitation.expiresAt, now),
          ),
        );
      if (existingInvite) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An invitation for that email is already pending",
        });
      }

      // Plan limit: members already in family + non-expired pending invites.
      // Reject if accepting this invite would push the family over its plan
      // member cap (free=1 owner-only, pro=unlimited).
      const [memberCountRow] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersToFamilies)
        .where(eq(usersToFamilies.familyId, familyId));
      const [pendingCountRow] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(invitation)
        .where(
          and(
            eq(invitation.familyId, familyId),
            gt(invitation.expiresAt, now),
          ),
        );
      const projected =
        Number(memberCountRow?.count ?? 0) +
        Number(pendingCountRow?.count ?? 0);
      await requireWithinLimit(ctx.db, familyId, "maxMembers", projected);

      const token = randomBytes(24).toString("hex");
      const [created] = await ctx.db
        .insert(invitation)
        .values({
          familyId,
          email,
          token,
          expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
          invitedById: ctx.session.user.id,
        })
        .returning();

      const [fam] = await ctx.db
        .select({ name: family.name })
        .from(family)
        .where(eq(family.id, familyId));

      const [inviter] = await ctx.db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, ctx.session.user.id));

      await sendFamilyInviteEmail({
        to: email,
        familyName: fam?.name ?? "",
        inviterName: inviter?.name ?? inviter?.email ?? "",
        inviterId: ctx.session.user.id,
      });

      return created;
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await requireOwner(ctx.db, ctx.session.user.id);
      await ctx.db
        .delete(invitation)
        .where(
          and(
            eq(invitation.id, input.id),
            eq(invitation.familyId, familyId),
          ),
        );
    }),
});
