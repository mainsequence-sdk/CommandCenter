import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Database,
  HardDrive,
  Loader2,
  Table2,
  Trash2,
  Wrench,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeleteMetaTablesWithCascade,
  bulkDeleteMetaTables,
  bulkRefreshMetaTableSearchIndex,
  deleteMetaTable,
  fetchMetaTableDetail,
  fetchMetaTableSummary,
  formatMainSequenceError,
  getTsManagerRecordIdentifier,
  listMetaTableNamespaces,
  listMetaTables,
  MainSequenceApiError,
  mainSequenceRegistryPageSize,
  syncMetaTableFromPhysical,
  type EntitySummaryHeader,
  type MainSequenceNamespaceOptionRecord,
  type MetaTableDetail,
  type MetaTableDeleteWithCascadeResponse,
  type MetaTableSyncFromPhysicalResponse,
  type MetaTableRecord,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";
import { MainSequenceMetaTableSchemaGraph } from "./MainSequenceSimpleTableSchemaGraph";
import { MainSequenceMetaTableSnapshotTab } from "./MainSequenceSimpleTableSnapshotTab";

const mainSequenceMetaTableIdParam = "msMetaTableUid";
const mainSequenceMetaTableTabParam = "msMetaTableTab";
const metaTableDetailTabs = [
  { id: "details", label: "Details" },
  { id: "description", label: "Description" },
  { id: "data-snapshot", label: "Data Snapshot" },
  { id: "ulm-diagram", label: "ULM diagram" },
] as const;
type MetaTableDetailTabId = (typeof metaTableDetailTabs)[number]["id"];
const defaultMetaTableDetailTabId: MetaTableDetailTabId = "details";
const allNamespacesOptionValue = "__all__";

type MetaTableActionKind =
  | "delete"
  | "delete-with-cascade"
  | "refresh-search-index"
  | "sync-from-physical";

type MetaTableActionRequest = {
  kind: MetaTableActionKind;
  tables: MetaTableRecord[];
};

type MetaTableColumnDetailRow = {
  key: string;
  name: string;
  label: string | null;
  logicalName: string | null;
  dataType: string | null;
  backendType: string | null;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  ordinalPosition: number | null;
  description: string | null;
};

type MetaTableIndexDetailRow = {
  key: string;
  name: string;
  columns: string[];
  unique: boolean | null;
  method: string | null;
  expression: string | null;
};

type MetaTableForeignKeyDetailRow = {
  key: string;
  name: string;
  sourceColumns: string[];
  targetTableUid: string | null;
  targetTableStorageHash: string | null;
  targetColumns: string[];
  onDelete: string | null;
};

function getPrimaryLabel(table: MetaTableRecord) {
  const candidates = [
    table.table_name,
    table.meta_table_name,
    table.display_name,
    table.name,
    table.title,
    table.identifier,
    table.storage_hash,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return `Meta Table ${table.uid}`;
}

function getMetaTableListTableName(table: MetaTableRecord) {
  const candidates = [
    table.table_name,
    table.meta_table_name,
    table.physical_table_name,
    table.identifier,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return getPrimaryLabel(table);
}

function getMetaTableUid(table: MetaTableRecord) {
  return table.uid;
}

const creationDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getDataSourceLabel(table: MetaTableRecord) {
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

function buildSearchText(table: MetaTableRecord) {
  return [
    table.identifier ?? "",
    table.storage_hash ?? "",
    table.namespace ?? "",
    table.description ?? "",
    getDataSourceLabel(table),
  ]
    .join(" ")
    .toLowerCase();
}

function getMetaTableDescription(table?: MetaTableRecord | MetaTableDetail | null) {
  return typeof table?.description === "string" ? table.description.trim() : "";
}

function formatMetaTableValue(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : "Not set";
}

function formatMetaTableListValue(values: string[]) {
  return values.length > 0 ? values.join(", ") : "Not set";
}

function getNamespaceOptionLabel(namespace: MainSequenceNamespaceOptionRecord) {
  return namespace.display_name;
}

function getNamespaceOptionDescription(namespace: MainSequenceNamespaceOptionRecord) {
  return `Meta tables: ${namespace.table_count}`;
}

function getNamespaceOptionValue(namespace: MainSequenceNamespaceOptionRecord) {
  return namespace.filters.namespace?.trim() || namespace.namespace.trim();
}

function formatManagementMode(value?: string | null) {
  if (!value?.trim()) {
    return "Not set";
  }

  return value
    .trim()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildFallbackMetaTableSummary(
  metaTable: MetaTableRecord | MetaTableDetail,
): EntitySummaryHeader {
  const openForEveryone =
    typeof metaTable.open_for_everyone === "boolean" ? metaTable.open_for_everyone : false;
  const protectFromDeletion =
    typeof metaTable.protect_from_deletion === "boolean" ? metaTable.protect_from_deletion : false;

  return {
    entity: {
      id: metaTable.uid || metaTable.id || getPrimaryLabel(metaTable),
      type: "meta_table",
      title: metaTable.storage_hash ?? getPrimaryLabel(metaTable),
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
        value: metaTable.identifier?.trim() || "Not set",
        kind: "text",
      },
      {
        key: "data_source",
        label: "Data Source",
        value: getDataSourceLabel(metaTable),
        kind: "text",
      },
      {
        key: "creation_date",
        label: "Created",
        value: formatCreationDate(metaTable.creation_date),
        kind: "datetime",
      },
    ],
    highlight_fields: [
      {
        key: "namespace",
        label: "Namespace",
        value: formatMetaTableValue(metaTable.namespace),
        kind: "code",
      },
      {
        key: "description",
        label: "Description",
        value: getMetaTableDescription(metaTable) || "Not set",
        kind: "text",
      },
    ],
    stats: [],
  };
}

function buildMetaTableColumnDetails(metaTable?: MetaTableDetail | null) {
  return (metaTable?.columns ?? []).map((column, index) => ({
    key: `${column.id ?? index}-${column.name}`,
    name: column.name,
    label: column.label ?? null,
    logicalName: column.logical_name ?? null,
    dataType: column.data_type ?? null,
    backendType: column.backend_type ?? null,
    nullable: column.nullable,
    primaryKey: column.primary_key,
    unique: column.unique,
    ordinalPosition: column.ordinal_position ?? null,
    description: column.description ?? null,
  }));
}

function buildMetaTableIndexDetails(metaTable?: MetaTableDetail | null) {
  return (metaTable?.indexes_meta ?? []).map((index, position) => ({
    key: `${index.name}-${position}`,
    name: index.name,
    columns: index.columns ?? [],
    unique: typeof index.unique === "boolean" ? index.unique : null,
    method: index.method ?? null,
    expression: index.expression ?? null,
  }));
}

function buildMetaTableForeignKeyDetails(
  foreignKeys: MetaTableDetail["foreign_keys"] | MetaTableDetail["incoming_fks"] | undefined,
) {
  return (foreignKeys ?? []).map((foreignKey, position) => ({
    key: `${foreignKey.name}-${position}`,
    name: foreignKey.name,
    sourceColumns: foreignKey.source_columns ?? [],
    targetTableUid: foreignKey.target_table_uid ?? null,
    targetTableStorageHash: foreignKey.target_table_storage_hash ?? null,
    targetColumns: foreignKey.target_columns ?? [],
    onDelete: foreignKey.on_delete ?? null,
  }));
}

function buildMetaTableFactItems(metaTable?: MetaTableDetail | null) {
  if (!metaTable) {
    return [];
  }

  return [
    {
      key: "namespace",
      label: "Namespace",
      value: formatMetaTableValue(metaTable.namespace),
      monospace: true,
    },
    {
      key: "data_source",
      label: "Data Source",
      value: getDataSourceLabel(metaTable),
      monospace: false,
    },
    {
      key: "management_mode",
      label: "Management Mode",
      value: formatManagementMode(metaTable.management_mode),
      monospace: false,
    },
    {
      key: "physical_table_name",
      label: "Physical Table",
      value: formatMetaTableValue(metaTable.physical_table_name ?? metaTable.storage_hash ?? null),
      monospace: true,
    },
    {
      key: "contract_version",
      label: "Contract Version",
      value: formatMetaTableValue(metaTable.contract_version),
      monospace: true,
    },
  ];
}

function getMetaTableActionErrorDescription(error: unknown, actionKind: MetaTableActionKind) {
  if (
    actionKind === "delete" &&
    error instanceof MainSequenceApiError &&
    error.status === 409
  ) {
    return `${formatMainSequenceError(error)} Use Delete with Cascade if you want to remove the referencing tables too.`;
  }

  return formatMainSequenceError(error);
}

function isMetaTableDetailTabId(value: string | null): value is MetaTableDetailTabId {
  return metaTableDetailTabs.some((tab) => tab.id === value);
}

export function MainSequenceMetaTablesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [filterValue, setFilterValue] = useState("");
  const [selectedNamespaceValue, setSelectedNamespaceValue] = useState("");
  const [metaTablesPageIndex, setMetaTablesPageIndex] = useState(0);
  const [actionRequest, setActionRequest] = useState<MetaTableActionRequest | null>(null);
  const deferredFilterValue = useDeferredValue(filterValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedMetaTableIdentifier =
    searchParams.get(mainSequenceMetaTableIdParam)?.trim() || null;
  const requestedDetailTabId = searchParams.get(mainSequenceMetaTableTabParam);
  const isMetaTableDetailOpen = Boolean(selectedMetaTableIdentifier);
  const selectedDetailTabId: MetaTableDetailTabId = isMetaTableDetailTabId(requestedDetailTabId)
      ? requestedDetailTabId
      : defaultMetaTableDetailTabId;

  const metaTableNamespacesQuery = useQuery({
    queryKey: ["main_sequence", "meta_tables", "namespaces"],
    queryFn: () => listMetaTableNamespaces(),
  });

  const metaTableNamespaceOptions = metaTableNamespacesQuery.data ?? [];
  const effectiveSelectedNamespace =
    selectedNamespaceValue && selectedNamespaceValue !== allNamespacesOptionValue
      ? selectedNamespaceValue
      : null;
  const isMetaTableNamespaceBootstrapReady =
    !metaTableNamespacesQuery.isLoading &&
    (!metaTableNamespaceOptions.length || selectedNamespaceValue.length > 0);

  const metaTablesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "meta_tables",
      "list",
      metaTablesPageIndex,
      effectiveSelectedNamespace,
      deferredFilterValue,
    ],
    queryFn: () =>
      listMetaTables({
        limit: mainSequenceRegistryPageSize,
        offset: metaTablesPageIndex * mainSequenceRegistryPageSize,
        namespace: effectiveSelectedNamespace ?? undefined,
        search: deferredFilterValue || undefined,
      }),
    enabled: isMetaTableNamespaceBootstrapReady && !metaTableNamespacesQuery.isError,
  });

  useEffect(() => {
    if (metaTableNamespaceOptions.length === 0) {
      if (!metaTableNamespacesQuery.isLoading && selectedNamespaceValue !== allNamespacesOptionValue) {
        setSelectedNamespaceValue(allNamespacesOptionValue);
      }
      return;
    }

    if (selectedNamespaceValue === allNamespacesOptionValue) {
      return;
    }

    const optionValues = new Set(metaTableNamespaceOptions.map(getNamespaceOptionValue));

    if (!selectedNamespaceValue || !optionValues.has(selectedNamespaceValue)) {
      setSelectedNamespaceValue(getNamespaceOptionValue(metaTableNamespaceOptions[0]!));
    }
  }, [
    metaTableNamespaceOptions,
    metaTableNamespacesQuery.isLoading,
    selectedNamespaceValue,
  ]);

  useEffect(() => {
    setMetaTablesPageIndex(0);
  }, [deferredFilterValue, effectiveSelectedNamespace]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((metaTablesQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );
    const hasBackendPageBoundary =
      Boolean(metaTablesQuery.data?.next) || Boolean(metaTablesQuery.data?.previous);

    if (!hasBackendPageBoundary && metaTablesPageIndex > totalPages - 1) {
      setMetaTablesPageIndex(totalPages - 1);
    }
  }, [
    metaTablesPageIndex,
    metaTablesQuery.data?.count,
    metaTablesQuery.data?.next,
    metaTablesQuery.data?.previous,
  ]);

  const metaTableSummaryQuery = useQuery({
    queryKey: ["main_sequence", "meta_tables", "summary", selectedMetaTableIdentifier],
    queryFn: () => fetchMetaTableSummary(selectedMetaTableIdentifier!),
    enabled: isMetaTableDetailOpen,
  });
  const metaTableDetailQuery = useQuery({
    queryKey: ["main_sequence", "meta_tables", "detail", selectedMetaTableIdentifier],
    queryFn: () => fetchMetaTableDetail(selectedMetaTableIdentifier!),
    enabled: isMetaTableDetailOpen,
  });

  const filteredTables = metaTablesQuery.data?.results ?? [];

  const selectedMetaTableFromList = useMemo(
    () =>
      (metaTablesQuery.data?.results ?? []).find(
        (table) => getTsManagerRecordIdentifier(table) === selectedMetaTableIdentifier,
      ) ??
      null,
    [selectedMetaTableIdentifier, metaTablesQuery.data?.results],
  );
  const metaTableSummary =
    metaTableSummaryQuery.data ??
    (metaTableDetailQuery.data
      ? buildFallbackMetaTableSummary(metaTableDetailQuery.data)
      : selectedMetaTableFromList
        ? buildFallbackMetaTableSummary(selectedMetaTableFromList)
        : null);
  const metaTableTitle =
    metaTableSummary?.entity.title ??
    metaTableDetailQuery.data?.storage_hash ??
    selectedMetaTableFromList?.storage_hash ??
    (isMetaTableDetailOpen ? `Meta table ${selectedMetaTableIdentifier}` : "Meta table");
  const metaTableColumnDetails = buildMetaTableColumnDetails(metaTableDetailQuery.data);
  const metaTableIndexDetails = buildMetaTableIndexDetails(metaTableDetailQuery.data);
  const metaTableForeignKeyDetails = buildMetaTableForeignKeyDetails(
    metaTableDetailQuery.data?.foreign_keys,
  );
  const metaTableIncomingForeignKeyDetails = buildMetaTableForeignKeyDetails(
    metaTableDetailQuery.data?.incoming_fks,
  );
  const metaTableFactItems = buildMetaTableFactItems(metaTableDetailQuery.data);
  const metaTableDescription =
    getMetaTableDescription(metaTableDetailQuery.data) ||
    getMetaTableDescription(selectedMetaTableFromList);

  const metaTableSelection = useRegistrySelection(filteredTables, getMetaTableUid);

  const actionMutation = useMutation({
    mutationFn: async (request: MetaTableActionRequest) => {
      const uids = request.tables
        .map((table) => table.uid.trim())
        .filter((uid): uid is string => Boolean(uid));

      switch (request.kind) {
        case "delete":
          if (uids.length === 1) {
            return deleteMetaTable(uids[0]!);
          }

          return bulkDeleteMetaTables({
            uids,
          });
        case "delete-with-cascade":
          return bulkDeleteMetaTablesWithCascade({
            uids,
            confirm_cascade_delete: true,
          });
        case "refresh-search-index":
          return bulkRefreshMetaTableSearchIndex(uids);
        case "sync-from-physical":
          if (uids.length !== 1) {
            throw new Error("Sync from physical requires exactly one MetaTable.");
          }

          return syncMetaTableFromPhysical(uids[0]!);
        default:
          return null;
      }
    },
    onSuccess: async (result, request) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "meta_tables"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "data_nodes"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "namespaces"],
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
              ? `${request.tables[0] ? getPrimaryLabel(request.tables[0]) : "Meta table"} was refreshed.`
              : `Search index refreshed for ${refreshedCount} meta tables.`,
        });
      } else if (request.kind === "sync-from-physical") {
        const syncResult =
          result && typeof result === "object"
            ? (result as MetaTableSyncFromPhysicalResponse)
            : null;

        await queryClient.invalidateQueries({
          queryKey: ["main_sequence", "meta_tables", "summary"],
        });
        await queryClient.invalidateQueries({
          queryKey: ["main_sequence", "meta_tables", "detail"],
        });

        toast({
          variant: "success",
          title: "MetaTable synced from physical",
          description:
            typeof syncResult?.detail === "string" && syncResult.detail.trim()
              ? syncResult.detail.trim()
              : `${request.tables[0] ? getPrimaryLabel(request.tables[0]) : "MetaTable"} was synced from the physical table.`,
        });
      } else if (request.kind === "delete-with-cascade") {
        const cascadeResult =
          result && typeof result === "object"
            ? (result as MetaTableDeleteWithCascadeResponse)
            : null;
        const deletedMetaTableCount = cascadeResult?.deleted_meta_table_count ?? request.tables.length;
        const deletedDynamicTableCount = cascadeResult?.deleted_dynamic_table_count ?? 0;

        toast({
          variant: "success",
          title: "Meta table cascade delete complete",
          description:
            deletedDynamicTableCount > 0
              ? `${deletedMetaTableCount} meta table${deletedMetaTableCount === 1 ? "" : "s"} and ${deletedDynamicTableCount} data node${deletedDynamicTableCount === 1 ? "" : "s"} were deleted.`
              : `${deletedMetaTableCount} meta table${deletedMetaTableCount === 1 ? "" : "s"} were deleted with cascade.`,
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
            deletedCount === 1
                ? "Meta table deleted"
                : "Meta tables deleted",
          description:
            deletedCount === 1
                ? `${request.tables[0] ? getPrimaryLabel(request.tables[0]) : "Meta table"} was deleted.`
                : `${deletedCount} meta tables were deleted.`,
        });
      }

      if (
        (request.kind === "delete" || request.kind === "delete-with-cascade") &&
        selectedMetaTableIdentifier &&
        request.tables.some((table) => table.uid === selectedMetaTableIdentifier)
      ) {
        closeMetaTableDetail();
      }

      setActionRequest(null);
      metaTableSelection.clearSelection();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title:
          actionRequest?.kind === "refresh-search-index"
            ? "Search index refresh failed"
            : actionRequest?.kind === "sync-from-physical"
              ? "Sync from physical failed"
            : "Meta table action failed",
        description: getMetaTableActionErrorDescription(error, actionRequest?.kind ?? "delete"),
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

  function openMetaTableDetail(
    metaTableIdentifier: string,
    tabId: MetaTableDetailTabId = defaultMetaTableDetailTabId,
  ) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceMetaTableIdParam, String(metaTableIdentifier));
      nextParams.set(mainSequenceMetaTableTabParam, tabId);
    });
  }

  function closeMetaTableDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceMetaTableIdParam);
      nextParams.delete(mainSequenceMetaTableTabParam);
    });
  }

  function selectMetaTableDetailTab(tabId: MetaTableDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceMetaTableIdParam, String(selectedMetaTableIdentifier));
      nextParams.set(mainSequenceMetaTableTabParam, tabId);
    });
  }

  function openAction(kind: MetaTableActionKind, tables: MetaTableRecord[]) {
    if (tables.length === 0) {
      return;
    }

    actionMutation.reset();
    setActionRequest({
      kind,
      tables,
    });
  }

  function openBulkAction(kind: MetaTableActionKind) {
    const selectedItems = metaTableSelection.selectedItems;

    openAction(kind, selectedItems);
  }

  function openDetailAction(kind: MetaTableActionKind) {
    if (metaTableDetailQuery.data) {
      openAction(kind, [metaTableDetailQuery.data]);
      return;
    }

    if (selectedMetaTableFromList) {
      openAction(kind, [selectedMetaTableFromList]);
    }
  }

  const bulkActions =
    metaTableSelection.selectedCount > 0
      ? [
          {
            id: "delete-meta-table",
            label: "Delete Table",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => openBulkAction("delete"),
          },
          {
            id: "delete-meta-table-with-cascade",
            label: "Delete with Cascade",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => openBulkAction("delete-with-cascade"),
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
    if (!actionRequest) {
      return null;
    }

    switch (actionRequest.kind) {
      case "delete":
        return {
          title: "Delete Table",
          actionLabel: "delete",
          confirmButtonLabel: "Delete Table",
          confirmWord: "DELETE",
          tone: "danger" as const,
          specialText: undefined,
        };
      case "delete-with-cascade":
        return {
          title: "Delete with Cascade",
          actionLabel: "delete with cascade",
          confirmButtonLabel: "Delete with Cascade",
          confirmWord: "DELETE WITH CASCADE",
          tone: "danger" as const,
          specialText:
            "This will recursively delete referencing MetaTables and Data Nodes, and it will drop platform-managed physical tables.",
        };
      case "sync-from-physical":
        return {
          title: "Sync from physical",
          actionLabel: "sync from physical",
          confirmButtonLabel: "Sync",
          confirmWord: "SYNC",
          tone: "primary" as const,
          specialText:
            "This command will introspect the physical table and recreate the MetaTable projection details from the latest state of the physical table.",
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
  }, [actionRequest]);

  const bulkActionObjectSummary = useMemo(() => {
    if (!actionRequest) {
      return null;
    }

    if (actionRequest.tables.length === 1) {
      return (
        <>
          <div className="font-medium">
            {actionRequest.tables[0]
              ? getPrimaryLabel(actionRequest.tables[0])
              : "Meta table"}
          </div>
          {actionRequest.tables[0]?.uid?.trim() ? (
            <div className="mt-1 text-muted-foreground">
              UID {actionRequest.tables[0].uid.trim()}
            </div>
          ) : null}
        </>
      );
    }

    return (
      <>
        <div className="font-medium">{actionRequest.tables.length} meta tables selected</div>
        <div className="mt-1 text-muted-foreground">
          {actionRequest.tables
            .slice(0, 3)
            .map((table) => getPrimaryLabel(table))
            .join(", ")}
          {actionRequest.tables.length > 3 ? ", ..." : ""}
        </div>
      </>
    );
  }, [actionRequest]);

  return (
    <div className="space-y-6">
      {isMetaTableDetailOpen ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button
                type="button"
                className="transition-colors hover:text-foreground"
                onClick={closeMetaTableDetail}
              >
                Meta tables
              </button>
              <span>/</span>
              <span className="text-foreground">{metaTableTitle}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDetailAction("sync-from-physical")}
                disabled={!metaTableDetailQuery.data && !selectedMetaTableFromList}
              >
                <Wrench className="h-4 w-4" />
                Sync from physical
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => openDetailAction("delete-with-cascade")}
                disabled={!metaTableDetailQuery.data && !selectedMetaTableFromList}
              >
                <Trash2 className="h-4 w-4" />
                Delete with Cascade
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDetailAction("delete")}
                disabled={!metaTableDetailQuery.data && !selectedMetaTableFromList}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button variant="outline" size="sm" onClick={closeMetaTableDetail}>
                <ArrowLeft className="h-4 w-4" />
                Back to meta tables
              </Button>
            </div>
          </div>

          {metaTableSummaryQuery.isLoading && !metaTableSummary ? (
            <Card>
              <CardContent className="flex min-h-48 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading meta table details
                </div>
              </CardContent>
            </Card>
          ) : null}

          {metaTableSummaryQuery.isError && !metaTableSummary ? (
            <Card>
              <CardContent className="p-5">
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(metaTableSummaryQuery.error)}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {metaTableSummary ? (
            <>
              <MainSequenceEntitySummaryCard summary={metaTableSummary} />

              <Card>
                <CardHeader className="border-b border-border/70 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {metaTableDetailTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={
                          tab.id === selectedDetailTabId
                            ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                            : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
                        }
                        onClick={() => selectMetaTableDetailTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="pt-5">
                  {selectedDetailTabId === "details" ? (
                    <div className="space-y-4">
                      {metaTableDetailQuery.isLoading ? (
                        <div className="flex min-h-48 items-center justify-center">
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading meta table details
                          </div>
                        </div>
                      ) : null}

                      {metaTableDetailQuery.isError ? (
                        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                          {formatMainSequenceError(metaTableDetailQuery.error)}
                        </div>
                      ) : null}

                      {!metaTableDetailQuery.isLoading && !metaTableDetailQuery.isError ? (
                        <div className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {metaTableFactItems.map((item) => (
                              <div
                                key={item.key}
                                className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-3"
                              >
                                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                  {item.label}
                                </div>
                                <div
                                  className={`mt-1 text-sm text-foreground ${item.monospace ? "font-mono" : ""}`}
                                >
                                  {item.value}
                                </div>
                              </div>
                            ))}
                          </div>

                          {metaTableDetailQuery.data?.labels?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {metaTableDetailQuery.data.labels.map((label) => (
                                <Badge key={label} variant="neutral">
                                  {label}
                                </Badge>
                              ))}
                            </div>
                          ) : null}

                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28">
                            <div className="border-b border-border/70 px-4 py-3">
                              <div className="text-base font-medium text-foreground">Column Details</div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                Normalized column metadata returned by the Meta Table detail endpoint.
                              </div>
                            </div>
                            <div className="overflow-x-auto p-4">
                              {metaTableColumnDetails.length > 0 ? (
                                <table
                                  className="w-full min-w-[1120px] border-separate"
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
                                        Ord
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Column
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Label
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Data Type
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Backend
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Flags
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Description
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {metaTableColumnDetails.map((column) => (
                                      <tr key={column.key}>
                                        <td className="rounded-l-[calc(var(--radius)-2px)] border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {column.ordinalPosition ?? "?"}
                                        </td>
                                        <td
                                          className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] font-mono text-foreground"
                                          style={{ fontSize: "var(--table-meta-font-size)" }}
                                        >
                                          {column.name}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          <div>{column.label || "Not set"}</div>
                                          {column.logicalName &&
                                          column.logicalName !== column.label ? (
                                            <div className="mt-1 text-xs text-muted-foreground">
                                              {column.logicalName}
                                            </div>
                                          ) : null}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {column.dataType || "Not set"}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {column.backendType || "Not set"}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          <div className="flex flex-wrap gap-1.5">
                                            <Badge variant={column.nullable ? "neutral" : "warning"}>
                                              {column.nullable ? "Nullable" : "Required"}
                                            </Badge>
                                            {column.primaryKey ? (
                                              <Badge variant="primary">PK</Badge>
                                            ) : null}
                                            {column.unique ? (
                                              <Badge variant="success">Unique</Badge>
                                            ) : null}
                                          </div>
                                        </td>
                                        <td className="rounded-r-[calc(var(--radius)-2px)] border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {column.description || "Not set"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                                  No column metadata is available for this meta table.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28">
                            <div className="border-b border-border/70 px-4 py-3">
                              <div className="text-base font-medium text-foreground">Indexes</div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                Index metadata exposed by the Meta Table detail endpoint.
                              </div>
                            </div>
                            <div className="overflow-x-auto p-4">
                              {metaTableIndexDetails.length > 0 ? (
                                <table
                                  className="w-full min-w-[860px] border-separate"
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
                                        Name
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Columns
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Unique
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Method
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Expression
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {metaTableIndexDetails.map((index) => (
                                      <tr key={index.key}>
                                        <td className="rounded-l-[calc(var(--radius)-2px)] border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] font-mono text-foreground">
                                          {index.name}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {formatMetaTableListValue(index.columns)}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {index.unique === null ? "Not set" : index.unique ? "Yes" : "No"}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {index.method || "Not set"}
                                        </td>
                                        <td className="rounded-r-[calc(var(--radius)-2px)] border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {index.expression || "Not set"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                                  No index metadata is available for this meta table.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28">
                            <div className="border-b border-border/70 px-4 py-3">
                              <div className="text-base font-medium text-foreground">Foreign Keys</div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                Outgoing foreign-key definitions declared on this Meta Table.
                              </div>
                            </div>
                            <div className="overflow-x-auto p-4">
                              {metaTableForeignKeyDetails.length > 0 ? (
                                <table
                                  className="w-full min-w-[1040px] border-separate"
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
                                        Name
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Source Columns
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Target Table
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Target Columns
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        On Delete
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {metaTableForeignKeyDetails.map((foreignKey) => (
                                      <tr key={foreignKey.key}>
                                        <td className="rounded-l-[calc(var(--radius)-2px)] border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] font-mono text-foreground">
                                          {foreignKey.name}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {formatMetaTableListValue(foreignKey.sourceColumns)}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          <div className="font-mono">
                                            {foreignKey.targetTableStorageHash ||
                                              foreignKey.targetTableUid ||
                                              "Not set"}
                                          </div>
                                          {foreignKey.targetTableStorageHash &&
                                          foreignKey.targetTableUid ? (
                                            <div className="mt-1 text-xs text-muted-foreground">
                                              {foreignKey.targetTableUid}
                                            </div>
                                          ) : null}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {formatMetaTableListValue(foreignKey.targetColumns)}
                                        </td>
                                        <td className="rounded-r-[calc(var(--radius)-2px)] border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {foreignKey.onDelete || "Not set"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                                  No foreign-key metadata is available for this meta table.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28">
                            <div className="border-b border-border/70 px-4 py-3">
                              <div className="text-base font-medium text-foreground">Incoming References</div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                Foreign keys from other tables that target this Meta Table.
                              </div>
                            </div>
                            <div className="overflow-x-auto p-4">
                              {metaTableIncomingForeignKeyDetails.length > 0 ? (
                                <table
                                  className="w-full min-w-[980px] border-separate"
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
                                        Name
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Source Columns
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Current Table
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        Target Columns
                                      </th>
                                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                                        On Delete
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {metaTableIncomingForeignKeyDetails.map((foreignKey) => (
                                      <tr key={foreignKey.key}>
                                        <td className="rounded-l-[calc(var(--radius)-2px)] border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] font-mono text-foreground">
                                          {foreignKey.name}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {formatMetaTableListValue(foreignKey.sourceColumns)}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          <div className="font-mono">
                                            {foreignKey.targetTableStorageHash ||
                                              metaTableDetailQuery.data?.storage_hash ||
                                              "Not set"}
                                          </div>
                                          {foreignKey.targetTableUid ? (
                                            <div className="mt-1 text-xs text-muted-foreground">
                                              {foreignKey.targetTableUid}
                                            </div>
                                          ) : null}
                                        </td>
                                        <td className="border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {formatMetaTableListValue(foreignKey.targetColumns)}
                                        </td>
                                        <td className="rounded-r-[calc(var(--radius)-2px)] border border-border/70 bg-background/40 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                                          {foreignKey.onDelete || "Not set"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                                  No incoming foreign keys are available for this meta table.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : selectedDetailTabId === "description" ? (
                    <Card variant="nested">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Description</CardTitle>
                        <CardDescription>
                          Description stored on the Meta Table resource.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {metaTableDetailQuery.isLoading && !metaTableDescription ? (
                          <div className="flex min-h-40 items-center justify-center">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading description
                            </div>
                          </div>
                        ) : metaTableDescription ? (
                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-5 py-5">
                            <MarkdownContent content={metaTableDescription} />
                          </div>
                        ) : (
                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-4 py-4 text-sm text-muted-foreground">
                            No description is available for this meta table.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : selectedDetailTabId === "data-snapshot" ? (
                    <MainSequenceMetaTableSnapshotTab metaTableUid={selectedMetaTableIdentifier!} />
                  ) : selectedDetailTabId === "ulm-diagram" ? (
                    <MainSequenceMetaTableSchemaGraph metaTableUid={selectedMetaTableIdentifier!} />
                  ) : (
                    null
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
            title="Meta Tables"
            description="Browse ts_manager meta_table rows by namespace and bulk delete selected entries."
            actions={<Badge variant="neutral">{`${metaTablesQuery.data?.count ?? 0} meta tables`}</Badge>}
          />

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="space-y-4">
                <div>
                  <CardTitle>Meta table registry</CardTitle>
                  <CardDescription>
                    Start from a namespace, then search across identifiers, hashes, descriptions,
                    and backing data sources inside that slice.
                  </CardDescription>
                </div>
                <MainSequenceRegistrySearch
                  actionMenuLabel="Meta table actions"
                  accessory={
                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                      <Badge variant="neutral">{`${metaTablesQuery.data?.count ?? 0} rows`}</Badge>
                      <div className="w-full sm:w-64">
                        <Select
                          value={selectedNamespaceValue}
                          onChange={(event) => setSelectedNamespaceValue(event.target.value)}
                          disabled={metaTableNamespacesQuery.isLoading || metaTableNamespacesQuery.isError}
                        >
                          <option value={allNamespacesOptionValue}>All namespaces</option>
                          {metaTableNamespaceOptions.map((namespace) => (
                            <option
                              key={namespace.namespace_uid}
                              value={getNamespaceOptionValue(namespace)}
                              data-description={getNamespaceOptionDescription(namespace)}
                            >
                              {getNamespaceOptionLabel(namespace)}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  }
                  bulkActions={bulkActions}
                  clearSelectionLabel="Clear selection"
                  onClearSelection={metaTableSelection.clearSelection}
                  renderSelectionSummary={(selectionCount) =>
                    `${selectionCount} meta table${selectionCount === 1 ? "" : "s"} selected`
                  }
                  value={filterValue}
                  onChange={(event) => setFilterValue(event.target.value)}
                  placeholder="Filter by identifier, hash, namespace, or data source"
                  searchClassName="max-w-xl"
                  selectionCount={metaTableSelection.selectedCount}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {metaTableNamespacesQuery.isLoading || metaTablesQuery.isLoading ? (
                <div className="flex min-h-64 items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading meta tables
                  </div>
                </div>
              ) : null}

              {metaTableNamespacesQuery.isError || metaTablesQuery.isError ? (
                <div className="p-5">
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {formatMainSequenceError(metaTableNamespacesQuery.error ?? metaTablesQuery.error)}
                  </div>
                </div>
              ) : null}

              {!metaTableNamespacesQuery.isLoading &&
              !metaTableNamespacesQuery.isError &&
              !metaTablesQuery.isLoading &&
              !metaTablesQuery.isError &&
              filteredTables.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                    <Table2 className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-sm font-medium text-foreground">No meta tables found</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Clear the current filter, switch namespace, or confirm the authenticated user can view meta tables.
                  </p>
                </div>
              ) : null}

              {!metaTableNamespacesQuery.isLoading &&
              !metaTableNamespacesQuery.isError &&
              !metaTablesQuery.isLoading &&
              !metaTablesQuery.isError &&
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
                            ariaLabel="Select all visible meta tables"
                            checked={metaTableSelection.allSelected}
                            indeterminate={metaTableSelection.someSelected}
                            onChange={metaTableSelection.toggleAll}
                          />
                        </th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Table name</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Identifier</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Data source</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Namespace</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Provisioning</th>
                        <th className="px-4 py-[var(--table-standard-header-padding-y)]">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTables.map((table) => {
                        const selected = metaTableSelection.isSelected(table.uid);

                        return (
                          <tr key={table.uid}>
                            <td className={getRegistryTableCellClassName(selected, "left")}>
                              <MainSequenceSelectionCheckbox
                                ariaLabel={`Select ${getPrimaryLabel(table)}`}
                                checked={selected}
                                onChange={() => metaTableSelection.toggleSelection(table.uid)}
                              />
                            </td>
                            <td className={getRegistryTableCellClassName(selected)}>
                              <div className="flex items-start gap-2">
                                <HardDrive className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    className="group inline-flex max-w-[260px] items-center gap-1 rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                                    onClick={() => {
                                      const metaTableIdentifier = getTsManagerRecordIdentifier(table);
                                      if (!metaTableIdentifier) {
                                        return;
                                      }
                                      openMetaTableDetail(metaTableIdentifier);
                                    }}
                                    title={getMetaTableListTableName(table)}
                                  >
                                    <span className="truncate">{getMetaTableListTableName(table)}</span>
                                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                                  </button>
                                  <div
                                    className="mt-0.5 max-w-[260px] truncate font-mono text-muted-foreground"
                                    style={{ fontSize: "var(--table-meta-font-size)" }}
                                    title={table.storage_hash?.trim() || undefined}
                                  >
                                    {table.storage_hash?.trim() || "No storage hash"}
                                  </div>
                                </div>
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
                                    {[table.uid?.trim() ? `UID ${table.uid.trim()}` : null, table.description?.trim() ?? null]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className={getRegistryTableCellClassName(selected)}>
                              <div className="text-foreground">{getDataSourceLabel(table)}</div>
                            </td>
                            <td className={getRegistryTableCellClassName(selected)}>
                              <div className="text-foreground">{table.namespace?.trim() || "Not set"}</div>
                              <div
                                className="mt-0.5 text-muted-foreground"
                                style={{ fontSize: "var(--table-meta-font-size)" }}
                              >
                                Frequency: {table.data_frequency_id ?? "Not set"}
                              </div>
                            </td>
                            <td className={getRegistryTableCellClassName(selected)}>
                              <div className="text-foreground">
                                {typeof table.provisioning_status === "string" &&
                                table.provisioning_status.trim()
                                  ? table.provisioning_status.trim()
                                  : "Not set"}
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

          {!metaTablesQuery.isLoading &&
          !metaTablesQuery.isError &&
          (metaTablesQuery.data?.count ?? 0) > 0 ? (
            <MainSequenceRegistryPagination
              count={metaTablesQuery.data?.count ?? 0}
              hasNextPage={Boolean(metaTablesQuery.data?.next)}
              hasPreviousPage={Boolean(metaTablesQuery.data?.previous)}
              itemLabel="meta tables"
              pageIndex={metaTablesPageIndex}
              pageSize={metaTablesQuery.data?.limit ?? mainSequenceRegistryPageSize}
              onPageChange={setMetaTablesPageIndex}
            />
          ) : null}
        </>
      )}

      {actionRequest && bulkActionConfig ? (
        <ActionConfirmationDialog
          title={bulkActionConfig.title}
          open
          onClose={() => {
            if (!actionMutation.isPending) {
              setActionRequest(null);
            }
          }}
          tone={bulkActionConfig.tone}
          actionLabel={bulkActionConfig.actionLabel}
          objectLabel={actionRequest.tables.length > 1 ? "meta tables" : "meta table"}
          confirmWord={bulkActionConfig.confirmWord}
          confirmButtonLabel={bulkActionConfig.confirmButtonLabel}
          description={
            actionRequest.kind === "refresh-search-index"
              ? "This action refreshes the search index for the selected meta tables."
              : actionRequest.kind === "sync-from-physical"
                ? "This action syncs the selected MetaTable projection from the backing physical table."
              : actionRequest.kind === "delete-with-cascade"
                ? "This action recursively deletes the selected meta tables and everything that references them."
                : "This action applies to the selected meta tables."
          }
          specialText={bulkActionConfig.specialText}
          objectSummary={bulkActionObjectSummary}
          error={
            actionMutation.isError
              ? getMetaTableActionErrorDescription(
                  actionMutation.error,
                  actionRequest.kind,
                )
              : undefined
          }
          isPending={actionMutation.isPending}
          onConfirm={() => actionMutation.mutateAsync(actionRequest)}
        />
      ) : null}
    </div>
  );
}
