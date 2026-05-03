import { Clock3, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

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

export function PublicWorkspaceStatusBar({
  compactMobile = false,
  centerContent,
}: {
  compactMobile?: boolean;
  centerContent?: ReactNode;
}) {
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
    <div
      className={
        compactMobile
          ? "relative sticky top-0 z-40 border-b border-border/60 bg-background/82 px-2 py-0 backdrop-blur-xl xl:mb-1 xl:px-0 xl:py-0.5"
          : "relative sticky top-0 z-40 mb-1 border-b border-border/60 bg-background/72 px-0 py-0.5 backdrop-blur-xl"
      }
    >
      <div className={compactMobile ? "grid grid-cols-[auto_1fr_auto] items-center gap-2" : "grid grid-cols-[auto_1fr_auto] items-center gap-2"}>
        <a
          href="/login"
          className={
            compactMobile
              ? "inline-flex items-center rounded-[calc(var(--radius)-5px)] px-0 py-0 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 xl:px-1 xl:py-0.5"
              : "inline-flex items-center rounded-[calc(var(--radius)-4px)] px-1 py-0.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          }
        >
          <BrandWordmark imageClassName={compactMobile ? "h-3.5 w-auto object-contain xl:h-8" : "h-7 w-auto object-contain sm:h-8"} />
        </a>
        <div className={compactMobile ? "min-w-0 px-1" : "min-w-0 px-2"}>
          {centerContent ? (
            <div className="flex min-w-0 items-center justify-center">
              {centerContent}
            </div>
          ) : null}
        </div>
        <div
          className={
            compactMobile
              ? "flex items-center justify-end gap-1 text-[8px] font-medium uppercase tracking-[0.12em] text-muted-foreground xl:flex-wrap xl:gap-3 xl:text-[10px] xl:tracking-[0.16em]"
              : "flex flex-wrap items-center justify-end gap-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
          }
        >
          {loading ? (
            <span className={compactMobile ? "hidden items-center gap-1.5 xl:inline-flex" : "inline-flex items-center gap-1.5"}>
              <RefreshCw className="h-3 w-3 animate-spin text-primary" />
              <span>Refreshing data</span>
            </span>
          ) : null}
          <span className={compactMobile ? "hidden items-center gap-2 xl:inline-flex" : "inline-flex items-center gap-2"}>
            <Clock3 className="h-3 w-3" />
            <span>{formatPublicWorkspaceRemainingTime(remainingRefreshMs)}</span>
            <span className="relative h-1 w-20 overflow-hidden rounded-full bg-border/60">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-primary/80 transition-[width] duration-150"
                style={{ width: refreshProgressWidth }}
              />
            </span>
          </span>
          <ThemeMenu compact={compactMobile} />
        </div>
      </div>
      <DashboardRefreshProgressLine className="top-full z-10" />
    </div>
  );
}
