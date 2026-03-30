import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { ArrowLeft, ArrowUpRight, Database, Loader2 } from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchTimeScaleDBServiceDetail,
  fetchTimeScaleDBServiceSummary,
  formatMainSequenceError,
  listTimeScaleDBServiceDataSources,
  mainSequenceRegistryPageSize,
  type PhysicalDataSourceListRow,
  type TimeScaleDBServiceRecord,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";

type DetailFieldDefinition = {
  key: keyof TimeScaleDBServiceRecord;
  label: string;
  fullWidth?: boolean;
  monospace?: boolean;
};

const detailFieldDefinitions: DetailFieldDefinition[] = [
  { key: "id", label: "Service ID", monospace: true },
  { key: "release_name", label: "Release Name", monospace: true },
  { key: "namespace", label: "Namespace", monospace: true },
  { key: "load_balancer_ip", label: "Load Balancer IP" },
  { key: "persistence_size", label: "Provisioned Storage" },
  { key: "backup_bucket", label: "Backup Bucket" },
  { key: "open_for_everyone", label: "Public" },
  { key: "has_postgres_password", label: "Password Configured" },
  { key: "linked_data_sources_count", label: "Linked Data Sources" },
  { key: "created_by_user", label: "Created By" },
  { key: "organization_owner", label: "Organization" },
  { key: "creation_date", label: "Creation Date" },
  { key: "created_at", label: "Created At" },
  { key: "updated_at", label: "Updated At" },
  { key: "helm_release_info", label: "Helm Release Info", fullWidth: true },
];

const databasePreferredColumnOrder = [
  "display_name",
  "id",
  "class_type_label",
  "class_type",
  "status_label",
  "status",
  "status_tone",
  "provisioned_size_gb",
  "creation_date_display",
  "creation_date",
  "source_logo",
] as const;

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

function stringifyUnknown(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function renderDetailValue(value: unknown, { monospace = false }: { monospace?: boolean } = {}) {
  if (value === null || value === undefined || value === "") {
    return <div className="text-sm text-muted-foreground">Not available</div>;
  }

  if (typeof value === "boolean") {
    return <div className="text-sm font-medium text-foreground">{value ? "Yes" : "No"}</div>;
  }

  if (typeof value === "number") {
    return <div className="text-sm font-medium text-foreground">{String(value)}</div>;
  }

  if (typeof value === "string") {
    return (
      <div className={monospace ? "font-mono text-sm text-foreground" : "text-sm font-medium text-foreground"}>
        {value}
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-[calc(var(--radius)-8px)] bg-background/40 p-3 font-mono text-xs text-foreground">
      {stringifyUnknown(value)}
    </pre>
  );
}

function getServiceTitle(
  serviceId: number,
  {
    initialService,
    detail,
    summaryTitle,
  }: {
    initialService: TimeScaleDBServiceRecord | null;
    detail: TimeScaleDBServiceRecord | null;
    summaryTitle: string | null;
  },
) {
  return (
    summaryTitle?.trim() ||
    detail?.release_name?.trim() ||
    initialService?.release_name?.trim() ||
    `TimeScaleDB Service ${serviceId}`
  );
}

function formatLinkedDatabaseDate(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

function formatDatabaseColumnLabel(key: string) {
  const explicitLabels: Record<string, string> = {
    id: "ID",
    display_name: "Database",
    source_logo: "Source Logo",
    class_type: "Class Type",
    class_type_label: "Class Type Label",
    status: "Status",
    status_label: "Status Label",
    status_tone: "Status Tone",
    provisioned_size_gb: "Provisioned Size (GB)",
    creation_date: "Creation Date",
    creation_date_display: "Creation Date Display",
  };

  return (
    explicitLabels[key] ??
    key
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function getDatabaseColumnKeys(rows: PhysicalDataSourceListRow[]) {
  const rowKeys = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => rowKeys.add(key));
  });

  const orderedKeys = databasePreferredColumnOrder.filter((key) => rowKeys.has(key));
  const remainingKeys = [...rowKeys]
    .filter((key) => !databasePreferredColumnOrder.includes(key as (typeof databasePreferredColumnOrder)[number]))
    .sort((left, right) => left.localeCompare(right));

  return [...orderedKeys, ...remainingKeys];
}

function renderDatabaseCellValue(
  row: PhysicalDataSourceListRow,
  key: string,
  onOpenPhysicalDataSourceDetail: (physicalDataSourceId: number) => void,
) {
  const value = row[key];

  if (key === "display_name") {
    return (
      <button
        type="button"
        className="group inline-flex items-center gap-1.5 rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
        onClick={() => onOpenPhysicalDataSourceDetail(row.id)}
      >
        <span>{typeof value === "string" && value.trim() ? value.trim() : `Physical Data Source ${row.id}`}</span>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
      </button>
    );
  }

  if (key === "status_label") {
    return (
      <Badge variant={getStatusBadgeVariant(row.status_tone)}>
        {typeof value === "string" && value.trim()
          ? value.trim()
          : row.status?.trim() || "Unknown"}
      </Badge>
    );
  }

  if (key === "creation_date") {
    return formatLinkedDatabaseDate(typeof value === "string" ? value : null);
  }

  if (key === "creation_date_display") {
    return typeof value === "string" && value.trim()
      ? value.trim()
      : formatLinkedDatabaseDate(row.creation_date);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (typeof value === "object") {
    return stringifyUnknown(value);
  }

  return String(value);
}

function getStatusBadgeVariant(statusTone: string) {
  if (statusTone === "success") {
    return "success" as const;
  }

  if (statusTone === "warning") {
    return "warning" as const;
  }

  if (statusTone === "danger") {
    return "danger" as const;
  }

  if (statusTone === "info") {
    return "primary" as const;
  }

  return "neutral" as const;
}

export type TimeScaleDbServiceDetailTabId = "details" | "databases";

export function MainSequenceTimeScaleDbServiceDetail({
  activeTabId,
  initialService,
  onBack,
  onSelectTab,
  serviceId,
}: {
  activeTabId: TimeScaleDbServiceDetailTabId;
  initialService: TimeScaleDBServiceRecord | null;
  onBack: () => void;
  onSelectTab: (tabId: TimeScaleDbServiceDetailTabId) => void;
  serviceId: number;
}) {
  const navigate = useNavigate();
  const [databaseSearchValue, setDatabaseSearchValue] = useState("");
  const [databasesPageIndex, setDatabasesPageIndex] = useState(0);
  const deferredDatabaseSearchValue = useDeferredValue(databaseSearchValue);
  const summaryQuery = useQuery({
    queryKey: ["main_sequence", "timescaledb_services", "summary", serviceId],
    queryFn: () => fetchTimeScaleDBServiceSummary(serviceId),
    enabled: serviceId > 0,
  });
  const detailQuery = useQuery({
    queryKey: ["main_sequence", "timescaledb_services", "detail", serviceId],
    queryFn: () => fetchTimeScaleDBServiceDetail(serviceId),
    enabled: serviceId > 0,
  });
  const databasesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "timescaledb_services",
      "data_sources",
      serviceId,
      databasesPageIndex,
      deferredDatabaseSearchValue.trim(),
    ],
    queryFn: () =>
      listTimeScaleDBServiceDataSources(serviceId, {
        page: databasesPageIndex + 1,
        pageSize: mainSequenceRegistryPageSize,
        search: deferredDatabaseSearchValue,
      }),
    enabled: serviceId > 0 && activeTabId === "databases",
  });

  const summary = summaryQuery.data ?? null;
  const detail = detailQuery.data ?? null;
  const databaseRows = databasesQuery.data?.rows ?? [];
  const databasesTotalItems = databasesQuery.data?.pagination.total_items ?? 0;
  const databaseColumnKeys = useMemo(
    () => getDatabaseColumnKeys(databaseRows),
    [databaseRows],
  );
  const serviceTitle = getServiceTitle(serviceId, {
    initialService,
    detail,
    summaryTitle: summary?.entity.title ?? null,
  });
  const subtitleParts = [
    detail?.namespace?.trim() || initialService?.namespace?.trim() || null,
    detail?.load_balancer_ip?.trim() || initialService?.load_balancer_ip?.trim() || null,
  ].filter(Boolean);
  const linkedDatabasesTitle = useMemo(
    () =>
      databasesQuery.data?.service.release_name?.trim() ||
      detail?.release_name?.trim() ||
      initialService?.release_name?.trim() ||
      `Service ${serviceId}`,
    [databasesQuery.data?.service.release_name, detail?.release_name, initialService?.release_name, serviceId],
  );

  useEffect(() => {
    setDatabaseSearchValue("");
    setDatabasesPageIndex(0);
  }, [serviceId]);

  useEffect(() => {
    setDatabasesPageIndex(0);
  }, [deferredDatabaseSearchValue]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      databasesQuery.data?.pagination.total_pages ??
        (Math.ceil(databasesTotalItems / mainSequenceRegistryPageSize) || 1),
    );

    if (databasesPageIndex > totalPages - 1) {
      setDatabasesPageIndex(totalPages - 1);
    }
  }, [databasesPageIndex, databasesQuery.data?.pagination.total_pages, databasesTotalItems]);

  function openPhysicalDataSourceDetail(physicalDataSourceId: number) {
    const searchParams = new URLSearchParams();
    searchParams.set("msPhysicalDataSourceId", String(physicalDataSourceId));
    navigate(`${getAppPath("main_sequence_workbench", "physical-data-sources")}?${searchParams.toString()}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title={serviceTitle}
        description={
          subtitleParts.length > 0
            ? subtitleParts.join(" · ")
            : "Read-only deployment service detail from the pods TimeScaleDB service endpoints."
        }
        actions={
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to services
          </Button>
        }
      />

      {summaryQuery.isError && !summary ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(summaryQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <MainSequenceEntitySummaryCard summary={summary} />
      ) : (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading service summary
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={
                activeTabId === "details"
                  ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                  : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
              }
              onClick={() => onSelectTab("details")}
            >
              Details
            </button>
            <button
              type="button"
              className={
                activeTabId === "databases"
                  ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                  : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
              }
              onClick={() => onSelectTab("databases")}
            >
              Databases
            </button>
          </div>
        </CardHeader>
      </Card>

      {activeTabId === "details" ? (
        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Service detail</CardTitle>
            <CardDescription>
              Read-only fields returned by the TimeScaleDB service detail endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {detailQuery.isLoading && !detail ? (
              <div className="flex min-h-56 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading service detail
                </div>
              </div>
            ) : null}

            {detailQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(detailQuery.error)}
              </div>
            ) : null}

            {!detailQuery.isLoading && !detailQuery.isError && detail ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {detailFieldDefinitions.map((field) => {
                  const rawValue = field.key === "creation_date"
                    ? formatDateTime(detail.creation_date)
                    : field.key === "created_at"
                      ? formatDateTime(detail.created_at)
                      : field.key === "updated_at"
                        ? formatDateTime(detail.updated_at)
                        : detail[field.key];

                  return (
                    <div
                      key={field.key}
                      className={`rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-4 ${
                        field.fullWidth ? "lg:col-span-2" : ""
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {field.label}
                      </div>
                      <div className="mt-3">{renderDetailValue(rawValue, { monospace: field.monospace })}</div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-col gap-4">
              <div>
                <CardTitle>Databases</CardTitle>
                <CardDescription>
                  Physical data sources linked to {linkedDatabasesTitle}.
                </CardDescription>
              </div>
              <MainSequenceRegistrySearch
                accessory={<Badge variant="neutral">{`${databasesTotalItems} rows`}</Badge>}
                value={databaseSearchValue}
                onChange={(event) => setDatabaseSearchValue(event.target.value)}
                placeholder="Search by display name, class type, status, or id"
                searchClassName="max-w-lg"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {databasesQuery.isLoading ? (
              <div className="flex min-h-56 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading databases
                </div>
              </div>
            ) : null}

            {databasesQuery.isError ? (
              <div className="p-5">
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(databasesQuery.error)}
                </div>
              </div>
            ) : null}

            {!databasesQuery.isLoading && !databasesQuery.isError && databasesTotalItems === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                  <Database className="h-6 w-6" />
                </div>
                <div className="mt-4 text-sm font-medium text-foreground">No databases found</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  This deployment service does not currently expose any linked physical data sources.
                </p>
              </div>
            ) : null}

            {!databasesQuery.isLoading && !databasesQuery.isError && databasesTotalItems > 0 ? (
              <div className="overflow-x-auto px-4 py-4">
                <table
                  className="w-full min-w-[1180px] border-separate text-sm"
                  style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
                >
                  <thead>
                    <tr
                      className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                      style={{ fontSize: "var(--table-meta-font-size)" }}
                    >
                      {databaseColumnKeys.map((key) => (
                        <th
                          key={key}
                          className="px-4 py-[var(--table-standard-header-padding-y)]"
                        >
                          {formatDatabaseColumnLabel(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {databaseRows.map((row: PhysicalDataSourceListRow) => (
                      <tr key={row.id}>
                        {databaseColumnKeys.map((key, index) => (
                          <td
                            key={`${row.id}-${key}`}
                            className={getRegistryTableCellClassName(
                              false,
                              index === 0
                                ? "left"
                                : index === databaseColumnKeys.length - 1
                                  ? "right"
                                  : "middle",
                            )}
                          >
                            {renderDatabaseCellValue(row, key, openPhysicalDataSourceDetail)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {!databasesQuery.isLoading && !databasesQuery.isError && databasesTotalItems > 0 ? (
              <MainSequenceRegistryPagination
                count={databasesTotalItems}
                itemLabel="databases"
                pageIndex={databasesPageIndex}
                pageSize={databasesQuery.data?.pagination.page_size ?? mainSequenceRegistryPageSize}
                onPageChange={setDatabasesPageIndex}
              />
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
