import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowLeft, BookOpenText, Database, PlugZap, Save } from "lucide-react";
import { Link } from "react-router-dom";

import { getWidgetById } from "@/app/registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardControlsProvider } from "@/dashboards/DashboardControls";
import { DashboardWidgetDependenciesProvider } from "@/dashboards/DashboardWidgetDependencies";
import { DashboardWidgetExecutionProvider } from "@/dashboards/DashboardWidgetExecution";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import { WidgetBindingPanel } from "@/widgets/shared/WidgetBindingPanel";
import { getWidgetDetailsPath } from "@/features/widgets/widget-explorer";
import { resolveWidgetInstancePresentation } from "@/widgets/shared/widget-schema";
import { resolveManagedConnectionQuerySource } from "@/connections/managedConnectionQuerySource";
import {
  applyManagedConnectionConsumerDraftProps,
  buildManagedConnectionConsumerDraftSignature,
  isManagedConnectionConsumerMode,
  resolveManagedConnectionConsumerDetachedSourceMode,
} from "@/widgets/shared/managed-connection-consumer";
import { getManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer-registry";
import {
  resolveManagedConnectionConsumerInputId,
  resolveManagedConnectionConsumerOutputId,
  resolveManagedConnectionConsumerSourceWidgetId,
} from "@/widgets/shared/managed-connection-consumer";
import { fetchAppComponentOpenApiDocument } from "@/widgets/core/app-component/appComponentApi";
import {
  buildAppComponentBindingSpec,
  buildAppComponentGeneratedForm,
  hasAppComponentDiscoveryTarget,
  normalizeAppComponentBindingSpec,
  normalizeAppComponentProps,
  resolveAppComponentOperation,
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
import { WorkspaceSavingStatus } from "./WorkspaceChrome";
import { ManagedConnectionConsumerPanel } from "@/widgets/shared/ManagedConnectionConsumerPanel";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import type { ResolvedWidgetInputs } from "@/widgets/types";

type WidgetSettingsTabId = "settings" | "bindings" | "connection";

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

function shouldRepairAppComponentBindingSpec(props: AppComponentWidgetProps) {
  const bindingSpec = props.bindingSpec;

  return Boolean(
    !bindingSpec ||
      bindingSpec.responsePorts.length === 0 ||
      bindingSpec.responsePorts.some(
        (port) =>
          !port.valueDescriptor ||
          port.valueDescriptor.kind === "unknown" ||
          port.valueDescriptor.contract !== port.contract,
      ),
  );
}

export function CustomWidgetSettingsPage({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const {
    user,
    isSaving,
    persistenceMode,
    requestedWidgetId,
    requestedWidgetSettingsTab,
    selectedDashboard,
    selectedWorkspaceDirty,
    resolvedDashboard,
    saveWorkspaceDraft,
    openDashboardView,
    updateSelectedWorkspace,
    updateSelectedWorkspaceUserState,
    commitSelectedWorkspaceControlsState,
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
  const [draftState, setDraftState] = useState(() =>
    instance && widget ? buildWidgetSettingsDraftState(instance, widget) : null,
  );
  const effectiveDraftState =
    instance && widget ? draftState ?? buildWidgetSettingsDraftState(instance, widget) : null;
  const managedConnectionAdapter = widget
    ? getManagedConnectionConsumerAdapter(widget.id)
    : null;
  const managedConnectionDraftProps = managedConnectionAdapter
    ? ((effectiveDraftState?.props ?? {}) as Record<string, unknown>)
    : undefined;
  const managedConnectionSource =
    instance && managedConnectionAdapter
      ? resolveManagedConnectionQuerySource(resolvedDashboard.widgets, instance.id)
      : null;
  const managedConnectionMode = Boolean(
    managedConnectionAdapter &&
      managedConnectionDraftProps &&
      isManagedConnectionConsumerMode(
        managedConnectionAdapter,
        managedConnectionAdapter.getSourceMode(managedConnectionDraftProps),
      ),
  );
  const hasManagedConnectionTab = Boolean(
    managedConnectionAdapter &&
      (managedConnectionMode || managedConnectionSource),
  );
  const requestedTab: WidgetSettingsTabId =
    hasManagedConnectionTab && requestedWidgetSettingsTab === "connection"
      ? "connection"
      : hasBindingTab && requestedWidgetSettingsTab === "bindings"
        ? "bindings"
        : "settings";
  const [activeTab, setActiveTab] = useState<WidgetSettingsTabId>(requestedTab);
  const repairedAppComponentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [instance?.id, requestedTab]);

  useEffect(() => {
    if (activeTab === "connection" && !hasManagedConnectionTab) {
      setActiveTab(hasBindingTab ? "bindings" : "settings");
    }
  }, [activeTab, hasBindingTab, hasManagedConnectionTab]);

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
        hasAppComponentDiscoveryTarget(normalizedProps) &&
          normalizedProps.method &&
          normalizedProps.path &&
          shouldRepairAppComponentBindingSpec(normalizedProps),
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

          if (!hasAppComponentDiscoveryTarget(normalizedProps) || !normalizedProps.method || !normalizedProps.path) {
            return null;
          }

          try {
            const document = await fetchAppComponentOpenApiDocument({
              props: normalizedProps,
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
  const currentManagedConnectionSignature = buildManagedConnectionConsumerDraftSignature(
    managedConnectionAdapter,
    (instance?.props ?? {}) as Record<string, unknown>,
  );
  const draftManagedConnectionSignature = buildManagedConnectionConsumerDraftSignature(
    managedConnectionAdapter,
    managedConnectionDraftProps,
  );
  const [managedConnectionPreviewRuntimeState, setManagedConnectionPreviewRuntimeState] = useState<
    Record<string, unknown> | undefined
  >(undefined);
  const managedConnectionPreviewResolvedInputs = useMemo<ResolvedWidgetInputs | undefined>(() => {
    if (
      !instance ||
      !managedConnectionAdapter ||
      !managedConnectionMode ||
      !managedConnectionPreviewRuntimeState
    ) {
      return undefined;
    }

    const sourceInputId = resolveManagedConnectionConsumerInputId(
      managedConnectionAdapter,
      managedConnectionDraftProps,
    );
    const sourceOutputId = resolveManagedConnectionConsumerOutputId(
      managedConnectionAdapter,
      managedConnectionDraftProps,
    );
    const sourceWidgetId = resolveManagedConnectionConsumerSourceWidgetId(
      managedConnectionAdapter,
      managedConnectionDraftProps,
    );
    const previewSourceInstanceId =
      managedConnectionSource?.widgetId === sourceWidgetId
        ? managedConnectionSource.id
        : `${instance.id}:managed-source-preview`;

    return {
      [sourceInputId]: {
        inputId: sourceInputId,
        label: "Source data",
        status: "valid",
        sourceWidgetId: previewSourceInstanceId,
        sourceOutputId,
        contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        value: managedConnectionPreviewRuntimeState,
        upstreamBase: managedConnectionPreviewRuntimeState,
      },
    } satisfies ResolvedWidgetInputs;
  }, [
    instance,
    managedConnectionAdapter,
    managedConnectionDraftProps,
    managedConnectionMode,
    managedConnectionPreviewRuntimeState,
    managedConnectionSource,
  ]);

  useEffect(() => {
    setManagedConnectionPreviewRuntimeState(undefined);
  }, [draftManagedConnectionSignature, instance?.id]);

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
  const managedConnectionDirty =
    Boolean(managedConnectionAdapter) &&
    draftManagedConnectionSignature !== currentManagedConnectionSignature;

  function updateManagedConnectionDraft(
    updater: (props: Record<string, unknown>) => Record<string, unknown>,
  ) {
    if (!instance || !widget || !managedConnectionAdapter) {
      return;
    }

    setDraftState((current) => {
      const base = current ?? buildWidgetSettingsDraftState(instance, widget);
      const currentProps = (base.props ?? {}) as Record<string, unknown>;
      const nextProps = updater(currentProps);

      return {
        ...base,
        props: nextProps,
      };
    });
  }

  function applyManagedConnectionDraft() {
    if (!instance || !managedConnectionAdapter || !managedConnectionDraftProps) {
      return;
    }

    const nextProps = applyManagedConnectionConsumerDraftProps(
      managedConnectionAdapter,
      (instance.props ?? {}) as Record<string, unknown>,
      managedConnectionDraftProps,
    );

    updateSelectedWorkspace((dashboard) =>
      updateDashboardWidgetSettings(dashboard, instance.id, {
        props: nextProps,
      }),
    );
  }

  function resetManagedConnectionDraft() {
    if (!instance || !widget || !managedConnectionAdapter) {
      return;
    }

    setDraftState((current) => {
      const base = current ?? buildWidgetSettingsDraftState(instance, widget);
      return {
        ...base,
        props: applyManagedConnectionConsumerDraftProps(
          managedConnectionAdapter,
          (base.props ?? {}) as Record<string, unknown>,
          (instance.props ?? {}) as Record<string, unknown>,
        ),
      };
    });

    if (
      !isManagedConnectionConsumerMode(
        managedConnectionAdapter,
        managedConnectionAdapter.getSourceMode(
          (instance.props ?? {}) as Record<string, unknown>,
        ),
      ) &&
      !managedConnectionSource
    ) {
      setActiveTab("bindings");
    }
  }

  function stageManagedConnection() {
    if (!managedConnectionAdapter) {
      return;
    }

    updateManagedConnectionDraft((currentProps) =>
      managedConnectionAdapter.setSourceMode(
        currentProps,
        managedConnectionAdapter.connectionMode,
      ),
    );
    setActiveTab("connection");
  }

  function removeManagedConnection() {
    if (!instance || !widget || !managedConnectionAdapter) {
      return;
    }

    const persistedMode = managedConnectionAdapter.getSourceMode(
      (instance.props ?? {}) as Record<string, unknown>,
    );
    const detachedSourceMode = isManagedConnectionConsumerMode(
      managedConnectionAdapter,
      persistedMode,
    )
      ? resolveManagedConnectionConsumerDetachedSourceMode(
          managedConnectionAdapter,
          (instance.props ?? {}) as Record<string, unknown>,
        )
      : persistedMode;

    if (isManagedConnectionConsumerMode(managedConnectionAdapter, persistedMode) || managedConnectionSource) {
      const nextProps = managedConnectionAdapter.setSourceMode(
        (instance.props ?? {}) as Record<string, unknown>,
        resolveManagedConnectionConsumerDetachedSourceMode(
          managedConnectionAdapter,
          (instance.props ?? {}) as Record<string, unknown>,
        ),
      );

      updateSelectedWorkspace((dashboard) =>
        updateDashboardWidgetSettings(dashboard, instance.id, {
          props: nextProps,
        }),
      );
    }

    updateManagedConnectionDraft((currentProps) =>
      managedConnectionAdapter.setSourceMode(currentProps, detachedSourceMode),
    );
    setActiveTab("bindings");
  }

  const pageContent = (
    <div className="relative h-full overflow-hidden">
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
                    {isSaving ? (
                      <WorkspaceSavingStatus className="bg-card/55" />
                    ) : selectedWorkspaceDirty ? (
                      <Badge variant="warning">Unsaved workspace draft</Badge>
                    ) : (
                      <Badge variant="success">Workspace saved</Badge>
                    )}
                    <Link
                      to={getWidgetDetailsPath(widget.id)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[calc(var(--radius)-4px)] border border-border bg-card/80 px-4 py-2 text-sm font-medium text-card-foreground transition-all hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                    >
                      <BookOpenText className="h-4 w-4" />
                      Widget type details
                    </Link>
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
                    {hasManagedConnectionTab ? (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "connection"}
                        className={getWidgetSettingsTabClassName(activeTab === "connection")}
                        onClick={() => {
                          setActiveTab("connection");
                        }}
                      >
                        Connection
                      </button>
                    ) : null}
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
                      panelDescription={
                        instance.slidePlacement
                          ? "Adjust the display title, schema fields, and advanced widget props for this slide-contained widget. Slide region membership is managed by the workspace slide layout."
                          : "Adjust the display title, shared presentation, schema fields, and advanced widget props for this dashboard instance."
                      }
                      previewResolvedInputsOverride={managedConnectionPreviewResolvedInputs}
                      persistenceNote={
                        backendMode
                          ? "Edits update the current workspace draft immediately. They are not saved until you click Save workspace."
                          : "Edits update the current local workspace draft immediately. They are not saved until you click Save workspace."
                      }
                      showPlacementField={!instance.slidePlacement}
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
                    panelDescription={
                      instance.slidePlacement
                        ? "Adjust the display title, schema fields, and advanced widget props for this slide-contained widget. Slide region membership is managed by the workspace slide layout."
                        : "Adjust the display title, shared presentation, schema fields, and advanced widget props for this dashboard instance."
                    }
                    previewResolvedInputsOverride={managedConnectionPreviewResolvedInputs}
                    persistenceNote={
                      backendMode
                        ? "Edits update the current workspace draft immediately. They are not saved until you click Save workspace."
                        : "Edits update the current local workspace draft immediately. They are not saved until you click Save workspace."
                    }
                    showPlacementField={!instance.slidePlacement}
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
                  managedConnectionAdapter ? (
                    <div className="space-y-6">
                      <section className="overflow-hidden rounded-[calc(var(--radius)+4px)] border border-border/70 bg-card/88 shadow-[var(--shadow-panel)] backdrop-blur">
                        <div className="border-b border-border/70 px-5 py-5 md:px-6 md:py-6">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
                                <Database className="h-5 w-5 text-primary" />
                                Data connection
                              </div>
                              <p className="max-w-3xl text-sm text-muted-foreground">
                                Keep widget presentation in Settings and manage widget-owned source
                                creation from here. A managed connection creates one hidden
                                connection source widget and binds its dataset output to this
                                widget&apos;s <code>{resolveManagedConnectionConsumerInputId(managedConnectionAdapter, managedConnectionDraftProps ?? instance.props)}</code>{" "}
                                input.
                              </p>
                            </div>
                            {managedConnectionMode ? (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setActiveTab("connection");
                                  }}
                                >
                                  <PlugZap className="h-4 w-4" />
                                  Open connection
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={removeManagedConnection}
                                >
                                  Remove connection
                                </Button>
                              </div>
                            ) : (
                              <Button onClick={stageManagedConnection}>
                                <PlugZap className="h-4 w-4" />
                                Add connection
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4 px-5 py-5 md:px-6 md:py-6">
                          {managedConnectionMode ? (
                            <div className="rounded-[calc(var(--radius)-6px)] border border-primary/35 bg-primary/8 px-4 py-4">
                              <div className="text-sm font-medium text-foreground">
                                {managedConnectionSource
                                  ? managedConnectionSource.title
                                  : "Managed connection draft"}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {managedConnectionSource
                                  ? `This ${widget.title.toLowerCase()} now manages its own hidden connection source. Use the Connection tab to edit the full query or stream configuration.`
                                  : "A managed connection has been staged locally. Open the Connection tab and apply those changes to create the hidden source widget."}
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-4 text-sm text-muted-foreground">
                              Use a normal widget-to-widget binding below, or add a managed
                              connection if this widget should own its own hidden source widget.
                            </div>
                          )}
                        </div>
                      </section>

                      {!managedConnectionMode ? (
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
                  ) : (
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
                  )
                ) : null}

                {activeTab === "connection" && hasManagedConnectionTab && managedConnectionAdapter && managedConnectionDraftProps ? (
                  <section className="overflow-hidden rounded-[calc(var(--radius)+4px)] border border-border/70 bg-card/88 shadow-[var(--shadow-panel)] backdrop-blur">
                    <div className="border-b border-border/70 px-5 py-5 md:px-6 md:py-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
                          <PlugZap className="h-5 w-5 text-primary" />
                          {widget.title} connection
                        </div>
                        <p className="max-w-3xl text-sm text-muted-foreground">
                          This tab reuses the same shared connection authoring surface as the
                          standalone Connection Query widget. This {widget.title.toLowerCase()} still renders only from the
                          resolved <code>{resolveManagedConnectionConsumerInputId(managedConnectionAdapter, managedConnectionDraftProps ?? instance.props)}</code> binding.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-6 px-5 py-5 md:px-6 md:py-6">
                      <ManagedConnectionConsumerPanel
                        adapter={managedConnectionAdapter}
                        draftProps={managedConnectionDraftProps}
                        editable
                        instanceId={instance.id}
                        instanceTitle={effectiveDraftState.title || instance.title || widget.title}
                        onPreviewRuntimeStateChange={setManagedConnectionPreviewRuntimeState}
                        previewRuntimeState={managedConnectionPreviewRuntimeState}
                        widgetTitle={widget.title}
                        onDraftPropsChange={(nextManagedConnectionProps) => {
                          updateManagedConnectionDraft(() => nextManagedConnectionProps);
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-5 py-4 md:px-6">
                      <div className="text-sm text-muted-foreground">
                        Connection edits stay local to this page until you apply them.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={!managedConnectionDirty}
                          onClick={resetManagedConnectionDraft}
                        >
                          Reset connection draft
                        </Button>
                        <Button
                          disabled={!managedConnectionDirty}
                          onClick={applyManagedConnectionDraft}
                        >
                          Apply connection changes
                        </Button>
                      </div>
                    </div>
                  </section>
                ) : null}
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="absolute inset-0 z-[70] overflow-hidden bg-background/92 backdrop-blur-xl">
        {pageContent}
      </div>
    );
  }

  return (
    <DashboardControlsProvider
      key={selectedDashboard.id}
      controls={selectedDashboard.controls}
      onStateChange={(state) => {
        updateSelectedWorkspaceUserState((dashboard) =>
          updateDashboardControlsState(dashboard, state),
        );
      }}
      onStateCommit={commitSelectedWorkspaceControlsState}
    >
      <DashboardWidgetRegistryProvider widgets={resolvedDashboard.widgets}>
        <DashboardWidgetExecutionProvider
          activeSurface="dashboard"
          scopeId={selectedDashboard.id}
          widgets={resolvedDashboard.widgets}
          writeRuntimeState={(instanceId, runtimeState) => {
            updateSelectedWorkspaceUserState((dashboard) =>
              updateDashboardWidgetRuntimeState(dashboard, instanceId, runtimeState),
              { bumpRevision: false },
            );
          }}
        >
          <DashboardWidgetDependenciesProvider widgets={resolvedDashboard.widgets}>
            {pageContent}
          </DashboardWidgetDependenciesProvider>
        </DashboardWidgetExecutionProvider>
      </DashboardWidgetRegistryProvider>
    </DashboardControlsProvider>
  );
}
