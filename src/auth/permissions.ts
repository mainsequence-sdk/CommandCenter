import type { AppUser } from "@/auth/types";
import { type BuiltinAppRole, type Permission } from "@/auth/types";

export interface PermissionDefinition {
  id: Permission;
  label: string;
  description: string;
  category: string;
}

export const ORGANIZATION_ADMIN_ROLE = "ORG_ADMIN";
export const ORGANIZATION_ADMIN_PERMISSION = "org_admin:view";
export const LEGACY_ADMIN_PERMISSION = "rbac:view";
export const WORKSPACES_PUBLISH_PERMISSION = "workspaces:publish";
export const DEPRECATED_PERMISSION_IDS = ["news:read"] as const satisfies Permission[];
export const PROMETHEUS_CONNECTION_PERMISSIONS = [
  "prometheus:query",
] as const satisfies Permission[];
export const POSTGRESQL_CONNECTION_PERMISSIONS = [
  "postgresql:query",
] as const satisfies Permission[];
export const TIMESCALEDB_CONNECTION_PERMISSIONS = [
  "timescaledb:query",
] as const satisfies Permission[];
export const MYSQL_CONNECTION_PERMISSIONS = [
  "mysql:query",
] as const satisfies Permission[];
export const MSSQL_CONNECTION_PERMISSIONS = [
  "mssql:query",
] as const satisfies Permission[];

const deprecatedPermissionIdSet = new Set<string>(DEPRECATED_PERMISSION_IDS);

export function isDeprecatedPermission(permission: string) {
  return deprecatedPermissionIdSet.has(permission.trim());
}

export function filterDeprecatedPermissions<T extends string>(permissions: readonly T[]) {
  return permissions.filter((permission) => !isDeprecatedPermission(permission));
}

export const ROLE_LABELS: Record<BuiltinAppRole, string> = {
  user: "User",
  org_admin: "Organization Admin",
};

export const CORE_PERMISSION_DEFINITIONS = [
  {
    id: "workspaces:view",
    label: "Workspaces / view",
    description: "Open the Workspaces application and workspace-backed shell surfaces.",
    category: "Shell",
  },
  {
    id: WORKSPACES_PUBLISH_PERMISSION,
    label: "Workspaces / publish",
    description: "Publish, unpublish, and rotate backend-managed public workspace URLs.",
    category: "Shell",
  },
  {
    id: "widget.catalog:view",
    label: "Widget catalog / view",
    description: "Browse the shared widget catalog from the shell.",
    category: "Shell",
  },
  {
    id: ORGANIZATION_ADMIN_PERMISSION,
    label: "Organization admin / access",
    description: "Open organization-scoped administration surfaces.",
    category: "Shell",
  },
  {
    id: "theme:manage",
    label: "Theme / manage",
    description: "Access theme controls and manage shell theme presets.",
    category: "Shell",
  },
  {
    id: LEGACY_ADMIN_PERMISSION,
    label: "RBAC / view",
    description: "Legacy organization-admin permission kept for backward compatibility.",
    category: "Shell",
  },
  {
    id: "main_sequence_markets:view",
    label: "Main Sequence Markets / view",
    description: "Open the Main Sequence Markets application and its market-facing surfaces.",
    category: "Markets",
  },
  {
    id: "orders:read",
    label: "Orders / read",
    description: "View execution and order management surfaces.",
    category: "Execution",
  },
  {
    id: "orders:submit",
    label: "Orders / submit",
    description: "Trigger order submission and execution actions.",
    category: "Execution",
  },
  {
    id: "prometheus:query",
    label: "Prometheus / query",
    description: "Query backend-owned Prometheus data-source instances.",
    category: "Connections",
  },
  {
    id: "postgresql:query",
    label: "PostgreSQL / query",
    description: "Query backend-owned PostgreSQL data-source instances.",
    category: "Connections",
  },
  {
    id: "timescaledb:query",
    label: "TimescaleDB / query",
    description: "Query backend-owned TimescaleDB data-source instances.",
    category: "Connections",
  },
  {
    id: "mysql:query",
    label: "MySQL / query",
    description: "Query backend-owned MySQL data-source instances.",
    category: "Connections",
  },
  {
    id: "mssql:query",
    label: "SQL Server / query",
    description: "Query backend-owned SQL Server data-source instances.",
    category: "Connections",
  },
] as const satisfies PermissionDefinition[];

export const ALL_PERMISSIONS: Permission[] = Array.from(
  new Set([
    ...CORE_PERMISSION_DEFINITIONS.map((definition) => definition.id),
    ...PROMETHEUS_CONNECTION_PERMISSIONS,
    ...POSTGRESQL_CONNECTION_PERMISSIONS,
    ...TIMESCALEDB_CONNECTION_PERMISSIONS,
    ...MYSQL_CONNECTION_PERMISSIONS,
    ...MSSQL_CONNECTION_PERMISSIONS,
  ]),
).filter((permission) => !isDeprecatedPermission(permission));

function normalizeRoleToken(value?: string | null) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeBuiltinRole(role?: string | null): BuiltinAppRole | null {
  const normalized = normalizeRoleToken(role);

  if (!normalized) {
    return null;
  }

  if (
    [
      "admin",
      "org_admin",
      "organization_admin",
      "organizationadmin",
    ].includes(normalized)
  ) {
    return "org_admin";
  }

  return normalized === "user" ? "user" : null;
}

export function isBuiltinRole(role: string): role is BuiltinAppRole {
  return normalizeBuiltinRole(role) !== null;
}

export function getRoleLabel(role?: string | null) {
  const normalized = normalizeBuiltinRole(role);
  return normalized ? ROLE_LABELS[normalized] : "User";
}

export function normalizeOrganizationRole(role?: string | null) {
  const normalized = normalizeRoleToken(role);

  if (!normalized) {
    return null;
  }

  if (
    [
      "org_admin",
      "organization_admin",
      "organizationadmin",
      "admin",
    ].includes(normalized)
  ) {
    return ORGANIZATION_ADMIN_ROLE;
  }

  return normalized.toUpperCase();
}

export function hasOrganizationAdminAccess(
  user?: Pick<AppUser, "organizationRole" | "role" | "permissions"> | null,
) {
  if (!user) {
    return false;
  }

  if (
    normalizeOrganizationRole(user.organizationRole) === ORGANIZATION_ADMIN_ROLE ||
    normalizeBuiltinRole(user.role) === "org_admin"
  ) {
    return true;
  }

  return hasAnyPermission(user.permissions ?? [], [ORGANIZATION_ADMIN_PERMISSION]);
}

export function getAccessProfileLabel(
  user?: Pick<AppUser, "role" | "permissions" | "organizationRole"> | null,
) {
  if (hasOrganizationAdminAccess(user)) {
    return ROLE_LABELS.org_admin;
  }

  return ROLE_LABELS.user;
}

export function hasAllPermissions(
  current: readonly string[],
  required: readonly string[] = [],
) {
  return required.every((permission) => current.includes(permission));
}

export function hasAnyPermission(
  current: readonly string[],
  required: readonly string[] = [],
) {
  return required.length === 0 || required.some((permission) => current.includes(permission));
}
