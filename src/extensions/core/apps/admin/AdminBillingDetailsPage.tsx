import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  getCurrentUserCreditsSummary,
  listBillingUsage,
  type BillingUsageRow,
  type UserCreditSummary,
} from "./api";
import { AdminSurfaceLayout } from "./shared";
import type { EntitySummaryHeader } from "../../../../../extensions/main_sequence/common/api";
import { MainSequenceEntitySummaryCard } from "../../../../../extensions/main_sequence/common/components/MainSequenceEntitySummaryCard";

type BillingRangePreset = "current" | "month" | "previous-month" | "current-year";

const billingRangePresets: Array<{ id: BillingRangePreset; label: string }> = [
  { id: "current", label: "Current" },
  { id: "month", label: "Month" },
  { id: "previous-month", label: "Previous Month" },
  { id: "current-year", label: "Current Year" },
];

const billingUsageColumns: Array<{
  field:
    | "started_at"
    | "ended_at"
    | "billing_category"
    | "billed_resource_name"
    | "parent_resource_name"
    | "total_cost";
  headerName: string;
}> = [
  { field: "started_at", headerName: "Started" },
  { field: "ended_at", headerName: "Ended" },
  { field: "billing_category", headerName: "Billing Category" },
  { field: "billed_resource_name", headerName: "Billed Resource" },
  { field: "parent_resource_name", headerName: "Owning Resource" },
  { field: "total_cost", headerName: "Cost" },
];

function formatAdminError(error: unknown) {
  return error instanceof Error ? error.message : "The billing usage request failed.";
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(date: Date) {
  return [
    date.getFullYear(),
    "-",
    padDatePart(date.getMonth() + 1),
    "-",
    padDatePart(date.getDate()),
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

function formatUsageTimestamp(value: string | null | undefined) {
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

function formatUsageCost(value: BillingUsageRow["total_cost"]) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return value == null ? "—" : String(value) || "—";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatUsageKind(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "service_runtime") {
    return "Service Runtime";
  }

  return normalized
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatUsageText(value: string | null | undefined) {
  return value?.trim() || "—";
}

function BillingResourceCell({
  kind,
  name,
  uid,
}: {
  kind: string | null;
  name: string | null;
  uid: string | null;
}) {
  const displayName = formatUsageText(name ?? uid);
  const formattedKind = formatUsageKind(kind);

  return (
    <div className="min-w-[220px] space-y-1">
      <div className="font-medium text-foreground">{displayName}</div>
      {formattedKind || uid ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {formattedKind ? <span>{formattedKind}</span> : null}
          {uid ? (
            <span className="max-w-[260px] truncate font-mono text-[10px]">
              {uid}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatUsageCell(row: BillingUsageRow, field: (typeof billingUsageColumns)[number]["field"]) {
  if (field === "started_at" || field === "ended_at") {
    return formatUsageTimestamp(row[field]);
  }

  if (field === "total_cost") {
    return formatUsageCost(row.total_cost);
  }

  if (field === "billing_category") {
    return formatUsageKind(row.billing_category) ?? "—";
  }

  if (field === "billed_resource_name") {
    return (
      <BillingResourceCell
        kind={row.billed_resource_kind}
        name={row.billed_resource_name}
        uid={row.billed_resource_uid}
      />
    );
  }

  if (field === "parent_resource_name") {
    return (
      <BillingResourceCell
        kind={row.parent_resource_kind}
        name={row.parent_resource_name}
        uid={row.parent_resource_uid}
      />
    );
  }

  return "—";
}

function clampBudgetPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function getBudgetPercent(spentCents: number, limitCents: number) {
  if (!Number.isFinite(spentCents) || !Number.isFinite(limitCents) || limitCents <= 0) {
    return null;
  }

  return clampBudgetPercent((spentCents / limitCents) * 100);
}

function hasMonthlyBudgetLimit(summary: UserCreditSummary["user_budget"]) {
  return Number(summary.monthly_limit_cents) > 0;
}

function formatBudgetCurrency(
  cents: number,
  currency: string,
  options: { fixedFractionDigits?: boolean } = {},
) {
  const normalizedCents = Number(cents || 0);
  const amount = normalizedCents / 100;
  const normalizedCurrency = String(currency || "usd").toUpperCase();
  const fractionDigits = options.fixedFractionDigits
    ? 2
    : Math.abs(normalizedCents) % 100 === 0
      ? 0
      : 2;

  try {
    const numberFormatOptions: Intl.NumberFormatOptions = {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: fractionDigits,
    };
    if (options.fixedFractionDigits) {
      numberFormatOptions.minimumFractionDigits = fractionDigits;
    }

    return new Intl.NumberFormat(undefined, numberFormatOptions).format(amount);
  } catch {
    return `$${amount.toFixed(fractionDigits)}`;
  }
}

function buildBudgetSummaryCard(summary: UserCreditSummary): EntitySummaryHeader {
  const userBudget = summary.user_budget;
  const organizationConsumption = summary.organization_consumption ?? null;
  const hasLimit = hasMonthlyBudgetLimit(userBudget);
  const userPercent = hasLimit
    ? getBudgetPercent(
        userBudget.spent_this_period_cents,
        Number(userBudget.monthly_limit_cents),
      )
    : null;
  const spentLabel = formatBudgetCurrency(userBudget.spent_this_period_cents, userBudget.currency, {
    fixedFractionDigits: true,
  });
  const limitLabel = hasLimit
    ? formatBudgetCurrency(Number(userBudget.monthly_limit_cents), userBudget.currency, {
        fixedFractionDigits: true,
      })
    : null;
  const remainingLabel =
    userBudget.remaining_monthly_limit_cents !== null
      ? formatBudgetCurrency(userBudget.remaining_monthly_limit_cents, userBudget.currency, {
          fixedFractionDigits: true,
        })
      : null;
  const availableLabel = formatBudgetCurrency(userBudget.available_cents, userBudget.currency, {
    fixedFractionDigits: true,
  });

  const badges = [];

  if (userPercent !== null) {
    badges.push({
      key: "user_budget_used",
      label: `${userPercent}% used`,
      tone: userPercent >= 90 ? "danger" : userPercent >= 75 ? "warning" : "success",
    });
  } else {
    badges.push({
      key: "user_budget_unlimited",
      label: "No monthly limit",
      tone: "info",
    });
  }

  if (organizationConsumption) {
    badges.push({
      key: "organization_consumers",
      label: `${organizationConsumption.consumer_count} consumers`,
      tone: "neutral",
    });
  }

  const inline_fields = [
    {
      key: "period_start",
      label: "Period Start",
      value: summary.period.start,
      kind: "date",
      meta: summary.period.timezone,
    },
    {
      key: "period_end",
      label: "Period End",
      value: summary.period.end,
      kind: "date",
      meta: summary.period.timezone,
    },
  ];

  const highlight_fields = [
    {
      key: "user_budget_window",
      label: "User Budget",
      value: limitLabel ? `${spentLabel} / ${limitLabel}` : spentLabel,
      kind: "text",
      meta: limitLabel ? "Spent / monthly limit" : "Spent this period",
    },
  ];

  if (organizationConsumption) {
    highlight_fields.push({
      key: "organization_consumption_split",
      label: "Organization Consumption",
      value: [
        `total ${formatBudgetCurrency(organizationConsumption.total_cents, organizationConsumption.currency, { fixedFractionDigits: true })}`,
        `user-attributed ${formatBudgetCurrency(organizationConsumption.user_attributed_cents, organizationConsumption.currency, { fixedFractionDigits: true })}`,
        `shared ${formatBudgetCurrency(organizationConsumption.organization_shared_cents, organizationConsumption.currency, { fixedFractionDigits: true })}`,
        `unresolved ${formatBudgetCurrency(organizationConsumption.unresolved_cents, organizationConsumption.currency, { fixedFractionDigits: true })}`,
      ].join(" · "),
      kind: "text",
      meta: "User and organization split",
    });
  }

  const stats = [
    {
      key: "user_spent",
      label: "User Spent",
      value: userBudget.spent_this_period_cents / 100,
      display: spentLabel,
      kind: "currency",
      info: "User-attributed spend in the current summary period.",
    },
    {
      key: "available_credits",
      label: "Available",
      value: userBudget.available_cents / 100,
      display: availableLabel,
      kind: "currency",
      info: "Currently available credits for the user budget context.",
    },
  ];

  if (limitLabel) {
    stats.push({
      key: "monthly_limit",
      label: "Monthly Limit",
      value: Number(userBudget.monthly_limit_cents) / 100,
      display: limitLabel,
      kind: "currency",
      info: "Configured monthly user budget limit.",
    });
  }

  if (remainingLabel) {
    stats.push({
      key: "remaining_budget",
      label: "Remaining",
      value: Number(userBudget.remaining_monthly_limit_cents) / 100,
      display: remainingLabel,
      kind: "currency",
      info: "Remaining user budget before hitting the monthly limit.",
    });
  }

  if (organizationConsumption) {
    stats.push({
      key: "organization_total_consumption",
      label: "Org Consumption",
      value: organizationConsumption.total_cents / 100,
      display: formatBudgetCurrency(
        organizationConsumption.total_cents,
        organizationConsumption.currency,
        { fixedFractionDigits: true },
      ),
      kind: "currency",
      info: "Total organization consumption in the same summary period.",
    });
    stats.push({
      key: "organization_consumers",
      label: "Consumers",
      value: organizationConsumption.consumer_count,
      display: String(organizationConsumption.consumer_count),
      kind: "number",
      info: "Number of consumers contributing to organization consumption.",
    });
  }

  return {
    entity: {
      id: "user-credits-summary",
      type: "credits",
      title: "Budget Summary",
    },
    badges,
    inline_fields,
    highlight_fields,
    stats,
  };
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
  const [startDateInput, setStartDateInput] = useState(toDateInputValue(initialRange.start));
  const [endDateInput, setEndDateInput] = useState(toDateInputValue(initialRange.end));
  const [appliedRange, setAppliedRange] = useState(() =>
    normalizeRangeForQuery(
      toDateInputValue(initialRange.start),
      toDateInputValue(initialRange.end),
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
    queryKey: ["admin", "billing", "credits-summary"],
    queryFn: () => getCurrentUserCreditsSummary(),
    retry: false,
    staleTime: 60_000,
  });

  const usageRows = billingUsageQuery.data?.rows ?? [];
  const billingSummaryCard = useMemo(
    () => (billingSummaryQuery.data ? buildBudgetSummaryCard(billingSummaryQuery.data) : null),
    [billingSummaryQuery.data],
  );
  const usageColumns = billingUsageColumns;

  function applyRange(startDate: string, endDate: string, preset: BillingRangePreset | null = null) {
    const normalizedRange = normalizeRangeForQuery(startDate, endDate);

    setStartDateInput(normalizedRange.startDate);
    setEndDateInput(normalizedRange.endDate);
    setAppliedRange(normalizedRange);
    setActivePreset(preset);
  }

  function handlePresetClick(preset: BillingRangePreset) {
    const range = getPresetRange(preset);
    applyRange(toDateInputValue(range.start), toDateInputValue(range.end), preset);
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
              Loading budget summary
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

      {!billingSummaryQuery.isLoading && !billingSummaryQuery.isError && billingSummaryCard ? (
        <MainSequenceEntitySummaryCard summary={billingSummaryCard} />
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
                    type="date"
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
                    type="date"
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
                  {`${usageRows.length} usage records`}
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
                      <tr
                        key={[
                          row.started_at,
                          row.ended_at,
                          row.billed_resource_uid,
                          row.billed_resource_name,
                          rowIndex,
                        ].join("-")}
                      >
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
                            {formatUsageCell(row, column.field)}
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
