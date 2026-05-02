import type { DashboardDefinitionType } from "@/dashboards/types";

export const DEFAULT_DASHBOARD_DEFINITION_TYPE: DashboardDefinitionType = "workspace";
const AGENT_MONITOR_WORKSPACE_LABEL = "agent-monitor";
const SLIDE_STUDIO_WORKSPACE_LABEL = "slide-studio";

export function isDashboardDefinitionType(value: unknown): value is DashboardDefinitionType {
  return value === "workspace" || value === "agent-monitor" || value === "slide-studio";
}

export function inferDashboardDefinitionTypeFromLabels(
  labels: readonly string[] | null | undefined,
): DashboardDefinitionType {
  if (Array.isArray(labels)) {
    if (labels.includes(AGENT_MONITOR_WORKSPACE_LABEL)) {
      return "agent-monitor";
    }

    if (labels.includes(SLIDE_STUDIO_WORKSPACE_LABEL)) {
      return "slide-studio";
    }
  }

  return DEFAULT_DASHBOARD_DEFINITION_TYPE;
}

export function normalizeDashboardDefinitionType(
  value: unknown,
  labels: readonly string[] | null | undefined,
): DashboardDefinitionType {
  return isDashboardDefinitionType(value)
    ? value
    : inferDashboardDefinitionTypeFromLabels(labels);
}

export function normalizeDashboardDefinitionTypeList(
  values: readonly DashboardDefinitionType[] | undefined,
) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.filter((value) => isDashboardDefinitionType(value))));
}
