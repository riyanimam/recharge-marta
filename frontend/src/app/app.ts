import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MartaApiService } from './marta-api.service';
import {
  Alert,
  Arrival,
  Dashboard,
  EquipmentStatus,
  LeaveNowResponse,
  TripOption,
} from './models';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class App implements OnInit, OnDestroy {
  dashboard: Dashboard | null = null;
  arrivals: Arrival[] = [];
  alerts: Alert[] = [];
  equipment: EquipmentStatus[] = [];
  tripOptions: TripOption[] = [];
  leaveNowResult: LeaveNowResponse | null = null;

  stopId = 'MID';
  routeId = 'RED';
  stationId = 'MID';

  origin = 'Midtown';
  destination = 'Airport';
  departAt = this.toDateTimeLocal(new Date(Date.now() + 10 * 60_000));
  arrivalBy = this.toDateTimeLocal(new Date(Date.now() + 70 * 60_000));
  accessibilityNeeded = true;

  isLoading = false;
  error: string | null = null;

  private realtimeSource: EventSource | null = null;

  constructor(private readonly api: MartaApiService) {}

  ngOnInit(): void {
    this.refreshAll();
    this.connectRealtime();
  }

  ngOnDestroy(): void {
    this.realtimeSource?.close();
  }

  get accessibilityIssueCount(): number {
    return this.equipment.filter((item) => item.status !== 'operational').length;
  }

  async refreshAll(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      const [dashboard, arrivals, alerts, equipment] = await Promise.all([
        this.api.getDashboard('commuter-1'),
        this.api.getArrivals(this.stopId),
        this.api.getAlerts(this.routeId),
        this.api.getEquipment(this.stationId),
      ]);
      this.dashboard = dashboard;
      this.arrivals = arrivals;
      this.alerts = alerts;
      this.equipment = equipment;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to load dashboard.';
    } finally {
      this.isLoading = false;
    }
  }

  async loadArrivals(): Promise<void> {
    this.error = null;
    try {
      this.arrivals = await this.api.getArrivals(this.stopId);
    } catch {
      this.error = 'Failed to refresh arrivals.';
    }
  }

  async loadAlerts(): Promise<void> {
    this.error = null;
    try {
      this.alerts = await this.api.getAlerts(this.routeId);
    } catch {
      this.error = 'Failed to refresh alerts.';
    }
  }

  async loadEquipment(): Promise<void> {
    this.error = null;
    try {
      this.equipment = await this.api.getEquipment(this.stationId);
    } catch {
      this.error = 'Failed to refresh equipment status.';
    }
  }

  async planTrip(event: Event): Promise<void> {
    event.preventDefault();
    this.error = null;
    try {
      this.tripOptions = await this.api.planTrip({
        origin: this.origin,
        destination: this.destination,
        departAt: new Date(this.departAt).toISOString(),
        accessibilityNeeded: this.accessibilityNeeded,
      });
    } catch {
      this.error = 'Trip planner failed.';
    }
  }

  async calculateLeaveNow(event: Event): Promise<void> {
    event.preventDefault();
    this.error = null;
    try {
      this.leaveNowResult = await this.api.leaveNow(
        this.stopId,
        'AIRPORT',
        new Date(this.arrivalBy).toISOString()
      );
    } catch {
      this.error = 'Leave-now calculator failed.';
    }
  }

  formatTime(value: string): string {
    return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  private connectRealtime(): void {
    this.realtimeSource?.close();
    this.realtimeSource = this.api.openRealtime((data) => {
      this.arrivals = data.arrivals;
      this.alerts = data.alerts;
    });
  }

  private toDateTimeLocal(value: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = value.getFullYear();
    const month = pad(value.getMonth() + 1);
    const day = pad(value.getDate());
    const hours = pad(value.getHours());
    const minutes = pad(value.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
