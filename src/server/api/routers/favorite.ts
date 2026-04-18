import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { userFavorite } from "~/server/db/schema";

const pathSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^\//, "Path must start with /");
const nameSchema = z.string().min(1).max(100);

export const favoriteRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: userFavorite.id,
        name: userFavorite.name,
        path: userFavorite.path,
        sortOrder: userFavorite.sortOrder,
      })
      .from(userFavorite)
      .where(eq(userFavorite.userId, ctx.session.user.id))
      .orderBy(asc(userFavorite.sortOrder), asc(userFavorite.createdAt));
  }),

  toggle: protectedProcedure
    .input(z.object({ name: nameSchema, path: pathSchema }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: userFavorite.id })
        .from(userFavorite)
        .where(
          and(
            eq(userFavorite.userId, ctx.session.user.id),
            eq(userFavorite.path, input.path),
          ),
        );

      if (existing) {
        await ctx.db
          .delete(userFavorite)
          .where(eq(userFavorite.id, existing.id));
        return { favorited: false };
      }

      await ctx.db.insert(userFavorite).values({
        userId: ctx.session.user.id,
        name: input.name,
        path: input.path,
      });
      return { favorited: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userFavorite)
        .where(
          and(
            eq(userFavorite.id, input.id),
            eq(userFavorite.userId, ctx.session.user.id),
          ),
        );
    }),
});
