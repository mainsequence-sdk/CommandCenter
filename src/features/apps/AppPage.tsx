import { Navigate, useParams } from "react-router-dom";

import { getAppById, getAppSurfaceById } from "@/app/registry";
import { getAccessibleApps, getAccessibleSurfaces, getAppPath, getDefaultSurface } from "@/apps/utils";
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

  const visibleSurfaces = getAccessibleSurfaces(app, permissions);
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

  if (!surface || !visibleSurfaces.some((candidate) => candidate.id === surface.id)) {
    return <Navigate to={getAppPath(app.id, defaultSurface.id)} replace />;
  }

  const SurfaceComponent = surface.kind === "dashboard" ? null : surface.component;

  if (surface.kind === "dashboard") {
    return <DashboardCanvas dashboard={surface.dashboard} />;
  }

  return SurfaceComponent ? <SurfaceComponent /> : null;
}
