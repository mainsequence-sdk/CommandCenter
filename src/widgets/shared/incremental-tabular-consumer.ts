import { useEffect, useMemo } from "react";

import type { ResolvedUpstreamConsumerState } from "@/widgets/shared/upstream-consumer-state";
import {
  isUpstreamConsumerBindingProblemKind,
} from "@/widgets/shared/upstream-consumer-state";
import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
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
  selectRuntimeRows,
  useRuntimeDataStore,
  type RuntimeRetentionPolicy,
  type RuntimeDataStore,
  type RuntimeRowSelector,
  type RuntimeTabularFrameRef,
} from "@/widgets/shared/runtime-data-store";

export const TABULAR_SEED_INPUT_ID = "seedData";
export const TABULAR_LIVE_UPDATES_INPUT_ID = "liveUpdates";
export const TABULAR_UPDATES_OUTPUT_ID = "updates";

export type IncrementalPublicationSemantics = "incremental";
export type IncrementalPublicationRole = "seed" | "update";
export interface TabularMergeKeyMapping {
  seedField: string;
  liveField: string;
}

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
  reductionSignature?: string;
  liveMergeKeyFields?: string[];
  liveMergeKeyMappings?: TabularMergeKeyMapping[];
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

function cloneJsonValue<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
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

function normalizeMergeKeyMappings(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isPlainRecord(entry)) {
      return [];
    }

    const seedField = typeof entry.seedField === "string" ? entry.seedField.trim() : "";
    const liveField = typeof entry.liveField === "string" ? entry.liveField.trim() : "";

    return seedField && liveField ? [{ seedField, liveField }] : [];
  });
}

function mergeKeyFieldsToMappings(fields: string[]): TabularMergeKeyMapping[] {
  return fields.map((field) => ({ seedField: field, liveField: field }));
}

function normalizeResolvedMergeKeyMappings(input: {
  mergeKeyFields?: string[];
  mergeKeyMappings?: TabularMergeKeyMapping[];
}) {
  const mappings = normalizeMergeKeyMappings(input.mergeKeyMappings);

  return mappings.length > 0
    ? mappings
    : mergeKeyFieldsToMappings(input.mergeKeyFields ?? []);
}

function buildMappedRowMergeKey(
  row: Record<string, unknown>,
  mappings: TabularMergeKeyMapping[],
  side: "seed" | "live",
) {
  return mappings
    .map((mapping) =>
      normalizeMergeKeyValue(row[side === "seed" ? mapping.seedField : mapping.liveField]),
    )
    .join("\u001f");
}

function normalizeLivePatchRow(
  liveRow: Record<string, unknown>,
  mappings: TabularMergeKeyMapping[],
) {
  const patch = { ...liveRow };

  mappings.forEach((mapping) => {
    if (mapping.seedField === mapping.liveField || !(mapping.liveField in patch)) {
      return;
    }

    if (!(mapping.seedField in patch)) {
      patch[mapping.seedField] = patch[mapping.liveField];
    }
    delete patch[mapping.liveField];
  });

  return patch;
}

function patchRetainedRow(
  retainedRow: Record<string, unknown> | undefined,
  liveRow: Record<string, unknown>,
  mappings: TabularMergeKeyMapping[],
) {
  const patch = normalizeLivePatchRow(liveRow, mappings);

  return retainedRow
    ? {
        ...retainedRow,
        ...patch,
      }
    : patch;
}

function resolveMarketAssetKeyFields(frame: Pick<TabularFrameSourceV1, "meta"> | null | undefined) {
  const marketAsset = isPlainRecord(frame?.meta?.marketAsset)
    ? frame.meta.marketAsset
    : undefined;
  const fieldRoles = Array.isArray(marketAsset?.fieldRoles)
    ? marketAsset.fieldRoles
    : [];

  return Array.from(
    new Set(
      fieldRoles.flatMap((entry) => {
        if (!isPlainRecord(entry) || entry.role !== "assetKey") {
          return [];
        }

        return typeof entry.field === "string" && entry.field.trim()
          ? [entry.field.trim()]
          : [];
      }),
    ),
  );
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
    error: frame.error,
    columns: frame.columns,
    rows: frame.rows,
    fields: frame.fields,
    meta: frame.meta,
  });
}

function serializeByValueFrameIdentity(frame: TabularFrameSourceV1 | null | undefined) {
  if (!frame) {
    return "null";
  }

  return serializeStoredFrame(stripConsumerContextFromFrame(frame));
}

function serializeRuntimeDataRef(ref: RuntimeTabularFrameRef | null | undefined) {
  if (!ref) {
    return "null";
  }

  return stableJsonStringify({
    refId: ref.refId,
    workspaceRuntimeId: ref.workspaceRuntimeId,
    ownerId: ref.ownerId,
    outputId: ref.outputId,
    version: ref.version,
    rowCount: ref.rowCount,
    schemaSignature: ref.schemaSignature,
    status: ref.status,
    error: ref.error,
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
        reductionSignature:
          typeof meta.reductionSignature === "string" ? meta.reductionSignature : undefined,
        liveMergeKeyFields: normalizeStringArray(meta.liveMergeKeyFields),
        liveMergeKeyMappings: normalizeMergeKeyMappings(meta.liveMergeKeyMappings),
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

function preserveRuntimeInteractionNamespace(
  nextRuntimeState: Record<string, unknown> | undefined,
  previousRuntimeState: unknown,
) {
  if (!isPlainRecord(previousRuntimeState) || !isPlainRecord(previousRuntimeState.interaction)) {
    return nextRuntimeState;
  }

  return {
    ...(nextRuntimeState ?? {}),
    interaction: cloneJsonValue(previousRuntimeState.interaction),
  };
}

function clearIncrementalFrameRuntimeState(
  previousRuntimeState: Record<string, unknown> | undefined,
) {
  const preserved = preserveRuntimeInteractionNamespace(undefined, previousRuntimeState);
  return preserved && Object.keys(preserved).length > 0 ? preserved : undefined;
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
  override?: string[],
) {
  if (override !== undefined) {
    return override;
  }

  const mergeKeyFields = normalizeStringArray(publication?.update?.diagnostics?.mergeKeyFields);
  return mergeKeyFields.length > 0 ? mergeKeyFields : (fallback ?? []);
}

function resolvePublicationMergeKeyMappings(input: {
  publication: IncrementalTabularPublication | null | undefined;
  previousFrame?: TabularFrameSourceV1 | null;
  fallbackFields?: string[];
  fallbackMappings?: TabularMergeKeyMapping[];
  overrideFields?: string[];
  overrideMappings?: TabularMergeKeyMapping[];
}) {
  const overrideMappings = normalizeMergeKeyMappings(input.overrideMappings);

  if (overrideMappings.length > 0) {
    return overrideMappings;
  }

  if (input.overrideFields !== undefined) {
    return mergeKeyFieldsToMappings(normalizeStringArray(input.overrideFields));
  }

  const diagnosticsMappings = normalizeMergeKeyMappings(
    input.publication?.update?.diagnostics?.mergeKeyMappings,
  );

  if (diagnosticsMappings.length > 0) {
    return diagnosticsMappings;
  }

  const diagnosticsFields = normalizeStringArray(
    input.publication?.update?.diagnostics?.mergeKeyFields,
  );

  if (diagnosticsFields.length > 0) {
    return mergeKeyFieldsToMappings(diagnosticsFields);
  }

  const fallbackMappings = normalizeMergeKeyMappings(input.fallbackMappings);

  if (fallbackMappings.length > 0) {
    return fallbackMappings;
  }

  const fallbackFields = normalizeStringArray(input.fallbackFields);

  if (fallbackFields.length > 0) {
    return mergeKeyFieldsToMappings(fallbackFields);
  }

  return mergeKeyFieldsToMappings(resolveMarketAssetKeyFields(input.previousFrame));
}

function normalizeResolvedWidgetInput(
  value: ResolvedWidgetInput | ResolvedWidgetInput[] | undefined,
): ResolvedWidgetInput | undefined {
  return Array.isArray(value)
    ? value.find((entry) => entry.status === "valid") ?? value[0]
    : value;
}

function applyRuntimeRowSelectorToFrame(
  frame: TabularFrameSourceV1 | null,
  selector: RuntimeRowSelector | undefined,
) {
  if (!frame || !selector) {
    return frame;
  }

  return {
    ...frame,
    rows: selectRuntimeRows(frame.rows, selector),
  } satisfies TabularFrameSourceV1;
}

function runtimeRetentionFromSelector(
  selector: RuntimeRowSelector | undefined,
): RuntimeRetentionPolicy | undefined {
  if (!selector?.limit || selector.direction === "earliest" || selector.offset) {
    return undefined;
  }

  return { maxRows: selector.limit };
}

function buildPublicationSignature(input: {
  baseFrame: TabularFrameSourceV1 | null;
  baseRef?: RuntimeTabularFrameRef;
  deltaFrame: TabularFrameSourceV1 | null;
  deltaRef?: RuntimeTabularFrameRef;
  input: ResolvedWidgetInput;
  role: IncrementalPublicationRole;
  sourceRunId?: string;
  update?: WidgetRuntimeUpdateEnvelope;
}) {
  const hasRefBackedIdentity = Boolean(input.baseRef || input.deltaRef);

  return stableJsonStringify({
    inputId: input.input.inputId,
    sourceWidgetId: input.input.sourceWidgetId,
    sourceOutputId: input.input.sourceOutputId,
    role: input.role,
    sourceRunId: hasRefBackedIdentity ? undefined : input.sourceRunId,
    sequence:
      hasRefBackedIdentity
        ? undefined
        : typeof input.update?.sequence === "number"
        ? input.update.sequence
        : typeof input.update?.diagnostics?.sequence === "number"
          ? input.update.diagnostics.sequence
          : undefined,
    baseRef: input.baseRef
      ? {
          refId: input.baseRef.refId,
          version: input.baseRef.version,
          rowCount: input.baseRef.rowCount,
        }
      : undefined,
    deltaRef: input.deltaRef
      ? {
          refId: input.deltaRef.refId,
          version: input.deltaRef.version,
          rowCount: input.deltaRef.rowCount,
        }
      : undefined,
    baseFrame: input.baseRef ? undefined : serializeByValueFrameIdentity(input.baseFrame),
    deltaFrame: input.deltaRef ? undefined : serializeByValueFrameIdentity(input.deltaFrame),
  });
}

function serializeRetentionPolicy(retention: RuntimeRetentionPolicy | undefined) {
  return stableJsonStringify({
    maxRows: retention?.maxRows,
  });
}

function serializeRowSelector(selector: RuntimeRowSelector | undefined) {
  return stableJsonStringify({
    direction: selector?.direction,
    limit: selector?.limit,
    offset: selector?.offset,
  });
}

function buildReductionSignature(input: {
  seedPublication: IncrementalTabularPublication | null;
  livePublication: IncrementalTabularPublication | null;
  mergeKeyFields: string[];
  mergeKeyMappings?: TabularMergeKeyMapping[];
  retention?: RuntimeRetentionPolicy;
  rowSelector?: RuntimeRowSelector;
}) {
  return stableJsonStringify({
    seedSignature: input.seedPublication?.signature ?? null,
    liveSignature: input.livePublication?.signature ?? null,
    mergeKeyFields: input.mergeKeyFields,
    mergeKeyMappings: input.mergeKeyMappings ?? [],
    retention: serializeRetentionPolicy(input.retention),
    rowSelector: serializeRowSelector(input.rowSelector),
  });
}

function hasFrameRows(frame: TabularFrameSourceV1 | null | undefined) {
  return (frame?.rows.length ?? 0) > 0;
}

function resolveRenderableFrameStatus(
  frames: Array<TabularFrameSourceV1 | null | undefined>,
  rowCount: number,
): TabularFrameSourceV1["status"] {
  if (frames.some((frame) => frame?.status === "error")) {
    return "error";
  }

  if (rowCount > 0) {
    return "ready";
  }

  if (frames.some((frame) => frame?.status === "loading")) {
    return "loading";
  }

  if (frames.some((frame) => frame?.status === "idle")) {
    return "idle";
  }

  return "ready";
}

function isInitialRolePending(
  state: ResolvedUpstreamConsumerState<TabularFrameSourceV1>,
  frame: TabularFrameSourceV1 | null,
) {
  if (state.kind === "error" || isUpstreamConsumerBindingProblemKind(state.kind)) {
    return false;
  }

  return (
    state.kind === "awaiting-upstream" ||
    state.kind === "loading" ||
    !hasFrameRows(frame)
  );
}

function shouldAwaitInitialDualRoleBaseline(input: {
  seedInput: ResolvedWidgetInput | undefined;
  liveInput: ResolvedWidgetInput | undefined;
  seedState: ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  liveState: ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  currentOutputFrame?: TabularFrameSourceV1 | null;
  seedFrame: TabularFrameSourceV1 | null;
  liveFrame: TabularFrameSourceV1 | null;
}) {
  const hasBoundSeedRole = input.seedInput?.status === "valid";
  const hasBoundLiveRole = input.liveInput?.status === "valid";

  if (!hasBoundSeedRole || !hasBoundLiveRole) {
    return false;
  }

  if (hasFrameRows(input.currentOutputFrame)) {
    return false;
  }

  return (
    isInitialRolePending(input.seedState, input.seedFrame) ||
    isInitialRolePending(input.liveState, input.liveFrame)
  );
}

function buildPendingSeedBaselineFrame(input: {
  seedFrame: TabularFrameSourceV1 | null;
  liveFrame: TabularFrameSourceV1 | null;
}) {
  const template = input.seedFrame ?? input.liveFrame;

  return {
    status: "loading",
    columns: template?.columns ?? [],
    rows: [],
    fields: template?.fields,
    meta: template?.meta,
    source: {
      ...template?.source,
      kind: template?.source?.kind ?? "incremental-tabular-consumer",
      updatedAtMs: Date.now(),
    },
  } satisfies TabularFrameSourceV1;
}

function buildPublication(
  input: ResolvedWidgetInput | undefined,
  fallbackRole: IncrementalPublicationRole,
  runtimeDataStore?: RuntimeDataStore | null,
  rowSelector?: RuntimeRowSelector,
): IncrementalTabularPublication | null {
  if (!input || input.status !== "valid") {
    return null;
  }

  const update = input.upstreamUpdate;
  const role = normalizePublicationRole(update, fallbackRole);
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
    (baseRef ? materializeRuntimeTabularFrame(baseRef, runtimeDataStore, rowSelector) : null) ??
    applyRuntimeRowSelectorToFrame(
      normalizeAnyTabularFrameSource(input.upstreamBase ?? input.value),
      rowSelector,
    );
  const deltaSelector = role === "seed" ? rowSelector : undefined;
  const deltaFrame =
    (deltaRef ? materializeRuntimeTabularFrame(deltaRef, runtimeDataStore, deltaSelector) : null) ??
    applyRuntimeRowSelectorToFrame(
      normalizeAnyTabularFrameSource(input.upstreamDelta),
      deltaSelector,
    );
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
      baseRef,
      deltaFrame,
      deltaRef,
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

  if (dataset.status === "idle") {
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
  mergeKeyMappings: TabularMergeKeyMapping[],
) {
  let mergedRows: Array<Record<string, unknown>>;

  if (mergeKeyMappings.length === 0) {
    mergedRows = [...retainedFrame.rows, ...deltaFrame.rows];
  } else {
    const rowsByKey = new Map<string, Record<string, unknown>>();

    retainedFrame.rows.forEach((row) => {
      rowsByKey.set(buildMappedRowMergeKey(row, mergeKeyMappings, "seed"), row);
    });

    deltaFrame.rows.forEach((row) => {
      const key = buildMappedRowMergeKey(row, mergeKeyMappings, "live");
      rowsByKey.set(key, patchRetainedRow(rowsByKey.get(key), row, mergeKeyMappings));
    });

    mergedRows = Array.from(rowsByKey.values());
  }

  return {
    ...retainedFrame,
    status: resolveRenderableFrameStatus([retainedFrame, deltaFrame], mergedRows.length),
    columns: retainedFrame.columns,
    fields: retainedFrame.fields,
    rows: mergedRows,
    meta: retainedFrame.meta,
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
    status: resolveRenderableFrameStatus([nextBase], nextBase.rows.length),
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
  liveMergeKeyFieldsOverride?: string[],
  liveMergeKeyMappingsOverride?: TabularMergeKeyMapping[],
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

  const mergeKeyMappings = resolvePublicationMergeKeyMappings({
    publication,
    previousFrame,
    fallbackFields: meta?.liveMergeKeyFields,
    fallbackMappings: meta?.liveMergeKeyMappings,
    overrideFields: liveMergeKeyFieldsOverride,
    overrideMappings: liveMergeKeyMappingsOverride?.map((mapping) => ({
      seedField: mapping.liveField,
      liveField: mapping.liveField,
    })),
  });

  return mergeDeltaFrame(previousFrame, publication.deltaFrame, mergeKeyMappings);
}

function combineSeedAndLiveFrames(input: {
  seedFrame: TabularFrameSourceV1 | null;
  liveFrame: TabularFrameSourceV1 | null;
  mergeKeyFields: string[];
  mergeKeyMappings?: TabularMergeKeyMapping[];
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
  const mergeKeyMappings = normalizeResolvedMergeKeyMappings({
    mergeKeyFields: input.mergeKeyFields,
    mergeKeyMappings: input.mergeKeyMappings,
  });

  if (mergeKeyMappings.length > 0) {
    const rowsByKey = new Map<string, Record<string, unknown>>();

    input.seedFrame.rows.forEach((row) => {
      rowsByKey.set(buildMappedRowMergeKey(row, mergeKeyMappings, "seed"), row);
    });

    input.liveFrame.rows.forEach((row) => {
      const key = buildMappedRowMergeKey(row, mergeKeyMappings, "live");
      rowsByKey.set(key, patchRetainedRow(rowsByKey.get(key), row, mergeKeyMappings));
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
    status: resolveRenderableFrameStatus(
    [input.seedFrame, input.liveFrame],
      rows.length,
    ),
    columns: input.seedFrame.columns,
    fields: input.seedFrame.fields,
    rows,
    meta: input.seedFrame.meta,
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

  const runtimeRef = getRuntimeDataRef(frame);
  const normalizedFrame = stripConsumerContextFromFrame(frame);

  return stableJsonStringify({
    runtimeRef: runtimeRef ? serializeRuntimeDataRef(runtimeRef) : undefined,
    frame: runtimeRef ? undefined : serializeStoredFrame(normalizedFrame),
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
    left?.reductionSignature === right?.reductionSignature &&
    stableJsonStringify(left?.liveMergeKeyFields ?? []) ===
      stableJsonStringify(right?.liveMergeKeyFields ?? []) &&
    stableJsonStringify(left?.liveMergeKeyMappings ?? []) ===
      stableJsonStringify(right?.liveMergeKeyMappings ?? []) &&
    serializeRuntimeDataRef(left?.seedRef) === serializeRuntimeDataRef(right?.seedRef) &&
    serializeRuntimeDataRef(left?.liveRef) === serializeRuntimeDataRef(right?.liveRef) &&
    serializeRuntimeDataRef(left?.outputRef) === serializeRuntimeDataRef(right?.outputRef) &&
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
  const primarySourceWidgetId =
    input.seedState.sourceWidgetId ?? input.liveState.sourceWidgetId;
  const primarySourceOutputId =
    input.seedState.sourceOutputId ?? input.liveState.sourceOutputId;
  const primarySourceWidgetTitle =
    input.seedState.sourceWidgetTitle ?? input.liveState.sourceWidgetTitle ?? null;
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
        sourceWidgetId: primarySourceWidgetId,
        sourceOutputId: primarySourceOutputId,
        sourceWidgetTitle: primarySourceWidgetTitle,
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

    if (input.dataset.status === "idle") {
      return {
        kind: "awaiting-upstream",
        dataset: input.dataset,
        deltaDataset: input.deltaDataset,
        inputStatus: undefined,
        sourceWidgetId: primarySourceWidgetId,
        sourceOutputId: primarySourceOutputId,
        sourceWidgetTitle: primarySourceWidgetTitle,
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

    if (input.dataset.status === "loading") {
      return {
        kind: "loading",
        dataset: input.dataset,
        deltaDataset: input.deltaDataset,
        inputStatus: undefined,
        sourceWidgetId: primarySourceWidgetId,
        sourceOutputId: primarySourceOutputId,
        sourceWidgetTitle: primarySourceWidgetTitle,
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
      sourceWidgetId: primarySourceWidgetId,
      sourceOutputId: primarySourceOutputId,
      sourceWidgetTitle: primarySourceWidgetTitle,
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
      sourceWidgetId: primarySourceWidgetId,
      sourceOutputId: primarySourceOutputId,
      sourceWidgetTitle: primarySourceWidgetTitle,
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
  rowSelector?: RuntimeRowSelector,
): TabularFrameSourceV1 | null {
  return materializeRuntimeTabularFrame(runtimeState, runtimeDataStore, rowSelector);
}

export function resolveIncrementalTabularOutputFrame(input: {
  resolvedInputs: ResolvedWidgetInputs | undefined;
  liveMergeKeyFields?: string[];
  liveMergeKeyMappings?: TabularMergeKeyMapping[];
  runtimeState?: unknown;
  runtimeDataStore?: RuntimeDataStore | null;
  runtimeRowSelector?: RuntimeRowSelector;
}) {
  if (!hasIncrementalTabularRoleBindings(input.resolvedInputs)) {
    return null;
  }

  const runtimeFrame = resolveIncrementalTabularRuntimeFrame(
    input.runtimeState,
    input.runtimeDataStore,
    input.runtimeRowSelector,
  );

  if (runtimeFrame) {
    return runtimeFrame.status === "idle" ? null : runtimeFrame;
  }

  const seedInput = normalizeResolvedWidgetInput(input.resolvedInputs?.[TABULAR_SEED_INPUT_ID]);
  const liveInput = normalizeResolvedWidgetInput(input.resolvedInputs?.[TABULAR_LIVE_UPDATES_INPUT_ID]);
  const seedFrame =
    materializeRuntimeTabularFrame(
      seedInput?.upstreamBaseRef ?? seedInput?.valueRef ?? seedInput?.upstreamBase ?? seedInput?.value,
      input.runtimeDataStore,
      input.runtimeRowSelector,
    ) ??
    applyRuntimeRowSelectorToFrame(
      normalizeAnyTabularFrameSource(seedInput?.upstreamBase ?? seedInput?.value),
      input.runtimeRowSelector,
    );
  const liveFrame =
    materializeRuntimeTabularFrame(
      liveInput?.upstreamBaseRef ?? liveInput?.valueRef ?? liveInput?.upstreamBase ?? liveInput?.value,
      input.runtimeDataStore,
      input.runtimeRowSelector,
    ) ??
    applyRuntimeRowSelectorToFrame(
      normalizeAnyTabularFrameSource(liveInput?.upstreamBase ?? liveInput?.value),
      input.runtimeRowSelector,
    );
  const seedState = buildInputConsumerState(seedInput);
  const liveState = buildInputConsumerState(liveInput);
  const livePublication = buildPublication(
    liveInput,
    "update",
    input.runtimeDataStore,
    input.runtimeRowSelector,
  );

  if (shouldAwaitInitialDualRoleBaseline({
    seedInput,
    liveInput,
    seedState,
    liveState,
    currentOutputFrame: null,
    seedFrame,
    liveFrame,
  })) {
    return seedFrame?.status === "loading" ? seedFrame : null;
  }

  const combinedFrame = combineSeedAndLiveFrames({
    seedFrame,
    liveFrame,
    mergeKeyFields: resolvePublicationMergeKeyFields(
      livePublication,
      resolveMarketAssetKeyFields(seedFrame),
      input.liveMergeKeyFields,
    ),
    mergeKeyMappings: resolvePublicationMergeKeyMappings({
      publication: livePublication,
      previousFrame: seedFrame,
      overrideFields: input.liveMergeKeyFields,
      overrideMappings: input.liveMergeKeyMappings,
    }),
  });

  return combinedFrame?.status === "idle" ? null : combinedFrame;
}

export function resolveIncrementalTabularBindingSnapshot(input: {
  resolvedInputs: ResolvedWidgetInputs | undefined;
  liveMergeKeyFields?: string[];
  liveMergeKeyMappings?: TabularMergeKeyMapping[];
  runtimeState?: unknown;
  runtimeDataStore?: RuntimeDataStore | null;
  runtimeRowSelector?: RuntimeRowSelector;
}): IncrementalTabularConsumerBindingState {
  const seedInput = normalizeResolvedWidgetInput(input.resolvedInputs?.[TABULAR_SEED_INPUT_ID]);
  const liveInput = normalizeResolvedWidgetInput(input.resolvedInputs?.[TABULAR_LIVE_UPDATES_INPUT_ID]);
  const seedState = buildInputConsumerState(seedInput);
  const liveState = buildInputConsumerState(liveInput);
  const active = hasIncrementalTabularRoleBindings(input.resolvedInputs);
  const seedPublication = active
    ? buildPublication(seedInput, "seed", input.runtimeDataStore, input.runtimeRowSelector)
    : null;
  const livePublication = active
    ? buildPublication(liveInput, "update", input.runtimeDataStore, input.runtimeRowSelector)
    : null;
  const dataset = active
    ? resolveIncrementalTabularOutputFrame(input)
    : null;
  const deltaDataset = livePublication?.deltaFrame ?? null;
  const consumerState = buildDualConsumerState({
    dataset,
    deltaDataset,
    liveState,
    seedState,
  });

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

export function useIncrementalTabularConsumerBindingState(input: {
  instanceId?: string;
  liveMergeKeyFields?: string[];
  liveMergeKeyMappings?: TabularMergeKeyMapping[];
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeRetention?: RuntimeRetentionPolicy;
  runtimeRowSelector?: RuntimeRowSelector;
  runtimeState?: Record<string, unknown>;
}) {
  const runtimeDataStore = useRuntimeDataStore();
  const liveMergeKeyFieldsOverride = useMemo(
    () =>
      input.liveMergeKeyFields === undefined
        ? undefined
        : normalizeStringArray(input.liveMergeKeyFields),
    [input.liveMergeKeyFields],
  );
  const liveMergeKeyMappingsOverride = useMemo(
    () =>
      input.liveMergeKeyMappings === undefined
        ? undefined
        : normalizeMergeKeyMappings(input.liveMergeKeyMappings),
    [input.liveMergeKeyMappings],
  );
  const seedInput = normalizeResolvedWidgetInput(input.resolvedInputs?.[TABULAR_SEED_INPUT_ID]);
  const liveInput = normalizeResolvedWidgetInput(input.resolvedInputs?.[TABULAR_LIVE_UPDATES_INPUT_ID]);
  const seedState = useMemo(() => buildInputConsumerState(seedInput), [seedInput]);
  const liveState = useMemo(() => buildInputConsumerState(liveInput), [liveInput]);
  const active = hasIncrementalTabularRoleBindings(input.resolvedInputs);
  const seedPublication = useMemo(
    () => buildPublication(seedInput, "seed", runtimeDataStore, input.runtimeRowSelector),
    [input.runtimeRowSelector, runtimeDataStore, seedInput],
  );
  const livePublication = useMemo(
    () => buildPublication(liveInput, "update", runtimeDataStore, input.runtimeRowSelector),
    [input.runtimeRowSelector, liveInput, runtimeDataStore],
  );
  const runtimeFrame = useMemo(
    () =>
      resolveIncrementalTabularRuntimeFrame(
        input.runtimeState,
        runtimeDataStore,
        input.runtimeRowSelector,
      ),
    [input.runtimeRowSelector, input.runtimeState, runtimeDataStore],
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
        const nextRuntimeState = clearIncrementalFrameRuntimeState(input.runtimeState);

        if (stableJsonStringify(nextRuntimeState ?? null) !== stableJsonStringify(input.runtimeState)) {
          input.onRuntimeStateChange?.(nextRuntimeState);
        }
      }
      return;
    }

    const currentRuntimeStateFrame = normalizeAnyTabularFrameSource(input.runtimeState);
    const currentFrame =
      resolveIncrementalTabularRuntimeFrame(
        input.runtimeState,
        runtimeDataStore,
        input.runtimeRowSelector,
      ) ??
      currentRuntimeStateFrame;
    const currentMeta = readConsumerMeta(currentRuntimeStateFrame) ?? readConsumerMeta(currentFrame);
    const effectiveLiveMergeKeyFields = resolvePublicationMergeKeyFields(
      livePublication,
      currentMeta?.liveMergeKeyFields ?? resolveMarketAssetKeyFields(currentFrame),
      liveMergeKeyFieldsOverride,
    );
    const effectiveLiveMergeKeyMappings = resolvePublicationMergeKeyMappings({
      publication: livePublication,
      previousFrame: currentFrame,
      fallbackFields: currentMeta?.liveMergeKeyFields,
      fallbackMappings: currentMeta?.liveMergeKeyMappings,
      overrideFields: liveMergeKeyFieldsOverride,
      overrideMappings: liveMergeKeyMappingsOverride,
    });
    const reductionSignature = buildReductionSignature({
      seedPublication,
      livePublication,
      mergeKeyFields: effectiveLiveMergeKeyFields,
      mergeKeyMappings: effectiveLiveMergeKeyMappings,
      retention: input.runtimeRetention ?? runtimeRetentionFromSelector(input.runtimeRowSelector),
      rowSelector: input.runtimeRowSelector,
    });
    let nextSeedFrame =
      (currentMeta?.seedRef ? runtimeDataStore?.readFrame(currentMeta.seedRef) : null) ??
      currentMeta?.seedFrame ??
      null;
    let nextLiveFrame =
      (currentMeta?.liveRef ? runtimeDataStore?.readFrame(currentMeta.liveRef) : null) ??
      currentMeta?.liveFrame ??
      null;
    let nextLiveMergeKeyFields = effectiveLiveMergeKeyFields;
    let nextLiveMergeKeyMappings = effectiveLiveMergeKeyMappings;
    let nextMeta = currentMeta ?? buildConsumerMeta(undefined, {});
    let frameChanged = false;
    let metaChanged = !currentMeta;
    let seedChanged = false;
    let liveChanged = false;

    if (
      seedPublication &&
      seedPublication.role === "seed" &&
      (seedPublication.signature !== currentMeta?.lastSeedSignature || !nextSeedFrame)
    ) {
      const seededFrame = applySeedFrame(nextSeedFrame, seedPublication);

      if (seededFrame) {
        nextSeedFrame = seededFrame;
        nextMeta = buildConsumerMeta(nextMeta, {
          lastSeedSignature: seedPublication.signature,
          lastSeedSourceRunId: seedPublication.sourceRunId,
        });
        frameChanged = true;
        seedChanged = true;
      }
    }

    if (
      livePublication &&
      (livePublication.signature !== currentMeta?.lastLiveSignature || !nextLiveFrame)
    ) {
      const liveFrame = applyLivePublication(
        nextLiveFrame,
        livePublication,
        currentMeta,
        liveMergeKeyFieldsOverride,
        liveMergeKeyMappingsOverride,
      );

      if (liveFrame) {
        nextLiveFrame = liveFrame;
        nextLiveMergeKeyFields = resolvePublicationMergeKeyFields(
          livePublication,
          currentMeta?.liveMergeKeyFields,
          liveMergeKeyFieldsOverride,
        );
        nextLiveMergeKeyMappings = resolvePublicationMergeKeyMappings({
          publication: livePublication,
          previousFrame: nextSeedFrame ?? currentFrame,
          fallbackFields: currentMeta?.liveMergeKeyFields,
          fallbackMappings: currentMeta?.liveMergeKeyMappings,
          overrideFields: liveMergeKeyFieldsOverride,
          overrideMappings: liveMergeKeyMappingsOverride,
        });
        nextMeta = buildConsumerMeta(nextMeta, {
          lastLiveSignature: livePublication.signature,
          lastLiveSourceRunId: livePublication.sourceRunId,
          liveMergeKeyFields: nextLiveMergeKeyFields,
          liveMergeKeyMappings: nextLiveMergeKeyMappings,
        });
        frameChanged = true;
        liveChanged = true;
      }
    }

    const ownerId = input.instanceId ?? "incremental-tabular-consumer";
    let nextRuntimeFrame: TabularFrameSourceV1 | null = null;
    const awaitInitialDualRoleBaseline = shouldAwaitInitialDualRoleBaseline({
      seedInput,
      liveInput,
      seedState,
      liveState,
      currentOutputFrame: currentFrame,
      seedFrame: nextSeedFrame,
      liveFrame: nextLiveFrame,
    });

    if (runtimeDataStore) {
      if (
        !frameChanged &&
        currentMeta?.outputRef &&
        currentMeta?.reductionSignature === reductionSignature &&
        !currentMeta.seedFrame &&
        !currentMeta.liveFrame
      ) {
        return;
      }

      const seedRef =
        nextSeedFrame
          ? seedChanged
            ? seedPublication?.baseRef ??
              runtimeDataStore.putSnapshot({
                ownerId,
                outputId: TABULAR_SEED_INPUT_ID,
                frame: nextSeedFrame,
                refKey: `${ownerId}:${TABULAR_SEED_INPUT_ID}`,
              })
            : currentMeta?.seedRef ??
              seedPublication?.baseRef ??
              runtimeDataStore.putSnapshot({
                ownerId,
                outputId: TABULAR_SEED_INPUT_ID,
                frame: nextSeedFrame,
                refKey: `${ownerId}:${TABULAR_SEED_INPUT_ID}`,
              })
          : null;
      const liveRef =
        nextLiveFrame
          ? liveChanged
            ? livePublication?.baseRef ??
              runtimeDataStore.putSnapshot({
                ownerId,
                outputId: TABULAR_LIVE_UPDATES_INPUT_ID,
                frame: nextLiveFrame,
                refKey: `${ownerId}:${TABULAR_LIVE_UPDATES_INPUT_ID}`,
              })
            : currentMeta?.liveRef ??
              livePublication?.baseRef ??
              runtimeDataStore.putSnapshot({
                ownerId,
                outputId: TABULAR_LIVE_UPDATES_INPUT_ID,
                frame: nextLiveFrame,
                refKey: `${ownerId}:${TABULAR_LIVE_UPDATES_INPUT_ID}`,
              })
          : null;
      if (awaitInitialDualRoleBaseline) {
        nextRuntimeFrame = buildPendingSeedBaselineFrame({
          seedFrame: nextSeedFrame,
          liveFrame: nextLiveFrame,
        });
        nextMeta = buildConsumerMeta(nextMeta, {
          seedRef,
          liveRef,
          outputRef: null,
          seedFrame: null,
          liveFrame: null,
          reductionSignature,
          liveMergeKeyFields: nextLiveMergeKeyFields,
          liveMergeKeyMappings: nextLiveMergeKeyMappings,
        });
      } else {
        const outputRef = runtimeDataStore.combine({
          ownerId,
          outputId: "dataset",
          seedRef,
          liveRef,
          seedFrame: seedRef ? null : nextSeedFrame,
          liveFrame: liveRef ? null : nextLiveFrame,
          mergeKeyFields: nextLiveMergeKeyFields,
          mergeKeyMappings: nextLiveMergeKeyMappings,
          retention: input.runtimeRetention ?? runtimeRetentionFromSelector(input.runtimeRowSelector),
          refKey: `${ownerId}:dataset`,
          signature: reductionSignature,
        });
        const outputFrame = outputRef ? runtimeDataStore.readFrame(outputRef) : null;

        if (!outputRef || !outputFrame) {
          return;
        }

        nextRuntimeFrame = attachRuntimeDataRefToFrame(outputFrame, outputRef);
        nextMeta = buildConsumerMeta(nextMeta, {
          seedRef,
          liveRef,
          outputRef,
          seedFrame: null,
          liveFrame: null,
          reductionSignature,
          liveMergeKeyFields: nextLiveMergeKeyFields,
          liveMergeKeyMappings: nextLiveMergeKeyMappings,
        });
      }
    } else {
      const nextFrame = awaitInitialDualRoleBaseline
        ? buildPendingSeedBaselineFrame({
            seedFrame: nextSeedFrame,
            liveFrame: nextLiveFrame,
          })
        : combineSeedAndLiveFrames({
            seedFrame: nextSeedFrame,
            liveFrame: nextLiveFrame,
            mergeKeyFields: nextLiveMergeKeyFields,
            mergeKeyMappings: nextLiveMergeKeyMappings,
          });

      if (!nextFrame) {
        return;
      }

      nextRuntimeFrame = nextFrame;
      nextMeta = buildConsumerMeta(nextMeta, {
        seedRef: null,
        liveRef: null,
        outputRef: null,
        seedFrame: stripConsumerContextFromFrame(nextSeedFrame),
        liveFrame: stripConsumerContextFromFrame(nextLiveFrame),
        reductionSignature,
        liveMergeKeyFields: nextLiveMergeKeyFields,
        liveMergeKeyMappings: nextLiveMergeKeyMappings,
      });
    }

    metaChanged = metaChanged || !sameConsumerMeta(currentMeta, nextMeta);

    if (!frameChanged && !metaChanged) {
      return;
    }

    const nextRuntimeFrameWithMeta = preserveRuntimeInteractionNamespace(
      withConsumerMeta(nextRuntimeFrame, nextMeta) as unknown as Record<string, unknown>,
      input.runtimeState,
    ) as unknown as TabularFrameSourceV1;
    const nextSignature = serializeFrameState(nextRuntimeFrameWithMeta);

    if (nextSignature !== runtimeFrameSignature) {
      input.onRuntimeStateChange?.(nextRuntimeFrameWithMeta as unknown as Record<string, unknown>);
    }
  }, [
    active,
    input.instanceId,
    input.onRuntimeStateChange,
    input.runtimeRetention,
    input.runtimeRowSelector,
    input.runtimeState,
    liveMergeKeyFieldsOverride,
    liveMergeKeyMappingsOverride,
    livePublication,
    runtimeFrameSignature,
    runtimeDataStore,
    seedPublication,
  ]);

  return useMemo(
    () =>
      resolveIncrementalTabularBindingSnapshot({
        liveMergeKeyFields: liveMergeKeyFieldsOverride,
        liveMergeKeyMappings: liveMergeKeyMappingsOverride,
        resolvedInputs: input.resolvedInputs,
        runtimeState: input.runtimeState,
        runtimeDataStore,
        runtimeRowSelector: input.runtimeRowSelector,
      }),
    [
      input.resolvedInputs,
      liveMergeKeyFieldsOverride,
      liveMergeKeyMappingsOverride,
      input.runtimeRowSelector,
      input.runtimeState,
      runtimeDataStore,
    ],
  );
}
