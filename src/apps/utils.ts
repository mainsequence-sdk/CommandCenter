import { appRegistry, getAppById, getAppSurfaceById } from "@/app/registry";
import { hasAllPermissions } from "@/auth/permissions";
import type {
  AppDefinition,
  AppNavigationPlacement,
  AppShellMenuAudience,
  AppShellMenuContribution,
  AppSurfaceDefinition,
  AppSurfaceEntry,
  AppSurfaceNavigationGroup,
  AppSurfaceNavigationSection,
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
  return appRegistry.apps
    .filter((app) => {
      if (!canAccessApp(app, permissions)) {
        return false;
      }

      return getAccessibleSurfaces(app, permissions).length > 0;
    })
    .sort((left, right) => {
      const leftOrder = left.navigationOrder ?? 1000;
      const rightOrder = right.navigationOrder ?? 1000;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.title.localeCompare(right.title);
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

export function canAccessShellMenuContribution(
  app: AppDefinition,
  contribution: AppShellMenuContribution,
  permissions: string[],
) {
  return (
    canAccessApp(app, permissions) &&
    hasAllPermissions(permissions, contribution.requiredPermissions ?? [])
  );
}

export function getAccessibleShellMenuEntries(
  permissions: string[],
  audience: AppShellMenuAudience,
) {
  return appRegistry.shellMenuEntries
    .filter((entry) => {
      if (entry.audience !== audience) {
        return false;
      }

      const app = getAppById(entry.appId);

      if (!app) {
        return false;
      }

      return canAccessShellMenuContribution(app, entry, permissions);
    })
    .sort((left, right) => {
      const leftGroupOrder = left.group?.order ?? Number.POSITIVE_INFINITY;
      const rightGroupOrder = right.group?.order ?? Number.POSITIVE_INFINITY;

      if (leftGroupOrder !== rightGroupOrder) {
        return leftGroupOrder - rightGroupOrder;
      }

      const leftOrder = left.order ?? Number.POSITIVE_INFINITY;
      const rightOrder = right.order ?? Number.POSITIVE_INFINITY;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      if (left.appTitle !== right.appTitle) {
        return left.appTitle.localeCompare(right.appTitle);
      }

      return left.label.localeCompare(right.label);
    });
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

export function getSurfaceFavoriteId(appId: string, surfaceId: string) {
  return `${appId}::${surfaceId}`;
}

export function isSurfaceFavorited(
  favoriteSurfaceIds: string[],
  appId: string,
  surfaceId: string,
) {
  return favoriteSurfaceIds.includes(getSurfaceFavoriteId(appId, surfaceId));
}

export function getFavoriteSurfaceEntries(
  permissions: string[],
  favoriteSurfaceIds: string[],
) {
  const accessibleSurfaces = getAccessibleSurfaceEntries(permissions);
  const accessibleSurfaceMap = new Map(
    accessibleSurfaces.map((surface) => [getSurfaceFavoriteId(surface.appId, surface.id), surface]),
  );

  return favoriteSurfaceIds
    .map((favoriteId) => accessibleSurfaceMap.get(favoriteId))
    .filter((surface): surface is AppSurfaceEntry => Boolean(surface));
}

const fallbackSurfaceSections: Record<
  AppSurfaceDefinition["kind"],
  AppSurfaceNavigationSection
> = {
  dashboard: {
    id: "dashboards",
    label: "Dashboards",
    order: 900,
  },
  page: {
    id: "pages",
    label: "Pages",
    order: 910,
  },
  tool: {
    id: "tools",
    label: "Tools",
    order: 920,
  },
};

export function getSurfaceNavigationGroups(
  surfaces: AppSurfaceDefinition[],
): AppSurfaceNavigationGroup[] {
  const groups = new Map<
    string,
    AppSurfaceNavigationGroup & { order: number; firstIndex: number }
  >();

  surfaces.forEach((surface, index) => {
    const section = surface.navigationSection ?? fallbackSurfaceSections[surface.kind];
    const existingGroup = groups.get(section.id);

    if (existingGroup) {
      existingGroup.surfaces.push(surface);
      existingGroup.firstIndex = Math.min(existingGroup.firstIndex, index);
      existingGroup.order = Math.min(existingGroup.order, section.order ?? index);
      return;
    }

    groups.set(section.id, {
      id: section.id,
      label: section.label,
      description: section.description,
      surfaces: [surface],
      firstIndex: index,
      order: section.order ?? index,
    });
  });

  return Array.from(groups.values())
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.firstIndex - right.firstIndex;
    })
    .map(({ id, label, description, surfaces: groupedSurfaces }) => ({
      id,
      label,
      description,
      surfaces: groupedSurfaces,
    }));
}
