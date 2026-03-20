import type { ReactNode } from "react";

import { useNavigate, useParams } from "react-router-dom";

import { getAppById } from "@/app/registry";
import { SurfaceFavoriteButton } from "@/app/layout/SurfaceFavoriteButton";
import {
  getAccessibleSurfaces,
  getAppPath,
  getSurfaceFavoriteId,
  getSurfaceNavigationGroups,
  isSurfaceFavorited,
} from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";

const adminAppId = "admin";

export function AdminSurfaceLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const params = useParams();
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const favoriteSurfaceIds = useShellStore((state) => state.favoriteSurfaceIds);
  const toggleSurfaceFavorite = useShellStore((state) => state.toggleSurfaceFavorite);
  const app = getAppById(adminAppId);
  const surfaces = app ? getAccessibleSurfaces(app, permissions) : [];
  const groups = getSurfaceNavigationGroups(surfaces);
  const currentSurfaceId = params.surfaceId ?? app?.defaultSurfaceId ?? "";

  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="min-h-full xl:grid xl:grid-cols-[208px_minmax(0,1fr)]">
        <aside
          data-theme-chrome="sidebar"
          className="border-b border-border/70 bg-sidebar/96 text-sidebar-foreground shadow-[var(--shadow-panel)] backdrop-blur xl:border-b-0 xl:border-r"
        >
          <div className="xl:sticky xl:top-0">
            <div className="border-b border-border/70 px-4 py-3.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {app?.title ?? "Admin"}
            </div>
            <div className="space-y-3 px-2 py-2">
              {groups.map((group, index) => (
                <div
                  key={group.id}
                  className={cn(index > 0 && "border-t border-border/60 pt-3")}
                >
                  <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.surfaces.map((surface) => {
                      const active = surface.id === currentSurfaceId;
                      const favoriteId = getSurfaceFavoriteId(adminAppId, surface.id);
                      const isFavorite = isSurfaceFavorited(
                        favoriteSurfaceIds,
                        adminAppId,
                        surface.id,
                      );

                      return (
                        <div
                          key={surface.id}
                          className={cn(
                            "group flex items-center gap-1 rounded-[calc(var(--radius)-8px)] pr-1 text-sidebar-foreground/72 transition-colors hover:bg-sidebar-foreground/[0.04] hover:text-foreground",
                            active && "bg-sidebar-foreground/[0.06] text-foreground",
                          )}
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 px-2 py-1.5 text-left"
                            onClick={() => {
                              navigate(getAppPath(adminAppId, surface.id));
                            }}
                          >
                            <div className="flex min-h-8 items-center">
                              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                                {surface.navLabel ?? surface.title}
                              </span>
                            </div>
                          </button>
                          <SurfaceFavoriteButton
                            favorite={isFavorite}
                            onToggle={() => toggleSurfaceFavorite(favoriteId)}
                            className="mt-0.5"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="px-5 pt-4 md:px-6">
            <PageHeader
              eyebrow="Admin"
              title={title}
              description={description}
            />
          </div>
          <div className="space-y-6 px-5 py-6 md:px-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
