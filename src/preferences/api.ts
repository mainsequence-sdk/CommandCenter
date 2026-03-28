import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import {
  defaultLanguage,
  isSupportedLanguage,
  type SupportedLanguage,
} from "@/i18n/config";

const devAuthProxyPrefix = "/__command_center_auth__";
const preferencesCacheStorageKeyPrefix = "ms.command-center.preferences";
const mockPreferencesJsonModules = import.meta.glob("/mock_data/command_center/preferences.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

export interface CommandCenterPreferencesSnapshot {
  language: SupportedLanguage;
  themeId: string;
  favoriteSurfaceIds: string[];
  favoriteWorkspaceIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function buildEndpointUrl(path: string) {
  const url = new URL(path, env.apiBaseUrl);

  if (import.meta.env.DEV && isLoopbackHostname(url.hostname)) {
    return `${devAuthProxyPrefix}${url.pathname}${url.search}`;
  }

  return url.toString();
}

function normalizeMockPreferencesPath(path: string) {
  const pathname = new URL(path, window.location.origin).pathname;

  if (!pathname.startsWith(devAuthProxyPrefix)) {
    return pathname;
  }

  const normalizedPathname = pathname.slice(devAuthProxyPrefix.length);
  return normalizedPathname || "/";
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

function readMockPreferencesSeed(): CommandCenterPreferencesSnapshot {
  const dataset = mockPreferencesJsonModules["/mock_data/command_center/preferences.json"];
  return normalizePreferencesPayload(dataset);
}

let mockPreferencesState = readMockPreferencesSeed();

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function buildPreferencesCacheStorageKey(userId: string) {
  return `${preferencesCacheStorageKeyPrefix}:${userId}`;
}

export function readCachedCommandCenterPreferences(
  userId: string | null | undefined,
): CommandCenterPreferencesSnapshot | null {
  if (!userId || !canUseLocalStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(buildPreferencesCacheStorageKey(userId));

    if (!rawValue) {
      return null;
    }

    return normalizePreferencesPayload(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function readCachedCurrentCommandCenterPreferences() {
  return readCachedCommandCenterPreferences(useAuthStore.getState().session?.user.id ?? null);
}

export function writeCachedCommandCenterPreferences(
  userId: string | null | undefined,
  snapshot: CommandCenterPreferencesSnapshot,
) {
  if (!userId || !canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      buildPreferencesCacheStorageKey(userId),
      JSON.stringify(normalizePreferencesPayload(snapshot)),
    );
  } catch {
    // Ignore cache write failures and continue with the backend response path.
  }
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

  if (env.useMockData) {
    const session = useAuthStore.getState().session;

    if (!session?.token) {
      throw new Error("Authentication credentials were not provided.");
    }

    const method = (init?.method ?? "GET").toUpperCase();
    const pathname = normalizeMockPreferencesPath(configuredPath);
    const configuredPathname = new URL(commandCenterConfig.preferences.url, window.location.origin).pathname;

    if (pathname === configuredPathname) {
      if (method === "GET") {
        return cloneJson(mockPreferencesState);
      }

      if (method === "PUT") {
        const body =
          init?.body && typeof init.body === "string"
            ? (() => {
                try {
                  return JSON.parse(init.body) as unknown;
                } catch {
                  return null;
                }
              })()
            : null;

        mockPreferencesState = normalizePreferencesPayload(body);
        return cloneJson(mockPreferencesState);
      }
    }
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
  return !env.useMockData && Boolean(commandCenterConfig.preferences.url.trim());
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
