import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve(__dirname, "../pages/index.vue");
const pageContent = readFileSync(pagePath, "utf-8");

describe("index page style accessibility rules", () => {
  it("adds visible keyboard focus styles for segmented controls", () => {
    expect(pageContent).toMatch(
      /\.seg-btn[\s\S]*?&:focus-visible\s*\{\s*outline:\s*2px solid var\(--rm-primary\)/,
    );
  });

  it("ensures icon buttons meet minimum touch target size", () => {
    expect(pageContent).toMatch(/\.icon-btn[\s\S]*?min-width:\s*2\.75rem/);
    expect(pageContent).toMatch(/\.icon-btn[\s\S]*?min-height:\s*2\.75rem/);
  });

  it("adds a tablet breakpoint for data row metadata alignment", () => {
    expect(pageContent).toContain("@media (max-width: 860px) and (min-width: 641px)");
    expect(pageContent).toContain(".data-row-end { align-items: flex-start; }");
  });
});
