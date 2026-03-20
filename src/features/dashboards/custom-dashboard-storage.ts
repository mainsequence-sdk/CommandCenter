import { resolveDashboardLayout } from "@/dashboards/layout";
import type {
  DashboardControlsState,
  DashboardDefinition,
  DashboardWidgetInstance,
  DashboardWidgetLegacyLayout,
  DashboardWidgetPlacement,
} from "@/dashboards/types";
import type { WidgetDefinition } from "@/widgets/types";

const STORAGE_PREFIX = "main-sequence.custom-dashboards";
const STORAGE_VERSION = 4;
const DEFAULT_WORKSPACE_COLUMNS = 96;
const DEFAULT_WORKSPACE_ROW_HEIGHT = 18;
const DEFAULT_WORKSPACE_GAP = 2;
const LEGACY_WORKSPACE_COLUMNS = 12;
const WORKSPACE_COLUMN_SCALE = DEFAULT_WORKSPACE_COLUMNS / LEGACY_WORKSPACE_COLUMNS;
const WORKSPACE_ROW_SCALE = 4;
const PREVIOUS_WORKSPACE_COLUMNS = 48;
const PREVIOUS_WORKSPACE_ROW_HEIGHT = 38;
const LEGACY_WORKSPACE_ROW_HEIGHT = 78;
const LEGACY_WORKSPACE_GAP = 8;

const DEFAULT_TIME_RANGE_OPTIONS = ["15m", "1h", "6h", "24h", "7d", "30d", "90d"] as const;
const DEFAULT_REFRESH_INTERVALS = [null, 10_000, 15_000, 30_000, 60_000] as const;

export interface UserDashboardCollection {
  version: number;
  dashboards: DashboardDefinition[];
  selectedDashboardId: string | null;
  savedAt: string | null;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}.${userId}`;
}

function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) {
    return `${prefix}-${uuid}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isLegacyLayout(
  layout: DashboardWidgetInstance["layout"],
): layout is DashboardWidgetLegacyLayout {
  return "w" in layout && "h" in layout;
}

function getLayoutCols(layout: DashboardWidgetInstance["layout"]) {
  return isLegacyLayout(layout) ? layout.w : layout.cols;
}

function getLayoutRows(layout: DashboardWidgetInstance["layout"]) {
  return isLegacyLayout(layout) ? layout.h : layout.rows;
}

function resolveWorkspaceRowScale(rawRowHeight: number) {
  if (rawRowHeight >= LEGACY_WORKSPACE_ROW_HEIGHT) {
    return WORKSPACE_ROW_SCALE;
  }

  if (rawRowHeight >= PREVIOUS_WORKSPACE_ROW_HEIGHT) {
    return 2;
  }

  return 1;
}

function scaleWidgetForFineGrid(
  instance: DashboardWidgetInstance,
  columnScale: number,
  rowScale: number,
) {
  if (columnScale === 1 && rowScale === 1) {
    return instance;
  }

  const cols = getLayoutCols(instance.layout);
  const rows = getLayoutRows(instance.layout);

  return {
    ...instance,
    layout: {
      cols: cols * columnScale,
      rows: rows * rowScale,
    },
    position: instance.position
      ? {
          x:
            typeof instance.position.x === "number"
              ? instance.position.x * columnScale
              : undefined,
          y:
            typeof instance.position.y === "number"
              ? instance.position.y * rowScale
              : undefined,
        }
      : undefined,
  };
}

export function ensureUserDashboardCollectionSelection(
  collection: UserDashboardCollection,
): UserDashboardCollection {
  const dashboards = collection.dashboards.length
    ? collection.dashboards
    : [createBlankDashboard()];

  const selectedDashboardId =
    collection.selectedDashboardId &&
    dashboards.some((dashboard) => dashboard.id === collection.selectedDashboardId)
      ? collection.selectedDashboardId
      : dashboards[0]?.id ?? null;

  return {
    ...collection,
    dashboards,
    selectedDashboardId,
  };
}

function sanitizeDashboard(dashboard: DashboardDefinition): DashboardDefinition {
  const rawColumns =
    typeof dashboard.grid?.columns === "number" && dashboard.grid.columns > 0
      ? dashboard.grid.columns
      : LEGACY_WORKSPACE_COLUMNS;
  const rawRowHeight =
    typeof dashboard.grid?.rowHeight === "number" && dashboard.grid.rowHeight > 0
      ? dashboard.grid.rowHeight
      : LEGACY_WORKSPACE_ROW_HEIGHT;
  const rawGap =
    typeof dashboard.grid?.gap === "number" && dashboard.grid.gap >= 0
      ? dashboard.grid.gap
      : LEGACY_WORKSPACE_GAP;
  const columnScale =
    rawColumns < DEFAULT_WORKSPACE_COLUMNS &&
    DEFAULT_WORKSPACE_COLUMNS % rawColumns === 0
      ? DEFAULT_WORKSPACE_COLUMNS / rawColumns
      : 1;
  const rowScale = resolveWorkspaceRowScale(rawRowHeight);
  const widgets = Array.isArray(dashboard.widgets)
    ? dashboard.widgets.map((instance) =>
        scaleWidgetForFineGrid(instance, columnScale, rowScale),
      )
    : [];

  return materializeDashboardLayout({
    ...dashboard,
    title: dashboard.title || "Untitled workspace",
    description: dashboard.description || "User-scoped custom workspace stored in local browser storage.",
    category: dashboard.category || "Custom",
    source: dashboard.source || "local-dev",
    widgets,
    controls: dashboard.controls ?? {
      enabled: true,
      timeRange: {
        enabled: true,
        defaultRange: "24h",
        options: [...DEFAULT_TIME_RANGE_OPTIONS],
      },
      refresh: {
        enabled: true,
        defaultIntervalMs: 60_000,
        intervals: [...DEFAULT_REFRESH_INTERVALS],
      },
      actions: {
        enabled: true,
        share: false,
        view: true,
      },
    },
    grid: {
      columns: Math.max(rawColumns * columnScale, DEFAULT_WORKSPACE_COLUMNS),
      rowHeight:
        rowScale > 1
          ? DEFAULT_WORKSPACE_ROW_HEIGHT
          : (dashboard.grid?.rowHeight ?? DEFAULT_WORKSPACE_ROW_HEIGHT),
      gap:
        columnScale > 1 || rawGap >= LEGACY_WORKSPACE_GAP
          ? DEFAULT_WORKSPACE_GAP
          : (dashboard.grid?.gap ?? DEFAULT_WORKSPACE_GAP),
    },
  });
}

export function cloneDashboardCollection(collection: UserDashboardCollection) {
  return cloneJson(collection);
}

export function materializeDashboardLayout(dashboard: DashboardDefinition): DashboardDefinition {
  const resolved = resolveDashboardLayout(dashboard);

  return {
    ...dashboard,
    grid: resolved.grid,
    widgets: resolved.widgets.map((instance) => ({
      ...instance,
      layout: {
        cols: instance.layout.w,
        rows: instance.layout.h,
      },
      position: {
        x: instance.layout.x,
        y: instance.layout.y,
      },
    })),
  };
}

export function createBlankDashboard(title = "My Workspace"): DashboardDefinition {
  return sanitizeDashboard({
    id: createId("custom-dashboard"),
    title,
    description: "User-scoped custom workspace stored in temporary local browser storage for development.",
    category: "Custom",
    source: "local-dev",
    grid: {
      columns: DEFAULT_WORKSPACE_COLUMNS,
      rowHeight: DEFAULT_WORKSPACE_ROW_HEIGHT,
      gap: DEFAULT_WORKSPACE_GAP,
    },
    controls: {
      enabled: true,
      timeRange: {
        enabled: true,
        defaultRange: "24h",
        options: [...DEFAULT_TIME_RANGE_OPTIONS],
      },
      refresh: {
        enabled: true,
        defaultIntervalMs: 60_000,
        intervals: [...DEFAULT_REFRESH_INTERVALS],
      },
      actions: {
        enabled: true,
        share: false,
        view: true,
      },
    },
    widgets: [],
  });
}

export const CUSTOM_WORKSPACE_COLUMN_SCALE = WORKSPACE_COLUMN_SCALE;
export const CUSTOM_WORKSPACE_ROW_SCALE = WORKSPACE_ROW_SCALE;

function buildDefaultCollection(): UserDashboardCollection {
  const dashboard = createBlankDashboard();

  return {
    version: STORAGE_VERSION,
    dashboards: [dashboard],
    selectedDashboardId: dashboard.id,
    savedAt: null,
  };
}

export function loadUserDashboardCollection(userId: string): UserDashboardCollection {
  if (!userId || !canUseLocalStorage()) {
    return buildDefaultCollection();
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey(userId));

    if (!rawValue) {
      return buildDefaultCollection();
    }

    const parsed = JSON.parse(rawValue) as Partial<UserDashboardCollection>;
    const dashboards = Array.isArray(parsed.dashboards)
      ? parsed.dashboards.map((dashboard) => sanitizeDashboard(dashboard))
      : [];

    return ensureUserDashboardCollectionSelection({
      version: STORAGE_VERSION,
      dashboards,
      selectedDashboardId:
        typeof parsed.selectedDashboardId === "string" ? parsed.selectedDashboardId : null,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
    });
  } catch {
    return buildDefaultCollection();
  }
}

export function saveUserDashboardCollection(
  userId: string,
  collection: UserDashboardCollection,
): UserDashboardCollection {
  const normalized = ensureUserDashboardCollectionSelection({
    version: STORAGE_VERSION,
    dashboards: collection.dashboards.map((dashboard) => sanitizeDashboard(dashboard)),
    selectedDashboardId: collection.selectedDashboardId,
    savedAt: new Date().toISOString(),
  });

  if (userId && canUseLocalStorage()) {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(normalized));
  }

  return normalized;
}

function buildWidgetInstance(
  widget: Pick<WidgetDefinition, "defaultSize" | "exampleProps" | "id" | "title">,
  position?: DashboardWidgetPlacement,
): DashboardWidgetInstance {
  return {
    id: createId("custom-widget"),
    widgetId: widget.id,
    title: widget.title,
    props: cloneJson(widget.exampleProps ?? {}),
    layout: {
      cols: Math.min(widget.defaultSize.w * WORKSPACE_COLUMN_SCALE, DEFAULT_WORKSPACE_COLUMNS),
      rows: widget.defaultSize.h * WORKSPACE_ROW_SCALE,
    },
    position,
  };
}

export function appendCatalogWidget(
  dashboard: DashboardDefinition,
  widget: Pick<WidgetDefinition, "defaultSize" | "exampleProps" | "id" | "title">,
) {
  return materializeDashboardLayout({
    ...dashboard,
    widgets: [...dashboard.widgets, buildWidgetInstance(widget)],
  });
}

export function placeCatalogWidget(
  dashboard: DashboardDefinition,
  widget: Pick<WidgetDefinition, "defaultSize" | "exampleProps" | "id" | "title">,
  position: DashboardWidgetPlacement,
) {
  return materializeDashboardLayout({
    ...dashboard,
    widgets: [buildWidgetInstance(widget, position), ...dashboard.widgets],
  });
}

export function moveDashboardWidget(
  dashboard: DashboardDefinition,
  instanceId: string,
  position: DashboardWidgetPlacement,
) {
  const current = dashboard.widgets.find((widget) => widget.id === instanceId);

  if (!current) {
    return dashboard;
  }

  return materializeDashboardLayout({
    ...dashboard,
    widgets: [
      {
        ...current,
        position,
      },
      ...dashboard.widgets.filter((widget) => widget.id !== instanceId),
    ],
  });
}

export function resizeDashboardWidget(
  dashboard: DashboardDefinition,
  instanceId: string,
  axis: "cols" | "rows",
  delta: number,
) {
  const maxColumns = dashboard.grid?.columns ?? DEFAULT_WORKSPACE_COLUMNS;

  return materializeDashboardLayout({
    ...dashboard,
    widgets: dashboard.widgets.map((widget) => {
      if (widget.id !== instanceId) {
        return widget;
      }

      const cols = "cols" in widget.layout ? widget.layout.cols : widget.layout.w;
      const rows = "rows" in widget.layout ? widget.layout.rows : widget.layout.h;

      return {
        ...widget,
        layout: {
          cols: axis === "cols" ? Math.max(1, Math.min(cols + delta, maxColumns)) : cols,
          rows: axis === "rows" ? Math.max(1, rows + delta) : rows,
        },
      };
    }),
  });
}

export function setDashboardWidgetGeometry(
  dashboard: DashboardDefinition,
  instanceId: string,
  geometry: {
    x?: number;
    y?: number;
    cols?: number;
    rows?: number;
  },
) {
  const maxColumns = dashboard.grid?.columns ?? DEFAULT_WORKSPACE_COLUMNS;

  return materializeDashboardLayout({
    ...dashboard,
    widgets: dashboard.widgets.map((widget) => {
      if (widget.id !== instanceId) {
        return widget;
      }

      const cols = getLayoutCols(widget.layout);
      const rows = getLayoutRows(widget.layout);

      return {
        ...widget,
        layout: {
          cols: Math.max(1, Math.min(geometry.cols ?? cols, maxColumns)),
          rows: Math.max(1, geometry.rows ?? rows),
        },
        position: {
          x: geometry.x ?? widget.position?.x,
          y: geometry.y ?? widget.position?.y,
        },
      };
    }),
  });
}

export function updateDashboardControlsState(
  dashboard: DashboardDefinition,
  state: DashboardControlsState,
) {
  const nextControls = {
    enabled: dashboard.controls?.enabled ?? true,
    timeRange: {
      enabled: dashboard.controls?.timeRange?.enabled ?? true,
      defaultRange: dashboard.controls?.timeRange?.defaultRange ?? "24h",
      options: dashboard.controls?.timeRange?.options ?? [...DEFAULT_TIME_RANGE_OPTIONS],
      selectedRange: state.timeRangeKey,
      customStartMs: state.timeRangeKey === "custom" ? state.rangeStartMs : undefined,
      customEndMs: state.timeRangeKey === "custom" ? state.rangeEndMs : undefined,
    },
    refresh: {
      enabled: dashboard.controls?.refresh?.enabled ?? true,
      defaultIntervalMs: dashboard.controls?.refresh?.defaultIntervalMs ?? 60_000,
      intervals: dashboard.controls?.refresh?.intervals ?? [...DEFAULT_REFRESH_INTERVALS],
      selectedIntervalMs: state.refreshIntervalMs,
    },
    actions: {
      enabled: dashboard.controls?.actions?.enabled ?? true,
      share: dashboard.controls?.actions?.share ?? false,
      view: dashboard.controls?.actions?.view ?? true,
    },
  };

  if (
    JSON.stringify(nextControls) === JSON.stringify(dashboard.controls ?? null)
  ) {
    return dashboard;
  }

  return {
    ...dashboard,
    controls: nextControls,
  };
}

export function updateDashboardWidgetSettings(
  dashboard: DashboardDefinition,
  instanceId: string,
  settings: {
    title?: string;
    props?: Record<string, unknown>;
  },
) {
  return materializeDashboardLayout({
    ...dashboard,
    widgets: dashboard.widgets.map((widget) => {
      if (widget.id !== instanceId) {
        return widget;
      }

      return {
        ...widget,
        title:
          "title" in settings
            ? (settings.title?.trim() ? settings.title.trim() : undefined)
            : widget.title,
        props:
          "props" in settings
            ? cloneJson(settings.props ?? {})
            : widget.props,
      };
    }),
  });
}

export function removeDashboardWidget(dashboard: DashboardDefinition, instanceId: string) {
  return materializeDashboardLayout({
    ...dashboard,
    widgets: dashboard.widgets.filter((widget) => widget.id !== instanceId),
  });
}
