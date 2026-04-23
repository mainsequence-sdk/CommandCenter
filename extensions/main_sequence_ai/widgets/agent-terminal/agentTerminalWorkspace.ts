import { getWidgetById } from "@/app/registry";
import type { DashboardDefinition, DashboardWidgetInstance } from "@/dashboards/types";
import {
  appendCatalogWidget,
  setDashboardWidgetGeometry,
  updateDashboardWidgetRuntimeState,
  updateDashboardWidgetSettings,
} from "@/features/dashboards/custom-dashboard-storage";

import { normalizeAgentTerminalWidgetProps } from "./agentTerminalModel";

export const AGENT_TERMINAL_WIDGET_ID = "main-sequence-ai-agent-terminal";
export const AGENT_TERMINAL_AUTO_FOCUS_RUNTIME_KEY = "autoFocusPromptNonce";
const AGENT_TERMINAL_SPAWN_COLS = 14;
const AGENT_TERMINAL_SPAWN_ROWS = 16;

function normalizeAgentName(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeAgentId(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeAgentSessionId(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildAgentTerminalWidgetTitle(agentName?: string | null) {
  const normalizedAgentName = normalizeAgentName(agentName);
  return normalizedAgentName ? `${normalizedAgentName} Terminal` : "Agent Terminal";
}

export function buildAgentTerminalSessionWidgetTitle({
  agentName,
  sessionId,
}: {
  agentName?: string | null;
  sessionId?: string | null;
}) {
  const normalizedAgentName = normalizeAgentName(agentName);
  const normalizedSessionId = normalizeAgentSessionId(sessionId);

  if (normalizedAgentName && normalizedSessionId) {
    return `${normalizedAgentName} (${normalizedSessionId})`;
  }

  if (normalizedSessionId) {
    return `Agent Terminal (${normalizedSessionId})`;
  }

  return buildAgentTerminalWidgetTitle(normalizedAgentName);
}

function resolveAgentTerminalWidget(dashboard: DashboardDefinition) {
  const widget = getWidgetById(AGENT_TERMINAL_WIDGET_ID);

  if (!widget) {
    throw new Error("Agent Terminal widget is not registered.");
  }

  return widget;
}

export function appendAgentTerminalWidget(dashboard: DashboardDefinition) {
  const widget = resolveAgentTerminalWidget(dashboard);
  const appendedDashboard = appendCatalogWidget(dashboard, widget);
  const insertedWidget = appendedDashboard.widgets[appendedDashboard.widgets.length - 1];

  if (!insertedWidget) {
    throw new Error("Agent Terminal widget could not be inserted into the workspace.");
  }

  const resizedDashboard = setDashboardWidgetGeometry(appendedDashboard, insertedWidget.id, {
    cols: AGENT_TERMINAL_SPAWN_COLS,
    rows: AGENT_TERMINAL_SPAWN_ROWS,
  });
  const configuredDashboard = updateDashboardWidgetSettings(resizedDashboard, insertedWidget.id, {
    props: normalizeAgentTerminalWidgetProps(
      (insertedWidget.props ?? {}) as Record<string, unknown>,
    ),
  });

  return {
    dashboard: updateDashboardWidgetRuntimeState(configuredDashboard, insertedWidget.id, {
      [AGENT_TERMINAL_AUTO_FOCUS_RUNTIME_KEY]: Date.now(),
    }),
    instanceId: insertedWidget.id,
  };
}

function getAgentTerminalWidgetSessionId(widget: DashboardWidgetInstance) {
  return normalizeAgentTerminalWidgetProps((widget.props ?? {}) as Record<string, unknown>)
    .agentSessionId ?? null;
}

export function findAgentTerminalWidgetForSession(
  dashboard: DashboardDefinition,
  sessionId: string,
) {
  const normalizedSessionId = normalizeAgentSessionId(sessionId);

  if (!normalizedSessionId) {
    return null;
  }

  return (
    dashboard.widgets.find(
      (widget) =>
        widget.widgetId === AGENT_TERMINAL_WIDGET_ID &&
        getAgentTerminalWidgetSessionId(widget) === normalizedSessionId,
    ) ?? null
  );
}

export function upsertAgentTerminalWidgetForSession(
  dashboard: DashboardDefinition,
  {
    agentId,
    agentName,
    sessionId,
  }: {
    agentId?: string | number | null;
    agentName?: string | null;
    sessionId: string;
  },
) {
  const normalizedAgentId = normalizeAgentId(agentId);
  const normalizedSessionId = normalizeAgentSessionId(sessionId);
  const normalizedAgentName = normalizeAgentName(agentName);

  if (!normalizedSessionId) {
    throw new Error("Agent Terminal widgets require a non-empty AgentSession id.");
  }

  const existing = findAgentTerminalWidgetForSession(dashboard, normalizedSessionId);
  const nextTitle = buildAgentTerminalSessionWidgetTitle({
    agentName: normalizedAgentName,
    sessionId: normalizedSessionId,
  });

  if (existing) {
    const currentProps = normalizeAgentTerminalWidgetProps(
      (existing.props ?? {}) as Record<string, unknown>,
    );
    const nextProps = normalizeAgentTerminalWidgetProps({
      ...currentProps,
      ...(normalizedAgentId ? { agentId: normalizedAgentId } : {}),
      ...(normalizedAgentName ? { agentName: normalizedAgentName } : {}),
      agentSessionId: normalizedSessionId,
    });
    const shouldUpdateTitle = existing.title !== nextTitle;
    const shouldUpdateProps = JSON.stringify(currentProps) !== JSON.stringify(nextProps);
    const nextDashboard =
      shouldUpdateTitle || shouldUpdateProps
        ? updateDashboardWidgetSettings(dashboard, existing.id, {
            ...(shouldUpdateTitle ? { title: nextTitle } : {}),
            ...(shouldUpdateProps ? { props: nextProps } : {}),
          })
        : dashboard;

    return {
      dashboard: nextDashboard,
      instanceId: existing.id,
      created: false,
    };
  }

  const { dashboard: appendedDashboard, instanceId } = appendAgentTerminalWidget(dashboard);

  const configuredDashboard = updateDashboardWidgetSettings(appendedDashboard, instanceId, {
    title: nextTitle,
    props: normalizeAgentTerminalWidgetProps({
      ...(
        appendedDashboard.widgets.find((widget) => widget.id === instanceId)?.props ?? {}
      ),
      ...(normalizedAgentId ? { agentId: normalizedAgentId } : {}),
      ...(normalizedAgentName ? { agentName: normalizedAgentName } : {}),
      agentSessionId: normalizedSessionId,
    }),
  });

  return {
    dashboard: configuredDashboard,
    instanceId,
    created: true,
  };
}
