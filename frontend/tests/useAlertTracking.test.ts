import { beforeEach, describe, expect, it } from "vitest";
import { useAlertTracking } from "../composables/useAlertTracking";

describe("useAlertTracking", () => {
  beforeEach(() => {
    localStorage.clear();
    const { clearProgress } = useAlertTracking();
    clearProgress();
  });

  it("starts with no read alerts", () => {
    const { getReadCount } = useAlertTracking();
    expect(getReadCount()).toBe(0);
  });

  it("marks an alert as read", () => {
    const { markAsRead, isRead } = useAlertTracking();
    markAsRead("alert-1");
    expect(isRead("alert-1")).toBe(true);
  });

  it("unread alerts counted correctly", () => {
    const { markAsRead, getUnreadCount } = useAlertTracking();
    markAsRead("a1");
    expect(getUnreadCount(["a1", "a2", "a3", "a4", "a5"])).toBe(4);
  });

  it("persists read state to localStorage", () => {
    const { markAsRead } = useAlertTracking();
    markAsRead("a1");
    markAsRead("a2");
    const stored = JSON.parse(localStorage.getItem("marta.readAlerts")!);
    expect(stored).toContain("a1");
    expect(stored).toContain("a2");
  });

  it("clearProgress resets read state", () => {
    const { markAsRead, clearProgress, getReadCount } = useAlertTracking();
    markAsRead("a1");
    clearProgress();
    expect(getReadCount()).toBe(0);
  });

  it("does not double-count re-reads", () => {
    const { markAsRead, getReadCount } = useAlertTracking();
    markAsRead("a1");
    markAsRead("a1");
    expect(getReadCount()).toBe(1);
  });
});
