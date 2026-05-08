import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import type { WidgetContractId } from "@/widgets/types";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  normalizeTabularFrameSource,
  type TabularFrameFieldSchema,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import {
  readWidgetRuntimeUpdateContext,
  attachWidgetRuntimeUpdateContext,
  type WidgetRuntimeUpdateEnvelope,
} from "@/widgets/shared/runtime-update";

export const RUNTIME_DATA_REF_KIND = "runtime-data-ref" as const;
export const RUNTIME_DATA_REF_CONTEXT_KEY = "runtimeDataRef" as const;

export interface RuntimeDataRef {
  kind: typeof RUNTIME_DATA_REF_KIND;
  refId: string;
  workspaceRuntimeId: string;
  ownerId: string;
  outputId: string;
  contractId: WidgetContractId;
  version: number;
  rowCount?: number;
  schemaSignature?: string;
  updatedAtMs?: number;
}

export interface RuntimeTabularFrameRef extends RuntimeDataRef {
  contractId: typeof CORE_TABULAR_FRAME_SOURCE_CONTRACT;
  columns: string[];
  fields?: TabularFrameFieldSchema[];
  status?: TabularFrameSourceV1["status"];
  error?: string;
}

export interface RuntimeRetentionPolicy {
  maxRows?: number;
}

export interface RuntimeRowSelector {
  direction?: "earliest" | "latest";
  limit?: number;
  offset?: number;
}

export interface RuntimeDataStore {
  readonly workspaceRuntimeId: string;
  putSnapshot(input: {
    ownerId: string;
    outputId: string;
    frame: TabularFrameSourceV1;
    refKey?: string;
  }): RuntimeTabularFrameRef;
  applyDelta(input: {
    ownerId: string;
    outputId: string;
    baseRef?: RuntimeTabularFrameRef;
    deltaFrame: TabularFrameSourceV1;
    mergeKeyFields: string[];
    retention?: RuntimeRetentionPolicy;
    refKey?: string;
  }): {
    outputRef: RuntimeTabularFrameRef;
    deltaRef: RuntimeTabularFrameRef;
    operations: NonNullable<WidgetRuntimeUpdateEnvelope["operations"]>;
  };
  combine(input: {
    ownerId: string;
    outputId: string;
    seedRef?: RuntimeTabularFrameRef | null;
    liveRef?: RuntimeTabularFrameRef | null;
    seedFrame?: TabularFrameSourceV1 | null;
    liveFrame?: TabularFrameSourceV1 | null;
    mergeKeyFields: string[];
    retention?: RuntimeRetentionPolicy;
    refKey?: string;
    signature?: string;
  }): RuntimeTabularFrameRef | null;
  readFrame(ref: RuntimeTabularFrameRef): TabularFrameSourceV1 | null;
  readRows(
    ref: RuntimeTabularFrameRef,
    selector?: RuntimeRowSelector,
  ): Array<Record<string, unknown>>;
  releaseOwner(ownerId: string): void;
}

interface RuntimeDataEntry {
  ownerId: string;
  frame: TabularFrameSourceV1;
  ref: RuntimeTabularFrameRef;
}

interface RuntimeCombinedEntry {
  signature?: string;
  frameSignature: string;
}

const RuntimeDataStoreContext = createContext<RuntimeDataStore | null>(null);
const runtimeDataStoreRegistry = new Map<string, RuntimeDataStore>();

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

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
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
  const fields = new Map<string, TabularFrameFieldSchema>();

  frames.forEach((frame) => {
    frame.fields?.forEach((field) => {
      if (!fields.has(field.key)) {
        fields.set(field.key, field);
      }
    });
  });

  return fields.size > 0 ? Array.from(fields.values()) : undefined;
}

function buildSchemaSignature(frame: TabularFrameSourceV1) {
  return stableJsonStringify({
    columns: frame.columns,
    fields: frame.fields?.map((field) => ({
      key: field.key,
      type: field.type,
    })),
  });
}

function buildFrameDataSignature(frame: TabularFrameSourceV1) {
  return stableJsonStringify({
    status: frame.status,
    error: frame.error,
    columns: frame.columns,
    fields: frame.fields,
    rows: frame.rows,
    meta: frame.meta,
  });
}

function getRuntimeDataRefFromContext(value: unknown): RuntimeTabularFrameRef | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const candidate = value[RUNTIME_DATA_REF_CONTEXT_KEY];

  return isRuntimeTabularFrameRef(candidate) ? candidate : undefined;
}

export function isRuntimeDataRef(value: unknown): value is RuntimeDataRef {
  return (
    isPlainRecord(value) &&
    value.kind === RUNTIME_DATA_REF_KIND &&
    typeof value.refId === "string" &&
    typeof value.workspaceRuntimeId === "string" &&
    typeof value.ownerId === "string" &&
    typeof value.outputId === "string" &&
    typeof value.contractId === "string" &&
    typeof value.version === "number"
  );
}

export function isRuntimeTabularFrameRef(value: unknown): value is RuntimeTabularFrameRef {
  return isRuntimeDataRef(value) && value.contractId === CORE_TABULAR_FRAME_SOURCE_CONTRACT;
}

export function getRuntimeDataRef(value: unknown): RuntimeTabularFrameRef | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  if (isRuntimeTabularFrameRef(value)) {
    return value;
  }

  if (isRuntimeTabularFrameRef(value.runtimeDataRef)) {
    return value.runtimeDataRef;
  }

  const source = isPlainRecord(value.source) ? value.source : undefined;
  const context = isPlainRecord(source?.context) ? source.context : undefined;

  return getRuntimeDataRefFromContext(context);
}

export function attachRuntimeDataRefToFrame(
  frame: TabularFrameSourceV1,
  ref: RuntimeTabularFrameRef,
  options?: {
    includeRows?: boolean;
  },
): TabularFrameSourceV1 & { runtimeDataRef: RuntimeTabularFrameRef } {
  return {
    ...frame,
    rows: options?.includeRows ? frame.rows : [],
    runtimeDataRef: ref,
    source: {
      ...frame.source,
      kind: frame.source?.kind ?? "runtime-data-store",
      context: {
        ...(frame.source?.context ?? {}),
        [RUNTIME_DATA_REF_CONTEXT_KEY]: ref,
      },
    },
  };
}

export function selectRuntimeRows(
  rows: Array<Record<string, unknown>>,
  selector: RuntimeRowSelector | undefined,
) {
  const limit = normalizePositiveInteger(selector?.limit);
  const offset = Math.max(0, normalizePositiveInteger(selector?.offset) ?? 0);

  if (!limit) {
    return rows;
  }

  if (selector?.direction === "earliest") {
    return rows.slice(offset, offset + limit);
  }

  const end = Math.max(0, rows.length - offset);
  return rows.slice(Math.max(0, end - limit), end);
}

function applyRetention(
  rows: Array<Record<string, unknown>>,
  retention: RuntimeRetentionPolicy | undefined,
) {
  const maxRows = normalizePositiveInteger(retention?.maxRows);

  return maxRows ? rows.slice(-maxRows) : rows;
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

  return "ready";
}

function normalizeCombinedFrame(frame: TabularFrameSourceV1) {
  return {
    ...frame,
    status: resolveRenderableFrameStatus([frame], frame.rows.length),
    source: {
      ...frame.source,
      kind: frame.source?.kind ?? "runtime-data-store",
      updatedAtMs: Date.now(),
    },
  } satisfies TabularFrameSourceV1;
}

function combineTabularFrames(input: {
  seedFrame: TabularFrameSourceV1 | null;
  liveFrame: TabularFrameSourceV1 | null;
  mergeKeyFields: string[];
  retention?: RuntimeRetentionPolicy;
}) {
  if (!input.seedFrame && !input.liveFrame) {
    return null;
  }

  if (!input.seedFrame && input.liveFrame) {
    const frame = normalizeCombinedFrame(input.liveFrame);

    return {
      ...frame,
      rows: applyRetention(frame.rows, input.retention),
    } satisfies TabularFrameSourceV1;
  }

  if (input.seedFrame && !input.liveFrame) {
    const frame = normalizeCombinedFrame(input.seedFrame);

    return {
      ...frame,
      rows: applyRetention(frame.rows, input.retention),
    } satisfies TabularFrameSourceV1;
  }

  const seedFrame = input.seedFrame;
  const liveFrame = input.liveFrame;

  if (!seedFrame || !liveFrame) {
    return null;
  }

  const rows: Array<Record<string, unknown>> = [];
  const mergeKeyFields = input.mergeKeyFields.filter(Boolean);

  if (mergeKeyFields.length > 0) {
    const rowsByKey = new Map<string, Record<string, unknown>>();

    seedFrame.rows.forEach((row) => {
      rowsByKey.set(buildRowMergeKey(row, mergeKeyFields), row);
    });

    liveFrame.rows.forEach((row) => {
      rowsByKey.set(buildRowMergeKey(row, mergeKeyFields), row);
    });

    rows.push(...rowsByKey.values());
  } else {
    const seenRows = new Set<string>();

    [...seedFrame.rows, ...liveFrame.rows].forEach((row) => {
      const serializedRow = stableJsonStringify(row);

      if (seenRows.has(serializedRow)) {
        return;
      }

      seenRows.add(serializedRow);
      rows.push(row);
    });
  }

  return {
    ...seedFrame,
    status: resolveRenderableFrameStatus([seedFrame, liveFrame], rows.length),
    columns: collectColumns(seedFrame, liveFrame),
    fields: collectFields(seedFrame, liveFrame),
    rows: applyRetention(rows, input.retention),
    meta: liveFrame.meta ?? seedFrame.meta,
    source: {
      ...seedFrame.source,
      kind: seedFrame.source?.kind ?? "runtime-data-store",
      updatedAtMs: Date.now(),
    },
  } satisfies TabularFrameSourceV1;
}

class InMemoryRuntimeDataStore implements RuntimeDataStore {
  readonly workspaceRuntimeId: string;
  private entries = new Map<string, RuntimeDataEntry>();
  private combinedEntries = new Map<string, RuntimeCombinedEntry>();

  constructor(workspaceRuntimeId: string) {
    this.workspaceRuntimeId = workspaceRuntimeId;
  }

  putSnapshot(input: {
    ownerId: string;
    outputId: string;
    frame: TabularFrameSourceV1;
    refKey?: string;
  }) {
    const normalizedFrame = normalizeTabularFrameSource(input.frame) ?? input.frame;
    const refId = input.refKey ?? `${input.ownerId}:${input.outputId}`;
    const previous = this.entries.get(refId);
    const ref: RuntimeTabularFrameRef = {
      kind: RUNTIME_DATA_REF_KIND,
      refId,
      workspaceRuntimeId: this.workspaceRuntimeId,
      ownerId: input.ownerId,
      outputId: input.outputId,
      contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      version: (previous?.ref.version ?? 0) + 1,
      rowCount: normalizedFrame.rows.length,
      schemaSignature: buildSchemaSignature(normalizedFrame),
      updatedAtMs: Date.now(),
      columns: [...normalizedFrame.columns],
      fields: normalizedFrame.fields ? [...normalizedFrame.fields] : undefined,
      status: normalizedFrame.status,
      error: normalizedFrame.error,
    };
    const storedFrame = attachRuntimeDataRefToFrame(normalizedFrame, ref, {
      includeRows: true,
    });

    this.entries.set(refId, {
      ownerId: input.ownerId,
      frame: storedFrame,
      ref,
    });

    return ref;
  }

  applyDelta(input: {
    ownerId: string;
    outputId: string;
    baseRef?: RuntimeTabularFrameRef;
    deltaFrame: TabularFrameSourceV1;
    mergeKeyFields: string[];
    retention?: RuntimeRetentionPolicy;
    refKey?: string;
  }) {
    const refKey = input.refKey ?? `${input.ownerId}:${input.outputId}`;
    const baseFrame =
      (input.baseRef ? this.readFrame(input.baseRef) : null) ??
      this.entries.get(refKey)?.frame ??
      {
        ...input.deltaFrame,
        rows: [],
      };
    const mergeKeyFields = input.mergeKeyFields.filter(Boolean);
    let appended = 0;
    let replaced = 0;
    let mergedRows: Array<Record<string, unknown>>;

    if (mergeKeyFields.length > 0) {
      const rowsByKey = new Map<string, Record<string, unknown>>();

      baseFrame.rows.forEach((row) => {
        rowsByKey.set(buildRowMergeKey(row, mergeKeyFields), row);
      });
      input.deltaFrame.rows.forEach((row) => {
        const key = buildRowMergeKey(row, mergeKeyFields);
        const existing = rowsByKey.has(key);

        rowsByKey.set(key, row);

        if (existing) {
          replaced += 1;
        } else {
          appended += 1;
        }
      });
      mergedRows = Array.from(rowsByKey.values());
    } else {
      appended = input.deltaFrame.rows.length;
      mergedRows = [...baseFrame.rows, ...input.deltaFrame.rows];
    }

    const rowsBeforeRetention = mergedRows.length;
    const maxRows = normalizePositiveInteger(input.retention?.maxRows);

    if (maxRows) {
      mergedRows = mergedRows.slice(-maxRows);
    }

    const outputFrame: TabularFrameSourceV1 = {
      ...baseFrame,
      status: input.deltaFrame.status === "error" ? "error" : "ready",
      columns: collectColumns(baseFrame, input.deltaFrame),
      fields: collectFields(baseFrame, input.deltaFrame),
      rows: mergedRows,
      meta: input.deltaFrame.meta ?? baseFrame.meta,
      source: {
        ...baseFrame.source,
        kind: baseFrame.source?.kind ?? input.deltaFrame.source?.kind ?? "runtime-data-store",
        updatedAtMs: Date.now(),
      },
    };
    const deltaRef = this.putSnapshot({
      ownerId: input.ownerId,
      outputId: `${input.outputId}:delta`,
      frame: input.deltaFrame,
      refKey: `${refKey}:delta`,
    });
    const outputRef = this.putSnapshot({
      ownerId: input.ownerId,
      outputId: input.outputId,
      frame: outputFrame,
      refKey,
    });

    return {
      outputRef,
      deltaRef,
      operations: {
        appended,
        replaced,
        pruned: Math.max(0, rowsBeforeRetention - mergedRows.length),
        returned: input.deltaFrame.rows.length,
        retained: mergedRows.length,
      },
    };
  }

  combine(input: {
    ownerId: string;
    outputId: string;
    seedRef?: RuntimeTabularFrameRef | null;
    liveRef?: RuntimeTabularFrameRef | null;
    seedFrame?: TabularFrameSourceV1 | null;
    liveFrame?: TabularFrameSourceV1 | null;
    mergeKeyFields: string[];
    retention?: RuntimeRetentionPolicy;
    refKey?: string;
    signature?: string;
  }) {
    const refKey = input.refKey ?? `${input.ownerId}:${input.outputId}`;
    const previousEntry = this.entries.get(refKey);
    const previousCombinedEntry = this.combinedEntries.get(refKey);

    if (input.signature && previousEntry && previousCombinedEntry?.signature === input.signature) {
      return previousEntry.ref;
    }

    const seedFrame =
      (input.seedRef ? this.readFrame(input.seedRef) : null) ??
      input.seedFrame ??
      null;
    const liveFrame =
      (input.liveRef ? this.readFrame(input.liveRef) : null) ??
      input.liveFrame ??
      null;
    const combinedFrame = combineTabularFrames({
      seedFrame,
      liveFrame,
      mergeKeyFields: input.mergeKeyFields,
      retention: input.retention,
    });

    if (!combinedFrame) {
      this.combinedEntries.delete(refKey);
      return null;
    }

    const frameSignature = buildFrameDataSignature(combinedFrame);

    if (previousEntry && previousCombinedEntry?.frameSignature === frameSignature) {
      this.combinedEntries.set(refKey, {
        signature: input.signature,
        frameSignature,
      });
      return previousEntry.ref;
    }

    const ref = this.putSnapshot({
      ownerId: input.ownerId,
      outputId: input.outputId,
      frame: combinedFrame,
      refKey,
    });

    this.combinedEntries.set(refKey, {
      signature: input.signature,
      frameSignature,
    });

    return ref;
  }

  readFrame(ref: RuntimeTabularFrameRef) {
    if (ref.workspaceRuntimeId !== this.workspaceRuntimeId) {
      return null;
    }

    return this.entries.get(ref.refId)?.frame ?? null;
  }

  readRows(ref: RuntimeTabularFrameRef, selector?: RuntimeRowSelector) {
    return selectRuntimeRows(this.readFrame(ref)?.rows ?? [], selector);
  }

  releaseOwner(ownerId: string) {
    for (const [refId, entry] of this.entries.entries()) {
      if (entry.ownerId === ownerId) {
        this.entries.delete(refId);
        this.combinedEntries.delete(refId);
      }
    }
  }
}

export function createRuntimeDataStore(workspaceRuntimeId: string): RuntimeDataStore {
  const existing = runtimeDataStoreRegistry.get(workspaceRuntimeId);

  if (existing) {
    return existing;
  }

  const store = new InMemoryRuntimeDataStore(workspaceRuntimeId);
  runtimeDataStoreRegistry.set(workspaceRuntimeId, store);
  return store;
}

export function materializeRuntimeTabularFrame(
  value: unknown,
  store: RuntimeDataStore | null | undefined,
  selector?: RuntimeRowSelector,
): TabularFrameSourceV1 | null {
  const ref = getRuntimeDataRef(value);
  const frameFromRef = ref ? store?.readFrame(ref) : null;

  if (ref && !frameFromRef) {
    return null;
  }

  const frame = frameFromRef ?? normalizeTabularFrameSource(value);

  if (!frame) {
    return null;
  }

  if (!selector || !ref || !store) {
    return frame;
  }

  return {
    ...frame,
    rows: store.readRows(ref, selector),
  };
}

export function storeTabularFrameRuntimeState(input: {
  frame: TabularFrameSourceV1;
  ownerId: string;
  outputId: string;
  store: RuntimeDataStore | null | undefined;
  refKey?: string;
  includeRowsInShell?: boolean;
}) {
  if (!input.store || input.frame.rows.length === 0) {
    return input.frame;
  }

  const update = readWidgetRuntimeUpdateContext(input.frame);
  const deltaFrame = normalizeTabularFrameSource(update?.deltaOutput);
  const frameWithoutUpdate = update
    ? attachWidgetRuntimeUpdateContext(input.frame, {
        ...update,
        retainedOutputLocation: "carrier",
        deltaOutput: undefined,
        retainedOutput: undefined,
      })
    : input.frame;
  const ref = input.store.putSnapshot({
    ownerId: input.ownerId,
    outputId: input.outputId,
    frame: frameWithoutUpdate,
    refKey: input.refKey,
  });
  const deltaRef = deltaFrame
    ? input.store.putSnapshot({
        ownerId: input.ownerId,
        outputId: `${input.outputId}:delta`,
        frame: deltaFrame,
        refKey: `${input.refKey ?? `${input.ownerId}:${input.outputId}`}:delta`,
      })
    : undefined;
  const shell = attachRuntimeDataRefToFrame(frameWithoutUpdate, ref, {
    includeRows: input.includeRowsInShell,
  });

  if (!update) {
    return shell;
  }

  return attachWidgetRuntimeUpdateContext(shell, {
    ...update,
    retainedOutput: undefined,
    deltaOutput: undefined,
    retainedOutputRef: ref,
    outputRef: ref,
    deltaOutputRef: deltaRef,
  });
}

export function RuntimeDataStoreProvider({
  children,
  store,
  workspaceRuntimeId,
}: {
  children: ReactNode;
  store?: RuntimeDataStore;
  workspaceRuntimeId?: string;
}) {
  const resolvedStore = useMemo(
    () => store ?? createRuntimeDataStore(workspaceRuntimeId ?? "workspace-runtime"),
    [store, workspaceRuntimeId],
  );

  return (
    <RuntimeDataStoreContext.Provider value={resolvedStore}>
      {children}
    </RuntimeDataStoreContext.Provider>
  );
}

export function useRuntimeDataStore() {
  return useContext(RuntimeDataStoreContext);
}
