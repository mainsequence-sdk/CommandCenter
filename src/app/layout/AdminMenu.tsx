import {
  type CSSProperties,
  type ComponentType,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Settings, type LucideProps } from "lucide-react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

interface AdminMenuProps {
  actions: Array<{
    icon: ComponentType<LucideProps>;
    label: string;
    onSelect: () => void;
  }>;
  align?: "end" | "start";
  menuClassName?: string;
  onOpenSettings?: () => void;
  placement?: "bottom" | "right";
  settingsLabel?: string;
  triggerClassName?: string;
  triggerContent: ReactNode;
  triggerLabel: string;
}

export function AdminMenu({
  actions,
  align = "end",
  menuClassName,
  onOpenSettings,
  placement = "bottom",
  settingsLabel = "Admin Settings",
  triggerClassName,
  triggerContent,
  triggerLabel,
}: AdminMenuProps) {
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

      const menuWidth = menuRef.current?.offsetWidth ?? 256;
      const menuHeight = menuRef.current?.offsetHeight ?? 320;
      const horizontalPadding = 12;
      const verticalPadding = 12;
      const maxLeft = Math.max(horizontalPadding, window.innerWidth - menuWidth - horizontalPadding);
      const maxTop = Math.max(verticalPadding, window.innerHeight - menuHeight - verticalPadding);

      if (placement === "right") {
        setPortalStyle({
          left: Math.min(triggerRect.right + 8, maxLeft),
          top: Math.min(triggerRect.top, maxTop),
        });
        return;
      }

      const preferredLeft =
        align === "start" ? triggerRect.left : triggerRect.right - menuWidth;
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
  }, [align, open, placement]);

  const hasActions = actions.length > 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        className={cn("inline-flex items-center justify-center", triggerClassName)}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {triggerContent}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              style={portalStyle}
              className={cn(
                "pointer-events-auto fixed z-[160] w-64 rounded-[calc(var(--radius)-2px)] border border-border/70 bg-card/96 p-1.5 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur",
                menuClassName,
              )}
              role="menu"
            >
              {actions.map((action) => {
                const Icon = action.icon;

                return (
                  <button
                    key={action.label}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-[calc(var(--radius)-6px)] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      action.onSelect();
                    }}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {action.label}
                  </button>
                );
              })}

              {hasActions && onOpenSettings ? <div className="my-1 h-px bg-border/70" /> : null}

              {onOpenSettings ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[calc(var(--radius)-6px)] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onOpenSettings();
                  }}
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  {settingsLabel}
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
