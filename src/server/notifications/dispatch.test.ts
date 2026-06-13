import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks for the dispatcher's dependencies ──
vi.mock("~/server/db", () => ({ db: {} }));

type DeliverFn = (
  ...args: unknown[]
) => Promise<{ ok: boolean; pruned?: number }>;
const emailDeliver = vi.fn<DeliverFn>();
const pushDeliver = vi.fn<DeliverFn>();
const emailConfigured = vi.fn<() => boolean>(() => true);
const pushConfigured = vi.fn<() => boolean>(() => true);

vi.mock("./channels/registry", () => ({
  channelRegistry: {
    email: {
      id: "email",
      isConfigured: () => emailConfigured(),
      deliver: (...args: unknown[]) => emailDeliver(...args),
    },
    push: {
      id: "push",
      isConfigured: () => pushConfigured(),
      deliver: (...args: unknown[]) => pushDeliver(...args),
    },
  },
}));

type ResolveFn = (
  ...args: unknown[]
) => Promise<Map<string, { email: boolean; push: boolean }>>;
const resolveSubscriptions = vi.fn<ResolveFn>();
vi.mock("./preferences/resolve", () => ({
  resolveSubscriptions: (...args: unknown[]) => resolveSubscriptions(...args),
}));

const recordNotified = vi.fn<(...args: unknown[]) => Promise<void>>(
  async () => undefined,
);
vi.mock("./dedupe", () => ({
  recordNotified: (...args: unknown[]) => recordNotified(...args),
}));

vi.mock("./push/subscriptions", () => ({
  loadPushSubscriptions: vi.fn(async () => []),
}));

type RenderFn = (
  channel: string,
  ctx: unknown,
) => Promise<
  | { channel: "email"; subject: string; html: string }
  | { channel: "push"; title: string; body: string; url: string; tag: string }
>;
const render = vi.fn<RenderFn>(async (channel) =>
  channel === "email"
    ? { channel: "email", subject: "s", html: "h" }
    : { channel: "push", title: "t", body: "b", url: "/u", tag: "x" },
);
vi.mock("./definitions/registry", () => ({
  getDefinition: () => ({
    type: "challenge_off_track",
    channels: ["email", "push"],
    defaults: { email: true, push: true },
    render: (channel: string, ctx: unknown) => render(channel, ctx),
  }),
}));

import { dispatchNotification } from "./dispatch";

const recipient = (id: string) => ({
  userId: id,
  email: `${id}@example.com`,
  locale: "en" as const,
});

beforeEach(() => {
  vi.clearAllMocks();
  emailConfigured.mockReturnValue(true);
  pushConfigured.mockReturnValue(true);
  emailDeliver.mockResolvedValue({ ok: true });
  pushDeliver.mockResolvedValue({ ok: true });
});

describe("dispatchNotification", () => {
  it("delivers only on channels the user is subscribed to", async () => {
    resolveSubscriptions.mockResolvedValue(
      new Map([["u1", { email: true, push: false }]]),
    );

    const summary = await dispatchNotification({
      type: "challenge_off_track",
      recipients: [recipient("u1")],
      payload: {},
    });

    expect(emailDeliver).toHaveBeenCalledTimes(1);
    expect(pushDeliver).not.toHaveBeenCalled();
    expect(summary.notifiedUserIds).toEqual(["u1"]);
    expect(summary.delivered).toBe(1);
  });

  it("skips channels that are not configured", async () => {
    pushConfigured.mockReturnValue(false);
    resolveSubscriptions.mockResolvedValue(
      new Map([["u1", { email: true, push: true }]]),
    );

    await dispatchNotification({
      type: "challenge_off_track",
      recipients: [recipient("u1")],
      payload: {},
    });

    expect(emailDeliver).toHaveBeenCalledTimes(1);
    expect(pushDeliver).not.toHaveBeenCalled();
  });

  it("isolates a failing channel without aborting the others", async () => {
    emailDeliver.mockRejectedValue(new Error("smtp down"));
    resolveSubscriptions.mockResolvedValue(
      new Map([["u1", { email: true, push: true }]]),
    );

    const summary = await dispatchNotification({
      type: "challenge_off_track",
      recipients: [recipient("u1")],
      payload: {},
    });

    expect(pushDeliver).toHaveBeenCalledTimes(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatchObject({ userId: "u1", channel: "email" });
    // push still delivered → the user counts as notified
    expect(summary.notifiedUserIds).toEqual(["u1"]);
  });

  it("records dedupe rows only for notified users when a key is given", async () => {
    resolveSubscriptions.mockResolvedValue(
      new Map([
        ["u1", { email: true, push: false }],
        ["u2", { email: false, push: false }], // opted out of everything
      ]),
    );

    const summary = await dispatchNotification({
      type: "challenge_off_track",
      recipients: [recipient("u1"), recipient("u2")],
      payload: {},
      dedupeKey: "challenge_off_track:inst-1",
    });

    expect(summary.notifiedUserIds).toEqual(["u1"]);
    expect(recordNotified).toHaveBeenCalledTimes(1);
    expect(recordNotified).toHaveBeenCalledWith(
      {},
      "u1",
      "challenge_off_track",
      "challenge_off_track:inst-1",
    );
  });

  it("does not record dedupe rows when no key is given", async () => {
    resolveSubscriptions.mockResolvedValue(
      new Map([["u1", { email: true, push: false }]]),
    );

    await dispatchNotification({
      type: "challenge_off_track",
      recipients: [recipient("u1")],
      payload: {},
    });

    expect(recordNotified).not.toHaveBeenCalled();
  });
});
