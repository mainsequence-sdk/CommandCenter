import { useEffect } from "react";

import { Outlet, useLocation } from "react-router-dom";

import { getAppById, getAppSurfaceById } from "@/app/registry";
import { AppNavigationPanel } from "@/app/layout/AppNavigationPanel";
import { Sidebar } from "@/app/layout/Sidebar";
import { Topbar } from "@/app/layout/Topbar";
import { getAccessibleApps, getAccessibleSurfaces } from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import { terminalSocket } from "@/data/terminal-socket";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";

export function AppShell() {
  const location = useLocation();
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const setLiveState = useShellStore((state) => state.setLiveState);
  const sidebarCollapsed = useShellStore((state) => state.sidebarCollapsed);
  const appPanelAppId = useShellStore((state) => state.appPanelAppId);
  const closeAppPanel = useShellStore((state) => state.closeAppPanel);
  const kioskMode = useShellStore((state) => state.kioskMode);
  const setKioskMode = useShellStore((state) => state.setKioskMode);
  const accessibleApps = getAccessibleApps(permissions);
  const panelApp =
    appPanelAppId && accessibleApps.some((candidate) => candidate.id === appPanelAppId)
      ? getAppById(appPanelAppId)
      : undefined;
  const panelAppSurfaces = panelApp ? getAccessibleSurfaces(panelApp, permissions) : [];
  const routeSegments = location.pathname.split("/").filter(Boolean);
  const routeApp = routeSegments[1] ? getAppById(routeSegments[1]) : undefined;
  const routeSurface =
    routeApp && routeSegments[2] ? getAppSurfaceById(routeApp.id, routeSegments[2]) : undefined;
  const fullBleedSurface = Boolean(routeSurface?.fullBleed) && !kioskMode;
  const showAppPanel = !kioskMode && Boolean(panelApp && panelAppSurfaces.length > 0);
  const sidebarWidth = kioskMode ? 0 : sidebarCollapsed ? 52 : 248;
  const routePathKey = location.pathname;

  useEffect(() => {
    const unsubscribe = terminalSocket.onStatusChange((state) => {
      setLiveState(state);
    });

    void terminalSocket.connect();

    return () => {
      unsubscribe();
      terminalSocket.disconnect();
    };
  }, [setLiveState]);

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
    if (kioskMode && routeSurface?.kind !== "dashboard") {
      setKioskMode(false);
    }
  }, [kioskMode, routeSurface?.kind, setKioskMode]);

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

  return (
    <div className="relative h-screen overflow-hidden bg-background text-foreground">
      <div
        className="grid h-full overflow-hidden transition-[grid-template-columns] duration-200 ease-out"
        style={{
          gridTemplateColumns: kioskMode ? "minmax(0, 1fr)" : `${sidebarWidth}px minmax(0, 1fr)`,
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
              kioskMode
                ? "overflow-auto px-3 py-3 md:px-4 md:py-4"
                : fullBleedSurface
                  ? "overflow-hidden p-0"
                  : "overflow-auto px-2 py-3 md:px-3 md:py-4",
            )}
          >
            <div className={cn("w-full", fullBleedSurface ? "h-full" : undefined)}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {showAppPanel && panelApp ? (
        <div
          className="fixed inset-y-0 z-[90]"
          style={{ left: sidebarWidth }}
        >
          <AppNavigationPanel
            app={panelApp}
            surfaces={panelAppSurfaces}
            onSelectSurface={closeAppPanel}
          />
        </div>
      ) : null}
    </div>
  );
}
