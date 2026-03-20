import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Loader2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/button";
import { commandCenterConfig } from "@/config/command-center";
import { cn } from "@/lib/utils";
import {
  dismissAllNotifications,
  dismissNotification,
  fetchNotificationDetail,
  fetchVisibleNotifications,
  formatNotificationsError,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/notifications/api";
import { formatNotificationTimeLabel } from "@/notifications/registry";
import type { VisibleAppNotification } from "@/notifications/types";
import { NotificationDetailDialog } from "./NotificationDetailDialog";

interface NotificationsMenuProps {
  triggerClassName?: string;
}

const notificationsQueryKey = [
  "notifications",
  "visible",
] as const;

function stripNotificationDescription(value: string) {
  if (!value.trim()) {
    return "";
  }

  if (typeof window === "undefined") {
    return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const documentFragment = new DOMParser().parseFromString(value, "text/html");
  return documentFragment.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function truncateNotificationDescription(value: string, limit = 220) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit).trimEnd()}...`;
}

function getNotificationTypeLabel(type: string) {
  switch (type) {
    case "UR":
      return "Urgent";
    case "IM":
      return "Important";
    case "IN":
      return "Info";
    default:
      return type;
  }
}

function getNotificationTypeClassName(type: string) {
  switch (type) {
    case "UR":
      return "border-danger/30 bg-danger/12 text-danger";
    case "IM":
      return "border-warning/30 bg-warning/12 text-warning";
    default:
      return "border-border/70 bg-card/80 text-muted-foreground";
  }
}

export function NotificationsMenu({ triggerClassName }: NotificationsMenuProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sessionToken = useAuthStore((state) => state.session?.token);
  const [open, setOpen] = useState(false);
  const [activeNotification, setActiveNotification] = useState<VisibleAppNotification | null>(null);
  const [portalStyle, setPortalStyle] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const notificationsQuery = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: fetchVisibleNotifications,
    enabled: Boolean(sessionToken),
    refetchInterval: commandCenterConfig.app.notificationsRefreshIntervalMs,
  });

  const items = notificationsQuery.data ?? [];
  const unreadCount = items.filter((item) => !item.is_read).length;
  const selectedNotification = activeNotification
    ? items.find((item) => item.notification_key === activeNotification.notification_key) ??
      activeNotification
    : null;

  const notificationDetailQuery = useQuery({
    queryKey: ["notifications", "detail", selectedNotification?.notification_key],
    queryFn: () => fetchNotificationDetail(selectedNotification as VisibleAppNotification),
    enabled: Boolean(selectedNotification?.detail_path),
  });

  const detailedSelectedNotification = selectedNotification
    ? notificationDetailQuery.data
      ? {
          ...selectedNotification,
          ...notificationDetailQuery.data,
        }
      : selectedNotification
    : null;

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (updatedNotification) => {
      queryClient.setQueryData<VisibleAppNotification[]>(notificationsQueryKey, (current) =>
        (current ?? []).map((item) =>
          item.notification_key === updatedNotification.notification_key ? updatedNotification : item,
        ),
      );

      setActiveNotification((current) =>
        current?.notification_key === updatedNotification.notification_key
          ? updatedNotification
          : current,
      );
    },
  });

  const dismissMutation = useMutation({
    mutationFn: dismissNotification,
    onSuccess: (notificationKey) => {
      queryClient.setQueryData<VisibleAppNotification[]>(notificationsQueryKey, (current) =>
        (current ?? []).filter((item) => item.notification_key !== notificationKey),
      );

      setActiveNotification((current) =>
        current?.notification_key === notificationKey ? null : current,
      );
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: ({ sourceKeys }) => {
      queryClient.setQueryData<VisibleAppNotification[]>(notificationsQueryKey, (current) =>
        (current ?? []).map((item) =>
          sourceKeys.includes(item.source_key)
            ? {
                ...item,
                is_read: true,
              }
            : item,
        ),
      );

      setActiveNotification((current) =>
        current && sourceKeys.includes(current.source_key)
          ? {
              ...current,
              is_read: true,
            }
          : current,
      );
    },
  });

  const dismissAllMutation = useMutation({
    mutationFn: dismissAllNotifications,
    onSuccess: ({ sourceKeys }) => {
      queryClient.setQueryData<VisibleAppNotification[]>(notificationsQueryKey, (current) =>
        (current ?? []).filter((item) => !sourceKeys.includes(item.source_key)),
      );

      setActiveNotification((current) =>
        current && sourceKeys.includes(current.source_key) ? null : current,
      );
    },
  });

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

      const menuWidth = menuRef.current?.offsetWidth ?? 360;
      const menuHeight = menuRef.current?.offsetHeight ?? 420;
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

  const mutationError =
    markReadMutation.error ??
    dismissMutation.error ??
    markAllReadMutation.error ??
    dismissAllMutation.error;

  const detailMutationError =
    selectedNotification &&
    (markReadMutation.variables?.notification_key === selectedNotification.notification_key ||
      dismissMutation.variables?.notification_key === selectedNotification.notification_key)
      ? formatNotificationsError(
          dismissMutation.error ?? markReadMutation.error ?? notificationDetailQuery.error,
        )
      : notificationDetailQuery.error
        ? formatNotificationsError(notificationDetailQuery.error)
        : null;

  function openNotificationDetail(notification: VisibleAppNotification) {
    setActiveNotification(notification);
    setOpen(false);
  }

  const menuContent = (
    <div
      ref={menuRef}
      style={portalStyle}
      className="pointer-events-auto fixed z-[160] w-[360px] overflow-hidden rounded-[calc(var(--radius)-2px)] border border-border/70 bg-card/96 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur"
      role="menu"
    >
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-topbar-foreground">
              {t("topbar.notificationsTitle")}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("topbar.notificationsUnread", { count: unreadCount })}
            </div>
          </div>
          {notificationsQuery.isFetching ? (
            <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        {items.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={unreadCount === 0 || markAllReadMutation.isPending}
              onClick={() => {
                void markAllReadMutation.mutateAsync();
              }}
            >
              {markAllReadMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5" />
              )}
              Mark all read
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={dismissAllMutation.isPending}
              onClick={() => {
                void dismissAllMutation.mutateAsync();
              }}
            >
              {dismissAllMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Dismiss all
            </Button>
          </div>
        ) : null}
      </div>

      <div className="max-h-[min(60vh,440px)] overflow-y-auto p-2">
        {mutationError ? (
          <div className="mb-2 rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {formatNotificationsError(mutationError)}
          </div>
        ) : null}

        {notificationsQuery.isLoading && items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-[calc(var(--radius)-6px)] px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading notifications
          </div>
        ) : null}

        {notificationsQuery.isError && items.length === 0 ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-3 py-4 text-sm text-danger">
            {formatNotificationsError(notificationsQuery.error)}
          </div>
        ) : null}

        {!notificationsQuery.isLoading && !notificationsQuery.isError && items.length === 0 ? (
          <div className="rounded-[calc(var(--radius)-6px)] px-3 py-4 text-sm text-muted-foreground">
            {t("topbar.notificationsEmpty")}
          </div>
        ) : null}

        {items.map((item) => {
          const description = truncateNotificationDescription(
            stripNotificationDescription(item.description),
          );
          const markReadPending =
            markReadMutation.isPending &&
            markReadMutation.variables?.notification_key === item.notification_key;
          const dismissPending =
            dismissMutation.isPending &&
            dismissMutation.variables?.notification_key === item.notification_key;

          return (
            <div
              key={item.notification_key}
              className={cn(
                "cursor-pointer rounded-[calc(var(--radius)-6px)] border px-3 py-2.5 transition-colors hover:border-primary/35 hover:bg-primary/8",
                item.is_read
                  ? "border-border/50 bg-card/45"
                  : "border-primary/25 bg-primary/6",
              )}
              role="menuitem"
              tabIndex={0}
              aria-haspopup="dialog"
              onClick={() => {
                openNotificationDetail(item);
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) {
                  return;
                }

                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openNotificationDetail(item);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/30",
                    !item.is_read &&
                      "bg-primary shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_55%,transparent)]",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium text-topbar-foreground">{item.title}</div>
                    <div className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      {formatNotificationTimeLabel(item.created_at)}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full border border-border/70 bg-card/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {item.app_title}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                        getNotificationTypeClassName(item.type),
                      )}
                    >
                      {getNotificationTypeLabel(item.type)}
                    </span>
                    {item.is_read ? (
                      <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        Read
                      </span>
                    ) : null}
                  </div>
                  {description ? (
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      {description}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!item.is_read && item.mark_read_path ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={markReadPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          void markReadMutation.mutateAsync(item);
                        }}
                      >
                        {markReadPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Mark read
                      </Button>
                    ) : null}
                    {item.dismiss_path ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={dismissPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          void dismissMutation.mutateAsync(item);
                        }}
                      >
                        {dismissPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        Dismiss
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div className="relative" ref={rootRef}>
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-topbar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
            triggerClassName,
          )}
          aria-expanded={open}
          aria-haspopup="menu"
          title={t("topbar.openNotifications")}
          aria-label={t("topbar.openNotifications")}
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          <Bell className="h-4 w-4" />
          {notificationsQuery.isFetching ? (
            <span className="absolute right-1 top-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-card">
              <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
            </span>
          ) : unreadCount ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
          ) : null}
        </button>

        {open
          ? typeof document !== "undefined"
            ? createPortal(menuContent, document.body)
            : null
          : null}
      </div>

      <NotificationDetailDialog
        open={Boolean(selectedNotification)}
        notification={detailedSelectedNotification}
        loading={notificationDetailQuery.isFetching}
        errorMessage={detailMutationError}
        markReadPending={
          markReadMutation.isPending &&
          markReadMutation.variables?.notification_key === selectedNotification?.notification_key
        }
        dismissPending={
          dismissMutation.isPending &&
          dismissMutation.variables?.notification_key === selectedNotification?.notification_key
        }
        onClose={() => {
          setActiveNotification(null);
        }}
        onMarkRead={
          selectedNotification && !selectedNotification.is_read && selectedNotification.mark_read_path
            ? () => {
                void markReadMutation.mutateAsync(selectedNotification);
              }
            : undefined
        }
        onDismiss={
          selectedNotification && selectedNotification.dismiss_path
            ? () => {
                void dismissMutation.mutateAsync(selectedNotification);
              }
            : undefined
        }
      />
    </>
  );
}
