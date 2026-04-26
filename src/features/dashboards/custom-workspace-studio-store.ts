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
  savePersistedWorkspaceUserState,
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
  workspaceUserStateHydratedById: Record<string, boolean>;
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
  saveWorkspaceUserState: (workspaceId: string) => Promise<boolean>;
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

function markWorkspaceUserStateHydratedAfterLocalUpdate(
  current: Record<string, boolean>,
  workspaceId: string,
) {
  if (isWorkspaceBackendEnabled() && !current[workspaceId]) {
    return current;
  }

  return {
    ...current,
    [workspaceId]: true,
  };
}

export const useCustomWorkspaceStudioStore = create<CustomWorkspaceStudioState>((set, get) => ({
  initializedUserId: null,
  hydratingUserId: null,
  selectedWorkspaceId: null,
  savedWorkspaceById: createEmptyWorkspaceMap(),
  draftWorkspaceById: createEmptyWorkspaceMap(),
  workspaceUserStateHydratedById: {},
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
        workspaceUserStateHydratedById: {},
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
        workspaceUserStateHydratedById: backendEnabled
          ? {}
          : Object.fromEntries(loaded.dashboards.map((dashboard) => [dashboard.id, true])),
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
        workspaceUserStateHydratedById: {},
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
        workspaceUserStateHydratedById: markWorkspaceUserStateHydratedAfterLocalUpdate(
          current.workspaceUserStateHydratedById,
          workspaceId,
        ),
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
        workspaceUserStateHydratedById: markWorkspaceUserStateHydratedAfterLocalUpdate(
          current.workspaceUserStateHydratedById,
          workspaceId,
        ),
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
        workspaceUserStateHydratedById: {
          ...state.workspaceUserStateHydratedById,
          [persistedWorkspace.id]: true,
        },
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
          workspaceUserStateHydratedById: Object.fromEntries(
            Object.entries(current.workspaceUserStateHydratedById).filter(([id]) => id !== workspaceId),
          ),
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
        workspaceUserStateHydratedById: Object.fromEntries(
          Object.entries(state.workspaceUserStateHydratedById).filter(([id]) => id !== workspaceId),
        ),
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
        workspaceUserStateHydratedById: savedWorkspace
          ? {
              ...current.workspaceUserStateHydratedById,
              [workspaceId]: true,
            }
          : Object.fromEntries(
              Object.entries(current.workspaceUserStateHydratedById).filter(([id]) => id !== workspaceId),
            ),
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
    const userStateRevision = current.workspaceUserStateRevisionById[workspaceId] ?? 0;
    const backendEnabled = isWorkspaceBackendEnabled();
    const draftUserState = extractWorkspaceUserStateFromDashboard(draftWorkspace);

    set({
      isSaving: true,
      error: null,
    });

    try {
      const shouldSaveSharedWorkspace = !backendEnabled || draftWorkspaceRevision > 0;
      const shouldSaveUserState = userStateRevision > 0;
      const savedWorkspace = shouldSaveSharedWorkspace
        ? await savePersistedWorkspace(
            current.initializedUserId,
            buildPersistedCollection(
              current.savedWorkspaceById,
              current.workspaceListItems,
              current.selectedWorkspaceId ?? workspaceId,
            ),
            draftWorkspace,
          )
        : current.savedWorkspaceById[workspaceId] ?? draftWorkspace;
      const persistedUserState =
        shouldSaveUserState && backendEnabled
          ? await savePersistedWorkspaceUserState(workspaceId, draftUserState)
          : draftUserState;
      const normalizedSavedWorkspace = applyWorkspaceUserStateToDashboard(
        savedWorkspace,
        persistedUserState,
      );
      const savedAt = new Date().toISOString();
      const workspaceListItem = summarizeDashboardForWorkspaceList(normalizedSavedWorkspace, {
        updatedAt: savedAt,
      });

      set((state) => {
        const draftRevisionMatches =
          (state.workspaceDraftRevisionById[workspaceId] ?? 0) === draftWorkspaceRevision;
        const userStateRevisionMatches =
          (state.workspaceUserStateRevisionById[workspaceId] ?? 0) === userStateRevision;
        const canReplaceDraftWorkspace = draftRevisionMatches && userStateRevisionMatches;
        const shouldClearUserStateRevision =
          userStateRevisionMatches && shouldSaveUserState;

        return {
        selectedWorkspaceId: workspaceId,
        savedWorkspaceById: upsertWorkspaceMap(state.savedWorkspaceById, normalizedSavedWorkspace),
        draftWorkspaceById:
          canReplaceDraftWorkspace
            ? upsertWorkspaceMap(state.draftWorkspaceById, normalizedSavedWorkspace)
            : state.draftWorkspaceById,
        workspaceUserStateHydratedById: {
          ...state.workspaceUserStateHydratedById,
          [workspaceId]: true,
        },
        workspaceListItems: upsertWorkspaceListItem(state.workspaceListItems, workspaceListItem),
        workspaceListHydrated: state.workspaceListHydrated,
        dirtyWorkspaceIds:
          draftRevisionMatches
            ? markWorkspaceIdsDirty(state.dirtyWorkspaceIds, [workspaceId], false)
            : state.dirtyWorkspaceIds,
        workspaceDraftRevisionById:
          draftRevisionMatches
            ? clearWorkspaceDraftRevisions(state.workspaceDraftRevisionById, [workspaceId])
            : state.workspaceDraftRevisionById,
        workspaceUserStateRevisionById: shouldClearUserStateRevision
          ? clearWorkspaceDraftRevisions(state.workspaceUserStateRevisionById, [workspaceId])
          : state.workspaceUserStateRevisionById,
        isSaving: false,
        error: null,
        };
      });

      return normalizedSavedWorkspace;
    } catch (error) {
      set({
        isSaving: false,
        error: readWorkspaceStoreError(error),
      });

      return null;
    }
  },
  async saveWorkspaceUserState(workspaceId) {
    const current = get();

    if (!current.initializedUserId) {
      return false;
    }

    const workspace =
      current.draftWorkspaceById[workspaceId] ??
      current.savedWorkspaceById[workspaceId] ??
      null;

    if (!workspace) {
      set({
        error: `Workspace ${workspaceId} is not available in the current draft.`,
      });
      return false;
    }

    if (!isWorkspaceBackendEnabled()) {
      return true;
    }

    const userStateRevision = current.workspaceUserStateRevisionById[workspaceId] ?? 0;
    const draftUserState = extractWorkspaceUserStateFromDashboard(workspace);

    try {
      const persistedUserState = await savePersistedWorkspaceUserState(
        workspaceId,
        draftUserState,
      );

      set((state) => {
        const userStateRevisionMatches =
          (state.workspaceUserStateRevisionById[workspaceId] ?? 0) === userStateRevision;
        const savedWorkspace = state.savedWorkspaceById[workspaceId] ?? null;
        const draftWorkspace = state.draftWorkspaceById[workspaceId] ?? null;
        const nextSavedWorkspace = savedWorkspace
          ? applyWorkspaceUserStateToDashboard(savedWorkspace, persistedUserState)
          : null;
        const nextDraftWorkspace = draftWorkspace
          ? applyWorkspaceUserStateToDashboard(draftWorkspace, persistedUserState)
          : null;

        return {
          savedWorkspaceById:
            nextSavedWorkspace && nextSavedWorkspace !== savedWorkspace
              ? {
                  ...state.savedWorkspaceById,
                  [workspaceId]: sanitizeDashboardDefinition(nextSavedWorkspace),
                }
              : state.savedWorkspaceById,
          draftWorkspaceById:
            nextDraftWorkspace && nextDraftWorkspace !== draftWorkspace
              ? {
                  ...state.draftWorkspaceById,
                  [workspaceId]: sanitizeDashboardDefinition(nextDraftWorkspace),
                }
              : state.draftWorkspaceById,
          workspaceUserStateHydratedById: {
            ...state.workspaceUserStateHydratedById,
            [workspaceId]: true,
          },
          workspaceUserStateRevisionById: userStateRevisionMatches
            ? clearWorkspaceDraftRevisions(state.workspaceUserStateRevisionById, [workspaceId])
            : state.workspaceUserStateRevisionById,
          error: null,
        };
      });

      return true;
    } catch (error) {
      set({
        error: readWorkspaceStoreError(error),
      });

      return false;
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

    const hydratedDraftWorkspace =
      current.workspaceUserStateHydratedById[workspaceId]
        ? (current.draftWorkspaceById[workspaceId] ?? null)
        : null;

    if (hydratedDraftWorkspace) {
      return hydratedDraftWorkspace;
    }

    if (current.loadingWorkspaceId === workspaceId) {
      return null;
    }

    const initialUserStateRevision = current.workspaceUserStateRevisionById[workspaceId] ?? 0;

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
      const [loadedWorkspace, loadedUserState] = await Promise.all([
        loadPersistedWorkspaceDetail(current.initializedUserId, workspaceId),
        loadPersistedWorkspaceUserState(current.initializedUserId, workspaceId),
      ]);

      if (!loadedWorkspace) {
        throw new Error(`Workspace ${workspaceId} was not found.`);
      }

      const hydratedWorkspace = applyWorkspaceUserStateToDashboard(
        loadedWorkspace,
        loadedUserState,
      );

      set((state) => {
        const existingListItem =
          state.workspaceListItems.find((entry) => entry.id === workspaceId) ?? null;
        const userStateRevisionMatches =
          (state.workspaceUserStateRevisionById[workspaceId] ?? 0) === initialUserStateRevision;

        return {
          selectedWorkspaceId: workspaceId,
          savedWorkspaceById: upsertWorkspaceMap(state.savedWorkspaceById, hydratedWorkspace),
          draftWorkspaceById: userStateRevisionMatches
            ? upsertWorkspaceMap(state.draftWorkspaceById, hydratedWorkspace)
            : state.draftWorkspaceById,
          workspaceUserStateHydratedById: {
            ...state.workspaceUserStateHydratedById,
            [workspaceId]: true,
          },
          workspaceListItems: upsertWorkspaceListItem(
            state.workspaceListItems,
            summarizeDashboardForWorkspaceList(hydratedWorkspace, {
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

      return hydratedWorkspace;
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
