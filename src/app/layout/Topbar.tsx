import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Rows3, Search, ShieldCheck } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { getAppById, getAppSurfaceById } from "@/app/registry";
import {
  getAccessibleAdminMenuApps,
  getAccessibleApps,
  getFavoriteSurfaceEntries,
  getAccessibleSurfaceEntries,
  getAccessibleSurfaces,
  getAppPath,
  getDefaultSurface,
  getSurfaceFavoriteId,
  getSurfaceNavigationGroups,
  getSurfacePath,
} from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import { hasAnyPermission } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { env } from "@/config/env";
import { useShellStore } from "@/stores/shell-store";
import { useCustomWorkspaceStudioStore } from "@/features/dashboards/custom-workspace-studio-store";
import {
  getFavoriteWorkspaceEntries,
  isWorkspaceFavoriteId,
} from "@/features/dashboards/workspace-favorites";
import { AdminMenu } from "./AdminMenu";
import { AppSurfaceSelector } from "./AppSurfaceSelector";
import { AppDetailsDialog } from "./AppDetailsDialog";
import { FavoriteSurfacesMenu, type FavoriteMenuItem } from "./FavoriteSurfacesMenu";
import { NotificationsMenu } from "./NotificationsMenu";
import { SettingsDialog } from "./SettingsDialog";
import { ThemeMenu } from "./ThemeMenu";

export function Topbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);
  const [adminSettingsOpen, setAdminSettingsOpen] = useState(false);
  const [appDetailsOpen, setAppDetailsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchPaletteMode, setSearchPaletteMode] = useState(false);
  const [searchPanelStyle, setSearchPanelStyle] = useState<CSSProperties>();
  const searchShortcutHint =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
      ? "⌘K"
      : "Ctrl K";

  const user = useAuthStore((state) => state.session?.user);
  const permissions = user?.permissions ?? [];
  const commandValue = useShellStore((state) => state.commandValue);
  const favoriteSurfaceIds = useShellStore((state) => state.favoriteSurfaceIds);
  const favoriteWorkspaceIds = useShellStore((state) => state.favoriteWorkspaceIds);
  const setCommandValue = useShellStore((state) => state.setCommandValue);
  const toggleSurfaceFavorite = useShellStore((state) => state.toggleSurfaceFavorite);
  const toggleWorkspaceFavorite = useShellStore((state) => state.toggleWorkspaceFavorite);
  const workspaceCanvasMenuHidden = useShellStore((state) => state.workspaceCanvasMenuHidden);
  const setWorkspaceCanvasMenuHidden = useShellStore((state) => state.setWorkspaceCanvasMenuHidden);
  const initializeWorkspaceStudio = useCustomWorkspaceStudioStore((state) => state.initialize);
  const workspaceDraftCollection = useCustomWorkspaceStudioStore((state) => state.draftCollection);
  const isAdmin = user?.role === "admin";

  const accessibleApps = getAccessibleApps(permissions);
  const adminMenuApps = getAccessibleAdminMenuApps(permissions);
  const accessibleSurfaces = getAccessibleSurfaceEntries(permissions);
  const favoriteSurfaces = getFavoriteSurfaceEntries(permissions, favoriteSurfaceIds);
  const favoriteWorkspaces = getFavoriteWorkspaceEntries(
    workspaceDraftCollection.dashboards,
    favoriteWorkspaceIds,
  );
  const favoriteMenuItems = useMemo<FavoriteMenuItem[]>(
    () => [
      ...favoriteWorkspaces.map((workspace) => ({
        id: workspace.id,
        favoriteId: workspace.favoriteId,
        groupId: workspace.appId,
        groupLabel: workspace.appTitle,
        title: workspace.title,
        kindLabel: workspace.kindLabel,
        path: workspace.path,
      })),
      ...favoriteSurfaces.map((surface) => ({
        id: surface.id,
        favoriteId: getSurfaceFavoriteId(surface.appId, surface.id),
        groupId: surface.appId,
        groupLabel: surface.appTitle,
        title: surface.navLabel ?? surface.title,
        kindLabel: surface.kind,
        path: getSurfacePath(surface),
      })),
    ],
    [favoriteSurfaces, favoriteWorkspaces],
  );
  const currentApp = params.appId ? getAppById(params.appId) : undefined;
  const currentSurface =
    currentApp && params.surfaceId ? getAppSurfaceById(currentApp.id, params.surfaceId) : undefined;
  const currentAppVisible =
    currentApp && accessibleApps.some((app) => app.id === currentApp.id) ? currentApp : undefined;
  const currentAppSurfaces = currentAppVisible
    ? getAccessibleSurfaces(currentAppVisible, permissions)
    : [];
  const currentAppSurfaceGroups = getSurfaceNavigationGroups(currentAppSurfaces);
  const currentDefaultSurface = currentAppVisible
    ? getDefaultSurface(currentAppVisible, permissions)
    : undefined;
  const currentSurfaceVisible =
    currentAppVisible &&
    currentSurface &&
    currentAppSurfaces.some((surface) => surface.id === currentSurface.id)
      ? currentSurface
      : undefined;
  const showWorkspaceCanvasMenuRestore =
    params.appId === "workspace-studio" &&
    params.surfaceId === "workspaces" &&
    Boolean(new URLSearchParams(location.search).get("workspace")) &&
    new URLSearchParams(location.search).get("view") !== "settings" &&
    workspaceCanvasMenuHidden;
  const selectedSurfaceId = currentSurfaceVisible?.id ?? currentDefaultSurface?.id ?? "";
  const normalizedQuery = commandValue.trim().toLowerCase();
  const searchItems = [
    ...accessibleApps.map((app) => ({
      title: app.title,
      subtitle: t("searchResults.openAppSubtitle"),
      to: getAppPath(app.id),
      visible: true,
    })),
    ...accessibleSurfaces.map((surface) => ({
      title: `${surface.appTitle} / ${surface.navLabel ?? surface.title}`,
      subtitle: t("searchResults.openSurfaceSubtitle"),
      to: getSurfacePath(surface),
      visible: true,
    })),
    {
      title: t("searchResults.widgetCatalogTitle"),
      subtitle: t("searchResults.widgetCatalogSubtitle"),
      to: "/app/widgets",
      visible: hasAnyPermission(permissions, ["widget.catalog:view"]),
    },
  ].filter((item) => item.visible ?? true);

  const filteredSearchItems = searchItems
    .filter((item) =>
      !normalizedQuery
        ? true
        : `${item.title} ${item.subtitle}`.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 8);
  const showSearchPanel = searchOpen && (searchPaletteMode || normalizedQuery.length > 0);
  const adminMenuActions = [
    ...adminMenuApps.map((app) => ({
      icon: app.icon,
      label: app.title,
      onSelect: () => {
        navigate(getAppPath(app.id));
      },
    })),
  ];

  useEffect(() => {
    void initializeWorkspaceStudio(user?.id ?? null);
  }, [initializeWorkspaceStudio, user?.id]);

  useEffect(() => {
    function focusSearch() {
      setSearchPaletteMode(true);
      setSearchOpen(true);
      searchRef.current?.focus();
      searchRef.current?.select();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setSearchPaletteMode(false);
        searchRef.current?.blur();
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;

      if (
        !searchContainerRef.current?.contains(target) &&
        !searchPanelRef.current?.contains(target)
      ) {
        setSearchOpen(false);
        setSearchPaletteMode(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClick);
    };
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setSearchPaletteMode(false);
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!showSearchPanel) {
      setSearchPanelStyle(undefined);
      return undefined;
    }

    let frameId = 0;

    function updateSearchPanelPosition() {
      const containerRect = searchContainerRef.current?.getBoundingClientRect();

      if (!containerRect) {
        return;
      }

      const viewportPadding = 12;
      const maxWidth = Math.min(containerRect.width, window.innerWidth - viewportPadding * 2);
      const left = Math.max(
        viewportPadding,
        Math.min(containerRect.left, window.innerWidth - maxWidth - viewportPadding),
      );
      const top = containerRect.bottom + 8;

      setSearchPanelStyle({
        left,
        top,
        width: maxWidth,
      });
    }

    updateSearchPanelPosition();
    frameId = window.requestAnimationFrame(updateSearchPanelPosition);

    window.addEventListener("resize", updateSearchPanelPosition);
    window.addEventListener("scroll", updateSearchPanelPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateSearchPanelPosition);
      window.removeEventListener("scroll", updateSearchPanelPosition, true);
    };
  }, [showSearchPanel]);

  const CurrentAppIcon = currentAppVisible?.icon;

  return (
    <header
      data-theme-chrome="topbar"
      className="flex h-14 items-center justify-between gap-4 border-b border-border/80 bg-topbar/95 px-4 backdrop-blur md:px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        {currentAppVisible && CurrentAppIcon ? (
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 min-w-0 px-2.5 text-topbar-foreground"
              onClick={() => {
                setAppDetailsOpen(true);
              }}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/65 text-topbar-foreground">
                <CurrentAppIcon className="h-4 w-4" />
              </span>
              <span className="truncate">{currentAppVisible.title}</span>
            </Button>
            {currentAppSurfaces.length && currentAppVisible.topNavigationStyle !== "hidden" ? (
              <AppSurfaceSelector
                appId={currentAppVisible.id}
                favoriteSurfaceIds={favoriteSurfaceIds}
                value={selectedSurfaceId}
                groups={currentAppSurfaceGroups}
                onToggleFavorite={toggleSurfaceFavorite}
                onSelect={(surfaceId) => {
                  navigate(getAppPath(currentAppVisible.id, surfaceId));
                }}
              />
            ) : null}
            {showWorkspaceCanvasMenuRestore ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Show dashboard menu"
                title="Show dashboard menu"
                className="relative h-9 w-9 px-0 text-topbar-foreground"
                onClick={() => {
                  setWorkspaceCanvasMenuHidden(false);
                }}
              >
                <span className="absolute inset-0 rounded-full border border-primary/28 bg-primary/8 animate-[pulse_2.2s_ease-in-out_infinite]" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary/90 animate-pulse" />
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/72 text-topbar-foreground shadow-sm">
                  <Rows3 className="h-4 w-4" />
                </span>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="hidden min-w-0 flex-1 md:block">
        <div ref={searchContainerRef} className="relative mx-auto max-w-[760px] xl:max-w-[880px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={commandValue}
            onFocus={() => {
              if (normalizedQuery.length > 0) {
                setSearchOpen(true);
              }
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              setCommandValue(nextValue);
              setSearchOpen(searchPaletteMode || nextValue.trim().length > 0);
            }}
            placeholder={t("topbar.searchPlaceholder")}
            className="pl-9 pr-16"
            title={t("topbar.searchShortcutTitle")}
          />
          <span
            className="pointer-events-none absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center rounded-md border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            title={t("topbar.searchShortcutTitle")}
            aria-hidden="true"
          >
            {searchShortcutHint}
          </span>
          {showSearchPanel && typeof document !== "undefined"
            ? createPortal(
                <div
                  ref={searchPanelRef}
                  style={searchPanelStyle}
                  className="fixed z-[170] overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 shadow-[var(--shadow-panel)] backdrop-blur"
                >
              <div className="border-b border-border/70 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {normalizedQuery ? t("topbar.matchingResults") : t("topbar.suggestedSearch")}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {normalizedQuery
                    ? t("topbar.mockedResultsDescription")
                    : t("topbar.quickEntryDescription")}
                </div>
              </div>
              <div className="max-h-[min(60vh,520px)] overflow-y-auto p-2">
                {filteredSearchItems.length ? (
                  filteredSearchItems.map((item) => (
                    <button
                      key={`${item.to}-${item.title}`}
                      type="button"
                      className="flex w-full flex-col items-start rounded-[calc(var(--radius)-6px)] px-3 py-2.5 text-left transition-colors hover:bg-muted/45"
                      onClick={() => {
                        navigate(item.to);
                        setSearchOpen(false);
                        setSearchPaletteMode(false);
                      }}
                    >
                      <div className="text-sm font-medium text-topbar-foreground">
                        {item.title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {item.subtitle}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[calc(var(--radius)-6px)] px-3 py-4">
                    <div className="text-sm font-medium text-topbar-foreground">
                      {t("topbar.noMatchingResults")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t("topbar.noMatchingResultsSubtitle")}
                    </div>
                  </div>
                )}
              </div>
                </div>,
                document.body,
              )
            : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="neutral">
          {env.useMockData ? t("topbar.dataModeMock") : t("topbar.dataModeLive")}
        </Badge>

        <FavoriteSurfacesMenu
          items={favoriteMenuItems}
          onSelect={(path) => {
            navigate(path);
          }}
          onToggleFavorite={(favoriteId) => {
            if (isWorkspaceFavoriteId(favoriteId)) {
              toggleWorkspaceFavorite(favoriteId);
              return;
            }

            toggleSurfaceFavorite(favoriteId);
          }}
        />

        <ThemeMenu />

        <NotificationsMenu />

        {isAdmin ? (
          <>
            <AdminMenu
              actions={adminMenuActions}
              align="end"
              placement="bottom"
              settingsLabel={t("userMenu.adminSettings")}
              triggerLabel={t("userMenu.openAdmin")}
              triggerClassName="min-w-0 gap-2 rounded-md border border-border/80 bg-card/70 px-3 py-1.5 text-left text-topbar-foreground transition-colors hover:bg-muted/50"
              triggerContent={
                <>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t("userMenu.admin")}</span>
                </>
              }
              onOpenSettings={() => {
                setAdminSettingsOpen(true);
              }}
            />
            <SettingsDialog
              mode="admin"
              open={adminSettingsOpen}
              user={user ?? undefined}
              onClose={() => {
                setAdminSettingsOpen(false);
              }}
            />
          </>
        ) : null}
      </div>

      {currentAppVisible ? (
        <AppDetailsDialog
          app={currentAppVisible}
          open={appDetailsOpen}
          onClose={() => {
            setAppDetailsOpen(false);
          }}
          surfaces={currentAppSurfaces}
        />
      ) : null}
    </header>
  );
}
