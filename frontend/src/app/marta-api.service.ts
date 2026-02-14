import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Alert,
  Arrival,
  Dashboard,
  EquipmentStatus,
  LeaveNowResponse,
  RealtimePayload,
  TripOption,
} from './models';

type PlanTripPayload = {
  origin: string;
  destination: string;
  departAt: string;
  accessibilityNeeded: boolean;
};

@Injectable({ providedIn: 'root' })
export class MartaApiService {
  private readonly apiBase = 'http://localhost:8080';

  constructor(private readonly http: HttpClient) {}

  getDashboard(userId: string): Promise<Dashboard> {
    return firstValueFrom(
      this.http.get<Dashboard>(`${this.apiBase}/api/v1/dashboard`, { params: { userId } })
    );
  }

  getArrivals(stopId?: string): Promise<Arrival[]> {
    return firstValueFrom(
      this.http.get<Arrival[]>(`${this.apiBase}/api/v1/arrivals`, {
        params: stopId ? { stopId } : {},
      })
    );
  }

  getAlerts(routeId?: string): Promise<Alert[]> {
    return firstValueFrom(
      this.http.get<Alert[]>(`${this.apiBase}/api/v1/alerts`, {
        params: routeId ? { routeId } : {},
      })
    );
  }

  getEquipment(stationId?: string): Promise<EquipmentStatus[]> {
    return firstValueFrom(
      this.http.get<EquipmentStatus[]>(`${this.apiBase}/api/v1/equipment`, {
        params: stationId ? { stationId } : {},
      })
    );
  }

  planTrip(payload: PlanTripPayload): Promise<TripOption[]> {
    return firstValueFrom(this.http.post<TripOption[]>(`${this.apiBase}/api/v1/trips/plan`, payload));
  }

  leaveNow(fromStopId: string, toStopId: string, arrivalBy: string): Promise<LeaveNowResponse> {
    return firstValueFrom(
      this.http.get<LeaveNowResponse>(`${this.apiBase}/api/v1/trips/leave-now`, {
        params: { fromStopId, toStopId, arrivalBy },
      })
    );
  }

  openRealtime(onUpdate: (payload: RealtimePayload) => void): EventSource {
    const source = new EventSource(`${this.apiBase}/api/v1/realtime/stream`);
    source.addEventListener('update', (event) => {
      const data = JSON.parse((event as MessageEvent<string>).data) as RealtimePayload;
      onUpdate(data);
    });
    source.onerror = () => source.close();
    return source;
  }
}
