import { createContext, useContext, useMemo } from "react";

import type { DashboardWidgetDependencyModel } from "./widget-dependencies";

export const DashboardWidgetDependenciesContext =
  createContext<DashboardWidgetDependencyModel | null>(null);

export function useDashboardWidgetDependencies() {
  return useContext(DashboardWidgetDependenciesContext);
}

export function useWidgetDependencyGraph() {
  return useDashboardWidgetDependencies()?.graph;
}

export function useWorkspaceVariableReferenceRegistry() {
  return useDashboardWidgetDependencies()?.variableRegistry;
}

export function useResolvedWidgetIo(instanceId?: string) {
  const model = useDashboardWidgetDependencies();

  return useMemo(() => {
    if (!model || !instanceId) {
      return undefined;
    }

    return model.resolveIo(instanceId);
  }, [instanceId, model]);
}

export function useResolvedWidgetOutputs(instanceId?: string) {
  const model = useDashboardWidgetDependencies();

  return useMemo(() => {
    if (!model || !instanceId) {
      return undefined;
    }

    return model.resolveOutputs(instanceId);
  }, [instanceId, model]);
}

export function useResolvedWidgetOutput(instanceId?: string, outputId?: string) {
  const resolvedOutputs = useResolvedWidgetOutputs(instanceId);

  return useMemo(() => {
    if (!resolvedOutputs || !outputId) {
      return undefined;
    }

    return resolvedOutputs[outputId];
  }, [outputId, resolvedOutputs]);
}

export function useResolvedWidgetInputs(instanceId?: string) {
  const model = useDashboardWidgetDependencies();

  return useMemo(() => {
    if (!model || !instanceId) {
      return undefined;
    }

    return model.resolveInputs(instanceId);
  }, [instanceId, model]);
}

export function useResolvedWidgetInput(instanceId?: string, inputId?: string) {
  const resolvedInputs = useResolvedWidgetInputs(instanceId);

  return useMemo(() => {
    if (!resolvedInputs || !inputId) {
      return undefined;
    }

    return resolvedInputs[inputId];
  }, [inputId, resolvedInputs]);
}
