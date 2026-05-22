import type { WidgetExecutionState } from "@/dashboards/DashboardWidgetExecutionContext";
import { titleCase } from "@/lib/utils";
import {
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_SEED_INPUT_ID,
} from "@/widgets/shared/incremental-tabular-consumer";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
} from "@/widgets/types";

export type WidgetStatusTone = "danger" | "neutral" | "primary" | "success" | "warning";
export type WidgetStatusSource =
  | "finite-execution"
  | "stream-publication"
  | "runtime"
  | "upstream";
export type WidgetStatusIndicator = "dot" | "lightning" | "dot+lightning";
export type WidgetPrimaryStatus = "error" | "neutral" | "ready" | "updating" | "waiting";
export type WidgetOutputLineage = "finite" | "finite+stream" | "local" | "stream";
export type WidgetActivityState =
  | "connecting"
  | "executing"
  | "idle"
  | "processing-stream-update"
  | "reconnecting";
export type WidgetStatusChannelKind = "live" | "seed";
const LEGACY_TABULAR_SOURCE_INPUT_ID = "sourceData";

export interface WidgetStatusChannel {
  activity: WidgetActivityState;
  detail?: string;
  kind: WidgetStatusChannelKind;
  label: string;
  present: boolean;
  status: WidgetPrimaryStatus;
  tone: WidgetStatusTone;
}

export interface WidgetStatusChannels {
  live?: WidgetStatusChannel;
  seed?: WidgetStatusChannel;
}

export interface WidgetStatusSummary {
  activity: WidgetActivityState;
  channels: WidgetStatusChannels;
  detail?: string;
  indicator: WidgetStatusIndicator;
  isError: boolean;
  isLoading: boolean;
  label: string;
  outputLineage: WidgetOutputLineage;
  primaryStatus: WidgetPrimaryStatus;
  runtimeStatus?: string;
  sources: WidgetStatusSource[];
  streamStatus?: string;
  tone: WidgetStatusTone;
}

export interface WidgetStatusDiagnostics {
  activity: WidgetActivityState;
  blockedByOutputId?: string;
  blockedByWidgetId?: string;
  channels: WidgetStatusChannels;
  detail?: string;
  indicator: WidgetStatusIndicator;
  label: string;
  lastExecutionAtMs?: number;
  lastPublicationAtMs?: number;
  outputLineage: WidgetOutputLineage;
  primaryStatus: WidgetPrimaryStatus;
  retainedOutputAvailable: boolean;
  runtimeStatus?: string;
  sources: WidgetStatusSource[];
  streamStatus?: string;
  tone: WidgetStatusTone;
}

export function resolveRuntimeStatus(runtimeState?: Record<string, unknown>) {
  return typeof runtimeState?.status === "string" ? runtimeState.status : null;
}

export function resolveRuntimeStreamStatus(runtimeState?: Record<string, unknown>) {
  const directStatus =
    typeof runtimeState?.streamStatus === "string" ? runtimeState.streamStatus.trim() : "";

  if (directStatus) {
    return directStatus;
  }

  return resolveSourceStreamStatus(runtimeState?.source, 0);
}

function resolveSourceStreamStatus(source: unknown, depth: number): string | null {
  if (!source || typeof source !== "object" || Array.isArray(source) || depth > 4) {
    return null;
  }

  const context = "context" in source ? (source as { context?: unknown }).context : undefined;

  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return null;
  }

  const stream = "stream" in context ? (context as { stream?: unknown }).stream : undefined;
  const nestedStatus =
    stream && typeof stream === "object" && !Array.isArray(stream) && "status" in stream
      ? (stream as { status?: unknown }).status
      : undefined;

  if (typeof nestedStatus === "string" && nestedStatus.trim()) {
    return nestedStatus.trim();
  }

  const upstreamSource =
    "upstreamSource" in context
      ? (context as { upstreamSource?: unknown }).upstreamSource
      : undefined;

  return resolveSourceStreamStatus(upstreamSource, depth + 1);
}

function readStringField(value: Record<string, unknown> | undefined, keys: string[]) {
  if (!value) {
    return undefined;
  }

  for (const key of keys) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

export function resolveRuntimeErrorDetail(runtimeState?: Record<string, unknown>) {
  return readStringField(runtimeState, ["error", "errorMessage", "message", "detail"]);
}

function uniqueSources(sources: WidgetStatusSource[]) {
  return [...new Set(sources)];
}

function indicatorForSources(sources: readonly WidgetStatusSource[]): WidgetStatusIndicator {
  const hasFinite =
    sources.includes("finite-execution") ||
    sources.includes("runtime") ||
    sources.includes("upstream");
  const hasStream = sources.includes("stream-publication");

  if (hasFinite && hasStream) {
    return "dot+lightning";
  }

  return hasStream ? "lightning" : "dot";
}

function outputLineageForSources(sources: readonly WidgetStatusSource[]): WidgetOutputLineage {
  const hasFinite =
    sources.includes("finite-execution") ||
    sources.includes("runtime") ||
    sources.includes("upstream");
  const hasStream = sources.includes("stream-publication");

  if (hasFinite && hasStream) {
    return "finite+stream";
  }

  if (hasStream) {
    return "stream";
  }

  return hasFinite ? "finite" : "local";
}

function primaryStatusForSummary(input: {
  isError?: boolean;
  isLoading?: boolean;
  tone: WidgetStatusTone;
}): WidgetPrimaryStatus {
  if (input.isError) {
    return "error";
  }

  if (input.isLoading || input.tone === "primary") {
    return "updating";
  }

  if (input.tone === "warning") {
    return "waiting";
  }

  if (input.tone === "success") {
    return "ready";
  }

  return "neutral";
}

function activityForSummary(input: {
  isLoading?: boolean;
  sources: readonly WidgetStatusSource[];
  streamStatus?: string | null;
}): WidgetActivityState {
  if (input.streamStatus === "connecting") {
    return "connecting";
  }

  if (input.streamStatus === "reconnecting") {
    return "reconnecting";
  }

  if (input.isLoading && input.sources.includes("finite-execution")) {
    return "executing";
  }

  if (input.isLoading && input.sources.includes("stream-publication")) {
    return "processing-stream-update";
  }

  return "idle";
}

function getResolvedInputEntries(
  resolvedInputs: ResolvedWidgetInputs | undefined,
  inputIds: string[],
) {
  return inputIds.flatMap((inputId) => {
    const entry = resolvedInputs?.[inputId];
    return Array.isArray(entry) ? entry : entry ? [entry] : [];
  });
}

function isResolvedInputBound(input: ResolvedWidgetInput) {
  return (
    input.status !== "unbound" &&
    Boolean(input.sourceWidgetId || input.sourceOutputId || input.binding)
  );
}

function resolvedInputHasPublishedValue(input: ResolvedWidgetInput) {
  return (
    input.value !== undefined ||
    input.valueRef !== undefined ||
    input.upstreamBase !== undefined ||
    input.upstreamBaseRef !== undefined ||
    input.upstreamDelta !== undefined ||
    input.upstreamDeltaRef !== undefined
  );
}

function hasInputResolutionProblem(input: ResolvedWidgetInput) {
  return input.status !== "valid" && input.status !== "unbound";
}

function buildChannelFromEntries(input: {
  entries: ResolvedWidgetInput[];
  fallbackBound?: boolean;
  fallbackHasPublishedValue?: boolean;
  kind: WidgetStatusChannelKind;
  streamStatus?: string | null;
}): WidgetStatusChannel | undefined {
  const boundEntries = input.entries.filter(isResolvedInputBound);
  const present = boundEntries.length > 0 || input.fallbackBound === true;

  if (!present) {
    return undefined;
  }

  const problemEntry = boundEntries.find(hasInputResolutionProblem);

  if (problemEntry) {
    return {
      detail: problemEntry.status,
      activity: "idle",
      kind: input.kind,
      label: input.kind === "live" ? "Live binding error" : "Seed binding error",
      present: true,
      status: "error",
      tone: "danger",
    };
  }

  if (input.kind === "live" && input.streamStatus === "error") {
    return {
      activity: "idle",
      kind: input.kind,
      label: "Live stream error",
      present: true,
      status: "error",
      tone: "danger",
    };
  }

  const hasPublishedValue =
    boundEntries.some(resolvedInputHasPublishedValue) || input.fallbackHasPublishedValue === true;

  if (input.kind === "live" && input.streamStatus === "connecting" && !hasPublishedValue) {
    return {
      activity: "connecting",
      kind: input.kind,
      label: "Live connecting",
      present: true,
      status: "waiting",
      tone: "warning",
    };
  }

  if (input.kind === "live" && input.streamStatus === "reconnecting") {
    return {
      activity: "reconnecting",
      kind: input.kind,
      label: "Live reconnecting",
      present: true,
      status: hasPublishedValue ? "ready" : "waiting",
      tone: hasPublishedValue ? "success" : "warning",
    };
  }

  if (
    !hasPublishedValue &&
    (boundEntries.some((entry) => entry.status === "valid") || input.fallbackBound === true)
  ) {
    return {
      activity: "idle",
      kind: input.kind,
      label: input.kind === "live" ? "Waiting for live input" : "Waiting for seed input",
      present: true,
      status: "waiting",
      tone: "warning",
    };
  }

  return {
    activity: "idle",
    kind: input.kind,
    label: input.kind === "live" ? "Live input ready" : "Seed input ready",
    present: true,
    status: "ready",
    tone: "success",
  };
}

function resolveWidgetStatusChannels(input: {
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeState?: Record<string, unknown>;
  streamStatus?: string | null;
}): WidgetStatusChannels {
  const provenance = resolveRuntimeStatusProvenance(input.runtimeState);
  const runtimeStatus = resolveRuntimeStatus(input.runtimeState);
  const streamHasRetainedOutput = hasUsableRetainedRuntimeOutput(input.runtimeState, runtimeStatus);
  const seedEntries = getResolvedInputEntries(input.resolvedInputs, [
    TABULAR_SEED_INPUT_ID,
    LEGACY_TABULAR_SOURCE_INPUT_ID,
  ]);
  const liveEntries = getResolvedInputEntries(input.resolvedInputs, [
    TABULAR_LIVE_UPDATES_INPUT_ID,
  ]);
  const seed = buildChannelFromEntries({
    entries: seedEntries,
    fallbackBound: provenance?.seedBound,
    fallbackHasPublishedValue: provenance?.seedHasPublishedValue,
    kind: "seed",
  });
  const live = buildChannelFromEntries({
    entries: liveEntries,
    fallbackBound: provenance?.liveBound ?? Boolean(input.streamStatus),
    fallbackHasPublishedValue: provenance?.liveHasPublishedValue ?? streamHasRetainedOutput,
    kind: "live",
    streamStatus: input.streamStatus,
  });

  return {
    ...(seed ? { seed } : {}),
    ...(live ? { live } : {}),
  };
}

function buildSummary(input: {
  activity?: WidgetActivityState;
  channels?: WidgetStatusChannels;
  detail?: string;
  isError?: boolean;
  isLoading?: boolean;
  label: string;
  outputLineage?: WidgetOutputLineage;
  primaryStatus?: WidgetPrimaryStatus;
  runtimeStatus?: string | null;
  sources: WidgetStatusSource[];
  streamStatus?: string | null;
  tone: WidgetStatusTone;
}): WidgetStatusSummary {
  const sources = uniqueSources(input.sources);
  const outputLineage = input.outputLineage ?? outputLineageForSources(sources);
  const primaryStatus = input.primaryStatus ?? primaryStatusForSummary(input);
  const activity =
    input.activity ??
    activityForSummary({
      isLoading: input.isLoading,
      sources,
      streamStatus: input.streamStatus,
    });

  return {
    activity,
    channels: input.channels ?? {},
    detail: input.detail,
    indicator: indicatorForSources(sources),
    isError: input.isError === true,
    isLoading: input.isLoading === true,
    label: input.label,
    outputLineage,
    primaryStatus,
    runtimeStatus: input.runtimeStatus ?? undefined,
    sources,
    streamStatus: input.streamStatus ?? undefined,
    tone: input.tone,
  };
}

function sourceForChannel(kind: WidgetStatusChannelKind): WidgetStatusSource {
  return kind === "live" ? "stream-publication" : "upstream";
}

function activeStatusChannels(channels: WidgetStatusChannels) {
  return [channels.seed, channels.live].filter(
    (channel): channel is WidgetStatusChannel => channel?.present === true,
  );
}

function resolveRoleAwareChannelStatus(
  channels: WidgetStatusChannels,
  streamStatus?: string | null,
): Parameters<typeof buildSummary>[0] | null {
  const activeChannels = activeStatusChannels(channels);

  if (activeChannels.length === 0) {
    return null;
  }

  const sources = activeChannels.map((channel) => sourceForChannel(channel.kind));
  const errorChannel = activeChannels.find((channel) => channel.status === "error");

  if (errorChannel) {
    return {
      activity: errorChannel.activity,
      detail: errorChannel.detail ?? errorChannel.label,
      isError: true,
      label: activeChannels.length > 1 ? "Upstream input error" : errorChannel.label,
      sources,
      streamStatus,
      tone: "danger",
    };
  }

  const waitingChannel = activeChannels.find((channel) => channel.status === "waiting");

  if (waitingChannel) {
    const label =
      activeChannels.length === 1 && waitingChannel.kind === "live"
        ? waitingChannel.activity === "connecting"
          ? "Connecting"
          : waitingChannel.activity === "reconnecting"
            ? "Reconnecting"
            : "Waiting for stream"
        : activeChannels.length > 1
          ? "Waiting for inputs"
          : waitingChannel.label;

    return {
      activity: waitingChannel.activity,
      detail:
        waitingChannel.detail ??
        (activeChannels.length === 1 && waitingChannel.kind === "live"
          ? "Waiting for the first usable stream publication."
          : undefined),
      label,
      sources,
      streamStatus,
      tone: "warning",
    };
  }

  const updatingChannel = activeChannels.find((channel) => channel.status === "updating");

  if (updatingChannel) {
    return {
      activity: updatingChannel.activity,
      isLoading: true,
      label: activeChannels.length > 1 ? "Updating inputs" : updatingChannel.label,
      sources,
      streamStatus,
      tone: "primary",
    };
  }

  return {
    activity:
      activeChannels.find((channel) => channel.activity !== "idle")?.activity ?? "idle",
    label:
      activeChannels.length === 1 && activeChannels[0]?.kind === "live" ? "Live" : "Ready",
    sources,
    streamStatus,
    tone: "success",
  };
}

function hasUsableRetainedRuntimeOutput(
  runtimeState: Record<string, unknown> | undefined,
  runtimeStatus: string | null,
) {
  if (!runtimeState || runtimeStatus === "error" || runtimeStatus === "data_error") {
    return false;
  }

  if (runtimeStatus === "ready" || runtimeStatus === "range") {
    return true;
  }

  const rows = runtimeState.rows;
  const columns = runtimeState.columns;
  const fields = runtimeState.fields;

  if (Array.isArray(rows) && rows.length > 0) {
    return true;
  }

  if (Array.isArray(columns) && columns.length > 0 && runtimeStatus !== "idle") {
    return true;
  }

  return Array.isArray(fields) && fields.length > 0 && runtimeStatus !== "idle";
}

function isRuntimeErrorStatus(runtimeStatus: string | null) {
  return (
    runtimeStatus === "error" ||
    runtimeStatus === "data_error" ||
    runtimeStatus === "detail_error"
  );
}

function isLiveStreamStatus(streamStatus: string | null) {
  return (
    streamStatus === "live" ||
    streamStatus === "reconnecting" ||
    streamStatus === "connecting"
  );
}

function resolveRuntimeSourceKind(runtimeState?: Record<string, unknown>) {
  const source = runtimeState?.source;

  if (!source || typeof source !== "object" || Array.isArray(source) || !("kind" in source)) {
    return undefined;
  }

  const kind = (source as { kind?: unknown }).kind;

  return typeof kind === "string" && kind.trim() ? kind.trim() : undefined;
}

interface RuntimeStatusProvenance {
  liveBound?: boolean;
  liveHasPublishedValue?: boolean;
  seedBound?: boolean;
  seedHasPublishedValue?: boolean;
}

function resolveRuntimeStatusProvenance(
  runtimeState?: Record<string, unknown>,
): RuntimeStatusProvenance | null {
  return resolveSourceStatusProvenance(runtimeState?.source, 0);
}

function resolveSourceStatusProvenance(
  source: unknown,
  depth: number,
): RuntimeStatusProvenance | null {
  if (!source || typeof source !== "object" || Array.isArray(source) || depth > 4) {
    return null;
  }

  const context = "context" in source ? (source as { context?: unknown }).context : undefined;

  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return null;
  }

  const statusProvenance =
    "statusProvenance" in context
      ? (context as { statusProvenance?: unknown }).statusProvenance
      : undefined;

  if (statusProvenance && typeof statusProvenance === "object" && !Array.isArray(statusProvenance)) {
    const provenance = statusProvenance as Record<string, unknown>;

    return {
      liveBound: provenance.liveBound === true,
      liveHasPublishedValue: provenance.liveHasPublishedValue === true,
      seedBound: provenance.seedBound === true,
      seedHasPublishedValue: provenance.seedHasPublishedValue === true,
    };
  }

  const upstreamSource =
    "upstreamSource" in context
      ? (context as { upstreamSource?: unknown }).upstreamSource
      : undefined;

  return resolveSourceStatusProvenance(upstreamSource, depth + 1);
}

function resolveReadyRuntimeSourcesForStream(input: {
  runtimeState?: Record<string, unknown>;
  runtimeStatus: string | null;
}) {
  const statusProvenance = resolveRuntimeStatusProvenance(input.runtimeState);

  if (statusProvenance?.liveBound && !statusProvenance.seedBound) {
    return ["stream-publication"] satisfies WidgetStatusSource[];
  }

  if (statusProvenance?.seedBound && !statusProvenance.liveBound) {
    return ["runtime"] satisfies WidgetStatusSource[];
  }

  if (statusProvenance?.seedBound && statusProvenance.liveBound) {
    return ["runtime", "stream-publication"] satisfies WidgetStatusSource[];
  }

  const runtimeSourceKind = resolveRuntimeSourceKind(input.runtimeState);

  return input.runtimeStatus && runtimeSourceKind !== "connection-stream-query"
    ? (["runtime", "stream-publication"] satisfies WidgetStatusSource[])
    : (["stream-publication"] satisfies WidgetStatusSource[]);
}

function readNumberField(value: Record<string, unknown> | undefined, keys: string[]) {
  if (!value) {
    return undefined;
  }

  for (const key of keys) {
    const candidate = value[key];

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function resolveRuntimePublicationTime(runtimeState?: Record<string, unknown>) {
  const direct = readNumberField(runtimeState, [
    "lastMessageAtMs",
    "lastHeartbeatAtMs",
    "updatedAtMs",
  ]);

  if (direct !== undefined) {
    return direct;
  }

  const source = runtimeState?.source;

  return source && typeof source === "object" && !Array.isArray(source)
    ? readNumberField(source as Record<string, unknown>, ["updatedAtMs"])
    : undefined;
}

export function resolveWidgetStatusSummary(input: {
  dashboardSurfaceHydrationActive?: boolean;
  executionState?: WidgetExecutionState;
  hasUnresolvedReferenceInputs?: boolean;
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeState?: Record<string, unknown>;
  widget?: {
    workspaceRuntimeMode?: string;
  };
}): WidgetStatusSummary {
  const runtimeStatus = resolveRuntimeStatus(input.runtimeState);
  const streamStatus = resolveRuntimeStreamStatus(input.runtimeState);
  const streamHasRetainedOutput = hasUsableRetainedRuntimeOutput(input.runtimeState, runtimeStatus);
  const streamError = streamStatus === "error";
  const runtimeError = isRuntimeErrorStatus(runtimeStatus);
  const executionError = input.executionState?.status === "error";
  const upstreamError = input.executionState?.status === "upstream-error";
  const channels = resolveWidgetStatusChannels({
    resolvedInputs: input.resolvedInputs,
    runtimeState: input.runtimeState,
    streamStatus,
  });
  const roleAwareStatus = resolveRoleAwareChannelStatus(channels, streamStatus);
  const buildStatusSummary = (summaryInput: Parameters<typeof buildSummary>[0]) =>
    buildSummary({
      ...summaryInput,
      channels,
    });

  if (executionError || upstreamError || streamError || runtimeError) {
    const sources: WidgetStatusSource[] = [];

    if (executionError) {
      sources.push("finite-execution");
    }

    if (upstreamError) {
      sources.push("upstream");
    }

    if (streamError) {
      sources.push("stream-publication");
    }

    if (runtimeError && !streamError) {
      sources.push("runtime");
    }

    return buildStatusSummary({
      detail:
        input.executionState?.error?.trim() ||
        resolveRuntimeErrorDetail(input.runtimeState) ||
        (streamError ? "The stream reported an error." : "Execution failed."),
      isError: true,
      label:
        executionError && streamError
          ? "Execution and stream error"
          : upstreamError && streamError
            ? "Upstream and stream error"
          : streamError
            ? "Stream error"
            : upstreamError
              ? "Upstream error"
            : runtimeError && !executionError
              ? titleCase(runtimeStatus!.replaceAll("_", " "))
              : "Execution error",
      runtimeStatus,
      sources,
      streamStatus,
      tone: "danger",
    });
  }

  if (roleAwareStatus?.isError) {
    return buildStatusSummary(roleAwareStatus);
  }

  if (roleAwareStatus) {
    return buildStatusSummary(roleAwareStatus);
  }

  if (input.executionState?.status === "running") {
    return buildStatusSummary({
      isLoading: true,
      label: "Running",
      runtimeStatus,
      sources: streamStatus ? ["finite-execution", "stream-publication"] : ["finite-execution"],
      streamStatus,
      tone: "primary",
    });
  }

  if (streamStatus && isLiveStreamStatus(streamStatus)) {
    if (streamHasRetainedOutput) {
      const sources = resolveReadyRuntimeSourcesForStream({
        runtimeState: input.runtimeState,
        runtimeStatus,
      });

      return buildStatusSummary({
        label:
          streamStatus === "reconnecting"
            ? "Reconnecting"
            : streamStatus === "connecting"
              ? "Connecting"
              : "Live",
        runtimeStatus,
        sources,
        streamStatus,
        tone: "success",
      });
    }

    return buildStatusSummary({
      detail: "Waiting for the first usable stream publication.",
      label: streamStatus === "connecting" ? "Connecting" : "Waiting for stream",
      runtimeStatus,
      sources: ["stream-publication"],
      streamStatus,
      tone: "warning",
    });
  }

  if (input.executionState?.status === "waiting") {
    const waitingReason = input.executionState.error?.trim();

    return buildStatusSummary({
      detail: waitingReason || "Waiting for an upstream widget before execution can continue.",
      label: "Waiting",
      runtimeStatus,
      sources: ["finite-execution"],
      streamStatus,
      tone: "warning",
    });
  }

  if (input.hasUnresolvedReferenceInputs) {
    return buildStatusSummary({
      detail: "One or more reference-backed inputs have no resolved value yet.",
      label: "Waiting for referenced value",
      runtimeStatus,
      sources: ["upstream"],
      streamStatus,
      tone: "warning",
    });
  }

  if (input.executionState?.status === "success") {
    return buildStatusSummary({
      label: "Ready",
      runtimeStatus,
      sources: streamStatus ? ["finite-execution", "stream-publication"] : ["finite-execution"],
      streamStatus,
      tone: "success",
    });
  }

  if (runtimeStatus === "range") {
    return buildStatusSummary({
      label: "Range",
      runtimeStatus,
      sources: ["runtime"],
      streamStatus,
      tone: "warning",
    });
  }

  if (runtimeStatus === "loading") {
    return buildStatusSummary({
      isLoading: true,
      label: "Loading data",
      runtimeStatus,
      sources: ["runtime"],
      streamStatus,
      tone: "primary",
    });
  }

  if (runtimeStatus === "ready") {
    return buildStatusSummary({
      label: "Ready",
      runtimeStatus,
      sources: streamStatus
        ? resolveReadyRuntimeSourcesForStream({
            runtimeState: input.runtimeState,
            runtimeStatus,
          })
        : ["runtime"],
      streamStatus,
      tone: "success",
    });
  }

  if (!runtimeStatus && input.widget?.workspaceRuntimeMode === "execution-owner") {
    return buildStatusSummary({
      detail: "Waiting for the widget to run and publish runtime data.",
      label: "Waiting",
      sources: ["finite-execution"],
      streamStatus,
      tone: "warning",
    });
  }

  if (input.dashboardSurfaceHydrationActive && input.widget?.workspaceRuntimeMode !== "local-ui") {
    return buildStatusSummary({
      isLoading: true,
      label: "Loading",
      runtimeStatus,
      sources: ["runtime"],
      streamStatus,
      tone: "primary",
    });
  }

  return buildStatusSummary({
    label: runtimeStatus ? titleCase(runtimeStatus.replaceAll("_", " ")) : "Ready",
    runtimeStatus: runtimeStatus ?? undefined,
    sources: runtimeStatus ? ["runtime"] : [],
    streamStatus,
    tone: runtimeStatus ? "neutral" : "success",
  });
}

export function resolveWidgetStatusDiagnostics(input: {
  dashboardSurfaceHydrationActive?: boolean;
  executionState?: WidgetExecutionState;
  hasUnresolvedReferenceInputs?: boolean;
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeState?: Record<string, unknown>;
  widget?: {
    workspaceRuntimeMode?: string;
  };
}): WidgetStatusDiagnostics {
  const summary = resolveWidgetStatusSummary(input);
  const runtimeStatus = resolveRuntimeStatus(input.runtimeState);

  return {
    blockedByOutputId: input.executionState?.blockedByOutputId,
    blockedByWidgetId: input.executionState?.blockedByWidgetId,
    channels: summary.channels,
    detail: summary.detail,
    indicator: summary.indicator,
    label: summary.label,
    lastExecutionAtMs: input.executionState?.finishedAtMs ?? input.executionState?.startedAtMs,
    lastPublicationAtMs: resolveRuntimePublicationTime(input.runtimeState),
    activity: summary.activity,
    outputLineage: summary.outputLineage,
    primaryStatus: summary.primaryStatus,
    retainedOutputAvailable: hasUsableRetainedRuntimeOutput(input.runtimeState, runtimeStatus),
    runtimeStatus: summary.runtimeStatus,
    sources: summary.sources,
    streamStatus: summary.streamStatus,
    tone: summary.tone,
  };
}
