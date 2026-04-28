import type { DashboardWidgetRegistryEntry } from "@/dashboards/DashboardWidgetRegistry";
import type {
  ResolvedWidgetInput,
  WidgetInputResolutionStatus,
} from "@/widgets/types";

export type UpstreamConsumerDatasetStatus = "idle" | "loading" | "ready" | "error";

export interface UpstreamConsumerDatasetLike {
  status?: UpstreamConsumerDatasetStatus | null;
  rows?: unknown[];
  columns?: unknown[];
  error?: string | null;
}

export type UpstreamConsumerStateKind =
  | WidgetInputResolutionStatus
  | "awaiting-upstream"
  | "loading"
  | "ready"
  | "empty"
  | "error";

export interface ResolvedUpstreamConsumerState<
  TDataset extends UpstreamConsumerDatasetLike = UpstreamConsumerDatasetLike,
> {
  kind: UpstreamConsumerStateKind;
  dataset: TDataset | null;
  deltaDataset: TDataset | null;
  inputStatus?: WidgetInputResolutionStatus;
  sourceWidgetId?: string;
  sourceOutputId?: string;
  sourceWidgetTitle?: string | null;
  error?: string | null;
  requiresUpstreamResolution: boolean;
  hasCanonicalSourceBinding: boolean;
  hasPublishedValue: boolean;
  isEmpty: boolean;
}

export function isUpstreamConsumerBindingProblemKind(kind: UpstreamConsumerStateKind) {
  return kind === "missing-source" ||
    kind === "missing-output" ||
    kind === "contract-mismatch" ||
    kind === "self-reference-blocked" ||
    kind === "transform-invalid";
}

export function isUpstreamConsumerPendingKind(kind: UpstreamConsumerStateKind) {
  return kind === "awaiting-upstream" || kind === "loading";
}

export function selectPreferredUpstreamDataset<TDataset extends UpstreamConsumerDatasetLike>(
  primary: TDataset | null | undefined,
  fallback: TDataset | null | undefined,
) {
  if (!primary) {
    return fallback ?? null;
  }

  if (
    primary.status === "idle" &&
    fallback &&
    fallback.status &&
    fallback.status !== "idle"
  ) {
    return fallback;
  }

  return primary;
}

function buildBaseConsumerState<TDataset extends UpstreamConsumerDatasetLike>(input: {
  kind: UpstreamConsumerStateKind;
  dataset: TDataset | null;
  deltaDataset?: TDataset | null;
  resolvedSourceInput?: ResolvedWidgetInput;
  resolvedSourceWidget?: DashboardWidgetRegistryEntry | null;
  error?: string | null;
  requiresUpstreamResolution?: boolean;
  hasCanonicalSourceBinding: boolean;
  hasPublishedValue: boolean;
  isEmpty?: boolean;
}): ResolvedUpstreamConsumerState<TDataset> {
  return {
    kind: input.kind,
    dataset: input.dataset,
    deltaDataset: input.deltaDataset ?? null,
    inputStatus: input.resolvedSourceInput?.status,
    sourceWidgetId: input.resolvedSourceInput?.sourceWidgetId,
    sourceOutputId: input.resolvedSourceInput?.sourceOutputId,
    sourceWidgetTitle: input.resolvedSourceWidget?.title ?? null,
    error: input.error ?? null,
    requiresUpstreamResolution: input.requiresUpstreamResolution === true,
    hasCanonicalSourceBinding: input.hasCanonicalSourceBinding,
    hasPublishedValue: input.hasPublishedValue,
    isEmpty: input.isEmpty === true,
  };
}

export function resolveUpstreamConsumerState<
  TDataset extends UpstreamConsumerDatasetLike = UpstreamConsumerDatasetLike,
>(input: {
  hasCanonicalSourceBinding: boolean;
  hasPublishedValue: boolean;
  resolvedSourceInput?: ResolvedWidgetInput;
  resolvedSourceWidget?: DashboardWidgetRegistryEntry | null;
  dataset: TDataset | null;
  deltaDataset?: TDataset | null;
  invalidPublishedValueMessage?: string;
}): ResolvedUpstreamConsumerState<TDataset> {
  const {
    dataset,
    deltaDataset,
    hasCanonicalSourceBinding,
    hasPublishedValue,
    invalidPublishedValueMessage,
    resolvedSourceInput,
    resolvedSourceWidget,
  } = input;
  const inputStatus = resolvedSourceInput?.status;

  if (!hasCanonicalSourceBinding || !resolvedSourceInput || inputStatus === "unbound") {
    return buildBaseConsumerState({
      kind: "unbound",
      dataset,
      deltaDataset,
      resolvedSourceInput,
      resolvedSourceWidget,
      hasCanonicalSourceBinding,
      hasPublishedValue,
    });
  }

  if (
    inputStatus === "missing-source" ||
    inputStatus === "missing-output" ||
    inputStatus === "contract-mismatch" ||
    inputStatus === "self-reference-blocked" ||
    inputStatus === "transform-invalid"
  ) {
    return buildBaseConsumerState({
      kind: inputStatus,
      dataset,
      deltaDataset,
      resolvedSourceInput,
      resolvedSourceWidget,
      hasCanonicalSourceBinding,
      hasPublishedValue,
    });
  }

  if (inputStatus !== "valid") {
    return buildBaseConsumerState({
      kind: "unbound",
      dataset,
      deltaDataset,
      resolvedSourceInput,
      resolvedSourceWidget,
      hasCanonicalSourceBinding,
      hasPublishedValue,
    });
  }

  if (!hasPublishedValue) {
    return buildBaseConsumerState({
      kind: "awaiting-upstream",
      dataset,
      deltaDataset,
      resolvedSourceInput,
      resolvedSourceWidget,
      requiresUpstreamResolution: true,
      hasCanonicalSourceBinding,
      hasPublishedValue,
    });
  }

  if (!dataset) {
    return buildBaseConsumerState({
      kind: "error",
      dataset,
      deltaDataset,
      resolvedSourceInput,
      resolvedSourceWidget,
      error: invalidPublishedValueMessage ?? "The upstream source did not publish a compatible dataset.",
      hasCanonicalSourceBinding,
      hasPublishedValue,
    });
  }

  if (dataset.status === "loading") {
    return buildBaseConsumerState({
      kind: "loading",
      dataset,
      deltaDataset,
      resolvedSourceInput,
      resolvedSourceWidget,
      hasCanonicalSourceBinding,
      hasPublishedValue,
    });
  }

  if (dataset.status === "error") {
    return buildBaseConsumerState({
      kind: "error",
      dataset,
      deltaDataset,
      resolvedSourceInput,
      resolvedSourceWidget,
      error: dataset.error ?? invalidPublishedValueMessage ?? "The upstream source failed.",
      hasCanonicalSourceBinding,
      hasPublishedValue,
    });
  }

  if (dataset.status === "ready") {
    const isEmpty = (dataset.rows?.length ?? 0) === 0;

    return buildBaseConsumerState({
      kind: isEmpty ? "empty" : "ready",
      dataset,
      deltaDataset,
      resolvedSourceInput,
      resolvedSourceWidget,
      hasCanonicalSourceBinding,
      hasPublishedValue,
      isEmpty,
    });
  }

  return buildBaseConsumerState({
    kind: "awaiting-upstream",
    dataset,
    deltaDataset,
    resolvedSourceInput,
    resolvedSourceWidget,
    requiresUpstreamResolution: true,
    hasCanonicalSourceBinding,
    hasPublishedValue,
  });
}
