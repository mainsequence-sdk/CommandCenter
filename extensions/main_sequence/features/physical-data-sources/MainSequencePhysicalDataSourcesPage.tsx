import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Database, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

import {
  bulkDeletePhysicalDataSources,
  formatMainSequenceError,
  listPhysicalDataSources,
  mainSequenceRegistryPageSize,
} from "../../api";
import { MainSequenceRegistryPagination } from "../../components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../components/MainSequenceSelectionCheckbox";
import { resolvePhysicalDataSourceIcon } from "../../components/physicalDataSourceIcons";
import { getRegistryTableCellClassName } from "../../components/registryTable";
import { useRegistrySelection } from "../../hooks/useRegistrySelection";
import { MainSequencePhysicalDataSourceEditor } from "./MainSequencePhysicalDataSourceEditor";

const mainSequencePhysicalDataSourceIdParam = "msPhysicalDataSourceId";
const mainSequencePhysicalDataSourceViewParam = "msPhysicalDataSourceView";

const physicalDataSourceCreateFlows = [
  { id: "create-timescale-db", label: "Create Timescale DB" },
  { id: "create-managed-data-source", label: "Create Managed Data Source" },
  { id: "create-duck-db", label: "Create Duck DB" },
] as const;

const createViewToSourceType = {
  "create-timescale-db": "timescale_db",
  "create-managed-data-source": "timescale_db_gcp_cloud",
  "create-duck-db": "duck_db",
} as const;

const classTypeFilterOptions = [
  { value: "", label: "All types" },
  { value: "timescale_db_remote", label: "Timescale DB" },
  { value: "timescale_db_gcp_cloud", label: "Managed Data Source" },
  { value: "duck_db", label: "Duck DB" },
] as const;

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

  return "neutral" as const;
}

export function MainSequencePhysicalDataSourcesPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [classTypeFilterValue, setClassTypeFilterValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deferredSearchValue = useDeferredValue(searchValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activePhysicalDataSourceId = Number(
    searchParams.get(mainSequencePhysicalDataSourceIdParam) ?? "",
  );
  const activeView = searchParams.get(mainSequencePhysicalDataSourceViewParam) ?? "";
  const activeCreateSourceType =
    activeView in createViewToSourceType
      ? createViewToSourceType[activeView as keyof typeof createViewToSourceType]
      : null;
  const isCreateFlowOpen = activeCreateSourceType !== null;
  const isEditFlowOpen =
    Number.isFinite(activePhysicalDataSourceId) && activePhysicalDataSourceId > 0;

  const physicalDataSourcesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "physical_data_sources",
      "list",
      pageIndex,
      deferredSearchValue.trim(),
      classTypeFilterValue,
    ],
    queryFn: () =>
      listPhysicalDataSources({
        page: pageIndex + 1,
        pageSize: mainSequenceRegistryPageSize,
        search: deferredSearchValue,
        classType: classTypeFilterValue,
      }),
  });

  const pageRows = physicalDataSourcesQuery.data?.rows ?? [];
  const selection = useRegistrySelection(pageRows);
  const totalItems = physicalDataSourcesQuery.data?.pagination.total_items ?? 0;
  const allPageSelected = pageRows.length > 0 && (selectAllMatching || selection.allSelected);
  const somePageSelected = !allPageSelected && selection.someSelected;
  const selectionCount = selectAllMatching ? totalItems : selection.selectedCount;
  const showSelectAllMatchingHint =
    !selectAllMatching && selection.allSelected && pageRows.length > 0 && totalItems > pageRows.length;

  useEffect(() => {
    setPageIndex(0);
    setSelectAllMatching(false);
    selection.setSelection([]);
  }, [classTypeFilterValue, deferredSearchValue]);

  useEffect(() => {
    const totalPages = Math.max(physicalDataSourcesQuery.data?.pagination.total_pages ?? 1, 1);

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, physicalDataSourcesQuery.data?.pagination.total_pages]);

  function clearSelection() {
    setSelectAllMatching(false);
    selection.clearSelection();
  }

  function toggleAllCurrentPage() {
    if (selectAllMatching) {
      clearSelection();
      return;
    }

    selection.toggleAll();
  }

  function toggleRowSelection(physicalDataSourceId: number) {
    if (selectAllMatching) {
      setSelectAllMatching(false);
      selection.setSelection(pageRows.map((row) => row.id).filter((id) => id !== physicalDataSourceId));
      return;
    }

    selection.toggleSelection(physicalDataSourceId);
  }

  function selectAllMatchingResults() {
    setSelectAllMatching(true);
    selection.setSelection(pageRows.map((row) => row.id));
  }

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

  function openCreateFlow(view: (typeof physicalDataSourceCreateFlows)[number]["id"]) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequencePhysicalDataSourceViewParam, view);
      nextParams.delete(mainSequencePhysicalDataSourceIdParam);
    });
  }

  function openPhysicalDataSourceDetail(physicalDataSourceId: number) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequencePhysicalDataSourceIdParam, String(physicalDataSourceId));
      nextParams.delete(mainSequencePhysicalDataSourceViewParam);
    });
  }

  function closeEditor() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequencePhysicalDataSourceIdParam);
      nextParams.delete(mainSequencePhysicalDataSourceViewParam);
    });
  }

  async function handleBulkDelete() {
    return bulkDeletePhysicalDataSources(
      selectAllMatching
        ? {
            selectAll: true,
            search: deferredSearchValue.trim() || undefined,
            classType: classTypeFilterValue || undefined,
          }
        : {
            ids: selection.selectedIds,
          },
    );
  }

  async function handleBulkDeleteSuccess() {
    clearSelection();
    setDeleteDialogOpen(false);

    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequencePhysicalDataSourceIdParam);
    });

    await queryClient.invalidateQueries({
      queryKey: ["main_sequence", "physical_data_sources"],
    });
  }

  const bulkActions =
    selectionCount > 0
      ? [
          {
            id: "delete-physical-data-sources",
            label: selectAllMatching
              ? "Delete matching physical data sources"
              : selectionCount === 1
                ? "Delete selected physical data source"
                : "Delete selected physical data sources",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => setDeleteDialogOpen(true),
          },
        ]
      : [];

  if (isCreateFlowOpen || isEditFlowOpen) {
    return (
      <MainSequencePhysicalDataSourceEditor
        mode={isEditFlowOpen ? "edit" : "create"}
        createSourceType={isCreateFlowOpen ? activeCreateSourceType : undefined}
        physicalDataSourceId={isEditFlowOpen ? activePhysicalDataSourceId : undefined}
        onBack={closeEditor}
        onOpenPhysicalDataSourceDetail={openPhysicalDataSourceDetail}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title="Physical Data Sources"
        description="Search and manage physical data source records."
        actions={
          <>
            <Badge variant="neutral">{`${totalItems} physical data sources`}</Badge>
            {physicalDataSourceCreateFlows.map((flow) => (
              <Button
                key={flow.id}
                type="button"
                variant={activeView === flow.id ? "secondary" : "outline"}
                size="sm"
                onClick={() => openCreateFlow(flow.id)}
              >
                <Plus className="h-4 w-4" />
                {flow.label}
              </Button>
            ))}
          </>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Physical data source registry</CardTitle>
              <CardDescription>
                Search, filter by class type, select rows, and bulk delete the current filtered set.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              actionMenuLabel="Physical data source actions"
              accessory={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <select
                    value={classTypeFilterValue}
                    onChange={(event) => setClassTypeFilterValue(event.target.value)}
                    className="flex h-10 min-w-[220px] rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/30"
                    aria-label="Filter by class type"
                  >
                    {classTypeFilterOptions.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Badge variant="neutral">{`${totalItems} rows`}</Badge>
                </div>
              }
              bulkActions={bulkActions}
              clearSelectionLabel="Clear selection"
              onClearSelection={clearSelection}
              renderSelectionSummary={(count) =>
                selectAllMatching
                  ? `All ${count} matching physical data sources selected`
                  : `${count} physical data sources selected`
              }
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search physical data sources"
              selectionCount={selectionCount}
            />

            {showSelectAllMatchingHint ? (
              <div className="rounded-[calc(var(--radius)-8px)] border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-foreground">
                <span>{`All ${pageRows.length} rows on this page are selected.`}</span>{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
                  onClick={selectAllMatchingResults}
                >
                  {`Select all ${totalItems} matching physical data sources`}
                </button>
                .
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {physicalDataSourcesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading physical data sources
              </div>
            </div>
          ) : null}

          {physicalDataSourcesQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(physicalDataSourcesQuery.error)}
              </div>
            </div>
          ) : null}

          {!physicalDataSourcesQuery.isLoading &&
          !physicalDataSourcesQuery.isError &&
          totalItems === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">
                No physical data sources found
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust the current search or class-type filter, or route into one of the create flows.
              </p>
            </div>
          ) : null}

          {!physicalDataSourcesQuery.isLoading &&
          !physicalDataSourcesQuery.isError &&
          totalItems > 0 ? (
            <div className="overflow-x-auto px-4 py-4">
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
                    <th className="w-12 px-3 py-[var(--table-standard-header-padding-y)]">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all visible physical data sources"
                        checked={allPageSelected}
                        indeterminate={somePageSelected}
                        onChange={toggleAllCurrentPage}
                      />
                    </th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Display name</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Type</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Status</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const selected = selectAllMatching || selection.isSelected(row.id);
                    const rowRouted = activePhysicalDataSourceId === row.id;
                    const iconSource = resolvePhysicalDataSourceIcon({
                      classType: row.class_type,
                      sourceLogo: row.source_logo,
                    });

                    return (
                      <tr
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => openPhysicalDataSourceDetail(row.id)}
                      >
                        <td
                          className={cn(
                            getRegistryTableCellClassName(selected, "left"),
                            rowRouted && !selected ? "border-primary/30 bg-primary/5" : null,
                          )}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select ${row.display_name}`}
                            checked={selected}
                            onChange={() => toggleRowSelection(row.id)}
                          />
                        </td>
                        <td
                          className={cn(
                            getRegistryTableCellClassName(selected),
                            rowRouted && !selected ? "border-primary/30 bg-primary/5" : null,
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <Database className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="inline-flex items-center gap-1 text-foreground">
                                <span className="font-medium">{row.display_name || `Data source ${row.id}`}</span>
                                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div
                                className="mt-0.5 text-muted-foreground"
                                style={{ fontSize: "var(--table-meta-font-size)" }}
                              >
                                {`Physical data source ID ${row.id}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className={cn(
                            getRegistryTableCellClassName(selected),
                            rowRouted && !selected ? "border-primary/30 bg-primary/5" : null,
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {iconSource ? (
                              <img
                                src={iconSource}
                                alt={row.class_type_label}
                                className="h-8 w-8 rounded-md border border-border/60 bg-background/70 object-contain p-1"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground">
                                <Database className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium text-foreground">{row.class_type_label}</div>
                              <div
                                className="mt-0.5 text-muted-foreground"
                                style={{ fontSize: "var(--table-meta-font-size)" }}
                              >
                                {row.class_type}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className={cn(
                            getRegistryTableCellClassName(selected),
                            rowRouted && !selected ? "border-primary/30 bg-primary/5" : null,
                          )}
                        >
                          <Badge variant={getStatusBadgeVariant(row.status_tone)}>{row.status_label}</Badge>
                        </td>
                        <td
                          className={cn(
                            getRegistryTableCellClassName(selected, "right"),
                            rowRouted && !selected ? "border-primary/30 bg-primary/5" : null,
                          )}
                        >
                          {row.creation_date_display || "Unknown"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!physicalDataSourcesQuery.isLoading &&
          !physicalDataSourcesQuery.isError &&
          totalItems > 0 ? (
            <MainSequenceRegistryPagination
              count={totalItems}
              itemLabel="physical data sources"
              pageIndex={pageIndex}
              pageSize={physicalDataSourcesQuery.data?.pagination.page_size ?? mainSequenceRegistryPageSize}
              onPageChange={setPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>

      <ActionConfirmationDialog
        title="Delete physical data sources"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        tone="danger"
        actionLabel="delete"
        objectLabel={selectionCount === 1 ? "physical data source" : "physical data sources"}
        confirmWord={
          selectAllMatching || selectionCount > 1
            ? "DELETE PHYSICAL DATA SOURCES"
            : "DELETE PHYSICAL DATA SOURCE"
        }
        confirmButtonLabel={
          selectAllMatching || selectionCount > 1
            ? "Delete physical data sources"
            : "Delete physical data source"
        }
        description={
          selectAllMatching
            ? "This will remove every physical data source matching the current filters."
            : "This will remove the selected physical data source records."
        }
        specialText="This action cannot be undone."
        objectSummary={
          selectAllMatching ? (
            <>
              <div className="font-medium">{`All ${totalItems} matching physical data sources`}</div>
              <div className="mt-1 text-muted-foreground">
                {[
                  deferredSearchValue.trim() ? `search=${deferredSearchValue.trim()}` : null,
                  classTypeFilterValue ? `class_type=${classTypeFilterValue}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No active filters"}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">
                {selectionCount === 1
                  ? selection.selectedItems[0]?.display_name || "Physical data source"
                  : `${selectionCount} physical data sources selected`}
              </div>
              <div className="mt-1 text-muted-foreground">
                {selection.selectedItems
                  .slice(0, 3)
                  .map((item) => item.display_name || `Data source ${item.id}`)
                  .join(", ")}
                {selection.selectedItems.length > 3 ? ", ..." : ""}
              </div>
            </>
          )
        }
        onConfirm={handleBulkDelete}
        onSuccess={handleBulkDeleteSuccess}
        successToast={{
          title: (result) => {
            const deletedCount =
              result && typeof result === "object" && "deleted_count" in result
                ? Number((result as { deleted_count?: number }).deleted_count ?? selectionCount)
                : selectionCount;

            return deletedCount === 1
              ? "Physical data source deleted"
              : "Physical data sources deleted";
          },
          description: (result) => {
            const deletedCount =
              result && typeof result === "object" && "deleted_count" in result
                ? Number((result as { deleted_count?: number }).deleted_count ?? selectionCount)
                : selectionCount;

            return deletedCount === 1
              ? "The selected physical data source was deleted."
              : `${deletedCount} physical data sources were deleted.`;
          },
        }}
        errorToast={{
          title: "Physical data source deletion failed",
          description: (error) => formatMainSequenceError(error),
          variant: "error",
        }}
      />
    </div>
  );
}
