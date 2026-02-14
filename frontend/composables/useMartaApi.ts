import type {
  Alert,
  Arrival,
  Dashboard,
  EquipmentStatus,
  LeaveNowResponse,
  RealtimePayload,
  TripOption,
} from "~/types/models";

type PlanTripPayload = {
  origin: string;
  destination: string;
  departAt: string;
  accessibilityNeeded: boolean;
};

// ── Mock data seeds ──

function seedArrivals(): Arrival[] {
  const now = Date.now();
  return [
    {
      routeId: "RED",
      routeName: "Red Line",
      stopId: "MID",
      stopName: "Midtown",
      destination: "Airport",
      predictedAt: new Date(now + 5 * 60_000).toISOString(),
      minutesAway: 5,
      accessibilitySafe: true,
    },
    {
      routeId: "GOLD",
      routeName: "Gold Line",
      stopId: "MID",
      stopName: "Midtown",
      destination: "Doraville",
      predictedAt: new Date(now + 11 * 60_000).toISOString(),
      minutesAway: 11,
      accessibilitySafe: true,
    },
    {
      routeId: "RED",
      routeName: "Red Line",
      stopId: "NORTH",
      stopName: "North Springs",
      destination: "Airport",
      predictedAt: new Date(now + 7 * 60_000).toISOString(),
      minutesAway: 7,
      accessibilitySafe: true,
    },
  ];
}

function seedAlerts(): Alert[] {
  const nowIso = new Date().toISOString();
  return [
    {
      id: "mock-alert-1",
      title: "Escalator advisory at Midtown",
      description: "Use north entrance elevator while escalator maintenance is in progress.",
      routeId: "RED",
      stationId: "MID",
      severity: "low",
      updatedAt: nowIso,
    },
    {
      id: "mock-alert-2",
      title: "Platform crowding expected",
      description: "Game-day event may increase wait times near downtown stations.",
      routeId: "GOLD",
      severity: "medium",
      updatedAt: nowIso,
    },
  ];
}

function seedEquipment(): EquipmentStatus[] {
  const nowIso = new Date().toISOString();
  return [
    {
      stationId: "MID",
      stationName: "Midtown",
      type: "elevator",
      name: "E1",
      status: "operational",
      updatedAt: nowIso,
    },
    {
      stationId: "MID",
      stationName: "Midtown",
      type: "escalator",
      name: "ES2",
      status: "out_of_service",
      updatedAt: nowIso,
    },
    {
      stationId: "AIRPORT",
      stationName: "Airport",
      type: "elevator",
      name: "E3",
      status: "operational",
      updatedAt: nowIso,
    },
  ];
}

// ── Mutable mock state (shared across calls) ──

let mockArrivals = seedArrivals();
let mockAlerts = seedAlerts();
const mockEquipment = seedEquipment();

function tickMockData(): void {
  const now = Date.now();
  mockArrivals = mockArrivals.map((arrival) => {
    const nextMinutes = Math.max(1, arrival.minutesAway - 1);
    const minutesAway = nextMinutes <= 1 ? 9 + Math.floor(Math.random() * 6) : nextMinutes;
    return {
      ...arrival,
      minutesAway,
      predictedAt: new Date(now + minutesAway * 60_000).toISOString(),
    };
  });

  if (Math.random() > 0.65) {
    mockAlerts = [
      {
        id: `mock-alert-${Math.floor(now / 1000)}`,
        title: "Minor delay near Arts Center",
        description: "Northbound trains are delayed 3-5 minutes due to temporary signal checks.",
        routeId: "RED",
        severity: "medium",
        updatedAt: new Date(now).toISOString(),
      },
      ...mockAlerts.slice(0, 1),
    ];
  } else {
    mockAlerts = mockAlerts.map((alert) => ({
      ...alert,
      updatedAt: new Date(now).toISOString(),
    }));
  }
}

// ── Resolve mock mode ──

function resolveMockMode(): boolean {
  if (import.meta.server) return false;

  const fromQuery = new URLSearchParams(window.location.search).get("mock");
  if (fromQuery === "1" || fromQuery === "true") {
    window.localStorage.setItem("marta.mock", "1");
    return true;
  }

  return window.localStorage.getItem("marta.mock") === "1";
}

// ── Composable ──

export function useMartaApi() {
  const apiBase = "http://localhost:8080";
  const mockMode = import.meta.server ? false : resolveMockMode();

  function isMockModeEnabled(): boolean {
    return mockMode;
  }

  async function getDashboard(userId: string): Promise<Dashboard> {
    if (mockMode) {
      return {
        userId,
        favoriteStops: ["MID", "NORTH", "AIRPORT"],
        favoriteRoutes: ["RED", "GOLD"],
        nextArrivals: mockArrivals,
        relevantAlerts: mockAlerts,
        equipmentSummary: mockEquipment,
      };
    }
    return $fetch<Dashboard>(`${apiBase}/api/v1/dashboard`, { params: { userId } });
  }

  async function getArrivals(stopId?: string): Promise<Arrival[]> {
    if (mockMode) {
      return stopId
        ? mockArrivals.filter((item) => item.stopId.toLowerCase() === stopId.toLowerCase())
        : mockArrivals;
    }
    return $fetch<Arrival[]>(`${apiBase}/api/v1/arrivals`, {
      params: stopId ? { stopId } : {},
    });
  }

  async function getAlerts(routeId?: string): Promise<Alert[]> {
    if (mockMode) {
      return routeId
        ? mockAlerts.filter(
            (item) => (item.routeId ?? "").toLowerCase() === routeId.toLowerCase(),
          )
        : mockAlerts;
    }
    return $fetch<Alert[]>(`${apiBase}/api/v1/alerts`, {
      params: routeId ? { routeId } : {},
    });
  }

  async function getEquipment(stationId?: string): Promise<EquipmentStatus[]> {
    if (mockMode) {
      return stationId
        ? mockEquipment.filter(
            (item) => item.stationId.toLowerCase() === stationId.toLowerCase(),
          )
        : mockEquipment;
    }
    return $fetch<EquipmentStatus[]>(`${apiBase}/api/v1/equipment`, {
      params: stationId ? { stationId } : {},
    });
  }

  async function planTrip(payload: PlanTripPayload): Promise<TripOption[]> {
    if (mockMode) {
      const depart = new Date(payload.departAt);
      const fastTrip: TripOption = {
        id: "mock-fast",
        summary: `${payload.origin} \u2192 ${payload.destination} via Red Line`,
        departAt: depart.toISOString(),
        arriveAt: new Date(depart.getTime() + 34 * 60_000).toISOString(),
        durationMinutes: 34,
        transfers: 1,
        transferRisk: "low",
        accessibilitySafe: payload.accessibilityNeeded,
        crowdingForecast: "moderate",
      };
      const saferTrip: TripOption = {
        id: "mock-safe",
        summary: `${payload.origin} \u2192 ${payload.destination} (accessibility-priority)`,
        departAt: new Date(depart.getTime() + 4 * 60_000).toISOString(),
        arriveAt: new Date(depart.getTime() + 42 * 60_000).toISOString(),
        durationMinutes: 38,
        transfers: 0,
        transferRisk: "low",
        accessibilitySafe: true,
        crowdingForecast: "low",
      };
      return [fastTrip, saferTrip];
    }
    return $fetch<TripOption[]>(`${apiBase}/api/v1/trips/plan`, {
      method: "POST",
      body: payload,
    });
  }

  async function leaveNow(
    fromStopId: string,
    toStopId: string,
    arrivalBy: string,
  ): Promise<LeaveNowResponse> {
    if (mockMode) {
      const arrival = new Date(arrivalBy);
      const leaveAt = new Date(arrival.getTime() - 52 * 60_000);
      return {
        fromStopId,
        toStopId,
        arrivalBy,
        leaveAt: leaveAt.toISOString(),
        bufferMinutes: 8,
        reliabilityNote:
          "Realtime crowding suggests leaving 8 minutes earlier for safer transfer margin.",
      };
    }
    return $fetch<LeaveNowResponse>(`${apiBase}/api/v1/trips/leave-now`, {
      params: { fromStopId, toStopId, arrivalBy },
    });
  }

  function openRealtime(onUpdate: (payload: RealtimePayload) => void): { close: () => void } {
    if (mockMode) {
      const intervalId = window.setInterval(() => {
        tickMockData();
        onUpdate({ arrivals: mockArrivals, alerts: mockAlerts });
      }, 5000);

      onUpdate({ arrivals: mockArrivals, alerts: mockAlerts });

      return { close: () => window.clearInterval(intervalId) };
    }

    const source = new EventSource(`${apiBase}/api/v1/realtime/stream`);
    source.addEventListener("update", (event) => {
      const data = JSON.parse((event as MessageEvent<string>).data) as RealtimePayload;
      onUpdate(data);
    });
    source.onerror = () => source.close();
    return { close: () => source.close() };
  }

  return {
    isMockModeEnabled,
    getDashboard,
    getArrivals,
    getAlerts,
    getEquipment,
    planTrip,
    leaveNow,
    openRealtime,
  };
}
