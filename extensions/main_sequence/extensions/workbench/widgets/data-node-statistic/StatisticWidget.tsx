import { useMemo } from "react";

import { Calculator, Database, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import type { WidgetComponentProps } from "@/widgets/types";

import { StatisticCardGrid } from "./StatisticCardGrid";
import {
  buildDataNodeStatisticCards,
  buildDataNodeStatisticFieldOptions,
  resolveDataNodeStatisticConfig,
  type MainSequenceDataNodeStatisticWidgetProps,
} from "./statisticModel";
import { useResolvedDataNodeWidgetSourceBinding } from "../data-node-shared/dataNodeWidgetSource";

type Props = WidgetComponentProps<MainSequenceDataNodeStatisticWidgetProps>;

export function StatisticWidget({ props, instanceId }: Props) {
  const sourceBinding = useResolvedDataNodeWidgetSourceBinding({
    props,
    currentWidgetInstanceId: instanceId,
  });
  useResolveWidgetUpstream(instanceId, {
    enabled: sourceBinding.requiresUpstreamResolution,
  });
  const linkedDataset = sourceBinding.resolvedSourceDataset;
  const availableFields = useMemo(
    () =>
      buildDataNodeStatisticFieldOptions({
        columns: linkedDataset?.columns,
        fields: linkedDataset?.fields,
        rows: linkedDataset?.rows,
      }),
    [linkedDataset?.columns, linkedDataset?.fields, linkedDataset?.rows],
  );
  const resolvedConfig = useMemo(
    () => resolveDataNodeStatisticConfig(props, availableFields),
    [availableFields, props],
  );
  const statisticResult = useMemo(
    () => buildDataNodeStatisticCards(linkedDataset?.rows ?? [], resolvedConfig),
    [linkedDataset?.rows, resolvedConfig],
  );
  const sourceLabel = sourceBinding.resolvedSourceWidget?.title?.trim() || undefined;

  if (!sourceBinding.hasResolvedFilterWidgetSource) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Select a Data Node source</div>
          <p className="text-sm text-muted-foreground">
            Open widget settings and use the Bindings tab to connect this statistic to a Data Node.
          </p>
        </div>
      </div>
    );
  }

  if (linkedDataset?.status === "loading" || linkedDataset == null) {
    return <Skeleton className="h-full rounded-[calc(var(--radius)-6px)]" />;
  }

  if (linkedDataset.status === "error") {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {linkedDataset.error ?? "The linked Data Node failed to load rows."}
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
            The linked Data Node did not publish any rows for the current selection.
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
            Choose the field this statistic should reduce from the linked Data Node dataset.
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
            The selected statistic needs a numeric value field in the incoming Data Node dataset.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col justify-center">
      <StatisticCardGrid
        cards={statisticResult.cards}
        fillHeight
        showSourceLabel={resolvedConfig.showSourceLabel}
        sourceLabel={sourceLabel}
      />
    </div>
  );
}
