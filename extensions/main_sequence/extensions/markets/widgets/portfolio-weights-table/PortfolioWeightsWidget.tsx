import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  fetchTargetPortfolioWeightsPositionDetails,
  formatMainSequenceError,
} from "../../../../common/api";
import {
  formatPortfolioWeightAggregateValue,
  getPortfolioWeightPositionRowNumericValue,
  getPortfolioWeightPositionRowType,
  normalizePortfolioWeightSummaryRows,
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

function normalizeSummaryPositionType(types: Set<string>) {
  if (types.size !== 1) {
    return null;
  }

  return Array.from(types)[0] ?? null;
}

function PortfolioWeightsSummaryStrip({
  rows,
}: {
  rows: Array<Record<string, unknown>>;
}) {
  const summary = useMemo(() => {
    let longSum = 0;
    let shortSum = 0;
    let totalSum = 0;
    const longTypes = new Set<string>();
    const shortTypes = new Set<string>();
    const totalTypes = new Set<string>();

    for (const row of rows) {
      const numericValue = getPortfolioWeightPositionRowNumericValue(row);

      if (numericValue === null) {
        continue;
      }

      const positionType = getPortfolioWeightPositionRowType(row);
      totalSum += numericValue;
      if (positionType !== "Not available") {
        totalTypes.add(positionType);
      }

      if (numericValue > 0) {
        longSum += numericValue;
        if (positionType !== "Not available") {
          longTypes.add(positionType);
        }
      } else if (numericValue < 0) {
        shortSum += numericValue;
        if (positionType !== "Not available") {
          shortTypes.add(positionType);
        }
      }
    }

    return {
      longSum,
      shortSum,
      totalSum,
      longType: normalizeSummaryPositionType(longTypes),
      shortType: normalizeSummaryPositionType(shortTypes),
      totalType: normalizeSummaryPositionType(totalTypes),
    };
  }, [rows]);

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {[
        {
          key: "longs",
          label: "Longs",
          value: formatPortfolioWeightAggregateValue(summary.longSum, summary.longType),
          tone:
            summary.longSum > 0
              ? "text-emerald-300 border-emerald-500/20 bg-emerald-500/8"
              : "text-muted-foreground border-border/60 bg-background/40",
        },
        {
          key: "shorts",
          label: "Shorts",
          value: formatPortfolioWeightAggregateValue(summary.shortSum, summary.shortType),
          tone:
            summary.shortSum < 0
              ? "text-rose-300 border-rose-500/20 bg-rose-500/8"
              : "text-muted-foreground border-border/60 bg-background/40",
        },
        {
          key: "total",
          label: "Total",
          value: formatPortfolioWeightAggregateValue(summary.totalSum, summary.totalType),
          tone: "text-foreground border-border/60 bg-background/40",
        },
      ].map((item) => (
        <div
          key={item.key}
          className={`min-w-[112px] rounded-[calc(var(--radius)-8px)] border px-3 py-2 ${item.tone}`}
        >
          <div className="text-[10px] uppercase tracking-[0.16em]">{item.label}</div>
          <div className="mt-1 text-sm font-medium">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

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
      {variant === "positions" && rows.length > 0 ? <PortfolioWeightsSummaryStrip rows={rows} /> : null}
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
