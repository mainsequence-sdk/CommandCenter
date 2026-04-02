import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";

import { ArrowLeft, Save } from "lucide-react";

import { getWidgetById } from "@/app/registry";
import { hasAllPermissions } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardControlsProvider } from "@/dashboards/DashboardControls";
import { DashboardWidgetDependenciesProvider } from "@/dashboards/DashboardWidgetDependencies";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import { WidgetBindingPanel } from "@/widgets/shared/WidgetBindingPanel";
import { resolveWidgetInstancePresentation } from "@/widgets/shared/widget-schema";
import { fetchAppComponentOpenApiDocument } from "@/widgets/core/app-component/appComponentApi";
import {
  buildAppComponentBindingSpec,
  buildAppComponentGeneratedForm,
  normalizeAppComponentBindingSpec,
  normalizeAppComponentProps,
  resolveAppComponentOperation,
  tryResolveAppComponentBaseUrl,
  type AppComponentWidgetProps,
} from "@/widgets/core/app-component/appComponentModel";
import {
  removeDashboardWidget,
  updateDashboardControlsState,
  updateDashboardWidgetBindings,
  updateDashboardWidgetRuntimeState,
  updateDashboardWidgetSettings,
} from "./custom-dashboard-storage";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import { WidgetSettingsPanel } from "@/widgets/shared/widget-settings";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import type { WidgetInstancePresentation } from "@/widgets/types";

function getWidgetSettingsTabClassName(active: boolean) {
  return active
    ? "inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm"
    : "inline-flex items-center gap-2 rounded-full border border-transparent bg-background/40 px-3 py-2 text-sm font-medium text-muted-foreground hover:border-border/50 hover:text-foreground";
}

function cloneWidgetSettingsValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildWidgetSettingsDraftState(
  instance: DashboardWidgetInstance,
  widget: NonNullable<ReturnType<typeof getWidgetById>>,
) {
  const initialProps = cloneWidgetSettingsValue(
    (instance.props ?? widget.exampleProps ?? {}) as Record<string, unknown>,
  );

  return {
    presentation: resolveWidgetInstancePresentation(widget, instance.presentation),
    props: initialProps,
    title: instance.title ?? "",
  };
}

export function CustomWidgetSettingsPage() {
  const {
    user,
    permissions,
    selectedWorkspaceDirty,
    isSaving,
    persistenceMode,
    requestedWidgetId,
    selectedDashboard,
    resolvedDashboard,
    saveWorkspaceDraft,
    openDashboardView,
    updateSelectedWorkspace,
  } = useCustomWorkspaceStudio();

  if (!user) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        Resolve a user session before opening widget settings.
      </div>
    );
  }

  if (!selectedDashboard || !resolvedDashboard || !requestedWidgetId) {
    return null;
  }

  const instance = selectedDashboard.widgets.find((widget) => widget.id === requestedWidgetId) ?? null;
  const widget = instance ? getWidgetById(instance.widgetId) : null;
  const backendMode = persistenceMode === "backend";
  const resolvedWidgetIo =
    instance && widget
      ? widget.resolveIo?.({
          widgetId: instance.widgetId,
          instanceId: instance.id,
          props: (instance.props ?? {}) as Record<string, unknown>,
          runtimeState: instance.runtimeState,
        }) ?? widget.io
      : undefined;
  const hasBindingTab = Boolean(
    resolvedWidgetIo?.inputs?.length ||
    widget?.io?.inputs?.length ||
    widget?.resolveIo,
  );
  const [activeTab, setActiveTab] = useState<"settings" | "bindings">("settings");
  const [draftState, setDraftState] = useState(() =>
    instance && widget ? buildWidgetSettingsDraftState(instance, widget) : null,
  );
  const repairedAppComponentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setActiveTab("settings");
  }, [instance?.id]);

  useEffect(() => {
    if (!instance || !widget) {
      setDraftState(null);
      return;
    }

    setDraftState(buildWidgetSettingsDraftState(instance, widget));
  }, [instance?.id, widget]);

  useEffect(() => {
    if (activeTab !== "bindings") {
      return;
    }

    const candidates = resolvedDashboard.widgets.filter((dashboardWidget) => {
      if (
        dashboardWidget.widgetId !== "app-component" ||
        repairedAppComponentIdsRef.current.has(dashboardWidget.id)
      ) {
        return false;
      }

      const normalizedProps = normalizeAppComponentProps(
        (dashboardWidget.props ?? {}) as AppComponentWidgetProps,
      );

      return Boolean(
        normalizedProps.apiBaseUrl &&
          normalizedProps.method &&
          normalizedProps.path &&
          !normalizedProps.bindingSpec,
      );
    });

    if (candidates.length === 0) {
      return;
    }

    candidates.forEach((dashboardWidget) => {
      repairedAppComponentIdsRef.current.add(dashboardWidget.id);
    });

    let cancelled = false;

    async function repairMissingBindingSpecs() {
      const nextSpecs = await Promise.all(
        candidates.map(async (dashboardWidget) => {
          const normalizedProps = normalizeAppComponentProps(
            (dashboardWidget.props ?? {}) as AppComponentWidgetProps,
          );
          const resolvedBaseUrl = tryResolveAppComponentBaseUrl(normalizedProps.apiBaseUrl);

          if (!resolvedBaseUrl || !normalizedProps.method || !normalizedProps.path) {
            return null;
          }

          try {
            const document = await fetchAppComponentOpenApiDocument({
              baseUrl: resolvedBaseUrl,
              authMode: normalizedProps.authMode,
            });
            const resolvedOperation = resolveAppComponentOperation(
              document,
              normalizedProps.method,
              normalizedProps.path,
            );
            const generatedForm = buildAppComponentGeneratedForm(
              document,
              resolvedOperation,
              normalizedProps.requestBodyContentType,
            );
            const bindingSpec = normalizeAppComponentBindingSpec(
              buildAppComponentBindingSpec(document, resolvedOperation, generatedForm),
            );

            if (!bindingSpec) {
              return null;
            }

            return {
              id: dashboardWidget.id,
              props: {
                ...(dashboardWidget.props ?? {}),
                bindingSpec,
              },
            };
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      const repairedEntries = nextSpecs.filter((entry) => entry !== null);

      if (repairedEntries.length === 0) {
        return;
      }

      const repairMap = new Map(repairedEntries.map((entry) => [entry.id, entry.props]));

      updateSelectedWorkspace((dashboard) => ({
        ...dashboard,
        widgets: dashboard.widgets.map((dashboardWidget) => {
          const nextProps = repairMap.get(dashboardWidget.id);

          if (!nextProps) {
            return dashboardWidget;
          }

          return {
            ...dashboardWidget,
            props: cloneWidgetSettingsValue(nextProps),
          };
        }),
      }));
    }

    void repairMissingBindingSpecs();

    return () => {
      cancelled = true;
    };
  }, [activeTab, resolvedDashboard.widgets, updateSelectedWorkspace]);

  const effectiveDraftState =
    instance && widget ? draftState ?? buildWidgetSettingsDraftState(instance, widget) : null;
  const bindingPreviewInstance = useMemo(
    () =>
      instance && effectiveDraftState
        ? {
            ...instance,
            title: effectiveDraftState.title.trim() ? effectiveDraftState.title.trim() : undefined,
            props: effectiveDraftState.props,
            presentation: effectiveDraftState.presentation,
          }
        : null,
    [effectiveDraftState, instance],
  );
  const bindingPreviewWidgets = useMemo(
    () =>
      instance && bindingPreviewInstance
        ? resolvedDashboard.widgets.map((dashboardWidget) =>
            dashboardWidget.id === instance.id ? bindingPreviewInstance : dashboardWidget,
          )
        : resolvedDashboard.widgets,
    [bindingPreviewInstance, instance, resolvedDashboard.widgets],
  );

  if (!instance || !widget || !effectiveDraftState) {
    return (
      <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={openDashboardView}>
              <ArrowLeft className="h-4 w-4" />
              Return to dashboard
            </Button>
          </div>
          <div className="rounded-[calc(var(--radius)+4px)] border border-danger/30 bg-danger/8 px-5 py-5 text-sm text-danger shadow-[var(--shadow-panel)]">
            The requested widget instance is no longer available in this workspace.
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardControlsProvider
      key={selectedDashboard.id}
      controls={selectedDashboard.controls}
      onStateChange={(state) => {
        updateSelectedWorkspace((dashboard) => updateDashboardControlsState(dashboard, state));
      }}
    >
      <DashboardWidgetRegistryProvider widgets={resolvedDashboard.widgets}>
        <DashboardWidgetDependenciesProvider widgets={resolvedDashboard.widgets}>
          <div className="relative h-full overflow-hidden">
            <div className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0">
              {resolvedDashboard.widgets.map((mountedInstance) => {
                const mountedWidget = getWidgetById(mountedInstance.widgetId);

                if (!mountedWidget) {
                  return null;
                }

                const required = [
                  ...(mountedWidget.requiredPermissions ?? []),
                  ...(mountedInstance.requiredPermissions ?? []),
                ];

                if (!hasAllPermissions(permissions, required)) {
                  return null;
                }

                const Component = mountedWidget.component as ComponentType<{
                  widget: typeof mountedWidget;
                  instanceId?: string;
                  instanceTitle?: string;
                  props: Record<string, unknown>;
                  presentation?: WidgetInstancePresentation;
                  runtimeState?: Record<string, unknown>;
                  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
                }>;

                return (
                  <div key={mountedInstance.id} className="h-px w-px overflow-hidden">
                    <Component
                      widget={mountedWidget}
                      instanceId={mountedInstance.id}
                      instanceTitle={mountedInstance.title}
                      props={mountedInstance.props ?? {}}
                      presentation={mountedInstance.presentation}
                      runtimeState={mountedInstance.runtimeState}
                      onRuntimeStateChange={(state) => {
                        updateSelectedWorkspace((dashboard) =>
                          updateDashboardWidgetRuntimeState(dashboard, mountedInstance.id, state),
                        );
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="h-full overflow-y-auto px-4 py-4 pb-10 md:px-6 md:py-6">
              <div className="mx-auto max-w-6xl space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <Button variant="outline" onClick={openDashboardView}>
                      <ArrowLeft className="h-4 w-4" />
                      Return to dashboard
                    </Button>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral" className="border border-border/70 bg-card/55">
                          {selectedDashboard.title}
                        </Badge>
                        <Badge variant="neutral">{widget.kind}</Badge>
                        <Badge variant="neutral">{widget.source}</Badge>
                      </div>
                      <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                          {instance.title ?? widget.title}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Widget ID
                          </span>
                          <Badge variant="neutral" className="font-mono text-[11px]">
                            {instance.id}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedWorkspaceDirty ? (
                      <Badge variant="warning">Unsaved workspace draft</Badge>
                    ) : (
                      <Badge variant="success">Workspace saved</Badge>
                    )}
                    <Button
                      onClick={() => void saveWorkspaceDraft()}
                      disabled={isSaving || !selectedWorkspaceDirty}
                    >
                      <Save className="h-4 w-4" />
                      Save workspace
                    </Button>
                  </div>
                </div>

                {hasBindingTab ? (
                  <div
                    className="flex flex-wrap gap-2"
                    role="tablist"
                    aria-label="Widget settings sections"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === "settings"}
                      className={getWidgetSettingsTabClassName(activeTab === "settings")}
                      onClick={() => {
                        setActiveTab("settings");
                      }}
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === "bindings"}
                      className={getWidgetSettingsTabClassName(activeTab === "bindings")}
                      onClick={() => {
                        setActiveTab("bindings");
                      }}
                    >
                      Bindings
                    </button>
                  </div>
                ) : null}

                {hasBindingTab ? (
                  <div className={activeTab === "settings" ? undefined : "hidden"}>
                    <WidgetSettingsPanel
                      widget={widget}
                      instance={instance}
                      draftTitle={effectiveDraftState.title}
                      onDraftTitleChange={(title) => {
                        setDraftState((current) =>
                          current
                            ? {
                                ...current,
                                title,
                              }
                            : {
                                ...buildWidgetSettingsDraftState(instance, widget),
                                title,
                              },
                        );
                      }}
                      draftProps={effectiveDraftState.props}
                      onDraftPropsChange={(props) => {
                        setDraftState((current) =>
                          current
                            ? {
                                ...current,
                                props,
                              }
                            : {
                                ...buildWidgetSettingsDraftState(instance, widget),
                                props,
                              },
                        );
                      }}
                      draftPresentation={effectiveDraftState.presentation}
                      onDraftPresentationChange={(presentation) => {
                        setDraftState((current) =>
                          current
                            ? {
                                ...current,
                                presentation,
                              }
                            : {
                                ...buildWidgetSettingsDraftState(instance, widget),
                                presentation,
                              },
                        );
                      }}
                      panelTitle={`${instance.title ?? widget.title} Settings`}
                      panelDescription="Adjust the display title, shared presentation, schema fields, and advanced widget props for this dashboard instance."
                      persistenceNote={
                        backendMode
                          ? "Edits update the current workspace draft immediately. They are not saved until you click Save workspace."
                          : "Edits update the current local workspace draft immediately. They are not saved until you click Save workspace."
                      }
                      secondaryActionLabel="Return to dashboard"
                      onClose={openDashboardView}
                      onRemove={() => {
                        updateSelectedWorkspace((dashboard) =>
                          removeDashboardWidget(dashboard, instance.id),
                        );
                        openDashboardView();
                      }}
                      onSave={({ title, props, presentation }) => {
                        updateSelectedWorkspace((dashboard) =>
                          updateDashboardWidgetSettings(dashboard, instance.id, {
                            title,
                            props,
                            presentation,
                          }),
                        );
                      }}
                    />
                  </div>
                ) : (
                  <WidgetSettingsPanel
                    widget={widget}
                    instance={instance}
                    panelTitle={`${instance.title ?? widget.title} Settings`}
                    panelDescription="Adjust the display title, shared presentation, schema fields, and advanced widget props for this dashboard instance."
                    persistenceNote={
                      backendMode
                        ? "Edits update the current workspace draft immediately. They are not saved until you click Save workspace."
                        : "Edits update the current local workspace draft immediately. They are not saved until you click Save workspace."
                    }
                    secondaryActionLabel="Return to dashboard"
                    onClose={openDashboardView}
                    onRemove={() => {
                      updateSelectedWorkspace((dashboard) =>
                        removeDashboardWidget(dashboard, instance.id),
                      );
                      openDashboardView();
                    }}
                    onSave={({ title, props, presentation }) => {
                      updateSelectedWorkspace((dashboard) =>
                        updateDashboardWidgetSettings(dashboard, instance.id, {
                          title,
                          props,
                          presentation,
                        }),
                      );
                    }}
                  />
                )}

                {activeTab === "bindings" && hasBindingTab ? (
                  <DashboardWidgetDependenciesProvider widgets={bindingPreviewWidgets}>
                    <WidgetBindingPanel
                      widget={widget}
                      instance={bindingPreviewInstance ?? instance}
                      editable
                      onBindingsChange={(bindings) => {
                        updateSelectedWorkspace((dashboard) =>
                          updateDashboardWidgetBindings(dashboard, instance.id, bindings),
                        );
                      }}
                    />
                  </DashboardWidgetDependenciesProvider>
                ) : null}
              </div>
            </div>
          </div>
        </DashboardWidgetDependenciesProvider>
      </DashboardWidgetRegistryProvider>
    </DashboardControlsProvider>
  );
}
