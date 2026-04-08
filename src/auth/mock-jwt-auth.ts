import { getPermissionsForRole } from "@/auth/permissions";
import type { AppRole, AppUser, OrganizationTeam, Permission } from "@/auth/types";
import { commandCenterConfig } from "@/config/command-center";

const mockJsonModules = import.meta.glob("/mock_data/command_center/auth.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

type MockAuthUserRecord = {
  id: string;
  email: string;
  password: string;
  name: string;
  first_name?: string;
  last_name?: string;
  team: string;
  role: AppRole;
  organization_role?: string;
  platform_permissions?: Permission[];
  is_platform_admin?: boolean;
  permissions: Permission[];
  groups?: string[];
  date_joined?: string;
  is_active?: boolean;
  last_login?: string;
  mfa_enabled?: boolean;
  organization_teams?: OrganizationTeam[];
  plan?: string;
};

type MockAuthConfig = {
  users: MockAuthUserRecord[];
};

const devAuthProxyPrefix = "/__command_center_auth__";

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readMockConfig(): MockAuthConfig {
  const dataset = mockJsonModules["/mock_data/command_center/auth.json"];

  if (!dataset || typeof dataset !== "object") {
    return {
      users: [],
    };
  }

  return cloneValue(dataset as MockAuthConfig);
}

let mockAuthState = readMockConfig();

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function base64UrlEncode(value: string) {
  const encoded = globalThis.btoa(
    encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    ),
  );

  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const decoded = globalThis.atob(padded);

  return decodeURIComponent(
    Array.from(decoded)
      .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join(""),
  );
}

function buildMockClaims(user: MockAuthUserRecord, expiresAtSeconds: number) {
  const claimMapping = commandCenterConfig.auth.jwt.claimMapping;

  return {
    [claimMapping.userId]: user.id,
    [claimMapping.name]: user.name,
    [claimMapping.email]: user.email,
    [claimMapping.team]: user.team,
    [claimMapping.role]: user.role,
    [claimMapping.permissions]: user.permissions,
    [claimMapping.organizationRole]: user.organization_role ?? "",
    [claimMapping.platformPermissions]: user.platform_permissions ?? [],
    [claimMapping.isPlatformAdmin]: user.is_platform_admin ?? false,
    [claimMapping.dateJoined]: user.date_joined ?? "2026-03-26T08:00:00Z",
    [claimMapping.isActive]: user.is_active ?? true,
    [claimMapping.lastLogin]: user.last_login ?? new Date().toISOString(),
    [claimMapping.mfaEnabled]: user.mfa_enabled ?? false,
    [claimMapping.organizationTeams]: user.organization_teams ?? [],
    exp: expiresAtSeconds,
    iat: Math.floor(Date.now() / 1000),
  };
}

function buildMockJwt(user: MockAuthUserRecord, expiresInSeconds = 60 * 60) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = buildMockClaims(user, expiresAtSeconds);

  return {
    token: `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
      JSON.stringify(payload),
    )}.mock-signature`,
    expiresAtSeconds,
  };
}

function buildMockRefreshToken(user: MockAuthUserRecord, expiresAtSeconds: number) {
  return `mock-refresh.${user.id}.${expiresAtSeconds}`;
}

function findUserByIdentifier(identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  return (
    mockAuthState.users.find((user) => user.email.trim().toLowerCase() === normalizedIdentifier) ??
    null
  );
}

function findUserById(id: string) {
  return mockAuthState.users.find((user) => user.id === id) ?? null;
}

function buildUserDetails(user: MockAuthUserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    team: user.team,
    role: user.role,
    organization_role: user.organization_role ?? "",
    platform_permissions: user.platform_permissions ?? [],
    is_platform_admin: user.is_platform_admin ?? false,
    permissions: user.permissions,
    groups: user.groups ?? [],
    date_joined: user.date_joined ?? "2026-03-26T08:00:00Z",
    is_active: user.is_active ?? true,
    last_login: user.last_login ?? new Date().toISOString(),
    mfa_enabled: user.mfa_enabled ?? false,
    organization_teams: user.organization_teams ?? [],
    plan: user.plan ?? "enterprise",
  };
}

function parseMockRefreshToken(refreshToken: string) {
  const parts = refreshToken.split(".");

  if (parts.length !== 3 || parts[0] !== "mock-refresh") {
    return null;
  }

  return {
    userId: parts[1] ?? "",
    expiresAtSeconds: Number(parts[2] ?? ""),
  };
}

function parseMockJwt(token: string) {
  const parts = token.split(".");

  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1] ?? ""));
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveMockUserFromAccessToken(token: string) {
  const payload = parseMockJwt(token);

  if (!payload) {
    return null;
  }

  const userId = readString(payload[commandCenterConfig.auth.jwt.claimMapping.userId]);

  if (!userId) {
    return null;
  }

  return findUserById(userId);
}

function getMockUnauthorizedMessage() {
  return "Authentication credentials were not provided.";
}

function normalizeMockAuthPathname(url: string) {
  const pathname = new URL(url, window.location.origin).pathname;

  if (!pathname.startsWith(devAuthProxyPrefix)) {
    return pathname;
  }

  const normalizedPathname = pathname.slice(devAuthProxyPrefix.length);
  return normalizedPathname || "/";
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

export function handleMockJwtPost(
  url: string,
  payload: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const pathname = normalizeMockAuthPathname(url);

  if (pathname === new URL(commandCenterConfig.auth.jwt.tokenUrl, window.location.origin).pathname) {
    const identifierField = commandCenterConfig.auth.jwt.requestFields.identifier;
    const passwordField = commandCenterConfig.auth.jwt.requestFields.password;
    const identifier = readString(payload[identifierField]);
    const password = readString(payload[passwordField]);
    const user = findUserByIdentifier(identifier);

    if (!user || user.password !== password) {
      throw new Error("Unable to sign in with the provided credentials.");
    }

    const { token, expiresAtSeconds } = buildMockJwt(user);
    const responseFields = commandCenterConfig.auth.jwt.responseFields;

    user.last_login = new Date().toISOString();

    return {
      [responseFields.accessToken]: token,
      [responseFields.refreshToken]: buildMockRefreshToken(user, expiresAtSeconds + 7 * 24 * 60 * 60),
      [responseFields.tokenType]: "Bearer",
    };
  }

  if (pathname === new URL(commandCenterConfig.auth.jwt.refreshUrl, window.location.origin).pathname) {
    const refreshField = commandCenterConfig.auth.jwt.requestFields.refresh;
    const refreshToken = readString(payload[refreshField]);
    const parsed = parseMockRefreshToken(refreshToken);

    if (!parsed || !parsed.userId) {
      throw new Error("The session expired and could not be refreshed.");
    }

    const user = findUserById(parsed.userId);

    if (!user) {
      throw new Error("The session expired and could not be refreshed.");
    }

    const { token, expiresAtSeconds } = buildMockJwt(user);
    const responseFields = commandCenterConfig.auth.jwt.responseFields;

    return {
      [responseFields.accessToken]: token,
      [responseFields.refreshToken]: buildMockRefreshToken(user, expiresAtSeconds + 7 * 24 * 60 * 60),
      [responseFields.tokenType]: "Bearer",
    };
  }

  return undefined;
}

export function handleMockJwtAuthorizedGet(
  url: string,
  accessToken: string,
): Record<string, unknown> | undefined {
  const pathname = normalizeMockAuthPathname(url);
  const user = resolveMockUserFromAccessToken(accessToken);
  const detailsPathname = new URL(
    commandCenterConfig.auth.jwt.userDetails.url,
    window.location.origin,
  ).pathname;
  const shellAccessPathname = user
    ? new URL(
        buildConfigPath(commandCenterConfig.commandCenterAccess.users.shellAccessUrl, {
          user_id: user.id,
        }),
        window.location.origin,
      ).pathname
    : "";

  if (![detailsPathname, shellAccessPathname].includes(pathname)) {
    return undefined;
  }

  if (!user) {
    throw new Error(getMockUnauthorizedMessage());
  }

  if (pathname === shellAccessPathname) {
    return {
      user_id: user.id,
      policy_ids: [],
      grant_permissions: [],
      deny_permissions: [],
      derived: {
        is_org_admin: user.permissions.includes("org_admin:view"),
        groups: [],
      },
      effective_permissions: user.permissions,
    };
  }

  return buildUserDetails(user);
}

export function handleMockAuthRequest(
  url: string,
  method: string,
  body: Record<string, unknown> | null,
  accessToken?: string | null,
): unknown | undefined {
  const pathname = normalizeMockAuthPathname(url);

  if (method === "GET") {
    const authorizedResponse = handleMockJwtAuthorizedGet(url, accessToken ?? "");

    if (authorizedResponse !== undefined) {
      return authorizedResponse;
    }
  }

  if (pathname === "/user/api/user/password-reset/" && method === "POST") {
    return {
      detail: "If an account with that email exists, a password reset email has been sent.",
    };
  }

  if (pathname === "/user/api/user/password-reset/validate/" && method === "POST") {
    const uidb64 = readString(body?.uidb64);
    const token = readString(body?.token);

    if (!uidb64 || !token || token === "invalid") {
      throw new Error("Password reset link is invalid or expired.");
    }

    return {
      valid: true,
      detail: "Password reset link is valid.",
    };
  }

  if (pathname === "/user/api/user/password-reset/confirm/" && method === "POST") {
    const uidb64 = readString(body?.uidb64);
    const token = readString(body?.token);
    const password = readString(body?.password);
    const confirmPassword = readString(body?.confirm_password);

    if (!uidb64 || !token || token === "invalid") {
      throw new Error("Password reset link is invalid or expired.");
    }

    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    if (password !== confirmPassword) {
      throw new Error("Passwords do not match.");
    }

    return {
      detail: "Password changed successfully. Please log in again.",
    };
  }

  if (pathname === "/user/api/user/request-password-change/" && method === "POST") {
    const user = accessToken ? resolveMockUserFromAccessToken(accessToken) : null;

    if (!user) {
      throw new Error(getMockUnauthorizedMessage());
    }

    return {
      detail: "Password change email sent. Please check your inbox.",
    };
  }

  return undefined;
}

export function getMockAuthHint() {
  const primaryUser = mockAuthState.users[0] ?? null;

  if (!primaryUser) {
    return null;
  }

  return {
    identifier: primaryUser.email,
    password: primaryUser.password,
  };
}

export function buildMockSessionUser(identifier: string): AppUser | null {
  const user = findUserByIdentifier(identifier);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    team: user.team,
    role: user.role,
    organizationRole: user.organization_role,
    platformPermissions: user.platform_permissions ?? [],
    isPlatformAdmin: user.is_platform_admin ?? false,
    permissions:
      user.permissions.length > 0
        ? user.permissions
        : getPermissionsForRole(user.role),
    groups: user.groups ?? [],
    dateJoined: user.date_joined,
    isActive: user.is_active,
    lastLogin: user.last_login,
    mfaEnabled: user.mfa_enabled,
    organizationTeams: user.organization_teams,
    plan: user.plan,
  };
}
