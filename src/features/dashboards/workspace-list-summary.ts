import type { DashboardDefinition, DashboardTimeRangeKey } from "@/dashboards/types";

export type WorkspaceListRangeKey = DashboardTimeRangeKey | "custom";

export interface WorkspaceListItemSummary {
  id: string;
  title: string;
  description: string;
  labels: string[];
  source: string;
  widgetCount: number;
  selectedRange: WorkspaceListRangeKey;
  customStartMs: number | null;
  customEndMs: number | null;
  refreshIntervalMs: number | null;
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

function coerceNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function coerceRangeKey(value: unknown) {
  return typeof value === "string" && value.trim() ? (value as WorkspaceListRangeKey) : null;
}

export function summarizeDashboardForWorkspaceList(
  dashboard: Pick<DashboardDefinition, "id" | "title" | "description" | "labels" | "source" | "widgets" | "controls">,
  options?: {
    updatedAt?: string | null;
  },
): WorkspaceListItemSummary {
  const timeRange = dashboard.controls?.timeRange;
  const refresh = dashboard.controls?.refresh;

  return {
    id: dashboard.id,
    title: dashboard.title,
    description: dashboard.description,
    labels: dashboard.labels ?? [],
    source: dashboard.source,
    widgetCount: dashboard.widgets.length,
    selectedRange: (timeRange?.selectedRange ?? timeRange?.defaultRange ?? "24h") as WorkspaceListRangeKey,
    customStartMs: typeof timeRange?.customStartMs === "number" ? timeRange.customStartMs : null,
    customEndMs: typeof timeRange?.customEndMs === "number" ? timeRange.customEndMs : null,
    refreshIntervalMs:
      typeof refresh?.selectedIntervalMs === "number" || refresh?.selectedIntervalMs === null
        ? refresh.selectedIntervalMs
        : typeof refresh?.defaultIntervalMs === "number" || refresh?.defaultIntervalMs === null
          ? refresh.defaultIntervalMs
          : null,
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
        widgets: value.widgets as DashboardDefinition["widgets"],
        controls: isRecord(value.controls) ? (value.controls as DashboardDefinition["controls"]) : undefined,
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
    widgetCount: typeof value.widgetCount === "number" && Number.isFinite(value.widgetCount)
      ? Math.max(0, Math.round(value.widgetCount))
      : 0,
    selectedRange: coerceRangeKey(value.selectedRange) ?? "24h",
    customStartMs: coerceNumberOrNull(value.customStartMs),
    customEndMs: coerceNumberOrNull(value.customEndMs),
    refreshIntervalMs: coerceNumberOrNull(value.refreshIntervalMs),
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
