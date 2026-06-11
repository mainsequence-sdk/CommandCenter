import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Database, Loader2, Save, Trash2, Weight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";

import {
  deletePortfolioSignal,
  deletePortfolioSignalWeights,
  fetchPortfolioSignal,
  formatMainSequenceError,
  listPortfolioSignals,
  mainSequenceRegistryPageSize,
  updatePortfolioSignal,
  type PortfolioSignalListFilters,
  type PortfolioSignalRecord,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";

type SignalDeleteIntent =
  | {
      type: "weights";
      signal: PortfolioSignalRecord;
    }
  | {
      type: "signal";
      signal: PortfolioSignalRecord;
    }
  | {
      type: "selection";
      signals: PortfolioSignalRecord[];
    };

type PortfolioSignalFormValues = {
  signalUid: string;
  signalDescription: string;
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

function readSignalText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getSignalTitle(signal: PortfolioSignalRecord | null) {
  if (!signal) {
    return "Portfolio Signal";
  }

  return readSignalText(signal.signal_uid, `Signal ${signal.uid}`);
}

function buildDeleteSummary(signal: PortfolioSignalRecord | null) {
  if (!signal) {
    return null;
  }

  return (
    <div className="space-y-1 text-sm">
      <div className="font-medium text-foreground">{getSignalTitle(signal)}</div>
      <div className="font-mono text-xs text-muted-foreground">{signal.uid}</div>
      {signal.signal_description ? (
        <div className="text-muted-foreground">{signal.signal_description}</div>
      ) : null}
    </div>
  );
}

function buildSelectionDeleteSummary(signals: PortfolioSignalRecord[]) {
  if (signals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {signals.slice(0, 5).map((signal) => (
        <div key={signal.uid} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{getSignalTitle(signal)}</div>
            <div className="truncate text-xs text-muted-foreground">
              {[`UID ${signal.uid}`, signal.signal_description || null].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      ))}
      {signals.length > 5 ? (
        <div className="text-xs text-muted-foreground">
          {`${signals.length - 5} more selected signals`}
        </div>
      ) : null}
    </div>
  );
}

function readDeletedCount(result: unknown, key: "deleted_count" | "deleted_weights_count") {
  if (
    result &&
    typeof result === "object" &&
    key in result &&
    typeof (result as Record<string, unknown>)[key] === "number"
  ) {
    return (result as Record<string, number>)[key];
  }

  return 0;
}

function PortfolioSignalForm({
  error,
  initialSignal,
  isPending,
  onCancel,
  onSubmit,
}: {
  error: unknown;
  initialSignal: PortfolioSignalRecord | null;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (values: PortfolioSignalFormValues) => void;
}) {
  const [values, setValues] = useState<PortfolioSignalFormValues>({
    signalUid: "",
    signalDescription: "",
  });

  useEffect(() => {
    setValues({
      signalUid: initialSignal?.signal_uid ?? "",
      signalDescription: initialSignal?.signal_description ?? "",
    });
  }, [initialSignal?.signal_description, initialSignal?.signal_uid]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      signalUid: values.signalUid.trim(),
      signalDescription: values.signalDescription.trim(),
    });
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Signal UID
          </span>
          <Input
            value={values.signalUid}
            readOnly
            placeholder="canonical-signal-key"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                signalUid: event.target.value,
              }))
            }
          />
          <span className="block text-xs text-muted-foreground">
            Signal UID is immutable.
          </span>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Description
          </span>
          <Textarea
            className="min-h-28"
            value={values.signalDescription}
            placeholder="Human-readable signal description"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                signalDescription: event.target.value,
              }))
            }
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(error)}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save description
        </Button>
      </div>
    </form>
  );
}

export function MainSequencePortfolioSignalsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [deleteIntent, setDeleteIntent] = useState<SignalDeleteIntent | null>(null);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const searchValue = searchParams.get("search") ?? "";
  const selectedSignalUid = searchParams.get("msPortfolioSignalUid") ?? "";
  const pageSize = mainSequenceRegistryPageSize;
  const offsetParam = readPositiveInt(searchParams.get("offset"));
  const pageParam = readPositiveInt(searchParams.get("page"));
  const page = offsetParam !== null ? Math.floor(offsetParam / pageSize) + 1 : (pageParam ?? 1);
  const pageIndex = Math.max(0, page - 1);
  const limit = pageSize;
  const offset = offsetParam ?? Math.max(0, pageIndex * pageSize);
  const needsSearchParamNormalization = useMemo(() => {
    if (pageParam !== null || searchParams.has("page_size") || searchParams.has("signal_uid")) {
      return true;
    }

    const limitParam = readPositiveInt(searchParams.get("limit"));
    return limitParam !== null && limitParam !== pageSize;
  }, [pageParam, pageSize, searchParams]);
  const deferredSearchValue = useDeferredValue(searchValue);

  const signalFilters = useMemo(
    () =>
      ({
        search: deferredSearchValue,
        limit,
        offset,
      }) satisfies PortfolioSignalListFilters,
    [deferredSearchValue, limit, offset],
  );

  const signalsQuery = useQuery({
    enabled: !needsSearchParamNormalization,
    queryKey: ["main_sequence", "portfolio_signals", "list", signalFilters],
    queryFn: () => listPortfolioSignals(signalFilters),
  });

  const signalDetailQuery = useQuery({
    enabled: Boolean(selectedSignalUid),
    queryKey: ["main_sequence", "portfolio_signals", "detail", selectedSignalUid],
    queryFn: () => fetchPortfolioSignal(selectedSignalUid),
  });

  const pageRows = signalsQuery.data?.results ?? [];
  const totalCount = signalsQuery.data?.count ?? pageRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const selectedSignal = signalDetailQuery.data ?? null;
  const signalSelection = useRegistrySelection(pageRows, (signal) => signal.uid);

  useEffect(() => {
    const nextParams = new URLSearchParams(location.search);
    let changed = false;

    if (nextParams.has("page")) {
      nextParams.delete("page");
      changed = true;
    }

    if (nextParams.has("page_size")) {
      nextParams.delete("page_size");
      changed = true;
    }

    if (nextParams.has("msPortfolioSignalMode")) {
      nextParams.delete("msPortfolioSignalMode");
      changed = true;
    }

    if (nextParams.has("signal_uid")) {
      nextParams.delete("signal_uid");
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

  function openSignal(signalUid: string) {
    updateSearchParams((nextParams) => {
      nextParams.set("msPortfolioSignalUid", signalUid);
      nextParams.delete("msPortfolioSignalMode");
    });
  }

  function closeDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete("msPortfolioSignalUid");
      nextParams.delete("msPortfolioSignalMode");
    });
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

  const updateSignalMutation = useMutation({
    mutationFn: ({
      signalMetadataUid,
      signalDescription,
    }: {
      signalMetadataUid: string;
      signalDescription: string;
    }) => updatePortfolioSignal(signalMetadataUid, { signal_description: signalDescription }),
    onSuccess: async (signal) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "portfolio_signals"],
      });

      toast({
        variant: "success",
        title: "Signal updated",
        description: `${getSignalTitle(signal)} was updated.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Signal update failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const deleteSignalWeightsMutation = useMutation({
    mutationFn: (signalMetadataUid: string) => deletePortfolioSignalWeights(signalMetadataUid),
  });

  const deleteSignalMutation = useMutation({
    mutationFn: (signalMetadataUid: string) => deletePortfolioSignal(signalMetadataUid),
  });

  const deleteSelectedSignalsMutation = useMutation({
    mutationFn: async (signals: PortfolioSignalRecord[]) => {
      let deletedCount = 0;
      let deletedWeightsCount = 0;

      for (const signal of signals) {
        const result = await deletePortfolioSignal(signal.uid);
        const resultDeletedCount = readDeletedCount(result, "deleted_count");

        deletedCount += resultDeletedCount > 0 ? resultDeletedCount : 1;
        deletedWeightsCount += readDeletedCount(result, "deleted_weights_count");
      }

      return {
        deleted_count: deletedCount,
        deleted_weights_count: deletedWeightsCount,
      };
    },
  });

  function submitUpdate(values: PortfolioSignalFormValues) {
    if (!selectedSignalUid) {
      return;
    }

    updateSignalMutation.mutate({
      signalMetadataUid: selectedSignalUid,
      signalDescription: values.signalDescription,
    });
  }

  async function confirmDeleteIntent() {
    if (!deleteIntent) {
      return null;
    }

    if (deleteIntent.type === "weights") {
      return deleteSignalWeightsMutation.mutateAsync(deleteIntent.signal.uid);
    }

    if (deleteIntent.type === "selection") {
      return deleteSelectedSignalsMutation.mutateAsync(deleteIntent.signals);
    }

    return deleteSignalMutation.mutateAsync(deleteIntent.signal.uid);
  }

  async function handleDeleteSuccess() {
    await queryClient.invalidateQueries({
      queryKey: ["main_sequence", "portfolio_signals"],
    });

    if (deleteIntent?.type === "signal") {
      closeDetail();
    }

    if (deleteIntent?.type === "selection") {
      signalSelection.clearSelection();
    }

    setDeleteIntent(null);
  }

  const signalBulkActions =
    signalSelection.selectedCount > 0
      ? [
          {
            id: "delete-signals",
            label:
              signalSelection.selectedCount === 1
                ? "Delete selected signal"
                : "Delete selected signals",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () =>
              setDeleteIntent({
                type: "selection",
                signals: signalSelection.selectedItems,
              }),
          },
        ]
      : [];

  const activeDeleteSignal =
    deleteIntent?.type === "signal" || deleteIntent?.type === "weights" ? deleteIntent.signal : null;
  const deleteIntentIsWeights = deleteIntent?.type === "weights";
  const deleteIntentIsSelection = deleteIntent?.type === "selection";
  const selectedDeleteSignals = deleteIntent?.type === "selection" ? deleteIntent.signals : [];
  const signalDeleteDialog = (
    <ActionConfirmationDialog
      open={deleteIntent !== null}
      onClose={() => {
        if (
          !deleteSignalMutation.isPending &&
          !deleteSignalWeightsMutation.isPending &&
          !deleteSelectedSignalsMutation.isPending
        ) {
          setDeleteIntent(null);
        }
      }}
      title={
        deleteIntentIsWeights
          ? "Delete signal values"
          : deleteIntentIsSelection && selectedDeleteSignals.length !== 1
            ? "Delete signals"
            : "Delete signal"
      }
      tone="danger"
      actionLabel={
        deleteIntentIsWeights
          ? "delete all signal values for this signal"
          : deleteIntentIsSelection && selectedDeleteSignals.length !== 1
            ? "delete the selected signal metadata rows and their signal values"
            : "delete this signal metadata row and its signal values"
      }
      objectLabel={deleteIntentIsSelection ? "portfolio signals" : "portfolio signal"}
      objectSummary={
        deleteIntentIsSelection
          ? buildSelectionDeleteSummary(selectedDeleteSignals)
          : buildDeleteSummary(activeDeleteSignal)
      }
      description={
        deleteIntentIsWeights
          ? "This calls DELETE /api/v1/portfolio-signal/{uid}/weights/ without weights_date, so all signal value rows for the signal are deleted."
          : deleteIntentIsSelection
            ? "This calls DELETE /api/v1/portfolio-signal/{uid}/ for each selected signal. The backend deletes matching signal values first, then deletes each metadata row."
            : "This calls DELETE /api/v1/portfolio-signal/{uid}/. The backend deletes matching signal values first, then deletes the metadata row."
      }
      confirmWord="DELETE"
      confirmButtonLabel={
        deleteIntentIsWeights
          ? "Delete signal values"
          : deleteIntentIsSelection && selectedDeleteSignals.length !== 1
            ? "Delete signals"
            : "Delete signal"
      }
      isPending={
        deleteSignalMutation.isPending ||
        deleteSignalWeightsMutation.isPending ||
        deleteSelectedSignalsMutation.isPending
      }
      onConfirm={confirmDeleteIntent}
      onSuccess={handleDeleteSuccess}
      errorToast={{
        title: deleteIntentIsWeights ? "Signal values deletion failed" : "Signal deletion failed",
        description: (error) => formatMainSequenceError(error),
      }}
      successToast={{
        title: deleteIntentIsWeights
          ? "Signal values deleted"
          : deleteIntentIsSelection && selectedDeleteSignals.length !== 1
            ? "Signals deleted"
            : "Signal deleted",
        description: (result) =>
          deleteIntentIsWeights
            ? `${readDeletedCount(result, "deleted_count")} signal value rows were deleted.`
            : `${readDeletedCount(result, "deleted_count")} signal metadata rows and ${readDeletedCount(
                result,
                "deleted_weights_count",
              )} signal value rows were deleted.`,
      }}
    />
  );

  if (selectedSignalUid) {
    const detailTitle = selectedSignal
      ? getSignalTitle(selectedSignal)
      : `Portfolio Signal ${selectedSignalUid}`;

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Main Sequence Markets"
          title={detailTitle}
          description="Portfolio signal metadata detail."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={closeDetail}>
                <ArrowLeft className="h-4 w-4" />
                Back to signals
              </Button>
              {selectedSignal ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setDeleteIntent({
                        type: "weights",
                        signal: selectedSignal,
                      })
                    }
                  >
                    <Weight className="h-4 w-4" />
                    Delete signal values
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() =>
                      setDeleteIntent({
                        type: "signal",
                        signal: selectedSignal,
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete signal
                  </Button>
                </>
              ) : null}
            </div>
          }
        />

        <Card>
          <CardHeader className="border-b border-border/70">
            <div>
              <CardTitle>Signal detail</CardTitle>
              <CardDescription>
                Signal UID is read-only; description can be updated.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {signalDetailQuery.isLoading ? (
              <div className="flex min-h-48 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading signal detail
                </div>
              </div>
            ) : null}

            {signalDetailQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(signalDetailQuery.error)}
              </div>
            ) : null}

            {selectedSignal ? (
              <PortfolioSignalForm
                initialSignal={selectedSignal}
                isPending={updateSignalMutation.isPending}
                error={updateSignalMutation.error}
                onCancel={closeDetail}
                onSubmit={submitUpdate}
              />
            ) : null}
          </CardContent>
        </Card>

        {signalDeleteDialog}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Portfolio Signals"
        description="Browse and maintain portfolio signal metadata through the selected Markets API connection."
        actions={<Badge variant="neutral">{`${totalCount} signals`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Signal metadata registry</CardTitle>
              <CardDescription>
                Signal metadata records from the selected Markets API connection.
              </CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Signal actions"
              accessory={<Badge variant="neutral">{`${totalCount} signals`}</Badge>}
              bulkActions={signalBulkActions}
              clearSelectionLabel="Clear signals"
              onClearSelection={signalSelection.clearSelection}
              renderSelectionSummary={(selectionCount) => `${selectionCount} signals selected`}
              value={searchValue}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search signal metadata"
              selectionCount={signalSelection.selectedCount}
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {signalsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading portfolio signals
              </div>
            </div>
          ) : null}

          {signalsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(signalsQuery.error)}
            </div>
          ) : null}

          {!signalsQuery.isLoading && !signalsQuery.isError && pageRows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No signals found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search to locate a signal metadata record.
              </p>
            </div>
          ) : null}

          {!signalsQuery.isLoading && !signalsQuery.isError && pageRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="w-12 px-3 pb-2">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all visible portfolio signals"
                        checked={signalSelection.allSelected}
                        indeterminate={signalSelection.someSelected}
                        onChange={signalSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 pb-2">Signal UID</th>
                    <th className="px-4 pb-2">Description</th>
                    <th className="px-4 pb-2">Metadata UID</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((signal) => {
                    const selected = signalSelection.isSelected(signal.uid);

                    return (
                      <tr key={signal.uid}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select portfolio signal ${signal.uid}`}
                            checked={selected}
                            onChange={() => signalSelection.toggleSelection(signal.uid)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <button
                            type="button"
                            className="group min-w-0 text-left"
                            onClick={() => openSignal(signal.uid)}
                          >
                            <div className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
                              <span className="truncate">{getSignalTitle(signal)}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                            </div>
                          </button>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          {signal.signal_description || (
                            <span className="text-muted-foreground">No description</span>
                          )}
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          <span className="font-mono text-xs text-muted-foreground">{signal.uid}</span>
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
          itemLabel="signals"
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </Card>

      {signalDeleteDialog}
    </div>
  );
}
