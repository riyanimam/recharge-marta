<script setup lang="ts">
/**
 * Quick Actions floating action button — inspired by the webcrawler QuickActions FAB.
 * Provides one-tap access to export, share link, and refresh.
 */
const emit = defineEmits<{
  refresh: [];
  exportJson: [];
  exportCsv: [];
  share: [];
}>();

const isOpen = ref(false);

function toggle() {
  isOpen.value = !isOpen.value;
}

function action(fn: () => void) {
  fn();
  isOpen.value = false;
}
</script>

<template>
  <div class="fab-container">
    <Transition name="fab-menu">
      <div v-if="isOpen" class="fab-menu">
        <button class="fab-action" aria-label="Refresh data" @click="action(() => emit('refresh'))">
          &#x21bb; Refresh
        </button>
        <button class="fab-action" aria-label="Export JSON" @click="action(() => emit('exportJson'))">
          &#x2913; JSON
        </button>
        <button class="fab-action" aria-label="Export CSV" @click="action(() => emit('exportCsv'))">
          &#x2913; CSV
        </button>
        <button class="fab-action" aria-label="Copy link" @click="action(() => emit('share'))">
          &#x1f517; Share
        </button>
      </div>
    </Transition>

    <button
      class="fab-trigger"
      :class="{ open: isOpen }"
      :aria-expanded="isOpen"
      aria-label="Quick actions"
      @click="toggle()"
    >
      {{ isOpen ? '\u2715' : '\u26A1' }}
    </button>
  </div>
</template>

<style scoped>
.fab-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 90;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.6rem;
}

.fab-trigger {
  width: 3.2rem;
  height: 3.2rem;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, CanvasText 22%, transparent);
  background: color-mix(in srgb, CanvasText 14%, Canvas 86%);
  color: CanvasText;
  font-size: 1.35rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 12px color-mix(in srgb, CanvasText 15%, transparent);
  transition: transform 0.15s ease, background 0.15s ease;
}

.fab-trigger:hover {
  background: color-mix(in srgb, CanvasText 22%, Canvas 78%);
}

.fab-trigger.open {
  transform: rotate(90deg);
}

.fab-menu {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: flex-end;
}

.fab-action {
  white-space: nowrap;
  padding: 0.5rem 0.85rem;
  border-radius: 0.6rem;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  background: Canvas;
  color: CanvasText;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 1px 6px color-mix(in srgb, CanvasText 10%, transparent);
  transition: transform 0.1s ease;
}

.fab-action:hover {
  transform: scale(1.04);
}

/* transition */
.fab-menu-enter-active,
.fab-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fab-menu-enter-from,
.fab-menu-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
