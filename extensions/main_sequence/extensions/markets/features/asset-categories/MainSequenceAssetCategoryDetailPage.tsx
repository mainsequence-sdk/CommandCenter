import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Database, Loader2, PencilLine, Trash2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  deleteAssetCategory,
  fetchAssetCategoryDetail,
  formatMainSequenceError,
  listAssets,
  mainSequenceRegistryPageSize,
  updateAssetCategory,
  type AssetListRow,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import {
  AssetCategoryEditorDialog,
  buildCategoryDeleteSummary,
  buildCategoryListRowFromDetail,
  buildCategorySummary,
  buildEditorInitialValues,
  buildUpdatePayload,
  formatAssetValue,
  formatCategoryValue,
  getAssetCategoriesListPath,
  readCategoryDetailString,
  resolveDeletedCount,
  type AssetCategoryEditorValues,
} from "./assetCategoryShared";

function readPositiveInt(value: string | null | undefined) {
  const parsed = Number(value ?? "");

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function MainSequenceAssetCategoryDetailPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [nestedAssetSearchValue, setNestedAssetSearchValue] = useState("");
  const [nestedAssetsPageIndex, setNestedAssetsPageIndex] = useState(0);

  const categoryId = readPositiveInt(params.categoryId);
  const deferredNestedAssetSearchValue = useDeferredValue(nestedAssetSearchValue);
  const backPath =
    ((location.state as { from?: string } | null)?.from || "").trim() ||
    getAssetCategoriesListPath();
  const nestedAssetsPageSize = mainSequenceRegistryPageSize;

  const categoryDetailQuery = useQuery({
    queryKey: ["main_sequence", "asset_categories", "detail", categoryId],
    queryFn: () => fetchAssetCategoryDetail(categoryId as number),
    enabled: categoryId !== null,
  });

  const nestedAssetFilters = useMemo(() => {
    if (categoryId === null) {
      return null;
    }

    return {
      search: deferredNestedAssetSearchValue,
      limit: nestedAssetsPageSize,
      offset: nestedAssetsPageIndex * nestedAssetsPageSize,
      categoryId,
    };
  }, [
    categoryId,
    deferredNestedAssetSearchValue,
    nestedAssetsPageIndex,
    nestedAssetsPageSize,
  ]);

  const nestedAssetsQuery = useQuery({
    queryKey: ["main_sequence", "asset_categories", "nested_assets", nestedAssetFilters],
    queryFn: () => listAssets(nestedAssetFilters ?? undefined),
    enabled: nestedAssetFilters !== null,
  });

  const nestedAssets = nestedAssetsQuery.data?.results ?? [];
  const nestedAssetsTotalCount = nestedAssetsQuery.data?.count ?? 0;
  useEffect(() => {
    setNestedAssetSearchValue("");
    setNestedAssetsPageIndex(0);
  }, [categoryId]);

  useEffect(() => {
    setNestedAssetsPageIndex(0);
  }, [deferredNestedAssetSearchValue]);

  useEffect(() => {
    const nestedTotalPages = Math.max(1, Math.ceil(nestedAssetsTotalCount / nestedAssetsPageSize));

    if (nestedAssetsPageIndex > nestedTotalPages - 1) {
      setNestedAssetsPageIndex(nestedTotalPages - 1);
    }
  }, [nestedAssetsPageIndex, nestedAssetsPageSize, nestedAssetsTotalCount]);

  const updateCategoryMutation = useMutation({
    mutationFn: (values: AssetCategoryEditorValues) =>
      updateAssetCategory(categoryId as number, buildUpdatePayload(values)),
    onSuccess: async (category) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "asset_categories"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "assets"],
        }),
      ]);

      toast({
        variant: "success",
        title: "Category updated",
        description: `${category.display_name || `Category ${category.id}`} was updated.`,
      });

      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Category update failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });

  const selectedCategoryRow = categoryDetailQuery.data
    ? buildCategoryListRowFromDetail(categoryDetailQuery.data)
    : null;

  async function handleDeleteSuccess(result: unknown) {
    await queryClient.invalidateQueries({
      queryKey: ["main_sequence", "asset_categories"],
    });

    toast({
      variant: "success",
      title: "Category deleted",
      description:
        selectedCategoryRow !== null
          ? `${formatCategoryValue(
              selectedCategoryRow.display_name,
              `Category ${selectedCategoryRow.id}`,
            )} was deleted.`
          : `${resolveDeletedCount(result, 1)} category was deleted.`,
    });

    navigate(backPath, { replace: true });
  }

  function submitUpdate(values: AssetCategoryEditorValues) {
    if (categoryId === null) {
      return;
    }

    try {
      updateCategoryMutation.mutate(values);
    } catch (error) {
      toast({
        variant: "error",
        title: "Category update failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    }
  }

  if (categoryId === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Main Sequence Markets"
          title="Asset Category"
          description="The requested category id is invalid."
          actions={
            <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" />
              Back to categories
            </Button>
          }
        />
      </div>
    );
  }

  const categoryTitle =
    categoryDetailQuery.data?.title?.trim() ||
    categoryDetailQuery.data?.selected_category.text?.trim() ||
    `Asset Category ${categoryId}`;
  const categorySubtitle = categoryDetailQuery.data?.selected_category.sub_text || "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={categoryTitle}
        description={categorySubtitle || "Review the category metadata and nested migrated asset list."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" />
              Back to categories
            </Button>
            {categoryDetailQuery.data?.actions.can_edit ? (
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(true)}>
                <PencilLine className="h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {categoryDetailQuery.data?.actions.can_delete && selectedCategoryRow ? (
              <Button type="button" variant="danger" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </div>
        }
      />

      {categoryDetailQuery.isLoading ? (
        <Card>
          <CardContent className="flex min-h-56 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading category detail
            </div>
          </CardContent>
        </Card>
      ) : null}

      {categoryDetailQuery.isError ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {categoryDetailQuery.error instanceof Error
                ? categoryDetailQuery.error.message
                : "The request failed."}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {categoryDetailQuery.data ? (
        <>
          <MainSequenceEntitySummaryCard
            summary={buildCategorySummary(categoryDetailQuery.data)}
          />

          <Card>
            <CardHeader className="border-b border-border/70">
              <div>
                <CardTitle>Category details</CardTitle>
                <CardDescription>
                  These fields come from the `frontend_detail` payload on a dedicated page route.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pt-6 md:grid-cols-2">
              {categoryDetailQuery.data.details.map((field) => (
                <div
                  key={field.name}
                  className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-3"
                >
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {field.label}
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {formatCategoryValue(field.value)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="space-y-4">
                <div>
                  <CardTitle>Assets in category</CardTitle>
                  <CardDescription>
                    This uses the asset list endpoint with `categories__id` from the current
                    category route.
                  </CardDescription>
                </div>

                <MainSequenceRegistrySearch
                  accessory={<Badge variant="neutral">{`${nestedAssetsTotalCount} assets`}</Badge>}
                  value={nestedAssetSearchValue}
                  onChange={(event) => setNestedAssetSearchValue(event.target.value)}
                  placeholder="Search assets in this category"
                  searchClassName="max-w-md"
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              {nestedAssetsQuery.isLoading ? (
                <div className="flex min-h-52 items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading category assets
                  </div>
                </div>
              ) : null}

              {nestedAssetsQuery.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(nestedAssetsQuery.error)}
                </div>
              ) : null}

              {!nestedAssetsQuery.isLoading && !nestedAssetsQuery.isError && nestedAssets.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                    <Database className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-sm font-medium text-foreground">No assets found</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Adjust the search or update category membership to populate this list.
                  </p>
                </div>
              ) : null}

              {!nestedAssetsQuery.isLoading && !nestedAssetsQuery.isError && nestedAssets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="px-4 pb-2">Asset</th>
                        <th className="px-4 pb-2">Ticker</th>
                        <th className="px-4 pb-2">Exchange</th>
                        <th className="px-4 pb-2">Sector</th>
                        <th className="px-4 pb-2">Type</th>
                        <th className="px-4 pb-2">Scope</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nestedAssets.map((asset: AssetListRow) => (
                        <tr key={asset.id}>
                          <td className={getRegistryTableCellClassName(false, "left")}>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">
                                {formatAssetValue(
                                  asset.name,
                                  asset.unique_identifier || asset.figi || `Asset ${asset.id}`,
                                )}
                              </div>
                              <div className="mt-1 truncate text-xs text-muted-foreground">
                                {[
                                  `ID ${asset.id}`,
                                  asset.unique_identifier ? `UID ${asset.unique_identifier}` : null,
                                  asset.figi ? `FIGI ${asset.figi}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </div>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {formatAssetValue(asset.ticker)}
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {formatAssetValue(asset.exchange_code)}
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {formatAssetValue(asset.security_market_sector)}
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {formatAssetValue(asset.security_type)}
                          </td>
                          <td className={getRegistryTableCellClassName(false, "right")}>
                            <Badge variant={asset.is_custom_by_organization ? "warning" : "neutral"}>
                              {asset.is_custom_by_organization ? "Custom" : "Standard"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>

            <MainSequenceRegistryPagination
              count={nestedAssetsTotalCount}
              itemLabel="assets"
              pageIndex={nestedAssetsPageIndex}
              pageSize={nestedAssetsPageSize}
              onPageChange={setNestedAssetsPageIndex}
            />
          </Card>

          <AssetCategoryEditorDialog
            mode="edit"
            open={editDialogOpen}
            onClose={() => {
              if (!updateCategoryMutation.isPending) {
                setEditDialogOpen(false);
              }
            }}
            onSubmit={submitUpdate}
            isPending={updateCategoryMutation.isPending}
            error={updateCategoryMutation.error}
            initialValues={buildEditorInitialValues(categoryDetailQuery.data)}
          />

          <ActionConfirmationDialog
            actionLabel="delete the selected category"
            confirmButtonLabel="Delete category"
            confirmWord="DELETE"
            description="This uses the asset-category DELETE endpoint on the dedicated detail page."
            errorToast={{
              title: "Category deletion failed",
              description: (error) =>
                error instanceof Error ? error.message : "The request failed.",
            }}
            objectLabel="category"
            objectSummary={selectedCategoryRow ? buildCategoryDeleteSummary([selectedCategoryRow]) : null}
            onClose={() => setDeleteDialogOpen(false)}
            onConfirm={() => deleteAssetCategory(categoryId)}
            onSuccess={handleDeleteSuccess}
            open={deleteDialogOpen}
            title="Delete category"
            tone="danger"
          />
        </>
      ) : null}
    </div>
  );
}
