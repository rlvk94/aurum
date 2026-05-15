import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    BETTER_AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    BETTER_AUTH_URL: z.string().url(),
    DATABASE_URL: z.string().url(),
    RESEND_API_KEY:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().optional(),
    EMAIL_FROM: z.string().min(1).default("Aurum <onboarding@resend.dev>"),
    CONTACT_TO_EMAIL:
      process.env.NODE_ENV === "production"
        ? z.string().email()
        : z.string().email().optional(),
    SIGNUP_NOTIFY_EMAIL: z.string().email().optional(),
    STRIPE_SECRET_KEY:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().optional(),
    STRIPE_WEBHOOK_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().optional(),
    STRIPE_PRICE_FAMILY_MONTHLY:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().optional(),
    STRIPE_PRICE_FAMILY_ANNUAL:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().optional(),
    CRON_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(16)
        : z.string().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_APP_ENV: z
      .enum(["development", "staging", "production"])
      .default("development"),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL,
    SIGNUP_NOTIFY_EMAIL: process.env.SIGNUP_NOTIFY_EMAIL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_FAMILY_MONTHLY: process.env.STRIPE_PRICE_FAMILY_MONTHLY,
    STRIPE_PRICE_FAMILY_ANNUAL: process.env.STRIPE_PRICE_FAMILY_ANNUAL,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
