import { resolveDashboardLayout } from "@/dashboards/layout";
import {
  applyGridLayoutToDashboardWidgets,
  sortWidgetsByGridOrder,
  type WorkspaceGridLayoutItem,
} from "@/dashboards/react-grid-layout-adapter";
import {
  getExpandedWorkspaceRowChildren,
  isWorkspaceRowCollapsed,
  isWorkspaceRowWidgetId,
  WORKSPACE_ROW_HEIGHT_ROWS,
} from "@/dashboards/structural-widgets";
import type {
  DashboardControlsState,
  DashboardDefinition,
  DashboardWidgetRowState,
  DashboardWidgetInstance,
  DashboardWidgetLegacyLayout,
  DashboardWidgetPlacement,
} from "@/dashboards/types";
import type { WidgetDefinition } from "@/widgets/types";
import { resolveDefaultWidgetPresentation } from "@/widgets/shared/widget-schema";

const STORAGE_PREFIX = "main-sequence.custom-dashboards";
const STORAGE_VERSION = 4;
const WORKSPACE_SNAPSHOT_SCHEMA = "mainsequence.workspace";
const WORKSPACE_SNAPSHOT_VERSION = 1;
const DEFAULT_WORKSPACE_COLUMNS = 96;
const DEFAULT_WORKSPACE_ROW_HEIGHT = 18;
const DEFAULT_WORKSPACE_GAP = 2;
const LEGACY_WORKSPACE_COLUMNS = 12;
const WORKSPACE_COLUMN_SCALE = DEFAULT_WORKSPACE_COLUMNS / LEGACY_WORKSPACE_COLUMNS;
const WORKSPACE_ROW_SCALE = 4;
const WORKSPACE_WIDGET_SPAWN_COLUMN_SCALE = 0.75;
const WORKSPACE_WIDGET_SPAWN_ROW_SCALE = 0.5;
const MAX_WORKSPACE_WIDGET_SPAWN_COLS = 12;
const MAX_WORKSPACE_WIDGET_SPAWN_ROWS = 6;
const PREVIOUS_WORKSPACE_COLUMNS = 48;
const PREVIOUS_WORKSPACE_ROW_HEIGHT = 38;
const LEGACY_WORKSPACE_ROW_HEIGHT = 78;
const LEGACY_WORKSPACE_GAP = 8;
const MIN_WORKSPACE_WIDGET_COLS = 4;
const MIN_WORKSPACE_WIDGET_ROWS = 3;

const DEFAULT_TIME_RANGE_OPTIONS = ["15m", "1h", "6h", "24h", "7d", "30d", "90d"] as const;
const DEFAULT_REFRESH_INTERVAL_MS = 300_000;
const DEFAULT_REFRESH_INTERVALS = [
  null,
  30_000,
  60_000,
  300_000,
  600_000,
  3_600_000,
] as const;

export interface UserDashboardCollection {
  version: number;
  dashboards: DashboardDefinition[];
  selectedDashboardId: string | null;
  savedAt: string | null;
}

export interface WorkspaceSnapshot {
  schema: typeof WORKSPACE_SNAPSHOT_SCHEMA;
  version: typeof WORKSPACE_SNAPSHOT_VERSION;
  exportedAt: string;
  workspace: DashboardDefinition;
}

export interface ParsedWorkspaceSnapshot {
  error: string | null;
  snapshot: WorkspaceSnapshot | null;
  sourceFormat: "snapshot" | "raw" | null;
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function normalizeWorkspaceLabels(labels: string[] | undefined) {
  if (!Array.isArray(labels)) {
    return [];
  }

  return Array.from(
    new Set(
      labels
        .map((label) => label.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

function normalizeWidgetRuntimeState(
  runtimeState: Record<string, unknown> | undefined,
) {
  if (!isPlainRecord(runtimeState)) {
    return undefined;
  }

  return cloneJson(runtimeState);
}

function normalizeDashboardRowState(
  rowState: DashboardWidgetRowState | undefined,
  columnScale: number,
  rowScale: number,
): DashboardWidgetRowState | undefined {
  if (!isPlainRecord(rowState)) {
    return undefined;
  }

  const legacyRowState = rowState as DashboardWidgetRowState & {
    panels?: DashboardWidgetInstance[];
  };
  const rawChildren: DashboardWidgetInstance[] = Array.isArray(rowState.children)
    ? rowState.children
    : Array.isArray(legacyRowState.panels)
      ? legacyRowState.panels
      : [];
  const children = rawChildren.map((child) =>
    normalizeDashboardWidgetInstance(child, columnScale, rowScale),
  );

  return {
    collapsed: rowState.collapsed === true,
    children,
  };
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

function clampWidgetMinimumLayout(
  widget: DashboardWidgetInstance,
  maxColumns: number,
): DashboardWidgetInstance {
  const nextWidget = isWorkspaceRowWidgetId(widget.widgetId)
    ? {
        ...widget,
        layout: {
          cols: maxColumns,
          rows: WORKSPACE_ROW_HEIGHT_ROWS,
        },
        position: {
          x: 0,
          y: widget.position?.y,
        },
      }
    : (() => {
        const cols = Math.min(
          Math.max(getLayoutCols(widget.layout), MIN_WORKSPACE_WIDGET_COLS),
          maxColumns,
        );
        const rows = Math.max(getLayoutRows(widget.layout), MIN_WORKSPACE_WIDGET_ROWS);
        const currentX = widget.position?.x;

        return {
          ...widget,
          layout: {
            cols,
            rows,
          },
          position: widget.position
            ? {
                x:
                  typeof currentX === "number"
                    ? Math.max(0, Math.min(currentX, Math.max(0, maxColumns - cols)))
                    : undefined,
                y: widget.position.y,
              }
            : undefined,
        };
      })();

  if (!nextWidget.row?.children?.length) {
    return nextWidget;
  }

  return {
    ...nextWidget,
    row: {
      ...nextWidget.row,
      children: nextWidget.row.children.map((child) =>
        clampWidgetMinimumLayout(child, maxColumns),
      ),
    },
  };
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

function normalizeDashboardWidgetInstance(
  instance: DashboardWidgetInstance,
  columnScale: number,
  rowScale: number,
): DashboardWidgetInstance {
  const scaled = scaleWidgetForFineGrid(
    {
      ...instance,
      runtimeState: normalizeWidgetRuntimeState(instance.runtimeState),
    },
    columnScale,
    rowScale,
  );

  const normalizedRowState = isWorkspaceRowWidgetId(instance.widgetId)
    ? normalizeDashboardRowState(instance.row, columnScale, rowScale) ?? {
        collapsed: false,
        children: [],
      }
    : undefined;

  return normalizedRowState
    ? {
        ...scaled,
        row: normalizedRowState,
      }
    : {
        ...scaled,
        row: undefined,
      };
}

export function ensureUserDashboardCollectionSelection(
  collection: UserDashboardCollection,
  options?: {
    allowEmpty?: boolean;
  },
): UserDashboardCollection {
  const allowEmpty = options?.allowEmpty ?? false;
  const dashboards = collection.dashboards.length
    ? collection.dashboards
    : (allowEmpty ? [] : [createBlankDashboard()]);

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
        normalizeDashboardWidgetInstance(instance, columnScale, rowScale),
      )
    : [];

  return materializeDashboardLayout({
    ...dashboard,
    title: dashboard.title || "Untitled workspace",
    description: dashboard.description || "User-scoped workspace managed in Command Center.",
    labels: normalizeWorkspaceLabels(dashboard.labels),
    category: dashboard.category || "Custom",
    source: dashboard.source || "user",
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
        defaultIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
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

export function normalizeDashboardDefinition(dashboard: DashboardDefinition) {
  return sanitizeDashboard(dashboard);
}

export function cloneDashboardCollection(collection: UserDashboardCollection) {
  return cloneJson(collection);
}

export function materializeDashboardLayout(dashboard: DashboardDefinition): DashboardDefinition {
  const maxColumns = dashboard.grid?.columns ?? DEFAULT_WORKSPACE_COLUMNS;
  const resolved = resolveDashboardLayout({
    ...dashboard,
    widgets: dashboard.widgets.map((widget) => clampWidgetMinimumLayout(widget, maxColumns)),
  });

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
    description: "User-scoped workspace managed in Command Center.",
    labels: [],
    category: "Custom",
    source: "user",
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
        defaultIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
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

export function normalizeUserDashboardCollection(
  collection: Partial<UserDashboardCollection> | null | undefined,
  options?: {
    fallbackSavedAt?: string | null;
    allowEmpty?: boolean;
  },
): UserDashboardCollection {
  const source = collection ?? {};

  return ensureUserDashboardCollectionSelection({
    version: STORAGE_VERSION,
    dashboards: Array.isArray(source.dashboards)
      ? source.dashboards.map((dashboard) => sanitizeDashboard(dashboard))
      : [],
    selectedDashboardId:
      typeof source.selectedDashboardId === "string" ? source.selectedDashboardId : null,
    savedAt:
      typeof source.savedAt === "string"
        ? source.savedAt
        : (options?.fallbackSavedAt ?? null),
  }, {
    allowEmpty: options?.allowEmpty ?? false,
  });
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

    return normalizeUserDashboardCollection(JSON.parse(rawValue) as Partial<UserDashboardCollection>);
  } catch {
    return buildDefaultCollection();
  }
}

export function saveUserDashboardCollection(
  userId: string,
  collection: UserDashboardCollection,
): UserDashboardCollection {
  const normalized = normalizeUserDashboardCollection(collection, {
    fallbackSavedAt: new Date().toISOString(),
  });

  if (userId && canUseLocalStorage()) {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(normalized));
  }

  return normalized;
}

function looksLikeDashboardDefinition(value: unknown): value is DashboardDefinition {
  return isPlainRecord(value) && Array.isArray(value.widgets);
}

function buildWidgetInstance(
  widget: Pick<
    WidgetDefinition,
    "defaultPresentation" | "defaultSize" | "exampleProps" | "id" | "schema" | "title"
  >,
  position?: DashboardWidgetPlacement,
): DashboardWidgetInstance {
  const spawnCols = Math.min(
    Math.max(
      Math.ceil(widget.defaultSize.w * WORKSPACE_WIDGET_SPAWN_COLUMN_SCALE),
      MIN_WORKSPACE_WIDGET_COLS,
    ),
    MAX_WORKSPACE_WIDGET_SPAWN_COLS,
    DEFAULT_WORKSPACE_COLUMNS,
  );
  const spawnRows = Math.min(
    Math.max(
      Math.ceil(widget.defaultSize.h * WORKSPACE_WIDGET_SPAWN_ROW_SCALE),
      MIN_WORKSPACE_WIDGET_ROWS,
    ),
    MAX_WORKSPACE_WIDGET_SPAWN_ROWS,
  );

  return {
    id: createId("custom-widget"),
    widgetId: widget.id,
    title: widget.title,
    props: cloneJson(widget.exampleProps ?? {}),
    presentation: resolveDefaultWidgetPresentation(widget),
    row: isWorkspaceRowWidgetId(widget.id)
      ? {
          collapsed: false,
          children: [],
        }
      : undefined,
    layout: {
      cols: spawnCols,
      rows: spawnRows,
    },
    position,
  };
}

function getDashboardBottomY(dashboard: DashboardDefinition) {
  const resolved = resolveDashboardLayout(dashboard);

  return resolved.widgets.reduce(
    (bottomY, instance) => Math.max(bottomY, instance.layout.y + instance.layout.h),
    0,
  );
}

function cloneDashboardWidgetTree(
  widget: DashboardWidgetInstance,
  options?: {
    refreshIds?: boolean;
  },
): DashboardWidgetInstance {
  const cloned = cloneJson(widget);

  if (options?.refreshIds) {
    cloned.id = createId("custom-widget");
  }

  if (cloned.row?.children?.length) {
    cloned.row = {
      ...cloned.row,
      children: cloned.row.children.map((child) =>
        cloneDashboardWidgetTree(child, options),
      ),
    };
  }

  return cloned;
}

function shiftDashboardWidgetTreeY(
  widget: DashboardWidgetInstance,
  deltaY: number,
): DashboardWidgetInstance {
  const nextWidget: DashboardWidgetInstance = {
    ...widget,
    position: widget.position
      ? {
          ...widget.position,
          y:
            typeof widget.position.y === "number"
              ? widget.position.y + deltaY
              : widget.position.y,
        }
      : widget.position,
  };

  if (!widget.row?.children?.length) {
    return nextWidget;
  }

  return {
    ...nextWidget,
    row: {
      ...widget.row,
      children: widget.row.children.map((child) =>
        shiftDashboardWidgetTreeY(child, deltaY),
      ),
    },
  };
}

function expandCollapsedRowChildrenIntoTopLevel(
  row: DashboardWidgetInstance,
) {
  const rowY = row.position?.y ?? 0;
  const storedChildren = row.row?.children ?? [];

  if (storedChildren.length === 0) {
    return [];
  }

  const clonedChildren = storedChildren.map((child) => cloneDashboardWidgetTree(child));
  const topMostChildY = clonedChildren.reduce((minimumY, child) => {
    const childY = child.position?.y;

    return typeof childY === "number"
      ? Math.min(minimumY, childY)
      : minimumY;
  }, Number.POSITIVE_INFINITY);
  const targetStartY = rowY + WORKSPACE_ROW_HEIGHT_ROWS;
  const deltaY = Number.isFinite(topMostChildY) ? targetStartY - topMostChildY : 0;

  return deltaY === 0
    ? clonedChildren
    : clonedChildren.map((child) => shiftDashboardWidgetTreeY(child, deltaY));
}

export function collapseDashboardRow(
  dashboard: DashboardDefinition,
  instanceId: string,
) {
  const rowIndex = dashboard.widgets.findIndex((widget) => widget.id === instanceId);

  if (rowIndex < 0) {
    return dashboard;
  }

  const row = dashboard.widgets[rowIndex];

  if (!isWorkspaceRowWidgetId(row.widgetId) || isWorkspaceRowCollapsed(row)) {
    return dashboard;
  }

  const childWidgets = getExpandedWorkspaceRowChildren(dashboard.widgets, rowIndex);
  const afterIndex = rowIndex + 1 + childWidgets.length;
  const nextRow: DashboardWidgetInstance = {
    ...row,
    row: {
      collapsed: true,
      children: childWidgets.map((child) => cloneDashboardWidgetTree(child)),
    },
  };

  return materializeDashboardLayout({
    ...dashboard,
    widgets: [
      ...dashboard.widgets.slice(0, rowIndex),
      nextRow,
      ...dashboard.widgets.slice(afterIndex),
    ],
  });
}

export function expandDashboardRow(
  dashboard: DashboardDefinition,
  instanceId: string,
) {
  const rowIndex = dashboard.widgets.findIndex((widget) => widget.id === instanceId);

  if (rowIndex < 0) {
    return dashboard;
  }

  const row = dashboard.widgets[rowIndex];

  if (!isWorkspaceRowWidgetId(row.widgetId) || !isWorkspaceRowCollapsed(row)) {
    return dashboard;
  }

  const restoredChildren = expandCollapsedRowChildrenIntoTopLevel(row);
  const expandedRow: DashboardWidgetInstance = {
    ...row,
    row: {
      collapsed: false,
      children: [],
    },
  };

  return materializeDashboardLayout({
    ...dashboard,
    widgets: [
      ...dashboard.widgets.slice(0, rowIndex),
      expandedRow,
      ...restoredChildren,
      ...dashboard.widgets.slice(rowIndex + 1),
    ],
  });
}

export function appendCatalogWidget(
  dashboard: DashboardDefinition,
  widget: Pick<
    WidgetDefinition,
    "defaultPresentation" | "defaultSize" | "exampleProps" | "id" | "schema" | "title"
  >,
) {
  const nextWidget = isWorkspaceRowWidgetId(widget.id)
    ? buildWidgetInstance(widget, {
        x: 0,
        y: getDashboardBottomY(dashboard),
      })
    : buildWidgetInstance(widget);

  return materializeDashboardLayout({
    ...dashboard,
    widgets: [...dashboard.widgets, nextWidget],
  });
}

export function placeCatalogWidget(
  dashboard: DashboardDefinition,
  widget: Pick<
    WidgetDefinition,
    "defaultPresentation" | "defaultSize" | "exampleProps" | "id" | "schema" | "title"
  >,
  position: DashboardWidgetPlacement,
) {
  return materializeDashboardLayout({
    ...dashboard,
    widgets: [...dashboard.widgets, buildWidgetInstance(widget, position)],
  });
}

export function commitDashboardGridLayout(
  dashboard: DashboardDefinition,
  layout: Array<Pick<WorkspaceGridLayoutItem, "h" | "i" | "w" | "x" | "y">>,
) {
  const nextWidgets = sortWidgetsByGridOrder(
    applyGridLayoutToDashboardWidgets(dashboard.widgets, layout),
    layout,
  );

  return materializeDashboardLayout({
    ...dashboard,
    widgets: nextWidgets,
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

      if (isWorkspaceRowWidgetId(widget.widgetId)) {
        return {
          ...widget,
          layout: {
            cols: maxColumns,
            rows: WORKSPACE_ROW_HEIGHT_ROWS,
          },
          position: {
            x: 0,
            y: widget.position?.y,
          },
        };
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

      if (isWorkspaceRowWidgetId(widget.widgetId)) {
        return {
          ...widget,
          layout: {
            cols: maxColumns,
            rows: WORKSPACE_ROW_HEIGHT_ROWS,
          },
          position: {
            x: 0,
            y: geometry.y ?? widget.position?.y,
          },
        };
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
      defaultIntervalMs:
        dashboard.controls?.refresh?.defaultIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS,
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

export function updateDashboardWidgetRuntimeState(
  dashboard: DashboardDefinition,
  instanceId: string,
  runtimeState: Record<string, unknown> | undefined,
) {
  const nextRuntimeState = normalizeWidgetRuntimeState(runtimeState);
  let changed = false;

  const nextWidgets = dashboard.widgets.map((widget) => {
    if (widget.id !== instanceId) {
      return widget;
    }

    if (
      JSON.stringify(widget.runtimeState ?? null) === JSON.stringify(nextRuntimeState ?? null)
    ) {
      return widget;
    }

    changed = true;

    return {
      ...widget,
      runtimeState: nextRuntimeState,
    };
  });

  return changed
    ? {
        ...dashboard,
        widgets: nextWidgets,
      }
    : dashboard;
}

export function updateDashboardWidgetSettings(
  dashboard: DashboardDefinition,
  instanceId: string,
  settings: {
    title?: string;
    props?: Record<string, unknown>;
    presentation?: DashboardWidgetInstance["presentation"];
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
        presentation:
          "presentation" in settings
            ? cloneJson(settings.presentation ?? {})
            : widget.presentation,
        runtimeState:
          "props" in settings
            ? undefined
            : widget.runtimeState,
      };
    }),
  });
}

export function removeDashboardWidget(dashboard: DashboardDefinition, instanceId: string) {
  const removeIndex = dashboard.widgets.findIndex((widget) => widget.id === instanceId);

  if (removeIndex < 0) {
    return dashboard;
  }

  const widget = dashboard.widgets[removeIndex];

  if (isWorkspaceRowCollapsed(widget)) {
    const restoredChildren = expandCollapsedRowChildrenIntoTopLevel(widget);

    return materializeDashboardLayout({
      ...dashboard,
      widgets: [
        ...dashboard.widgets.slice(0, removeIndex),
        ...restoredChildren,
        ...dashboard.widgets.slice(removeIndex + 1),
      ],
    });
  }

  return materializeDashboardLayout({
    ...dashboard,
    widgets: dashboard.widgets.filter((entry) => entry.id !== instanceId),
  });
}

export function duplicateDashboardWidget(
  dashboard: DashboardDefinition,
  instanceId: string,
) {
  const current = dashboard.widgets.find((widget) => widget.id === instanceId);

  if (!current) {
    return dashboard;
  }

  const cols = getLayoutCols(current.layout);
  const rows = getLayoutRows(current.layout);
  const currentX = current.position?.x ?? 0;
  const currentY = current.position?.y ?? 0;
  const duplicatedWidget: DashboardWidgetInstance = {
    ...cloneDashboardWidgetTree(current, {
      refreshIds: true,
    }),
    runtimeState: undefined,
    position: isWorkspaceRowWidgetId(current.widgetId)
      ? {
          x: 0,
          y: currentY + rows,
        }
      : {
          x: Math.max(0, Math.min(currentX + 2, DEFAULT_WORKSPACE_COLUMNS - cols)),
          y: currentY + 2,
        },
  };

  return materializeDashboardLayout({
    ...dashboard,
    widgets: [...dashboard.widgets, duplicatedWidget],
  });
}

export function createWorkspaceSnapshot(
  dashboard: DashboardDefinition,
): WorkspaceSnapshot {
  return {
    schema: WORKSPACE_SNAPSHOT_SCHEMA,
    version: WORKSPACE_SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    workspace: sanitizeDashboard(cloneJson(dashboard)),
  };
}

export function stringifyWorkspaceSnapshot(dashboard: DashboardDefinition) {
  return JSON.stringify(createWorkspaceSnapshot(dashboard), null, 2);
}

export function parseWorkspaceSnapshot(rawValue: string): ParsedWorkspaceSnapshot {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return {
      error: "Paste a workspace JSON payload first.",
      snapshot: null,
      sourceFormat: null,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (
      isPlainRecord(parsed) &&
      parsed.schema === WORKSPACE_SNAPSHOT_SCHEMA &&
      parsed.version === WORKSPACE_SNAPSHOT_VERSION &&
      looksLikeDashboardDefinition(parsed.workspace)
    ) {
      return {
        error: null,
        snapshot: {
          schema: WORKSPACE_SNAPSHOT_SCHEMA,
          version: WORKSPACE_SNAPSHOT_VERSION,
          exportedAt:
            typeof parsed.exportedAt === "string"
              ? parsed.exportedAt
              : new Date().toISOString(),
          workspace: sanitizeDashboard(parsed.workspace),
        },
        sourceFormat: "snapshot",
      };
    }

    if (looksLikeDashboardDefinition(parsed)) {
      return {
        error: null,
        snapshot: {
          schema: WORKSPACE_SNAPSHOT_SCHEMA,
          version: WORKSPACE_SNAPSHOT_VERSION,
          exportedAt: new Date().toISOString(),
          workspace: sanitizeDashboard(parsed),
        },
        sourceFormat: "raw",
      };
    }

    return {
      error: "JSON does not match the workspace snapshot format.",
      snapshot: null,
      sourceFormat: null,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid JSON.",
      snapshot: null,
      sourceFormat: null,
    };
  }
}

export function restoreWorkspaceFromSnapshot(
  snapshot: WorkspaceSnapshot,
  options?: {
    workspaceId?: string;
  },
) {
  return {
    ...sanitizeDashboard(cloneJson(snapshot.workspace)),
    id: options?.workspaceId ?? createId("custom-dashboard"),
  };
}
