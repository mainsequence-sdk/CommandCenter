import {
  builtinAppRoles,
  type AppUser,
  type LoginInput,
  type OrganizationTeam,
  type Permission,
  type Session,
} from "@/auth/types";
import { getPermissionsForRole } from "@/auth/permissions";
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

interface StoredJwtAuthState {
  session: Session;
  tokens: StoredJwtTokens;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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

function normalizeConfiguredGroupList(value: unknown) {
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
        return normalizeConfiguredGroupList(parsed);
      } catch {
        return [trimmed];
      }
    }

    return trimmed
      .split(",")
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
        const name = readString(entry.name);
        return name ? [name] : [];
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
    const name = readString(value.name);
    return name ? [name] : [];
  }

  return [] as string[];
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

function getConfiguredBaseUrl() {
  const configuredBaseUrl = commandCenterConfig.auth.baseUrl.trim();
  return configuredBaseUrl || env.apiBaseUrl;
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function resolveEndpointUrl(path: string) {
  const resolvedUrl = new URL(path, getConfiguredBaseUrl());

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

async function extractErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();

      if (typeof data === "string" && data.trim()) {
        return data;
      }

      if (Array.isArray(data)) {
        return data.filter((entry) => typeof entry === "string").join(", ");
      }

      if (isRecord(data)) {
        const detail = data.detail;

        if (typeof detail === "string" && detail.trim()) {
          return detail;
        }

        const firstEntry = Object.values(data).find((value) => {
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
    } catch {
      return "";
    }
  }

  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function postJson<T>(url: string, payload: Record<string, unknown>, requestLabel: string) {
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
    const message = (await extractErrorMessage(response)).trim();
    throw new Error(
      message ||
        `${requestLabel} failed at ${url} with ${response.status} ${response.statusText}.`,
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
    const message = (await extractErrorMessage(response)).trim();
    throw new Error(
      message ||
        `${requestLabel} failed at ${url} with ${response.status} ${response.statusText}.`,
    );
  }

  return (await response.json()) as T;
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

function resolveRoleFromGroups(groups: string[], fallbackRole: string) {
  const normalizedGroups = new Set(groups.map((group) => group.toLowerCase()));
  const roleGroups = commandCenterConfig.auth.jwt.userDetails.roleGroups;

  for (const role of ["admin", "trader", "analyst", "viewer"] as const) {
    const configuredGroups = normalizeConfiguredGroupList(roleGroups[role]);

    if (
      configuredGroups.some((group) => normalizedGroups.has(group.toLowerCase()))
    ) {
      return role;
    }
  }

  return fallbackRole;
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
    userDetails ? resolveMappedValue(userDetailsMapping.groups, [userDetails]) : undefined,
  );
  const fallbackRole = readString(
    resolveMappedValue(userDetailsMapping.role, allSources) ??
      resolveMappedValue(claimMapping.role, tokenSources),
    "user",
  );
  const role = resolveRoleFromGroups(groups, fallbackRole);
  const permissions = normalizePermissions(
    (userDetails && resolveMappedValue(userDetailsMapping.permissions, [userDetails])) ??
      resolveMappedValue(claimMapping.permissions, tokenSources),
  );
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
  const name = readString(
    (userDetails && resolveMappedValue(userDetailsMapping.name, [userDetails])) ??
      resolveMappedValue(claimMapping.name, tokenSources),
    deriveName(email, role),
  );
  const team = readString(
    (userDetails && resolveMappedValue(userDetailsMapping.team, [userDetails])) ??
      resolveMappedValue(claimMapping.team, tokenSources),
    "Unknown",
  );
  const id = readString(
    (userDetails && resolveMappedValue(userDetailsMapping.userId, [userDetails])) ??
      resolveMappedValue(claimMapping.userId, tokenSources),
    email || role || "user",
  );

  return {
    id,
    name,
    email,
    team,
    role,
    permissions:
      permissions.length || !builtinAppRoles.includes(role as (typeof builtinAppRoles)[number])
        ? permissions
        : getPermissionsForRole(role),
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
  const session: Session = {
    token: tokens.accessToken,
    tokenType: tokens.tokenType,
    expiresAt:
      expiresAt && expiresAt > 10_000_000_000 ? expiresAt : expiresAt ? expiresAt * 1000 : undefined,
    user: options?.user ?? buildUserProfile(tokens, tokenResponse, userDetails),
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

  const permissions = normalizePermissions(value.user.permissions);

  if (!permissions.length && !readString(value.token)) {
    return null;
  }

  return {
    token: readString(value.token),
    tokenType: readString(value.tokenType, "Bearer"),
    expiresAt: readNumber(value.expiresAt),
    user: {
      id: readString(value.user.id),
      name: readString(value.user.name, "User"),
      email: readString(value.user.email),
      avatarUrl: readString(value.user.avatarUrl) || undefined,
      team: readString(value.user.team, "Unknown"),
      role: readString(value.user.role, "user"),
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

  return {
    session: {
      ...restored.session,
      token: restored.tokens.accessToken,
      tokenType: restored.tokens.tokenType,
      expiresAt: restored.tokens.expiresAt,
    },
    tokens: restored.tokens,
  };
}

export async function loginWithJwt(input: LoginInput): Promise<JwtSessionBundle> {
  const requestFields = commandCenterConfig.auth.jwt.requestFields;
  const responseData = await postJson<Record<string, unknown>>(
    resolveEndpointUrl(commandCenterConfig.auth.jwt.tokenUrl),
    {
      [requestFields.identifier]: input.identifier,
      [requestFields.password]: input.password,
    },
    "Token request",
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

  return buildSessionBundle(tokens, responseData, currentUser ? { user: currentUser } : undefined);
}
