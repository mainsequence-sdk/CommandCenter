import { useEffect, useMemo } from "react";

import type { ResolvedUpstreamConsumerState } from "@/widgets/shared/upstream-consumer-state";
import {
  isUpstreamConsumerBindingProblemKind,
} from "@/widgets/shared/upstream-consumer-state";
import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
import { normalizeTabularFrameSource } from "@/widgets/shared/tabular-frame-source";
import { normalizeAnyTabularFrameSource } from "@/widgets/shared/tabular-widget-source";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
  WidgetInstanceBindings,
} from "@/widgets/types";
import type { WidgetRuntimeUpdateEnvelope } from "@/widgets/shared/runtime-update";
import {
  attachRuntimeDataRefToFrame,
  getRuntimeDataRef,
  isRuntimeTabularFrameRef,
  materializeRuntimeTabularFrame,
  useRuntimeDataStore,
  type RuntimeDataStore,
  type RuntimeTabularFrameRef,
} from "@/widgets/shared/runtime-data-store";

export const TABULAR_SEED_INPUT_ID = "seedData";
export const TABULAR_LIVE_UPDATES_INPUT_ID = "liveUpdates";
export const TABULAR_UPDATES_OUTPUT_ID = "updates";

export type IncrementalPublicationSemantics = "incremental";
export type IncrementalPublicationRole = "seed" | "update";

const LEGACY_TABULAR_CONSUMER_WIDGET_IDS = new Set([
  "graph",
  "table",
  "statistic",
  "main-sequence-ohlc-bars",
]);
const LEGACY_TABULAR_SOURCE_INPUT_ID = "sourceData";

interface IncrementalTabularConsumerMeta {
  mode: "incremental-tabular-consumer";
  lastSeedSignature?: string;
  lastSeedSourceRunId?: string;
  lastLiveSignature?: string;
  lastLiveSourceRunId?: string;
  liveMergeKeyFields?: string[];
  seedRef?: RuntimeTabularFrameRef | null;
  liveRef?: RuntimeTabularFrameRef | null;
  outputRef?: RuntimeTabularFrameRef | null;
  seedFrame?: TabularFrameSourceV1 | null;
  liveFrame?: TabularFrameSourceV1 | null;
}

export interface IncrementalTabularConsumerBindingState {
  active: boolean;
  dataset: TabularFrameSourceV1 | null;
  deltaDataset: TabularFrameSourceV1 | null;
  consumerState: ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  liveInput: ResolvedWidgetInput | undefined;
  livePublication: IncrementalTabularPublication | null;
  requiresUpstreamResolution: boolean;
  seedInput: ResolvedWidgetInput | undefined;
  seedPublication: IncrementalTabularPublication | null;
}

interface IncrementalTabularPublication {
  baseFrame: TabularFrameSourceV1 | null;
  baseRef?: RuntimeTabularFrameRef;
  deltaFrame: TabularFrameSourceV1 | null;
  deltaRef?: RuntimeTabularFrameRef;
  role: IncrementalPublicationRole;
  signature: string;
  sourceRunId?: string;
  update?: WidgetRuntimeUpdateEnvelope;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) =>
    typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
  );
}

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }

  if (isPlainRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizeMergeKeyValue(value: unknown) {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return stableJsonStringify(value);
}

function buildRowMergeKey(row: Record<string, unknown>, mergeKeyFields: string[]) {
  return mergeKeyFields.map((field) => normalizeMergeKeyValue(row[field])).join("\u001f");
}

function collectColumns(...frames: TabularFrameSourceV1[]) {
  const columns = new Set<string>();

  frames.forEach((frame) => {
    frame.columns.forEach((column) => {
      if (column.trim()) {
        columns.add(column);
      }
    });
    frame.rows.forEach((row) => {
      Object.keys(row).forEach((column) => {
        if (column.trim()) {
          columns.add(column);
        }
      });
    });
  });

  return Array.from(columns);
}

function collectFields(...frames: TabularFrameSourceV1[]) {
  const fields = new Map<string, NonNullable<TabularFrameSourceV1["fields"]>[number]>();

  frames.forEach((frame) => {
    frame.fields?.forEach((field) => {
      if (!fields.has(field.key)) {
        fields.set(field.key, field);
      }
    });
  });

  return fields.size > 0 ? Array.from(fields.values()) : undefined;
}

function buildConsumerMeta(
  existing: IncrementalTabularConsumerMeta | undefined,
  next: Partial<IncrementalTabularConsumerMeta>,
) {
  return {
    mode: "incremental-tabular-consumer" as const,
    ...(existing ?? {}),
    ...next,
  };
}

function stripConsumerContextFromFrame(
  frame: TabularFrameSourceV1 | null | undefined,
): TabularFrameSourceV1 | null {
  if (!frame) {
    return null;
  }

  if (!frame.source?.context?.incrementalConsumer) {
    return frame;
  }

  const { incrementalConsumer: _discarded, ...restContext } = frame.source.context;

  return {
    ...frame,
    source: {
      ...frame.source,
      context: Object.keys(restContext).length > 0 ? restContext : undefined,
    },
  };
}

function serializeStoredFrame(frame: TabularFrameSourceV1 | null | undefined) {
  if (!frame) {
    return "null";
  }

  return stableJsonStringify({
    status: frame.status,
    columns: frame.columns,
    rows: frame.rows,
    fields: frame.fields,
    meta: frame.meta,
    updatedAtMs: frame.source?.updatedAtMs,
  });
}

function readConsumerMeta(
  frame: TabularFrameSourceV1 | null | undefined,
): IncrementalTabularConsumerMeta | undefined {
  const context = frame?.source?.context;

  if (!isPlainRecord(context) || !isPlainRecord(context.incrementalConsumer)) {
    return undefined;
  }

  const meta = context.incrementalConsumer;

  return meta.mode === "incremental-tabular-consumer"
    ? {
        mode: "incremental-tabular-consumer",
        lastSeedSignature:
          typeof meta.lastSeedSignature === "string" ? meta.lastSeedSignature : undefined,
        lastSeedSourceRunId:
          typeof meta.lastSeedSourceRunId === "string" ? meta.lastSeedSourceRunId : undefined,
        lastLiveSignature:
          typeof meta.lastLiveSignature === "string" ? meta.lastLiveSignature : undefined,
        lastLiveSourceRunId:
          typeof meta.lastLiveSourceRunId === "string" ? meta.lastLiveSourceRunId : undefined,
        liveMergeKeyFields: normalizeStringArray(meta.liveMergeKeyFields),
        seedRef: isRuntimeTabularFrameRef(meta.seedRef) ? meta.seedRef : null,
        liveRef: isRuntimeTabularFrameRef(meta.liveRef) ? meta.liveRef : null,
        outputRef: isRuntimeTabularFrameRef(meta.outputRef) ? meta.outputRef : null,
        seedFrame: stripConsumerContextFromFrame(
          normalizeAnyTabularFrameSource(meta.seedFrame),
        ),
        liveFrame: stripConsumerContextFromFrame(
          normalizeAnyTabularFrameSource(meta.liveFrame),
        ),
      }
    : undefined;
}

function withConsumerMeta(
  frame: TabularFrameSourceV1,
  meta: IncrementalTabularConsumerMeta,
): TabularFrameSourceV1 {
  return {
    ...frame,
    source: {
      ...frame.source,
      kind: frame.source?.kind ?? "incremental-tabular-consumer",
      updatedAtMs: frame.source?.updatedAtMs ?? Date.now(),
      context: {
        ...(frame.source?.context ?? {}),
        incrementalConsumer: meta,
      },
    },
  };
}

function normalizePublicationRole(
  update: WidgetRuntimeUpdateEnvelope | undefined,
  fallbackRole: IncrementalPublicationRole,
): IncrementalPublicationRole {
  return update?.publicationRole === "seed" || update?.publicationRole === "update"
    ? update.publicationRole
    : fallbackRole;
}

function resolvePublicationMergeKeyFields(
  publication: IncrementalTabularPublication | null | undefined,
  fallback?: string[],
) {
  const mergeKeyFields = normalizeStringArray(publication?.update?.diagnostics?.mergeKeyFields);
  return mergeKeyFields.length > 0 ? mergeKeyFields : (fallback ?? []);
}

function normalizeResolvedWidgetInput(
  value: ResolvedWidgetInput | ResolvedWidgetInput[] | undefined,
): ResolvedWidgetInput | undefined {
  return Array.isArray(value)
    ? value.find((entry) => entry.status === "valid") ?? value[0]
    : value;
}

function buildPublicationSignature(input: {
  baseFrame: TabularFrameSourceV1 | null;
  deltaFrame: TabularFrameSourceV1 | null;
  input: ResolvedWidgetInput;
  role: IncrementalPublicationRole;
  sourceRunId?: string;
  update?: WidgetRuntimeUpdateEnvelope;
}) {
  return stableJsonStringify({
    inputId: input.input.inputId,
    sourceWidgetId: input.input.sourceWidgetId,
    sourceOutputId: input.input.sourceOutputId,
    role: input.role,
    sourceRunId: input.sourceRunId,
    sequence:
      typeof input.update?.sequence === "number"
        ? input.update.sequence
        : typeof input.update?.diagnostics?.sequence === "number"
          ? input.update.diagnostics.sequence
          : undefined,
    baseUpdatedAtMs: input.baseFrame?.source?.updatedAtMs,
    deltaUpdatedAtMs: input.deltaFrame?.source?.updatedAtMs,
    baseRows: input.baseFrame?.rows.length ?? null,
    deltaRows: input.deltaFrame?.rows.length ?? null,
  });
}

function buildPublication(
  input: ResolvedWidgetInput | undefined,
  fallbackRole: IncrementalPublicationRole,
  runtimeDataStore?: RuntimeDataStore | null,
): IncrementalTabularPublication | null {
  if (!input || input.status !== "valid") {
    return null;
  }

  const update = input.upstreamUpdate;
  const baseRef =
    (isRuntimeTabularFrameRef(input.upstreamBaseRef) ? input.upstreamBaseRef : undefined) ??
    (isRuntimeTabularFrameRef(input.valueRef) ? input.valueRef : undefined) ??
    (isRuntimeTabularFrameRef(update?.outputRef) ? update.outputRef : undefined) ??
    (isRuntimeTabularFrameRef(update?.retainedOutputRef) ? update.retainedOutputRef : undefined) ??
    getRuntimeDataRef(input.upstreamBase ?? input.value);
  const deltaRef =
    (isRuntimeTabularFrameRef(input.upstreamDeltaRef) ? input.upstreamDeltaRef : undefined) ??
    (isRuntimeTabularFrameRef(update?.deltaOutputRef) ? update.deltaOutputRef : undefined) ??
    getRuntimeDataRef(input.upstreamDelta);
  const baseFrame =
    (baseRef ? materializeRuntimeTabularFrame(baseRef, runtimeDataStore) : null) ??
    normalizeAnyTabularFrameSource(input.upstreamBase ?? input.value);
  const deltaFrame =
    (deltaRef ? materializeRuntimeTabularFrame(deltaRef, runtimeDataStore) : null) ??
    normalizeAnyTabularFrameSource(input.upstreamDelta);
  const role = normalizePublicationRole(update, fallbackRole);
  const sourceRunId =
    typeof update?.sourceRunId === "string" && update.sourceRunId.trim()
      ? update.sourceRunId.trim()
      : undefined;

  if (!baseFrame && !deltaFrame) {
    return null;
  }

  return {
    baseFrame,
    baseRef,
    deltaFrame,
    deltaRef,
    role,
    sourceRunId,
    update,
    signature: buildPublicationSignature({
      baseFrame,
      deltaFrame,
      input,
      role,
      sourceRunId,
      update,
    }),
  };
}

function choosePreferredProblemState(
  states: Array<ResolvedUpstreamConsumerState<TabularFrameSourceV1>>,
) {
  return states.find((state) => isUpstreamConsumerBindingProblemKind(state.kind)) ?? null;
}

function buildInputConsumerState(input: ResolvedWidgetInput | undefined) {
  const dataset = normalizeAnyTabularFrameSource(input?.upstreamBase ?? input?.value);
  const deltaDataset = normalizeAnyTabularFrameSource(input?.upstreamDelta);
  const hasCanonicalSourceBinding = Boolean(input?.sourceWidgetId);
  const hasPublishedValue = Boolean(
    input && (input.upstreamBase !== undefined || input.value !== undefined || input.upstreamDelta !== undefined),
  );

  if (!input || input.status === "unbound") {
    return {
      kind: "unbound",
      dataset,
      deltaDataset,
      inputStatus: input?.status,
      sourceWidgetId: input?.sourceWidgetId,
      sourceOutputId: input?.sourceOutputId,
      sourceWidgetTitle: null,
      error: null,
      requiresUpstreamResolution: false,
      hasCanonicalSourceBinding,
      hasPublishedValue,
      isEmpty: false,
    } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  }

  if (isUpstreamConsumerBindingProblemKind(input.status)) {
    return {
      kind: input.status,
      dataset,
      deltaDataset,
      inputStatus: input.status,
      sourceWidgetId: input.sourceWidgetId,
      sourceOutputId: input.sourceOutputId,
      sourceWidgetTitle: null,
      error: null,
      requiresUpstreamResolution: false,
      hasCanonicalSourceBinding,
      hasPublishedValue,
      isEmpty: false,
    } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  }

  if (!hasPublishedValue) {
    return {
      kind: "awaiting-upstream",
      dataset,
      deltaDataset,
      inputStatus: input.status,
      sourceWidgetId: input.sourceWidgetId,
      sourceOutputId: input.sourceOutputId,
      sourceWidgetTitle: null,
      error: null,
      requiresUpstreamResolution: true,
      hasCanonicalSourceBinding,
      hasPublishedValue,
      isEmpty: false,
    } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  }

  if (!dataset) {
    return {
      kind: "error",
      dataset: null,
      deltaDataset,
      inputStatus: input.status,
      sourceWidgetId: input.sourceWidgetId,
      sourceOutputId: input.sourceOutputId,
      sourceWidgetTitle: null,
      error: "The bound source did not publish a compatible canonical tabular frame.",
      requiresUpstreamResolution: false,
      hasCanonicalSourceBinding,
      hasPublishedValue,
      isEmpty: false,
    } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  }

  if (dataset.status === "loading") {
    return {
      kind: "loading",
      dataset,
      deltaDataset,
      inputStatus: input.status,
      sourceWidgetId: input.sourceWidgetId,
      sourceOutputId: input.sourceOutputId,
      sourceWidgetTitle: null,
      error: null,
      requiresUpstreamResolution: false,
      hasCanonicalSourceBinding,
      hasPublishedValue,
      isEmpty: false,
    } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  }

  if (dataset.status === "error") {
    return {
      kind: "error",
      dataset,
      deltaDataset,
      inputStatus: input.status,
      sourceWidgetId: input.sourceWidgetId,
      sourceOutputId: input.sourceOutputId,
      sourceWidgetTitle: null,
      error: dataset.error ?? "The bound source failed.",
      requiresUpstreamResolution: false,
      hasCanonicalSourceBinding,
      hasPublishedValue,
      isEmpty: false,
    } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  }

  const isEmpty = (dataset.rows?.length ?? 0) === 0;

  return {
    kind: isEmpty ? "empty" : "ready",
    dataset,
    deltaDataset,
    inputStatus: input.status,
    sourceWidgetId: input.sourceWidgetId,
    sourceOutputId: input.sourceOutputId,
    sourceWidgetTitle: null,
    error: null,
    requiresUpstreamResolution: false,
    hasCanonicalSourceBinding,
    hasPublishedValue,
    isEmpty,
  } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
}

function mergeDeltaFrame(
  retainedFrame: TabularFrameSourceV1,
  deltaFrame: TabularFrameSourceV1,
  mergeKeyFields: string[],
) {
  if (mergeKeyFields.length === 0) {
    return {
      ...retainedFrame,
      status: "ready",
      columns: collectColumns(retainedFrame, deltaFrame),
      fields: collectFields(retainedFrame, deltaFrame),
      rows: [...retainedFrame.rows, ...deltaFrame.rows],
      meta: deltaFrame.meta ?? retainedFrame.meta,
      source: {
        ...retainedFrame.source,
        kind: retainedFrame.source?.kind ?? "incremental-tabular-consumer",
        updatedAtMs: Date.now(),
      },
    } satisfies TabularFrameSourceV1;
  }

  const rowsByKey = new Map<string, Record<string, unknown>>();

  retainedFrame.rows.forEach((row) => {
    rowsByKey.set(buildRowMergeKey(row, mergeKeyFields), row);
  });

  deltaFrame.rows.forEach((row) => {
    rowsByKey.set(buildRowMergeKey(row, mergeKeyFields), row);
  });

  return {
    ...retainedFrame,
    status: "ready",
    columns: collectColumns(retainedFrame, deltaFrame),
    fields: collectFields(retainedFrame, deltaFrame),
    rows: Array.from(rowsByKey.values()),
    meta: deltaFrame.meta ?? retainedFrame.meta,
    source: {
      ...retainedFrame.source,
      kind: retainedFrame.source?.kind ?? "incremental-tabular-consumer",
      updatedAtMs: Date.now(),
    },
  } satisfies TabularFrameSourceV1;
}

function applySeedFrame(
  previousFrame: TabularFrameSourceV1 | null,
  publication: IncrementalTabularPublication,
) {
  const nextBase = publication.baseFrame ?? publication.deltaFrame ?? previousFrame;

  if (!nextBase) {
    return previousFrame;
  }

  return {
    ...nextBase,
    status: nextBase.status === "error" ? "error" : nextBase.status === "loading" ? "loading" : "ready",
    source: {
      ...nextBase.source,
      kind: nextBase.source?.kind ?? "incremental-tabular-consumer",
      updatedAtMs: Date.now(),
    },
  } satisfies TabularFrameSourceV1;
}

function applyLivePublication(
  previousFrame: TabularFrameSourceV1 | null,
  publication: IncrementalTabularPublication,
  meta: IncrementalTabularConsumerMeta | undefined,
) {
  if (publication.role === "seed") {
    return applySeedFrame(previousFrame, publication);
  }

  if (
    publication.sourceRunId &&
    meta?.lastLiveSourceRunId &&
    publication.sourceRunId !== meta.lastLiveSourceRunId
  ) {
    return applySeedFrame(previousFrame, publication);
  }

  if (!previousFrame) {
    return applySeedFrame(previousFrame, publication);
  }

  if (!publication.deltaFrame) {
    return publication.baseFrame ?? previousFrame;
  }

  const mergeKeyFields = resolvePublicationMergeKeyFields(publication, meta?.liveMergeKeyFields);

  return mergeDeltaFrame(previousFrame, publication.deltaFrame, mergeKeyFields);
}

function combineSeedAndLiveFrames(input: {
  seedFrame: TabularFrameSourceV1 | null;
  liveFrame: TabularFrameSourceV1 | null;
  mergeKeyFields: string[];
}) {
  if (!input.seedFrame && !input.liveFrame) {
    return null;
  }

  if (!input.seedFrame) {
    return applySeedFrame(null, {
      baseFrame: input.liveFrame,
      deltaFrame: null,
      role: "seed",
      signature: "live-only",
    });
  }

  if (!input.liveFrame) {
    return applySeedFrame(null, {
      baseFrame: input.seedFrame,
      deltaFrame: null,
      role: "seed",
      signature: "seed-only",
    });
  }

  const rows: Array<Record<string, unknown>> = [];

  if (input.mergeKeyFields.length > 0) {
    const rowsByKey = new Map<string, Record<string, unknown>>();

    input.seedFrame.rows.forEach((row) => {
      rowsByKey.set(buildRowMergeKey(row, input.mergeKeyFields), row);
    });

    input.liveFrame.rows.forEach((row) => {
      rowsByKey.set(buildRowMergeKey(row, input.mergeKeyFields), row);
    });

    rows.push(...rowsByKey.values());
  } else {
    const seenRows = new Set<string>();

    [...input.seedFrame.rows, ...input.liveFrame.rows].forEach((row) => {
      const serializedRow = stableJsonStringify(row);

      if (seenRows.has(serializedRow)) {
        return;
      }

      seenRows.add(serializedRow);
      rows.push(row);
    });
  }

  return {
    ...input.seedFrame,
    status:
      input.seedFrame.status === "error" || input.liveFrame.status === "error"
        ? "error"
        : input.seedFrame.status === "loading" || input.liveFrame.status === "loading"
          ? "loading"
          : "ready",
    columns: collectColumns(input.seedFrame, input.liveFrame),
    fields: collectFields(input.seedFrame, input.liveFrame),
    rows,
    meta: input.liveFrame.meta ?? input.seedFrame.meta,
    source: {
      ...input.seedFrame.source,
      kind: input.seedFrame.source?.kind ?? "incremental-tabular-consumer",
      updatedAtMs: Date.now(),
    },
  } satisfies TabularFrameSourceV1;
}

function serializeFrameState(frame: TabularFrameSourceV1 | null | undefined) {
  if (!frame) {
    return "null";
  }

  return stableJsonStringify({
    status: frame.status,
    rowCount: frame.rows.length,
    columnCount: frame.columns.length,
    updatedAtMs: frame.source?.updatedAtMs,
    meta: readConsumerMeta(frame),
  });
}

function sameConsumerMeta(
  left: IncrementalTabularConsumerMeta | undefined,
  right: IncrementalTabularConsumerMeta | undefined,
) {
  return (
    left?.lastSeedSignature === right?.lastSeedSignature &&
    left?.lastSeedSourceRunId === right?.lastSeedSourceRunId &&
    left?.lastLiveSignature === right?.lastLiveSignature &&
    left?.lastLiveSourceRunId === right?.lastLiveSourceRunId &&
    stableJsonStringify(left?.liveMergeKeyFields ?? []) ===
      stableJsonStringify(right?.liveMergeKeyFields ?? []) &&
    serializeStoredFrame(left?.seedFrame) === serializeStoredFrame(right?.seedFrame) &&
    serializeStoredFrame(left?.liveFrame) === serializeStoredFrame(right?.liveFrame)
  );
}

function buildDualConsumerState(input: {
  dataset: TabularFrameSourceV1 | null;
  deltaDataset: TabularFrameSourceV1 | null;
  liveState: ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  seedState: ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
}) {
  const problemState = choosePreferredProblemState([input.seedState, input.liveState]);

  if (problemState) {
    return {
      ...problemState,
      dataset: input.dataset,
      deltaDataset: input.deltaDataset,
      hasCanonicalSourceBinding:
        input.seedState.hasCanonicalSourceBinding || input.liveState.hasCanonicalSourceBinding,
      hasPublishedValue:
        input.seedState.hasPublishedValue || input.liveState.hasPublishedValue,
      requiresUpstreamResolution:
        input.seedState.requiresUpstreamResolution || input.liveState.requiresUpstreamResolution,
      isEmpty: input.dataset ? input.dataset.rows.length === 0 : false,
    } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  }

  if (input.dataset) {
    if (input.dataset.status === "error") {
      return {
        kind: "error",
        dataset: input.dataset,
        deltaDataset: input.deltaDataset,
        inputStatus: undefined,
        sourceWidgetId: input.liveState.sourceWidgetId ?? input.seedState.sourceWidgetId,
        sourceOutputId: input.liveState.sourceOutputId ?? input.seedState.sourceOutputId,
        sourceWidgetTitle: input.liveState.sourceWidgetTitle ?? input.seedState.sourceWidgetTitle ?? null,
        error: input.dataset.error ?? null,
        requiresUpstreamResolution:
          input.seedState.requiresUpstreamResolution || input.liveState.requiresUpstreamResolution,
        hasCanonicalSourceBinding:
          input.seedState.hasCanonicalSourceBinding || input.liveState.hasCanonicalSourceBinding,
        hasPublishedValue:
          input.seedState.hasPublishedValue || input.liveState.hasPublishedValue,
        isEmpty: false,
      } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
    }

    if (input.dataset.status === "loading") {
      return {
        kind: "loading",
        dataset: input.dataset,
        deltaDataset: input.deltaDataset,
        inputStatus: undefined,
        sourceWidgetId: input.liveState.sourceWidgetId ?? input.seedState.sourceWidgetId,
        sourceOutputId: input.liveState.sourceOutputId ?? input.seedState.sourceOutputId,
        sourceWidgetTitle: input.liveState.sourceWidgetTitle ?? input.seedState.sourceWidgetTitle ?? null,
        error: null,
        requiresUpstreamResolution:
          input.seedState.requiresUpstreamResolution || input.liveState.requiresUpstreamResolution,
        hasCanonicalSourceBinding:
          input.seedState.hasCanonicalSourceBinding || input.liveState.hasCanonicalSourceBinding,
        hasPublishedValue:
          input.seedState.hasPublishedValue || input.liveState.hasPublishedValue,
        isEmpty: false,
      } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
    }

    const isEmpty = input.dataset.rows.length === 0;

    return {
      kind: isEmpty ? "empty" : "ready",
      dataset: input.dataset,
      deltaDataset: input.deltaDataset,
      inputStatus: undefined,
      sourceWidgetId: input.liveState.sourceWidgetId ?? input.seedState.sourceWidgetId,
      sourceOutputId: input.liveState.sourceOutputId ?? input.seedState.sourceOutputId,
      sourceWidgetTitle: input.liveState.sourceWidgetTitle ?? input.seedState.sourceWidgetTitle ?? null,
      error: null,
      requiresUpstreamResolution:
        input.seedState.requiresUpstreamResolution || input.liveState.requiresUpstreamResolution,
      hasCanonicalSourceBinding:
        input.seedState.hasCanonicalSourceBinding || input.liveState.hasCanonicalSourceBinding,
      hasPublishedValue:
        input.seedState.hasPublishedValue || input.liveState.hasPublishedValue,
      isEmpty,
    } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  }

  const requiresUpstreamResolution =
    input.seedState.requiresUpstreamResolution || input.liveState.requiresUpstreamResolution;
  const hasCanonicalSourceBinding =
    input.seedState.hasCanonicalSourceBinding || input.liveState.hasCanonicalSourceBinding;
  const hasPublishedValue =
    input.seedState.hasPublishedValue || input.liveState.hasPublishedValue;

  if (requiresUpstreamResolution || hasCanonicalSourceBinding) {
    return {
      kind: "awaiting-upstream",
      dataset: null,
      deltaDataset: input.deltaDataset,
      inputStatus: undefined,
      sourceWidgetId: input.liveState.sourceWidgetId ?? input.seedState.sourceWidgetId,
      sourceOutputId: input.liveState.sourceOutputId ?? input.seedState.sourceOutputId,
      sourceWidgetTitle: input.liveState.sourceWidgetTitle ?? input.seedState.sourceWidgetTitle ?? null,
      error: null,
      requiresUpstreamResolution,
      hasCanonicalSourceBinding,
      hasPublishedValue,
      isEmpty: false,
    } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  }

  return {
    kind: "unbound",
    dataset: null,
    deltaDataset: null,
    inputStatus: undefined,
    sourceWidgetId: undefined,
    sourceOutputId: undefined,
    sourceWidgetTitle: null,
    error: null,
    requiresUpstreamResolution: false,
    hasCanonicalSourceBinding: false,
    hasPublishedValue: false,
    isEmpty: false,
  } satisfies ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
}

export function migrateLegacyIncrementalTabularBindings(
  widgetId: string | undefined,
  bindings: WidgetInstanceBindings | undefined,
) {
  if (!widgetId || !LEGACY_TABULAR_CONSUMER_WIDGET_IDS.has(widgetId) || !bindings) {
    return bindings;
  }

  const sourceBinding = bindings[LEGACY_TABULAR_SOURCE_INPUT_ID];

  if (!sourceBinding || bindings[TABULAR_SEED_INPUT_ID] || bindings[TABULAR_LIVE_UPDATES_INPUT_ID]) {
    return bindings;
  }

  const nextBindings = { ...bindings };
  delete nextBindings[LEGACY_TABULAR_SOURCE_INPUT_ID];
  nextBindings[TABULAR_SEED_INPUT_ID] = sourceBinding;
  return nextBindings;
}

export function hasIncrementalTabularRoleBindings(
  resolvedInputs: ResolvedWidgetInputs | undefined,
) {
  return Boolean(
    resolvedInputs &&
      (TABULAR_SEED_INPUT_ID in resolvedInputs ||
        TABULAR_LIVE_UPDATES_INPUT_ID in resolvedInputs),
  );
}

export function resolveIncrementalTabularRuntimeFrame(
  runtimeState: unknown,
  runtimeDataStore?: RuntimeDataStore | null,
): TabularFrameSourceV1 | null {
  return materializeRuntimeTabularFrame(runtimeState, runtimeDataStore);
}

export function resolveIncrementalTabularOutputFrame(input: {
  resolvedInputs: ResolvedWidgetInputs | undefined;
  runtimeState?: unknown;
  runtimeDataStore?: RuntimeDataStore | null;
}) {
  if (!hasIncrementalTabularRoleBindings(input.resolvedInputs)) {
    return null;
  }

  const runtimeFrame = resolveIncrementalTabularRuntimeFrame(
    input.runtimeState,
    input.runtimeDataStore,
  );

  if (runtimeFrame) {
    return runtimeFrame;
  }

  const seedInput = normalizeResolvedWidgetInput(input.resolvedInputs?.[TABULAR_SEED_INPUT_ID]);
  const liveInput = normalizeResolvedWidgetInput(input.resolvedInputs?.[TABULAR_LIVE_UPDATES_INPUT_ID]);

  const seedValue = seedInput?.upstreamBaseRef ?? seedInput?.valueRef ?? seedInput?.upstreamBase ?? seedInput?.value;
  const liveValue = liveInput?.upstreamBaseRef ?? liveInput?.valueRef ?? liveInput?.upstreamBase ?? liveInput?.value;

  return (
    materializeRuntimeTabularFrame(seedValue, input.runtimeDataStore) ??
    materializeRuntimeTabularFrame(liveValue, input.runtimeDataStore) ??
    normalizeAnyTabularFrameSource(seedInput?.upstreamBase ?? seedInput?.value) ??
    normalizeAnyTabularFrameSource(liveInput?.upstreamBase ?? liveInput?.value)
  );
}

export function useIncrementalTabularConsumerBindingState(input: {
  instanceId?: string;
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeState?: Record<string, unknown>;
}) {
  const runtimeDataStore = useRuntimeDataStore();
  const seedInput = normalizeResolvedWidgetInput(input.resolvedInputs?.[TABULAR_SEED_INPUT_ID]);
  const liveInput = normalizeResolvedWidgetInput(input.resolvedInputs?.[TABULAR_LIVE_UPDATES_INPUT_ID]);
  const seedState = useMemo(() => buildInputConsumerState(seedInput), [seedInput]);
  const liveState = useMemo(() => buildInputConsumerState(liveInput), [liveInput]);
  const active = hasIncrementalTabularRoleBindings(input.resolvedInputs);
  const seedPublication = useMemo(
    () => buildPublication(seedInput, "seed", runtimeDataStore),
    [runtimeDataStore, seedInput],
  );
  const livePublication = useMemo(
    () => buildPublication(liveInput, "update", runtimeDataStore),
    [liveInput, runtimeDataStore],
  );
  const runtimeFrame = useMemo(
    () => resolveIncrementalTabularRuntimeFrame(input.runtimeState, runtimeDataStore),
    [input.runtimeState, runtimeDataStore],
  );
  const runtimeStateFrame = useMemo(
    () => normalizeAnyTabularFrameSource(input.runtimeState),
    [input.runtimeState],
  );
  const runtimeFrameSignature = useMemo(
    () => serializeFrameState(runtimeStateFrame ?? runtimeFrame),
    [runtimeFrame, runtimeStateFrame],
  );

  useEffect(() => {
    if (!active) {
      if (input.runtimeState) {
        input.onRuntimeStateChange?.(undefined);
      }
      return;
    }

    const currentRuntimeStateFrame = normalizeAnyTabularFrameSource(input.runtimeState);
    const currentFrame =
      resolveIncrementalTabularRuntimeFrame(input.runtimeState, runtimeDataStore) ??
      currentRuntimeStateFrame;
    const currentMeta = readConsumerMeta(currentRuntimeStateFrame) ?? readConsumerMeta(currentFrame);
    let nextSeedFrame =
      (currentMeta?.seedRef ? runtimeDataStore?.readFrame(currentMeta.seedRef) : null) ??
      currentMeta?.seedFrame ??
      null;
    let nextLiveFrame =
      (currentMeta?.liveRef ? runtimeDataStore?.readFrame(currentMeta.liveRef) : null) ??
      currentMeta?.liveFrame ??
      null;
    let nextLiveMergeKeyFields = currentMeta?.liveMergeKeyFields ?? [];
    let nextMeta = currentMeta ?? buildConsumerMeta(undefined, {});
    let frameChanged = false;
    let metaChanged = !currentMeta;

    if (
      seedPublication &&
      seedPublication.role === "seed" &&
      seedPublication.signature !== currentMeta?.lastSeedSignature
    ) {
      const seededFrame = applySeedFrame(nextSeedFrame, seedPublication);

      if (seededFrame) {
        nextSeedFrame = seededFrame;
        nextMeta = buildConsumerMeta(nextMeta, {
          lastSeedSignature: seedPublication.signature,
          lastSeedSourceRunId: seedPublication.sourceRunId,
        });
        frameChanged = true;
      }
    }

    if (livePublication && livePublication.signature !== currentMeta?.lastLiveSignature) {
      const liveFrame = applyLivePublication(nextLiveFrame, livePublication, currentMeta);

      if (liveFrame) {
        nextLiveFrame = liveFrame;
        nextLiveMergeKeyFields = resolvePublicationMergeKeyFields(
          livePublication,
          currentMeta?.liveMergeKeyFields,
        );
        nextMeta = buildConsumerMeta(nextMeta, {
          lastLiveSignature: livePublication.signature,
          lastLiveSourceRunId: livePublication.sourceRunId,
          liveMergeKeyFields: nextLiveMergeKeyFields,
        });
        frameChanged = true;
      }
    }

    const nextFrame = combineSeedAndLiveFrames({
      seedFrame: nextSeedFrame,
      liveFrame: nextLiveFrame,
      mergeKeyFields: nextLiveMergeKeyFields,
    });

    if (!nextFrame) {
      return;
    }

    let nextRuntimeFrame = nextFrame;
    const ownerId = input.instanceId ?? "incremental-tabular-consumer";
    const seedRef =
      seedPublication?.baseRef ??
      currentMeta?.seedRef ??
      (nextSeedFrame && runtimeDataStore
        ? runtimeDataStore.putSnapshot({
          ownerId,
          outputId: TABULAR_SEED_INPUT_ID,
          frame: nextSeedFrame,
          refKey: `${ownerId}:${TABULAR_SEED_INPUT_ID}`,
        })
        : null);
    const liveRef =
      livePublication?.baseRef ??
      livePublication?.deltaRef ??
      currentMeta?.liveRef ??
      (nextLiveFrame && runtimeDataStore
        ? runtimeDataStore.putSnapshot({
          ownerId,
          outputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          frame: nextLiveFrame,
          refKey: `${ownerId}:${TABULAR_LIVE_UPDATES_INPUT_ID}`,
        })
        : null);
    const outputRef = runtimeDataStore
      ? runtimeDataStore.putSnapshot({
        ownerId,
        outputId: "dataset",
        frame: nextFrame,
        refKey: `${ownerId}:dataset`,
      })
      : null;

    if (outputRef) {
      nextRuntimeFrame = attachRuntimeDataRefToFrame(nextFrame, outputRef);
    }

    nextMeta = buildConsumerMeta(nextMeta, {
      seedRef,
      liveRef,
      outputRef,
      seedFrame: runtimeDataStore ? null : stripConsumerContextFromFrame(nextSeedFrame),
      liveFrame: runtimeDataStore ? null : stripConsumerContextFromFrame(nextLiveFrame),
      liveMergeKeyFields: nextLiveMergeKeyFields,
    });
    metaChanged = metaChanged || !sameConsumerMeta(currentMeta, nextMeta);

    if (!frameChanged && !metaChanged) {
      return;
    }

    const nextRuntimeFrameWithMeta = withConsumerMeta(nextRuntimeFrame, nextMeta);
    const nextSignature = serializeFrameState(nextRuntimeFrameWithMeta);

    if (nextSignature !== runtimeFrameSignature) {
      input.onRuntimeStateChange?.(nextRuntimeFrameWithMeta as unknown as Record<string, unknown>);
    }
  }, [
    active,
    input.instanceId,
    input.onRuntimeStateChange,
    input.runtimeState,
    livePublication,
    runtimeFrameSignature,
    runtimeDataStore,
    seedPublication,
  ]);

  const dataset = useMemo(
    () => resolveIncrementalTabularRuntimeFrame(input.runtimeState, runtimeDataStore),
    [input.runtimeState, runtimeDataStore],
  );
  const deltaDataset = livePublication?.deltaFrame ?? null;
  const consumerState = useMemo(
    () =>
      buildDualConsumerState({
        dataset,
        deltaDataset,
        liveState,
        seedState,
      }),
    [dataset, deltaDataset, liveState, seedState],
  );

  return {
    active,
    dataset,
    deltaDataset,
    consumerState,
    liveInput,
    livePublication,
    requiresUpstreamResolution:
      seedState.requiresUpstreamResolution || liveState.requiresUpstreamResolution,
    seedInput,
    seedPublication,
  } satisfies IncrementalTabularConsumerBindingState;
}
