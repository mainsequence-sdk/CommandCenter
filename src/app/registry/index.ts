import type { AppExtension, AppRegistry } from "@/app/registry/types";
import type { AppSurfaceEntry } from "@/apps/types";
import { env } from "@/config/env";

const internalModules = import.meta.glob(
  ["../../extensions/*/index.ts", "../../extensions/*/extensions/*/index.ts"],
  { eager: true },
);
const externalModules = import.meta.glob(
  ["../../../extensions/*/index.ts", "../../../extensions/*/extensions/*/index.ts"],
  { eager: true },
);
const modules = { ...internalModules, ...externalModules };

function uniqueById<T extends { id: string }>(items: T[]) {
  const map = new Map<string, T>();

  items.forEach((item) => {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  });

  return [...map.values()];
}

const extensions = Object.values(modules)
  .map((module) => (module as { default?: AppExtension }).default)
  .filter((module): module is AppExtension => Boolean(module));

const widgets = uniqueById(extensions.flatMap((extension) => extension.widgets ?? []));
const apps = uniqueById(extensions.flatMap((extension) => extension.apps ?? [])).filter((app) => {
  if (!env.includeWorkspaces && app.id === "workspace-studio") {
    return false;
  }

  return true;
});
const surfaces = apps.flatMap<AppSurfaceEntry>((app) =>
  app.surfaces.map((surface) => ({
    ...surface,
    appId: app.id,
    appTitle: app.title,
    appDescription: app.description,
    appSource: app.source,
    appIcon: app.icon,
    appRequiredPermissions: app.requiredPermissions,
  })),
);
const dashboards = surfaces
  .filter((surface) => surface.kind === "dashboard")
  .map((surface) => surface.dashboard);

export const appRegistry: AppRegistry = {
  extensions,
  widgets,
  apps,
  surfaces,
  dashboards,
  themes: uniqueById(extensions.flatMap((extension) => extension.themes ?? [])),
};

export function getWidgetById(id: string) {
  return appRegistry.widgets.find((widget) => widget.id === id);
}

export function getAppById(id: string) {
  return appRegistry.apps.find((app) => app.id === id);
}

export function getAppSurfaceById(appId: string, surfaceId: string) {
  return getAppById(appId)?.surfaces.find((surface) => surface.id === surfaceId);
}

export function getDashboardSurfaceByDashboardId(dashboardId: string) {
  return appRegistry.surfaces.find(
    (surface) => surface.kind === "dashboard" && surface.dashboard.id === dashboardId,
  );
}

export function getSurfaceById(surfaceId: string) {
  return appRegistry.surfaces.find((surface) => surface.id === surfaceId);
}
