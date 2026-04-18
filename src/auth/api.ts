import { useAuthStore } from "@/auth/auth-store";
import { handleMockAuthRequest } from "@/auth/mock-jwt-auth";
import { env } from "@/config/env";

const devAuthProxyPrefix = "/__command_center_auth__";

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

export interface UserLoginSessionRecord {
  id: number;
  login_time: string;
  last_seen_at: string | null;
  last_refresh_at: string | null;
  logout_time: string | null;
  revoked_at: string | null;
  revoked_reason: string;
  ip_address: string | null;
  user_agent: string;
  device_label: string;
  auth_source: string;
  is_current: boolean;
  is_active: boolean;
  is_revoked: boolean;
}

export interface RevokeOtherSessionsResponse {
  detail: string;
  revoked_count: number;
}

export interface CurrentUserMfaStatusResponse {
  mfa_enabled: boolean;
}

export interface CurrentUserMfaSetupResponse {
  detail?: string;
  qr_png_base64?: string;
  manual_entry_key?: string;
}

export interface VerifyCurrentUserMfaSetupInput {
  mfa_code: string;
}

export interface VerifyCurrentUserMfaSetupResponse {
  detail: string;
  mfa_enabled: boolean;
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

export function listCurrentUserSessions() {
  return requestAuthJson<UserLoginSessionRecord[]>("/user/api/user/sessions/", undefined, {
    requiresAuth: true,
  });
}

export function revokeCurrentUserSession(sessionId: number) {
  return requestAuthJson<UserLoginSessionRecord>(
    `/user/api/user/sessions/${sessionId}/revoke/`,
    {
      method: "POST",
    },
    {
      requiresAuth: true,
    },
  );
}

export function revokeOtherCurrentUserSessions() {
  return requestAuthJson<RevokeOtherSessionsResponse>(
    "/user/api/user/sessions/revoke-others/",
    {
      method: "POST",
    },
    {
      requiresAuth: true,
    },
  );
}

export function getCurrentUserMfaStatus() {
  return requestAuthJson<CurrentUserMfaStatusResponse>("/user/api/user/mfa/status/", undefined, {
    requiresAuth: true,
  });
}

export function getCurrentUserMfaSetup() {
  return requestAuthJson<CurrentUserMfaSetupResponse>("/user/api/user/mfa/setup/", undefined, {
    requiresAuth: true,
  });
}

export function verifyCurrentUserMfaSetup(input: VerifyCurrentUserMfaSetupInput) {
  return requestAuthJson<VerifyCurrentUserMfaSetupResponse>(
    "/user/api/user/mfa/setup/verify/",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    {
      requiresAuth: true,
    },
  );
}
