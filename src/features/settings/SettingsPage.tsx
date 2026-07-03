import { useMemo, useState, type ComponentType, type ReactNode } from "react";

import {
  AppWindow,
  BadgeDollarSign,
  Building2,
  ChevronDown,
  CircleUserRound,
  CreditCard,
  Github,
  KeyRound,
  LineChart,
  ReceiptText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users2,
  Wallet,
} from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import type { AppShellMenuEntry } from "@/app/registry/types";
import { getAccessibleShellMenuEntries } from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import {
  hasAllPermissions,
  hasOrganizationAdminAccess,
  hasPlatformAdminAccess,
} from "@/auth/permissions";
import type { AppUser } from "@/auth/types";
import { SettingsDialog } from "@/app/layout/SettingsDialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AdminActivePlansPage } from "@/extensions/core/apps/admin/AdminActivePlansPage";
import { AdminBillingDetailsPage } from "@/extensions/core/apps/admin/AdminBillingDetailsPage";
import { AdminGithubOrganizationsPage } from "@/extensions/core/apps/admin/AdminGithubOrganizationsPage";
import { AdminHostedResourcesPage } from "@/extensions/core/apps/admin/AdminHostedResourcesPage";
import { AdminInvoicesPage } from "@/extensions/core/apps/admin/AdminInvoicesPage";
import { AdminLoginSessionsPage } from "@/extensions/core/apps/admin/AdminLoginSessionsPage";
import { AdminMainSequenceMarketsPage } from "@/extensions/core/apps/admin/AdminMainSequenceMarketsPage";
import { AdminManageCreditsPage } from "@/extensions/core/apps/admin/AdminManageCreditsPage";
import { AdminOrganizationUsersPage } from "@/extensions/core/apps/admin/AdminOrganizationUsersPage";
import { AdminWidgetConfigurationsPage } from "@/extensions/core/apps/admin/AdminWidgetConfigurationsPage";
import { cn } from "@/lib/utils";

type SettingsGroupId = "account" | "billing" | "organization" | "applications" | "platform";

interface SettingsRouteContext {
  navigate: ReturnType<typeof useNavigate>;
  user?: AppUser;
}

interface SettingsRouteDefinition {
  path: string;
  label: string;
  title: string;
  description: string;
  groupId: SettingsGroupId;
  icon: ComponentType<{ className?: string }>;
  applicationId?: string;
  applicationLabel?: string;
  applicationIcon?: ComponentType<{ className?: string }>;
  requiredPermissions?: string[];
  adminScope?: "organization" | "platform";
  render: (context: SettingsRouteContext) => ReactNode;
}

interface SettingsGroupDefinition {
  id: SettingsGroupId;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  order: number;
}

interface ApplicationRouteGroup {
  key: string;
  label?: string;
  icon?: ComponentType<{ className?: string }>;
  routes: SettingsRouteDefinition[];
  firstIndex: number;
}

const settingsGroups: SettingsGroupDefinition[] = [
  {
    id: "account",
    label: "Account",
    description: "Profile, preferences, security, and sessions.",
    icon: CircleUserRound,
    order: 10,
  },
  {
    id: "billing",
    label: "Billing",
    description: "Personal credits and organization billing.",
    icon: CreditCard,
    order: 20,
  },
  {
    id: "organization",
    label: "Organization",
    description: "Organization users, plans, security, and integrations.",
    icon: Building2,
    order: 30,
  },
  {
    id: "applications",
    label: "Applications",
    description: "Application-specific settings and providers.",
    icon: AppWindow,
    order: 40,
  },
  {
    id: "platform",
    label: "Platform",
    description: "Platform admin configuration and registries.",
    icon: ShieldCheck,
    order: 50,
  },
];

const adminRouteMap: Record<string, string> = {
  "organization-users": "organization/users",
  "active-plans": "organization/plans",
  "security-sessions": "organization/security-sessions",
  "github-organizations": "organization/github",
  "widget-configurations": "organization/widgets",
  "main-sequence-markets": "applications/main-sequence-markets",
  invoices: "billing/invoices",
  "billing-details": "billing/details",
  "hosted-resources": "billing/hosted-resources",
  "manage-credits": "billing/manage-credits",
};

function normalizeRoutePath(value?: string) {
  return (value ?? "").replace(/^\/+|\/+$/g, "");
}

function getSettingsPath(path: string) {
  return `/app/settings/${path}`;
}

function settingsDialogPage({
  mode,
  sectionId,
  user,
  navigate,
}: {
  mode: "user" | "platform";
  sectionId: string;
  user?: AppUser;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <SettingsDialog
      mode={mode}
      open
      presentation="page"
      requestedSectionId={sectionId}
      showNavigation={false}
      user={user}
      onClose={() => {
        navigate("/app/settings/account/profile");
      }}
    />
  );
}

function settingsContributionPage(entry: AppShellMenuEntry, user?: AppUser) {
  const Component = entry.component;

  return <Component audience={entry.audience} user={user} />;
}

function makeShellContributionPath(entry: AppShellMenuEntry) {
  if (entry.id === "shell-settings-host::user-credits") {
    return "billing/credits";
  }

  return `applications/${entry.appId}/${entry.contributionId}`;
}

function makeSettingsRoutes(shellEntries: AppShellMenuEntry[]) {
  const personalCreditEntry = shellEntries.find(
    (entry) => entry.id === "shell-settings-host::user-credits",
  );
  const contributedRoutes = shellEntries
    .filter((entry) => entry.id !== "shell-settings-host::user-credits")
    .map<SettingsRouteDefinition>((entry) => ({
      path: makeShellContributionPath(entry),
      label: entry.label,
      title: entry.label,
      description: entry.description ?? entry.appDescription,
      groupId: "applications",
      icon: entry.icon ?? entry.appIcon,
      applicationId: entry.appId,
      applicationLabel: entry.appTitle,
      applicationIcon: entry.appIcon,
      requiredPermissions: entry.requiredPermissions,
      render: ({ user }) => settingsContributionPage(entry, user),
    }));

  const routes: SettingsRouteDefinition[] = [
    {
      path: "account/profile",
      label: "Profile",
      title: "Profile",
      description: "Manage account identity, profile image, and display details.",
      groupId: "account",
      icon: UserCog,
      render: ({ navigate, user }) =>
        settingsDialogPage({ mode: "user", sectionId: "account", user, navigate }),
    },
    {
      path: "account/preferences",
      label: "Preferences",
      title: "Preferences",
      description: "Manage theme, language, and local shell preferences.",
      groupId: "account",
      icon: SlidersHorizontal,
      render: ({ navigate, user }) =>
        settingsDialogPage({ mode: "user", sectionId: "general", user, navigate }),
    },
    {
      path: "account/security",
      label: "Security",
      title: "Security",
      description: "Manage password, MFA, account deletion, and active sessions.",
      groupId: "account",
      icon: KeyRound,
      render: ({ navigate, user }) =>
        settingsDialogPage({ mode: "user", sectionId: "security", user, navigate }),
    },
    {
      path: "account/sessions",
      label: "Sessions",
      title: "Sessions",
      description: "Review and revoke active account sessions.",
      groupId: "account",
      icon: ShieldCheck,
      render: ({ navigate, user }) =>
        settingsDialogPage({ mode: "user", sectionId: "security", user, navigate }),
    },
    {
      path: "billing/credits",
      label: "Credits",
      title: "Credits & Billing",
      description: "Review personal credit balance and spending policy.",
      groupId: "billing",
      icon: Wallet,
      render: ({ user }) =>
        personalCreditEntry
          ? settingsContributionPage(personalCreditEntry, user)
          : (
              <Card>
                <CardContent className="p-5 text-sm text-muted-foreground">
                  Credits are not available for this session.
                </CardContent>
              </Card>
            ),
    },
    {
      path: "organization/users",
      label: "Users",
      title: "Organization Users",
      description: "Browse organization-scoped users and account state.",
      groupId: "organization",
      icon: Users2,
      adminScope: "organization",
      requiredPermissions: ["org_admin:view"],
      render: () => <AdminOrganizationUsersPage />,
    },
    {
      path: "organization/plans",
      label: "Active Plans",
      title: "Active Plans",
      description: "Review organization plan inventory and assignments.",
      groupId: "organization",
      icon: BadgeDollarSign,
      adminScope: "organization",
      requiredPermissions: ["org_admin:view"],
      render: () => <AdminActivePlansPage />,
    },
    {
      path: "organization/security-sessions",
      label: "Security Sessions",
      title: "Security Sessions",
      description: "Review and revoke organization-scoped tracked login sessions.",
      groupId: "organization",
      icon: ShieldCheck,
      adminScope: "organization",
      requiredPermissions: ["org_admin:view"],
      render: () => <AdminLoginSessionsPage />,
    },
    {
      path: "organization/github",
      label: "GitHub",
      title: "GitHub Organizations",
      description: "Review linked GitHub organizations and integration status.",
      groupId: "organization",
      icon: Github,
      adminScope: "organization",
      requiredPermissions: ["org_admin:view"],
      render: () => <AdminGithubOrganizationsPage />,
    },
    {
      path: "organization/widgets",
      label: "Widgets",
      title: "Widget Configurations",
      description: "Review backend-registered widget types with organization configuration.",
      groupId: "organization",
      icon: AppWindow,
      adminScope: "organization",
      requiredPermissions: ["org_admin:view"],
      render: () => <AdminWidgetConfigurationsPage />,
    },
    {
      path: "applications/main-sequence-markets",
      label: "Market Data Connection",
      title: "Main Sequence Markets",
      description: "Select the Adapter From API connection used by Main Sequence Markets.",
      groupId: "applications",
      icon: AppWindow,
      applicationId: "main_sequence_markets",
      applicationLabel: "Main Sequence Markets",
      applicationIcon: LineChart,
      adminScope: "organization",
      requiredPermissions: ["org_admin:view"],
      render: () => <AdminMainSequenceMarketsPage />,
    },
    {
      path: "billing/invoices",
      label: "Invoices",
      title: "Invoices",
      description: "Review organization invoice history and statements.",
      groupId: "billing",
      icon: ReceiptText,
      adminScope: "organization",
      requiredPermissions: ["org_admin:view"],
      render: () => <AdminInvoicesPage />,
    },
    {
      path: "billing/details",
      label: "Billing Details",
      title: "Billing Details",
      description: "Review organization billing profile and invoice recipients.",
      groupId: "billing",
      icon: CreditCard,
      adminScope: "organization",
      requiredPermissions: ["org_admin:view"],
      render: () => <AdminBillingDetailsPage />,
    },
    {
      path: "billing/hosted-resources",
      label: "Hosted Resources",
      title: "Hosted Resources",
      description: "Review organization-hosted infrastructure inventory.",
      groupId: "billing",
      icon: Building2,
      adminScope: "organization",
      requiredPermissions: ["org_admin:view"],
      render: () => <AdminHostedResourcesPage />,
    },
    {
      path: "billing/manage-credits",
      label: "Manage Credits",
      title: "Manage Credits",
      description: "Manage organization credit balance, auto-reload, and user budgets.",
      groupId: "billing",
      icon: Wallet,
      adminScope: "organization",
      requiredPermissions: ["org_admin:view"],
      render: () => <AdminManageCreditsPage />,
    },
    {
      path: "platform/auth",
      label: "Authentication",
      title: "Authentication",
      description: "Platform authentication settings and diagnostics.",
      groupId: "platform",
      icon: ShieldCheck,
      adminScope: "platform",
      requiredPermissions: ["platform_admin:access"],
      render: ({ navigate, user }) =>
        settingsDialogPage({ mode: "platform", sectionId: "auth", user, navigate }),
    },
    {
      path: "platform/configuration",
      label: "Configuration",
      title: "Configuration",
      description: "Platform environment and runtime configuration.",
      groupId: "platform",
      icon: Settings2,
      adminScope: "platform",
      requiredPermissions: ["platform_admin:access"],
      render: ({ navigate, user }) =>
        settingsDialogPage({ mode: "platform", sectionId: "configuration", user, navigate }),
    },
    {
      path: "platform/widget-registry",
      label: "Widget Registry",
      title: "Widget Registry",
      description: "Review frontend widget registry and backend sync state.",
      groupId: "platform",
      icon: AppWindow,
      adminScope: "platform",
      requiredPermissions: ["platform_admin:access"],
      render: ({ navigate, user }) =>
        settingsDialogPage({ mode: "platform", sectionId: "registry", user, navigate }),
    },
    {
      path: "platform/connection-registry",
      label: "Connection Registry",
      title: "Connection Registry",
      description: "Review available connection type definitions.",
      groupId: "platform",
      icon: Building2,
      adminScope: "platform",
      requiredPermissions: ["platform_admin:access"],
      render: ({ navigate, user }) =>
        settingsDialogPage({
          mode: "platform",
          sectionId: "connection-registry",
          user,
          navigate,
        }),
    },
    {
      path: "platform/access-catalog",
      label: "Access Catalog",
      title: "Access Catalog",
      description: "Review app and permission coverage in the shell registry.",
      groupId: "platform",
      icon: KeyRound,
      adminScope: "platform",
      requiredPermissions: ["platform_admin:access"],
      render: ({ navigate, user }) =>
        settingsDialogPage({ mode: "platform", sectionId: "access-catalog", user, navigate }),
    },
    ...contributedRoutes,
  ];

  return routes;
}

function canAccessSettingsRoute(route: SettingsRouteDefinition, user?: AppUser) {
  const permissions = [...(user?.permissions ?? []), ...(user?.platformPermissions ?? [])];

  if (!hasAllPermissions(permissions, route.requiredPermissions ?? [])) {
    return false;
  }

  if (route.adminScope === "organization") {
    return hasOrganizationAdminAccess(user);
  }

  if (route.adminScope === "platform") {
    return hasPlatformAdminAccess(user);
  }

  return true;
}

function routeSectionId(sectionId: string) {
  switch (sectionId) {
    case "general":
      return "account/preferences";
    case "account":
      return "account/profile";
    case "security":
      return "account/security";
    case "auth":
      return "platform/auth";
    case "configuration":
      return "platform/configuration";
    case "registry":
      return "platform/widget-registry";
    case "connection-registry":
      return "platform/connection-registry";
    case "access-catalog":
      return "platform/access-catalog";
    case "shell-settings-host::user-credits":
      return "billing/credits";
    default:
      if (sectionId.includes("::")) {
        const [appId, contributionId] = sectionId.split("::");
        return `applications/${appId}/${contributionId}`;
      }
      return "account/profile";
  }
}

function groupRoutes(routes: SettingsRouteDefinition[]) {
  const groupMap = new Map<SettingsGroupId, SettingsRouteDefinition[]>();

  routes.forEach((route) => {
    const current = groupMap.get(route.groupId) ?? [];
    current.push(route);
    groupMap.set(route.groupId, current);
  });

  return settingsGroups
    .map((group) => ({
      ...group,
      routes: groupMap.get(group.id) ?? [],
    }))
    .filter((group) => group.routes.length > 0)
    .sort((left, right) => left.order - right.order);
}

function groupApplicationRoutes(routes: SettingsRouteDefinition[]) {
  const groupedRoutes = new Map<string, ApplicationRouteGroup>();

  routes.forEach((route, index) => {
    const key = route.applicationId ? `app:${route.applicationId}` : `route:${route.path}`;
    const current = groupedRoutes.get(key);

    if (current) {
      current.routes.push(route);
      current.firstIndex = Math.min(current.firstIndex, index);
      return;
    }

    groupedRoutes.set(key, {
      key,
      label: route.applicationLabel,
      icon: route.applicationIcon,
      routes: [route],
      firstIndex: index,
    });
  });

  return Array.from(groupedRoutes.values()).sort(
    (left, right) => left.firstIndex - right.firstIndex,
  );
}

function SettingsAccessDenied({ route }: { route: SettingsRouteDefinition }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm font-medium text-foreground">Access restricted</div>
        <div className="mt-2 max-w-2xl text-sm text-muted-foreground">
          This settings section keeps the same access gate as before. Your current session
          does not include the permissions required to open {route.title}.
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsNotFound() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm font-medium text-foreground">Settings section not found</div>
        <div className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The requested settings route does not exist.
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.session?.user);
  const permissions = user?.permissions ?? [];
  const shellEntries = getAccessibleShellMenuEntries(permissions, "user");
  const allRoutes = useMemo(() => makeSettingsRoutes(shellEntries), [shellEntries]);
  const accessibleRoutes = allRoutes.filter((route) => canAccessSettingsRoute(route, user));
  const selectedPath = normalizeRoutePath(params["*"]);
  const selectedRoute = allRoutes.find((route) => route.path === selectedPath);
  const selectedAccessible = selectedRoute
    ? canAccessSettingsRoute(selectedRoute, user)
    : false;
  const firstAccessibleRoute = accessibleRoutes[0];
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const groups = groupRoutes(accessibleRoutes);
  const renderRouteButton = (
    route: SettingsRouteDefinition,
    options: { nested?: boolean } = {},
  ) => {
    const Icon = route.icon;
    const active = route.path === selectedPath;

    return (
      <button
        key={route.path}
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-[calc(var(--radius)-7px)] px-2 py-2 text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-foreground/[0.04] hover:text-foreground",
          options.nested && "pl-6",
          active && "bg-sidebar-foreground/[0.08] text-foreground",
        )}
        onClick={() => {
          navigate(getSettingsPath(route.path));
        }}
      >
        {options.nested ? null : <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate">{route.label}</span>
        {route.adminScope ? (
          <Badge
            variant={route.adminScope === "platform" ? "warning" : "neutral"}
            className="h-5 px-1.5 text-[9px]"
          >
            {route.adminScope === "platform" ? "Platform" : "Org"}
          </Badge>
        ) : null}
      </button>
    );
  };

  if (!selectedPath) {
    return firstAccessibleRoute ? (
      <Navigate to={getSettingsPath(firstAccessibleRoute.path)} replace />
    ) : (
      <SettingsAccessDenied
        route={{
          path: "settings",
          label: "Settings",
          title: "Settings",
          description: "No settings are available for this session.",
          groupId: "account",
          icon: Settings2,
          render: () => null,
        }}
      />
    );
  }

  const selectedTitle = selectedRoute?.title ?? "Settings";
  const selectedDescription = selectedRoute?.description ?? "Configure Command Center.";

  return (
    <div className="h-full min-h-0 overflow-hidden bg-background">
      <div className="grid h-full min-h-0 w-full gap-0 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          data-theme-chrome="sidebar"
          className="min-h-0 border-b border-border/70 bg-background text-sidebar-foreground xl:border-b-0 xl:border-r"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-border/70 px-5 py-4">
              <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Settings
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">
                Account and administration
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-3">
              {groups.map((group) => {
                const GroupIcon = group.icon;
                const groupActive = group.routes.some((route) => route.path === selectedPath);
                const collapsed = collapsedGroups[group.id] ?? (!groupActive && group.id !== "account");

                return (
                  <div key={group.id} className="rounded-[calc(var(--radius)-5px)]">
                    <button
                      type="button"
                      title={group.description}
                      className="flex w-full items-center gap-2 rounded-[calc(var(--radius)-7px)] px-2 py-2 text-left text-sidebar-foreground/84 transition-colors hover:bg-sidebar-foreground/[0.04] hover:text-foreground"
                      onClick={() => {
                        setCollapsedGroups((current) => ({
                          ...current,
                          [group.id]: !collapsed,
                        }));
                      }}
                    >
                      <GroupIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.18em]">
                        {group.label}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-muted-foreground transition-transform",
                          collapsed && "-rotate-90",
                        )}
                      />
                    </button>
                    {!collapsed ? (
                      <div className="mt-1 space-y-0.5 pl-2">
                        {group.id === "applications"
                          ? groupApplicationRoutes(group.routes).map((applicationGroup) => {
                              const ApplicationIcon = applicationGroup.icon ?? AppWindow;

                              if (!applicationGroup.label) {
                                return applicationGroup.routes.map((route) => renderRouteButton(route));
                              }

                              return (
                                <div key={applicationGroup.key} className="space-y-0.5">
                                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70">
                                    <ApplicationIcon className="h-3.5 w-3.5 shrink-0" />
                                    <span className="min-w-0 truncate">{applicationGroup.label}</span>
                                  </div>
                                  {applicationGroup.routes.map((route) =>
                                    renderRouteButton(route, { nested: true }),
                                  )}
                                </div>
                              );
                            })
                          : group.routes.map((route) => renderRouteButton(route))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 overflow-auto">
          <div className="border-b border-border/70 px-6 py-5 md:px-8">
            <PageHeader
              eyebrow="Settings"
              title={selectedTitle}
              description={selectedDescription}
            />
          </div>
          <div className="space-y-6 px-6 py-6 md:px-8">
            {selectedRoute && selectedAccessible
              ? selectedRoute.render({ navigate, user: user ?? undefined })
              : selectedRoute
                ? <SettingsAccessDenied route={selectedRoute} />
                : <SettingsNotFound />}
          </div>
        </main>
      </div>
    </div>
  );
}

export function LegacyAdminSettingsRedirect() {
  const { surfaceId } = useParams();
  const target = adminRouteMap[normalizeRoutePath(surfaceId)] ?? "organization/users";

  return <Navigate to={getSettingsPath(target)} replace />;
}

export function resolveSettingsSectionPath(sectionId?: string | null) {
  return getSettingsPath(routeSectionId(sectionId ?? "account"));
}
