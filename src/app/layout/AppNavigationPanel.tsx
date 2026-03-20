import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import type { AppDefinition, AppSurfaceNavigationGroup } from "@/apps/types";
import { getAppPath, getSurfaceFavoriteId, isSurfaceFavorited } from "@/apps/utils";
import { cn } from "@/lib/utils";
import { SurfaceFavoriteButton } from "./SurfaceFavoriteButton";

interface AppNavigationPanelProps {
  app: AppDefinition;
  groups: AppSurfaceNavigationGroup[];
  favoriteSurfaceIds: string[];
  onSelectSurface: () => void;
  onToggleFavorite: (favoriteId: string) => void;
}

export function AppNavigationPanel({
  app,
  groups,
  favoriteSurfaceIds,
  onSelectSurface,
  onToggleFavorite,
}: AppNavigationPanelProps) {
  const { t } = useTranslation();
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
        {groups.map((group, groupIndex) => (
          <section
            key={group.id}
            className={cn(groupIndex > 0 && "mt-3 border-t border-border/60 pt-3")}
          >
            <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.surfaces.map((surface) => {
                const isActive = activeSurfaceId === surface.id;
                const favoriteId = getSurfaceFavoriteId(app.id, surface.id);
                const isFavorite = isSurfaceFavorited(favoriteSurfaceIds, app.id, surface.id);

                return (
                  <div
                    key={surface.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-[calc(var(--radius)-8px)] pr-1 text-sidebar-foreground/72 transition-colors hover:bg-sidebar-foreground/[0.04] hover:text-foreground",
                      isActive && "bg-sidebar-foreground/[0.06] text-foreground",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        navigate(getAppPath(app.id, surface.id));
                        onSelectSurface();
                      }}
                      className="min-w-0 flex-1 px-2 py-1.5 text-left"
                    >
                      <div className="flex min-h-8 items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                          {surface.navLabel ?? surface.title}
                        </span>
                        <span className="shrink-0 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                          {surface.kind}
                        </span>
                      </div>
                    </button>
                    <SurfaceFavoriteButton
                      favorite={isFavorite}
                      onToggle={() => onToggleFavorite(favoriteId)}
                      className="mt-0.5"
                    />
                    <span className="sr-only">
                      {isFavorite
                        ? t("common.removeFromFavorites")
                        : t("common.addToFavorites")}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
