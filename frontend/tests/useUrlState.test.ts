import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUrlState } from "../composables/useUrlState";

describe("useUrlState", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.restoreAllMocks();
    // Use a writable location stub
    Object.defineProperty(window, "location", {
      value: { search: "", href: "http://localhost/", pathname: "/" },
      writable: true,
      configurable: true,
    });
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("reads empty params when URL has no query string", () => {
    const { read } = useUrlState();
    const params = read();
    expect(params.stop).toBeUndefined();
    expect(params.route).toBeUndefined();
    expect(params.station).toBeUndefined();
  });

  it("reads params from query string", () => {
    window.location.search = "?stop=FIVE_POINTS&route=RED&lang=es";
    const { read } = useUrlState();
    const params = read();
    expect(params.stop).toBe("FIVE_POINTS");
    expect(params.route).toBe("RED");
    expect(params.lang).toBe("es");
  });

  it("writes state to URL via replaceState", () => {
    const { write } = useUrlState();
    write({ stop: "AIRPORT", route: "GOLD" });
    expect(window.history.replaceState).toHaveBeenCalled();
    const call = vi.mocked(window.history.replaceState).mock.calls[0];
    const url = call[2] as string;
    expect(url).toContain("stop=AIRPORT");
    expect(url).toContain("route=GOLD");
  });

  it("preserves mock param if present", () => {
    window.location.search = "?mock=1";
    const { write } = useUrlState();
    write({ stop: "MIDTOWN" });
    const call = vi.mocked(window.history.replaceState).mock.calls[0];
    const url = call[2] as string;
    expect(url).toContain("mock=1");
    expect(url).toContain("stop=MIDTOWN");
  });

  it("skips undefined values", () => {
    const { write } = useUrlState();
    write({ stop: "X", route: undefined });
    const call = vi.mocked(window.history.replaceState).mock.calls[0];
    const url = call[2] as string;
    expect(url).toContain("stop=X");
    expect(url).not.toContain("route=");
  });

  it("copyLink copies current URL to clipboard", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    window.location.href = "http://localhost/?stop=X";
    const { copyLink } = useUrlState();
    copyLink();
    expect(writeText).toHaveBeenCalledWith("http://localhost/?stop=X");
  });
});
