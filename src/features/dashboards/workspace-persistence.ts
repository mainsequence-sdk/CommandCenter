import {
  loadUserDashboardCollection,
  saveUserDashboardCollection,
  type UserDashboardCollection,
} from "./custom-dashboard-storage";
import {
  fetchWorkspaceCollectionFromBackend,
  hasConfiguredWorkspaceBackend,
  saveWorkspaceCollectionToBackend,
} from "./workspace-api";

export type WorkspacePersistenceMode = "backend" | "local";

export function getWorkspacePersistenceMode(): WorkspacePersistenceMode {
  return hasConfiguredWorkspaceBackend() ? "backend" : "local";
}

export function isWorkspaceBackendEnabled() {
  return getWorkspacePersistenceMode() === "backend";
}

export async function loadPersistedWorkspaceCollection(userId: string) {
  if (!isWorkspaceBackendEnabled()) {
    return loadUserDashboardCollection(userId);
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
