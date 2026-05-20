import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { getWidgetById } from "@/app/registry";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import { useRuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import type { WidgetDefinition } from "@/widgets/types";

import {
  createDashboardWidgetDependencyModel,
  type DashboardWidgetDependencyModel,
} from "./widget-dependencies";
import { DashboardWidgetDependenciesContext } from "./DashboardWidgetDependenciesContext";

function summarizeVariableDebugValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return {
      kind: "array",
      length: value.length,
      sample: value.slice(0, 3),
    };
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);

    return {
      kind: "object",
      keys,
      sample: Object.fromEntries(keys.slice(0, 8).map((key) => [key, record[key]])),
    };
  }

  return value;
}

function summarizeWorkspaceVariableStore(model: DashboardWidgetDependencyModel) {
  return model.variableRegistry.entries.map((entry) => {
    const output = model.resolveOutputs(entry.key.sourceWidgetId)?.[entry.key.sourceOutputId];

    return {
      id: entry.id,
      key: entry.key,
      sourceValue: summarizeVariableDebugValue(output?.value),
      sourceContract: output?.contractId,
      consumers: entry.consumers.map((consumer) => ({
        targetWidgetId: consumer.targetWidgetId,
        targetInputId: consumer.targetInputId,
        targetKind: consumer.targetKind,
        propPath: consumer.propPath,
      })),
    };
  });
}

function summarizeRuntimeStateForDebug(runtimeState: unknown) {
  if (!runtimeState || typeof runtimeState !== "object") {
    return runtimeState;
  }

  const record = runtimeState as Record<string, unknown>;
  const interaction =
    record.interaction && typeof record.interaction === "object"
      ? (record.interaction as Record<string, unknown>)
      : null;
  const selection =
    interaction?.selection && typeof interaction.selection === "object"
      ? interaction.selection
      : null;

  return {
    keys: Object.keys(record),
    selection,
  };
}

export function DashboardWidgetDependenciesProvider({
  children,
  resolveWidgetDefinition,
  widgets,
}: {
  children: ReactNode;
  resolveWidgetDefinition?: (widgetId: string) => WidgetDefinition | undefined;
  widgets: DashboardWidgetInstance[];
}) {
  const runtimeDataStore = useRuntimeDataStore();
  const model = useMemo(
    () =>
      createDashboardWidgetDependencyModel(
        widgets,
        resolveWidgetDefinition ?? getWidgetById,
        { runtimeDataStore },
      ),
    [resolveWidgetDefinition, runtimeDataStore, widgets],
  );
  const previousVariableDebugSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const entries = summarizeWorkspaceVariableStore(model);
    const signature = JSON.stringify(entries);

    if (signature === previousVariableDebugSignatureRef.current) {
      return;
    }

    previousVariableDebugSignatureRef.current = signature;

    /*
    console.log("[workspace-variable-store]", {
      entries,
    });
    */
  }, [model]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    /*
    console.log(
      "[workspace-runtime-state]",
      widgets.map((widget) => ({
        instanceId: widget.id,
        runtimeState: summarizeRuntimeStateForDebug(widget.runtimeState),
      })),
    );
    */
  }, [widgets]);

  return (
    <DashboardWidgetDependenciesContext.Provider value={model}>
      {children}
    </DashboardWidgetDependenciesContext.Provider>
  );
}
export {
  useDashboardWidgetDependencies,
  useResolvedWidgetInput,
  useResolvedWidgetInputs,
  useResolvedWidgetIo,
  useResolvedWidgetOutput,
  useResolvedWidgetOutputs,
  useWidgetDependencyGraph,
  useWorkspaceVariableReferenceRegistry,
} from "./DashboardWidgetDependenciesContext";
