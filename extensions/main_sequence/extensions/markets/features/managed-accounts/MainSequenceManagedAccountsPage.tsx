import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Database, Loader2, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  deleteManagedAccount,
  formatMainSequenceError,
  listManagedAccounts,
  mainSequenceRegistryPageSize,
  type ManagedAccountListFilters,
  type ManagedAccountListRow,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";
import {
  formatManagedAccountValue,
  getManagedAccountDetailPath,
} from "./managedAccountShared";

type ManagedAccountDeleteIntent = {
  accounts: ManagedAccountListRow[];
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

function getManagedAccountLabel(account: ManagedAccountListRow) {
  return formatManagedAccountValue(
    account.display_name ?? account.account_name ?? account.name,
    "Managed account",
  );
}

function buildManagedAccountDeleteSummary(accounts: ManagedAccountListRow[]) {
  if (accounts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {accounts.slice(0, 5).map((account) => {
        const secondaryLine = [
          typeof account.account_is_active === "boolean"
            ? account.account_is_active
              ? "Active"
              : "Inactive"
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <div key={account.uid} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">
                {getManagedAccountLabel(account)}
              </div>
              {secondaryLine ? (
                <div className="truncate text-xs text-muted-foreground">{secondaryLine}</div>
              ) : null}
            </div>
          </div>
        );
      })}
      {accounts.length > 5 ? (
        <div className="text-xs text-muted-foreground">
          {`${accounts.length - 5} more selected managed accounts`}
        </div>
      ) : null}
    </div>
  );
}

export function MainSequenceManagedAccountsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [deleteIntent, setDeleteIntent] = useState<ManagedAccountDeleteIntent | null>(null);
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
  const managedAccountSelection = useRegistrySelection(pageRows, (account) => account.uid);

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

  const deleteManagedAccountsMutation = useMutation({
    mutationFn: async (accounts: ManagedAccountListRow[]) => {
      await Promise.all(accounts.map((account) => deleteManagedAccount(account.uid)));
      return {
        deleted_count: accounts.length,
        deleted_uids: accounts.map((account) => account.uid),
      };
    },
    onSuccess: async (result) => {
      const deletedUids = result.deleted_uids;

      managedAccountSelection.setSelection(
        managedAccountSelection.selectedIds.filter((uid) => !deletedUids.includes(uid)),
      );
      setDeleteIntent(null);

      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "managed_accounts"],
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Account deletion failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const managedAccountBulkActions =
    managedAccountSelection.selectedCount > 0
      ? [
          {
            id: "delete-managed-accounts",
            label:
              managedAccountSelection.selectedCount === 1
                ? "Delete selected account"
                : "Delete selected accounts",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () =>
              setDeleteIntent({
                accounts: managedAccountSelection.selectedItems,
              }),
          },
        ]
      : [];

  async function confirmDelete() {
    if (!deleteIntent) {
      return null;
    }

    return deleteManagedAccountsMutation.mutateAsync(deleteIntent.accounts);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Accounts"
        description="Browse managed accounts and open dedicated account detail in the shared registry style."
        actions={
          <Badge variant="neutral">{`${totalCount} accounts`}</Badge>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Managed account registry</CardTitle>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Managed account actions"
              accessory={<Badge variant="neutral">{`${totalCount} rows`}</Badge>}
              bulkActions={managedAccountBulkActions}
              clearSelectionLabel="Clear accounts"
              onClearSelection={managedAccountSelection.clearSelection}
              renderSelectionSummary={(selectionCount) =>
                `${selectionCount} managed accounts selected`
              }
              value={searchValue}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search by account name or UID"
              selectionCount={managedAccountSelection.selectedCount}
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
                <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      <th className="w-12 px-3 pb-2">
                        <MainSequenceSelectionCheckbox
                          ariaLabel="Select all visible managed accounts"
                          checked={managedAccountSelection.allSelected}
                          indeterminate={managedAccountSelection.someSelected}
                          onChange={managedAccountSelection.toggleAll}
                        />
                      </th>
                      {["Account", "Paper", "Active"].map((label, index) => (
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
                    {pageRows.map((account) => {
                      const selected = managedAccountSelection.isSelected(account.uid);

                      return (
                      <tr
                        key={account.uid}
                        className="group cursor-pointer"
                        onClick={() => {
                          navigate(getManagedAccountDetailPath(account.uid), {
                            state: {
                              from: `${location.pathname}${location.search}`,
                            },
                          });
                        }}
                      >
                        <td
                          className={getRegistryTableCellClassName(selected, "left")}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select managed account ${getManagedAccountLabel(account)}`}
                            checked={selected}
                            onChange={() => managedAccountSelection.toggleSelection(account.uid)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <Link
                            to={getManagedAccountDetailPath(account.uid)}
                            state={{
                              from: `${location.pathname}${location.search}`,
                            }}
                            className="group inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:text-primary focus-visible:decoration-primary focus-visible:outline-none"
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            <span className="truncate">
                              {getManagedAccountLabel(account)}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                          </Link>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {`UID ${account.uid}`}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          {typeof account.is_paper === "boolean"
                            ? account.is_paper
                              ? "Yes"
                              : "No"
                            : "Not available"}
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          {typeof account.account_is_active === "boolean"
                            ? account.account_is_active
                              ? "Active"
                              : "Inactive"
                            : "Not available"}
                        </td>
                      </tr>
                    )})}
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

      <ActionConfirmationDialog
        open={deleteIntent !== null}
        onClose={() => {
          if (!deleteManagedAccountsMutation.isPending) {
            setDeleteIntent(null);
          }
        }}
        title={
          (deleteIntent?.accounts.length ?? 0) === 1
            ? "Delete account"
            : "Delete accounts"
        }
        tone="danger"
        actionLabel={
          (deleteIntent?.accounts.length ?? 0) === 1
            ? "delete the selected account"
            : "delete the selected accounts"
        }
        objectLabel="account rows"
        objectSummary={buildManagedAccountDeleteSummary(deleteIntent?.accounts ?? [])}
        description="This uses the managed-account delete endpoint for each selected account."
        specialText="This will delete all account history and references, including historical positions and trades."
        confirmWord="DELETE"
        confirmButtonLabel={
          (deleteIntent?.accounts.length ?? 0) === 1
            ? "Delete account"
            : "Delete accounts"
        }
        isPending={deleteManagedAccountsMutation.isPending}
        onConfirm={confirmDelete}
        error={
          deleteManagedAccountsMutation.isError
            ? formatMainSequenceError(deleteManagedAccountsMutation.error)
            : undefined
        }
        successToast={{
          title: (result) => {
            const deletedCount =
              result &&
              typeof result === "object" &&
              "deleted_count" in result &&
              typeof (result as { deleted_count?: unknown }).deleted_count === "number"
                ? (result as { deleted_count: number }).deleted_count
                : deleteIntent?.accounts.length ?? 0;

            return deletedCount === 1 ? "Account deleted" : "Accounts deleted";
          },
          description: (result) => {
            const deletedCount =
              result &&
              typeof result === "object" &&
              "deleted_count" in result &&
              typeof (result as { deleted_count?: unknown }).deleted_count === "number"
                ? (result as { deleted_count: number }).deleted_count
                : deleteIntent?.accounts.length ?? 0;

            return deletedCount === 1
              ? "The selected account was deleted."
              : `${deletedCount} accounts were deleted.`;
          },
        }}
      />
    </div>
  );
}
