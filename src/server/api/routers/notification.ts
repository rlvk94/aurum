import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { notificationPreference, pushSubscription } from "~/server/db/schema";
import {
  CHANNELS,
  NOTIFICATION_TYPES,
  defaultEnabled,
  definitionRegistry,
} from "~/server/notifications";

export const notificationRouter = createTRPCRouter({
  // Resolved preference matrix for the current user: every type × channel, with
  // the stored value or the type's default, plus which channels each type
  // actually supports.
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        type: notificationPreference.type,
        channel: notificationPreference.channel,
        enabled: notificationPreference.enabled,
      })
      .from(notificationPreference)
      .where(eq(notificationPreference.userId, ctx.session.user.id));

    const stored = new Map(
      rows.map((r) => [`${r.type}:${r.channel}`, r.enabled] as const),
    );

    const items = NOTIFICATION_TYPES.map((type) => {
      const def = definitionRegistry[type];
      const channels = Object.fromEntries(
        CHANNELS.map((channel) => [
          channel,
          stored.get(`${type}:${channel}`) ?? defaultEnabled(type, channel),
        ]),
      ) as Record<(typeof CHANNELS)[number], boolean>;
      return {
        type,
        availableChannels: def.channels,
        channels,
      };
    });

    return { items, channels: CHANNELS };
  }),

  setPreference: protectedProcedure
    .input(
      z.object({
        type: z.enum(NOTIFICATION_TYPES),
        channel: z.enum(CHANNELS),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(notificationPreference)
        .values({
          userId: ctx.session.user.id,
          type: input.type,
          channel: input.channel,
          enabled: input.enabled,
        })
        .onConflictDoUpdate({
          target: [
            notificationPreference.userId,
            notificationPreference.type,
            notificationPreference.channel,
          ],
          set: { enabled: input.enabled, updatedAt: new Date() },
        });
      return { ok: true };
    }),

  // ── Device (push subscription) management ──

  subscribeDevice: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        p256dh: z.string().min(1),
        auth: z.string().min(1),
        userAgent: z.string().max(512).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(pushSubscription)
        .values({
          userId: ctx.session.user.id,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent,
          lastUsedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: pushSubscription.endpoint,
          set: {
            userId: ctx.session.user.id,
            p256dh: input.p256dh,
            auth: input.auth,
            userAgent: input.userAgent,
            lastUsedAt: new Date(),
          },
        });
      return { ok: true };
    }),

  unsubscribeDevice: protectedProcedure
    .input(z.object({ endpoint: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(pushSubscription)
        .where(
          and(
            eq(pushSubscription.endpoint, input.endpoint),
            eq(pushSubscription.userId, ctx.session.user.id),
          ),
        );
      return { ok: true };
    }),

  listDevices: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: pushSubscription.id,
        endpoint: pushSubscription.endpoint,
        userAgent: pushSubscription.userAgent,
        createdAt: pushSubscription.createdAt,
        lastUsedAt: pushSubscription.lastUsedAt,
      })
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, ctx.session.user.id))
      .orderBy(desc(pushSubscription.createdAt));
    return rows;
  }),
});
