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
  background: color-mix(in srgb, CanvasText 40%, transparent);
  backdrop-filter: blur(4px);
}

.shortcut-dialog {
  width: min(420px, 92vw);
  max-height: 80vh;
  overflow-y: auto;
  background: Canvas;
  color: CanvasText;
  border-radius: 0.75rem;
  border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
  box-shadow: 0 8px 32px color-mix(in srgb, CanvasText 18%, transparent);
  padding: 1.25rem;
}

.shortcut-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.shortcut-header h2 {
  margin: 0;
  font-size: 1.15rem;
}

.shortcut-table {
  width: 100%;
  border-collapse: collapse;
}

.shortcut-table th {
  text-align: left;
  font-weight: 600;
  padding: 0.45rem 0.6rem;
  border-bottom: 2px solid color-mix(in srgb, CanvasText 16%, transparent);
  font-size: 0.85rem;
  color: color-mix(in srgb, CanvasText 70%, transparent);
}

.shortcut-table td {
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid color-mix(in srgb, CanvasText 8%, transparent);
  font-size: 0.9rem;
}

kbd {
  display: inline-block;
  min-width: 1.6rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, CanvasText 22%, transparent);
  background: color-mix(in srgb, CanvasText 6%, Canvas 94%);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
}

/* transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.15s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
