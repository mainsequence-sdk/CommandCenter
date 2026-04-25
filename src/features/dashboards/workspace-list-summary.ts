import type { DashboardDefinition } from "@/dashboards/types";

export interface WorkspaceListItemSummary {
  id: string;
  title: string;
  description: string;
  labels: string[];
  source: string;
  updatedAt: string | null;
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

function readWorkspaceId(source: Record<string, unknown>) {
  return normalizeWorkspaceId(
    source.id ??
      source.pk ??
      source.uuid ??
      source.workspace_id ??
      source.workspaceId ??
      source.dashboard_id ??
      source.dashboardId,
  );
}

function readStringAlias(source: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
}

function coerceStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function coerceLabelArray(source: Record<string, unknown>) {
  return coerceStringArray(source.labels).length > 0
    ? coerceStringArray(source.labels)
    : coerceStringArray(source.tags);
}

function readUpdatedAt(source: Record<string, unknown>) {
  return readStringAlias(source, ["updatedAt", "updated_at", "modified_at", "modifiedAt"], "") || null;
}

export function summarizeDashboardForWorkspaceList(
  dashboard: Pick<DashboardDefinition, "id" | "title" | "description" | "labels" | "source">,
  options?: {
    updatedAt?: string | null;
  },
): WorkspaceListItemSummary {
  return {
    id: dashboard.id,
    title: dashboard.title,
    description: dashboard.description,
    labels: dashboard.labels ?? [],
    source: dashboard.source,
    updatedAt: options?.updatedAt ?? null,
  };
}

export function coerceWorkspaceListItemSummary(value: unknown): WorkspaceListItemSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  if (isRecord(value.workspace)) {
    const nestedSummary = coerceWorkspaceListItemSummary(value.workspace);
    return nestedSummary
      ? {
          ...nestedSummary,
          updatedAt: readUpdatedAt(value) ?? nestedSummary.updatedAt,
        }
      : null;
  }

  if (isRecord(value.dashboard)) {
    const nestedSummary = coerceWorkspaceListItemSummary(value.dashboard);
    return nestedSummary
      ? {
          ...nestedSummary,
          updatedAt: readUpdatedAt(value) ?? nestedSummary.updatedAt,
        }
      : null;
  }

  if (Array.isArray(value.widgets)) {
    const id = readWorkspaceId(value);

    if (!id) {
      return null;
    }

    return summarizeDashboardForWorkspaceList(
      {
        id,
        title: readStringAlias(value, ["title", "name", "display_name", "displayName"], "Workspace"),
        description: typeof value.description === "string" ? value.description : "",
        labels: coerceLabelArray(value),
        source: readStringAlias(value, ["source", "origin"], "user"),
      },
      {
        updatedAt: readUpdatedAt(value),
      },
    );
  }

  const id = readWorkspaceId(value);

  if (!id) {
    return null;
  }

  return {
    id,
    title: readStringAlias(value, ["title", "name", "display_name", "displayName"], "Workspace"),
    description: typeof value.description === "string" ? value.description : "",
    labels: coerceLabelArray(value),
    source: readStringAlias(value, ["source", "origin"], "user"),
    updatedAt: readUpdatedAt(value),
  };
}

function normalizeWorkspaceListEntries(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((entry) => coerceWorkspaceListItemSummary(entry))
        .filter((entry): entry is WorkspaceListItemSummary => entry !== null)
    : [];
}

export function normalizeWorkspaceListSummariesPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return normalizeWorkspaceListEntries(payload);
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.results)) {
    return normalizeWorkspaceListEntries(payload.results);
  }

  if (Array.isArray(payload.dashboards)) {
    return normalizeWorkspaceListEntries(payload.dashboards);
  }

  if (Array.isArray(payload.workspaces)) {
    return normalizeWorkspaceListEntries(payload.workspaces);
  }

  if (Array.isArray(payload.items)) {
    return normalizeWorkspaceListEntries(payload.items);
  }

  if (Array.isArray(payload.data)) {
    return normalizeWorkspaceListEntries(payload.data);
  }

  return [];
}
