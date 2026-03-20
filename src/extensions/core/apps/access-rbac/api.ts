import { getPermissionsForRole, normalizeBuiltinRole } from "@/auth/permissions";
import type { AppUser, OrganizationTeam, Permission } from "@/auth/types";
import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";

const devAuthProxyPrefix = "/__command_center_auth__";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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

function normalizePermissions(value: unknown) {
  return normalizeStringList(value) as Permission[];
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
    return normalizeStringList(value);
  }

  return [] as string[];
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
        is_active:
          readBoolean(entry.is_active) ??
          readBoolean(entry.isActive) ??
          true,
      },
    ];
  });
}

function getConfiguredBaseUrl() {
  const configuredBaseUrl = commandCenterConfig.auth.baseUrl.trim();
  return configuredBaseUrl || env.apiBaseUrl;
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function buildEndpointUrl(
  path: string,
  search?: Record<string, string | number | boolean | undefined>,
  baseUrl = getConfiguredBaseUrl(),
) {
  const url = new URL(path, baseUrl);

  Object.entries(search ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  if (import.meta.env.DEV && isLoopbackHostname(url.hostname)) {
    return `${devAuthProxyPrefix}${url.pathname}${url.search}`;
  }

  return url.toString();
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

async function requestAccessRbacJson<T>(
  path: string,
  search?: Record<string, string | number | boolean | undefined>,
) {
  const requestUrl = buildEndpointUrl(path, search);

  async function sendRequest() {
    const session = useAuthStore.getState().session;
    const headers = new Headers({
      Accept: "application/json",
    });

    if (session?.token) {
      headers.set("Authorization", `${session.tokenType ?? "Bearer"} ${session.token}`);
    }

    return fetch(requestUrl, { headers });
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
    throw new Error(readErrorMessage(payload) || `User request failed with ${response.status}.`);
  }

  return payload as T;
}

function normalizeListPayload<T>(payload: PaginatedResponse<T> | T[]) {
  return Array.isArray(payload) ? payload : payload.results;
}

function deriveName(email: string, role: string) {
  if (!email) {
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : "User";
  }

  const [localPart] = email.split("@");
  const cleaned = localPart
    ?.replace(/[._-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleaned) {
    return email;
  }

  return cleaned
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function normalizeUserRecord(record: Record<string, unknown>): AppUser {
  const mapping = commandCenterConfig.auth.jwt.userDetails.responseMapping;
  const groups = normalizeGroupNames(
    readPathValue(record, mapping.groups) ?? readPathValue(record, "groups"),
  );
  const role = normalizeBuiltinRole(readString(
    readPathValue(record, mapping.role) ?? readPathValue(record, "role"),
    "user",
  )) ?? "user";
  const permissions = normalizePermissions(
    readPathValue(record, mapping.permissions) ?? readPathValue(record, "permissions"),
  );
  const email = readString(
    readPathValue(record, mapping.email) ?? readPathValue(record, "email"),
  );
  const name = readString(
    readPathValue(record, mapping.name) ?? readPathValue(record, "name"),
    deriveName(email, role),
  );
  const team = readString(
    readPathValue(record, mapping.team) ??
      readPathValue(record, "team") ??
      (isRecord(readPathValue(record, "team")) ? readString((readPathValue(record, "team") as Record<string, unknown>).name) : ""),
    "Unknown",
  );
  const id = readString(
    readPathValue(record, mapping.userId) ?? readPathValue(record, "id"),
    email || name || "user",
  );
  const organizationTeams = normalizeOrganizationTeams(
    readPathValue(record, mapping.organizationTeams) ??
      readPathValue(record, "organization_teams") ??
      readPathValue(record, "organizationTeams"),
  );

  return {
    id,
    name,
    email,
    team,
    role,
    permissions: permissions.length ? permissions : getPermissionsForRole(role),
    groups,
    dateJoined:
      readString(readPathValue(record, mapping.dateJoined) ?? readPathValue(record, "date_joined")) ||
      undefined,
    isActive: readBoolean(
      readPathValue(record, mapping.isActive) ?? readPathValue(record, "is_active"),
    ),
    lastLogin:
      readString(readPathValue(record, mapping.lastLogin) ?? readPathValue(record, "last_login")) ||
      undefined,
    mfaEnabled: readBoolean(
      readPathValue(record, mapping.mfaEnabled) ?? readPathValue(record, "mfa_enabled"),
    ),
    organizationTeams,
  };
}

export async function listAccessRbacUsers({
  limit = 25,
  search,
}: {
  limit?: number;
  search?: string;
} = {}) {
  const payload = await requestAccessRbacJson<PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[]>(
    commandCenterConfig.accessRbac.users.listUrl,
    {
      limit,
      search,
    },
  );

  return normalizeListPayload(payload).map((record) => normalizeUserRecord(record));
}

export async function listAccessRbacGroups() {
  const payload = await requestAccessRbacJson<
    | PaginatedResponse<Record<string, unknown>>
    | Record<string, unknown>[]
    | Record<string, unknown>
    | string[]
  >(commandCenterConfig.accessRbac.groups.listUrl);

  let rawGroups: unknown = payload;

  if (!Array.isArray(payload) && isRecord(payload)) {
    rawGroups = readPathValue(payload, "groups") ?? readPathValue(payload, "results") ?? payload;
  }

  return Array.from(new Set(normalizeGroupNames(rawGroups))).sort((left, right) =>
    left.localeCompare(right),
  );
}
