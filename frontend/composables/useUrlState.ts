/**
 * URL state composable — keep key UI state in the query string for shareable links.
 * Inspired by the georgia-legislation-webcrawler URL state management pattern.
 */

export interface UrlStateParams {
  stop?: string;
  route?: string;
  station?: string;
  section?: string;
  lang?: string;
}

export function useUrlState() {
  function read(): UrlStateParams {
    if (import.meta.server) return {};
    const params = new URLSearchParams(window.location.search);
    const result: UrlStateParams = {};
    if (params.get("stop")) result.stop = params.get("stop")!;
    if (params.get("route")) result.route = params.get("route")!;
    if (params.get("station")) result.station = params.get("station")!;
    if (params.get("section")) result.section = params.get("section")!;
    if (params.get("lang")) result.lang = params.get("lang")!;
    return result;
  }

  function write(state: UrlStateParams): void {
    if (import.meta.server) return;
    const params = new URLSearchParams();
    if (state.stop) params.set("stop", state.stop);
    if (state.route) params.set("route", state.route);
    if (state.station) params.set("station", state.station);
    if (state.section) params.set("section", state.section);
    if (state.lang) params.set("lang", state.lang);

    // Preserve mock param if present
    const current = new URLSearchParams(window.location.search);
    if (current.get("mock")) params.set("mock", current.get("mock")!);

    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }

  function copyLink(): void {
    if (import.meta.server) return;
    navigator.clipboard.writeText(window.location.href);
  }

  return { read, write, copyLink };
}
