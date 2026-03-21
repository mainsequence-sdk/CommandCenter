import { create } from "zustand";

import {
  cloneDashboardCollection,
  ensureUserDashboardCollectionSelection,
  normalizeDashboardDefinition,
  saveUserDashboardCollection,
  type UserDashboardCollection,
} from "./custom-dashboard-storage";
import {
  loadPersistedWorkspaceCollection,
  isWorkspaceBackendEnabled,
  savePersistedWorkspaceCollection,
} from "./workspace-persistence";
import type { DashboardDefinition } from "@/dashboards/types";
import { createWorkspaceInBackend, deleteWorkspaceInBackend } from "./workspace-api";

interface CustomWorkspaceStudioState {
  initializedUserId: string | null;
  hydratingUserId: string | null;
  savedCollection: UserDashboardCollection;
  draftCollection: UserDashboardCollection;
  isHydrating: boolean;
  isSaving: boolean;
  error: string | null;
  initialize: (userId: string | null) => Promise<void>;
  updateDraftCollection: (
    updater: (collection: UserDashboardCollection) => UserDashboardCollection,
  ) => void;
  createWorkspace: (
    workspace: DashboardDefinition,
  ) => Promise<DashboardDefinition | null>;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
  resetDraftCollection: () => void;
  saveDraftCollection: () => Promise<UserDashboardCollection | null>;
}

function createEmptyCollection(): UserDashboardCollection {
  return {
    version: 1,
    dashboards: [],
    selectedDashboardId: null,
    savedAt: null,
  };
}

function readWorkspaceStoreError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to sync workspaces.";
}

function serializeCollection(collection: UserDashboardCollection) {
  return JSON.stringify(collection);
}

function prependWorkspace(
  collection: UserDashboardCollection,
  workspace: DashboardDefinition,
  options?: {
    allowEmpty?: boolean;
    savedAt?: string | null;
  },
) {
  return ensureUserDashboardCollectionSelection(
    {
      ...collection,
      dashboards: [
        workspace,
        ...collection.dashboards.filter((dashboard) => dashboard.id !== workspace.id),
      ],
      selectedDashboardId: workspace.id,
      savedAt: options?.savedAt ?? collection.savedAt,
    },
    {
      allowEmpty: options?.allowEmpty ?? false,
    },
  );
}

function removeWorkspace(
  collection: UserDashboardCollection,
  workspaceId: string,
  options?: {
    allowEmpty?: boolean;
    savedAt?: string | null;
  },
) {
  return ensureUserDashboardCollectionSelection(
    {
      ...collection,
      dashboards: collection.dashboards.filter((dashboard) => dashboard.id !== workspaceId),
      selectedDashboardId:
        collection.selectedDashboardId === workspaceId
          ? null
          : collection.selectedDashboardId,
      savedAt: options?.savedAt ?? collection.savedAt,
    },
    {
      allowEmpty: options?.allowEmpty ?? false,
    },
  );
}

export const useCustomWorkspaceStudioStore = create<CustomWorkspaceStudioState>((set, get) => ({
  initializedUserId: null,
  hydratingUserId: null,
  savedCollection: createEmptyCollection(),
  draftCollection: createEmptyCollection(),
  isHydrating: false,
  isSaving: false,
  error: null,
  async initialize(userId) {
    if (!userId) {
      set({
        initializedUserId: null,
        hydratingUserId: null,
        savedCollection: createEmptyCollection(),
        draftCollection: createEmptyCollection(),
        isHydrating: false,
        isSaving: false,
        error: null,
      });
      return;
    }

    const current = get();

    if (current.initializedUserId === userId || current.hydratingUserId === userId) {
      return;
    }

    set({
      hydratingUserId: userId,
      isHydrating: true,
      error: null,
    });

    try {
      const loaded = await loadPersistedWorkspaceCollection(userId);

      if (get().hydratingUserId !== userId) {
        return;
      }

      set({
        initializedUserId: userId,
        hydratingUserId: null,
        savedCollection: loaded,
        draftCollection: cloneDashboardCollection(loaded),
        isHydrating: false,
        error: null,
      });
    } catch (error) {
      if (get().hydratingUserId !== userId) {
        return;
      }

      set({
        initializedUserId: null,
        hydratingUserId: null,
        savedCollection: createEmptyCollection(),
        draftCollection: createEmptyCollection(),
        isHydrating: false,
        error: readWorkspaceStoreError(error),
      });
    }
  },
  updateDraftCollection(updater) {
    set((current) => ({
      draftCollection: (() => {
        const nextDraftCollection = ensureUserDashboardCollectionSelection(
          updater(cloneDashboardCollection(current.draftCollection)),
          {
            allowEmpty: isWorkspaceBackendEnabled(),
          },
        );

        return JSON.stringify(nextDraftCollection) === JSON.stringify(current.draftCollection)
          ? current.draftCollection
          : nextDraftCollection;
      })(),
    }));
  },
  async createWorkspace(workspace) {
    const normalizedWorkspace = normalizeDashboardDefinition(workspace);

    if (!isWorkspaceBackendEnabled()) {
      set((current) => ({
        draftCollection: prependWorkspace(current.draftCollection, normalizedWorkspace),
        error: null,
      }));

      return normalizedWorkspace;
    }

    const current = get();

    if (!current.initializedUserId || current.isSaving) {
      return null;
    }

    set({
      isSaving: true,
      error: null,
    });

    try {
      const persistedWorkspace = await createWorkspaceInBackend(normalizedWorkspace);
      const savedAt = new Date().toISOString();

      set((state) => ({
        savedCollection: prependWorkspace(state.savedCollection, persistedWorkspace, {
          allowEmpty: true,
          savedAt,
        }),
        draftCollection: prependWorkspace(state.draftCollection, persistedWorkspace, {
          allowEmpty: true,
          savedAt,
        }),
        isSaving: false,
        error: null,
      }));

      return persistedWorkspace;
    } catch (error) {
      set({
        isSaving: false,
        error: readWorkspaceStoreError(error),
      });

      return null;
    }
  },
  async deleteWorkspace(workspaceId) {
    const current = get();
    const backendEnabled = isWorkspaceBackendEnabled();
    const savedWorkspace = current.savedCollection.dashboards.find(
      (dashboard) => dashboard.id === workspaceId,
    );

    if (current.isSaving || !current.initializedUserId) {
      return false;
    }

    const allowEmpty = backendEnabled;
    const savedAt = new Date().toISOString();
    const nextSavedCollection = removeWorkspace(current.savedCollection, workspaceId, {
      allowEmpty,
      savedAt,
    });
    const nextDraftCollection = removeWorkspace(current.draftCollection, workspaceId, {
      allowEmpty,
      savedAt,
    });

    set({
      isSaving: true,
      error: null,
    });

    try {
      if (backendEnabled) {
        if (!savedWorkspace) {
          throw new Error(
            `Workspace ${workspaceId} is not loaded from the backend. Refresh the workspace list and try again.`,
          );
        }

        await deleteWorkspaceInBackend(savedWorkspace.id);
        const reloadedCollection = await loadPersistedWorkspaceCollection(
          current.initializedUserId,
        );

        set({
          savedCollection: reloadedCollection,
          draftCollection: cloneDashboardCollection(reloadedCollection),
          isSaving: false,
          error: null,
        });

        return true;
      }

      const persistedSavedCollection = saveUserDashboardCollection(
        current.initializedUserId!,
        nextSavedCollection,
      );

      set((state) => ({
        savedCollection: persistedSavedCollection,
        draftCollection: removeWorkspace(state.draftCollection, workspaceId, {
          allowEmpty,
          savedAt: persistedSavedCollection.savedAt,
        }),
        isSaving: false,
        error: null,
      }));

      return true;
    } catch (error) {
      set({
        isSaving: false,
        error: readWorkspaceStoreError(error),
      });

      return false;
    }
  },
  resetDraftCollection() {
    set((current) => ({
      draftCollection: cloneDashboardCollection(current.savedCollection),
    }));
  },
  async saveDraftCollection() {
    const current = get();

    if (!current.initializedUserId || current.isSaving) {
      return null;
    }

    set({
      isSaving: true,
      error: null,
    });

    try {
      const normalized = await savePersistedWorkspaceCollection(
        current.initializedUserId,
        current.savedCollection,
        current.draftCollection,
      );

      set((state) => ({
        savedCollection: normalized,
        draftCollection:
          serializeCollection(state.draftCollection) === serializeCollection(current.draftCollection)
            ? cloneDashboardCollection(normalized)
            : state.draftCollection,
        isSaving: false,
        error: null,
      }));

      return normalized;
    } catch (error) {
      set({
        isSaving: false,
        error: readWorkspaceStoreError(error),
      });

      return null;
    }
  },
}));
