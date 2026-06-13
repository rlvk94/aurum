import { describe, expect, it } from "vitest";

import { resolveSubscriptionsFromRows } from "./resolve";

// challenge_off_track defaults: { email: true, push: true }.
const TYPE = "challenge_off_track";

describe("resolveSubscriptionsFromRows", () => {
  it("falls back to type defaults when a user has no stored rows", () => {
    const result = resolveSubscriptionsFromRows([], ["u1"], TYPE);
    expect(result.get("u1")).toEqual({ email: true, push: true });
  });

  it("honors a stored override and defaults the unspecified channel", () => {
    const result = resolveSubscriptionsFromRows(
      [{ userId: "u1", channel: "push", enabled: false }],
      ["u1"],
      TYPE,
    );
    expect(result.get("u1")).toEqual({ email: true, push: false });
  });

  it("resolves multiple users independently", () => {
    const result = resolveSubscriptionsFromRows(
      [
        { userId: "u1", channel: "email", enabled: false },
        { userId: "u2", channel: "push", enabled: false },
      ],
      ["u1", "u2", "u3"],
      TYPE,
    );
    expect(result.get("u1")).toEqual({ email: false, push: true });
    expect(result.get("u2")).toEqual({ email: true, push: false });
    expect(result.get("u3")).toEqual({ email: true, push: true });
  });

  it("ignores rows for users not in the requested set", () => {
    const result = resolveSubscriptionsFromRows(
      [{ userId: "other", channel: "email", enabled: false }],
      ["u1"],
      TYPE,
    );
    expect(result.has("other")).toBe(false);
    expect(result.get("u1")).toEqual({ email: true, push: true });
  });
});
