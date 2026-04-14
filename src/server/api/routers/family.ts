import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { family, user, usersToFamilies } from "~/server/db/schema";

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
      const [newFamily] = await ctx.db
        .insert(family)
        .values({ name: input.name })
        .returning();

      await ctx.db.insert(usersToFamilies).values({
        userId: ctx.session.user.id,
        familyId: newFamily!.id,
        role: "owner",
      });

      // Set as active family
      await ctx.db
        .update(user)
        .set({ activeFamilyId: newFamily!.id })
        .where(eq(user.id, ctx.session.user.id));

      return newFamily;
    }),
});
