/**
 * Favorites composable — persist favorite routes and stations to localStorage.
 * Inspired by the georgia-legislation-webcrawler favorites/sidebar pattern.
 */

const STORAGE_KEY = "marta.favorites";

interface FavoritesState {
  routes: string[];
  stations: string[];
}

function load(): FavoritesState {
  if (import.meta.server) return { routes: [], stations: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { routes: [], stations: [] };
    return { routes: [], stations: [], ...JSON.parse(raw) };
  } catch {
    return { routes: [], stations: [] };
  }
}

function persist(state: FavoritesState): void {
  if (import.meta.server) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const state = reactive<FavoritesState>(load());

export function useFavorites() {
  function toggleRoute(routeId: string): void {
    const idx = state.routes.indexOf(routeId);
    if (idx >= 0) {
      state.routes.splice(idx, 1);
    } else {
      state.routes.push(routeId);
    }
    persist({ ...state, routes: [...state.routes] });
  }

  function toggleStation(stationId: string): void {
    const idx = state.stations.indexOf(stationId);
    if (idx >= 0) {
      state.stations.splice(idx, 1);
    } else {
      state.stations.push(stationId);
    }
    persist({ ...state, stations: [...state.stations] });
  }

  function isRouteBookmarked(routeId: string): boolean {
    return state.routes.includes(routeId);
  }

  function isStationBookmarked(stationId: string): boolean {
    return state.stations.includes(stationId);
  }

  function clearAll(): void {
    state.routes = [];
    state.stations = [];
    persist({ routes: [], stations: [] });
  }

  const totalCount = computed(() => state.routes.length + state.stations.length);

  return {
    favorites: state,
    toggleRoute,
    toggleStation,
    isRouteBookmarked,
    isStationBookmarked,
    clearAll,
    totalCount,
  };
}
