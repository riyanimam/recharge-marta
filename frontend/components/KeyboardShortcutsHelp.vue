<script setup lang="ts">
/**
 * Keyboard shortcuts help modal — inspired by the webcrawler HelpModal.
 * Shows all available keyboard shortcuts.
 */
import type { ShortcutDef } from "~/composables/useKeyboardShortcuts";

defineProps<{
  shortcuts: ShortcutDef[];
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="shortcut-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" @click.self="emit('close')">
        <div class="shortcut-dialog">
          <div class="shortcut-header">
            <h2>Keyboard Shortcuts</h2>
            <button class="btn icon-btn close-btn" aria-label="Close" @click="emit('close')">&#10005;</button>
          </div>
          <table class="shortcut-table" aria-label="Available keyboard shortcuts">
            <thead>
              <tr>
                <th>Key</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in shortcuts" :key="s.key">
                <td><kbd>{{ s.key }}</kbd></td>
                <td>{{ s.description }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.shortcut-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--rm-bg-overlay);
  backdrop-filter: blur(4px);
}

.shortcut-dialog {
  width: min(420px, 92vw);
  max-height: 80vh;
  overflow-y: auto;
  background: var(--rm-bg-surface);
  color: var(--rm-text-primary);
  border-radius: var(--rm-radius-lg);
  border: 1px solid var(--rm-border-default);
  box-shadow: var(--rm-shadow-lg);
  padding: var(--rm-space-xl);
}

.shortcut-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--rm-space-lg);
}

.shortcut-header h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.shortcut-table {
  width: 100%;
  border-collapse: collapse;
}

.shortcut-table th {
  text-align: left;
  font-weight: 600;
  padding: 0.45rem 0.6rem;
  border-bottom: 2px solid var(--rm-border-strong);
  font-size: 0.82rem;
  color: var(--rm-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.shortcut-table td {
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--rm-border-subtle);
  font-size: 0.9rem;
}

kbd {
  display: inline-block;
  min-width: 1.6rem;
  padding: 0.15rem 0.45rem;
  border-radius: var(--rm-radius-sm);
  border: 1px solid var(--rm-border-strong);
  background: var(--rm-bg-inset);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
}

/* transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--rm-transition-fast);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
