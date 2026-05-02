import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

import { getWidgetById } from "@/app/registry";
import { hasAllPermissions } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ResolvedDashboardWidgetEntry } from "@/dashboards/canvas-items";
import { DashboardControlsProvider } from "@/dashboards/DashboardControls";
import { DashboardWidgetDependenciesProvider } from "@/dashboards/DashboardWidgetDependencies";
import { DashboardWidgetExecutionProvider } from "@/dashboards/DashboardWidgetExecution";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import { WORKSPACE_SLIDE_WIDGET_ID } from "@/dashboards/structural-widgets";
import type { ResolvedDashboardWidgetInstance } from "@/dashboards/types";
import { useShellStore } from "@/stores/shell-store";
import { resolveWidgetSidebarOnly } from "@/widgets/shared/chrome";
import { resolveWidgetInstancePresentation } from "@/widgets/shared/widget-schema";
import { LockedWidgetFrame } from "@/widgets/shared/widget-frame";
import {
  sanitizeWorkspaceSlideProps,
  WORKSPACE_SLIDE_REGION_IDS,
  type WorkspaceSlideRegionId,
} from "@/widgets/core/workspace-slide/slide-model";
import { WorkspaceSlideSurface } from "@/widgets/core/workspace-slide/WorkspaceSlideWidget";
import type { WidgetHeaderActionsProps, WidgetInstancePresentation } from "@/widgets/types";

import {
  updateDashboardControlsState,
} from "./custom-dashboard-storage";
import { WorkspaceCanvasWidgetCard } from "./WorkspaceCanvasWidgetHost";
import { WorkspaceRenderErrorBoundary, WorkspaceRenderErrorState } from "./WorkspaceRenderErrorBoundary";
import { WorkspaceSlideSubgridHost } from "./WorkspaceSlideSubgridHost";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import { useWorkspaceStudioSurfaceConfig } from "./workspace-studio-surface-config";

interface WidgetInstanceOverride {
  props?: Record<string, unknown>;
  presentation?: WidgetInstancePresentation | null;
  runtimeState?: Record<string, unknown> | null;
  title?: string | null;
}

function applyWidgetOverride(
  instance: ResolvedDashboardWidgetInstance,
  override?: WidgetInstanceOverride,
) {
  if (!override) {
    return instance;
  }

  return {
    ...instance,
    title: "title" in override ? (override.title ?? undefined) : instance.title,
    props: "props" in override ? override.props : instance.props,
    presentation:
      "presentation" in override ? (override.presentation ?? undefined) : instance.presentation,
    runtimeState:
      "runtimeState" in override ? (override.runtimeState ?? undefined) : instance.runtimeState,
  };
}

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

function SlideStudioSlideshowViewport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const kioskMode = useShellStore((state) => state.kioskMode);
  const setKioskMode = useShellStore((state) => state.setKioskMode);
  const {
    permissions,
    selectedDashboard,
    resolvedDashboard,
    updateSelectedWorkspaceUserState,
    commitSelectedWorkspaceControlsState,
  } = useCustomWorkspaceStudio();
  const [widgetOverrides, setWidgetOverrides] = useState<Record<string, WidgetInstanceOverride>>(
    {},
  );
  const previousKioskModeRef = useRef<boolean | null>(null);
  const kioskObservationReadyRef = useRef(false);

  const exitSlideshow = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("mode");
    nextParams.delete("slide");
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (previousKioskModeRef.current == null) {
      previousKioskModeRef.current = kioskMode;
    }

    setKioskMode(true);

    return () => {
      setKioskMode(previousKioskModeRef.current ?? false);
    };
  }, [setKioskMode]);

  useEffect(() => {
    if (!kioskObservationReadyRef.current) {
      kioskObservationReadyRef.current = true;
      return;
    }

    if (!kioskMode) {
      exitSlideshow();
    }
  }, [exitSlideshow, kioskMode]);

  useEffect(() => {
    setWidgetOverrides({});
  }, [selectedDashboard?.id]);

  const renderedWidgets = useMemo(
    () =>
      (resolvedDashboard?.widgets ?? []).map((instance) =>
        applyWidgetOverride(instance, widgetOverrides[instance.id]),
      ),
    [resolvedDashboard?.widgets, widgetOverrides],
  );

  const resolvedRenderedWidgets = useMemo(
    () =>
      renderedWidgets.map((instance) => {
        const widget = getWidgetById(instance.widgetId);

        return widget
          ? {
              ...instance,
              presentation: resolveWidgetInstancePresentation(widget, instance.presentation),
            }
          : instance;
      }),
    [renderedWidgets],
  );

  const widgetEntries = useMemo<ResolvedDashboardWidgetEntry[]>(
    () =>
      resolvedRenderedWidgets.flatMap((instance) => {
        const widget = getWidgetById(instance.widgetId);

        return widget ? [{ instance, widget }] : [];
      }),
    [resolvedRenderedWidgets],
  );

  const slidePlacedWidgetEntriesByRegion = useMemo(() => {
    const grouped = new Map<string, Map<WorkspaceSlideRegionId, ResolvedDashboardWidgetEntry[]>>();

    widgetEntries.forEach((entry) => {
      if (resolveWidgetSidebarOnly(entry.instance.presentation) || !entry.instance.slidePlacement) {
        return;
      }

      const byRegion = grouped.get(entry.instance.slidePlacement.slideWidgetId) ?? new Map();
      const current = byRegion.get(entry.instance.slidePlacement.region) ?? [];
      current.push(entry);
      byRegion.set(entry.instance.slidePlacement.region, current);
      grouped.set(entry.instance.slidePlacement.slideWidgetId, byRegion);
    });

    grouped.forEach((byRegion) => {
      byRegion.forEach((entries) => {
        entries.sort(
          (left, right) =>
            left.instance.layout.y - right.instance.layout.y ||
            left.instance.layout.x - right.instance.layout.x,
        );
      });
    });

    return grouped;
  }, [widgetEntries]);

  const sidebarOnlyWidgetEntries = useMemo(
    () =>
      widgetEntries.filter(
        ({ instance }) =>
          resolveWidgetSidebarOnly(instance.presentation) && !instance.slidePlacement,
      ),
    [widgetEntries],
  );

  const slideEntries = useMemo(
    () =>
      widgetEntries
        .filter(
          ({ instance, widget }) =>
            widget.id === WORKSPACE_SLIDE_WIDGET_ID && !instance.slidePlacement,
        )
        .sort(
          (left, right) =>
            left.instance.layout.y - right.instance.layout.y ||
            left.instance.layout.x - right.instance.layout.x,
        ),
    [widgetEntries],
  );

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

      if (event.key === "Escape") {
        event.preventDefault();
        exitSlideshow();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSlideEntry, activeSlideIndex, exitSlideshow, setActiveSlideIndex]);

  const renderCanvasWidgetCard = useCallback(
    (instance: ResolvedDashboardWidgetInstance, widgetId: string): ReactNode => {
      const widget = getWidgetById(widgetId);

      if (!widget) {
        return null;
      }

      const required = [...(widget.requiredPermissions ?? []), ...(instance.requiredPermissions ?? [])];

      if (!hasAllPermissions(permissions, required)) {
        return (
          <LockedWidgetFrame
            title={instance.title ?? widget.title}
            description={`Missing permissions: ${required.join(", ")}`}
            style={{ height: "100%" }}
          />
        );
      }

      const HeaderActions =
        widget.headerActions as
          | ComponentType<WidgetHeaderActionsProps<Record<string, unknown>>>
          | undefined;

      return (
        <WorkspaceCanvasWidgetCard
          instanceId={instance.id}
          instanceTitle={instance.title}
          selected={false}
          editable={false}
          widget={widget}
          widgetProps={instance.props ?? {}}
          widgetPresentation={instance.presentation}
          widgetRuntimeState={instance.runtimeState}
          renderCanvasFields={false}
          headerActions={
            HeaderActions ? (
              <HeaderActions
                widget={widget}
                props={instance.props ?? {}}
                runtimeState={instance.runtimeState}
                onRuntimeStateChange={(state) => {
                  setWidgetOverrides((current) => ({
                    ...current,
                    [instance.id]: {
                      ...current[instance.id],
                      runtimeState: state ?? null,
                    },
                  }));
                }}
              />
            ) : undefined
          }
          onRemove={() => {}}
          onDuplicate={() => {}}
          onSaveWidget={() => {}}
          onPropsChange={(instanceId, props) => {
            setWidgetOverrides((current) => ({
              ...current,
              [instanceId]: {
                ...current[instanceId],
                props,
              },
            }));
          }}
          onPresentationChange={(instanceId, presentation) => {
            setWidgetOverrides((current) => ({
              ...current,
              [instanceId]: {
                ...current[instanceId],
                presentation,
              },
            }));
          }}
          onRuntimeStateChange={(instanceId, runtimeState) => {
            setWidgetOverrides((current) => ({
              ...current,
              [instanceId]: {
                ...current[instanceId],
                runtimeState: runtimeState ?? null,
              },
            }));
          }}
          onSelect={() => {}}
          onOpenBindings={() => {}}
          onOpenSettings={() => {}}
          rowCollapsed={false}
          rowChildCount={0}
        />
      );
    },
    [permissions],
  );

  const activeSlideLabel = activeSlideEntry
    ? (activeSlideEntry.instance.title?.trim() || `Slide ${activeSlideIndex + 1}`)
    : null;

  const activeSlideContent = useMemo(() => {
    if (!activeSlideEntry) {
      return null;
    }

    const slide = sanitizeWorkspaceSlideProps(activeSlideEntry.instance.props ?? {});
    const slideRegions = slidePlacedWidgetEntriesByRegion.get(activeSlideEntry.instance.id);
    const regionContent: Partial<Record<WorkspaceSlideRegionId, ReactNode>> = {};

    WORKSPACE_SLIDE_REGION_IDS.forEach((regionId) => {
      const entries = slideRegions?.get(regionId) ?? [];

      if (entries.length === 0) {
        return;
      }

      regionContent[regionId] = (
        <WorkspaceSlideSubgridHost
          items={entries.map((entry) => ({
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
      );
    });

    return (
      <WorkspaceSlideSurface
        active
        editable={false}
        slide={slide}
        slideWidgetId={activeSlideEntry.instance.id}
        overlayContent={
          <div className="mx-auto flex w-full items-start justify-between gap-4 opacity-0 transition-opacity duration-150 group-hover/slideshow:opacity-100 group-focus-within/slideshow:opacity-100">
            <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-border/70 bg-background/88 px-4 py-2 shadow-[var(--shadow-panel)] backdrop-blur-md">
              <Badge variant="neutral" className="border border-primary/30 bg-primary/10 text-primary">
                {`Slide ${activeSlideIndex + 1} / ${slideEntries.length}`}
              </Badge>
              {activeSlideLabel ? (
                <span className="text-sm font-medium text-foreground">{activeSlideLabel}</span>
              ) : null}
            </div>
            <div className="pointer-events-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={activeSlideIndex <= 0}
                onClick={() => {
                  setActiveSlideIndex(activeSlideIndex - 1);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={activeSlideIndex < 0 || activeSlideIndex >= slideEntries.length - 1}
                onClick={() => {
                  setActiveSlideIndex(activeSlideIndex + 1);
                }}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exitSlideshow();
                }}
              >
                <X className="h-4 w-4" />
                Exit
              </Button>
            </div>
          </div>
        }
        regionContent={regionContent}
      />
    );
  }, [
    activeSlideEntry,
    activeSlideIndex,
    activeSlideLabel,
    exitSlideshow,
    renderCanvasWidgetCard,
    setActiveSlideIndex,
    slideEntries.length,
    slidePlacedWidgetEntriesByRegion,
  ]);

  return (
    <DashboardWidgetRegistryProvider widgets={renderedWidgets}>
      <DashboardWidgetExecutionProvider
        activeSurface="dashboard"
        enableAutomaticHydration={false}
        scopeId={selectedDashboard?.id ?? "slide-studio"}
        widgets={renderedWidgets}
        writeRuntimeState={(instanceId, runtimeState) => {
          setWidgetOverrides((current) => ({
            ...current,
            [instanceId]: {
              ...current[instanceId],
              runtimeState: runtimeState ?? null,
            },
          }));
        }}
      >
        <DashboardWidgetDependenciesProvider widgets={renderedWidgets}>
          <div
            className="relative min-h-screen overflow-hidden text-foreground"
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
            <div className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0">
              {sidebarOnlyWidgetEntries.map(({ instance, widget }) => {
                const required = [...(widget.requiredPermissions ?? []), ...(instance.requiredPermissions ?? [])];

                if (!hasAllPermissions(permissions, required)) {
                  return null;
                }

                const Component = widget.component as ComponentType<{
                  widget: typeof widget;
                  instanceId?: string;
                  instanceTitle?: string;
                  props: Record<string, unknown>;
                  presentation?: WidgetInstancePresentation;
                  runtimeState?: Record<string, unknown>;
                  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
                }>;

                return (
                  <div key={instance.id} className="h-px w-px overflow-hidden">
                    <Component
                      widget={widget}
                      instanceId={instance.id}
                      instanceTitle={instance.title}
                      props={instance.props ?? {}}
                      presentation={instance.presentation}
                      runtimeState={instance.runtimeState}
                      onRuntimeStateChange={(state) => {
                        setWidgetOverrides((current) => ({
                          ...current,
                          [instance.id]: {
                            ...current[instance.id],
                            runtimeState: state ?? null,
                          },
                        }));
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="min-h-screen px-8 py-8">
              {activeSlideContent ? (
                <div className="group/slideshow relative h-[calc(100vh-4rem)] w-full">{activeSlideContent}</div>
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

export function SlideStudioSlideshowPage() {
  const navigate = useNavigate();
  const { workspaceFilter, workspaceListPath } = useWorkspaceStudioSurfaceConfig();
  const {
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
        <DashboardControlsProvider
          key={`${selectedDashboard.id}:slideshow`}
          controls={selectedDashboard.controls}
          refreshProgressUpdateIntervalMs={120}
        onStateChange={(state) => {
          updateSelectedWorkspaceUserState((dashboard) =>
            updateDashboardControlsState(dashboard, state),
          );
        }}
          onStateCommit={commitSelectedWorkspaceControlsState}
        >
          <SlideStudioSlideshowViewport />
        </DashboardControlsProvider>
      </WorkspaceRenderErrorBoundary>
  );
}
