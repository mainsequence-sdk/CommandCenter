import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardControlsProvider } from "@/dashboards/DashboardControls";
import { DashboardWidgetDependenciesProvider } from "@/dashboards/DashboardWidgetDependencies";
import { DashboardWidgetExecutionProvider } from "@/dashboards/DashboardWidgetExecution";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import type {
  DashboardControlsState,
  DashboardDefinition,
  ResolvedDashboardDefinition,
} from "@/dashboards/types";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import {
  sanitizeWorkspaceSlideProps,
} from "@/widgets/core/workspace-slide/slide-model";
import { WorkspaceSlideSurface } from "@/widgets/core/workspace-slide/WorkspaceSlideWidget";
import type { WidgetExecutionSurface } from "@/widgets/types";

import {
  updateDashboardControlsState,
} from "./custom-dashboard-storage";
import { WorkspaceRenderErrorBoundary, WorkspaceRenderErrorState } from "./WorkspaceRenderErrorBoundary";
import { WorkspaceSlideSubgridHost } from "./WorkspaceSlideSubgridHost";
import { useSlideStudioProjectionData } from "./slide-studio-runtime";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import { useWorkspaceStudioSurfaceConfig } from "./workspace-studio-surface-config";
import { PublicWorkspaceStatusBar } from "./PublicWorkspaceStatusBar";

function resolveInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "input, textarea, select, button, [contenteditable='true'], [role='textbox']",
    ),
  );
}

function SlideStudioSlideshowViewport({
  dashboard,
  resolvedDashboard,
  permissions,
  executionSurface,
  publicWorkspaceToken,
  manageKioskMode,
  onExit,
}: {
  dashboard: DashboardDefinition;
  resolvedDashboard: ResolvedDashboardDefinition;
  permissions: readonly string[];
  executionSurface: WidgetExecutionSurface;
  publicWorkspaceToken?: string;
  manageKioskMode: boolean;
  onExit?: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const kioskMode = useShellStore((state) => state.kioskMode);
  const setKioskMode = useShellStore((state) => state.setKioskMode);
  const [isSlideFrameHovered, setIsSlideFrameHovered] = useState(false);
  const [alwaysShowSlideshowControls, setAlwaysShowSlideshowControls] = useState(false);
  const [showSlideshowIntroHint, setShowSlideshowIntroHint] = useState(false);
  const previousKioskModeRef = useRef<boolean | null>(null);
  const kioskObservationReadyRef = useRef(false);
  const slideshowIntroHintShownRef = useRef(false);
  const publicView = executionSurface === "public-workspace";

  const canExitSlideshow = Boolean(onExit) || Boolean(searchParams.get("mode"));
  const exitSlideshow = useCallback(() => {
    if (onExit) {
      onExit();
      return;
    }

    if (!searchParams.get("mode")) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("mode");
    nextParams.delete("slide");
    setSearchParams(nextParams);
  }, [onExit, searchParams, setSearchParams]);

  useEffect(() => {
    if (!manageKioskMode) {
      return undefined;
    }

    if (previousKioskModeRef.current == null) {
      previousKioskModeRef.current = kioskMode;
    }

    setKioskMode(true);

    return () => {
      setKioskMode(previousKioskModeRef.current ?? false);
    };
  }, [kioskMode, manageKioskMode, setKioskMode]);

  useEffect(() => {
    if (!manageKioskMode) {
      return;
    }

    if (!kioskObservationReadyRef.current) {
      kioskObservationReadyRef.current = true;
      return;
    }

    if (!kioskMode) {
      exitSlideshow();
    }
  }, [exitSlideshow, kioskMode, manageKioskMode]);

  useEffect(() => {
    slideshowIntroHintShownRef.current = false;
    setShowSlideshowIntroHint(false);
  }, [dashboard.id]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 1279px), (hover: none), (pointer: coarse)");
    const updateControlsVisibility = () => {
      setAlwaysShowSlideshowControls(mediaQuery.matches);
    };

    updateControlsVisibility();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateControlsVisibility);

      return () => {
        mediaQuery.removeEventListener("change", updateControlsVisibility);
      };
    }

    mediaQuery.addListener(updateControlsVisibility);

    return () => {
      mediaQuery.removeListener(updateControlsVisibility);
    };
  }, []);

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

  const requestedSlideId = searchParams.get("slide");
  const activeSlideIndex = useMemo(() => {
    if (slideEntries.length === 0) {
      return -1;
    }

    const requestedIndex = requestedSlideId
      ? slideEntries.findIndex(({ instance }) => instance.id === requestedSlideId)
      : -1;

    return requestedIndex >= 0 ? requestedIndex : 0;
  }, [requestedSlideId, slideEntries]);
  const activeSlideEntry =
    activeSlideIndex >= 0 ? (slideEntries[activeSlideIndex] ?? null) : null;

  useEffect(() => {
    if (!activeSlideEntry || slideshowIntroHintShownRef.current) {
      return undefined;
    }

    slideshowIntroHintShownRef.current = true;
    setShowSlideshowIntroHint(true);

    const timeoutId = window.setTimeout(() => {
      setShowSlideshowIntroHint(false);
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeSlideEntry]);

  useEffect(() => {
    if (!activeSlideEntry) {
      return;
    }

    if (requestedSlideId === activeSlideEntry.instance.id) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("slide", activeSlideEntry.instance.id);
    setSearchParams(nextParams, { replace: true });
  }, [activeSlideEntry, requestedSlideId, searchParams, setSearchParams]);

  const setActiveSlideIndex = useCallback(
    (nextIndex: number) => {
      if (slideEntries.length === 0) {
        return;
      }

      const clampedIndex = Math.min(Math.max(nextIndex, 0), slideEntries.length - 1);
      const nextSlide = slideEntries[clampedIndex];

      if (!nextSlide) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("slide", nextSlide.instance.id);
      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams, slideEntries],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!activeSlideEntry || resolveInteractiveTarget(event.target)) {
        return;
      }

      if (
        event.key === "ArrowLeft" ||
        event.key === "PageUp" ||
        (event.key === " " && event.shiftKey)
      ) {
        event.preventDefault();
        setActiveSlideIndex(activeSlideIndex - 1);
        return;
      }

      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        setActiveSlideIndex(activeSlideIndex + 1);
        return;
      }

      if (event.key === "Escape" && canExitSlideshow) {
        event.preventDefault();
        exitSlideshow();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSlideEntry, activeSlideIndex, canExitSlideshow, exitSlideshow, setActiveSlideIndex]);

  const activeSlideLabel = activeSlideEntry
    ? (activeSlideEntry.instance.title?.trim() || `Slide ${activeSlideIndex + 1}`)
    : null;
  const showSlideEdgeControls =
    alwaysShowSlideshowControls || isSlideFrameHovered || showSlideshowIntroHint;
  const showSlideshowTopHint = showSlideshowIntroHint && Boolean(activeSlideEntry);

  const activeSlideContent = useMemo(() => {
    if (!activeSlideEntry) {
      return null;
    }

    const slide = sanitizeWorkspaceSlideProps(activeSlideEntry.instance.props ?? {});
    const slideRegions = slidePlacedWidgetEntriesByRegion.get(activeSlideEntry.instance.id);
    const bodyEntries = slideRegions?.get("body") ?? [];
    const bodyContent =
      bodyEntries.length > 0 ? (
        <WorkspaceSlideSubgridHost
          items={bodyEntries.map((entry) => ({
            id: entry.instance.id,
            layout: {
              x: entry.instance.layout.x,
              y: entry.instance.layout.y,
              w: entry.instance.layout.w,
              h: entry.instance.layout.h,
            },
            content: renderCanvasWidgetCard(entry.instance, entry.instance.widgetId),
          }))}
          editable={false}
        />
      ) : undefined;

    return (
      <WorkspaceSlideSurface
        active
        editable={false}
        maximizeFrame
        slide={slide}
        slideWidgetId={activeSlideEntry.instance.id}
        regionContent={bodyContent ? { body: bodyContent } : undefined}
      />
    );
  }, [
    activeSlideEntry,
    renderCanvasWidgetCard,
    slidePlacedWidgetEntriesByRegion,
  ]);

  return (
    <DashboardWidgetRegistryProvider widgets={renderedWidgets}>
      <DashboardWidgetExecutionProvider
        activeSurface="dashboard"
        enableAutomaticHydration={executionSurface === "public-workspace"}
        executionSurface={executionSurface}
        publicWorkspaceToken={publicWorkspaceToken}
        scopeId={dashboard.id}
        widgets={renderedWidgets}
        writeRuntimeState={(instanceId, runtimeState) => {
          updateWidgetRuntimeState(instanceId, runtimeState);
        }}
      >
        <DashboardWidgetDependenciesProvider widgets={renderedWidgets}>
          <div
            className="relative flex min-h-screen flex-col overflow-hidden text-foreground"
            style={{ backgroundColor: "var(--workspace-canvas-base-color)" }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: "var(--workspace-canvas-background)" }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: "var(--workspace-canvas-overlay)" }}
            />
            {publicView ? (
              <div className="relative z-20 shrink-0">
                <PublicWorkspaceStatusBar
                  compactMobile
                  centerContent={
                    activeSlideEntry ? (
                      <div className="inline-flex min-w-0 items-center justify-center gap-1.5 xl:gap-2">
                        <Badge
                          variant="neutral"
                          className="border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] text-primary xl:text-xs"
                        >
                          {`${activeSlideIndex + 1} / ${slideEntries.length}`}
                        </Badge>
                        {activeSlideLabel ? (
                          <span className="hidden min-w-0 truncate text-[10px] font-medium text-foreground xl:inline">
                            {activeSlideLabel}
                          </span>
                        ) : null}
                      </div>
                    ) : null
                  }
                />
              </div>
            ) : null}

            {hiddenDependencyMounts}

            {showSlideshowTopHint ? (
              <div className="relative z-20 shrink-0 px-4 pt-2 xl:px-8 xl:pt-3">
                <div className="flex justify-center">
                  <div className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-background/88 px-3 py-1 shadow-[var(--shadow-panel)] backdrop-blur-md">
                    {!publicView ? (
                      <Badge
                        variant="neutral"
                        className="border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                      >
                        {`${activeSlideIndex + 1} / ${slideEntries.length}`}
                      </Badge>
                    ) : null}
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Use `←` / `→`, `Space`, `Shift` + `Space`, or `Esc`
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="relative z-10 min-h-0 flex-1 px-0 py-0 xl:px-8 xl:py-8">
              {activeSlideContent ? (
                <div
                  className={cn(
                    "relative box-border w-full",
                    publicView
                      ? "h-[calc(100dvh-2.1rem)] xl:h-[calc(100vh-6rem)] xl:pb-8"
                      : "h-[calc(100vh-0.5rem)] xl:h-[calc(100vh-4rem)] xl:pb-8",
                  )}
                  onMouseLeave={() => {
                    setIsSlideFrameHovered(false);
                  }}
                >
                  {canExitSlideshow ? (
                    <div className="pointer-events-none absolute right-2 top-2 z-30 xl:right-4 xl:top-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className="pointer-events-auto h-8 w-8 rounded-full bg-background/88 shadow-[var(--shadow-panel)] backdrop-blur-md xl:h-9 xl:w-9"
                        onClick={() => {
                          exitSlideshow();
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                  <div
                    onMouseEnter={() => {
                      setIsSlideFrameHovered(true);
                    }}
                    onMouseLeave={() => {
                      setIsSlideFrameHovered(false);
                    }}
                    className="relative mx-auto h-full w-full max-w-[min(100vw,calc((100dvh-2.1rem)*16/9))] xl:max-w-[min(92vw,calc((100vh-8rem)*16/9))]"
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-y-0 left-0 right-0 z-20 flex items-center justify-between transition-opacity duration-150",
                        showSlideEdgeControls ? "opacity-100" : "opacity-0",
                      )}
                    >
                      <div className="pointer-events-none -ml-1 flex h-full items-center xl:-ml-4">
                        <Button
                          variant="outline"
                          size="icon"
                          className="pointer-events-auto h-9 w-9 rounded-full bg-background/88 shadow-[var(--shadow-panel)] backdrop-blur-md xl:h-10 xl:w-10"
                          disabled={activeSlideIndex <= 0}
                          aria-label="Previous slide"
                          onClick={() => {
                            setActiveSlideIndex(activeSlideIndex - 1);
                          }}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="pointer-events-none -mr-1 flex h-full items-center xl:-mr-4">
                        <Button
                          variant="outline"
                          size="icon"
                          className="pointer-events-auto h-9 w-9 rounded-full bg-background/88 shadow-[var(--shadow-panel)] backdrop-blur-md xl:h-10 xl:w-10"
                          disabled={activeSlideIndex < 0 || activeSlideIndex >= slideEntries.length - 1}
                          aria-label="Next slide"
                          onClick={() => {
                            setActiveSlideIndex(activeSlideIndex + 1);
                          }}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {activeSlideContent}
                  </div>
                </div>
              ) : (
                <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                  <div className="max-w-md rounded-[calc(var(--radius)+4px)] border border-border/70 bg-background/88 px-6 py-7 text-center shadow-[var(--shadow-panel)] backdrop-blur-md">
                    <Badge variant="neutral" className="border border-border/70 bg-card/55">
                      Slide Studio
                    </Badge>
                    <div className="mt-3 space-y-2">
                      <h1 className="text-xl font-semibold tracking-tight text-foreground">
                        No slides to present
                      </h1>
                      <p className="text-sm text-muted-foreground">
                        Add at least one Slide widget to this deck before opening slideshow mode.
                      </p>
                    </div>
                    <div className="mt-5 flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          exitSlideshow();
                        }}
                      >
                        Return to editor
                      </Button>
                    </div>
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

export function SlideStudioSlideshowRuntime({
  dashboard,
  resolvedDashboard,
  permissions,
  executionSurface = "private-dashboard",
  publicWorkspaceToken,
  manageKioskMode = true,
  onControlsStateChange,
  onControlsStateCommit,
  onExit,
}: {
  dashboard: DashboardDefinition;
  resolvedDashboard: ResolvedDashboardDefinition;
  permissions: readonly string[];
  executionSurface?: WidgetExecutionSurface;
  publicWorkspaceToken?: string;
  manageKioskMode?: boolean;
  onControlsStateChange?: (state: DashboardControlsState) => void;
  onControlsStateCommit?: (state: DashboardControlsState) => void;
  onExit?: () => void;
}) {
  return (
    <DashboardControlsProvider
      key={`${dashboard.id}:slideshow`}
      controls={dashboard.controls}
      refreshProgressUpdateIntervalMs={120}
      onStateChange={onControlsStateChange}
      onStateCommit={onControlsStateCommit}
    >
      <SlideStudioSlideshowViewport
        dashboard={dashboard}
        resolvedDashboard={resolvedDashboard}
        permissions={permissions}
        executionSurface={executionSurface}
        publicWorkspaceToken={publicWorkspaceToken}
        manageKioskMode={manageKioskMode}
        onExit={onExit}
      />
    </DashboardControlsProvider>
  );
}

export function SlideStudioSlideshowPage() {
  const navigate = useNavigate();
  const { workspaceFilter, workspaceListPath } = useWorkspaceStudioSurfaceConfig();
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
  const selectedWorkspaceSupported = selectedDashboard
    ? (workspaceFilter ? workspaceFilter(selectedDashboard) : true)
    : false;

  if (requestedWorkspaceId && workspaceSelectionPending && !selectedDashboard) {
    return (
      <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto flex min-h-[320px] max-w-4xl items-center justify-center">
          <div className="w-full max-w-md rounded-[calc(var(--radius)+4px)] border border-border/70 bg-card/80 px-6 py-8 text-center shadow-[var(--shadow-panel)]">
            <Badge variant="neutral" className="border border-border/70 bg-card/55">
              Loading slideshow
            </Badge>
            <div className="mt-3 space-y-1">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Opening presentation
              </h1>
              <p className="text-sm text-muted-foreground">
                Loading the selected slide deck and preparing slideshow mode.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (
    requestedWorkspaceId &&
    (requestedWorkspaceMissing || (selectedDashboard && !selectedWorkspaceSupported))
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
                Unable to open slideshow
              </h1>
              <p className="text-sm text-muted-foreground">
                The selected workspace is not available on the Slide Studio surface.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigate(workspaceListPath);
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
          navigate(workspaceListPath);
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
      resetKey={`${selectedDashboard.id}:${selectedWorkspaceView}:slideshow`}
      onBackToWorkspaces={() => {
        navigate(workspaceListPath);
      }}
      onOpenSettings={() => {
        openWorkspaceSettings();
      }}
      workspaceId={selectedDashboard.id}
      workspaceTitle={selectedDashboard.title}
    >
      <SlideStudioSlideshowRuntime
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
