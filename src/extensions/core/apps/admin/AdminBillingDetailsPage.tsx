import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  getBillingSummary,
  listBillingUsage,
  type BillingUsageColumnDef,
  type BillingUsageRow,
} from "./api";
import { AdminSurfaceLayout } from "./shared";
import { MainSequenceEntitySummaryCard } from "../../../../../extensions/main_sequence/common/components/MainSequenceEntitySummaryCard";

type BillingRangePreset = "current" | "month" | "previous-month" | "current-year";

const billingRangePresets: Array<{ id: BillingRangePreset; label: string }> = [
  { id: "current", label: "Current" },
  { id: "month", label: "Month" },
  { id: "previous-month", label: "Previous Month" },
  { id: "current-year", label: "Current Year" },
];

function formatAdminError(error: unknown) {
  return error instanceof Error ? error.message : "The billing usage request failed.";
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function toDatetimeLocalValue(date: Date) {
  return [
    date.getFullYear(),
    "-",
    padDatePart(date.getMonth() + 1),
    "-",
    padDatePart(date.getDate()),
    "T",
    padDatePart(date.getHours()),
    ":",
    padDatePart(date.getMinutes()),
  ].join("");
}

function getPresetRange(preset: BillingRangePreset) {
  const now = new Date();

  if (preset === "current") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
      end: now,
    };
  }

  if (preset === "month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      end: now,
    };
  }

  if (preset === "previous-month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 0, 0),
    };
  }

  return {
    start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
    end: now,
  };
}

function normalizeRangeForQuery(startDate: string, endDate: string) {
  return {
    startDate: startDate.trim(),
    endDate: endDate.trim(),
  };
}

function formatUsageEndTime(value: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUsageCost(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return value || "—";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatUsageCell(
  row: BillingUsageRow,
  column: BillingUsageColumnDef,
) {
  const rawValue = row[column.field as keyof BillingUsageRow];

  if (column.field === "usage_end_time") {
    return formatUsageEndTime(String(rawValue ?? ""));
  }

  if (column.field === "total_cost" || column.valueFormatter === "currencyCellFormatter") {
    return formatUsageCost(String(rawValue ?? ""));
  }

  if (column.field === "source_type") {
    return String(rawValue ?? "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  if (column.field === "is_estimate_state") {
    return (
      <Badge variant={rawValue ? "warning" : "success"}>
        {rawValue ? "Estimated" : "Final"}
      </Badge>
    );
  }

  return String(rawValue ?? "—");
}

function getCompactCellClassName(edge: "left" | "middle" | "right" = "middle") {
  return [
    "border border-border/70 bg-background/38 px-3 py-2 align-top text-xs",
    edge === "left" ? "rounded-l-[calc(var(--radius)-6px)]" : "",
    edge === "right" ? "rounded-r-[calc(var(--radius)-6px)]" : "",
    edge !== "right" ? "border-r-0" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function AdminBillingDetailsPage() {
  const initialRange = useMemo(() => getPresetRange("month"), []);
  const [startDateInput, setStartDateInput] = useState(toDatetimeLocalValue(initialRange.start));
  const [endDateInput, setEndDateInput] = useState(toDatetimeLocalValue(initialRange.end));
  const [appliedRange, setAppliedRange] = useState(() =>
    normalizeRangeForQuery(
      toDatetimeLocalValue(initialRange.start),
      toDatetimeLocalValue(initialRange.end),
    ),
  );
  const [activePreset, setActivePreset] = useState<BillingRangePreset | null>("month");

  const rangeError = useMemo(() => {
    if (!startDateInput || !endDateInput) {
      return "Start and end dates are required.";
    }

    if (endDateInput < startDateInput) {
      return "End date must be after start date.";
    }

    return "";
  }, [endDateInput, startDateInput]);

  const billingUsageQuery = useQuery({
    queryKey: ["admin", "billing", "usage", appliedRange.startDate, appliedRange.endDate],
    queryFn: () =>
      listBillingUsage({
        startDate: appliedRange.startDate,
        endDate: appliedRange.endDate,
      }),
    retry: false,
  });
  const billingSummaryQuery = useQuery({
    queryKey: ["admin", "billing", "summary"],
    queryFn: () => getBillingSummary(),
    retry: false,
    staleTime: 60_000,
  });

  const usageRows = billingUsageQuery.data?.rows ?? [];
  const usageColumns = billingUsageQuery.data?.columnDefs ?? [];

  function applyRange(startDate: string, endDate: string, preset: BillingRangePreset | null = null) {
    const normalizedRange = normalizeRangeForQuery(startDate, endDate);

    setStartDateInput(normalizedRange.startDate);
    setEndDateInput(normalizedRange.endDate);
    setAppliedRange(normalizedRange);
    setActivePreset(preset);
  }

  function handlePresetClick(preset: BillingRangePreset) {
    const range = getPresetRange(preset);
    applyRange(toDatetimeLocalValue(range.start), toDatetimeLocalValue(range.end), preset);
  }

  return (
    <AdminSurfaceLayout
      title="Billing Details"
      description="Review billing usage across the selected date range."
    >
      {billingSummaryQuery.isLoading ? (
        <Card>
          <CardContent className="flex min-h-32 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading billing summary
            </div>
          </CardContent>
        </Card>
      ) : null}

      {billingSummaryQuery.isError ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatAdminError(billingSummaryQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!billingSummaryQuery.isLoading && !billingSummaryQuery.isError && billingSummaryQuery.data ? (
        <MainSequenceEntitySummaryCard summary={billingSummaryQuery.data} />
      ) : null}

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Billing usage</CardTitle>
              <CardDescription>
                Filter usage by date range and review detailed billing activity.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-[220px]">
                  <label
                    htmlFor="billing-usage-start"
                    className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    From
                  </label>
                  <Input
                    id="billing-usage-start"
                    type="datetime-local"
                    step={60}
                    value={startDateInput}
                    onChange={(event) => {
                      setStartDateInput(event.target.value);
                      setActivePreset(null);
                    }}
                  />
                </div>
                <div className="w-[220px]">
                  <label
                    htmlFor="billing-usage-end"
                    className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    To
                  </label>
                  <Input
                    id="billing-usage-end"
                    type="datetime-local"
                    step={60}
                    value={endDateInput}
                    onChange={(event) => {
                      setEndDateInput(event.target.value);
                      setActivePreset(null);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={billingUsageQuery.isFetching || Boolean(rangeError)}
                  onClick={() => {
                    applyRange(startDateInput, endDateInput, null);
                  }}
                >
                  {billingUsageQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Apply
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {billingRangePresets.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    size="sm"
                    variant={activePreset === preset.id ? "default" : "outline"}
                    onClick={() => handlePresetClick(preset.id)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rangeError ? (
            <div className="border-b border-border/70 px-4 py-3 text-sm text-danger">
              {rangeError}
            </div>
          ) : null}

          {billingUsageQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading billing usage
              </div>
            </div>
          ) : null}

          {billingUsageQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatAdminError(billingUsageQuery.error)}
              </div>
            </div>
          ) : null}

          {!billingUsageQuery.isLoading && !billingUsageQuery.isError && usageRows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <CalendarRange className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No usage found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Try another date range to review billing activity.
              </p>
            </div>
          ) : null}

          {!billingUsageQuery.isLoading && !billingUsageQuery.isError && usageRows.length > 0 ? (
            <>
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div className="text-sm text-muted-foreground">
                  {`${usageRows.length} rows`}
                </div>
                <Badge variant="neutral">
                  {`${appliedRange.startDate} to ${appliedRange.endDate}`}
                </Badge>
              </div>
              <div className="overflow-x-auto px-4 py-4">
                <table
                  className="w-full min-w-[920px] border-separate"
                  style={{ borderSpacing: "0 6px" }}
                >
                  <thead>
                    <tr
                      className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                      style={{ fontSize: "10px" }}
                    >
                      {usageColumns.map((column) => (
                        <th
                          key={column.field}
                          className="px-3 py-1.5"
                        >
                          {column.headerName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.map((row, rowIndex) => (
                      <tr key={`${row.usage_end_time}-${row.source_object}-${rowIndex}`}>
                        {usageColumns.map((column, columnIndex) => (
                          <td
                            key={`${rowIndex}-${column.field}`}
                            className={getCompactCellClassName(
                              columnIndex === 0
                                ? "left"
                                : columnIndex === usageColumns.length - 1
                                  ? "right"
                                  : "middle",
                            )}
                          >
                            {formatUsageCell(row, column)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </AdminSurfaceLayout>
  );
}
