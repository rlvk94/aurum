import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { user } from "~/server/db/schema";

export const userRouter = createTRPCRouter({
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        locale: z.enum(["da", "en"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({
          name: input.name,
          ...(input.locale && { locale: input.locale }),
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.session.user.id));
    }),
});
