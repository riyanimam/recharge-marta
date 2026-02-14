/**
 * Alert tracking composable — track which alerts the user has already seen.
 * Inspired by the georgia-legislation-webcrawler useReadingProgress hook.
 */

const STORAGE_KEY = "marta.readAlerts";

function loadRead(): Set<string> {
  if (import.meta.server) return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persistRead(ids: Set<string>): void {
  if (import.meta.server) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

const readIds = reactive(new Set<string>(loadRead()));

export function useAlertTracking() {
  function markAsRead(alertId: string): void {
    readIds.add(alertId);
    persistRead(readIds);
  }

  function isRead(alertId: string): boolean {
    return readIds.has(alertId);
  }

  function getReadCount(): number {
    return readIds.size;
  }

  function getUnreadCount(alertIds: string[]): number {
    return alertIds.filter((id) => !readIds.has(id)).length;
  }

  function clearProgress(): void {
    readIds.clear();
    persistRead(readIds);
  }

  return {
    markAsRead,
    isRead,
    getReadCount,
    getUnreadCount,
    clearProgress,
  };
}
