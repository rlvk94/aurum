import { describe, it, expect, vi } from "vitest";

/**
 * Example BetterAuth email OTP test — co-located with the auth client.
 *
 * This test demonstrates how to mock the BetterAuth client to test
 * components or utilities that depend on email OTP authentication.
 */

// Mock the BetterAuth client module
vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn(() => ({
    emailOtp: {
      sendVerificationOtp: vi.fn().mockResolvedValue({ data: { success: true } }),
      verifyEmail: vi.fn().mockResolvedValue({ data: { session: { id: "session-1" } } }),
    },
    signIn: {
      emailOtp: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "test@example.com" } } }),
    },
    signOut: vi.fn().mockResolvedValue({}),
    useSession: vi.fn().mockReturnValue({
      data: null,
      isPending: false,
    }),
    $Infer: {
      Session: {} as Record<string, unknown>,
    },
  })),
}));

// Mock the client plugins (emailOTPClient is a no-op in tests)
vi.mock("better-auth/client/plugins", () => ({
  emailOTPClient: vi.fn(() => ({})),
}));

describe("auth-client", () => {
  it("exports authClient with email OTP methods", async () => {
    const { authClient } = await import("./auth-client");
    expect(authClient).toBeDefined();
    expect(authClient.emailOtp).toBeDefined();
    expect(authClient.signOut).toBeDefined();
  });

  it("can send a verification OTP", async () => {
    const { authClient } = await import("./auth-client");

    const result = await authClient.emailOtp.sendVerificationOtp({
      email: "emma@example.com",
      type: "sign-in",
    });

    expect(result.data?.success).toBe(true);
  });

  it("can sign in with email OTP", async () => {
    const { authClient } = await import("./auth-client");

    const result = await authClient.signIn.emailOtp({
      email: "emma@example.com",
      otp: "123456",
    });

    expect(result.data?.user).toEqual({
      id: "user-1",
      email: "test@example.com",
    });
  });

  it("can call signOut", async () => {
    const { authClient } = await import("./auth-client");

    await expect(authClient.signOut()).resolves.toBeDefined();
  });
});
