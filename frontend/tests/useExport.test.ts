import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExport } from "../composables/useExport";
import type { Alert, Arrival, EquipmentStatus } from "../types/models";

describe("useExport", () => {
  let clickSpy: ReturnType<typeof vi.fn<(download: string) => void>>;

  beforeEach(() => {
    vi.restoreAllMocks();
    clickSpy = vi.fn<(download: string) => void>();

    // Mock URL blob methods
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    // Intercept anchor click — happy-dom createElement works fine, just spy on click
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickSpy(this.download);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleArrival: Arrival = {
    routeId: "RED",
    routeName: "Red Line",
    stopId: "S1",
    stopName: "Five Points",
    destination: "Airport",
    predictedAt: "10:05 AM",
    minutesAway: 3,
    accessibilitySafe: true,
  };

  const sampleAlert: Alert = {
    id: "a1",
    title: "Delay",
    description: "5 min delay on Red Line",
    severity: "medium",
    updatedAt: "2025-01-01",
  };

  const sampleEquipment: EquipmentStatus = {
    stationId: "MID",
    stationName: "Midtown",
    type: "escalator",
    name: "Escalator A",
    status: "operational",
    updatedAt: "2025-01-01",
  };

  it("exports arrivals as JSON", () => {
    const { exportArrivalsJSON } = useExport();
    exportArrivalsJSON([sampleArrival]);
    expect(clickSpy).toHaveBeenCalled();
    expect(clickSpy.mock.calls[0][0]).toContain("arrivals");
    expect(clickSpy.mock.calls[0][0]).toContain(".json");
  });

  it("exports arrivals as CSV", () => {
    const { exportArrivalsCSV } = useExport();
    exportArrivalsCSV([sampleArrival]);
    expect(clickSpy).toHaveBeenCalled();
    expect(clickSpy.mock.calls[0][0]).toContain("arrivals");
    expect(clickSpy.mock.calls[0][0]).toContain(".csv");
  });

  it("exports alerts as JSON", () => {
    const { exportAlertsJSON } = useExport();
    exportAlertsJSON([sampleAlert]);
    expect(clickSpy).toHaveBeenCalled();
    expect(clickSpy.mock.calls[0][0]).toContain("alerts");
  });

  it("exports equipment as CSV", () => {
    const { exportEquipmentCSV } = useExport();
    exportEquipmentCSV([sampleEquipment]);
    expect(clickSpy).toHaveBeenCalled();
    expect(clickSpy.mock.calls[0][0]).toContain("equipment");
  });

  it("calls createObjectURL with a Blob", () => {
    const { exportAlertsJSON } = useExport();
    exportAlertsJSON([sampleAlert]);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});
