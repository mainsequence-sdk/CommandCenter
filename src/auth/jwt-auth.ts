import {
  type AppUser,
  type AuthLoginChallenge,
  type CompleteMfaSetupInput,
  type LoginInput,
  type OrganizationTeam,
  type Permission,
  type Session,
} from "@/auth/types";
import {
  handleMockAuthRequest,
  handleMockJwtAuthorizedGet,
  handleMockJwtPost,
  isMockHttpError,
} from "@/auth/mock-jwt-auth";
import {
  ORGANIZATION_ADMIN_PERMISSION,
  PLATFORM_ADMIN_PERMISSION,
  buildEffectivePermissions,
  getPermissionsForRole,
  normalizeBuiltinRole,
  normalizeOrganizationRole,
} from "@/auth/permissions";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";

const authStorageKey = "command-center.jwt-auth";
const refreshSkewMs = 60_000;
const devAuthProxyPrefix = "/__command_center_auth__";

export interface StoredJwtTokens {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAt?: number;
}

export interface JwtSessionBundle {
  session: Session;
  tokens: StoredJwtTokens;
}

export interface RestoredJwtSession extends JwtSessionBundle {
  refreshNow: boolean;
}

export type JwtLoginResult =
  | {
      status: "authenticated";
      bundle: JwtSessionBundle;
    }
  | {
      status: "mfa_required";
      challenge: Extract<AuthLoginChallenge, { type: "mfa_required" }>;
    }
  | {
      status: "mfa_setup_required";
      challenge: Extract<AuthLoginChallenge, { type: "mfa_setup_required" }>;
    };

interface StoredJwtAuthState {
  session: Session;
  tokens: StoredJwtTokens;
}

class JsonResponseError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "JsonResponseError";
    this.status = status;
    this.payload = payload;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readStringish(value: unknown, fallback = "") {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return undefined;
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

function resolveMappedValue(path: string, sources: Record<string, unknown>[]) {
  for (const source of sources) {
    const value = readPathValue(source, path);

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
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
        const normalizedName = readString(entry.normalized_name);
        return normalizedName ? [normalizedName] : [];
      }

      return [];
    });
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [] as string[];
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeGroupNames(parsed);
      } catch {
        return [trimmed];
      }
    }

    return normalizeStringList(trimmed);
  }

  if (isRecord(value)) {
    const normalizedName = readString(value.normalized_name);
    return normalizedName ? [normalizedName] : [];
  }

  return [] as string[];
}

function buildConfigPath(
  template: string,
  params: Record<string, string | number>,
) {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    if (!(key in params)) {
      return match;
    }

    return encodeURIComponent(String(params[key]));
  });
}

function normalizePermissions(value: unknown) {
  return normalizeStringList(value) as Permission[];
}

function normalizeOrganizationTeams(value: unknown): OrganizationTeam[] | undefined {
  let rawValue = value;

  if (typeof rawValue === "string" && rawValue.trim()) {
    try {
      rawValue = JSON.parse(rawValue);
    } catch {
      return undefined;
    }
  }

  if (!Array.isArray(rawValue)) {
    return undefined;
  }

  return rawValue.flatMap<OrganizationTeam>((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const id = readNumber(entry.id);
    const name = readString(entry.name);

    if (id === undefined || !name) {
      return [];
    }

    return [
      {
        id,
        name,
        description: readString(entry.description),
        is_active: readBoolean(entry.is_active ?? entry.isActive) ?? false,
      },
    ];
  });
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function decodeJwtClaims(token: string) {
  const segments = token.split(".");

  if (segments.length < 2) {
    throw new Error("JWT access token is malformed.");
  }

  const payload = decodeBase64Url(segments[1] ?? "");
  const claims = JSON.parse(payload);

  if (!isRecord(claims)) {
    throw new Error("JWT access token payload is invalid.");
  }

  return claims;
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function resolveEndpointUrl(path: string) {
  const resolvedUrl = new URL(path, env.apiBaseUrl);

  if (import.meta.env.DEV && isLoopbackHostname(resolvedUrl.hostname)) {
    return `${devAuthProxyPrefix}${resolvedUrl.pathname}${resolvedUrl.search}`;
  }

  return resolvedUrl.toString();
}

function describeTransportError(error: unknown) {
  if (error instanceof TypeError) {
    return "The browser could not reach the server. This usually means CORS, mixed content, or an unreachable host.";
  }

  if (error instanceof DOMException) {
    return "The request was blocked before the server returned a response.";
  }

  return "The request failed before the server returned a response.";
}

async function readResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

function extractPayloadErrorMessage(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (Array.isArray(payload)) {
    return payload.filter((entry): entry is string => typeof entry === "string").join(", ");
  }

  if (isRecord(payload)) {
    const detail = payload.detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    const firstEntry = Object.values(payload).find((value) => {
      if (typeof value === "string" && value.trim()) {
        return true;
      }

      return Array.isArray(value) && value.some((entry) => typeof entry === "string");
    });

    if (typeof firstEntry === "string") {
      return firstEntry;
    }

    if (Array.isArray(firstEntry)) {
      return firstEntry
        .filter((entry): entry is string => typeof entry === "string")
        .join(", ");
    }
  }

  return "";
}

function buildJsonResponseError(
  status: number,
  payload: unknown,
  requestLabel: string,
  url: string,
  statusText = "",
) {
  const message = extractPayloadErrorMessage(payload).trim();

  return new JsonResponseError(
    status,
    payload,
    message || `${requestLabel} failed at ${url} with ${status}${statusText ? ` ${statusText}` : ""}.`,
  );
}

async function postJson<T>(url: string, payload: Record<string, unknown>, requestLabel: string) {
  if (env.useMockData) {
    try {
      const mockResponse = handleMockJwtPost(url, payload);

      if (mockResponse !== undefined) {
        return mockResponse as T;
      }
    } catch (error) {
      if (isMockHttpError(error)) {
        throw buildJsonResponseError(error.status, error.payload, requestLabel, url);
      }

      throw error;
    }
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(
      `${requestLabel} could not reach ${url}. ${describeTransportError(error)}`,
    );
  }

  if (!response.ok) {
    throw buildJsonResponseError(
      response.status,
      await readResponsePayload(response),
      requestLabel,
      url,
      response.statusText,
    );
  }

  return (await response.json()) as T;
}

async function requestExactJson<T>(
  url: string,
  init: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
  },
  requestLabel: string,
) {
  const method = init.method ?? "GET";

  if (env.useMockData) {
    try {
      const mockResponse = handleMockAuthRequest(
        url,
        method,
        init.body ?? null,
        null,
      );

      if (mockResponse !== undefined) {
        return mockResponse as T;
      }
    } catch (error) {
      if (isMockHttpError(error)) {
        throw buildJsonResponseError(error.status, error.payload, requestLabel, url);
      }

      throw error;
    }
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch (error) {
    throw new Error(
      `${requestLabel} could not reach ${url}. ${describeTransportError(error)}`,
    );
  }

  if (!response.ok) {
    throw buildJsonResponseError(
      response.status,
      await readResponsePayload(response),
      requestLabel,
      url,
      response.statusText,
    );
  }

  return (await response.json()) as T;
}

async function fetchJsonAuthorized<T>(
  url: string,
  token: string,
  tokenType: string,
  requestLabel: string,
) {
  if (env.useMockData) {
    const mockResponse =
      handleMockJwtAuthorizedGet(url, token) ??
      handleMockAuthRequest(url, "GET", null, token);

    if (mockResponse !== undefined) {
      return mockResponse as T;
    }
  }

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType} ${token}`,
      },
    });
  } catch (error) {
    throw new Error(
      `${requestLabel} could not reach ${url}. ${describeTransportError(error)}`,
    );
  }

  if (!response.ok) {
    throw buildJsonResponseError(
      response.status,
      await readResponsePayload(response),
      requestLabel,
      url,
      response.statusText,
    );
  }

  return (await response.json()) as T;
}

async function postAuthorizedWithoutBody(
  url: string,
  token: string,
  tokenType: string,
  requestLabel: string,
) {
  if (env.useMockData) {
    const mockResponse = handleMockAuthRequest(url, "POST", null, token);

    if (mockResponse !== undefined) {
      return;
    }

    return;
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType} ${token}`,
      },
    });
  } catch (error) {
    throw new Error(
      `${requestLabel} could not reach ${url}. ${describeTransportError(error)}`,
    );
  }

  if (!response.ok) {
    throw buildJsonResponseError(
      response.status,
      await readResponsePayload(response),
      requestLabel,
      url,
      response.statusText,
    );
  }
}

function buildStoredTokens(
  responseData: Record<string, unknown>,
  previousRefreshToken?: string | null,
) {
  const responseFields = commandCenterConfig.auth.jwt.responseFields;
  const accessToken = readString(readPathValue(responseData, responseFields.accessToken));

  if (!accessToken) {
    throw new Error("The configured JWT token response did not include an access token.");
  }

  const claims = decodeJwtClaims(accessToken);
  const expiresAtSeconds = readNumber(claims.exp);

  return {
    accessToken,
    refreshToken:
      readString(readPathValue(responseData, responseFields.refreshToken)) ||
      previousRefreshToken ||
      null,
    tokenType: readString(readPathValue(responseData, responseFields.tokenType), "Bearer"),
    expiresAt: expiresAtSeconds ? expiresAtSeconds * 1000 : undefined,
  } satisfies StoredJwtTokens;
}

async function resolveMfaSetupChallenge(
  detail: string,
  payload: Record<string, unknown>,
): Promise<Extract<AuthLoginChallenge, { type: "mfa_setup_required" }>> {
  const setupToken = readString(payload.setup_token);
  const setupUrl = readString(payload.setup_url);
  const setupVerifyUrl = readString(payload.setup_verify_url);

  if (!setupToken || !setupUrl || !setupVerifyUrl) {
    throw new Error("The MFA setup response did not include the required setup token and URLs.");
  }

  const setupData = await requestExactJson<Record<string, unknown>>(
    setupUrl,
    { method: "GET" },
    "MFA setup request",
  );
  const qrPngBase64 = readString(setupData.qr_png_base64);
  const manualEntryKey = readString(setupData.manual_entry_key);

  if (!qrPngBase64 && !manualEntryKey) {
    throw new Error("The MFA setup response did not include a QR code or manual entry key.");
  }

  return {
    type: "mfa_setup_required",
    detail: detail || "MFA setup is required before login can complete.",
    setupToken,
    setupUrl,
    setupVerifyUrl,
    qrPngBase64: qrPngBase64 || undefined,
    manualEntryKey: manualEntryKey || undefined,
  };
}

async function resolveLoginChallenge(
  error: unknown,
): Promise<AuthLoginChallenge | null> {
  if (!(error instanceof JsonResponseError) || error.status !== 401 || !isRecord(error.payload)) {
    return null;
  }

  const detail = readString(error.payload.detail);
  const code = readString(error.payload.code);

  if (code === "mfa_required" || readBoolean(error.payload.mfa_required) === true) {
    return {
      type: "mfa_required",
      detail: detail || "MFA code required.",
    };
  }

  if (code === "mfa_setup_required" || readBoolean(error.payload.mfa_setup_required) === true) {
    return resolveMfaSetupChallenge(detail, error.payload);
  }

  return null;
}

function deriveName(email: string, role: string) {
  if (email.includes("@")) {
    const localPart = email.split("@")[0] ?? "";
    const normalized = localPart.replace(/[._-]+/g, " ").trim();

    if (normalized) {
      return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
  }

  return role || "User";
}

async function fetchUserDetails(tokens: StoredJwtTokens) {
  const detailsPath = commandCenterConfig.auth.jwt.userDetails.url.trim();

  if (!detailsPath) {
    return null;
  }

  return fetchJsonAuthorized<Record<string, unknown>>(
    resolveEndpointUrl(detailsPath),
    tokens.accessToken,
    tokens.tokenType,
    "User details request",
  );
}

function normalizeShellAccessPermissions(payload: Record<string, unknown>) {
  return normalizePermissions(
    payload.effective_permissions ?? payload.effectivePermissions,
  );
}

function resolveSessionRole({
  permissions,
  platformPermissions = [],
  isPlatformAdmin = false,
}: {
  permissions: Permission[];
  platformPermissions?: Permission[];
  isPlatformAdmin?: boolean;
}) {
  if (
    isPlatformAdmin ||
    permissions.includes(PLATFORM_ADMIN_PERMISSION) ||
    platformPermissions.includes(PLATFORM_ADMIN_PERMISSION)
  ) {
    return "platform_admin" as const;
  }

  if (permissions.includes(ORGANIZATION_ADMIN_PERMISSION)) {
    return "org_admin" as const;
  }

  return "user" as const;
}

async function fetchUserShellAccess(
  tokens: StoredJwtTokens,
  userId: string,
) {
  const shellAccessTemplate = commandCenterConfig.commandCenterAccess.users.shellAccessUrl.trim();

  if (!shellAccessTemplate || !userId) {
    return null;
  }

  const shellAccessPath = buildConfigPath(shellAccessTemplate, {
    user_id: userId,
  });

  const payload = await fetchJsonAuthorized<Record<string, unknown>>(
    resolveEndpointUrl(shellAccessPath),
    tokens.accessToken,
    tokens.tokenType,
    "Shell access request",
  );

  return normalizeShellAccessPermissions(payload);
}

async function hydrateUserShellAccess(
  tokens: StoredJwtTokens,
  user: AppUser,
) {
  if (!user.id) {
    throw new Error("User details did not provide an id required for shell-access resolution.");
  }

  const shellPermissions = await fetchUserShellAccess(tokens, user.id);

  if (!shellPermissions) {
    return user;
  }

  const permissions = buildEffectivePermissions({
    permissions: shellPermissions,
    platformPermissions: user.platformPermissions,
    isPlatformAdmin: user.isPlatformAdmin,
  });

  return {
    ...user,
    role: resolveSessionRole({
      permissions,
      platformPermissions: user.platformPermissions,
      isPlatformAdmin: user.isPlatformAdmin,
    }),
    permissions,
  } satisfies AppUser;
}

function buildUserProfile(
  tokens: StoredJwtTokens,
  tokenResponse?: Record<string, unknown>,
  userDetails?: Record<string, unknown> | null,
): AppUser {
  const claims = decodeJwtClaims(tokens.accessToken);
  const claimMapping = commandCenterConfig.auth.jwt.claimMapping;
  const userDetailsMapping = commandCenterConfig.auth.jwt.userDetails.responseMapping;
  const tokenSources = [tokenResponse, claims].filter(isRecord);
  const allSources = [userDetails, ...tokenSources].filter(isRecord);
  const groups = normalizeGroupNames(
    userDetails ? readPathValue(userDetails, "groups") : undefined,
  );
  const fallbackRole = readString(
    resolveMappedValue(userDetailsMapping.role, allSources) ??
      resolveMappedValue(claimMapping.role, tokenSources),
    "user",
  );
  const organizationRole =
    normalizeOrganizationRole(
      readString(
        (userDetails && resolveMappedValue(userDetailsMapping.organizationRole, [userDetails])) ??
          resolveMappedValue(claimMapping.organizationRole, tokenSources),
      ),
    ) ?? undefined;
  const platformPermissions = normalizePermissions(
    (userDetails && resolveMappedValue(userDetailsMapping.platformPermissions, [userDetails])) ??
      resolveMappedValue(claimMapping.platformPermissions, tokenSources),
  );
  const platformAdminFlag = readBoolean(
    (userDetails && resolveMappedValue(userDetailsMapping.isPlatformAdmin, [userDetails])) ??
      resolveMappedValue(claimMapping.isPlatformAdmin, tokenSources),
  );
  const normalizedFallbackRole = normalizeBuiltinRole(fallbackRole) ?? "user";
  const isPlatformAdmin =
    platformAdminFlag ??
    (platformPermissions.includes("platform_admin:access") ||
      normalizedFallbackRole === "platform_admin");
  const role = isPlatformAdmin ? "platform_admin" : "user";
  const rawPermissions = normalizePermissions(
    (userDetails && resolveMappedValue(userDetailsMapping.permissions, [userDetails])) ??
      resolveMappedValue(claimMapping.permissions, tokenSources),
  );
  const permissions = buildEffectivePermissions({
    permissions: rawPermissions,
    role,
    organizationRole,
    platformPermissions,
    isPlatformAdmin,
  });
  const dateJoined = readString(
    (userDetails && resolveMappedValue(userDetailsMapping.dateJoined, [userDetails])) ??
      resolveMappedValue(claimMapping.dateJoined, tokenSources),
  );
  const isActive = readBoolean(
    (userDetails && resolveMappedValue(userDetailsMapping.isActive, [userDetails])) ??
      resolveMappedValue(claimMapping.isActive, tokenSources),
  );
  const lastLogin = readString(
    (userDetails && resolveMappedValue(userDetailsMapping.lastLogin, [userDetails])) ??
      resolveMappedValue(claimMapping.lastLogin, tokenSources),
  );
  const mfaEnabled = readBoolean(
    (userDetails && resolveMappedValue(userDetailsMapping.mfaEnabled, [userDetails])) ??
      resolveMappedValue(claimMapping.mfaEnabled, tokenSources),
  );
  const organizationTeams = normalizeOrganizationTeams(
    (userDetails &&
      (resolveMappedValue(userDetailsMapping.organizationTeams, [userDetails]) ??
        readPathValue(userDetails, "organization_teams") ??
        readPathValue(userDetails, "organizationTeams"))) ??
      resolveMappedValue(claimMapping.organizationTeams, tokenSources) ??
      resolveMappedValue("organization_teams", tokenSources) ??
      resolveMappedValue("organizationTeams", tokenSources),
  );
  const email = readString(
    (userDetails && resolveMappedValue(userDetailsMapping.email, [userDetails])) ??
      resolveMappedValue(claimMapping.email, tokenSources),
  );
  const firstName = readString(
    (userDetails &&
      (resolveMappedValue("first_name", [userDetails]) ??
        resolveMappedValue("firstName", [userDetails]))) ??
      resolveMappedValue("first_name", tokenSources) ??
      resolveMappedValue("firstName", tokenSources),
  );
  const lastName = readString(
    (userDetails &&
      (resolveMappedValue("last_name", [userDetails]) ??
        resolveMappedValue("lastName", [userDetails]))) ??
      resolveMappedValue("last_name", tokenSources) ??
      resolveMappedValue("lastName", tokenSources),
  );
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const plan = readString(
    (userDetails &&
      (resolveMappedValue("plan", [userDetails]) ??
        resolveMappedValue("active_plan_type", [userDetails]) ??
        resolveMappedValue("organization_plan", [userDetails]) ??
        resolveMappedValue("subscription_plan", [userDetails]))) ??
      resolveMappedValue("plan", tokenSources) ??
      resolveMappedValue("active_plan_type", tokenSources) ??
      resolveMappedValue("organization_plan", tokenSources) ??
      resolveMappedValue("subscription_plan", tokenSources),
  );
  const name = readString(
    (userDetails && resolveMappedValue(userDetailsMapping.name, [userDetails])) ??
      resolveMappedValue(claimMapping.name, tokenSources),
    fullName || deriveName(email, role),
  );
  const team = readString(
    (userDetails && resolveMappedValue(userDetailsMapping.team, [userDetails])) ??
      resolveMappedValue(claimMapping.team, tokenSources),
    "Unknown",
  );
  const id = userDetails
    ? readStringish(
        resolveMappedValue(userDetailsMapping.userId, [userDetails]) ??
          readPathValue(userDetails, "id"),
      )
    : readStringish(resolveMappedValue(claimMapping.userId, tokenSources));

  return {
    id,
    name,
    email,
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    plan: plan || undefined,
    team,
    role,
    organizationRole,
    platformPermissions,
    isPlatformAdmin,
    permissions: permissions.length ? permissions : getPermissionsForRole(role),
    groups,
    dateJoined: dateJoined || undefined,
    isActive,
    lastLogin: lastLogin || undefined,
    mfaEnabled,
    organizationTeams,
  };
}

async function buildSessionBundle(
  tokens: StoredJwtTokens,
  tokenResponse?: Record<string, unknown>,
  options?: {
    includeUserDetails?: boolean;
    user?: AppUser;
  },
) {
  const userDetails = options?.includeUserDetails ? await fetchUserDetails(tokens) : null;
  const claims = decodeJwtClaims(tokens.accessToken);
  const expiresAt = tokens.expiresAt ?? readNumber(claims.exp);
  const resolvedUser =
    userDetails
      ? buildUserProfile(tokens, tokenResponse, userDetails)
      : options?.user ?? buildUserProfile(tokens, tokenResponse, userDetails);
  const session: Session = {
    token: tokens.accessToken,
    tokenType: tokens.tokenType,
    expiresAt:
      expiresAt && expiresAt > 10_000_000_000 ? expiresAt : expiresAt ? expiresAt * 1000 : undefined,
    user: await hydrateUserShellAccess(tokens, resolvedUser),
  };

  return {
    session,
    tokens,
  } satisfies JwtSessionBundle;
}

function shouldRefresh(expiresAt?: number) {
  if (!expiresAt) {
    return false;
  }

  return expiresAt <= Date.now() + refreshSkewMs;
}

function parseStoredSession(value: unknown): Session | null {
  if (!isRecord(value) || !isRecord(value.user)) {
    return null;
  }

  const role = normalizeBuiltinRole(readString(value.user.role, "user")) ?? "user";
  const organizationRole =
    normalizeOrganizationRole(
      readString(value.user.organizationRole ?? value.user.organization_role),
    ) ?? undefined;
  const platformPermissions = normalizePermissions(
    value.user.platformPermissions ?? value.user.platform_permissions,
  );
  const isPlatformAdmin =
    readBoolean(value.user.isPlatformAdmin ?? value.user.is_platform_admin) ??
    (platformPermissions.includes("platform_admin:access") || role === "platform_admin");
  const permissions = buildEffectivePermissions({
    permissions: normalizePermissions(value.user.permissions),
    role,
    organizationRole,
    platformPermissions,
    isPlatformAdmin,
  });

  if (!permissions.length && !readString(value.token)) {
    return null;
  }

  return {
    token: readString(value.token),
    tokenType: readString(value.tokenType, "Bearer"),
    expiresAt: readNumber(value.expiresAt),
    user: {
      id: readStringish(value.user.id),
      name: readString(value.user.name, "User"),
      email: readString(value.user.email),
      avatarUrl: readString(value.user.avatarUrl) || undefined,
      plan: readString(value.user.plan) || undefined,
      team: readString(value.user.team, "Unknown"),
      role,
      organizationRole,
      platformPermissions,
      isPlatformAdmin,
      permissions,
      groups: normalizeGroupNames(value.user.groups),
      dateJoined: readString(value.user.dateJoined) || undefined,
      isActive: readBoolean(value.user.isActive),
      lastLogin: readString(value.user.lastLogin) || undefined,
      mfaEnabled: readBoolean(value.user.mfaEnabled),
      organizationTeams: normalizeOrganizationTeams(
        value.user.organizationTeams ?? value.user.organization_teams,
      ),
    },
  };
}

export function persistJwtSession(bundle: JwtSessionBundle) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: StoredJwtAuthState = {
    session: bundle.session,
    tokens: bundle.tokens,
  };

  window.localStorage.setItem(authStorageKey, JSON.stringify(payload));
}

export function clearStoredJwtSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(authStorageKey);
}

export function restoreStoredJwtSession(): RestoredJwtSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(authStorageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!isRecord(parsed)) {
      clearStoredJwtSession();
      return null;
    }

    const rawTokens = isRecord(parsed.tokens) ? parsed.tokens : parsed;
    const tokens: StoredJwtTokens = {
      accessToken: readString(rawTokens.accessToken),
      refreshToken: readString(rawTokens.refreshToken) || null,
      tokenType: readString(rawTokens.tokenType, "Bearer"),
      expiresAt: readNumber(rawTokens.expiresAt),
    };

    if (!tokens.accessToken) {
      clearStoredJwtSession();
      return null;
    }

    const storedSession = parseStoredSession(parsed.session);

    return {
      session:
        storedSession?.user && storedSession.token
          ? {
              token: storedSession.token,
              tokenType: storedSession.tokenType,
              expiresAt: storedSession.expiresAt,
              user: storedSession.user,
            }
          : {
              token: tokens.accessToken,
              tokenType: tokens.tokenType,
              expiresAt: tokens.expiresAt,
              user: buildUserProfile(tokens),
            },
      tokens,
      refreshNow: shouldRefresh(tokens.expiresAt),
    };
  } catch {
    clearStoredJwtSession();
    return null;
  }
}

export async function resolveStoredJwtSession(
  restored: RestoredJwtSession,
): Promise<JwtSessionBundle> {
  if (shouldRefresh(restored.tokens.expiresAt) && restored.tokens.refreshToken) {
    return refreshJwtSession(restored.tokens.refreshToken, restored.session.user);
  }

  return buildSessionBundle(restored.tokens, undefined, {
    includeUserDetails: true,
    user: restored.session.user,
  });
}

export async function loginWithJwt(input: LoginInput): Promise<JwtLoginResult> {
  const requestFields = commandCenterConfig.auth.jwt.requestFields;
  const requestBody: Record<string, unknown> = {
    [requestFields.identifier]: input.identifier,
    [requestFields.password]: input.password,
  };

  if (input.mfaCode?.trim()) {
    requestBody.mfa_code = input.mfaCode.trim();
  }

  let responseData: Record<string, unknown>;

  try {
    responseData = await postJson<Record<string, unknown>>(
      resolveEndpointUrl(commandCenterConfig.auth.jwt.tokenUrl),
      requestBody,
      "Token request",
    );
  } catch (error) {
    const challenge = await resolveLoginChallenge(error);

    if (challenge?.type === "mfa_required") {
      return {
        status: "mfa_required",
        challenge,
      };
    }

    if (challenge?.type === "mfa_setup_required") {
      return {
        status: "mfa_setup_required",
        challenge,
      };
    }

    throw error;
  }

  const tokens = buildStoredTokens(responseData);

  return {
    status: "authenticated",
    bundle: await buildSessionBundle(tokens, responseData, {
      includeUserDetails: true,
    }),
  };
}

export async function verifyJwtMfaSetup(
  input: CompleteMfaSetupInput,
): Promise<JwtSessionBundle> {
  const responseData = await requestExactJson<Record<string, unknown>>(
    input.setupVerifyUrl,
    {
      method: "POST",
      body: {
        setup_token: input.setupToken,
        mfa_code: input.mfaCode.trim(),
      },
    },
    "MFA setup verification request",
  );
  const tokens = buildStoredTokens(responseData);

  return buildSessionBundle(tokens, responseData, {
    includeUserDetails: true,
  });
}

export async function refreshJwtSession(
  refreshToken: string,
  currentUser?: AppUser,
): Promise<JwtSessionBundle> {
  const requestFields = commandCenterConfig.auth.jwt.requestFields;
  const responseData = await postJson<Record<string, unknown>>(
    resolveEndpointUrl(commandCenterConfig.auth.jwt.refreshUrl),
    {
      [requestFields.refresh]: refreshToken,
    },
    "Refresh request",
  );
  const tokens = buildStoredTokens(responseData, refreshToken);

  return buildSessionBundle(tokens, responseData, {
    includeUserDetails: true,
    user: currentUser,
  });
}

export async function logoutJwtSession(
  accessToken: string,
  tokenType = "Bearer",
): Promise<void> {
  const token = accessToken.trim();

  if (!token) {
    throw new Error("Cannot log out without an access token.");
  }

  await postAuthorizedWithoutBody(
    resolveEndpointUrl("/auth/jwt-token/logout/"),
    token,
    tokenType,
    "Logout request",
  );
}
