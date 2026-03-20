import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeleteAssetTranslationTables,
  createAssetTranslationTable,
  formatMainSequenceError,
  listAssetTranslationTables,
  type AssetTranslationTableListFilters,
  type AssetTranslationTableListRow,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";
import {
  AssetTranslationTableEditorDialog,
  buildAssetTranslationTableCreatePayload,
  buildAssetTranslationTableDeleteSummary,
  buildAssetTranslationTableInitialValues,
  buildFilteredAssetTranslationTableDeleteSummary,
  formatTranslationDateTime,
  formatTranslationTableValue,
  getAssetTranslationTableDetailPath,
  resolveDeletedCount,
  type AssetTranslationTableEditorValues,
} from "./assetTranslationTableShared";

const translationTablePageSize = 40;

type TranslationTableDeleteIntent =
  | { mode: "selection"; tables: AssetTranslationTableListRow[] }
  | { mode: "filtered" };

function readPositiveInt(value: string | null) {
  const parsed = Number(value ?? "");

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function setOrDeleteParam(nextParams: URLSearchParams, key: string, value: string) {
  if (value.trim()) {
    nextParams.set(key, value);
    return;
  }

  nextParams.delete(key);
}

export function MainSequenceAssetTranslationTablesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteIntent, setDeleteIntent] = useState<TranslationTableDeleteIntent | null>(null);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const searchValue = searchParams.get("search") ?? "";
  const page = readPositiveInt(searchParams.get("page")) ?? 1;
  const pageIndex = Math.max(0, page - 1);
  const deferredSearchValue = useDeferredValue(searchValue);

  const tableFilters = useMemo(
    () =>
      ({
        search: deferredSearchValue,
        page,
        pageSize: translationTablePageSize,
      }) satisfies AssetTranslationTableListFilters,
    [deferredSearchValue, page],
  );

  const tablesQuery = useQuery({
    queryKey: ["main_sequence", "asset_translation_tables", "list", tableFilters],
    queryFn: () => listAssetTranslationTables(tableFilters),
  });

  const pageRows = tablesQuery.data?.rows ?? [];
  const pagination = tablesQuery.data?.pagination;
  const totalCount = pagination?.total_items ?? pageRows.length;
  const pageSize = pagination?.page_size ?? translationTablePageSize;
  const totalPages = pagination?.total_pages ?? Math.max(1, Math.ceil(totalCount / pageSize));
  const tableSelection = useRegistrySelection(pageRows);

  useEffect(() => {
    const nextParams = new URLSearchParams(location.search);
    let changed = false;

    if (nextParams.has("page_size")) {
      nextParams.delete("page_size");
      changed = true;
    }

    if (!changed) {
      return;
    }

    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (page > totalPages) {
      const nextParams = new URLSearchParams(location.search);

      nextParams.set("page", String(totalPages));

      navigate(
        {
          pathname: location.pathname,
          search: `?${nextParams.toString()}`,
        },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate, page, totalPages]);

  function updateSearchParams(
    update: (nextParams: URLSearchParams) => void,
    { replace = false }: { replace?: boolean } = {},
  ) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);
    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace },
    );
  }

  function updateSearch(value: string) {
    updateSearchParams(
      (nextParams) => {
        setOrDeleteParam(nextParams, "search", value);
        nextParams.set("page", "1");
      },
      { replace: true },
    );
  }

  function handlePageChange(nextPageIndex: number) {
    updateSearchParams((nextParams) => {
      nextParams.set("page", String(nextPageIndex + 1));
    });
  }

  const createTableMutation = useMutation({
    mutationFn: createAssetTranslationTable,
    onSuccess: async (table) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "asset_translation_tables"],
      });

      toast({
        variant: "success",
        title: "Translation table created",
        description: `${table.unique_identifier || `Table ${table.id}`} is now available.`,
      });

      setCreateDialogOpen(false);
      navigate(getAssetTranslationTableDetailPath(table.id), {
        state: {
          from: `${location.pathname}${location.search}`,
        },
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Translation table creation failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });

  const tableBulkActions =
    tableSelection.selectedCount > 0
      ? [
          {
            id: "delete-translation-tables",
            label:
              tableSelection.selectedCount === 1
                ? "Delete selected table"
                : "Delete selected tables",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () =>
              setDeleteIntent({
                mode: "selection",
                tables: tableSelection.selectedItems,
              }),
          },
        ]
      : [];

  const deleteSelectionTables = deleteIntent?.mode === "selection" ? deleteIntent.tables : [];
  const deleteIsFiltered = deleteIntent?.mode === "filtered";
  const deleteDialogTitle = deleteIsFiltered
    ? "Delete filtered translation tables"
    : deleteSelectionTables.length === 1
      ? "Delete translation table"
      : "Delete translation tables";
  const deleteActionLabel = deleteIsFiltered
    ? "delete all translation tables matching the current search"
    : deleteSelectionTables.length === 1
      ? "delete the selected translation table"
      : "delete the selected translation tables";
  const deleteConfirmButtonLabel = deleteIsFiltered
    ? "Delete tables"
    : deleteSelectionTables.length === 1
      ? "Delete table"
      : "Delete tables";
  const deleteDescription = deleteIsFiltered
    ? "This uses the translation-table bulk-delete endpoint with select_all=true and the active search."
    : "This uses the translation-table bulk-delete endpoint for the selected rows.";
  const deleteObjectSummary = deleteIsFiltered
    ? buildFilteredAssetTranslationTableDeleteSummary({
        totalCount,
        searchValue,
      })
    : buildAssetTranslationTableDeleteSummary(deleteSelectionTables);

  async function handleDeleteSuccess(result: unknown) {
    if (deleteIntent?.mode === "selection") {
      const deletedIds = deleteIntent.tables.map((table) => table.id);

      tableSelection.setSelection(
        tableSelection.selectedIds.filter((id) => !deletedIds.includes(id)),
      );
    } else {
      tableSelection.clearSelection();
    }

    setDeleteIntent(null);
    await queryClient.invalidateQueries({
      queryKey: ["main_sequence", "asset_translation_tables"],
    });
  }

  async function confirmDelete() {
    if (!deleteIntent) {
      return null;
    }

    if (deleteIntent.mode === "filtered") {
      return bulkDeleteAssetTranslationTables({
        selectAll: true,
        search: searchValue.trim() || undefined,
      });
    }

    return bulkDeleteAssetTranslationTables({
      ids: deleteIntent.tables.map((table) => table.id),
    });
  }

  function submitCreate(values: AssetTranslationTableEditorValues) {
    try {
      createTableMutation.mutate(buildAssetTranslationTableCreatePayload(values));
    } catch (error) {
      toast({
        variant: "error",
        title: "Translation table creation failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Asset Translation Tables"
        description="Manage translation tables and open each table’s embedded rules manager."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{`${totalCount} tables`}</Badge>
            <Button type="button" size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create table
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Translation table registry</CardTitle>
              <CardDescription>
                Browse translation tables, create new ones, and open a table to manage its rules on
                the same page.
              </CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Table actions"
              accessory={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{`${totalCount} rows`}</Badge>
                  {searchValue.trim() && totalCount > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteIntent({ mode: "filtered" })}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete filtered
                    </Button>
                  ) : null}
                </div>
              }
              bulkActions={tableBulkActions}
              clearSelectionLabel="Clear tables"
              onClearSelection={tableSelection.clearSelection}
              renderSelectionSummary={(selectionCount) => `${selectionCount} tables selected`}
              value={searchValue}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search by id or unique identifier"
              selectionCount={tableSelection.selectedCount}
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {tablesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading translation tables
              </div>
            </div>
          ) : null}

          {tablesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(tablesQuery.error)}
            </div>
          ) : null}

          {!tablesQuery.isLoading && !tablesQuery.isError && pageRows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">
                No translation tables found
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search or create a new translation table.
              </p>
            </div>
          ) : null}

          {!tablesQuery.isLoading && !tablesQuery.isError && pageRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="w-12 px-3 pb-2">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all visible translation tables"
                        checked={tableSelection.allSelected}
                        indeterminate={tableSelection.someSelected}
                        onChange={tableSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 pb-2">Unique identifier</th>
                    <th className="px-4 pb-2">Rules</th>
                    <th className="px-4 pb-2">Creation date</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((table) => {
                    const selected = tableSelection.isSelected(table.id);

                    return (
                      <tr
                        key={table.id}
                        className="cursor-pointer"
                        onClick={() =>
                          navigate(getAssetTranslationTableDetailPath(table.id), {
                            state: {
                              from: `${location.pathname}${location.search}`,
                            },
                          })
                        }
                      >
                        <td
                          className={getRegistryTableCellClassName(selected, "left")}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select translation table ${table.id}`}
                            checked={selected}
                            onChange={() => tableSelection.toggleSelection(table.id)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="font-medium text-foreground">
                            {formatTranslationTableValue(
                              table.unique_identifier,
                              `Table ${table.id}`,
                            )}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{`ID ${table.id}`}</div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <Badge variant="neutral">{`${table.rules_number} rules`}</Badge>
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          {formatTranslationDateTime(table.creation_date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>

        <MainSequenceRegistryPagination
          count={totalCount}
          itemLabel="tables"
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </Card>

      <AssetTranslationTableEditorDialog
        mode="create"
        open={createDialogOpen}
        onClose={() => {
          if (!createTableMutation.isPending) {
            setCreateDialogOpen(false);
          }
        }}
        onSubmit={submitCreate}
        isPending={createTableMutation.isPending}
        error={createTableMutation.error}
        initialValues={buildAssetTranslationTableInitialValues(null)}
      />

      <ActionConfirmationDialog
        actionLabel={deleteActionLabel}
        confirmButtonLabel={deleteConfirmButtonLabel}
        confirmWord="DELETE"
        description={deleteDescription}
        errorToast={{
          title: deleteIsFiltered
            ? "Filtered delete failed"
            : "Translation table bulk delete failed",
          description: (error) =>
            error instanceof Error ? error.message : "The request failed.",
        }}
        objectLabel={deleteIsFiltered ? "translation tables" : "translation tables"}
        objectSummary={deleteObjectSummary}
        onClose={() => setDeleteIntent(null)}
        onConfirm={confirmDelete}
        onSuccess={handleDeleteSuccess}
        open={deleteIntent !== null}
        successToast={{
          title: deleteIsFiltered ? "Tables deleted" : "Tables deleted",
          description: (result) =>
            deleteIsFiltered
              ? `${resolveDeletedCount(result, totalCount)} translation tables were deleted.`
              : `${resolveDeletedCount(result, deleteSelectionTables.length)} translation tables were deleted.`,
        }}
        title={deleteDialogTitle}
        tone="danger"
      />
    </div>
  );
}
