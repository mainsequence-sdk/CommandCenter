import type { BuiltinAppRole, ShellAccess } from "@/auth/types";

const workspaceApps = [
  "workspace-studio",
  "command-center-docs",
  "main_sequence_ai",
  "main_sequence_markets",
  "main_sequence_workbench",
] as const;

const workspaceSurfaces = [
  "workspace-studio.workspaces",
  "workspace-studio.slide-studio",
  "workspace-studio.widget-catalog",
  "workspace-studio.widgets",
  "command-center-docs.getting-started",
  "command-center-docs.workspaces",
  "command-center-docs.widgets",
  "command-center-docs.reference-variables",
  "command-center-docs.slide-studio",
  "command-center-docs.foundry",
  "command-center-docs.main-sequence-ai",
  "command-center-docs.agents-monitor",
  "command-center-docs.organization-admin",
  "command-center-docs.rbac",
  "command-center-docs.organization-admin-tbd",
  "main_sequence_ai.chat",
  "main_sequence_ai.agents",
  "main_sequence_ai.capabilities",
  "main_sequence_ai.monitor",
  "main_sequence_ai.project-agent-deployment-logs",
  "main_sequence_ai.session",
  "main_sequence_markets.asset-categories",
  "main_sequence_markets.assets",
  "main_sequence_markets.indices",
  "main_sequence_markets.pricing-curves",
  "main_sequence_markets.pricing-market-data",
  "main_sequence_markets.calendars",
  "main_sequence_markets.settings",
  "main_sequence_markets.funds",
  "main_sequence_markets.portfolio-groups",
  "main_sequence_markets.portfolio-signals",
  "main_sequence_markets.portfolios",
  "main_sequence_markets.accounts",
  "main_sequence_workbench.buckets",
  "main_sequence_workbench.clusters",
  "main_sequence_workbench.constants",
  "main_sequence_workbench.data-nodes",
  "main_sequence_workbench.jobs",
  "main_sequence_workbench.meta-tables",
  "main_sequence_workbench.namespaces",
  "main_sequence_workbench.physical-data-sources",
  "main_sequence_workbench.project-data-sources",
  "main_sequence_workbench.projects",
  "main_sequence_workbench.scalable-services",
  "main_sequence_workbench.secrets",
  "main_sequence_workbench.streamlit",
  "main_sequence_workbench.timescaledb-services",
] as const;

const organizationApps = [
  ...workspaceApps,
  "settings.account",
  "settings.billing",
  "settings.organization",
  "settings.access-rbac",
  "settings.applications",
] as const;

const organizationSurfaces = [
  ...workspaceSurfaces,
  "settings.account.profile",
  "settings.account.preferences",
  "settings.account.security",
  "settings.account.sessions",
  "settings.billing.credits",
  "settings.billing.invoices",
  "settings.billing.details",
  "settings.billing.hosted-resources",
  "settings.billing.manage-credits",
  "settings.organization.users",
  "settings.organization.plans",
  "settings.organization.security-sessions",
  "settings.organization.github",
  "settings.organization.widgets",
  "settings.access-rbac.inspector",
  "settings.access-rbac.teams",
  "settings.applications.main-sequence-markets",
  "settings.applications.main_sequence_ai/agents-settings",
  "settings.applications.main_sequence_ai/model-providers",
] as const;

const adminApps = [
  ...organizationApps,
  "connections",
  "settings.platform",
] as const;

const adminSurfaces = [
  ...organizationSurfaces,
  "connections.add-new-connection",
  "connections.data-sources",
  "connections.explore",
  "settings.platform.auth",
  "settings.platform.configuration",
  "settings.platform.widget-registry",
  "settings.platform.connection-registry",
] as const;

function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values));
}

export function cloneShellAccess(shellAccess: {
  accessibleApps: readonly string[];
  accessibleSurfaces: readonly string[];
}): ShellAccess {
  return {
    accessibleApps: uniqueStrings(shellAccess.accessibleApps),
    accessibleSurfaces: uniqueStrings(shellAccess.accessibleSurfaces),
  };
}

export function getMockShellAccessForRole(role: BuiltinAppRole): ShellAccess {
  if (role === "org_admin") {
    return cloneShellAccess({
      accessibleApps: adminApps,
      accessibleSurfaces: adminSurfaces,
    });
  }

  return cloneShellAccess({
    accessibleApps: workspaceApps,
    accessibleSurfaces: workspaceSurfaces,
  });
}

export function normalizeMockShellAccess(value: unknown): ShellAccess {
  if (typeof value !== "object" || value === null) {
    return {
      accessibleApps: [],
      accessibleSurfaces: [],
    };
  }

  const record = value as Record<string, unknown>;
  const accessibleApps = Array.isArray(record.accessible_apps)
    ? record.accessible_apps
    : Array.isArray(record.accessibleApps)
      ? record.accessibleApps
      : [];
  const accessibleSurfaces = Array.isArray(record.accessible_surfaces)
    ? record.accessible_surfaces
    : Array.isArray(record.accessibleSurfaces)
      ? record.accessibleSurfaces
      : [];

  return cloneShellAccess({
    accessibleApps: accessibleApps.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0),
    accessibleSurfaces: accessibleSurfaces.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0),
  });
}
