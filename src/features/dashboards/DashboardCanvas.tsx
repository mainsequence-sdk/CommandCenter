import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ComponentType } from "react";

import { ArrowLeft } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { hasAllPermissions } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DashboardControlsProvider,
  DashboardDataControls,
  DashboardRefreshProgressLine,
} from "@/dashboards/DashboardControls";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import { resolveDashboardLayout } from "@/dashboards/layout";
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
import { WidgetCanvasControls } from "@/widgets/shared/widget-canvas-controls";
import {
  resolveWidgetHeaderVisibility,
  resolveWidgetSidebarOnly,
} from "@/widgets/shared/chrome";
import { WidgetSettingsPanel } from "@/widgets/shared/widget-settings";
import { resolveWidgetInstancePresentation } from "@/widgets/shared/widget-schema";
import type { WidgetInstancePresentation } from "@/widgets/types";
import type { WidgetHeaderActionsProps } from "@/widgets/types";

function layoutToStyle(layout: ResolvedDashboardWidgetLayout): CSSProperties {
  return {
    gridColumn: `${layout.x + 1} / span ${layout.w}`,
    gridRow: `${layout.y + 1} / span ${layout.h}`,
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

export function DashboardCanvas({ dashboard }: { dashboard: DashboardDefinition }) {
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const [widgetOverrides, setWidgetOverrides] = useState<Record<string, WidgetInstanceOverride>>(
    {},
  );
  const [settingsInstanceId, setSettingsInstanceId] = useState<string | null>(null);
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
  const canvasWidgets = useMemo(
    () => resolvedRenderedWidgets.filter((instance) => !resolveWidgetSidebarOnly(instance.presentation)),
    [resolvedRenderedWidgets],
  );
  const sidebarOnlyWidgets = useMemo(
    () => resolvedRenderedWidgets.filter((instance) => resolveWidgetSidebarOnly(instance.presentation)),
    [resolvedRenderedWidgets],
  );
  const settingsInstance = useMemo(
    () => resolvedRenderedWidgets.find((instance) => instance.id === settingsInstanceId) ?? null,
    [resolvedRenderedWidgets, settingsInstanceId],
  );
  const settingsWidget = settingsInstance ? getWidgetById(settingsInstance.widgetId) : null;

  useEffect(() => {
    setWidgetOverrides({});
    setSettingsInstanceId(null);
  }, [dashboard.id]);

  useEffect(() => {
    if (
      settingsInstanceId &&
      !resolvedRenderedWidgets.some((instance) => instance.id === settingsInstanceId)
    ) {
      setSettingsInstanceId(null);
    }
  }, [resolvedRenderedWidgets, settingsInstanceId]);

  return (
    <DashboardControlsProvider key={dashboard.id} controls={dashboard.controls}>
      <DashboardWidgetRegistryProvider widgets={renderedWidgets}>
        <div className="relative">
          <DashboardRefreshProgressLine />
          <div className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0">
            {sidebarOnlyWidgets.map((instance) => {
              const widget = getWidgetById(instance.widgetId);

              if (!widget) {
                return null;
              }

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
                className="grid"
                style={{
                  gap: `${resolvedDashboard.grid.gap}px`,
                  gridAutoRows: `${resolvedDashboard.grid.rowHeight}px`,
                  gridTemplateColumns: `repeat(${resolvedDashboard.grid.columns}, minmax(0, 1fr))`,
                }}
              >
                {canvasWidgets.map((instance) => {
                  const widget = getWidgetById(instance.widgetId);
                  const style = layoutToStyle(instance.layout);

                  if (!widget) {
                    return (
                      <MissingWidgetFrame
                        key={instance.id}
                        widgetId={instance.widgetId}
                        style={style}
                      />
                    );
                  }

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
                      <WidgetCanvasControls
                        widget={widget}
                        props={(instance.props ?? {}) as Record<string, unknown>}
                        presentation={instance.presentation}
                        runtimeState={instance.runtimeState}
                        onPropsChange={(props) => {
                          setWidgetOverrides((current) => ({
                            ...current,
                            [instance.id]: {
                              ...current[instance.id],
                              props,
                            },
                          }));
                        }}
                        onRuntimeStateChange={(state) => {
                          setWidgetOverrides((current) => ({
                            ...current,
                            [instance.id]: {
                              ...current[instance.id],
                              runtimeState: state ?? null,
                            },
                          }));
                        }}
                        onPresentationChange={(nextPresentation) => {
                          setWidgetOverrides((current) => ({
                            ...current,
                            [instance.id]: {
                              ...current[instance.id],
                              presentation: nextPresentation,
                            },
                          }));
                        }}
                      />
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

                {sidebarOnlyWidgets.map((instance) => {
                  const widget = getWidgetById(instance.widgetId);

                  if (!widget) {
                    return null;
                  }

                  const required = [
                    ...(widget.requiredPermissions ?? []),
                    ...(instance.requiredPermissions ?? []),
                  ];

                  if (!hasAllPermissions(permissions, required)) {
                    return null;
                  }

                return (
                  <WidgetCanvasControls
                    key={instance.id}
                    widget={widget}
                    props={(instance.props ?? {}) as Record<string, unknown>}
                    presentation={instance.presentation}
                    runtimeState={instance.runtimeState}
                    onPropsChange={(props) => {
                      setWidgetOverrides((current) => ({
                        ...current,
                        [instance.id]: {
                          ...current[instance.id],
                          props,
                        },
                      }));
                    }}
                    onRuntimeStateChange={(state) => {
                      setWidgetOverrides((current) => ({
                        ...current,
                        [instance.id]: {
                          ...current[instance.id],
                          runtimeState: state ?? null,
                        },
                      }));
                    }}
                    onPresentationChange={(nextPresentation) => {
                      setWidgetOverrides((current) => ({
                        ...current,
                        [instance.id]: {
                          ...current[instance.id],
                          presentation: nextPresentation,
                        },
                      }));
                    }}
                    containerStyle={layoutToStyle(instance.layout)}
                    containerClassName="relative isolate h-full overflow-visible"
                  />
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
