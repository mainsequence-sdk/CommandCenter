import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import {
  defaultLanguage,
  isSupportedLanguage,
  type SupportedLanguage,
} from "@/i18n/config";

const devAuthProxyPrefix = "/__command_center_auth__";

export interface CommandCenterPreferencesSnapshot {
  language: SupportedLanguage;
  themeId: string;
  favoriteSurfaceIds: string[];
  favoriteWorkspaceIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function getConfiguredBaseUrl() {
  const configuredBaseUrl = commandCenterConfig.auth.baseUrl.trim();
  return configuredBaseUrl || env.apiBaseUrl;
}

function buildEndpointUrl(path: string) {
  const url = new URL(path, getConfiguredBaseUrl());

  if (import.meta.env.DEV && isLoopbackHostname(url.hostname)) {
    return `${devAuthProxyPrefix}${url.pathname}${url.search}`;
  }

  return url.toString();
}

function normalizeFavoriteIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function normalizePreferencesPayload(payload: unknown): CommandCenterPreferencesSnapshot {
  const source = isRecord(payload) ? payload : {};
  const rawLanguage = typeof source.language === "string" ? source.language : "";
  const rawThemeId = typeof source.themeId === "string" ? source.themeId.trim() : "";

  return {
    language: isSupportedLanguage(rawLanguage) ? rawLanguage : defaultLanguage,
    themeId: rawThemeId,
    favoriteSurfaceIds: normalizeFavoriteIds(source.favoriteSurfaceIds),
    favoriteWorkspaceIds: normalizeFavoriteIds(source.favoriteWorkspaceIds),
  };
}

async function readResponsePayload(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.trim() ? text : null;
}

function readErrorMessage(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (!payload || typeof payload !== "object") {
    return "";
  }

  const detail = "detail" in payload ? payload.detail : undefined;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  for (const value of Object.values(payload)) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value)) {
      const joined = value.filter((entry): entry is string => typeof entry === "string").join(", ");
      if (joined) {
        return joined;
      }
    }
  }

  return "";
}

async function requestPreferences(
  init?: RequestInit,
): Promise<CommandCenterPreferencesSnapshot> {
  const configuredPath = commandCenterConfig.preferences.url.trim();

  if (!configuredPath) {
    throw new Error("Command Center preferences endpoint is not configured.");
  }

  const requestUrl = buildEndpointUrl(configuredPath);

  async function sendRequest() {
    const session = useAuthStore.getState().session;
    const headers = new Headers(init?.headers);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (session?.token) {
      headers.set("Authorization", `${session.tokenType ?? "Bearer"} ${session.token}`);
    }

    return fetch(requestUrl, {
      ...init,
      headers,
    });
  }

  let response = await sendRequest();

  if (response.status === 401) {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      response = await sendRequest();
    }
  }

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new Error(
      readErrorMessage(payload) || `Preferences request failed with ${response.status}.`,
    );
  }

  return normalizePreferencesPayload(payload);
}

export function hasConfiguredPreferencesEndpoint() {
  return Boolean(commandCenterConfig.preferences.url.trim());
}

export function fetchCommandCenterPreferences() {
  return requestPreferences();
}

export function updateCommandCenterPreferences(
  snapshot: CommandCenterPreferencesSnapshot,
) {
  return requestPreferences({
    method: "PUT",
    body: JSON.stringify(snapshot),
  });
}
