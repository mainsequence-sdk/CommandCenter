import { CalendarClock, Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VisibleAppNotification } from "@/notifications/types";

interface NotificationDetailDialogProps {
  dismissPending?: boolean;
  errorMessage?: string | null;
  loading?: boolean;
  markReadPending?: boolean;
  notification: VisibleAppNotification | null;
  onClose: () => void;
  onDismiss?: () => void;
  onMarkRead?: () => void;
  open: boolean;
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

function getNotificationTypeVariant(type: string) {
  switch (type) {
    case "UR":
      return "danger" as const;
    case "IM":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function formatAbsoluteTimestamp(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function extractNotificationBody(value: string) {
  if (!value.trim()) {
    return "";
  }

  if (typeof window === "undefined") {
    return value.replace(/<[^>]+>/g, " ").replace(/\s+\n/g, "\n").replace(/\s+/g, " ").trim();
  }

  const parsed = new DOMParser().parseFromString(value, "text/html");
  const body = parsed.body;

  body.querySelectorAll("br").forEach((element) => {
    element.replaceWith("\n");
  });

  body.querySelectorAll("p,div,section,article,li,h1,h2,h3,h4,h5,h6").forEach((element) => {
    if (!element.textContent?.endsWith("\n")) {
      element.append("\n");
    }
  });

  return body.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? "";
}

export function NotificationDetailDialog({
  dismissPending = false,
  errorMessage,
  loading = false,
  markReadPending = false,
  notification,
  onClose,
  onDismiss,
  onMarkRead,
  open,
}: NotificationDetailDialogProps) {
  const body = notification ? extractNotificationBody(notification.description) : "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={notification?.title ?? "Notification"}
      description={notification ? `${notification.app_title} · ${notification.source_title}` : undefined}
      className="max-w-[min(1080px,calc(100vw-24px))]"
    >
      {notification ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_280px]">
          <section className="min-w-0 space-y-4">
            <div className="rounded-[calc(var(--radius)-2px)] border border-white/8 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{notification.app_title}</Badge>
                <Badge variant="secondary">{notification.source_title}</Badge>
                <Badge variant={getNotificationTypeVariant(notification.type)}>
                  {getNotificationTypeLabel(notification.type)}
                </Badge>
                {notification.is_read ? <Badge variant="neutral">Read</Badge> : null}
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                {formatAbsoluteTimestamp(notification.created_at)}
              </div>
            </div>

            <div className="rounded-[calc(var(--radius)-2px)] border border-white/8 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Full content
              </div>

              {loading ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading full notification
                </div>
              ) : (
                <div
                  className={cn(
                    "mt-4 rounded-[calc(var(--radius)-6px)] border border-white/8 bg-black/10 px-4 py-4 text-sm leading-6 text-topbar-foreground",
                    !body && "text-muted-foreground",
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {body || "No notification body was provided."}
                  </div>
                </div>
              )}

              {errorMessage ? (
                <div className="mt-4 rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-3 py-3 text-sm text-danger">
                  {errorMessage}
                </div>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[calc(var(--radius)-2px)] border border-white/8 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Actions
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {!notification.is_read && notification.mark_read_path && onMarkRead ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={markReadPending}
                    onClick={onMarkRead}
                  >
                    {markReadPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Mark read
                  </Button>
                ) : null}
                {notification.dismiss_path && onDismiss ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={dismissPending}
                    onClick={onDismiss}
                  >
                    {dismissPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Dismiss
                  </Button>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </Dialog>
  );
}
