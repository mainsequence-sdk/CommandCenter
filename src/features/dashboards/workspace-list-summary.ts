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

function coerceStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
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

  if (Array.isArray(value.widgets)) {
    const id = normalizeWorkspaceId(value.id);

    if (!id) {
      return null;
    }

    return summarizeDashboardForWorkspaceList(
      {
        id,
        title: typeof value.title === "string" && value.title.trim() ? value.title : "Workspace",
        description: typeof value.description === "string" ? value.description : "",
        labels: coerceStringArray(value.labels),
        source: typeof value.source === "string" && value.source.trim() ? value.source : "user",
      },
      {
        updatedAt:
          typeof value.updatedAt === "string" && value.updatedAt.trim()
            ? value.updatedAt
            : typeof value.updated_at === "string" && value.updated_at.trim()
              ? value.updated_at
              : null,
      },
    );
  }

  const id = normalizeWorkspaceId(value.id);

  if (!id) {
    return null;
  }

  return {
    id,
    title: typeof value.title === "string" && value.title.trim() ? value.title : "Workspace",
    description: typeof value.description === "string" ? value.description : "",
    labels: coerceStringArray(value.labels),
    source: typeof value.source === "string" && value.source.trim() ? value.source : "user",
    updatedAt:
      typeof value.updatedAt === "string" && value.updatedAt.trim()
        ? value.updatedAt
        : typeof value.updated_at === "string" && value.updated_at.trim()
          ? value.updated_at
          : null,
  };
}

export function normalizeWorkspaceListSummariesPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => coerceWorkspaceListItemSummary(entry))
      .filter((entry): entry is WorkspaceListItemSummary => entry !== null);
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.results)) {
    return payload.results
      .map((entry) => coerceWorkspaceListItemSummary(entry))
      .filter((entry): entry is WorkspaceListItemSummary => entry !== null);
  }

  if (Array.isArray(payload.dashboards)) {
    return payload.dashboards
      .map((entry) => coerceWorkspaceListItemSummary(entry))
      .filter((entry): entry is WorkspaceListItemSummary => entry !== null);
  }

  return [];
}
