import type { ThemePreset } from "@/themes/types";
import type { WidgetDefinition } from "@/widgets/types";
import type { AppDefinition, AppShellMenuContribution, AppSurfaceEntry } from "@/apps/types";
import type { DashboardDefinition } from "@/dashboards/types";
import type { AnyConnectionTypeDefinition } from "@/connections/types";

export interface AppExtension {
  id: string;
  title: string;
  description?: string;
  mockOnly?: boolean;
  widgets?: WidgetDefinition[];
  apps?: AppDefinition[];
  themes?: ThemePreset[];
  connections?: AnyConnectionTypeDefinition[];
}

export interface AppRegistry {
  extensions: AppExtension[];
  widgets: WidgetDefinition[];
  apps: AppDefinition[];
  surfaces: AppSurfaceEntry[];
  shellMenuEntries: AppShellMenuEntry[];
  dashboards: DashboardDefinition[];
  themes: ThemePreset[];
  connections: AnyConnectionTypeDefinition[];
}

export type AppShellMenuEntry = AppShellMenuContribution & {
  id: string;
  contributionId: string;
  appId: string;
  appTitle: string;
  appDescription: string;
  appSource: string;
  appIcon: AppDefinition["icon"];
  appRequiredPermissions?: string[];
};
