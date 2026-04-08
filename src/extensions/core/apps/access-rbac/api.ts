import {
  buildEffectivePermissions,
  getPermissionsForRole,
  normalizeBuiltinRole,
  normalizeOrganizationRole,
} from "@/auth/permissions";
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

export interface AccessRbacUsersPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: AppUser[];
}

export interface AccessPolicy {
  id: number;
  slugifiedName: string;
  label: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  isEditable: boolean;
}

export interface UserShellAccessGroup {
  id: number;
  name: string;
  normalizedName: string;
  permissions: Permission[];
}

export interface UserShellAccess {
  userId: string;
  policyIds: string[];
  grantPermissions: Permission[];
  denyPermissions: Permission[];
  derived: {
    isOrgAdmin: boolean;
    groups: UserShellAccessGroup[];
  };
  effectivePermissions: Permission[];
}

export interface AccessPolicyWriteInput {
  slugifiedName: string;
  label: string;
  description: string;
  permissions: Permission[];
}

export interface UserShellAccessPatchInput {
  policyIds: string[];
  grantPermissions: Permission[];
  denyPermissions: Permission[];
}

const hiddenAccessPolicySlugs = new Set(["platform-admin"]);
export const BUILTIN_ACCESS_POLICY_DETAILS = {
  "light-user": {
    slugifiedName: "light-user",
    label: "Light User",
    description:
      "Base shell access for users who should only see Workspaces and Main Sequence Markets.",
    permissions: ["workspaces:view", "main_sequence_markets:view"],
    isSystem: true,
    isEditable: false,
    isVisible: true,
  },
  "dev-user": {
    slugifiedName: "dev-user",
    label: "Dev User",
    description:
      "Developer shell access for users who should see the full Main Sequence Foundry application.",
    permissions: [
      "workspaces:view",
      "main_sequence_markets:view",
      "main_sequence_foundry:view",
    ],
    isSystem: true,
    isEditable: false,
    isVisible: true,
  },
  "org-admin-user": {
    slugifiedName: "org-admin-user",
    label: "Org Admin User",
    description:
      "Organization-admin-only shell access for users who should only see organization administration surfaces.",
    permissions: ["org_admin:view"],
    isSystem: true,
    isEditable: false,
    isVisible: true,
  },
} as const;
const builtinLockedAccessPolicySlugs = new Set(
  Object.keys(BUILTIN_ACCESS_POLICY_DETAILS).map((slug) => normalizePolicySlug(slug)),
);

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

function normalizePolicySlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  return Array.from(new Set(normalizeStringList(value))) as Permission[];
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
    return normalizeStringList(value);
  }

  if (isRecord(value)) {
    const normalizedName = readString(value.normalized_name);
    return normalizedName ? [normalizedName] : [];
  }

  return [] as string[];
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

    if (session?.token) {
      headers.set("Authorization", `${session.tokenType ?? "Bearer"} ${session.token}`);
    }

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

function isHiddenAccessPolicySlug(slug: string) {
  return hiddenAccessPolicySlugs.has(normalizePolicySlug(slug));
}

function isBuiltinLockedAccessPolicySlug(slug: string) {
  return builtinLockedAccessPolicySlugs.has(normalizePolicySlug(slug));
}

export function isVisibleAccessPolicy(policy: Pick<AccessPolicy, "slugifiedName">) {
  return !isHiddenAccessPolicySlug(policy.slugifiedName);
}

export function isAssignableAccessPolicy(
  policy: Pick<AccessPolicy, "slugifiedName" | "isSystem">,
) {
  return isVisibleAccessPolicy(policy) && !policy.isSystem;
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
  const groups = normalizeGroupNames(readPathValue(record, "groups"));
  const organizationRole =
    normalizeOrganizationRole(
      readString(
        readPathValue(record, mapping.organizationRole) ??
          readPathValue(record, "organization_role") ??
          readPathValue(record, "organizationRole"),
      ),
    ) ?? undefined;
  const platformPermissions = normalizePermissions(
    readPathValue(record, mapping.platformPermissions) ??
      readPathValue(record, "platform_permissions") ??
      readPathValue(record, "platformPermissions"),
  );
  const normalizedRecordRole = normalizeBuiltinRole(readString(
    readPathValue(record, mapping.role) ?? readPathValue(record, "role"),
    "user",
  )) ?? "user";
  const isPlatformAdmin =
    readBoolean(
      readPathValue(record, mapping.isPlatformAdmin) ??
        readPathValue(record, "is_platform_admin") ??
        readPathValue(record, "isPlatformAdmin"),
    ) ??
    (platformPermissions.includes("platform_admin:access") || normalizedRecordRole === "platform_admin");
  const role =
    isPlatformAdmin
      ? "platform_admin"
      : normalizedRecordRole;
  const permissions = buildEffectivePermissions({
    permissions: normalizePermissions(
      readPathValue(record, mapping.permissions) ?? readPathValue(record, "permissions"),
    ),
    role,
    organizationRole,
    platformPermissions,
    isPlatformAdmin,
  });
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
  const plan = readString(
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
  const organizationTeams = normalizeOrganizationTeams(
    readPathValue(record, mapping.organizationTeams) ??
      readPathValue(record, "teams") ??
      readPathValue(record, "organization_teams") ??
      readPathValue(record, "organizationTeams"),
  );

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

function normalizeAccessPolicyRecord(record: Record<string, unknown>): AccessPolicy {
  const slugifiedName = normalizePolicySlug(
    readString(record.slugified_name) || readString(record.slugifiedName) || readString(record.label),
  );
  const isBuiltinLocked = isBuiltinLockedAccessPolicySlug(slugifiedName);
  const builtinDetails =
    BUILTIN_ACCESS_POLICY_DETAILS[
      slugifiedName as keyof typeof BUILTIN_ACCESS_POLICY_DETAILS
    ];

  return {
    id: readNumber(record.id) ?? 0,
    slugifiedName,
    label: builtinDetails?.label ?? readString(record.label, slugifiedName || "Policy"),
    description: builtinDetails?.description ?? readString(record.description),
    permissions: builtinDetails
      ? [...builtinDetails.permissions]
      : normalizePermissions(record.permissions),
    isSystem:
      builtinDetails?.isSystem ??
      readBoolean(record.is_system) ??
      readBoolean(record.isSystem) ??
      isBuiltinLocked,
    isEditable:
      builtinDetails?.isEditable ??
      ((readBoolean(record.is_editable) ?? readBoolean(record.isEditable) ?? !isBuiltinLocked) &&
        !isBuiltinLocked),
  };
}

function normalizeShellAccessGroup(record: unknown): UserShellAccessGroup | null {
  if (!isRecord(record)) {
    return null;
  }

  const normalizedName = readString(record.normalized_name) || readString(record.normalizedName);
  const id = readNumber(record.id);
  const name = readString(record.name);

  if (id === undefined || !name) {
    return null;
  }

  return {
    id,
    name,
    normalizedName,
    permissions: normalizePermissions(record.permissions),
  };
}

function normalizeShellAccessRecord(record: Record<string, unknown>): UserShellAccess {
  const derived = isRecord(record.derived) ? record.derived : {};
  const groups = Array.isArray(derived.groups)
    ? derived.groups
        .map((entry) => normalizeShellAccessGroup(entry))
        .filter((entry): entry is UserShellAccessGroup => entry !== null)
    : [];

  return {
    userId: readStringish(record.user_id ?? record.userId, ""),
    policyIds: normalizeStringList(record.policy_ids ?? record.policyIds),
    grantPermissions: normalizePermissions(
      record.grant_permissions ?? record.grantPermissions,
    ),
    denyPermissions: normalizePermissions(
      record.deny_permissions ?? record.denyPermissions,
    ),
    derived: {
      isOrgAdmin:
        readBoolean(derived.is_org_admin ?? derived.isOrgAdmin) ??
        groups.some((group) => group.normalizedName.trim().toLowerCase() === "org_admin"),
      groups,
    },
    effectivePermissions: normalizePermissions(
      record.effective_permissions ?? record.effectivePermissions,
    ),
  };
}

function normalizeAccessPolicyInput(input: AccessPolicyWriteInput) {
  return {
    slugified_name: normalizePolicySlug(input.slugifiedName),
    label: readString(input.label, "Policy"),
    description: readString(input.description),
    permissions: normalizePermissions(input.permissions),
  };
}

function normalizeShellAccessPatchInput(input: UserShellAccessPatchInput) {
  return {
    policy_ids: Array.from(new Set(input.policyIds.map((entry) => normalizePolicySlug(entry)).filter(Boolean))),
    grant_permissions: normalizePermissions(input.grantPermissions),
    deny_permissions: normalizePermissions(input.denyPermissions),
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

export async function listAccessPolicies({
  includeHidden = false,
  limit = 100,
}: {
  includeHidden?: boolean;
  limit?: number;
} = {}) {
  const results: AccessPolicy[] = [];
  let offset = 0;

  while (true) {
    const payload = await requestAccessRbacJson<
      PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[]
    >(commandCenterConfig.commandCenterAccess.accessPolicies.listUrl, {
      search: {
        limit,
        offset,
      },
    });

    const pageItems = normalizeListPayload(payload).map((record) =>
      normalizeAccessPolicyRecord(record),
    );

    results.push(...pageItems);

    if (Array.isArray(payload)) {
      break;
    }

    offset += payload.results.length;

    if (!payload.next || offset >= payload.count) {
      break;
    }
  }

  const deduped = Array.from(
    new Map(results.map((policy) => [policy.slugifiedName, policy])).values(),
  );

  return includeHidden ? deduped : deduped.filter((policy) => isVisibleAccessPolicy(policy));
}

export async function createAccessPolicy(input: AccessPolicyWriteInput) {
  const payload = await requestAccessRbacJson<Record<string, unknown>>(
    commandCenterConfig.commandCenterAccess.accessPolicies.listUrl,
    {
      method: "POST",
      body: normalizeAccessPolicyInput(input),
    },
  );

  return normalizeAccessPolicyRecord(payload);
}

export async function updateAccessPolicy(policyId: number, input: AccessPolicyWriteInput) {
  const payload = await requestAccessRbacJson<Record<string, unknown>>(
    buildConfigPath(commandCenterConfig.commandCenterAccess.accessPolicies.detailUrl, {
      id: policyId,
    }),
    {
      method: "PATCH",
      body: normalizeAccessPolicyInput(input),
    },
  );

  return normalizeAccessPolicyRecord(payload);
}

export async function deleteAccessPolicy(policyId: number) {
  await requestAccessRbacJson<null>(
    buildConfigPath(commandCenterConfig.commandCenterAccess.accessPolicies.detailUrl, {
      id: policyId,
    }),
    {
      method: "DELETE",
    },
  );
}

export async function getUserShellAccess(userId: string | number) {
  const payload = await requestAccessRbacJson<Record<string, unknown>>(
    buildConfigPath(commandCenterConfig.commandCenterAccess.users.shellAccessUrl, {
      user_id: userId,
    }),
  );

  return normalizeShellAccessRecord(payload);
}

export async function updateUserShellAccess(
  userId: string | number,
  input: UserShellAccessPatchInput,
) {
  const payload = await requestAccessRbacJson<Record<string, unknown>>(
    buildConfigPath(commandCenterConfig.commandCenterAccess.users.shellAccessUrl, {
      user_id: userId,
    }),
    {
      method: "PATCH",
      body: normalizeShellAccessPatchInput(input),
    },
  );

  return normalizeShellAccessRecord(payload);
}

export async function previewUserShellAccess(
  userId: string | number,
  input: UserShellAccessPatchInput,
) {
  const payload = await requestAccessRbacJson<Record<string, unknown>>(
    buildConfigPath(commandCenterConfig.commandCenterAccess.users.shellAccessPreviewUrl, {
      user_id: userId,
    }),
    {
      method: "POST",
      body: normalizeShellAccessPatchInput(input),
    },
  );

  return normalizeShellAccessRecord(payload);
}
