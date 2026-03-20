import { getAccessibleApps } from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import {
  collectAppNotificationSources,
  normalizeSourceNotifications,
  sortVisibleNotifications,
} from "@/notifications/registry";

import type {
  AppNotificationQueryValue,
  ResolvedAppNotificationSource,
  VisibleAppNotification,
  VisibleNotificationContract,
} from "./types";

const devAuthProxyPrefix = "/__command_center_auth__";

type QueryValue = AppNotificationQueryValue;

type NotificationListPayload =
  | VisibleNotificationContract[]
  | {
      results?: VisibleNotificationContract[];
    };

interface NotificationEndpointRequest {
  path: string;
  baseUrl?: string;
}

interface NotificationBatchMutationResult {
  sourceKeys: string[];
}

export class NotificationsApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "NotificationsApiError";
    this.status = status;
    this.payload = payload;
  }
}

function getConfiguredBaseUrl() {
  const configuredBaseUrl = commandCenterConfig.auth.baseUrl.trim();
  return configuredBaseUrl || env.apiBaseUrl;
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function buildEndpointUrl(
  path: string,
  search?: Record<string, QueryValue>,
  baseUrl = getConfiguredBaseUrl(),
) {
  const url = new URL(path, baseUrl);

  if (search) {
    Object.entries(search).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  if (import.meta.env.DEV && isLoopbackHostname(url.hostname)) {
    return `${devAuthProxyPrefix}${url.pathname}${url.search}`;
  }

  return url.toString();
}

async function readResponsePayload(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.trim() ? text : null;
}

function readErrorMessage(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (!payload || typeof payload !== "object") {
    return "";
  }

  const detail = "detail" in payload ? payload.detail : undefined;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  for (const value of Object.values(payload)) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value)) {
      const joined = value.filter((entry): entry is string => typeof entry === "string").join(", ");
      if (joined) {
        return joined;
      }
    }
  }

  return "";
}

async function requestNotificationsJson<T>(
  endpoint: NotificationEndpointRequest,
  init?: RequestInit,
  search?: Record<string, QueryValue>,
) {
  const requestUrl = buildEndpointUrl(endpoint.path, search, endpoint.baseUrl);

  async function sendRequest() {
    const session = useAuthStore.getState().session;
    const headers = new Headers(init?.headers);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (session?.token) {
      headers.set("Authorization", `${session.tokenType ?? "Bearer"} ${session.token}`);
    }

    return fetch(requestUrl, {
      ...init,
      headers,
    });
  }

  let response: Response;

  try {
    response = await sendRequest();
  } catch (error) {
    throw new NotificationsApiError(
      "The browser could not reach the notifications API.",
      0,
      error,
    );
  }

  if (response.status === 401) {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      response = await sendRequest();
    }
  }

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new NotificationsApiError(
      readErrorMessage(payload) || `Notification request failed with ${response.status}.`,
      response.status,
      payload,
    );
  }

  return payload as T;
}

function normalizeNotificationListPayload(payload: NotificationListPayload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  return [];
}

function getRegisteredNotificationSources() {
  const permissions = useAuthStore.getState().session?.user?.permissions ?? [];
  return collectAppNotificationSources(getAccessibleApps(permissions));
}

function mergeNotificationUpdate(
  current: VisibleAppNotification,
  payload: VisibleNotificationContract | null,
) {
  if (!payload) {
    return {
      ...current,
      is_read: true,
    };
  }

  return {
    ...current,
    ...payload,
  };
}

async function fetchSourceNotifications(source: ResolvedAppNotificationSource) {
  const payload = await requestNotificationsJson<NotificationListPayload>(
    {
      path: source.listPath,
      baseUrl: source.baseUrl,
    },
    undefined,
    source.listQuery,
  );

  return normalizeSourceNotifications(source, normalizeNotificationListPayload(payload));
}

function getSupportedSources(
  predicate: (source: ResolvedAppNotificationSource) => string | undefined,
) {
  return getRegisteredNotificationSources().filter((source) => Boolean(predicate(source)));
}

async function runSourceBatchMutation(
  sources: ResolvedAppNotificationSource[],
  resolvePath: (source: ResolvedAppNotificationSource) => string | undefined,
) {
  if (!sources.length) {
    return { sourceKeys: [] };
  }

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const path = resolvePath(source);

      if (!path) {
        return null;
      }

      await requestNotificationsJson<unknown>(
        {
          path,
          baseUrl: source.baseUrl,
        },
        {
          method: "POST",
        },
      );

      return source.source_key;
    }),
  );

  const successfulSourceKeys = results
    .filter(
      (result): result is PromiseFulfilledResult<string | null> => result.status === "fulfilled",
    )
    .map((result) => result.value)
    .filter((value): value is string => Boolean(value));

  if (!successfulSourceKeys.length) {
    const firstFailure = results.find((result) => result.status === "rejected");
    throw firstFailure?.reason ?? new NotificationsApiError("Notification request failed.", 0, null);
  }

  return {
    sourceKeys: successfulSourceKeys,
  };
}

export function formatNotificationsError(error: unknown) {
  if (error instanceof NotificationsApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "The notification request failed.";
}

export async function fetchVisibleNotifications() {
  const sources = getRegisteredNotificationSources();

  if (!sources.length) {
    return [] as VisibleAppNotification[];
  }

  const results = await Promise.allSettled(sources.map((source) => fetchSourceNotifications(source)));
  const notifications = results
    .filter(
      (result): result is PromiseFulfilledResult<VisibleAppNotification[]> =>
        result.status === "fulfilled",
    )
    .flatMap((result) => result.value);

  if (!notifications.length) {
    const firstFailure = results.find((result) => result.status === "rejected");

    if (firstFailure?.status === "rejected") {
      throw firstFailure.reason;
    }
  }

  return sortVisibleNotifications(notifications);
}

export function fetchNotificationDetail(notification: VisibleAppNotification) {
  if (!notification.detail_path) {
    throw new NotificationsApiError(
      "This notification source does not expose a detail endpoint.",
      400,
      null,
    );
  }

  return requestNotificationsJson<VisibleNotificationContract>({
    path: notification.detail_path,
    baseUrl: notification.source_base_url,
  });
}

export async function markNotificationRead(notification: VisibleAppNotification) {
  if (!notification.mark_read_path) {
    throw new NotificationsApiError(
      "This notification source does not expose a mark-read endpoint.",
      400,
      null,
    );
  }

  const payload = await requestNotificationsJson<VisibleNotificationContract | null>(
    {
      path: notification.mark_read_path,
      baseUrl: notification.source_base_url,
    },
    {
      method: "POST",
    },
  );

  return mergeNotificationUpdate(notification, payload);
}

export async function dismissNotification(notification: VisibleAppNotification) {
  if (!notification.dismiss_path) {
    throw new NotificationsApiError(
      "This notification source does not expose a dismiss endpoint.",
      400,
      null,
    );
  }

  await requestNotificationsJson<null>(
    {
      path: notification.dismiss_path,
      baseUrl: notification.source_base_url,
    },
    {
      method: "POST",
    },
  );

  return notification.notification_key;
}

export function markAllNotificationsRead() {
  return runSourceBatchMutation(
    getSupportedSources((source) => source.markAllReadPath),
    (source) => source.markAllReadPath,
  );
}

export function dismissAllNotifications() {
  return runSourceBatchMutation(
    getSupportedSources((source) => source.dismissAllPath),
    (source) => source.dismissAllPath,
  );
}

export type { NotificationBatchMutationResult };
