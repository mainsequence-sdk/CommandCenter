import type { ResolvedWidgetInputs } from "@/widgets/types";
import { resolveIncrementalTabularOutputFrame } from "@/widgets/shared/incremental-tabular-consumer";
import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
import { getRuntimeDataRef } from "@/widgets/shared/runtime-data-store";

import {
  buildTabularSourceDescriptor,
  normalizeAnyTabularFrameSource,
  TABULAR_SOURCE_CONTRACT,
} from "@/widgets/shared/tabular-widget-source";
import {
  TABULAR_SOURCE_INPUT_ID,
  TABULAR_SOURCE_OUTPUT_ID,
} from "@/widgets/shared/tabular-widget-source";

export const statisticDemoResolvedInputs: ResolvedWidgetInputs = {
  [TABULAR_SOURCE_INPUT_ID]: {
    inputId: TABULAR_SOURCE_INPUT_ID,
    label: "Source data",
    status: "valid",
    sourceWidgetId: "__demo_connection_query__",
    sourceOutputId: TABULAR_SOURCE_OUTPUT_ID,
    contractId: TABULAR_SOURCE_CONTRACT,
    value: {
      status: "ready",
      columns: ["curve", "updated_at", "yield", "change_bp"],
      fields: [
        {
          key: "curve",
          label: "Curve",
          type: "string",
          nullable: false,
          provenance: "manual",
        },
        {
          key: "updated_at",
          label: "Updated at",
          type: "datetime",
          nullable: false,
          provenance: "manual",
        },
        {
          key: "yield",
          label: "Yield",
          type: "number",
          nullable: false,
          nativeType: "numeric",
          provenance: "manual",
        },
        {
          key: "change_bp",
          label: "Change (bp)",
          type: "number",
          nullable: false,
          nativeType: "numeric",
          provenance: "manual",
        },
      ],
      rows: [
        {
          curve: "UST 10Y",
          updated_at: "2026-04-24T13:00:00.000Z",
          yield: 4.18,
          change_bp: -2.4,
        },
        {
          curve: "UST 10Y",
          updated_at: "2026-04-24T16:00:00.000Z",
          yield: 4.23,
          change_bp: 5.0,
        },
        {
          curve: "Bund 10Y",
          updated_at: "2026-04-24T13:00:00.000Z",
          yield: 2.44,
          change_bp: -1.8,
        },
        {
          curve: "Bund 10Y",
          updated_at: "2026-04-24T16:00:00.000Z",
          yield: 2.49,
          change_bp: 5.0,
        },
        {
          curve: "Gilt 10Y",
          updated_at: "2026-04-24T13:00:00.000Z",
          yield: 4.08,
          change_bp: -1.2,
        },
        {
          curve: "Gilt 10Y",
          updated_at: "2026-04-24T16:00:00.000Z",
          yield: 4.03,
          change_bp: -5.0,
        },
      ],
      source: buildTabularSourceDescriptor({
        sourceId: 1084,
        sourceLabel: "Global sovereign yields",
        dateRangeMode: "dashboard",
        updatedAtMs: Date.parse("2026-04-24T16:00:00.000Z"),
      }),
      updatedAtMs: Date.parse("2026-04-24T16:00:00.000Z"),
    },
  },
};

export function resolveStatisticSourceDataset(
  resolvedInputs: ResolvedWidgetInputs | undefined,
) {
  const resolvedEntry = resolvedInputs?.[TABULAR_SOURCE_INPUT_ID];
  const candidate = Array.isArray(resolvedEntry)
    ? resolvedEntry.find((entry) => entry.status === "valid")
    : resolvedEntry;

  return candidate?.status === "valid"
    ? normalizeAnyTabularFrameSource(candidate.upstreamBase ?? candidate.value)
    : null;
}

export function resolveStatisticSettingsDataset(
  resolvedInputs: ResolvedWidgetInputs | undefined,
) {
  const incrementalDataset = resolveIncrementalTabularOutputFrame({
    resolvedInputs,
    liveMergeKeyFields: [],
  });

  return incrementalDataset ?? resolveStatisticSourceDataset(resolvedInputs);
}

export function resolveStatisticLinkedDataset(input: {
  previewDataset: TabularFrameSourceV1 | null;
  incrementalActive: boolean;
  incrementalDataset: TabularFrameSourceV1 | null;
  incrementalConsumerDataset: TabularFrameSourceV1 | null;
  sourceDataset: TabularFrameSourceV1 | null;
  sourceConsumerDataset: TabularFrameSourceV1 | null;
}) {
  const previewDataset = input.previewDataset;
  const previewIsEmptyRefShell =
    previewDataset != null &&
    previewDataset.rows.length === 0 &&
    Boolean(getRuntimeDataRef(previewDataset));

  if (input.incrementalActive) {
    return (
      input.incrementalDataset ??
      input.incrementalConsumerDataset ??
      (previewIsEmptyRefShell ? null : previewDataset) ??
      null
    );
  }

  if (previewDataset && !previewIsEmptyRefShell) {
    return previewDataset;
  }

  return input.sourceDataset ?? input.sourceConsumerDataset ?? previewDataset ?? null;
}
