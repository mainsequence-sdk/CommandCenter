import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  fetchTargetPortfolioWeightsPositionDetails,
  formatMainSequenceError,
} from "../../../../common/api";
import {
  normalizePortfolioWeightSummaryRows,
  PortfolioWeightsPositionSummaryStrip,
  PortfolioWeightsTable,
  type PortfolioWeightsTableVariant,
} from "./PortfolioWeightsTable";

export interface PortfolioWeightsWidgetProps extends Record<string, unknown> {
  portfolioId?: number;
  targetPortfolioId?: number;
  variant?: PortfolioWeightsTableVariant;
  tableMinWidth?: number;
}

type Props = WidgetComponentProps<PortfolioWeightsWidgetProps>;

export function PortfolioWeightsWidget({ props }: Props) {
  const targetPortfolioId = Number(props.portfolioId ?? props.targetPortfolioId ?? "");
  const variant: PortfolioWeightsTableVariant = props.variant === "summary" ? "summary" : "positions";
  const tableMinWidth =
    typeof props.tableMinWidth === "number" ? props.tableMinWidth : variant === "summary" ? 680 : 760;

  const weightsDetailsQuery = useQuery({
    queryKey: ["main_sequence", "widgets", "portfolio_weights", targetPortfolioId, variant],
    queryFn: () => fetchTargetPortfolioWeightsPositionDetails(targetPortfolioId),
    enabled: Number.isFinite(targetPortfolioId) && targetPortfolioId > 0,
  });

  if (!Number.isFinite(targetPortfolioId) || targetPortfolioId <= 0) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          Set a valid target portfolio id to render this widget.
        </CardContent>
      </Card>
    );
  }

  if (weightsDetailsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-3 h-4 w-4 animate-spin" />
          Loading portfolio weights
        </CardContent>
      </Card>
    );
  }

  if (weightsDetailsQuery.isError) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(weightsDetailsQuery.error)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows =
    variant === "summary"
      ? normalizePortfolioWeightSummaryRows(weightsDetailsQuery.data?.weights ?? null)
      : weightsDetailsQuery.data?.rows ?? [];
  const columnDefs =
    variant === "summary"
      ? weightsDetailsQuery.data?.summaryColumnDefs ?? []
      : weightsDetailsQuery.data?.columnDefs ?? [];

  return (
    <div className="space-y-0">
      {variant === "positions" && rows.length > 0 ? (
        <PortfolioWeightsPositionSummaryStrip rows={rows} />
      ) : null}
      <PortfolioWeightsTable
        columnDefs={columnDefs}
        rows={rows}
        expandableAssetRows={variant === "summary"}
        positionMap={weightsDetailsQuery.data?.position_map ?? null}
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
