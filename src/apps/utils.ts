import { appRegistry, getAppById, getAppSurfaceById } from "@/app/registry";
import { hasAllPermissions } from "@/auth/permissions";
import type {
  AppDefinition,
  AppNavigationPlacement,
  AppSurfaceDefinition,
  AppSurfaceEntry,
} from "@/apps/types";

export function getAppPath(appId: string, surfaceId?: string) {
  return surfaceId ? `/app/${appId}/${surfaceId}` : `/app/${appId}`;
}

export function canAccessApp(app: AppDefinition, permissions: string[]) {
  return hasAllPermissions(permissions, app.requiredPermissions ?? []);
}

export function getAppNavigationPlacement(app: Pick<AppDefinition, "navigationPlacement">) {
  return app.navigationPlacement ?? "primary";
}

export function canAccessSurface(
  app: AppDefinition,
  surface: AppSurfaceDefinition,
  permissions: string[],
) {
  return (
    canAccessApp(app, permissions) &&
    !surface.hidden &&
    hasAllPermissions(permissions, surface.requiredPermissions ?? [])
  );
}

export function getAccessibleSurfaces(app: AppDefinition, permissions: string[]) {
  return app.surfaces.filter((surface) => canAccessSurface(app, surface, permissions));
}

export function getDefaultSurface(app: AppDefinition, permissions: string[]) {
  const visibleSurfaces = getAccessibleSurfaces(app, permissions);

  return (
    visibleSurfaces.find((surface) => surface.id === app.defaultSurfaceId) ??
    visibleSurfaces[0]
  );
}

export function getAccessibleApps(permissions: string[]) {
  return appRegistry.apps.filter((app) => {
    if (!canAccessApp(app, permissions)) {
      return false;
    }

    return getAccessibleSurfaces(app, permissions).length > 0;
  });
}

export function getAccessibleAppsByPlacement(
  permissions: string[],
  placement: AppNavigationPlacement,
) {
  return getAccessibleApps(permissions).filter(
    (app) => getAppNavigationPlacement(app) === placement,
  );
}

export function getAccessiblePrimaryApps(permissions: string[]) {
  return getAccessibleAppsByPlacement(permissions, "primary");
}

export function getAccessibleAdminMenuApps(permissions: string[]) {
  return getAccessibleAppsByPlacement(permissions, "admin-menu");
}

export function getAccessibleSurfaceEntries(permissions: string[]) {
  return appRegistry.surfaces.filter((surface) => {
    const app = getAppById(surface.appId);
    const appSurface = getAppSurfaceById(surface.appId, surface.id);

    if (!app || !appSurface) {
      return false;
    }

    return canAccessSurface(app, appSurface, permissions);
  });
}

export function getSurfacePath(surface: AppSurfaceEntry) {
  return getAppPath(surface.appId, surface.id);
}
