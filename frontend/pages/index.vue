<script setup lang="ts">
import type {
  Alert,
  Arrival,
  Dashboard,
  EquipmentStatus,
  LeaveNowResponse,
  TripOption,
} from "~/types/models";
import type { SupportedLang } from "~/composables/useI18n";
import type { ColorScheme, FontSize } from "~/composables/usePreferences";
import type { ShortcutDef } from "~/composables/useKeyboardShortcuts";

const api = useMartaApi();
const { t, currentLang, languageLabels, languageKeys, setLanguage } = useAppI18n();
const { prefs, update: updatePrefs, init: initPrefs } = usePreferences();
const { favorites, toggleRoute, toggleStation, isRouteBookmarked, isStationBookmarked, totalCount: favCount } = useFavorites();
const { exportArrivalsJSON, exportAlertsJSON, exportArrivalsCSV, exportAlertsCSV } = useExport();
const { markAsRead, isRead: isAlertRead, getUnreadCount } = useAlertTracking();
const urlState = useUrlState();

const isMockMode = import.meta.server ? false : api.isMockModeEnabled();

const dashboard = ref<Dashboard | null>(null);
const arrivals = ref<Arrival[]>([]);
const alerts = ref<Alert[]>([]);
const equipment = ref<EquipmentStatus[]>([]);
const tripOptions = ref<TripOption[]>([]);
const leaveNowResult = ref<LeaveNowResponse | null>(null);

const stopId = ref("MID");
const routeId = ref("RED");
const stationId = ref("MID");

const origin = ref("Midtown");
const destination = ref("Airport");
const departAt = ref(toDateTimeLocal(new Date(Date.now() + 10 * 60_000)));
const arrivalBy = ref(toDateTimeLocal(new Date(Date.now() + 70 * 60_000)));
const accessibilityNeeded = ref(true);

const isLoading = ref(false);
const error = ref<string | null>(null);
const settingsOpen = ref(false);
const shortcutsHelpOpen = ref(false);
const linkCopied = ref(false);

let realtimeHandle: { close: () => void } | null = null;

const unreadAlertCount = computed(() => getUnreadCount(alerts.value.map((a) => a.id)));

const accessibilityIssueCount = computed(() =>
  equipment.value.filter((item) => item.status !== "operational").length,
);

// ── Keyboard shortcuts ──

const shortcutDefs = computed<ShortcutDef[]>(() => [
  { key: "r", description: "Refresh all data", handler: () => refreshAll() },
  { key: "s", description: "Toggle settings panel", handler: () => toggleSettings() },
  { key: "?", description: "Show keyboard shortcuts", handler: () => { shortcutsHelpOpen.value = true; } },
  { key: "Escape", description: "Close panels / dialogs", handler: () => { settingsOpen.value = false; shortcutsHelpOpen.value = false; }, allowInInput: true },
]);

useKeyboardShortcuts(shortcutDefs);

// ── Lifecycle ──

onMounted(() => {
  initPrefs();
  setLanguage(prefs.language as SupportedLang);

  // Restore from URL if present
  const urlParams = urlState.read();
  if (urlParams.stop) stopId.value = urlParams.stop;
  if (urlParams.route) routeId.value = urlParams.route;
  if (urlParams.station) stationId.value = urlParams.station;
  if (urlParams.lang) {
    setLanguage(urlParams.lang as SupportedLang);
    updatePrefs({ language: urlParams.lang });
  }

  refreshAll();
  connectRealtime();
});

onUnmounted(() => {
  realtimeHandle?.close();
});

// ── Actions ──

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value;
}

function setColorScheme(scheme: ColorScheme) {
  updatePrefs({ colorScheme: scheme });
}

function setFontSize(size: FontSize) {
  updatePrefs({ fontSize: size });
}

function setHighContrast(value: boolean) {
  updatePrefs({ highContrast: value });
}

function setReducedMotion(value: boolean) {
  updatePrefs({ reducedMotion: value });
}

function onSetLanguage(lang: string) {
  setLanguage(lang as SupportedLang);
  updatePrefs({ language: lang });
}

async function refreshAll() {
  isLoading.value = true;
  error.value = null;
  try {
    const [d, a, al, eq] = await Promise.all([
      api.getDashboard("commuter-1"),
      api.getArrivals(stopId.value),
      api.getAlerts(routeId.value),
      api.getEquipment(stationId.value),
    ]);
    dashboard.value = d;
    arrivals.value = a;
    alerts.value = al;
    equipment.value = eq;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load dashboard.";
  } finally {
    isLoading.value = false;
  }
}

async function loadArrivals() {
  error.value = null;
  try {
    arrivals.value = await api.getArrivals(stopId.value);
  } catch {
    error.value = "Failed to refresh arrivals.";
  }
}

async function loadAlerts() {
  error.value = null;
  try {
    alerts.value = await api.getAlerts(routeId.value);
  } catch {
    error.value = "Failed to refresh alerts.";
  }
}

async function loadEquipment() {
  error.value = null;
  try {
    equipment.value = await api.getEquipment(stationId.value);
  } catch {
    error.value = "Failed to refresh equipment status.";
  }
}

async function planTrip() {
  error.value = null;
  try {
    tripOptions.value = await api.planTrip({
      origin: origin.value,
      destination: destination.value,
      departAt: new Date(departAt.value).toISOString(),
      accessibilityNeeded: accessibilityNeeded.value,
    });
  } catch {
    error.value = "Trip planner failed.";
  }
}

async function calculateLeaveNow() {
  error.value = null;
  try {
    leaveNowResult.value = await api.leaveNow(
      stopId.value,
      "AIRPORT",
      new Date(arrivalBy.value).toISOString(),
    );
  } catch {
    error.value = "Leave-now calculator failed.";
  }
}

// ── Helpers ──

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function alertSeverityLabel(severity: Alert["severity"]): string {
  const map: Record<string, string> = {
    high: t("alerts.high"),
    medium: t("alerts.medium"),
    low: t("alerts.low"),
  };
  return map[severity] ?? severity;
}

function equipmentStatusLabel(status: EquipmentStatus["status"]): string {
  return status === "operational" ? t("access.operational") : t("access.outOfService");
}

function tripRiskLabel(risk: TripOption["transferRisk"]): string {
  const map: Record<string, string> = {
    high: t("trip.riskHigh"),
    medium: t("trip.riskMedium"),
    low: t("trip.riskLow"),
  };
  return map[risk] ?? risk;
}

function severityClass(severity: Alert["severity"]): string {
  const map: Record<string, string> = {
    high: "pill--danger",
    medium: "pill--warning",
    low: "pill--info",
  };
  return map[severity] ?? "";
}

function riskClass(risk: TripOption["transferRisk"]): string {
  const map: Record<string, string> = {
    high: "pill--danger",
    medium: "pill--warning",
    low: "pill--success",
  };
  return map[risk] ?? "";
}

function connectRealtime() {
  realtimeHandle?.close();
  realtimeHandle = api.openRealtime((data) => {
    arrivals.value = data.arrivals;
    alerts.value = data.alerts;
  });
}

// ── URL state sync ──

function syncUrl() {
  urlState.write({
    stop: stopId.value !== "MID" ? stopId.value : undefined,
    route: routeId.value !== "RED" ? routeId.value : undefined,
    station: stationId.value !== "MID" ? stationId.value : undefined,
    lang: prefs.language !== "en" ? prefs.language : undefined,
  });
}

watch([stopId, routeId, stationId], syncUrl);

// ── Share link ──

function shareLink() {
  syncUrl();
  urlState.copyLink();
  linkCopied.value = true;
  setTimeout(() => { linkCopied.value = false; }, 2000);
}

function handleRetry() {
  refreshAll();
}

// ── Quick-action wrappers ──

function onQuickExportJson() {
  exportArrivalsJSON(arrivals.value);
}

function onQuickExportCsv() {
  exportArrivalsCSV(arrivals.value);
}

function toDateTimeLocal(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hours = pad(value.getHours());
  const minutes = pad(value.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
</script>

<template>
  <a class="skip-link" href="#main-content">{{ t('nav.skip') }}</a>

  <!-- ═══ Top navigation bar ═══ -->
  <header class="topbar">
    <div class="topbar-inner">
      <div class="topbar-brand">
        <div class="brand-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="7" fill="var(--rm-primary)"/><path d="M7 19.5V8.5a1 1 0 011-1h12a1 1 0 011 1v11a1 1 0 01-1 1H8a1 1 0 01-1-1z" stroke="#fff" stroke-width="1.6"/><path d="M10 12h8M10 15h5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>
        </div>
        <div>
          <h1 class="brand-title">Recharge MARTA</h1>
          <p class="brand-subtitle">{{ t('app.subtitle') }}</p>
        </div>
      </div>

      <div class="topbar-center">
        <div class="topbar-badges">
          <span v-if="isMockMode" class="badge badge--mock">{{ t('app.mock') }}</span>
          <span class="badge badge--live"><span class="live-dot" aria-hidden="true"></span> {{ t('app.live') }}</span>
        </div>
      </div>

      <nav class="topbar-actions" aria-label="Global actions">
        <button class="topbar-btn" :aria-label="t('shortcuts.open')" @click="shortcutsHelpOpen = true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1" y="1" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 6.5a2.5 2.5 0 014.37 1.66c0 1.67-2.5 1.67-2.5 3.34M9 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button
          class="topbar-btn"
          :aria-expanded="settingsOpen"
          aria-controls="settings-panel"
          :aria-label="t('prefs.title')"
          @click="toggleSettings()"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.05 3.05l1.41 1.41M13.54 13.54l1.41 1.41M3.05 14.95l1.41-1.41M13.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <button
          class="btn btn--primary"
          :disabled="isLoading"
          :aria-label="t('app.refresh')"
          @click="refreshAll()"
        >
          <svg v-if="!isLoading" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8a6 6 0 0110.47-4M14 8a6 6 0 01-10.47 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 1v3h-3M4 15v-3h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <svg v-else class="spin" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" stroke-dasharray="28 10" stroke-linecap="round"/></svg>
          {{ isLoading ? t('app.refreshing') : t('app.refresh') }}
        </button>
      </nav>
    </div>
  </header>

  <!-- ═══ Settings drawer ═══ -->
  <Transition name="drawer">
    <aside
      v-if="settingsOpen"
      id="settings-panel"
      class="settings-drawer"
      role="dialog"
      :aria-label="t('prefs.title')"
    >
      <div class="drawer-header">
        <h2>{{ t('prefs.title') }}</h2>
        <button class="topbar-btn" :aria-label="t('prefs.close')" @click="toggleSettings()">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>

      <div class="drawer-body">
        <fieldset class="settings-fieldset">
          <legend>{{ t('prefs.theme') }}</legend>
          <div class="seg-control" role="radiogroup" :aria-label="t('prefs.theme')">
            <button v-for="scheme in (['system', 'light', 'dark'] as const)" :key="scheme"
              class="seg-btn" :class="{ active: prefs.colorScheme === scheme }"
              role="radio" :aria-checked="prefs.colorScheme === scheme"
              @click="setColorScheme(scheme)">
              {{ t(`prefs.theme${scheme.charAt(0).toUpperCase() + scheme.slice(1)}`) }}
            </button>
          </div>
        </fieldset>

        <fieldset class="settings-fieldset">
          <legend>{{ t('prefs.fontSize') }}</legend>
          <div class="seg-control" role="radiogroup" :aria-label="t('prefs.fontSize')">
            <button v-for="fs in (['default', 'large', 'x-large'] as const)" :key="fs"
              class="seg-btn" :class="{ active: prefs.fontSize === fs }"
              role="radio" :aria-checked="prefs.fontSize === fs"
              @click="setFontSize(fs)">
              {{ t(`prefs.font${fs === 'default' ? 'Default' : fs === 'large' ? 'Large' : 'XLarge'}`) }}
            </button>
          </div>
        </fieldset>

        <label class="toggle-row">
          <span>{{ t('prefs.highContrast') }}</span>
          <input type="checkbox" class="sr-only" :checked="prefs.highContrast" @change="setHighContrast(!prefs.highContrast)" />
          <span class="toggle-track" :class="{ on: prefs.highContrast }"><span class="toggle-thumb" /></span>
        </label>

        <label class="toggle-row">
          <span>{{ t('prefs.reducedMotion') }}</span>
          <input type="checkbox" class="sr-only" :checked="prefs.reducedMotion" @change="setReducedMotion(!prefs.reducedMotion)" />
          <span class="toggle-track" :class="{ on: prefs.reducedMotion }"><span class="toggle-thumb" /></span>
        </label>

        <fieldset class="settings-fieldset">
          <legend>{{ t('prefs.language') }}</legend>
          <select
            :value="prefs.language"
            class="select"
            :aria-label="t('prefs.language')"
            @change="onSetLanguage(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="lang in languageKeys" :key="lang" :value="lang">
              {{ languageLabels[lang] }}
            </option>
          </select>
        </fieldset>
      </div>
    </aside>
  </Transition>
  <Transition name="overlay-fade">
    <div v-if="settingsOpen" class="drawer-overlay" @click="settingsOpen = false" />
  </Transition>

  <!-- ═══ Main content ═══ -->
  <main id="main-content" class="page-wrap">
    <div class="page-inner">
      <!-- Error banner -->
      <Transition name="slide-down">
        <div v-if="error" class="alert alert--danger" role="alert">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="7.5" stroke="currentColor" stroke-width="1.5"/><path d="M9 5.5v4M9 12.5h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span class="alert-text">{{ error }}</span>
          <button class="btn btn--secondary btn--sm" @click="handleRetry()">{{ t('app.refresh') }}</button>
        </div>
      </Transition>

      <!-- Loading skeleton -->
      <template v-if="isLoading && arrivals.length === 0">
        <section class="card card--hero">
          <SkeletonLoader variant="stat" :count="3" />
        </section>
        <div class="grid-2">
          <section class="card"><SkeletonLoader variant="row" :count="3" /></section>
          <section class="card"><SkeletonLoader variant="row" :count="2" /></section>
        </div>
      </template>

      <template v-else>
        <!-- ── Overview hero ── -->
        <section class="card card--hero" aria-labelledby="overview-title">
          <div class="card-header">
            <div>
              <h2 id="overview-title" class="card-title">{{ t('overview.title') }}</h2>
              <p class="card-desc">{{ t('overview.subtitle') }}</p>
            </div>
          </div>

          <div class="kpi-row" role="list" :aria-label="t('overview.metrics')">
            <article class="kpi" role="listitem">
              <span class="kpi-label">{{ t('overview.arrivals') }}</span>
              <span class="kpi-value">{{ arrivals.length }}</span>
            </article>
            <article class="kpi" role="listitem">
              <span class="kpi-label">{{ t('overview.alerts') }}</span>
              <span class="kpi-value">
                {{ alerts.length }}
                <span v-if="unreadAlertCount > 0" class="kpi-badge">{{ unreadAlertCount }} {{ t('alerts.unread') }}</span>
              </span>
            </article>
            <article class="kpi" role="listitem">
              <span class="kpi-label">{{ t('overview.accessibility') }}</span>
              <span class="kpi-value" :class="{ 'kpi-value--warn': accessibilityIssueCount > 0 }">{{ accessibilityIssueCount }}</span>
            </article>
          </div>

          <div v-if="dashboard || favCount > 0" class="chip-row">
            <template v-if="dashboard">
              <span v-for="route in dashboard.favoriteRoutes" :key="route" class="chip chip--route">Route {{ route }}</span>
              <span v-for="stop in dashboard.favoriteStops" :key="stop" class="chip chip--stop">Stop {{ stop }}</span>
            </template>
            <template v-if="favCount > 0">
              <span v-for="route in favorites.routes" :key="'fav-r-' + route" class="chip chip--fav">&#9733; Route {{ route }}</span>
              <span v-for="station in favorites.stations" :key="'fav-s-' + station" class="chip chip--fav">&#9733; {{ station }}</span>
            </template>
          </div>
        </section>

        <!-- ── Two-column grid: Arrivals + Alerts ── -->
        <div class="grid-2">
          <!-- Arrivals -->
          <section class="card" aria-labelledby="arrivals-title">
            <div class="card-header">
              <div>
                <h2 id="arrivals-title" class="card-title">{{ t('arrivals.title') }}</h2>
                <p class="card-desc">{{ t('arrivals.subtitle') }}</p>
              </div>
              <div class="card-actions" v-if="arrivals.length > 0">
                <button class="btn btn--ghost btn--sm" :aria-label="t('export.json')" @click="exportArrivalsJSON(arrivals)">JSON</button>
                <button class="btn btn--ghost btn--sm" :aria-label="t('export.csv')" @click="exportArrivalsCSV(arrivals)">CSV</button>
              </div>
            </div>

            <div class="filter-bar">
              <label class="field">
                <span class="field-label">{{ t('arrivals.stopId') }}</span>
                <input v-model="stopId" class="input" placeholder="MID" />
              </label>
              <button class="btn btn--secondary" @click="loadArrivals()">{{ t('arrivals.load') }}</button>
            </div>

            <ul class="data-list">
              <li v-for="item in arrivals" :key="item.routeId + '-' + item.destination + '-' + item.stopId" class="data-row">
                <div class="data-row-main">
                  <strong class="data-row-title">{{ item.routeName }}</strong>
                  <p class="data-row-sub">{{ item.stopName }} &rarr; {{ item.destination }}</p>
                </div>
                <div class="data-row-end">
                  <span class="pill pill--info">{{ item.minutesAway }} {{ t('arrivals.min') }}</span>
                  <span class="meta-text">{{ formatTime(item.predictedAt) }}</span>
                  <button class="icon-btn icon-btn--star" :aria-label="isRouteBookmarked(item.routeId) ? t('fav.remove') : t('fav.add')" @click="toggleRoute(item.routeId)">
                    {{ isRouteBookmarked(item.routeId) ? '&#9733;' : '&#9734;' }}
                  </button>
                </div>
              </li>
              <li v-if="arrivals.length === 0" class="empty">{{ t('arrivals.empty') }}</li>
            </ul>
          </section>

          <!-- Alerts -->
          <section class="card" aria-labelledby="alerts-title">
            <div class="card-header">
              <div>
                <h2 id="alerts-title" class="card-title">{{ t('alerts.title') }}</h2>
                <p class="card-desc">{{ t('alerts.subtitle') }}</p>
              </div>
              <div class="card-actions" v-if="alerts.length > 0">
                <button class="btn btn--ghost btn--sm" :aria-label="t('export.json')" @click="exportAlertsJSON(alerts)">JSON</button>
                <button class="btn btn--ghost btn--sm" :aria-label="t('export.csv')" @click="exportAlertsCSV(alerts)">CSV</button>
              </div>
            </div>

            <div class="filter-bar">
              <label class="field">
                <span class="field-label">{{ t('alerts.routeFilter') }}</span>
                <input v-model="routeId" class="input" placeholder="RED" />
              </label>
              <button class="btn btn--secondary" @click="loadAlerts()">{{ t('alerts.load') }}</button>
            </div>

            <ul class="data-list">
              <li
                v-for="alertItem in alerts"
                :key="alertItem.id"
                class="data-row"
                :class="{ 'data-row--unread': !isAlertRead(alertItem.id) }"
                @click="markAsRead(alertItem.id)"
              >
                <div class="data-row-main">
                  <div class="data-row-title-row">
                    <strong class="data-row-title">{{ alertItem.title }}</strong>
                    <span v-if="!isAlertRead(alertItem.id)" class="badge badge--new">{{ t('alerts.new') }}</span>
                  </div>
                  <p class="data-row-sub">{{ alertItem.description }}</p>
                </div>
                <div class="data-row-end">
                  <span class="pill" :class="severityClass(alertItem.severity)">{{ alertSeverityLabel(alertItem.severity) }}</span>
                  <span class="meta-text">{{ formatTime(alertItem.updatedAt) }}</span>
                </div>
              </li>
              <li v-if="alerts.length === 0" class="empty">{{ t('alerts.empty') }}</li>
            </ul>
          </section>
        </div>

        <!-- ── Two-column: Equipment + Trip Planner ── -->
        <div class="grid-2">
          <!-- Accessibility / Equipment -->
          <section class="card" aria-labelledby="access-title">
            <div class="card-header">
              <div>
                <h2 id="access-title" class="card-title">{{ t('access.title') }}</h2>
                <p class="card-desc">{{ t('access.subtitle') }}</p>
              </div>
            </div>

            <div class="filter-bar">
              <label class="field">
                <span class="field-label">{{ t('access.stationId') }}</span>
                <input v-model="stationId" class="input" placeholder="MID" />
              </label>
              <button class="btn btn--secondary" @click="loadEquipment()">{{ t('access.check') }}</button>
            </div>

            <ul class="data-list">
              <li v-for="item in equipment" :key="item.stationId + '-' + item.name" class="data-row">
                <div class="data-row-main">
                  <strong class="data-row-title">{{ item.stationName }}</strong>
                  <p class="data-row-sub">{{ item.type }} {{ item.name }}</p>
                </div>
                <div class="data-row-end">
                  <span class="pill" :class="item.status === 'operational' ? 'pill--success' : 'pill--danger'">
                    {{ equipmentStatusLabel(item.status) }}
                  </span>
                  <span class="meta-text">{{ formatTime(item.updatedAt) }}</span>
                  <button class="icon-btn icon-btn--star" :aria-label="isStationBookmarked(item.stationId) ? t('fav.remove') : t('fav.add')" @click="toggleStation(item.stationId)">
                    {{ isStationBookmarked(item.stationId) ? '&#9733;' : '&#9734;' }}
                  </button>
                </div>
              </li>
              <li v-if="equipment.length === 0" class="empty">{{ t('access.empty') }}</li>
            </ul>
          </section>

          <!-- Trip Planner -->
          <section class="card" aria-labelledby="trip-title">
            <div class="card-header">
              <div>
                <h2 id="trip-title" class="card-title">{{ t('trip.title') }}</h2>
                <p class="card-desc">{{ t('trip.subtitle') }}</p>
              </div>
            </div>

            <form class="form-stack" @submit.prevent="planTrip()">
              <div class="form-row-2">
                <label class="field">
                  <span class="field-label">{{ t('trip.from') }}</span>
                  <input v-model="origin" class="input" required />
                </label>
                <label class="field">
                  <span class="field-label">{{ t('trip.to') }}</span>
                  <input v-model="destination" class="input" required />
                </label>
              </div>
              <label class="field">
                <span class="field-label">{{ t('trip.departAt') }}</span>
                <input type="datetime-local" v-model="departAt" class="input" required />
              </label>
              <label class="toggle-row toggle-row--compact">
                <span>{{ t('trip.accessibleOnly') }}</span>
                <input type="checkbox" class="sr-only" v-model="accessibilityNeeded" />
                <span class="toggle-track" :class="{ on: accessibilityNeeded }"><span class="toggle-thumb" /></span>
              </label>
              <button class="btn btn--primary btn--full" type="submit">{{ t('trip.plan') }}</button>
            </form>

            <ul class="data-list" v-if="tripOptions.length > 0">
              <li v-for="trip in tripOptions" :key="trip.id" class="data-row">
                <div class="data-row-main">
                  <strong class="data-row-title">{{ trip.summary }}</strong>
                  <p class="data-row-sub">
                    {{ trip.durationMinutes }} {{ t('arrivals.min') }}
                    &bull; {{ trip.transfers }} {{ t('trip.transfers') }}
                    &bull; {{ t('trip.crowding') }} {{ trip.crowdingForecast }}
                  </p>
                </div>
                <div class="data-row-end">
                  <span class="pill" :class="riskClass(trip.transferRisk)">{{ tripRiskLabel(trip.transferRisk) }}</span>
                  <span v-if="trip.accessibilitySafe" class="pill pill--success">{{ t('trip.accessible') }}</span>
                </div>
              </li>
            </ul>
            <p v-else class="empty">{{ t('trip.empty') }}</p>
          </section>
        </div>

        <!-- ── Leave-Now (full width) ── -->
        <section class="card" aria-labelledby="leave-title">
          <div class="card-header">
            <div>
              <h2 id="leave-title" class="card-title">{{ t('leave.title') }}</h2>
              <p class="card-desc">{{ t('leave.subtitle') }}</p>
            </div>
          </div>

          <form class="filter-bar" @submit.prevent="calculateLeaveNow()">
            <label class="field">
              <span class="field-label">{{ t('leave.arriveBy') }}</span>
              <input type="datetime-local" v-model="arrivalBy" class="input" required />
            </label>
            <button class="btn btn--primary" type="submit">{{ t('leave.calculate') }}</button>
          </form>

          <article v-if="leaveNowResult" class="result-card">
            <h3 class="result-title">{{ t('leave.recommended') }}</h3>
            <p class="result-body">
              {{ t('leave.leaveAt') }}
              <strong>{{ formatTime(leaveNowResult.leaveAt) }}</strong>
              &mdash; {{ leaveNowResult.bufferMinutes }} {{ t('leave.buffer') }}
            </p>
            <p class="meta-text">{{ leaveNowResult.reliabilityNote }}</p>
          </article>
          <p v-else class="meta-text leave-empty">{{ t('leave.empty') }}</p>
        </section>
      </template>
    </div>
  </main>

  <!-- Quick Actions FAB -->
  <QuickActions
    @refresh="refreshAll()"
    @export-json="onQuickExportJson()"
    @export-csv="onQuickExportCsv()"
    @share="shareLink()"
  />

  <!-- Share toast -->
  <Transition name="toast">
    <div v-if="linkCopied" class="toast" role="status">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      {{ t('share.copied') }}
    </div>
  </Transition>

  <!-- Keyboard shortcuts help -->
  <KeyboardShortcutsHelp
    :shortcuts="shortcutDefs"
    :open="shortcutsHelpOpen"
    @close="shortcutsHelpOpen = false"
  />
</template>

<style lang="scss" scoped>
/* ═══════════════════════════════════════════════════════════════
   Recharge MARTA — Page Styles (Enterprise)
   ═══════════════════════════════════════════════════════════════ */

/* ── Utility ── */
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

.skip-link {
  position: absolute; left: -9999px; top: 0; z-index: 999;
  &:focus {
    left: var(--rm-space-md); top: var(--rm-space-md);
    padding: var(--rm-space-sm) var(--rm-space-md);
    background: var(--rm-primary); color: var(--rm-primary-text);
    border-radius: var(--rm-radius-md); font-weight: 600;
  }
}

/* ── Topbar ── */
.topbar {
  position: sticky; top: 0; z-index: 50;
  background: var(--rm-bg-surface);
  border-bottom: 1px solid var(--rm-border-default);
  box-shadow: var(--rm-shadow-sm);
  backdrop-filter: blur(12px);
}

.topbar-inner {
  display: flex; align-items: center; gap: var(--rm-space-lg);
  max-width: var(--rm-max-width); margin: 0 auto;
  padding: var(--rm-space-md) var(--rm-space-xl);
  height: var(--rm-header-height);
}

.topbar-brand {
  display: flex; align-items: center; gap: var(--rm-space-md);
  flex-shrink: 0;
}

.brand-icon { flex-shrink: 0; display: flex; }

.brand-title {
  font-size: 1.125rem; font-weight: 700; letter-spacing: -0.01em;
  margin: 0;
}

.brand-subtitle {
  font-size: 0.8rem; color: var(--rm-text-secondary);
  margin: 0; line-height: 1.2;
}

.topbar-center { flex: 1; display: flex; justify-content: center; }

.topbar-badges { display: flex; gap: var(--rm-space-sm); }

.badge {
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.2rem 0.6rem; border-radius: var(--rm-radius-full);
  font-size: 0.72rem; font-weight: 600; letter-spacing: 0.02em;
  text-transform: uppercase;
}

.badge--mock {
  background: var(--rm-warning-bg); color: var(--rm-warning);
  border: 1px solid var(--rm-warning);
}

.badge--live {
  background: var(--rm-success-bg); color: var(--rm-success);
  border: 1px solid var(--rm-success);
}

.badge--new {
  background: var(--rm-primary); color: var(--rm-primary-text);
  font-size: 0.65rem; padding: 0.12rem 0.42rem;
}

.live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--rm-success);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.topbar-actions {
  display: flex; align-items: center; gap: var(--rm-space-sm);
  flex-shrink: 0;
}

.topbar-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 2.25rem; height: 2.25rem;
  border-radius: var(--rm-radius-md); border: 1px solid var(--rm-border-default);
  background: var(--rm-bg-surface); color: var(--rm-text-secondary);
  cursor: pointer; transition: all var(--rm-transition-fast);
  &:hover { background: var(--rm-bg-inset); color: var(--rm-text-primary); }
}

/* ── Buttons ── */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
  padding: 0.5rem 1rem; border-radius: var(--rm-radius-md);
  font-size: 0.85rem; font-weight: 600; font-family: inherit;
  cursor: pointer; border: 1px solid transparent;
  transition: all var(--rm-transition-fast);
  white-space: nowrap; line-height: 1;
  &:disabled { opacity: 0.55; cursor: not-allowed; }
}

.btn--primary {
  background: var(--rm-primary); color: var(--rm-primary-text); border-color: var(--rm-primary);
  &:hover:not(:disabled) { background: var(--rm-primary-hover); }
  &:focus-visible { box-shadow: var(--rm-shadow-focus); }
}

.btn--secondary {
  background: var(--rm-bg-surface); color: var(--rm-text-primary);
  border-color: var(--rm-border-default);
  &:hover { background: var(--rm-bg-inset); }
}

.btn--ghost {
  background: transparent; color: var(--rm-text-secondary);
  padding: 0.35rem 0.6rem;
  &:hover { background: var(--rm-bg-inset); color: var(--rm-text-primary); }
}

.btn--sm { font-size: 0.75rem; padding: 0.3rem 0.55rem; }
.btn--full { width: 100%; }

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Settings Drawer ── */
.drawer-overlay {
  position: fixed; inset: 0; z-index: 90;
  background: var(--rm-bg-overlay);
  backdrop-filter: blur(4px);
}

.settings-drawer {
  position: fixed; top: 0; right: 0; z-index: 100;
  width: min(400px, 100vw); height: 100dvh;
  overflow-y: auto;
  background: var(--rm-bg-surface); border-left: 1px solid var(--rm-border-default);
  box-shadow: var(--rm-shadow-lg);
  display: flex; flex-direction: column;
}

.drawer-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: var(--rm-space-lg) var(--rm-space-xl);
  border-bottom: 1px solid var(--rm-border-default);
  h2 { margin: 0; font-size: 1.05rem; font-weight: 700; }
}

.drawer-body {
  padding: var(--rm-space-xl);
  display: flex; flex-direction: column; gap: var(--rm-space-xl);
}

.settings-fieldset {
  border: none; padding: 0; margin: 0;
  legend {
    font-size: 0.8rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em; color: var(--rm-text-tertiary);
    margin-bottom: var(--rm-space-sm);
  }
}

.seg-control {
  display: flex; border-radius: var(--rm-radius-md); overflow: hidden;
  border: 1px solid var(--rm-border-default);
}

.seg-btn {
  flex: 1; padding: 0.5rem 0.65rem; border: none;
  border-right: 1px solid var(--rm-border-default);
  background: var(--rm-bg-surface); color: var(--rm-text-secondary);
  font-size: 0.82rem; font-weight: 500; font-family: inherit;
  cursor: pointer; text-align: center;
  transition: all var(--rm-transition-fast);
  &:last-child { border-right: none; }
  &:focus-visible { outline: 2px solid var(--rm-primary); outline-offset: -2px; }
  &.active {
    background: var(--rm-primary); color: var(--rm-primary-text);
    font-weight: 600;
  }
  &:hover:not(.active) { background: var(--rm-bg-inset); }
}

.toggle-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: var(--rm-space-sm) 0; gap: var(--rm-space-md); cursor: pointer;
  font-size: 0.9rem; color: var(--rm-text-primary);
}

.toggle-row--compact { padding: 0; }

.toggle-track {
  position: relative; width: 2.5rem; height: 1.4rem;
  border-radius: var(--rm-radius-full);
  background: var(--rm-border-strong);
  transition: background var(--rm-transition-fast);
  flex-shrink: 0;
  &.on { background: var(--rm-primary); }
}

.toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: calc(1.4rem - 4px); height: calc(1.4rem - 4px);
  border-radius: 50%; background: white;
  transition: transform var(--rm-transition-fast);
  box-shadow: 0 1px 3px rgba(0,0,0,0.18);
  .on > & { transform: translateX(calc(2.5rem - 1.4rem)); }
}

.select {
  width: 100%; padding: 0.55rem 0.75rem;
  border-radius: var(--rm-radius-md); border: 1px solid var(--rm-border-default);
  background: var(--rm-bg-surface); color: var(--rm-text-primary);
  font: inherit; font-size: 0.88rem; cursor: pointer;
  &:focus-visible { outline: 2px solid var(--rm-primary); outline-offset: 2px; }
}

/* Drawer transitions */
.drawer-enter-active, .drawer-leave-active { transition: transform var(--rm-transition-slow); }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }
.overlay-fade-enter-active, .overlay-fade-leave-active { transition: opacity var(--rm-transition-base); }
.overlay-fade-enter-from, .overlay-fade-leave-to { opacity: 0; }

/* ── Page layout ── */
.page-wrap {
  padding: var(--rm-space-xl) var(--rm-space-xl) var(--rm-space-3xl);
}

.page-inner {
  max-width: var(--rm-max-width); margin: 0 auto;
  display: flex; flex-direction: column; gap: var(--rm-space-xl);
}

.grid-2 {
  display: grid; grid-template-columns: 1fr; gap: var(--rm-space-xl);
  @media (min-width: 860px) { grid-template-columns: repeat(2, 1fr); }
}

/* ── Alert banner ── */
.alert {
  display: flex; align-items: center; gap: var(--rm-space-md);
  padding: var(--rm-space-md) var(--rm-space-lg);
  border-radius: var(--rm-radius-md); font-size: 0.88rem; font-weight: 500;
}

.alert-text { flex: 1; }

.alert--danger {
  background: var(--rm-danger-bg); color: var(--rm-danger);
  border: 1px solid var(--rm-danger);
}

.slide-down-enter-active, .slide-down-leave-active { transition: all var(--rm-transition-base); }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-8px); }

/* ── Cards ── */
.card {
  background: var(--rm-bg-surface); border-radius: var(--rm-radius-lg);
  border: 1px solid var(--rm-border-strong);
  box-shadow: var(--rm-shadow-md);
  padding: var(--rm-space-xl);
  transition: box-shadow var(--rm-transition-fast), border-color var(--rm-transition-fast);
  &:hover { box-shadow: var(--rm-shadow-lg); border-color: var(--rm-text-tertiary); }
}

.card--hero {
  background: linear-gradient(135deg, var(--rm-bg-surface) 60%, var(--rm-accent-bg) 100%);
  border-color: var(--rm-border-strong);
}

.card-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: var(--rm-space-md); margin-bottom: var(--rm-space-lg);
}

.card-title {
  font-size: 1.05rem; font-weight: 700; margin: 0;
  letter-spacing: -0.005em;
}

.card-desc {
  font-size: 0.82rem; color: var(--rm-text-secondary); margin: 0.15rem 0 0;
}

.card-actions { display: flex; gap: var(--rm-space-xs); flex-shrink: 0; }

/* ── KPIs ── */
.kpi-row {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--rm-space-md);
}

.kpi {
  display: flex; flex-direction: column; gap: 0.15rem;
  background: var(--rm-bg-inset);
  border-radius: var(--rm-radius-md);
  padding: var(--rm-space-md) var(--rm-space-lg);
  border: 1px solid var(--rm-border-default);
  box-shadow: var(--rm-shadow-sm);
}

.kpi-label {
  font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--rm-text-tertiary);
}

.kpi-value {
  font-size: 1.65rem; font-weight: 800; letter-spacing: -0.02em;
  line-height: 1.1;
}

.kpi-value--warn { color: var(--rm-danger); }

.kpi-badge {
  display: inline-block; font-size: 0.65rem; font-weight: 700;
  padding: 0.1rem 0.4rem; border-radius: var(--rm-radius-full);
  background: var(--rm-primary); color: var(--rm-primary-text);
  vertical-align: middle; margin-left: 0.35rem;
}

/* ── Chips ── */
.chip-row {
  display: flex; flex-wrap: wrap; gap: var(--rm-space-sm);
  margin-top: var(--rm-space-sm);
}

.chip {
  display: inline-flex; align-items: center;
  padding: 0.2rem 0.6rem; border-radius: var(--rm-radius-full);
  font-size: 0.78rem; font-weight: 600;
  border: 1px solid var(--rm-border-default);
  background: var(--rm-bg-surface);
}

.chip--route { border-color: var(--rm-primary); color: var(--rm-primary); background: var(--rm-info-bg); }
.chip--stop { color: var(--rm-text-secondary); }
.chip--fav { border-color: var(--rm-accent); color: var(--rm-accent-text); background: var(--rm-accent-bg); }

/* ── Filter bar (input + button) ── */
.filter-bar {
  display: flex; gap: var(--rm-space-md); align-items: flex-end;
  margin-bottom: var(--rm-space-lg);
}

.filter-bar .field { flex: 1; }

.field { display: flex; flex-direction: column; gap: 0.2rem; }

.field-label {
  font-size: 0.78rem; font-weight: 600; color: var(--rm-text-tertiary);
  text-transform: uppercase; letter-spacing: 0.03em;
}

.input {
  width: 100%; padding: 0.55rem 0.75rem;
  border-radius: var(--rm-radius-md);
  border: 1px solid var(--rm-border-default);
  background: var(--rm-bg-surface); color: var(--rm-text-primary);
  font: inherit; font-size: 0.88rem;
  transition: border-color var(--rm-transition-fast), box-shadow var(--rm-transition-fast);
  &:focus { border-color: var(--rm-primary); box-shadow: var(--rm-shadow-focus); outline: none; }
  &::placeholder { color: var(--rm-text-tertiary); }
}

/* ── Data list / rows ── */
.data-list {
  margin: 0; padding: 0; list-style: none;
  display: flex; flex-direction: column; gap: var(--rm-space-sm);
}

.data-row {
  display: flex; justify-content: space-between; align-items: center; gap: var(--rm-space-lg);
  padding: var(--rm-space-md) var(--rm-space-lg);
  border-radius: var(--rm-radius-md); border: 1px solid var(--rm-border-default);
  background: var(--rm-bg-surface);
  box-shadow: var(--rm-shadow-sm);
  transition: border-color var(--rm-transition-fast), background var(--rm-transition-fast), box-shadow var(--rm-transition-fast);
  &:hover { border-color: var(--rm-border-strong); background: var(--rm-bg-inset); box-shadow: var(--rm-shadow-md); }
}

.data-row--unread {
  border-left: 3px solid var(--rm-primary);
  background: var(--rm-info-bg);
}

.data-row-main { flex: 1; min-width: 0; }

.data-row-title {
  font-size: 0.9rem; font-weight: 600; color: var(--rm-text-primary);
}

.data-row-title-row {
  display: flex; align-items: center; gap: var(--rm-space-sm);
}

.data-row-sub {
  font-size: 0.82rem; color: var(--rm-text-secondary); margin: 0.15rem 0 0;
  line-height: 1.4;
}

.data-row-end {
  display: flex; flex-direction: column; align-items: flex-end;
  gap: 0.2rem; flex-shrink: 0;
}

/* ── Pills ── */
.pill {
  display: inline-flex; align-items: center;
  padding: 0.18rem 0.55rem; border-radius: var(--rm-radius-full);
  font-size: 0.72rem; font-weight: 600; letter-spacing: 0.01em;
  border: 1px solid transparent;
}

.pill--info { background: var(--rm-info-bg); color: var(--rm-info); border-color: var(--rm-info); }
.pill--success { background: var(--rm-success-bg); color: var(--rm-success); border-color: var(--rm-success); }
.pill--warning { background: var(--rm-warning-bg); color: var(--rm-warning); border-color: var(--rm-warning); }
.pill--danger { background: var(--rm-danger-bg); color: var(--rm-danger); border-color: var(--rm-danger); }

.meta-text { font-size: 0.78rem; color: var(--rm-text-tertiary); }

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer;
  min-width: 2.75rem; min-height: 2.75rem;
  font-size: 1.2rem; padding: 0; line-height: 1;
  color: var(--rm-text-tertiary);
  transition: color var(--rm-transition-fast), transform var(--rm-transition-fast);
  &:hover { color: var(--rm-accent); transform: scale(1.15); }
}

.icon-btn--star { font-size: 1.25rem; }

.empty {
  text-align: center; padding: var(--rm-space-xl);
  border: 1px dashed var(--rm-border-strong);
  border-radius: var(--rm-radius-md);
  color: var(--rm-text-tertiary); font-size: 0.88rem;
}

/* ── Form stack ── */
.form-stack {
  display: flex; flex-direction: column; gap: var(--rm-space-md);
  margin-bottom: var(--rm-space-lg);
}

.form-row-2 {
  display: grid; grid-template-columns: 1fr 1fr; gap: var(--rm-space-md);
  @media (max-width: 600px) { grid-template-columns: 1fr; }
}

/* ── Result card ── */
.result-card {
  margin-top: var(--rm-space-lg);
  padding: var(--rm-space-lg);
  border-radius: var(--rm-radius-md);
  background: var(--rm-success-bg);
  border: 1px solid var(--rm-success);
}

.result-title {
  font-size: 0.88rem; font-weight: 700; margin: 0 0 var(--rm-space-sm);
  color: var(--rm-success);
}

.result-body { margin: 0; font-size: 0.9rem; }
.leave-empty { margin-top: var(--rm-space-md); }

/* ── Toast ── */
.toast {
  position: fixed; bottom: 5.5rem; right: 1.5rem; z-index: 95;
  display: flex; align-items: center; gap: var(--rm-space-sm);
  padding: var(--rm-space-md) var(--rm-space-lg);
  border-radius: var(--rm-radius-md);
  background: var(--rm-text-primary); color: var(--rm-text-inverse);
  font-size: 0.85rem; font-weight: 600;
  box-shadow: var(--rm-shadow-lg);
}

.toast-enter-active, .toast-leave-active {
  transition: opacity var(--rm-transition-base), transform var(--rm-transition-base);
}
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }

/* ── Responsive ── */
@media (max-width: 640px) {
  .topbar-inner { padding: var(--rm-space-md); gap: var(--rm-space-sm); }
  .topbar-center { display: none; }
  .brand-subtitle { display: none; }
  .page-wrap { padding: var(--rm-space-md) var(--rm-space-md) var(--rm-space-2xl); }
  .card { padding: var(--rm-space-lg); }
  .kpi-row { grid-template-columns: 1fr; }
  .data-row { flex-direction: column; align-items: flex-start; gap: var(--rm-space-md); }
  .data-row-end { flex-direction: row; flex-wrap: wrap; gap: var(--rm-space-sm); }
  .filter-bar { flex-direction: column; }
  .settings-drawer { width: 100%; }
}

@media (max-width: 860px) and (min-width: 641px) {
  .data-row-end { align-items: flex-start; }
}

@media (min-width: 1200px) {
  .page-wrap { padding: var(--rm-space-2xl) var(--rm-space-3xl) var(--rm-space-3xl); }
}
</style>
