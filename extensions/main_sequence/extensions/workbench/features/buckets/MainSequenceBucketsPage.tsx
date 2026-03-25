import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Database, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeleteBuckets,
  createBucket,
  formatMainSequenceError,
  listBuckets,
  mainSequenceRegistryPageSize,
  type BucketRecord,
} from "../../../../common/api";
import {
  MainSequenceBucketDetail,
  type BucketBrowserState,
  type BucketBrowserSort,
} from "./MainSequenceBucketDetail";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";

const mainSequenceBucketIdParam = "msBucketId";
const mainSequenceBucketPrefixParam = "msBucketPrefix";
const mainSequenceBucketSearchParam = "msBucketSearch";
const mainSequenceBucketSortParam = "msBucketSort";
const mainSequenceBucketDirParam = "msBucketDir";
const mainSequenceBucketPageParam = "msBucketPage";

const defaultBucketBrowserState: BucketBrowserState = {
  prefix: "",
  search: "",
  sort: "name",
  dir: "asc",
  page: 1,
};

function readBucketBrowserState(searchParams: URLSearchParams): BucketBrowserState {
  const sort = searchParams.get(mainSequenceBucketSortParam);
  const dir = searchParams.get(mainSequenceBucketDirParam);
  const page = Number(searchParams.get(mainSequenceBucketPageParam) ?? "");

  return {
    prefix: searchParams.get(mainSequenceBucketPrefixParam) ?? "",
    search: searchParams.get(mainSequenceBucketSearchParam) ?? "",
    sort:
      sort === "created_by_pod" ||
      sort === "creation_date" ||
      sort === "resource" ||
      sort === "size" ||
      sort === "name"
        ? (sort as BucketBrowserSort)
        : "name",
    dir: dir === "desc" ? "desc" : "asc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function MainSequenceBucketsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [exactNameValue, setExactNameValue] = useState("");
  const [nameInValue, setNameInValue] = useState("");
  const [bucketsPageIndex, setBucketsPageIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bucketName, setBucketName] = useState("");
  const [pendingDeleteBuckets, setPendingDeleteBuckets] = useState<BucketRecord[]>([]);
  const deferredSearchValue = useDeferredValue(searchValue);
  const deferredExactNameValue = useDeferredValue(exactNameValue);
  const deferredNameInValue = useDeferredValue(nameInValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedBucketId = Number(searchParams.get(mainSequenceBucketIdParam) ?? "");
  const [bucketBrowserState, setBucketBrowserState] = useState<BucketBrowserState>(() =>
    readBucketBrowserState(searchParams),
  );
  const isBucketDetailOpen = Number.isFinite(selectedBucketId) && selectedBucketId > 0;

  useEffect(() => {
    setBucketBrowserState(readBucketBrowserState(searchParams));
  }, [searchParams]);

  const bucketsQuery = useQuery({
    queryKey: [
      "main_sequence",
      "buckets",
      "list",
      bucketsPageIndex,
      deferredSearchValue.trim(),
      deferredExactNameValue.trim(),
      deferredNameInValue.trim(),
    ],
    queryFn: () =>
      listBuckets({
        limit: mainSequenceRegistryPageSize,
        offset: bucketsPageIndex * mainSequenceRegistryPageSize,
        search: deferredSearchValue,
        name: deferredExactNameValue,
        nameIn: deferredNameInValue,
      }),
  });

  useEffect(() => {
    setBucketsPageIndex(0);
  }, [deferredSearchValue, deferredExactNameValue, deferredNameInValue]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((bucketsQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (bucketsPageIndex > totalPages - 1) {
      setBucketsPageIndex(totalPages - 1);
    }
  }, [bucketsPageIndex, bucketsQuery.data?.count]);

  const bucketSelection = useRegistrySelection(bucketsQuery.data?.results ?? []);
  const selectedBucketFromList = useMemo(
    () => (bucketsQuery.data?.results ?? []).find((bucket) => bucket.id === selectedBucketId) ?? null,
    [bucketsQuery.data?.results, selectedBucketId],
  );
  const createBucketMutation = useMutation({
    mutationFn: createBucket,
    onSuccess: async (bucket) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "buckets"],
      });

      toast({
        variant: "success",
        title: "Bucket created",
        description: `${bucket.name} is now available.`,
      });

      setCreateDialogOpen(false);
      setBucketName("");
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Bucket creation failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const bucketBulkActions =
    bucketSelection.selectedCount > 0
      ? [
          {
            id: "delete-buckets",
            label:
              bucketSelection.selectedCount === 1
                ? "Delete selected bucket"
                : "Delete selected buckets",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => {
              setPendingDeleteBuckets(bucketSelection.selectedItems);
            },
          },
        ]
      : [];

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

  function openBucketDetail(bucketId: number) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceBucketIdParam, String(bucketId));
      nextParams.set(mainSequenceBucketPrefixParam, "");
      nextParams.set(mainSequenceBucketSearchParam, "");
      nextParams.set(mainSequenceBucketSortParam, "name");
      nextParams.set(mainSequenceBucketDirParam, "asc");
      nextParams.set(mainSequenceBucketPageParam, "1");
    });
    setBucketBrowserState(defaultBucketBrowserState);
  }

  function closeBucketDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceBucketIdParam);
      nextParams.delete(mainSequenceBucketPrefixParam);
      nextParams.delete(mainSequenceBucketSearchParam);
      nextParams.delete(mainSequenceBucketSortParam);
      nextParams.delete(mainSequenceBucketDirParam);
      nextParams.delete(mainSequenceBucketPageParam);
    });
    setBucketBrowserState(defaultBucketBrowserState);
  }

  function updateBucketBrowserState(nextState: BucketBrowserState) {
    setBucketBrowserState(nextState);
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceBucketIdParam, String(selectedBucketId));
      nextParams.set(mainSequenceBucketPrefixParam, nextState.prefix);
      nextParams.set(mainSequenceBucketSearchParam, nextState.search);
      nextParams.set(mainSequenceBucketSortParam, nextState.sort);
      nextParams.set(mainSequenceBucketDirParam, nextState.dir);
      nextParams.set(mainSequenceBucketPageParam, String(nextState.page));
    });
  }

  async function handleDeleteBuckets() {
    if (pendingDeleteBuckets.length === 0) {
      return null;
    }

    return bulkDeleteBuckets({
      ids: pendingDeleteBuckets.map((bucket) => bucket.id),
    });
  }

  async function handleDeleteBucketsSuccess(result: unknown) {
    const deletedBucketIds = pendingDeleteBuckets.map((bucket) => bucket.id);
    const deletedCount =
      result && typeof result === "object" && "deleted_count" in result
        ? Number((result as { deleted_count?: number }).deleted_count ?? pendingDeleteBuckets.length)
        : pendingDeleteBuckets.length;

    bucketSelection.setSelection(
      bucketSelection.selectedIds.filter((id) => !deletedBucketIds.includes(id)),
    );
    setPendingDeleteBuckets([]);

    await queryClient.invalidateQueries({
      queryKey: ["main_sequence", "buckets"],
    });

    toast({
      variant: "success",
      title: deletedCount === 1 ? "Bucket deleted" : "Buckets deleted",
      description:
        deletedCount === 1
          ? `${pendingDeleteBuckets[0]?.name ?? "Bucket"} was deleted.`
          : `${deletedCount} buckets were deleted.`,
    });
  }

  if (isBucketDetailOpen) {
    return (
      <MainSequenceBucketDetail
        browserState={bucketBrowserState}
        bucketId={selectedBucketId}
        initialBucket={selectedBucketFromList}
        onBack={closeBucketDetail}
        onUpdateBrowserState={updateBucketBrowserState}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title="Buckets"
        description="Browse and manage bucket objects."
        actions={
          <>
            <Badge variant="neutral">{`${bucketsQuery.data?.count ?? 0} buckets`}</Badge>
            <Button
              onClick={() => {
                createBucketMutation.reset();
                setBucketName("");
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Create bucket
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Bucket registry</CardTitle>
              <CardDescription>
                Search, filter by exact name, or delete selected buckets.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              actionMenuLabel="Bucket actions"
              accessory={<Badge variant="neutral">{`${bucketsQuery.data?.count ?? 0} buckets`}</Badge>}
              bulkActions={bucketBulkActions}
              clearSelectionLabel="Clear buckets"
              onClearSelection={bucketSelection.clearSelection}
              renderSelectionSummary={(selectionCount) => `${selectionCount} buckets selected`}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search buckets"
              selectionCount={bucketSelection.selectedCount}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Exact name
                </label>
                <Input
                  value={exactNameValue}
                  onChange={(event) => setExactNameValue(event.target.value)}
                  placeholder="research-artifacts"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Name in
                </label>
                <Input
                  value={nameInValue}
                  onChange={(event) => setNameInValue(event.target.value)}
                  placeholder="research-artifacts, pipeline-cache"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {bucketsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading buckets
              </div>
            </div>
          ) : null}

          {bucketsQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(bucketsQuery.error)}
              </div>
            </div>
          ) : null}

          {!bucketsQuery.isLoading &&
          !bucketsQuery.isError &&
          (bucketsQuery.data?.results.length ?? 0) === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No buckets found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust the active search or name filters, or create a new bucket.
              </p>
            </div>
          ) : null}

          {!bucketsQuery.isLoading &&
          !bucketsQuery.isError &&
          (bucketsQuery.data?.results.length ?? 0) > 0 ? (
            <div className="overflow-x-auto px-4 py-4">
              <table
                className="w-full min-w-[880px] border-separate"
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
                        ariaLabel="Select all visible buckets"
                        checked={bucketSelection.allSelected}
                        indeterminate={bucketSelection.someSelected}
                        onChange={bucketSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Bucket</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)] text-right">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {(bucketsQuery.data?.results ?? []).map((bucket) => {
                    const selected = bucketSelection.isSelected(bucket.id);

                    return (
                      <tr
                        key={bucket.id}
                        className="cursor-pointer"
                        onClick={() => openBucketDetail(bucket.id)}
                      >
                        <td
                          className={getRegistryTableCellClassName(selected, "left")}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select ${bucket.name}`}
                            checked={selected}
                            onChange={() => bucketSelection.toggleSelection(bucket.id)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="flex items-start gap-2">
                            <Database className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="inline-flex items-center gap-1 text-foreground">
                                <span className="font-medium">{bucket.name}</span>
                                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div
                                className="mt-0.5 text-muted-foreground"
                                style={{ fontSize: "var(--table-meta-font-size)" }}
                              >
                                Bucket ID {bucket.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className={getRegistryTableCellClassName(selected, "right")}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-danger/25 text-danger hover:bg-danger/10"
                              onClick={() => setPendingDeleteBuckets([bucket])}
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

          {!bucketsQuery.isLoading &&
          !bucketsQuery.isError &&
          (bucketsQuery.data?.count ?? 0) > 0 ? (
            <MainSequenceRegistryPagination
              count={bucketsQuery.data?.count ?? 0}
              itemLabel="buckets"
              pageIndex={bucketsPageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setBucketsPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        title="Create bucket"
        open={createDialogOpen}
        onClose={() => {
          if (!createBucketMutation.isPending) {
            setCreateDialogOpen(false);
          }
        }}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Name
            </label>
            <Input
              value={bucketName}
              onChange={(event) => setBucketName(event.target.value)}
              placeholder="research-artifacts"
              autoFocus
            />
          </div>

          {createBucketMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(createBucketMutation.error)}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createBucketMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!bucketName.trim()) {
                  toast({
                    variant: "error",
                    title: "Bucket creation failed",
                    description: "Name is required.",
                  });
                  return;
                }

                createBucketMutation.mutate({
                  name: bucketName.trim(),
                });
              }}
              disabled={createBucketMutation.isPending || !bucketName.trim()}
            >
              {createBucketMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create bucket
            </Button>
          </div>
        </div>
      </Dialog>

      <ActionConfirmationDialog
        title={pendingDeleteBuckets.length > 1 ? "Delete buckets" : "Delete bucket"}
        open={pendingDeleteBuckets.length > 0}
        onClose={() => setPendingDeleteBuckets([])}
        tone="danger"
        actionLabel="delete"
        objectLabel={pendingDeleteBuckets.length > 1 ? "buckets" : "bucket"}
        confirmWord={pendingDeleteBuckets.length > 1 ? "DELETE BUCKETS" : "DELETE BUCKET"}
        confirmButtonLabel={pendingDeleteBuckets.length > 1 ? "Delete buckets" : "Delete bucket"}
        description={
          pendingDeleteBuckets.length > 1
            ? "This will remove the selected buckets."
            : "This will remove the selected bucket."
        }
        specialText="This action cannot be undone."
        objectSummary={
          pendingDeleteBuckets.length === 1 ? (
            <>
              <div className="font-medium">{pendingDeleteBuckets[0]?.name}</div>
              <div className="mt-1 text-muted-foreground">
                {pendingDeleteBuckets[0] ? `Bucket ID ${pendingDeleteBuckets[0].id}` : null}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">{pendingDeleteBuckets.length} buckets selected</div>
              <div className="mt-1 text-muted-foreground">
                {pendingDeleteBuckets
                  .slice(0, 3)
                  .map((bucket) => bucket.name)
                  .join(", ")}
                {pendingDeleteBuckets.length > 3 ? ", ..." : ""}
              </div>
            </>
          )
        }
        onConfirm={handleDeleteBuckets}
        onSuccess={handleDeleteBucketsSuccess}
        errorToast={{
          title: pendingDeleteBuckets.length > 1 ? "Bucket deletion failed" : "Bucket delete failed",
          description: (error) => formatMainSequenceError(error),
          variant: "error",
        }}
      />
    </div>
  );
}
