/**
 * Export composable — download transit data as JSON or CSV.
 * Inspired by the georgia-legislation-webcrawler export utilities.
 */

import type { Alert, Arrival, EquipmentStatus, TripOption } from "~/types/models";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function dateSuffix(): string {
  return new Date().toISOString().split("T")[0];
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function useExport() {
  // ── JSON exports ──

  function exportArrivalsJSON(arrivals: Arrival[]): void {
    const blob = new Blob([JSON.stringify(arrivals, null, 2)], { type: "application/json" });
    downloadBlob(blob, `marta-arrivals-${dateSuffix()}.json`);
  }

  function exportAlertsJSON(alerts: Alert[]): void {
    const blob = new Blob([JSON.stringify(alerts, null, 2)], { type: "application/json" });
    downloadBlob(blob, `marta-alerts-${dateSuffix()}.json`);
  }

  function exportEquipmentJSON(equipment: EquipmentStatus[]): void {
    const blob = new Blob([JSON.stringify(equipment, null, 2)], { type: "application/json" });
    downloadBlob(blob, `marta-equipment-${dateSuffix()}.json`);
  }

  function exportTripsJSON(trips: TripOption[]): void {
    const blob = new Blob([JSON.stringify(trips, null, 2)], { type: "application/json" });
    downloadBlob(blob, `marta-trips-${dateSuffix()}.json`);
  }

  // ── CSV exports ──

  function exportArrivalsCSV(arrivals: Arrival[]): void {
    const headers = ["Route", "Stop", "Destination", "Minutes Away", "Predicted At", "Accessible"];
    const rows = arrivals.map((a) => [
      a.routeName,
      a.stopName,
      a.destination,
      String(a.minutesAway),
      a.predictedAt,
      a.accessibilitySafe ? "Yes" : "No",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `marta-arrivals-${dateSuffix()}.csv`);
  }

  function exportAlertsCSV(alerts: Alert[]): void {
    const headers = ["ID", "Title", "Severity", "Route", "Station", "Updated At", "Description"];
    const rows = alerts.map((a) => [
      a.id,
      a.title,
      a.severity,
      a.routeId ?? "",
      a.stationId ?? "",
      a.updatedAt,
      a.description,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `marta-alerts-${dateSuffix()}.csv`);
  }

  function exportEquipmentCSV(equipment: EquipmentStatus[]): void {
    const headers = ["Station", "Type", "Name", "Status", "Updated At"];
    const rows = equipment.map((e) => [
      e.stationName,
      e.type,
      e.name,
      e.status,
      e.updatedAt,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `marta-equipment-${dateSuffix()}.csv`);
  }

  return {
    exportArrivalsJSON,
    exportAlertsJSON,
    exportEquipmentJSON,
    exportTripsJSON,
    exportArrivalsCSV,
    exportAlertsCSV,
    exportEquipmentCSV,
  };
}
