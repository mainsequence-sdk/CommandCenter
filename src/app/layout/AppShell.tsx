import { useEffect } from "react";

import { Outlet, useLocation } from "react-router-dom";

import { getAppById, getAppSurfaceById } from "@/app/registry";
import { AppNavigationPanel } from "@/app/layout/AppNavigationPanel";
import { Sidebar } from "@/app/layout/Sidebar";
import { Topbar } from "@/app/layout/Topbar";
import {
  getAccessibleApps,
  getAccessibleSurfaces,
  getSurfaceNavigationGroups,
} from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import { env } from "@/config/env";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import { ChatMount, ChatOverlay, ChatProvider } from "../../../extensions/main_sequence_ai/assistant-ui";
import {
  CHAT_PAGE_PATH,
  CHAT_RAIL_WIDTH,
  useChatUiStore,
} from "../../../extensions/main_sequence_ai/assistant-ui/chat-ui-store";

function isWorkspaceCanvasRoute(pathname: string, search: string) {
  const routeSegments = pathname.split("/").filter(Boolean);

  if (routeSegments[1] !== "workspace-studio" || routeSegments[2] !== "workspaces") {
    return false;
  }

  const searchParams = new URLSearchParams(search);
  const workspaceId = searchParams.get("workspace");
  const view = searchParams.get("view");

  return (
    Boolean(workspaceId) &&
    view !== "settings" &&
    view !== "widget-settings" &&
    view !== "graph"
  );
}

export function AppShell() {
  const location = useLocation();
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const sidebarCollapsed = useShellStore((state) => state.sidebarCollapsed);
  const appPanelAppId = useShellStore((state) => state.appPanelAppId);
  const closeAppPanel = useShellStore((state) => state.closeAppPanel);
  const kioskMode = useShellStore((state) => state.kioskMode);
  const setKioskMode = useShellStore((state) => state.setKioskMode);
  const favoriteSurfaceIds = useShellStore((state) => state.favoriteSurfaceIds);
  const toggleSurfaceFavorite = useShellStore((state) => state.toggleSurfaceFavorite);
  const chatRailOpen = useChatUiStore((state) => state.railOpen);
  const chatRailMode = useChatUiStore((state) => state.railMode);
  const accessibleApps = getAccessibleApps(permissions);
  const panelApp =
    appPanelAppId && accessibleApps.some((candidate) => candidate.id === appPanelAppId)
      ? getAppById(appPanelAppId)
      : undefined;
  const panelAppSurfaces = panelApp ? getAccessibleSurfaces(panelApp, permissions) : [];
  const panelAppSurfaceGroups = getSurfaceNavigationGroups(panelAppSurfaces);
  const routeSegments = location.pathname.split("/").filter(Boolean);
  const routeApp = routeSegments[1] ? getAppById(routeSegments[1]) : undefined;
  const routeSurface =
    routeApp && routeSegments[2] ? getAppSurfaceById(routeApp.id, routeSegments[2]) : undefined;
  const widgetCatalogRoute =
    routeSegments[1] === "workspace-studio" &&
    routeSegments[2] === "widget-catalog";
  const workspaceCanvasRoute = isWorkspaceCanvasRoute(location.pathname, location.search);
  const kioskEligibleRoute =
    routeSurface?.kind === "dashboard" ||
    workspaceCanvasRoute;
  const fullBleedSurface = Boolean(routeSurface?.fullBleed) || workspaceCanvasRoute;
  const showAppPanel = !kioskMode && Boolean(panelApp && panelAppSurfaceGroups.length > 0);
  const sidebarWidth = kioskMode ? 0 : sidebarCollapsed ? 52 : 248;
  const routePathKey = location.pathname;
  const showDockedChatRail =
    env.includeAui &&
    location.pathname !== CHAT_PAGE_PATH &&
    chatRailOpen &&
    chatRailMode === "docked";

  useEffect(() => {
    if (!kioskMode) {
      return;
    }

    closeAppPanel();
  }, [closeAppPanel, kioskMode]);

  useEffect(() => {
    closeAppPanel();
  }, [closeAppPanel, routePathKey]);

  useEffect(() => {
    if (kioskMode && !kioskEligibleRoute) {
      setKioskMode(false);
    }
  }, [kioskEligibleRoute, kioskMode, setKioskMode]);

  useEffect(() => {
    if (!showAppPanel) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;

      if (!target) {
        return;
      }

      if (
        target.closest("[data-app-navigation-panel]") ||
        target.closest("[data-shell-sidebar]")
      ) {
        return;
      }

      closeAppPanel();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAppPanel();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeAppPanel, showAppPanel]);

  useEffect(() => {
    if (!kioskMode) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setKioskMode(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [kioskMode, setKioskMode]);

  const shell = (
    <div className="relative h-screen overflow-hidden bg-background text-foreground">
      <div
        className="grid h-full overflow-hidden transition-[grid-template-columns] duration-200 ease-out"
        style={{
          gridTemplateColumns: kioskMode
            ? showDockedChatRail
              ? `minmax(0, 1fr) ${CHAT_RAIL_WIDTH}px`
              : "minmax(0, 1fr)"
            : showDockedChatRail
              ? `${sidebarWidth}px minmax(0, 1fr) ${CHAT_RAIL_WIDTH}px`
              : `${sidebarWidth}px minmax(0, 1fr)`,
        }}
      >
        {!kioskMode ? <Sidebar /> : null}
        <div
          className={cn(
            "grid min-h-0 min-w-0",
            kioskMode ? "grid-rows-[1fr]" : "grid-rows-[56px_1fr]",
          )}
        >
          {!kioskMode ? <Topbar /> : null}
          <main
            className={cn(
              "min-h-0",
              fullBleedSurface
                ? widgetCatalogRoute
                  ? "overflow-auto p-0"
                  : "overflow-hidden p-0"
                : kioskMode
                  ? "overflow-auto px-3 py-3 md:px-4 md:py-4"
                  : "overflow-auto px-2 py-3 md:px-3 md:py-4",
            )}
          >
            <div
              className={cn(
                "w-full",
                fullBleedSurface
                  ? widgetCatalogRoute
                    ? "min-h-full"
                    : "h-full"
                  : undefined,
              )}
            >
              <Outlet />
            </div>
          </main>
        </div>
        {showDockedChatRail ? <ChatOverlay mode="docked" /> : null}
      </div>

      {showAppPanel && panelApp ? (
        <div
          className="fixed inset-y-0 z-[90]"
          style={{ left: sidebarWidth }}
        >
          <AppNavigationPanel
            app={panelApp}
            groups={panelAppSurfaceGroups}
            favoriteSurfaceIds={favoriteSurfaceIds}
            onSelectSurface={closeAppPanel}
            onToggleFavorite={toggleSurfaceFavorite}
          />
        </div>
      ) : null}

      {env.includeAui ? <ChatMount /> : null}
    </div>
  );

  return env.includeAui ? <ChatProvider>{shell}</ChatProvider> : shell;
}
