import { getAppPath } from "@/apps/utils";
import { createBlankDashboard } from "@/features/dashboards/custom-dashboard-storage";
import type { WorkspaceListItemSummary } from "@/features/dashboards/workspace-list-summary";
import type { WorkspaceStudioSurfaceConfig } from "@/features/dashboards/workspace-studio-surface-config";
import { appComponentWidget } from "@/widgets/core/app-component/definition";
import { markdownNoteWidget } from "@/widgets/core/markdown-note/definition";
import { mainSequenceDataNodeFilterWidget } from "../main_sequence/extensions/workbench/widgets/data-node-filter/definition";
import { mainSequenceDataNodeTableWidget } from "../main_sequence/extensions/workbench/widgets/data-node-table/definition";
import { mainSequenceDataNodeGraphWidget } from "../main_sequence/extensions/workbench/widgets/data-node-visualizer/definition";
import {
  AGENT_TERMINAL_WIDGET_ID,
  appendAgentTerminalWidget,
  upsertAgentTerminalWidgetForSession,
} from "./widgets/agent-terminal/agentTerminalWorkspace";
import { UPSTREAM_INSPECTOR_WIDGET_ID } from "./widgets/upstream-inspector/definition";

const MAIN_SEQUENCE_AI_WORKSPACE_LABEL = "main-sequence-ai";
const AGENT_MONITOR_WORKSPACE_LABEL = "agent-monitor";
const AGENT_MONITOR_SESSION_LABEL_PREFIX = "agent-session:";
export const AGENTS_MONITOR_SURFACE_PATH = getAppPath("main_sequence_ai", "monitor");

function normalizeAgentSessionId(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeAgentName(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getAgentMonitorWorkspacePath(workspaceId: string, view?: "graph" | "settings") {
  const params = new URLSearchParams({
    workspace: workspaceId,
  });

  if (view) {
    params.set("view", view);
  }

  return `${AGENTS_MONITOR_SURFACE_PATH}?${params.toString()}`;
}

export function getAgentMonitorSessionLabel(sessionId: string) {
  return `${AGENT_MONITOR_SESSION_LABEL_PREFIX}${sessionId}`;
}

export function isAgentMonitorWorkspace(workspace: { labels?: string[] | undefined }) {
  const labels = workspace.labels ?? [];

  return (
    labels.includes(MAIN_SEQUENCE_AI_WORKSPACE_LABEL) &&
    labels.includes(AGENT_MONITOR_WORKSPACE_LABEL)
  );
}

export function findAgentMonitorWorkspaceForSession(
  workspaces: readonly Pick<WorkspaceListItemSummary, "id" | "labels">[],
  sessionId: string,
) {
  const sessionLabel = getAgentMonitorSessionLabel(sessionId);

  return workspaces.find(
    (workspace) =>
      isAgentMonitorWorkspace(workspace) && (workspace.labels ?? []).includes(sessionLabel),
  ) ?? null;
}

export function buildAgentMonitorWorkspaceTitle({
  agentName,
  sessionId,
}: {
  agentName?: string | null;
  sessionId?: string | null;
} = {}) {
  const normalizedAgentName = normalizeAgentName(agentName);
  const normalizedSessionId = normalizeAgentSessionId(sessionId);

  if (normalizedAgentName) {
    return `${normalizedAgentName} Monitor`;
  }

  if (normalizedSessionId) {
    return `Agent Session ${normalizedSessionId}`;
  }

  return "Agent Monitor";
}

export function createAgentMonitorWorkspaceDefinition({
  agentName,
  sessionId,
}: {
  agentName?: string | null;
  sessionId?: string | null;
} = {}) {
  const normalizedSessionId = normalizeAgentSessionId(sessionId);
  const normalizedAgentName = normalizeAgentName(agentName);

  let dashboard = createBlankDashboard(
    buildAgentMonitorWorkspaceTitle({
      agentName: normalizedAgentName,
      sessionId: normalizedSessionId,
    }),
  );

  dashboard = {
    ...dashboard,
    description: normalizedSessionId
      ? "Agent monitor workspace backed by the Main Sequence AI Agent Terminal widget."
      : "Agent monitor workspace reserved for Main Sequence AI terminal sessions.",
    labels: [
      MAIN_SEQUENCE_AI_WORKSPACE_LABEL,
      AGENT_MONITOR_WORKSPACE_LABEL,
      ...(normalizedSessionId ? [getAgentMonitorSessionLabel(normalizedSessionId)] : []),
    ],
  };

  if (!normalizedSessionId) {
    return appendAgentTerminalWidget(dashboard).dashboard;
  }

  return upsertAgentTerminalWidgetForSession(dashboard, {
    agentName: normalizedAgentName,
    sessionId: normalizedSessionId,
  }).dashboard;
}

export const agentMonitorWorkspaceStudioConfig: WorkspaceStudioSurfaceConfig = {
  allowedWidgetIds: [
    AGENT_TERMINAL_WIDGET_ID,
    UPSTREAM_INSPECTOR_WIDGET_ID,
    markdownNoteWidget.id,
    appComponentWidget.id,
    mainSequenceDataNodeFilterWidget.id,
    mainSequenceDataNodeTableWidget.id,
    mainSequenceDataNodeGraphWidget.id,
  ],
  catalogTitle: "Agent Widgets",
  catalogDescription:
    "Build monitor workspaces with Agent Terminal plus snapshot-capable context widgets such as Data Nodes, Data Node Table, Data Node Graph, AppComponent, and Markdown.",
  savedWidgetsPath: undefined,
  workspaceFilter: isAgentMonitorWorkspace,
  workspaceListPath: AGENTS_MONITOR_SURFACE_PATH,
};
