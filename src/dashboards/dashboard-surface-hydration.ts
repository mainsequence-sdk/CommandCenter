export type DashboardExecutionSurface = "dashboard" | "graph";

export type DashboardSurfaceHydrationReason =
  | "initial-entry"
  | "surface-return";

export function shouldStartDashboardSurfaceReturnHydration({
  previousSurface,
  nextSurface,
  initialRefreshCompleted,
}: {
  previousSurface: DashboardExecutionSurface;
  nextSurface: DashboardExecutionSurface;
  initialRefreshCompleted: boolean;
}) {
  return (
    previousSurface === "graph" &&
    nextSurface === "dashboard" &&
    initialRefreshCompleted
  );
}

export function resolveDashboardSurfaceHydrationState({
  activeSurface,
  initialHydrationActive,
  surfaceReturnHydrationActive,
  surfaceReturnHydrationPending = false,
}: {
  activeSurface: DashboardExecutionSurface;
  initialHydrationActive: boolean;
  surfaceReturnHydrationActive: boolean;
  surfaceReturnHydrationPending?: boolean;
}): {
  active: boolean;
  reason?: DashboardSurfaceHydrationReason;
} {
  if (activeSurface !== "dashboard") {
    return {
      active: false,
    };
  }

  if (initialHydrationActive) {
    return {
      active: true,
      reason: "initial-entry",
    };
  }

  if (surfaceReturnHydrationPending || surfaceReturnHydrationActive) {
    return {
      active: true,
      reason: "surface-return",
    };
  }

  return {
    active: false,
  };
}

export function shouldSuppressPassiveUpstreamResolution({
  dashboardSurfaceHydrationActive,
}: {
  dashboardSurfaceHydrationActive: boolean;
}) {
  return dashboardSurfaceHydrationActive;
}

export function shouldMountSidebarOnlyWidgets({
  dashboardSurfaceHydrationActive,
}: {
  dashboardSurfaceHydrationActive: boolean;
}) {
  return !dashboardSurfaceHydrationActive;
}
