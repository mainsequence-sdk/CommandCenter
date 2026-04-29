import {
  parseGraphTimeValue,
} from "@/widgets/core/graph/graphModel";
import type { ConnectionStreamQueryRuntimeState } from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";
import { normalizeTabularFrameSource } from "@/widgets/shared/tabular-frame-source";
import { readWidgetRuntimeUpdateContext } from "@/widgets/shared/runtime-update";

import type {
  ConnectionQueryGraphPreviewModel,
  ConnectionQueryModel,
} from "./types";

const DEFAULT_STREAM_PREVIEW_MAX_RETAINED_ROWS = 500;

type PreviewGraphChartType = "line" | "area" | "bar";

export type ConnectionStreamPreviewAccumulationMode =
  | "live-frame"
  | "snapshot-replace"
  | "snapshot-upsert"
  | "delta-append"
  | "delta-merge";

export interface ConnectionStreamPreviewState {
  accumulationMode: ConnectionStreamPreviewAccumulationMode;
  frame: ConnectionStreamQueryRuntimeState;
  lastPlottedAtMs?: number;
  maxRetainedRows: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const entries = value.flatMap((entry) =>
    typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
  );

  return entries.length > 0 ? Array.from(new Set(entries)) : undefined;
}

function normalizePreferredChartType(value: unknown): PreviewGraphChartType | undefined {
  return value === "area" || value === "bar" || value === "line"
    ? value
    : undefined;
}

export function resolveConnectionQueryGraphPreview(
  queryModel: ConnectionQueryModel | null | undefined,
): ConnectionQueryGraphPreviewModel | undefined {
  const graph = queryModel?.preview?.graph;

  if (!isPlainRecord(graph)) {
    return undefined;
  }

  const xField = normalizeTrimmedString(graph.xField);
  const yField = normalizeTrimmedString(graph.yField);

  if (!xField || !yField) {
    return undefined;
  }

  return {
    xField,
    yField,
    groupField: normalizeTrimmedString(graph.groupField),
    rowIdentityFields: normalizeStringArray(graph.rowIdentityFields),
    preferredChartType: normalizePreferredChartType(graph.preferredChartType),
    maxRetainedRows: normalizePositiveInteger(graph.maxRetainedRows),
  };
}

function normalizeGraphDefaults(
  value: unknown,
): {
  xField?: string;
  yField?: string;
  groupField?: string;
  preferredChartType?: PreviewGraphChartType;
} | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const xField = normalizeTrimmedString(value.xField);
  const yField = normalizeTrimmedString(value.yField);
  const groupField = normalizeTrimmedString(value.groupField);
  const preferredChartType = normalizePreferredChartType(value.preferredChartType);

  if (!xField && !yField && !groupField && !preferredChartType) {
    return undefined;
  }

  return {
    xField,
    yField,
    groupField,
    preferredChartType,
  };
}

export function resolveStreamPreviewGraphDefaults(input: {
  frame?: ConnectionStreamQueryRuntimeState | null;
  queryModel?: ConnectionQueryModel | null;
}) {
  const sourceContext = isPlainRecord(input.frame?.source?.context)
    ? input.frame.source.context
    : undefined;
  const existingDefaults = normalizeGraphDefaults(sourceContext?.graphDefaults);

  if (existingDefaults?.xField && existingDefaults?.yField) {
    return existingDefaults;
  }

  const preview = resolveConnectionQueryGraphPreview(input.queryModel);

  if (!preview) {
    return existingDefaults;
  }

  return {
    ...existingDefaults,
    xField: existingDefaults?.xField ?? preview.xField,
    yField: existingDefaults?.yField ?? preview.yField,
    groupField: existingDefaults?.groupField ?? preview.groupField,
    preferredChartType: existingDefaults?.preferredChartType ?? preview.preferredChartType,
  };
}

function buildRowIdentityValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function buildRowIdentityKey(
  row: Record<string, unknown>,
  identityFields: string[],
) {
  return identityFields
    .map((field) => buildRowIdentityValue(row[field]))
    .join("\u001f");
}

function sameStringArray(left: string[] | undefined, right: string[] | undefined) {
  const normalizedLeft = left ?? [];
  const normalizedRight = right ?? [];

  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((entry, index) => entry === normalizedRight[index]);
}

function sameFieldSchema(
  left: ConnectionStreamQueryRuntimeState["fields"],
  right: ConnectionStreamQueryRuntimeState["fields"],
) {
  if (!left?.length && !right?.length) {
    return true;
  }

  if (!left?.length || !right?.length || left.length !== right.length) {
    return false;
  }

  return left.every((field, index) => {
    const nextField = right[index];
    return Boolean(nextField && field.key === nextField.key && field.type === nextField.type);
  });
}

function canAccumulatePreviewFrame(
  retainedFrame: ConnectionStreamQueryRuntimeState | undefined,
  runtimeFrame: ConnectionStreamQueryRuntimeState,
) {
  if (!retainedFrame) {
    return false;
  }

  return sameStringArray(retainedFrame.columns, runtimeFrame.columns) &&
    sameFieldSchema(retainedFrame.fields, runtimeFrame.fields);
}

function trimRetainedRows(
  rows: Array<Record<string, unknown>>,
  maxRetainedRows: number,
) {
  return rows.length > maxRetainedRows ? rows.slice(-maxRetainedRows) : rows;
}

function upsertRowsByIdentity(input: {
  incomingRows: Array<Record<string, unknown>>;
  retainedRows: Array<Record<string, unknown>>;
  rowIdentityFields: string[];
}) {
  const rowsByKey = new Map<string, Record<string, unknown>>();

  input.retainedRows.forEach((row) => {
    rowsByKey.set(buildRowIdentityKey(row, input.rowIdentityFields), row);
  });

  input.incomingRows.forEach((row) => {
    rowsByKey.set(buildRowIdentityKey(row, input.rowIdentityFields), row);
  });

  return Array.from(rowsByKey.values());
}

function resolvePreviewRows(input: {
  retainedFrame?: ConnectionStreamQueryRuntimeState;
  runtimeFrame: ConnectionStreamQueryRuntimeState;
  rowIdentityFields: string[];
  maxRetainedRows: number;
}) {
  const runtimeUpdate = readWidgetRuntimeUpdateContext(input.runtimeFrame);
  const runtimeMode = runtimeUpdate?.mode;
  const deltaFrame = normalizeTabularFrameSource(runtimeUpdate?.deltaOutput);

  if (!input.retainedFrame || !canAccumulatePreviewFrame(input.retainedFrame, input.runtimeFrame)) {
    return {
      accumulationMode: "live-frame" as const,
      rows: trimRetainedRows(input.runtimeFrame.rows, input.maxRetainedRows),
    };
  }

  if (runtimeMode === "delta") {
    const incomingRows = deltaFrame?.rows ?? input.runtimeFrame.rows;

    if (input.rowIdentityFields.length > 0) {
      return {
        accumulationMode: "delta-merge" as const,
        rows: trimRetainedRows(
          upsertRowsByIdentity({
            retainedRows: input.retainedFrame.rows,
            incomingRows,
            rowIdentityFields: input.rowIdentityFields,
          }),
          input.maxRetainedRows,
        ),
      };
    }

    return {
      accumulationMode: "delta-append" as const,
      rows: trimRetainedRows(
        [...input.retainedFrame.rows, ...incomingRows],
        input.maxRetainedRows,
      ),
    };
  }

  if (runtimeMode === "snapshot" && input.rowIdentityFields.length > 0) {
    return {
      accumulationMode: "snapshot-upsert" as const,
      rows: trimRetainedRows(
        upsertRowsByIdentity({
          retainedRows: input.retainedFrame.rows,
          incomingRows: input.runtimeFrame.rows,
          rowIdentityFields: input.rowIdentityFields,
        }),
        input.maxRetainedRows,
      ),
    };
  }

  if (runtimeMode === "snapshot") {
    return {
      accumulationMode: "snapshot-replace" as const,
      rows: trimRetainedRows(input.runtimeFrame.rows, input.maxRetainedRows),
    };
  }

  return {
    accumulationMode: "live-frame" as const,
    rows: trimRetainedRows(input.runtimeFrame.rows, input.maxRetainedRows),
  };
}

function resolveLastPlottedAtMs(
  rows: Array<Record<string, unknown>>,
  xField: string | undefined,
) {
  if (!xField) {
    return undefined;
  }

  let latest: number | undefined;

  rows.forEach((row) => {
    const parsed = parseGraphTimeValue(row[xField]);

    if (parsed === null) {
      return;
    }

    latest = latest === undefined ? parsed : Math.max(latest, parsed);
  });

  return latest;
}

function projectPreviewFrame(input: {
  rows: Array<Record<string, unknown>>;
  runtimeFrame: ConnectionStreamQueryRuntimeState;
  queryModel?: ConnectionQueryModel | null;
}) {
  const graphDefaults = resolveStreamPreviewGraphDefaults({
    frame: input.runtimeFrame,
    queryModel: input.queryModel,
  });
  const sourceContext = isPlainRecord(input.runtimeFrame.source?.context)
    ? input.runtimeFrame.source.context
    : {};

  return {
    ...input.runtimeFrame,
    rows: input.rows,
    source: {
      ...input.runtimeFrame.source,
      kind: input.runtimeFrame.source?.kind ?? "connection-stream-query",
      context: graphDefaults
        ? {
            ...sourceContext,
            graphDefaults,
          }
        : sourceContext,
    },
  } satisfies ConnectionStreamQueryRuntimeState;
}

export function buildConnectionStreamPreviewState(input: {
  retainedPreviewState?: ConnectionStreamPreviewState | null;
  runtimeFrame: ConnectionStreamQueryRuntimeState;
  queryModel?: ConnectionQueryModel | null;
}) {
  const preview = resolveConnectionQueryGraphPreview(input.queryModel);
  const maxRetainedRows =
    preview?.maxRetainedRows ?? DEFAULT_STREAM_PREVIEW_MAX_RETAINED_ROWS;
  const rowIdentityFields = preview?.rowIdentityFields ?? [];
  const retainedFrame = input.retainedPreviewState?.frame;

  if (input.runtimeFrame.status !== "ready") {
    const frame = retainedFrame
      ? projectPreviewFrame({
          rows: retainedFrame.rows,
          runtimeFrame: {
            ...input.runtimeFrame,
            columns: retainedFrame.columns,
            fields: retainedFrame.fields,
            meta: retainedFrame.meta ?? input.runtimeFrame.meta,
          },
          queryModel: input.queryModel,
        })
      : projectPreviewFrame({
          rows: input.runtimeFrame.rows,
          runtimeFrame: input.runtimeFrame,
          queryModel: input.queryModel,
        });

    return {
      accumulationMode: input.retainedPreviewState?.accumulationMode ?? "live-frame",
      frame,
      lastPlottedAtMs: input.retainedPreviewState?.lastPlottedAtMs,
      maxRetainedRows,
    } satisfies ConnectionStreamPreviewState;
  }

  const resolved = resolvePreviewRows({
    retainedFrame,
    runtimeFrame: input.runtimeFrame,
    rowIdentityFields,
    maxRetainedRows,
  });
  const frame = projectPreviewFrame({
    rows: resolved.rows,
    runtimeFrame: input.runtimeFrame,
    queryModel: input.queryModel,
  });
  const graphDefaults = resolveStreamPreviewGraphDefaults({
    frame,
    queryModel: input.queryModel,
  });

  return {
    accumulationMode: resolved.accumulationMode,
    frame,
    lastPlottedAtMs: resolveLastPlottedAtMs(frame.rows, graphDefaults?.xField),
    maxRetainedRows,
  } satisfies ConnectionStreamPreviewState;
}
