import { commandCenterConfig, type AssistantUiProtocol } from "@/config/command-center";

export function normalizeMainSequenceAiAssistantEndpoint(endpoint: string) {
  const trimmed = endpoint.trim();

  if (!trimmed) {
    throw new Error("assistant_ui.endpoint is blank.");
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }

  const protocol = window.location.protocol === "https:" ? "https://" : "http://";
  return `${protocol}${trimmed}`;
}

export function resolveMainSequenceAiAssistantEndpoint() {
  return normalizeMainSequenceAiAssistantEndpoint(commandCenterConfig.assistantUi.endpoint);
}

export function resolveMainSequenceAiAssistantProtocol(): AssistantUiProtocol {
  return commandCenterConfig.assistantUi.protocol;
}

export function buildMainSequenceAiAssistantHeaders({
  accept,
  token,
  tokenType = "Bearer",
}: {
  accept?: string;
  token?: string | null;
  tokenType?: string;
}) {
  const headers = new Headers();

  if (accept) {
    headers.set("Accept", accept);
  }

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  return headers;
}
