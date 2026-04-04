import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import type {
  DashboardCompanionLayoutItem,
  DashboardWidgetInstance,
  DashboardWidgetPlacement,
} from "@/dashboards/types";
import type {
  WidgetInstanceBindings,
  WidgetInstancePresentation,
  WidgetContractId,
  WidgetPortBinding,
} from "@/widgets/types";

const devAuthProxyPrefix = "/__command_center_auth__";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneJson<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
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

function normalizeSavedWidgetId(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function readContractId(value: unknown): WidgetContractId | undefined {
  return typeof value === "string" && value.trim()
    ? (value.trim() as WidgetContractId)
    : undefined;
}

function readOptionalRecord(value: unknown) {
  return isRecord(value) ? cloneJson(value) : undefined;
}

function readLayout(value: unknown): DashboardWidgetInstance["layout"] {
  if (!isRecord(value)) {
    return { cols: 12, rows: 8 };
  }

  const cols = typeof value.cols === "number" ? value.cols : typeof value.w === "number" ? value.w : 12;
  const rows = typeof value.rows === "number" ? value.rows : typeof value.h === "number" ? value.h : 8;

  return {
    cols: Math.max(1, Math.round(cols)),
    rows: Math.max(1, Math.round(rows)),
  };
}

function readPlacement(value: unknown): DashboardWidgetPlacement | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const x = typeof value.x === "number" ? value.x : undefined;
  const y = typeof value.y === "number" ? value.y : undefined;

  return x === undefined && y === undefined ? undefined : { x, y };
}

function readCompanions(value: unknown): DashboardCompanionLayoutItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || !isRecord(entry.layout)) {
      return [];
    }

    const instanceId = normalizeSavedWidgetId(entry.instanceId ?? entry.instance_id);
    const fieldId = typeof entry.fieldId === "string"
      ? entry.fieldId
      : typeof entry.field_id === "string"
        ? entry.field_id
        : null;

    if (!instanceId || !fieldId) {
      return [];
    }

    const x = typeof entry.layout.x === "number" ? entry.layout.x : 0;
    const y = typeof entry.layout.y === "number" ? entry.layout.y : 0;
    const w = typeof entry.layout.w === "number" ? entry.layout.w : 1;
    const h = typeof entry.layout.h === "number" ? entry.layout.h : 1;

    return [{
      id:
        typeof entry.id === "string" && entry.id.trim()
          ? entry.id
          : `widget-companion:${instanceId}:${fieldId}`,
      instanceId,
      fieldId,
      layout: {
        x: Math.max(0, Math.round(x)),
        y: Math.max(0, Math.round(y)),
        w: Math.max(1, Math.round(w)),
        h: Math.max(1, Math.round(h)),
      },
    } satisfies DashboardCompanionLayoutItem];
  });
}

class SavedWidgetBackendRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "SavedWidgetBackendRequestError";
    this.status = status;
    this.payload = payload;
  }
}

async function requestSavedWidgetBackend(path: string, init?: RequestInit) {
  const session = useAuthStore.getState().session;
  const headers = new Headers(init?.headers);

  headers.set("Accept", "application/json");

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  const response = await fetch(buildEndpointUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    throw new SavedWidgetBackendRequestError(
      response.status,
      payload,
      typeof payload === "string" && payload.trim()
        ? payload
        : `Saved widget backend request failed (${response.status}).`,
    );
  }

  return payload;
}

export interface SavedWidgetInstanceSummary {
  id: string;
  title: string;
  description: string;
  labels: string[];
  source: string;
  category: string;
  widgetTypeId: string;
  instanceTitle: string;
  updatedAt: string | null;
}

export interface SavedWidgetInstanceRecord extends SavedWidgetInstanceSummary {
  schemaVersion: number;
  props?: Record<string, unknown>;
  presentation?: WidgetInstancePresentation;
  bindings?: WidgetInstanceBindings;
  row?: DashboardWidgetInstance["row"];
  layout: DashboardWidgetInstance["layout"];
  position?: DashboardWidgetPlacement;
  companions: DashboardCompanionLayoutItem[];
  requiredPermissions: string[];
}

export interface SavedWidgetGroupBindingPayload
  extends Omit<WidgetPortBinding, "sourceWidgetId"> {}

export interface SavedWidgetGroupBindingRecord {
  id: string;
  sourceMemberKey: string;
  targetMemberKey: string;
  inputId: string;
  bindingPayload?: SavedWidgetGroupBindingPayload;
}

export interface SavedWidgetGroupMemberRecord {
  id: string;
  memberKey: string;
  sortOrder: number;
  layoutOverride?: Record<string, unknown>;
  widgetInstance: SavedWidgetInstanceRecord;
}

export interface SavedWidgetGroupSummary {
  id: string;
  title: string;
  description: string;
  labels: string[];
  source: string;
  category: string;
  memberCount: number;
  updatedAt: string | null;
}

export interface SavedWidgetGroupRecord extends SavedWidgetGroupSummary {
  schemaVersion: number;
  requiredPermissions: string[];
  members: SavedWidgetGroupMemberRecord[];
  bindings: SavedWidgetGroupBindingRecord[];
}

export interface SavedWidgetInstanceMutationPayload {
  title: string;
  description?: string;
  labels?: string[];
  category?: string;
  source?: string;
  schemaVersion?: number;
  widgetTypeId: string;
  instanceTitle?: string;
  props?: Record<string, unknown>;
  presentation?: WidgetInstancePresentation;
  bindings?: WidgetInstanceBindings;
  row?: DashboardWidgetInstance["row"];
  layout: DashboardWidgetInstance["layout"];
  position?: DashboardWidgetPlacement;
  companions?: DashboardCompanionLayoutItem[];
  requiredPermissions?: string[];
}

export interface SavedWidgetGroupMemberWidgetSnapshotPayload {
  title: string;
  description?: string;
  labels?: string[];
  category?: string;
  source?: string;
  schemaVersion?: number;
  widgetTypeId: string;
  instanceTitle?: string;
  props?: Record<string, unknown>;
  presentation?: WidgetInstancePresentation;
  row?: DashboardWidgetInstance["row"];
  layout: DashboardWidgetInstance["layout"];
  position?: DashboardWidgetPlacement;
  companions?: DashboardCompanionLayoutItem[];
  requiredPermissions?: string[];
}

export interface SavedWidgetGroupMemberMutationPayload {
  memberKey: string;
  sortOrder: number;
  layoutOverride?: Record<string, unknown>;
  widgetInstance: SavedWidgetGroupMemberWidgetSnapshotPayload;
}

export interface SavedWidgetGroupBindingMutationPayload {
  sourceMemberKey: string;
  targetMemberKey: string;
  inputId: string;
  bindingPayload?: SavedWidgetGroupBindingPayload;
}

export interface SavedWidgetGroupMutationPayload {
  title: string;
  description?: string;
  labels?: string[];
  category?: string;
  source?: string;
  schemaVersion?: number;
  requiredPermissions?: string[];
  members: SavedWidgetGroupMemberMutationPayload[];
  bindings?: SavedWidgetGroupBindingMutationPayload[];
}

function normalizeSavedWidgetInstanceSummary(value: unknown): SavedWidgetInstanceSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const nested = isRecord(value.widget_instance)
    ? value.widget_instance
    : isRecord(value.widget)
      ? value.widget
      : value;
  const id = normalizeSavedWidgetId(value.id ?? nested.id);
  const widgetTypeId = readString(
    nested.widgetTypeId ??
      nested.widget_type_id ??
      nested.widgetId ??
      nested.widget_id,
  ).trim();

  if (!id || !widgetTypeId) {
    return null;
  }

  return {
    id,
    title: readString(value.title ?? nested.title, "Saved widget"),
    description: readString(value.description ?? nested.description, ""),
    labels: readStringArray(value.labels ?? nested.labels),
    source: readString(value.source ?? nested.source, "user"),
    category: readString(value.category ?? nested.category, "Custom"),
    widgetTypeId,
    instanceTitle: readString(nested.instanceTitle ?? nested.instance_title ?? nested.title, ""),
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : typeof value.updated_at === "string"
          ? value.updated_at
          : typeof nested.updatedAt === "string"
            ? nested.updatedAt
            : typeof nested.updated_at === "string"
              ? nested.updated_at
              : null,
  };
}

function normalizeSavedWidgetInstanceRecord(value: unknown): SavedWidgetInstanceRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const nested = isRecord(value.widget_instance)
    ? value.widget_instance
    : isRecord(value.widget)
      ? value.widget
      : value;
  const summary = normalizeSavedWidgetInstanceSummary(value);

  if (!summary) {
    return null;
  }

  return {
    ...summary,
    schemaVersion:
      typeof value.schemaVersion === "number"
        ? value.schemaVersion
        : typeof value.schema_version === "number"
          ? value.schema_version
          : typeof nested.schemaVersion === "number"
            ? nested.schemaVersion
            : typeof nested.schema_version === "number"
              ? nested.schema_version
              : 1,
    props: readOptionalRecord(nested.props),
    presentation: readOptionalRecord(nested.presentation) as WidgetInstancePresentation | undefined,
    bindings: readOptionalRecord(nested.bindings) as WidgetInstanceBindings | undefined,
    row: readOptionalRecord(nested.row) as DashboardWidgetInstance["row"] | undefined,
    layout: readLayout(nested.layout),
    position: readPlacement(nested.position),
    companions: readCompanions(nested.companions),
    requiredPermissions: readStringArray(
      nested.requiredPermissions ?? nested.required_permissions,
    ),
  };
}

function normalizeSavedWidgetGroupBindingRecord(
  value: unknown,
): SavedWidgetGroupBindingRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceMemberKey = readString(
    value.sourceMemberKey ?? value.source_member_key ?? value.source_member,
  ).trim();
  const targetMemberKey = readString(
    value.targetMemberKey ?? value.target_member_key ?? value.target_member,
  ).trim();
  const inputId = readString(value.inputId ?? value.input_id).trim();

  if (!sourceMemberKey || !targetMemberKey || !inputId) {
    return null;
  }

  const rawBindingPayload = value.bindingPayload ?? value.binding_payload;
  const sourceOutputId = isRecord(rawBindingPayload)
    ? typeof rawBindingPayload.sourceOutputId === "string"
      ? rawBindingPayload.sourceOutputId
      : typeof rawBindingPayload.source_output_id === "string"
        ? rawBindingPayload.source_output_id
        : undefined
    : undefined;
  const bindingPayload = sourceOutputId
    ? {
        sourceOutputId,
        transformId:
          isRecord(rawBindingPayload) && typeof rawBindingPayload.transformId === "string"
            ? rawBindingPayload.transformId
            : isRecord(rawBindingPayload) && typeof rawBindingPayload.transform_id === "string"
              ? rawBindingPayload.transform_id
              : undefined,
        transformPath:
          isRecord(rawBindingPayload) && Array.isArray(rawBindingPayload.transformPath)
            ? rawBindingPayload.transformPath.filter((entry): entry is string => typeof entry === "string")
            : isRecord(rawBindingPayload) && Array.isArray(rawBindingPayload.transform_path)
              ? rawBindingPayload.transform_path.filter((entry): entry is string => typeof entry === "string")
              : undefined,
        transformContractId:
          isRecord(rawBindingPayload)
            ? readContractId(
                rawBindingPayload.transformContractId ??
                  rawBindingPayload.transform_contract_id,
              )
            : undefined,
      } satisfies SavedWidgetGroupBindingPayload
    : undefined;

  return {
    id:
      normalizeSavedWidgetId(value.id) ??
      `${sourceMemberKey}:${targetMemberKey}:${inputId}`,
    sourceMemberKey,
    targetMemberKey,
    inputId,
    bindingPayload,
  };
}

function normalizeSavedWidgetGroupMemberRecord(
  value: unknown,
): SavedWidgetGroupMemberRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const widgetInstance = normalizeSavedWidgetInstanceRecord(
    value.widgetInstance ?? value.widget_instance ?? value.saved_widget_instance,
  );
  const memberKey = readString(value.memberKey ?? value.member_key ?? value.alias).trim();

  if (!widgetInstance || !memberKey) {
    return null;
  }

  return {
    id: normalizeSavedWidgetId(value.id) ?? memberKey,
    memberKey,
    sortOrder:
      typeof value.sortOrder === "number"
        ? value.sortOrder
        : typeof value.sort_order === "number"
          ? value.sort_order
          : 0,
    layoutOverride: readOptionalRecord(value.layoutOverride ?? value.layout_override),
    widgetInstance,
  };
}

function normalizeSavedWidgetGroupSummary(value: unknown): SavedWidgetGroupSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeSavedWidgetId(value.id);

  if (!id) {
    return null;
  }

  const membersValue =
    value.members ?? value.group_members ?? value.widgets ?? value.saved_widget_instances;
  const explicitMemberCount =
    readFiniteNumber(value.memberCount) ??
    readFiniteNumber(value.member_count) ??
    readFiniteNumber(value.membersCount) ??
    readFiniteNumber(value.members_count) ??
    readFiniteNumber(value.widgetsCount) ??
    readFiniteNumber(value.widgets_count) ??
    readFiniteNumber(value.groupMembersCount) ??
    readFiniteNumber(value.group_members_count) ??
    readFiniteNumber(value.savedWidgetInstancesCount) ??
    readFiniteNumber(value.saved_widget_instances_count);

  return {
    id,
    title: readString(value.title, "Saved widget group"),
    description: readString(value.description, ""),
    labels: readStringArray(value.labels),
    source: readString(value.source, "user"),
    category: readString(value.category, "Custom"),
    memberCount:
      explicitMemberCount !== null
        ? Math.max(0, Math.trunc(explicitMemberCount))
        : Array.isArray(membersValue)
          ? membersValue.length
          : 0,
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : typeof value.updated_at === "string"
          ? value.updated_at
          : null,
  };
}

function normalizeSavedWidgetGroupRecord(value: unknown): SavedWidgetGroupRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const summary = normalizeSavedWidgetGroupSummary(value);

  if (!summary) {
    return null;
  }

  const membersValue =
    value.members ?? value.group_members ?? value.widgets ?? value.saved_widget_instances;
  const bindingsValue = value.bindings ?? value.group_bindings;

  return {
    ...summary,
    schemaVersion:
      typeof value.schemaVersion === "number"
        ? value.schemaVersion
        : typeof value.schema_version === "number"
          ? value.schema_version
          : 1,
    requiredPermissions: readStringArray(
      value.requiredPermissions ?? value.required_permissions,
    ),
    members: Array.isArray(membersValue)
      ? membersValue
          .map((entry) => normalizeSavedWidgetGroupMemberRecord(entry))
          .filter((entry): entry is SavedWidgetGroupMemberRecord => entry !== null)
      : [],
    bindings: Array.isArray(bindingsValue)
      ? bindingsValue
          .map((entry) => normalizeSavedWidgetGroupBindingRecord(entry))
          .filter((entry): entry is SavedWidgetGroupBindingRecord => entry !== null)
      : [],
  };
}

function normalizeListPayload<T>(
  payload: unknown,
  normalizer: (value: unknown) => T | null,
  candidateKeys: string[],
) {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => normalizer(entry))
      .filter((entry): entry is T => entry !== null);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const candidateArrays = [
    ...candidateKeys.map((key) => payload[key]),
  ];

  for (const candidate of candidateArrays) {
    if (Array.isArray(candidate)) {
      return candidate
        .map((entry) => normalizer(entry))
        .filter((entry): entry is T => entry !== null);
    }
  }

  return [];
}

function resolveDetailPath(template: string, id: string) {
  const encodedId = encodeURIComponent(id);

  if (template.includes("{id}")) {
    return template.replace(/\{id\}/g, encodedId);
  }

  if (template.includes(":id")) {
    return template.replace(/:id/g, encodedId);
  }

  return template.endsWith("/") ? `${template}${encodedId}/` : `${template}/${encodedId}/`;
}

function serializeSavedWidgetInstanceMutationPayload(payload: SavedWidgetInstanceMutationPayload) {
  return JSON.stringify({
    title: payload.title,
    description: payload.description ?? "",
    labels: payload.labels ?? [],
    category: payload.category ?? "Custom",
    source: payload.source ?? "user",
    schema_version: payload.schemaVersion ?? 1,
    widget_id: payload.widgetTypeId,
    instance_title: payload.instanceTitle ?? "",
    props: payload.props ?? {},
    presentation: payload.presentation ?? {},
    bindings: payload.bindings ?? {},
    row: payload.row ?? null,
    layout: payload.layout,
    position: payload.position ?? null,
    companions: payload.companions ?? [],
    required_permissions: payload.requiredPermissions ?? [],
  });
}

function serializeSavedWidgetGroupMutationPayload(payload: SavedWidgetGroupMutationPayload) {
  return JSON.stringify({
    title: payload.title,
    description: payload.description ?? "",
    labels: payload.labels ?? [],
    category: payload.category ?? "Custom",
    source: payload.source ?? "user",
    schema_version: payload.schemaVersion ?? 1,
    required_permissions: payload.requiredPermissions ?? [],
    members: payload.members.map((member) => ({
      member_key: member.memberKey,
      sort_order: member.sortOrder,
      layout_override: member.layoutOverride ?? null,
      widget_instance: {
        title: member.widgetInstance.title,
        description: member.widgetInstance.description ?? "",
        labels: member.widgetInstance.labels ?? [],
        category: member.widgetInstance.category ?? "Custom",
        source: member.widgetInstance.source ?? "user",
        schema_version: member.widgetInstance.schemaVersion ?? 1,
        widget_id: member.widgetInstance.widgetTypeId,
        instance_title: member.widgetInstance.instanceTitle ?? "",
        props: member.widgetInstance.props ?? {},
        presentation: member.widgetInstance.presentation ?? {},
        row: member.widgetInstance.row ?? null,
        layout: member.widgetInstance.layout,
        position: member.widgetInstance.position ?? null,
        companions: member.widgetInstance.companions ?? [],
        required_permissions: member.widgetInstance.requiredPermissions ?? [],
      },
    })),
    bindings: (payload.bindings ?? []).map((binding) => ({
      source_member_key: binding.sourceMemberKey,
      target_member_key: binding.targetMemberKey,
      input_id: binding.inputId,
      binding_payload: binding.bindingPayload
        ? {
            source_output_id: binding.bindingPayload.sourceOutputId,
            transform_id: binding.bindingPayload.transformId ?? null,
            transform_path: binding.bindingPayload.transformPath ?? null,
            transform_contract_id: binding.bindingPayload.transformContractId ?? null,
          }
        : null,
    })),
  });
}

export function hasConfiguredSavedWidgetsBackend() {
  return Boolean(
    commandCenterConfig.savedWidgets.instancesListUrl.trim() &&
    commandCenterConfig.savedWidgets.instancesDetailUrl.trim() &&
    commandCenterConfig.savedWidgets.groupsListUrl.trim() &&
    commandCenterConfig.savedWidgets.groupsDetailUrl.trim(),
  );
}

export async function fetchSavedWidgetInstancesFromBackend() {
  const listPath = commandCenterConfig.savedWidgets.instancesListUrl.trim();

  if (!listPath) {
    throw new Error("Saved widget instances endpoint is not configured.");
  }

  const payload = await requestSavedWidgetBackend(listPath);
  return normalizeListPayload(
    payload,
    normalizeSavedWidgetInstanceSummary,
    ["results", "rows", "items", "saved_widget_instances", "instances"],
  );
}

export async function fetchSavedWidgetInstanceDetailFromBackend(id: string) {
  const detailPath = commandCenterConfig.savedWidgets.instancesDetailUrl.trim();

  if (!detailPath) {
    throw new Error("Saved widget instance detail endpoint is not configured.");
  }

  const payload = await requestSavedWidgetBackend(resolveDetailPath(detailPath, id));
  const record = normalizeSavedWidgetInstanceRecord(payload);

  if (!record) {
    throw new Error(`Saved widget instance ${id} detail response was invalid.`);
  }

  return record;
}

export async function createSavedWidgetInstanceInBackend(
  payload: SavedWidgetInstanceMutationPayload,
) {
  const listPath = commandCenterConfig.savedWidgets.instancesListUrl.trim();

  if (!listPath) {
    throw new Error("Saved widget instances endpoint is not configured.");
  }

  const response = await requestSavedWidgetBackend(listPath, {
    method: "POST",
    body: serializeSavedWidgetInstanceMutationPayload(payload),
  });
  const record = normalizeSavedWidgetInstanceRecord(response);

  if (!record) {
    throw new Error("Saved widget instance create response was invalid.");
  }

  return record;
}

export async function updateSavedWidgetInstanceInBackend(
  id: string,
  payload: SavedWidgetInstanceMutationPayload,
) {
  const detailPath = commandCenterConfig.savedWidgets.instancesDetailUrl.trim();

  if (!detailPath) {
    throw new Error("Saved widget instance detail endpoint is not configured.");
  }

  const response = await requestSavedWidgetBackend(resolveDetailPath(detailPath, id), {
    method: "PUT",
    body: serializeSavedWidgetInstanceMutationPayload(payload),
  });
  const record = normalizeSavedWidgetInstanceRecord(response);

  if (!record) {
    throw new Error("Saved widget instance update response was invalid.");
  }

  return record;
}

export async function deleteSavedWidgetInstanceInBackend(id: string) {
  const detailPath = commandCenterConfig.savedWidgets.instancesDetailUrl.trim();

  if (!detailPath) {
    throw new Error("Saved widget instance detail endpoint is not configured.");
  }

  await requestSavedWidgetBackend(resolveDetailPath(detailPath, id), {
    method: "DELETE",
  });
}

export async function fetchSavedWidgetGroupsFromBackend() {
  const listPath = commandCenterConfig.savedWidgets.groupsListUrl.trim();

  if (!listPath) {
    throw new Error("Saved widget groups endpoint is not configured.");
  }

  const payload = await requestSavedWidgetBackend(listPath);
  return normalizeListPayload(
    payload,
    normalizeSavedWidgetGroupSummary,
    ["results", "rows", "items", "saved_widget_groups", "groups"],
  );
}

export async function fetchSavedWidgetGroupDetailFromBackend(id: string) {
  const detailPath = commandCenterConfig.savedWidgets.groupsDetailUrl.trim();

  if (!detailPath) {
    throw new Error("Saved widget group detail endpoint is not configured.");
  }

  const payload = await requestSavedWidgetBackend(resolveDetailPath(detailPath, id));
  const record = normalizeSavedWidgetGroupRecord(payload);

  if (!record) {
    throw new Error(`Saved widget group ${id} detail response was invalid.`);
  }

  return record;
}

export async function createSavedWidgetGroupInBackend(
  payload: SavedWidgetGroupMutationPayload,
) {
  const listPath = commandCenterConfig.savedWidgets.groupsListUrl.trim();

  if (!listPath) {
    throw new Error("Saved widget groups endpoint is not configured.");
  }

  const response = await requestSavedWidgetBackend(listPath, {
    method: "POST",
    body: serializeSavedWidgetGroupMutationPayload(payload),
  });
  const record = normalizeSavedWidgetGroupRecord(response);

  if (!record) {
    throw new Error("Saved widget group create response was invalid.");
  }

  return record;
}

export async function updateSavedWidgetGroupInBackend(
  id: string,
  payload: SavedWidgetGroupMutationPayload,
) {
  const detailPath = commandCenterConfig.savedWidgets.groupsDetailUrl.trim();

  if (!detailPath) {
    throw new Error("Saved widget group detail endpoint is not configured.");
  }

  const response = await requestSavedWidgetBackend(resolveDetailPath(detailPath, id), {
    method: "PUT",
    body: serializeSavedWidgetGroupMutationPayload(payload),
  });
  const record = normalizeSavedWidgetGroupRecord(response);

  if (!record) {
    throw new Error("Saved widget group update response was invalid.");
  }

  return record;
}

export async function deleteSavedWidgetGroupInBackend(id: string) {
  const detailPath = commandCenterConfig.savedWidgets.groupsDetailUrl.trim();

  if (!detailPath) {
    throw new Error("Saved widget group detail endpoint is not configured.");
  }

  await requestSavedWidgetBackend(resolveDetailPath(detailPath, id), {
    method: "DELETE",
  });
}
