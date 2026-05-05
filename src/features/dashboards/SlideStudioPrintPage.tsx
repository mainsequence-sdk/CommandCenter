import { useEffect, useMemo, useRef } from "react";

import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardControlsProvider } from "@/dashboards/DashboardControls";
import { DashboardWidgetDependenciesProvider } from "@/dashboards/DashboardWidgetDependencies";
import {
  DashboardWidgetExecutionProvider,
  useDashboardWidgetExecution,
} from "@/dashboards/DashboardWidgetExecution";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import type {
  DashboardControlsState,
  DashboardDefinition,
  ResolvedDashboardDefinition,
} from "@/dashboards/types";
import { cn } from "@/lib/utils";
import { sanitizeWorkspaceSlideProps } from "@/widgets/core/workspace-slide/slide-model";
import { WorkspaceSlideSurface } from "@/widgets/core/workspace-slide/WorkspaceSlideWidget";
import type { WidgetExecutionSurface } from "@/widgets/types";

import { updateDashboardControlsState } from "./custom-dashboard-storage";
import { WorkspaceRenderErrorBoundary, WorkspaceRenderErrorState } from "./WorkspaceRenderErrorBoundary";
import { WorkspaceSlideSubgridHost } from "./WorkspaceSlideSubgridHost";
import { useSlideStudioProjectionData } from "./slide-studio-runtime";
import { SLIDE_STUDIO_SURFACE_PATH } from "./slide-studio-workspaces";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";

function SlideStudioPrintViewport({
  dashboard,
  resolvedDashboard,
  permissions,
  executionSurface,
}: {
  dashboard: DashboardDefinition;
  resolvedDashboard: ResolvedDashboardDefinition;
  permissions: readonly string[];
  executionSurface: WidgetExecutionSurface;
}) {
  const printTriggeredRef = useRef(false);
  const previousTitleRef = useRef<string | null>(null);
  const execution = useDashboardWidgetExecution();
  const {
    hiddenDependencyMounts,
    renderCanvasWidgetCard,
    renderedWidgets,
    slideEntries,
    slidePlacedWidgetEntriesByRegion,
    updateWidgetRuntimeState,
  } = useSlideStudioProjectionData({
    dashboardId: dashboard.id,
    permissions,
    resolvedDashboard,
  });
  const readyForPrint =
    slideEntries.length > 0 &&
    execution?.dashboardSurfaceHydrationActive !== true;

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    previousTitleRef.current = document.title;
    document.title = `${dashboard.title || "slide-deck"}.pdf`;

    return () => {
      if (previousTitleRef.current !== null) {
        document.title = previousTitleRef.current;
      }
    };
  }, [dashboard.title]);

  useEffect(() => {
    printTriggeredRef.current = false;
  }, [dashboard.id]);

  useEffect(() => {
    if (!readyForPrint || printTriggeredRef.current || typeof window === "undefined") {
      return undefined;
    }

    printTriggeredRef.current = true;
    let cancelled = false;
    let timeoutId = 0;
    let frameId = 0;

    frameId = window.requestAnimationFrame(() => {
      frameId = window.requestAnimationFrame(() => {
        timeoutId = window.setTimeout(() => {
          if (cancelled) {
            return;
          }

          window.focus();
          window.print();
        }, 180);
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [readyForPrint]);

  const renderedSlides = useMemo(
    () =>
      slideEntries.map((entry, index) => {
        const slide = sanitizeWorkspaceSlideProps(entry.instance.props ?? {});
        const slideRegions = slidePlacedWidgetEntriesByRegion.get(entry.instance.id);
        const bodyEntries = slideRegions?.get("body") ?? [];
        const bodyContent =
          bodyEntries.length > 0 ? (
            <WorkspaceSlideSubgridHost
              items={bodyEntries.map((item) => ({
                id: item.instance.id,
                layout: {
                  x: item.instance.layout.x,
                  y: item.instance.layout.y,
                  w: item.instance.layout.w,
                  h: item.instance.layout.h,
                },
                content: renderCanvasWidgetCard(item.instance, item.instance.widgetId),
              }))}
              editable={false}
            />
          ) : undefined;

        return (
          <section
            key={entry.instance.id}
            className="slide-studio-print-page flex items-center justify-center print:break-after-page print:break-inside-avoid print:last:break-after-auto"
          >
            <div className="slide-studio-print-sheet relative w-full max-w-[min(96vw,1280px)] aspect-video overflow-hidden print:max-w-none">
              <WorkspaceSlideSurface
                active={false}
                editable={false}
                frameMode="print"
                slide={slide}
                slideWidgetId={entry.instance.id}
                regionContent={bodyContent ? { body: bodyContent } : undefined}
              />
            </div>
          </section>
        );
      }),
    [renderCanvasWidgetCard, slideEntries, slidePlacedWidgetEntriesByRegion],
  );

  return (
    <DashboardWidgetRegistryProvider widgets={renderedWidgets}>
      <DashboardWidgetExecutionProvider
        activeSurface="dashboard"
        scopeId={dashboard.id}
        widgets={renderedWidgets}
        executionSurface={executionSurface}
        writeRuntimeState={(instanceId, runtimeState) => {
          updateWidgetRuntimeState(instanceId, runtimeState);
        }}
      >
        <DashboardWidgetDependenciesProvider widgets={renderedWidgets}>
          <div className="min-h-screen bg-background text-foreground print:min-h-0 print:bg-white">
            <style>
              {`
                @page {
                  size: 13.333in 7.5in;
                  margin: 0;
                }

                @media print {
                  html,
                  body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                    print-color-adjust: exact;
                    -webkit-print-color-adjust: exact;
                  }

                  .slide-studio-print-root {
                    padding: 0 !important;
                    margin: 0 !important;
                  }

                  .slide-studio-print-page {
                    width: 13.333in;
                    height: 7.5in;
                    margin: 0;
                    padding: 0;
                  }

                  .slide-studio-print-sheet {
                    width: 13.333in !important;
                    height: 7.5in !important;
                    max-width: none !important;
                  }
                }
              `}
            </style>
            {hiddenDependencyMounts}
            <div
              className={cn(
                "slide-studio-print-root mx-auto max-w-[1600px] px-4 py-4 md:px-6 md:py-6 print:max-w-none print:px-0 print:py-0",
                slideEntries.length > 0 ? "space-y-6 print:space-y-0" : undefined,
              )}
            >
              {slideEntries.length > 0 ? (
                renderedSlides
              ) : (
                <div className="mx-auto flex min-h-[320px] max-w-2xl items-center justify-center">
                  <div className="w-full max-w-md rounded-[calc(var(--radius)+4px)] border border-border/70 bg-card/80 px-6 py-8 text-center shadow-[var(--shadow-panel)]">
                    <div className="text-sm font-medium text-foreground">No slides to print</div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Add at least one Slide widget to this deck before exporting it as PDF.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DashboardWidgetDependenciesProvider>
      </DashboardWidgetExecutionProvider>
    </DashboardWidgetRegistryProvider>
  );
}

export function SlideStudioPrintRuntime({
  dashboard,
  resolvedDashboard,
  permissions,
  executionSurface = "private-dashboard",
  onControlsStateChange,
  onControlsStateCommit,
}: {
  dashboard: DashboardDefinition;
  resolvedDashboard: ResolvedDashboardDefinition;
  permissions: readonly string[];
  executionSurface?: WidgetExecutionSurface;
  onControlsStateChange?: (state: DashboardControlsState) => void;
  onControlsStateCommit?: (state: DashboardControlsState) => void;
}) {
  return (
    <DashboardControlsProvider
      key={`${dashboard.id}:print`}
      controls={dashboard.controls}
      refreshProgressUpdateIntervalMs={120}
      onStateChange={onControlsStateChange}
      onStateCommit={onControlsStateCommit}
    >
      <SlideStudioPrintViewport
        dashboard={dashboard}
        resolvedDashboard={resolvedDashboard}
        permissions={permissions}
        executionSurface={executionSurface}
      />
    </DashboardControlsProvider>
  );
}

export function SlideStudioPrintPage() {
  const navigate = useNavigate();
  const {
    permissions,
    selectedDashboard,
    resolvedDashboard,
    resolvedDashboardError,
    selectedWorkspaceView,
    requestedWorkspaceId,
    requestedWorkspaceMissing,
    workspaceSelectionPending,
    openWorkspaceSettings,
    updateSelectedWorkspaceUserState,
    commitSelectedWorkspaceControlsState,
  } = useCustomWorkspaceStudio();

  if (requestedWorkspaceId && workspaceSelectionPending && !selectedDashboard) {
    return (
      <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto flex min-h-[320px] max-w-4xl items-center justify-center">
          <div className="w-full max-w-md rounded-[calc(var(--radius)+4px)] border border-border/70 bg-card/80 px-6 py-8 text-center shadow-[var(--shadow-panel)]">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Preparing slide deck
              </h1>
              <p className="text-sm text-muted-foreground">
                Loading the selected slide deck and preparing the printable PDF projection.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (
    requestedWorkspaceId &&
    requestedWorkspaceMissing
  ) {
    return (
      <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto flex min-h-[320px] max-w-4xl items-center justify-center">
          <div className="w-full max-w-md rounded-[calc(var(--radius)+4px)] border border-danger/25 bg-card/80 px-6 py-8 text-center shadow-[var(--shadow-panel)]">
            <Badge variant="warning" className="border border-danger/25 bg-danger/10 text-danger">
              Slide deck not found
            </Badge>
            <div className="mt-3 space-y-1">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Unable to open print preview
              </h1>
              <p className="text-sm text-muted-foreground">
                The selected workspace is not available on the Slide Studio surface.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigate(SLIDE_STUDIO_SURFACE_PATH);
                }}
              >
                Back to slide decks
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedDashboard) {
    return null;
  }

  if (resolvedDashboardError) {
    return (
      <WorkspaceRenderErrorState
        error={resolvedDashboardError}
        onBackToWorkspaces={() => {
          navigate(SLIDE_STUDIO_SURFACE_PATH);
        }}
        onOpenSettings={() => {
          openWorkspaceSettings();
        }}
        workspaceId={selectedDashboard.id}
        workspaceTitle={selectedDashboard.title}
      />
    );
  }

  if (!resolvedDashboard) {
    return null;
  }

  return (
    <WorkspaceRenderErrorBoundary
      resetKey={`${selectedDashboard.id}:${selectedWorkspaceView}:print`}
      onBackToWorkspaces={() => {
        navigate(SLIDE_STUDIO_SURFACE_PATH);
      }}
      onOpenSettings={() => {
        openWorkspaceSettings();
      }}
      workspaceId={selectedDashboard.id}
      workspaceTitle={selectedDashboard.title}
    >
      <SlideStudioPrintRuntime
        dashboard={selectedDashboard}
        resolvedDashboard={resolvedDashboard}
        permissions={permissions}
        onControlsStateChange={(state) => {
          updateSelectedWorkspaceUserState((dashboard) =>
            updateDashboardControlsState(dashboard, state),
          );
        }}
        onControlsStateCommit={commitSelectedWorkspaceControlsState}
      />
    </WorkspaceRenderErrorBoundary>
  );
}
