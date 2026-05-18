import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ArrowLeft, BookOpenText, Database, Loader2, PlugZap, Save } from "lucide-react";
import { Link } from "react-router-dom";

import { getWidgetById } from "@/app/registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardControlsProvider } from "@/dashboards/DashboardControls";
import { DashboardWidgetDependenciesProvider } from "@/dashboards/DashboardWidgetDependencies";
import {
  DashboardWidgetExecutionProvider,
  useDashboardWidgetExecution,
} from "@/dashboards/DashboardWidgetExecution";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import { isWidgetReferenceTargetInputId } from "@/dashboards/widget-instance-references";
import {
  createDashboardWidgetDependencyModel,
  normalizeWidgetInstanceBindings,
} from "@/dashboards/widget-dependencies";
import {
  buildWidgetReferenceLanguageSourceWidgets,
  reconcileWidgetReferenceExpressionBindings,
} from "@/dashboards/widget-reference-language";
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
  duplicateDashboardWidgetWithResult,
  removeDashboardWidget,
  updateDashboardControlsState,
  updateDashboardWidgetBindings,
  updateDashboardWidgetRuntimeState,
  updateDashboardWidgetSettings,
} from "./custom-dashboard-storage";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import { WidgetSettingsPanel } from "@/widgets/shared/widget-settings";
import type { DashboardDefinition, DashboardWidgetInstance } from "@/dashboards/types";
import { WorkspaceSavingStatus } from "./WorkspaceChrome";
import { ManagedConnectionConsumerPanel } from "@/widgets/shared/ManagedConnectionConsumerPanel";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import {
  projectWidgetRuntimeUpdateOutput,
  resolveWidgetRuntimeUpdateParts,
} from "@/widgets/shared/runtime-update";
import type { ResolvedWidgetInputs } from "@/widgets/types";

type WidgetSettingsTabId = "settings" | "bindings" | "connection";

function buildWidgetCommitSourceSignature(
  widgets: DashboardWidgetInstance[],
  changedWidgetId: string,
) {
  const widget = widgets.find((entry) => entry.id === changedWidgetId);

  try {
    return JSON.stringify({
      id: widget?.id ?? null,
      widgetId: widget?.widgetId ?? null,
      title: widget?.title ?? null,
      props: widget?.props ?? null,
      bindings: widget?.bindings ?? null,
      presentation: widget?.presentation ?? null,
      runtimeState: widget?.runtimeState ?? null,
    });
  } catch {
    return `unserializable:${changedWidgetId}`;
  }
}

function VariableDrivenWidgetCommitCoordinator({
  currentWidgets,
  beforeWidgets,
  changedWidgetId,
  children,
  updateSelectedWorkspace,
}: {
  currentWidgets: DashboardWidgetInstance[];
  beforeWidgets: DashboardWidgetInstance[];
  changedWidgetId: string;
  children: (
    commitWidgetSettingsChange: (nextDashboard: DashboardDefinition) => void,
  ) => ReactNode;
  updateSelectedWorkspace: (
    updater: (dashboard: DashboardDefinition) => DashboardDefinition,
  ) => void;
}) {
  const widgetExecution = useDashboardWidgetExecution();
  const [pendingCommit, setPendingCommit] = useState<{
    changedWidgetId: string;
    beforeWidgets: DashboardWidgetInstance[];
    afterWidgets: DashboardWidgetInstance[];
    sourceSignature: string;
  } | null>(null);

  const currentWidgetsSignature = useMemo(
    () => buildWidgetCommitSourceSignature(currentWidgets, changedWidgetId),
    [changedWidgetId, currentWidgets],
  );

  useEffect(() => {
    if (!pendingCommit || !widgetExecution) {
      return;
    }

    if (currentWidgetsSignature !== pendingCommit.sourceSignature) {
      return;
    }

    const nextPendingCommit = pendingCommit;
    setPendingCommit(null);

    void widgetExecution.executeVariableDrivenWidgetCommit({
      changedWidgetId: nextPendingCommit.changedWidgetId,
      beforeWidgets: nextPendingCommit.beforeWidgets,
      afterWidgets: nextPendingCommit.afterWidgets,
    });
  }, [currentWidgetsSignature, pendingCommit, widgetExecution]);

  return children((nextDashboard) => {
    updateSelectedWorkspace(() => nextDashboard);
    setPendingCommit({
      changedWidgetId,
      beforeWidgets,
      afterWidgets: nextDashboard.widgets,
      sourceSignature: buildWidgetCommitSourceSignature(nextDashboard.widgets, changedWidgetId),
    });
  });
}

function getWidgetSettingsTabClassName(active: boolean) {
  return active
    ? "inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm"
    : "inline-flex items-center gap-2 rounded-full border border-transparent bg-background/40 px-3 py-2 text-sm font-medium text-muted-foreground hover:border-border/50 hover:text-foreground";
}

function cloneWidgetSettingsValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function WidgetSettingsDeferredRegion({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-topbar-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="space-y-3">
        <div className="h-10 rounded-[calc(var(--radius)-8px)] bg-muted/45" />
        <div className="h-24 rounded-[calc(var(--radius)-8px)] bg-muted/35" />
        <div className="h-16 rounded-[calc(var(--radius)-8px)] bg-muted/30" />
      </div>
    </div>
  );
}

function buildWidgetSettingsDraftState(
  instance: DashboardWidgetInstance,
  widget: NonNullable<ReturnType<typeof getWidgetById>>,
) {
  const initialProps = cloneWidgetSettingsValue(
    (instance.props ?? widget.exampleProps ?? {}) as Record<string, unknown>,
  );

  return {
    bindings: normalizeWidgetInstanceBindings(instance.bindings),
    presentation: resolveWidgetInstancePresentation(widget, instance.presentation),
    props: initialProps,
    title: instance.title ?? "",
  };
}

export function buildWidgetSettingsDependencyPreview(input: {
  activeTab: WidgetSettingsTabId;
  draftState: ReturnType<typeof buildWidgetSettingsDraftState> | null;
  instance: DashboardWidgetInstance | null;
  managedConnectionDraftProps?: Record<string, unknown>;
  widgets: DashboardWidgetInstance[];
}) {
  const previewInstance =
    input.instance && input.draftState
      ? {
          ...input.instance,
          bindings: input.draftState.bindings,
          title: input.draftState.title.trim() ? input.draftState.title.trim() : undefined,
          props:
            input.activeTab === "connection" && input.managedConnectionDraftProps
              ? input.managedConnectionDraftProps
              : input.draftState.props,
          presentation: input.draftState.presentation,
        }
      : null;
  const previewWidgets =
    input.instance && previewInstance
      ? input.widgets.map((dashboardWidget) =>
          dashboardWidget.id === input.instance?.id ? previewInstance : dashboardWidget,
        )
      : input.widgets;

  return {
    previewInstance,
    previewWidgets,
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
  initialTab,
  onRequestClose,
  onRequestOpenWidgetSettings,
  widgetId,
}: {
  embedded?: boolean;
  initialTab?: WidgetSettingsTabId;
  onRequestClose?: () => void;
  onRequestOpenWidgetSettings?: (widgetId: string, tab?: WidgetSettingsTabId) => void;
  widgetId?: string | null;
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
    openWidgetSettings,
    updateSelectedWorkspace,
    updateSelectedWorkspaceUserState,
    commitSelectedWorkspaceControlsState,
  } = useCustomWorkspaceStudio();
  const activeWidgetId = widgetId ?? requestedWidgetId;
  const activeRequestedTab = initialTab ?? requestedWidgetSettingsTab;
  const closeSettings = onRequestClose ?? openDashboardView;
  const requestOpenWidgetSettings = onRequestOpenWidgetSettings ?? openWidgetSettings;

  if (!user) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        Resolve a user session before opening widget settings.
      </div>
    );
  }

  if (!selectedDashboard || !resolvedDashboard || !activeWidgetId) {
    return null;
  }

  const instance = selectedDashboard.widgets.find((widget) => widget.id === activeWidgetId) ?? null;
  const widget = instance ? getWidgetById(instance.widgetId) : null;
  const backendMode = persistenceMode === "backend";
  const [draftState, setDraftState] = useState(() =>
    instance && widget ? buildWidgetSettingsDraftState(instance, widget) : null,
  );
  const effectiveDraftState =
    instance && widget ? draftState ?? buildWidgetSettingsDraftState(instance, widget) : null;
  const resolvedWidgetIo =
    instance && widget
      ? widget.resolveIo?.({
          widgetId: instance.widgetId,
          instanceId: instance.id,
          props: (effectiveDraftState?.props ?? instance.props ?? {}) as Record<string, unknown>,
          runtimeState: instance.runtimeState,
        }) ?? widget.io
      : undefined;
  const bindingTabInputs = (resolvedWidgetIo?.inputs ?? widget?.io?.inputs ?? []).filter(
    (input) => !isWidgetReferenceTargetInputId(input.id),
  );
  const hasBindingTab = Boolean(bindingTabInputs.length);
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
  const managedConnectionReferenceSourceWidgets = useMemo(
    () =>
      buildWidgetReferenceLanguageSourceWidgets(
        createDashboardWidgetDependencyModel(resolvedDashboard.widgets, getWidgetById),
        {
          excludeInstanceId: instance?.id ?? undefined,
        },
      ),
    [instance?.id, resolvedDashboard.widgets],
  );
  const requestedTab: WidgetSettingsTabId =
    hasManagedConnectionTab && activeRequestedTab === "connection"
      ? "connection"
      : hasBindingTab && activeRequestedTab === "bindings"
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

  const {
    previewInstance: bindingPreviewInstance,
    previewWidgets: bindingPreviewWidgets,
  } = useMemo(
    () =>
      buildWidgetSettingsDependencyPreview({
        activeTab,
        draftState: effectiveDraftState,
        instance,
        managedConnectionDraftProps,
        widgets: resolvedDashboard.widgets,
      }),
    [activeTab, effectiveDraftState, instance, managedConnectionDraftProps, resolvedDashboard.widgets],
  );
  const currentManagedConnectionSignature = buildManagedConnectionConsumerDraftSignature(
    managedConnectionAdapter,
    (instance?.props ?? {}) as Record<string, unknown>,
  );
  const draftManagedConnectionSignature = buildManagedConnectionConsumerDraftSignature(
    managedConnectionAdapter,
    managedConnectionDraftProps,
  );
  const managedConnectionDirty =
    Boolean(managedConnectionAdapter) &&
    draftManagedConnectionSignature !== currentManagedConnectionSignature;
  const [managedConnectionPreviewRuntimeState, setManagedConnectionPreviewRuntimeState] = useState<
    Record<string, unknown> | undefined
  >(undefined);
  const connectionTabHydrationKey =
    activeTab === "connection" && instance && widget
      ? `${instance.id}:${widget.id}:connection`
      : null;
  const [hydratedConnectionTabKey, setHydratedConnectionTabKey] = useState<string | null>(null);
  const connectionTabReady =
    connectionTabHydrationKey !== null &&
    hydratedConnectionTabKey === connectionTabHydrationKey;
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

    const previewOutputValue = projectWidgetRuntimeUpdateOutput(
      managedConnectionPreviewRuntimeState,
      {
        sourceOutputId,
        outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      },
    );
    const previewRuntimeParts = resolveWidgetRuntimeUpdateParts<
      Record<string, unknown>,
      Record<string, unknown>
    >(previewOutputValue);

    return {
      [sourceInputId]: {
        inputId: sourceInputId,
        label: "Source data",
        status: "valid",
        sourceWidgetId: previewSourceInstanceId,
        sourceOutputId,
        contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        value: previewOutputValue,
        upstreamBase: previewRuntimeParts.upstreamBase,
        upstreamBaseRef: previewRuntimeParts.upstreamBaseRef,
        upstreamDelta: previewRuntimeParts.upstreamDelta,
        upstreamDeltaRef: previewRuntimeParts.upstreamDeltaRef,
        upstreamUpdate: previewRuntimeParts.upstreamUpdate,
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

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let animationFrameId: number | undefined;
    let cancelled = false;

    if (!connectionTabHydrationKey) {
      setHydratedConnectionTabKey(null);
      return undefined;
    }

    setHydratedConnectionTabKey(null);

    const markReady = () => {
      if (!cancelled) {
        setHydratedConnectionTabKey(connectionTabHydrationKey);
      }
    };

    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      animationFrameId = window.requestAnimationFrame(() => {
        timeoutId = window.setTimeout(markReady, 0);
      });
    } else {
      timeoutId = setTimeout(markReady, 0);
    }

    return () => {
      cancelled = true;

      if (
        animationFrameId !== undefined &&
        typeof window !== "undefined" &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(animationFrameId);
      }

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [connectionTabHydrationKey]);

  if (!instance || !widget || !effectiveDraftState) {
    return (
      <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={closeSettings}>
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
  const settingsInstance = instance;
  const settingsWidget = widget;
  const cardTitle =
    effectiveDraftState.title.trim() || settingsInstance.title?.trim() || "Untitled card";
  function reconcileManagedConnectionDraftBindings(input: {
    bindings: DashboardWidgetInstance["bindings"];
    currentProps: Record<string, unknown>;
    nextProps: Record<string, unknown>;
    title: string;
  }) {
    return normalizeWidgetInstanceBindings(
      reconcileWidgetReferenceExpressionBindings({
        bindings: input.bindings,
        currentTitle: input.title,
        currentProps: input.currentProps,
        nextTitle: input.title,
        nextProps: input.nextProps,
        sourceWidgets: managedConnectionReferenceSourceWidgets,
      }).bindings as DashboardWidgetInstance["bindings"],
    );
  }

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
      const reconciledBindings = reconcileManagedConnectionDraftBindings({
        bindings: base.bindings,
        currentProps,
        nextProps,
        title: base.title,
      });

      return {
        ...base,
        bindings: reconciledBindings,
        props: nextProps,
      };
    });
  }

  function resetManagedConnectionDraft() {
    if (!instance || !widget || !managedConnectionAdapter) {
      return;
    }

    setDraftState((current) => {
      const base = current ?? buildWidgetSettingsDraftState(instance, widget);
      const currentProps = (base.props ?? {}) as Record<string, unknown>;
      const nextProps = applyManagedConnectionConsumerDraftProps(
        managedConnectionAdapter,
        currentProps,
        (instance.props ?? {}) as Record<string, unknown>,
      );

      return {
        ...base,
        bindings: reconcileManagedConnectionDraftBindings({
          bindings: base.bindings,
          currentProps,
          nextProps,
          title: base.title,
        }),
        props: nextProps,
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

  function duplicateCurrentWidget() {
    if (!selectedDashboard || !instance) {
      return;
    }

    const duplication = duplicateDashboardWidgetWithResult(selectedDashboard, instance.id);

    if (!duplication.duplicatedInstanceId) {
      return;
    }

    updateSelectedWorkspace(() => duplication.dashboard);
    requestOpenWidgetSettings(
      duplication.duplicatedInstanceId,
      activeTab === "bindings" || activeTab === "connection" ? activeTab : "settings",
    );
  }

  function handleBindingTabChange(bindings: DashboardWidgetInstance["bindings"]) {
    if (!instance || !widget) {
      return;
    }

    const normalizedBindings = normalizeWidgetInstanceBindings(bindings);

    setDraftState((current) =>
      current
        ? {
            ...current,
            bindings: normalizedBindings,
          }
        : {
            ...buildWidgetSettingsDraftState(instance, widget),
            bindings: normalizedBindings,
          },
    );

    updateSelectedWorkspace((dashboard) =>
      updateDashboardWidgetBindings(dashboard, instance.id, bindings),
    );
  }

  function handleDraftTitleChange(title: string) {
    setDraftState((current) =>
      current
        ? {
            ...current,
            title,
          }
        : {
            ...buildWidgetSettingsDraftState(settingsInstance, settingsWidget),
            title,
          },
    );
  }

  const pageContent = (
    <VariableDrivenWidgetCommitCoordinator
      currentWidgets={resolvedDashboard.widgets}
      beforeWidgets={selectedDashboard.widgets}
      changedWidgetId={instance.id}
      updateSelectedWorkspace={updateSelectedWorkspace}
    >
      {(commitWidgetSettingsChange) => {
        const saveWidgetSettings = ({
          title,
          props,
          bindings,
          presentation,
        }: {
          title?: string;
          props: Record<string, unknown>;
          bindings?: DashboardWidgetInstance["bindings"];
          presentation: DashboardWidgetInstance["presentation"];
        }) => {
          const nextDashboard = updateDashboardWidgetBindings(
            updateDashboardWidgetSettings(selectedDashboard, instance.id, {
              title,
              props,
              presentation,
            }),
            instance.id,
            bindings,
          );

          commitWidgetSettingsChange(nextDashboard);
        };

        const applyManagedConnectionDraftWithCommit = () => {
          if (!managedConnectionAdapter || !managedConnectionDraftProps) {
            return;
          }

          const nextProps = applyManagedConnectionConsumerDraftProps(
            managedConnectionAdapter,
            (instance.props ?? {}) as Record<string, unknown>,
            managedConnectionDraftProps,
          );
          const nextDashboard = updateDashboardWidgetSettings(selectedDashboard, instance.id, {
            props: nextProps,
          });

          commitWidgetSettingsChange(nextDashboard);
        };

        const removeManagedConnectionWithCommit = () => {
          if (!managedConnectionAdapter) {
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

          if (
            isManagedConnectionConsumerMode(managedConnectionAdapter, persistedMode) ||
            managedConnectionSource
          ) {
            const nextProps = managedConnectionAdapter.setSourceMode(
              (instance.props ?? {}) as Record<string, unknown>,
              resolveManagedConnectionConsumerDetachedSourceMode(
                managedConnectionAdapter,
                (instance.props ?? {}) as Record<string, unknown>,
              ),
            );
            const nextDashboard = updateDashboardWidgetSettings(selectedDashboard, instance.id, {
              props: nextProps,
            });

            commitWidgetSettingsChange(nextDashboard);
          }

          updateManagedConnectionDraft((currentProps) =>
            managedConnectionAdapter.setSourceMode(currentProps, detachedSourceMode),
          );
          setActiveTab("bindings");
        };

        return (
          <div className="relative h-full overflow-hidden">
            <div className="h-full overflow-y-auto px-4 py-4 pb-10 md:px-6 md:py-6">
              <div className="mx-auto max-w-6xl space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <Button variant="outline" onClick={closeSettings}>
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
                          {cardTitle}
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
                    {managedConnectionAdapter ? (
                      managedConnectionMode ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setActiveTab("connection");
                          }}
                        >
                          <PlugZap className="h-4 w-4" />
                          Open connection
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={stageManagedConnection}>
                          <PlugZap className="h-4 w-4" />
                          Add connection
                        </Button>
                      )
                    ) : null}
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
                      draftBindings={effectiveDraftState.bindings}
                      onDraftBindingsChange={(bindings) => {
                        setDraftState((current) =>
                          current
                            ? {
                                ...current,
                                bindings,
                              }
                            : {
                                ...buildWidgetSettingsDraftState(instance, widget),
                                bindings,
                              },
                        );
                      }}
                      onDraftTitleChange={handleDraftTitleChange}
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
                      panelDescription={
                        instance.slidePlacement
                          ? "Adjust the card title, schema fields, and advanced widget props for this slide-contained widget. Slide region membership is managed by the workspace slide layout."
                          : "Adjust the card title, shared presentation, schema fields, and advanced widget props for this dashboard instance."
                      }
                      previewResolvedInputsOverride={managedConnectionPreviewResolvedInputs}
                      persistenceNote={
                        backendMode
                          ? "Save settings updates the current workspace draft. The workspace is not persisted until you click Save workspace."
                          : "Save settings updates the current local workspace draft. The workspace is not persisted until you click Save workspace."
                      }
                      showPlacementField={!instance.slidePlacement}
                      secondaryActionLabel="Return to dashboard"
                      onClose={closeSettings}
                      onDuplicate={duplicateCurrentWidget}
                      onRemove={() => {
                        updateSelectedWorkspace((dashboard) =>
                          removeDashboardWidget(dashboard, instance.id),
                        );
                        closeSettings();
                      }}
                      onSave={saveWidgetSettings}
                    />
                  </div>
                ) : (
                  <WidgetSettingsPanel
                    widget={widget}
                    instance={instance}
                    draftTitle={effectiveDraftState.title}
                    onDraftTitleChange={handleDraftTitleChange}
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
                    panelDescription={
                      instance.slidePlacement
                        ? "Adjust the card title, schema fields, and advanced widget props for this slide-contained widget. Slide region membership is managed by the workspace slide layout."
                        : "Adjust the card title, shared presentation, schema fields, and advanced widget props for this dashboard instance."
                    }
                    previewResolvedInputsOverride={managedConnectionPreviewResolvedInputs}
                    persistenceNote={
                      backendMode
                        ? "Save settings updates the current workspace draft. The workspace is not persisted until you click Save workspace."
                        : "Save settings updates the current local workspace draft. The workspace is not persisted until you click Save workspace."
                    }
                    draftBindings={effectiveDraftState.bindings}
                    onDraftBindingsChange={(bindings) => {
                      setDraftState((current) =>
                        current
                          ? {
                              ...current,
                              bindings,
                            }
                          : {
                              ...buildWidgetSettingsDraftState(instance, widget),
                              bindings,
                            },
                      );
                    }}
                    showPlacementField={!instance.slidePlacement}
                    secondaryActionLabel="Return to dashboard"
                    onClose={closeSettings}
                    onDuplicate={duplicateCurrentWidget}
                    onRemove={() => {
                      updateSelectedWorkspace((dashboard) =>
                        removeDashboardWidget(dashboard, instance.id),
                      );
                      closeSettings();
                    }}
                    onSave={saveWidgetSettings}
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
                                  onClick={removeManagedConnectionWithCommit}
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
                              handleBindingTabChange(bindings);
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
                          handleBindingTabChange(bindings);
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
                      {connectionTabReady ? (
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
                      ) : (
                        <WidgetSettingsDeferredRegion
                          title="Loading connection editor"
                          description="Preparing connection picker data, query controls, runtime status, and diagnostic panels after the tab opens."
                        />
                      )}
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
                          onClick={applyManagedConnectionDraftWithCommit}
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
      }}
    </VariableDrivenWidgetCommitCoordinator>
  );

  if (embedded) {
    return (
      <div className="absolute inset-0 z-[70] overflow-hidden bg-background/92 backdrop-blur-xl">
        <DashboardWidgetDependenciesProvider widgets={bindingPreviewWidgets}>
          {pageContent}
        </DashboardWidgetDependenciesProvider>
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
          <DashboardWidgetDependenciesProvider widgets={bindingPreviewWidgets}>
            {pageContent}
          </DashboardWidgetDependenciesProvider>
        </DashboardWidgetExecutionProvider>
      </DashboardWidgetRegistryProvider>
    </DashboardControlsProvider>
  );
}
