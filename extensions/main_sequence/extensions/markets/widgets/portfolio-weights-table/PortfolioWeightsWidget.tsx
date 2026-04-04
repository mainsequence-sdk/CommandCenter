import { Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useWidgetExecutionState } from "@/dashboards/DashboardWidgetExecution";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  formatMainSequenceError,
} from "../../../../common/api";
import {
  normalizePortfolioWeightSummaryRows,
  PortfolioWeightsPositionSummaryStrip,
  PortfolioWeightsTable,
  type PortfolioWeightsTableVariant,
} from "./PortfolioWeightsTable";
import {
  normalizePortfolioWeightsRuntimeState,
  normalizePortfolioWeightsTargetId,
  normalizePortfolioWeightsVariant,
  type PortfolioWeightsWidgetProps,
} from "./portfolioWeightsRuntime";

type Props = WidgetComponentProps<PortfolioWeightsWidgetProps>;

export function PortfolioWeightsWidget({ instanceId, props, runtimeState }: Props) {
  const executionState = useWidgetExecutionState(instanceId);
  const targetPortfolioId = normalizePortfolioWeightsTargetId(props);
  const variant: PortfolioWeightsTableVariant = normalizePortfolioWeightsVariant(props.variant);
  const tableMinWidth =
    typeof props.tableMinWidth === "number" ? props.tableMinWidth : variant === "summary" ? 680 : 760;
  const normalizedRuntimeState = normalizePortfolioWeightsRuntimeState(runtimeState);
  const payload = normalizedRuntimeState.payload;
  const isLoading =
    executionState?.status === "running" ||
    normalizedRuntimeState.status === "loading" ||
    (!payload && targetPortfolioId > 0 && normalizedRuntimeState.status !== "error");

  if (!Number.isFinite(targetPortfolioId) || targetPortfolioId <= 0) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          Set a valid target portfolio id to render this widget.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-3 h-4 w-4 animate-spin" />
          Loading portfolio weights
        </CardContent>
      </Card>
    );
  }

  if (normalizedRuntimeState.status === "error") {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(normalizedRuntimeState.error)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows =
    variant === "summary"
      ? normalizePortfolioWeightSummaryRows(payload?.weights ?? null)
      : payload?.rows ?? [];
  const columnDefs =
    variant === "summary"
      ? payload?.summaryColumnDefs ?? []
      : payload?.columnDefs ?? [];

  return (
    <div className="space-y-0">
      {variant === "positions" && rows.length > 0 ? (
        <PortfolioWeightsPositionSummaryStrip rows={rows} />
      ) : null}
      <PortfolioWeightsTable
        columnDefs={columnDefs}
        rows={rows}
        expandableAssetRows={variant === "summary"}
        positionMap={payload?.position_map ?? null}
        preferredPositionColumns={variant === "positions"}
        emptyMessage={
          variant === "summary"
            ? "No summary weight rows were returned."
            : "No position rows were returned."
        }
        emptyTitle={variant === "summary" ? "No summary rows" : "No position rows"}
        tableMinWidth={tableMinWidth}
      />
    </div>
  );
}
