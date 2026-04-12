import { describe, it, expect, vi } from "vitest";

/**
 * Example BetterAuth-protected route test — co-located with the auth client.
 *
 * This test demonstrates how to mock the BetterAuth client to test
 * components or utilities that depend on authentication state.
 */

// Mock the BetterAuth client module
vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn(() => ({
    signIn: {
      email: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "test@example.com" } } }),
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

describe("auth-client", () => {
  it("exports authClient with createAuthClient", async () => {
    const { authClient } = await import("./auth-client");
    expect(authClient).toBeDefined();
    expect(authClient.signIn).toBeDefined();
    expect(authClient.signOut).toBeDefined();
  });

  it("can call signIn.email with credentials", async () => {
    const { authClient } = await import("./auth-client");

    const result = await authClient.signIn.email({
      email: "test@example.com",
      password: "password123",
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
