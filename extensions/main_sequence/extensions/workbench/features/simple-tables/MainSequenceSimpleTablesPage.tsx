import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Database, HardDrive, Loader2, Table2, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeleteSimpleTables,
  bulkRefreshSimpleTableSearchIndex,
  fetchSimpleTableDetail,
  fetchSimpleTableSummary,
  formatMainSequenceError,
  listSimpleTables,
  mainSequenceRegistryPageSize,
  type EntitySummaryHeader,
  type SimpleTableDetail,
  type SimpleTableRecord,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";
import {
  MainSequenceSimpleTableUpdateDetail,
  type SimpleTableUpdateDetailTabId,
} from "./MainSequenceSimpleTableUpdateDetail";
import { MainSequenceSimpleTableSchemaGraph } from "./MainSequenceSimpleTableSchemaGraph";
import { MainSequenceSimpleTableSnapshotTab } from "./MainSequenceSimpleTableSnapshotTab";
import { MainSequenceSimpleTableUpdatesTab } from "./MainSequenceSimpleTableUpdatesTab";

const mainSequenceSimpleTableIdParam = "msSimpleTableId";
const mainSequenceSimpleTableTabParam = "msSimpleTableTab";
const mainSequenceSimpleTableUpdateIdParam = "msSimpleTableUpdateId";
const mainSequenceSimpleTableUpdateTabParam = "msSimpleTableUpdateTab";
const simpleTableDetailTabs = [
  { id: "details", label: "Details" },
  { id: "description", label: "Description" },
  { id: "data-snapshot", label: "Data Snapshot" },
  { id: "ulm-diagram", label: "ULM diagram" },
  { id: "local-update", label: "Local Update" },
] as const;
type SimpleTableDetailTabId = (typeof simpleTableDetailTabs)[number]["id"];
const defaultSimpleTableDetailTabId: SimpleTableDetailTabId = "details";

type SimpleTableBulkActionKind = "delete" | "delete-downstream" | "refresh-search-index";

type SimpleTableBulkActionRequest = {
  kind: SimpleTableBulkActionKind;
  tables: SimpleTableRecord[];
};

function getPrimaryLabel(table: SimpleTableRecord) {
  const candidates = [
    table.storage_hash,
    table.display_name,
    table.name,
    table.table_name,
    table.simple_table_name,
    table.title,
    table.identifier,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return `Simple Table ${table.id}`;
}

const creationDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getDataSourceLabel(table: SimpleTableRecord) {
  if (!table.data_source?.related_resource) {
    return "No data source";
  }

  return (
    table.data_source.related_resource.display_name?.trim() ||
    table.data_source.related_resource.name?.trim() ||
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

function buildSearchText(table: SimpleTableRecord) {
  return [
    String(table.id),
    table.identifier ?? "",
    table.storage_hash ?? "",
    table.source_class_name ?? "",
    table.description ?? "",
    getDataSourceLabel(table),
  ]
    .join(" ")
    .toLowerCase();
}

function getSimpleTableDescription(table?: SimpleTableRecord | SimpleTableDetail | null) {
  return typeof table?.description === "string" ? table.description.trim() : "";
}

function buildFallbackSimpleTableSummary(
  simpleTable: SimpleTableRecord | SimpleTableDetail,
): EntitySummaryHeader {
  const openForEveryone =
    typeof simpleTable.open_for_everyone === "boolean" ? simpleTable.open_for_everyone : false;
  const protectFromDeletion =
    typeof simpleTable.protect_from_deletion === "boolean" ? simpleTable.protect_from_deletion : false;

  return {
    entity: {
      id: simpleTable.id,
      type: "simple_table",
      title: simpleTable.storage_hash ?? getPrimaryLabel(simpleTable),
    },
    badges: [
      {
        key: "visibility",
        label: openForEveryone ? "Public" : "Private",
        tone: openForEveryone ? "success" : "neutral",
      },
      {
        key: "protection",
        label: protectFromDeletion ? "Protected" : "Deletable",
        tone: protectFromDeletion ? "warning" : "info",
      },
    ],
    inline_fields: [
      {
        key: "identifier",
        label: "Identifier",
        value: simpleTable.identifier?.trim() || "Not set",
        kind: "text",
      },
      {
        key: "data_source",
        label: "Data Source",
        value: getDataSourceLabel(simpleTable),
        kind: "text",
      },
      {
        key: "creation_date",
        label: "Created",
        value: formatCreationDate(simpleTable.creation_date),
        kind: "datetime",
      },
    ],
    highlight_fields: [
      {
        key: "source_class_name",
        label: "Source Class",
        value: simpleTable.source_class_name ?? "Unknown",
        kind: "code",
      },
      {
        key: "description",
        label: "Description",
        value: getSimpleTableDescription(simpleTable) || "Not set",
        kind: "text",
      },
    ],
    stats: [],
  };
}

function buildSimpleTableColumnDetails(simpleTable?: SimpleTableDetail | null) {
  if (Array.isArray(simpleTable?.sourcetableconfiguration?.columns_metadata)) {
    return simpleTable.sourcetableconfiguration.columns_metadata;
  }

  return (simpleTable?.columns ?? []).map((column) => ({
    source_config_id: column.id ?? null,
    column_name: column.column_name,
    dtype: column.db_type ?? null,
    label: column.attr_name ?? null,
    description: null,
  }));
}

function isSimpleTableDetailTabId(value: string | null): value is SimpleTableDetailTabId {
  return simpleTableDetailTabs.some((tab) => tab.id === value);
}

export function MainSequenceSimpleTablesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [filterValue, setFilterValue] = useState("");
  const [simpleTablesPageIndex, setSimpleTablesPageIndex] = useState(0);
  const [bulkActionRequest, setBulkActionRequest] = useState<SimpleTableBulkActionRequest | null>(null);
  const deferredFilterValue = useDeferredValue(filterValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedSimpleTableId = Number(searchParams.get(mainSequenceSimpleTableIdParam) ?? "");
  const requestedDetailTabId = searchParams.get(mainSequenceSimpleTableTabParam);
  const selectedSimpleTableUpdateId = Number(
    searchParams.get(mainSequenceSimpleTableUpdateIdParam) ?? "",
  );
  const selectedSimpleTableUpdateTabId = searchParams.get(mainSequenceSimpleTableUpdateTabParam);
  const isSimpleTableDetailOpen =
    Number.isFinite(selectedSimpleTableId) && selectedSimpleTableId > 0;
  const isSimpleTableUpdateDetailOpen =
    Number.isFinite(selectedSimpleTableUpdateId) && selectedSimpleTableUpdateId > 0;
  const isStandaloneSimpleTableUpdateDetailOpen =
    isSimpleTableUpdateDetailOpen && !isSimpleTableDetailOpen;
  const selectedDetailTabId: SimpleTableDetailTabId = isSimpleTableUpdateDetailOpen
    ? "local-update"
    : isSimpleTableDetailTabId(requestedDetailTabId)
      ? requestedDetailTabId
      : defaultSimpleTableDetailTabId;

  const simpleTablesQuery = useQuery({
    queryKey: ["main_sequence", "simple_tables", "list", simpleTablesPageIndex],
    queryFn: () =>
      listSimpleTables({
        limit: mainSequenceRegistryPageSize,
        offset: simpleTablesPageIndex * mainSequenceRegistryPageSize,
      }),
  });

  useEffect(() => {
    setSimpleTablesPageIndex(0);
  }, [deferredFilterValue]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((simpleTablesQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (simpleTablesPageIndex > totalPages - 1) {
      setSimpleTablesPageIndex(totalPages - 1);
    }
  }, [simpleTablesPageIndex, simpleTablesQuery.data?.count]);

  const simpleTableSummaryQuery = useQuery({
    queryKey: ["main_sequence", "simple_tables", "summary", selectedSimpleTableId],
    queryFn: () => fetchSimpleTableSummary(selectedSimpleTableId),
    enabled: isSimpleTableDetailOpen,
  });
  const simpleTableDetailQuery = useQuery({
    queryKey: ["main_sequence", "simple_tables", "detail", selectedSimpleTableId],
    queryFn: () => fetchSimpleTableDetail(selectedSimpleTableId),
    enabled: isSimpleTableDetailOpen,
  });

  const filteredTables = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return (simpleTablesQuery.data?.results ?? []).filter((table) => {
      if (!needle) {
        return true;
      }

      return buildSearchText(table).includes(needle);
    });
  }, [deferredFilterValue, simpleTablesQuery.data?.results]);

  const selectedSimpleTableFromList = useMemo(
    () =>
      (simpleTablesQuery.data?.results ?? []).find((table) => table.id === selectedSimpleTableId) ??
      null,
    [selectedSimpleTableId, simpleTablesQuery.data?.results],
  );
  const simpleTableSummary =
    simpleTableSummaryQuery.data ??
    (simpleTableDetailQuery.data
      ? buildFallbackSimpleTableSummary(simpleTableDetailQuery.data)
      : selectedSimpleTableFromList
        ? buildFallbackSimpleTableSummary(selectedSimpleTableFromList)
        : null);
  const simpleTableTitle =
    simpleTableSummary?.entity.title ??
    simpleTableDetailQuery.data?.storage_hash ??
    selectedSimpleTableFromList?.storage_hash ??
    (isSimpleTableDetailOpen ? `Simple table ${selectedSimpleTableId}` : "Simple table");
  const simpleTableColumnDetails = buildSimpleTableColumnDetails(simpleTableDetailQuery.data);
  const simpleTableDescription =
    getSimpleTableDescription(simpleTableDetailQuery.data) ||
    getSimpleTableDescription(selectedSimpleTableFromList);

  const simpleTableSelection = useRegistrySelection(filteredTables);

  const bulkActionMutation = useMutation({
    mutationFn: async (request: SimpleTableBulkActionRequest) => {
      const ids = request.tables.map((table) => table.id);

      switch (request.kind) {
        case "delete":
          return bulkDeleteSimpleTables({
            ids,
            fullDeleteSelected: true,
          });
        case "delete-downstream":
          return bulkDeleteSimpleTables({
            ids,
            fullDeleteDownstreamTables: true,
          });
        case "refresh-search-index":
          return bulkRefreshSimpleTableSearchIndex(ids);
        default:
          return null;
      }
    },
    onSuccess: async (result, request) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "simple_tables"],
      });

      if (request.kind === "refresh-search-index") {
        const refreshedCount =
          result && typeof result === "object" && "results" in result && Array.isArray(result.results)
            ? result.results.length
            : request.tables.length;

        toast({
          variant: "success",
          title: "Search index refreshed",
          description:
            refreshedCount === 1
              ? `${getPrimaryLabel(request.tables[0] ?? { id: 0 })} was refreshed.`
              : `Search index refreshed for ${refreshedCount} simple tables.`,
        });
      } else {
        const deletedCount =
          result && typeof result === "object" && "deleted_count" in result
            ? Number(result.deleted_count) || request.tables.length
            : Array.isArray(result)
              ? result.length
              : request.tables.length;

        toast({
          variant: "success",
          title:
            request.kind === "delete-downstream"
              ? "Downstream delete completed"
              : deletedCount === 1
                ? "Simple table deleted"
                : "Simple tables deleted",
          description:
            request.kind === "delete-downstream"
              ? deletedCount === 1
                ? "1 simple table was deleted."
                : `${deletedCount} simple tables were deleted.`
              : deletedCount === 1
                ? `${getPrimaryLabel(request.tables[0] ?? { id: 0 })} was deleted.`
                : `${deletedCount} simple tables were deleted.`,
        });
      }

      setBulkActionRequest(null);
      simpleTableSelection.clearSelection();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title:
          bulkActionRequest?.kind === "refresh-search-index"
            ? "Search index refresh failed"
            : "Simple table action failed",
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

  function openSimpleTableDetail(
    simpleTableId: number,
    tabId: SimpleTableDetailTabId = defaultSimpleTableDetailTabId,
  ) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceSimpleTableIdParam, String(simpleTableId));
      nextParams.set(mainSequenceSimpleTableTabParam, tabId);
      nextParams.delete(mainSequenceSimpleTableUpdateIdParam);
      nextParams.delete(mainSequenceSimpleTableUpdateTabParam);
    });
  }

  function closeSimpleTableDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceSimpleTableIdParam);
      nextParams.delete(mainSequenceSimpleTableTabParam);
      nextParams.delete(mainSequenceSimpleTableUpdateIdParam);
      nextParams.delete(mainSequenceSimpleTableUpdateTabParam);
    });
  }

  function openSimpleTableUpdateDetail(simpleTableUpdateId: number) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceSimpleTableTabParam, "local-update");
      nextParams.set(mainSequenceSimpleTableUpdateIdParam, String(simpleTableUpdateId));
      nextParams.set(mainSequenceSimpleTableUpdateTabParam, "details");
    });
  }

  function closeSimpleTableUpdateDetail() {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceSimpleTableTabParam, "local-update");
      nextParams.delete(mainSequenceSimpleTableUpdateIdParam);
      nextParams.delete(mainSequenceSimpleTableUpdateTabParam);
    });
  }

  function closeStandaloneSimpleTableUpdateDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceSimpleTableIdParam);
      nextParams.delete(mainSequenceSimpleTableTabParam);
      nextParams.delete(mainSequenceSimpleTableUpdateIdParam);
      nextParams.delete(mainSequenceSimpleTableUpdateTabParam);
    });
  }

  function selectSimpleTableUpdateTab(tabId: SimpleTableUpdateDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceSimpleTableTabParam, "local-update");
      nextParams.set(mainSequenceSimpleTableUpdateTabParam, tabId);
    });
  }

  function selectSimpleTableDetailTab(tabId: SimpleTableDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceSimpleTableIdParam, String(selectedSimpleTableId));
      nextParams.set(mainSequenceSimpleTableTabParam, tabId);

      if (tabId !== "local-update") {
        nextParams.delete(mainSequenceSimpleTableUpdateIdParam);
        nextParams.delete(mainSequenceSimpleTableUpdateTabParam);
      }
    });
  }

  function openBulkAction(kind: SimpleTableBulkActionKind) {
    const selectedItems = simpleTableSelection.selectedItems;

    if (selectedItems.length === 0) {
      return;
    }

    bulkActionMutation.reset();
    setBulkActionRequest({
      kind,
      tables: selectedItems,
    });
  }

  const bulkActions =
    simpleTableSelection.selectedCount > 0
      ? [
          {
            id: "delete-simple-table",
            label: "Delete Table",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => openBulkAction("delete"),
          },
          {
            id: "delete-downstream-simple-tables",
            label: "Delete Downstream Tables",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => openBulkAction("delete-downstream"),
          },
          {
            id: "refresh-table-search-index",
            label: "Refresh table search index",
            tone: "primary" as const,
            onSelect: () => openBulkAction("refresh-search-index"),
          },
        ]
      : [];

  const bulkActionConfig = useMemo(() => {
    if (!bulkActionRequest) {
      return null;
    }

    switch (bulkActionRequest.kind) {
      case "delete":
        return {
          title: "Delete Table",
          actionLabel: "delete",
          confirmButtonLabel: "Delete Table",
          confirmWord: "DELETE",
          tone: "danger" as const,
          specialText: undefined,
        };
      case "delete-downstream":
        return {
          title: "Delete Downstream Tables",
          actionLabel: "delete",
          confirmButtonLabel: "Delete Downstream Tables",
          confirmWord: "DELETE",
          tone: "danger" as const,
          specialText:
            "The following command will delete all the Simple Tables that flow downstream are you sure you want to proceed?",
        };
      default:
        return {
          title: "Refresh table search index",
          actionLabel: "refresh table search index",
          confirmButtonLabel: "Refresh table search index",
          confirmWord: "REFRESH SEARCH INDEX",
          tone: "primary" as const,
          specialText: "This will refresh the table search index",
        };
    }
  }, [bulkActionRequest]);

  const bulkActionObjectSummary = useMemo(() => {
    if (!bulkActionRequest) {
      return null;
    }

    if (bulkActionRequest.tables.length === 1) {
      return (
        <>
          <div className="font-medium">{getPrimaryLabel(bulkActionRequest.tables[0] ?? { id: 0 })}</div>
          <div className="mt-1 text-muted-foreground">
            {`Simple table ID ${bulkActionRequest.tables[0]?.id ?? ""}`}
          </div>
        </>
      );
    }

    return (
      <>
        <div className="font-medium">{bulkActionRequest.tables.length} simple tables selected</div>
        <div className="mt-1 text-muted-foreground">
          {bulkActionRequest.tables
            .slice(0, 3)
            .map((table) => getPrimaryLabel(table))
            .join(", ")}
          {bulkActionRequest.tables.length > 3 ? ", ..." : ""}
        </div>
      </>
    );
  }, [bulkActionRequest]);

  return (
    <div className="space-y-6">
      {isStandaloneSimpleTableUpdateDetailOpen ? (
        <MainSequenceSimpleTableUpdateDetail
          onClose={closeStandaloneSimpleTableUpdateDetail}
          onOpenSimpleTableDetail={openSimpleTableDetail}
          onSelectTab={selectSimpleTableUpdateTab}
          selectedTabId={selectedSimpleTableUpdateTabId}
          simpleTableUpdateId={selectedSimpleTableUpdateId}
        />
      ) : isSimpleTableDetailOpen ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button
                type="button"
                className="transition-colors hover:text-foreground"
                onClick={closeSimpleTableDetail}
              >
                Simple tables
              </button>
              <span>/</span>
              <span className="text-foreground">{simpleTableTitle}</span>
            </div>
            <Button variant="outline" size="sm" onClick={closeSimpleTableDetail}>
              <ArrowLeft className="h-4 w-4" />
              Back to simple tables
            </Button>
          </div>

          {simpleTableSummaryQuery.isLoading && !simpleTableSummary ? (
            <Card>
              <CardContent className="flex min-h-48 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading simple table details
                </div>
              </CardContent>
            </Card>
          ) : null}

          {simpleTableSummaryQuery.isError && !simpleTableSummary ? (
            <Card>
              <CardContent className="p-5">
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(simpleTableSummaryQuery.error)}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {simpleTableSummary ? (
            <>
              <MainSequenceEntitySummaryCard summary={simpleTableSummary} />

              <Card>
                <CardHeader className="border-b border-border/70 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {simpleTableDetailTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={
                          tab.id === selectedDetailTabId
                            ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                            : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
                        }
                        onClick={() => selectSimpleTableDetailTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="pt-5">
                  {selectedDetailTabId === "details" ? (
                    <div className="space-y-4">
                      {simpleTableDetailQuery.isLoading ? (
                        <div className="flex min-h-48 items-center justify-center">
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading simple table details
                          </div>
                        </div>
                      ) : null}

                      {simpleTableDetailQuery.isError ? (
                        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                          {formatMainSequenceError(simpleTableDetailQuery.error)}
                        </div>
                      ) : null}

                      {!simpleTableDetailQuery.isLoading && !simpleTableDetailQuery.isError ? (
                        <Card variant="nested">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Column details</CardTitle>
                            <CardDescription>
                              Column metadata from the source table configuration.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {simpleTableColumnDetails.length > 0 ? (
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
                                    {simpleTableColumnDetails.map((column) => (
                                      <tr
                                        key={`${column.source_config_id ?? "none"}-${column.column_name}`}
                                      >
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
                                No column metadata is available for this simple table.
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ) : null}
                    </div>
                  ) : selectedDetailTabId === "description" ? (
                    <Card variant="nested">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Description</CardTitle>
                        <CardDescription>
                          Description stored on the Simple Table resource.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {simpleTableDetailQuery.isLoading && !simpleTableDescription ? (
                          <div className="flex min-h-40 items-center justify-center">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading description
                            </div>
                          </div>
                        ) : simpleTableDescription ? (
                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-5 py-5">
                            <MarkdownContent content={simpleTableDescription} />
                          </div>
                        ) : (
                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-4 py-4 text-sm text-muted-foreground">
                            No description is available for this simple table.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : selectedDetailTabId === "data-snapshot" ? (
                    <MainSequenceSimpleTableSnapshotTab simpleTableId={selectedSimpleTableId} />
                  ) : selectedDetailTabId === "ulm-diagram" ? (
                    <MainSequenceSimpleTableSchemaGraph simpleTableId={selectedSimpleTableId} />
                  ) : (
                    <MainSequenceSimpleTableUpdatesTab
                      onCloseSimpleTableUpdateDetail={closeSimpleTableUpdateDetail}
                      onOpenSimpleTableDetail={openSimpleTableDetail}
                      onOpenSimpleTableUpdateDetail={openSimpleTableUpdateDetail}
                      onSelectSimpleTableUpdateTab={selectSimpleTableUpdateTab}
                      selectedSimpleTableUpdateId={
                        Number.isFinite(selectedSimpleTableUpdateId) && selectedSimpleTableUpdateId > 0
                          ? selectedSimpleTableUpdateId
                          : null
                      }
                      selectedSimpleTableUpdateTabId={selectedSimpleTableUpdateTabId}
                      simpleTableId={selectedSimpleTableId}
                    />
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
            title="Simple Tables"
            description="Browse ts_manager simple_table rows and bulk delete selected entries."
            actions={<Badge variant="neutral">{`${simpleTablesQuery.data?.count ?? 0} simple tables`}</Badge>}
          />

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="space-y-4">
                <div>
                  <CardTitle>Simple table registry</CardTitle>
                  <CardDescription>
                    Search across identifiers, hashes, sources, descriptions, and backing data
                    sources.
                  </CardDescription>
                </div>
                <MainSequenceRegistrySearch
                  actionMenuLabel="Simple table actions"
                  accessory={<Badge variant="neutral">{`${simpleTablesQuery.data?.count ?? 0} rows`}</Badge>}
                  bulkActions={bulkActions}
                  clearSelectionLabel="Clear selection"
                  onClearSelection={simpleTableSelection.clearSelection}
                  renderSelectionSummary={(selectionCount) =>
                    `${selectionCount} simple table${selectionCount === 1 ? "" : "s"} selected`
                  }
                  value={filterValue}
                  onChange={(event) => setFilterValue(event.target.value)}
                  placeholder="Filter by identifier, id, hash, source class, or data source"
                  searchClassName="max-w-xl"
                  selectionCount={simpleTableSelection.selectedCount}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {simpleTablesQuery.isLoading ? (
                <div className="flex min-h-64 items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading simple tables
                  </div>
                </div>
              ) : null}

              {simpleTablesQuery.isError ? (
                <div className="p-5">
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {formatMainSequenceError(simpleTablesQuery.error)}
                  </div>
                </div>
              ) : null}

              {!simpleTablesQuery.isLoading &&
              !simpleTablesQuery.isError &&
              filteredTables.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                    <Table2 className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-sm font-medium text-foreground">No simple tables found</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Clear the current filter or confirm the authenticated user can view simple tables.
                  </p>
                </div>
              ) : null}

              {!simpleTablesQuery.isLoading &&
              !simpleTablesQuery.isError &&
              filteredTables.length > 0 ? (
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
                            ariaLabel="Select all visible simple tables"
                            checked={simpleTableSelection.allSelected}
                            indeterminate={simpleTableSelection.someSelected}
                            onChange={simpleTableSelection.toggleAll}
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
                      {filteredTables.map((table) => {
                        const selected = simpleTableSelection.isSelected(table.id);

                        return (
                          <tr key={table.id}>
                            <td className={getRegistryTableCellClassName(selected, "left")}>
                              <MainSequenceSelectionCheckbox
                                ariaLabel={`Select ${getPrimaryLabel(table)}`}
                                checked={selected}
                                onChange={() => simpleTableSelection.toggleSelection(table.id)}
                              />
                            </td>
                            <td className={getRegistryTableCellClassName(selected)}>
                              <div className="flex items-start gap-2">
                                <HardDrive className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <button
                                  type="button"
                                  className="group inline-flex max-w-[240px] items-center gap-1 rounded-sm text-left font-mono text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                                  style={{ fontSize: "var(--table-meta-font-size)" }}
                                  onClick={() => openSimpleTableDetail(table.id)}
                                  title={table.storage_hash ?? getPrimaryLabel(table)}
                                >
                                  <span className="truncate">{table.storage_hash ?? getPrimaryLabel(table)}</span>
                                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                                </button>
                              </div>
                            </td>
                            <td className={getRegistryTableCellClassName(selected)}>
                              <div className="flex items-start gap-2">
                                <Database className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div className="min-w-0">
                                  <div className="font-medium text-foreground">
                                    {table.identifier?.trim() || "No identifier"}
                                  </div>
                                  <div
                                    className="mt-0.5 text-muted-foreground"
                                    style={{ fontSize: "var(--table-meta-font-size)" }}
                                  >
                                    ID {table.id}
                                    {table.description?.trim() ? ` · ${table.description.trim()}` : ""}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className={getRegistryTableCellClassName(selected)}>
                              <div className="text-foreground">{getDataSourceLabel(table)}</div>
                            </td>
                            <td className={getRegistryTableCellClassName(selected)}>
                              <div className="text-foreground">{table.source_class_name ?? "Unknown"}</div>
                              <div
                                className="mt-0.5 text-muted-foreground"
                                style={{ fontSize: "var(--table-meta-font-size)" }}
                              >
                                Frequency: {table.data_frequency_id ?? "Not set"}
                              </div>
                            </td>
                            <td className={getRegistryTableCellClassName(selected, "right")}>
                              <div className="text-foreground">{formatCreationDate(table.creation_date)}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {!simpleTablesQuery.isLoading &&
          !simpleTablesQuery.isError &&
          (simpleTablesQuery.data?.count ?? 0) > 0 ? (
            <MainSequenceRegistryPagination
              count={simpleTablesQuery.data?.count ?? 0}
              itemLabel="simple tables"
              pageIndex={simpleTablesPageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setSimpleTablesPageIndex}
            />
          ) : null}
        </>
      )}

      {bulkActionRequest && bulkActionConfig ? (
        <ActionConfirmationDialog
          title={bulkActionConfig.title}
          open
          onClose={() => {
            if (!bulkActionMutation.isPending) {
              setBulkActionRequest(null);
            }
          }}
          tone={bulkActionConfig.tone}
          actionLabel={bulkActionConfig.actionLabel}
          objectLabel={bulkActionRequest.tables.length > 1 ? "simple tables" : "simple table"}
          confirmWord={bulkActionConfig.confirmWord}
          confirmButtonLabel={bulkActionConfig.confirmButtonLabel}
          description={
            bulkActionRequest.kind === "refresh-search-index"
              ? "This action refreshes the search index for the selected simple tables."
              : "This action applies to the selected simple tables."
          }
          specialText={bulkActionConfig.specialText}
          objectSummary={bulkActionObjectSummary}
          error={
            bulkActionMutation.isError ? formatMainSequenceError(bulkActionMutation.error) : undefined
          }
          isPending={bulkActionMutation.isPending}
          onConfirm={() => bulkActionMutation.mutateAsync(bulkActionRequest)}
        />
      ) : null}
    </div>
  );
}
