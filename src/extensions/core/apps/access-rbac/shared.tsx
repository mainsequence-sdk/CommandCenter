import { type ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Search } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { appRegistry, getAppById } from "@/app/registry";
import { SurfaceFavoriteButton } from "@/app/layout/SurfaceFavoriteButton";
import {
  getAccessibleSurfaces,
  getAppPath,
  getSurfaceFavoriteId,
  getSurfaceNavigationGroups,
  isSurfaceFavorited,
} from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import { getRoleLabel } from "@/auth/permissions";
import type { AppUser } from "@/auth/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";

import {
  getUserShellAccess,
  listAccessRbacUsers,
  type UserShellAccess,
} from "./api";

export function useAccessRbacData() {
  const session = useAuthStore((state) => state.session);
  const sessionUser = session?.user;
  const permissions = sessionUser?.permissions ?? [];

  return {
    session,
    sessionUser,
    permissions,
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
      eyebrow="Organization Admin"
      title={title}
      description={description}
    />
  );
}

export function AccessRbacSurfaceLayout({
  title,
  description,
  children,
  surfaceId,
}: {
  title: string;
  description: string;
  children: ReactNode;
  surfaceId?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const favoriteSurfaceIds = useShellStore((state) => state.favoriteSurfaceIds);
  const toggleSurfaceFavorite = useShellStore((state) => state.toggleSurfaceFavorite);
  const app = getAppById("access-rbac");
  const surfaces = app ? getAccessibleSurfaces(app, permissions) : [];
  const groups = getSurfaceNavigationGroups(surfaces);
  const currentSurfaceId = surfaceId ?? params.surfaceId ?? app?.defaultSurfaceId ?? "";
  const embeddedInSettings = location.pathname.startsWith("/app/settings/");

  if (embeddedInSettings) {
    return <div className="space-y-6">{children}</div>;
  }

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
  const inspectedUser = selectedUser ?? sessionUser ?? null;
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

  const inspectedUserUid = inspectedUser?.uid?.trim() || null;
  function requireInspectedUserUid() {
    if (!inspectedUserUid) {
      throw new Error("Selected user did not include a UID for shell-access.");
    }

    return inspectedUserUid;
  }
  const shellAccessQuery = useQuery({
    queryKey: ["access-rbac", "users", inspectedUserUid, "shell-access"],
    queryFn: () => getUserShellAccess(requireInspectedUserUid()),
    enabled: Boolean(inspectedUserUid),
    staleTime: 30_000,
  });

  const resultUsers = usersQuery.data ?? [];
  const resolvedShellAccess = shellAccessQuery.data ?? null;
  const shellAccessTree = useMemo(
    () => buildShellAccessTree(resolvedShellAccess),
    [resolvedShellAccess],
  );
  const accessibleAppCount = shellAccessTree.length;
  const accessibleSurfaceCount = shellAccessTree.reduce(
    (total, app) => total + app.surfaces.length,
    0,
  );

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

            {resolvedShellAccess ? (
              <div className="mt-4 grid gap-4 border-t border-border/70 pt-4 md:grid-cols-2">
                <InfoRow
                  label="Session"
                  value={
                    sessionUser && inspectedUser?.id === sessionUser.id
                      ? "Current signed-in operator"
                      : "Selected user"
                  }
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card variant="nested">
          <CardHeader className="p-4 pb-0">
            <CardTitle>Resolved shell access</CardTitle>
            <CardDescription>
              Backend-owned shell visibility for the selected user, shown as applications and
              surfaces.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-4 pt-4">
            {shellAccessQuery.isLoading ? (
              <div className="flex items-center gap-2 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading shell access...
              </div>
            ) : shellAccessQuery.error instanceof Error ? (
              <div className="rounded-[calc(var(--radius)-8px)] border border-danger/30 bg-danger/5 px-3 py-3 text-sm text-danger">
                {shellAccessQuery.error.message}
              </div>
            ) : resolvedShellAccess ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <MetricTile
                    label="Applications"
                    value={accessibleAppCount}
                    detail="Allowed app entries"
                  />
                  <MetricTile
                    label="Surfaces"
                    value={accessibleSurfaceCount}
                    detail="Allowed submenu entries"
                  />
                </div>

                <ShellAccessTree apps={shellAccessTree} />
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Select a user to inspect shell access.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ShellAccessTreeApp {
  id: string;
  title: string;
  surfaces: ShellAccessTreeSurface[];
}

interface ShellAccessTreeSurface {
  key: string;
  title: string;
}

function buildShellAccessTree(access: UserShellAccess | null): ShellAccessTreeApp[] {
  const accessibleAppIds = new Set(access?.accessibleApps ?? []);
  const accessibleSurfaceIds = new Set(access?.accessibleSurfaces ?? []);

  return appRegistry.apps.flatMap((app) => {
    const appAllowed = accessibleAppIds.has(app.id);
    const surfaces = appRegistry.surfaces
      .filter((surface) => surface.appId === app.id && !surface.hidden)
      .flatMap((surface) => {
        const surfaceKey = `${surface.appId}.${surface.id}`;

        if (!accessibleSurfaceIds.has(surfaceKey)) {
          return [];
        }

        return [{
          key: surfaceKey,
          title: surface.title,
        }];
      });

    if (!appAllowed && surfaces.length === 0) {
      return [];
    }

    return [{
      id: app.id,
      title: getShellAccessAppTitle(app.id, app.title),
      surfaces,
    }];
  });
}

function getShellAccessAppTitle(appId: string, title: string) {
  if (appId === "settings") {
    return "Account and administration";
  }

  return title;
}

function ShellAccessTree({ apps }: { apps: ShellAccessTreeApp[] }) {
  if (!apps.length) {
    return (
      <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3 text-sm text-muted-foreground">
        No shell applications were returned for this user.
      </div>
    );
  }

  return (
    <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
      {apps.map((app) => (
        <div
          key={app.id}
          className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45"
        >
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <div className="truncate text-sm font-medium text-foreground">{app.title}</div>
              </div>
            </div>
            <Badge variant="success">visible</Badge>
          </div>
          {app.surfaces.length ? (
            <div className="border-t border-border/60 px-4 py-3">
              <div className="grid gap-2 md:grid-cols-2">
                {app.surfaces.map((surface) => (
                  <div
                    key={surface.key}
                    className="flex items-start justify-between gap-3 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-card/35 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-success" />
                        <div className="truncate text-sm text-foreground">{surface.title}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ))}
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
