import { useMemo, useState, type ComponentType, type ReactNode } from "react";

import {
  AppWindow,
  BadgeDollarSign,
  Building2,
  ChevronDown,
  CircleUserRound,
  CreditCard,
  Database,
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
import {
  canAccessShellSurfaceKey,
  getAccessibleShellMenuEntries,
  getShellSurfaceKey,
} from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import type { AppUser } from "@/auth/types";
import { SettingsDialog } from "@/app/layout/SettingsDialog";
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
import { AccessRbacInspectorPage } from "@/extensions/core/apps/access-rbac/AccessRbacInspectorPage";
import { AccessRbacTeamsPage } from "@/extensions/core/apps/access-rbac/AccessRbacTeamsPage";
import { UserCreditsSettingsSection } from "@/extensions/core/UserCreditsSettingsSection";
import { cn } from "@/lib/utils";

type SettingsGroupId =
  | "account"
  | "billing"
  | "organization"
  | "access-rbac"
  | "applications"
  | "platform";

type SettingsLayoutMode = "narrow" | "standard" | "wide" | "full";

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
  accessPath?: string;
  hideFromNav?: boolean;
  applicationId?: string;
  applicationLabel?: string;
  applicationIcon?: ComponentType<{ className?: string }>;
  navigationParent?: {
    key: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
  };
  layout?: SettingsLayoutMode;
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

interface NestedSettingsRouteGroup {
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
    description: "Profile, preferences, usage, security, and sessions.",
    icon: CircleUserRound,
    order: 10,
  },
  {
    id: "billing",
    label: "Billing",
    description: "Organization billing, invoices, credits, and hosted resources.",
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
    id: "access-rbac",
    label: "Access & RBAC",
    description: "Resolved shell access inspection and teams.",
    icon: KeyRound,
    order: 35,
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
    label: "System",
    description: "System configuration and registries.",
    icon: ShieldCheck,
    order: 50,
  },
];

function normalizeRoutePath(value?: string) {
  return (value ?? "").replace(/^\/+|\/+$/g, "");
}

function getSettingsPath(path: string) {
  return `/app/settings/${path}`;
}

function getSettingsLayoutClassName(
  layout: SettingsLayoutMode | undefined,
  target: "header" | "content",
) {
  const base = "mx-auto w-full";

  switch (layout) {
    case "narrow":
      return cn(base, "max-w-[900px]");
    case "wide":
      return cn(base, "max-w-[1480px]");
    case "full":
      return cn(base, "max-w-none");
    case "standard":
    default:
      return cn(base, "max-w-[1120px]", target === "content" ? "2xl:max-w-[1240px]" : null);
  }
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
  return `applications/${entry.appId}/${entry.contributionId}`;
}

function makeSettingsRoutes(shellEntries: AppShellMenuEntry[]) {
  const contributedRoutes = shellEntries
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
      layout: "standard",
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
      layout: "narrow",
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
      layout: "narrow",
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
      layout: "narrow",
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
      layout: "wide",
      render: ({ navigate, user }) =>
        settingsDialogPage({ mode: "user", sectionId: "security", user, navigate }),
    },
    {
      path: "account/usage-detail",
      label: "Usage Detail",
      title: "Usage Detail",
      description: "Review personal credit usage, balance, and spending policy.",
      groupId: "account",
      icon: Wallet,
      accessPath: "billing/credits",
      layout: "standard",
      render: () => <UserCreditsSettingsSection />,
    },
    {
      path: "billing/credits",
      label: "Usage Detail",
      title: "Usage Detail",
      description: "Review personal credit usage, balance, and spending policy.",
      groupId: "account",
      icon: Wallet,
      accessPath: "billing/credits",
      hideFromNav: true,
      render: () => <Navigate to={getSettingsPath("account/usage-detail")} replace />,
    },
    {
      path: "organization/users",
      label: "Users",
      title: "Organization Users",
      description: "Browse organization-scoped users and account state.",
      groupId: "organization",
      icon: Users2,
      layout: "wide",
      render: () => <AdminOrganizationUsersPage />,
    },
    {
      path: "organization/plans",
      label: "Active Plans",
      title: "Active Plans",
      description: "Review organization plan inventory and assignments.",
      groupId: "organization",
      icon: BadgeDollarSign,
      layout: "wide",
      render: () => <AdminActivePlansPage />,
    },
    {
      path: "organization/security-sessions",
      label: "Security Sessions",
      title: "Security Sessions",
      description: "Review and revoke organization-scoped tracked login sessions.",
      groupId: "organization",
      icon: ShieldCheck,
      layout: "wide",
      render: () => <AdminLoginSessionsPage />,
    },
    {
      path: "organization/github",
      label: "GitHub",
      title: "GitHub Organizations",
      description: "Review linked GitHub organizations and integration status.",
      groupId: "organization",
      icon: Github,
      layout: "wide",
      render: () => <AdminGithubOrganizationsPage />,
    },
    {
      path: "organization/widgets",
      label: "Widgets",
      title: "Widget Configurations",
      description: "Review backend-registered widget types with organization configuration.",
      groupId: "organization",
      icon: AppWindow,
      layout: "wide",
      render: () => <AdminWidgetConfigurationsPage />,
    },
    {
      path: "access-rbac/inspector",
      label: "Inspector",
      title: "Organization User Inspector",
      description: "Search users and inspect their effective shell access.",
      groupId: "access-rbac",
      icon: UserCog,
      layout: "wide",
      render: () => <AccessRbacInspectorPage />,
    },
    {
      path: "access-rbac/teams",
      label: "Teams",
      title: "Teams",
      description: "Manage organization teams, memberships, and team sharing.",
      groupId: "access-rbac",
      icon: Users2,
      layout: "wide",
      render: () => <AccessRbacTeamsPage />,
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
      layout: "standard",
      render: () => <AdminMainSequenceMarketsPage />,
    },
    {
      path: "billing/invoices",
      label: "Invoices",
      title: "Invoices",
      description: "Review organization invoice history and statements.",
      groupId: "billing",
      icon: ReceiptText,
      layout: "wide",
      render: () => <AdminInvoicesPage />,
    },
    {
      path: "billing/details",
      label: "Billing Details",
      title: "Billing Details",
      description: "Review organization billing profile and invoice recipients.",
      groupId: "billing",
      icon: CreditCard,
      layout: "standard",
      render: () => <AdminBillingDetailsPage />,
    },
    {
      path: "billing/hosted-resources",
      label: "Hosted Resources",
      title: "Hosted Resources",
      description: "Review organization-hosted infrastructure inventory.",
      groupId: "billing",
      icon: Building2,
      layout: "wide",
      hideFromNav: true,
      render: () => <Navigate to={getSettingsPath("billing/hosted-resources/databases")} replace />,
    },
    {
      path: "billing/hosted-resources/databases",
      label: "Databases",
      title: "Managed Databases",
      description: "Create and review organization-hosted managed databases.",
      groupId: "billing",
      icon: Database,
      accessPath: "billing/hosted-resources",
      navigationParent: {
        key: "billing/hosted-resources",
        label: "Hosted Resources",
        icon: Building2,
      },
      layout: "wide",
      render: () => <AdminHostedResourcesPage />,
    },
    {
      path: "billing/manage-credits",
      label: "Manage Credits",
      title: "Manage Credits",
      description: "Manage organization credit balance, auto-reload, and user budgets.",
      groupId: "billing",
      icon: Wallet,
      layout: "wide",
      render: () => <AdminManageCreditsPage />,
    },
    {
      path: "platform/auth",
      label: "Authentication",
      title: "Authentication",
      description: "System authentication settings and diagnostics.",
      groupId: "platform",
      icon: ShieldCheck,
      layout: "standard",
      render: ({ navigate, user }) =>
        settingsDialogPage({ mode: "platform", sectionId: "auth", user, navigate }),
    },
    {
      path: "platform/configuration",
      label: "Configuration",
      title: "Configuration",
      description: "System environment and runtime configuration.",
      groupId: "platform",
      icon: Settings2,
      layout: "wide",
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
      layout: "wide",
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
      layout: "wide",
      render: ({ navigate, user }) =>
        settingsDialogPage({
          mode: "platform",
          sectionId: "connection-registry",
          user,
          navigate,
        }),
    },
    ...contributedRoutes,
  ];

  return routes;
}

function canAccessSettingsRoute(route: SettingsRouteDefinition, user?: AppUser) {
  const shellAccess = user?.shellAccess;
  const routeSurfaceKey = getShellSurfaceKey("settings", route.accessPath ?? route.path);

  return canAccessShellSurfaceKey(routeSurfaceKey, shellAccess);
}

function routeSectionId(sectionId: string) {
  switch (sectionId) {
    case "general":
      return "account/preferences";
    case "account":
      return "account/profile";
    case "security":
      return "account/security";
    case "billing":
    case "credits":
    case "usage":
    case "usage-detail":
      return "account/usage-detail";
    case "auth":
      return "platform/auth";
    case "configuration":
      return "platform/configuration";
    case "registry":
      return "platform/widget-registry";
    case "connection-registry":
      return "platform/connection-registry";
    case "access-rbac":
    case "rbac":
      return "access-rbac/inspector";
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

function groupNestedSettingsRoutes(routes: SettingsRouteDefinition[]) {
  const groupedRoutes = new Map<string, NestedSettingsRouteGroup>();

  routes
    .filter((route) => !route.hideFromNav)
    .forEach((route, index) => {
      const parent = route.navigationParent;
      const key = parent ? `parent:${parent.key}` : `route:${route.path}`;
      const current = groupedRoutes.get(key);

      if (current) {
        current.routes.push(route);
        current.firstIndex = Math.min(current.firstIndex, index);
        return;
      }

      groupedRoutes.set(key, {
        key,
        label: parent?.label,
        icon: parent?.icon,
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
      <CardContent className="p-4">
        <div className="text-sm font-medium text-foreground">Access restricted</div>
        <div className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Your current backend shell access does not include the settings surface required to
          open {route.title}.
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsNotFound() {
  return (
    <Card>
      <CardContent className="p-4">
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
  const shellEntries = getAccessibleShellMenuEntries(user?.shellAccess, "user");
  const allRoutes = useMemo(() => makeSettingsRoutes(shellEntries), [shellEntries]);
  const accessibleRoutes = allRoutes.filter((route) => canAccessSettingsRoute(route, user));
  const selectedPath = normalizeRoutePath(params["*"]);
  const selectedRoute = allRoutes.find((route) => route.path === selectedPath);
  const selectedAccessible = selectedRoute
    ? canAccessSettingsRoute(selectedRoute, user)
    : false;
  const firstAccessibleRoute = accessibleRoutes[0];
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedApplicationGroups, setCollapsedApplicationGroups] = useState<Record<string, boolean>>({});
  const [collapsedNestedRouteGroups, setCollapsedNestedRouteGroups] = useState<Record<string, boolean>>({});
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
        {options.nested ? null : <Icon className="h-4 w-4 shrink-0 text-current" />}
        <span className="min-w-0 flex-1 truncate">{route.label}</span>
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
  const selectedLayout = selectedRoute?.layout ?? "standard";
  const headerClassName = getSettingsLayoutClassName(selectedLayout, "header");
  const contentClassName = getSettingsLayoutClassName(selectedLayout, "content");

  return (
    <div className="h-full min-h-0 overflow-hidden bg-background">
      <div className="grid h-full min-h-0 w-full gap-0 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside
          data-theme-chrome="sidebar"
          className="min-h-0 border-b border-border/70 bg-background text-sidebar-foreground xl:border-b-0 xl:border-r"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-border/70 px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Settings
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">
                Account and administration
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-auto px-2.5 py-3">
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
                              const applicationGroupActive = applicationGroup.routes.some(
                                (route) => route.path === selectedPath,
                              );
                              const applicationCollapsed =
                                collapsedApplicationGroups[applicationGroup.key] ??
                                !applicationGroupActive;

                              if (!applicationGroup.label) {
                                return applicationGroup.routes.map((route) => renderRouteButton(route));
                              }

                              return (
                                <div key={applicationGroup.key} className="space-y-0.5">
                                  <button
                                    type="button"
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-[calc(var(--radius)-7px)] px-2 py-1.5 text-left text-xs font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-foreground/[0.04] hover:text-foreground",
                                      applicationGroupActive && "text-foreground",
                                    )}
                                    onClick={() => {
                                      setCollapsedApplicationGroups((current) => ({
                                        ...current,
                                        [applicationGroup.key]: !applicationCollapsed,
                                      }));
                                    }}
                                  >
                                    <ApplicationIcon className="h-3.5 w-3.5 shrink-0" />
                                    <span className="min-w-0 truncate">{applicationGroup.label}</span>
                                    <ChevronDown
                                      className={cn(
                                        "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                                        applicationCollapsed && "-rotate-90",
                                      )}
                                    />
                                  </button>
                                  {!applicationCollapsed
                                    ? applicationGroup.routes.map((route) =>
                                        renderRouteButton(route, { nested: true }),
                                      )
                                    : null}
                                </div>
                              );
                            })
                          : groupNestedSettingsRoutes(group.routes).map((routeGroup) => {
                              if (!routeGroup.label) {
                                return routeGroup.routes.map((route) => renderRouteButton(route));
                              }

                              const ParentIcon = routeGroup.icon ?? AppWindow;
                              const routeGroupActive = routeGroup.routes.some(
                                (route) => route.path === selectedPath,
                              );
                              const routeGroupCollapsed =
                                collapsedNestedRouteGroups[routeGroup.key] ?? !routeGroupActive;

                              return (
                                <div key={routeGroup.key} className="space-y-0.5">
                                  <button
                                    type="button"
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-[calc(var(--radius)-7px)] px-2 py-1.5 text-left text-xs font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-foreground/[0.04] hover:text-foreground",
                                      routeGroupActive && "text-foreground",
                                    )}
                                    onClick={() => {
                                      setCollapsedNestedRouteGroups((current) => ({
                                        ...current,
                                        [routeGroup.key]: !routeGroupCollapsed,
                                      }));
                                    }}
                                  >
                                    <ParentIcon className="h-3.5 w-3.5 shrink-0" />
                                    <span className="min-w-0 truncate">{routeGroup.label}</span>
                                    <ChevronDown
                                      className={cn(
                                        "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                                        routeGroupCollapsed && "-rotate-90",
                                      )}
                                    />
                                  </button>
                                  {!routeGroupCollapsed
                                    ? routeGroup.routes.map((route) =>
                                        renderRouteButton(route, { nested: true }),
                                      )
                                    : null}
                                </div>
                              );
                            })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 overflow-auto">
          <div className="border-b border-border/70 px-4 py-3 md:px-6">
            <div className={headerClassName}>
              <PageHeader
                eyebrow="Settings"
                title={selectedTitle}
                description={selectedDescription}
              />
            </div>
          </div>
          <div className={cn(contentClassName, "space-y-4 px-4 py-4 md:px-6")}>
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

export function resolveSettingsSectionPath(sectionId?: string | null) {
  return getSettingsPath(routeSectionId(sectionId ?? "account"));
}
