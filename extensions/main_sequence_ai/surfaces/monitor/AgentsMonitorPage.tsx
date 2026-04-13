import { useEffect, useMemo, useRef } from "react";

import { ArrowRight, LayoutTemplate, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceStudioCanvasHost } from "@/features/dashboards/WorkspaceStudioCanvasHost";
import { useCustomWorkspaceStudio } from "@/features/dashboards/useCustomWorkspaceStudio";
import {
  WorkspaceStudioSurfaceConfigProvider,
  filterWorkspaceStudioEntries,
} from "@/features/dashboards/workspace-studio-surface-config";

import {
  agentMonitorWorkspaceStudioConfig,
  createAgentMonitorWorkspaceDefinition,
  getAgentMonitorWorkspacePath,
  isAgentMonitorWorkspace,
} from "../../agent-monitor-workspaces";
import { AgentTerminalWorkspaceLauncher } from "../../widgets/agent-terminal/AgentTerminalWorkspaceLauncher";

function formatWorkspaceUpdatedAt(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function AgentsMonitorPageContent() {
  const navigate = useNavigate();
  const {
    user,
    workspaceListItems,
    selectedDashboard,
    selectedWorkspaceEditing,
    dirty,
    isHydrating,
    isSaving,
    error,
    persistenceMode,
    createWorkspaceFromDefinition,
    setSelectedWorkspaceEditing,
    workspaceSelectionPending,
    requestedWorkspaceId,
    requestedWorkspaceMissing,
  } = useCustomWorkspaceStudio();
  const autoEnabledEditWorkspaceIdsRef = useRef<Set<string>>(new Set());
  const backendMode = persistenceMode === "backend";
  const monitorWorkspaces = useMemo(
    () =>
      filterWorkspaceStudioEntries(
        workspaceListItems,
        agentMonitorWorkspaceStudioConfig.workspaceFilter,
      ),
    [workspaceListItems],
  );
  const selectedWorkspaceSupported = selectedDashboard
    ? isAgentMonitorWorkspace(selectedDashboard)
    : false;

  useEffect(() => {
    if (!selectedDashboard || !selectedWorkspaceSupported) {
      return;
    }

    if (
      selectedWorkspaceEditing ||
      autoEnabledEditWorkspaceIdsRef.current.has(selectedDashboard.id)
    ) {
      return;
    }

    autoEnabledEditWorkspaceIdsRef.current.add(selectedDashboard.id);
    setSelectedWorkspaceEditing(true);
  }, [
    selectedDashboard,
    selectedWorkspaceEditing,
    selectedWorkspaceSupported,
    setSelectedWorkspaceEditing,
  ]);

  if (!user) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        Resolve a user session before opening Agents Monitor.
      </div>
    );
  }

  if (requestedWorkspaceId && workspaceSelectionPending && !selectedDashboard) {
    return (
      <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto flex min-h-[320px] max-w-4xl items-center justify-center">
          <div className="w-full max-w-md rounded-[calc(var(--radius)+4px)] border border-border/70 bg-card/80 px-6 py-8 text-center shadow-[var(--shadow-panel)]">
            <Badge variant="neutral" className="border border-border/70 bg-card/55">
              Loading monitor
            </Badge>
            <div className="mt-3 space-y-1">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Opening agent monitor
              </h1>
              <p className="text-sm text-muted-foreground">
                Loading workspace {requestedWorkspaceId} and restoring its monitor canvas.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (
    requestedWorkspaceId &&
    (requestedWorkspaceMissing || (selectedDashboard && !selectedWorkspaceSupported))
  ) {
    return (
      <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto flex min-h-[320px] max-w-4xl items-center justify-center">
          <div className="w-full max-w-md rounded-[calc(var(--radius)+4px)] border border-danger/25 bg-card/80 px-6 py-8 text-center shadow-[var(--shadow-panel)]">
            <Badge variant="warning" className="border border-danger/25 bg-danger/10 text-danger">
              Monitor not found
            </Badge>
            <div className="mt-3 space-y-1">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Unable to open agent monitor
              </h1>
              <p className="text-sm text-muted-foreground">
                Workspace {requestedWorkspaceId} is not available on the Agents Monitor surface.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigate(agentMonitorWorkspaceStudioConfig.workspaceListPath ?? "/app");
                }}
              >
                Back to monitors
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedDashboard && selectedWorkspaceSupported) {
    return <WorkspaceStudioCanvasHost />;
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
                Agents Monitor
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Open agent-monitor workspaces powered by the shared workspace studio. This surface
                exposes only the Agent Terminal widget.
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
            <AgentTerminalWorkspaceLauncher createWorkspaceWhenMissing buttonLabel="Launch session" />
            <Button
              onClick={() => {
                void createWorkspaceFromDefinition(createAgentMonitorWorkspaceDefinition());
              }}
              disabled={isHydrating || isSaving}
            >
              <LayoutTemplate className="h-4 w-4" />
              New monitor
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[calc(var(--radius)+4px)] border border-border/70 bg-card/78 shadow-[var(--shadow-panel)]">
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-background/55">
                <tr className="border-b border-border/70">
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Monitor
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Description
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Labels
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Updated
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {monitorWorkspaces.length > 0 ? (
                  monitorWorkspaces.map((workspace) => (
                    <tr
                      key={workspace.id}
                      className="border-b border-border/60 transition-colors hover:bg-background/35"
                    >
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
                        <div className="line-clamp-2">{workspace.description}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex max-w-[260px] flex-wrap gap-1.5">
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
                      <td className="px-4 py-3 align-top text-foreground">
                        {formatWorkspaceUpdatedAt(workspace.updatedAt)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              navigate(getAgentMonitorWorkspacePath(workspace.id));
                            }}
                          >
                            <ArrowRight className="h-4 w-4" />
                            Open
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigate(getAgentMonitorWorkspacePath(workspace.id, "settings"));
                            }}
                          >
                            <Settings2 className="h-4 w-4" />
                            Settings
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center">
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-foreground">
                          No agent monitors yet.
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Launch a session here or create a blank monitor workspace.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border/70 bg-background/35 px-4 py-3 text-xs text-muted-foreground">
            {monitorWorkspaces.length} monitors.
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentsMonitorPage() {
  const surfaceConfig = useMemo(
    () => ({
      ...agentMonitorWorkspaceStudioConfig,
      toolbarActions: <AgentTerminalWorkspaceLauncher mode="toolbar" />,
    }),
    [],
  );

  return (
    <WorkspaceStudioSurfaceConfigProvider value={surfaceConfig}>
      <AgentsMonitorPageContent />
    </WorkspaceStudioSurfaceConfigProvider>
  );
}
