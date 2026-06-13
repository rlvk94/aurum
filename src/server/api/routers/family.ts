import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { db as dbInstance } from "~/server/db";
import {
  family,
  familySubscription,
  user,
  usersToFamilies,
} from "~/server/db/schema";
import { seedDefaultCategories } from "~/server/db/seeds/seed-categories";

export async function getActiveFamilyId(db: typeof dbInstance, userId: string) {
  const [dbUser] = await db
    .select({ activeFamilyId: user.activeFamilyId })
    .from(user)
    .where(eq(user.id, userId));

  if (!dbUser?.activeFamilyId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active family",
    });
  }
  return dbUser.activeFamilyId;
}

export async function getActiveFamilyMembership(
  db: typeof dbInstance,
  userId: string,
) {
  const familyId = await getActiveFamilyId(db, userId);
  const [membership] = await db
    .select({ role: usersToFamilies.role })
    .from(usersToFamilies)
    .where(
      and(
        eq(usersToFamilies.userId, userId),
        eq(usersToFamilies.familyId, familyId),
      ),
    );
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not a member of the active family",
    });
  }
  return { familyId, role: membership.role };
}

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

async function countOwners(db: typeof dbInstance, familyId: string) {
  const rows = await db
    .select({ userId: usersToFamilies.userId })
    .from(usersToFamilies)
    .where(
      and(
        eq(usersToFamilies.familyId, familyId),
        eq(usersToFamilies.role, "owner"),
      ),
    );
  return rows.length;
}

async function pickFallbackFamilyId(
  db: typeof dbInstance,
  userId: string,
  excludeFamilyId: string,
) {
  const rows = await db
    .select({ familyId: usersToFamilies.familyId })
    .from(usersToFamilies)
    .where(
      and(
        eq(usersToFamilies.userId, userId),
        ne(usersToFamilies.familyId, excludeFamilyId),
      ),
    )
    .limit(1);
  return rows[0]?.familyId ?? null;
}

export const familyRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db
      .select({
        familyId: usersToFamilies.familyId,
        role: usersToFamilies.role,
        familyName: family.name,
      })
      .from(usersToFamilies)
      .innerJoin(family, eq(usersToFamilies.familyId, family.id))
      .where(eq(usersToFamilies.userId, ctx.session.user.id));

    return memberships;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [newFamily] = await tx
          .insert(family)
          .values({ name: input.name })
          .returning();

        await tx.insert(usersToFamilies).values({
          userId: ctx.session.user.id,
          familyId: newFamily!.id,
          role: "owner",
        });

        await tx.insert(familySubscription).values({
          familyId: newFamily!.id,
        });

        const [dbUser] = await tx
          .select({ locale: user.locale })
          .from(user)
          .where(eq(user.id, ctx.session.user.id));

        await seedDefaultCategories(tx, newFamily!.id, dbUser?.locale ?? "da");

        await tx
          .update(user)
          .set({ activeFamilyId: newFamily!.id })
          .where(eq(user.id, ctx.session.user.id));

        return newFamily;
      });
    }),

  current: protectedProcedure.query(async ({ ctx }) => {
    const { familyId, role } = await getActiveFamilyMembership(
      ctx.db,
      ctx.session.user.id,
    );
    const [row] = await ctx.db
      .select({
        id: family.id,
        name: family.name,
      })
      .from(family)
      .where(eq(family.id, familyId));
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return { ...row, role };
  }),

  update: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await requireOwner(ctx.db, ctx.session.user.id);
      await ctx.db
        .update(family)
        .set({ name: input.name.trim(), updatedAt: new Date() })
        .where(eq(family.id, familyId));
    }),

  listMembers: protectedProcedure.query(async ({ ctx }) => {
    const { familyId } = await getActiveFamilyMembership(
      ctx.db,
      ctx.session.user.id,
    );
    const rows = await ctx.db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: usersToFamilies.role,
        joinedAt: usersToFamilies.createdAt,
      })
      .from(usersToFamilies)
      .innerJoin(user, eq(usersToFamilies.userId, user.id))
      .where(eq(usersToFamilies.familyId, familyId));
    return rows;
  }),

  removeMember: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await requireOwner(ctx.db, ctx.session.user.id);
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use leave to remove yourself",
        });
      }

      const [target] = await ctx.db
        .select({ role: usersToFamilies.role })
        .from(usersToFamilies)
        .where(
          and(
            eq(usersToFamilies.userId, input.userId),
            eq(usersToFamilies.familyId, familyId),
          ),
        );
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      if (target.role === "owner") {
        const owners = await countOwners(ctx.db, familyId);
        if (owners <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the last owner",
          });
        }
      }

      await ctx.db
        .delete(usersToFamilies)
        .where(
          and(
            eq(usersToFamilies.userId, input.userId),
            eq(usersToFamilies.familyId, familyId),
          ),
        );

      const fallback = await pickFallbackFamilyId(
        ctx.db,
        input.userId,
        familyId,
      );
      await ctx.db
        .update(user)
        .set({ activeFamilyId: fallback, updatedAt: new Date() })
        .where(
          and(eq(user.id, input.userId), eq(user.activeFamilyId, familyId)),
        );
    }),

  updateMemberRole: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["owner", "member"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await requireOwner(ctx.db, ctx.session.user.id);

      const [target] = await ctx.db
        .select({ role: usersToFamilies.role })
        .from(usersToFamilies)
        .where(
          and(
            eq(usersToFamilies.userId, input.userId),
            eq(usersToFamilies.familyId, familyId),
          ),
        );
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      if (target.role === "owner" && input.role === "member") {
        const owners = await countOwners(ctx.db, familyId);
        if (owners <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot demote the last owner",
          });
        }
      }

      await ctx.db
        .update(usersToFamilies)
        .set({ role: input.role, updatedAt: new Date() })
        .where(
          and(
            eq(usersToFamilies.userId, input.userId),
            eq(usersToFamilies.familyId, familyId),
          ),
        );
    }),

  leave: protectedProcedure.mutation(async ({ ctx }) => {
    const { familyId, role } = await getActiveFamilyMembership(
      ctx.db,
      ctx.session.user.id,
    );

    if (role === "owner") {
      const owners = await countOwners(ctx.db, familyId);
      if (owners <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "You are the last owner — promote another member to owner before leaving",
        });
      }
    }

    await ctx.db
      .delete(usersToFamilies)
      .where(
        and(
          eq(usersToFamilies.userId, ctx.session.user.id),
          eq(usersToFamilies.familyId, familyId),
        ),
      );

    const fallback = await pickFallbackFamilyId(
      ctx.db,
      ctx.session.user.id,
      familyId,
    );
    await ctx.db
      .update(user)
      .set({ activeFamilyId: fallback, updatedAt: new Date() })
      .where(eq(user.id, ctx.session.user.id));

    return { activeFamilyId: fallback };
  }),
});
