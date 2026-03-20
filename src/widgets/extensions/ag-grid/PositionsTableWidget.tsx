import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { AllCommunityModule, type ColDef } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";

import { fetchPositions, type PositionRow } from "@/data/api";
import { formatCurrency, formatNumber, formatSignedCurrency } from "@/lib/format";
import { getThemeTightnessMetrics } from "@/themes/tightness";
import { useTheme } from "@/themes/ThemeProvider";
import { createAgGridTerminalTheme } from "@/widgets/extensions/ag-grid/grid-theme";
import type { WidgetComponentProps } from "@/widgets/types";

type Props = WidgetComponentProps<Record<string, unknown>>;

const agGridModules = [AllCommunityModule];

export function PositionsTableWidget({}: Props) {
  const { resolvedTokens, tightness } = useTheme();
  const tightnessMetrics = useMemo(
    () => getThemeTightnessMetrics(tightness),
    [tightness],
  );
  const query = useQuery({
    queryKey: ["positions"],
    queryFn: fetchPositions,
  });
  const theme = useMemo(
    () => createAgGridTerminalTheme(resolvedTokens, tightnessMetrics.table),
    [resolvedTokens, tightnessMetrics],
  );

  const columnDefs = useMemo<ColDef<PositionRow>[]>(
    () => [
      { field: "symbol", headerName: "Symbol", minWidth: 110 },
      {
        field: "side",
        headerName: "Side",
        minWidth: 90,
        cellClass: (params) =>
          params.value === "Long" ? "cell-positive" : "cell-negative",
      },
      {
        field: "quantity",
        headerName: "Qty",
        minWidth: 110,
        valueFormatter: (params) => formatNumber(params.value ?? 0),
      },
      {
        field: "avgPrice",
        headerName: "Avg",
        minWidth: 110,
        valueFormatter: (params) => formatCurrency(params.value ?? 0),
      },
      {
        field: "lastPrice",
        headerName: "Last",
        minWidth: 110,
        valueFormatter: (params) => formatCurrency(params.value ?? 0),
      },
      {
        field: "pnl",
        headerName: "PnL",
        minWidth: 130,
        cellClass: (params) =>
          (params.value ?? 0) >= 0 ? "cell-positive" : "cell-negative",
        valueFormatter: (params) => formatSignedCurrency(params.value ?? 0),
      },
      {
        field: "exposure",
        headerName: "Exposure",
        minWidth: 140,
        valueFormatter: (params) => formatCurrency(params.value ?? 0, true),
      },
      { field: "account", headerName: "Acct", minWidth: 100 },
      { field: "strategy", headerName: "Strategy", minWidth: 150, flex: 1.2 },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<PositionRow>>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
      flex: 1,
    }),
    [],
  );

  return (
    <AgGridProvider modules={agGridModules}>
      <div className="h-full min-h-[280px] overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/70 text-foreground">
        <AgGridReact<PositionRow>
          theme={theme}
          rowData={query.data ?? []}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          animateRows
          pagination={false}
          suppressMovableColumns
          rowHeight={tightnessMetrics.table.agGridRowHeight}
          headerHeight={tightnessMetrics.table.agGridHeaderHeight}
        />
      </div>
    </AgGridProvider>
  );
}
