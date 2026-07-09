import type { BuiltinAppRole, ShellAccess } from "@/auth/types";

const workspaceApps = [
  "workspace-studio",
  "command-center-docs",
  "main_sequence_ai",
  "main_sequence_markets",
  "main-sequence-foundry",
] as const;

const organizationApps = [
  ...workspaceApps,
  "settings.account",
  "settings.billing",
  "settings.organization",
  "settings.access-rbac",
  "settings.applications",
] as const;

const adminApps = [
  ...organizationApps,
  "connections",
  "settings.platform",
] as const;

function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values));
}

export function cloneShellAccess(shellAccess: {
  accessibleApps: readonly string[];
}): ShellAccess {
  return {
    accessibleApps: uniqueStrings(shellAccess.accessibleApps),
  };
}

export function getMockShellAccessForRole(role: BuiltinAppRole): ShellAccess {
  if (role === "org_admin") {
    return cloneShellAccess({
      accessibleApps: adminApps,
    });
  }

  return cloneShellAccess({
    accessibleApps: workspaceApps,
  });
}

export function normalizeMockShellAccess(value: unknown): ShellAccess {
  if (typeof value !== "object" || value === null) {
    return {
      accessibleApps: [],
    };
  }

  const record = value as Record<string, unknown>;
  const accessibleApps = Array.isArray(record.accessible_apps)
    ? record.accessible_apps
    : Array.isArray(record.accessibleApps)
      ? record.accessibleApps
      : [];

  return cloneShellAccess({
    accessibleApps: accessibleApps.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0),
  });
}
