import { createContext, useContext, type ReactNode } from "react";

import type { DashboardManagedWidgetOwner } from "@/dashboards/types";
import type { WidgetInstancePresentation } from "@/widgets/types";

export interface DashboardWidgetRegistryEntry {
  id: string;
  widgetId: string;
  title?: string;
  props?: Record<string, unknown>;
  runtimeState?: Record<string, unknown>;
  managedBy?: DashboardManagedWidgetOwner;
  presentation?: WidgetInstancePresentation;
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
