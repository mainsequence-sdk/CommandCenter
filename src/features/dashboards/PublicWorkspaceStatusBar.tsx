import { Clock3, RefreshCw } from "lucide-react";

import { ThemeMenu } from "@/app/layout/ThemeMenu";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import {
  DashboardRefreshProgressLine,
  useDashboardControls,
} from "@/dashboards/DashboardControls";
import { useDashboardWidgetExecution } from "@/dashboards/DashboardWidgetExecution";

function formatPublicWorkspaceRemainingTime(valueMs: number | null) {
  if (valueMs === null) {
    return "Next update off";
  }

  if (valueMs < 60_000) {
    return `Next ${Math.max(1, Math.ceil(valueMs / 1000))}s`;
  }

  if (valueMs < 3_600_000) {
    return `Next ${Math.max(1, Math.ceil(valueMs / 60_000))}m`;
  }

  return `Next ${Math.max(1, Math.ceil(valueMs / 3_600_000))}h`;
}

export function PublicWorkspaceStatusBar() {
  const widgetExecution = useDashboardWidgetExecution();
  const { isRefreshing, refreshIntervalMs, refreshProgress } = useDashboardControls();
  const loading = widgetExecution?.dashboardSurfaceHydrationActive === true || isRefreshing;
  const autoRefreshActive = refreshIntervalMs !== null;
  const remainingRefreshMs =
    autoRefreshActive && typeof refreshIntervalMs === "number"
      ? Math.max(0, Math.round((1 - refreshProgress) * refreshIntervalMs))
      : null;
  const refreshProgressWidth = autoRefreshActive
    ? `${Math.max(0, Math.min(100, refreshProgress * 100))}%`
    : "0%";

  return (
    <div className="relative sticky top-0 z-40 mb-1 border-b border-border/60 bg-background/72 px-0 py-0.5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href="/login"
          className="inline-flex items-center rounded-[calc(var(--radius)-4px)] px-1 py-0.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          <BrandWordmark imageClassName="h-7 w-auto object-contain sm:h-8" />
        </a>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin text-primary" />
              <span>Refreshing data</span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-3 w-3" />
            <span>{formatPublicWorkspaceRemainingTime(remainingRefreshMs)}</span>
            <span className="relative h-1 w-20 overflow-hidden rounded-full bg-border/60">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-primary/80 transition-[width] duration-150"
                style={{ width: refreshProgressWidth }}
              />
            </span>
          </span>
          <ThemeMenu />
        </div>
      </div>
      <DashboardRefreshProgressLine className="top-full z-10" />
    </div>
  );
}
