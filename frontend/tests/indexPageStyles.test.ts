import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve(__dirname, "../pages/index.vue");
const pageContent = readFileSync(pagePath, "utf-8");

describe("index page style accessibility rules", () => {
  it("adds visible keyboard focus styles for segmented controls", () => {
    const segBtnBlock = pageContent.match(/\.seg-btn\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(segBtnBlock).toContain("&:focus-visible");
    expect(segBtnBlock).toMatch(/outline:\s*2px\s+solid\s+var\(--rm-primary\)/);
  });

  it("ensures icon buttons meet minimum touch target size", () => {
    expect(pageContent).toMatch(/\.icon-btn[\s\S]*?min-width:\s*2\.75rem/);
    expect(pageContent).toMatch(/\.icon-btn[\s\S]*?min-height:\s*2\.75rem/);
  });

  it("adds a tablet breakpoint for data row metadata alignment", () => {
    const tabletMedia = "@media (max-width: 860px) and (min-width: 641px)";
    const tabletStart = pageContent.indexOf(tabletMedia);
    const nextMediaStart = pageContent.indexOf("@media (min-width: 1200px)");
    const tabletBlock = tabletStart >= 0 ? pageContent.slice(tabletStart, nextMediaStart) : "";

    expect(tabletBlock).toContain(tabletMedia);
    expect(tabletBlock).toMatch(/\.data-row-end\s*\{[^}]*align-items:\s*flex-start/);
  });

  it("adds an actionable retry button in error banner", () => {
    expect(pageContent).toContain('class="alert-text"');
    expect(pageContent).toContain('@click="retryFromError()"');
  });

  it("keeps skip-link before main content for keyboard users", () => {
    const skipLinkIndex = pageContent.indexOf('href="#main-content"');
    const mainIndex = pageContent.indexOf('<main id="main-content"');

    expect(skipLinkIndex).toBeGreaterThanOrEqual(0);
    expect(mainIndex).toBeGreaterThanOrEqual(0);
    expect(skipLinkIndex).toBeLessThan(mainIndex);
  });
});
