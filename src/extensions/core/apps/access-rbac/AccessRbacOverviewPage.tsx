import { useState } from "react";

import { fetchCurrentAuthGroups } from "@/auth/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  AccessRbacSurfaceLayout,
} from "./shared";

export function AccessRbacOverviewPage() {
  const [currentGroups, setCurrentGroups] = useState<string[] | null>(null);
  const [currentGroupsError, setCurrentGroupsError] = useState<string | null>(null);
  const [currentGroupsLoading, setCurrentGroupsLoading] = useState(false);

  async function handleLoadCurrentGroups() {
    setCurrentGroupsLoading(true);
    setCurrentGroupsError(null);

    try {
      const groups = await fetchCurrentAuthGroups();
      setCurrentGroups(groups);
    } catch (error) {
      setCurrentGroupsError(
        error instanceof Error ? error.message : "Unable to load current groups.",
      );
      setCurrentGroups(null);
    } finally {
      setCurrentGroupsLoading(false);
    }
  }

  return (
    <AccessRbacSurfaceLayout
      title="Access & RBAC"
      description="This overview separates what Command Center enforces in the shell from what Main Sequence enforces on governed backend resources."
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
                <div className="text-sm font-medium text-foreground">Platform access class</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Right now Command Center only distinguishes Admin and User. That platform access
                  class is configured in <code>config/command-center.yaml</code> by mapping
                  backend RBAC groups into the shell application groups under{" "}
                  <code>auth.jwt.user_details.role_groups</code>. You can inspect that mapping in
                  Admin Settings under Auth. Admin unlocks administration surfaces. User is the
                  general non-admin shell class.
                </div>
              </CardContent>
            </Card>
            <Card variant="nested">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-foreground">Resolution flow</div>
                <pre className="mt-3 overflow-x-auto rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/55 p-4 text-xs leading-6 text-foreground">
{`backend RBAC groups
        |
        +-- matches configured Admin group? ------ yes ---> Admin shell class
        |                                             |
        |                                             v
        |                                      admin surfaces unlock
        |
        +-- no ---> groups are assigned to policies
                         |
                         +-- one policy match -------> apply that policy
                         |
                         +-- multiple matches -------> highest precedence wins
                         |                              + permission grants merge
                         |
                         +-- no policy match ---------> fallback User baseline
                                                        |
                                                        v
                                           shell gates decide what is visible,
                                           searchable, and reachable`}
                </pre>
              </CardContent>
            </Card>
            <Card variant="nested">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-foreground">Permission gates</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Permissions are the real enforcement layer. In the current shell, those
                  permission gates are resolved from backend RBAC groups and auth claims during
                  session build. Apps, pages, tools, widgets, and utilities each declare their
                  required permissions, and the shell uses those checks to decide what is visible,
                  searchable, and reachable.
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentGroupsLoading}
                      onClick={() => {
                        void handleLoadCurrentGroups();
                      }}
                    >
                      {currentGroupsLoading ? "Loading groups..." : "Show current groups"}
                    </Button>
                    {currentGroupsError ? (
                      <span className="text-xs text-danger">{currentGroupsError}</span>
                    ) : null}
                  </div>
                  {currentGroups ? (
                    currentGroups.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {currentGroups.map((group) => (
                          <Badge key={group} variant="primary">
                            {group}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        No groups were returned for this session.
                      </div>
                    )
                  ) : null}
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
