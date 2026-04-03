import { create } from "zustand";

import {
  cloneDashboardCollection,
  ensureUserDashboardCollectionSelection,
  sanitizeDashboardDefinition,
  saveUserDashboardCollection,
  type UserDashboardCollection,
} from "./custom-dashboard-storage";
import {
  loadPersistedWorkspaceCollection,
  loadPersistedWorkspaceDetail,
  loadPersistedWorkspaceListSummaries,
  isWorkspaceBackendEnabled,
  savePersistedWorkspace,
} from "./workspace-persistence";
import type { DashboardDefinition } from "@/dashboards/types";
import { createWorkspaceInBackend, deleteWorkspaceInBackend } from "./workspace-api";
import {
  summarizeDashboardForWorkspaceList,
  type WorkspaceListItemSummary,
} from "./workspace-list-summary";

interface CustomWorkspaceStudioState {
  initializedUserId: string | null;
  hydratingUserId: string | null;
  savedCollection: UserDashboardCollection;
  draftCollection: UserDashboardCollection;
  workspaceListItems: WorkspaceListItemSummary[];
  workspaceEditorModeById: Record<string, boolean>;
  isHydrating: boolean;
  isSaving: boolean;
  loadingWorkspaceId: string | null;
  workspaceLoadErrorById: Record<string, string>;
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
  saveWorkspace: (workspaceId: string) => Promise<DashboardDefinition | null>;
  loadWorkspaceDetail: (workspaceId: string) => Promise<DashboardDefinition | null>;
  setWorkspaceEditing: (workspaceId: string, editing: boolean) => void;
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

function serializeWorkspace(workspace: DashboardDefinition | null | undefined) {
  return workspace ? JSON.stringify(sanitizeDashboardDefinition(workspace)) : null;
}

function upsertWorkspaceListItem(
  items: WorkspaceListItemSummary[],
  item: WorkspaceListItemSummary,
) {
  return [item, ...items.filter((entry) => entry.id !== item.id)];
}

function removeWorkspaceListItem(
  items: WorkspaceListItemSummary[],
  workspaceId: string,
) {
  return items.filter((entry) => entry.id !== workspaceId);
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

function upsertWorkspace(
  collection: UserDashboardCollection,
  workspace: DashboardDefinition,
  options?: {
    allowEmpty?: boolean;
    savedAt?: string | null;
  },
) {
  const normalizedWorkspace = sanitizeDashboardDefinition(workspace);
  const dashboards = collection.dashboards.some((entry) => entry.id === normalizedWorkspace.id)
    ? collection.dashboards.map((entry) =>
        entry.id === normalizedWorkspace.id ? normalizedWorkspace : entry,
      )
    : [normalizedWorkspace, ...collection.dashboards];

  return ensureUserDashboardCollectionSelection(
    {
      ...collection,
      dashboards,
      selectedDashboardId: normalizedWorkspace.id,
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
  workspaceListItems: [],
  workspaceEditorModeById: {},
  isHydrating: false,
  isSaving: false,
  loadingWorkspaceId: null,
  workspaceLoadErrorById: {},
  error: null,
  async initialize(userId) {
    if (!userId) {
      set({
        initializedUserId: null,
        hydratingUserId: null,
        savedCollection: createEmptyCollection(),
        draftCollection: createEmptyCollection(),
        workspaceListItems: [],
        workspaceEditorModeById: {},
        isHydrating: false,
        isSaving: false,
        loadingWorkspaceId: null,
        workspaceLoadErrorById: {},
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
      const backendEnabled = isWorkspaceBackendEnabled();
      const loaded = backendEnabled
        ? createEmptyCollection()
        : await loadPersistedWorkspaceCollection(userId);
      const workspaceListItems = await loadPersistedWorkspaceListSummaries(userId);

      if (get().hydratingUserId !== userId) {
        return;
      }

      set({
        initializedUserId: userId,
        hydratingUserId: null,
        savedCollection: loaded,
        draftCollection: cloneDashboardCollection(loaded),
        workspaceListItems,
        workspaceEditorModeById: {},
        isHydrating: false,
        loadingWorkspaceId: null,
        workspaceLoadErrorById: {},
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
        workspaceListItems: [],
        workspaceEditorModeById: {},
        isHydrating: false,
        loadingWorkspaceId: null,
        workspaceLoadErrorById: {},
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
    const normalizedWorkspace = sanitizeDashboardDefinition(workspace);

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
      const workspaceListItem = summarizeDashboardForWorkspaceList(persistedWorkspace, {
        updatedAt: savedAt,
      });

      set((state) => ({
        savedCollection: prependWorkspace(state.savedCollection, persistedWorkspace, {
          allowEmpty: true,
          savedAt,
        }),
        draftCollection: prependWorkspace(state.draftCollection, persistedWorkspace, {
          allowEmpty: true,
          savedAt,
        }),
        workspaceListItems: upsertWorkspaceListItem(state.workspaceListItems, workspaceListItem),
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
        await deleteWorkspaceInBackend(workspaceId);
        const reloadedWorkspaceListItems = await loadPersistedWorkspaceListSummaries(
          current.initializedUserId,
        );

        set({
          savedCollection: nextSavedCollection,
          draftCollection: nextDraftCollection,
          workspaceListItems: reloadedWorkspaceListItems,
          workspaceEditorModeById: Object.fromEntries(
            Object.entries(current.workspaceEditorModeById).filter(([id]) => id !== workspaceId),
          ),
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
        workspaceListItems: removeWorkspaceListItem(state.workspaceListItems, workspaceId),
        workspaceEditorModeById: Object.fromEntries(
          Object.entries(state.workspaceEditorModeById).filter(([id]) => id !== workspaceId),
        ),
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
  async saveWorkspace(workspaceId) {
    const current = get();

    if (!current.initializedUserId || current.isSaving) {
      return null;
    }

    const draftWorkspace =
      current.draftCollection.dashboards.find((dashboard) => dashboard.id === workspaceId) ?? null;

    if (!draftWorkspace) {
      set({
        error: `Workspace ${workspaceId} is not available in the current draft.`,
      });
      return null;
    }

    const draftWorkspaceSignature = serializeWorkspace(draftWorkspace);

    set({
      isSaving: true,
      error: null,
    });

    try {
      const savedWorkspace = await savePersistedWorkspace(
        current.initializedUserId,
        current.savedCollection,
        draftWorkspace,
      );
      const savedAt = new Date().toISOString();
      const workspaceListItem = summarizeDashboardForWorkspaceList(savedWorkspace, {
        updatedAt: savedAt,
      });

      set((state) => ({
        savedCollection: upsertWorkspace(state.savedCollection, savedWorkspace, {
          allowEmpty: true,
          savedAt,
        }),
        draftCollection:
          serializeWorkspace(
            state.draftCollection.dashboards.find((dashboard) => dashboard.id === workspaceId) ??
              null,
          ) === draftWorkspaceSignature
            ? upsertWorkspace(state.draftCollection, savedWorkspace, {
                allowEmpty: true,
                savedAt,
              })
            : state.draftCollection,
        workspaceListItems: upsertWorkspaceListItem(state.workspaceListItems, workspaceListItem),
        isSaving: false,
        error: null,
      }));

      return savedWorkspace;
    } catch (error) {
      set({
        isSaving: false,
        error: readWorkspaceStoreError(error),
      });

      return null;
    }
  },
  async loadWorkspaceDetail(workspaceId) {
    const current = get();

    if (!current.initializedUserId) {
      return null;
    }

    if (!isWorkspaceBackendEnabled()) {
      return (
        current.draftCollection.dashboards.find((dashboard) => dashboard.id === workspaceId) ?? null
      );
    }

    const savedWorkspace =
      current.savedCollection.dashboards.find((dashboard) => dashboard.id === workspaceId) ?? null;

    if (savedWorkspace) {
      return savedWorkspace;
    }

    const draftWorkspace =
      current.draftCollection.dashboards.find((dashboard) => dashboard.id === workspaceId) ?? null;

    if (draftWorkspace) {
      return draftWorkspace;
    }

    if (current.loadingWorkspaceId === workspaceId) {
      return null;
    }

    set((state) => ({
      loadingWorkspaceId: workspaceId,
      workspaceLoadErrorById: Object.fromEntries(
        Object.entries(state.workspaceLoadErrorById).filter(([id]) => id !== workspaceId),
      ),
      error: null,
    }));

    try {
      const loadedWorkspace = await loadPersistedWorkspaceDetail(current.initializedUserId, workspaceId);

      if (!loadedWorkspace) {
        throw new Error(`Workspace ${workspaceId} was not found.`);
      }

      set((state) => ({
        savedCollection: upsertWorkspace(state.savedCollection, loadedWorkspace, {
          allowEmpty: true,
          savedAt: state.savedCollection.savedAt,
        }),
        draftCollection: upsertWorkspace(state.draftCollection, loadedWorkspace, {
          allowEmpty: true,
          savedAt: state.draftCollection.savedAt,
        }),
        workspaceListItems: upsertWorkspaceListItem(
          state.workspaceListItems,
          summarizeDashboardForWorkspaceList(loadedWorkspace),
        ),
        loadingWorkspaceId: null,
        workspaceLoadErrorById: Object.fromEntries(
          Object.entries(state.workspaceLoadErrorById).filter(([id]) => id !== workspaceId),
        ),
        error: null,
      }));

      return loadedWorkspace;
    } catch (error) {
      const message = readWorkspaceStoreError(error);

      set((state) => ({
        loadingWorkspaceId: null,
        workspaceLoadErrorById: {
          ...state.workspaceLoadErrorById,
          [workspaceId]: message,
        },
        error: message,
      }));

      return null;
    }
  },
  setWorkspaceEditing(workspaceId, editing) {
    set((current) => {
      const currentValue = current.workspaceEditorModeById[workspaceId] ?? false;

      if (currentValue === editing) {
        return current;
      }

      return {
        workspaceEditorModeById: {
          ...current.workspaceEditorModeById,
          [workspaceId]: editing,
        },
      };
    });
  },
}));
