import {
  ensureUserDashboardCollectionSelection,
  sanitizeDashboardDefinition,
  saveUserDashboardCollection,
  type UserDashboardCollection,
} from "./custom-dashboard-storage";
import type { DashboardDefinition } from "@/dashboards/types";
import { env } from "@/config/env";
import {
  fetchWorkspaceDetailFromBackend,
  fetchWorkspaceListSummariesFromBackend,
  clearLegacyMockWorkspaceCollection,
  hasConfiguredWorkspaceBackend,
  readBundledMockWorkspaceCollection,
  readLegacyMockWorkspaceCollection,
  saveWorkspaceInBackend,
} from "./workspace-api";
import { summarizeDashboardForWorkspaceList, type WorkspaceListItemSummary } from "./workspace-list-summary";

export type WorkspacePersistenceMode = "backend" | "local";

export function getWorkspacePersistenceMode(): WorkspacePersistenceMode {
  if (env.useMockData) {
    return "local";
  }

  return hasConfiguredWorkspaceBackend() ? "backend" : "local";
}

export function isWorkspaceBackendEnabled() {
  return getWorkspacePersistenceMode() === "backend";
}

export async function loadPersistedWorkspaceListSummaries(
  userId: string,
): Promise<WorkspaceListItemSummary[]> {
  if (env.useMockData) {
    return readBundledMockWorkspaceCollection().dashboards.map((dashboard) =>
      summarizeDashboardForWorkspaceList(dashboard),
    );
  }

  if (!isWorkspaceBackendEnabled()) {
    const { loadUserDashboardCollection } = await import("./custom-dashboard-storage");
    return loadUserDashboardCollection(userId).dashboards.map((dashboard) =>
      summarizeDashboardForWorkspaceList(dashboard),
    );
  }

  return fetchWorkspaceListSummariesFromBackend();
}

export async function loadPersistedWorkspaceCollection(userId: string) {
  if (env.useMockData) {
    return readBundledMockWorkspaceCollection();
  }

  if (!isWorkspaceBackendEnabled()) {
    const { loadUserDashboardCollection } = await import("./custom-dashboard-storage");
    const localCollection = loadUserDashboardCollection(userId);

    if (localCollection.dashboards.length === 0) {
      const legacyMockCollection = readLegacyMockWorkspaceCollection(userId);

      if (legacyMockCollection?.dashboards.length) {
        const migratedCollection = saveUserDashboardCollection(userId, legacyMockCollection);
        clearLegacyMockWorkspaceCollection(userId);
        return migratedCollection;
      }
    }

    return localCollection;
  }

  throw new Error(
    "Backend workspace loading is summary-first. Use loadPersistedWorkspaceListSummaries() and loadPersistedWorkspaceDetail() instead.",
  );
}

export async function loadPersistedWorkspaceDetail(
  userId: string,
  workspaceId: string,
): Promise<DashboardDefinition | null> {
  if (env.useMockData) {
    return (
      readBundledMockWorkspaceCollection().dashboards.find((dashboard) => dashboard.id === workspaceId) ??
      null
    );
  }

  if (!isWorkspaceBackendEnabled()) {
    const { loadUserDashboardCollection } = await import("./custom-dashboard-storage");
    return (
      loadUserDashboardCollection(userId).dashboards.find((dashboard) => dashboard.id === workspaceId) ??
      null
    );
  }

  return fetchWorkspaceDetailFromBackend(workspaceId);
}

export async function savePersistedWorkspace(
  userId: string,
  currentCollection: UserDashboardCollection,
  workspace: DashboardDefinition,
) {
  if (!isWorkspaceBackendEnabled()) {
    const normalizedWorkspace = sanitizeDashboardDefinition(workspace);
    const persistedCollection = saveUserDashboardCollection(
      userId,
      ensureUserDashboardCollectionSelection(
        {
          ...currentCollection,
          dashboards: currentCollection.dashboards.some(
            (entry) => entry.id === normalizedWorkspace.id,
          )
            ? currentCollection.dashboards.map((entry) =>
                entry.id === normalizedWorkspace.id ? normalizedWorkspace : entry,
              )
            : [normalizedWorkspace, ...currentCollection.dashboards],
          selectedDashboardId: normalizedWorkspace.id,
          savedAt: new Date().toISOString(),
        },
        {
          allowEmpty: true,
        },
      ),
    );

    return (
      persistedCollection.dashboards.find((entry) => entry.id === normalizedWorkspace.id) ??
      normalizedWorkspace
    );
  }

  return saveWorkspaceInBackend(workspace);
}
