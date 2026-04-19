import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";

import { db } from "~/server/db";
import { sendSignInOtpEmail } from "~/server/email";
import { acceptPendingInvitationsFor } from "~/server/family/accept-pending-invitations";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await acceptPendingInvitationsFor(session.userId);
        },
      },
    },
  },
  plugins: [
    nextCookies(),
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      sendVerificationOTP: async ({ email, otp }) => {
        await sendSignInOtpEmail({ to: email, code: otp });
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
