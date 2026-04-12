import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Example tRPC router test — co-located with the router it covers.
 *
 * This test exercises the `post.hello` public procedure without hitting
 * the database, demonstrating how to test tRPC routers in isolation.
 */

// Mock server-only to allow importing server modules in tests
vi.mock("server-only", () => ({}));

// Mock the database module so we don't need a real connection
vi.mock("~/server/db", () => ({
  db: {
    query: { posts: { findFirst: vi.fn() } },
    insert: vi.fn().mockReturnValue({ values: vi.fn() }),
  },
}));

// Mock better-auth to avoid real auth initialization
vi.mock("~/server/better-auth", () => ({
  auth: {
    api: { getSession: vi.fn().mockResolvedValue(null) },
  },
}));

describe("postRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hello procedure returns a greeting", async () => {
    // Dynamically import after mocks are set up
    const { appRouter } = await import("~/server/api/root");
    const { createTRPCContext } = await import("~/server/api/trpc");

    const ctx = await createTRPCContext({
      headers: new Headers(),
    });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.post.hello({ text: "world" });

    expect(result).toEqual({ greeting: "Hello world" });
  });

  it("hello procedure handles empty input", async () => {
    const { appRouter } = await import("~/server/api/root");
    const { createTRPCContext } = await import("~/server/api/trpc");

    const ctx = await createTRPCContext({
      headers: new Headers(),
    });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.post.hello({ text: "" });

    expect(result).toEqual({ greeting: "Hello " });
  });
});
