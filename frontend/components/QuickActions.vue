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
  position: sticky;
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  margin-left: auto;
  margin-right: max(1rem, env(safe-area-inset-right, 0px));
  width: fit-content;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.6rem;
}

.fab-trigger {
  width: 3.2rem;
  height: 3.2rem;
  border-radius: 50%;
  border: 2px solid var(--rm-border-strong);
  background: var(--rm-primary);
  color: var(--rm-primary-text);
  font-size: 1.35rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--rm-shadow-md);
  transition: transform var(--rm-transition-fast), background var(--rm-transition-fast);
}

.fab-trigger:hover {
  background: var(--rm-primary-hover);
}

.fab-trigger:focus-visible {
  outline: 2px solid var(--rm-primary);
  outline-offset: 2px;
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
  border-radius: var(--rm-radius-md);
  border: 1px solid var(--rm-border-default);
  background: var(--rm-bg-surface);
  color: var(--rm-text-primary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--rm-shadow-sm);
  transition: transform var(--rm-transition-fast), background var(--rm-transition-fast);
}

.fab-action:hover {
  background: var(--rm-bg-inset);
  transform: scale(1.04);
}

.fab-action:focus-visible {
  outline: 2px solid var(--rm-primary);
  outline-offset: 2px;
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

@media (max-width: 640px) {
  .fab-container {
    position: fixed;
    bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
    right: max(0.75rem, env(safe-area-inset-right, 0px));
    margin-right: 0;
  }

  .fab-trigger {
    width: 3rem;
    height: 3rem;
    font-size: 1.25rem;
  }
}
</style>
