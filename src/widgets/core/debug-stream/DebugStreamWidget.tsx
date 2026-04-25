import { useEffect, useMemo } from "react";

import { Bug, Database, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConnectionQueryResponsePreview } from "@/connections/ConnectionQueryResponsePreview";
import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import { cn } from "@/lib/utils";
import {
  hasTabularTimeSeriesSemantics,
  legacyTimeSeriesFrameToTabularFrameSource,
  normalizeTabularFrameSource,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import {
  normalizeAnyTabularFrameSource,
  useResolvedTabularWidgetSourceBinding,
} from "@/widgets/shared/tabular-widget-source";
import type { WidgetComponentProps } from "@/widgets/types";

import type { DebugStreamWidgetProps } from "./DebugStreamWidgetSettings";

type Props = WidgetComponentProps<DebugStreamWidgetProps>;
type DebugPreviewFrame = TabularFrameSourceV1;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summarizeDebugValue(value: unknown) {
  if (!isPlainRecord(value)) {
    return value === undefined ? { kind: "undefined" } : { kind: typeof value };
  }

  const tabularFrame = normalizeTabularFrameSource(value);

  if (tabularFrame) {
    return {
      kind: "tabular-frame",
      status: tabularFrame.status,
      contract: "core.tabular_frame@v1",
      columnCount: tabularFrame.columns.length,
      rowCount: tabularFrame.rows.length,
      fieldCount: tabularFrame.fields?.length ?? 0,
      hasTimeSeriesHints: hasTabularTimeSeriesSemantics(tabularFrame),
    };
  }

  const normalizedTabular = normalizeAnyTabularFrameSource(value);

  if (normalizedTabular) {
    return {
      kind: "normalized-tabular-frame",
      status: normalizedTabular.status,
      contract: normalizedTabular.source?.context?.sourceContract ?? "core.tabular_frame@v1",
      columnCount: normalizedTabular.columns.length,
      rowCount: normalizedTabular.rows.length,
      fieldCount: normalizedTabular.fields?.length ?? 0,
      hasTimeSeriesHints: hasTabularTimeSeriesSemantics(normalizedTabular),
    };
  }

  return {
    kind: "record",
    keys: Object.keys(value).slice(0, 12),
    status: typeof value.status === "string" ? value.status : undefined,
  };
}

function cropDebugJson(value: string, maxLines = 120) {
  const lines = value.split(/\r?\n/);

  if (lines.length <= maxLines) {
    return value;
  }

  return `${lines.slice(0, maxLines).join("\n")}\n… (${lines.length - maxLines} more lines hidden)`;
}

function formatDebugJson(value: unknown) {
  try {
    return cropDebugJson(JSON.stringify(value, null, 2));
  } catch {
    return String(value);
  }
}

function resolvePreviewFrame(candidates: unknown[]): DebugPreviewFrame | null {
  for (const candidate of candidates) {
    const tabularFrame =
      normalizeTabularFrameSource(candidate) ??
      legacyTimeSeriesFrameToTabularFrameSource(candidate);

    if (tabularFrame) {
      return tabularFrame;
    }
  }

  return null;
}

function DebugSummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2", className)}>
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 break-all text-sm text-foreground">{value}</div>
    </div>
  );
}

export function DebugStreamWidget({
  instanceId,
  instanceTitle,
  props,
}: Props) {
  const sourceBinding = useResolvedTabularWidgetSourceBinding({
    props,
    currentWidgetInstanceId: instanceId,
  });

  useResolveWidgetUpstream(instanceId, {
    enabled: sourceBinding.requiresUpstreamResolution,
  });

  const previewFrame = useMemo(
    () =>
      resolvePreviewFrame([
        sourceBinding.resolvedSourceInput?.value,
        sourceBinding.resolvedSourceWidget?.runtimeState,
        sourceBinding.resolvedSourceDataset,
      ]),
    [
      sourceBinding.resolvedSourceDataset,
      sourceBinding.resolvedSourceInput?.value,
      sourceBinding.resolvedSourceWidget?.runtimeState,
    ],
  );

  const debugSnapshot = useMemo(
    () => ({
      widgetId: "debug_stream",
      instanceId,
      title: instanceTitle,
      sourceWidgetId: sourceBinding.resolvedSourceInput?.sourceWidgetId,
      sourceOutputId: sourceBinding.resolvedSourceInput?.sourceOutputId,
      inputStatus: sourceBinding.resolvedSourceInput?.status ?? "unbound",
      inputContractId: sourceBinding.resolvedSourceInput?.contractId,
      hasResolvedFilterWidgetSource: sourceBinding.hasResolvedFilterWidgetSource,
      requiresUpstreamResolution: sourceBinding.requiresUpstreamResolution,
      isAwaitingBoundSourceValue: sourceBinding.isAwaitingBoundSourceValue,
      sourceWidget: sourceBinding.resolvedSourceWidget
        ? {
            id: sourceBinding.resolvedSourceWidget.id,
            widgetId: sourceBinding.resolvedSourceWidget.widgetId,
            title: sourceBinding.resolvedSourceWidget.title,
          }
        : null,
      inputValue: summarizeDebugValue(sourceBinding.resolvedSourceInput?.value),
      sourceRuntimeState: summarizeDebugValue(sourceBinding.resolvedSourceWidget?.runtimeState),
      resolvedSourceDataset: summarizeDebugValue(sourceBinding.resolvedSourceDataset),
      previewFrame: summarizeDebugValue(previewFrame),
    }),
    [
      instanceId,
      instanceTitle,
      previewFrame,
      sourceBinding.hasResolvedFilterWidgetSource,
      sourceBinding.isAwaitingBoundSourceValue,
      sourceBinding.requiresUpstreamResolution,
      sourceBinding.resolvedSourceDataset,
      sourceBinding.resolvedSourceInput?.contractId,
      sourceBinding.resolvedSourceInput?.sourceOutputId,
      sourceBinding.resolvedSourceInput?.sourceWidgetId,
      sourceBinding.resolvedSourceInput?.status,
      sourceBinding.resolvedSourceInput?.value,
      sourceBinding.resolvedSourceWidget,
    ],
  );
  const debugSnapshotJson = useMemo(
    () => JSON.stringify(debugSnapshot),
    [debugSnapshot],
  );

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.debug("[debug-stream] snapshot", JSON.parse(debugSnapshotJson));
  }, [debugSnapshotJson]);

  if (!sourceBinding.hasCanonicalSourceBinding) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Bind a source</div>
          <p className="text-sm text-muted-foreground">
            Open the Bindings tab and connect <code>sourceData</code> to a tabular widget output.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">debug_stream</Badge>
        <Badge variant="neutral">{debugSnapshot.inputStatus}</Badge>
        {debugSnapshot.inputContractId ? (
          <Badge variant="neutral">{debugSnapshot.inputContractId}</Badge>
        ) : null}
        {sourceBinding.requiresUpstreamResolution ? (
          <Badge variant="warning">resolving upstream</Badge>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DebugSummaryCard
          label="Source widget"
          value={sourceBinding.resolvedSourceWidget?.title ?? sourceBinding.resolvedSourceInput?.sourceWidgetId ?? "Unknown source"}
        />
        <DebugSummaryCard
          label="Source output"
          value={sourceBinding.resolvedSourceInput?.sourceOutputId ?? "Unknown output"}
        />
        <DebugSummaryCard
          label="Preview kind"
          value={previewFrame ? (hasTabularTimeSeriesSemantics(previewFrame) ? "time-series" : "tabular") : "none"}
        />
        <DebugSummaryCard
          label="Resolved dataset"
          value={sourceBinding.resolvedSourceDataset
            ? `${sourceBinding.resolvedSourceDataset.rows.length.toLocaleString()} rows / ${sourceBinding.resolvedSourceDataset.columns.length.toLocaleString()} columns`
            : "No resolved dataset"}
        />
      </div>

      {sourceBinding.isAwaitingBoundSourceValue ? (
        <div className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Resolving upstream source. The binding is valid but this consumer still cannot see the published frame.
        </div>
      ) : null}

      {previewFrame ? (
        <ConnectionQueryResponsePreview
          title={instanceTitle || "Debug Stream"}
          description="Explorer-style preview of the currently resolved consumer input."
          frame={previewFrame}
          showRaw={false}
        />
      ) : (
        <div className="flex min-h-[220px] items-center justify-center rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 text-sm text-muted-foreground">
          No preview frame is currently visible to this consumer.
        </div>
      )}

      <details className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground">
          <Bug className="h-4 w-4 text-primary" />
          Consumer snapshot
        </summary>
        <pre className="max-h-[360px] overflow-auto border-t border-border/70 p-4 text-xs text-muted-foreground">
          {formatDebugJson(debugSnapshot)}
        </pre>
      </details>

      <div className="grid gap-3 xl:grid-cols-2">
        <details className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
            Resolved input value
          </summary>
          <pre className="max-h-[280px] overflow-auto border-t border-border/70 p-4 text-xs text-muted-foreground">
            {formatDebugJson(summarizeDebugValue(sourceBinding.resolvedSourceInput?.value))}
          </pre>
        </details>

        <details className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
            Source widget runtime state
          </summary>
          <pre className="max-h-[280px] overflow-auto border-t border-border/70 p-4 text-xs text-muted-foreground">
            {formatDebugJson(summarizeDebugValue(sourceBinding.resolvedSourceWidget?.runtimeState))}
          </pre>
        </details>
      </div>
    </div>
  );
}
