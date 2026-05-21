import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardDefinition, DashboardWidgetInstance } from "@/dashboards/types";
import { updateDashboardWidgetSettings } from "./custom-dashboard-storage";
import { summarizeDashboardForWorkspaceList } from "./workspace-list-summary";

const workspacePersistenceMocks = vi.hoisted(() => ({
  isWorkspaceBackendEnabled: vi.fn(() => true),
  loadPersistedWorkspaceCollection: vi.fn(),
  loadPersistedWorkspaceDetail: vi.fn(),
  loadPersistedWorkspaceListSummaries: vi.fn(),
  loadPersistedWorkspaceUserState: vi.fn(),
  savePersistedWorkspace: vi.fn(),
  savePersistedWorkspaceUserState: vi.fn(),
}));

vi.mock("./workspace-persistence", () => workspacePersistenceMocks);

const { useCustomWorkspaceStudioStore } = await import("./custom-workspace-studio-store");

function widgetWithProps(props: Record<string, unknown>): DashboardWidgetInstance {
  return {
    id: "chart-1",
    widgetId: "graph",
    title: "Chart",
    props,
    layout: {
      cols: 12,
      rows: 8,
    },
  };
}

function workspaceWithWidget(widget: DashboardWidgetInstance): DashboardDefinition {
  return {
    id: "workspace-1",
    title: "Workspace",
    description: "Store test workspace",
    source: "test",
    widgets: [widget],
  };
}

function seedStore(workspace: DashboardDefinition) {
  useCustomWorkspaceStudioStore.setState({
    initializedUserId: "user-1",
    hydratingUserId: null,
    selectedWorkspaceId: workspace.id,
    savedWorkspaceById: {
      [workspace.id]: workspace,
    },
    draftWorkspaceById: {
      [workspace.id]: workspace,
    },
    workspaceUserStateHydratedById: {
      [workspace.id]: true,
    },
    workspaceListItems: [summarizeDashboardForWorkspaceList(workspace)],
    workspaceListTypes: [],
    workspaceListHydrated: true,
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
}

describe("custom workspace studio store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspacePersistenceMocks.isWorkspaceBackendEnabled.mockReturnValue(true);
    workspacePersistenceMocks.savePersistedWorkspace.mockImplementation(
      async (_userId: string, _collection: unknown, workspace: DashboardDefinition) => workspace,
    );
  });

  it("persists the exact workspace snapshot produced by a draft updater", async () => {
    const workspace = workspaceWithWidget(widgetWithProps({ decimals: 0 }));
    seedStore(workspace);

    const result = await useCustomWorkspaceStudioStore
      .getState()
      .saveWorkspaceDraftUpdate(workspace.id, (draft) =>
        updateDashboardWidgetSettings(draft, "chart-1", {
          props: {
            decimals: 4,
          },
        }),
      );

    expect(result?.previousWorkspace.widgets[0]?.props).toEqual({ decimals: 0 });
    expect(result?.updatedWorkspace.widgets[0]?.props).toEqual({ decimals: 4 });
    expect(result?.savedWorkspace.widgets[0]?.props).toEqual({ decimals: 4 });
    expect(workspacePersistenceMocks.savePersistedWorkspace).toHaveBeenCalledTimes(1);
    expect(workspacePersistenceMocks.savePersistedWorkspace.mock.calls[0]?.[2].widgets[0]?.props).toEqual({
      decimals: 4,
    });
    expect(useCustomWorkspaceStudioStore.getState().dirtyWorkspaceIds[workspace.id]).toBeUndefined();
  });

  it("applies draft updates against the latest store draft", async () => {
    const workspace = workspaceWithWidget(widgetWithProps({ decimals: 0 }));
    seedStore(workspace);

    useCustomWorkspaceStudioStore
      .getState()
      .updateWorkspaceDraft(workspace.id, (draft) =>
        updateDashboardWidgetSettings(draft, "chart-1", {
          props: {
            decimals: 0,
            lineColor: "cyan",
          },
        }),
      );

    const result = await useCustomWorkspaceStudioStore
      .getState()
      .saveWorkspaceDraftUpdate(workspace.id, (draft) =>
        updateDashboardWidgetSettings(draft, "chart-1", {
          props: {
            ...draft.widgets[0]?.props,
            decimals: 4,
          },
        }),
      );

    expect(result?.previousWorkspace.widgets[0]?.props).toEqual({
      decimals: 0,
      lineColor: "cyan",
    });
    expect(workspacePersistenceMocks.savePersistedWorkspace.mock.calls[0]?.[2].widgets[0]?.props).toEqual({
      decimals: 4,
      lineColor: "cyan",
    });
  });

  it("keeps the updated draft dirty when persistence fails", async () => {
    const workspace = workspaceWithWidget(widgetWithProps({ decimals: 0 }));
    seedStore(workspace);
    workspacePersistenceMocks.savePersistedWorkspace.mockRejectedValueOnce(new Error("save failed"));

    const result = await useCustomWorkspaceStudioStore
      .getState()
      .saveWorkspaceDraftUpdate(workspace.id, (draft) =>
        updateDashboardWidgetSettings(draft, "chart-1", {
          props: {
            decimals: 4,
          },
        }),
      );

    expect(result).toBeNull();
    expect(useCustomWorkspaceStudioStore.getState().draftWorkspaceById[workspace.id]?.widgets[0]?.props).toEqual({
      decimals: 4,
    });
    expect(useCustomWorkspaceStudioStore.getState().savedWorkspaceById[workspace.id]?.widgets[0]?.props).toEqual({
      decimals: 0,
    });
    expect(useCustomWorkspaceStudioStore.getState().dirtyWorkspaceIds[workspace.id]).toBe(true);
    expect(useCustomWorkspaceStudioStore.getState().error).toBe("save failed");
  });
});
