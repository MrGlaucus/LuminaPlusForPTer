import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeCss = readFileSync(new URL("../home.css", import.meta.url), "utf8");
const surfaceCss = readFileSync(new URL("../surface.css", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../../pages/Home.tsx", import.meta.url), "utf8");
const controlsSource = readFileSync(
  new URL("../../components/shell/FloatingControls.tsx", import.meta.url),
  "utf8",
);
const miniSource = readFileSync(
  new URL("../../components/node/MiniNodeCard.tsx", import.meta.url),
  "utf8",
);
const nodeGridSource = readFileSync(
  new URL("../../components/node/NodeGrid.tsx", import.meta.url),
  "utf8",
);
const appShellSource = readFileSync(
  new URL("../../components/shell/AppShell.tsx", import.meta.url),
  "utf8",
);
const routerSource = readFileSync(new URL("../../router.tsx", import.meta.url), "utf8");

describe("home responsive layout contracts", () => {
  it("uses an explicit expanded state through tablet widths without :has()", () => {
    expect(homeCss).not.toContain(":has(");
    expect(homeCss).toMatch(/@media \(max-width: 1023px\)[\s\S]*\.home-dashboard\.is-controls-expanded \.home-brand/);
    expect(homeSource).toContain("onExpandedChange={setControlsExpanded}");
  });

  it("reclaims the reserved header space after timed hiding", () => {
    expect(homeSource).toContain('is-home-header-hidden');
    expect(homeCss).toMatch(
      /\.home-dashboard\.is-home-header-hidden\s*\{[^}]*padding-top:\s*0/,
    );
  });

  it("keeps both horizontal edges inside viewport safe areas", () => {
    expect(surfaceCss).toContain("env(safe-area-inset-left, 0px)");
    expect(surfaceCss).toContain("env(safe-area-inset-right, 0px)");
    expect(surfaceCss).toMatch(/padding-left:\s*max\(var\(--app-gutter\)/);
    expect(surfaceCss).toMatch(/padding-right:\s*max\(var\(--app-gutter\)/);
  });

  it("enforces the mini card width floor before adding another fixed column", () => {
    expect(homeCss).toContain("minmax(var(--mini-card-min-width, 260px), 1fr)");
    for (const breakpoint of [1440, 1150, 860, 580]) {
      expect(homeCss).toContain(`@media (max-width: ${breakpoint}px)`);
    }
  });

  it("resets child panels on collapse and keeps home-only routing out of controls", () => {
    expect(controlsSource).toContain("if (nextCollapsed) setColorsOpen(false)");
    expect(controlsSource).not.toContain("useLocation");
    expect(controlsSource).not.toContain("useSearchParams");
    expect(controlsSource).not.toContain("usePublicConfig");
  });

  it("keeps mini cards observer-free and URL-encodes their detail route", () => {
    expect(miniSource).not.toMatch(
      /from\s+["']\.\/(?:MetricBar|LatencyBars|QualityBars|CanvasStrip)["']/,
    );
    expect(miniSource).not.toContain("<canvas");
    expect(miniSource).toContain("encodeURIComponent(node.uuid)");
  });

  it("does not render zero-value overview cards before the node store is hydrated", () => {
    expect(nodeGridSource).toContain("hydrated: storeHydrated");
    expect(nodeGridSource).toContain("!themeSettings.isReady || !storeHydrated");
    expect(nodeGridSource.indexOf("!themeSettings.isReady || !storeHydrated")).toBeLessThan(
      nodeGridSource.indexOf("const homeHeader"),
    );
    const loadingBranch = nodeGridSource.slice(
      nodeGridSource.indexOf("!themeSettings.isReady || !storeHydrated"),
      nodeGridSource.indexOf("const homeHeader"),
    );
    expect(loadingBranch).not.toContain("<HomeBrand");
    expect(loadingBranch).not.toContain("<Spinner");
    expect(homeSource).toContain("const homeReady = themeSettings.isReady && storeHydrated");
    expect(homeSource).toContain("{homeReady && <FloatingControls");
  });

  it("keeps access and initial home hydration behind one shell-owned spinner", () => {
    expect(appShellSource).toContain("useNodeStoreStatus(canHydrateHome)");
    expect(appShellSource).toContain("isCheckingAccess || isCheckingHomeData");
    expect(appShellSource).toContain("isCheckingShell ?");
    expect(routerSource).toContain('import { Home } from "@/pages/Home"');
    expect(routerSource).not.toMatch(/const Home\s*=\s*lazy/);
    expect(routerSource).toContain("element: <Home />");
  });

  it("nudges brand and controls below the iOS PWA system blur band", () => {
    expect(homeCss).toMatch(/@supports \(-webkit-touch-callout: none\)/);
    expect(homeCss).toMatch(/@media \(display-mode: standalone\) and \(pointer: coarse\)/);
    expect(homeCss).toMatch(
      /html \.home-brand,\s*html \.floating-controls\s*\{\s*top:\s*1px/,
    );
    expect(homeCss).toMatch(/html \.home-dashboard\s*\{\s*padding-top:\s*43px/);
    expect(homeCss).toMatch(
      /html \.home-dashboard\.is-home-header-hidden\s*\{\s*padding-top:\s*0/,
    );
    expect(homeCss).toMatch(
      /@media \(min-width: 1024px\)\s*\{\s*html \.home-brand,\s*html \.floating-controls\s*\{\s*top:\s*-3px/,
    );
    expect(homeCss).toMatch(/html \.home-dashboard\s*\{\s*padding-top:\s*39px/);
  });

  it("仅在 iOS PWA 内为下拉刷新提示增加相同的 15px 避让", () => {
    expect(homeCss).toMatch(
      /@supports \(-webkit-touch-callout: none\)\s*\{\s*@media \(display-mode: standalone\) and \(pointer: coarse\)\s*\{\s*html \.pwa-pull-refresh\s*\{\s*top:\s*calc\(env\(safe-area-inset-top, 0px\) \+ 15px\);\s*\}/,
    );
    expect(surfaceCss).toMatch(
      /\.pwa-pull-refresh\s*\{[^}]*top:\s*env\(safe-area-inset-top, 0px\);/,
    );
  });
});
