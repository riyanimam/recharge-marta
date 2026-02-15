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

// ── Mock catalog / helpers ──

type RouteDef = {
  id: string;
  name: string;
  stops: string[];
};

const STATION_NAMES: Record<string, string> = {
  MID: "Midtown",
  ARTS: "Arts Center",
  LENOX: "Lenox",
  FIVE: "Five Points",
  AIRPORT: "Airport",
  NORTH: "North Springs",
  DOR: "Doraville",
  KSU: "Kennesaw Shuttle",
  EAST: "East Point",
  WEST: "West End",
};

const ROUTES: RouteDef[] = [
  { id: "RED", name: "Red Line", stops: ["NORTH", "MID", "FIVE", "AIRPORT"] },
  { id: "GOLD", name: "Gold Line", stops: ["DOR", "LENOX", "MID", "FIVE", "AIRPORT"] },
  { id: "BLUE", name: "Blue Line", stops: ["WEST", "FIVE", "EAST"] },
  { id: "GREEN", name: "Green Line", stops: ["WEST", "FIVE", "KING"] },
];

const ALERT_TEMPLATES: Array<Pick<Alert, "title" | "description" | "severity">> = [
  {
    title: "Signal check causing moderate delay",
    description: "Trains may run 4-8 minutes behind schedule while signal checks are in progress.",
    severity: "medium",
  },
  {
    title: "Escalator out of service",
    description: "Use elevator access until escalator maintenance is completed.",
    severity: "low",
  },
  {
    title: "Service suspension on one segment",
    description: "Bus bridge activated between adjacent stations due to emergency track work.",
    severity: "high",
  },
  {
    title: "Event crowding advisory",
    description: "Expect heavier platform loads and longer boarding time near downtown stations.",
    severity: "medium",
  },
];

function normalizeId(value: string): string {
  return value.trim().toUpperCase();
}

function stationNameFor(stationId: string): string {
  return STATION_NAMES[stationId] ?? `${stationId} Station`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function routeDestination(route: RouteDef, fromStopId: string): string {
  const stops = route.stops;
  if (stops.length === 0) return "Terminal";
  const idx = stops.indexOf(fromStopId);
  if (idx < 0) return stationNameFor(stops[stops.length - 1] ?? fromStopId);
  const towardEnd = idx < Math.floor(stops.length / 2);
  const destId = towardEnd ? stops[stops.length - 1] : stops[0];
  return stationNameFor(destId ?? fromStopId);
}

function generateArrivalsForStop(stopId: string, count = 4): Arrival[] {
  const now = Date.now();
  const servingRoutes = ROUTES.filter((route) => route.stops.includes(stopId));
  const routes = servingRoutes.length > 0 ? servingRoutes : [pickOne(ROUTES)];

  return Array.from({ length: count }).map((_, index) => {
    const route = routes[index % routes.length] ?? routes[0];
    const minutesAway = randomInt(2, 17) + index;
    return {
      routeId: route.id,
      routeName: route.name,
      stopId,
      stopName: stationNameFor(stopId),
      destination: routeDestination(route, stopId),
      predictedAt: new Date(now + minutesAway * 60_000).toISOString(),
      minutesAway,
      accessibilitySafe: Math.random() > 0.18,
    };
  });
}

function seedArrivals(): Arrival[] {
  return [
    ...generateArrivalsForStop("MID", 5),
    ...generateArrivalsForStop("NORTH", 3),
    ...generateArrivalsForStop("AIRPORT", 3),
  ];
}

function createAlert(seed: number, routeId?: string, stationId?: string): Alert {
  const now = Date.now();
  const template = ALERT_TEMPLATES[seed % ALERT_TEMPLATES.length] ?? ALERT_TEMPLATES[0];
  return {
    id: `mock-alert-${now}-${seed}`,
    title: template?.title ?? "Service advisory",
    description: template?.description ?? "Minor service update.",
    routeId,
    stationId,
    severity: template?.severity ?? "low",
    updatedAt: new Date(now).toISOString(),
  };
}

function seedAlerts(): Alert[] {
  return [
    createAlert(0, "RED", "MID"),
    createAlert(1, "GOLD", "LENOX"),
    createAlert(2, "BLUE", "FIVE"),
  ];
}

function seedEquipment(): EquipmentStatus[] {
  const nowIso = new Date().toISOString();
  const stationIds = ["MID", "NORTH", "AIRPORT", "FIVE", "LENOX", "EAST"];
  return stationIds.flatMap((stationId, idx) => [
    {
      stationId,
      stationName: stationNameFor(stationId),
      type: "elevator",
      name: `E${idx + 1}`,
      status: Math.random() > 0.2 ? "operational" : "out_of_service",
      updatedAt: nowIso,
    } satisfies EquipmentStatus,
    {
      stationId,
      stationName: stationNameFor(stationId),
      type: "escalator",
      name: `ES${idx + 1}`,
      status: Math.random() > 0.3 ? "operational" : "out_of_service",
      updatedAt: nowIso,
    } satisfies EquipmentStatus,
  ]);
}

// ── Mutable mock state (shared across calls) ──

let mockArrivals = seedArrivals();
let mockAlerts = seedAlerts();
let mockEquipment = seedEquipment();
let alertSequence = 3;

function tickMockData(): void {
  const now = Date.now();
  mockArrivals = mockArrivals.map((arrival) => {
    const nextMinutes = Math.max(1, arrival.minutesAway - randomInt(1, 3));
    const wrappedMinutes = nextMinutes === 1 ? randomInt(8, 16) : nextMinutes;
    return {
      ...arrival,
      minutesAway: wrappedMinutes,
      predictedAt: new Date(now + wrappedMinutes * 60_000).toISOString(),
      accessibilitySafe: Math.random() > 0.15,
    };
  });

  if (Math.random() > 0.55) {
    const route = pickOne(ROUTES);
    const stationId = pickOne(route.stops);
    mockAlerts = [
      createAlert(alertSequence++, route.id, stationId),
      ...mockAlerts.slice(0, 7),
    ];
  } else {
    mockAlerts = mockAlerts.map((alert) => ({
      ...alert,
      updatedAt: new Date(now - randomInt(0, 6) * 60_000).toISOString(),
    }));
  }

  mockEquipment = mockEquipment.map((item) => {
    if (Math.random() > 0.86) {
      return {
        ...item,
        status: item.status === "operational" ? "out_of_service" : "operational",
        updatedAt: new Date(now).toISOString(),
      };
    }

    return {
      ...item,
      updatedAt: new Date(now - randomInt(0, 30) * 60_000).toISOString(),
    };
  });
}

// ── Resolve mock mode ──

function resolveMockMode(): boolean {
  if (import.meta.server) return false;

  const fromQuery = new URLSearchParams(window.location.search).get("mock");
  if (fromQuery === "1" || fromQuery === "true") {
    window.localStorage.setItem("marta.mock", "1");
    return true;
  }

  const persisted = window.localStorage.getItem("marta.mock");
  return persisted === "1" || persisted === "true";
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
      tickMockData();
      if (!stopId) return mockArrivals;

      const normalizedStop = normalizeId(stopId);
      const existing = mockArrivals.filter((item) => item.stopId === normalizedStop);
      if (existing.length > 0) return existing;

      const generated = generateArrivalsForStop(normalizedStop, 4);
      mockArrivals = [...generated, ...mockArrivals].slice(0, 24);
      return generated;
    }
    return $fetch<Arrival[]>(`${apiBase}/api/v1/arrivals`, {
      params: stopId ? { stopId } : {},
    });
  }

  async function getAlerts(routeId?: string): Promise<Alert[]> {
    if (mockMode) {
      tickMockData();
      if (!routeId) return mockAlerts;

      const normalizedRoute = normalizeId(routeId);
      const existing = mockAlerts.filter((item) => (item.routeId ?? "") === normalizedRoute);
      if (existing.length > 0) return existing;

      const generated = createAlert(alertSequence++, normalizedRoute);
      mockAlerts = [generated, ...mockAlerts].slice(0, 10);
      return [generated];
    }
    return $fetch<Alert[]>(`${apiBase}/api/v1/alerts`, {
      params: routeId ? { routeId } : {},
    });
  }

  async function getEquipment(stationId?: string): Promise<EquipmentStatus[]> {
    if (mockMode) {
      tickMockData();
      if (!stationId) return mockEquipment;

      const normalizedStation = normalizeId(stationId);
      const existing = mockEquipment.filter((item) => item.stationId === normalizedStation);
      if (existing.length > 0) return existing;

      const nowIso = new Date().toISOString();
      const generated: EquipmentStatus[] = [
        {
          stationId: normalizedStation,
          stationName: stationNameFor(normalizedStation),
          type: "elevator",
          name: `E-${normalizedStation}`,
          status: "operational",
          updatedAt: nowIso,
        },
        {
          stationId: normalizedStation,
          stationName: stationNameFor(normalizedStation),
          type: "escalator",
          name: `ES-${normalizedStation}`,
          status: Math.random() > 0.5 ? "operational" : "out_of_service",
          updatedAt: nowIso,
        },
      ];

      mockEquipment = [...generated, ...mockEquipment].slice(0, 32);
      return generated;
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
        summary: `${payload.origin} -> ${payload.destination} via Red Line`,
        departAt: depart.toISOString(),
        arriveAt: new Date(depart.getTime() + 31 * 60_000).toISOString(),
        durationMinutes: 31,
        transfers: 1,
        transferRisk: payload.accessibilityNeeded ? "medium" : "low",
        accessibilitySafe: !payload.accessibilityNeeded || Math.random() > 0.25,
        crowdingForecast: "high",
      };
      const saferTrip: TripOption = {
        id: "mock-safe",
        summary: `${payload.origin} -> ${payload.destination} (accessibility-priority)`,
        departAt: new Date(depart.getTime() + 4 * 60_000).toISOString(),
        arriveAt: new Date(depart.getTime() + 44 * 60_000).toISOString(),
        durationMinutes: 40,
        transfers: 0,
        transferRisk: "low",
        accessibilitySafe: true,
        crowdingForecast: "low",
      };

      const balancedTrip: TripOption = {
        id: "mock-balanced",
        summary: `${payload.origin} -> ${payload.destination} via transfer at Five Points`,
        departAt: new Date(depart.getTime() + 2 * 60_000).toISOString(),
        arriveAt: new Date(depart.getTime() + 37 * 60_000).toISOString(),
        durationMinutes: 35,
        transfers: 1,
        transferRisk: "medium",
        accessibilitySafe: !payload.accessibilityNeeded || Math.random() > 0.1,
        crowdingForecast: "moderate",
      };

      return [fastTrip, balancedTrip, saferTrip];
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
      const travelMinutes = fromStopId === toStopId ? 8 : randomInt(28, 58);
      const bufferMinutes = randomInt(5, 12);
      const leaveAt = new Date(arrival.getTime() - (travelMinutes + bufferMinutes) * 60_000);
      return {
        fromStopId,
        toStopId,
        arrivalBy,
        leaveAt: leaveAt.toISOString(),
        bufferMinutes,
        reliabilityNote:
          "Realtime variability and transfer risk suggest leaving early to preserve connection margin.",
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
        onUpdate({ arrivals: [...mockArrivals], alerts: [...mockAlerts] });
      }, 4000);

      onUpdate({ arrivals: [...mockArrivals], alerts: [...mockAlerts] });

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
