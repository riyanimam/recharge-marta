import { beforeEach, describe, expect, it } from "vitest";
import { useFavorites } from "../composables/useFavorites";

describe("useFavorites", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset singleton state
    const { clearAll } = useFavorites();
    clearAll();
  });

  it("starts with empty favorites", () => {
    const { favorites, totalCount } = useFavorites();
    expect(favorites.routes).toEqual([]);
    expect(favorites.stations).toEqual([]);
    expect(totalCount.value).toBe(0);
  });

  it("toggles a route on", () => {
    const { toggleRoute, isRouteBookmarked, totalCount } = useFavorites();
    toggleRoute("RED");
    expect(isRouteBookmarked("RED")).toBe(true);
    expect(totalCount.value).toBe(1);
  });

  it("toggles a route off", () => {
    const { toggleRoute, isRouteBookmarked } = useFavorites();
    toggleRoute("RED");
    toggleRoute("RED");
    expect(isRouteBookmarked("RED")).toBe(false);
  });

  it("toggles a station on", () => {
    const { toggleStation, isStationBookmarked } = useFavorites();
    toggleStation("MID");
    expect(isStationBookmarked("MID")).toBe(true);
  });

  it("toggles a station off", () => {
    const { toggleStation, isStationBookmarked } = useFavorites();
    toggleStation("MID");
    toggleStation("MID");
    expect(isStationBookmarked("MID")).toBe(false);
  });

  it("persists to localStorage", () => {
    const { toggleRoute, toggleStation } = useFavorites();
    toggleRoute("GOLD");
    toggleStation("NORTH");
    const stored = JSON.parse(localStorage.getItem("marta.favorites")!);
    expect(stored.routes).toContain("GOLD");
    expect(stored.stations).toContain("NORTH");
  });

  it("clearAll empties all favorites", () => {
    const { toggleRoute, toggleStation, clearAll, totalCount } = useFavorites();
    toggleRoute("RED");
    toggleStation("MID");
    clearAll();
    expect(totalCount.value).toBe(0);
  });

  it("counts routes and stations together", () => {
    const { toggleRoute, toggleStation, totalCount } = useFavorites();
    toggleRoute("RED");
    toggleRoute("GOLD");
    toggleStation("AIRPORT");
    expect(totalCount.value).toBe(3);
  });
});
