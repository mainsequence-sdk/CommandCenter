import { getAppPath } from "@/apps/utils";
import type { DashboardDefinition } from "@/dashboards/types";

const WORKSPACE_FAVORITE_PREFIX = "workspace-studio::workspace::";

export interface FavoriteWorkspaceEntry {
  id: string;
  favoriteId: string;
  title: string;
  path: string;
  appId: "workspace-studio";
  appTitle: string;
  kindLabel: "workspace";
}

export function getWorkspaceFavoriteId(workspaceId: string) {
  return `${WORKSPACE_FAVORITE_PREFIX}${workspaceId}`;
}

export function isWorkspaceFavoriteId(favoriteId: string) {
  return favoriteId.startsWith(WORKSPACE_FAVORITE_PREFIX);
}

export function isWorkspaceFavorited(favoriteWorkspaceIds: string[], workspaceId: string) {
  return favoriteWorkspaceIds.includes(getWorkspaceFavoriteId(workspaceId));
}

export function getWorkspacePath(workspaceId: string, view?: "settings") {
  const params = new URLSearchParams({ workspace: workspaceId });

  if (view === "settings") {
    params.set("view", "settings");
  }

  return `${getAppPath("workspace-studio", "workspaces")}?${params.toString()}`;
}

export function getFavoriteWorkspaceEntries(
  workspaces: DashboardDefinition[],
  favoriteWorkspaceIds: string[],
): FavoriteWorkspaceEntry[] {
  const workspaceMap = new Map(
    workspaces.map((workspace) => [getWorkspaceFavoriteId(workspace.id), workspace]),
  );

  return favoriteWorkspaceIds
    .map((favoriteId) => {
      const workspace = workspaceMap.get(favoriteId);

      if (!workspace) {
        return null;
      }

      return {
        id: workspace.id,
        favoriteId,
        title: workspace.title,
        path: getWorkspacePath(workspace.id),
        appId: "workspace-studio" as const,
        appTitle: "Workspaces",
        kindLabel: "workspace" as const,
      };
    })
    .filter((workspace): workspace is FavoriteWorkspaceEntry => Boolean(workspace));
}
