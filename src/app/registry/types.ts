import type { ThemePreset } from "@/themes/types";
import type { WidgetDefinition } from "@/widgets/types";
import type { AppDefinition, AppSurfaceEntry } from "@/apps/types";
import type { DashboardDefinition } from "@/dashboards/types";

export interface AppExtension {
  id: string;
  title: string;
  description?: string;
  mockOnly?: boolean;
  widgets?: WidgetDefinition[];
  apps?: AppDefinition[];
  themes?: ThemePreset[];
}

export interface AppRegistry {
  extensions: AppExtension[];
  widgets: WidgetDefinition[];
  apps: AppDefinition[];
  surfaces: AppSurfaceEntry[];
  dashboards: DashboardDefinition[];
  themes: ThemePreset[];
}
