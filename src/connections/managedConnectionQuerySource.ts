import type { DashboardManagedWidgetOwner } from "@/dashboards/types";
import type { WidgetInstancePresentation } from "@/widgets/types";
import {
  normalizeConnectionQueryProps,
  normalizeConnectionQueryRuntimeState,
  type ConnectionQueryRuntimeState,
  type ConnectionQueryWidgetProps,
} from "@/widgets/core/connection-query/connectionQueryModel";
import {
  normalizeConnectionStreamQueryProps,
  normalizeConnectionStreamQueryRuntimeState,
} from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";

export interface ManagedConnectionQueryWidgetEntry {
  id: string;
  widgetId: string;
  title?: string;
  props?: Record<string, unknown>;
  runtimeState?: Record<string, unknown>;
  managedBy?: DashboardManagedWidgetOwner;
  presentation?: WidgetInstancePresentation;
}

export interface ConnectionQueryRuntimeSummary {
  status: "missing" | "idle" | "loading" | "ready" | "error";
  tone: "neutral" | "warning" | "success" | "danger";
  title: string;
  description: string;
}

export interface ManagedConnectionQuerySourceDescriptor {
  id: string;
  widgetId: string;
  title: string;
  props: ConnectionQueryWidgetProps;
  runtimeState: ConnectionQueryRuntimeState | null;
  runtimeSummary: ConnectionQueryRuntimeSummary;
  managedBy: DashboardManagedWidgetOwner;
  presentation?: WidgetInstancePresentation;
}

function isTabularRuntimeFrame(
  value: ConnectionQueryRuntimeState,
): value is ConnectionQueryRuntimeState & {
  columns: string[];
  rows: Array<Record<string, unknown>>;
} {
  return "columns" in value && Array.isArray(value.columns) && Array.isArray(value.rows);
}

function isRawFrameRuntime(
  value: ConnectionQueryRuntimeState,
): value is ConnectionQueryRuntimeState & {
  fields: Array<{ name: string; values: unknown[] }>;
} {
  return "fields" in value && Array.isArray(value.fields);
}

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
}

export function buildConnectionQuerySourceIdentityLabel(
  props: ConnectionQueryWidgetProps,
): string {
  return [
    props.connectionRef?.typeId,
    props.connectionRef?.id,
    props.queryModelId,
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map(String)
    .join(" / ");
}

export function isEmbeddedManagedConnectionQueryWidget(
  widget: ManagedConnectionQueryWidgetEntry | null | undefined,
  ownerInstanceId?: string,
): widget is ManagedConnectionQueryWidgetEntry & {
  managedBy: DashboardManagedWidgetOwner;
} {
  if (
    !widget ||
    (widget.widgetId !== "connection-query" &&
      widget.widgetId !== "connection-stream-query") ||
    widget.managedBy?.role !== "embedded-connection-source"
  ) {
    return false;
  }

  return ownerInstanceId ? widget.managedBy.ownerInstanceId === ownerInstanceId : true;
}

export function resolveConnectionQueryRuntimeSummary(
  runtimeState: unknown,
): ConnectionQueryRuntimeSummary {
  const normalizedRuntimeState = normalizeConnectionQueryRuntimeState(runtimeState);

  if (!normalizedRuntimeState) {
    return {
      status: "missing",
      tone: "neutral",
      title: "No runtime yet",
      description: "This source has not published a live result yet.",
    };
  }

  if (normalizedRuntimeState.status === "error") {
    return {
      status: "error",
      tone: "danger",
      title: "Runtime error",
      description:
        normalizedRuntimeState.error?.trim() ||
        "The source published an error instead of a dataset.",
    };
  }

  if (normalizedRuntimeState.status === "loading") {
    return {
      status: "loading",
      tone: "warning",
      title: "Running query",
      description: "The source is executing its current connection query.",
    };
  }

  if (normalizedRuntimeState.status === "idle") {
    return {
      status: "idle",
      tone: "neutral",
      title: "Idle",
      description: "The source is waiting for a runtime execution.",
    };
  }

  if (isTabularRuntimeFrame(normalizedRuntimeState)) {
    return {
      status: "ready",
      tone: "success",
      title: "Ready",
      description: `${pluralize(normalizedRuntimeState.rows.length, "row")} across ${pluralize(
        normalizedRuntimeState.columns.length,
        "column",
      )}.`,
    };
  }

  if (isRawFrameRuntime(normalizedRuntimeState)) {
    return {
      status: "ready",
      tone: "success",
      title: "Ready",
      description: `Published ${pluralize(normalizedRuntimeState.fields.length, "field")}.`,
    };
  }

  return {
    status: "ready",
    tone: "success",
    title: "Ready",
    description: "The source published a normalized runtime frame.",
  };
}

export function resolveManagedConnectionQuerySource(
  widgets: readonly ManagedConnectionQueryWidgetEntry[],
  ownerInstanceId: string,
): ManagedConnectionQuerySourceDescriptor | null {
  const normalizedOwnerInstanceId = ownerInstanceId.trim();

  if (!normalizedOwnerInstanceId) {
    return null;
  }

  const widget =
    widgets.find((candidate) =>
      isEmbeddedManagedConnectionQueryWidget(candidate, normalizedOwnerInstanceId),
    ) ?? null;

  if (!widget) {
    return null;
  }

  const runtimeState =
    widget.widgetId === "connection-stream-query"
      ? normalizeConnectionStreamQueryRuntimeState(widget.runtimeState)
      : normalizeConnectionQueryRuntimeState(widget.runtimeState);

  return {
    id: widget.id,
    widgetId: widget.widgetId,
    title: widget.title?.trim() || "Embedded connection source",
    props: widget.widgetId === "connection-stream-query"
      ? normalizeConnectionStreamQueryProps((widget.props ?? {}) as ConnectionQueryWidgetProps)
      : normalizeConnectionQueryProps((widget.props ?? {}) as ConnectionQueryWidgetProps),
    runtimeState,
    runtimeSummary: resolveConnectionQueryRuntimeSummary(widget.runtimeState),
    managedBy: widget.managedBy,
    presentation: widget.presentation,
  };
}
