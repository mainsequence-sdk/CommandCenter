import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RbacAssignmentMatrix,
  type RbacAssignmentValue,
} from "@/components/ui/rbac-assignment-matrix";

import {
  AccessRbacSurfaceLayout,
  MetricTile,
  accessRbacAssignmentScopes,
  mergeRbacIds,
  useAccessRbacData,
} from "./shared";

export function AccessRbacAssignmentsPage() {
  const { sessionUser, assignmentUsers, assignmentTeams, teamsQuery } = useAccessRbacData();
  const [objectAccessValue, setObjectAccessValue] = useState<RbacAssignmentValue>(() => ({
    view: {
      userIds: sessionUser ? [sessionUser.id] : [],
      teamIds: [],
    },
    edit: {
      userIds: sessionUser ? [sessionUser.id] : [],
      teamIds: [],
    },
  }));

  useEffect(() => {
    if (!assignmentTeams.length) {
      return;
    }

    setObjectAccessValue((current) => {
      if ((current.view?.teamIds?.length ?? 0) > 0) {
        return current;
      }

      return {
        ...current,
        view: {
          userIds: current.view?.userIds ?? [],
          teamIds: [assignmentTeams[0]!.id],
        },
      };
    });
  }, [assignmentTeams]);

  return (
    <AccessRbacSurfaceLayout
      title="Main Sequence object access"
      description="This Concept & Help surface explains how Main Sequence handles direct object-level access for governed resources such as projects, secrets, constants, and jobs."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Users" value={assignmentUsers.length} detail="Assignable identities" />
        <MetricTile
          label="Teams"
          value={assignmentTeams.length}
          detail={teamsQuery.isLoading ? "Loading directory teams" : "Assignable teams"}
        />
        <MetricTile
          label="View assignees"
          value={
            (objectAccessValue.view?.userIds.length ?? 0) + (objectAccessValue.view?.teamIds.length ?? 0)
          }
          detail="Direct users and teams"
        />
        <MetricTile
          label="Edit assignees"
          value={
            (objectAccessValue.edit?.userIds.length ?? 0) + (objectAccessValue.edit?.teamIds.length ?? 0)
          }
          detail="Higher-order scope"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Object access model</CardTitle>
            <CardDescription>
              This matrix represents one Main Sequence resource at a time. Command Center shell
              policies decide who can open platform surfaces. This layer decides who can view or
              edit an individual Main Sequence object.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RbacAssignmentMatrix
              scopes={accessRbacAssignmentScopes}
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

        <Card>
          <CardHeader>
            <CardTitle>Concept notes</CardTitle>
            <CardDescription>
              This belongs to the Main Sequence concept layer, not the Command Center shell policy
              layer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Card variant="nested">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-foreground">View scope</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  All direct editors also land in view automatically, so the lower scope never drifts
                  behind the higher one.
                </div>
              </CardContent>
            </Card>
            <Card variant="nested">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-foreground">Teams, not groups</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  The matrix is deliberately modeled around users and teams. Team membership is the
                  reusable enterprise primitive here, not an ad-hoc group layer.
                </div>
              </CardContent>
            </Card>
            <Card variant="nested">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-foreground">Reusable by design</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  This page mounts the same `RbacAssignmentMatrix` component that other admin tools
                  can embed inside object detail flows.
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </AccessRbacSurfaceLayout>
  );
}
