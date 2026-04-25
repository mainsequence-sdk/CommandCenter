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
export const PLATFORM_ADMIN_PERMISSION = "platform_admin:access";
export const LEGACY_ADMIN_PERMISSION = "rbac:view";
export const PROMETHEUS_CONNECTION_PERMISSIONS = [
  "prometheus:query",
] as const satisfies Permission[];
export const POSTGRESQL_CONNECTION_PERMISSIONS = [
  "postgresql:query",
] as const satisfies Permission[];

export const ROLE_LABELS: Record<BuiltinAppRole, string> = {
  user: "User",
  org_admin: "Organization Admin",
  platform_admin: "Platform Admin",
};

export const ROLE_PERMISSIONS: Record<BuiltinAppRole, Permission[]> = {
  user: [
    "workspaces:view",
    "widget.catalog:view",
    "main_sequence_markets:view",
    "news:read",
    "orders:read",
    "orders:submit",
    "main_sequence_foundry:view",
    ...PROMETHEUS_CONNECTION_PERMISSIONS,
  ],
  org_admin: [
    "workspaces:view",
    "widget.catalog:view",
    ORGANIZATION_ADMIN_PERMISSION,
    "main_sequence_markets:view",
    "news:read",
    "orders:read",
    "orders:submit",
    "main_sequence_foundry:view",
    ...PROMETHEUS_CONNECTION_PERMISSIONS,
  ],
  platform_admin: [
    "workspaces:view",
    "widget.catalog:view",
    "theme:manage",
    ORGANIZATION_ADMIN_PERMISSION,
    PLATFORM_ADMIN_PERMISSION,
    "main_sequence_markets:view",
    "news:read",
    "orders:read",
    "orders:submit",
    "main_sequence_foundry:view",
    ...PROMETHEUS_CONNECTION_PERMISSIONS,
    ...POSTGRESQL_CONNECTION_PERMISSIONS,
  ],
};

export const CORE_PERMISSION_DEFINITIONS = [
  {
    id: "workspaces:view",
    label: "Workspaces / view",
    description: "Open the Workspaces application and workspace-backed shell surfaces.",
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
    id: PLATFORM_ADMIN_PERMISSION,
    label: "Platform admin / access",
    description: "Open platform-level admin settings and diagnostics.",
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
    id: "news:read",
    label: "News / read",
    description: "Read news and event feed surfaces.",
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
] as const satisfies PermissionDefinition[];

export const ALL_PERMISSIONS: Permission[] = Array.from(
  new Set([
    ...CORE_PERMISSION_DEFINITIONS.map((definition) => definition.id),
    ...PROMETHEUS_CONNECTION_PERMISSIONS,
    ...POSTGRESQL_CONNECTION_PERMISSIONS,
  ]),
);

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
      "platform_admin",
      "platformadmin",
      "superuser",
      "super_user",
      "system_admin",
    ].includes(normalized)
  ) {
    return "platform_admin";
  }

  if (
    [
      "org_admin",
      "organization_admin",
      "organizationadmin",
      "admin",
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

export function getPermissionsForRole(role?: string | null) {
  const normalized = normalizeBuiltinRole(role);

  if (!normalized) {
    return [] as Permission[];
  }

  return ROLE_PERMISSIONS[normalized];
}

export function buildEffectivePermissions({
  permissions = [],
  role,
  organizationRole,
  platformPermissions = [],
  isPlatformAdmin = false,
}: {
  permissions?: string[];
  role?: string | null;
  organizationRole?: string | null;
  platformPermissions?: string[];
  isPlatformAdmin?: boolean;
}) {
  const normalizedRole = normalizeBuiltinRole(role);
  const merged = new Set<Permission>(
    permissions.length > 0
      ? permissions
      : normalizedRole
        ? ROLE_PERMISSIONS[normalizedRole].filter(
            (permission) => permission !== ORGANIZATION_ADMIN_PERMISSION,
          )
        : [],
  );

  platformPermissions.forEach((permission) => {
    if (permission.trim()) {
      merged.add(permission);
    }
  });

  const platformAdmin =
    isPlatformAdmin ||
    normalizedRole === "platform_admin" ||
    merged.has(PLATFORM_ADMIN_PERMISSION);

  if (platformAdmin) {
    merged.add(PLATFORM_ADMIN_PERMISSION);
    merged.add(ORGANIZATION_ADMIN_PERMISSION);
    PROMETHEUS_CONNECTION_PERMISSIONS.forEach((permission) => merged.add(permission));
    POSTGRESQL_CONNECTION_PERMISSIONS.forEach((permission) => merged.add(permission));
  }

  return Array.from(merged);
}

export function hasOrganizationAdminAccess(
  user?: Pick<AppUser, "organizationRole" | "role" | "permissions" | "isPlatformAdmin"> | null,
) {
  if (!user) {
    return false;
  }

  if (user.isPlatformAdmin) {
    return true;
  }

  return hasAnyPermission(user.permissions ?? [], [ORGANIZATION_ADMIN_PERMISSION]);
}

export function hasPlatformAdminAccess(
  user?: Pick<
    AppUser,
    "role" | "permissions" | "platformPermissions" | "isPlatformAdmin"
  > | null,
) {
  if (!user) {
    return false;
  }

  if (user.isPlatformAdmin) {
    return true;
  }

  if (normalizeBuiltinRole(user.role) === "platform_admin") {
    return true;
  }

  return hasAnyPermission(
    [...(user.permissions ?? []), ...(user.platformPermissions ?? [])],
    [PLATFORM_ADMIN_PERMISSION],
  );
}

export function getAccessProfileLabel(
  user?: Pick<
    AppUser,
    "role" | "permissions" | "platformPermissions" | "isPlatformAdmin" | "organizationRole"
  > | null,
) {
  if (hasPlatformAdminAccess(user)) {
    return ROLE_LABELS.platform_admin;
  }

  if (hasOrganizationAdminAccess(user)) {
    return ROLE_LABELS.org_admin;
  }

  return ROLE_LABELS.user;
}

export function hasAllPermissions(
  current: string[],
  required: string[] = [],
) {
  return required.every((permission) => current.includes(permission));
}

export function hasAnyPermission(
  current: string[],
  required: string[] = [],
) {
  return required.length === 0 || required.some((permission) => current.includes(permission));
}
