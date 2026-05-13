import { useMemo } from "react";

import { Calculator, Database, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import type { WidgetComponentProps } from "@/widgets/types";
import { useIncrementalTabularConsumerBindingState } from "@/widgets/shared/incremental-tabular-consumer";

import { StatisticCardGrid } from "./StatisticCardGrid";
import {
  buildStatisticCards,
  buildStatisticFieldOptions,
  resolveStatisticConfig,
  type StatisticWidgetProps,
} from "./statisticModel";
import {
  resolveStatisticLinkedDataset,
  resolveStatisticSettingsDataset,
} from "./statisticPreview";
import { useResolvedTabularWidgetSourceBinding } from "@/widgets/shared/tabular-widget-source";

type Props = WidgetComponentProps<StatisticWidgetProps>;

const STATISTIC_RUNTIME_ROW_WINDOW_MAX_ROWS = 250_000;
const STATISTIC_LIVE_UPDATE_MERGE_KEY_FIELDS: string[] = [];

export function StatisticWidget({
  props,
  instanceId,
  resolvedInputs,
  runtimeState,
  onRuntimeStateChange,
}: Props) {
  const previewDataset = useMemo(
    () => resolveStatisticSettingsDataset(resolvedInputs),
    [resolvedInputs],
  );
  const sourceBinding = useResolvedTabularWidgetSourceBinding({
    props,
    currentWidgetInstanceId: instanceId,
    resolvedInputs,
  });
  const runtimeRetention = useMemo(
    () => ({ maxRows: STATISTIC_RUNTIME_ROW_WINDOW_MAX_ROWS }),
    [],
  );
  const incrementalBinding = useIncrementalTabularConsumerBindingState({
    instanceId,
    liveMergeKeyFields: STATISTIC_LIVE_UPDATE_MERGE_KEY_FIELDS,
    onRuntimeStateChange,
    resolvedInputs,
    runtimeRetention,
    runtimeState,
  });
  const sourceConsumerState = incrementalBinding.active
    ? incrementalBinding.consumerState
    : sourceBinding.consumerState;
  useResolveWidgetUpstream(instanceId, {
    enabled:
      previewDataset == null &&
      (incrementalBinding.active
        ? incrementalBinding.requiresUpstreamResolution
        : sourceBinding.requiresUpstreamResolution),
  });
  const linkedDataset = useMemo(
    () =>
      resolveStatisticLinkedDataset({
        previewDataset,
        incrementalActive: incrementalBinding.active,
        incrementalDataset: incrementalBinding.dataset,
        incrementalConsumerDataset: incrementalBinding.consumerState.dataset,
        sourceDataset: sourceBinding.resolvedSourceDataset,
        sourceConsumerDataset: sourceBinding.consumerState.dataset,
      }),
    [
      incrementalBinding.active,
      incrementalBinding.consumerState.dataset,
      incrementalBinding.dataset,
      previewDataset,
      sourceBinding.consumerState.dataset,
      sourceBinding.resolvedSourceDataset,
    ],
  );
  const availableFields = useMemo(
    () =>
      buildStatisticFieldOptions({
        columns: linkedDataset?.columns,
        fields: linkedDataset?.fields,
        rows: linkedDataset?.rows,
      }),
    [linkedDataset?.columns, linkedDataset?.fields, linkedDataset?.rows],
  );
  const resolvedConfig = useMemo(
    () => resolveStatisticConfig(props, availableFields),
    [availableFields, props],
  );
  const statisticResult = useMemo(
    () => buildStatisticCards(linkedDataset?.rows ?? [], resolvedConfig),
    [linkedDataset?.rows, resolvedConfig],
  );
  const resolvedColumnCount = Math.max(
    1,
    Math.min(
      statisticResult.cards.length,
      resolvedConfig.columnCount ?? Math.min(statisticResult.cards.length, 4),
    ),
  );
  const rowCount =
    statisticResult.cards.length === 0
      ? 0
      : Math.ceil(statisticResult.cards.length / resolvedColumnCount);
  const shouldFillHeight = rowCount <= 1;
  const sourceLabel =
    previewDataset?.source?.label?.trim() ||
    sourceBinding.resolvedSourceWidget?.title?.trim() ||
    undefined;

  if (linkedDataset == null && sourceConsumerState.kind === "unbound") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Select a tabular source</div>
          <p className="text-sm text-muted-foreground">
            Open widget settings and use the Bindings tab to connect this statistic to a tabular source.
          </p>
        </div>
      </div>
    );
  }

  if (linkedDataset == null && sourceConsumerState.kind === "missing-source") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Bound source is missing</div>
          <p className="text-sm text-muted-foreground">
            Rebind this statistic because the saved source widget no longer exists in this workspace.
          </p>
        </div>
      </div>
    );
  }

  if (linkedDataset == null && sourceConsumerState.kind === "missing-output") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Bound output is missing</div>
          <p className="text-sm text-muted-foreground">
            The selected source widget no longer publishes the output this statistic is bound to.
          </p>
        </div>
      </div>
    );
  }

  if (linkedDataset == null && sourceConsumerState.kind === "contract-mismatch") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Incompatible bound dataset</div>
          <p className="text-sm text-muted-foreground">
            Bind this statistic to a widget output that publishes one canonical tabular frame.
          </p>
        </div>
      </div>
    );
  }

  if (
    linkedDataset == null &&
    (sourceConsumerState.kind === "self-reference-blocked" ||
      sourceConsumerState.kind === "transform-invalid")
  ) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Source binding is invalid</div>
          <p className="text-sm text-muted-foreground">
            Fix the statistic binding before this widget can resolve the published dataset.
          </p>
        </div>
      </div>
    );
  }

  if (linkedDataset == null && sourceConsumerState.kind === "awaiting-upstream") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Resolving upstream source</div>
          <p className="text-sm text-muted-foreground">
            Refreshing the bound source widget so this statistic can read its dataset.
          </p>
        </div>
      </div>
    );
  }

  if (linkedDataset == null && sourceConsumerState.kind === "error") {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {sourceConsumerState.error ?? "The bound source failed to load rows."}
      </div>
    );
  }

  if (
    linkedDataset?.status === "loading" ||
    linkedDataset == null
  ) {
    return <Skeleton className="h-full rounded-[calc(var(--radius)-6px)]" />;
  }

  if (linkedDataset.status === "error") {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {linkedDataset.error ?? "The bound source failed to load rows."}
      </div>
    );
  }

  if (linkedDataset.rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Loader2 className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">No rows available</div>
          <p className="text-sm text-muted-foreground">
            The bound source did not publish any rows for the current selection.
          </p>
        </div>
      </div>
    );
  }

  if (statisticResult.issue === "missing_value_field") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Select a value field</div>
          <p className="text-sm text-muted-foreground">
            Choose the field this statistic should reduce from the bound source dataset.
          </p>
        </div>
      </div>
    );
  }

  if (statisticResult.issue === "non_numeric_value_field") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Numeric field required</div>
          <p className="text-sm text-muted-foreground">
            The selected statistic needs a numeric value field in the incoming tabular dataset.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto">
      <StatisticCardGrid
        cards={statisticResult.cards}
        columnCount={resolvedConfig.columnCount}
        fillHeight={shouldFillHeight}
        showSourceLabel={resolvedConfig.showSourceLabel}
        sourceLabel={sourceLabel}
      />
    </div>
  );
}
