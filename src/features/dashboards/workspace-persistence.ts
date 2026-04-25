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
  fetchWorkspaceUserStateFromBackend,
  fetchWorkspaceListSummariesFromBackend,
  clearLegacyMockWorkspaceCollection,
  hasConfiguredWorkspaceBackend,
  readBundledMockWorkspaceCollection,
  readLegacyMockWorkspaceCollection,
  saveWorkspaceInBackend,
  saveWorkspaceUserStateInBackend,
} from "./workspace-api";
import { summarizeDashboardForWorkspaceList, type WorkspaceListItemSummary } from "./workspace-list-summary";
import {
  createEmptyWorkspaceUserState,
  extractWorkspaceUserStateFromDashboard,
  type WorkspaceUserStateSnapshot,
} from "./workspace-user-state";

export type WorkspacePersistenceMode = "backend" | "local";
export interface LoadPersistedWorkspaceListSummariesOptions {
  excludeIds?: readonly string[];
}

function normalizeExcludedWorkspaceIds(excludeIds: readonly string[] | undefined) {
  if (!Array.isArray(excludeIds)) {
    return [];
  }

  return Array.from(
    new Set(
      excludeIds
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function filterExcludedWorkspaceSummaries(
  items: WorkspaceListItemSummary[],
  options?: LoadPersistedWorkspaceListSummariesOptions,
) {
  const excludedIds = normalizeExcludedWorkspaceIds(options?.excludeIds);

  if (excludedIds.length === 0) {
    return items;
  }

  const excludedIdSet = new Set(excludedIds);
  return items.filter((item) => !excludedIdSet.has(item.id));
}

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
  options?: LoadPersistedWorkspaceListSummariesOptions,
): Promise<WorkspaceListItemSummary[]> {
  if (env.useMockData) {
    return filterExcludedWorkspaceSummaries(
      readBundledMockWorkspaceCollection().dashboards.map((dashboard) =>
        summarizeDashboardForWorkspaceList(dashboard),
      ),
      options,
    );
  }

  if (!isWorkspaceBackendEnabled()) {
    const { loadUserDashboardCollection } = await import("./custom-dashboard-storage");
    return filterExcludedWorkspaceSummaries(
      loadUserDashboardCollection(userId).dashboards.map((dashboard) =>
        summarizeDashboardForWorkspaceList(dashboard),
      ),
      options,
    );
  }

  return fetchWorkspaceListSummariesFromBackend({
    excludeIds: options?.excludeIds,
  });
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

export async function loadPersistedWorkspaceUserState(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceUserStateSnapshot> {
  if (env.useMockData) {
    const workspace =
      readBundledMockWorkspaceCollection().dashboards.find((dashboard) => dashboard.id === workspaceId) ??
      null;

    return workspace
      ? extractWorkspaceUserStateFromDashboard(workspace)
      : createEmptyWorkspaceUserState();
  }

  if (!isWorkspaceBackendEnabled()) {
    const { loadUserDashboardCollection } = await import("./custom-dashboard-storage");
    const workspace =
      loadUserDashboardCollection(userId).dashboards.find((dashboard) => dashboard.id === workspaceId) ??
      null;

    return workspace
      ? extractWorkspaceUserStateFromDashboard(workspace)
      : createEmptyWorkspaceUserState();
  }

  return fetchWorkspaceUserStateFromBackend(workspaceId);
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

export async function savePersistedWorkspaceUserState(
  workspaceId: string,
  userState: WorkspaceUserStateSnapshot,
) {
  if (!isWorkspaceBackendEnabled()) {
    return userState;
  }

  return saveWorkspaceUserStateInBackend(workspaceId, userState);
}
