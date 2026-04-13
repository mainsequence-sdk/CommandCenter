import type { WidgetExecutionDefinition } from "@/widgets/types";

import {
  normalizeAgentTerminalWidgetProps,
  type AgentTerminalWidgetProps,
} from "./agentTerminalModel";

export const AGENT_TERMINAL_HISTORY_REFRESH_RUNTIME_KEY = "historyRefreshNonce";

export const agentTerminalExecutionDefinition = {
  canExecute: (context) => {
    const normalizedProps = normalizeAgentTerminalWidgetProps(
      (context.targetOverrides?.props ?? context.props) as AgentTerminalWidgetProps,
    );

    return Boolean(normalizedProps.agentSessionId);
  },
  execute: async (context) => ({
    status: "success",
    runtimeStatePatch:
      context.reason === "dashboard-refresh"
        ? {
            [AGENT_TERMINAL_HISTORY_REFRESH_RUNTIME_KEY]: Date.now(),
          }
        : undefined,
  }),
  getRefreshPolicy: (context) => {
    const normalizedProps = normalizeAgentTerminalWidgetProps(
      (context.targetOverrides?.props ?? context.props) as AgentTerminalWidgetProps,
    );

    return normalizedProps.agentSessionId && normalizedProps.historyRefreshMode === "workspace"
      ? "allow-refresh"
      : "manual-only";
  },
  getExecutionKey: (context) => `agent-terminal:${context.instanceId}`,
} satisfies WidgetExecutionDefinition<AgentTerminalWidgetProps>;
