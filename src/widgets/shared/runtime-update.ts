export const WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION = "widget-runtime-update@v1" as const;
export const WIDGET_RUNTIME_UPDATE_CONTEXT_KEY = "runtimeUpdate" as const;

export type WidgetRuntimeUpdateMode = "snapshot" | "delta";

export interface WidgetRuntimeUpdateRange {
  from?: string;
  to?: string;
}

export interface WidgetRuntimeUpdateOperations {
  appended?: number;
  replaced?: number;
  removed?: number;
  pruned?: number;
  returned?: number;
  retained?: number;
}

export interface WidgetRuntimeUpdateEnvelope<
  TRetainedOutput = unknown,
  TDeltaOutput = unknown,
> {
  contractVersion: typeof WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION;
  mode: WidgetRuntimeUpdateMode;
  sourceWidgetId?: string;
  sourceOutputId?: string;
  outputContractId?: string;
  retainedOutputLocation?: "carrier" | "envelope";
  retainedOutput?: TRetainedOutput;
  deltaOutput?: TDeltaOutput;
  range?: WidgetRuntimeUpdateRange;
  retainedRange?: WidgetRuntimeUpdateRange;
  watermarkBeforeMs?: number;
  watermarkAfterMs?: number;
  operations?: WidgetRuntimeUpdateOperations;
  diagnostics?: Record<string, unknown>;
}

export interface WidgetRuntimeUpdateParts<
  TBase = unknown,
  TDelta = unknown,
> {
  upstreamBase: TBase;
  upstreamDelta?: TDelta;
  upstreamUpdate?: WidgetRuntimeUpdateEnvelope<TBase, TDelta>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function attachWidgetRuntimeUpdateContext<
  TOutput extends { source?: { context?: Record<string, unknown> } },
>(output: TOutput, update: WidgetRuntimeUpdateEnvelope): TOutput {
  return {
    ...output,
    source: {
      ...output.source,
      context: {
        ...(output.source?.context ?? {}),
        [WIDGET_RUNTIME_UPDATE_CONTEXT_KEY]: update,
      },
    },
  };
}

export function readWidgetRuntimeUpdateContext(
  output: unknown,
): WidgetRuntimeUpdateEnvelope | undefined {
  if (!isPlainRecord(output) || !isPlainRecord(output.source)) {
    return undefined;
  }

  const context = output.source.context;

  if (!isPlainRecord(context)) {
    return undefined;
  }

  const update = context[WIDGET_RUNTIME_UPDATE_CONTEXT_KEY];

  return isPlainRecord(update) &&
    update.contractVersion === WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION &&
    (update.mode === "snapshot" || update.mode === "delta")
    ? (update as unknown as WidgetRuntimeUpdateEnvelope)
    : undefined;
}

export function resolveWidgetRuntimeUpdateParts<TBase = unknown, TDelta = unknown>(
  output: TBase,
): WidgetRuntimeUpdateParts<TBase, TDelta> {
  const update = readWidgetRuntimeUpdateContext(output) as
    | WidgetRuntimeUpdateEnvelope<TBase, TDelta>
    | undefined;

  if (!update) {
    return {
      upstreamBase: output,
    };
  }

  const upstreamBase =
    update.retainedOutputLocation === "envelope" && "retainedOutput" in update
      ? update.retainedOutput
      : output;

  return {
    upstreamBase: upstreamBase as TBase,
    upstreamDelta: update.mode === "delta" ? update.deltaOutput : undefined,
    upstreamUpdate: update,
  };
}

export function mapWidgetRuntimeUpdateEnvelope<TBase = unknown, TDelta = unknown>(
  update: WidgetRuntimeUpdateEnvelope,
  output: {
    mode?: WidgetRuntimeUpdateMode;
    outputContractId?: string;
    upstreamBase: TBase;
    upstreamDelta?: TDelta;
    diagnostics?: Record<string, unknown>;
  },
): WidgetRuntimeUpdateEnvelope<TBase, TDelta> {
  const mode = output.mode ?? update.mode;

  return {
    ...update,
    mode,
    outputContractId: output.outputContractId ?? update.outputContractId,
    retainedOutputLocation: "carrier",
    retainedOutput: undefined,
    deltaOutput: mode === "delta" ? output.upstreamDelta : undefined,
    diagnostics: output.diagnostics
      ? {
          ...(update.diagnostics ?? {}),
          ...output.diagnostics,
        }
      : update.diagnostics,
  };
}
