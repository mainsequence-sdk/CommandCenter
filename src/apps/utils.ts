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
    appScopes: new Set((shellAccess?.accessibleApps ?? []).map(normalizeShellAccessId)),
  };
}

export interface ShellAccessTarget {
  appScopeId: string;
  sectionScopeId?: string;
  surfaceId: string;
  surfaceKey: string;
}

export function normalizeShellAccessId(value: string) {
  return value
    .trim()
    .replace(/[\\/]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function getFallbackShellAccessTarget(appId: string, surfaceId: string): ShellAccessTarget {
  const appScopeId = normalizeShellAccessId(appId);
  const normalizedSurfaceId = normalizeShellAccessId(surfaceId);

  return {
    appScopeId,
    surfaceId: normalizedSurfaceId,
    surfaceKey: `${appScopeId}.${normalizedSurfaceId}`,
  };
}

function getFirstShellAccessSegment(value: string) {
  return normalizeShellAccessId(value).split(".").filter(Boolean)[0];
}

function getSectionRelativeSurfaceId(surfaceId: string, sectionId: string) {
  const normalizedSurfaceId = normalizeShellAccessId(surfaceId);
  const normalizedSectionId = normalizeShellAccessId(sectionId);

  if (!normalizedSurfaceId || !normalizedSectionId) {
    return normalizedSurfaceId;
  }

  if (normalizedSurfaceId === normalizedSectionId) {
    return "";
  }

  const sectionPrefix = `${normalizedSectionId}.`;

  if (normalizedSurfaceId.startsWith(sectionPrefix)) {
    return normalizedSurfaceId.slice(sectionPrefix.length);
  }

  return normalizedSurfaceId;
}

export function resolveShellAccessTarget(
  app: AppDefinition,
  surface: AppSurfaceDefinition | string,
): ShellAccessTarget {
  const surfaceDefinition = typeof surface === "string"
    ? app.surfaces.find((candidate) => candidate.id === surface)
    : surface;
  const rawSurfaceId = typeof surface === "string" ? surface : surface.id;
  const appScopeId = normalizeShellAccessId(app.shellAccess?.appScopeId ?? app.id);
  const scopeMode = app.shellAccess?.scopeMode ?? "app";
  const explicitSectionId = surfaceDefinition?.shellAccess?.sectionId;
  const inferredSectionId = getFirstShellAccessSegment(rawSurfaceId);
  const sectionId =
    explicitSectionId ??
    surfaceDefinition?.navigationSection?.id ??
    (scopeMode === "navigation-section" ? inferredSectionId : undefined);
  const shouldUseSectionScope = Boolean(
    sectionId && (scopeMode === "navigation-section" || explicitSectionId),
  );

  if (!shouldUseSectionScope || !sectionId) {
    return getFallbackShellAccessTarget(
      appScopeId,
      surfaceDefinition?.shellAccess?.surfaceId ?? rawSurfaceId,
    );
  }

  const normalizedSectionId = normalizeShellAccessId(sectionId);
  const sectionScopeId = `${appScopeId}.${normalizedSectionId}`;
  const sectionRelativeSurfaceId = getSectionRelativeSurfaceId(
    surfaceDefinition?.shellAccess?.surfaceId ?? rawSurfaceId,
    normalizedSectionId,
  );
  const surfaceId = sectionRelativeSurfaceId
    ? `${normalizedSectionId}.${sectionRelativeSurfaceId}`
    : normalizedSectionId;

  return {
    appScopeId,
    sectionScopeId,
    surfaceId,
    surfaceKey: `${appScopeId}.${surfaceId}`,
  };
}

function resolveShellAccessTargetFromIds(appId: string, surfaceId: string) {
  const app = getAppById(appId);

  if (!app) {
    return getFallbackShellAccessTarget(appId, surfaceId);
  }

  return resolveShellAccessTarget(app, surfaceId);
}

export function getShellAppIdForSurface(appId: string, surfaceId: string) {
  const target = resolveShellAccessTargetFromIds(appId, surfaceId);

  return target.sectionScopeId ?? target.appScopeId;
}

export function getShellSurfaceIdForSurface(appId: string, surfaceId: string) {
  return resolveShellAccessTargetFromIds(appId, surfaceId).surfaceId;
}

export function getShellSurfaceKey(appId: string, surfaceId: string) {
  return resolveShellAccessTargetFromIds(appId, surfaceId).surfaceKey;
}

export function canAccessShellSurfaceKey(
  surfaceKey: string,
  shellAccess?: ShellAccess | null,
) {
  const normalizedSurfaceKey = normalizeShellAccessId(surfaceKey);
  const { appScopes } = normalizeShellAccess(shellAccess);

  return Array.from(appScopes).some((grantedScope) => {
    if (!grantedScope) {
      return false;
    }

    return (
      normalizedSurfaceKey === grantedScope ||
      normalizedSurfaceKey.startsWith(`${grantedScope}.`)
    );
  });
}

export function canAccessApp(app: AppDefinition, shellAccess?: ShellAccess | null) {
  const { appScopes } = normalizeShellAccess(shellAccess);
  const appScopeId = normalizeShellAccessId(app.shellAccess?.appScopeId ?? app.id);

  return Array.from(appScopes).some(
    (grantedScope) =>
      grantedScope === appScopeId || grantedScope.startsWith(`${appScopeId}.`),
  );
}

function canAccessShellTarget(
  target: ShellAccessTarget,
  shellAccess?: ShellAccess | null,
) {
  return canAccessShellSurfaceKey(target.surfaceKey, shellAccess);
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
  return (
    (options.includeHidden || !surface.hidden) &&
    canAccessShellTarget(resolveShellAccessTarget(app, surface), shellAccess)
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
  const derivedSurfaceEntries = getAccessibleSurfaceEntries(shellAccess);
  const accessibleSurfaceMap = new Map(
    derivedSurfaceEntries.map((surface) => [
      getSurfaceFavoriteId(surface.appId, surface.id),
      surface,
    ]),
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
