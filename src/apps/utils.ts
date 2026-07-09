import { appRegistry, getAppById, getAppSurfaceById } from "@/app/registry";
import type { ShellAccess } from "@/auth/types";
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

function normalizeShellAccess(shellAccess?: ShellAccess | null) {
  return {
    appIds: new Set(shellAccess?.accessibleApps ?? []),
    surfaceIds: new Set(shellAccess?.accessibleSurfaces ?? []),
  };
}

function getSettingsSurfaceParts(surfaceId: string) {
  const [sectionId, ...surfacePathParts] = surfaceId.split("/").filter(Boolean);

  if (!sectionId || surfacePathParts.length === 0) {
    return null;
  }

  return {
    appId: `settings.${sectionId}`,
    surfaceId: surfacePathParts.join("/"),
  };
}

export function getShellAppIdForSurface(appId: string, surfaceId: string) {
  if (appId === "settings") {
    return getSettingsSurfaceParts(surfaceId)?.appId ?? appId;
  }

  return appId;
}

export function getShellSurfaceIdForSurface(appId: string, surfaceId: string) {
  if (appId === "settings") {
    return getSettingsSurfaceParts(surfaceId)?.surfaceId ?? surfaceId;
  }

  return surfaceId;
}

export function getShellSurfaceKey(appId: string, surfaceId: string) {
  const shellAppId = getShellAppIdForSurface(appId, surfaceId);
  const shellSurfaceId = getShellSurfaceIdForSurface(appId, surfaceId);

  return `${shellAppId}.${shellSurfaceId}`;
}

export function canAccessApp(app: AppDefinition, shellAccess?: ShellAccess | null) {
  const { appIds } = normalizeShellAccess(shellAccess);

  if (app.id === "settings") {
    return Array.from(appIds).some((appId) => appId.startsWith("settings."));
  }

  return appIds.has(app.id);
}

export function getAppNavigationPlacement(app: Pick<AppDefinition, "navigationPlacement">) {
  return app.navigationPlacement ?? "primary";
}

export function canAccessSurface(
  app: AppDefinition,
  surface: AppSurfaceDefinition,
  shellAccess?: ShellAccess | null,
  options: { includeHidden?: boolean } = {},
) {
  const normalizedShellAccess = normalizeShellAccess(shellAccess);
  const shellAppId = getShellAppIdForSurface(app.id, surface.id);

  return (
    normalizedShellAccess.appIds.has(shellAppId) &&
    (options.includeHidden || !surface.hidden) &&
    normalizedShellAccess.surfaceIds.has(getShellSurfaceKey(app.id, surface.id))
  );
}

export function getAccessibleSurfaces(app: AppDefinition, shellAccess?: ShellAccess | null) {
  return app.surfaces.filter((surface) => canAccessSurface(app, surface, shellAccess));
}

export function getDefaultSurface(app: AppDefinition, shellAccess?: ShellAccess | null) {
  const visibleSurfaces = getAccessibleSurfaces(app, shellAccess);

  return (
    visibleSurfaces.find((surface) => surface.id === app.defaultSurfaceId) ??
    visibleSurfaces[0]
  );
}

export function getAccessibleApps(shellAccess?: ShellAccess | null) {
  return appRegistry.apps
    .filter((app) => {
      if (!canAccessApp(app, shellAccess)) {
        return false;
      }

      return getAccessibleSurfaces(app, shellAccess).length > 0;
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
  shellAccess: ShellAccess | null | undefined,
  placement: AppNavigationPlacement,
) {
  return getAccessibleApps(shellAccess).filter(
    (app) => getAppNavigationPlacement(app) === placement,
  );
}

export function getAccessiblePrimaryApps(shellAccess?: ShellAccess | null) {
  return getAccessibleAppsByPlacement(shellAccess, "primary");
}

export function getAccessibleAdminMenuApps(shellAccess?: ShellAccess | null) {
  return getAccessibleAppsByPlacement(shellAccess, "admin-menu");
}

export function canAccessShellMenuContribution(
  app: AppDefinition,
  contribution: AppShellMenuContribution,
  shellAccess?: ShellAccess | null,
) {
  return canAccessApp(app, shellAccess);
}

export function getAccessibleShellMenuEntries(
  shellAccess: ShellAccess | null | undefined,
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

      return canAccessShellMenuContribution(app, entry, shellAccess);
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

export function getAccessibleSurfaceEntries(shellAccess?: ShellAccess | null) {
  return appRegistry.surfaces.filter((surface) => {
    const app = getAppById(surface.appId);
    const appSurface = getAppSurfaceById(surface.appId, surface.id);

    if (!app || !appSurface) {
      return false;
    }

    return canAccessSurface(app, appSurface, shellAccess);
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
  shellAccess: ShellAccess | null | undefined,
  favoriteSurfaceIds: string[],
) {
  const accessibleSurfaces = getAccessibleSurfaceEntries(shellAccess);
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
