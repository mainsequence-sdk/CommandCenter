import { Navigate } from "react-router-dom";

import { getAccessibleApps, getAppPath, getDefaultSurface } from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";

export function AppRedirect() {
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const firstApp = getAccessibleApps(permissions)[0];
  const defaultSurface = firstApp ? getDefaultSurface(firstApp, permissions) : undefined;

  if (!firstApp || !defaultSurface) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        No apps are available for the current role.
      </div>
    );
  }

  return <Navigate to={getAppPath(firstApp.id, defaultSurface.id)} replace />;
}
