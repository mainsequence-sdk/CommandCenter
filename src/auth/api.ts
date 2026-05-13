import { useAuthStore } from "@/auth/auth-store";
import { handleMockAuthRequest } from "@/auth/mock-jwt-auth";
import { commandCenterConfig } from "@/config/command-center";
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

export function buildAuthEndpointUrl(path: string) {
  return buildEndpointUrl(path);
}

export interface AuthDetailResponse {
  detail: string;
}

export class AuthRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
    this.payload = payload;
  }
}

export function isAuthRequestError(error: unknown): error is AuthRequestError {
  return error instanceof AuthRequestError;
}

export interface SocialLoginProvidersResponse {
  providers: string[];
  provider_details?: SocialLoginProviderDetailResponse[];
}

export interface SocialLoginProviderDetailResponse {
  id: string;
  name: string;
  start_url: string;
}

export interface SocialLoginProviderDescriptor {
  id: string;
  name: string;
  startUrl: string;
}

export interface SocialAuthTokenExchangeInput {
  code: string;
  code_verifier: string;
  redirect_uri: string;
}

export interface SocialAuthTokenExchangeResponse {
  access: string;
  refresh: string;
}

export interface BrowserMfaVerifyInput {
  mfa_code: string;
}

export interface BrowserMfaVerifyResponse {
  detail: string;
  redirect_url: string;
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
  mfa_enabled?: boolean;
  mfa_policy_enforced?: boolean;
  mfa_setup_required?: boolean;
  setup_token?: string;
}

export interface VerifyCurrentUserMfaSetupInput {
  mfa_code: string;
}

export interface VerifyCurrentUserMfaSetupResponse {
  detail: string;
  mfa_enabled: boolean;
  mfa_policy_enforced?: boolean;
  mfa_setup_required?: boolean;
  redirect_url?: string | null;
  refresh?: string;
  access?: string;
}

export interface WebSocketTicketRequestInput {
  audience?: string;
}

export interface WebSocketTicketResponse {
  ticket: string;
  ticketType: string;
  audience: string;
  expiresAt: string;
}

export interface CurrentUserProfilePictureResponse {
  id: number;
  profile_picture: string;
}

export interface DeleteCurrentUserAccountResponse {
  detail: string;
  code: "account_deleted";
  deleted_user_id: number;
  deleted_organization: boolean;
}

export interface DeleteCurrentUserAccountBlockingInvoice {
  id: string;
  status: string;
  amount_remaining: number;
  hosted_invoice_url: string | null;
}

export interface DeleteCurrentUserAccountOrgPolicyBlockedPayload {
  detail: string;
  code: "account_deletion_org_policy_blocked";
  organization_kind: string;
  allowed_organization_kind: string;
}

export interface DeleteCurrentUserAccountBillingDebtPayload {
  detail: string;
  code: "billing_debt_exists";
  blocking_invoices: DeleteCurrentUserAccountBlockingInvoice[];
  blocking_consumption_record_ids: number[];
  blocking_credit_transaction_ids: number[];
}

export interface DeleteCurrentUserAccountBillingCleanupFailedPayload {
  detail: string;
  code: "account_deletion_billing_cleanup_failed";
}

export const DEFAULT_WEBSOCKET_TICKET_AUDIENCE = "command_center_ws";

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

  for (const [field, value] of Object.entries(payload)) {
    if (field === "detail") {
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      return `${field}: ${value.trim()}`;
    }

    if (Array.isArray(value)) {
      const messages = value.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      );

      if (messages.length > 0) {
        return `${field}: ${messages.join(" ")}`;
      }
    }
  }

  return "";
}

async function requestAuthJson<T>(
  path: string,
  init?: RequestInit,
  {
    requiresAuth = false,
    credentials,
  }: {
    requiresAuth?: boolean;
    credentials?: RequestCredentials;
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

    if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
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
      credentials: init?.credentials ?? credentials,
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
    throw new AuthRequestError(
      response.status,
      payload,
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

export async function listSocialLoginProviders() {
  const payload = await requestAuthJson<SocialLoginProvidersResponse>("/auth/social/providers/");

  return (payload.provider_details ?? [])
    .filter((provider): provider is SocialLoginProviderDetailResponse => {
      return Boolean(
        provider &&
          typeof provider.id === "string" &&
          typeof provider.start_url === "string",
      );
    })
    .map((provider) => ({
      id: provider.id.trim(),
      name: typeof provider.name === "string" && provider.name.trim() ? provider.name.trim() : provider.id.trim(),
      startUrl: provider.start_url.trim(),
    }))
    .filter((provider) => provider.id && provider.startUrl);
}

export function buildSocialLoginStartUrl(
  baseStartUrl: string,
  input: {
    redirectUri: string;
    state: string;
    codeChallenge: string;
  },
) {
  const baseOrigin =
    typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(
    buildAuthEndpointUrl(baseStartUrl),
    baseOrigin,
  );
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function exchangeSocialAuthCode(input: SocialAuthTokenExchangeInput) {
  return requestAuthJson<SocialAuthTokenExchangeResponse>("/auth/social/token/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyBrowserMfaChallenge(url: string, input: BrowserMfaVerifyInput) {
  return requestAuthJson<BrowserMfaVerifyResponse>(
    url,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    {
      credentials: "include",
    },
  );
}

export function getSocialMfaSetup(url: string) {
  return requestAuthJson<CurrentUserMfaSetupResponse>(
    url,
    undefined,
    {
      credentials: "include",
    },
  );
}

export function verifySocialMfaSetup(
  url: string,
  input: VerifyCurrentUserMfaSetupInput & { setup_token?: string },
) {
  return requestAuthJson<VerifyCurrentUserMfaSetupResponse>(
    url,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    {
      credentials: "include",
    },
  );
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

export function deleteCurrentUserAccount() {
  return requestAuthJson<DeleteCurrentUserAccountResponse>("/user/api/user/delete-account/", {
    method: "DELETE",
    body: JSON.stringify({}),
  }, {
    requiresAuth: true,
  });
}

export function uploadCurrentUserProfilePicture(file: File) {
  if (env.useMockData) {
    const session = useAuthStore.getState().session;
    const numericId = Number(session?.user.id ?? 0);

    return Promise.resolve({
      id: Number.isFinite(numericId) ? numericId : 0,
      profile_picture: URL.createObjectURL(file),
    } satisfies CurrentUserProfilePictureResponse);
  }

  const formData = new FormData();
  formData.set("profile_picture", file);

  return requestAuthJson<CurrentUserProfilePictureResponse>(
    "/user/api/user/profile-picture/",
    {
      method: "POST",
      body: formData,
    },
    {
      requiresAuth: true,
    },
  );
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

export function requestWebSocketTicket(input: WebSocketTicketRequestInput = {}) {
  const path = commandCenterConfig.auth.websocketTicketUrl.trim();

  if (!path) {
    throw new Error("Command Center WebSocket ticket endpoint is not configured.");
  }

  return requestAuthJson<WebSocketTicketResponse>(
    path,
    {
      method: "POST",
      body: JSON.stringify({
        audience: input.audience ?? DEFAULT_WEBSOCKET_TICKET_AUDIENCE,
      }),
    },
    {
      requiresAuth: true,
    },
  );
}
