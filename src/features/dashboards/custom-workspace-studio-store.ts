import { create } from "zustand";

import {
  sanitizeDashboardDefinition,
  saveUserDashboardCollection,
  type UserDashboardCollection,
} from "./custom-dashboard-storage";
import {
  loadPersistedWorkspaceCollection,
  loadPersistedWorkspaceDetail,
  loadPersistedWorkspaceListSummaries,
  loadPersistedWorkspaceUserState,
  isWorkspaceBackendEnabled,
  savePersistedWorkspace,
} from "./workspace-persistence";
import type { DashboardDefinition } from "@/dashboards/types";
import {
  createWorkspaceInBackend,
  deleteWorkspaceInBackend,
  isWorkspaceBackendNotFoundError,
} from "./workspace-api";
import {
  summarizeDashboardForWorkspaceList,
  type WorkspaceListItemSummary,
} from "./workspace-list-summary";
import {
  applyWorkspaceUserStateToDashboard,
  extractWorkspaceUserStateFromDashboard,
} from "./workspace-user-state";

interface CustomWorkspaceStudioState {
  initializedUserId: string | null;
  hydratingUserId: string | null;
  selectedWorkspaceId: string | null;
  savedWorkspaceById: Record<string, DashboardDefinition>;
  draftWorkspaceById: Record<string, DashboardDefinition>;
  workspaceListItems: WorkspaceListItemSummary[];
  workspaceListHydrated: boolean;
  dirtyWorkspaceIds: Record<string, boolean>;
  workspaceDraftRevisionById: Record<string, number>;
  workspaceUserStateRevisionById: Record<string, number>;
  workspaceEditorModeById: Record<string, boolean>;
  isHydrating: boolean;
  isSaving: boolean;
  loadingWorkspaceId: string | null;
  workspaceLoadErrorById: Record<string, string>;
  missingWorkspaceIds: Record<string, boolean>;
  error: string | null;
  initialize: (
    userId: string | null,
    options?: {
      preloadList?: boolean;
    },
  ) => Promise<void>;
  updateWorkspaceDraft: (
    workspaceId: string,
    updater: (workspace: DashboardDefinition) => DashboardDefinition,
    options?: {
      markDirty?: boolean;
    },
  ) => void;
  updateWorkspaceUserState: (
    workspaceId: string,
    updater: (workspace: DashboardDefinition) => DashboardDefinition,
    options?: {
      bumpRevision?: boolean;
    },
  ) => void;
  setSelectedWorkspaceId: (workspaceId: string | null) => void;
  createWorkspace: (
    workspace: DashboardDefinition,
  ) => Promise<DashboardDefinition | null>;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
  resetWorkspaceDraft: (workspaceId: string) => void;
  saveWorkspace: (workspaceId: string) => Promise<DashboardDefinition | null>;
  loadWorkspaceDetail: (workspaceId: string) => Promise<DashboardDefinition | null>;
  setWorkspaceEditing: (workspaceId: string, editing: boolean) => void;
}

function cloneWorkspace<T extends DashboardDefinition>(workspace: T): T {
  return JSON.parse(JSON.stringify(workspace)) as T;
}

function buildWorkspaceMap(
  workspaces: DashboardDefinition[],
): Record<string, DashboardDefinition> {
  return Object.fromEntries(
    workspaces.map((workspace) => [workspace.id, cloneWorkspace(workspace)]),
  );
}

function buildPersistedCollection(
  workspaceById: Record<string, DashboardDefinition>,
  workspaceListItems: WorkspaceListItemSummary[],
  selectedWorkspaceId: string | null,
): UserDashboardCollection {
  const orderedIds = [
    ...workspaceListItems.map((workspace) => workspace.id),
    ...Object.keys(workspaceById).filter(
      (workspaceId) => !workspaceListItems.some((workspace) => workspace.id === workspaceId),
    ),
  ];
  const dashboards = orderedIds.flatMap((workspaceId) =>
    workspaceById[workspaceId] ? [workspaceById[workspaceId]] : [],
  );

  return {
    version: 1,
    dashboards,
    selectedDashboardId:
      selectedWorkspaceId && workspaceById[selectedWorkspaceId]
        ? selectedWorkspaceId
        : dashboards[0]?.id ?? null,
    savedAt: null,
  };
}

function createEmptyWorkspaceMap(): Record<string, DashboardDefinition> {
  return {};
}

function readWorkspaceStoreError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to sync workspaces.";
}

function upsertWorkspaceListItem(
  items: WorkspaceListItemSummary[],
  item: WorkspaceListItemSummary,
) {
  return [item, ...items.filter((entry) => entry.id !== item.id)];
}

function replaceWorkspaceListItem(
  items: WorkspaceListItemSummary[],
  item: WorkspaceListItemSummary,
) {
  const index = items.findIndex((entry) => entry.id === item.id);

  if (index === -1) {
    return [item, ...items];
  }

  const nextItems = [...items];
  nextItems[index] = item;
  return nextItems;
}

function removeWorkspaceListItem(
  items: WorkspaceListItemSummary[],
  workspaceId: string,
) {
  return items.filter((entry) => entry.id !== workspaceId);
}

function markWorkspaceIdsDirty(
  current: Record<string, boolean>,
  workspaceIds: string[],
  dirty: boolean,
) {
  if (workspaceIds.length === 0) {
    return current;
  }

  const next = { ...current };

  workspaceIds.forEach((workspaceId) => {
    if (!workspaceId) {
      return;
    }

    if (dirty) {
      next[workspaceId] = true;
      return;
    }

    delete next[workspaceId];
  });

  return next;
}

function bumpWorkspaceDraftRevisions(
  current: Record<string, number>,
  workspaceIds: string[],
) {
  if (workspaceIds.length === 0) {
    return current;
  }

  const next = { ...current };

  workspaceIds.forEach((workspaceId) => {
    if (!workspaceId) {
      return;
    }

    next[workspaceId] = (next[workspaceId] ?? 0) + 1;
  });

  return next;
}

function clearWorkspaceDraftRevisions(
  current: Record<string, number>,
  workspaceIds: string[],
) {
  if (workspaceIds.length === 0) {
    return current;
  }

  const next = { ...current };

  workspaceIds.forEach((workspaceId) => {
    delete next[workspaceId];
  });

  return next;
}

function upsertWorkspaceMap(
  current: Record<string, DashboardDefinition>,
  workspace: DashboardDefinition,
) {
  return {
    ...current,
    [workspace.id]: sanitizeDashboardDefinition(workspace),
  };
}

function removeWorkspaceMap(
  current: Record<string, DashboardDefinition>,
  workspaceId: string,
) {
  if (!current[workspaceId]) {
    return current;
  }

  const next = { ...current };
  delete next[workspaceId];
  return next;
}

export const useCustomWorkspaceStudioStore = create<CustomWorkspaceStudioState>((set, get) => ({
  initializedUserId: null,
  hydratingUserId: null,
  selectedWorkspaceId: null,
  savedWorkspaceById: createEmptyWorkspaceMap(),
  draftWorkspaceById: createEmptyWorkspaceMap(),
  workspaceListItems: [],
  workspaceListHydrated: false,
  dirtyWorkspaceIds: {},
  workspaceDraftRevisionById: {},
  workspaceUserStateRevisionById: {},
  workspaceEditorModeById: {},
  isHydrating: false,
  isSaving: false,
  loadingWorkspaceId: null,
  workspaceLoadErrorById: {},
  missingWorkspaceIds: {},
  error: null,
  async initialize(userId, options) {
    if (!userId) {
      set({
        initializedUserId: null,
        hydratingUserId: null,
        selectedWorkspaceId: null,
        savedWorkspaceById: createEmptyWorkspaceMap(),
        draftWorkspaceById: createEmptyWorkspaceMap(),
        workspaceListItems: [],
        workspaceListHydrated: false,
        dirtyWorkspaceIds: {},
        workspaceDraftRevisionById: {},
        workspaceUserStateRevisionById: {},
        workspaceEditorModeById: {},
        isHydrating: false,
        isSaving: false,
        loadingWorkspaceId: null,
        workspaceLoadErrorById: {},
        missingWorkspaceIds: {},
        error: null,
      });
      return;
    }

    const current = get();
    const shouldPreloadList = options?.preloadList ?? true;

    if (
        current.hydratingUserId === userId ||
      (
        current.initializedUserId === userId &&
        (!shouldPreloadList || !isWorkspaceBackendEnabled() || current.workspaceListHydrated)
      )
    ) {
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
        ? buildPersistedCollection(createEmptyWorkspaceMap(), [], null)
        : await loadPersistedWorkspaceCollection(userId);
      const workspaceListItems = shouldPreloadList
        ? await loadPersistedWorkspaceListSummaries(userId)
        : current.workspaceListItems;

      if (get().hydratingUserId !== userId) {
        return;
      }

      set({
        initializedUserId: userId,
        hydratingUserId: null,
        selectedWorkspaceId: loaded.selectedDashboardId,
        savedWorkspaceById: buildWorkspaceMap(loaded.dashboards),
        draftWorkspaceById: buildWorkspaceMap(loaded.dashboards),
        workspaceListItems,
        workspaceListHydrated: shouldPreloadList || !backendEnabled,
        dirtyWorkspaceIds: {},
        workspaceDraftRevisionById: {},
        workspaceUserStateRevisionById: {},
        workspaceEditorModeById: {},
        isHydrating: false,
        loadingWorkspaceId: null,
        workspaceLoadErrorById: {},
        missingWorkspaceIds: {},
        error: null,
      });
    } catch (error) {
      if (get().hydratingUserId !== userId) {
        return;
      }

      set({
        initializedUserId: null,
        hydratingUserId: null,
        selectedWorkspaceId: null,
        savedWorkspaceById: createEmptyWorkspaceMap(),
        draftWorkspaceById: createEmptyWorkspaceMap(),
        workspaceListItems: [],
        workspaceListHydrated: false,
        dirtyWorkspaceIds: {},
        workspaceDraftRevisionById: {},
        workspaceUserStateRevisionById: {},
        workspaceEditorModeById: {},
        isHydrating: false,
        loadingWorkspaceId: null,
        workspaceLoadErrorById: {},
        missingWorkspaceIds: {},
        error: readWorkspaceStoreError(error),
      });
    }
  },
  updateWorkspaceDraft(workspaceId, updater, options) {
    set((current) => {
      const currentWorkspace = current.draftWorkspaceById[workspaceId] ?? null;

      if (!currentWorkspace) {
        return current;
      }

      const updatedWorkspace = updater(currentWorkspace);

      if (updatedWorkspace === currentWorkspace) {
        return current;
      }

      const nextWorkspace = sanitizeDashboardDefinition({
        ...updatedWorkspace,
        id: workspaceId,
      });

      return {
        draftWorkspaceById: {
          ...current.draftWorkspaceById,
          [workspaceId]: nextWorkspace,
        },
        workspaceListItems: isWorkspaceBackendEnabled()
          ? current.workspaceListItems
          : replaceWorkspaceListItem(
              current.workspaceListItems,
              summarizeDashboardForWorkspaceList(nextWorkspace, {
                updatedAt:
                  current.workspaceListItems.find((entry) => entry.id === workspaceId)?.updatedAt ?? null,
              }),
            ),
        dirtyWorkspaceIds:
          options?.markDirty === false
            ? current.dirtyWorkspaceIds
            : markWorkspaceIdsDirty(current.dirtyWorkspaceIds, [workspaceId], true),
        workspaceDraftRevisionById:
          options?.markDirty === false
            ? current.workspaceDraftRevisionById
            : bumpWorkspaceDraftRevisions(current.workspaceDraftRevisionById, [workspaceId]),
      };
    });
  },
  updateWorkspaceUserState(workspaceId, updater, options) {
    set((current) => {
      const savedWorkspace = current.savedWorkspaceById[workspaceId] ?? null;
      const draftWorkspace = current.draftWorkspaceById[workspaceId] ?? null;

      if (!savedWorkspace && !draftWorkspace) {
        return current;
      }

      const nextSavedWorkspace = savedWorkspace ? updater(savedWorkspace) : null;
      const nextDraftWorkspace = draftWorkspace ? updater(draftWorkspace) : null;
      const savedChanged = Boolean(savedWorkspace && nextSavedWorkspace !== savedWorkspace);
      const draftChanged = Boolean(draftWorkspace && nextDraftWorkspace !== draftWorkspace);

      if (!savedChanged && !draftChanged) {
        return current;
      }

      return {
        savedWorkspaceById:
          savedChanged && nextSavedWorkspace
            ? {
                ...current.savedWorkspaceById,
                [workspaceId]: sanitizeDashboardDefinition({
                  ...nextSavedWorkspace,
                  id: workspaceId,
                }),
              }
            : current.savedWorkspaceById,
        draftWorkspaceById:
          draftChanged && nextDraftWorkspace
            ? {
                ...current.draftWorkspaceById,
                [workspaceId]: sanitizeDashboardDefinition({
                  ...nextDraftWorkspace,
                  id: workspaceId,
                }),
              }
            : current.draftWorkspaceById,
        workspaceUserStateRevisionById:
          options?.bumpRevision === false
            ? current.workspaceUserStateRevisionById
            : bumpWorkspaceDraftRevisions(current.workspaceUserStateRevisionById, [workspaceId]),
      };
    });
  },
  setSelectedWorkspaceId(workspaceId) {
    set((current) =>
      current.selectedWorkspaceId === workspaceId
        ? current
        : {
            selectedWorkspaceId: workspaceId,
          },
    );
  },
  async createWorkspace(workspace) {
    const normalizedWorkspace = sanitizeDashboardDefinition(workspace);

    if (!isWorkspaceBackendEnabled()) {
      set((current) => ({
        selectedWorkspaceId: normalizedWorkspace.id,
        draftWorkspaceById: {
          ...current.draftWorkspaceById,
          [normalizedWorkspace.id]: normalizedWorkspace,
        },
        workspaceListItems: upsertWorkspaceListItem(
          current.workspaceListItems,
          summarizeDashboardForWorkspaceList(normalizedWorkspace),
        ),
        workspaceListHydrated: current.workspaceListHydrated,
        dirtyWorkspaceIds: markWorkspaceIdsDirty(
          current.dirtyWorkspaceIds,
          [normalizedWorkspace.id],
          true,
        ),
        workspaceDraftRevisionById: bumpWorkspaceDraftRevisions(
          current.workspaceDraftRevisionById,
          [normalizedWorkspace.id],
        ),
        workspaceUserStateRevisionById: current.workspaceUserStateRevisionById,
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
        selectedWorkspaceId: persistedWorkspace.id,
        savedWorkspaceById: upsertWorkspaceMap(state.savedWorkspaceById, persistedWorkspace),
        draftWorkspaceById: upsertWorkspaceMap(state.draftWorkspaceById, persistedWorkspace),
        workspaceListItems: upsertWorkspaceListItem(state.workspaceListItems, workspaceListItem),
        workspaceListHydrated: state.workspaceListHydrated,
        dirtyWorkspaceIds: markWorkspaceIdsDirty(state.dirtyWorkspaceIds, [persistedWorkspace.id], false),
        workspaceDraftRevisionById: clearWorkspaceDraftRevisions(
          state.workspaceDraftRevisionById,
          [persistedWorkspace.id],
        ),
        workspaceUserStateRevisionById: state.workspaceUserStateRevisionById,
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

    const nextSelectedWorkspaceId =
      current.selectedWorkspaceId === workspaceId ? null : current.selectedWorkspaceId;

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
          selectedWorkspaceId: nextSelectedWorkspaceId,
          savedWorkspaceById: removeWorkspaceMap(current.savedWorkspaceById, workspaceId),
          draftWorkspaceById: removeWorkspaceMap(current.draftWorkspaceById, workspaceId),
          workspaceListItems: reloadedWorkspaceListItems,
          workspaceListHydrated: true,
          dirtyWorkspaceIds: markWorkspaceIdsDirty(current.dirtyWorkspaceIds, [workspaceId], false),
          workspaceDraftRevisionById: clearWorkspaceDraftRevisions(
            current.workspaceDraftRevisionById,
            [workspaceId],
          ),
          workspaceUserStateRevisionById: clearWorkspaceDraftRevisions(
            current.workspaceUserStateRevisionById,
            [workspaceId],
          ),
          workspaceEditorModeById: Object.fromEntries(
            Object.entries(current.workspaceEditorModeById).filter(([id]) => id !== workspaceId),
          ),
          isSaving: false,
          error: null,
        });

        return true;
      }

      const nextSavedWorkspaceById = removeWorkspaceMap(current.savedWorkspaceById, workspaceId);
      const nextDraftWorkspaceById = removeWorkspaceMap(current.draftWorkspaceById, workspaceId);
      const nextWorkspaceListItems = removeWorkspaceListItem(current.workspaceListItems, workspaceId);
      const persistedSavedCollection = saveUserDashboardCollection(
        current.initializedUserId!,
        buildPersistedCollection(
          nextSavedWorkspaceById,
          nextWorkspaceListItems,
          nextSelectedWorkspaceId,
        ),
      );

      set((state) => ({
        selectedWorkspaceId: nextSelectedWorkspaceId,
        savedWorkspaceById: buildWorkspaceMap(persistedSavedCollection.dashboards),
        draftWorkspaceById: nextDraftWorkspaceById,
        workspaceListItems: nextWorkspaceListItems,
        workspaceListHydrated: current.workspaceListHydrated,
        dirtyWorkspaceIds: markWorkspaceIdsDirty(state.dirtyWorkspaceIds, [workspaceId], false),
        workspaceDraftRevisionById: clearWorkspaceDraftRevisions(
          state.workspaceDraftRevisionById,
          [workspaceId],
        ),
        workspaceUserStateRevisionById: clearWorkspaceDraftRevisions(
          state.workspaceUserStateRevisionById,
          [workspaceId],
        ),
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
  resetWorkspaceDraft(workspaceId) {
    set((current) => {
      const savedWorkspace = current.savedWorkspaceById[workspaceId] ?? null;

      return {
        draftWorkspaceById: savedWorkspace
          ? {
              ...current.draftWorkspaceById,
              [workspaceId]: cloneWorkspace(savedWorkspace),
            }
          : removeWorkspaceMap(current.draftWorkspaceById, workspaceId),
        workspaceListItems:
          isWorkspaceBackendEnabled()
            ? current.workspaceListItems
            : savedWorkspace
              ? replaceWorkspaceListItem(
                  current.workspaceListItems,
                  summarizeDashboardForWorkspaceList(savedWorkspace, {
                    updatedAt:
                      current.workspaceListItems.find((entry) => entry.id === workspaceId)?.updatedAt ??
                      null,
                  }),
                )
              : removeWorkspaceListItem(current.workspaceListItems, workspaceId),
        workspaceListHydrated: current.workspaceListHydrated,
        dirtyWorkspaceIds: markWorkspaceIdsDirty(current.dirtyWorkspaceIds, [workspaceId], false),
        workspaceDraftRevisionById: clearWorkspaceDraftRevisions(
          current.workspaceDraftRevisionById,
          [workspaceId],
        ),
        workspaceUserStateRevisionById: current.workspaceUserStateRevisionById,
      };
    });
  },
  async saveWorkspace(workspaceId) {
    const current = get();

    if (!current.initializedUserId || current.isSaving) {
      return null;
    }

    const draftWorkspace = current.draftWorkspaceById[workspaceId] ?? null;

    if (!draftWorkspace) {
      set({
        error: `Workspace ${workspaceId} is not available in the current draft.`,
      });
      return null;
    }

    const draftWorkspaceRevision = current.workspaceDraftRevisionById[workspaceId] ?? 0;
    const draftUserState = extractWorkspaceUserStateFromDashboard(draftWorkspace);

    set({
      isSaving: true,
      error: null,
    });

    try {
      const savedWorkspace = await savePersistedWorkspace(
        current.initializedUserId,
        buildPersistedCollection(
          current.savedWorkspaceById,
          current.workspaceListItems,
          current.selectedWorkspaceId ?? workspaceId,
        ),
        draftWorkspace,
      );
      const normalizedSavedWorkspace = applyWorkspaceUserStateToDashboard(
        savedWorkspace,
        draftUserState,
      );
      const savedAt = new Date().toISOString();
      const workspaceListItem = summarizeDashboardForWorkspaceList(normalizedSavedWorkspace, {
        updatedAt: savedAt,
      });

      set((state) => ({
        selectedWorkspaceId: workspaceId,
        savedWorkspaceById: upsertWorkspaceMap(state.savedWorkspaceById, normalizedSavedWorkspace),
        draftWorkspaceById:
          (state.workspaceDraftRevisionById[workspaceId] ?? 0) === draftWorkspaceRevision
            ? upsertWorkspaceMap(state.draftWorkspaceById, normalizedSavedWorkspace)
            : state.draftWorkspaceById,
        workspaceListItems: upsertWorkspaceListItem(state.workspaceListItems, workspaceListItem),
        workspaceListHydrated: state.workspaceListHydrated,
        dirtyWorkspaceIds:
          (state.workspaceDraftRevisionById[workspaceId] ?? 0) === draftWorkspaceRevision
            ? markWorkspaceIdsDirty(state.dirtyWorkspaceIds, [workspaceId], false)
            : state.dirtyWorkspaceIds,
        workspaceDraftRevisionById:
          (state.workspaceDraftRevisionById[workspaceId] ?? 0) === draftWorkspaceRevision
            ? clearWorkspaceDraftRevisions(state.workspaceDraftRevisionById, [workspaceId])
            : state.workspaceDraftRevisionById,
        workspaceUserStateRevisionById: state.workspaceUserStateRevisionById,
        isSaving: false,
        error: null,
      }));

      return normalizedSavedWorkspace;
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
      return current.draftWorkspaceById[workspaceId] ?? null;
    }

    const savedWorkspace = current.savedWorkspaceById[workspaceId] ?? null;

    if (savedWorkspace) {
      return savedWorkspace;
    }

    const draftWorkspace = current.draftWorkspaceById[workspaceId] ?? null;

    if (draftWorkspace) {
      return draftWorkspace;
    }

    if (current.loadingWorkspaceId === workspaceId) {
      return null;
    }

    const initialUserStateRevision =
      current.workspaceUserStateRevisionById[workspaceId] ?? 0;
    const userStatePromise = loadPersistedWorkspaceUserState(
      current.initializedUserId,
      workspaceId,
    )
      .then((loadedUserState) => {
        set((state) => {
          const savedWorkspace = state.savedWorkspaceById[workspaceId] ?? null;

          if (!savedWorkspace) {
            return state;
          }

          const nextSavedWorkspace = applyWorkspaceUserStateToDashboard(
            savedWorkspace,
            loadedUserState,
          );
          const draftWorkspaceForHydration =
            (state.workspaceUserStateRevisionById[workspaceId] ?? 0) === initialUserStateRevision
              ? (state.draftWorkspaceById[workspaceId] ?? null)
              : null;
          const nextDraftWorkspace = draftWorkspaceForHydration
            ? applyWorkspaceUserStateToDashboard(draftWorkspaceForHydration, loadedUserState)
            : null;

          if (
            nextSavedWorkspace === savedWorkspace &&
            nextDraftWorkspace === draftWorkspaceForHydration
          ) {
            return state;
          }

          return {
            savedWorkspaceById:
              nextSavedWorkspace !== savedWorkspace
                ? {
                    ...state.savedWorkspaceById,
                    [workspaceId]: sanitizeDashboardDefinition(nextSavedWorkspace),
                  }
                : state.savedWorkspaceById,
            draftWorkspaceById:
              nextDraftWorkspace && nextDraftWorkspace !== draftWorkspaceForHydration
                ? {
                    ...state.draftWorkspaceById,
                    [workspaceId]: sanitizeDashboardDefinition(nextDraftWorkspace),
                  }
                : state.draftWorkspaceById,
          };
        });
      })
      .catch((error) => {
        console.warn(
          `[workspaces] Unable to hydrate user state for workspace ${workspaceId}.`,
          error,
        );
      });

    set((state) => ({
      loadingWorkspaceId: workspaceId,
      workspaceLoadErrorById: Object.fromEntries(
        Object.entries(state.workspaceLoadErrorById).filter(([id]) => id !== workspaceId),
      ),
      missingWorkspaceIds: Object.fromEntries(
        Object.entries(state.missingWorkspaceIds).filter(([id]) => id !== workspaceId),
      ),
      error: null,
    }));

    try {
      const loadedWorkspace = await loadPersistedWorkspaceDetail(current.initializedUserId, workspaceId);

      if (!loadedWorkspace) {
        throw new Error(`Workspace ${workspaceId} was not found.`);
      }

      set((state) => {
        const existingListItem =
          state.workspaceListItems.find((entry) => entry.id === workspaceId) ?? null;

        return {
          selectedWorkspaceId: workspaceId,
          savedWorkspaceById: upsertWorkspaceMap(state.savedWorkspaceById, loadedWorkspace),
          draftWorkspaceById: upsertWorkspaceMap(state.draftWorkspaceById, loadedWorkspace),
          workspaceListItems: upsertWorkspaceListItem(
            state.workspaceListItems,
            summarizeDashboardForWorkspaceList(loadedWorkspace, {
              updatedAt: existingListItem?.updatedAt ?? null,
            }),
          ),
          workspaceListHydrated: state.workspaceListHydrated,
          dirtyWorkspaceIds: markWorkspaceIdsDirty(state.dirtyWorkspaceIds, [workspaceId], false),
          workspaceDraftRevisionById: clearWorkspaceDraftRevisions(
            state.workspaceDraftRevisionById,
            [workspaceId],
          ),
          loadingWorkspaceId: null,
          workspaceLoadErrorById: Object.fromEntries(
            Object.entries(state.workspaceLoadErrorById).filter(([id]) => id !== workspaceId),
          ),
          missingWorkspaceIds: Object.fromEntries(
            Object.entries(state.missingWorkspaceIds).filter(([id]) => id !== workspaceId),
          ),
          error: null,
        };
      });

      void userStatePromise;

      return loadedWorkspace;
    } catch (error) {
      const message = readWorkspaceStoreError(error);

      set((state) => ({
        loadingWorkspaceId: null,
        workspaceLoadErrorById: {
          ...state.workspaceLoadErrorById,
          [workspaceId]: message,
        },
        missingWorkspaceIds: isWorkspaceBackendNotFoundError(error)
          ? {
              ...state.missingWorkspaceIds,
              [workspaceId]: true,
            }
          : Object.fromEntries(
              Object.entries(state.missingWorkspaceIds).filter(([id]) => id !== workspaceId),
            ),
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
