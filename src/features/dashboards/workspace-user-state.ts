import type {
  DashboardControlsConfig,
  DashboardDefinition,
  DashboardRefreshConfig,
  DashboardTimeRangeConfig,
  DashboardTimeRangeKey,
  DashboardWidgetInstance,
} from "@/dashboards/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeTimeRangeKey(value: unknown): DashboardTimeRangeKey | "custom" | undefined {
  return value === "custom" ||
    value === "15m" ||
    value === "1h" ||
    value === "6h" ||
    value === "24h" ||
    value === "7d" ||
    value === "30d" ||
    value === "90d"
    ? value
    : undefined;
}

function normalizeFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeNullableRefreshInterval(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }

  const finiteValue = normalizeFiniteNumber(value);

  return finiteValue && finiteValue > 0 ? Math.trunc(finiteValue) : undefined;
}

function areJsonEqual(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export interface WorkspaceUserStateSnapshot {
  selectedControls: {
    timeRangeKey?: DashboardTimeRangeKey | "custom";
    rangeStartMs?: number | null;
    rangeEndMs?: number | null;
    refreshIntervalMs?: number | null;
  };
  widgetRuntimeState: Record<string, Record<string, unknown>>;
}

export function createEmptyWorkspaceUserState(): WorkspaceUserStateSnapshot {
  return {
    selectedControls: {},
    widgetRuntimeState: {},
  };
}

function normalizeSelectedControls(value: unknown): WorkspaceUserStateSnapshot["selectedControls"] {
  if (!isRecord(value)) {
    return {};
  }

  const timeRangeKey = normalizeTimeRangeKey(value.timeRangeKey);
  const rangeStartMs =
    value.rangeStartMs === null ? null : normalizeFiniteNumber(value.rangeStartMs);
  const rangeEndMs =
    value.rangeEndMs === null ? null : normalizeFiniteNumber(value.rangeEndMs);
  const refreshIntervalMs = normalizeNullableRefreshInterval(value.refreshIntervalMs);
  const hasValidCustomRange =
    timeRangeKey === "custom" &&
    typeof rangeStartMs === "number" &&
    typeof rangeEndMs === "number" &&
    rangeStartMs <= rangeEndMs;

  return {
    ...(timeRangeKey && timeRangeKey !== "custom" ? { timeRangeKey } : {}),
    ...(hasValidCustomRange
      ? {
          timeRangeKey: "custom" as const,
          rangeStartMs,
          rangeEndMs,
        }
      : {}),
    ...(refreshIntervalMs !== undefined ? { refreshIntervalMs } : {}),
  };
}

function normalizeWidgetRuntimeStateMap(
  value: unknown,
): WorkspaceUserStateSnapshot["widgetRuntimeState"] {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, Record<string, unknown>] =>
          typeof entry[0] === "string" && isRecord(entry[1]),
      )
      .map(([widgetId, runtimeState]) => [widgetId, cloneJson(runtimeState)]),
  );
}

function unwrapWorkspaceUserStatePayloadRecord(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (Array.isArray(payload.results)) {
    return payload.results.find((entry) => isRecord(entry)) ?? null;
  }

  if ("selectedControls" in payload || "widgetRuntimeState" in payload) {
    return payload;
  }

  return null;
}

export function normalizeWorkspaceUserStatePayload(
  payload: unknown,
): WorkspaceUserStateSnapshot {
  const record = unwrapWorkspaceUserStatePayloadRecord(payload);

  if (!record) {
    return createEmptyWorkspaceUserState();
  }

  return {
    selectedControls: normalizeSelectedControls(record.selectedControls),
    widgetRuntimeState: normalizeWidgetRuntimeStateMap(record.widgetRuntimeState),
  };
}

function stripWorkspaceControlSelections(
  controls: DashboardControlsConfig | undefined,
): DashboardControlsConfig | undefined {
  if (!controls) {
    return controls;
  }

  let changed = false;
  let nextTimeRange: DashboardTimeRangeConfig | undefined = controls.timeRange;
  let nextRefresh: DashboardRefreshConfig | undefined = controls.refresh;

  if (controls.timeRange) {
    const { selectedRange: _selectedRange, customStartMs: _customStartMs, customEndMs: _customEndMs, ...rest } =
      controls.timeRange;

    if (
      "selectedRange" in controls.timeRange ||
      "customStartMs" in controls.timeRange ||
      "customEndMs" in controls.timeRange
    ) {
      changed = true;
      nextTimeRange = rest;
    }
  }

  if (controls.refresh) {
    const { selectedIntervalMs: _selectedIntervalMs, ...rest } = controls.refresh;

    if ("selectedIntervalMs" in controls.refresh) {
      changed = true;
      nextRefresh = rest;
    }
  }

  if (!changed) {
    return controls;
  }

  return {
    ...controls,
    ...(nextTimeRange ? { timeRange: nextTimeRange } : {}),
    ...(nextRefresh ? { refresh: nextRefresh } : {}),
  };
}

function stripWorkspaceWidgetRuntimeState(
  widgets: DashboardDefinition["widgets"],
): DashboardDefinition["widgets"] {
  let changed = false;

  const nextWidgets = widgets.map((widget) => {
    let nextWidget: DashboardWidgetInstance = widget;

    if ("runtimeState" in widget) {
      const { runtimeState: _runtimeState, ...rest } = widget;
      nextWidget = rest;
      changed = true;
    }

    if (!widget.row?.children?.length) {
      return nextWidget;
    }

    const nextChildren = stripWorkspaceWidgetRuntimeState(widget.row.children);

    if (nextChildren === widget.row.children) {
      return nextWidget;
    }

    changed = true;
    return {
      ...nextWidget,
      row: {
        ...widget.row,
        children: nextChildren,
      },
    };
  });

  return changed ? nextWidgets : widgets;
}

export function stripWorkspaceUserStateFromDashboard(
  dashboard: DashboardDefinition,
): DashboardDefinition {
  const nextControls = stripWorkspaceControlSelections(dashboard.controls);
  const nextWidgets = stripWorkspaceWidgetRuntimeState(dashboard.widgets);

  if (nextControls === dashboard.controls && nextWidgets === dashboard.widgets) {
    return dashboard;
  }

  return {
    ...dashboard,
    controls: nextControls,
    widgets: nextWidgets,
  };
}

function collectWidgetRuntimeStateFromWidgets(
  widgets: DashboardDefinition["widgets"],
  runtimeStateById: Record<string, Record<string, unknown>>,
) {
  widgets.forEach((widget) => {
    if (isRecord(widget.runtimeState)) {
      runtimeStateById[widget.id] = cloneJson(widget.runtimeState);
    }

    if (widget.row?.children?.length) {
      collectWidgetRuntimeStateFromWidgets(widget.row.children, runtimeStateById);
    }
  });
}

export function extractWorkspaceUserStateFromDashboard(
  dashboard: DashboardDefinition,
): WorkspaceUserStateSnapshot {
  const selectedControls: WorkspaceUserStateSnapshot["selectedControls"] = {};
  const timeRange = dashboard.controls?.timeRange;
  const refresh = dashboard.controls?.refresh;

  if (timeRange?.selectedRange) {
    selectedControls.timeRangeKey = timeRange.selectedRange;

    if (
      timeRange.selectedRange === "custom" &&
      typeof timeRange.customStartMs === "number" &&
      typeof timeRange.customEndMs === "number"
    ) {
      selectedControls.rangeStartMs = timeRange.customStartMs;
      selectedControls.rangeEndMs = timeRange.customEndMs;
    }
  }

  if ("selectedIntervalMs" in (refresh ?? {})) {
    selectedControls.refreshIntervalMs = refresh?.selectedIntervalMs ?? null;
  }

  const widgetRuntimeState: Record<string, Record<string, unknown>> = {};
  collectWidgetRuntimeStateFromWidgets(dashboard.widgets, widgetRuntimeState);

  return {
    selectedControls,
    widgetRuntimeState,
  };
}

function applySelectedControlsToDashboard(
  dashboard: DashboardDefinition,
  selectedControls: WorkspaceUserStateSnapshot["selectedControls"],
) {
  if (Object.keys(selectedControls).length === 0) {
    return dashboard;
  }

  const currentControls = dashboard.controls ?? {};
  const currentTimeRange = currentControls.timeRange ?? {};
  const currentRefresh = currentControls.refresh ?? {};
  const hasTimeRangeUpdate =
    "timeRangeKey" in selectedControls ||
    "rangeStartMs" in selectedControls ||
    "rangeEndMs" in selectedControls;
  const hasRefreshUpdate = "refreshIntervalMs" in selectedControls;

  const nextTimeRange = hasTimeRangeUpdate
    ? {
        ...currentTimeRange,
        ...("timeRangeKey" in selectedControls && selectedControls.timeRangeKey
          ? { selectedRange: selectedControls.timeRangeKey }
          : {}),
        ...(("timeRangeKey" in selectedControls && selectedControls.timeRangeKey !== "custom") ||
        ("rangeStartMs" in selectedControls && selectedControls.rangeStartMs === null)
          ? { customStartMs: undefined }
          : {}),
        ...(("timeRangeKey" in selectedControls && selectedControls.timeRangeKey !== "custom") ||
        ("rangeEndMs" in selectedControls && selectedControls.rangeEndMs === null)
          ? { customEndMs: undefined }
          : {}),
        ...("rangeStartMs" in selectedControls && typeof selectedControls.rangeStartMs === "number"
          ? { customStartMs: selectedControls.rangeStartMs }
          : {}),
        ...("rangeEndMs" in selectedControls && typeof selectedControls.rangeEndMs === "number"
          ? { customEndMs: selectedControls.rangeEndMs }
          : {}),
      }
    : currentTimeRange;
  const nextRefresh = hasRefreshUpdate
    ? {
        ...currentRefresh,
        selectedIntervalMs: selectedControls.refreshIntervalMs ?? null,
      }
    : currentRefresh;

  if (
    nextTimeRange === currentTimeRange &&
    nextRefresh === currentRefresh
  ) {
    return dashboard;
  }

  const nextControls = {
    ...currentControls,
    ...(hasTimeRangeUpdate ? { timeRange: nextTimeRange } : {}),
    ...(hasRefreshUpdate ? { refresh: nextRefresh } : {}),
  };

  if (areJsonEqual(nextControls, dashboard.controls)) {
    return dashboard;
  }

  return {
    ...dashboard,
    controls: nextControls,
  };
}

function applyWidgetRuntimeStateToWidgets(
  widgets: DashboardDefinition["widgets"],
  widgetRuntimeState: WorkspaceUserStateSnapshot["widgetRuntimeState"],
): DashboardDefinition["widgets"] {
  if (Object.keys(widgetRuntimeState).length === 0) {
    return widgets;
  }

  let changed = false;

  const nextWidgets = widgets.map((widget) => {
    let nextWidget: DashboardWidgetInstance = widget;
    const nextRuntimeState = widgetRuntimeState[widget.id];

    if (nextRuntimeState && !areJsonEqual(widget.runtimeState, nextRuntimeState)) {
      nextWidget = {
        ...widget,
        runtimeState: cloneJson(nextRuntimeState),
      };
      changed = true;
    }

    if (!widget.row?.children?.length) {
      return nextWidget;
    }

    const nextChildren = applyWidgetRuntimeStateToWidgets(
      widget.row.children,
      widgetRuntimeState,
    );

    if (nextChildren === widget.row.children) {
      return nextWidget;
    }

    changed = true;
    return {
      ...nextWidget,
      row: {
        ...widget.row,
        children: nextChildren,
      },
    };
  });

  return changed ? nextWidgets : widgets;
}

export function applyWorkspaceUserStateToDashboard(
  dashboard: DashboardDefinition,
  userState: WorkspaceUserStateSnapshot,
): DashboardDefinition {
  const withSelectedControls = applySelectedControlsToDashboard(
    dashboard,
    userState.selectedControls,
  );
  const nextWidgets = applyWidgetRuntimeStateToWidgets(
    withSelectedControls.widgets,
    userState.widgetRuntimeState,
  );

  if (nextWidgets === withSelectedControls.widgets) {
    return withSelectedControls;
  }

  return {
    ...withSelectedControls,
    widgets: nextWidgets,
  };
}
