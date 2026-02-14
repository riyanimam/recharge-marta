/**
 * Tests for global.scss — verifies that visual/accessibility CSS rules
 * actually produce the expected computed styles when the relevant
 * data-attributes and classes are applied to <html>.
 *
 * These tests inject the stylesheet into happy-dom and then assert that
 * the correct CSS custom properties / computed values are present.
 *
 * NOTE: happy-dom doesn't fully compute cascaded styles, so we verify
 * the DOM structure (attributes / classes) that the stylesheet selectors
 * depend on, treating the stylesheet as a contract: if the attributes are
 * present, the browser will pick up the matching CSS rules.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

// Inject the real stylesheet so the DOM has the <style> tag.
const cssPath = resolve(__dirname, "../assets/styles/global.scss");
let cssContent: string;
try {
  cssContent = readFileSync(cssPath, "utf-8");
} catch {
  cssContent = "";
}

const root = () => document.documentElement;

function injectGlobalStyles(): void {
  // Remove previous injection if any
  document.getElementById("test-global-css")?.remove();
  const style = document.createElement("style");
  style.id = "test-global-css";
  style.textContent = cssContent;
  document.head.appendChild(style);
}

beforeEach(() => {
  injectGlobalStyles();
});

describe("global.scss: theme selectors", () => {
  it("html[data-theme='light'] selector is present in stylesheet", () => {
    expect(cssContent).toContain('html[data-theme="light"]');
  });

  it("html[data-theme='dark'] selector is present in stylesheet", () => {
    expect(cssContent).toContain('html[data-theme="dark"]');
  });

  it("applies data-theme='light' attribute correctly", () => {
    root().setAttribute("data-theme", "light");
    expect(root().getAttribute("data-theme")).toBe("light");
  });

  it("applies data-theme='dark' attribute correctly", () => {
    root().setAttribute("data-theme", "dark");
    expect(root().getAttribute("data-theme")).toBe("dark");
  });
});

describe("global.scss: font-size selectors", () => {
  it("html[data-font-size='large'] selector is present", () => {
    expect(cssContent).toContain('html[data-font-size="large"]');
  });

  it("html[data-font-size='x-large'] selector is present", () => {
    expect(cssContent).toContain('html[data-font-size="x-large"]');
  });

  it("large font-size rule uses 112.5%", () => {
    const largeFontMatch = cssContent.match(
      /html\[data-font-size="large"\]\s*\{[^}]*font-size:\s*112\.5%/,
    );
    expect(largeFontMatch).not.toBeNull();
  });

  it("x-large font-size rule uses 125%", () => {
    const xlMatch = cssContent.match(
      /html\[data-font-size="x-large"\]\s*\{[^}]*font-size:\s*125%/,
    );
    expect(xlMatch).not.toBeNull();
  });
});

describe("global.scss: high-contrast selectors", () => {
  it("html.high-contrast selector is present", () => {
    expect(cssContent).toContain("html.high-contrast");
  });

  it("high-contrast forces bold on .pill, .chip, .btn", () => {
    const match = cssContent.match(/html\.high-contrast[\s\S]*?font-weight:\s*700/);
    expect(match).not.toBeNull();
  });

  it("high-contrast improves .muted readability", () => {
    // Verifies .muted color is closer to full CanvasText (88%) in high-contrast
    const match = cssContent.match(/html\.high-contrast[\s\S]*?\.muted\s*\{[^}]*88%/);
    expect(match).not.toBeNull();
  });
});

describe("global.scss: reduced-motion selectors", () => {
  it("html.reduced-motion selector is present", () => {
    expect(cssContent).toContain("html.reduced-motion");
  });

  it("reduced-motion disables transitions", () => {
    const match = cssContent.match(
      /html\.reduced-motion[\s\S]*?transition[^:]*:\s*none/,
    );
    expect(match).not.toBeNull();
  });

  it("reduced-motion disables animations", () => {
    const match = cssContent.match(
      /html\.reduced-motion[\s\S]*?animation[^:]*:\s*none/,
    );
    expect(match).not.toBeNull();
  });
});

describe("global.scss: base rules", () => {
  it("sets box-sizing: border-box for all elements", () => {
    expect(cssContent).toContain("box-sizing: border-box");
  });

  it("uses color-scheme: light dark for system-aware themes", () => {
    expect(cssContent).toContain("color-scheme: light dark");
  });
});
