import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";

import { db } from "~/server/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      sendVerificationOTP: async ({ email, otp, type }) => {
        // TODO: Integrate a transactional email provider (e.g. Resend, Postmark)
        // For development, log the OTP to the console
        console.log(`[DEV] OTP for ${email} (${type}): ${otp}`);
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
