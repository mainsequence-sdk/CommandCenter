import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { AccessRbacSurfaceLayout, MetricTile, ResourceCoverageGrid, useAccessRbacData } from "./shared";

export function AccessRbacCoveragePage() {
  const { permissions, accessibleApps, accessibleSurfaces, accessibleWidgets, accessibleActions } =
    useAccessRbacData();

  return (
    <AccessRbacSurfaceLayout
      title="Coverage"
      description="Trace how the current permission set resolves across the full shell. This gives administrators a direct answer to what a user can see before the backend resource layer is involved."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Apps" value={accessibleApps.length} detail="Visible product domains" />
        <MetricTile label="Surfaces" value={accessibleSurfaces.length} detail="Accessible views" />
        <MetricTile label="Widgets" value={accessibleWidgets.length} detail="Unlocked components" />
        <MetricTile label="Utilities" value={accessibleActions.length} detail="Global shell utilities" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Access coverage map</CardTitle>
          <CardDescription>
            Use this surface to sanity-check entitlement rollout before opening the rest of the shell
            to a new role or team configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ResourceCoverageGrid permissions={permissions} />
        </CardContent>
      </Card>
    </AccessRbacSurfaceLayout>
  );
}
