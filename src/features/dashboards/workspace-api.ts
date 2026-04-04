import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import type { DashboardDefinition, DashboardWidgetInstance } from "@/dashboards/types";
import {
  sanitizeDashboardDefinition,
  sanitizeUserDashboardCollection,
  normalizeDashboardDefinition,
  normalizeUserDashboardCollection,
  type UserDashboardCollection,
} from "./custom-dashboard-storage";
import {
  normalizeWorkspaceListSummariesPayload,
  summarizeDashboardForWorkspaceList,
  type WorkspaceListItemSummary,
} from "./workspace-list-summary";
import {
  applyWorkspaceUserStateToDashboard,
  createEmptyWorkspaceUserState,
  extractWorkspaceUserStateFromDashboard,
  normalizeWorkspaceUserStatePayload,
  stripWorkspaceUserStateFromDashboard,
  type WorkspaceUserStateSnapshot,
} from "./workspace-user-state";

const devAuthProxyPrefix = "/__command_center_auth__";
const mockWorkspaceStorageKeyPrefix = "ms.command-center.mock-workspaces";
const mockWorkspaceJsonModules = import.meta.glob("/mock_data/workspaces/demo_workspace.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

export class WorkspaceBackendRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "WorkspaceBackendRequestError";
    this.status = status;
    this.payload = payload;
  }
}

export function isWorkspaceBackendNotFoundError(error: unknown) {
  return error instanceof WorkspaceBackendRequestError && error.status === 404;
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
  const dataset = mockWorkspaceJsonModules["/mock_data/workspaces/demo_workspace.json"];

  const seededDashboard = coerceDashboardDefinition(dataset);

  if (seededDashboard) {
    return {
      dashboards: [seededDashboard],
      selectedDashboardId: seededDashboard.id,
      savedAt: null,
    };
  }

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

export function readBundledMockWorkspaceCollection() {
  return normalizeUserDashboardCollection(readMockWorkspaceSeed(), {
    allowEmpty: true,
  });
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

export function readLegacyMockWorkspaceCollection(
  userId: string | null | undefined,
): UserDashboardCollection | null {
  return readStoredMockWorkspaceCollection(userId);
}

export function clearLegacyMockWorkspaceCollection(userId: string | null | undefined) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(buildMockWorkspaceStorageKey(userId));
  } catch {
    // Ignore mock storage cleanup failures; the migrated local store remains authoritative.
  }
}

function readMockWorkspaceCollection(
  userId: string | null | undefined,
): UserDashboardCollection {
  const storedCollection = readStoredMockWorkspaceCollection(userId);

  if (storedCollection) {
    return storedCollection;
  }

  return readBundledMockWorkspaceCollection();
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

function appendWorkspaceListFrontendFlag(path: string) {
  const url = new URL(path, env.apiBaseUrl);
  url.searchParams.set("fe_list", "true");
  return `${url.pathname}${url.search}`;
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

function resolveWorkspaceUserStateListPath(workspaceId: string) {
  const template = commandCenterConfig.workspaces.userStateListUrl.trim();

  if (!template) {
    return "";
  }

  const url = new URL(template, env.apiBaseUrl);
  url.searchParams.set("workspace", workspaceId);
  return `${url.pathname}${url.search}`;
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

function buildMockWorkspacePayload() {
  const mockWorkspaceCollection = readMockWorkspaceCollection(getCurrentMockWorkspaceUserId());

  return {
    results: mockWorkspaceCollection.dashboards.map((dashboard) =>
      summarizeDashboardForWorkspaceList(dashboard, {
        updatedAt: mockWorkspaceCollection.savedAt,
      }),
    ),
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

  return sanitizeDashboardDefinition({
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
  const createdWorkspace = sanitizeDashboardDefinition({
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

    const updatedWorkspace = sanitizeDashboardDefinition({
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

  const messages: string[] = [];

  function appendMessage(rawMessage: string, path: string[]) {
    const message = rawMessage.trim();

    if (!message) {
      return;
    }

    if (path.length === 0) {
      messages.push(message);
      return;
    }

    messages.push(`${path.join(".")}: ${message}`);
  }

  function visit(value: unknown, path: string[]) {
    if (typeof value === "string") {
      appendMessage(value, path);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        const nextPath =
          typeof entry === "string" && path.length > 0 ? path : [...path, String(index)];
        visit(entry, nextPath);
      });
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    Object.entries(value).forEach(([key, entry]) => {
      visit(entry, [...path, key]);
    });
  }

  Object.entries(payload).forEach(([key, value]) => {
    if (key === "detail" && typeof value === "string") {
      return;
    }

    visit(value, [key]);
  });

  if (messages.length > 0) {
    return messages.join(" | ");
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

function serializeWorkspaceMutationPayload(
  dashboard: DashboardDefinition,
  options?: {
    includeId?: boolean;
  },
) {
  const normalizedDashboard = stripWorkspaceUserStateFromDashboard(
    sanitizeDashboardDefinition(dashboard),
  );

  if (options?.includeId ?? false) {
    return JSON.stringify(normalizedDashboard);
  }

  const { id: _id, ...payload } = normalizedDashboard;
  return JSON.stringify(payload);
}

function unwrapDashboardPayloadRecord(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (Array.isArray(payload.widgets)) {
    return payload;
  }

  if ("workspace" in payload) {
    return unwrapDashboardPayloadRecord(payload.workspace);
  }

  if ("dashboard" in payload) {
    return unwrapDashboardPayloadRecord(payload.dashboard);
  }

  return payload;
}

function collectWidgetGeometryById(
  widgets: DashboardDefinition["widgets"],
  geometryById: Map<
    string,
    Pick<DashboardWidgetInstance, "layout" | "position">
  > = new Map(),
) {
  widgets.forEach((widget) => {
    geometryById.set(widget.id, {
      layout: cloneJson(widget.layout),
      position: cloneJson(widget.position),
    });

    if (widget.row?.children?.length) {
      collectWidgetGeometryById(widget.row.children, geometryById);
    }
  });

  return geometryById;
}

function applyFallbackWidgetGeometry(
  widgets: DashboardDefinition["widgets"],
  geometryById: ReadonlyMap<string, Pick<DashboardWidgetInstance, "layout" | "position">>,
): DashboardDefinition["widgets"] {
  return widgets.map((widget) => {
    const fallbackGeometry = geometryById.get(widget.id);
    const nextWidget: DashboardWidgetInstance = fallbackGeometry
      ? {
          ...widget,
          layout: cloneJson(fallbackGeometry.layout),
          position: cloneJson(fallbackGeometry.position),
        }
      : widget;

    if (!nextWidget.row?.children?.length) {
      return nextWidget;
    }

    return {
      ...nextWidget,
      row: {
        ...nextWidget.row,
        children: applyFallbackWidgetGeometry(nextWidget.row.children, geometryById),
      },
    };
  });
}

function resolveMutationDashboardPayload(payload: unknown, fallback: DashboardDefinition) {
  const fallbackUserState = extractWorkspaceUserStateFromDashboard(fallback);
  const resolved = coerceDashboardDefinition(payload);
  const payloadRecord = unwrapDashboardPayloadRecord(payload);

  if (resolved) {
    const nextResolved =
      fallback.widgets.length > 0
        ? sanitizeDashboardDefinition({
            ...resolved,
            widgets: applyFallbackWidgetGeometry(
              resolved.widgets,
              collectWidgetGeometryById(fallback.widgets),
            ),
          })
        : resolved;

    if (
      payloadRecord &&
      !Array.isArray(payloadRecord.companions) &&
      Array.isArray(fallback.companions) &&
      fallback.companions.length > 0
    ) {
      return applyWorkspaceUserStateToDashboard(
        sanitizeDashboardDefinition({
          ...nextResolved,
          companions: fallback.companions,
        }),
        fallbackUserState,
      );
    }

    return applyWorkspaceUserStateToDashboard(nextResolved, fallbackUserState);
  }

  return applyWorkspaceUserStateToDashboard(
    normalizeDashboardDefinition(stripWorkspaceUserStateFromDashboard(fallback)),
    fallbackUserState,
  );
}

export function hasConfiguredWorkspaceBackend() {
  return Boolean(
    commandCenterConfig.workspaces.listUrl.trim() &&
    commandCenterConfig.workspaces.detailUrl.trim(),
  );
}

export function hasConfiguredWorkspaceUserStateBackend() {
  return Boolean(commandCenterConfig.workspaces.userStateListUrl.trim());
}

export async function fetchWorkspaceListSummariesFromBackend(): Promise<WorkspaceListItemSummary[]> {
  const listPath = commandCenterConfig.workspaces.listUrl.trim();

  if (!listPath) {
    throw new Error("Command Center workspaces list endpoint is not configured.");
  }

  if (env.useMockData) {
    return readMockWorkspaceCollection(getCurrentMockWorkspaceUserId()).dashboards.map((dashboard) =>
      summarizeDashboardForWorkspaceList(dashboard),
    );
  }

  const payload = await requestWorkspaceBackend(appendWorkspaceListFrontendFlag(listPath));
  return normalizeWorkspaceListSummariesPayload(payload);
}

export async function fetchWorkspaceDetailFromBackend(workspaceId: string) {
  const detailPath = commandCenterConfig.workspaces.detailUrl.trim();

  if (!detailPath) {
    throw new Error("Command Center workspace detail endpoint is not configured.");
  }

  if (env.useMockData) {
    const currentWorkspace =
      readMockWorkspaceCollection(getCurrentMockWorkspaceUserId()).dashboards.find(
        (dashboard) => dashboard.id === workspaceId,
      ) ?? null;

    if (!currentWorkspace) {
      throw new Error(`Workspace ${workspaceId} was not found.`);
    }

    return currentWorkspace;
  }

  const payload = await requestWorkspaceBackend(resolveWorkspaceDetailPath(workspaceId));
  const dashboard = coerceDashboardDefinition(payload);

  if (!dashboard) {
    throw new Error(`Workspace ${workspaceId} detail response was invalid.`);
  }

  return dashboard;
}

export async function fetchWorkspaceUserStateFromBackend(
  workspaceId: string,
): Promise<WorkspaceUserStateSnapshot> {
  const userStateListPath = resolveWorkspaceUserStateListPath(workspaceId);

  if (!userStateListPath) {
    return createEmptyWorkspaceUserState();
  }

  if (env.useMockData) {
    const currentWorkspace =
      readMockWorkspaceCollection(getCurrentMockWorkspaceUserId()).dashboards.find(
        (dashboard) => dashboard.id === workspaceId,
      ) ?? null;

    return currentWorkspace
      ? extractWorkspaceUserStateFromDashboard(currentWorkspace)
      : createEmptyWorkspaceUserState();
  }

  const payload = await requestWorkspaceBackend(userStateListPath);
  return normalizeWorkspaceUserStatePayload(payload);
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

export async function saveWorkspaceInBackend(dashboard: DashboardDefinition) {
  const detailPath = commandCenterConfig.workspaces.detailUrl.trim();

  if (!detailPath) {
    throw new Error("Command Center workspace detail endpoint is not configured.");
  }

  if (env.useMockData) {
    const nextCollection = persistMockWorkspaceCollection(
      sanitizeUserDashboardCollection(
        {
          dashboards: [
            sanitizeDashboardDefinition(dashboard),
            ...readMockWorkspaceCollection(getCurrentMockWorkspaceUserId()).dashboards.filter(
              (entry) => entry.id !== dashboard.id,
            ),
          ],
          selectedDashboardId: dashboard.id,
          savedAt: new Date().toISOString(),
        },
        {
          allowEmpty: true,
          fallbackSavedAt: new Date().toISOString(),
        },
      ),
    );

    return (
      nextCollection.dashboards.find((entry) => entry.id === dashboard.id) ??
      sanitizeDashboardDefinition(dashboard)
    );
  }

  const payload = await requestWorkspaceBackend(resolveWorkspaceDetailPath(dashboard.id), {
    method: "PUT",
    body: serializeWorkspaceMutationPayload(dashboard),
  });

  return resolveMutationDashboardPayload(payload, dashboard);
}
