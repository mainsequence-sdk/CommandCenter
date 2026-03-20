import { type ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Search, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { appRegistry, getAppById } from "@/app/registry";
import { SurfaceFavoriteButton } from "@/app/layout/SurfaceFavoriteButton";
import {
  canAccessApp,
  canAccessSurface,
  getAccessibleApps,
  getAccessibleSurfaces,
  getAccessibleSurfaceEntries,
  getAppPath,
  getSurfaceFavoriteId,
  getSurfaceNavigationGroups,
  isSurfaceFavorited,
} from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import {
  ALL_PERMISSIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  getRoleLabel,
  hasAllPermissions,
} from "@/auth/permissions";
import type { AppUser } from "@/auth/types";
import { builtinAppRoles } from "@/auth/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import type {
  RbacAssignableTeam,
  RbacAssignableUser,
  RbacAssignmentScope,
} from "@/components/ui/rbac-assignment-matrix";
import { listTeams } from "@/features/teams/api";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";

import { listAccessRbacUsers } from "./api";

export const accessRbacRoles = builtinAppRoles;

export const accessRbacUtilityActions: Array<{
  label: string;
  requiredPermissions: string[];
}> = [
  {
    label: "Widget Catalog",
    requiredPermissions: ["widget.catalog:view"],
  },
  {
    label: "Theme Studio",
    requiredPermissions: ["theme:manage"],
  },
  {
    label: "Access & RBAC",
    requiredPermissions: ["rbac:view"],
  },
];

export const accessRbacAssignmentScopes: RbacAssignmentScope[] = [
  {
    id: "view",
    title: "Can view",
    userHelperText: "Users on the right can view this object.",
    teamHelperText:
      "Teams on the right can view this object. All current and future team members inherit access.",
  },
  {
    id: "edit",
    title: "Can edit",
    userHelperText: "Users on the right can edit this object. Edit implies view.",
    teamHelperText:
      "Teams on the right can edit this object. All current and future team members inherit access, and edit still implies view.",
  },
];

export function mergeRbacIds(...lists: Array<Array<string | number>>) {
  const seen = new Set<string>();

  return lists.flat().filter((id) => {
    const key = String(id);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function useAccessRbacData() {
  const session = useAuthStore((state) => state.session);
  const sessionUser = session?.user;
  const permissions = sessionUser?.permissions ?? [];

  const accessibleApps = getAccessibleApps(permissions);
  const accessibleSurfaces = getAccessibleSurfaceEntries(permissions);
  const accessibleWidgets = appRegistry.widgets.filter((widget) =>
    hasAllPermissions(permissions, widget.requiredPermissions ?? []),
  );
  const accessibleActions = accessRbacUtilityActions.filter((action) =>
    hasAllPermissions(permissions, action.requiredPermissions),
  );
  const teamsQuery = useQuery({
    queryKey: ["teams", "list", "access-rbac"],
    queryFn: () => listTeams(),
    staleTime: 300_000,
  });
  const assignmentUsers = useMemo(
    (): RbacAssignableUser[] =>
      ([
        sessionUser
          ? {
              id: sessionUser.id,
              email: sessionUser.email,
              name: sessionUser.name,
              roleLabel: getRoleLabel(sessionUser.role),
            }
          : null,
        {
          id: "ameer-uak",
          email: "ameer.uak@gmail.com",
          roleLabel: "User",
        },
        {
          id: "fatih-da1994",
          email: "fatih.da1994@gmail.com",
          roleLabel: "User",
        },
        {
          id: "joselo-main-sequence",
          email: "joselo@main-sequence.io",
          roleLabel: "User",
        },
        {
          id: "info-main-sequence",
          email: "l@main-sequence.io",
          roleLabel: "User",
        },
      ] as Array<RbacAssignableUser | null>).filter(
        (user): user is RbacAssignableUser => user !== null,
      ),
    [sessionUser],
  );
  const assignmentTeams = useMemo<RbacAssignableTeam[]>(
    () =>
      (teamsQuery.data ?? []).map((team) => ({
        id: team.id,
        name: team.name,
        memberCount: team.member_count,
        description: team.description,
      })),
    [teamsQuery.data],
  );

  return {
    session,
    sessionUser,
    permissions,
    accessibleApps,
    accessibleSurfaces,
    accessibleWidgets,
    accessibleActions,
    teamsQuery,
    assignmentUsers,
    assignmentTeams,
  };
}

export function AccessRbacPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <PageHeader
      eyebrow="Admin"
      title={title}
      description={description}
    />
  );
}

export function AccessRbacSurfaceLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const params = useParams();
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const favoriteSurfaceIds = useShellStore((state) => state.favoriteSurfaceIds);
  const toggleSurfaceFavorite = useShellStore((state) => state.toggleSurfaceFavorite);
  const app = getAppById("access-rbac");
  const surfaces = app ? getAccessibleSurfaces(app, permissions) : [];
  const groups = getSurfaceNavigationGroups(surfaces);
  const currentSurfaceId = params.surfaceId ?? app?.defaultSurfaceId ?? "";

  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="min-h-full xl:grid xl:grid-cols-[208px_minmax(0,1fr)]">
        <aside
          data-theme-chrome="sidebar"
          className="border-b border-border/70 bg-sidebar/96 text-sidebar-foreground shadow-[var(--shadow-panel)] backdrop-blur xl:border-b-0 xl:border-r"
        >
          <div className="xl:sticky xl:top-0">
            <div className="border-b border-border/70 px-4 py-3.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Access & RBAC
            </div>
            <div className="space-y-3 px-2 py-2">
              {groups.map((group, index) => (
                <div
                  key={group.id}
                  className={cn(index > 0 && "border-t border-border/60 pt-3")}
                >
                  <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.surfaces.map((surface) => {
                      const active = surface.id === currentSurfaceId;
                      const favoriteId = getSurfaceFavoriteId("access-rbac", surface.id);
                      const isFavorite = isSurfaceFavorited(
                        favoriteSurfaceIds,
                        "access-rbac",
                        surface.id,
                      );

                      return (
                        <div
                          key={surface.id}
                          className={cn(
                            "group flex items-center gap-1 rounded-[calc(var(--radius)-8px)] pr-1 text-sidebar-foreground/72 transition-colors hover:bg-sidebar-foreground/[0.04] hover:text-foreground",
                            active && "bg-sidebar-foreground/[0.06] text-foreground",
                          )}
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 px-2 py-1.5 text-left"
                            onClick={() => {
                              navigate(getAppPath("access-rbac", surface.id));
                            }}
                          >
                            <div className="flex min-h-8 items-center">
                              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                                {surface.navLabel ?? surface.title}
                              </span>
                            </div>
                          </button>
                          <SurfaceFavoriteButton
                            favorite={isFavorite}
                            onToggle={() => toggleSurfaceFavorite(favoriteId)}
                            className="mt-0.5"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="px-5 pt-4 md:px-6">
            <AccessRbacPageHeader title={title} description={description} />
          </div>
          <div className="space-y-6 px-5 py-6 md:px-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function UserAccessInspectorPanel({
  sessionUser,
}: {
  sessionUser?: AppUser | null;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(sessionUser ?? null);
  const deferredSearchValue = useDeferredValue(searchValue);
  const usersQuery = useQuery({
    queryKey: ["access-rbac", "users", deferredSearchValue],
    queryFn: () =>
      listAccessRbacUsers({
        search: deferredSearchValue.trim() || undefined,
      }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!sessionUser || selectedUser) {
      return;
    }

    setSelectedUser(sessionUser);
    setSearchValue(formatUserOptionLabel(sessionUser));
  }, [selectedUser, sessionUser]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;

      if (!rootRef.current?.contains(target)) {
        setSearchOpen(false);
      }
    }

    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("click", handleClick);
    };
  }, []);

  const inspectedUser = selectedUser ?? sessionUser ?? null;
  const inspectedPermissions = inspectedUser?.permissions ?? [];
  const accessFootprint = getAccessFootprint(inspectedPermissions);
  const resultUsers = usersQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div ref={rootRef} className="relative max-w-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchValue}
            placeholder="Search by name or email..."
            className="h-11 border-border/80 bg-background/90 pl-9 shadow-sm"
            onFocus={() => {
              setSearchOpen(true);
            }}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setSearchOpen(true);
            }}
          />
          {searchOpen ? (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[calc(var(--radius)-4px)] border border-border/80 bg-card/96 shadow-[var(--shadow-panel)] backdrop-blur">
              <div className="max-h-72 overflow-y-auto p-1.5">
                {usersQuery.isLoading ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading users...
                  </div>
                ) : resultUsers.length ? (
                  resultUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 rounded-[calc(var(--radius)-6px)] px-3 py-2 text-left transition-colors hover:bg-muted/45"
                      onClick={() => {
                        setSelectedUser(user);
                        setSearchValue(formatUserOptionLabel(user));
                        setSearchOpen(false);
                      }}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {user.name || user.email}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                      </div>
                      <div className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {getRoleLabel(user.role)}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    No users matched this search.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <Card variant="nested">
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
              <InfoRow label="Name" value={inspectedUser?.name ?? "-"} />
              <InfoRow label="Role" value={getRoleLabel(inspectedUser?.role) ?? "-"} />
              <InfoRow label="Email" value={inspectedUser?.email ?? "-"} />
              <InfoRow label="Team" value={inspectedUser?.team ?? "-"} />
            </div>

            {sessionUser && inspectedUser?.id === sessionUser.id ? (
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="secondary">Current session</Badge>
                <div className="text-sm text-muted-foreground">
                  The inspected user matches the signed-in operator.
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card variant="nested">
          <CardHeader className="p-4 pb-0">
            <CardTitle>Granted permissions</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-4">
            <div className="flex flex-wrap gap-2">
              {inspectedUser?.permissions.length ? (
                inspectedUser.permissions.map((permission) => (
                  <Badge key={permission} variant="primary">
                    {permission}
                  </Badge>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No explicit permissions.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card variant="nested">
          <CardHeader className="p-4 pb-0">
            <CardTitle>Access coverage</CardTitle>
            <CardDescription>
              This is the same shell coverage model used by the Coverage surface, resolved for the
              selected user.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-4 pt-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label="Apps"
                value={accessFootprint.accessibleApps.length}
                detail="Visible product domains"
              />
              <MetricTile
                label="Surfaces"
                value={accessFootprint.accessibleSurfaces.length}
                detail="Accessible views"
              />
              <MetricTile
                label="Widgets"
                value={accessFootprint.accessibleWidgets.length}
                detail="Unlocked components"
              />
              <MetricTile
                label="Utilities"
                value={accessFootprint.accessibleActions.length}
                detail="Global shell utilities"
              />
            </div>
            <ResourceCoverageGrid permissions={inspectedPermissions} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function getAccessFootprint(permissions: string[]) {
  const accessibleApps = getAccessibleApps(permissions);
  const accessibleSurfaces = getAccessibleSurfaceEntries(permissions);
  const accessibleWidgets = appRegistry.widgets.filter((widget) =>
    hasAllPermissions(permissions, widget.requiredPermissions ?? []),
  );
  const accessibleActions = accessRbacUtilityActions.filter((action) =>
    hasAllPermissions(permissions, action.requiredPermissions),
  );

  return {
    accessibleApps,
    accessibleSurfaces,
    accessibleWidgets,
    accessibleActions,
  };
}

export function RoleMatrixCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Access class matrix</CardTitle>
        <CardDescription>
          The shell currently keeps only two built-in access classes: Admin and User. The matrix
          below shows the fallback permission bundles used when the backend does not send explicit
          permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table
          className="w-full min-w-[560px] border-separate text-sm"
          style={{ borderSpacing: "0 var(--table-standard-row-gap)" }}
        >
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="py-[var(--table-standard-header-padding-y)]">Permission</th>
              {accessRbacRoles.map((role) => (
                <th key={role} className="py-[var(--table-standard-header-padding-y)]">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ fontSize: "var(--table-standard-font-size)" }}>
            {ALL_PERMISSIONS.map((permission) => (
              <tr key={permission}>
                <td className="rounded-l-[calc(var(--radius)-6px)] border border-r-0 border-border/70 bg-background/45 px-4 py-[var(--table-standard-cell-padding-y)] font-mono text-xs text-foreground">
                  {permission}
                </td>
                {accessRbacRoles.map((role, index) => {
                  const allowed = ROLE_PERMISSIONS[role].includes(permission);

                  return (
                    <td
                      key={role}
                      className={`border border-border/70 bg-background/45 px-4 py-[var(--table-standard-cell-padding-y)] ${
                        index === accessRbacRoles.length - 1
                          ? "rounded-r-[calc(var(--radius)-6px)]"
                          : "border-l-0"
                      }`}
                    >
                      {allowed ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function ResourceCoverageGrid({ permissions }: { permissions: string[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ResourceAccessCard
        title="Apps"
        description="Apps are the primary navigation domains. Each one routes to a default accessible surface."
        items={appRegistry.apps.map((app) => ({
          label: app.title,
          allowed: canAccessApp(app, permissions),
          metadata: `${app.source} · ${(app.requiredPermissions ?? ["none"]).join(", ")}`,
        }))}
      />
      <ResourceAccessCard
        title="Surfaces"
        description="Dashboards, pages, and tools remain app-local. Visibility depends on both app and surface permissions."
        items={appRegistry.surfaces.map((surface) => {
          const app = getAppById(surface.appId);

          return {
            label: `${surface.appTitle} / ${surface.title}`,
            allowed: app ? canAccessSurface(app, surface, permissions) : false,
            metadata: `${surface.kind} · ${(surface.requiredPermissions ?? ["none"]).join(", ")}`,
          };
        })}
      />
      <ResourceAccessCard
        title="Widgets"
        description="Widgets are independently gated, so a visible dashboard can still contain locked tiles for lower roles."
        items={appRegistry.widgets.map((widget) => ({
          label: widget.title,
          allowed: hasAllPermissions(permissions, widget.requiredPermissions ?? []),
          metadata: (widget.requiredPermissions ?? ["none"]).join(", "),
        }))}
      />
      <ResourceAccessCard
        title="Utility actions"
        description="Global utilities stay reachable from the shell only when the underlying permission gates are satisfied."
        items={accessRbacUtilityActions.map((action) => ({
          label: action.label,
          allowed: hasAllPermissions(permissions, action.requiredPermissions),
          metadata: action.requiredPermissions.join(", "),
        }))}
      />
    </div>
  );
}

export function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <Card variant="nested">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
        <div className="mt-2 font-semibold tracking-tight text-foreground text-[var(--font-size-card-value)]">
          {value}
        </div>
        {detail ? (
          <div className="mt-1 text-muted-foreground" style={{ fontSize: "var(--font-size-body-xs)" }}>
            {detail}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function formatUserOptionLabel(user: Pick<AppUser, "name" | "email">) {
  if (user.name && user.email) {
    return `${user.name} <${user.email}>`;
  }

  return user.email || user.name || "User";
}

function ResourceAccessCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ label: string; allowed: boolean; metadata: string }>;
}) {
  return (
    <Card>
      <CardHeader className="px-4 py-3 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1 text-xs leading-5">{description}</CardDescription>
          </div>
          <Badge variant="neutral">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-4">
        <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{item.label}</div>
              <div className="text-[11px] leading-5 text-muted-foreground">{item.metadata}</div>
            </div>
            <Badge variant={item.allowed ? "success" : "warning"}>
              {item.allowed ? "allowed" : "locked"}
            </Badge>
          </div>
        ))}
        </div>
      </CardContent>
    </Card>
  );
}
