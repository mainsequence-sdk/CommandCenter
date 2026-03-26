import { useAuthStore } from "@/auth/auth-store";
import { handleMockAuthRequest } from "@/auth/mock-jwt-auth";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";

const devAuthProxyPrefix = "/__command_center_auth__";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPathValue(source: Record<string, unknown>, path: string) {
  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((current, segment) => {
      if (!isRecord(current) || !(segment in current)) {
        return undefined;
      }

      return current[segment];
    }, source);
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [] as string[];
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeStringList(parsed);
      } catch {
        return [trimmed];
      }
    }

    const separator = trimmed.includes(",") ? "," : /\s+/;

    return trimmed
      .split(separator)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [] as string[];
}

function normalizeGroupNames(value: unknown) {
  if (Array.isArray(value)) {
    return value.flatMap<string>((entry) => {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        return trimmed ? [trimmed] : [];
      }

      if (isRecord(entry)) {
        const name = typeof entry.name === "string" ? entry.name.trim() : "";
        return name ? [name] : [];
      }

      return [];
    });
  }

  if (typeof value === "string") {
    return normalizeStringList(value);
  }

  if (isRecord(value)) {
    const name = typeof value.name === "string" ? value.name.trim() : "";
    return name ? [name] : [];
  }

  return [] as string[];
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

export interface AuthDetailResponse {
  detail: string;
}

export interface PasswordResetRequestInput {
  email: string;
}

export interface PasswordResetValidateInput {
  uidb64: string;
  token: string;
}

export interface PasswordResetValidateResponse {
  valid: boolean;
  detail: string;
}

export interface PasswordResetConfirmInput extends PasswordResetValidateInput {
  password: string;
  confirm_password: string;
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

  return "";
}

async function requestAuthJson<T>(
  path: string,
  init?: RequestInit,
  {
    requiresAuth = false,
  }: {
    requiresAuth?: boolean;
  } = {},
) {
  const requestUrl = buildEndpointUrl(path);

  if (env.useMockData) {
    const session = useAuthStore.getState().session;
    const body =
      init?.body && typeof init.body === "string"
        ? (() => {
            try {
              return JSON.parse(init.body) as Record<string, unknown>;
            } catch {
              return null;
            }
          })()
        : null;

    const mockResponse = handleMockAuthRequest(
      requestUrl,
      (init?.method ?? "GET").toUpperCase(),
      body,
      requiresAuth ? session?.token ?? null : null,
    );

    if (mockResponse !== undefined) {
      return mockResponse as T;
    }
  }

  async function sendRequest() {
    const session = useAuthStore.getState().session;
    const headers = new Headers(init?.headers);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (requiresAuth) {
      if (!session?.token) {
        throw new Error("You need to be signed in to complete this request.");
      }

      headers.set("Authorization", `${session.tokenType ?? "Bearer"} ${session.token}`);
    }

    return fetch(requestUrl, {
      ...init,
      headers,
    });
  }

  let response = await sendRequest();

  if (requiresAuth && response.status === 401) {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      response = await sendRequest();
    }
  }

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new Error(
      readErrorMessage(payload) || `Authentication request failed with ${response.status}.`,
    );
  }

  return payload as T;
}

function resolveGroupsFromPayload(payload: unknown) {
  const groupsPath = commandCenterConfig.auth.jwt.userDetails.responseMapping.groups;

  if (Array.isArray(payload) || typeof payload === "string") {
    return normalizeGroupNames(payload);
  }

  if (!isRecord(payload)) {
    return [] as string[];
  }

  const mappedGroups = readPathValue(payload, groupsPath);
  if (mappedGroups !== undefined) {
    return normalizeGroupNames(mappedGroups);
  }

  const directGroups = readPathValue(payload, "groups");
  if (directGroups !== undefined) {
    return normalizeGroupNames(directGroups);
  }

  const results = readPathValue(payload, "results");
  if (results !== undefined) {
    return normalizeGroupNames(results);
  }

  return [] as string[];
}

export async function fetchCurrentAuthGroups() {
  const groupsPath = commandCenterConfig.auth.jwt.userDetails.groupsUrl.trim();

  if (!groupsPath) {
    return [] as string[];
  }

  const payload = await requestAuthJson<unknown>(groupsPath, undefined, {
    requiresAuth: true,
  });

  return resolveGroupsFromPayload(payload);
}

export function requestPasswordReset(input: PasswordResetRequestInput) {
  return requestAuthJson<AuthDetailResponse>("/user/api/user/password-reset/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function validatePasswordResetLink(input: PasswordResetValidateInput) {
  return requestAuthJson<PasswordResetValidateResponse>("/user/api/user/password-reset/validate/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function confirmPasswordReset(input: PasswordResetConfirmInput) {
  return requestAuthJson<AuthDetailResponse>("/user/api/user/password-reset/confirm/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function requestPasswordChangeEmail() {
  return requestAuthJson<AuthDetailResponse>("/user/api/user/request-password-change/", {
    method: "POST",
    body: JSON.stringify({}),
  }, {
    requiresAuth: true,
  });
}
