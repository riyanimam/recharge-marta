export type Arrival = {
  routeId: string;
  routeName: string;
  stopId: string;
  stopName: string;
  destination: string;
  predictedAt: string;
  minutesAway: number;
  accessibilitySafe: boolean;
};

export type Alert = {
  id: string;
  title: string;
  description: string;
  routeId?: string;
  stationId?: string;
  severity: "low" | "medium" | "high";
  updatedAt: string;
};

export type EquipmentStatus = {
  stationId: string;
  stationName: string;
  type: "elevator" | "escalator";
  name: string;
  status: "operational" | "out_of_service";
  updatedAt: string;
};

export type TripOption = {
  id: string;
  summary: string;
  departAt: string;
  arriveAt: string;
  durationMinutes: number;
  transfers: number;
  transferRisk: "low" | "medium" | "high";
  accessibilitySafe: boolean;
  crowdingForecast: "low" | "moderate" | "high";
};

export type LeaveNowResponse = {
  fromStopId: string;
  toStopId: string;
  arrivalBy: string;
  leaveAt: string;
  bufferMinutes: number;
  reliabilityNote: string;
};

export type Dashboard = {
  userId: string;
  favoriteStops: string[];
  favoriteRoutes: string[];
  nextArrivals: Arrival[];
  relevantAlerts: Alert[];
  equipmentSummary: EquipmentStatus[];
};

export type RealtimePayload = {
  arrivals: Arrival[];
  alerts: Alert[];
};
