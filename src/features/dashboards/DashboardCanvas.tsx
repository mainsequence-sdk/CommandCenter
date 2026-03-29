import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ComponentType } from "react";

import { ArrowLeft } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { hasAllPermissions } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  resolveDashboardCanvasCompanionCandidates,
  type DashboardCanvasCompanionCandidate,
  type ResolvedDashboardWidgetEntry,
} from "@/dashboards/canvas-items";
import {
  DashboardControlsProvider,
  DashboardDataControls,
  DashboardRefreshProgressLine,
} from "@/dashboards/DashboardControls";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import { resolveDashboardLayout } from "@/dashboards/layout";
import {
  resolveResponsiveCanvasLayout,
  resolveWidgetResponsiveMinWidthPx,
} from "@/dashboards/responsive-layout";
import { isWorkspaceRowWidgetId } from "@/dashboards/structural-widgets";
import type {
  DashboardDefinition,
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
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [companionVisibilityById, setCompanionVisibilityById] = useState<Record<string, boolean>>(
    {},
  );
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
  const companionCandidates = useMemo(
    () =>
      resolveDashboardCanvasCompanionCandidates(widgetEntries, {
        columns: resolvedDashboard.grid.columns,
      }),
    [resolvedDashboard.grid.columns, widgetEntries],
  );
  const visibleCompanionCandidates = useMemo(
    () =>
      companionCandidates.filter((candidate) => companionVisibilityById[candidate.itemId] !== false),
    [companionCandidates, companionVisibilityById],
  );
  const responsiveCanvasLayout = useMemo(
    () =>
      resolveResponsiveCanvasLayout(
        [
          ...canvasWidgetEntries.map(({ instance, widget }) => ({
            id: instance.id,
            widgetId: widget.id,
            layout: instance.layout,
            minWidthPx: resolveWidgetResponsiveMinWidthPx(widget),
          })),
          ...missingCanvasWidgets.map((instance) => ({
            id: instance.id,
            widgetId: instance.widgetId,
            layout: instance.layout,
            minWidthPx: 220,
          })),
          ...visibleCompanionCandidates.map((candidate) => ({
            id: candidate.itemId,
            layout: candidate.layout,
            minWidthPx: candidate.minWidthPx,
          })),
        ],
        {
          availableWidth: canvasWidth,
          canonicalColumns: resolvedDashboard.grid.columns,
          gap: resolvedDashboard.grid.gap,
        },
      ),
    [
      canvasWidth,
      canvasWidgetEntries,
      missingCanvasWidgets,
      resolvedDashboard.grid.columns,
      resolvedDashboard.grid.gap,
      visibleCompanionCandidates,
    ],
  );
  const canvasMinHeight = useMemo(
    () =>
      resolveCanvasMinHeight(
        [
          ...canvasWidgetEntries
            .map(({ instance }) => responsiveCanvasLayout.layoutById.get(instance.id) ?? instance.layout),
          ...missingCanvasWidgets
            .map((instance) => responsiveCanvasLayout.layoutById.get(instance.id) ?? instance.layout),
          ...visibleCompanionCandidates
            .map((candidate) => responsiveCanvasLayout.layoutById.get(candidate.itemId) ?? candidate.layout),
        ],
        resolvedDashboard.grid,
      ),
    [
      canvasWidgetEntries,
      missingCanvasWidgets,
      responsiveCanvasLayout.layoutById,
      resolvedDashboard.grid,
      visibleCompanionCandidates,
    ],
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
      setCanvasWidth(0);
      return undefined;
    }

    const element = canvasRef.current;

    function updateWidth() {
      setCanvasWidth(element.getBoundingClientRect().width);
    }

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);
    window.addEventListener("resize", updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [settingsInstanceId]);

  return (
    <DashboardControlsProvider key={dashboard.id} controls={dashboard.controls}>
      <DashboardWidgetRegistryProvider widgets={renderedWidgets}>
        <div className="relative">
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
                persistenceNote="Changes apply only to the current page session."
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
              <div
                ref={canvasRef}
                className="grid"
                style={{
                  gap: `${resolvedDashboard.grid.gap}px`,
                  gridAutoRows: `${resolvedDashboard.grid.rowHeight}px`,
                  gridTemplateColumns: `repeat(${responsiveCanvasLayout.columns}, minmax(0, 1fr))`,
                  minHeight: `${canvasMinHeight}px`,
                }}
              >
                {canvasWidgetEntries.map(({ instance, widget }) => {
                  const style = layoutToStyle(
                    responsiveCanvasLayout.layoutById.get(instance.id) ?? instance.layout,
                  );
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
                      className="relative isolate h-full overflow-visible"
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

                {missingCanvasWidgets.map((instance) => {
                  const style = layoutToStyle(
                    responsiveCanvasLayout.layoutById.get(instance.id) ?? instance.layout,
                  );

                  return (
                    <MissingWidgetFrame
                      key={instance.id}
                      widgetId={instance.widgetId}
                      style={style}
                    />
                  );
                })}

                {visibleCompanionCandidates.map((candidate) => {
                  const style = layoutToStyle(
                    responsiveCanvasLayout.layoutById.get(candidate.itemId) ?? candidate.layout,
                  );

                  return (
                    <div
                      key={candidate.itemId}
                      style={style}
                      className="relative isolate h-full overflow-visible"
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
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DashboardWidgetRegistryProvider>
    </DashboardControlsProvider>
  );
}
