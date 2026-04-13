import { createContext, useContext, useMemo, type ReactNode } from "react";

import { getAppPath } from "@/apps/utils";

interface WorkspaceStudioFilterTarget {
  labels?: string[];
}

export interface WorkspaceStudioSurfaceConfig {
  allowedWidgetIds?: string[];
  catalogDescription?: string;
  catalogTitle?: string;
  savedWidgetsPath?: string;
  toolbarActions?: ReactNode;
  workspaceFilter?: (workspace: WorkspaceStudioFilterTarget) => boolean;
  workspaceListPath?: string;
}

export interface ResolvedWorkspaceStudioSurfaceConfig {
  allowedWidgetIds?: string[];
  catalogDescription: string;
  catalogTitle: string;
  savedWidgetsPath?: string;
  toolbarActions?: ReactNode;
  workspaceFilter?: (workspace: WorkspaceStudioFilterTarget) => boolean;
  workspaceListPath: string;
}

const defaultWorkspaceStudioSurfaceConfig: ResolvedWorkspaceStudioSurfaceConfig = {
  catalogDescription: "Search, filter, favorite, or drag directly onto the canvas.",
  catalogTitle: "Components",
  savedWidgetsPath: getAppPath("workspace-studio", "widgets"),
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
