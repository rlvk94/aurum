import { z } from "zod";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db as dbInstance } from "~/server/db";
import { category, user } from "~/server/db/schema";

const kindSchema = z.enum(["expense", "income"]);

async function getActiveFamilyId(
  db: typeof dbInstance,
  userId: string,
) {
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

export const categoryRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    return ctx.db
      .select()
      .from(category)
      .where(eq(category.familyId, familyId))
      .orderBy(asc(sql`lower(${category.name})`));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        kind: kindSchema,
        parentId: z.string().uuid().nullable().optional(),
        icon: z.string().max(16).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      // If parentId is set, enforce: parent must exist in the family,
      // be top-level (no parent of its own), and have the same kind.
      if (input.parentId) {
        const [parent] = await ctx.db
          .select({
            id: category.id,
            parentId: category.parentId,
            kind: category.kind,
          })
          .from(category)
          .where(
            and(
              eq(category.id, input.parentId),
              eq(category.familyId, familyId),
            ),
          );
        if (!parent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Parent category not found",
          });
        }
        if (parent.parentId !== null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only two levels of hierarchy are allowed",
          });
        }
        if (parent.kind !== input.kind) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Child must have the same kind as parent",
          });
        }
      }

      const [created] = await ctx.db
        .insert(category)
        .values({
          familyId,
          name: input.name.trim(),
          kind: input.kind,
          parentId: input.parentId ?? null,
          icon: input.icon ?? null,
        })
        .returning();

      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        parentId: z.string().uuid().nullable().optional(),
        icon: z.string().max(16).nullable().optional(),
        archived: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      const [existing] = await ctx.db
        .select({
          id: category.id,
          parentId: category.parentId,
          kind: category.kind,
        })
        .from(category)
        .where(
          and(eq(category.id, input.id), eq(category.familyId, familyId)),
        );

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // If assigning a parent: ensure parent exists in the family, is top-level,
      // matches kind, and this category itself has no children.
      if (input.parentId) {
        if (input.parentId === input.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Category cannot be its own parent",
          });
        }

        const [parent] = await ctx.db
          .select({
            parentId: category.parentId,
            kind: category.kind,
          })
          .from(category)
          .where(
            and(
              eq(category.id, input.parentId),
              eq(category.familyId, familyId),
            ),
          );
        if (!parent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Parent category not found",
          });
        }
        if (parent.parentId !== null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only two levels of hierarchy are allowed",
          });
        }
        if (parent.kind !== existing.kind) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Child must have the same kind as parent",
          });
        }

        // Ensure this category has no children (can't become a child if it's already a parent)
        const [childCount] = await ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(category)
          .where(eq(category.parentId, input.id));
        if (childCount && Number(childCount.count) > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot nest a category that already has children",
          });
        }
      }

      const { id, ...data } = input;

      await ctx.db
        .update(category)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(category.id, id), eq(category.familyId, familyId)));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      await ctx.db
        .delete(category)
        .where(and(eq(category.id, input.id), eq(category.familyId, familyId)));
    }),
});
