import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ComponentType } from "react";

import { ArrowLeft } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { hasAllPermissions } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  resolveDashboardCanvasCompanionCandidates,
  resolveDashboardCompanionMap,
  resolveDashboardCompanionLayoutMap,
  type DashboardCanvasCompanionCandidate,
  type ResolvedDashboardWidgetEntry,
} from "@/dashboards/canvas-items";
import {
  DashboardControlsProvider,
  DashboardDataControls,
  DashboardRefreshProgressLine,
} from "@/dashboards/DashboardControls";
import { DashboardWidgetDependenciesProvider } from "@/dashboards/DashboardWidgetDependencies";
import { DashboardWidgetExecutionProvider } from "@/dashboards/DashboardWidgetExecution";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import { resolveDashboardLayout } from "@/dashboards/layout";
import {
  resolveAutoGridTemplateColumns,
  resolveCustomRuntimeGridLayout,
} from "@/dashboards/responsive-layout";
import {
  getWorkspaceRowChildCount,
  isWorkspaceRowCollapsed,
  isWorkspaceRowWidgetId,
  WORKSPACE_SLIDE_WIDGET_ID,
} from "@/dashboards/structural-widgets";
import type {
  DashboardDefinition,
  DashboardLayoutKind,
  ResolvedDashboardWidgetInstance,
  ResolvedDashboardWidgetLayout,
} from "@/dashboards/types";
import { getWidgetById } from "@/app/registry";
import {
  LockedWidgetFrame,
  MissingWidgetFrame,
} from "@/widgets/shared/widget-frame";
import { resolveWidgetSidebarOnly } from "@/widgets/shared/chrome";
import { WidgetSettingsPanel } from "@/widgets/shared/widget-settings";
import {
  getVisibleWidgetSchemaFields,
  resolveWidgetFieldState,
  resolveWidgetInstancePresentation,
  useResolvedWidgetControllerContext,
} from "@/widgets/shared/widget-schema";
import type { WidgetInstanceBindings, WidgetInstancePresentation } from "@/widgets/types";
import type { WidgetHeaderActionsProps } from "@/widgets/types";
import {
  sanitizeWorkspaceSlideProps,
  type WorkspaceSlideRegionId,
} from "@/widgets/core/workspace-slide/slide-model";
import { WorkspaceSlideSurface } from "@/widgets/core/workspace-slide/WorkspaceSlideWidget";
import {
  DEFAULT_WORKSPACE_CANVAS_BOTTOM_BUFFER_ROWS,
  resolveWorkspaceCanvasMinHeight,
} from "./workspace-canvas-height";
import { PublicWorkspaceStatusBar } from "./PublicWorkspaceStatusBar";
import { clonePublicWorkspaceRenderPermissions } from "./public-workspace-permissions";
import { WorkspaceWidgetRail } from "./WorkspaceChrome";
import { WorkspaceCanvasWidgetCard } from "./WorkspaceCanvasWidgetHost";
import { WorkspaceSlideSubgridHost } from "./WorkspaceSlideSubgridHost";
import { HiddenSidebarRuntimeWidgetMount } from "./HiddenSidebarRuntimeWidgetMount";
import { isManagedDashboardWidgetHiddenFromNormalRail } from "./workspace-widget-visibility";

const EMPTY_PERMISSIONS: string[] = [];
function layoutToStyle(layout: ResolvedDashboardWidgetLayout): CSSProperties {
  return {
    gridColumn: `${layout.x + 1} / span ${layout.w}`,
    gridRow: `${layout.y + 1} / span ${layout.h}`,
  };
}

function autoGridItemStyle(
  layout: Pick<ResolvedDashboardWidgetLayout, "h">,
  options?: { fullWidth?: boolean },
): CSSProperties {
  return {
    minWidth: 0,
    gridRow: `span ${Math.max(1, layout.h)}`,
    gridColumn: options?.fullWidth ? "1 / -1" : undefined,
  };
}

function resolveGridItemInsetStyle(gap: number): CSSProperties | undefined {
  if (gap <= 0) {
    return undefined;
  }

  return {
    boxSizing: "border-box",
    padding: `${gap / 2}px`,
  };
}

function jsonValueEquals(a: unknown, b: unknown) {
  if (Object.is(a, b)) {
    return true;
  }

  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

interface WidgetInstanceOverride {
  bindings?: WidgetInstanceBindings;
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
    title:
      "title" in override
        ? (override.title ?? undefined)
        : instance.title,
    bindings:
      "bindings" in override
        ? override.bindings
        : instance.bindings,
    props:
      "props" in override
        ? override.props
        : instance.props,
    presentation:
      "presentation" in override
        ? (override.presentation ?? undefined)
        : instance.presentation,
    runtimeState:
      "runtimeState" in override
        ? (override.runtimeState ?? undefined)
        : instance.runtimeState,
  };
}

function DashboardCanvasCompanionCard({
  candidate,
  onPropsChange,
  onRuntimeStateChange,
  onVisibilityChange,
}: {
  candidate: DashboardCanvasCompanionCandidate;
  onPropsChange: (props: Record<string, unknown>) => void;
  onRuntimeStateChange: (runtimeState: Record<string, unknown> | undefined) => void;
  onVisibilityChange: (itemId: string, visible: boolean) => void;
}) {
  const context = useResolvedWidgetControllerContext(candidate.widget, {
    instanceId: candidate.instanceId,
    props: candidate.props,
    runtimeState: candidate.runtimeState,
    mode: "canvas",
  });
  const visibleField = useMemo(
    () =>
      getVisibleWidgetSchemaFields(candidate.widget, candidate.props, false, context).find(
        (field) => field.id === candidate.fieldId,
      ) ?? null,
    [candidate.fieldId, candidate.props, candidate.widget, context],
  );
  const renderCanvasVisible = Boolean(visibleField?.renderCanvas);

  useEffect(() => {
    onVisibilityChange(candidate.itemId, renderCanvasVisible);
  }, [candidate.itemId, onVisibilityChange, renderCanvasVisible]);

  if (!renderCanvasVisible || !visibleField?.renderCanvas) {
    return null;
  }

  const CanvasRenderer = visibleField.renderCanvas;
  const fieldState = resolveWidgetFieldState(
    candidate.presentation,
    visibleField,
    candidate.fieldIndex,
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border border-border/70 bg-background/18 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur-md">
      <div className="flex min-h-7 items-center border-b border-border/70 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <span className="truncate">{candidate.title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <CanvasRenderer
          field={visibleField}
          widget={candidate.widget}
          props={candidate.props}
          onPropsChange={onPropsChange}
          fieldState={fieldState}
          runtimeState={candidate.runtimeState}
          onRuntimeStateChange={onRuntimeStateChange}
          editable={false}
          context={context}
        />
      </div>
    </div>
  );
}

export function DashboardCanvas({
  dashboard,
  publicView = false,
}: {
  dashboard: DashboardDefinition;
  publicView?: boolean;
}) {
  const permissions = useAuthStore((state) => state.session?.user.permissions) ?? EMPTY_PERMISSIONS;
  return (
    <DashboardCanvasSurface
      dashboard={dashboard}
      publicView={publicView}
      permissions={permissions}
    />
  );
}

export function PublicDashboardCanvas({
  dashboard,
  publicWorkspaceToken,
}: {
  dashboard: DashboardDefinition;
  publicWorkspaceToken?: string;
}) {
  return (
    <DashboardCanvasSurface
      dashboard={dashboard}
      publicView
      publicWorkspaceToken={publicWorkspaceToken}
      permissions={clonePublicWorkspaceRenderPermissions()}
    />
  );
}

function DashboardCanvasSurface({
  dashboard,
  publicView,
  publicWorkspaceToken,
  permissions,
}: {
  dashboard: DashboardDefinition;
  publicView: boolean;
  publicWorkspaceToken?: string;
  permissions: readonly string[];
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const canvasScrollContainerRef = useRef<HTMLElement | null>(null);
  const [widgetOverrides, setWidgetOverrides] = useState<Record<string, WidgetInstanceOverride>>(
    {},
  );
  const [settingsInstanceId, setSettingsInstanceId] = useState<string | null>(null);
  const [companionVisibilityById, setCompanionVisibilityById] = useState<Record<string, boolean>>(
    {},
  );
  const [canvasScrollSync, setCanvasScrollSync] = useState({
    progress: 0,
    canScroll: false,
  });
  const [canvasWidth, setCanvasWidth] = useState<number | null>(null);
  const resolvedDashboard = useMemo(
    () => resolveDashboardLayout(dashboard),
    [dashboard],
  );
  const renderedWidgets = useMemo(
    () =>
      resolvedDashboard.widgets.map((instance) =>
        applyWidgetOverride(instance, widgetOverrides[instance.id]),
      ),
    [resolvedDashboard.widgets, widgetOverrides],
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

        return widget
          ? [
              {
                instance,
                widget,
              },
            ]
          : [];
      }),
    [resolvedRenderedWidgets],
  );
  const missingCanvasWidgets = useMemo(
    () =>
      resolvedRenderedWidgets.filter((instance) => {
        if (resolveWidgetSidebarOnly(instance.presentation) || instance.slidePlacement) {
          return false;
        }

        return getWidgetById(instance.widgetId) == null;
      }),
    [resolvedRenderedWidgets],
  );
  const canvasWidgetEntries = useMemo(
    () =>
      widgetEntries.filter(
        ({ instance }) =>
          !resolveWidgetSidebarOnly(instance.presentation) && !instance.slidePlacement,
      ),
    [widgetEntries],
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
  const layoutKind: DashboardLayoutKind = resolvedDashboard.layoutKind ?? "custom";
  const runtimeRowHeight =
    layoutKind === "auto-grid"
      ? Math.max(1, resolvedDashboard.autoGrid?.rowHeight ?? resolvedDashboard.grid.rowHeight)
      : resolvedDashboard.grid.rowHeight;
  const customGridVisualGap = layoutKind === "custom" ? resolvedDashboard.grid.gap : 0;
  const autoGridFillScreen = layoutKind === "auto-grid" && resolvedDashboard.autoGrid?.fillScreen === true;
  const storedCompanionLayoutById = useMemo(
    () => resolveDashboardCompanionLayoutMap(resolvedDashboard.companions),
    [resolvedDashboard.companions],
  );
  const storedCompanionById = useMemo(
    () => resolveDashboardCompanionMap(resolvedDashboard.companions),
    [resolvedDashboard.companions],
  );
  const companionCandidates = useMemo(
    () =>
      resolveDashboardCanvasCompanionCandidates(
        widgetEntries.filter(({ instance }) => !instance.slidePlacement),
        {
        columns: resolvedDashboard.grid.columns,
        storedCompanionLayoutById,
        storedCompanionById,
      },
      ),
    [resolvedDashboard.grid.columns, storedCompanionById, storedCompanionLayoutById, widgetEntries],
  );
  const visibleCompanionCandidates = useMemo(
    () =>
      companionCandidates.filter((candidate) => companionVisibilityById[candidate.itemId] !== false),
    [companionCandidates, companionVisibilityById],
  );
  const customRuntimeLayout = useMemo(
    () =>
      resolveCustomRuntimeGridLayout(
        [
          ...canvasWidgetEntries.map(({ instance }) => ({
            i: instance.id,
            ...instance.layout,
          })),
          ...missingCanvasWidgets.map((instance) => ({
            i: instance.id,
            ...instance.layout,
          })),
          ...visibleCompanionCandidates.map((candidate) => ({
            i: candidate.itemId,
            ...candidate.layout,
          })),
        ],
        resolvedDashboard.grid.columns,
        canvasWidth,
      ),
    [
      canvasWidgetEntries,
      canvasWidth,
      missingCanvasWidgets,
      resolvedDashboard.grid.columns,
      visibleCompanionCandidates,
    ],
  );
  const customRuntimeLayoutById = useMemo(
    () =>
      new Map<string, ResolvedDashboardWidgetLayout>(
        customRuntimeLayout.layout.map((item) => [
          item.i,
          {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          } satisfies ResolvedDashboardWidgetLayout,
        ]),
      ),
    [customRuntimeLayout.layout],
  );
  const canvasMinHeight = useMemo(
    () => layoutKind === "custom"
      ?
      resolveWorkspaceCanvasMinHeight(
        [
          ...canvasWidgetEntries
            .map(({ instance }) => customRuntimeLayoutById.get(instance.id) ?? instance.layout),
          ...missingCanvasWidgets
            .map((instance) => customRuntimeLayoutById.get(instance.id) ?? instance.layout),
          ...visibleCompanionCandidates
            .map((candidate) => customRuntimeLayoutById.get(candidate.itemId) ?? candidate.layout),
        ],
        {
          bottomBufferRows: DEFAULT_WORKSPACE_CANVAS_BOTTOM_BUFFER_ROWS,
          grid: {
            gap: 0,
            rowHeight: runtimeRowHeight,
          },
        },
      )
      : 0,
    [
      canvasWidgetEntries,
      customRuntimeLayoutById,
      layoutKind,
      missingCanvasWidgets,
      resolvedDashboard.grid.gap,
      runtimeRowHeight,
      visibleCompanionCandidates,
    ],
  );
  const autoGridTemplateColumns = useMemo(
    () =>
      resolveAutoGridTemplateColumns({
        maxColumns: resolvedDashboard.autoGrid?.maxColumns,
        minColumnWidthPx: resolvedDashboard.autoGrid?.minColumnWidthPx,
        gap: resolvedDashboard.grid.gap,
      }),
    [
      resolvedDashboard.autoGrid?.maxColumns,
      resolvedDashboard.autoGrid?.minColumnWidthPx,
      resolvedDashboard.grid.gap,
    ],
  );
  const visibleCompanionsByInstanceId = useMemo(() => {
    const map = new Map<string, DashboardCanvasCompanionCandidate[]>();

    visibleCompanionCandidates.forEach((candidate) => {
      const current = map.get(candidate.instanceId) ?? [];
      current.push(candidate);
      map.set(candidate.instanceId, current);
    });

    return map;
  }, [visibleCompanionCandidates]);
  const rowChildCountById = useMemo(
    () =>
      new Map(
        resolvedRenderedWidgets
          .filter((instance) => isWorkspaceRowWidgetId(instance.widgetId))
          .map((instance) => [
            instance.id,
            getWorkspaceRowChildCount(resolvedRenderedWidgets, instance.id),
          ] as const),
      ),
    [resolvedRenderedWidgets],
  );
  const autoGridRenderItems = useMemo(
    () =>
      resolvedRenderedWidgets
        .filter(
          (instance) =>
            !resolveWidgetSidebarOnly(instance.presentation) && !instance.slidePlacement,
        )
        .flatMap((instance) => {
          const baseItem =
            getWidgetById(instance.widgetId) == null
              ? [{ kind: "missing" as const, instance }]
              : [{ kind: "widget" as const, instance, widget: getWidgetById(instance.widgetId)! }];
          const companionItems = (visibleCompanionsByInstanceId.get(instance.id) ?? []).map((candidate) => ({
            kind: "companion" as const,
            candidate,
          }));

          return [...baseItem, ...companionItems];
        }),
    [resolvedRenderedWidgets, visibleCompanionsByInstanceId],
  );
  const settingsInstance = useMemo(
    () => resolvedRenderedWidgets.find((instance) => instance.id === settingsInstanceId) ?? null,
    [resolvedRenderedWidgets, settingsInstanceId],
  );
  const settingsWidget = settingsInstance ? getWidgetById(settingsInstance.widgetId) : null;
  const railWidgets = useMemo(
    () =>
      resolvedDashboard.widgets.flatMap((instance) => {
        const widget = getWidgetById(instance.widgetId);
        const required = [
          ...(widget?.requiredPermissions ?? []),
          ...(instance.requiredPermissions ?? []),
        ];

        return widget &&
          !isManagedDashboardWidgetHiddenFromNormalRail(instance) &&
          (publicView || hasAllPermissions(permissions, required))
          ? [
              {
                id: instance.id,
                title: instance.title,
                layout: instance.layout,
                props: instance.props,
                presentation: instance.presentation,
                runtimeState: instance.runtimeState,
                widget,
              },
            ]
          : [];
      }),
    [permissions, publicView, resolvedDashboard.widgets],
  );
  const setWidgetRuntimeStateOverride = useCallback(
    (instanceId: string, runtimeState: Record<string, unknown> | undefined) => {
      setWidgetOverrides((current) => {
        const nextRuntimeState = runtimeState ?? null;
        const currentEntry = current[instanceId];

        if (jsonValueEquals(currentEntry?.runtimeState ?? null, nextRuntimeState)) {
          return current;
        }

        return {
          ...current,
          [instanceId]: {
            ...currentEntry,
            runtimeState: nextRuntimeState,
          },
        };
      });
    },
    [],
  );
  const handleRuntimeStateChange = useCallback(
    (instanceId: string, runtimeState: Record<string, unknown> | undefined) => {
      if (publicView) {
        return;
      }

      setWidgetRuntimeStateOverride(instanceId, runtimeState);
    },
    [publicView, setWidgetRuntimeStateOverride],
  );
  const handleCompanionVisibilityChange = useCallback((itemId: string, visible: boolean) => {
    setCompanionVisibilityById((current) => {
      if (current[itemId] === visible) {
        return current;
      }

      return {
        ...current,
        [itemId]: visible,
      };
    });
  }, []);
  const handleCanvasScrollProgressChange = useCallback((nextProgress: number) => {
    const scrollElement = canvasScrollContainerRef.current;

    if (!scrollElement) {
      return;
    }

    const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
    const clampedProgress = Math.min(1, Math.max(0, nextProgress));
    scrollElement.scrollTop = maxScrollTop * clampedProgress;
  }, []);

  useLayoutEffect(() => {
    const scrollElement = publicView
      ? (document.scrollingElement as HTMLElement | null)
      : null;

    canvasScrollContainerRef.current = scrollElement;

    if (!scrollElement || typeof window === "undefined") {
      setCanvasScrollSync({
        progress: 0,
        canScroll: false,
      });
      return undefined;
    }

    const element = scrollElement;
    let frameId = 0;

    function updateScrollSync() {
      const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
      const nextCanScroll = maxScrollTop > 0;
      const nextProgress = nextCanScroll ? element.scrollTop / maxScrollTop : 0;

      setCanvasScrollSync((current) => {
        if (
          current.canScroll === nextCanScroll &&
          Math.abs(current.progress - nextProgress) < 0.001
        ) {
          return current;
        }

        return {
          progress: nextProgress,
          canScroll: nextCanScroll,
        };
      });
    }

    function scheduleUpdate() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateScrollSync);
    }

    scheduleUpdate();

    const resizeObserver = new ResizeObserver(() => {
      scheduleUpdate();
    });

    resizeObserver.observe(element);
    Array.from(element.children).forEach((child) => {
      resizeObserver.observe(child);
    });
    element.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      element.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [
    publicView,
    canvasMinHeight,
    layoutKind,
    resolvedDashboard?.widgets.length,
    visibleCompanionCandidates.length,
    settingsInstanceId,
  ]);

  useEffect(() => {
    setWidgetOverrides({});
    setSettingsInstanceId(null);
    setCompanionVisibilityById({});
  }, [dashboard.id]);

  useEffect(() => {
    if (
      settingsInstanceId &&
      !resolvedRenderedWidgets.some((instance) => instance.id === settingsInstanceId)
    ) {
      setSettingsInstanceId(null);
    }
  }, [resolvedRenderedWidgets, settingsInstanceId]);

  useEffect(() => {
    if (!canvasRef.current) {
      setCanvasWidth(null);
      return undefined;
    }

    const element = canvasRef.current;

    function updateCanvasWidth() {
      const nextWidth = element.getBoundingClientRect().width;
      setCanvasWidth(nextWidth > 0 ? nextWidth : null);
    }

    updateCanvasWidth();

    const observer = new ResizeObserver(() => {
      updateCanvasWidth();
    });

    observer.observe(element);
    window.addEventListener("resize", updateCanvasWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateCanvasWidth);
    };
  }, []);

  function renderCanvasWidgetCard(
    instance: ResolvedDashboardWidgetInstance,
    widget: NonNullable<ReturnType<typeof getWidgetById>>,
  ): ReactNode {
    const required = [
      ...(widget.requiredPermissions ?? []),
      ...(instance.requiredPermissions ?? []),
    ];

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

    if (widget.id === WORKSPACE_SLIDE_WIDGET_ID) {
      const slide = sanitizeWorkspaceSlideProps(instance.props ?? {});
      const slideRegions = slidePlacedWidgetEntriesByRegion.get(instance.id);
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
              content: renderCanvasWidgetCard(entry.instance, entry.widget),
            }))}
            editable={false}
          />
        ) : undefined;

      return (
        <WorkspaceCanvasWidgetCard
          instanceId={instance.id}
          instanceTitle={instance.title}
          selected={false}
          editable={false}
          shellVariant="transparent"
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
                  handleRuntimeStateChange(instance.id, state);
                }}
              />
            ) : undefined
          }
          customContent={
            <WorkspaceSlideSurface
              slide={slide}
              editable={false}
              regionContent={bodyContent ? { body: bodyContent } : undefined}
            />
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
            handleRuntimeStateChange(instanceId, runtimeState);
          }}
          onSelect={() => {}}
          onOpenBindings={() => {}}
          onOpenSettings={(instanceId) => {
            setSettingsInstanceId(instanceId);
          }}
        />
      );
    }

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
                handleRuntimeStateChange(instance.id, state);
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
          handleRuntimeStateChange(instanceId, runtimeState);
        }}
        onSelect={() => {}}
        onOpenBindings={() => {}}
        onOpenSettings={(instanceId) => {
          setSettingsInstanceId(instanceId);
        }}
        rowCollapsed={isWorkspaceRowCollapsed(instance)}
        rowChildCount={rowChildCountById.get(instance.id) ?? 0}
      />
    );
  }

  return (
    <DashboardControlsProvider key={dashboard.id} controls={dashboard.controls}>
      <DashboardWidgetRegistryProvider widgets={renderedWidgets}>
        <DashboardWidgetExecutionProvider
          executionSurface={publicView ? "public-workspace" : "private-dashboard"}
          publicWorkspaceToken={publicView ? publicWorkspaceToken : undefined}
          scopeId={dashboard.id}
          widgets={renderedWidgets}
          writeRuntimeState={(instanceId, runtimeState) => {
            handleRuntimeStateChange(instanceId, runtimeState);
          }}
        >
          <DashboardWidgetDependenciesProvider widgets={renderedWidgets}>
            <div ref={canvasRef} className="relative">
              {publicView ? <PublicWorkspaceStatusBar /> : <DashboardRefreshProgressLine />}
              {publicView ? (
                <WorkspaceWidgetRail
                  widgets={railWidgets}
                  activeInstanceId={null}
                  topOffsetClassName="top-12"
                  interactive={false}
                  viewportPinned
                  scrollSync={canvasScrollSync.canScroll ? {
                    progress: canvasScrollSync.progress,
                    canScroll: canvasScrollSync.canScroll,
                    onProgressChange: handleCanvasScrollProgressChange,
                  } : undefined}
                  onOpenWidget={() => {}}
                />
              ) : null}
              <div className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0">
            {sidebarOnlyWidgetEntries.map(({ instance, widget }) => {
              const required = [
                ...(widget.requiredPermissions ?? []),
                ...(instance.requiredPermissions ?? []),
              ];

              if (!hasAllPermissions(permissions, required)) {
                return null;
              }

              return (
                <HiddenSidebarRuntimeWidgetMount
                  key={instance.id}
                  instance={instance}
                  widget={widget}
                  onRuntimeStateChange={(state) => {
                    handleRuntimeStateChange(instance.id, state);
                  }}
                />
              );
            })}
              </div>
          {settingsInstance && settingsWidget ? (
            <div className="h-full overflow-y-auto pr-1 pb-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <Button variant="outline" onClick={() => setSettingsInstanceId(null)}>
                    <ArrowLeft className="h-4 w-4" />
                    Return to dashboard
                  </Button>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{settingsWidget.kind}</Badge>
                      <Badge variant="neutral">{settingsWidget.source}</Badge>
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                        {settingsInstance.title?.trim() || "Untitled card"}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Widget ID
                        </span>
                        <Badge variant="neutral" className="font-mono text-[11px]">
                          {settingsInstance.id}
                        </Badge>
                      </div>
                      <p className="max-w-3xl text-sm text-muted-foreground">
                        Adjust this widget instance in a dedicated settings view instead of a modal.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <WidgetSettingsPanel
                widget={settingsWidget}
                instance={settingsInstance}
                panelDescription={
                  settingsInstance.slidePlacement
                    ? "Adjust the card title, schema fields, and advanced widget props for this slide-contained widget. Slide region membership is managed by the workspace slide layout."
                    : "Adjust the card title, shared presentation, schema fields, and advanced widget props for this dashboard instance."
                }
                persistenceNote="Edits update this page immediately and are lost when you refresh or leave the page."
                showPlacementField={!settingsInstance.slidePlacement}
                secondaryActionLabel="Return to dashboard"
                onClose={() => {
                  setSettingsInstanceId(null);
                }}
                onSave={({ title, props, bindings, presentation }) => {
                  setWidgetOverrides((current) => ({
                    ...current,
                    [settingsInstance.id]: {
                      bindings,
                      title: title ?? null,
                      props,
                      presentation: presentation ?? null,
                    },
                  }));
                }}
              />
            </div>
          ) : (
            <div className={publicView ? "space-y-3 pl-12" : "space-y-3"}>
              {!publicView ? <DashboardDataControls controls={dashboard.controls} /> : null}
              {layoutKind === "auto-grid" ? (
                <div
                  className="grid"
                  style={{
                    gap: `${resolvedDashboard.grid.gap}px`,
                    gridAutoRows: `${runtimeRowHeight}px`,
                    gridTemplateColumns: autoGridTemplateColumns,
                    minHeight: autoGridFillScreen ? "calc(100vh - 17rem)" : undefined,
                  }}
                >
                  {autoGridRenderItems.map((item) => {
                    if (item.kind === "companion") {
                      return (
                        <div
                          key={item.candidate.itemId}
                          style={autoGridItemStyle(item.candidate.layout)}
                          className="relative isolate h-full min-w-0 overflow-visible"
                        >
                          <DashboardCanvasCompanionCard
                            candidate={item.candidate}
                            onPropsChange={(props) => {
                              setWidgetOverrides((current) => ({
                                ...current,
                                [item.candidate.instanceId]: {
                                  ...current[item.candidate.instanceId],
                                  props,
                                },
                              }));
                            }}
                            onRuntimeStateChange={(state) => {
                              handleRuntimeStateChange(item.candidate.instanceId, state);
                            }}
                            onVisibilityChange={handleCompanionVisibilityChange}
                          />
                        </div>
                      );
                    }

                    if (item.kind === "missing") {
                      return (
                        <MissingWidgetFrame
                          key={item.instance.id}
                          widgetId={item.instance.widgetId}
                          style={autoGridItemStyle(item.instance.layout, {
                            fullWidth:
                              isWorkspaceRowWidgetId(item.instance.widgetId) ||
                              item.instance.widgetId === WORKSPACE_SLIDE_WIDGET_ID,
                          })}
                        />
                      );
                    }

                    const { instance, widget } = item;
                    const style = autoGridItemStyle(instance.layout, {
                      fullWidth:
                        isWorkspaceRowWidgetId(widget.id) ||
                        widget.id === WORKSPACE_SLIDE_WIDGET_ID,
                    });

                    return (
                      <div
                        key={instance.id}
                        style={style}
                        className="relative isolate h-full min-w-0 overflow-visible"
                      >
                        {renderCanvasWidgetCard(instance, widget)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className="grid"
                  style={{
                    gap: "0px",
                    gridAutoRows: `${runtimeRowHeight}px`,
                    gridTemplateColumns: `repeat(${resolvedDashboard.grid.columns}, minmax(0, 1fr))`,
                    minHeight: `${canvasMinHeight}px`,
                  }}
                >
                {canvasWidgetEntries.map(({ instance, widget }) => {
                  const style = layoutToStyle(
                    customRuntimeLayoutById.get(instance.id) ?? instance.layout,
                  );

                  return (
                    <div
                      key={instance.id}
                      style={style}
                      className="relative isolate box-border h-full overflow-visible"
                    >
                      <div
                        className="box-border h-full overflow-visible"
                        style={resolveGridItemInsetStyle(customGridVisualGap)}
                      >
                        {renderCanvasWidgetCard(instance, widget)}
                      </div>
                    </div>
                  );
                })}

                {missingCanvasWidgets.map((instance) => {
                  const style = layoutToStyle(
                    customRuntimeLayoutById.get(instance.id) ?? instance.layout,
                  );

                  return (
                    <div
                      key={instance.id}
                      style={style}
                      className="relative isolate box-border h-full overflow-visible"
                    >
                      <div
                        className="box-border h-full overflow-visible"
                        style={resolveGridItemInsetStyle(customGridVisualGap)}
                      >
                        <MissingWidgetFrame
                          widgetId={instance.widgetId}
                          style={{ height: "100%" }}
                        />
                      </div>
                    </div>
                  );
                })}

                {visibleCompanionCandidates.map((candidate) => {
                  const style = layoutToStyle(
                    customRuntimeLayoutById.get(candidate.itemId) ?? candidate.layout,
                  );

                  return (
                    <div
                      key={candidate.itemId}
                      style={style}
                      className="relative isolate box-border h-full overflow-visible"
                    >
                      <div
                        className="box-border h-full overflow-visible"
                        style={resolveGridItemInsetStyle(customGridVisualGap)}
                      >
                        <DashboardCanvasCompanionCard
                          candidate={candidate}
                          onPropsChange={(props) => {
                            setWidgetOverrides((current) => ({
                              ...current,
                              [candidate.instanceId]: {
                                ...current[candidate.instanceId],
                                props,
                              },
                            }));
                          }}
                          onRuntimeStateChange={(state) => {
                            handleRuntimeStateChange(candidate.instanceId, state);
                          }}
                          onVisibilityChange={handleCompanionVisibilityChange}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          )}
          </div>
          </DashboardWidgetDependenciesProvider>
        </DashboardWidgetExecutionProvider>
      </DashboardWidgetRegistryProvider>
    </DashboardControlsProvider>
  );
}
