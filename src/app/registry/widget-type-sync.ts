import { appRegistry } from "@/app/registry";
import { useAuthStore } from "@/auth/auth-store";
import { useToastStore } from "@/components/ui/toaster";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import type {
  WidgetDefinition,
  WidgetInputEffect,
  WidgetInstancePresentation,
  WidgetIoDefinition,
  WidgetSettingsSchema,
  WidgetValueDescriptor,
} from "@/widgets/types";

const devAuthProxyPrefix = "/__command_center_auth__";
const widgetRegistrySyncSessionStorageKeyPrefix = "ms.command-center.widget-registry-sync";

// Bump when the JSON manifest contract changes in a backend-visible way.
export const WIDGET_REGISTRY_VERSION = "2026-04-02";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface SyncedWidgetTypePayload {
  widgetId: string;
  title: string;
  description: string;
  category: string;
  kind: WidgetDefinition["kind"];
  source: string;
  tags: string[];
  requiredPermissions: string[];
  schema: JsonValue;
  io: JsonValue;
  defaultPresentation: JsonValue;
  isActive: boolean;
}

export interface WidgetTypeSyncPayload {
  registryVersion: string;
  checksum: string;
  widgets: SyncedWidgetTypePayload[];
}

export interface WidgetTypeSyncResponse {
  status: "noop" | "synced";
  registryVersion?: string;
  checksum?: string;
  lastSyncedAt?: string;
  created?: number;
  updated?: number;
  deactivated?: number;
  total?: number;
}

class WidgetTypeSyncError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "WidgetTypeSyncError";
    this.status = status;
    this.payload = payload;
  }
}

const inFlightSyncs = new Map<string, Promise<WidgetTypeSyncResponse>>();
const reportedSyncErrors = new Set<string>();

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

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function buildWidgetRegistrySyncSessionKey(userId: string) {
  return `${widgetRegistrySyncSessionStorageKeyPrefix}:${userId}`;
}

function readSessionSyncMarker(userId: string) {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    return window.sessionStorage.getItem(buildWidgetRegistrySyncSessionKey(userId));
  } catch {
    return null;
  }
}

function writeSessionSyncMarker(userId: string, marker: string) {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(buildWidgetRegistrySyncSessionKey(userId), marker);
  } catch {
    // Ignore sessionStorage write failures and keep the network result authoritative.
  }
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

function projectValueDescriptor(descriptor: WidgetValueDescriptor | undefined): JsonValue {
  return descriptor ? toJsonValue(descriptor) : {};
}

function projectInputEffects(effects: WidgetInputEffect[] | undefined): JsonValue {
  if (!effects?.length) {
    return [];
  }

  return toJsonValue(
    effects.map((effect) => ({
      kind: effect.kind,
      sourcePath: effect.sourcePath,
      target: effect.target,
      description: effect.description,
    })),
  );
}

function projectWidgetSchema(schema: WidgetSettingsSchema | undefined): JsonValue {
  if (!schema) {
    return {};
  }

  return toJsonValue({
    sections: schema.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
    })),
    fields: schema.fields.map((field) => ({
      id: field.id,
      label: field.label,
      description: field.description,
      sectionId: field.sectionId,
      settingsColumnSpan: field.settingsColumnSpan,
      category: field.category,
      tags: field.tags ?? [],
      pop: field.pop,
    })),
  });
}

function projectWidgetIo(io: WidgetIoDefinition | undefined, hasDynamicIo: boolean): JsonValue {
  if (!io && !hasDynamicIo) {
    return {};
  }

  return toJsonValue({
    dynamic: hasDynamicIo || undefined,
    inputs:
      io?.inputs?.map((input) => ({
        id: input.id,
        label: input.label,
        description: input.description,
        accepts: input.accepts,
        required: input.required,
        cardinality: input.cardinality,
        effects: projectInputEffects(input.effects),
      })) ?? [],
    outputs:
      io?.outputs?.map((output) => ({
        id: output.id,
        label: output.label,
        description: output.description,
        contract: output.contract,
        valueDescriptor: projectValueDescriptor(output.valueDescriptor),
      })) ?? [],
  });
}

function projectDefaultPresentation(
  defaultPresentation: WidgetInstancePresentation | undefined,
): JsonValue {
  return defaultPresentation ? toJsonValue(defaultPresentation) : {};
}

function projectWidgetType(widget: WidgetDefinition): SyncedWidgetTypePayload {
  return {
    widgetId: widget.id,
    title: widget.title,
    description: widget.description,
    category: widget.category,
    kind: widget.kind,
    source: widget.source,
    tags: widget.tags ?? [],
    requiredPermissions: widget.requiredPermissions ?? [],
    schema: projectWidgetSchema(widget.schema),
    io: projectWidgetIo(widget.io, typeof widget.resolveIo === "function"),
    defaultPresentation: projectDefaultPresentation(widget.defaultPresentation),
    isActive: true,
  };
}

export async function buildWidgetTypeSyncPayload(): Promise<WidgetTypeSyncPayload> {
  const widgets = [...appRegistry.widgets]
    .map((widget) => projectWidgetType(widget))
    .sort((left, right) => left.widgetId.localeCompare(right.widgetId));

  const registryBody = {
    registryVersion: WIDGET_REGISTRY_VERSION,
    widgets,
  } satisfies Omit<WidgetTypeSyncPayload, "checksum">;
  const checksum = `sha256:${await sha256Hex(
    stableStringifyJson(registryBody as unknown as JsonValue),
  )}`;

  return {
    ...registryBody,
    checksum,
  };
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

  return "";
}

async function requestWidgetTypeSync(
  payload: WidgetTypeSyncPayload,
): Promise<WidgetTypeSyncResponse> {
  const syncPath = commandCenterConfig.widgetTypes.syncUrl.trim();

  if (!syncPath) {
    throw new Error("Command Center widget-type sync endpoint is not configured.");
  }

  const requestUrl = buildEndpointUrl(syncPath);

  async function sendRequest() {
    const session = useAuthStore.getState().session;

    if (!session?.token) {
      throw new Error("You need to be signed in before the widget registry can sync.");
    }

    return fetch(requestUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `${session.tokenType ?? "Bearer"} ${session.token}`,
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
    throw new WidgetTypeSyncError(
      response.status,
      responsePayload,
      readErrorMessage(responsePayload) || `Widget registry sync failed with ${response.status}.`,
    );
  }

  return (responsePayload ?? { status: "noop" }) as WidgetTypeSyncResponse;
}

function reportWidgetRegistrySyncError(message: string) {
  if (!message || reportedSyncErrors.has(message)) {
    return;
  }

  reportedSyncErrors.add(message);
  useToastStore.getState().push({
    title: "Widget registry sync failed",
    description: message,
    variant: "error",
    duration: 8000,
  });
}

export async function syncWidgetTypesOnceForSession() {
  if (env.useMockData) {
    return { status: "noop" } satisfies WidgetTypeSyncResponse;
  }

  const session = useAuthStore.getState().session;

  if (!session?.token || !session.user.id) {
    return { status: "noop" } satisfies WidgetTypeSyncResponse;
  }

  const payload = await buildWidgetTypeSyncPayload();
  const syncMarker = `${payload.registryVersion}:${payload.checksum}`;
  const cachedMarker = readSessionSyncMarker(session.user.id);

  if (cachedMarker === syncMarker) {
    return { status: "noop" } satisfies WidgetTypeSyncResponse;
  }

  const inFlightKey = `${session.user.id}:${syncMarker}`;
  const existingPromise = inFlightSyncs.get(inFlightKey);

  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = requestWidgetTypeSync(payload)
    .then((response) => {
      writeSessionSyncMarker(session.user.id, syncMarker);
      return response;
    })
    .catch((error) => {
      reportWidgetRegistrySyncError(
        error instanceof Error && error.message ? error.message : "Unable to sync widget types.",
      );
      throw error;
    })
    .finally(() => {
      inFlightSyncs.delete(inFlightKey);
    });

  inFlightSyncs.set(inFlightKey, nextPromise);
  return nextPromise;
}
