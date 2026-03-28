import {
  loadUserDashboardCollection,
  saveUserDashboardCollection,
  type UserDashboardCollection,
} from "./custom-dashboard-storage";
import { env } from "@/config/env";
import {
  fetchWorkspaceCollectionFromBackend,
  clearLegacyMockWorkspaceCollection,
  hasConfiguredWorkspaceBackend,
  readLegacyMockWorkspaceCollection,
  saveWorkspaceCollectionToBackend,
} from "./workspace-api";

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

export async function loadPersistedWorkspaceCollection(userId: string) {
  if (!isWorkspaceBackendEnabled()) {
    const localCollection = loadUserDashboardCollection(userId);

    if (env.useMockData && localCollection.dashboards.length === 0) {
      const legacyMockCollection = readLegacyMockWorkspaceCollection(userId);

      if (legacyMockCollection?.dashboards.length) {
        const migratedCollection = saveUserDashboardCollection(userId, legacyMockCollection);
        clearLegacyMockWorkspaceCollection(userId);
        return migratedCollection;
      }
    }

    return localCollection;
  }

  return fetchWorkspaceCollectionFromBackend();
}

export async function savePersistedWorkspaceCollection(
  userId: string,
  previousCollection: UserDashboardCollection,
  nextCollection: UserDashboardCollection,
) {
  if (!isWorkspaceBackendEnabled()) {
    return saveUserDashboardCollection(userId, nextCollection);
  }

  return saveWorkspaceCollectionToBackend(previousCollection, nextCollection);
}
