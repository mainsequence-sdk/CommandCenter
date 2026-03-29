import { Navigate } from "react-router-dom";

import { getAppById } from "@/app/registry";
import { getAccessibleApps, getAppPath, getDefaultSurface } from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import { env } from "@/config/env";

export function AppRedirect() {
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const accessibleApps = getAccessibleApps(permissions);
  const mockDemoApp = env.useMockData ? getAppById("demo") : undefined;
  const preferredApp =
    mockDemoApp && accessibleApps.some((app) => app.id === mockDemoApp.id)
      ? mockDemoApp
      : accessibleApps[0];
  const defaultSurface = preferredApp ? getDefaultSurface(preferredApp, permissions) : undefined;

  if (!preferredApp || !defaultSurface) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        No apps are available for the current role.
      </div>
    );
  }

  return <Navigate to={getAppPath(preferredApp.id, defaultSurface.id)} replace />;
}
