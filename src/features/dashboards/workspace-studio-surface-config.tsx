import { createContext, useContext, useMemo, type ReactNode } from "react";

import { getAppPath } from "@/apps/utils";
import type { DashboardDefinition, DashboardDefinitionType } from "@/dashboards/types";
import { WORKSPACE_SLIDE_WIDGET_ID } from "@/dashboards/structural-widgets";
import {
  DEFAULT_DASHBOARD_DEFINITION_TYPE,
  normalizeDashboardDefinitionType,
  normalizeDashboardDefinitionTypeList,
} from "./workspace-definition-type";

interface WorkspaceStudioFilterTarget {
  type?: DashboardDefinitionType;
  labels?: string[];
}

export interface WorkspaceStudioSurfaceConfig {
  allowedWidgetIds?: string[];
  deniedWidgetIds?: string[];
  catalogDescription?: string;
  catalogTitle?: string;
  createWorkspaceDefinition?: (defaultTitle: string) => DashboardDefinition;
  createWorkspaceLabel?: string;
  savedWidgetsPath?: string;
  toolbarActions?: ReactNode;
  workspaceFilter?: (workspace: WorkspaceStudioFilterTarget) => boolean;
  workspaceCountLabel?: string;
  workspacePageDescription?: string;
  workspacePageTitle?: string;
  workspaceTypes?: DashboardDefinitionType[];
  workspaceListPath?: string;
}

export interface ResolvedWorkspaceStudioSurfaceConfig {
  allowedWidgetIds?: string[];
  deniedWidgetIds?: string[];
  catalogDescription: string;
  catalogTitle: string;
  createWorkspaceDefinition?: (defaultTitle: string) => DashboardDefinition;
  createWorkspaceLabel: string;
  savedWidgetsPath?: string;
  toolbarActions?: ReactNode;
  workspaceFilter?: (workspace: WorkspaceStudioFilterTarget) => boolean;
  workspaceCountLabel: string;
  workspacePageDescription: string;
  workspacePageTitle: string;
  workspaceTypes: DashboardDefinitionType[];
  workspaceListPath: string;
}

export type WorkspaceStudioRouteMode =
  | "public-preview"
  | "slideshow"
  | "print";

const defaultWorkspaceStudioSurfaceConfig: ResolvedWorkspaceStudioSurfaceConfig = {
  catalogDescription: "Search, filter, favorite, or drag directly onto the canvas.",
  catalogTitle: "Components",
  createWorkspaceLabel: "New workspace",
  deniedWidgetIds: [WORKSPACE_SLIDE_WIDGET_ID],
  savedWidgetsPath: getAppPath("workspace-studio", "widgets"),
  workspaceCountLabel: "workspaces",
  workspaceTypes: [DEFAULT_DASHBOARD_DEFINITION_TYPE],
  workspacePageDescription:
    "Choose a saved workspace or create a new one. Canvas and settings belong to each workspace instance.",
  workspacePageTitle: "Workspaces",
  workspaceFilter: (workspace) =>
    normalizeDashboardDefinitionType(workspace.type, workspace.labels) ===
    DEFAULT_DASHBOARD_DEFINITION_TYPE,
  workspaceListPath: getAppPath("workspace-studio", "workspaces"),
};

const WorkspaceStudioSurfaceConfigContext =
  createContext<ResolvedWorkspaceStudioSurfaceConfig>(defaultWorkspaceStudioSurfaceConfig);

function resolveWorkspaceStudioSurfaceConfig(
  value?: WorkspaceStudioSurfaceConfig,
): ResolvedWorkspaceStudioSurfaceConfig {
  return {
    ...defaultWorkspaceStudioSurfaceConfig,
    ...value,
    allowedWidgetIds: value?.allowedWidgetIds
      ? Array.from(
          new Set(
            value.allowedWidgetIds
              .map((widgetId) => widgetId.trim())
              .filter(Boolean),
          ),
        )
      : undefined,
    deniedWidgetIds:
      value?.deniedWidgetIds !== undefined
        ? Array.from(
            new Set(
              value.deniedWidgetIds
                .map((widgetId) => widgetId.trim())
                .filter(Boolean),
            ),
          )
        : defaultWorkspaceStudioSurfaceConfig.deniedWidgetIds,
    workspaceTypes:
      value?.workspaceTypes !== undefined
        ? normalizeDashboardDefinitionTypeList(value.workspaceTypes)
        : defaultWorkspaceStudioSurfaceConfig.workspaceTypes,
  };
}

export function WorkspaceStudioSurfaceConfigProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: WorkspaceStudioSurfaceConfig;
}) {
  const resolvedValue = useMemo(() => resolveWorkspaceStudioSurfaceConfig(value), [value]);

  return (
    <WorkspaceStudioSurfaceConfigContext.Provider value={resolvedValue}>
      {children}
    </WorkspaceStudioSurfaceConfigContext.Provider>
  );
}

export function useWorkspaceStudioSurfaceConfig() {
  return useContext(WorkspaceStudioSurfaceConfigContext);
}

export function filterWorkspaceStudioEntries<T extends WorkspaceStudioFilterTarget>(
  entries: readonly T[],
  workspaceFilter?: (workspace: WorkspaceStudioFilterTarget) => boolean,
) {
  if (!workspaceFilter) {
    return [...entries];
  }

  return entries.filter((entry) => workspaceFilter(entry));
}

export function buildWorkspaceStudioCanvasPath(workspaceListPath: string, workspaceId: string) {
  const params = new URLSearchParams({
    workspace: workspaceId,
  });

  return `${workspaceListPath}?${params.toString()}`;
}

export function buildWorkspaceStudioViewPath(
  workspaceListPath: string,
  workspaceId: string,
  view: "graph" | "settings",
) {
  const params = new URLSearchParams({
    workspace: workspaceId,
    view,
  });

  return `${workspaceListPath}?${params.toString()}`;
}

export function buildWorkspaceStudioModePath(
  workspaceListPath: string,
  workspaceId: string,
  mode: WorkspaceStudioRouteMode,
) {
  const params = new URLSearchParams({
    workspace: workspaceId,
    mode,
  });

  return `${workspaceListPath}?${params.toString()}`;
}
