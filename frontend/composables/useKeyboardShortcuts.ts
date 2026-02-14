/**
 * Keyboard shortcuts composable — global hotkeys for power-user navigation.
 * Inspired by the georgia-legislation-webcrawler keyboard shortcut system.
 */

export interface ShortcutDef {
  key: string;
  description: string;
  handler: () => void;
  /** If true, shortcut fires even if an input / textarea is focused */
  allowInInput?: boolean;
}

export function useKeyboardShortcuts(shortcuts: Ref<ShortcutDef[]>) {
  function handleKeyDown(e: KeyboardEvent): void {
    // Skip if inside an input, textarea, or select (unless allowed)
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    const isInput = tag === "input" || tag === "textarea" || tag === "select";

    for (const shortcut of shortcuts.value) {
      if (shortcut.key.toLowerCase() !== e.key.toLowerCase()) continue;
      if (isInput && !shortcut.allowInInput) continue;

      // Ignore if modifier keys are pressed (allow Escape always)
      if (e.key !== "Escape" && (e.ctrlKey || e.altKey || e.metaKey)) continue;

      e.preventDefault();
      shortcut.handler();
      return;
    }
  }

  onMounted(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });
}
