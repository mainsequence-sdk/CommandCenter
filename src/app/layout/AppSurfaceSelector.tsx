import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Check, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

import type { AppSurfaceDefinition } from "@/apps/types";
import { cn } from "@/lib/utils";

interface SurfaceGroup {
  label: string;
  surfaces: AppSurfaceDefinition[];
}

interface AppSurfaceSelectorProps {
  groups: SurfaceGroup[];
  value: string;
  onSelect: (surfaceId: string) => void;
}

function getSurfaceLabel(surface: AppSurfaceDefinition) {
  return surface.navLabel ?? surface.title;
}

export function AppSurfaceSelector({
  groups,
  value,
  onSelect,
}: AppSurfaceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [portalStyle, setPortalStyle] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedSurface = useMemo(
    () => groups.flatMap((group) => group.surfaces).find((surface) => surface.id === value),
    [groups, value],
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;

      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
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

  useEffect(() => {
    setOpen(false);
  }, [value]);

  useLayoutEffect(() => {
    if (!open) {
      setPortalStyle(undefined);
      return undefined;
    }

    let frameId = 0;

    function updatePosition() {
      const triggerRect = triggerRef.current?.getBoundingClientRect();

      if (!triggerRect) {
        return;
      }

      const menuWidth = menuRef.current?.offsetWidth ?? 304;
      const menuHeight = menuRef.current?.offsetHeight ?? 360;
      const horizontalPadding = 12;
      const verticalPadding = 12;
      const maxLeft = Math.max(horizontalPadding, window.innerWidth - menuWidth - horizontalPadding);
      const maxTop = Math.max(verticalPadding, window.innerHeight - menuHeight - verticalPadding);
      const preferredLeft = triggerRect.left;
      const preferredTop = triggerRect.bottom + 8;

      setPortalStyle({
        left: Math.max(horizontalPadding, Math.min(preferredLeft, maxLeft)),
        top: Math.max(verticalPadding, Math.min(preferredTop, maxTop)),
      });
    }

    updatePosition();
    frameId = window.requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const menuContent = open ? (
    <div
      ref={menuRef}
      style={portalStyle}
      className="pointer-events-auto fixed z-[160] w-[304px] overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 p-2 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur"
      role="menu"
    >
      {groups.map((group, index) => (
        <div
          key={group.label}
          className={cn(index > 0 && "mt-2 border-t border-border/70 pt-2")}
        >
          <div className="px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {group.label}
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {group.surfaces.map((surface) => {
              const isActive = surface.id === value;

              return (
                <button
                  key={surface.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[calc(var(--radius)-6px)] px-3 py-2.5 text-left transition-colors hover:bg-muted/45",
                    isActive && "bg-primary/14 text-topbar-foreground",
                  )}
                  onClick={() => {
                    setOpen(false);
                    onSelect(surface.id);
                  }}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary">
                    {isActive ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {getSurfaceLabel(surface)}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {surface.kind}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "flex h-9 min-w-[220px] max-w-[320px] items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/65 px-3 text-sm text-foreground shadow-sm transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
          open && "border-primary/60 bg-muted/55",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <span className="truncate text-left">
          {selectedSurface ? getSurfaceLabel(selectedSurface) : "Select surface"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {menuContent ? createPortal(menuContent, document.body) : null}
    </div>
  );
}
