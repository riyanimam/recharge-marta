/**
 * Tests for useI18n composable — verifies translation lookup,
 * language switching, and that all supported languages have
 * complete translations.
 */
import { describe, expect, it } from "vitest";
import type { SupportedLang } from "~/composables/useI18n";
import { LANGUAGE_LABELS, useAppI18n } from "~/composables/useI18n";

describe("useAppI18n", () => {
  describe("t() translation lookup", () => {
    it("returns English translation for a known key", () => {
      const { t, setLanguage } = useAppI18n();
      setLanguage("en");
      expect(t("app.title")).toBe("Recharge MARTA");
    });

    it("falls back to the key itself when it does not exist", () => {
      const { t, setLanguage } = useAppI18n();
      setLanguage("en");
      expect(t("nonexistent.key")).toBe("nonexistent.key");
    });

    it("returns translated text after switching to Spanish", () => {
      const { t, setLanguage } = useAppI18n();
      setLanguage("es");
      expect(t("app.refresh")).toBe("Actualizar todo");
    });

    it("returns translated text after switching to French", () => {
      const { t, setLanguage } = useAppI18n();
      setLanguage("fr");
      expect(t("app.refresh")).toBe("Tout actualiser");
    });
  });

  describe("language labels", () => {
    it("has labels for all supported languages", () => {
      const keys = Object.keys(LANGUAGE_LABELS) as SupportedLang[];
      expect(keys).toContain("en");
      expect(keys).toContain("es");
      expect(keys).toContain("ko");
      expect(keys).toContain("zh");
      expect(keys).toContain("fr");
    });
  });

  describe("languageKeys", () => {
    it("returns all supported language codes", () => {
      const { languageKeys } = useAppI18n();
      expect(languageKeys.length).toBeGreaterThanOrEqual(5);
      expect(languageKeys).toContain("en");
    });
  });

  describe("translation completeness", () => {
    it("every language has the same set of keys as English", () => {
      const { t, setLanguage } = useAppI18n();
      setLanguage("en");

      // Get all English keys by checking known keys
      const englishKeys = [
        "nav.skip", "app.title", "app.subtitle", "app.mock", "app.live",
        "app.refresh", "app.refreshing",
        "overview.title", "overview.subtitle", "overview.metrics",
        "overview.arrivals", "overview.alerts", "overview.accessibility",
        "arrivals.title", "arrivals.subtitle", "arrivals.stopId",
        "arrivals.load", "arrivals.empty", "arrivals.min",
        "alerts.title", "alerts.subtitle", "alerts.routeFilter",
        "alerts.load", "alerts.empty", "alerts.high", "alerts.medium", "alerts.low",
        "access.title", "access.subtitle", "access.stationId",
        "access.check", "access.empty", "access.operational", "access.outOfService",
        "trip.title", "trip.subtitle", "trip.from", "trip.to", "trip.departAt",
        "trip.accessibleOnly", "trip.plan", "trip.empty", "trip.transfers",
        "trip.crowding", "trip.accessible", "trip.riskHigh", "trip.riskMedium", "trip.riskLow",
        "leave.title", "leave.subtitle", "leave.arriveBy", "leave.calculate",
        "leave.recommended", "leave.leaveAt", "leave.buffer", "leave.empty",
        "prefs.title", "prefs.theme", "prefs.themeSystem", "prefs.themeLight", "prefs.themeDark",
        "prefs.fontSize", "prefs.fontDefault", "prefs.fontLarge", "prefs.fontXLarge",
        "prefs.highContrast", "prefs.reducedMotion", "prefs.language", "prefs.close",
      ];

      const languages: SupportedLang[] = ["es", "ko", "zh", "fr"];

      for (const lang of languages) {
        setLanguage(lang);
        const missing = englishKeys.filter((key) => t(key) === key);
        expect(missing, `Missing keys in "${lang}"`).toEqual([]);
      }
    });
  });
});
