import type { AgentSearchResult } from "../../agent-search";

export const AGENT_TERMINAL_ALLOWED_AGENT_TYPES = ["astro-orchestrator"] as const;

function normalizeAgentType(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isAgentTerminalAllowedAgentType(value: string | null | undefined) {
  const normalized = normalizeAgentType(value);

  if (!normalized) {
    return false;
  }

  return AGENT_TERMINAL_ALLOWED_AGENT_TYPES.includes(
    normalized as (typeof AGENT_TERMINAL_ALLOWED_AGENT_TYPES)[number],
  );
}

export function isAgentTerminalAllowedAgent(agent: Pick<AgentSearchResult, "agentType">) {
  return isAgentTerminalAllowedAgentType(agent.agentType);
}

export function filterAgentTerminalAllowedAgents(agents: readonly AgentSearchResult[]) {
  return agents.filter(isAgentTerminalAllowedAgent);
}

export function getAgentTerminalAllowedAgentsLabel() {
  return AGENT_TERMINAL_ALLOWED_AGENT_TYPES.join(", ");
}
