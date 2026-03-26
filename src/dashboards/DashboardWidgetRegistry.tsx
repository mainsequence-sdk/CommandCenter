import { createContext, useContext, type ReactNode } from "react";

export interface DashboardWidgetRegistryEntry {
  id: string;
  widgetId: string;
  title?: string;
  props?: Record<string, unknown>;
  runtimeState?: Record<string, unknown>;
}

const DashboardWidgetRegistryContext = createContext<DashboardWidgetRegistryEntry[] | null>(null);

export function DashboardWidgetRegistryProvider({
  children,
  widgets,
}: {
  children: ReactNode;
  widgets: DashboardWidgetRegistryEntry[];
}) {
  return (
    <DashboardWidgetRegistryContext.Provider value={widgets}>
      {children}
    </DashboardWidgetRegistryContext.Provider>
  );
}

export function useDashboardWidgetRegistry() {
  return useContext(DashboardWidgetRegistryContext) ?? [];
}
