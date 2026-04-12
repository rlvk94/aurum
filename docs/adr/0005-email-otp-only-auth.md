# ADR-0005: Email OTP-Only Authentication

## Status

Accepted

## Date

2026-04-12

## Context

Aurum needs an authentication strategy that is low-friction for a family finance app used weekly. The original T3 scaffold included email/password authentication and GitHub OAuth.

For this product, password-based auth introduces unnecessary complexity: users must remember passwords, the app must handle password resets, and the security surface area is larger. Social OAuth (GitHub) is irrelevant for a household finance tool — the target users are family members, not developers.

Email OTP (one-time passcode) provides a simpler, more secure flow that matches the app's usage pattern: infrequent logins from trusted devices, with session persistence between uses.

## Decision

Use **email OTP as the sole authentication method**. No password authentication. No social OAuth providers.

The flow:

1. User enters their email address
2. System sends a 6-digit OTP code to that email
3. User enters the code to verify
4. On success, a session is created
5. If the email is new, a user account is created during onboarding

Implementation (BetterAuth `emailOTP` plugin):

- **Server:** `src/server/better-auth/config.ts` — `emailOTP({ otpLength: 6, expiresIn: 600 })` with a `sendVerificationOTP` callback (currently logs to console in development; must be wired to a transactional email provider before production)
- **Client:** `src/server/better-auth/client.ts` and `src/lib/auth-client.ts` — `emailOTPClient()` plugin added to `createAuthClient()`
- **Schema:** `password` field removed from the `account` table; OTPs are stored in the existing `verification` table
- **Env:** `BETTER_AUTH_GITHUB_CLIENT_ID` and `BETTER_AUTH_GITHUB_CLIENT_SECRET` removed; `@auth/drizzle-adapter` dependency removed

OTP behavior:

- 6-digit numeric code
- 10 minute expiry (`expiresIn: 600`)
- Resend with cooldown (BetterAuth default: 60s window, max 3 attempts)
- Client methods: `authClient.emailOtp.sendVerificationOtp()`, `authClient.signIn.emailOtp()`

## Consequences

- **Positive:** Zero password management — no forgot-password flows, no credential stuffing risk, no bcrypt overhead.
- **Positive:** Low friction — users only need access to their email to sign in, which matches how infrequently they'll authenticate.
- **Positive:** Simpler codebase — removes password hashing, password reset flows, and OAuth callback handling.
- **Trade-off:** Requires a working email delivery service (SMTP or transactional email provider) for staging/production.
- **Trade-off:** Users without email access cannot sign in — acceptable for this product's target audience.
- **Follow-up:** Integrate a transactional email provider (e.g. Resend, Postmark) into the `sendVerificationOTP` callback before deploying to staging.
