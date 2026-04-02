import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { isWorkspaceRowWidgetId } from "@/dashboards/structural-widgets";
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
  WidgetFrame,
} from "@/widgets/shared/widget-frame";
import {
  resolveWidgetHeaderVisibility,
  resolveWidgetSidebarOnly,
} from "@/widgets/shared/chrome";
import { WidgetSettingsPanel } from "@/widgets/shared/widget-settings";
import {
  getVisibleWidgetSchemaFields,
  resolveWidgetFieldState,
  resolveWidgetInstancePresentation,
  useResolvedWidgetControllerContext,
} from "@/widgets/shared/widget-schema";
import type { WidgetInstancePresentation } from "@/widgets/types";
import type { WidgetHeaderActionsProps } from "@/widgets/types";

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

function resolveCanvasMinHeight(
  widgets: readonly Pick<ResolvedDashboardWidgetLayout, "h" | "y">[],
  grid: { gap: number; rowHeight: number },
) {
  const maxBottom = widgets.reduce(
    (bottom, widget) => Math.max(bottom, widget.y + widget.h),
    6,
  );

  return maxBottom * grid.rowHeight + Math.max(0, maxBottom - 1) * grid.gap;
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
    title:
      "title" in override
        ? (override.title ?? undefined)
        : instance.title,
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

  useEffect(() => {
    onVisibilityChange(candidate.itemId, Boolean(visibleField?.renderCanvas));
  }, [candidate.itemId, onVisibilityChange, visibleField]);

  if (!visibleField?.renderCanvas) {
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

export function DashboardCanvas({ dashboard }: { dashboard: DashboardDefinition }) {
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [widgetOverrides, setWidgetOverrides] = useState<Record<string, WidgetInstanceOverride>>(
    {},
  );
  const [settingsInstanceId, setSettingsInstanceId] = useState<string | null>(null);
  const [companionVisibilityById, setCompanionVisibilityById] = useState<Record<string, boolean>>(
    {},
  );
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
        if (resolveWidgetSidebarOnly(instance.presentation)) {
          return false;
        }

        return getWidgetById(instance.widgetId) == null;
      }),
    [resolvedRenderedWidgets],
  );
  const canvasWidgetEntries = useMemo(
    () => widgetEntries.filter(({ instance }) => !resolveWidgetSidebarOnly(instance.presentation)),
    [widgetEntries],
  );
  const sidebarOnlyWidgetEntries = useMemo(
    () => widgetEntries.filter(({ instance }) => resolveWidgetSidebarOnly(instance.presentation)),
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
      resolveDashboardCanvasCompanionCandidates(widgetEntries, {
        columns: resolvedDashboard.grid.columns,
        storedCompanionLayoutById,
        storedCompanionById,
      }),
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
      resolveCanvasMinHeight(
        [
          ...canvasWidgetEntries
            .map(({ instance }) => customRuntimeLayoutById.get(instance.id) ?? instance.layout),
          ...missingCanvasWidgets
            .map((instance) => customRuntimeLayoutById.get(instance.id) ?? instance.layout),
          ...visibleCompanionCandidates
            .map((candidate) => customRuntimeLayoutById.get(candidate.itemId) ?? candidate.layout),
        ],
        {
          gap: 0,
          rowHeight: runtimeRowHeight,
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
  const autoGridRenderItems = useMemo(
    () =>
      resolvedRenderedWidgets
        .filter((instance) => !resolveWidgetSidebarOnly(instance.presentation))
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

  return (
    <DashboardControlsProvider key={dashboard.id} controls={dashboard.controls}>
      <DashboardWidgetRegistryProvider widgets={renderedWidgets}>
        <DashboardWidgetExecutionProvider
          scopeId={dashboard.id}
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
            <div ref={canvasRef} className="relative">
              <DashboardRefreshProgressLine />
              <div className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0">
            {sidebarOnlyWidgetEntries.map(({ instance, widget }) => {
              const required = [
                ...(widget.requiredPermissions ?? []),
                ...(instance.requiredPermissions ?? []),
              ];

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
                        {settingsInstance.title ?? settingsWidget.title}
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
                panelTitle={`${settingsInstance.title ?? settingsWidget.title} Settings`}
                panelDescription="Adjust the display title, shared presentation, schema fields, and advanced widget props for this dashboard instance."
                persistenceNote="Edits update this page immediately and are lost when you refresh or leave the page."
                secondaryActionLabel="Return to dashboard"
                onClose={() => {
                  setSettingsInstanceId(null);
                }}
                onSave={({ title, props, presentation }) => {
                  setWidgetOverrides((current) => ({
                    ...current,
                    [settingsInstance.id]: {
                      title: title ?? null,
                      props,
                      presentation: presentation ?? null,
                    },
                  }));
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <DashboardDataControls controls={dashboard.controls} />
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
                              setWidgetOverrides((current) => ({
                                ...current,
                                [item.candidate.instanceId]: {
                                  ...current[item.candidate.instanceId],
                                  runtimeState: state ?? null,
                                },
                              }));
                            }}
                            onVisibilityChange={(itemId, visible) => {
                              setCompanionVisibilityById((current) => {
                                if (current[itemId] === visible) {
                                  return current;
                                }

                                return {
                                  ...current,
                                  [itemId]: visible,
                                };
                              });
                            }}
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
                            fullWidth: isWorkspaceRowWidgetId(item.instance.widgetId),
                          })}
                        />
                      );
                    }

                    const { instance, widget } = item;
                    const style = autoGridItemStyle(instance.layout, {
                      fullWidth: isWorkspaceRowWidgetId(widget.id),
                    });
                    const required = [
                      ...(widget.requiredPermissions ?? []),
                      ...(instance.requiredPermissions ?? []),
                    ];

                    if (!hasAllPermissions(permissions, required)) {
                      return (
                        <LockedWidgetFrame
                          key={instance.id}
                          style={style}
                          title={instance.title ?? widget.title}
                          description={`Missing permissions: ${required.join(", ")}`}
                        />
                      );
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
                    const HeaderActions =
                      widget.headerActions as
                        | ComponentType<WidgetHeaderActionsProps<Record<string, unknown>>>
                        | undefined;

                    return (
                      <div
                        key={instance.id}
                        style={style}
                        className="relative isolate h-full min-w-0 overflow-visible"
                      >
                        <WidgetFrame
                          widget={widget}
                          instance={instance}
                          presentation={instance.presentation}
                          showHeader={
                            isWorkspaceRowWidgetId(widget.id)
                              ? false
                              : resolveWidgetHeaderVisibility(instance.props)
                          }
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
                          onOpenSettings={() => {
                            setSettingsInstanceId(instance.id);
                          }}
                        >
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
                        </WidgetFrame>
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
                  const required = [
                    ...(widget.requiredPermissions ?? []),
                    ...(instance.requiredPermissions ?? []),
                  ];

                  if (!hasAllPermissions(permissions, required)) {
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
                          <LockedWidgetFrame
                            title={instance.title ?? widget.title}
                            description={`Missing permissions: ${required.join(", ")}`}
                            style={{ height: "100%" }}
                          />
                        </div>
                      </div>
                    );
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
                  const HeaderActions =
                    widget.headerActions as
                      | ComponentType<WidgetHeaderActionsProps<Record<string, unknown>>>
                      | undefined;

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
                        <WidgetFrame
                          widget={widget}
                          instance={instance}
                          presentation={instance.presentation}
                          showHeader={
                            isWorkspaceRowWidgetId(widget.id)
                              ? false
                              : resolveWidgetHeaderVisibility(instance.props)
                          }
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
                          onOpenSettings={() => {
                            setSettingsInstanceId(instance.id);
                          }}
                        >
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
                        </WidgetFrame>
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
                            setWidgetOverrides((current) => ({
                              ...current,
                              [candidate.instanceId]: {
                                ...current[candidate.instanceId],
                                runtimeState: state ?? null,
                              },
                            }));
                          }}
                          onVisibilityChange={(itemId, visible) => {
                            setCompanionVisibilityById((current) => {
                              if (current[itemId] === visible) {
                                return current;
                              }

                              return {
                                ...current,
                                [itemId]: visible,
                              };
                            });
                          }}
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
