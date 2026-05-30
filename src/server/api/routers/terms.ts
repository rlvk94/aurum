import { createHash } from "node:crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { termsAcceptance, user } from "~/server/db/schema";
import { getCurrentTerms, getTermsByVersion } from "~/server/terms";

const localeSchema = z.enum(["da", "en"]);

function sha256(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export const termsRouter = createTRPCRouter({
  // Returns the current terms (text for the requested/user locale) plus whether
  // the user has already accepted this version.
  current: protectedProcedure
    .input(z.object({ locale: localeSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const terms = getCurrentTerms();

      let locale = input?.locale;
      if (!locale) {
        const [row] = await ctx.db
          .select({ locale: user.locale })
          .from(user)
          .where(eq(user.id, ctx.session.user.id));
        locale = row?.locale ?? "da";
      }

      const [existing] = await ctx.db
        .select({ id: termsAcceptance.id })
        .from(termsAcceptance)
        .where(
          and(
            eq(termsAcceptance.userId, ctx.session.user.id),
            eq(termsAcceptance.version, terms.version),
          ),
        );

      return {
        version: terms.version,
        effectiveDate: terms.effectiveDate,
        locale,
        content: terms.content[locale],
        accepted: Boolean(existing),
      };
    }),

  // Records acceptance. The accepted text is re-derived server-side from the
  // bundle by (version, locale) — never trusted from the client — so the stored
  // snapshot is authoritative and tamper-proof. Idempotent per (user, version).
  accept: protectedProcedure
    .input(z.object({ version: z.string().min(1), locale: localeSchema }))
    .mutation(async ({ ctx, input }) => {
      const terms = getTermsByVersion(input.version);
      const content = terms?.content[input.locale];
      if (!terms || !content) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unknown terms version or locale",
        });
      }

      const result = await ctx.db
        .insert(termsAcceptance)
        .values({
          userId: ctx.session.user.id,
          version: terms.version,
          locale: input.locale,
          contentHash: sha256(content),
          content,
        })
        .onConflictDoNothing({
          target: [termsAcceptance.userId, termsAcceptance.version],
        })
        .returning({ id: termsAcceptance.id });

      return { accepted: true, inserted: result.length };
    }),
});
