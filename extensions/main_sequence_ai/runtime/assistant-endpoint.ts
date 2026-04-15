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

function toAssistantBaseUrl(endpoint: string) {
  const normalized = normalizeMainSequenceAiAssistantEndpoint(endpoint);

  if (normalized.startsWith("/")) {
    return new URL(normalized, window.location.origin);
  }

  return new URL(normalized);
}

export function resolveMainSequenceAiAssistantEndpoint() {
  return normalizeMainSequenceAiAssistantEndpoint(commandCenterConfig.assistantUi.endpoint);
}

export function buildMainSequenceAiAssistantUrl(assistantEndpoint: string, requestPath: string) {
  if (/^https?:\/\//i.test(requestPath)) {
    return requestPath;
  }

  const base = toAssistantBaseUrl(assistantEndpoint);
  const prefix = base.pathname.replace(/\/+$/, "");
  const suffix = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;

  base.pathname = `${prefix}${suffix}`.replace(/\/{2,}/g, "/");
  base.search = "";
  base.hash = "";

  return base.toString();
}

export function buildMainSequenceAiAssistantChatUrl(assistantEndpoint: string) {
  return buildMainSequenceAiAssistantUrl(assistantEndpoint, "/api/chat");
}

export function resolveMainSequenceAiAssistantChatEndpoint() {
  return buildMainSequenceAiAssistantChatUrl(resolveMainSequenceAiAssistantEndpoint());
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
