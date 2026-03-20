import {
  type CSSProperties,
  type ComponentType,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { LogOut, Palette, Settings, type LucideProps } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  align?: "end" | "start";
  avatarClassName?: string;
  avatarSrc?: string;
  email?: string;
  menuActions?: Array<{
    icon: ComponentType<LucideProps>;
    label: string;
    onSelect: () => void;
  }>;
  menuClassName?: string;
  name: string;
  onOpenSettings?: () => void;
  onLogout: () => void;
  onThemeAction?: () => void;
  placement?: "bottom" | "right";
  role?: string;
  settingsLabel?: string;
  team?: string;
  themeLabel?: string;
  themeValue?: string;
  triggerContent?: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
}

export function UserMenu({
  align = "end",
  avatarClassName,
  avatarSrc,
  email,
  menuActions,
  menuClassName,
  name,
  onOpenSettings,
  onLogout,
  onThemeAction,
  placement = "bottom",
  role,
  settingsLabel,
  team,
  themeLabel,
  themeValue,
  triggerContent,
  triggerClassName,
  triggerLabel,
}: UserMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [portalStyle, setPortalStyle] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const normalizedName = name.trim() || "User";
  const metaLine = [team, role].filter(Boolean).join(" · ");
  const resolvedTriggerLabel = triggerLabel ?? t("userMenu.open");
  const resolvedSettingsLabel = settingsLabel || t("userMenu.settings");

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

  const menuContent = (
    <div
      ref={menuRef}
      style={portalStyle}
      className={cn(
        "pointer-events-auto fixed z-[160] w-64 rounded-[calc(var(--radius)-2px)] border border-border/70 bg-card/96 p-1.5 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur",
        menuClassName,
      )}
      role="menu"
    >
      <div className="rounded-[calc(var(--radius)-6px)] px-3 py-2.5">
        <div className="truncate text-sm font-medium text-topbar-foreground">
          {normalizedName}
        </div>
        {email ? (
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        ) : null}
        {metaLine ? (
          <div className="mt-1 truncate text-xs text-muted-foreground">{metaLine}</div>
        ) : null}
      </div>

      <div className="my-1 h-px bg-border/70" />

      {menuActions?.map((action) => {
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

      {onThemeAction ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-[calc(var(--radius)-6px)] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            onThemeAction();
          }}
        >
          <Palette className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-left">{themeLabel ?? "Theme"}</span>
          {themeValue ? (
            <span className="text-xs text-muted-foreground">{themeValue}</span>
          ) : null}
        </button>
      ) : null}

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
          {resolvedSettingsLabel}
        </button>
      ) : null}

      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-[calc(var(--radius)-6px)] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
        role="menuitem"
        onClick={() => {
          setOpen(false);
          onLogout();
        }}
      >
        <LogOut className="h-4 w-4 text-muted-foreground" />
        {t("userMenu.signOut")}
      </button>
    </div>
  );

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          triggerContent
            ? "flex items-center rounded-md transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
            : "flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
          triggerClassName,
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        title={resolvedTriggerLabel}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {triggerContent ? (
          triggerContent
        ) : (
          <Avatar
            name={normalizedName}
            src={avatarSrc}
            className={cn(
              "h-full w-full border-0 bg-sidebar-foreground/[0.06] text-topbar-foreground/72",
              avatarClassName,
            )}
            iconClassName="h-4 w-4"
          />
        )}
      </button>

      {open
        ? typeof document !== "undefined"
          ? createPortal(menuContent, document.body)
          : null
        : null}
    </div>
  );
}
