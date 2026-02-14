import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: {
      "~": new URL("./", import.meta.url).pathname,
      "#imports": new URL("./tests/__mocks__/imports.ts", import.meta.url).pathname,
    },
  },
});
