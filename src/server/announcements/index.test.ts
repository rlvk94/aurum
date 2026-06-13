import { describe, it, expect } from "vitest";
import {
  ANNOUNCEMENTS,
  getVisibleAnnouncements,
  latestAnnouncementId,
} from "./index";

describe("announcements bundle", () => {
  it("ships the Projects launch announcement as id 2026-04-projects", () => {
    expect(ANNOUNCEMENTS.some((a) => a.id === "2026-04-projects")).toBe(true);
  });

  it("getVisibleAnnouncements filters out future-dated entries", () => {
    const future = new Date("2026-04-25T00:00:00Z");
    const visible = getVisibleAnnouncements(future);
    expect(visible.every((a) => a.publishedAt <= "2026-04-25")).toBe(true);
  });

  it("returns entries newest-first by lexicographic id", () => {
    const visible = getVisibleAnnouncements(new Date("2099-01-01T00:00:00Z"));
    for (let i = 1; i < visible.length; i++) {
      expect(visible[i - 1]!.id >= visible[i]!.id).toBe(true);
    }
  });

  it("latestAnnouncementId returns the highest id by lex order", () => {
    const id = latestAnnouncementId(new Date("2099-01-01T00:00:00Z"));
    expect(id).toBe(
      ANNOUNCEMENTS.slice().sort((a, b) => (a.id < b.id ? 1 : -1))[0]!.id,
    );
  });

  it("latestAnnouncementId returns null when nothing is published yet", () => {
    const id = latestAnnouncementId(new Date("2000-01-01T00:00:00Z"));
    expect(id).toBeNull();
  });
});
