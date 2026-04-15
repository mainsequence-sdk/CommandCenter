import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";

const devAuthProxyPrefix = "/__command_center_auth__";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function buildEndpointUrl(
  path: string,
  search?: Record<string, string | number | boolean | undefined>,
) {
  const url = new URL(path, env.apiBaseUrl);

  Object.entries(search ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    url.searchParams.set(key, String(value));
  });

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

async function requestRegisteredWidgetTypesJson<T>(
  path: string,
  init?: RequestInit,
  search?: Record<string, string | number | boolean | undefined>,
) {
  const requestUrl = buildEndpointUrl(path, search);

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
    throw new Error(
      readErrorMessage(payload) || `Registered widget type request failed with ${response.status}.`,
    );
  }

  return payload as T;
}

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

function normalizeRegisteredWidgetTypesPayload(
  payload: PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[],
) {
  const rows = Array.isArray(payload) ? payload : payload.results ?? [];

  return rows
    .filter(isRecord)
    .map((row) => normalizeRegisteredWidgetType(row))
    .filter((row) => row.widgetId.length > 0);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readStringOrNumber(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function readNullableIdentifier(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  return null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function readNullableObject(value: unknown) {
  return isRecord(value) ? value : null;
}

function readNullableInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export interface RegisteredWidgetTypeRecord {
  id: number | string | null;
  widgetId: string;
  title: string;
  description: string;
  category: string;
  kind: string;
  source: string;
  tags: string[];
  requiredPermissions: string[];
  defaultPresentation: Record<string, unknown> | null;
  organizationConfigurationSchema: Record<string, unknown> | null;
  defaultOrganizationConfiguration: Record<string, unknown> | null;
  organizationConfigurationVersion: number | null;
  isActive: boolean;
}

function normalizeRegisteredWidgetType(
  source: Record<string, unknown>,
): RegisteredWidgetTypeRecord {
  return {
    id: readNullableIdentifier(source.id) ?? readNullableIdentifier(source.pk),
    widgetId: readString(source.widget_id ?? source.widgetId),
    title: readString(source.title),
    description: readString(source.description),
    category: readString(source.category),
    kind: readString(source.kind),
    source: readString(source.source),
    tags: readStringArray(source.tags),
    requiredPermissions: readStringArray(
      source.required_permissions ?? source.requiredPermissions,
    ),
    defaultPresentation: readNullableObject(
      source.default_presentation ?? source.defaultPresentation,
    ),
    organizationConfigurationSchema: readNullableObject(
      source.organization_configuration_schema_json
      ?? source.organizationConfigurationSchemaJson
      ?? source.organizationConfigurationSchema,
    ),
    defaultOrganizationConfiguration: readNullableObject(
      source.default_organization_configuration_json
      ?? source.defaultOrganizationConfigurationJson
      ?? source.defaultOrganizationConfiguration,
    ),
    organizationConfigurationVersion: readNullableInteger(
      source.organization_configuration_version
      ?? source.organizationConfigurationVersion,
    ),
    isActive:
      source.is_active === undefined && source.isActive === undefined
        ? true
        : Boolean(source.is_active ?? source.isActive),
  };
}

export function hasConfiguredRegisteredWidgetTypesEndpoint() {
  return commandCenterConfig.widgetTypes.listUrl.trim().length > 0;
}

export async function fetchRegisteredWidgetTypes() {
  const listPath = commandCenterConfig.widgetTypes.listUrl.trim();

  if (!listPath) {
    return [];
  }

  const records: RegisteredWidgetTypeRecord[] = [];
  const visitedTargets = new Set<string>();
  let nextTarget: string | null = listPath;

  while (nextTarget) {
    if (visitedTargets.has(nextTarget)) {
      break;
    }

    visitedTargets.add(nextTarget);

    const payload: PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[] =
      await requestRegisteredWidgetTypesJson<
        PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[]
      >(nextTarget);

    records.push(...normalizeRegisteredWidgetTypesPayload(payload));

    nextTarget =
      Array.isArray(payload)
        ? null
        : typeof payload.next === "string" && payload.next.trim()
          ? payload.next.trim()
          : null;
  }

  return records;
}

export function useRegisteredWidgetTypesCatalog() {
  const endpointConfigured = hasConfiguredRegisteredWidgetTypesEndpoint();
  const query = useQuery({
    queryKey: ["registered-widget-types", "list"],
    queryFn: fetchRegisteredWidgetTypes,
    enabled: endpointConfigured,
    staleTime: 300_000,
  });

  const activeWidgetIdSet = useMemo(
    () =>
      new Set(
        (query.data ?? [])
          .filter((row) => row.isActive)
          .map((row) => row.widgetId),
      ),
    [query.data],
  );
  const configurableWidgetTypes = useMemo(
    () =>
      (query.data ?? []).filter((row) => Boolean(row.organizationConfigurationSchema)),
    [query.data],
  );

  return {
    ...query,
    endpointConfigured,
    activeWidgetIdSet,
    configurableWidgetTypes,
  };
}
