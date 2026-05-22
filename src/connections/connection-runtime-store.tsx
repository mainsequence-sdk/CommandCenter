import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ConnectionRuntimeStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "error"
  | "closed";

export type ConnectionRuntimeEntryKind = "stream";

export type ConnectionRuntimeSessionKind = "live" | "retained" | "draft-preview";

// Temporary stream diagnostics are disabled by default to avoid console spam.
const CONNECTION_RUNTIME_STORE_DEBUG_LOGS_ENABLED = false;

export interface ConnectionRuntimeSession {
  close: (code?: number, reason?: string) => void;
}

export interface ConnectionRuntimeEntrySnapshot {
  activeOwnerCount: number;
  columnCount?: number;
  error?: string;
  errorCode?: string;
  key: string;
  kind: ConnectionRuntimeEntryKind;
  lastHeartbeatAtMs?: number;
  lastMessageAtMs?: number;
  nextRetryAtMs?: number;
  ownerIds: string[];
  reconnectAttemptCount?: number;
  rowCount?: number;
  runtimeState?: Record<string, unknown>;
  sessionKind: ConnectionRuntimeSessionKind;
  status: ConnectionRuntimeStatus;
  updatedAtMs: number;
}

export interface AcquireConnectionRuntimeSessionInput {
  key: string;
  kind?: ConnectionRuntimeEntryKind;
  onRuntimeStateChange?: (runtimeState: Record<string, unknown>) => void;
  ownerId: string;
  start: () => ConnectionRuntimeSession;
}

export interface ConnectionRuntimeSessionHandle {
  key: string;
  release: () => void;
}

export interface PublishConnectionRuntimeStateInput {
  key: string;
  kind?: ConnectionRuntimeEntryKind;
  ownerId?: string;
  runtimeState: Record<string, unknown>;
  sessionKind?: ConnectionRuntimeSessionKind;
}

interface InternalConnectionRuntimeEntry {
  effectiveSignature?: string;
  key: string;
  kind: ConnectionRuntimeEntryKind;
  ownerCallbacks: Map<string, (runtimeState: Record<string, unknown>) => void>;
  ownerIds: Set<string>;
  runtimeState?: Record<string, unknown>;
  session?: ConnectionRuntimeSession;
  sessionKind: ConnectionRuntimeSessionKind;
  snapshot: ConnectionRuntimeEntrySnapshot;
  status: ConnectionRuntimeStatus;
  updatedAtMs: number;
}

export interface ConnectionRuntimeStore {
  readonly workspaceRuntimeId: string;
  acquireStreamSession(input: AcquireConnectionRuntimeSessionInput): ConnectionRuntimeSessionHandle;
  getEntrySnapshot(key: string | undefined): ConnectionRuntimeEntrySnapshot | undefined;
  publishStreamState(input: PublishConnectionRuntimeStateInput): void;
  subscribe(listener: () => void): () => void;
}

const ConnectionRuntimeStoreContext = createContext<ConnectionRuntimeStore | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStatus(value: unknown): ConnectionRuntimeStatus {
  return value === "connecting" ||
    value === "live" ||
    value === "reconnecting" ||
    value === "error" ||
    value === "closed"
    ? value
    : "idle";
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : undefined;
}

function resolveRuntimeStateSummary(runtimeState: Record<string, unknown> | undefined) {
  if (!runtimeState) {
    return {
      columnCount: undefined,
      rowCount: undefined,
    };
  }

  const runtimeDataRef = isRecord(runtimeState.runtimeDataRef)
    ? runtimeState.runtimeDataRef
    : undefined;
  const columns = Array.isArray(runtimeState.columns) ? runtimeState.columns : undefined;
  const rows = Array.isArray(runtimeState.rows) ? runtimeState.rows : undefined;

  return {
    columnCount: columns?.length,
    rowCount: normalizeNumber(runtimeDataRef?.rowCount) ?? rows?.length,
  };
}

function resolveRuntimeErrorCode(runtimeState: Record<string, unknown> | undefined) {
  const errorCode =
    typeof runtimeState?.streamErrorCode === "string"
      ? runtimeState.streamErrorCode
      : undefined;

  if (errorCode) {
    return errorCode;
  }

  const source = isRecord(runtimeState?.source) ? runtimeState.source : undefined;
  const context = isRecord(source?.context) ? source.context : undefined;
  const stream = isRecord(context?.stream) ? context.stream : undefined;

  return typeof stream?.errorCode === "string" ? stream.errorCode : undefined;
}

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildStreamRuntimeEffectiveSignature(runtimeState: Record<string, unknown>) {
  const runtimeDataRef = isRecord(runtimeState.runtimeDataRef)
    ? runtimeState.runtimeDataRef
    : undefined;
  const source = isRecord(runtimeState.source) ? runtimeState.source : undefined;
  const context = isRecord(source?.context) ? source.context : undefined;
  const stream = isRecord(context?.stream) ? context.stream : undefined;

  return stableJsonStringify({
    columns: Array.isArray(runtimeState.columns) ? runtimeState.columns : undefined,
    error: typeof runtimeState.error === "string" ? runtimeState.error : undefined,
    errorCode: resolveRuntimeErrorCode(runtimeState),
    fields: Array.isArray(runtimeState.fields) ? runtimeState.fields : undefined,
    rows: runtimeDataRef ? undefined : runtimeState.rows,
    runtimeDataRef: runtimeDataRef
      ? {
          contractId: runtimeDataRef.contractId,
          ownerId: runtimeDataRef.ownerId,
          outputId: runtimeDataRef.outputId,
          refId: runtimeDataRef.refId,
          rowCount: runtimeDataRef.rowCount,
          schemaSignature: runtimeDataRef.schemaSignature,
          version: runtimeDataRef.version,
        }
      : undefined,
    sourceRunId:
      typeof runtimeState.sourceRunId === "string" ? runtimeState.sourceRunId : undefined,
    status: typeof runtimeState.status === "string" ? runtimeState.status : undefined,
    streamStatus: normalizeStatus(runtimeState.streamStatus),
    streamTransportStatus: typeof stream?.status === "string" ? stream.status : undefined,
  });
}

export interface ConnectionStreamPublicationPlan {
  effectiveSignature: string;
  shouldPublish: boolean;
  status: ConnectionRuntimeStatus;
}

export function planConnectionStreamPublication(input: {
  previousEffectiveSignature?: string;
  runtimeState: Record<string, unknown>;
}): ConnectionStreamPublicationPlan {
  const effectiveSignature = buildStreamRuntimeEffectiveSignature(input.runtimeState);

  return {
    effectiveSignature,
    shouldPublish: input.previousEffectiveSignature !== effectiveSignature,
    status: normalizeStatus(input.runtimeState.streamStatus),
  };
}

function summarizeRuntimeStoreKey(value: string) {
  return value.length > 180 ? `${value.slice(0, 90)}...${value.slice(-70)}` : value;
}

function buildSnapshot(entry: InternalConnectionRuntimeEntry): ConnectionRuntimeEntrySnapshot {
  const summary = resolveRuntimeStateSummary(entry.runtimeState);

  return {
    activeOwnerCount: entry.ownerIds.size,
    columnCount: summary.columnCount,
    error: typeof entry.runtimeState?.error === "string" ? entry.runtimeState.error : undefined,
    errorCode: resolveRuntimeErrorCode(entry.runtimeState),
    key: entry.key,
    kind: entry.kind,
    lastHeartbeatAtMs: normalizeNumber(entry.runtimeState?.lastHeartbeatAtMs),
    lastMessageAtMs: normalizeNumber(entry.runtimeState?.lastMessageAtMs),
    nextRetryAtMs: normalizeNumber(entry.runtimeState?.nextRetryAtMs),
    ownerIds: Array.from(entry.ownerIds).sort(),
    reconnectAttemptCount: normalizeNumber(entry.runtimeState?.reconnectAttemptCount),
    rowCount: summary.rowCount,
    runtimeState: entry.runtimeState,
    sessionKind: entry.sessionKind,
    status: entry.status,
    updatedAtMs: entry.updatedAtMs,
  };
}

class InMemoryConnectionRuntimeStore implements ConnectionRuntimeStore {
  readonly workspaceRuntimeId: string;
  private readonly entries = new Map<string, InternalConnectionRuntimeEntry>();
  private readonly listeners = new Set<() => void>();

  constructor(workspaceRuntimeId: string) {
    this.workspaceRuntimeId = workspaceRuntimeId;
  }

  acquireStreamSession(input: AcquireConnectionRuntimeSessionInput): ConnectionRuntimeSessionHandle {
    const key = input.key.trim();
    const ownerId = input.ownerId.trim() || key;

    if (!key) {
      throw new Error("Connection runtime session requires a stable key.");
    }

    const existingEntry = this.entries.get(key);
    const entry = this.getOrCreateEntry(key, input.kind ?? "stream");
    const refCountBefore = entry.ownerIds.size;
    let released = false;
    let startCalled = false;

    entry.ownerIds.add(ownerId);
    if (input.onRuntimeStateChange) {
      entry.ownerCallbacks.set(ownerId, input.onRuntimeStateChange);
    } else {
      entry.ownerCallbacks.delete(ownerId);
    }
    entry.sessionKind = "live";

    if (!entry.session) {
      entry.status = entry.runtimeState ? entry.status : "connecting";
      entry.updatedAtMs = Date.now();
      startCalled = true;

      try {
        entry.session = input.start();
      } catch (error) {
        entry.ownerIds.delete(ownerId);
        entry.status = "error";
        entry.runtimeState = {
          ...(entry.runtimeState ?? {}),
          error: error instanceof Error ? error.message : "Connection runtime session failed.",
          streamStatus: "error",
        };
        this.commit(entry);
        throw error;
      }
    }

    if (import.meta.env.DEV && CONNECTION_RUNTIME_STORE_DEBUG_LOGS_ENABLED) {
      console.log("[stream-runtime-store-acquire]", {
        key: summarizeRuntimeStoreKey(key),
        ownerId,
        hadEntry: Boolean(existingEntry),
        refCountBefore,
        startCalled,
      });
    }

    this.commit(entry);

    return {
      key,
      release: () => {
        if (released) {
          return;
        }

        released = true;
        if (import.meta.env.DEV && CONNECTION_RUNTIME_STORE_DEBUG_LOGS_ENABLED) {
          const currentEntry = this.entries.get(key);
          console.log("[stream-runtime-store-release]", {
            key: summarizeRuntimeStoreKey(key),
            ownerId,
            refCountAfter: Math.max((currentEntry?.ownerIds.size ?? 1) - 1, 0),
            closed: (currentEntry?.ownerIds.size ?? 0) <= 1,
          });
        }
        this.releaseOwner(key, ownerId);
      },
    };
  }

  getEntrySnapshot(key: string | undefined): ConnectionRuntimeEntrySnapshot | undefined {
    const normalizedKey = key?.trim();

    if (!normalizedKey) {
      return undefined;
    }

    return this.entries.get(normalizedKey)?.snapshot;
  }

  publishStreamState(input: PublishConnectionRuntimeStateInput) {
    const key = input.key.trim();

    if (!key) {
      return;
    }

    const entry = this.getOrCreateEntry(key, input.kind ?? "stream");
    const publicationPlan = planConnectionStreamPublication({
      previousEffectiveSignature: entry.effectiveSignature,
      runtimeState: input.runtimeState,
    });

    if (!publicationPlan.shouldPublish) {
      return;
    }

    entry.effectiveSignature = publicationPlan.effectiveSignature;
    entry.runtimeState = input.runtimeState;
    entry.status = publicationPlan.status;
    entry.sessionKind = input.sessionKind ?? entry.sessionKind;
    entry.updatedAtMs = Date.now();
    this.commit(entry);
    entry.ownerCallbacks.forEach((callback) => {
      callback(input.runtimeState);
    });
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private getOrCreateEntry(key: string, kind: ConnectionRuntimeEntryKind) {
    const existing = this.entries.get(key);

    if (existing) {
      return existing;
    }

    const entry: InternalConnectionRuntimeEntry = {
      key,
      kind,
      ownerCallbacks: new Map(),
      ownerIds: new Set(),
      sessionKind: "retained",
      status: "idle",
      updatedAtMs: Date.now(),
      snapshot: {
        activeOwnerCount: 0,
        key,
        kind,
        ownerIds: [],
        sessionKind: "retained",
        status: "idle",
        updatedAtMs: Date.now(),
      },
    };

    entry.snapshot = buildSnapshot(entry);
    this.entries.set(key, entry);
    return entry;
  }

  private releaseOwner(key: string, ownerId: string) {
    const entry = this.entries.get(key);

    if (!entry) {
      return;
    }

    entry.ownerIds.delete(ownerId);
    entry.ownerCallbacks.delete(ownerId);

    if (entry.ownerIds.size === 0 && entry.session) {
      const session = entry.session;
      entry.session = undefined;
      entry.sessionKind = "retained";
      entry.status = entry.runtimeState ? "closed" : "idle";
      entry.updatedAtMs = Date.now();
      session.close(1000, "connection runtime store owner released");
    }

    this.commit(entry);
  }

  private commit(entry: InternalConnectionRuntimeEntry) {
    entry.snapshot = buildSnapshot(entry);
    this.listeners.forEach((listener) => listener());
  }
}

export function createConnectionRuntimeStore(workspaceRuntimeId: string): ConnectionRuntimeStore {
  return new InMemoryConnectionRuntimeStore(workspaceRuntimeId);
}

export function ConnectionRuntimeStoreProvider({
  children,
  store,
  workspaceRuntimeId,
}: {
  children: ReactNode;
  store?: ConnectionRuntimeStore;
  workspaceRuntimeId?: string;
}) {
  const resolvedStore = useMemo(
    () => store ?? createConnectionRuntimeStore(workspaceRuntimeId ?? "workspace-runtime"),
    [store, workspaceRuntimeId],
  );

  return (
    <ConnectionRuntimeStoreContext.Provider value={resolvedStore}>
      {children}
    </ConnectionRuntimeStoreContext.Provider>
  );
}

export function useConnectionRuntimeStore() {
  return useContext(ConnectionRuntimeStoreContext);
}

export function useConnectionRuntimeEntry(key: string | undefined) {
  const store = useConnectionRuntimeStore();

  return useSyncExternalStore(
    store
      ? (listener) => store.subscribe(listener)
      : () => () => {},
    () => store?.getEntrySnapshot(key),
    () => undefined,
  );
}

export function useThrottledConnectionRuntimeEntry(
  key: string | undefined,
  intervalMs = 250,
) {
  const store = useConnectionRuntimeStore();
  const normalizedIntervalMs = Math.max(0, Math.trunc(intervalMs));
  const [snapshot, setSnapshot] = useState(() => store?.getEntrySnapshot(key));
  const lastUpdateAtRef = useRef(0);
  const pendingSnapshotRef = useRef<ConnectionRuntimeEntrySnapshot | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const initialSnapshot = store?.getEntrySnapshot(key);
    pendingSnapshotRef.current = initialSnapshot;
    lastUpdateAtRef.current = Date.now();
    setSnapshot((current) => current === initialSnapshot ? current : initialSnapshot);

    if (!store) {
      return undefined;
    }

    const flush = () => {
      timerRef.current = null;
      lastUpdateAtRef.current = Date.now();
      setSnapshot((current) =>
        current === pendingSnapshotRef.current ? current : pendingSnapshotRef.current,
      );
    };

    const scheduleSnapshot = () => {
      pendingSnapshotRef.current = store.getEntrySnapshot(key);

      const elapsedMs = Date.now() - lastUpdateAtRef.current;
      const delayMs = normalizedIntervalMs === 0
        ? 0
        : Math.max(0, normalizedIntervalMs - elapsedMs);

      if (timerRef.current === null) {
        timerRef.current = setTimeout(flush, delayMs);
      }
    };

    const unsubscribe = store.subscribe(scheduleSnapshot);

    return () => {
      unsubscribe();

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [key, normalizedIntervalMs, store]);

  return snapshot;
}
