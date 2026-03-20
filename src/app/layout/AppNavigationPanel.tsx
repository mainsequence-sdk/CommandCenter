import { useLocation, useNavigate } from "react-router-dom";

import type { AppDefinition, AppSurfaceDefinition } from "@/apps/types";
import { getAppPath } from "@/apps/utils";
import { cn } from "@/lib/utils";

interface AppNavigationPanelProps {
  app: AppDefinition;
  surfaces: AppSurfaceDefinition[];
  onSelectSurface: () => void;
}

export function AppNavigationPanel({
  app,
  surfaces,
  onSelectSurface,
}: AppNavigationPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeSurfaceId = location.pathname.split("/").filter(Boolean)[2];

  return (
    <aside
      data-theme-chrome="sidebar"
      className="relative z-[91] flex h-screen max-h-screen w-[208px] shrink-0 flex-col border-r border-border/70 bg-sidebar/96 px-2 pt-1.5 pb-2 shadow-[var(--shadow-panel)] backdrop-blur"
    >
      <div className="border-b border-border/70 px-2 pb-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {app.title}
        </div>
      </div>

      <nav className="mt-1.5 flex min-h-0 flex-1 flex-col overflow-y-auto">
        {surfaces.map((surface, index) => {
          const isActive = activeSurfaceId === surface.id;
          const isLast = index === surfaces.length - 1;

          return (
            <button
              key={surface.id}
              type="button"
              onClick={() => {
                navigate(getAppPath(app.id, surface.id));
                onSelectSurface();
              }}
              className={
                cn(
                  "group relative block w-full rounded-[calc(var(--radius)-8px)] px-2 py-1.5 text-left text-sidebar-foreground/72 transition-colors hover:bg-sidebar-foreground/[0.04] hover:text-foreground",
                  isActive && "bg-sidebar-foreground/[0.06] text-foreground",
                )
              }
            >
              <div className="flex min-h-8 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {surface.navLabel ?? surface.title}
                </span>
                <span className="shrink-0 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {surface.kind}
                </span>
              </div>
              {!isLast ? (
                <span className="pointer-events-none absolute bottom-0 left-2 right-2 h-px bg-border/55" />
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
