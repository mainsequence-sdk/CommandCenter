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
  bulkDeleteProjectDataSources,
  formatMainSequenceError,
  listProjectDataSources,
  mainSequenceRegistryPageSize,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";
import { MainSequenceProjectDataSourceEditor } from "./MainSequenceProjectDataSourceEditor";

const mainSequenceProjectDataSourceIdParam = "msProjectDataSourceId";
const mainSequencePhysicalDataSourceIdParam = "msPhysicalDataSourceId";
const mainSequenceProjectDataSourceViewParam = "msProjectDataSourceView";
const createProjectDataSourceView = "create";

export function MainSequenceProjectDataSourcesPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deferredSearchValue = useDeferredValue(searchValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeProjectDataSourceId = Number(
    searchParams.get(mainSequenceProjectDataSourceIdParam) ?? "",
  );
  const activePhysicalDataSourceId = Number(
    searchParams.get(mainSequencePhysicalDataSourceIdParam) ?? "",
  );
  const activeView = searchParams.get(mainSequenceProjectDataSourceViewParam) ?? "";
  const isCreateFlowOpen = activeView === createProjectDataSourceView;
  const isEditFlowOpen =
    Number.isFinite(activeProjectDataSourceId) && activeProjectDataSourceId > 0;

  const projectDataSourcesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "project_data_sources",
      "list",
      pageIndex,
      deferredSearchValue.trim(),
    ],
    queryFn: () =>
      listProjectDataSources({
        page: pageIndex + 1,
        pageSize: mainSequenceRegistryPageSize,
        search: deferredSearchValue,
      }),
  });

  const pageRows = projectDataSourcesQuery.data?.rows ?? [];
  const selection = useRegistrySelection(pageRows);
  const totalItems = projectDataSourcesQuery.data?.pagination.total_items ?? 0;
  const allPageSelected = pageRows.length > 0 && (selectAllMatching || selection.allSelected);
  const somePageSelected = !allPageSelected && selection.someSelected;
  const selectionCount = selectAllMatching ? totalItems : selection.selectedCount;
  const showSelectAllMatchingHint =
    !selectAllMatching && selection.allSelected && pageRows.length > 0 && totalItems > pageRows.length;

  useEffect(() => {
    setPageIndex(0);
    setSelectAllMatching(false);
    selection.setSelection([]);
  }, [deferredSearchValue]);

  useEffect(() => {
    const totalPages = Math.max(projectDataSourcesQuery.data?.pagination.total_pages ?? 1, 1);

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, projectDataSourcesQuery.data?.pagination.total_pages]);

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

  function toggleRowSelection(projectDataSourceId: number) {
    if (selectAllMatching) {
      setSelectAllMatching(false);
      selection.setSelection(pageRows.map((row) => row.id).filter((id) => id !== projectDataSourceId));
      return;
    }

    selection.toggleSelection(projectDataSourceId);
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

  function openCreateFlow() {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceProjectDataSourceViewParam, createProjectDataSourceView);
      nextParams.delete(mainSequenceProjectDataSourceIdParam);
      nextParams.delete(mainSequencePhysicalDataSourceIdParam);
    });
  }

  function openProjectDataSourceDetail(projectDataSourceId: number) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceProjectDataSourceIdParam, String(projectDataSourceId));
      nextParams.delete(mainSequenceProjectDataSourceViewParam);
      nextParams.delete(mainSequencePhysicalDataSourceIdParam);
    });
  }

  function openPhysicalDataSourceDetail(physicalDataSourceId: number) {
    navigate(`/app/main_sequence_workbench/physical-data-sources?msPhysicalDataSourceId=${physicalDataSourceId}`);
  }

  function closeEditor() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceProjectDataSourceViewParam);
      nextParams.delete(mainSequenceProjectDataSourceIdParam);
      nextParams.delete(mainSequencePhysicalDataSourceIdParam);
    });
  }

  async function handleBulkDelete() {
    return bulkDeleteProjectDataSources(
      selectAllMatching
        ? {
            selectAll: true,
            search: deferredSearchValue.trim() || undefined,
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
      nextParams.delete(mainSequenceProjectDataSourceIdParam);
      nextParams.delete(mainSequencePhysicalDataSourceIdParam);
    });

    await queryClient.invalidateQueries({
      queryKey: ["main_sequence", "project_data_sources"],
    });
  }

  const bulkActions =
    selectionCount > 0
      ? [
          {
            id: "delete-project-data-sources",
            label: selectAllMatching
              ? "Delete matching project data sources"
              : selectionCount === 1
                ? "Delete selected project data source"
                : "Delete selected project data sources",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => setDeleteDialogOpen(true),
          },
        ]
      : [];

  if (isCreateFlowOpen || isEditFlowOpen) {
    return (
      <MainSequenceProjectDataSourceEditor
        mode={isEditFlowOpen ? "edit" : "create"}
        projectDataSourceId={isEditFlowOpen ? activeProjectDataSourceId : undefined}
        onBack={closeEditor}
        onOpenProjectDataSourceDetail={openProjectDataSourceDetail}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title="Project Data Sources"
        description="Search and manage project data source records."
        actions={
          <>
            <Badge variant="neutral">{`${totalItems} project data sources`}</Badge>
            <Button
              type="button"
              variant={activeView === createProjectDataSourceView ? "secondary" : "default"}
              onClick={openCreateFlow}
            >
              <Plus className="h-4 w-4" />
              Create project data source
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Project data source registry</CardTitle>
              <CardDescription>
                Search project data sources, select rows, and bulk delete the current filtered set.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              actionMenuLabel="Project data source actions"
              accessory={<Badge variant="neutral">{`${totalItems} rows`}</Badge>}
              bulkActions={bulkActions}
              clearSelectionLabel="Clear selection"
              onClearSelection={clearSelection}
              renderSelectionSummary={(count) =>
                selectAllMatching
                  ? `All ${count} matching project data sources selected`
                  : `${count} project data sources selected`
              }
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search project data sources"
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
                  {`Select all ${totalItems} matching project data sources`}
                </button>
                .
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {projectDataSourcesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading project data sources
              </div>
            </div>
          ) : null}

          {projectDataSourcesQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(projectDataSourcesQuery.error)}
              </div>
            </div>
          ) : null}

          {!projectDataSourcesQuery.isLoading &&
          !projectDataSourcesQuery.isError &&
          totalItems === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">
                No project data sources found
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust the current search or route into the create flow.
              </p>
            </div>
          ) : null}

          {!projectDataSourcesQuery.isLoading &&
          !projectDataSourcesQuery.isError &&
          totalItems > 0 ? (
            <div className="overflow-x-auto px-4 py-4">
              <table
                className="w-full min-w-[960px] border-separate"
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
                        ariaLabel="Select all visible project data sources"
                        checked={allPageSelected}
                        indeterminate={somePageSelected}
                        onChange={toggleAllCurrentPage}
                      />
                    </th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                      Display name
                    </th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                      Default
                    </th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                      Physical data source
                    </th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const selected = selectAllMatching || selection.isSelected(row.id);
                    const rowRouted = activeProjectDataSourceId === row.id;
                    const relatedResourceRouted =
                      row.related_resource?.id !== null &&
                      row.related_resource?.id !== undefined &&
                      activePhysicalDataSourceId === row.related_resource.id;

                    return (
                      <tr
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => openProjectDataSourceDetail(row.id)}
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
                                {`Project data source ID ${row.id}`}
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
                          <Badge variant={row.is_default_data_source ? "success" : "neutral"}>
                            {row.is_default_data_source ? "Default" : "Custom"}
                          </Badge>
                        </td>
                        <td
                          className={cn(
                            getRegistryTableCellClassName(selected),
                            rowRouted && !selected ? "border-primary/30 bg-primary/5" : null,
                          )}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {row.related_resource?.id ? (
                            <button
                              type="button"
                              className="group min-w-0 text-left"
                              onClick={() => openPhysicalDataSourceDetail(row.related_resource!.id!)}
                            >
                              <div
                                className={cn(
                                  "inline-flex items-center gap-1 font-medium text-foreground transition-colors group-hover:text-primary",
                                  relatedResourceRouted ? "text-primary" : null,
                                )}
                              >
                                <span className="truncate">{row.related_resource.label || "Linked resource"}</span>
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </div>
                              <div
                                className="mt-0.5 text-muted-foreground"
                                style={{ fontSize: "var(--table-meta-font-size)" }}
                              >
                                {[row.related_resource.class_type, row.related_resource.status]
                                  .filter(Boolean)
                                  .join(" · ") || "No status"}
                              </div>
                            </button>
                          ) : (
                            <span className="text-muted-foreground">No linked resource</span>
                          )}
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

          {!projectDataSourcesQuery.isLoading &&
          !projectDataSourcesQuery.isError &&
          totalItems > 0 ? (
            <MainSequenceRegistryPagination
              count={totalItems}
              itemLabel="project data sources"
              pageIndex={pageIndex}
              pageSize={projectDataSourcesQuery.data?.pagination.page_size ?? mainSequenceRegistryPageSize}
              onPageChange={setPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>

      <ActionConfirmationDialog
        title="Delete project data sources"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        tone="danger"
        actionLabel="delete"
        objectLabel={selectionCount === 1 ? "project data source" : "project data sources"}
        confirmWord={
          selectAllMatching || selectionCount > 1
            ? "DELETE PROJECT DATA SOURCES"
            : "DELETE PROJECT DATA SOURCE"
        }
        confirmButtonLabel={
          selectAllMatching || selectionCount > 1
            ? "Delete project data sources"
            : "Delete project data source"
        }
        description={
          selectAllMatching
            ? "This will remove every project data source matching the current search."
            : "This will remove the selected project data source records."
        }
        specialText="This action cannot be undone."
        objectSummary={
          selectAllMatching ? (
            <>
              <div className="font-medium">{`All ${totalItems} matching project data sources`}</div>
              <div className="mt-1 text-muted-foreground">
                {deferredSearchValue.trim()
                  ? `Current search filter: ${deferredSearchValue.trim()}`
                  : "Current search filter: none"}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">
                {selectionCount === 1
                  ? selection.selectedItems[0]?.display_name || "Project data source"
                  : `${selectionCount} project data sources selected`}
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
              ? "Project data source deleted"
              : "Project data sources deleted";
          },
          description: (result) => {
            const deletedCount =
              result && typeof result === "object" && "deleted_count" in result
                ? Number((result as { deleted_count?: number }).deleted_count ?? selectionCount)
                : selectionCount;

            return deletedCount === 1
              ? "The selected project data source was deleted."
              : `${deletedCount} project data sources were deleted.`;
          },
        }}
        errorToast={{
          title: "Project data source deletion failed",
          description: (error) => formatMainSequenceError(error),
          variant: "error",
        }}
      />
    </div>
  );
}
