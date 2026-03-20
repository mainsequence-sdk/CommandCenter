import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Command, Search, ShieldCheck } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { getAppById, getAppSurfaceById } from "@/app/registry";
import {
  getAccessibleAdminMenuApps,
  getAccessibleApps,
  getAccessiblePrimaryApps,
  getAccessibleSurfaceEntries,
  getAccessibleSurfaces,
  getAppPath,
  getDefaultSurface,
  getSurfacePath,
} from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import { hasAnyPermission } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { env } from "@/config/env";
import { useShellStore } from "@/stores/shell-store";
import { AdminMenu } from "./AdminMenu";
import { AppSurfaceSelector } from "./AppSurfaceSelector";
import { AppDetailsDialog } from "./AppDetailsDialog";
import { NotificationsMenu } from "./NotificationsMenu";
import { SettingsDialog } from "./SettingsDialog";

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

  const user = useAuthStore((state) => state.session?.user);
  const permissions = user?.permissions ?? [];
  const commandValue = useShellStore((state) => state.commandValue);
  const setCommandValue = useShellStore((state) => state.setCommandValue);
  const isAdmin = user?.role === "admin";
  const accessExplorerAllowed = hasAnyPermission(permissions, ["rbac:view"]);

  const accessibleApps = getAccessibleApps(permissions);
  const searchableApps = getAccessiblePrimaryApps(permissions);
  const searchableAppIds = new Set(searchableApps.map((app) => app.id));
  const adminMenuApps = getAccessibleAdminMenuApps(permissions);
  const accessibleSurfaces = getAccessibleSurfaceEntries(permissions);
  const searchableSurfaces = accessibleSurfaces.filter((surface) =>
    searchableAppIds.has(surface.appId),
  );
  const currentApp = params.appId ? getAppById(params.appId) : undefined;
  const currentSurface =
    currentApp && params.surfaceId ? getAppSurfaceById(currentApp.id, params.surfaceId) : undefined;
  const currentAppVisible =
    currentApp && accessibleApps.some((app) => app.id === currentApp.id) ? currentApp : undefined;
  const currentAppSurfaces = currentAppVisible
    ? getAccessibleSurfaces(currentAppVisible, permissions)
    : [];
  const currentDefaultSurface = currentAppVisible
    ? getDefaultSurface(currentAppVisible, permissions)
    : undefined;
  const currentSurfaceVisible =
    currentAppVisible &&
    currentSurface &&
    currentAppSurfaces.some((surface) => surface.id === currentSurface.id)
      ? currentSurface
      : undefined;
  const selectedSurfaceId = currentSurfaceVisible?.id ?? currentDefaultSurface?.id ?? "";
  const surfaceGroups = [
    {
      label: "Dashboards",
      surfaces: currentAppSurfaces.filter((surface) => surface.kind === "dashboard"),
    },
    {
      label: "Pages",
      surfaces: currentAppSurfaces.filter((surface) => surface.kind === "page"),
    },
    {
      label: "Tools",
      surfaces: currentAppSurfaces.filter((surface) => surface.kind === "tool"),
    },
  ].filter((group) => group.surfaces.length > 0);

  const normalizedQuery = commandValue.trim().toLowerCase();
  const searchItems = [
    ...searchableApps.map((app) => ({
      title: app.title,
      subtitle: t("searchResults.openAppSubtitle"),
      to: getAppPath(app.id),
      visible: true,
    })),
    ...searchableSurfaces.map((surface) => ({
      title: `${surface.appTitle} / ${surface.navLabel ?? surface.title}`,
      subtitle:
        surface.kind === "tool"
          ? t("searchResults.openToolSubtitle")
          : surface.kind === "page"
            ? t("searchResults.openPageSubtitle")
            : t("searchResults.openDashboardSubtitle"),
      to: getSurfacePath(surface),
      visible: true,
    })),
    {
      title: t("searchResults.widgetCatalogTitle"),
      subtitle: t("searchResults.widgetCatalogSubtitle"),
      to: "/app/widgets",
      visible: hasAnyPermission(permissions, ["widget.catalog:view"]),
    },
    {
      title: t("searchResults.accessControlTitle"),
      subtitle: t("searchResults.accessControlSubtitle"),
      to: "/app/access",
      visible: hasAnyPermission(permissions, ["rbac:view"]),
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
    ...(accessExplorerAllowed
      ? [
          {
            icon: ShieldCheck,
            label: t("searchResults.accessControlTitle"),
            onSelect: () => {
              navigate("/app/access");
            },
          },
        ]
      : []),
  ];

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
            {currentAppSurfaces.length ? (
              <AppSurfaceSelector
                value={selectedSurfaceId}
                groups={surfaceGroups}
                onSelect={(surfaceId) => {
                  navigate(getAppPath(currentAppVisible.id, surfaceId));
                }}
              />
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
            className="pl-9"
          />
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

        <button
          type="button"
          className="rounded-md border border-border/80 bg-card/70 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
          title={t("topbar.searchShortcutTitle")}
          aria-label={t("topbar.searchShortcutTitle")}
          onClick={() => {
            setSearchPaletteMode(true);
            setSearchOpen(true);
            searchRef.current?.focus();
            searchRef.current?.select();
          }}
        >
          <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded border border-border bg-muted/70 text-[10px] text-foreground">
            <Command className="h-2.5 w-2.5" />
          </span>
          K
        </button>

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
