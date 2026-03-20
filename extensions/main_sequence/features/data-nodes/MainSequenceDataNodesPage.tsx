import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Database, HardDrive, Loader2, Network } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchDataNodeDetail,
  fetchDataNodeSummary,
  formatMainSequenceError,
  listDataNodes,
  mainSequenceRegistryPageSize,
  type DataNodeDetail,
  type DataNodeSummary,
  type EntitySummaryHeader,
} from "../../api";
import { MainSequenceEntitySummaryCard } from "../../components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistryPagination } from "../../components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../components/registryTable";
import { useRegistrySelection } from "../../hooks/useRegistrySelection";
import { MainSequenceDataNodeLocalTimeSeriesTab } from "./MainSequenceDataNodeLocalTimeSeriesTab";
import { MainSequenceDataNodePoliciesTab } from "./MainSequenceDataNodePoliciesTab";

const mainSequenceDataNodeIdParam = "msDataNodeId";
type DataNodeDetailTabId = "details" | "local-time-series" | "policies";
const dataNodeDetailTabs = [
  { id: "details", label: "Details" },
  { id: "local-time-series", label: "Local Update" },
  { id: "policies", label: "Policies" },
] as const;

const creationDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getDataNodeTitle(dataNode: DataNodeSummary) {
  const identifier = dataNode.identifier?.trim();

  if (identifier) {
    return identifier;
  }

  return `Dynamic table ${dataNode.id}`;
}

function getDataSourceLabel(dataNode: DataNodeSummary) {
  if (!dataNode.data_source?.related_resource) {
    return "No data source";
  }

  return (
    dataNode.data_source.related_resource.display_name?.trim() ||
    dataNode.data_source.related_resource.name?.trim() ||
    "No data source"
  );
}

function formatCreationDate(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return creationDateFormatter.format(new Date(parsed));
}

function getTableIndexNames(dataNode: DataNodeSummary) {
  const rawValue = dataNode.table_index_names as unknown;

  if (Array.isArray(rawValue)) {
    return rawValue.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  }

  if (typeof rawValue === "string" && rawValue.trim()) {
    return [rawValue.trim()];
  }

  return [];
}

function buildFallbackDataNodeSummary(dataNode: DataNodeSummary): EntitySummaryHeader {
  return {
    entity: {
      id: dataNode.id,
      type: "data_node",
      title: dataNode.storage_hash,
    },
    badges: [
      {
        key: "visibility",
        label: dataNode.open_for_everyone ? "Public" : "Private",
        tone: dataNode.open_for_everyone ? "success" : "neutral",
      },
    ],
    inline_fields: [
      {
        key: "identifier",
        label: "Identifier",
        value: dataNode.identifier?.trim() || "Not set",
        kind: "text",
      },
      {
        key: "data_source",
        label: "Data Source",
        value: getDataSourceLabel(dataNode),
        kind: "text",
      },
      {
        key: "frequency",
        label: "Frequency",
        value: dataNode.data_frequency_id ?? "Not set",
        kind: "text",
      },
    ],
    highlight_fields: [
      {
        key: "source_class_name",
        label: "Source Class",
        value: dataNode.source_class_name ?? "Unknown",
        kind: "code",
      },
      {
        key: "description",
        label: "Description",
        value: dataNode.description?.trim() || "Not set",
        kind: "text",
      },
    ],
    stats: [],
  };
}

export function MainSequenceDataNodesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [filterValue, setFilterValue] = useState("");
  const [dataNodesPageIndex, setDataNodesPageIndex] = useState(0);
  const [selectedDetailTabId, setSelectedDetailTabId] = useState<DataNodeDetailTabId>("details");
  const deferredFilterValue = useDeferredValue(filterValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedDataNodeId = Number(searchParams.get(mainSequenceDataNodeIdParam) ?? "");
  const isDataNodeDetailOpen = Number.isFinite(selectedDataNodeId) && selectedDataNodeId > 0;

  const dataNodesQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "list", dataNodesPageIndex],
    queryFn: () =>
      listDataNodes({
        limit: mainSequenceRegistryPageSize,
        offset: dataNodesPageIndex * mainSequenceRegistryPageSize,
      }),
  });

  useEffect(() => {
    setDataNodesPageIndex(0);
  }, [deferredFilterValue]);

  const dataNodeSummaryQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "summary", selectedDataNodeId],
    queryFn: () => fetchDataNodeSummary(selectedDataNodeId),
    enabled: isDataNodeDetailOpen,
  });
  const dataNodeDetailQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "detail", selectedDataNodeId],
    queryFn: () => fetchDataNodeDetail(selectedDataNodeId),
    enabled: isDataNodeDetailOpen,
  });

  const filteredDataNodes = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return (dataNodesQuery.data?.results ?? []).filter((dataNode) => {
      if (!needle) {
        return true;
      }

      return [
        getDataNodeTitle(dataNode),
        String(dataNode.id),
        dataNode.identifier ?? "",
        dataNode.storage_hash,
        dataNode.source_class_name ?? "",
        dataNode.description ?? "",
        getDataSourceLabel(dataNode),
        dataNode.data_source?.related_resource_class_type ?? "",
        dataNode.data_frequency_id ?? "",
        ...getTableIndexNames(dataNode),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [dataNodesQuery.data?.results, deferredFilterValue]);
  const dataNodeSelection = useRegistrySelection(filteredDataNodes);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((dataNodesQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (dataNodesPageIndex > totalPages - 1) {
      setDataNodesPageIndex(totalPages - 1);
    }
  }, [dataNodesPageIndex, dataNodesQuery.data?.count]);
  const selectedDataNodeFromList = useMemo(
    () => (dataNodesQuery.data?.results ?? []).find((dataNode) => dataNode.id === selectedDataNodeId) ?? null,
    [dataNodesQuery.data?.results, selectedDataNodeId],
  );
  const dataNodeSummary =
    dataNodeSummaryQuery.data ??
    (selectedDataNodeFromList ? buildFallbackDataNodeSummary(selectedDataNodeFromList) : null);
  const dataNodeTitle =
    dataNodeSummary?.entity.title ??
    selectedDataNodeFromList?.storage_hash ??
    (isDataNodeDetailOpen ? `Data node ${selectedDataNodeId}` : "Data node");
  const dataNodeColumnDetails = dataNodeDetailQuery.data?.sourcetableconfiguration?.columns_metadata ?? [];

  useEffect(() => {
    setSelectedDetailTabId("details");
  }, [selectedDataNodeId]);

  function updateSearchParams(update: (nextParams: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);
    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: false },
    );
  }

  function openDataNodeDetail(dataNodeId: number) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceDataNodeIdParam, String(dataNodeId));
    });
  }

  function closeDataNodeDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceDataNodeIdParam);
    });
  }

  return (
    <div className="space-y-6">
      {isDataNodeDetailOpen ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button
                type="button"
                className="transition-colors hover:text-foreground"
                onClick={closeDataNodeDetail}
              >
                Data nodes
              </button>
              <span>/</span>
              <span className="text-foreground">{dataNodeTitle}</span>
            </div>
            <Button variant="outline" size="sm" onClick={closeDataNodeDetail}>
              <ArrowLeft className="h-4 w-4" />
              Back to data nodes
            </Button>
          </div>

          {dataNodeSummaryQuery.isLoading && !dataNodeSummary ? (
            <Card>
              <CardContent className="flex min-h-48 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading data node details
                </div>
              </CardContent>
            </Card>
          ) : null}

          {dataNodeSummaryQuery.isError ? (
            <Card>
              <CardContent className="p-5">
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(dataNodeSummaryQuery.error)}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {dataNodeSummary ? (
            <>
              <MainSequenceEntitySummaryCard summary={dataNodeSummary} />

              <Card>
                <CardHeader className="border-b border-border/70 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {dataNodeDetailTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={
                          tab.id === selectedDetailTabId
                            ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                            : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
                        }
                        onClick={() => setSelectedDetailTabId(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="pt-5">
                  {selectedDetailTabId === "details" ? (
                    <div className="space-y-4">
                      {dataNodeDetailQuery.isLoading ? (
                        <div className="flex min-h-48 items-center justify-center">
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading data node details
                          </div>
                        </div>
                      ) : null}

                      {dataNodeDetailQuery.isError ? (
                        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                          {formatMainSequenceError(dataNodeDetailQuery.error)}
                        </div>
                      ) : null}

                      {!dataNodeDetailQuery.isLoading && !dataNodeDetailQuery.isError ? (
                        <>
                          <Card className="border border-border/70 bg-background/24">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">Column details</CardTitle>
                              <CardDescription>Column metadata from the source table configuration.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                              {dataNodeColumnDetails.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-[920px] border-separate border-spacing-y-2 text-sm">
                                    <thead>
                                      <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                        <th className="px-4 pb-2">Column</th>
                                        <th className="px-4 pb-2">Dtype</th>
                                        <th className="px-4 pb-2">Label</th>
                                        <th className="px-4 pb-2">Description</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {dataNodeColumnDetails.map((column) => (
                                        <tr key={`${column.source_config_id ?? "none"}-${column.column_name}`}>
                                          <td className="rounded-l-[calc(var(--radius)-2px)] border border-border/70 bg-background/40 px-4 py-3 font-mono text-xs text-foreground">
                                            {column.column_name}
                                          </td>
                                          <td className="border border-border/70 bg-background/40 px-4 py-3 text-foreground">
                                            {column.dtype?.trim() || "Not set"}
                                          </td>
                                          <td className="border border-border/70 bg-background/40 px-4 py-3 text-foreground">
                                            {column.label?.trim() || "Not set"}
                                          </td>
                                          <td className="rounded-r-[calc(var(--radius)-2px)] border border-border/70 bg-background/40 px-4 py-3 text-foreground">
                                            {column.description?.trim() || "Not set"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                                  No column metadata is available for this data node.
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </>
                      ) : null}
                    </div>
                  ) : selectedDetailTabId === "local-time-series" ? (
                    <MainSequenceDataNodeLocalTimeSeriesTab dataNodeId={selectedDataNodeId} />
                  ) : (
                    <MainSequenceDataNodePoliciesTab dataNodeId={selectedDataNodeId} />
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      ) : (
        <>
          <PageHeader
            eyebrow="Main Sequence"
            title="DataNodes"
            description="Browse data nodes from the ts_manager API."
            actions={<Badge variant="neutral">{`${dataNodesQuery.data?.count ?? 0} data nodes`}</Badge>}
          />

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle>Data nodes registry</CardTitle>
                  <CardDescription>
                    Search across identifiers, hashes, sources, descriptions, and index names.
                  </CardDescription>
                </div>
                <MainSequenceRegistrySearch
                  clearSelectionLabel="Clear data nodes"
                  onClearSelection={dataNodeSelection.clearSelection}
                  renderSelectionSummary={(selectionCount) => `${selectionCount} data nodes selected`}
                  value={filterValue}
                  onChange={(event) => setFilterValue(event.target.value)}
                  placeholder="Filter by identifier, id, hash, source class, or data source"
                  selectionCount={dataNodeSelection.selectedCount}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
          {dataNodesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading data nodes
              </div>
            </div>
          ) : null}

          {dataNodesQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(dataNodesQuery.error)}
              </div>
            </div>
          ) : null}

          {!dataNodesQuery.isLoading && !dataNodesQuery.isError && filteredDataNodes.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Network className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No data nodes found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Clear the current filter or confirm the authenticated user can view dynamic tables.
              </p>
            </div>
          ) : null}

                  {!dataNodesQuery.isLoading && !dataNodesQuery.isError && filteredDataNodes.length > 0 ? (
                    <div className="overflow-x-auto px-4 py-4">
              <table className="w-full min-w-[1220px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="w-12 px-3 pb-2">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all visible data nodes"
                        checked={dataNodeSelection.allSelected}
                        indeterminate={dataNodeSelection.someSelected}
                        onChange={dataNodeSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 pb-2">Storage hash</th>
                    <th className="px-4 pb-2">Identifier</th>
                    <th className="px-4 pb-2">Data source</th>
                    <th className="px-4 pb-2">Source class</th>
                    <th className="px-4 pb-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDataNodes.map((dataNode) => {
                    const selected = dataNodeSelection.isSelected(dataNode.id);

                    return (
                      <tr key={dataNode.id}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select ${getDataNodeTitle(dataNode)}`}
                            checked={selected}
                            onChange={() => dataNodeSelection.toggleSelection(dataNode.id)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="flex items-start gap-2">
                            <HardDrive className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <button
                              type="button"
                              className="group inline-flex max-w-[240px] items-center gap-1.5 rounded-sm text-left font-mono text-xs text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                              onClick={() => openDataNodeDetail(dataNode.id)}
                              title={dataNode.storage_hash}
                            >
                              <span className="truncate">{dataNode.storage_hash}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                            </button>
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="flex items-start gap-2">
                            <Database className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="font-medium text-foreground">
                                {dataNode.identifier?.trim() || "No identifier"}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                ID {dataNode.id}
                                {dataNode.description?.trim()
                                  ? ` · ${dataNode.description.trim()}`
                                  : ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="text-foreground">{getDataSourceLabel(dataNode)}</div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="text-foreground">{dataNode.source_class_name ?? "Unknown"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Frequency: {dataNode.data_frequency_id ?? "Not set"}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          <div className="text-foreground">{formatCreationDate(dataNode.creation_date)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
                    </div>
                  ) : null}
                  {!dataNodesQuery.isLoading &&
                  !dataNodesQuery.isError &&
                  (dataNodesQuery.data?.count ?? 0) > 0 ? (
                    <MainSequenceRegistryPagination
                      count={dataNodesQuery.data?.count ?? 0}
                      itemLabel="data nodes"
                      pageIndex={dataNodesPageIndex}
                      pageSize={mainSequenceRegistryPageSize}
                      onPageChange={setDataNodesPageIndex}
                    />
                  ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
