import { builtinAppRoles, type BuiltinAppRole, type Permission } from "@/auth/types";

export interface PermissionDefinition {
  id: Permission;
  label: string;
  description: string;
  category: string;
}

export const ROLE_LABELS: Record<BuiltinAppRole, string> = {
  user: "User",
  admin: "Admin",
};

export const ROLE_PERMISSIONS: Record<BuiltinAppRole, Permission[]> = {
  user: [
    "dashboard:view",
    "widget.catalog:view",
    "marketdata:read",
    "portfolio:read",
    "news:read",
    "orders:read",
    "orders:submit",
    "main_sequence:view",
    "main_sequence.workspace:view",
    "main_sequence.operations:view",
    "main_sequence.data:view",
  ],
  admin: [
    "dashboard:view",
    "widget.catalog:view",
    "theme:manage",
    "rbac:view",
    "marketdata:read",
    "portfolio:read",
    "news:read",
    "orders:read",
    "orders:submit",
    "main_sequence:view",
    "main_sequence.workspace:view",
    "main_sequence.operations:view",
    "main_sequence.data:view",
  ],
};

export const CORE_PERMISSION_DEFINITIONS = [
  {
    id: "dashboard:view",
    label: "Dashboard / view",
    description: "Open dashboard surfaces and dashboard home views.",
    category: "Shell",
  },
  {
    id: "widget.catalog:view",
    label: "Widget catalog / view",
    description: "Browse the shared widget catalog from the shell.",
    category: "Shell",
  },
  {
    id: "theme:manage",
    label: "Theme / manage",
    description: "Access theme controls and manage shell theme presets.",
    category: "Shell",
  },
  {
    id: "rbac:view",
    label: "RBAC / view",
    description: "Open Access & RBAC administration surfaces.",
    category: "Shell",
  },
  {
    id: "marketdata:read",
    label: "Market data / read",
    description: "Open market data views and read market-facing widgets.",
    category: "Markets",
  },
  {
    id: "portfolio:read",
    label: "Portfolio / read",
    description: "Open portfolio-level data and portfolio widgets.",
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
] as const satisfies PermissionDefinition[];

export const ALL_PERMISSIONS = CORE_PERMISSION_DEFINITIONS.map(
  (definition) => definition.id,
);

export function normalizeBuiltinRole(role?: string | null): BuiltinAppRole | null {
  const normalized = role?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return normalized === "admin" ? "admin" : "user";
}

export function isBuiltinRole(role: string): role is BuiltinAppRole {
  return normalizeBuiltinRole(role) !== null;
}

export function getRoleLabel(role?: string | null) {
  const normalized = normalizeBuiltinRole(role);
  return normalized ? ROLE_LABELS[normalized] : "User";
}

export function getPermissionsForRole(role?: string | null) {
  const normalized = normalizeBuiltinRole(role);

  if (!normalized) {
    return [] as Permission[];
  }

  return ROLE_PERMISSIONS[normalized];
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
