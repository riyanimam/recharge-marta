export type ColorScheme = "light" | "dark" | "system";
export type FontSize = "default" | "large" | "x-large";

export type UserPreferences = {
  colorScheme: ColorScheme;
  fontSize: FontSize;
  highContrast: boolean;
  reducedMotion: boolean;
  language: string;
};

const STORAGE_KEY = "marta.prefs";

const DEFAULTS: UserPreferences = {
  colorScheme: "system",
  fontSize: "default",
  highContrast: false,
  reducedMotion: false,
  language: "en",
};

function loadPrefs(): UserPreferences {
  if (import.meta.server) return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function persistPrefs(prefs: UserPreferences): void {
  if (import.meta.server) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function applyToDocument(prefs: UserPreferences): void {
  if (import.meta.server) return;

  const root = document.documentElement;

  // Color scheme
  root.removeAttribute("data-theme");
  if (prefs.colorScheme !== "system") {
    root.setAttribute("data-theme", prefs.colorScheme);
  }

  // Font size
  root.setAttribute("data-font-size", prefs.fontSize);

  // High contrast
  root.classList.toggle("high-contrast", prefs.highContrast);

  // Reduced motion
  root.classList.toggle("reduced-motion", prefs.reducedMotion);

  // Language
  root.setAttribute("lang", prefs.language);
}

const prefsState = reactive<UserPreferences>(loadPrefs());

export function usePreferences() {
  function update(patch: Partial<UserPreferences>): UserPreferences {
    Object.assign(prefsState, patch);
    persistPrefs({ ...prefsState });
    applyToDocument({ ...prefsState });
    return { ...prefsState };
  }

  function init(): void {
    applyToDocument({ ...prefsState });
  }

  return {
    prefs: prefsState,
    update,
    init,
  };
}
