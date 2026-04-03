import { buildCompanionItemId } from "@/dashboards/canvas-items";
import { resolveDashboardLayout } from "@/dashboards/layout";
import {
  applyGridLayoutToDashboardWidgets,
  sortWidgetsByGridOrder,
  type WorkspaceGridLayoutItem,
} from "@/dashboards/react-grid-layout-adapter";
import { normalizeWidgetInstanceBindings } from "@/dashboards/widget-dependencies";
import {
  getExpandedWorkspaceRowChildren,
  isWorkspaceRowCollapsed,
  isWorkspaceRowWidgetId,
  WORKSPACE_ROW_HEIGHT_ROWS,
} from "@/dashboards/structural-widgets";
import type {
  DashboardCompanionLayoutItem,
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
const STORAGE_VERSION = 5;
const WORKSPACE_SNAPSHOT_SCHEMA = "mainsequence.workspace";
const WORKSPACE_SNAPSHOT_VERSION = 1;
const DEFAULT_WORKSPACE_COLUMNS = 48;
const DEFAULT_WORKSPACE_ROW_HEIGHT = 15;
const DEFAULT_WORKSPACE_GAP = 8;
const DEFAULT_WORKSPACE_ROW_STEP = DEFAULT_WORKSPACE_ROW_HEIGHT;
const DEFAULT_AUTO_GRID_MAX_COLUMNS = 4;
const DEFAULT_AUTO_GRID_MIN_COLUMN_WIDTH_PX = 320;
const DEFAULT_AUTO_GRID_FILL_SCREEN = false;
const DEFAULT_AUTO_GRID_ROW_HEIGHT = 18;
const LEGACY_WORKSPACE_COLUMNS = 12;
const PREVIOUS_CUSTOM_WORKSPACE_COLUMNS = 24;
const PREVIOUS_CUSTOM_WORKSPACE_ROW_HEIGHT = 30;
const DEFAULT_WORKSPACE_WIDGET_SPAWN_COLS = 12;
const DEFAULT_WORKSPACE_WIDGET_SPAWN_ROWS = 8;
const LEGACY_WORKSPACE_ROW_HEIGHT = 78;
const LEGACY_WORKSPACE_GAP = 8;
const MIN_WORKSPACE_WIDGET_COLS = 1;
const MIN_WORKSPACE_WIDGET_ROWS = 1;

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

interface WorkspaceGridMigration {
  columnScale: number;
  sourceRowHeight: number;
  sourceGap: number;
  sourceRowStep: number;
  sourceUsesVisualGutters: boolean;
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

function slugifyWidgetInstancePrefix(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "widget";
}

function buildWidgetInstanceIdPrefix(
  widget: Pick<WidgetDefinition, "id" | "title"> | Pick<DashboardWidgetInstance, "widgetId" | "title">,
) {
  if ("id" in widget) {
    return slugifyWidgetInstancePrefix(widget.id || widget.title || "widget");
  }

  return slugifyWidgetInstancePrefix(widget.widgetId || widget.title || "widget");
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

function collectDashboardWidgetTreeIds(widget: DashboardWidgetInstance): string[] {
  return [
    widget.id,
    ...(widget.row?.children?.flatMap((child) => collectDashboardWidgetTreeIds(child)) ?? []),
  ];
}

function collectDashboardWidgetIds(widgets: DashboardWidgetInstance[]) {
  return new Set(widgets.flatMap((widget) => collectDashboardWidgetTreeIds(widget)));
}

function usesVisualWorkspaceGutters(
  rawColumns: number,
  rawRowHeight: number,
  rawGap: number,
) {
  if (rawGap !== DEFAULT_WORKSPACE_GAP) {
    return false;
  }

  return (
    (rawColumns === DEFAULT_WORKSPACE_COLUMNS && rawRowHeight === DEFAULT_WORKSPACE_ROW_HEIGHT) ||
    (rawColumns === PREVIOUS_CUSTOM_WORKSPACE_COLUMNS &&
      rawRowHeight === PREVIOUS_CUSTOM_WORKSPACE_ROW_HEIGHT)
  );
}

function buildWorkspaceGridMigration(
  rawColumns: number,
  rawRowHeight: number,
  rawGap: number,
): WorkspaceGridMigration {
  const sourceUsesVisualGutters = usesVisualWorkspaceGutters(rawColumns, rawRowHeight, rawGap);

  return {
    columnScale: DEFAULT_WORKSPACE_COLUMNS / Math.max(1, rawColumns),
    sourceRowHeight: rawRowHeight,
    sourceGap: rawGap,
    sourceRowStep: sourceUsesVisualGutters ? rawRowHeight : rawRowHeight + rawGap,
    sourceUsesVisualGutters,
  };
}

function scaleGridX(rawX: number, migration: WorkspaceGridMigration) {
  return Math.max(0, Math.round(rawX * migration.columnScale));
}

function scaleGridY(rawY: number, migration: WorkspaceGridMigration) {
  return Math.max(0, Math.round((rawY * migration.sourceRowStep) / DEFAULT_WORKSPACE_ROW_STEP));
}

function scaleGridW(rawW: number, migration: WorkspaceGridMigration) {
  return Math.max(1, Math.round(rawW * migration.columnScale));
}

function scaleGridH(rawH: number, migration: WorkspaceGridMigration) {
  const pixelHeight = migration.sourceUsesVisualGutters
    ? rawH * migration.sourceRowHeight
    : rawH * migration.sourceRowHeight + Math.max(0, rawH - 1) * migration.sourceGap;

  return Math.max(1, Math.round(pixelHeight / DEFAULT_WORKSPACE_ROW_STEP));
}

function normalizeDashboardCompanionLayoutItem(
  item: DashboardCompanionLayoutItem,
  migration: WorkspaceGridMigration,
): DashboardCompanionLayoutItem | null {
  if (
    !item ||
    typeof item.instanceId !== "string" ||
    !item.instanceId ||
    typeof item.fieldId !== "string" ||
    !item.fieldId ||
    !isPlainRecord(item.layout)
  ) {
    return null;
  }

  const rawLayout = item.layout;
  const rawX = typeof rawLayout.x === "number" ? rawLayout.x : 0;
  const rawY = typeof rawLayout.y === "number" ? rawLayout.y : 0;
  const rawW = typeof rawLayout.w === "number" ? rawLayout.w : 0;
  const rawH = typeof rawLayout.h === "number" ? rawLayout.h : 0;

  if (rawW <= 0 || rawH <= 0) {
    return null;
  }

  return {
    id: buildCompanionItemId(item.instanceId, item.fieldId),
    instanceId: item.instanceId,
    fieldId: item.fieldId,
    layout: {
      x: scaleGridX(rawX, migration),
      y: scaleGridY(rawY, migration),
      w: scaleGridW(rawW, migration),
      h: scaleGridH(rawH, migration),
    },
  };
}

function extractLegacyCompanionLayoutItems(
  widgets: DashboardWidgetInstance[],
  migration: WorkspaceGridMigration,
): DashboardCompanionLayoutItem[] {
  return widgets.flatMap((widget) => {
    const ownItems = Object.entries(widget.presentation?.exposedFields ?? {}).flatMap(
      ([fieldId, fieldState]) => {
        if (
          typeof fieldState?.gridX !== "number" ||
          typeof fieldState?.gridY !== "number" ||
          typeof fieldState?.gridW !== "number" ||
          typeof fieldState?.gridH !== "number"
        ) {
          return [];
        }

        return [{
          id: buildCompanionItemId(widget.id, fieldId),
          instanceId: widget.id,
          fieldId,
          layout: {
            x: scaleGridX(fieldState.gridX, migration),
            y: scaleGridY(fieldState.gridY, migration),
            w: scaleGridW(fieldState.gridW, migration),
            h: scaleGridH(fieldState.gridH, migration),
          },
        } satisfies DashboardCompanionLayoutItem];
      },
    );

    if (!widget.row?.children?.length) {
      return ownItems;
    }

    return [...ownItems, ...extractLegacyCompanionLayoutItems(widget.row.children, migration)];
  });
}

function sanitizeDashboardCompanionLayoutItems(
  companionItems: DashboardCompanionLayoutItem[] | undefined,
  widgets: DashboardWidgetInstance[],
  migration: WorkspaceGridMigration,
): DashboardCompanionLayoutItem[] {
  const normalizedItems = Array.isArray(companionItems)
    ? companionItems
        .map((item) => normalizeDashboardCompanionLayoutItem(item, migration))
        .filter((item): item is DashboardCompanionLayoutItem => item !== null)
    : extractLegacyCompanionLayoutItems(widgets, migration);
  const widgetIds = collectDashboardWidgetIds(widgets);
  const dedupedById = new Map<string, DashboardCompanionLayoutItem>();

  normalizedItems.forEach((item) => {
    if (!widgetIds.has(item.instanceId)) {
      return;
    }

    dedupedById.set(item.id, item);
  });

  return [...dedupedById.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeDashboardRowState(
  rowState: DashboardWidgetRowState | undefined,
  migration: WorkspaceGridMigration,
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
    normalizeDashboardWidgetInstance(child, migration),
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

function normalizeDashboardWidgetInstance(
  instance: DashboardWidgetInstance,
  migration: WorkspaceGridMigration,
): DashboardWidgetInstance {
  const { autoGrid: _legacyAutoGrid, ...instanceWithoutLegacyAutoGrid } =
    instance as DashboardWidgetInstance & { autoGrid?: unknown };
  const rawPosition = isLegacyLayout(instance.layout)
    ? {
        x: instance.layout.x,
        y: instance.layout.y,
      }
    : instance.position;
  const scaled: DashboardWidgetInstance = {
    ...instanceWithoutLegacyAutoGrid,
    bindings: normalizeWidgetInstanceBindings(instance.bindings),
    runtimeState: normalizeWidgetRuntimeState(instance.runtimeState),
    layout: {
      cols: scaleGridW(getLayoutCols(instance.layout), migration),
      rows: scaleGridH(getLayoutRows(instance.layout), migration),
    },
    position: rawPosition
      ? {
          x: typeof rawPosition.x === "number" ? scaleGridX(rawPosition.x, migration) : undefined,
          y: typeof rawPosition.y === "number" ? scaleGridY(rawPosition.y, migration) : undefined,
        }
      : undefined,
  };

  const normalizedRowState = isWorkspaceRowWidgetId(instance.widgetId)
    ? normalizeDashboardRowState(instance.row, migration) ?? {
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

function hasLegacyCompanionProjectionInWidgetTree(
  widgets: DashboardWidgetInstance[],
): boolean {
  return widgets.some((widget) => {
    const hasLegacyProjection = Object.values(widget.presentation?.exposedFields ?? {}).some(
      (fieldState) =>
        typeof fieldState?.gridX === "number" ||
        typeof fieldState?.gridY === "number" ||
        typeof fieldState?.gridW === "number" ||
        typeof fieldState?.gridH === "number",
    );

    if (hasLegacyProjection) {
      return true;
    }

    return widget.row?.children?.length
      ? hasLegacyCompanionProjectionInWidgetTree(widget.row.children)
      : false;
  });
}

function dashboardWidgetTreeRequiresMigration(
  widgets: DashboardWidgetInstance[],
): boolean {
  return widgets.some((widget) => {
    const rowState = widget.row as (DashboardWidgetRowState & { panels?: DashboardWidgetInstance[] }) | undefined;

    if (isLegacyLayout(widget.layout)) {
      return true;
    }

    if (rowState?.panels && Array.isArray(rowState.panels)) {
      return true;
    }

    return widget.row?.children?.length
      ? dashboardWidgetTreeRequiresMigration(widget.row.children)
      : false;
  });
}

function dashboardRequiresMigration(dashboard: DashboardDefinition) {
  if (
    dashboard.grid?.columns !== DEFAULT_WORKSPACE_COLUMNS ||
    dashboard.grid?.rowHeight !== DEFAULT_WORKSPACE_ROW_HEIGHT ||
    dashboard.grid?.gap !== DEFAULT_WORKSPACE_GAP
  ) {
    return true;
  }

  if (!Array.isArray(dashboard.widgets)) {
    return true;
  }

  if (dashboardWidgetTreeRequiresMigration(dashboard.widgets)) {
    return true;
  }

  return hasLegacyCompanionProjectionInWidgetTree(dashboard.widgets);
}

function sanitizeCanonicalDashboardRowState(
  rowState: DashboardWidgetRowState | undefined,
  maxColumns: number,
): DashboardWidgetRowState | undefined {
  if (!isPlainRecord(rowState)) {
    return undefined;
  }

  const rawChildren = Array.isArray(rowState.children) ? rowState.children : [];

  return {
    collapsed: rowState.collapsed === true,
    children: rawChildren.map((child) =>
      sanitizeCanonicalDashboardWidgetInstance(child, maxColumns),
    ),
  };
}

function sanitizeCanonicalDashboardWidgetInstance(
  instance: DashboardWidgetInstance,
  maxColumns: number,
): DashboardWidgetInstance {
  const rawPosition = isLegacyLayout(instance.layout)
    ? {
        x: instance.layout.x,
        y: instance.layout.y,
      }
    : instance.position;
  const nextWidget: DashboardWidgetInstance = {
    ...instance,
    bindings: normalizeWidgetInstanceBindings(instance.bindings),
    runtimeState: normalizeWidgetRuntimeState(instance.runtimeState),
    layout: {
      cols: getLayoutCols(instance.layout),
      rows: getLayoutRows(instance.layout),
    },
    position: rawPosition
      ? {
          x: typeof rawPosition.x === "number" ? rawPosition.x : undefined,
          y: typeof rawPosition.y === "number" ? rawPosition.y : undefined,
        }
      : undefined,
  };
  const normalizedRowState = isWorkspaceRowWidgetId(instance.widgetId)
    ? sanitizeCanonicalDashboardRowState(instance.row, maxColumns) ?? {
        collapsed: false,
        children: [],
      }
    : undefined;

  return clampWidgetMinimumLayout(
    normalizedRowState
      ? {
          ...nextWidget,
          row: normalizedRowState,
        }
      : {
          ...nextWidget,
          row: undefined,
        },
    maxColumns,
  );
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

export function migrateDashboardDefinition(dashboard: DashboardDefinition): DashboardDefinition {
  const layoutKind = dashboard.layoutKind ?? "custom";
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
  const migration = buildWorkspaceGridMigration(rawColumns, rawRowHeight, rawGap);
  const widgets = Array.isArray(dashboard.widgets)
    ? dashboard.widgets.map((instance) =>
        normalizeDashboardWidgetInstance(instance, migration),
      )
    : [];
  const companions = sanitizeDashboardCompanionLayoutItems(
    dashboard.companions,
    widgets,
    migration,
  );

  return materializeDashboardLayout({
    ...dashboard,
    title: dashboard.title || "Untitled workspace",
    description: dashboard.description || "User-scoped workspace managed in Command Center.",
    labels: normalizeWorkspaceLabels(dashboard.labels),
    category: dashboard.category || "Custom",
    source: dashboard.source || "user",
    layoutKind,
    autoGrid: {
      maxColumns:
        typeof dashboard.autoGrid?.maxColumns === "number" && dashboard.autoGrid.maxColumns > 0
          ? Math.round(dashboard.autoGrid.maxColumns)
          : DEFAULT_AUTO_GRID_MAX_COLUMNS,
      minColumnWidthPx:
        typeof dashboard.autoGrid?.minColumnWidthPx === "number" && dashboard.autoGrid.minColumnWidthPx > 0
          ? Math.round(dashboard.autoGrid.minColumnWidthPx)
          : DEFAULT_AUTO_GRID_MIN_COLUMN_WIDTH_PX,
      rowHeight:
        typeof dashboard.autoGrid?.rowHeight === "number" && dashboard.autoGrid.rowHeight > 0
          ? Math.round(dashboard.autoGrid.rowHeight)
          : DEFAULT_AUTO_GRID_ROW_HEIGHT,
      fillScreen: dashboard.autoGrid?.fillScreen === true ? true : DEFAULT_AUTO_GRID_FILL_SCREEN,
    },
    companions,
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
      columns: DEFAULT_WORKSPACE_COLUMNS,
      rowHeight: DEFAULT_WORKSPACE_ROW_HEIGHT,
      gap: DEFAULT_WORKSPACE_GAP,
    },
  });
}

export function sanitizeDashboardDefinition(dashboard: DashboardDefinition): DashboardDefinition {
  if (dashboardRequiresMigration(dashboard)) {
    return migrateDashboardDefinition(dashboard);
  }

  const maxColumns = DEFAULT_WORKSPACE_COLUMNS;
  const widgets = Array.isArray(dashboard.widgets)
    ? dashboard.widgets.map((instance) =>
        sanitizeCanonicalDashboardWidgetInstance(instance, maxColumns),
      )
    : [];
  const identityMigration = buildWorkspaceGridMigration(
    DEFAULT_WORKSPACE_COLUMNS,
    DEFAULT_WORKSPACE_ROW_HEIGHT,
    DEFAULT_WORKSPACE_GAP,
  );
  const companions = sanitizeDashboardCompanionLayoutItems(
    dashboard.companions,
    widgets,
    identityMigration,
  );

  return materializeDashboardLayout({
    ...dashboard,
    title: dashboard.title || "Untitled workspace",
    description: dashboard.description || "User-scoped workspace managed in Command Center.",
    labels: normalizeWorkspaceLabels(dashboard.labels),
    category: dashboard.category || "Custom",
    source: dashboard.source || "user",
    layoutKind: dashboard.layoutKind ?? "custom",
    autoGrid: {
      maxColumns:
        typeof dashboard.autoGrid?.maxColumns === "number" && dashboard.autoGrid.maxColumns > 0
          ? Math.round(dashboard.autoGrid.maxColumns)
          : DEFAULT_AUTO_GRID_MAX_COLUMNS,
      minColumnWidthPx:
        typeof dashboard.autoGrid?.minColumnWidthPx === "number" &&
        dashboard.autoGrid.minColumnWidthPx > 0
          ? Math.round(dashboard.autoGrid.minColumnWidthPx)
          : DEFAULT_AUTO_GRID_MIN_COLUMN_WIDTH_PX,
      rowHeight:
        typeof dashboard.autoGrid?.rowHeight === "number" && dashboard.autoGrid.rowHeight > 0
          ? Math.round(dashboard.autoGrid.rowHeight)
          : DEFAULT_AUTO_GRID_ROW_HEIGHT,
      fillScreen:
        dashboard.autoGrid?.fillScreen === true ? true : DEFAULT_AUTO_GRID_FILL_SCREEN,
    },
    companions,
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
      columns: DEFAULT_WORKSPACE_COLUMNS,
      rowHeight: DEFAULT_WORKSPACE_ROW_HEIGHT,
      gap: DEFAULT_WORKSPACE_GAP,
    },
  });
}

export function normalizeDashboardDefinition(dashboard: DashboardDefinition) {
  return migrateDashboardDefinition(dashboard);
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
  const widgetIds = collectDashboardWidgetIds(dashboard.widgets);
  const companions = (dashboard.companions ?? [])
    .filter((item) => widgetIds.has(item.instanceId))
    .map((item) => ({
      ...item,
      id: buildCompanionItemId(item.instanceId, item.fieldId),
      layout: {
        x: Math.max(0, item.layout.x),
        y: Math.max(0, item.layout.y),
        w: Math.max(1, Math.min(item.layout.w, resolved.grid.columns)),
        h: Math.max(1, item.layout.h),
      },
    }));

  return {
    ...dashboard,
    grid: resolved.grid,
    companions,
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
  return sanitizeDashboardDefinition({
    id: createId("custom-dashboard"),
    title,
    description: "User-scoped workspace managed in Command Center.",
    labels: [],
    category: "Custom",
    source: "user",
    layoutKind: "custom",
    autoGrid: {
      maxColumns: DEFAULT_AUTO_GRID_MAX_COLUMNS,
      minColumnWidthPx: DEFAULT_AUTO_GRID_MIN_COLUMN_WIDTH_PX,
      rowHeight: DEFAULT_AUTO_GRID_ROW_HEIGHT,
      fillScreen: DEFAULT_AUTO_GRID_FILL_SCREEN,
    },
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
      ? source.dashboards.map((dashboard) => migrateDashboardDefinition(dashboard))
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

export function sanitizeUserDashboardCollection(
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
      ? source.dashboards.map((dashboard) => sanitizeDashboardDefinition(dashboard))
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
  const normalized = sanitizeUserDashboardCollection(collection, {
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
    "defaultPresentation" | "exampleProps" | "id" | "title"
  >,
  position?: DashboardWidgetPlacement,
): DashboardWidgetInstance {
  const spawnCols = isWorkspaceRowWidgetId(widget.id)
    ? DEFAULT_WORKSPACE_COLUMNS
    : DEFAULT_WORKSPACE_WIDGET_SPAWN_COLS;
  const spawnRows = isWorkspaceRowWidgetId(widget.id)
    ? WORKSPACE_ROW_HEIGHT_ROWS
    : DEFAULT_WORKSPACE_WIDGET_SPAWN_ROWS;

  return {
    id: createId(buildWidgetInstanceIdPrefix(widget)),
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
    idMap?: Map<string, string>;
  },
): DashboardWidgetInstance {
  const cloned = cloneJson(widget);
  const previousId = cloned.id;

  if (options?.refreshIds) {
    cloned.id = createId(buildWidgetInstanceIdPrefix(cloned));
    options.idMap?.set(previousId, cloned.id);
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

function removeDashboardCompanionsForInstanceIds(
  dashboard: DashboardDefinition,
  instanceIds: Set<string>,
) {
  if (instanceIds.size === 0 || !dashboard.companions?.length) {
    return dashboard;
  }

  return {
    ...dashboard,
    companions: dashboard.companions.filter((item) => !instanceIds.has(item.instanceId)),
  };
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
    "defaultPresentation" | "exampleProps" | "id" | "title"
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
    "defaultPresentation" | "exampleProps" | "id" | "title"
  >,
  position: DashboardWidgetPlacement,
) {
  return materializeDashboardLayout({
    ...dashboard,
    widgets: [...dashboard.widgets, buildWidgetInstance(widget, position)],
  });
}

export function commitDashboardCompanionLayout(
  dashboard: DashboardDefinition,
  layout: Array<Pick<WorkspaceGridLayoutItem, "h" | "i" | "w" | "x" | "y">>,
) {
  const upserts = new Map(
    layout.flatMap((item) => {
      const parsed = item.i.startsWith("widget-companion:") ? item.i.split(":") : null;

      if (!parsed || parsed.length !== 3) {
        return [];
      }

      const [, instanceId, fieldId] = parsed;

      if (!instanceId || !fieldId) {
        return [];
      }

      return [[
        item.i,
        {
          id: item.i,
          instanceId,
          fieldId,
          layout: {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          },
        } satisfies DashboardCompanionLayoutItem,
      ] as const];
    }),
  );

  if (upserts.size === 0) {
    return dashboard;
  }

  const nextCompanions = new Map(
    (dashboard.companions ?? []).map((item) => [item.id, item] as const),
  );

  upserts.forEach((item, id) => {
    nextCompanions.set(id, {
      ...item,
    });
  });

  return materializeDashboardLayout({
    ...dashboard,
    companions: [...nextCompanions.values()],
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

function resolveWidgetReorderBlockRange(
  widgets: DashboardDefinition["widgets"],
  startIndex: number,
) {
  const widget = widgets[startIndex];

  if (!widget || !isWorkspaceRowWidgetId(widget.widgetId) || isWorkspaceRowCollapsed(widget)) {
    return {
      start: startIndex,
      end: startIndex,
    };
  }

  let end = startIndex;

  for (let index = startIndex + 1; index < widgets.length; index += 1) {
    if (isWorkspaceRowWidgetId(widgets[index]?.widgetId)) {
      break;
    }

    end = index;
  }

  return {
    start: startIndex,
    end,
  };
}

export function reorderDashboardWidgets(
  dashboard: DashboardDefinition,
  draggedInstanceId: string,
  targetInstanceId: string,
  position: "before" | "after",
) {
  if (draggedInstanceId === targetInstanceId) {
    return dashboard;
  }

  const draggedIndex = dashboard.widgets.findIndex((widget) => widget.id === draggedInstanceId);
  const targetIndex = dashboard.widgets.findIndex((widget) => widget.id === targetInstanceId);

  if (draggedIndex < 0 || targetIndex < 0) {
    return dashboard;
  }

  const nextWidgets = [...dashboard.widgets];
  const draggedRange = resolveWidgetReorderBlockRange(nextWidgets, draggedIndex);

  if (targetIndex >= draggedRange.start && targetIndex <= draggedRange.end) {
    return dashboard;
  }

  const draggedWidgets = nextWidgets.splice(
    draggedRange.start,
    draggedRange.end - draggedRange.start + 1,
  );

  if (draggedWidgets.length === 0) {
    return dashboard;
  }

  const baseTargetIndex = nextWidgets.findIndex((widget) => widget.id === targetInstanceId);

  if (baseTargetIndex < 0) {
    return dashboard;
  }

  const targetRange = resolveWidgetReorderBlockRange(nextWidgets, baseTargetIndex);
  const insertionIndex = position === "after" ? targetRange.end + 1 : targetRange.start;
  nextWidgets.splice(insertionIndex, 0, ...draggedWidgets);

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

function updateBindingsInWidgetTree(
  widget: DashboardWidgetInstance,
  instanceId: string,
  bindings: DashboardWidgetInstance["bindings"],
): [DashboardWidgetInstance, boolean] {
  const normalizedBindings = normalizeWidgetInstanceBindings(bindings);
  let changed = false;
  let nextWidget = widget;

  if (widget.id === instanceId) {
    const previousSerialized = JSON.stringify(widget.bindings ?? null);
    const nextSerialized = JSON.stringify(normalizedBindings ?? null);

    if (previousSerialized !== nextSerialized) {
      changed = true;
      nextWidget = {
        ...widget,
        bindings: normalizedBindings,
        runtimeState: undefined,
      };
    }
  }

  if (!nextWidget.row?.children?.length) {
    return [nextWidget, changed];
  }

  let childChanged = false;
  const nextChildren = nextWidget.row.children.map((child) => {
    const [nextChild, nextChildChanged] = updateBindingsInWidgetTree(
      child,
      instanceId,
      bindings,
    );

    childChanged ||= nextChildChanged;
    return nextChild;
  });

  if (!childChanged) {
    return [nextWidget, changed];
  }

  return [
    {
      ...nextWidget,
      row: {
        ...nextWidget.row,
        children: nextChildren,
      },
    },
    true,
  ];
}

export function updateDashboardWidgetBindings(
  dashboard: DashboardDefinition,
  instanceId: string,
  bindings: DashboardWidgetInstance["bindings"],
) {
  let changed = false;

  const nextWidgets = dashboard.widgets.map((widget) => {
    const [nextWidget, widgetChanged] = updateBindingsInWidgetTree(
      widget,
      instanceId,
      bindings,
    );

    changed ||= widgetChanged;
    return nextWidget;
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
  return {
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
  };
}

export function removeDashboardWidget(dashboard: DashboardDefinition, instanceId: string) {
  const removeIndex = dashboard.widgets.findIndex((widget) => widget.id === instanceId);

  if (removeIndex < 0) {
    return dashboard;
  }

  const widget = dashboard.widgets[removeIndex];

  if (isWorkspaceRowCollapsed(widget)) {
    const restoredChildren = expandCollapsedRowChildrenIntoTopLevel(widget);
    const nextDashboard = removeDashboardCompanionsForInstanceIds(
      {
        ...dashboard,
        widgets: [
          ...dashboard.widgets.slice(0, removeIndex),
          ...restoredChildren,
          ...dashboard.widgets.slice(removeIndex + 1),
        ],
      },
      new Set([widget.id]),
    );

    return materializeDashboardLayout(nextDashboard);
  }

  const removedIds = new Set(collectDashboardWidgetTreeIds(widget));

  return materializeDashboardLayout(
    removeDashboardCompanionsForInstanceIds(
      {
        ...dashboard,
        widgets: dashboard.widgets.filter((entry) => entry.id !== instanceId),
      },
      removedIds,
    ),
  );
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
  const maxColumns = dashboard.grid?.columns ?? DEFAULT_WORKSPACE_COLUMNS;
  const idMap = new Map<string, string>();
  const duplicatedWidget: DashboardWidgetInstance = {
    ...cloneDashboardWidgetTree(current, {
      refreshIds: true,
      idMap,
    }),
    runtimeState: undefined,
    position: isWorkspaceRowWidgetId(current.widgetId)
      ? {
          x: 0,
          y: currentY + rows,
        }
      : {
          x: Math.max(0, Math.min(currentX + 2, maxColumns - cols)),
          y: currentY + 2,
        },
  };
  const duplicatedCompanions = (dashboard.companions ?? []).flatMap((item) => {
    const nextInstanceId = idMap.get(item.instanceId);

    if (!nextInstanceId) {
      return [];
    }

    return [{
      id: buildCompanionItemId(nextInstanceId, item.fieldId),
      instanceId: nextInstanceId,
      fieldId: item.fieldId,
      layout: {
        x: item.layout.x,
        y: item.layout.y,
        w: item.layout.w,
        h: item.layout.h,
      },
    } satisfies DashboardCompanionLayoutItem];
  });

  return materializeDashboardLayout({
    ...dashboard,
    companions: [...(dashboard.companions ?? []), ...duplicatedCompanions],
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
    workspace: sanitizeDashboardDefinition(cloneJson(dashboard)),
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
          workspace: migrateDashboardDefinition(parsed.workspace),
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
          workspace: migrateDashboardDefinition(parsed),
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
    ...migrateDashboardDefinition(cloneJson(snapshot.workspace)),
    id: options?.workspaceId ?? createId("custom-dashboard"),
  };
}
