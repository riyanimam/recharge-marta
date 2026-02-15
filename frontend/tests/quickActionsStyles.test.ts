import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentPath = resolve(__dirname, "../components/QuickActions.vue");
const componentContent = readFileSync(componentPath, "utf-8");

describe("QuickActions floating layout and accessibility", () => {
  it("anchors the quick actions container to viewport safe-area edges", () => {
    const fabStart = componentContent.indexOf(".fab-container {");
    const mediaStart = componentContent.indexOf("@media (max-width: 640px)");
    const desktopFabBlock =
      fabStart >= 0 && mediaStart > fabStart ? componentContent.slice(fabStart, mediaStart) : "";

    expect(desktopFabBlock).toContain("position: sticky;");
    expect(desktopFabBlock).toContain("bottom: calc(1rem + env(safe-area-inset-bottom, 0px));");
    expect(desktopFabBlock).toContain("margin-right: max(1rem, env(safe-area-inset-right, 0px));");

    const mobileBlock = mediaStart >= 0 ? componentContent.slice(mediaStart) : "";
    expect(mobileBlock).toContain(".fab-container {");
    expect(mobileBlock).toContain("position: fixed;");
    expect(mobileBlock).toContain("right: max(0.75rem, env(safe-area-inset-right, 0px));");
  });

  it("adds focus-visible styling for keyboard users", () => {
    expect(componentContent).toContain(".fab-trigger:focus-visible");
    expect(componentContent).toContain(".fab-action:focus-visible");
  });
});
