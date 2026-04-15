import type { ComponentType } from "react";

import type { AppUser } from "@/auth/types";
import type { DashboardDefinition } from "@/dashboards/types";
import type { AppNotificationSourceDefinition } from "@/notifications/types";

export type AppIcon = ComponentType<{ className?: string }>;
export type AppNavigationPlacement = "primary" | "admin-menu";
export type AppTopNavigationStyle = "selector" | "hidden";
export type AppShellMenuAudience = "user" | "admin";

export interface AppPermissionDefinition {
  id: string;
  label: string;
  description: string;
  category?: string;
}

export type AppSurfaceAssistantContextValue = string | number | boolean | null | undefined;

export type AppSurfaceAssistantContextDetails = Record<
  string,
  AppSurfaceAssistantContextValue
>;

export interface AppSurfaceAssistantContextResolved {
  summary: string;
  availableActions: string[];
  details: AppSurfaceAssistantContextDetails;
}

export interface AppSurfaceAssistantContextInput {
  appId: string;
  surfaceId: string;
  currentPath: string;
  pathname: string;
  searchParams: URLSearchParams;
  permissionCount: number;
  role?: string;
  userEmail?: string;
  userId?: string;
  userName?: string;
}

export interface AppSurfaceAssistantContext {
  summary: string;
  availableActions?: string[];
  details?: AppSurfaceAssistantContextDetails;
  resolve?: (
    input: AppSurfaceAssistantContextInput,
  ) => Partial<AppSurfaceAssistantContextResolved>;
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
  icon?: AppIcon;
  navigationSection?: AppSurfaceNavigationSection;
  requiredPermissions?: string[];
  hidden?: boolean;
  fullBleed?: boolean;
  assistantContext?: AppSurfaceAssistantContext;
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

export interface AppShellMenuContributionGroup {
  id: string;
  label: string;
  description?: string;
  order?: number;
}

export interface AppShellMenuRenderProps {
  audience: AppShellMenuAudience;
  user?: AppUser;
}

export interface AppShellMenuContribution {
  id: string;
  audience: AppShellMenuAudience;
  label: string;
  description?: string;
  icon?: AppIcon;
  order?: number;
  requiredPermissions?: string[];
  group?: AppShellMenuContributionGroup;
  component: ComponentType<AppShellMenuRenderProps>;
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
  shellMenuContributions?: AppShellMenuContribution[];
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

export function defineSurfaceAssistantContext(
  assistantContext: AppSurfaceAssistantContext,
) {
  return { assistantContext } as const;
}
