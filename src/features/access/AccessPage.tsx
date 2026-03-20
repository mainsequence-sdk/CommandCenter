import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";

import { appRegistry, getAppById } from "@/app/registry";
import {
  canAccessApp,
  canAccessSurface,
  getAccessibleApps,
  getAccessibleSurfaceEntries,
} from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import {
  ALL_PERMISSIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  getRoleLabel,
  hasAllPermissions,
} from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  RbacAssignmentMatrix,
  type RbacAssignableTeam,
  type RbacAssignableUser,
  type RbacAssignmentScope,
  type RbacAssignmentValue,
} from "@/components/ui/rbac-assignment-matrix";
import { listTeams } from "@/features/teams/api";
import { builtinAppRoles } from "@/auth/types";

const roles = builtinAppRoles;
const objectAccessScopes: RbacAssignmentScope[] = [
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

function mergeRbacIds(...lists: Array<Array<string | number>>) {
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

export function AccessPage() {
  const session = useAuthStore((state) => state.session);
  const permissions = session?.user.permissions ?? [];
  const sessionUser = session?.user;

  const accessibleApps = getAccessibleApps(permissions);
  const accessibleSurfaces = getAccessibleSurfaceEntries(permissions);

  const accessibleWidgets = appRegistry.widgets.filter((widget) =>
    hasAllPermissions(permissions, widget.requiredPermissions ?? []),
  );
  const utilityActions = [
    {
      label: "Widget Catalog",
      requiredPermissions: ["widget.catalog:view"],
    },
    {
      label: "Theme Studio",
      requiredPermissions: ["theme:manage"],
    },
    {
      label: "Access Explorer",
      requiredPermissions: ["rbac:view"],
    },
  ];
  const accessibleActions = utilityActions.filter((action) =>
    hasAllPermissions(permissions, action.requiredPermissions),
  );
  const teamsQuery = useQuery({
    queryKey: ["teams", "list", "access-page"],
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
          roleLabel: "Analyst",
        },
        {
          id: "fatih-da1994",
          email: "fatih.da1994@gmail.com",
          roleLabel: "Viewer",
        },
        {
          id: "joselo-main-sequence",
          email: "joselo@main-sequence.io",
          roleLabel: "Trader",
        },
        {
          id: "info-main-sequence",
          email: "l@main-sequence.io",
          roleLabel: "Support",
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
  const [objectAccessValue, setObjectAccessValue] = useState<RbacAssignmentValue>(() => ({
    view: {
      userIds: sessionUser ? [sessionUser.id] : [],
      teamIds: assignmentTeams[0] ? [assignmentTeams[0].id] : [],
    },
    edit: {
      userIds: sessionUser ? [sessionUser.id] : [],
      teamIds: [],
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Access & RBAC"
        description="Frontend gates mirror backend roles so users only see apps, surfaces, widgets, and utility actions they are entitled to use."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Current session</CardTitle>
            <CardDescription>
              This view demonstrates UI-level RBAC. The backend must still enforce authorization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoRow label="Name" value={session?.user.name ?? "-"} />
              <InfoRow label="Role" value={session?.user.role ?? "-"} />
              <InfoRow label="Email" value={session?.user.email ?? "-"} />
              <InfoRow label="Team" value={session?.user.team ?? "-"} />
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Granted permissions
              </div>
              <div className="flex flex-wrap gap-2">
                {permissions.map((permission) => (
                  <Badge key={permission} variant="primary">
                    {permission}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MiniList
                title="Accessible apps"
                items={accessibleApps.map((app) => app.title)}
              />
              <MiniList
                title="Accessible surfaces"
                items={accessibleSurfaces.map((surface) => `${surface.appTitle} / ${surface.title}`)}
              />
              <MiniList
                title="Accessible widgets"
                items={accessibleWidgets.map((widget) => widget.title)}
              />
              <MiniList
                title="Accessible actions"
                items={accessibleActions.map((action) => action.label)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role matrix</CardTitle>
            <CardDescription>
              Built-in shell roles stay visible here as a reference matrix, but the live session can now also come from configured JWT claims.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="pb-2">Permission</th>
                  {roles.map((role) => (
                    <th key={role} className="pb-2">{ROLE_LABELS[role]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMISSIONS.map((permission) => (
                  <tr key={permission}>
                    <td className="rounded-l-[calc(var(--radius)-6px)] border border-r-0 border-border/70 bg-background/45 px-4 py-3 font-mono text-xs text-foreground">
                      {permission}
                    </td>
                    {roles.map((role, index) => {
                      const allowed = ROLE_PERMISSIONS[role].includes(permission);

                      return (
                        <td
                          key={role}
                          className={`border border-border/70 bg-background/45 px-4 py-3 ${
                            index === roles.length - 1
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Object access assignments</CardTitle>
          <CardDescription>
            Assign direct object access to individual users and teams.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RbacAssignmentMatrix
            scopes={objectAccessScopes}
            users={assignmentUsers}
            teams={assignmentTeams}
            value={objectAccessValue}
            onChange={(nextValue) => {
              setObjectAccessValue({
                ...nextValue,
                view: {
                  userIds: mergeRbacIds(
                    nextValue.view?.userIds ?? [],
                    nextValue.edit?.userIds ?? [],
                  ),
                  teamIds: mergeRbacIds(
                    nextValue.view?.teamIds ?? [],
                    nextValue.edit?.teamIds ?? [],
                  ),
                },
                edit: {
                  userIds: nextValue.edit?.userIds ?? [],
                  teamIds: nextValue.edit?.teamIds ?? [],
                },
              });
            }}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-4">
        <ResourceAccessCard
          title="Apps"
          description="Apps are the primary left-rail navigation units. Users land on each app's default home surface."
          items={appRegistry.apps.map((app) => ({
            label: app.title,
            allowed: canAccessApp(app, permissions),
            metadata: `${app.source} · ${(app.requiredPermissions ?? ["none"]).join(", ")}`,
          }))}
        />
        <ResourceAccessCard
          title="Surfaces"
          description="Dashboards, pages, and tools are app-local surfaces. Their visibility depends on both app and surface permissions."
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
          description="Widgets are independently gated, so dashboard surfaces can still contain locked tiles for lower roles."
          items={appRegistry.widgets.map((widget) => ({
            label: widget.title,
            allowed: hasAllPermissions(permissions, widget.requiredPermissions ?? []),
            metadata: (widget.requiredPermissions ?? ["none"]).join(", "),
          }))}
        />
        <ResourceAccessCard
          title="Utility actions"
          description="Global utility pages are reachable from search and the library section of the shell."
          items={utilityActions.map((action) => ({
            label: action.label,
            allowed: hasAllPermissions(permissions, action.requiredPermissions),
            metadata: action.requiredPermissions.join(", "),
          }))}
        />
      </div>
    </div>
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

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 p-4">
      <div className="mb-3 text-sm font-medium">{title}</div>
      <div className="space-y-2 text-sm text-muted-foreground">
        {items.length ? items.map((item) => <div key={item}>{item}</div>) : <div>None</div>}
      </div>
    </div>
  );
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
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start justify-between gap-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="font-medium text-foreground">{item.label}</div>
              <div className="text-sm text-muted-foreground">{item.metadata}</div>
            </div>
            <Badge variant={item.allowed ? "success" : "warning"}>
              {item.allowed ? "allowed" : "locked"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
