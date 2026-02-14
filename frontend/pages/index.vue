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

  <header class="app-header">
    <div class="header-copy">
      <h1>Recharge MARTA</h1>
      <p>{{ t('app.subtitle') }}</p>
      <div class="header-badges">
        <p v-if="isMockMode" class="mock-badge">{{ t('app.mock') }}</p>
        <p class="live-badge">{{ t('app.live') }}</p>
      </div>
    </div>
    <div class="header-actions">
      <button
        class="btn icon-btn"
        :aria-label="t('shortcuts.open')"
        @click="shortcutsHelpOpen = true"
      >
        ?
      </button>
      <button
        class="btn icon-btn"
        :aria-expanded="settingsOpen"
        aria-controls="settings-panel"
        :aria-label="t('prefs.title')"
        @click="toggleSettings()"
      >
        &#9881;
      </button>
      <button
        class="btn secondary"
        :disabled="isLoading"
        :aria-label="t('app.refresh')"
        @click="refreshAll()"
      >
        {{ isLoading ? t('app.refreshing') : t('app.refresh') }}
      </button>
    </div>
  </header>

  <!-- Settings panel -->
  <aside
    v-if="settingsOpen"
    id="settings-panel"
    class="settings-panel"
    role="dialog"
    :aria-label="t('prefs.title')"
  >
    <div class="settings-header">
      <h2>{{ t('prefs.title') }}</h2>
      <button class="btn icon-btn close-btn" :aria-label="t('prefs.close')" @click="toggleSettings()">
        &#10005;
      </button>
    </div>

    <div class="settings-group">
      <h3>{{ t('prefs.theme') }}</h3>
      <div class="toggle-group" role="radiogroup" :aria-label="t('prefs.theme')">
        <button
          class="toggle-btn"
          :class="{ active: prefs.colorScheme === 'system' }"
          role="radio"
          :aria-checked="prefs.colorScheme === 'system'"
          @click="setColorScheme('system')"
        >
          {{ t('prefs.themeSystem') }}
        </button>
        <button
          class="toggle-btn"
          :class="{ active: prefs.colorScheme === 'light' }"
          role="radio"
          :aria-checked="prefs.colorScheme === 'light'"
          @click="setColorScheme('light')"
        >
          {{ t('prefs.themeLight') }}
        </button>
        <button
          class="toggle-btn"
          :class="{ active: prefs.colorScheme === 'dark' }"
          role="radio"
          :aria-checked="prefs.colorScheme === 'dark'"
          @click="setColorScheme('dark')"
        >
          {{ t('prefs.themeDark') }}
        </button>
      </div>
    </div>

    <div class="settings-group">
      <h3>{{ t('prefs.fontSize') }}</h3>
      <div class="toggle-group" role="radiogroup" :aria-label="t('prefs.fontSize')">
        <button
          class="toggle-btn"
          :class="{ active: prefs.fontSize === 'default' }"
          role="radio"
          :aria-checked="prefs.fontSize === 'default'"
          @click="setFontSize('default')"
        >
          {{ t('prefs.fontDefault') }}
        </button>
        <button
          class="toggle-btn"
          :class="{ active: prefs.fontSize === 'large' }"
          role="radio"
          :aria-checked="prefs.fontSize === 'large'"
          @click="setFontSize('large')"
        >
          {{ t('prefs.fontLarge') }}
        </button>
        <button
          class="toggle-btn"
          :class="{ active: prefs.fontSize === 'x-large' }"
          role="radio"
          :aria-checked="prefs.fontSize === 'x-large'"
          @click="setFontSize('x-large')"
        >
          {{ t('prefs.fontXLarge') }}
        </button>
      </div>
    </div>

    <div class="settings-group">
      <label class="checkbox">
        <input type="checkbox" :checked="prefs.highContrast" @change="setHighContrast(!prefs.highContrast)" />
        {{ t('prefs.highContrast') }}
      </label>
    </div>

    <div class="settings-group">
      <label class="checkbox">
        <input type="checkbox" :checked="prefs.reducedMotion" @change="setReducedMotion(!prefs.reducedMotion)" />
        {{ t('prefs.reducedMotion') }}
      </label>
    </div>

    <div class="settings-group">
      <h3>{{ t('prefs.language') }}</h3>
      <select
        :value="prefs.language"
        class="lang-select"
        :aria-label="t('prefs.language')"
        @change="onSetLanguage(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="lang in languageKeys" :key="lang" :value="lang">
          {{ languageLabels[lang] }}
        </option>
      </select>
    </div>
  </aside>

  <main id="main-content" class="app-grid">
    <p v-if="error" class="error-banner">{{ error }}</p>

    <!-- Loading skeleton -->
    <template v-if="isLoading && arrivals.length === 0">
      <section class="card hero-card">
        <SkeletonLoader variant="stat" :count="3" />
      </section>
      <section class="card">
        <SkeletonLoader variant="row" :count="3" />
      </section>
      <section class="card">
        <SkeletonLoader variant="row" :count="2" />
      </section>
    </template>

    <template v-else>
    <!-- Overview -->
    <section class="card hero-card" aria-labelledby="overview-title">
      <div class="card-heading-row">
        <h2 id="overview-title">{{ t('overview.title') }}</h2>
        <p class="muted">{{ t('overview.subtitle') }}</p>
      </div>

      <div class="stats" role="list" :aria-label="t('overview.metrics')">
        <article role="listitem">
          <span>{{ t('overview.arrivals') }}</span>
          <strong>{{ arrivals.length }}</strong>
        </article>
        <article role="listitem">
          <span>{{ t('overview.alerts') }}</span>
          <strong>
            {{ alerts.length }}
            <span v-if="unreadAlertCount > 0" class="unread-badge">{{ unreadAlertCount }} {{ t('alerts.unread') }}</span>
          </strong>
        </article>
        <article role="listitem">
          <span>{{ t('overview.accessibility') }}</span>
          <strong>{{ accessibilityIssueCount }}</strong>
        </article>
      </div>

      <div v-if="dashboard" class="chip-row" aria-label="Saved preferences">
        <span v-for="route in dashboard.favoriteRoutes" :key="route" class="chip">Route {{ route }}</span>
        <span v-for="stop in dashboard.favoriteStops" :key="stop" class="chip muted-chip">Stop {{ stop }}</span>
      </div>

      <!-- Favorites summary -->
      <div v-if="favCount > 0" class="chip-row" :aria-label="t('fav.title')">
        <span v-for="route in favorites.routes" :key="'fav-r-' + route" class="chip fav-chip">&#9733; Route {{ route }}</span>
        <span v-for="station in favorites.stations" :key="'fav-s-' + station" class="chip fav-chip">&#9733; {{ station }}</span>
      </div>
    </section>

    <!-- Arrivals -->
    <section class="card" aria-labelledby="arrivals-title">
      <div class="card-heading-row">
        <div>
          <h2 id="arrivals-title">{{ t('arrivals.title') }}</h2>
          <p class="muted">{{ t('arrivals.subtitle') }}</p>
        </div>
        <div class="card-actions" v-if="arrivals.length > 0">
          <button class="btn-small" :aria-label="t('export.json')" @click="exportArrivalsJSON(arrivals)">&#x2913; JSON</button>
          <button class="btn-small" :aria-label="t('export.csv')" @click="exportArrivalsCSV(arrivals)">&#x2913; CSV</button>
        </div>
      </div>

      <div class="inline-controls">
        <label>
          {{ t('arrivals.stopId') }}
          <input v-model="stopId" placeholder="MID" />
        </label>
        <button class="btn" @click="loadArrivals()">{{ t('arrivals.load') }}</button>
      </div>

      <ul class="list modern-list">
        <li v-for="item in arrivals" :key="item.routeId + '-' + item.destination" class="row-item">
          <div>
            <strong>{{ item.routeName }}</strong>
            <p>{{ item.stopName }} &rarr; {{ item.destination }}</p>
          </div>
          <div class="row-meta">
            <span class="pill">{{ item.minutesAway }} {{ t('arrivals.min') }}</span>
            <span class="muted">{{ formatTime(item.predictedAt) }}</span>
            <button
              class="fav-btn"
              :aria-label="isRouteBookmarked(item.routeId) ? t('fav.remove') : t('fav.add')"
              @click="toggleRoute(item.routeId)"
            >
              {{ isRouteBookmarked(item.routeId) ? '&#9733;' : '&#9734;' }}
            </button>
          </div>
        </li>
        <li v-if="arrivals.length === 0" class="empty-state">{{ t('arrivals.empty') }}</li>
      </ul>
    </section>

    <!-- Alerts -->
    <section class="card" aria-labelledby="alerts-title">
      <div class="card-heading-row">
        <div>
          <h2 id="alerts-title">{{ t('alerts.title') }}</h2>
          <p class="muted">{{ t('alerts.subtitle') }}</p>
        </div>
        <div class="card-actions" v-if="alerts.length > 0">
          <button class="btn-small" :aria-label="t('export.json')" @click="exportAlertsJSON(alerts)">&#x2913; JSON</button>
          <button class="btn-small" :aria-label="t('export.csv')" @click="exportAlertsCSV(alerts)">&#x2913; CSV</button>
        </div>
      </div>

      <div class="inline-controls">
        <label>
          {{ t('alerts.routeFilter') }}
          <input v-model="routeId" placeholder="RED" />
        </label>
        <button class="btn" @click="loadAlerts()">{{ t('alerts.load') }}</button>
      </div>

      <ul class="list modern-list">
        <li
          v-for="alert in alerts"
          :key="alert.id"
          class="row-item"
          :class="{ 'row-item--unread': !isAlertRead(alert.id) }"
          @click="markAsRead(alert.id)"
        >
          <div>
            <strong>{{ alert.title }}</strong>
            <span v-if="!isAlertRead(alert.id)" class="new-badge">{{ t('alerts.new') }}</span>
            <p>{{ alert.description }}</p>
          </div>
          <div class="row-meta">
            <span class="pill">{{ alertSeverityLabel(alert.severity) }}</span>
            <span class="muted">{{ formatTime(alert.updatedAt) }}</span>
          </div>
        </li>
        <li v-if="alerts.length === 0" class="empty-state">{{ t('alerts.empty') }}</li>
      </ul>
    </section>

    <!-- Accessibility -->
    <section class="card" aria-labelledby="access-title">
      <div class="card-heading-row">
        <h2 id="access-title">{{ t('access.title') }}</h2>
        <p class="muted">{{ t('access.subtitle') }}</p>
      </div>

      <div class="inline-controls">
        <label>
          {{ t('access.stationId') }}
          <input v-model="stationId" placeholder="MID" />
        </label>
        <button class="btn" @click="loadEquipment()">{{ t('access.check') }}</button>
      </div>

      <ul class="list modern-list">
        <li v-for="item in equipment" :key="item.stationId + '-' + item.name" class="row-item">
          <div>
            <strong>{{ item.stationName }}</strong>
            <p>{{ item.type }} {{ item.name }}</p>
          </div>
          <div class="row-meta">
            <span class="pill">{{ equipmentStatusLabel(item.status) }}</span>
            <span class="muted">{{ formatTime(item.updatedAt) }}</span>
            <button
              class="fav-btn"
              :aria-label="isStationBookmarked(item.stationId) ? t('fav.remove') : t('fav.add')"
              @click="toggleStation(item.stationId)"
            >
              {{ isStationBookmarked(item.stationId) ? '&#9733;' : '&#9734;' }}
            </button>
          </div>
        </li>
        <li v-if="equipment.length === 0" class="empty-state">{{ t('access.empty') }}</li>
      </ul>
    </section>

    <!-- Trip Planner -->
    <section class="card" aria-labelledby="trip-title">
      <div class="card-heading-row">
        <h2 id="trip-title">{{ t('trip.title') }}</h2>
        <p class="muted">{{ t('trip.subtitle') }}</p>
      </div>

      <form class="stack" @submit.prevent="planTrip()">
        <label>
          {{ t('trip.from') }}
          <input v-model="origin" required />
        </label>
        <label>
          {{ t('trip.to') }}
          <input v-model="destination" required />
        </label>
        <label>
          {{ t('trip.departAt') }}
          <input type="datetime-local" v-model="departAt" required />
        </label>
        <label class="checkbox">
          <input type="checkbox" v-model="accessibilityNeeded" />
          {{ t('trip.accessibleOnly') }}
        </label>
        <button class="btn" type="submit">{{ t('trip.plan') }}</button>
      </form>

      <ul class="list modern-list">
        <li v-for="trip in tripOptions" :key="trip.id" class="row-item">
          <div>
            <strong>{{ trip.summary }}</strong>
            <p>
              {{ trip.durationMinutes }} {{ t('arrivals.min') }} &bull;
              {{ trip.transfers }} {{ t('trip.transfers') }} &bull;
              {{ t('trip.crowding') }} {{ trip.crowdingForecast }}
            </p>
          </div>
          <div class="row-meta">
            <span class="pill">{{ tripRiskLabel(trip.transferRisk) }}</span>
            <span v-if="trip.accessibilitySafe" class="pill">{{ t('trip.accessible') }}</span>
          </div>
        </li>
        <li v-if="tripOptions.length === 0" class="empty-state">{{ t('trip.empty') }}</li>
      </ul>
    </section>

    <!-- Leave-Now -->
    <section class="card" aria-labelledby="leave-title">
      <div class="card-heading-row">
        <h2 id="leave-title">{{ t('leave.title') }}</h2>
        <p class="muted">{{ t('leave.subtitle') }}</p>
      </div>

      <form class="stack" @submit.prevent="calculateLeaveNow()">
        <label>
          {{ t('leave.arriveBy') }}
          <input type="datetime-local" v-model="arrivalBy" required />
        </label>
        <button class="btn" type="submit">{{ t('leave.calculate') }}</button>
      </form>

      <article v-if="leaveNowResult" class="recommendation">
        <h3>{{ t('leave.recommended') }}</h3>
        <p>
          {{ t('leave.leaveAt') }} <strong>{{ formatTime(leaveNowResult.leaveAt) }}</strong>
          — {{ leaveNowResult.bufferMinutes }} {{ t('leave.buffer') }}
        </p>
        <p class="muted">{{ leaveNowResult.reliabilityNote }}</p>
      </article>
      <p v-else class="muted">{{ t('leave.empty') }}</p>
    </section>
    </template>
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
    <div v-if="linkCopied" class="toast" role="status">{{ t('share.copied') }}</div>
  </Transition>

  <!-- Keyboard shortcuts help -->
  <KeyboardShortcutsHelp
    :shortcuts="shortcutDefs"
    :open="shortcutsHelpOpen"
    @close="shortcutsHelpOpen = false"
  />
</template>

<style lang="scss" scoped>
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
}

.skip-link:focus {
  left: 0.5rem;
  top: 0.5rem;
  background: CanvasText;
  color: Canvas;
  padding: 0.5rem 0.75rem;
  border-radius: 0.4rem;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1rem;
  border-bottom: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
  background: color-mix(in srgb, Canvas 96%, CanvasText 4%);
}

.app-header h1 {
  margin: 0;
  font-size: clamp(1.35rem, 2.4vw, 2rem);
}

.app-header p {
  margin: 0.35rem 0 0;
  max-width: 72ch;
}

.header-copy {
  display: grid;
  gap: 0.2rem;
}

.header-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.3rem;
}

.header-actions {
  display: flex;
  align-items: center;
}

.mock-badge {
  display: inline-block;
  margin: 0;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
  background: color-mix(in srgb, CanvasText 8%, Canvas 92%);
  font-size: 0.82rem;
  font-weight: 600;
}

.live-badge {
  margin: 0;
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, CanvasText 15%, transparent);
  background: color-mix(in srgb, Canvas 86%, CanvasText 14%);
  font-size: 0.82rem;
  font-weight: 600;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.card {
  grid-column: span 12;
  padding: 1rem 1rem 1.1rem;
  border-radius: 0.9rem;
  border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
  background: color-mix(in srgb, Canvas 97%, CanvasText 3%);
}

.card h2 {
  margin-top: 0;
  margin-bottom: 0;
  font-size: 1.08rem;
}

.card-heading-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.hero-card {
  display: grid;
  gap: 0.9rem;
}

label,
input,
button {
  font: inherit;
}

label {
  display: block;
  margin-bottom: 0;
}

.inline-controls {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  margin-bottom: 0.85rem;
}

input {
  margin-top: 0.3rem;
  width: 100%;
  padding: 0.6rem 0.72rem;
  border-radius: 0.6rem;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  background: Canvas;
  color: CanvasText;
}

.stack label {
  margin-bottom: 0.2rem;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.checkbox input {
  width: auto;
  margin: 0;
}

.btn {
  padding: 0.62rem 0.9rem;
  border-radius: 0.6rem;
  border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
  background: color-mix(in srgb, CanvasText 10%, Canvas 90%);
  color: CanvasText;
  font-weight: 600;
  cursor: pointer;
}

.btn.secondary {
  background: color-mix(in srgb, CanvasText 16%, Canvas 84%);
}

.btn:disabled {
  opacity: 0.65;
  cursor: wait;
}

.list {
  margin: 0;
  padding-left: 0;
  list-style: none;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
}

.stats article {
  border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
  border-radius: 0.6rem;
  padding: 0.72rem;
  background: color-mix(in srgb, Canvas 90%, CanvasText 10%);
}

.stats span {
  display: block;
  font-size: 0.9rem;
}

.stats strong {
  font-size: 1.3rem;
}

.muted {
  color: color-mix(in srgb, CanvasText 70%, transparent);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.58rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  background: color-mix(in srgb, CanvasText 9%, Canvas 91%);
  font-size: 0.83rem;
  font-weight: 600;
}

.muted-chip {
  background: color-mix(in srgb, CanvasText 5%, Canvas 95%);
}

.modern-list {
  display: grid;
  gap: 0.55rem;
}

.row-item {
  display: flex;
  justify-content: space-between;
  gap: 0.9rem;
  align-items: center;
  border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  border-radius: 0.68rem;
  padding: 0.62rem 0.72rem;
  background: color-mix(in srgb, Canvas 92%, CanvasText 8%);
}

.row-item p {
  margin: 0.18rem 0 0;
  color: color-mix(in srgb, CanvasText 75%, transparent);
}

.row-meta {
  display: grid;
  justify-items: end;
  gap: 0.2rem;
  text-align: right;
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.52rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  background: color-mix(in srgb, CanvasText 11%, Canvas 89%);
  font-size: 0.8rem;
  font-weight: 600;
}

.empty-state {
  border: 1px dashed color-mix(in srgb, CanvasText 25%, transparent);
  border-radius: 0.6rem;
  padding: 0.7rem;
  color: color-mix(in srgb, CanvasText 72%, transparent);
}

.error-banner {
  grid-column: span 12;
  border: 1px solid color-mix(in srgb, CanvasText 35%, transparent);
  color: CanvasText;
  background: color-mix(in srgb, CanvasText 12%, Canvas 88%);
  border-radius: 0.6rem;
  padding: 0.7rem;
}

.stack > * + * {
  margin-top: 0.6rem;
}

.recommendation {
  margin-top: 0.8rem;
  border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
  border-radius: 0.75rem;
  padding: 0.75rem;
  background: color-mix(in srgb, CanvasText 6%, Canvas 94%);
}

.recommendation h3 {
  margin: 0 0 0.45rem;
  font-size: 0.96rem;
}

.recommendation p {
  margin: 0.32rem 0;
}

@media (min-width: 780px) {
  .card {
    grid-column: span 6;
  }

  .card:first-of-type {
    grid-column: span 12;
  }

  .app-header {
    padding-inline: 1.25rem;
  }

  .app-grid {
    padding-inline: 1.25rem;
  }
}

@media (max-width: 640px) {
  .header-actions {
    width: 100%;
  }

  .header-actions .btn {
    width: 100%;
  }

  .app-header {
    flex-direction: column;
  }

  .inline-controls {
    grid-template-columns: 1fr;
  }

  .row-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .row-meta {
    justify-items: start;
    text-align: left;
  }

  .stats {
    grid-template-columns: 1fr;
  }

  .settings-panel {
    width: 100%;
    border-radius: 0;
  }
}

/* ── Settings panel ── */

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  padding: 0;
  font-size: 1.3rem;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  background: color-mix(in srgb, CanvasText 8%, Canvas 92%);
  color: CanvasText;
  cursor: pointer;
  line-height: 1;
}

.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: min(360px, 100vw);
  height: 100vh;
  overflow-y: auto;
  z-index: 100;
  padding: 1rem 1.1rem 1.5rem;
  border-left: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
  background: Canvas;
  box-shadow: -4px 0 24px color-mix(in srgb, CanvasText 10%, transparent);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.1rem;
}

.settings-header h2 {
  margin: 0;
  font-size: 1.15rem;
}

.close-btn {
  font-size: 1rem;
  width: 2rem;
  height: 2rem;
}

.settings-group {
  margin-bottom: 1rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
}

.settings-group h3 {
  margin: 0 0 0.45rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: color-mix(in srgb, CanvasText 80%, transparent);
}

.toggle-group {
  display: flex;
  gap: 0;
  border-radius: 0.6rem;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
}

.toggle-btn {
  flex: 1;
  padding: 0.5rem 0.6rem;
  border: none;
  border-right: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
  background: color-mix(in srgb, CanvasText 5%, Canvas 95%);
  color: CanvasText;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  text-align: center;
}

.toggle-btn:last-child {
  border-right: none;
}

.toggle-btn.active {
  background: color-mix(in srgb, CanvasText 20%, Canvas 80%);
  font-weight: 700;
}

.lang-select {
  width: 100%;
  padding: 0.55rem 0.7rem;
  border-radius: 0.6rem;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  background: Canvas;
  color: CanvasText;
  font: inherit;
  font-size: 0.92rem;
  cursor: pointer;
}

/* ── New feature styles ── */

.card-actions {
  display: flex;
  gap: 0.35rem;
  flex-shrink: 0;
}

.btn-small {
  padding: 0.32rem 0.55rem;
  border-radius: 0.5rem;
  border: 1px solid color-mix(in srgb, CanvasText 16%, transparent);
  background: color-mix(in srgb, CanvasText 6%, Canvas 94%);
  color: CanvasText;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-small:hover {
  background: color-mix(in srgb, CanvasText 14%, Canvas 86%);
}

.fav-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.3rem;
  padding: 0;
  line-height: 1;
  color: CanvasText;
}

.fav-btn:hover {
  transform: scale(1.15);
}

.fav-chip {
  background: color-mix(in srgb, CanvasText 8%, Canvas 92%);
  border-color: color-mix(in srgb, CanvasText 25%, transparent);
}

.unread-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: color-mix(in srgb, CanvasText 18%, Canvas 82%);
  vertical-align: middle;
  margin-left: 0.35rem;
}

.new-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.08rem 0.35rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, CanvasText 30%, transparent);
  background: color-mix(in srgb, CanvasText 14%, Canvas 86%);
  margin-left: 0.4rem;
  vertical-align: middle;
}

.row-item--unread {
  border-left: 3px solid color-mix(in srgb, CanvasText 45%, transparent);
}

.toast {
  position: fixed;
  bottom: 5.5rem;
  right: 1.5rem;
  z-index: 95;
  padding: 0.55rem 1rem;
  border-radius: 0.6rem;
  background: color-mix(in srgb, CanvasText 90%, Canvas 10%);
  color: Canvas;
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 2px 12px color-mix(in srgb, CanvasText 20%, transparent);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
