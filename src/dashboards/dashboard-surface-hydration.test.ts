import { describe, expect, it } from "vitest";

import {
  resolveDashboardSurfaceHydrationState,
  shouldMountSidebarOnlyWidgets,
  shouldStartDashboardSurfaceReturnHydration,
  shouldSuppressPassiveUpstreamResolution,
} from "./dashboard-surface-hydration";

describe("dashboard surface hydration", () => {
  it("starts a surface-return hydration only when graph returns to dashboard after initial entry settled", () => {
    expect(
      shouldStartDashboardSurfaceReturnHydration({
        previousSurface: "graph",
        nextSurface: "dashboard",
        initialRefreshCompleted: true,
      }),
    ).toBe(true);

    expect(
      shouldStartDashboardSurfaceReturnHydration({
        previousSurface: "dashboard",
        nextSurface: "graph",
        initialRefreshCompleted: true,
      }),
    ).toBe(false);

    expect(
      shouldStartDashboardSurfaceReturnHydration({
        previousSurface: "graph",
        nextSurface: "dashboard",
        initialRefreshCompleted: false,
      }),
    ).toBe(false);
  });

  it("prioritizes initial-entry hydration over surface-return hydration and disables hydration on graph surfaces", () => {
    expect(
      resolveDashboardSurfaceHydrationState({
        activeSurface: "dashboard",
        initialHydrationActive: true,
        surfaceReturnHydrationActive: true,
        surfaceReturnHydrationPending: true,
      }),
    ).toEqual({
      active: true,
      reason: "initial-entry",
    });

    expect(
      resolveDashboardSurfaceHydrationState({
        activeSurface: "dashboard",
        initialHydrationActive: false,
        surfaceReturnHydrationActive: false,
        surfaceReturnHydrationPending: true,
      }),
    ).toEqual({
      active: true,
      reason: "surface-return",
    });

    expect(
      resolveDashboardSurfaceHydrationState({
        activeSurface: "graph",
        initialHydrationActive: true,
        surfaceReturnHydrationActive: true,
        surfaceReturnHydrationPending: true,
      }),
    ).toEqual({
      active: false,
    });
  });

  it("suppresses passive upstream resolution and hidden sidebar mounts while dashboard hydration is active", () => {
    expect(
      shouldSuppressPassiveUpstreamResolution({
        dashboardSurfaceHydrationActive: true,
      }),
    ).toBe(true);
    expect(
      shouldSuppressPassiveUpstreamResolution({
        dashboardSurfaceHydrationActive: false,
      }),
    ).toBe(false);

    expect(
      shouldMountSidebarOnlyWidgets({
        dashboardSurfaceHydrationActive: true,
      }),
    ).toBe(false);
    expect(
      shouldMountSidebarOnlyWidgets({
        dashboardSurfaceHydrationActive: false,
      }),
    ).toBe(true);
  });
});
