import { Navigate, useParams } from "react-router-dom";

import { getAppById, getAppSurfaceById } from "@/app/registry";
import { canAccessApp, getAccessibleApps, getAppPath, getDefaultSurface } from "@/apps/utils";
import { hasAllPermissions } from "@/auth/permissions";
import { useAuthStore } from "@/auth/auth-store";
import { DashboardCanvas } from "@/features/dashboards/DashboardCanvas";

export function AppPage() {
  const { appId, surfaceId } = useParams();
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const accessibleApps = getAccessibleApps(permissions);

  if (accessibleApps.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        No apps are available for the current role. Add one in the extension registry or update
        RBAC metadata.
      </div>
    );
  }

  const app = (appId ? getAppById(appId) : undefined) ?? accessibleApps[0];

  if (!app || !accessibleApps.some((candidate) => candidate.id === app.id)) {
    return <Navigate to={getAppPath(accessibleApps[0]!.id)} replace />;
  }

  const defaultSurface = getDefaultSurface(app, permissions);

  if (!defaultSurface) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        The selected app has no accessible surfaces for the current role.
      </div>
    );
  }

  if (!surfaceId) {
    return <Navigate to={getAppPath(app.id, defaultSurface.id)} replace />;
  }

  const surface = getAppSurfaceById(app.id, surfaceId);
  const surfaceRouteAccessible =
    Boolean(surface) &&
    canAccessApp(app, permissions) &&
    hasAllPermissions(permissions, surface?.requiredPermissions ?? []);

  if (!surface || !surfaceRouteAccessible) {
    return <Navigate to={getAppPath(app.id, defaultSurface.id)} replace />;
  }

  const resolvedSurface = surface;
  const SurfaceComponent =
    resolvedSurface.kind === "dashboard" ? null : resolvedSurface.component;

  if (resolvedSurface.kind === "dashboard") {
    return <DashboardCanvas dashboard={resolvedSurface.dashboard} />;
  }

  return SurfaceComponent ? <SurfaceComponent /> : null;
}
