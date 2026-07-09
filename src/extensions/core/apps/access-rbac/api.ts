import {
  filterDeprecatedPermissions,
  normalizeBuiltinRole,
  normalizeOrganizationRole,
} from "@/auth/permissions";
import type { AppPlan, AppUser, OrganizationTeam, Permission } from "@/auth/types";
import { useAuthStore } from "@/auth/auth-store";
import { applySessionAuthHeaders } from "@/auth/session-headers";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";

const devAuthProxyPrefix = "/__command_center_auth__";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AccessRbacUsersPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: AppUser[];
}

export interface UserShellAccess {
  userUid: string;
  accessibleApps: string[];
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

function normalizePlan(value: unknown): AppPlan | undefined {
  if (typeof value === "string" && value.trim()) {
    const name = value.trim();

    return {
      name,
      plan_type: name,
    };
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const planType = readString(value.plan_type ?? value.planType ?? value.type);
  const name =
    readString(value.name) ||
    readString(value.plan_name ?? value.planName) ||
    planType;
  const price = readNumber(value.price);
  const description = readString(value.description);

  if (!name && price === undefined && !description && !planType) {
    return undefined;
  }

  const plan: AppPlan = {
    name: name || "Plan",
  };

  if (price !== undefined) {
    plan.price = price;
  }

  if (description) {
    plan.description = description;
  }

  if (planType) {
    plan.plan_type = planType;
  }

  return plan;
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
  return filterDeprecatedPermissions(
    Array.from(new Set(normalizeStringList(value))),
  ) as Permission[];
}

function normalizeOrganizationTeams(value: unknown): OrganizationTeam[] | undefined {
  let rawValue = value;

  if (Array.isArray(rawValue) && rawValue.every((entry) => typeof entry === "string")) {
    return rawValue.flatMap<OrganizationTeam>((entry, index) => {
      const name = entry.trim();

      if (!name) {
        return [];
      }

      return [
        {
          id: index + 1,
          name,
          description: "",
          is_active: true,
        },
      ];
    });
  }

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

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function buildEndpointUrl(
  path: string,
  search?: Record<string, string | number | boolean | undefined>,
  baseUrl = env.apiBaseUrl,
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
  {
    method = "GET",
    search,
    body,
  }: {
    method?: "DELETE" | "GET" | "PATCH" | "POST";
    search?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  } = {},
) {
  const requestUrl = buildEndpointUrl(path, search);

  async function sendRequest() {
    const session = useAuthStore.getState().session;
    const headers = new Headers({
      Accept: "application/json",
    });

    applySessionAuthHeaders(headers, session);

    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(requestUrl, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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
  const organizationRole =
    normalizeOrganizationRole(
      readString(
        readPathValue(record, mapping.organizationRole) ??
          readPathValue(record, "organization_role") ??
          readPathValue(record, "organizationRole"),
      ),
    ) ?? undefined;
  const normalizedRecordRole = normalizeBuiltinRole(readString(
    readPathValue(record, mapping.role) ?? readPathValue(record, "role"),
    "user",
  )) ?? "user";
  const role = normalizedRecordRole;
  const permissions = normalizePermissions(
    readPathValue(record, mapping.permissions) ?? readPathValue(record, "permissions"),
  );
  const email = readString(
    readPathValue(record, mapping.email) ?? readPathValue(record, "email"),
  );
  const firstName = readString(
    readPathValue(record, "first_name") ?? readPathValue(record, "firstName"),
  );
  const lastName = readString(
    readPathValue(record, "last_name") ?? readPathValue(record, "lastName"),
  );
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const plan = normalizePlan(
    readPathValue(record, "plan") ??
      readPathValue(record, "active_plan_type") ??
      readPathValue(record, "organization_plan") ??
      readPathValue(record, "subscription_plan"),
  );
  const name = readString(
    readPathValue(record, mapping.name) ?? readPathValue(record, "name"),
    fullName || deriveName(email, role),
  );
  const team = readString(
    readPathValue(record, mapping.team) ??
      readPathValue(record, "team") ??
      (isRecord(readPathValue(record, "team")) ? readString((readPathValue(record, "team") as Record<string, unknown>).name) : ""),
    "Unknown",
  );
  const id = readStringish(
    readPathValue(record, mapping.userId) ?? readPathValue(record, "id"),
    email || name || "user",
  );
  const uid = readStringish(
    readPathValue(record, "uid") ??
      readPathValue(record, "user_uid") ??
      readPathValue(record, "userUid") ??
      readPathValue(record, "user.uid") ??
      readPathValue(record, "user.user_uid") ??
      readPathValue(record, "user.userUid"),
  );
  const organizationTeams = normalizeOrganizationTeams(
    readPathValue(record, mapping.organizationTeams) ??
      readPathValue(record, "teams") ??
      readPathValue(record, "organization_teams") ??
      readPathValue(record, "organizationTeams"),
  );

  return {
    id,
    uid: uid || undefined,
    name,
    email,
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    plan,
    team,
    role,
    organizationRole,
    permissions,
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

function normalizeShellAccessRecord(record: Record<string, unknown>): UserShellAccess {
  return {
    userUid: readStringish(record.user_uid ?? record.userUid ?? record.uid, ""),
    accessibleApps: normalizeStringList(record.accessible_apps ?? record.accessibleApps),
  };
}

export async function listAccessRbacUsers({
  limit = 25,
  search,
}: {
  limit?: number;
  search?: string;
} = {}) {
  const response = await listAccessRbacUsersPage({
    limit,
    search,
  });

  return response.results;
}

export async function listAccessRbacUsersPage({
  limit = 25,
  offset,
  search,
  excludePodUsers,
  frontEndList,
  includeExtra,
}: {
  limit?: number;
  offset?: number;
  search?: string;
  excludePodUsers?: boolean;
  frontEndList?: boolean;
  includeExtra?: string[];
} = {}): Promise<AccessRbacUsersPage> {
  const payload = await requestAccessRbacJson<
    PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[]
  >(
    commandCenterConfig.accessRbac.users.listUrl,
    {
      search: {
        limit,
        offset,
        search,
        exclude_pod_users: excludePodUsers,
        front_end_list: frontEndList,
        include_extra: includeExtra?.join(","),
      },
    },
  );

  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      next: null,
      previous: null,
      results: payload.map((record) => normalizeUserRecord(record)),
    };
  }

  return {
    count: payload.count,
    next: payload.next,
    previous: payload.previous,
    results: payload.results.map((record) => normalizeUserRecord(record)),
  };
}

export async function getUserShellAccess(userUid: string) {
  const payload = await requestAccessRbacJson<Record<string, unknown>>(
    buildConfigPath(commandCenterConfig.commandCenterAccess.users.shellAccessUrl, {
      user_uid: userUid,
    }),
  );

  return normalizeShellAccessRecord(payload);
}
