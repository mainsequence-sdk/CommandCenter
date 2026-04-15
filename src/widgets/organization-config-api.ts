import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";

const devAuthProxyPrefix = "/__command_center_auth__";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
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

  const nestedErrors = "errors" in payload ? payload.errors : undefined;

  if (isRecord(nestedErrors)) {
    for (const [key, value] of Object.entries(nestedErrors)) {
      if (typeof value === "string" && value.trim()) {
        return `${key}: ${value.trim()}`;
      }

      if (Array.isArray(value)) {
        const joined = value.filter((entry): entry is string => typeof entry === "string").join(", ");
        if (joined) {
          return `${key}: ${joined}`;
        }
      }
    }
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

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" && value.trim()) {
      return `${key}: ${value.trim()}`;
    }

    if (Array.isArray(value)) {
      const joined = value.filter((entry): entry is string => typeof entry === "string").join(", ");
      if (joined) {
        return `${key}: ${joined}`;
      }
    }
  }

  return "";
}

async function requestOrganizationWidgetTypeConfigurations<T>(
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
      readErrorMessage(payload) ||
      `Organization widget type configuration request failed with ${response.status}.`,
    );
  }

  return payload as T;
}

function normalizeConfigJson(value: unknown) {
  return isRecord(value) ? cloneJson(value) : {};
}

function normalizeOrganizationWidgetTypeConfigurationRecord(
  payload: unknown,
): OrganizationWidgetTypeConfigurationRecord {
  const source = isRecord(payload) ? payload : {};
  const id = readNullableString(source.id);
  const registeredWidgetTypeId = readNullableString(
    source.registered_widget_type ?? source.registeredWidgetType,
  );
  const registeredWidgetTypeWidgetId = readString(
    source.registered_widget_type_widget_id ?? source.registeredWidgetTypeWidgetId,
  ).trim();

  if (!id || !registeredWidgetTypeId || !registeredWidgetTypeWidgetId) {
    throw new Error("Organization widget type configuration payload is missing required fields.");
  }

  return {
    id,
    organizationOwnerId: readNullableString(
      source.organization_owner ?? source.organizationOwner,
    ),
    createdByUserId: readNullableString(
      source.created_by_user ?? source.createdByUser,
    ),
    creationDate: readNullableString(
      source.creation_date ?? source.creationDate,
    ),
    registeredWidgetTypeId,
    registeredWidgetTypeWidgetId,
    registeredWidgetTypeTitle: readString(
      source.registered_widget_type_title ?? source.registeredWidgetTypeTitle,
    ),
    configJson: normalizeConfigJson(source.config_json ?? source.configJson),
  };
}

function normalizeOrganizationWidgetTypeConfigurationList(
  payload: unknown,
): OrganizationWidgetTypeConfigurationRecord[] {
  if (Array.isArray(payload)) {
    return payload.map((entry) => normalizeOrganizationWidgetTypeConfigurationRecord(entry));
  }

  if (isRecord(payload) && Array.isArray(payload.results)) {
    return payload.results.map((entry) => normalizeOrganizationWidgetTypeConfigurationRecord(entry));
  }

  return [];
}

function buildDetailPath(id: string) {
  const template = commandCenterConfig.widgetTypes.organizationConfigurationsDetailUrl.trim();

  if (!template) {
    throw new Error("Organization widget type configuration detail endpoint is not configured.");
  }

  return template.replace("{id}", encodeURIComponent(id));
}

export interface OrganizationWidgetTypeConfigurationRecord {
  id: string;
  organizationOwnerId: string | null;
  createdByUserId: string | null;
  creationDate: string | null;
  registeredWidgetTypeId: string;
  registeredWidgetTypeWidgetId: string;
  registeredWidgetTypeTitle: string;
  configJson: Record<string, unknown>;
}

export interface OrganizationWidgetTypeConfigurationMutationPayload {
  registeredWidgetType: string | number;
  configJson: Record<string, unknown>;
}

export interface OrganizationWidgetTypeConfigurationListFilters {
  registeredWidgetType?: string | number;
  widgetId?: string;
}

export function hasConfiguredOrganizationWidgetTypeConfigurationsEndpoint() {
  return commandCenterConfig.widgetTypes.organizationConfigurationsListUrl.trim().length > 0;
}

export async function fetchOrganizationWidgetTypeConfigurations(
  filters?: OrganizationWidgetTypeConfigurationListFilters,
) {
  const listPath = commandCenterConfig.widgetTypes.organizationConfigurationsListUrl.trim();

  if (!listPath || env.useMockData) {
    return [] as OrganizationWidgetTypeConfigurationRecord[];
  }

  const payload = await requestOrganizationWidgetTypeConfigurations<unknown>(
    listPath,
    undefined,
    {
      registered_widget_type: filters?.registeredWidgetType,
      widgetId: filters?.widgetId?.trim() || undefined,
    },
  );

  return normalizeOrganizationWidgetTypeConfigurationList(payload);
}

export async function fetchOrganizationWidgetTypeConfiguration(id: string) {
  if (env.useMockData) {
    throw new Error("Organization widget type configuration detail is unavailable in mock mode.");
  }

  const payload = await requestOrganizationWidgetTypeConfigurations<unknown>(buildDetailPath(id));
  return normalizeOrganizationWidgetTypeConfigurationRecord(payload);
}

export async function createOrganizationWidgetTypeConfiguration(
  input: OrganizationWidgetTypeConfigurationMutationPayload,
) {
  const listPath = commandCenterConfig.widgetTypes.organizationConfigurationsListUrl.trim();

  if (!listPath || env.useMockData) {
    throw new Error("Organization widget type configuration create endpoint is not configured.");
  }

  const payload = await requestOrganizationWidgetTypeConfigurations<unknown>(listPath, {
    method: "POST",
    body: JSON.stringify({
      registered_widget_type: input.registeredWidgetType,
      config_json: cloneJson(input.configJson),
    }),
  });

  return normalizeOrganizationWidgetTypeConfigurationRecord(payload);
}

export async function updateOrganizationWidgetTypeConfiguration(
  id: string,
  input: OrganizationWidgetTypeConfigurationMutationPayload,
) {
  if (env.useMockData) {
    throw new Error("Organization widget type configuration update is unavailable in mock mode.");
  }

  const payload = await requestOrganizationWidgetTypeConfigurations<unknown>(buildDetailPath(id), {
    method: "PUT",
    body: JSON.stringify({
      registered_widget_type: input.registeredWidgetType,
      config_json: cloneJson(input.configJson),
    }),
  });

  return normalizeOrganizationWidgetTypeConfigurationRecord(payload);
}

export async function patchOrganizationWidgetTypeConfiguration(
  id: string,
  input: Pick<OrganizationWidgetTypeConfigurationMutationPayload, "configJson">,
) {
  if (env.useMockData) {
    throw new Error("Organization widget type configuration patch is unavailable in mock mode.");
  }

  const payload = await requestOrganizationWidgetTypeConfigurations<unknown>(buildDetailPath(id), {
    method: "PATCH",
    body: JSON.stringify({
      config_json: cloneJson(input.configJson),
    }),
  });

  return normalizeOrganizationWidgetTypeConfigurationRecord(payload);
}

export async function deleteOrganizationWidgetTypeConfiguration(id: string) {
  if (env.useMockData) {
    return;
  }

  await requestOrganizationWidgetTypeConfigurations<unknown>(buildDetailPath(id), {
    method: "DELETE",
  });
}
