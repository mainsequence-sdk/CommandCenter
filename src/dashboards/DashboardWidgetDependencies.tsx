import { createContext, useContext, useMemo, type ReactNode } from "react";

import { getWidgetById } from "@/app/registry";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import type { WidgetDefinition } from "@/widgets/types";

import {
  createDashboardWidgetDependencyModel,
  type DashboardWidgetDependencyModel,
} from "./widget-dependencies";

const DashboardWidgetDependenciesContext =
  createContext<DashboardWidgetDependencyModel | null>(null);

export function DashboardWidgetDependenciesProvider({
  children,
  resolveWidgetDefinition,
  widgets,
}: {
  children: ReactNode;
  resolveWidgetDefinition?: (widgetId: string) => WidgetDefinition | undefined;
  widgets: DashboardWidgetInstance[];
}) {
  const model = useMemo(
    () =>
      createDashboardWidgetDependencyModel(
        widgets,
        resolveWidgetDefinition ?? getWidgetById,
      ),
    [resolveWidgetDefinition, widgets],
  );

  return (
    <DashboardWidgetDependenciesContext.Provider value={model}>
      {children}
    </DashboardWidgetDependenciesContext.Provider>
  );
}

export function useDashboardWidgetDependencies() {
  return useContext(DashboardWidgetDependenciesContext);
}

export function useWidgetDependencyGraph() {
  return useDashboardWidgetDependencies()?.graph;
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
