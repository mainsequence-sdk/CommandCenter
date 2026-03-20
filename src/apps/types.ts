import type { ComponentType } from "react";

import type { DashboardDefinition } from "@/dashboards/types";
import type { AppNotificationSourceDefinition } from "@/notifications/types";

export type AppIcon = ComponentType<{ className?: string }>;
export type AppNavigationPlacement = "primary" | "admin-menu";
export type AppTopNavigationStyle = "selector" | "hidden";

export interface AppPermissionDefinition {
  id: string;
  label: string;
  description: string;
  category?: string;
}

export interface AppSurfaceNavigationSection {
  id: string;
  label: string;
  description?: string;
  order?: number;
}

interface AppSurfaceBase {
  id: string;
  title: string;
  description: string;
  navLabel?: string;
  navigationSection?: AppSurfaceNavigationSection;
  requiredPermissions?: string[];
  hidden?: boolean;
  fullBleed?: boolean;
}

export interface DashboardSurfaceDefinition extends AppSurfaceBase {
  kind: "dashboard";
  dashboard: DashboardDefinition;
}

export interface PageSurfaceDefinition extends AppSurfaceBase {
  kind: "page";
  component: ComponentType;
}

export interface ToolSurfaceDefinition extends AppSurfaceBase {
  kind: "tool";
  component: ComponentType;
}

export type AppSurfaceDefinition =
  | DashboardSurfaceDefinition
  | PageSurfaceDefinition
  | ToolSurfaceDefinition;

export interface AppSurfaceNavigationGroup {
  id: string;
  label: string;
  description?: string;
  surfaces: AppSurfaceDefinition[];
}

export interface AppDefinition {
  id: string;
  title: string;
  description: string;
  source: string;
  icon: AppIcon;
  navigationPlacement?: AppNavigationPlacement;
  topNavigationStyle?: AppTopNavigationStyle;
  requiredPermissions?: string[];
  permissionDefinitions?: AppPermissionDefinition[];
  defaultSurfaceId: string;
  surfaces: AppSurfaceDefinition[];
  notificationSources?: AppNotificationSourceDefinition[];
}

export type AppSurfaceEntry = AppSurfaceDefinition & {
  appId: string;
  appTitle: string;
  appDescription: string;
  appSource: string;
  appIcon: AppIcon;
  appRequiredPermissions?: string[];
};
