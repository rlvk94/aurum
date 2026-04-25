import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { announcementDismissal } from "~/server/db/schema";
import {
  ANNOUNCEMENTS,
  getVisibleAnnouncements,
} from "~/server/announcements";

export const announcementRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const visible = getVisibleAnnouncements();
    if (visible.length === 0) {
      return { items: [], unreadCount: 0 };
    }

    const dismissals = await ctx.db
      .select({
        announcementId: announcementDismissal.announcementId,
        dismissedAt: announcementDismissal.dismissedAt,
      })
      .from(announcementDismissal)
      .where(
        and(
          eq(announcementDismissal.userId, ctx.session.user.id),
          inArray(
            announcementDismissal.announcementId,
            visible.map((a) => a.id),
          ),
        ),
      );

    const seenMap = new Map(
      dismissals.map((d) => [d.announcementId, d.dismissedAt] as const),
    );

    const items = visible.map((a) => ({
      ...a,
      seen: seenMap.has(a.id),
      seenAt: seenMap.get(a.id) ?? null,
    }));

    return {
      items,
      unreadCount: items.filter((i) => !i.seen).length,
    };
  }),

  markSeen: protectedProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const knownIds = new Set(ANNOUNCEMENTS.map((a) => a.id));
      const validIds = input.ids.filter((id) => knownIds.has(id));
      if (validIds.length === 0) return { inserted: 0 };

      const result = await ctx.db
        .insert(announcementDismissal)
        .values(
          validIds.map((id) => ({
            userId: ctx.session.user.id,
            announcementId: id,
          })),
        )
        .onConflictDoNothing({
          target: [
            announcementDismissal.userId,
            announcementDismissal.announcementId,
          ],
        })
        .returning({ id: announcementDismissal.announcementId });

      return { inserted: result.length };
    }),
});
