import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Database, HardDrive, Loader2, Network, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeleteDataNodes,
  bulkRefreshDataNodeTableSearchIndex,
  bulkSetDataNodeIndexStatsFromTable,
  bulkSetDataNodeNextUpdateFromLastIndexValue,
  fetchDataNodeDetail,
  fetchDataNodeSummary,
  formatMainSequenceError,
  listDataNodes,
  mainSequenceRegistryPageSize,
  type DataNodeDetail,
  type DataNodeSummary,
  type EntitySummaryHeader,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";
import {
  MainSequenceDataNodeLocalUpdateDetail,
  type LocalUpdateDetailTabId,
} from "./MainSequenceDataNodeLocalUpdateDetail";
import { MainSequenceDataNodeLocalTimeSeriesTab } from "./MainSequenceDataNodeLocalTimeSeriesTab";
import { MainSequenceDataNodePoliciesTab } from "./MainSequenceDataNodePoliciesTab";

const mainSequenceDataNodeIdParam = "msDataNodeId";
const mainSequenceDataNodeTabParam = "msDataNodeTab";
const mainSequenceLocalUpdateIdParam = "msLocalUpdateId";
const mainSequenceLocalUpdateTabParam = "msLocalUpdateTab";
const dataNodeDetailTabs = [
  { id: "details", label: "Details" },
  { id: "description", label: "Description" },
  { id: "local-time-series", label: "Local Update" },
  { id: "policies", label: "Policies" },
] as const;
type DataNodeDetailTabId = (typeof dataNodeDetailTabs)[number]["id"];
const defaultDataNodeDetailTabId: DataNodeDetailTabId = "details";

type DataNodeBulkActionKind =
  | "set-next-update-from-last-index"
  | "set-index-stats-from-table"
  | "refresh-table-search-index"
  | "delete";

type DataNodeBulkActionRequest = {
  kind: DataNodeBulkActionKind;
  dataNodes: DataNodeSummary[];
};

type DataNodeDeleteOptions = {
  deleteWithNoTable: boolean;
  fullDeleteDownstreamTables: boolean;
  overrideProtection: boolean;
};

const defaultDataNodeDeleteOptions: DataNodeDeleteOptions = {
  deleteWithNoTable: false,
  fullDeleteDownstreamTables: false,
  overrideProtection: false,
};

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
  const rawValue =
    (dataNode.table_index_names as unknown) ??
    (dataNode.index_names as unknown) ??
    (dataNode.sourcetableconfiguration?.index_names as unknown);

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

function getGeneratedSearchDocument(summary?: EntitySummaryHeader | null) {
  const rawValue =
    summary?.extra?.generated_search_document ?? summary?.extras?.generated_search_document ?? null;

  return typeof rawValue === "string" && rawValue.trim() ? rawValue.trim() : null;
}

function isDataNodeDetailTabId(value: string | null): value is DataNodeDetailTabId {
  return dataNodeDetailTabs.some((tab) => tab.id === value);
}

export function MainSequenceDataNodesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [filterValue, setFilterValue] = useState("");
  const [dataNodesPageIndex, setDataNodesPageIndex] = useState(0);
  const [bulkActionRequest, setBulkActionRequest] = useState<DataNodeBulkActionRequest | null>(null);
  const [deleteOptions, setDeleteOptions] = useState<DataNodeDeleteOptions>(
    defaultDataNodeDeleteOptions,
  );
  const deferredFilterValue = useDeferredValue(filterValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedDataNodeId = Number(searchParams.get(mainSequenceDataNodeIdParam) ?? "");
  const requestedDetailTabId = searchParams.get(mainSequenceDataNodeTabParam);
  const selectedLocalUpdateId = Number(searchParams.get(mainSequenceLocalUpdateIdParam) ?? "");
  const selectedLocalUpdateTabId = searchParams.get(mainSequenceLocalUpdateTabParam);
  const isDataNodeDetailOpen = Number.isFinite(selectedDataNodeId) && selectedDataNodeId > 0;
  const isLocalUpdateDetailOpen =
    Number.isFinite(selectedLocalUpdateId) && selectedLocalUpdateId > 0;
  const isStandaloneLocalUpdateDetailOpen = isLocalUpdateDetailOpen && !isDataNodeDetailOpen;
  const selectedDetailTabId: DataNodeDetailTabId = isLocalUpdateDetailOpen
    ? "local-time-series"
    : isDataNodeDetailTabId(requestedDetailTabId)
      ? requestedDetailTabId
      : defaultDataNodeDetailTabId;

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
  const generatedSearchDocument = getGeneratedSearchDocument(dataNodeSummaryQuery.data ?? dataNodeSummary);

  const refreshSearchIndexMutation = useMutation({
    mutationFn: () => bulkRefreshDataNodeTableSearchIndex([selectedDataNodeId]),
    onSuccess: async (result) => {
      const payload =
        result && typeof result === "object" && "success_count" in result && "failed_count" in result
          ? (result as { success_count: number; failed_count: number })
          : null;

      toast({
        variant: payload?.failed_count ? "info" : "success",
        title: payload?.failed_count ? "Search index refresh completed with failures" : "Search index refreshed",
        description: payload
          ? payload.failed_count > 0
            ? `${payload.success_count} succeeded, ${payload.failed_count} failed.`
            : "The DataNode search index was refreshed."
          : "The DataNode search index was refreshed.",
      });

      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "data_nodes"],
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Search index refresh failed",
        description: formatMainSequenceError(error),
      });
    },
  });

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

  function openDataNodeDetail(
    dataNodeId: number,
    tabId: DataNodeDetailTabId = defaultDataNodeDetailTabId,
  ) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceDataNodeIdParam, String(dataNodeId));
      nextParams.set(mainSequenceDataNodeTabParam, tabId);
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
    });
  }

  function closeDataNodeDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceDataNodeIdParam);
      nextParams.delete(mainSequenceDataNodeTabParam);
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
    });
  }

  function openLocalUpdateDetail(localUpdateId: number) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceDataNodeTabParam, "local-time-series");
      nextParams.set(mainSequenceLocalUpdateIdParam, String(localUpdateId));
      nextParams.set(mainSequenceLocalUpdateTabParam, "details");
    });
  }

  function closeLocalUpdateDetail() {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceDataNodeTabParam, "local-time-series");
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
    });
  }

  function closeStandaloneLocalUpdateDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceDataNodeIdParam);
      nextParams.delete(mainSequenceDataNodeTabParam);
      nextParams.delete(mainSequenceLocalUpdateIdParam);
      nextParams.delete(mainSequenceLocalUpdateTabParam);
    });
  }

  function selectLocalUpdateTab(tabId: LocalUpdateDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceDataNodeTabParam, "local-time-series");
      nextParams.set(mainSequenceLocalUpdateTabParam, tabId);
    });
  }

  function selectDataNodeDetailTab(tabId: DataNodeDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceDataNodeIdParam, String(selectedDataNodeId));
      nextParams.set(mainSequenceDataNodeTabParam, tabId);

      if (tabId !== "local-time-series") {
        nextParams.delete(mainSequenceLocalUpdateIdParam);
        nextParams.delete(mainSequenceLocalUpdateTabParam);
      }
    });
  }

  function openBulkAction(kind: DataNodeBulkActionKind) {
    const selectedItems = dataNodeSelection.selectedItems;

    if (selectedItems.length === 0) {
      return;
    }

    if (kind === "delete") {
      setDeleteOptions(defaultDataNodeDeleteOptions);
    }

    setBulkActionRequest({
      kind,
      dataNodes: selectedItems,
    });
  }

  const dataNodeBulkActions = useMemo(
    () => [
      {
        id: "set-next-update-from-last-index",
        label: "Set next update from last time index value",
        onSelect: () => openBulkAction("set-next-update-from-last-index"),
      },
      {
        id: "set-index-stats-from-table",
        label: "Set index stats from table",
        onSelect: () => openBulkAction("set-index-stats-from-table"),
      },
      {
        id: "refresh-table-search-index",
        label: "Refresh table search index",
        onSelect: () => openBulkAction("refresh-table-search-index"),
      },
      {
        id: "delete",
        label: "Delete Data Nodes",
        icon: Trash2,
        onSelect: () => openBulkAction("delete"),
        tone: "danger" as const,
      },
    ],
    [dataNodeSelection.selectedItems],
  );

  const bulkActionConfig = useMemo(() => {
    if (!bulkActionRequest) {
      return null;
    }

    switch (bulkActionRequest.kind) {
      case "set-next-update-from-last-index":
        return {
          title: "Set next update from last time index value",
          actionLabel: "set next update from last time index value",
          confirmButtonLabel: "Set next update",
          confirmWord: "SET NEXT UPDATE",
          tone: "primary" as const,
          specialText:
            "This will recompute the next update timestamp from the last indexed value for the selected Data Nodes.",
        };
      case "set-index-stats-from-table":
        return {
          title: "Set index stats from table",
          actionLabel: "set index stats from table",
          confirmButtonLabel: "Set index stats",
          confirmWord: "SET INDEX STATS",
          tone: "primary" as const,
          specialText:
            "This will refresh index statistics from the backing table for the selected Data Nodes.",
        };
      case "refresh-table-search-index":
        return {
          title: "Refresh table search index",
          actionLabel: "refresh table search index",
          confirmButtonLabel: "Refresh search index",
          confirmWord: "REFRESH SEARCH INDEX",
          tone: "warning" as const,
          specialText:
            "This will rebuild the search index for the selected Data Nodes and may take some time.",
        };
      default:
        return {
          title: "Delete Data Nodes",
          actionLabel: "delete",
          confirmButtonLabel: "Delete Data Nodes",
          confirmWord: "DELETE DATA NODES",
          tone: "danger" as const,
          specialText: deleteOptions.fullDeleteDownstreamTables
            ? "This will permanently delete the selected Data Nodes and downstream dependencies. This action cannot be undone."
            : "This will permanently delete the selected Data Nodes. This action cannot be undone.",
        };
    }
  }, [bulkActionRequest, deleteOptions.fullDeleteDownstreamTables]);

  const bulkActionObjectSummary = useMemo(() => {
    if (!bulkActionRequest) {
      return null;
    }

    const selectedNames = bulkActionRequest.dataNodes.map((dataNode) => dataNode.storage_hash);

    if (selectedNames.length === 1) {
      return (
        <>
          <div className="font-medium">{selectedNames[0]}</div>
          <div className="mt-1 text-muted-foreground">
            Data node ID {bulkActionRequest.dataNodes[0]?.id}
          </div>
        </>
      );
    }

    return (
      <>
        <div className="font-medium">{bulkActionRequest.dataNodes.length} data nodes selected</div>
        <div className="mt-1 text-muted-foreground">
          {selectedNames.slice(0, 3).join(", ")}
          {selectedNames.length > 3 ? ", ..." : ""}
        </div>
      </>
    );
  }, [bulkActionRequest]);

  async function handleConfirmBulkAction() {
    if (!bulkActionRequest) {
      return null;
    }

    const selectedIds = bulkActionRequest.dataNodes.map((dataNode) => dataNode.id);

    switch (bulkActionRequest.kind) {
      case "set-next-update-from-last-index":
        return bulkSetDataNodeNextUpdateFromLastIndexValue(selectedIds);
      case "set-index-stats-from-table":
        return bulkSetDataNodeIndexStatsFromTable(selectedIds);
      case "refresh-table-search-index":
        return bulkRefreshDataNodeTableSearchIndex(selectedIds);
      case "delete":
        return bulkDeleteDataNodes({
          selectedIds,
          fullDeleteSelected: true,
          fullDeleteDownstreamTables: deleteOptions.fullDeleteDownstreamTables,
          deleteWithNoTable: deleteOptions.deleteWithNoTable,
          overrideProtection: deleteOptions.overrideProtection,
        });
      default:
        return null;
    }
  }

  async function handleBulkActionSuccess(result: unknown) {
    if (!bulkActionRequest) {
      return;
    }

    if (
      bulkActionRequest.kind === "delete" &&
      result &&
      typeof result === "object" &&
      "selected_deleted" in result
    ) {
      const payload = result as {
        selected_deleted: number;
        downstream_deleted: number;
        missing_table_deleted: number;
      };

      toast({
        variant:
          payload.selected_deleted > 0 ||
          payload.downstream_deleted > 0 ||
          payload.missing_table_deleted > 0
            ? "success"
            : "info",
        title: "Data node delete completed",
        description: [
          payload.selected_deleted ? `${payload.selected_deleted} selected deleted` : null,
          payload.downstream_deleted ? `${payload.downstream_deleted} downstream deleted` : null,
          payload.missing_table_deleted ? `${payload.missing_table_deleted} orphan rows deleted` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "No rows were deleted.",
      });
    } else if (
      result &&
      typeof result === "object" &&
      "success_count" in result &&
      "failed_count" in result
    ) {
      const payload = result as {
        success_count: number;
        failed_count: number;
      };

      toast({
        variant: payload.failed_count > 0 ? "info" : "success",
        title: payload.failed_count > 0 ? "Bulk action completed with failures" : "Bulk action completed",
        description:
          payload.failed_count > 0
            ? `${payload.success_count} succeeded, ${payload.failed_count} failed.`
            : `${payload.success_count} data nodes updated.`,
      });
    }

    dataNodeSelection.clearSelection();
    setBulkActionRequest(null);
    setDeleteOptions(defaultDataNodeDeleteOptions);

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["main_sequence", "data_nodes"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["main_sequence", "data_nodes", "local_time_series"],
      }),
    ]);
  }

  return (
    <div className="space-y-6">
      {isStandaloneLocalUpdateDetailOpen ? (
        <MainSequenceDataNodeLocalUpdateDetail
          localTimeSerieId={selectedLocalUpdateId}
          onClose={closeStandaloneLocalUpdateDetail}
          onOpenDataNodeDetail={openDataNodeDetail}
          onSelectTab={selectLocalUpdateTab}
          selectedTabId={selectedLocalUpdateTabId}
        />
      ) : isDataNodeDetailOpen ? (
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
                        onClick={() => selectDataNodeDetailTab(tab.id)}
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
                          <Card variant="nested">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">Column details</CardTitle>
                              <CardDescription>Column metadata from the source table configuration.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                              {dataNodeColumnDetails.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table
                                    className="w-full min-w-[920px] border-separate"
                                    style={{
                                      borderSpacing: "0 var(--table-row-gap-y)",
                                      fontSize: "var(--table-font-size)",
                                    }}
                                  >
                                    <thead>
                                      <tr
                                        className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                                        style={{ fontSize: "var(--table-meta-font-size)" }}
                                      >
                                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                          Column
                                        </th>
                                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                          Dtype
                                        </th>
                                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                          Label
                                        </th>
                                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                          Description
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {dataNodeColumnDetails.map((column) => (
                                        <tr key={`${column.source_config_id ?? "none"}-${column.column_name}`}>
                                          <td
                                            className="rounded-l-[calc(var(--radius)-2px)] border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] font-mono text-foreground"
                                            style={{ fontSize: "var(--table-meta-font-size)" }}
                                          >
                                            {column.column_name}
                                          </td>
                                          <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                            {column.dtype?.trim() || "Not set"}
                                          </td>
                                          <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                            {column.label?.trim() || "Not set"}
                                          </td>
                                          <td className="rounded-r-[calc(var(--radius)-2px)] border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
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
                  ) : selectedDetailTabId === "description" ? (
                    <Card variant="nested">
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">AI description</CardTitle>
                            <CardDescription>
                              This is AI-generated information about the DataNode.
                            </CardDescription>
                          </div>
                          {!generatedSearchDocument ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                void refreshSearchIndexMutation.mutateAsync();
                              }}
                              disabled={refreshSearchIndexMutation.isPending}
                            >
                              {refreshSearchIndexMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Refresh search index
                            </Button>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {dataNodeSummaryQuery.isLoading && !generatedSearchDocument ? (
                          <div className="flex min-h-40 items-center justify-center">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading AI description
                            </div>
                          </div>
                        ) : generatedSearchDocument ? (
                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-5 py-5">
                            <MarkdownContent content={generatedSearchDocument} />
                          </div>
                        ) : (
                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-4 py-4 text-sm text-muted-foreground">
                            <p>
                              No AI-generated description is available yet. This can be generated with the{" "}
                              <code>refresh_search_index</code> action.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : selectedDetailTabId === "local-time-series" ? (
                    <MainSequenceDataNodeLocalTimeSeriesTab
                      dataNodeId={selectedDataNodeId}
                      onCloseLocalUpdateDetail={closeLocalUpdateDetail}
                      onOpenDataNodeDetail={openDataNodeDetail}
                      onOpenLocalUpdateDetail={openLocalUpdateDetail}
                      onSelectLocalUpdateTab={selectLocalUpdateTab}
                      selectedLocalUpdateId={
                        Number.isFinite(selectedLocalUpdateId) && selectedLocalUpdateId > 0
                          ? selectedLocalUpdateId
                          : null
                      }
                      selectedLocalUpdateTabId={selectedLocalUpdateTabId}
                    />
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
                  actionMenuLabel="Data node actions"
                  bulkActions={dataNodeBulkActions}
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
              <table
                className="w-full min-w-[1220px] border-separate"
                style={{
                  borderSpacing: "0 var(--table-row-gap-y)",
                  fontSize: "var(--table-font-size)",
                }}
              >
                <thead>
                  <tr
                    className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                    style={{ fontSize: "var(--table-meta-font-size)" }}
                  >
                    <th className="w-12 px-3 py-[var(--table-standard-header-padding-y)]">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all visible data nodes"
                        checked={dataNodeSelection.allSelected}
                        indeterminate={dataNodeSelection.someSelected}
                        onChange={dataNodeSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Storage hash</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Identifier</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Data source</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Source class</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Created</th>
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
                              className="group inline-flex max-w-[240px] items-center gap-1 rounded-sm text-left font-mono text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                              style={{ fontSize: "var(--table-meta-font-size)" }}
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
                              <div
                                className="mt-0.5 text-muted-foreground"
                                style={{ fontSize: "var(--table-meta-font-size)" }}
                              >
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
                          <div
                            className="mt-0.5 text-muted-foreground"
                            style={{ fontSize: "var(--table-meta-font-size)" }}
                          >
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

      {bulkActionRequest && bulkActionConfig ? (
        <ActionConfirmationDialog
          title={bulkActionConfig.title}
          open
          onClose={() => {
            setBulkActionRequest(null);
            setDeleteOptions(defaultDataNodeDeleteOptions);
          }}
          tone={bulkActionConfig.tone}
          actionLabel={bulkActionConfig.actionLabel}
          objectLabel={bulkActionRequest.dataNodes.length > 1 ? "data nodes" : "data node"}
          confirmWord={bulkActionConfig.confirmWord}
          confirmButtonLabel={bulkActionConfig.confirmButtonLabel}
          description={
            bulkActionRequest.kind === "delete" ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Selected Data Nodes will be fully deleted. The options below extend that delete behavior.
                </div>
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-4 py-3">
                  <div className="space-y-3 text-sm text-foreground">
                    <div className="flex items-start gap-3">
                      <input
                        id="data-node-delete-downstream"
                        type="checkbox"
                        checked={deleteOptions.fullDeleteDownstreamTables}
                        onChange={(event) =>
                          setDeleteOptions((current) => ({
                            ...current,
                            fullDeleteDownstreamTables: event.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-border bg-background"
                      />
                      <label htmlFor="data-node-delete-downstream" className="space-y-1">
                        <div>Delete downstream dependencies</div>
                        <div className="text-xs text-muted-foreground">
                          Also delete downstream tables linked to the selected Data Nodes.
                        </div>
                      </label>
                    </div>
                    <div className="flex items-start gap-3">
                      <input
                        id="data-node-delete-orphans"
                        type="checkbox"
                        checked={deleteOptions.deleteWithNoTable}
                        onChange={(event) =>
                          setDeleteOptions((current) => ({
                            ...current,
                            deleteWithNoTable: event.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-border bg-background"
                      />
                      <label htmlFor="data-node-delete-orphans" className="space-y-1">
                        <div>Clean up orphan rows with no backing table</div>
                        <div className="text-xs text-muted-foreground">
                          Also scan for metadata rows whose backing table no longer exists.
                        </div>
                      </label>
                    </div>
                    <div className="flex items-start gap-3">
                      <input
                        id="data-node-delete-override"
                        type="checkbox"
                        checked={deleteOptions.overrideProtection}
                        onChange={(event) =>
                          setDeleteOptions((current) => ({
                            ...current,
                            overrideProtection: event.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-border bg-background"
                      />
                      <label htmlFor="data-node-delete-override" className="space-y-1">
                        <div>Override protection</div>
                        <div className="text-xs text-muted-foreground">
                          Staff/admin only. Use this when protected DataNodes must be removed.
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ) : undefined
          }
          specialText={bulkActionConfig.specialText}
          objectSummary={bulkActionObjectSummary}
          onConfirm={handleConfirmBulkAction}
          onSuccess={handleBulkActionSuccess}
          errorToast={{
            title: `${bulkActionConfig.title} failed`,
            description: (error) => formatMainSequenceError(error),
            variant: "error",
          }}
        />
      ) : null}
    </div>
  );
}
