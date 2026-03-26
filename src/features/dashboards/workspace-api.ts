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
const mockWorkspaceStorageKeyPrefix = "ms.command-center.mock-workspaces";
const mockWorkspaceJsonModules = import.meta.glob("/mock_data/workspaces/workspaces.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

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

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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

function readMockWorkspaceSeed(): Partial<UserDashboardCollection> {
  const dataset = mockWorkspaceJsonModules["/mock_data/workspaces/workspaces.json"];

  if (Array.isArray(dataset)) {
    return {
      dashboards: dataset
        .map((entry) => coerceDashboardDefinition(entry))
        .filter((dashboard): dashboard is DashboardDefinition => dashboard !== null),
      selectedDashboardId: null,
      savedAt: null,
    };
  }

  if (!isRecord(dataset)) {
    return {
      dashboards: [],
      selectedDashboardId: null,
      savedAt: null,
    };
  }

  return cloneJson(dataset as Partial<UserDashboardCollection>);
}

function buildMockWorkspaceStorageKey(userId: string | null | undefined) {
  return `${mockWorkspaceStorageKeyPrefix}:${userId ?? "anonymous"}`;
}

function readStoredMockWorkspaceCollection(
  userId: string | null | undefined,
): UserDashboardCollection | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(buildMockWorkspaceStorageKey(userId));

    if (!rawValue) {
      return null;
    }

    return normalizeUserDashboardCollection(JSON.parse(rawValue) as Partial<UserDashboardCollection>, {
      allowEmpty: true,
    });
  } catch {
    return null;
  }
}

function readMockWorkspaceCollection(
  userId: string | null | undefined,
): UserDashboardCollection {
  const storedCollection = readStoredMockWorkspaceCollection(userId);

  if (storedCollection) {
    return storedCollection;
  }

  return normalizeUserDashboardCollection(readMockWorkspaceSeed(), {
    allowEmpty: true,
  });
}

function writeMockWorkspaceCollection(
  userId: string | null | undefined,
  collection: UserDashboardCollection,
) {
  const normalizedCollection = normalizeUserDashboardCollection(collection, {
    allowEmpty: true,
    fallbackSavedAt: collection.savedAt ?? new Date().toISOString(),
  });

  if (canUseLocalStorage()) {
    try {
      window.localStorage.setItem(
        buildMockWorkspaceStorageKey(userId),
        JSON.stringify(normalizedCollection),
      );
    } catch {
      // Ignore localStorage write failures in mock mode and continue with the in-memory value.
    }
  }

  return normalizedCollection;
}

function getCurrentMockWorkspaceUserId() {
  return useAuthStore.getState().session?.user.id ?? null;
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function buildEndpointUrl(path: string) {
  const url = new URL(path, env.apiBaseUrl);

  if (import.meta.env.DEV && isLoopbackHostname(url.hostname)) {
    return `${devAuthProxyPrefix}${url.pathname}${url.search}`;
  }

  return url.toString();
}

function normalizeMockWorkspacePath(path: string) {
  const pathname = new URL(path, window.location.origin).pathname;

  if (!pathname.startsWith(devAuthProxyPrefix)) {
    return pathname;
  }

  const normalizedPathname = pathname.slice(devAuthProxyPrefix.length);
  return normalizedPathname || "/";
}

function createMockWorkspaceId() {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) {
    return `workspace-${uuid}`;
  }

  return `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

function parseRequestJsonBody(body: RequestInit["body"]) {
  if (!body || typeof body !== "string") {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
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

function buildMockWorkspacePayload() {
  const mockWorkspaceCollection = readMockWorkspaceCollection(getCurrentMockWorkspaceUserId());

  return {
    results: cloneJson(mockWorkspaceCollection.dashboards),
    selectedDashboardId: mockWorkspaceCollection.selectedDashboardId,
    savedAt: mockWorkspaceCollection.savedAt,
  };
}

function extractWorkspaceIdFromPath(pathname: string, listPathname: string) {
  if (!pathname.startsWith(listPathname)) {
    return null;
  }

  const remainder = pathname.slice(listPathname.length).replace(/^\/+|\/+$/g, "");

  if (!remainder) {
    return null;
  }

  return decodeURIComponent(remainder.split("/")[0] ?? "");
}

function buildMockWorkspaceFromPayload(payload: unknown): DashboardDefinition {
  const source = isRecord(payload) ? payload : {};
  const normalizedId = normalizeWorkspaceId(source.id) ?? createMockWorkspaceId();

  return normalizeDashboardDefinition({
    id: normalizedId,
    title: typeof source.title === "string" && source.title.trim() ? source.title : "My Workspace",
    description:
      typeof source.description === "string" && source.description.trim()
        ? source.description
        : "User-scoped workspace managed in Command Center.",
    labels: Array.isArray(source.labels)
      ? source.labels.filter((label): label is string => typeof label === "string")
      : [],
    category: typeof source.category === "string" && source.category.trim() ? source.category : "Custom",
    source: typeof source.source === "string" && source.source.trim() ? source.source : "user",
    requiredPermissions: Array.isArray(source.requiredPermissions)
      ? source.requiredPermissions.filter((permission): permission is string => typeof permission === "string")
      : undefined,
    grid: isRecord(source.grid) ? (source.grid as DashboardDefinition["grid"]) : undefined,
    controls: isRecord(source.controls) ? (source.controls as DashboardDefinition["controls"]) : undefined,
    widgets: Array.isArray(source.widgets) ? (source.widgets as DashboardDefinition["widgets"]) : [],
  });
}

function updateMockWorkspaceCollection(
  userId: string | null | undefined,
  dashboards: DashboardDefinition[],
  selectedDashboardId: string | null,
) {
  const savedAt = new Date().toISOString();

  return writeMockWorkspaceCollection(
    userId,
    {
      ...readMockWorkspaceCollection(userId),
      dashboards,
      selectedDashboardId,
      savedAt,
    },
  );
}

function persistMockWorkspaceCollection(
  collection: UserDashboardCollection,
) {
  return writeMockWorkspaceCollection(getCurrentMockWorkspaceUserId(), collection);
}

function createMockWorkspace(
  dashboard: DashboardDefinition,
) {
  const userId = getCurrentMockWorkspaceUserId();
  const currentCollection = readMockWorkspaceCollection(userId);
  const createdWorkspace = normalizeDashboardDefinition({
    ...dashboard,
    id: dashboard.id?.trim() ? dashboard.id : createMockWorkspaceId(),
  });

  updateMockWorkspaceCollection(
    userId,
    [createdWorkspace, ...currentCollection.dashboards.filter((entry) => entry.id !== createdWorkspace.id)],
    createdWorkspace.id,
  );

  return createdWorkspace;
}

function deleteMockWorkspace(workspaceId: string) {
  const userId = getCurrentMockWorkspaceUserId();
  const currentCollection = readMockWorkspaceCollection(userId);
  const nextDashboards = currentCollection.dashboards.filter((dashboard) => dashboard.id !== workspaceId);
  const nextSelectedDashboardId =
    currentCollection.selectedDashboardId === workspaceId
      ? nextDashboards[0]?.id ?? null
      : currentCollection.selectedDashboardId;

  updateMockWorkspaceCollection(userId, nextDashboards, nextSelectedDashboardId);
}

function handleMockWorkspaceRequest(path: string, init?: RequestInit) {
  const listPath = commandCenterConfig.workspaces.listUrl.trim();

  if (!listPath) {
    return undefined;
  }

  const method = (init?.method ?? "GET").toUpperCase();
  const pathname = normalizeMockWorkspacePath(path);
  const listPathname = new URL(listPath, window.location.origin).pathname;
  const currentUserId = getCurrentMockWorkspaceUserId();
  const mockWorkspaceCollection = readMockWorkspaceCollection(currentUserId);

  if (pathname === listPathname) {
    if (method === "GET") {
      return buildMockWorkspacePayload();
    }

    if (method === "POST") {
      const createdWorkspace = buildMockWorkspaceFromPayload(parseRequestJsonBody(init?.body));
      updateMockWorkspaceCollection(
        currentUserId,
        [createdWorkspace, ...mockWorkspaceCollection.dashboards],
        createdWorkspace.id,
      );
      return cloneJson(createdWorkspace);
    }

    return undefined;
  }

  const workspaceId = extractWorkspaceIdFromPath(pathname, listPathname);

  if (!workspaceId) {
    return undefined;
  }

  const currentWorkspace =
    mockWorkspaceCollection.dashboards.find((dashboard) => dashboard.id === workspaceId) ?? null;

  if (method === "GET") {
    if (!currentWorkspace) {
      throw new WorkspaceBackendRequestError(404, { detail: "Workspace not found." }, "Workspace not found.");
    }

    return cloneJson(currentWorkspace);
  }

  if (method === "PUT") {
    if (!currentWorkspace) {
      throw new WorkspaceBackendRequestError(404, { detail: "Workspace not found." }, "Workspace not found.");
    }

    const updatedWorkspace = normalizeDashboardDefinition({
      ...buildMockWorkspaceFromPayload(parseRequestJsonBody(init?.body)),
      id: workspaceId,
    });
    const nextDashboards = mockWorkspaceCollection.dashboards.map((dashboard) =>
      dashboard.id === workspaceId ? updatedWorkspace : dashboard,
    );
    updateMockWorkspaceCollection(
      currentUserId,
      nextDashboards,
      mockWorkspaceCollection.selectedDashboardId === workspaceId
        ? workspaceId
        : mockWorkspaceCollection.selectedDashboardId,
    );
    return cloneJson(updatedWorkspace);
  }

  if (method === "DELETE") {
    if (!currentWorkspace) {
      throw new WorkspaceBackendRequestError(404, { detail: "Workspace not found." }, "Workspace not found.");
    }

    const nextDashboards = mockWorkspaceCollection.dashboards.filter(
      (dashboard) => dashboard.id !== workspaceId,
    );
    const nextSelectedDashboardId =
      mockWorkspaceCollection.selectedDashboardId === workspaceId
        ? nextDashboards[0]?.id ?? null
        : mockWorkspaceCollection.selectedDashboardId;

    updateMockWorkspaceCollection(currentUserId, nextDashboards, nextSelectedDashboardId);
    return null;
  }

  return undefined;
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
  if (env.useMockData) {
    const mockResponse = handleMockWorkspaceRequest(path, init);

    if (mockResponse !== undefined) {
      return mockResponse;
    }
  }

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
  if (env.useMockData) {
    deleteMockWorkspace(workspaceId);
    return;
  }

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

  if (env.useMockData) {
    return readMockWorkspaceCollection(getCurrentMockWorkspaceUserId());
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

  if (env.useMockData) {
    return createMockWorkspace(dashboard);
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

  if (env.useMockData) {
    return persistMockWorkspaceCollection(
      normalizeUserDashboardCollection(nextCollection, {
        allowEmpty: true,
        fallbackSavedAt: new Date().toISOString(),
      }),
    );
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
