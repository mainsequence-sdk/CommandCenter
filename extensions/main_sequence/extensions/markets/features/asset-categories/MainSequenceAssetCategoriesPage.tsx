import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Database, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeleteAssetCategories,
  createAssetCategory,
  deleteAssetCategory,
  formatMainSequenceError,
  listAssetCategories,
  mainSequenceRegistryPageSize,
  type AssetCategoryListFilters,
  type AssetCategoryListRow,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";
import {
  AssetCategoryEditorDialog,
  buildCategoryDeleteSummary,
  buildCreatePayload,
  formatCategoryValue,
  getAssetCategoryDetailPath,
  resolveDeletedCount,
  type AssetCategoryEditorValues,
} from "./assetCategoryShared";

type AssetCategoryDeleteIntent = {
  categories: AssetCategoryListRow[];
};

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

function applyPaginationParams(nextParams: URLSearchParams, page: number, pageSize: number) {
  const nextOffset = Math.max(0, (page - 1) * pageSize);

  nextParams.set("limit", String(pageSize));
  nextParams.set("offset", String(nextOffset));
  nextParams.delete("page");
  nextParams.delete("page_size");
}

export function MainSequenceAssetCategoriesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteIntent, setDeleteIntent] = useState<AssetCategoryDeleteIntent | null>(null);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const searchValue = searchParams.get("search") ?? "";
  const pageSize = mainSequenceRegistryPageSize;
  const offsetParam = readPositiveInt(searchParams.get("offset"));
  const pageParam = readPositiveInt(searchParams.get("page"));
  const page = offsetParam !== null ? Math.floor(offsetParam / pageSize) + 1 : (pageParam ?? 1);
  const pageIndex = Math.max(0, page - 1);
  const limit = pageSize;
  const offset = offsetParam ?? Math.max(0, pageIndex * pageSize);
  const needsSearchParamNormalization = useMemo(() => {
    if (pageParam !== null || searchParams.has("page_size")) {
      return true;
    }

    if (
      ["display_name__contains", "unique_identifier__contains", "description__contains"].some((key) =>
        searchParams.has(key),
      )
    ) {
      return true;
    }

    const limitParam = readPositiveInt(searchParams.get("limit"));
    return limitParam !== null && limitParam !== pageSize;
  }, [pageParam, pageSize, searchParams]);

  const deferredSearchValue = useDeferredValue(searchValue);

  const categoryFilters = useMemo(
    () =>
      ({
        search: deferredSearchValue,
        limit,
        offset,
      }) satisfies AssetCategoryListFilters,
    [deferredSearchValue, limit, offset],
  );

  const categoriesQuery = useQuery({
    enabled: !needsSearchParamNormalization,
    queryKey: ["main_sequence", "asset_categories", "list", categoryFilters],
    queryFn: () => listAssetCategories(categoryFilters),
  });

  const pageRows = categoriesQuery.data?.rows ?? [];
  const totalCount = categoriesQuery.data?.pagination?.total_items ?? pageRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const categorySelection = useRegistrySelection(pageRows);

  useEffect(() => {
    const nextParams = new URLSearchParams(location.search);
    let changed = false;

    ["display_name__contains", "unique_identifier__contains", "description__contains"].forEach((key) => {
      if (nextParams.has(key)) {
        nextParams.delete(key);
        changed = true;
      }
    });

    if (nextParams.has("page")) {
      nextParams.delete("page");
      changed = true;
    }

    if (nextParams.has("page_size")) {
      nextParams.delete("page_size");
      changed = true;
    }

    const limitParam = readPositiveInt(nextParams.get("limit"));

    if (limitParam !== null && limitParam !== pageSize) {
      nextParams.set("limit", String(pageSize));
      changed = true;
    }

    if (pageParam !== null && offsetParam === null) {
      nextParams.set("offset", String(Math.max(0, (pageParam - 1) * pageSize)));
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
  }, [location.pathname, location.search, navigate, offsetParam, pageParam, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      const nextParams = new URLSearchParams(location.search);
      applyPaginationParams(nextParams, totalPages, pageSize);

      navigate(
        {
          pathname: location.pathname,
          search: `?${nextParams.toString()}`,
        },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate, page, pageSize, totalPages]);

  const createCategoryMutation = useMutation({
    mutationFn: createAssetCategory,
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "asset_categories"],
      });

      toast({
        variant: "success",
        title: "Category created",
        description: `${category.display_name || `Category ${category.id}`} is now available.`,
      });

      setCreateDialogOpen(false);
      navigate(getAssetCategoryDetailPath(category.id), {
        state: {
          from: `${location.pathname}${location.search}`,
        },
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Category creation failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });

  const categoryBulkActions =
    categorySelection.selectedCount > 0
      ? [
          {
            id: "delete-categories",
            label:
              categorySelection.selectedCount === 1
                ? "Delete selected category"
                : "Delete selected categories",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () =>
              setDeleteIntent({
                categories: categorySelection.selectedItems,
              }),
          },
        ]
      : [];

  const deleteSelectionCategories = deleteIntent?.categories ?? [];
  const deleteDialogTitle =
    deleteSelectionCategories.length === 1 ? "Delete category" : "Delete categories";
  const deleteActionLabel =
    deleteSelectionCategories.length === 1
      ? "delete the selected category"
      : "delete the selected categories";
  const deleteConfirmButtonLabel =
    deleteSelectionCategories.length === 1 ? "Delete category" : "Delete categories";
  const deleteDescription =
    deleteSelectionCategories.length === 1
      ? "This uses the asset-category DELETE endpoint for a single category."
      : "This uses the asset-category bulk-delete endpoint for the selected rows.";
  const deleteObjectSummary = buildCategoryDeleteSummary(deleteSelectionCategories);

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
        applyPaginationParams(nextParams, 1, pageSize);
      },
      { replace: true },
    );
  }

  function handlePageChange(nextPageIndex: number) {
    updateSearchParams((nextParams) => {
      applyPaginationParams(nextParams, nextPageIndex + 1, pageSize);
    });
  }

  async function handleDeleteSuccess(result: unknown) {
    if (!deleteIntent) {
      return;
    }

    const deletedIds = deleteIntent.categories.map((category) => category.id);

    categorySelection.setSelection(
      categorySelection.selectedIds.filter((id) => !deletedIds.includes(id)),
    );

    setDeleteIntent(null);
    await queryClient.invalidateQueries({
      queryKey: ["main_sequence", "asset_categories"],
    });
  }

  async function confirmDelete() {
    if (!deleteIntent) {
      return null;
    }

    if (deleteIntent.categories.length === 1) {
      return deleteAssetCategory(deleteIntent.categories[0].id);
    }

    return bulkDeleteAssetCategories({
      ids: deleteIntent.categories.map((category) => category.id),
    });
  }

  function submitCreate(values: AssetCategoryEditorValues) {
    try {
      createCategoryMutation.mutate(buildCreatePayload(values));
    } catch (error) {
      toast({
        variant: "error",
        title: "Category creation failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Asset Categories"
        description="Browse asset categories, create new groups, and open category detail as a dedicated page."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{`${totalCount} categories`}</Badge>
            <Button type="button" size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create category
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Asset category registry</CardTitle>
              <CardDescription>
                Browse and search the frontend asset-category list. Opening a row routes to a full
                detail page instead of rendering in a modal.
              </CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Category actions"
              accessory={<Badge variant="neutral">{`${totalCount} rows`}</Badge>}
              bulkActions={categoryBulkActions}
              clearSelectionLabel="Clear categories"
              onClearSelection={categorySelection.clearSelection}
              renderSelectionSummary={(selectionCount) => `${selectionCount} categories selected`}
              value={searchValue}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search by id, display name, unique identifier, or description"
              selectionCount={categorySelection.selectedCount}
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {categoriesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading asset categories
              </div>
            </div>
          ) : null}

          {categoriesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(categoriesQuery.error)}
            </div>
          ) : null}

          {!categoriesQuery.isLoading && !categoriesQuery.isError && pageRows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No categories found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search or create a new category to populate the registry.
              </p>
            </div>
          ) : null}

          {!categoriesQuery.isLoading && !categoriesQuery.isError && pageRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="w-12 px-3 pb-2">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all visible categories"
                        checked={categorySelection.allSelected}
                        indeterminate={categorySelection.someSelected}
                        onChange={categorySelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 pb-2">Category</th>
                    <th className="px-4 pb-2">Unique identifier</th>
                    <th className="px-4 pb-2">Description</th>
                    <th className="px-4 pb-2">Assets</th>
                    <th className="px-4 pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((category) => {
                    const selected = categorySelection.isSelected(category.id);

                    return (
                      <tr key={category.id}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select category ${category.id}`}
                            checked={selected}
                            onChange={() => categorySelection.toggleSelection(category.id)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <button
                            type="button"
                            className="group min-w-0 text-left"
                            onClick={() =>
                              navigate(getAssetCategoryDetailPath(category.id), {
                                state: {
                                  from: `${location.pathname}${location.search}`,
                                },
                              })
                            }
                          >
                            <div className="inline-flex items-center gap-1.5 font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
                              <span className="truncate">
                                {formatCategoryValue(category.display_name, `Category ${category.id}`)}
                              </span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                            </div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {`ID ${category.id}`}
                            </div>
                          </button>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="font-mono text-xs text-foreground">
                            {formatCategoryValue(category.unique_identifier)}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="max-w-[360px] truncate text-foreground">
                            {formatCategoryValue(category.description)}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <Badge variant="neutral">{`${category.number_of_assets} assets`}</Badge>
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                navigate(getAssetCategoryDetailPath(category.id), {
                                  state: {
                                    from: `${location.pathname}${location.search}`,
                                  },
                                })
                              }
                            >
                              <ArrowUpRight className="h-4 w-4" />
                              Open
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteIntent({
                                  categories: [category],
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
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
          itemLabel="categories"
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </Card>

      <AssetCategoryEditorDialog
        mode="create"
        open={createDialogOpen}
        onClose={() => {
          if (!createCategoryMutation.isPending) {
            setCreateDialogOpen(false);
          }
        }}
        onSubmit={submitCreate}
        isPending={createCategoryMutation.isPending}
        error={createCategoryMutation.error}
        initialValues={{
          displayName: "",
          uniqueIdentifier: "",
          description: "",
          assetIdsText: "",
        }}
      />

      <ActionConfirmationDialog
        actionLabel={deleteActionLabel}
        confirmButtonLabel={deleteConfirmButtonLabel}
        confirmWord="DELETE"
        description={deleteDescription}
        errorToast={{
          title:
            deleteSelectionCategories.length === 1
              ? "Category deletion failed"
              : "Category bulk delete failed",
          description: (error) =>
            error instanceof Error ? error.message : "The request failed.",
        }}
        objectLabel={deleteSelectionCategories.length === 1 ? "category" : "categories"}
        objectSummary={deleteObjectSummary}
        onClose={() => setDeleteIntent(null)}
        onConfirm={confirmDelete}
        onSuccess={handleDeleteSuccess}
        open={deleteIntent !== null}
        successToast={{
          title:
            deleteSelectionCategories.length === 1 ? "Category deleted" : "Categories deleted",
          description: (result) =>
            deleteSelectionCategories.length === 1
              ? `${formatCategoryValue(
                  deleteSelectionCategories[0]?.display_name,
                  `Category ${deleteSelectionCategories[0]?.id ?? ""}`,
                )} was deleted.`
              : `${resolveDeletedCount(result, deleteSelectionCategories.length)} categories were deleted.`,
        }}
        title={deleteDialogTitle}
        tone="danger"
      />
    </div>
  );
}
