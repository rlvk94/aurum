# ADR-0005: Email OTP-Only Authentication

## Status

Proposed

## Date

2026-04-12

## Context

Aurum needs an authentication strategy that is low-friction for a family finance app used weekly. The current BetterAuth scaffold includes email/password authentication and GitHub OAuth.

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

OTP behavior:

- 6-digit numeric code
- ~10 minute expiry
- Resend with cooldown to prevent abuse
- BetterAuth's built-in email OTP plugin handles the core mechanics

## Consequences

- **Positive:** Zero password management — no forgot-password flows, no credential stuffing risk, no bcrypt overhead.
- **Positive:** Low friction — users only need access to their email to sign in, which matches how infrequently they'll authenticate.
- **Positive:** Simpler codebase — removes password hashing, password reset flows, and OAuth callback handling.
- **Trade-off:** Requires a working email delivery service (SMTP or transactional email provider) from day one.
- **Trade-off:** Users without email access cannot sign in — acceptable for this product's target audience.
- **Follow-up:** The current BetterAuth config must be updated to disable `emailAndPassword` and remove GitHub OAuth. An email provider must be configured.
