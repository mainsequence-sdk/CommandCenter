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
import {
  ChatMount,
  ChatOverlay,
  ChatProvider,
  ProjectAgentChatMount,
} from "../../../extensions/main_sequence_ai/assistant-ui";
import {
  CHAT_PAGE_PATH,
  CHAT_RAIL_WIDTH,
  useChatUiStore,
} from "../../../extensions/main_sequence_ai/assistant-ui/chat-ui-store";
import { useProjectAgentRailStore } from "../../../extensions/main_sequence_ai/assistant-ui/project-agent-rail-store";

const WORKSPACE_CANVAS_SURFACE_IDS = new Set(["workspaces", "slide-studio"]);

function isWorkspaceCanvasRoute(pathname: string, search: string) {
  const routeSegments = pathname.split("/").filter(Boolean);
  const surfaceId = routeSegments[2];

  if (
    routeSegments[1] !== "workspace-studio" ||
    !surfaceId ||
    !WORKSPACE_CANVAS_SURFACE_IDS.has(surfaceId)
  ) {
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

function isWorkspacePublicPreviewRoute(pathname: string, search: string) {
  const routeSegments = pathname.split("/").filter(Boolean);
  const surfaceId = routeSegments[2];

  if (
    routeSegments[1] !== "workspace-studio" ||
    !surfaceId ||
    !WORKSPACE_CANVAS_SURFACE_IDS.has(surfaceId)
  ) {
    return false;
  }

  const searchParams = new URLSearchParams(search);

  return Boolean(searchParams.get("workspace")) && searchParams.get("mode") === "public-preview";
}

function isWorkspacePrintRoute(pathname: string, search: string) {
  const routeSegments = pathname.split("/").filter(Boolean);
  const surfaceId = routeSegments[2];

  if (
    routeSegments[1] !== "workspace-studio" ||
    !surfaceId ||
    !WORKSPACE_CANVAS_SURFACE_IDS.has(surfaceId)
  ) {
    return false;
  }

  const searchParams = new URLSearchParams(search);

  return Boolean(searchParams.get("workspace")) && searchParams.get("mode") === "print";
}

export function AppShell() {
  const location = useLocation();
  const shellAccess = useAuthStore((state) => state.session?.user.shellAccess);
  const sidebarCollapsed = useShellStore((state) => state.sidebarCollapsed);
  const appPanelAppId = useShellStore((state) => state.appPanelAppId);
  const closeAppPanel = useShellStore((state) => state.closeAppPanel);
  const kioskMode = useShellStore((state) => state.kioskMode);
  const setKioskMode = useShellStore((state) => state.setKioskMode);
  const favoriteSurfaceIds = useShellStore((state) => state.favoriteSurfaceIds);
  const toggleSurfaceFavorite = useShellStore((state) => state.toggleSurfaceFavorite);
  const chatRailOpen = useChatUiStore((state) => state.railOpen);
  const chatRailMode = useChatUiStore((state) => state.railMode);
  const projectAgentRailOpen = useProjectAgentRailStore((state) => state.railOpen);
  const projectAgentRailMode = useProjectAgentRailStore((state) => state.railMode);
  const accessibleApps = getAccessibleApps(shellAccess);
  const panelApp =
    appPanelAppId && accessibleApps.some((candidate) => candidate.id === appPanelAppId)
      ? getAppById(appPanelAppId)
      : undefined;
  const panelAppSurfaces = panelApp ? getAccessibleSurfaces(panelApp, shellAccess) : [];
  const panelAppSurfaceGroups = getSurfaceNavigationGroups(panelAppSurfaces);
  const routeSegments = location.pathname.split("/").filter(Boolean);
  const routeApp = routeSegments[1] ? getAppById(routeSegments[1]) : undefined;
  const routeSurface =
    routeApp && routeSegments[2] ? getAppSurfaceById(routeApp.id, routeSegments[2]) : undefined;
  const settingsRoute = routeSegments[1] === "settings";
  const widgetCatalogRoute =
    routeSegments[1] === "workspace-studio" &&
    routeSegments[2] === "widget-catalog";
  const workspaceCanvasRoute = isWorkspaceCanvasRoute(location.pathname, location.search);
  const workspacePublicPreviewRoute = isWorkspacePublicPreviewRoute(location.pathname, location.search);
  const workspacePrintRoute = isWorkspacePrintRoute(location.pathname, location.search);
  const kioskEligibleRoute =
    routeSurface?.kind === "dashboard" ||
    workspaceCanvasRoute;
  const shelllessRoute = kioskMode || workspacePublicPreviewRoute || workspacePrintRoute;
  const fullBleedSurface =
    settingsRoute ||
    Boolean(routeSurface?.fullBleed) ||
    workspaceCanvasRoute ||
    workspacePublicPreviewRoute ||
    workspacePrintRoute;
  const showAppPanel = !shelllessRoute && Boolean(panelApp && panelAppSurfaceGroups.length > 0);
  const sidebarWidth = shelllessRoute ? 0 : sidebarCollapsed ? 52 : 248;
  const routePathKey = location.pathname;
  const showDockedChatRail =
    env.includeAui &&
    !workspacePublicPreviewRoute &&
    !workspacePrintRoute &&
    location.pathname !== CHAT_PAGE_PATH &&
    chatRailOpen &&
    chatRailMode === "docked";
  const showDockedProjectAgentRail =
    env.includeAui &&
    !workspacePublicPreviewRoute &&
    !workspacePrintRoute &&
    location.pathname !== CHAT_PAGE_PATH &&
    projectAgentRailOpen &&
    projectAgentRailMode === "docked";
  const dockedRailCount =
    (showDockedChatRail ? 1 : 0) + (showDockedProjectAgentRail ? 1 : 0);

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
    <div
      className={cn(
        "relative bg-background text-foreground",
        workspacePrintRoute ? "min-h-screen overflow-visible" : "h-screen overflow-hidden",
      )}
    >
      <div
        className={cn(
          "grid transition-[grid-template-columns] duration-200 ease-out",
          workspacePrintRoute ? "min-h-screen overflow-visible" : "h-full overflow-hidden",
        )}
        style={{
          gridTemplateColumns: shelllessRoute
            ? dockedRailCount > 0
              ? `minmax(0, 1fr)${showDockedChatRail ? ` ${CHAT_RAIL_WIDTH}px` : ""}${showDockedProjectAgentRail ? ` ${CHAT_RAIL_WIDTH}px` : ""}`
              : "minmax(0, 1fr)"
            : dockedRailCount > 0
              ? `${sidebarWidth}px minmax(0, 1fr)${showDockedChatRail ? ` ${CHAT_RAIL_WIDTH}px` : ""}${showDockedProjectAgentRail ? ` ${CHAT_RAIL_WIDTH}px` : ""}`
              : `${sidebarWidth}px minmax(0, 1fr)`,
        }}
      >
        {!shelllessRoute ? <Sidebar /> : null}
        <div
          className={cn(
            "grid min-w-0",
            workspacePrintRoute ? "min-h-screen" : "min-h-0",
            shelllessRoute ? "grid-rows-[1fr]" : "grid-rows-[56px_1fr]",
          )}
        >
          {!shelllessRoute ? <Topbar /> : null}
          <main
            className={cn(
              workspacePrintRoute ? "min-h-screen overflow-visible p-0" : "min-h-0",
              !workspacePrintRoute
                ? fullBleedSurface
                  ? widgetCatalogRoute
                    ? "overflow-auto p-0"
                    : "overflow-hidden p-0"
                  : shelllessRoute
                    ? "overflow-auto px-3 py-3 md:px-4 md:py-4"
                    : "overflow-auto px-2 py-3 md:px-3 md:py-4"
                : undefined,
            )}
          >
            <div
              className={cn(
                "w-full",
                workspacePrintRoute
                  ? "min-h-screen"
                  : fullBleedSurface
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
        {showDockedProjectAgentRail ? <ProjectAgentChatMount mode="docked" /> : null}
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
      {env.includeAui ? <ProjectAgentChatMount /> : null}
    </div>
  );

  return env.includeAui ? <ChatProvider>{shell}</ChatProvider> : shell;
}
