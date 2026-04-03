import { ArrowRight, Copy, LayoutTemplate, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { SurfaceFavoriteButton } from "@/app/layout/SurfaceFavoriteButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useShellStore } from "@/stores/shell-store";
import { CustomDashboardStudioPage } from "./CustomDashboardStudioPage";
import { CustomWorkspaceGraphPage } from "./CustomWorkspaceGraphPage";
import { CustomWorkspaceSettingsPage } from "./CustomWorkspaceSettingsPage";
import {
  createWorkspaceSnapshot,
  restoreWorkspaceFromSnapshot,
} from "./custom-dashboard-storage";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import type { WorkspaceListItemSummary } from "./workspace-list-summary";
import {
  getWorkspaceFavoriteId,
  getWorkspacePath,
  isWorkspaceFavorited,
} from "./workspace-favorites";

function formatWorkspaceRange(workspace: Pick<
  WorkspaceListItemSummary,
  "selectedRange" | "customStartMs" | "customEndMs"
>) {
  const selectedRange = workspace.selectedRange ?? "24h";

  if (
    selectedRange === "custom" &&
    typeof workspace.customStartMs === "number" &&
    typeof workspace.customEndMs === "number"
  ) {
    try {
      const formatter = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      });

      return `${formatter.format(new Date(workspace.customStartMs))} - ${formatter.format(new Date(workspace.customEndMs))}`;
    } catch {
      return "Custom";
    }
  }

  const rangeLabels: Record<string, string> = {
    "15m": "15 min",
    "1h": "1 hour",
    "6h": "6 hours",
    "24h": "24 hours",
    "7d": "7 days",
    "30d": "30 days",
    "90d": "90 days",
  };

  return rangeLabels[selectedRange] ?? selectedRange;
}

function formatWorkspaceRefresh(workspace: Pick<WorkspaceListItemSummary, "refreshIntervalMs">) {
  const refreshIntervalMs = workspace.refreshIntervalMs ?? null;

  if (refreshIntervalMs === null) {
    return "Off";
  }

  if (refreshIntervalMs < 120_000) {
    return `${Math.round(refreshIntervalMs / 1000)}s`;
  }

  if (refreshIntervalMs % 3_600_000 === 0) {
    return `${Math.round(refreshIntervalMs / 3_600_000)}h`;
  }

  return `${Math.round(refreshIntervalMs / 60_000)}m`;
}

function buildCopiedWorkspaceTitle(title: string) {
  const trimmed = title.trim();
  return trimmed ? `Copy of ${trimmed}` : "Copy of Workspace";
}

export function WorkspacesPage() {
  const navigate = useNavigate();
  const favoriteWorkspaceIds = useShellStore((state) => state.favoriteWorkspaceIds);
  const toggleWorkspaceFavorite = useShellStore((state) => state.toggleWorkspaceFavorite);
  const {
    user,
    workspaceListItems,
    draftCollection,
    selectedDashboard,
    dirty,
    isHydrating,
    isSaving,
    error,
    persistenceMode,
    createWorkspace,
    createWorkspaceFromDefinition,
    workspaceSelectionPending,
    requestedWorkspaceMissing,
    requestedWorkspaceId,
    selectedWorkspaceView,
    loadWorkspaceDetail,
  } = useCustomWorkspaceStudio();
  const backendMode = persistenceMode === "backend";

  if (!user) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        Resolve a user session before opening Workspaces.
      </div>
    );
  }

  if (requestedWorkspaceId && workspaceSelectionPending && !selectedDashboard) {
    return (
      <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto flex min-h-[320px] max-w-4xl items-center justify-center">
          <div className="w-full max-w-md rounded-[calc(var(--radius)+4px)] border border-border/70 bg-card/80 px-6 py-8 text-center shadow-[var(--shadow-panel)]">
            <Badge variant="neutral" className="border border-border/70 bg-card/55">
              Loading workspace
            </Badge>
            <div className="mt-3 space-y-1">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Opening workspace
              </h1>
              <p className="text-sm text-muted-foreground">
                Loading workspace {requestedWorkspaceId} and restoring its canvas.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (requestedWorkspaceId && requestedWorkspaceMissing) {
    return (
      <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto flex min-h-[320px] max-w-4xl items-center justify-center">
          <div className="w-full max-w-md rounded-[calc(var(--radius)+4px)] border border-danger/25 bg-card/80 px-6 py-8 text-center shadow-[var(--shadow-panel)]">
            <Badge variant="warning" className="border border-danger/25 bg-danger/10 text-danger">
              Workspace not found
            </Badge>
            <div className="mt-3 space-y-1">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Unable to open workspace
              </h1>
              <p className="text-sm text-muted-foreground">
                Workspace {requestedWorkspaceId} is not available in the current draft.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigate("/app/workspace-studio/workspaces");
                }}
              >
                Back to workspaces
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (requestedWorkspaceId && selectedDashboard) {
    return selectedWorkspaceView === "settings" ? (
      <CustomWorkspaceSettingsPage />
    ) : selectedWorkspaceView === "graph" ? (
      <CustomWorkspaceGraphPage />
    ) : (
      <CustomDashboardStudioPage />
    );
  }

  return (
    <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {error ? (
          <div className="rounded-[var(--radius)] border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="neutral" className="border border-border/70 bg-card/55">
              {persistenceMode} / {user.id}
            </Badge>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Workspaces
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Choose a saved workspace or create a new one. Canvas and settings belong to each
                workspace instance.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isHydrating ? (
              <Badge variant="neutral">Loading</Badge>
            ) : isSaving ? (
              <Badge variant="neutral">Saving</Badge>
            ) : !backendMode && dirty ? (
              <Badge variant="warning">Unsaved draft</Badge>
            ) : (
              <Badge variant="success">Saved</Badge>
            )}
            <Button
              onClick={() => {
                void createWorkspace();
              }}
              disabled={isHydrating || isSaving}
            >
              <LayoutTemplate className="h-4 w-4" />
              New workspace
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[calc(var(--radius)+4px)] border border-border/70 bg-card/78 shadow-[var(--shadow-panel)]">
          <div className="overflow-auto">
            <table className="w-full min-w-[840px] border-collapse text-left text-sm">
              <thead className="bg-background/55">
                <tr className="border-b border-border/70">
                  <th className="w-14 px-3 py-3">
                    <span className="sr-only">Favorite</span>
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Workspace
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Description
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Labels
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Widgets
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Range
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Refresh
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {workspaceListItems.map((workspace) => (
                  <tr
                    key={workspace.id}
                    className="border-b border-border/60 transition-colors hover:bg-background/35"
                  >
                    <td className="px-3 py-3 align-top">
                      <SurfaceFavoriteButton
                        favorite={isWorkspaceFavorited(favoriteWorkspaceIds, workspace.id)}
                        className="h-8 w-8 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/40"
                        onToggle={() => {
                          toggleWorkspaceFavorite(getWorkspaceFavoriteId(workspace.id));
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {workspace.title}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {workspace.source || persistenceMode}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[340px] px-4 py-3 align-top text-muted-foreground">
                      <div className="line-clamp-2">
                        {workspace.description}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex max-w-[220px] flex-wrap gap-1.5">
                        {workspace.labels?.length ? (
                          workspace.labels.map((label) => (
                            <Badge
                              key={label}
                              variant="neutral"
                              className="border border-border/70 bg-background/40"
                            >
                              {label}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No labels</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant="neutral" className="border border-border/70 bg-background/40">
                        {workspace.widgetCount}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-top text-foreground">
                      {formatWorkspaceRange(workspace)}
                    </td>
                    <td className="px-4 py-3 align-top text-foreground">
                      {formatWorkspaceRefresh(workspace)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            navigate(getWorkspacePath(workspace.id));
                          }}
                        >
                          <ArrowRight className="h-4 w-4" />
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void (async () => {
                              const sourceWorkspace =
                                persistenceMode === "backend"
                                  ? await loadWorkspaceDetail(workspace.id)
                                  : (draftCollection.dashboards.find(
                                      (dashboard) => dashboard.id === workspace.id,
                                    ) ?? null);

                              if (!sourceWorkspace) {
                                return;
                              }

                              const duplicatedWorkspace = restoreWorkspaceFromSnapshot(
                                createWorkspaceSnapshot(sourceWorkspace),
                              );

                              duplicatedWorkspace.title = buildCopiedWorkspaceTitle(workspace.title);

                              await createWorkspaceFromDefinition(duplicatedWorkspace);
                            })();
                          }}
                          disabled={isHydrating || isSaving}
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigate(getWorkspacePath(workspace.id, "settings"));
                          }}
                        >
                          <Settings2 className="h-4 w-4" />
                          Settings
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border/70 bg-background/35 px-4 py-3 text-xs text-muted-foreground">
            {workspaceListItems.length} workspaces.
          </div>
        </div>
      </div>
    </div>
  );
}
