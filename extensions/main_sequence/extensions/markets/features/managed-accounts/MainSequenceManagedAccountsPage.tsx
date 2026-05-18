import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Database, Loader2, Plus } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  createManagedAccount,
  formatMainSequenceError,
  listManagedAccounts,
  mainSequenceRegistryPageSize,
  type ManagedAccountListFilters,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import {
  formatManagedAccountValue,
  getManagedAccountDetailPath,
} from "./managedAccountShared";
import {
  buildManagedAccountCreatePayload,
  ManagedAccountEditorDialog,
  type ManagedAccountEditorValues,
} from "./managedAccountEditor";

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

export function MainSequenceManagedAccountsPage() {
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

  const managedAccountFilters = useMemo(
    () =>
      ({
        search: deferredSearchValue,
        limit,
        offset,
      }) satisfies ManagedAccountListFilters,
    [deferredSearchValue, limit, offset],
  );

  const managedAccountsQuery = useQuery({
    enabled: !needsSearchParamNormalization,
    queryKey: ["main_sequence", "managed_accounts", "list", managedAccountFilters],
    queryFn: () => listManagedAccounts(managedAccountFilters),
  });

  const pageRows = managedAccountsQuery.data?.results ?? [];
  const totalCount = managedAccountsQuery.data?.count ?? pageRows.length;
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

  const createManagedAccountMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createManagedAccount>[0]) => {
      const normalizedAccountName = input.account_name.trim().toLowerCase();
      const existingAccounts = await listManagedAccounts({
        search: input.account_name,
        limit: 25,
        offset: 0,
      });

      const duplicate = existingAccounts.results.some((account) => {
        const candidate =
          account.display_name ?? account.account_name ?? account.name ?? "";

        return candidate.trim().toLowerCase() === normalizedAccountName;
      });

      if (duplicate) {
        throw new Error("Account name must be unique.");
      }

      return createManagedAccount(input);
    },
    onSuccess: async (account) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "managed_accounts"],
      });

      toast({
        variant: "success",
        title: "Account created",
        description: `${formatManagedAccountValue(account.display_name ?? account.account_name ?? account.name, `Account ${account.id}`)} is now available.`,
      });

      setCreateDialogOpen(false);
      navigate(getManagedAccountDetailPath(account.id), {
        state: {
          from: `${location.pathname}${location.search}`,
        },
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Account creation failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });

  function submitCreate(values: ManagedAccountEditorValues) {
    try {
      createManagedAccountMutation.mutate(buildManagedAccountCreatePayload(values));
    } catch (error) {
      toast({
        variant: "error",
        title: "Account creation failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Accounts"
        description="Browse managed accounts and open dedicated account detail in the shared registry style."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{`${totalCount} accounts`}</Badge>
            <Button type="button" size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create account
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Managed account registry</CardTitle>
              <CardDescription>
                Search managed accounts and review their broker, venue, and status metadata.
              </CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Managed account actions"
              accessory={<Badge variant="neutral">{`${totalCount} rows`}</Badge>}
              value={searchValue}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search by name, account number, broker, venue, or status"
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {managedAccountsQuery.isLoading ? (
            <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading managed accounts
            </div>
          ) : null}

          {managedAccountsQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(managedAccountsQuery.error)}
              </div>
            </div>
          ) : null}

          {!managedAccountsQuery.isLoading && !managedAccountsQuery.isError && pageRows.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-border/70 text-muted-foreground">
                <Database className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">No managed accounts found</div>
                <div className="text-sm text-muted-foreground">
                  Try a different search term or refresh when the backend account registry is available.
                </div>
              </div>
            </div>
          ) : null}

          {!managedAccountsQuery.isLoading && !managedAccountsQuery.isError && pageRows.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {["Account", "Account Number", "Broker", "Venue", "Type", "Status"].map((label, index, all) => (
                        <th
                          key={label}
                          className={index === 0 ? "px-4 pb-2 w-[28%]" : "px-4 pb-2"}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((account) => (
                      <tr
                        key={account.id}
                        className="group cursor-pointer"
                        onClick={() => {
                          navigate(getManagedAccountDetailPath(account.id), {
                            state: {
                              from: `${location.pathname}${location.search}`,
                            },
                          });
                        }}
                      >
                        <td className={getRegistryTableCellClassName(false, "left")}>
                          <Link
                            to={getManagedAccountDetailPath(account.id)}
                            state={{
                              from: `${location.pathname}${location.search}`,
                            }}
                            className="group inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:text-primary focus-visible:decoration-primary focus-visible:outline-none"
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            <span className="truncate">
                              {formatManagedAccountValue(
                                account.display_name ?? account.account_name ?? account.name,
                                `Account ${account.id}`,
                              )}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                          </Link>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {`ID ${account.id}`}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          {formatManagedAccountValue(account.account_number)}
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          {formatManagedAccountValue(account.broker_name)}
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          {formatManagedAccountValue(account.execution_venue_name)}
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          {formatManagedAccountValue(account.account_type)}
                        </td>
                        <td className={getRegistryTableCellClassName(false, "right")}>
                          {formatManagedAccountValue(account.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </>
          ) : null}
        </CardContent>
        <MainSequenceRegistryPagination
          count={totalCount}
          itemLabel="accounts"
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </Card>

      <ManagedAccountEditorDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={submitCreate}
        isPending={createManagedAccountMutation.isPending}
        error={createManagedAccountMutation.error}
      />
    </div>
  );
}
