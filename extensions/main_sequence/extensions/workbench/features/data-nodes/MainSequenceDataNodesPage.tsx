import { useDeferredValue, useEffect, useEffectEvent, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpDown,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Database,
  HardDrive,
  Loader2,
  Network,
  Trash2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeleteDataNodes,
  bulkRefreshDataNodeTableSearchIndex,
  bulkSetDataNodeIndexStatsFromTable,
  bulkSetDataNodeNextUpdateFromLastIndexValue,
  deleteDataNodeTail,
  fetchDataNodeDetail,
  fetchDataNodeSummary,
  fetchSourceTableConfigurationStats,
  formatMainSequenceError,
  listDataNodes,
  mainSequenceRegistryPageSize,
  type DataNodeDetail,
  type DataNodeSummary,
  type EntitySummaryHeader,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequencePermissionsTab } from "../../../../common/components/MainSequencePermissionsTab";
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
import { MainSequenceDataNodeSnapshotTab } from "./MainSequenceDataNodeSnapshotTab";

const mainSequenceDataNodeIdParam = "msDataNodeId";
const mainSequenceDataNodeTabParam = "msDataNodeTab";
const mainSequenceLocalUpdateIdParam = "msLocalUpdateId";
const mainSequenceLocalUpdateTabParam = "msLocalUpdateTab";
const dataNodePermissionsObjectUrl = "/orm/api/ts_manager/dynamic_table";
const dataNodeDetailTabs = [
  { id: "details", label: "Details" },
  { id: "description", label: "Description" },
  { id: "data-snapshot", label: "Data Snapshot" },
  { id: "local-time-series", label: "Local Update" },
  { id: "policies", label: "Policies" },
  { id: "permissions", label: "Permissions" },
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

type DataNodeSortKey =
  | "storage_hash"
  | "identifier"
  | "data_source"
  | "source_class_name"
  | "creation_date";
type DataNodeSortDirection = "asc" | "desc";

const defaultDataNodeDeleteOptions: DataNodeDeleteOptions = {
  deleteWithNoTable: false,
  fullDeleteDownstreamTables: false,
  overrideProtection: false,
};

const creationDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
const dataNodeSortCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function formatDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

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

function normalizeDataNodeSortValue(value?: string | null) {
  return value?.trim() ?? "";
}

function getDataNodeSortValue(dataNode: DataNodeSummary, key: DataNodeSortKey) {
  switch (key) {
    case "storage_hash":
      return normalizeDataNodeSortValue(dataNode.storage_hash);
    case "identifier":
      return normalizeDataNodeSortValue(dataNode.identifier);
    case "data_source":
      return normalizeDataNodeSortValue(getDataSourceLabel(dataNode));
    case "source_class_name":
      return normalizeDataNodeSortValue(dataNode.source_class_name);
    case "creation_date":
      return normalizeDataNodeSortValue(dataNode.creation_date);
  }
}

function compareDataNodes(
  left: DataNodeSummary,
  right: DataNodeSummary,
  key: DataNodeSortKey,
  direction: DataNodeSortDirection,
) {
  if (key === "creation_date") {
    const leftValue = Date.parse(left.creation_date ?? "");
    const rightValue = Date.parse(right.creation_date ?? "");
    const leftMissing = Number.isNaN(leftValue);
    const rightMissing = Number.isNaN(rightValue);

    if (leftMissing && rightMissing) {
      return dataNodeSortCollator.compare(left.storage_hash, right.storage_hash);
    }

    if (leftMissing) {
      return 1;
    }

    if (rightMissing) {
      return -1;
    }

    const comparison = direction === "asc" ? leftValue - rightValue : rightValue - leftValue;

    if (comparison !== 0) {
      return comparison;
    }

    return dataNodeSortCollator.compare(left.storage_hash, right.storage_hash);
  }

  const leftValue = getDataNodeSortValue(left, key);
  const rightValue = getDataNodeSortValue(right, key);
  const leftMissing = !leftValue;
  const rightMissing = !rightValue;

  if (leftMissing && rightMissing) {
    return dataNodeSortCollator.compare(left.storage_hash, right.storage_hash);
  }

  if (leftMissing) {
    return 1;
  }

  if (rightMissing) {
    return -1;
  }

  const comparison =
    direction === "asc"
      ? dataNodeSortCollator.compare(leftValue, rightValue)
      : dataNodeSortCollator.compare(rightValue, leftValue);

  if (comparison !== 0) {
    return comparison;
  }

  return dataNodeSortCollator.compare(left.storage_hash, right.storage_hash);
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

function getSourceTableConfigurationId(dataNodeDetail?: DataNodeDetail | null) {
  const explicitId = dataNodeDetail?.sourcetableconfiguration?.id;

  if (typeof explicitId === "number" && Number.isFinite(explicitId) && explicitId > 0) {
    return explicitId;
  }

  const sourceConfigIds = new Set(
    (dataNodeDetail?.sourcetableconfiguration?.columns_metadata ?? [])
      .map((column) => column.source_config_id)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0),
  );

  if (sourceConfigIds.size === 1) {
    return [...sourceConfigIds][0] ?? null;
  }

  const relatedTable = dataNodeDetail?.sourcetableconfiguration?.related_table;

  if (typeof relatedTable === "number" && Number.isFinite(relatedTable) && relatedTable > 0) {
    return relatedTable;
  }

  return null;
}

function getDataNodeIdentifierIndexName(dataNodeDetail?: DataNodeDetail | null) {
  const sourceTableConfiguration = dataNodeDetail?.sourcetableconfiguration;
  const timeIndexName = sourceTableConfiguration?.time_index_name?.trim();
  const indexNames = sourceTableConfiguration?.index_names ?? [];

  return (
    indexNames.find((indexName) => {
      const normalizedIndexName = indexName?.trim();

      return Boolean(normalizedIndexName && normalizedIndexName !== timeIndexName);
    }) ?? null
  );
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
  const rawValue = summary?.extensions?.generated_search_document ?? null;

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
  const [deleteTailDialogOpen, setDeleteTailDialogOpen] = useState(false);
  const [deleteTailAfterDate, setDeleteTailAfterDate] = useState("");
  const [deleteTailIdentifierSearch, setDeleteTailIdentifierSearch] = useState("");
  const [selectedDeleteTailIdentifiers, setSelectedDeleteTailIdentifiers] = useState<string[]>([]);
  const [deleteTailFormError, setDeleteTailFormError] = useState<string | null>(null);
  const [sortState, setSortState] = useState<{
    direction: DataNodeSortDirection;
    key: DataNodeSortKey | null;
  }>({
    direction: "asc",
    key: null,
  });
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
  const sortedDataNodes = useMemo(() => {
    if (!sortState.key) {
      return filteredDataNodes;
    }

    return [...filteredDataNodes].sort((left, right) =>
      compareDataNodes(left, right, sortState.key!, sortState.direction),
    );
  }, [filteredDataNodes, sortState.direction, sortState.key]);
  const dataNodeSelection = useRegistrySelection(sortedDataNodes);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((dataNodesQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (dataNodesPageIndex > totalPages - 1) {
      setDataNodesPageIndex(totalPages - 1);
    }
  }, [dataNodesPageIndex, dataNodesQuery.data?.count]);
  const toggleSort = useEffectEvent((key: DataNodeSortKey) => {
    setSortState((current) => {
      if (current.key !== key) {
        return {
          key,
          direction: "asc",
        };
      }

      if (current.direction === "asc") {
        return {
          key,
          direction: "desc",
        };
      }

      return {
        key: null,
        direction: "asc",
      };
    });
  });
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
  const selectedSourceTableConfiguration = dataNodeDetailQuery.data?.sourcetableconfiguration ?? null;
  const sourceTableConfigurationId = useMemo(
    () => getSourceTableConfigurationId(dataNodeDetailQuery.data),
    [dataNodeDetailQuery.data],
  );
  const identifierIndexName = useMemo(
    () => getDataNodeIdentifierIndexName(dataNodeDetailQuery.data),
    [dataNodeDetailQuery.data],
  );
  const isMultiIndexDataNode = (selectedSourceTableConfiguration?.index_names?.length ?? 0) > 1;
  const generatedSearchDocument = getGeneratedSearchDocument(dataNodeSummaryQuery.data ?? dataNodeSummary);
  const sourceTableConfigStatsQuery = useQuery({
    queryKey: ["main_sequence", "source_table_config", "stats", sourceTableConfigurationId],
    queryFn: () => fetchSourceTableConfigurationStats(sourceTableConfigurationId!),
    enabled:
      deleteTailDialogOpen &&
      isDataNodeDetailOpen &&
      isMultiIndexDataNode &&
      typeof sourceTableConfigurationId === "number" &&
      Number.isFinite(sourceTableConfigurationId) &&
      sourceTableConfigurationId > 0,
  });
  const deleteTailIdentifierOptions = useMemo(() => {
    const maxPerAssetSymbol =
      sourceTableConfigStatsQuery.data?.multi_index_stats?.max_per_asset_symbol ?? {};

    return Object.entries(maxPerAssetSymbol)
      .map(([identifier, lastTimestamp]) => ({
        identifier,
        lastTimestamp,
      }))
      .sort((left, right) => dataNodeSortCollator.compare(left.identifier, right.identifier));
  }, [sourceTableConfigStatsQuery.data]);
  const filteredDeleteTailIdentifierOptions = useMemo(() => {
    const needle = deleteTailIdentifierSearch.trim().toLowerCase();

    if (!needle) {
      return deleteTailIdentifierOptions;
    }

    return deleteTailIdentifierOptions.filter((option) =>
      option.identifier.toLowerCase().includes(needle),
    );
  }, [deleteTailIdentifierOptions, deleteTailIdentifierSearch]);

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
  const deleteTailMutation = useMutation({
    mutationFn: (input: { dataNodeId: number; afterDate: string; uniqueIdentifierList?: string[] }) =>
      deleteDataNodeTail(input.dataNodeId, {
        after_date: input.afterDate,
        unique_identifier_list: input.uniqueIdentifierList,
      }),
    onSuccess: async (result) => {
      setDeleteTailDialogOpen(false);
      setDeleteTailAfterDate("");
      setDeleteTailIdentifierSearch("");
      setSelectedDeleteTailIdentifiers([]);
      setDeleteTailFormError(null);

      toast({
        variant: result.deleted_count > 0 ? "success" : "info",
        title: result.deleted_count > 0 ? "Tail data deleted" : "No tail rows deleted",
        description:
          result.deleted_count > 0
            ? [
                `${result.deleted_count} rows removed`,
                result.unique_identifier_list?.length
                  ? `${result.unique_identifier_list.length} identifiers filtered`
                  : null,
                result.table_empty ? "table is now empty" : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "No rows matched the delete-after-date request.",
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "data_nodes"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "source_table_config", "stats", sourceTableConfigurationId],
        }),
      ]);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Tail delete failed",
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
      toast({
        variant: "info",
        title: "Select data nodes first",
        description: "Choose one or more data nodes before running a list action.",
      });
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

  useEffect(() => {
    if (!deleteTailDialogOpen) {
      setDeleteTailAfterDate("");
      setDeleteTailIdentifierSearch("");
      setSelectedDeleteTailIdentifiers([]);
      setDeleteTailFormError(null);
      deleteTailMutation.reset();
      return;
    }

    setDeleteTailAfterDate(
      formatDateTimeLocalValue(selectedSourceTableConfiguration?.last_time_index_value),
    );
    setDeleteTailIdentifierSearch("");
    setSelectedDeleteTailIdentifiers([]);
    setDeleteTailFormError(null);
    deleteTailMutation.reset();
  }, [
    deleteTailDialogOpen,
    selectedDataNodeId,
    selectedSourceTableConfiguration?.last_time_index_value,
  ]);

  function toggleDeleteTailIdentifier(identifier: string) {
    setSelectedDeleteTailIdentifiers((current) =>
      current.includes(identifier)
        ? current.filter((value) => value !== identifier)
        : [...current, identifier].sort((left, right) => dataNodeSortCollator.compare(left, right)),
    );
  }

  function selectAllVisibleDeleteTailIdentifiers() {
    setSelectedDeleteTailIdentifiers((current) => {
      const next = new Set(current);

      filteredDeleteTailIdentifierOptions.forEach((option) => {
        next.add(option.identifier);
      });

      return [...next].sort((left, right) => dataNodeSortCollator.compare(left, right));
    });
  }

  function clearDeleteTailIdentifiers() {
    setSelectedDeleteTailIdentifiers([]);
  }

  async function handleDeleteTailSubmit() {
    if (!isDataNodeDetailOpen || !Number.isFinite(selectedDataNodeId) || selectedDataNodeId <= 0) {
      return;
    }

    if (!deleteTailAfterDate.trim()) {
      setDeleteTailFormError("Choose the first timestamp that should be deleted.");
      return;
    }

    const parsedAfterDate = new Date(deleteTailAfterDate);

    if (Number.isNaN(parsedAfterDate.getTime())) {
      setDeleteTailFormError("Enter a valid delete-after timestamp.");
      return;
    }

    setDeleteTailFormError(null);

    await deleteTailMutation.mutateAsync({
      dataNodeId: selectedDataNodeId,
      afterDate: parsedAfterDate.toISOString(),
      uniqueIdentifierList:
        isMultiIndexDataNode && selectedDeleteTailIdentifiers.length > 0
          ? selectedDeleteTailIdentifiers
          : undefined,
    });
  }

  function renderSortableHeader(label: string, key: DataNodeSortKey) {
    const isActive = sortState.key === key;

    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        onClick={() => toggleSort(key)}
      >
        <span>{label}</span>
        {isActive ? (
          sortState.direction === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
        )}
      </button>
    );
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
      const actionCopy =
        bulkActionRequest.kind === "set-next-update-from-last-index"
          ? {
              successTitle: "Next update values refreshed",
              partialTitle: "Next update refresh completed with failures",
              successDescription: `${payload.success_count} data nodes updated from their last time index value.`,
            }
          : bulkActionRequest.kind === "set-index-stats-from-table"
            ? {
                successTitle: "Index stats refreshed",
                partialTitle: "Index stats refresh completed with failures",
                successDescription: `${payload.success_count} data nodes refreshed from their table metadata.`,
              }
            : {
                successTitle: "Search index refreshed",
                partialTitle: "Search index refresh completed with failures",
                successDescription: `${payload.success_count} data nodes reindexed.`,
              };

      toast({
        variant: payload.failed_count > 0 ? "info" : "success",
        title: payload.failed_count > 0 ? actionCopy.partialTitle : actionCopy.successTitle,
        description:
          payload.failed_count > 0
            ? `${payload.success_count} succeeded, ${payload.failed_count} failed.`
            : actionCopy.successDescription,
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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteTailDialogOpen(true)}
                disabled={!selectedSourceTableConfiguration}
              >
                <Trash2 className="h-4 w-4" />
                Delete Tail Data
              </Button>
              <Button variant="outline" size="sm" onClick={closeDataNodeDetail}>
                <ArrowLeft className="h-4 w-4" />
                Back to data nodes
              </Button>
            </div>
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
                  ) : selectedDetailTabId === "data-snapshot" ? (
                    <MainSequenceDataNodeSnapshotTab dataNodeId={selectedDataNodeId} />
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
                  ) : selectedDetailTabId === "permissions" ? (
                    <MainSequencePermissionsTab
                      objectUrl={dataNodePermissionsObjectUrl}
                      objectId={selectedDataNodeId}
                      entityLabel="Data Node"
                      enabled={selectedDetailTabId === "permissions"}
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

                  {!dataNodesQuery.isLoading && !dataNodesQuery.isError && sortedDataNodes.length > 0 ? (
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
                    <th
                      className="px-4 py-[var(--table-standard-header-padding-y)]"
                      aria-sort={
                        sortState.key === "storage_hash"
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      {renderSortableHeader("Storage hash", "storage_hash")}
                    </th>
                    <th
                      className="px-4 py-[var(--table-standard-header-padding-y)]"
                      aria-sort={
                        sortState.key === "identifier"
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      {renderSortableHeader("Identifier", "identifier")}
                    </th>
                    <th
                      className="px-4 py-[var(--table-standard-header-padding-y)]"
                      aria-sort={
                        sortState.key === "data_source"
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      {renderSortableHeader("Data source", "data_source")}
                    </th>
                    <th
                      className="px-4 py-[var(--table-standard-header-padding-y)]"
                      aria-sort={
                        sortState.key === "source_class_name"
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      {renderSortableHeader("Source class", "source_class_name")}
                    </th>
                    <th
                      className="px-4 py-[var(--table-standard-header-padding-y)]"
                      aria-sort={
                        sortState.key === "creation_date"
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      {renderSortableHeader("Created", "creation_date")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDataNodes.map((dataNode) => {
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

      <Dialog
        title="Delete Tail Data"
        description="Delete rows at and after a timestamp. Optionally scope the delete to selected identifiers for multi-index tables."
        open={deleteTailDialogOpen}
        onClose={() => {
          if (deleteTailMutation.isPending) {
            return;
          }

          setDeleteTailDialogOpen(false);
        }}
        className="max-w-[min(760px,calc(100vw-24px))]"
      >
        <div className="space-y-5">
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            This is a suffix delete. Rows with a time index greater than or equal to the selected
            timestamp will be removed.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="data-node-delete-tail-after-date"
                className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
              >
                Delete From
              </label>
              <Input
                id="data-node-delete-tail-after-date"
                type="datetime-local"
                value={deleteTailAfterDate}
                onChange={(event) => setDeleteTailAfterDate(event.target.value)}
                disabled={deleteTailMutation.isPending}
              />
              <div className="text-xs text-muted-foreground">
                Matching rows where <code>{selectedSourceTableConfiguration?.time_index_name ?? "time_index"}</code>{" "}
                is greater than or equal to this value will be deleted.
              </div>
            </div>

            <div className="space-y-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Table Context
              </div>
              <div className="space-y-1 text-sm text-foreground">
                <div>Dynamic table ID {selectedDataNodeId}</div>
                <div>
                  Related table {selectedSourceTableConfiguration?.related_table ?? "Not available"}
                </div>
                <div>
                  Indexes:{" "}
                  {(selectedSourceTableConfiguration?.index_names ?? []).join(", ") || "Not available"}
                </div>
              </div>
            </div>
          </div>

          {isMultiIndexDataNode ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">Identifier filter</div>
                  <div className="text-sm text-muted-foreground">
                    Limit the suffix delete to selected values from{" "}
                    <code>{identifierIndexName ?? "the identifier index"}</code>.
                  </div>
                </div>
                <Badge variant="neutral">
                  {selectedDeleteTailIdentifiers.length > 0
                    ? `${selectedDeleteTailIdentifiers.length} selected`
                    : "All identifiers"}
                </Badge>
              </div>

              {typeof sourceTableConfigurationId !== "number" || sourceTableConfigurationId <= 0 ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                  Identifier options are unavailable because the SourceTableConfiguration id could not
                  be resolved from the current payload.
                </div>
              ) : sourceTableConfigStatsQuery.isLoading ? (
                <div className="flex min-h-24 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading identifier options
                  </div>
                </div>
              ) : sourceTableConfigStatsQuery.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(sourceTableConfigStatsQuery.error)}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={deleteTailIdentifierSearch}
                      onChange={(event) => setDeleteTailIdentifierSearch(event.target.value)}
                      placeholder="Filter identifiers"
                      disabled={deleteTailMutation.isPending}
                      className="max-w-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllVisibleDeleteTailIdentifiers}
                      disabled={
                        deleteTailMutation.isPending ||
                        filteredDeleteTailIdentifierOptions.length === 0
                      }
                    >
                      Select visible
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearDeleteTailIdentifiers}
                      disabled={
                        deleteTailMutation.isPending || selectedDeleteTailIdentifiers.length === 0
                      }
                    >
                      Clear
                    </Button>
                  </div>

                  {filteredDeleteTailIdentifierOptions.length > 0 ? (
                    <div className="max-h-64 space-y-2 overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-3">
                      {filteredDeleteTailIdentifierOptions.map((option) => {
                        const checked = selectedDeleteTailIdentifiers.includes(option.identifier);

                        return (
                          <label
                            key={option.identifier}
                            className="flex items-start justify-between gap-3 rounded-[calc(var(--radius)-10px)] border border-border/60 bg-background/32 px-3 py-2 text-sm text-foreground"
                          >
                            <span className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleDeleteTailIdentifier(option.identifier)}
                                disabled={deleteTailMutation.isPending}
                                className="mt-1 h-4 w-4 rounded border-border bg-background"
                              />
                              <span>{option.identifier}</span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Last row {formatCreationDate(option.lastTimestamp)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
                      No identifiers are available for this Data Node.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
              This table uses a single index, so the delete applies to the full tail without identifier filtering.
            </div>
          )}

          {deleteTailFormError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {deleteTailFormError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTailDialogOpen(false)}
              disabled={deleteTailMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void handleDeleteTailSubmit();
              }}
              disabled={deleteTailMutation.isPending || !selectedSourceTableConfiguration}
            >
              {deleteTailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Tail Data
            </Button>
          </div>
        </div>
      </Dialog>

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
