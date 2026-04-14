import {
  CheckCircle2,
  CircleAlert,
  CircleX,
  Info,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { AppComponentResponseNotification as AppComponentResponseNotificationValue } from "./appComponentModel";

const toneStyles = {
  success: {
    icon: CheckCircle2,
    className:
      "border-success/30 bg-success/10 text-success [&_[data-notification-title]]:text-success [&_[data-notification-details]]:text-success/90",
  },
  primary: {
    icon: Info,
    className:
      "border-primary/30 bg-primary/10 text-primary [&_[data-notification-title]]:text-primary [&_[data-notification-details]]:text-primary/90",
  },
  info: {
    icon: Info,
    className:
      "border-primary/30 bg-primary/10 text-primary [&_[data-notification-title]]:text-primary [&_[data-notification-details]]:text-primary/90",
  },
  warning: {
    icon: CircleAlert,
    className:
      "border-warning/35 bg-warning/10 text-warning [&_[data-notification-title]]:text-warning [&_[data-notification-details]]:text-warning/90",
  },
  error: {
    icon: CircleX,
    className:
      "border-danger/35 bg-danger/10 text-danger [&_[data-notification-title]]:text-danger [&_[data-notification-details]]:text-danger/90",
  },
} as const;

export function AppComponentResponseNotification({
  notification,
  className,
}: {
  notification: AppComponentResponseNotificationValue;
  className?: string;
}) {
  const toneStyle = toneStyles[notification.tone];
  const Icon = toneStyle.icon;

  return (
    <section
      className={cn(
        "rounded-[calc(var(--radius)-6px)] border px-4 py-3",
        toneStyle.className,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 space-y-1">
          {notification.title ? (
            <div data-notification-title className="text-sm font-semibold">
              {notification.title}
            </div>
          ) : null}
          <div className="text-sm font-medium leading-5">{notification.message}</div>
          {notification.details ? (
            <div data-notification-details className="text-xs leading-5">
              {notification.details}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
