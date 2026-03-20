import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  createExecutionVenue,
  formatMainSequenceError,
  listExecutionVenues,
  mainSequenceRegistryPageSize,
  type ExecutionVenueListFilters,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import {
  ExecutionVenueEditorDialog,
  buildExecutionVenueCreatePayload,
  formatExecutionVenueValue,
  getExecutionVenueDetailPath,
  type ExecutionVenueEditorValues,
} from "./executionVenueShared";

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

export function MainSequenceExecutionVenuesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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

    const limitParam = readPositiveInt(searchParams.get("limit"));
    return limitParam !== null && limitParam !== pageSize;
  }, [pageParam, pageSize, searchParams]);

  const deferredSearchValue = useDeferredValue(searchValue);

  const executionVenueFilters = useMemo(
    () =>
      ({
        search: deferredSearchValue,
        limit,
        offset,
      }) satisfies ExecutionVenueListFilters,
    [deferredSearchValue, limit, offset],
  );

  const executionVenuesQuery = useQuery({
    enabled: !needsSearchParamNormalization,
    queryKey: ["main_sequence", "execution_venues", "list", executionVenueFilters],
    queryFn: () => listExecutionVenues(executionVenueFilters),
  });

  const pageRows = executionVenuesQuery.data?.results ?? [];
  const totalCount = executionVenuesQuery.data?.count ?? pageRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

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

  const createExecutionVenueMutation = useMutation({
    mutationFn: createExecutionVenue,
    onSuccess: async (executionVenue) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "execution_venues"],
      });

      toast({
        variant: "success",
        title: "Execution venue created",
        description: `${executionVenue.name || executionVenue.symbol || `Venue ${executionVenue.id}`} is now available.`,
      });

      setCreateDialogOpen(false);
      navigate(getExecutionVenueDetailPath(executionVenue.id), {
        state: {
          from: `${location.pathname}${location.search}`,
        },
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Execution venue creation failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });

  function submitCreate(values: ExecutionVenueEditorValues) {
    try {
      createExecutionVenueMutation.mutate(buildExecutionVenueCreatePayload(values));
    } catch (error) {
      toast({
        variant: "error",
        title: "Execution venue creation failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Execution Venues"
        description="Browse execution venues, create new ones, and open venue detail as a dedicated page."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{`${totalCount} venues`}</Badge>
            <Button type="button" size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create venue
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Execution venue registry</CardTitle>
              <CardDescription>
                Browse and search execution venues backed by the standard DRF list contract.
              </CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Execution venue actions"
              accessory={<Badge variant="neutral">{`${totalCount} rows`}</Badge>}
              value={searchValue}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search by name or symbol"
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {executionVenuesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading execution venues
              </div>
            </div>
          ) : null}

          {executionVenuesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(executionVenuesQuery.error)}
            </div>
          ) : null}

          {!executionVenuesQuery.isLoading && !executionVenuesQuery.isError && pageRows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">
                No execution venues found
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search or create a new execution venue.
              </p>
            </div>
          ) : null}

          {!executionVenuesQuery.isLoading && !executionVenuesQuery.isError && pageRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 pb-2">Symbol</th>
                    <th className="px-4 pb-2">Name</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((executionVenue) => (
                    <tr
                      key={executionVenue.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate(getExecutionVenueDetailPath(executionVenue.id), {
                          state: {
                            from: `${location.pathname}${location.search}`,
                          },
                        })
                      }
                    >
                      <td className={getRegistryTableCellClassName(false, "left")}>
                        <div className="font-medium text-foreground">
                          {formatExecutionVenueValue(
                            executionVenue.symbol,
                            `Venue ${executionVenue.id}`,
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{`ID ${executionVenue.id}`}</div>
                      </td>
                      <td className={getRegistryTableCellClassName(false, "right")}>
                        {formatExecutionVenueValue(executionVenue.name)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>

        <MainSequenceRegistryPagination
          count={totalCount}
          itemLabel="venues"
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </Card>

      <ExecutionVenueEditorDialog
        mode="create"
        open={createDialogOpen}
        onClose={() => {
          if (!createExecutionVenueMutation.isPending) {
            setCreateDialogOpen(false);
          }
        }}
        onSubmit={submitCreate}
        isPending={createExecutionVenueMutation.isPending}
        error={createExecutionVenueMutation.error}
        initialValues={{
          symbol: "",
          name: "",
        }}
      />
    </div>
  );
}
