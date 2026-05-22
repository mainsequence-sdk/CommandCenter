import { describe, expect, it } from "vitest";

import {
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_SEED_INPUT_ID,
} from "@/widgets/shared/incremental-tabular-consumer";

import { resolveWidgetStatusDiagnostics, resolveWidgetStatusSummary } from "./widget-status";

describe("resolveWidgetStatusSummary", () => {
  it("uses a red dot for finite execution errors", () => {
    const summary = resolveWidgetStatusSummary({
      executionState: {
        status: "error",
        error: "Request failed.",
      },
    });

    expect(summary).toMatchObject({
      activity: "idle",
      indicator: "dot",
      isError: true,
      label: "Execution error",
      outputLineage: "finite",
      primaryStatus: "error",
      sources: ["finite-execution"],
      tone: "danger",
    });
  });

  it("uses a red dot for upstream execution blockers", () => {
    const summary = resolveWidgetStatusSummary({
      executionState: {
        status: "upstream-error",
        error: "Blocked by Source.",
        blockedByWidgetId: "source-1",
      },
    });

    expect(summary).toMatchObject({
      detail: "Blocked by Source.",
      indicator: "dot",
      isError: true,
      label: "Upstream error",
      sources: ["upstream"],
      tone: "danger",
    });
  });

  it("uses a red lightning indicator for stream errors", () => {
    const summary = resolveWidgetStatusSummary({
      runtimeState: {
        status: "error",
        streamStatus: "error",
        error: "Socket closed.",
      },
    });

    expect(summary).toMatchObject({
      activity: "idle",
      detail: "Socket closed.",
      indicator: "lightning",
      isError: true,
      label: "Stream error",
      outputLineage: "stream",
      primaryStatus: "error",
      sources: ["stream-publication"],
      tone: "danger",
    });
  });

  it("combines dot and lightning when finite and stream errors are both active", () => {
    const summary = resolveWidgetStatusSummary({
      executionState: {
        status: "error",
        error: "Execution failed.",
      },
      runtimeState: {
        status: "error",
        streamStatus: "error",
        error: "Socket closed.",
      },
    });

    expect(summary).toMatchObject({
      activity: "idle",
      indicator: "dot+lightning",
      isError: true,
      label: "Execution and stream error",
      outputLineage: "finite+stream",
      primaryStatus: "error",
      sources: ["finite-execution", "stream-publication"],
      tone: "danger",
    });
  });

  it("keeps a retained live stream green instead of showing stale finite waiting", () => {
    const summary = resolveWidgetStatusSummary({
      executionState: {
        status: "waiting",
        error: "Waiting for upstream.",
      },
      runtimeState: {
        status: "ready",
        streamStatus: "live",
        columns: ["symbol", "last"],
        rows: [{ symbol: "BTCUSDT", last: 100 }],
      },
    });

    expect(summary).toMatchObject({
      indicator: "lightning",
      isError: false,
      label: "Live",
      sources: ["stream-publication"],
      tone: "success",
    });
  });

  it("shows live-only transformed source wrappers as stream-only", () => {
    const summary = resolveWidgetStatusSummary({
      runtimeState: {
        status: "ready",
        columns: ["symbol"],
        rows: [{ symbol: "BTCUSDT" }],
        source: {
          kind: "tabular-transform",
          context: {
            statusProvenance: {
              liveBound: true,
              liveHasPublishedValue: true,
              seedBound: false,
            },
            upstreamSource: {
              kind: "connection-stream-query",
              context: {
                stream: {
                  status: "live",
                },
              },
            },
          },
        },
      },
    });

    expect(summary).toMatchObject({
      activity: "idle",
      channels: {
        live: {
          kind: "live",
          status: "ready",
          tone: "success",
        },
      },
      indicator: "lightning",
      label: "Live",
      outputLineage: "stream",
      primaryStatus: "ready",
      sources: ["stream-publication"],
      streamStatus: "live",
      tone: "success",
    });
  });

  it("shows transformed source wrappers with seed and live provenance as dot plus stream", () => {
    const summary = resolveWidgetStatusSummary({
      runtimeState: {
        status: "ready",
        columns: ["symbol"],
        rows: [{ symbol: "BTCUSDT" }],
        source: {
          kind: "tabular-transform",
          context: {
            statusProvenance: {
              liveBound: true,
              liveHasPublishedValue: true,
              seedBound: true,
              seedHasPublishedValue: true,
            },
            upstreamSource: {
              kind: "connection-stream-query",
              context: {
                stream: {
                  status: "live",
                },
              },
            },
          },
        },
      },
    });

    expect(summary).toMatchObject({
      activity: "idle",
      channels: {
        live: {
          kind: "live",
          status: "ready",
          tone: "success",
        },
        seed: {
          kind: "seed",
          status: "ready",
          tone: "success",
        },
      },
      indicator: "dot+lightning",
      label: "Ready",
      outputLineage: "finite+stream",
      primaryStatus: "ready",
      sources: ["upstream", "stream-publication"],
      streamStatus: "live",
      tone: "success",
    });
  });

  it("shows stream waiting before the first usable publication", () => {
    const summary = resolveWidgetStatusSummary({
      runtimeState: {
        status: "idle",
        streamStatus: "connecting",
        columns: [],
        rows: [],
      },
    });

    expect(summary).toMatchObject({
      activity: "connecting",
      channels: {
        live: {
          kind: "live",
          status: "waiting",
          tone: "warning",
        },
      },
      detail: "Waiting for the first usable stream publication.",
      indicator: "lightning",
      isError: false,
      label: "Connecting",
      outputLineage: "stream",
      primaryStatus: "waiting",
      sources: ["stream-publication"],
      tone: "warning",
    });
  });

  it("keeps live-only consumers ready during execution ticks after the first live publication", () => {
    const summary = resolveWidgetStatusSummary({
      executionState: {
        status: "running",
      },
      runtimeState: {
        status: "ready",
        columns: ["symbol"],
        rows: [{ symbol: "BTCUSDT" }],
        source: {
          kind: "tabular-transform",
          context: {
            statusProvenance: {
              activeInputRole: "live",
              liveBound: true,
              liveHasPublishedValue: true,
              seedBound: false,
              seedHasPublishedValue: false,
            },
          },
        },
      },
    });

    expect(summary).toMatchObject({
      activity: "idle",
      indicator: "lightning",
      isLoading: false,
      label: "Live",
      outputLineage: "stream",
      primaryStatus: "ready",
      sources: ["stream-publication"],
      tone: "success",
    });
  });

  it("waits for all bound seed and live channels before reporting combined readiness", () => {
    const summary = resolveWidgetStatusSummary({
      resolvedInputs: {
        [TABULAR_SEED_INPUT_ID]: {
          inputId: TABULAR_SEED_INPUT_ID,
          label: "Seed data",
          status: "valid",
          sourceWidgetId: "seed-source",
          sourceOutputId: "dataset",
          value: { rows: [{ symbol: "BTCUSDT" }] },
        },
        [TABULAR_LIVE_UPDATES_INPUT_ID]: {
          inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          label: "Live updates",
          status: "valid",
          sourceWidgetId: "stream-source",
          sourceOutputId: "updates",
        },
      },
    });

    expect(summary).toMatchObject({
      indicator: "dot+lightning",
      label: "Waiting for inputs",
      outputLineage: "finite+stream",
      primaryStatus: "waiting",
      sources: ["upstream", "stream-publication"],
      tone: "warning",
    });
  });

  it("derives seed and live channel indicators directly from resolved bindings", () => {
    const summary = resolveWidgetStatusSummary({
      resolvedInputs: {
        [TABULAR_SEED_INPUT_ID]: {
          inputId: TABULAR_SEED_INPUT_ID,
          label: "Seed data",
          status: "valid",
          sourceWidgetId: "http-source",
          sourceOutputId: "dataset",
          value: { rows: [{ symbol: "BTCUSDT" }] },
        },
        [TABULAR_LIVE_UPDATES_INPUT_ID]: {
          inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          label: "Live updates",
          status: "missing-source",
          sourceWidgetId: "stream-source",
          sourceOutputId: "updates",
        },
      },
      runtimeState: {
        status: "ready",
      },
    });

    expect(summary.channels.seed).toMatchObject({
      kind: "seed",
      present: true,
      status: "ready",
      tone: "success",
    });
    expect(summary.channels.live).toMatchObject({
      kind: "live",
      present: true,
      status: "error",
      tone: "danger",
    });
  });

  it("builds structured diagnostics for status surfaces without console logs", () => {
    const diagnostics = resolveWidgetStatusDiagnostics({
      executionState: {
        status: "upstream-error",
        error: "Blocked by Source.",
        blockedByWidgetId: "source-1",
        blockedByOutputId: "dataset",
        finishedAtMs: 123,
      },
      runtimeState: {
        status: "ready",
        streamStatus: "live",
        columns: ["symbol"],
        rows: [{ symbol: "BTCUSDT" }],
        lastMessageAtMs: 456,
      },
    });

    expect(diagnostics).toMatchObject({
      activity: "idle",
      blockedByOutputId: "dataset",
      blockedByWidgetId: "source-1",
      detail: "Blocked by Source.",
      indicator: "dot",
      label: "Upstream error",
      lastExecutionAtMs: 123,
      lastPublicationAtMs: 456,
      outputLineage: "finite",
      primaryStatus: "error",
      retainedOutputAvailable: true,
      runtimeStatus: "ready",
      sources: ["upstream"],
      streamStatus: "live",
      tone: "danger",
    });
  });
});
