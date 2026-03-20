import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Star } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { SurfaceFavoriteButton } from "./SurfaceFavoriteButton";

export interface FavoriteMenuItem {
  id: string;
  favoriteId: string;
  groupId: string;
  groupLabel: string;
  title: string;
  kindLabel: string;
  path: string;
}

interface FavoriteSurfacesMenuProps {
  items: FavoriteMenuItem[];
  onSelect: (path: string) => void;
  onToggleFavorite: (favoriteId: string) => void;
}

export function FavoriteSurfacesMenu({
  items,
  onSelect,
  onToggleFavorite,
}: FavoriteSurfacesMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [portalStyle, setPortalStyle] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const groupedItems = useMemo(() => {
    const groups = new Map<
      string,
      { id: string; label: string; items: FavoriteMenuItem[] }
    >();

    items.forEach((item) => {
      const existingGroup = groups.get(item.groupId);

      if (existingGroup) {
        existingGroup.items.push(item);
        return;
      }

      groups.set(item.groupId, {
        id: item.groupId,
        label: item.groupLabel,
        items: [item],
      });
    });

    return Array.from(groups.values());
  }, [items]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;

      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPortalStyle(undefined);
      return undefined;
    }

    let frameId = 0;

    function updatePortalPosition() {
      const triggerRect = triggerRef.current?.getBoundingClientRect();

      if (!triggerRect) {
        return;
      }

      const menuWidth = menuRef.current?.offsetWidth ?? 320;
      const menuHeight = menuRef.current?.offsetHeight ?? 360;
      const horizontalPadding = 12;
      const verticalPadding = 12;
      const maxLeft = Math.max(horizontalPadding, window.innerWidth - menuWidth - horizontalPadding);
      const maxTop = Math.max(verticalPadding, window.innerHeight - menuHeight - verticalPadding);
      const preferredLeft = triggerRect.right - menuWidth;
      const preferredTop = triggerRect.bottom + 8;

      setPortalStyle({
        left: Math.max(horizontalPadding, Math.min(preferredLeft, maxLeft)),
        top: Math.max(verticalPadding, Math.min(preferredTop, maxTop)),
      });
    }

    updatePortalPosition();
    frameId = window.requestAnimationFrame(updatePortalPosition);

    window.addEventListener("resize", updatePortalPosition);
    window.addEventListener("scroll", updatePortalPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePortalPosition);
      window.removeEventListener("scroll", updatePortalPosition, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("topbar.openFavorites")}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/70 text-sm text-foreground shadow-sm transition-colors",
          "hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        )}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <Star
          className={cn(
            "h-4 w-4",
            items.length > 0 ? "fill-current text-primary" : "text-muted-foreground",
          )}
        />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              style={portalStyle}
              className="pointer-events-auto fixed z-[160] w-[320px] overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 p-2 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur"
              role="menu"
            >
              {groupedItems.length ? (
                groupedItems.map((group, index) => (
                  <section
                    key={group.id}
                    className={cn(index > 0 && "mt-2 border-t border-border/70 pt-2")}
                  >
                    <div className="px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {group.label}
                    </div>
                    <div className="mt-1 flex flex-col gap-1">
                      {group.items.map((item) => (
                        <div
                          key={item.favoriteId}
                          className="flex items-center gap-2 rounded-[calc(var(--radius)-6px)] pl-3 pr-1 transition-colors hover:bg-muted/45"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
                            onClick={() => {
                              setOpen(false);
                              onSelect(item.path);
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {item.title}
                            </span>
                            <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                              {item.kindLabel}
                            </span>
                          </button>
                          <SurfaceFavoriteButton
                            favorite
                            onToggle={() => onToggleFavorite(item.favoriteId)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="rounded-[calc(var(--radius)-6px)] px-3 py-4">
                  <div className="text-sm font-medium text-topbar-foreground">
                    {t("topbar.noFavorites")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("topbar.noFavoritesSubtitle")}
                  </div>
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
