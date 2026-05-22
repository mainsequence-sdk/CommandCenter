import type { WidgetExecutionState } from "@/dashboards/DashboardWidgetExecutionContext";
import { titleCase } from "@/lib/utils";

export type WidgetStatusTone = "danger" | "neutral" | "primary" | "success" | "warning";
export type WidgetStatusSource =
  | "finite-execution"
  | "stream-publication"
  | "runtime"
  | "upstream";
export type WidgetStatusIndicator = "dot" | "lightning" | "dot+lightning";

export interface WidgetStatusSummary {
  detail?: string;
  indicator: WidgetStatusIndicator;
  isError: boolean;
  isLoading: boolean;
  label: string;
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

  const source = runtimeState?.source;
  const context =
    source && typeof source === "object" && !Array.isArray(source) && "context" in source
      ? (source as { context?: unknown }).context
      : undefined;
  const stream =
    context && typeof context === "object" && !Array.isArray(context) && "stream" in context
      ? (context as { stream?: unknown }).stream
      : undefined;
  const nestedStatus =
    stream && typeof stream === "object" && !Array.isArray(stream) && "status" in stream
      ? (stream as { status?: unknown }).status
      : undefined;

  return typeof nestedStatus === "string" && nestedStatus.trim() ? nestedStatus.trim() : null;
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

function buildSummary(input: {
  detail?: string;
  isError?: boolean;
  isLoading?: boolean;
  label: string;
  runtimeStatus?: string | null;
  sources: WidgetStatusSource[];
  streamStatus?: string | null;
  tone: WidgetStatusTone;
}): WidgetStatusSummary {
  const sources = uniqueSources(input.sources);

  return {
    detail: input.detail,
    indicator: indicatorForSources(sources),
    isError: input.isError === true,
    isLoading: input.isLoading === true,
    label: input.label,
    runtimeStatus: input.runtimeStatus ?? undefined,
    sources,
    streamStatus: input.streamStatus ?? undefined,
    tone: input.tone,
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

export function resolveWidgetStatusSummary(input: {
  dashboardSurfaceHydrationActive?: boolean;
  executionState?: WidgetExecutionState;
  hasUnresolvedReferenceInputs?: boolean;
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

    return buildSummary({
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

  if (input.executionState?.status === "running") {
    return buildSummary({
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
      return buildSummary({
        label:
          streamStatus === "reconnecting"
            ? "Reconnecting"
            : streamStatus === "connecting"
              ? "Connecting"
              : "Live",
        runtimeStatus,
        sources: ["stream-publication"],
        streamStatus,
        tone: "success",
      });
    }

    return buildSummary({
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

    return buildSummary({
      detail: waitingReason || "Waiting for an upstream widget before execution can continue.",
      label: "Waiting",
      runtimeStatus,
      sources: ["finite-execution"],
      streamStatus,
      tone: "warning",
    });
  }

  if (input.hasUnresolvedReferenceInputs) {
    return buildSummary({
      detail: "One or more reference-backed inputs have no resolved value yet.",
      label: "Waiting for referenced value",
      runtimeStatus,
      sources: ["upstream"],
      streamStatus,
      tone: "warning",
    });
  }

  if (input.executionState?.status === "success") {
    return buildSummary({
      label: "Ready",
      runtimeStatus,
      sources: streamStatus ? ["finite-execution", "stream-publication"] : ["finite-execution"],
      streamStatus,
      tone: "success",
    });
  }

  if (runtimeStatus === "range") {
    return buildSummary({
      label: "Range",
      runtimeStatus,
      sources: ["runtime"],
      streamStatus,
      tone: "warning",
    });
  }

  if (runtimeStatus === "loading") {
    return buildSummary({
      isLoading: true,
      label: "Loading data",
      runtimeStatus,
      sources: ["runtime"],
      streamStatus,
      tone: "primary",
    });
  }

  if (runtimeStatus === "ready") {
    return buildSummary({
      label: "Ready",
      runtimeStatus,
      sources: streamStatus ? ["runtime", "stream-publication"] : ["runtime"],
      streamStatus,
      tone: "success",
    });
  }

  if (!runtimeStatus && input.widget?.workspaceRuntimeMode === "execution-owner") {
    return buildSummary({
      detail: "Waiting for the widget to run and publish runtime data.",
      label: "Waiting",
      sources: ["finite-execution"],
      streamStatus,
      tone: "warning",
    });
  }

  if (input.dashboardSurfaceHydrationActive && input.widget?.workspaceRuntimeMode !== "local-ui") {
    return buildSummary({
      isLoading: true,
      label: "Loading",
      runtimeStatus,
      sources: ["runtime"],
      streamStatus,
      tone: "primary",
    });
  }

  return buildSummary({
    label: runtimeStatus ? titleCase(runtimeStatus.replaceAll("_", " ")) : "Ready",
    runtimeStatus: runtimeStatus ?? undefined,
    sources: runtimeStatus ? ["runtime"] : [],
    streamStatus,
    tone: runtimeStatus ? "neutral" : "success",
  });
}
