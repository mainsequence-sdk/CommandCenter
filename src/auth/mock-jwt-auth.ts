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

type MockTrackedSessionRecord = {
  id: number;
  user_id: string;
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
};

type MockMfaSetupRecord = {
  userId: string;
  setupToken: string;
  createdAt: string;
};

const devAuthProxyPrefix = "/__command_center_auth__";
const mockMfaEnrollmentCode = "123456";
const mockQrPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sN8pKcAAAAASUVORK5CYII=";

export class MockHttpError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown) {
    super(
      typeof payload === "object" &&
        payload !== null &&
        "detail" in payload &&
        typeof payload.detail === "string"
        ? payload.detail
        : `Mock request failed with ${status}.`,
    );
    this.name = "MockHttpError";
    this.status = status;
    this.payload = payload;
  }
}

export function isMockHttpError(error: unknown): error is MockHttpError {
  return error instanceof MockHttpError;
}

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
let mockSessionIdCounter = 100;
const mockTrackedSessions: MockTrackedSessionRecord[] = [];
const mockMfaSetups = new Map<string, MockMfaSetupRecord>();

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

function isPrivilegedMockUser(user: MockAuthUserRecord) {
  return Boolean(
    user.is_platform_admin ||
      user.organization_role === "ORG_ADMIN" ||
      user.permissions.includes("org_admin:view") ||
      user.permissions.includes("platform_admin:access"),
  );
}

function buildMockMfaManualEntryKey(user: MockAuthUserRecord) {
  return `MS-${user.id.padStart(4, "0")}-AUTH`;
}

function buildMockMfaSetupPayload(user: MockAuthUserRecord) {
  return {
    qr_png_base64: mockQrPngBase64,
    manual_entry_key: buildMockMfaManualEntryKey(user),
    detail: "Scan the QR code or enter the manual key, then verify with your first code.",
  };
}

function buildMockMfaSetupUrl(setupToken: string) {
  return new URL(
    `/user/api/user/mfa/setup/?setup_token=${encodeURIComponent(setupToken)}`,
    window.location.origin,
  ).toString();
}

function buildMockMfaSetupVerifyUrl() {
  return new URL("/user/api/user/mfa/setup/verify/", window.location.origin).toString();
}

function issueMockMfaSetup(user: MockAuthUserRecord) {
  const setupToken = `mock-setup.${user.id}.${Date.now()}`;
  mockMfaSetups.set(setupToken, {
    userId: user.id,
    setupToken,
    createdAt: new Date().toISOString(),
  });

  return {
    setupToken,
    setupUrl: buildMockMfaSetupUrl(setupToken),
    setupVerifyUrl: buildMockMfaSetupVerifyUrl(),
  };
}

function resolveMockMfaSetup(setupToken: string) {
  const setup = mockMfaSetups.get(setupToken);

  if (!setup) {
    return null;
  }

  const user = findUserById(setup.userId);

  if (!user) {
    mockMfaSetups.delete(setupToken);
    return null;
  }

  return {
    setup,
    user,
  };
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

function nextMockSessionId() {
  mockSessionIdCounter += 1;
  return mockSessionIdCounter;
}

function createMockSession(input: {
  userId: string;
  userAgent: string;
  deviceLabel: string;
  ipAddress: string;
  isCurrent: boolean;
  loginTime: string;
  lastSeenAt: string;
  lastRefreshAt: string;
}) {
  const session: MockTrackedSessionRecord = {
    id: nextMockSessionId(),
    user_id: input.userId,
    login_time: input.loginTime,
    last_seen_at: input.lastSeenAt,
    last_refresh_at: input.lastRefreshAt,
    logout_time: null,
    revoked_at: null,
    revoked_reason: "",
    ip_address: input.ipAddress,
    user_agent: input.userAgent,
    device_label: input.deviceLabel,
    auth_source: "jwt",
    is_current: input.isCurrent,
    is_active: true,
    is_revoked: false,
  };
  mockTrackedSessions.push(session);
  return session;
}

function ensureTrackedSessionsForUser(
  user: MockAuthUserRecord,
  activeUserAgent: string,
) {
  const userSessions = mockTrackedSessions.filter((session) => session.user_id === user.id);

  if (userSessions.length === 0) {
    const now = new Date();
    const nowIso = now.toISOString();
    const previousIso = new Date(now.getTime() - 1000 * 60 * 27).toISOString();
    const previousSeenIso = new Date(now.getTime() - 1000 * 60 * 4).toISOString();

    createMockSession({
      userId: user.id,
      userAgent: activeUserAgent,
      deviceLabel: "Current browser session",
      ipAddress: "203.0.113.10",
      isCurrent: true,
      loginTime: nowIso,
      lastSeenAt: nowIso,
      lastRefreshAt: nowIso,
    });
    createMockSession({
      userId: user.id,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36",
      deviceLabel: "Chrome on macOS",
      ipAddress: "198.51.100.41",
      isCurrent: false,
      loginTime: previousIso,
      lastSeenAt: previousSeenIso,
      lastRefreshAt: previousSeenIso,
    });
  } else if (!userSessions.some((session) => session.is_current && session.is_active)) {
    const nowIso = new Date().toISOString();
    createMockSession({
      userId: user.id,
      userAgent: activeUserAgent,
      deviceLabel: "Current browser session",
      ipAddress: "203.0.113.10",
      isCurrent: true,
      loginTime: nowIso,
      lastSeenAt: nowIso,
      lastRefreshAt: nowIso,
    });
  }
}

function listTrackedSessionsForUser(user: MockAuthUserRecord) {
  ensureTrackedSessionsForUser(user, navigator.userAgent);

  return mockTrackedSessions
    .filter((session) => session.user_id === user.id)
    .sort((left, right) => {
      const leftTime = Date.parse(left.login_time);
      const rightTime = Date.parse(right.login_time);
      return Number.isNaN(rightTime) || Number.isNaN(leftTime) ? 0 : rightTime - leftTime;
    })
    .map(({ user_id: _userId, ...session }) => ({
      ...session,
    }));
}

function revokeTrackedSession(session: MockTrackedSessionRecord, reason: string) {
  const nowIso = new Date().toISOString();

  session.is_active = false;
  session.is_revoked = true;
  session.is_current = false;
  session.revoked_at = nowIso;
  session.logout_time = nowIso;
  session.revoked_reason = reason;
  session.last_seen_at = nowIso;
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
    const mfaCode = readString(payload.mfa_code);
    const user = findUserByIdentifier(identifier);

    if (!user || user.password !== password) {
      throw new Error("Unable to sign in with the provided credentials.");
    }

    if (user.mfa_enabled) {
      if (!mfaCode) {
        throw new MockHttpError(401, {
          detail: "MFA code required.",
          code: "mfa_required",
          mfa_required: true,
        });
      }

      if (mfaCode !== mockMfaEnrollmentCode) {
        throw new MockHttpError(401, {
          detail: "Invalid MFA code.",
        });
      }
    } else if (isPrivilegedMockUser(user)) {
      const setupChallenge = issueMockMfaSetup(user);

      throw new MockHttpError(401, {
        detail: "MFA setup is required before login can complete.",
        code: "mfa_setup_required",
        mfa_setup_required: true,
        setup_token: setupChallenge.setupToken,
        setup_url: setupChallenge.setupUrl,
        setup_verify_url: setupChallenge.setupVerifyUrl,
      });
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

  if (pathname === "/user/api/user/mfa/status/" && method === "GET") {
    const user = accessToken ? resolveMockUserFromAccessToken(accessToken) : null;

    if (!user) {
      throw new Error(getMockUnauthorizedMessage());
    }

    return {
      mfa_enabled: user.mfa_enabled ?? false,
    };
  }

  if (pathname === "/user/api/user/mfa/setup/" && method === "GET") {
    const authenticatedUser = accessToken ? resolveMockUserFromAccessToken(accessToken) : null;

    if (authenticatedUser) {
      if (authenticatedUser.mfa_enabled) {
        throw new Error("MFA is already enabled for this account.");
      }

      return buildMockMfaSetupPayload(authenticatedUser);
    }

    const setupToken = readString(new URL(url, window.location.origin).searchParams.get("setup_token"));
    const resolved = resolveMockMfaSetup(setupToken);

    if (!resolved) {
      throw new MockHttpError(401, {
        detail: "MFA setup token is invalid or expired.",
      });
    }

    return buildMockMfaSetupPayload(resolved.user);
  }

  if (pathname === "/user/api/user/mfa/setup/verify/" && method === "POST") {
    const authenticatedUser = accessToken ? resolveMockUserFromAccessToken(accessToken) : null;

    if (authenticatedUser) {
      const mfaCode = readString(body?.mfa_code);

      if (!mfaCode) {
        throw new Error("MFA code is required.");
      }

      if (mfaCode !== mockMfaEnrollmentCode) {
        throw new MockHttpError(401, {
          detail: "Invalid MFA code.",
        });
      }

      authenticatedUser.mfa_enabled = true;
      authenticatedUser.last_login = new Date().toISOString();

      return {
        detail: "MFA enabled successfully.",
        mfa_enabled: true,
      };
    }

    const setupToken = readString(body?.setup_token);
    const mfaCode = readString(body?.mfa_code);
    const resolved = resolveMockMfaSetup(setupToken);

    if (!resolved) {
      throw new MockHttpError(401, {
        detail: "MFA setup token is invalid or expired.",
      });
    }

    if (mfaCode !== mockMfaEnrollmentCode) {
      throw new MockHttpError(401, {
        detail: "Invalid MFA code.",
      });
    }

    resolved.user.mfa_enabled = true;
    resolved.user.last_login = new Date().toISOString();
    mockMfaSetups.delete(setupToken);

    const { token, expiresAtSeconds } = buildMockJwt(resolved.user);
    const responseFields = commandCenterConfig.auth.jwt.responseFields;

    return {
      detail: "MFA enabled successfully.",
      mfa_enabled: true,
      mfa_policy_enforced: true,
      mfa_setup_required: false,
      [responseFields.accessToken]: token,
      [responseFields.refreshToken]: buildMockRefreshToken(
        resolved.user,
        expiresAtSeconds + 7 * 24 * 60 * 60,
      ),
      [responseFields.tokenType]: "Bearer",
    };
  }

  if (pathname === "/auth/jwt-token/logout/" && method === "POST") {
    const user = accessToken ? resolveMockUserFromAccessToken(accessToken) : null;

    if (!user) {
      throw new Error(getMockUnauthorizedMessage());
    }

    const currentSession = mockTrackedSessions.find(
      (session) => session.user_id === user.id && session.is_current && session.is_active,
    );

    if (currentSession) {
      revokeTrackedSession(currentSession, "User logged out.");
    }

    return {
      detail: "JWT session logged out successfully.",
    };
  }

  if (pathname === "/user/api/user/sessions/" && method === "GET") {
    const user = accessToken ? resolveMockUserFromAccessToken(accessToken) : null;

    if (!user) {
      throw new Error(getMockUnauthorizedMessage());
    }

    return listTrackedSessionsForUser(user);
  }

  const revokeOneMatch = pathname.match(/^\/user\/api\/user\/sessions\/(\d+)\/revoke\/$/);

  if (revokeOneMatch && method === "POST") {
    const user = accessToken ? resolveMockUserFromAccessToken(accessToken) : null;

    if (!user) {
      throw new Error(getMockUnauthorizedMessage());
    }

    const sessionId = Number.parseInt(revokeOneMatch[1] ?? "", 10);
    const session = mockTrackedSessions.find(
      (entry) => entry.id === sessionId && entry.user_id === user.id,
    );

    if (!session) {
      throw new Error("Session not found.");
    }

    revokeTrackedSession(session, "Revoked by current user.");

    const { user_id: _userId, ...record } = session;
    return record;
  }

  if (pathname === "/user/api/user/sessions/revoke-others/" && method === "POST") {
    const user = accessToken ? resolveMockUserFromAccessToken(accessToken) : null;

    if (!user) {
      throw new Error(getMockUnauthorizedMessage());
    }

    const sessions = mockTrackedSessions.filter((session) => session.user_id === user.id);
    let revokedCount = 0;

    for (const session of sessions) {
      if (!session.is_current && session.is_active && !session.is_revoked) {
        revokeTrackedSession(session, "Revoked by current user.");
        revokedCount += 1;
      }
    }

    return {
      detail: "Other tracked sessions revoked successfully.",
      revoked_count: revokedCount,
    };
  }

  return undefined;
}

export function getMockAuthHint() {
  const primaryUser =
    mockAuthState.users.find((user) => !user.mfa_enabled && !isPrivilegedMockUser(user)) ??
    mockAuthState.users[0] ??
    null;

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
