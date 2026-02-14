/**
 * Vitest global setup — runs before every test file.
 *
 * Provides Vue globals that Nuxt auto-imports (reactive, computed, ref, etc.)
 * and resets DOM/localStorage between tests.
 */
import { beforeEach } from "vitest";
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";

// Expose Nuxt auto-imports as true globals so composables work outside Nuxt.
Object.assign(globalThis, { reactive, computed, ref, onMounted, onUnmounted });

beforeEach(() => {
  // Clear localStorage between tests so preference state doesn't leak.
  localStorage.clear();

  // Reset document element attributes / classes that usePreferences sets.
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  root.removeAttribute("data-font-size");
  root.removeAttribute("lang");
  root.classList.remove("high-contrast", "reduced-motion");
});
