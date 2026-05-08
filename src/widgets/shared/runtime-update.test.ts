import { describe, expect, it } from "vitest";

import { CORE_TABULAR_FRAME_SOURCE_CONTRACT, type TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";

import {
  attachWidgetRuntimeUpdateContext,
  readWidgetRuntimeUpdateContext,
  mapWidgetRuntimeUpdateEnvelope,
  projectWidgetRuntimeUpdateOutput,
  resolveWidgetRuntimeUpdateParts,
} from "./runtime-update";

function frame(rows: Array<Record<string, unknown>>): TabularFrameSourceV1 {
  return {
    status: "ready",
    columns: ["time", "value"],
    rows,
    source: {
      kind: "test-source",
    },
  };
}

describe("runtime update helpers", () => {
  it("projects delta publications onto the explicit updates output without losing metadata", () => {
    const retained = frame([
      { time: "2026-04-29T00:00:00.000Z", value: 1 },
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
    ]);
    const delta = frame([
      { time: "2026-04-29T00:01:00.000Z", value: 2 },
    ]);
    const published = attachWidgetRuntimeUpdateContext(retained, {
      contractVersion: "widget-runtime-update@v1",
      mode: "delta",
      publicationSemantics: "incremental",
      publicationRole: "update",
      sourceRunId: "http-run-1",
      sequence: 7,
      sourceOutputId: "dataset",
      outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      deltaOutput: delta,
      retainedOutputLocation: "carrier",
    });

    const projected = projectWidgetRuntimeUpdateOutput(published, {
      sourceOutputId: "updates",
      outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    });
    const parts = resolveWidgetRuntimeUpdateParts(projected);

    expect(parts.upstreamBase).toEqual(published);
    expect(parts.upstreamDelta).toEqual(delta);
    expect(parts.upstreamUpdate).toMatchObject({
      publicationSemantics: "incremental",
      publicationRole: "update",
      sourceRunId: "http-run-1",
      sequence: 7,
      sourceOutputId: "updates",
      retainedOutputLocation: "envelope",
    });
    expect(readWidgetRuntimeUpdateContext(parts.upstreamBase)).toMatchObject({
      sourceOutputId: "dataset",
      publicationRole: "update",
    });
  });

  it("maps transformed outputs while preserving incremental publication fields", () => {
    const retained = frame([{ time: "2026-04-29T00:00:00.000Z", value: 1 }]);
    const delta = frame([{ time: "2026-04-29T00:00:00.000Z", value: 3 }]);
    const mapped = mapWidgetRuntimeUpdateEnvelope(
      {
        contractVersion: "widget-runtime-update@v1",
        mode: "delta",
        publicationSemantics: "incremental",
        publicationRole: "seed",
        sourceRunId: "ws-run-2",
        sequence: 3,
        retainedOutputRef: {
          kind: "runtime-data-ref",
          refId: "source:dataset",
          workspaceRuntimeId: "workspace-1",
          ownerId: "source",
          outputId: "dataset",
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          version: 1,
          rowCount: 1,
          schemaSignature: "sig-1",
          updatedAtMs: 123,
        },
        outputRef: {
          kind: "runtime-data-ref",
          refId: "source:dataset",
          workspaceRuntimeId: "workspace-1",
          ownerId: "source",
          outputId: "dataset",
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          version: 1,
          rowCount: 1,
          schemaSignature: "sig-1",
          updatedAtMs: 123,
        },
        diagnostics: {
          original: true,
        },
      },
      {
        mode: "delta",
        outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        upstreamBase: retained,
        upstreamDelta: delta,
        preserveOutputRefs: false,
        diagnostics: {
          transformed: true,
        },
      },
    );

    expect(mapped).toMatchObject({
      publicationSemantics: "incremental",
      publicationRole: "seed",
      sourceRunId: "ws-run-2",
      sequence: 3,
      outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      retainedOutputLocation: "carrier",
      deltaOutput: delta,
      diagnostics: {
        original: true,
        transformed: true,
      },
    });
    expect(mapped.outputRef).toBeUndefined();
    expect(mapped.retainedOutputRef).toBeUndefined();
    expect(mapped.deltaOutputRef).toBeUndefined();
  });
});
