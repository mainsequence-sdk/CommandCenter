import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { Boxes, ChevronLeft, LogOut, Palette, Users2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";

import { getAccessiblePrimaryApps } from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import { getRoleLabel, hasAnyPermission } from "@/auth/permissions";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { LogoMark } from "@/components/brand/LogoMark";
import { Avatar } from "@/components/ui/avatar";
import { useCommandCenterConfig } from "@/config/CommandCenterConfigProvider";
import { useChatFeature } from "@/features/chat/ChatProvider";
import { CHAT_PAGE_PATH } from "@/features/chat/chat-ui-store";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import { SettingsDialog } from "./SettingsDialog";
import { UserMenu } from "./UserMenu";

const baseItemClass =
  "group relative z-10 flex h-11 w-full min-w-0 items-center text-sidebar-foreground/52 transition-colors hover:text-topbar-foreground";

const tileClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-transparent transition-colors";

function HoverTooltip({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      return undefined;
    }

    function updatePosition() {
      const rect = anchorRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setStyle({
        left: rect.right + 8,
        top: rect.top + rect.height / 2,
        transform: "translateY(-50%)",
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
    >
      {children}
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              style={style}
              className="pointer-events-none fixed z-[140] whitespace-nowrap rounded-[calc(var(--radius)-6px)] border border-border/80 bg-card/96 px-2.5 py-1.5 text-xs font-medium text-topbar-foreground shadow-[var(--shadow-panel)]"
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

function AssistantSidebarTrigger({
  active,
  collapsed,
  onClick,
  shortcutLabel,
  shortcutVisual,
}: {
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  shortcutLabel: string;
  shortcutVisual: string;
}) {
  const trigger = (
    <button
      type="button"
      className={cn(
        collapsed
          ? "flex h-9 w-full items-center justify-center rounded-md transition-colors"
          : "flex w-full items-center gap-3 rounded-[calc(var(--radius)-6px)] px-2 py-2 text-left transition-colors",
        active
          ? collapsed
            ? "text-topbar-foreground"
            : "border-primary/35 bg-primary/12 text-topbar-foreground"
          : collapsed
            ? "text-sidebar-foreground/72 hover:bg-sidebar-foreground/[0.04] hover:text-topbar-foreground"
            : "border-border/70 bg-muted/45 text-sidebar-foreground/72 hover:bg-sidebar-foreground/[0.04] hover:text-topbar-foreground",
      )}
      title={`Open AI chat (${shortcutLabel})`}
      onClick={onClick}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-border/70 bg-background/55 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground shadow-sm",
          collapsed ? "min-w-[34px]" : "min-w-[52px]",
          active && "border-primary/30 bg-primary/10 text-topbar-foreground",
        )}
      >
        {shortcutVisual}
      </span>
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-topbar-foreground">
            Assistant
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            Open chat
          </span>
        </span>
      ) : null}
    </button>
  );

  if (collapsed) {
    return <HoverTooltip label="Open AI chat">{trigger}</HoverTooltip>;
  }

  return trigger;
}

export function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { app } = useCommandCenterConfig();
  const user = useAuthStore((state) => state.session?.user);
  const logout = useAuthStore((state) => state.logout);
  const sidebarCollapsed = useShellStore((state) => state.sidebarCollapsed);
  const expandSidebar = useShellStore((state) => state.expandSidebar);
  const collapseSidebar = useShellStore((state) => state.collapseSidebar);
  const appPanelAppId = useShellStore((state) => state.appPanelAppId);
  const closeAppPanel = useShellStore((state) => state.closeAppPanel);
  const openAppPanel = useShellStore((state) => state.openAppPanel);
  const toggleAppPanel = useShellStore((state) => state.toggleAppPanel);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const { isOverlayOpen, toggleChat } = useChatFeature();

  const userName = user?.name?.trim() || app.name;
  const userRole = user?.role?.trim() || "User";
  const userRoleLabel = getRoleLabel(userRole);
  const permissions = user?.permissions ?? [];
  const assistantShortcutLabel =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
      ? "⌘ + J"
      : "Ctrl + J";
  const assistantShortcutVisual =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
      ? "⌘J"
      : "⌃J";
  const widgetCatalogAllowed = hasAnyPermission(permissions, ["widget.catalog:view"]);
  const themeStudioAllowed = hasAnyPermission(permissions, ["theme:manage"]);

  const accessibleApps = getAccessiblePrimaryApps(permissions);
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const activeAppId = pathSegments[1];
  const assistantActive = isOverlayOpen || location.pathname === CHAT_PAGE_PATH;
  const userMenuActions = [
    {
      icon: Users2,
      label: "Teams",
      onSelect: () => {
        closeAppPanel();
        navigate("/app/teams");
      },
    },
    ...(widgetCatalogAllowed
      ? [
          {
            icon: Boxes,
            label: t("searchResults.widgetCatalogTitle"),
            onSelect: () => {
              closeAppPanel();
              navigate("/app/widgets");
            },
          },
        ]
      : []),
    ...(themeStudioAllowed
      ? [
          {
            icon: Palette,
            label: t("searchResults.themeStudioTitle"),
            onSelect: () => {
              closeAppPanel();
              navigate("/app/themes");
            },
          },
        ]
      : []),
  ];

  return (
    <aside
      data-shell-sidebar
      data-theme-chrome="sidebar"
      className={cn(
        "relative z-20 flex h-screen max-h-screen flex-col overflow-x-visible overflow-y-hidden border-r border-border/70 bg-sidebar/98 backdrop-blur",
        sidebarCollapsed ? "w-[52px]" : "min-w-[248px] max-w-[280px]",
      )}
    >
      <div className="shrink-0 px-2 pt-2">
        {sidebarCollapsed ? (
          <button
            type="button"
            className="flex h-10 w-full items-center justify-center rounded-md text-topbar-foreground transition-colors hover:bg-sidebar-foreground/[0.04]"
            title={t("navigation.expandSidebar", { app: app.shortName })}
            onClick={expandSidebar}
          >
            <LogoMark className="h-8 w-8" />
          </button>
        ) : (
          <div className="flex h-10 items-center gap-3 px-2">
            <LogoMark className="h-8 w-8" />
            <BrandWordmark className="flex-1" imageClassName="h-4 w-auto max-w-none" />
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-foreground/[0.04] hover:text-topbar-foreground"
              title={t("navigation.collapseSidebar")}
              onClick={collapseSidebar}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <nav className="mt-2 flex min-h-0 flex-1 flex-col overflow-x-visible overflow-y-auto px-2">
        {accessibleApps.length ? (
          <div className="mb-2">
            {!sidebarCollapsed ? (
              <div className="px-2 pb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {t("navigation.apps")}
              </div>
            ) : null}
            <div className="flex flex-col gap-0.5">
              {accessibleApps.map((appItem) => {
                const Icon = appItem.icon;
                const isCurrentApp = activeAppId === appItem.id;
                const isExplorerApp = appPanelAppId === appItem.id;
                const isActive = appPanelAppId ? isExplorerApp : isCurrentApp;

                return (
                  <button
                    key={appItem.id}
                    type="button"
                    title={sidebarCollapsed ? appItem.title : undefined}
                    aria-pressed={isActive}
                    onClick={() => {
                      if (isCurrentApp) {
                        toggleAppPanel(appItem.id);
                        return;
                      }

                      openAppPanel(appItem.id);
                    }}
                    className={cn(
                      baseItemClass,
                      sidebarCollapsed
                        ? "justify-center"
                        : "justify-start gap-2.5 rounded-[calc(var(--radius)-6px)] pl-3 pr-4",
                      isActive &&
                        "text-topbar-foreground before:absolute before:-left-2 before:top-0 before:bottom-0 before:w-[2px] before:bg-topbar-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        tileClass,
                        isActive
                          ? "text-topbar-foreground"
                          : "group-hover:text-topbar-foreground",
                      )}
                    >
                      {sidebarCollapsed ? (
                        <HoverTooltip label={appItem.title}>
                          <Icon className="h-[18px] w-[18px]" />
                        </HoverTooltip>
                      ) : (
                        <Icon className="h-[18px] w-[18px]" />
                      )}
                    </span>
                    {!sidebarCollapsed ? (
                      <span className="truncate text-sm font-medium">{appItem.title}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

      </nav>

      <div className="mt-auto shrink-0 px-2 pb-3 pt-2">
        {sidebarCollapsed ? (
          <div className="flex w-full flex-col items-center gap-2">
            <AssistantSidebarTrigger
              active={assistantActive}
              collapsed
              onClick={toggleChat}
              shortcutLabel={assistantShortcutLabel}
              shortcutVisual={assistantShortcutVisual}
            />
            <UserMenu
              name={userName}
              avatarSrc={user?.avatarUrl}
              email={user?.email}
              team={user?.team}
              role={userRoleLabel}
              align="start"
              placement="right"
              triggerLabel={userName}
              triggerClassName="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-sidebar-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
              triggerContent={
                <Avatar
                  name={userName}
                  src={user?.avatarUrl}
                  className="h-8 w-8 border-0 bg-sidebar-foreground/[0.06] text-topbar-foreground/72"
                  iconClassName="h-4 w-4"
                />
              }
              onOpenSettings={() => {
                setUserSettingsOpen(true);
              }}
              menuActions={userMenuActions}
              onLogout={() => {
                logout();
                navigate("/login");
              }}
            />
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/58 transition-colors hover:bg-sidebar-foreground/[0.04] hover:text-topbar-foreground"
              title={t("userMenu.signOut")}
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="mb-2 px-2">
              <AssistantSidebarTrigger
                active={assistantActive}
                collapsed={false}
                onClick={toggleChat}
                shortcutLabel={assistantShortcutLabel}
                shortcutVisual={assistantShortcutVisual}
              />
            </div>
            <div className="mb-2 flex items-center gap-3 px-2">
              <UserMenu
                name={userName}
                avatarSrc={user?.avatarUrl}
                email={user?.email}
                team={user?.team}
                role={userRoleLabel}
                align="start"
                placement="right"
                triggerLabel={userName}
                triggerClassName="w-full justify-start rounded-[calc(var(--radius)-6px)] px-2 py-1.5 hover:bg-sidebar-foreground/[0.04]"
                triggerContent={
                  <>
                    <Avatar
                      name={userName}
                      src={user?.avatarUrl}
                      className="h-8 w-8 shrink-0 border-0 bg-sidebar-foreground/[0.06] text-topbar-foreground/72"
                      iconClassName="h-4 w-4"
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="truncate text-sm font-medium text-topbar-foreground">
                        {userName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {userRoleLabel}
                      </div>
                    </div>
                  </>
                }
                onOpenSettings={() => {
                  setUserSettingsOpen(true);
                }}
                menuActions={userMenuActions}
                onLogout={() => {
                  logout();
                  navigate("/login");
                }}
              />
            </div>
            <button
              type="button"
              className={cn(baseItemClass, "justify-start gap-3 rounded-md px-2.5")}
              title={t("userMenu.signOut")}
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <span className={cn(tileClass, "group-hover:text-topbar-foreground")}>
                <LogOut className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">{t("userMenu.signOut")}</span>
            </button>
          </>
        )}
      </div>

      <SettingsDialog
        mode="user"
        open={userSettingsOpen}
        user={user ?? undefined}
        onClose={() => {
          setUserSettingsOpen(false);
        }}
      />
    </aside>
  );
}
