export interface DashboardGridConfig {
  columns?: number;
  rowHeight?: number;
  gap?: number;
}

export type DashboardTimeRangeKey = "15m" | "1h" | "6h" | "24h" | "7d" | "30d" | "90d";

export interface DashboardTimeRangeConfig {
  enabled?: boolean;
  defaultRange?: DashboardTimeRangeKey;
  options?: DashboardTimeRangeKey[];
}

export interface DashboardRefreshConfig {
  enabled?: boolean;
  defaultIntervalMs?: number | null;
  intervals?: Array<number | null>;
}

export interface DashboardActionsConfig {
  enabled?: boolean;
  share?: boolean;
  view?: boolean;
}

export interface DashboardControlsConfig {
  enabled?: boolean;
  timeRange?: DashboardTimeRangeConfig;
  refresh?: DashboardRefreshConfig;
  actions?: DashboardActionsConfig;
}

export interface DashboardWidgetSpan {
  cols: number;
  rows: number;
}

export interface DashboardWidgetPlacement {
  x?: number;
  y?: number;
}

export interface DashboardWidgetLegacyLayout {
  x?: number;
  y?: number;
  w: number;
  h: number;
}

export type DashboardWidgetLayout = DashboardWidgetSpan | DashboardWidgetLegacyLayout;

export interface DashboardWidgetInstance {
  id: string;
  widgetId: string;
  title?: string;
  props?: Record<string, unknown>;
  layout: DashboardWidgetLayout;
  position?: DashboardWidgetPlacement;
  requiredPermissions?: string[];
}

export interface DashboardDefinition {
  id: string;
  title: string;
  description: string;
  category?: string;
  source: string;
  requiredPermissions?: string[];
  grid?: DashboardGridConfig;
  controls?: DashboardControlsConfig;
  widgets: DashboardWidgetInstance[];
}

export interface ResolvedDashboardGridConfig {
  columns: number;
  rowHeight: number;
  gap: number;
}

export interface ResolvedDashboardWidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ResolvedDashboardWidgetInstance
  extends Omit<DashboardWidgetInstance, "layout"> {
  layout: ResolvedDashboardWidgetLayout;
}

export interface ResolvedDashboardDefinition
  extends Omit<DashboardDefinition, "grid" | "widgets"> {
  grid: ResolvedDashboardGridConfig;
  widgets: ResolvedDashboardWidgetInstance[];
}

export interface DashboardLayoutIssue {
  widgetId: string;
  message: string;
}
