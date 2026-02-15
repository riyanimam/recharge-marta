import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMartaApi } from "~/composables/useMartaApi";

function enableMockMode(): void {
  localStorage.setItem("marta.mock", "1");
}

describe("useMartaApi (mock mode)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    enableMockMode();
  });

  it("reports mock mode enabled", () => {
    const api = useMartaApi();
    expect(api.isMockModeEnabled()).toBe(true);
  });

  it("returns generated arrivals for unknown stop IDs", async () => {
    const api = useMartaApi();
    const arrivals = await api.getArrivals("zzz");

    expect(arrivals.length).toBeGreaterThan(0);
    expect(arrivals.every((item) => item.stopId === "ZZZ")).toBe(true);
    expect(arrivals.every((item) => item.stopName.length > 0)).toBe(true);
  });

  it("returns generated alerts for unknown route filters", async () => {
    const api = useMartaApi();
    const alerts = await api.getAlerts("purple");

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((item) => item.routeId === "PURPLE")).toBe(true);
  });

  it("returns generated equipment for unknown station IDs", async () => {
    const api = useMartaApi();
    const equipment = await api.getEquipment("custom");

    expect(equipment.length).toBe(2);
    expect(equipment.every((item) => item.stationId === "CUSTOM")).toBe(true);
  });

  it("returns multiple trip options for planning", async () => {
    const api = useMartaApi();
    const trips = await api.planTrip({
      origin: "Midtown",
      destination: "Airport",
      departAt: new Date().toISOString(),
      accessibilityNeeded: true,
    });

    expect(trips.length).toBe(3);
    expect(trips.some((trip) => trip.transfers === 0)).toBe(true);
  });

  it("realtime stream emits immediate and interval updates", () => {
    vi.useFakeTimers();
    const api = useMartaApi();
    const onUpdate = vi.fn();

    const stream = api.openRealtime(onUpdate);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(4000);
    expect(onUpdate).toHaveBeenCalledTimes(2);

    stream.close();
  });
});
