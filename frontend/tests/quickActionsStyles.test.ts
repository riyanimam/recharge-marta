import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentPath = resolve(__dirname, "../components/QuickActions.vue");
const componentContent = readFileSync(componentPath, "utf-8");

describe("QuickActions floating layout and accessibility", () => {
  it("anchors the quick actions container to viewport safe-area edges", () => {
    expect(componentContent).toContain("position: sticky;");
    expect(componentContent).toMatch(/\.fab-container[\s\S]*?bottom:\s*calc\(1rem \+ env\(safe-area-inset-bottom, 0px\)\)/);
    expect(componentContent).toMatch(
      /\.fab-container[\s\S]*?margin-right:\s*max\(1rem, env\(safe-area-inset-right, 0px\)\)/,
    );
    expect(componentContent).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.fab-container[\s\S]*?position:\s*fixed[\s\S]*?right:\s*max\(0\.75rem, env\(safe-area-inset-right, 0px\)\)/,
    );
  });

  it("adds focus-visible styling for keyboard users", () => {
    expect(componentContent).toContain(".fab-trigger:focus-visible");
    expect(componentContent).toContain(".fab-action:focus-visible");
  });
});
