import { z } from "zod";
import { and, eq, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { db as dbInstance } from "~/server/db";
import {
  family,
  invitation,
  user,
  usersToFamilies,
} from "~/server/db/schema";
import { getActiveFamilyMembership } from "~/server/api/routers/family";

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

      // TODO: send via transactional email provider
      console.log(
        `[DEV] Invitation for ${email} to "${fam?.name}": /invite/${token}`,
      );

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

  accept: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const [invite] = await ctx.db
        .select({
          id: invitation.id,
          familyId: invitation.familyId,
          email: invitation.email,
          expiresAt: invitation.expiresAt,
        })
        .from(invitation)
        .where(eq(invitation.token, input.token));

      if (!invite || invite.expiresAt < now) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation is invalid or has expired",
        });
      }

      const [currentUser] = await ctx.db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, ctx.session.user.id));

      if (currentUser?.email.toLowerCase() !== invite.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation was sent to a different email address",
        });
      }

      // If already a member, just delete the invite and return
      const [existing] = await ctx.db
        .select({ userId: usersToFamilies.userId })
        .from(usersToFamilies)
        .where(
          and(
            eq(usersToFamilies.userId, ctx.session.user.id),
            eq(usersToFamilies.familyId, invite.familyId),
          ),
        );

      if (!existing) {
        await ctx.db.insert(usersToFamilies).values({
          userId: ctx.session.user.id,
          familyId: invite.familyId,
          role: "member",
        });
      }

      await ctx.db.delete(invitation).where(eq(invitation.id, invite.id));

      await ctx.db
        .update(user)
        .set({ activeFamilyId: invite.familyId, updatedAt: new Date() })
        .where(eq(user.id, ctx.session.user.id));

      return { familyId: invite.familyId };
    }),
});
