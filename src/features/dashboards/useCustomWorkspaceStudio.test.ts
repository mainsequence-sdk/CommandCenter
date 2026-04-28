import { describe, expect, it } from "vitest";

import { resolveWorkspaceDirtyState } from "./useCustomWorkspaceStudio";

describe("resolveWorkspaceDirtyState", () => {
  it("ignores dirty state from other workspaces when no workspace is selected", () => {
    expect(
      resolveWorkspaceDirtyState({
        workspaceId: null,
        dirtyWorkspaceIds: {
          "workspace-a": true,
        },
        workspaceDraftRevisionById: {
          "workspace-a": 2,
        },
        workspaceUserStateRevisionById: {
          "workspace-a": 5,
        },
      }),
    ).toBe(false);
  });

  it("reports dirty only for the selected workspace", () => {
    expect(
      resolveWorkspaceDirtyState({
        workspaceId: "workspace-b",
        dirtyWorkspaceIds: {
          "workspace-a": true,
        },
        workspaceDraftRevisionById: {
          "workspace-a": 1,
          "workspace-b": 0,
        },
        workspaceUserStateRevisionById: {
          "workspace-b": 1,
        },
      }),
    ).toBe(true);
  });

  it("stays false when the selected workspace has no draft or user-state revisions", () => {
    expect(
      resolveWorkspaceDirtyState({
        workspaceId: "workspace-b",
        dirtyWorkspaceIds: {
          "workspace-a": true,
        },
        workspaceDraftRevisionById: {
          "workspace-a": 1,
          "workspace-b": 0,
        },
        workspaceUserStateRevisionById: {
          "workspace-a": 3,
          "workspace-b": 0,
        },
      }),
    ).toBe(false);
  });
});
