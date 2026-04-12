/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import("next").NextConfig} */
const config = {
  serverExternalPackages: ["postgres"],
};

export default withSentryConfig(withNextIntl(config), {
  // Upload source maps to Sentry for readable stack traces in production
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Suppress noisy Sentry build logs
  silent: !process.env.CI,
});
