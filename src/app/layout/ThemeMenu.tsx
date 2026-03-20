import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Check, Palette } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";

export function ThemeMenu() {
  const { t } = useTranslation();
  const { availableThemes, themeId, setThemeById } = useTheme();
  const [open, setOpen] = useState(false);
  const [portalStyle, setPortalStyle] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

      const menuWidth = menuRef.current?.offsetWidth ?? 280;
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
        aria-label={t("settingsDialog.themePreset")}
        title={t("settingsDialog.themePreset")}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/70 text-sm text-foreground shadow-sm transition-colors",
          "hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        )}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <Palette className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              style={portalStyle}
              className="pointer-events-auto fixed z-[160] w-[280px] overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 p-2 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur"
              role="menu"
            >
              <div className="px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {t("settingsDialog.themePreset")}
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {availableThemes.map((theme) => {
                  const active = theme.id === themeId;

                  return (
                    <button
                      key={theme.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[calc(var(--radius)-6px)] px-3 py-2.5 text-left transition-colors",
                        active ? "bg-primary/10 text-foreground" : "hover:bg-muted/45",
                      )}
                      onClick={() => {
                        setThemeById(theme.id);
                        setOpen(false);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{theme.label}</div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {theme.mode}
                        </div>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          active ? "text-primary" : "opacity-0",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
