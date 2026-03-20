import type { AppDefinition } from "@/apps/types";

import type {
  ResolvedAppNotificationSource,
  VisibleAppNotification,
  VisibleNotificationContract,
} from "./types";

function toTimestamp(value: string) {
  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeNotification(
  source: ResolvedAppNotificationSource,
  notification: VisibleNotificationContract,
): VisibleAppNotification {
  return {
    ...notification,
    app_id: source.app_id,
    app_title: source.app_title,
    app_source: source.app_source,
    notification_key: `${source.source_key}:${String(notification.id)}`,
    source_id: source.id,
    source_title: source.title ?? source.app_title,
    source_key: source.source_key,
    source_base_url: source.baseUrl,
    detail_path: source.detailPath?.replace("{id}", String(notification.id)),
    mark_read_path: source.markReadPath?.replace("{id}", String(notification.id)),
    dismiss_path: source.dismissPath?.replace("{id}", String(notification.id)),
  };
}

export function collectAppNotificationSources(apps: AppDefinition[]): ResolvedAppNotificationSource[] {
  return apps
    .flatMap((app) =>
      (app.notificationSources ?? []).map((source) => ({
        ...source,
        app_id: app.id,
        app_title: app.title,
        app_source: app.source,
        source_key: `${app.id}:${source.id}`,
      })),
    );
}

export function normalizeSourceNotifications(
  source: ResolvedAppNotificationSource,
  notifications: VisibleNotificationContract[],
) {
  return notifications
    .map((notification) => normalizeNotification(source, notification))
    .sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at));
}

export function sortVisibleNotifications<T extends { created_at: string }>(notifications: T[]) {
  return [...notifications].sort(
    (left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at),
  );
}

export function formatNotificationTimeLabel(createdAt: string, now = Date.now()) {
  const createdAtMs = toTimestamp(createdAt);

  if (!createdAtMs) {
    return "";
  }

  const elapsedMinutes = Math.max(0, Math.floor((now - createdAtMs) / 60_000));

  if (elapsedMinutes < 1) {
    return "now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h`;
  }

  return `${Math.floor(elapsedHours / 24)}d`;
}
