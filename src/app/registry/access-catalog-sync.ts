import { appRegistry } from "@/app/registry";
import type { AppDefinition, AppSurfaceNavigationSection, AppSurfaceEntry } from "@/apps/types";
import { getPermissionDefinitions } from "@/auth/permission-catalog";
import type { PermissionDefinition } from "@/auth/permissions";
import { useAuthStore } from "@/auth/auth-store";
import { buildSessionAuthHeaderRecord } from "@/auth/session-headers";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";

export const ACCESS_CATALOG_VERSION = "2026-05-23-generated-access-catalog-uid";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface SyncedAccessAppPayload {
  uid: string;
  title: string;
  description: string;
  source: string;
  requiredPermissions: string[];
  defaultSurfaceUid: string;
}

export interface SyncedAccessSurfacePayload {
  appUid: string;
  appTitle: string;
  appSource: string;
  surfaceUid: string;
  title: string;
  navLabel?: string;
  description: string;
  kind: AppSurfaceEntry["kind"];
  hidden: boolean;
  routePath: string;
  requiredPermissions: string[];
  appRequiredPermissions: string[];
  effectiveRequiredPermissions: string[];
  navigationSection?: {
    id: string;
    label: string;
    description?: string;
    order?: number;
  };
}

export interface SyncedAccessPermissionPayload {
  id: string;
  label: string;
  description: string;
  category: string;
}

export interface AccessCatalogPayload {
  registryVersion: string;
  checksum: string;
  apps: SyncedAccessAppPayload[];
  permissions: SyncedAccessPermissionPayload[];
  surfaces: SyncedAccessSurfacePayload[];
}

export interface AccessCatalogValidationIssue {
  section: string;
  message: string;
}

export interface AccessCatalogDraft {
  payload: AccessCatalogPayload;
  validationIssues: AccessCatalogValidationIssue[];
}

export interface AccessCatalogSyncResponse {
  status: "noop" | "synced";
  registryVersion?: string;
  checksum?: string;
  lastSyncedAt?: string;
  created?: number;
  updated?: number;
  deactivated?: number;
  total?: number;
}

class AccessCatalogSyncError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "AccessCatalogSyncError";
    this.status = status;
    this.payload = payload;
  }
}

const devAuthProxyPrefix = "/__command_center_auth__";
const inFlightSyncs = new Map<string, Promise<AccessCatalogSyncResponse>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function toJsonValue(value: unknown): JsonValue {
  const serialized = JSON.stringify(value, (_key, candidate) => {
    if (candidate === undefined) {
      return undefined;
    }

    if (
      typeof candidate === "function" ||
      typeof candidate === "symbol" ||
      typeof candidate === "bigint"
    ) {
      return undefined;
    }

    return candidate;
  });

  return serialized ? (JSON.parse(serialized) as JsonValue) : {};
}

function stableNormalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => stableNormalizeJson(entry));
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonValue>>((result, key) => {
        result[key] = stableNormalizeJson(value[key] as JsonValue);
        return result;
      }, {});
  }

  return value;
}

function stableStringifyJson(value: JsonValue) {
  return JSON.stringify(stableNormalizeJson(value));
}

async function sha256Hex(value: string) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function uniqueSortedStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  ).sort((left, right) => left.localeCompare(right));
}

function projectNavigationSection(
  section: AppSurfaceNavigationSection | undefined,
): SyncedAccessSurfacePayload["navigationSection"] {
  if (!section) {
    return undefined;
  }

  return {
    id: section.id,
    label: section.label,
    description: section.description,
    order: section.order,
  };
}

export function projectAccessAppForSync(app: AppDefinition): SyncedAccessAppPayload {
  return {
    uid: app.id,
    title: app.title,
    description: app.description,
    source: app.source,
    requiredPermissions: uniqueSortedStrings(app.requiredPermissions ?? []),
    defaultSurfaceUid: app.defaultSurfaceId,
  };
}

export function projectAccessSurfaceForSync(
  surface: AppSurfaceEntry,
): SyncedAccessSurfacePayload {
  const requiredPermissions = uniqueSortedStrings(surface.requiredPermissions ?? []);
  const appRequiredPermissions = uniqueSortedStrings(surface.appRequiredPermissions ?? []);

  return {
    appUid: surface.appId,
    appTitle: surface.appTitle,
    appSource: surface.appSource,
    surfaceUid: surface.id,
    title: surface.title,
    navLabel: surface.navLabel?.trim() || undefined,
    description: surface.description,
    kind: surface.kind,
    hidden: Boolean(surface.hidden),
    routePath: `/app/${surface.appId}/${surface.id}`,
    requiredPermissions,
    appRequiredPermissions,
    effectiveRequiredPermissions: uniqueSortedStrings([
      ...appRequiredPermissions,
      ...requiredPermissions,
    ]),
    navigationSection: projectNavigationSection(surface.navigationSection),
  };
}

export function projectPermissionDefinitionForSync(
  definition: PermissionDefinition,
): SyncedAccessPermissionPayload {
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    category: definition.category,
  };
}

function appendValidationIssue(
  issues: AccessCatalogValidationIssue[],
  section: string,
  message: string,
) {
  issues.push({ section, message });
}

function validateAccessApp(
  issues: AccessCatalogValidationIssue[],
  app: SyncedAccessAppPayload,
  knownPermissionIds: Set<string>,
) {
  if (!app.uid.trim()) {
    appendValidationIssue(issues, "apps", "uid is required.");
  }

  if (!app.title.trim()) {
    appendValidationIssue(issues, `apps.${app.uid || "(missing uid)"}`, "title is required.");
  }

  if (!app.defaultSurfaceUid.trim()) {
    appendValidationIssue(
      issues,
      `apps.${app.uid || "(missing uid)"}`,
      "defaultSurfaceUid is required.",
    );
  }

  app.requiredPermissions.forEach((permissionId) => {
    if (!knownPermissionIds.has(permissionId)) {
      appendValidationIssue(
        issues,
        `apps.${app.uid || "(missing uid)"}.requiredPermissions`,
        `Unknown permission ${permissionId}.`,
      );
    }
  });
}

function validateAccessSurface(
  issues: AccessCatalogValidationIssue[],
  surface: SyncedAccessSurfacePayload,
  knownPermissionIds: Set<string>,
) {
  const section = `surfaces.${surface.appUid || "(missing appUid)"}.${surface.surfaceUid || "(missing surfaceUid)"}`;

  if (!surface.surfaceUid.trim()) {
    appendValidationIssue(issues, section, "surfaceUid is required.");
  }

  if (!surface.title.trim()) {
    appendValidationIssue(issues, section, "title is required.");
  }

  if (!surface.description.trim()) {
    appendValidationIssue(issues, section, "description is required.");
  }

  surface.effectiveRequiredPermissions.forEach((permissionId) => {
    if (!knownPermissionIds.has(permissionId)) {
      appendValidationIssue(
        issues,
        `${section}.effectiveRequiredPermissions`,
        `Unknown permission ${permissionId}.`,
      );
    }
  });
}

function formatValidationIssues(issues: AccessCatalogValidationIssue[]) {
  return issues.map((issue) => `${issue.section}: ${issue.message}`).join(" | ");
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

  if (isRecord(payload) && typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail.trim();
  }

  return "";
}

export async function buildAccessCatalogDraft(): Promise<AccessCatalogDraft> {
  const validationIssues: AccessCatalogValidationIssue[] = [];
  const apps = [...appRegistry.apps]
    .map((app) => projectAccessAppForSync(app))
    .sort((left, right) => left.uid.localeCompare(right.uid));
  const permissions = getPermissionDefinitions()
    .map((definition) => projectPermissionDefinitionForSync(definition))
    .sort((left, right) => left.id.localeCompare(right.id));
  const surfaces = [...appRegistry.surfaces]
    .map((surface) => projectAccessSurfaceForSync(surface))
    .sort((left, right) => {
      if (left.appUid === right.appUid) {
        return left.surfaceUid.localeCompare(right.surfaceUid);
      }

      return left.appUid.localeCompare(right.appUid);
    });
  const knownPermissionIds = new Set(permissions.map((permission) => permission.id));

  apps.forEach((app) => validateAccessApp(validationIssues, app, knownPermissionIds));
  surfaces.forEach((surface) =>
    validateAccessSurface(validationIssues, surface, knownPermissionIds),
  );

  const registryBody = {
    registryVersion: ACCESS_CATALOG_VERSION,
    apps,
    permissions,
    surfaces,
  } satisfies Omit<AccessCatalogPayload, "checksum">;
  const checksum = `sha256:${await sha256Hex(stableStringifyJson(toJsonValue(registryBody)))}`;

  return {
    payload: {
      ...registryBody,
      checksum,
    },
    validationIssues,
  };
}

export async function buildAccessCatalogPayload(): Promise<AccessCatalogPayload> {
  const draft = await buildAccessCatalogDraft();

  if (draft.validationIssues.length > 0) {
    throw new Error(
      `Access catalog manifest is invalid. ${formatValidationIssues(draft.validationIssues)}`,
    );
  }

  return draft.payload;
}

async function requestAccessCatalogSync(
  payload: AccessCatalogPayload,
): Promise<AccessCatalogSyncResponse> {
  const syncPath = commandCenterConfig.commandCenterAccess.accessCatalog.syncUrl.trim();

  if (!syncPath) {
    throw new Error("Command Center access-catalog sync endpoint is not configured.");
  }

  const requestUrl = buildEndpointUrl(syncPath);

  async function sendRequest() {
    const session = useAuthStore.getState().session;

    if (!session?.token) {
      throw new Error("You need to be signed in before the access catalog can sync.");
    }

    return fetch(requestUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...buildSessionAuthHeaderRecord(session),
      },
      body: JSON.stringify(payload),
    });
  }

  let response = await sendRequest();

  if (response.status === 401) {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      response = await sendRequest();
    }
  }

  const responsePayload = await readResponsePayload(response);

  if (!response.ok) {
    throw new AccessCatalogSyncError(
      response.status,
      responsePayload,
      readErrorMessage(responsePayload) ||
        `Access catalog sync failed with ${response.status}.`,
    );
  }

  return (responsePayload ?? { status: "noop" }) as AccessCatalogSyncResponse;
}

export async function syncAccessCatalog(
  payload?: AccessCatalogPayload,
) {
  if (env.useMockData) {
    return { status: "noop" } satisfies AccessCatalogSyncResponse;
  }

  const session = useAuthStore.getState().session;

  if (!session?.token || !session.user.uid) {
    throw new Error("You need to be signed in before the access catalog can sync.");
  }

  const effectivePayload = payload ?? await buildAccessCatalogPayload();
  const syncMarker = `${effectivePayload.registryVersion}:${effectivePayload.checksum}`;
  const inFlightKey = `${session.user.uid}:${syncMarker}`;
  const existingPromise = inFlightSyncs.get(inFlightKey);

  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = requestAccessCatalogSync(effectivePayload).finally(() => {
    inFlightSyncs.delete(inFlightKey);
  });

  inFlightSyncs.set(inFlightKey, nextPromise);
  return nextPromise;
}
