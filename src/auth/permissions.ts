import { builtinAppRoles, type BuiltinAppRole, type Permission } from "@/auth/types";

export const ROLE_LABELS: Record<BuiltinAppRole, string> = {
  viewer: "Viewer",
  analyst: "Analyst",
  trader: "Trader",
  admin: "Admin",
};

export const ROLE_PERMISSIONS: Record<BuiltinAppRole, Permission[]> = {
  viewer: ["dashboard:view", "marketdata:read", "news:read"],
  analyst: [
    "dashboard:view",
    "widget.catalog:view",
    "marketdata:read",
    "portfolio:read",
    "news:read",
  ],
  trader: [
    "dashboard:view",
    "widget.catalog:view",
    "marketdata:read",
    "portfolio:read",
    "news:read",
    "orders:read",
    "orders:submit",
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
  ],
};

export const ALL_PERMISSIONS = [
  "dashboard:view",
  "widget.catalog:view",
  "theme:manage",
  "rbac:view",
  "marketdata:read",
  "portfolio:read",
  "news:read",
  "orders:read",
  "orders:submit",
] as const satisfies Permission[];

export function isBuiltinRole(role: string): role is BuiltinAppRole {
  return builtinAppRoles.includes(role as BuiltinAppRole);
}

export function getRoleLabel(role?: string | null) {
  if (!role) {
    return "User";
  }

  return isBuiltinRole(role) ? ROLE_LABELS[role] : role;
}

export function getPermissionsForRole(role?: string | null) {
  if (!role || !isBuiltinRole(role)) {
    return [] as Permission[];
  }

  return ROLE_PERMISSIONS[role];
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
