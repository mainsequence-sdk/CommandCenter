import type { AgentSearchResult } from "../../agent-search";

export const AGENT_TERMINAL_ALLOWED_AGENT_REQUEST_NAMES = ["astro-orchestrator"] as const;

function normalizeAgentName(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isAgentTerminalAllowedAgentName(value: string | null | undefined) {
  const normalized = normalizeAgentName(value);

  if (!normalized) {
    return false;
  }

  return AGENT_TERMINAL_ALLOWED_AGENT_REQUEST_NAMES.includes(
    normalized as (typeof AGENT_TERMINAL_ALLOWED_AGENT_REQUEST_NAMES)[number],
  );
}

export function isAgentTerminalAllowedAgent(agent: Pick<AgentSearchResult, "name">) {
  return isAgentTerminalAllowedAgentName(agent.name);
}

export function filterAgentTerminalAllowedAgents(agents: readonly AgentSearchResult[]) {
  return agents.filter(isAgentTerminalAllowedAgent);
}

export function getAgentTerminalAllowedAgentsLabel() {
  return AGENT_TERMINAL_ALLOWED_AGENT_REQUEST_NAMES.join(", ");
}
