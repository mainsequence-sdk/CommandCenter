import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import type { DashboardDefinition } from "@/dashboards/types";
import {
  normalizeDashboardDefinition,
  normalizeUserDashboardCollection,
  type UserDashboardCollection,
} from "./custom-dashboard-storage";

const devAuthProxyPrefix = "/__command_center_auth__";

class WorkspaceBackendRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "WorkspaceBackendRequestError";
    this.status = status;
    this.payload = payload;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeWorkspaceId(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function getConfiguredBaseUrl() {
  const configuredBaseUrl = commandCenterConfig.auth.baseUrl.trim();
  return configuredBaseUrl || env.apiBaseUrl;
}

function buildEndpointUrl(path: string) {
  const url = new URL(path, getConfiguredBaseUrl());

  if (import.meta.env.DEV && isLoopbackHostname(url.hostname)) {
    return `${devAuthProxyPrefix}${url.pathname}${url.search}`;
  }

  return url.toString();
}

function coerceDashboardDefinition(value: unknown): DashboardDefinition | null {
  if (!isRecord(value)) {
    return null;
  }

  const normalizedId = normalizeWorkspaceId(value.id);

  if (normalizedId && Array.isArray(value.widgets)) {
    return normalizeDashboardDefinition({
      ...(value as unknown as DashboardDefinition),
      id: normalizedId,
    });
  }

  if ("workspace" in value) {
    return coerceDashboardDefinition(value.workspace);
  }

  if ("dashboard" in value) {
    return coerceDashboardDefinition(value.dashboard);
  }

  return null;
}

function resolveWorkspaceDetailPath(workspaceId: string) {
  const template = commandCenterConfig.workspaces.detailUrl.trim();
  const encodedId = encodeURIComponent(workspaceId);

  if (template.includes("{id}")) {
    return template.replace(/\{id\}/g, encodedId);
  }

  if (template.includes(":id")) {
    return template.replace(/:id/g, encodedId);
  }

  return template.endsWith("/") ? `${template}${encodedId}/` : `${template}/${encodedId}/`;
}

function normalizeWorkspaceListPayload(payload: unknown): DashboardDefinition[] {
  if (Array.isArray(payload)) {
    return payload
      .map((dashboard) => coerceDashboardDefinition(dashboard))
      .filter((dashboard): dashboard is DashboardDefinition => dashboard !== null);
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.results)) {
    return payload.results
      .map((dashboard) => coerceDashboardDefinition(dashboard))
      .filter((dashboard): dashboard is DashboardDefinition => dashboard !== null);
  }

  if (Array.isArray(payload.dashboards)) {
    return payload.dashboards
      .map((dashboard) => coerceDashboardDefinition(dashboard))
      .filter((dashboard): dashboard is DashboardDefinition => dashboard !== null);
  }

  return [];
}

function readSavedAtFromDashboard(dashboard: unknown) {
  if (!isRecord(dashboard)) {
    return null;
  }

  const candidate =
    dashboard.updatedAt ??
    dashboard.updated_at ??
    dashboard.modifiedAt ??
    dashboard.modified_at ??
    dashboard.savedAt ??
    dashboard.saved_at;

  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

function resolveCollectionSavedAt(payload: unknown, dashboards: DashboardDefinition[]) {
  if (isRecord(payload)) {
    const collectionSavedAt = payload.savedAt ?? payload.saved_at;

    if (typeof collectionSavedAt === "string" && collectionSavedAt.trim()) {
      return collectionSavedAt;
    }
  }

  return dashboards.reduce<string | null>((latest, dashboard) => {
    const candidate = readSavedAtFromDashboard(dashboard);

    if (!candidate) {
      return latest;
    }

    if (!latest) {
      return candidate;
    }

    return Date.parse(candidate) > Date.parse(latest) ? candidate : latest;
  }, null);
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

  if (!isRecord(payload)) {
    return "";
  }

  const detail = payload.detail;
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

async function requestWorkspaceBackend(path: string, init?: RequestInit) {
  const requestUrl = buildEndpointUrl(path);

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

  let response = await sendRequest();

  if (response.status === 401) {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      response = await sendRequest();
    }
  }

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new WorkspaceBackendRequestError(
      response.status,
      payload,
      readErrorMessage(payload) || `Workspace request failed with ${response.status}.`,
    );
  }

  return payload;
}

export async function deleteWorkspaceInBackend(workspaceId: string) {
  await requestWorkspaceBackend(resolveWorkspaceDetailPath(workspaceId), {
    method: "DELETE",
  });
}

function serializeDashboard(dashboard: DashboardDefinition) {
  return JSON.stringify(normalizeDashboardDefinition(dashboard));
}

function serializeWorkspaceMutationPayload(
  dashboard: DashboardDefinition,
  options?: {
    includeId?: boolean;
  },
) {
  const normalizedDashboard = normalizeDashboardDefinition(dashboard);

  if (options?.includeId ?? false) {
    return JSON.stringify(normalizedDashboard);
  }

  const { id: _id, ...payload } = normalizedDashboard;
  return JSON.stringify(payload);
}

function resolveMutationDashboardPayload(payload: unknown, fallback: DashboardDefinition) {
  const resolved = coerceDashboardDefinition(payload);

  if (resolved) {
    return resolved;
  }

  return normalizeDashboardDefinition(fallback);
}

export function hasConfiguredWorkspaceBackend() {
  return Boolean(
    commandCenterConfig.workspaces.listUrl.trim() &&
    commandCenterConfig.workspaces.detailUrl.trim(),
  );
}

export async function fetchWorkspaceCollectionFromBackend() {
  const listPath = commandCenterConfig.workspaces.listUrl.trim();

  if (!listPath) {
    throw new Error("Command Center workspaces list endpoint is not configured.");
  }

  const payload = await requestWorkspaceBackend(listPath);
  const dashboards = normalizeWorkspaceListPayload(payload);

  return normalizeUserDashboardCollection(
    {
      dashboards,
      selectedDashboardId:
        isRecord(payload) && normalizeWorkspaceId(payload.selectedDashboardId)
          ? normalizeWorkspaceId(payload.selectedDashboardId)
          : null,
      savedAt: resolveCollectionSavedAt(payload, dashboards),
    },
    {
      allowEmpty: true,
      fallbackSavedAt: resolveCollectionSavedAt(payload, dashboards),
    },
  );
}

export async function createWorkspaceInBackend(dashboard: DashboardDefinition) {
  const listPath = commandCenterConfig.workspaces.listUrl.trim();

  if (!listPath) {
    throw new Error("Command Center workspaces list endpoint is not configured.");
  }

  const payload = await requestWorkspaceBackend(listPath, {
    method: "POST",
    body: serializeWorkspaceMutationPayload(dashboard),
  });

  return resolveMutationDashboardPayload(payload, dashboard);
}

export async function saveWorkspaceCollectionToBackend(
  previousCollection: UserDashboardCollection,
  nextCollection: UserDashboardCollection,
) {
  const listPath = commandCenterConfig.workspaces.listUrl.trim();

  if (!listPath || !commandCenterConfig.workspaces.detailUrl.trim()) {
    throw new Error("Command Center workspaces backend is not fully configured.");
  }

  const normalizedPrevious = normalizeUserDashboardCollection(previousCollection);
  const normalizedNext = normalizeUserDashboardCollection(nextCollection, {
    allowEmpty: true,
    fallbackSavedAt: new Date().toISOString(),
  });
  const previousById = new Map(
    normalizedPrevious.dashboards.map((dashboard) => [dashboard.id, dashboard]),
  );
  const nextById = new Map(normalizedNext.dashboards.map((dashboard) => [dashboard.id, dashboard]));
  const persistedDashboards = new Map<string, DashboardDefinition>();

  for (const dashboard of normalizedPrevious.dashboards) {
    if (!nextById.has(dashboard.id)) {
      await deleteWorkspaceInBackend(dashboard.id);
    }
  }

  for (const dashboard of normalizedNext.dashboards) {
    const previousDashboard = previousById.get(dashboard.id);

    if (!previousDashboard) {
      const payload = await requestWorkspaceBackend(listPath, {
        method: "POST",
        body: serializeWorkspaceMutationPayload(dashboard),
      });

      persistedDashboards.set(
        dashboard.id,
        resolveMutationDashboardPayload(payload, dashboard),
      );
      continue;
    }

    if (serializeDashboard(previousDashboard) === serializeDashboard(dashboard)) {
      persistedDashboards.set(dashboard.id, dashboard);
      continue;
    }

    const payload = await requestWorkspaceBackend(resolveWorkspaceDetailPath(dashboard.id), {
      method: "PUT",
      body: serializeWorkspaceMutationPayload(dashboard),
    });

    persistedDashboards.set(
      dashboard.id,
      resolveMutationDashboardPayload(payload, dashboard),
    );
  }

  const savedAt = new Date().toISOString();

  return normalizeUserDashboardCollection(
    {
      ...normalizedNext,
      dashboards: normalizedNext.dashboards.map(
        (dashboard) => persistedDashboards.get(dashboard.id) ?? dashboard,
      ),
      savedAt,
    },
    {
      allowEmpty: true,
      fallbackSavedAt: savedAt,
    },
  );
}
