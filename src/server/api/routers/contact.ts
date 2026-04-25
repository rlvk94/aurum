import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { sendContactEmail } from "~/server/email";

const contactInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  message: z.string().trim().min(5).max(4000),
});

export const contactRouter = createTRPCRouter({
  send: publicProcedure.input(contactInput).mutation(async ({ input }) => {
    try {
      await sendContactEmail(input);
    } catch (error) {
      console.error("[contact.send] failed", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send contact message",
      });
    }
    return { ok: true as const };
  }),
});
