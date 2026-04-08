import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  AccessRbacSurfaceLayout,
} from "./shared";

export function AccessRbacOverviewPage() {
  return (
    <AccessRbacSurfaceLayout
      title="Access & RBAC"
      description="This overview separates what Command Center enforces in the shell from what Main Sequence enforces on governed backend resources for organization-admin workflows."
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Command Center</CardTitle>
            <CardDescription>
              This section describes the platform behavior enforced by the shell itself.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Card variant="nested">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-foreground">Authentication and session</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Login resolves the signed-in identity and builds the session. That session carries
                  the user record, the current access class, and the permission set the shell will
                  use for gating.
                </div>
              </CardContent>
            </Card>
            <Card variant="nested">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-foreground">Organization access class</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Auth identifies the user. Command Center then resolves shell access from the
                  dedicated shell-access endpoint and uses the returned
                  <code> effective_permissions</code> as the source of truth for organization-admin
                  surfaces.
                </div>
              </CardContent>
            </Card>
            <Card variant="nested">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-foreground">Resolution flow</div>
                <pre className="mt-3 overflow-x-auto rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/55 p-4 text-xs leading-6 text-foreground">
{`backend user details / JWT claims
        |
        +-- identity bootstrap ----------------------> signed-in user profile
        |
        +-- /command_center/access-policies/ --------> reusable shell policy definitions
        |
        +-- /command_center/users/<id>/shell-access/ -> user policy assignments plus direct grants/denies
        |                                              resolve into effective permissions
        |
        +-- effective_permissions --------------------> shell gates decide what is visible,
                                                       searchable, and reachable`}
                </pre>
              </CardContent>
            </Card>
            <Card variant="nested">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-foreground">Permission gates</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Permissions are the real shell enforcement layer. Reusable shell policies and
                  per-user overrides come from the dedicated Command Center policy and shell-access
                  endpoints. Apps, pages, tools, widgets, and utilities each declare their required
                  permissions, and the shell uses those checks to decide what is visible,
                  searchable, and reachable.
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="text-xs text-muted-foreground">
                    Auth groups can still exist on backend identity payloads, but they are not part
                    of the Command Center config contract and they no longer unlock
                    organization-admin navigation in the shell.
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Main Sequence</CardTitle>
            <CardDescription>
              The Main Sequence application uses a more fine-grained object access model. This
              separates Command Center view-level RBAC from Main Sequence object-level RBAC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Card variant="nested">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-foreground">Resource assignments</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Object-level RBAC is separate from the Command Center platform access class.
                  Individual Main Sequence resources can still grant direct `view` or `edit` access
                  to users and teams without changing whether the shell treats them as Admin or
                  User.
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </AccessRbacSurfaceLayout>
  );
}
