import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Braces, Database, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  bulkDeleteNamespaces,
  fetchNamespaceDetail,
  fetchNamespaceTables,
  formatMainSequenceError,
  listNamespaces,
  mainSequenceRegistryPageSize,
  type MainSequenceNamespaceDetail,
  type MainSequenceNamespaceRecord,
  type MainSequenceNamespaceTableRecord,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { MainSequenceNamespacePermissionsCard } from "./MainSequenceNamespacePermissionsCard";

const mainSequenceNamespaceUidParam = "msNamespaceUid";
const mainSequenceNamespaceTabParam = "msNamespaceTab";
const namespaceDetailTabs = [
  { id: "overview", label: "Overview" },
  { id: "tables", label: "Tables" },
  { id: "permissions", label: "Permissions" },
] as const;
type NamespaceDetailTabId = (typeof namespaceDetailTabs)[number]["id"];
const defaultNamespaceDetailTabId: NamespaceDetailTabId = "overview";

const creationDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCreationDate(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return creationDateFormatter.format(new Date(parsed));
}

function getNamespaceTitle(namespace: MainSequenceNamespaceRecord) {
  return namespace.name.trim() || namespace.uid.trim() || "Unnamed namespace";
}

function getNamespaceDescription(namespace?: MainSequenceNamespaceDetail | MainSequenceNamespaceRecord | null) {
  if (!namespace || !("description" in namespace)) {
    return "";
  }

  return typeof namespace.description === "string" ? namespace.description.trim() : "";
}

function getNamespaceTableTitle(table: MainSequenceNamespaceTableRecord) {
  return table.identifier?.trim() || table.uid;
}

function getNamespaceTableKindLabel(table: MainSequenceNamespaceTableRecord) {
  switch (table.kind) {
    case "meta_table":
      return "Meta Table";
    case "dynamic_table":
      return "Data Node";
    default:
      return "Table";
  }
}

function isNamespaceDetailTabId(value: string | null): value is NamespaceDetailTabId {
  return namespaceDetailTabs.some((tab) => tab.id === value);
}

export function MainSequenceNamespacesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [namespaceTablesPageIndex, setNamespaceTablesPageIndex] = useState(0);
  const [selectedNamespaceUids, setSelectedNamespaceUids] = useState<string[]>([]);
  const deferredSearchValue = useDeferredValue(searchValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedNamespaceUid = searchParams.get(mainSequenceNamespaceUidParam)?.trim() ?? "";
  const isNamespaceDetailOpen = selectedNamespaceUid.length > 0;
  const requestedDetailTabId = searchParams.get(mainSequenceNamespaceTabParam);
  const selectedDetailTabId: NamespaceDetailTabId = isNamespaceDetailTabId(requestedDetailTabId)
    ? requestedDetailTabId
    : defaultNamespaceDetailTabId;

  const namespacesQuery = useQuery({
    queryKey: ["main_sequence", "namespaces", "list"],
    queryFn: () => listNamespaces(),
  });
  const bulkDeleteNamespacesMutation = useMutation({
    mutationFn: (uids: string[]) => bulkDeleteNamespaces(uids),
    onSuccess: async () => {
      setSelectedNamespaceUids([]);
      await queryClient.invalidateQueries({ queryKey: ["main_sequence", "namespaces"] });
    },
  });

  const filteredNamespaces = useMemo(() => {
    const namespaces = namespacesQuery.data ?? [];
    const needle = deferredSearchValue.trim().toLowerCase();

    if (!needle) {
      return namespaces;
    }

    return namespaces.filter((namespace) =>
      [
        namespace.uid,
        namespace.name,
        namespace.description ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [deferredSearchValue, namespacesQuery.data]);

  const totalNamespaces = namespacesQuery.data?.length ?? 0;
  const pageRows = useMemo(() => {
    const start = pageIndex * mainSequenceRegistryPageSize;
    return filteredNamespaces.slice(start, start + mainSequenceRegistryPageSize);
  }, [filteredNamespaces, pageIndex]);
  const selectedNamespaceUidSet = useMemo(() => new Set(selectedNamespaceUids), [selectedNamespaceUids]);
  const allPageRowsSelected =
    pageRows.length > 0 && pageRows.every((namespace) => selectedNamespaceUidSet.has(namespace.uid));

  const selectedNamespace = useMemo(
    () =>
      (namespacesQuery.data ?? []).find((namespace) => namespace.uid === selectedNamespaceUid) ?? null,
    [namespacesQuery.data, selectedNamespaceUid],
  );
  const namespaceDetailQuery = useQuery({
    queryKey: ["main_sequence", "namespaces", "detail", selectedNamespaceUid],
    queryFn: () => fetchNamespaceDetail(selectedNamespaceUid),
    enabled: isNamespaceDetailOpen,
  });
  const namespaceTablesQuery = useQuery({
    queryKey: ["main_sequence", "namespaces", "tables", selectedNamespaceUid],
    queryFn: () => fetchNamespaceTables(selectedNamespaceUid),
    enabled: isNamespaceDetailOpen,
  });
  const resolvedNamespace =
    namespaceDetailQuery.data ??
    selectedNamespace;
  const detailNamespace =
    resolvedNamespace ??
    (selectedNamespaceUid
      ? {
          uid: selectedNamespaceUid,
          name: selectedNamespaceUid,
          description: null,
          creation_date: null,
          created_by_user_uid: null,
          organization_owner_uid: null,
          open_for_everyone: false,
          meta_table_count: 0,
          dynamic_table_metadata_count: 0,
        }
      : null);
  const pagedNamespaceTables = useMemo(() => {
    const rows = namespaceTablesQuery.data ?? [];
    const start = namespaceTablesPageIndex * mainSequenceRegistryPageSize;
    return rows.slice(start, start + mainSequenceRegistryPageSize);
  }, [namespaceTablesPageIndex, namespaceTablesQuery.data]);

  useEffect(() => {
    setPageIndex(0);
  }, [deferredSearchValue]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredNamespaces.length / mainSequenceRegistryPageSize));

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [filteredNamespaces.length, pageIndex]);

  useEffect(() => {
    setNamespaceTablesPageIndex(0);
  }, [selectedNamespaceUid]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((namespaceTablesQuery.data?.length ?? 0) / mainSequenceRegistryPageSize),
    );

    if (namespaceTablesPageIndex > totalPages - 1) {
      setNamespaceTablesPageIndex(totalPages - 1);
    }
  }, [namespaceTablesPageIndex, namespaceTablesQuery.data?.length]);

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

  function openNamespaceDetail(namespaceUid: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceNamespaceUidParam, namespaceUid);
      nextParams.set(mainSequenceNamespaceTabParam, defaultNamespaceDetailTabId);
    });
  }

  function closeNamespaceDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceNamespaceUidParam);
      nextParams.delete(mainSequenceNamespaceTabParam);
    });
  }

  function selectNamespaceDetailTab(tabId: NamespaceDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceNamespaceUidParam, selectedNamespaceUid);
      nextParams.set(mainSequenceNamespaceTabParam, tabId);
    });
  }

  function openMetaTableDetail(metaTableUid: string) {
    navigate(`/app/main-sequence-foundry/meta-tables?msMetaTableUid=${encodeURIComponent(metaTableUid)}`);
  }

  function openDataNodeDetail(dataNodeUid: string) {
    navigate(`/app/main-sequence-foundry/data-nodes?msDataNodeUid=${encodeURIComponent(dataNodeUid)}`);
  }

  function openNamespaceTableDetail(table: MainSequenceNamespaceTableRecord) {
    if (table.kind === "meta_table") {
      openMetaTableDetail(table.uid);
      return;
    }

    if (table.kind === "dynamic_table") {
      openDataNodeDetail(table.uid);
    }
  }

  function toggleNamespaceSelection(namespaceUid: string) {
    setSelectedNamespaceUids((current) =>
      current.includes(namespaceUid)
        ? current.filter((uid) => uid !== namespaceUid)
        : [...current, namespaceUid],
    );
  }

  function toggleVisibleNamespaceSelection() {
    setSelectedNamespaceUids((current) => {
      const nextSelection = new Set(current);

      if (allPageRowsSelected) {
        pageRows.forEach((namespace) => nextSelection.delete(namespace.uid));
      } else {
        pageRows.forEach((namespace) => nextSelection.add(namespace.uid));
      }

      return Array.from(nextSelection);
    });
  }

  function deleteSelectedNamespaces() {
    if (selectedNamespaceUids.length === 0 || bulkDeleteNamespacesMutation.isPending) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedNamespaceUids.length} selected namespace${selectedNamespaceUids.length === 1 ? "" : "s"}?`,
    );

    if (!confirmed) {
      return;
    }

    bulkDeleteNamespacesMutation.mutate(selectedNamespaceUids);
  }

  if (isNamespaceDetailOpen) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Main Sequence"
          title={detailNamespace ? getNamespaceTitle(detailNamespace) : selectedNamespaceUid}
          description={detailNamespace?.description || detailNamespace?.name || selectedNamespaceUid}
          actions={
            <Button type="button" variant="outline" onClick={closeNamespaceDetail}>
              <ArrowLeft className="h-4 w-4" />
              Back to namespaces
            </Button>
          }
        />

        <Card>
          <CardHeader className="border-b border-border/70 pb-4">
            <div className="flex flex-wrap gap-2">
              {namespaceDetailTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={
                    tab.id === selectedDetailTabId
                      ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                      : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
                  }
                  onClick={() => selectNamespaceDetailTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {selectedDetailTabId === "overview" ? (
              <div className="space-y-4">
                {namespaceDetailQuery.isLoading ? (
                  <div className="flex min-h-24 items-center justify-center">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading namespace details
                    </div>
                  </div>
                ) : null}

                {namespaceDetailQuery.isError ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {formatMainSequenceError(namespaceDetailQuery.error)}
                  </div>
                ) : null}

                {!namespaceDetailQuery.isLoading && !namespaceDetailQuery.isError ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Name</div>
                        <div className="mt-2 text-sm font-medium text-foreground">
                          {detailNamespace ? getNamespaceTitle(detailNamespace) : selectedNamespaceUid}
                        </div>
                      </div>
                      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Description</div>
                        <div className="mt-2 font-mono text-sm text-foreground">
                          {detailNamespace?.description || "Not set"}
                        </div>
                      </div>
                      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Namespace UID</div>
                        <div className="mt-2 font-mono text-sm text-foreground">
                          {detailNamespace?.uid ?? selectedNamespaceUid}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Meta Tables</div>
                        <div className="mt-2 text-sm font-medium text-foreground">
                          {detailNamespace?.meta_table_count ?? 0}
                        </div>
                      </div>
                      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Data Nodes</div>
                        <div className="mt-2 text-sm font-medium text-foreground">
                          {detailNamespace?.dynamic_table_metadata_count ?? 0}
                        </div>
                      </div>
                      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Created</div>
                        <div className="mt-2 text-sm font-medium text-foreground">
                          {formatCreationDate(detailNamespace?.creation_date)}
                        </div>
                      </div>
                      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Visibility</div>
                        <div className="mt-2 text-sm font-medium text-foreground">
                          {detailNamespace?.open_for_everyone ? "Public" : "Private"}
                        </div>
                      </div>
                    </div>

                    {getNamespaceDescription(detailNamespace) ? (
                      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-4 py-4 text-sm text-foreground">
                        {getNamespaceDescription(detailNamespace)}
                      </div>
                    ) : (
                      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-4 py-4 text-sm text-muted-foreground">
                        No description is available for this namespace.
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            ) : selectedDetailTabId === "permissions" ? (
              <Card variant="nested">
                <CardHeader className="border-b border-border/70 pb-4">
                  <CardTitle className="text-base">Permissions</CardTitle>
                  <CardDescription>
                    Control who can view and edit this namespace, then propagate those rules to the related tables.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  <MainSequenceNamespacePermissionsCard namespaceUid={selectedNamespaceUid} />
                </CardContent>
              </Card>
            ) : (
              <Card variant="nested">
                <CardHeader className="border-b border-border/70 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Tables</CardTitle>
                      <CardDescription>
                        Tables currently registered under this namespace.
                      </CardDescription>
                    </div>
                    <Badge variant="neutral">{`${namespaceTablesQuery.data?.length ?? 0} tables`}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {namespaceTablesQuery.isLoading ? (
                    <div className="flex min-h-48 items-center justify-center">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading namespace tables
                      </div>
                    </div>
                  ) : null}

                  {namespaceTablesQuery.isError ? (
                    <div className="p-5">
                      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                        {formatMainSequenceError(namespaceTablesQuery.error)}
                      </div>
                    </div>
                  ) : null}

                  {!namespaceTablesQuery.isLoading &&
                  !namespaceTablesQuery.isError &&
                  (namespaceTablesQuery.data?.length ?? 0) === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                        <Database className="h-5 w-5" />
                      </div>
                      <div className="mt-4 text-sm font-medium text-foreground">No tables on this namespace</div>
                    </div>
                  ) : null}

                  {!namespaceTablesQuery.isLoading &&
                  !namespaceTablesQuery.isError &&
                  (namespaceTablesQuery.data?.length ?? 0) > 0 ? (
                    <>
                      <div className="overflow-x-auto px-4 py-4">
                        <table
                          className="w-full min-w-[860px] border-separate text-sm"
                          style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
                        >
                          <thead>
                            <tr
                              className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                              style={{ fontSize: "var(--table-meta-font-size)" }}
                            >
                              <th className="px-4 py-[var(--table-standard-header-padding-y)]">Type</th>
                              <th className="px-4 py-[var(--table-standard-header-padding-y)]">Table</th>
                              <th className="px-4 py-[var(--table-standard-header-padding-y)]">Identifier</th>
                              <th className="px-4 py-[var(--table-standard-header-padding-y)]">Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedNamespaceTables.map((table) => {
                              const canOpen = table.kind === "meta_table" || table.kind === "dynamic_table";
                              return (
                                <tr key={table.uid}>
                                  <td className={getRegistryTableCellClassName(false, "left")}>
                                    <Badge variant="neutral">{getNamespaceTableKindLabel(table)}</Badge>
                                  </td>
                                  <td className={getRegistryTableCellClassName(false, "left")}>
                                    <button
                                      type="button"
                                      className="group inline-flex items-center gap-1.5 rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary disabled:no-underline disabled:opacity-70"
                                      onClick={() => openNamespaceTableDetail(table)}
                                      disabled={!canOpen}
                                    >
                                      <span>{getNamespaceTableTitle(table)}</span>
                                      {canOpen ? (
                                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                                      ) : null}
                                    </button>
                                  </td>
                                  <td className={getRegistryTableCellClassName(false)}>
                                    <div className="text-foreground">{getNamespaceTableTitle(table)}</div>
                                    {table.uid ? (
                                      <div className="mt-0.5 font-mono text-xs text-muted-foreground">{table.uid}</div>
                                    ) : null}
                                  </td>
                                  <td className={getRegistryTableCellClassName(false, "right")}>
                                    <div className="text-foreground">{formatCreationDate(table.creation_date)}</div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <MainSequenceRegistryPagination
                        count={namespaceTablesQuery.data?.length ?? 0}
                        itemLabel="tables"
                        pageIndex={namespaceTablesPageIndex}
                        pageSize={mainSequenceRegistryPageSize}
                        onPageChange={setNamespaceTablesPageIndex}
                      />
                    </>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title="Namespaces"
        description="Browse ts_manager namespaces and inspect the Meta Tables and Data Nodes registered under each namespace."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{`${totalNamespaces} namespaces`}</Badge>
            <Button
              type="button"
              variant="outline"
              onClick={deleteSelectedNamespaces}
              disabled={selectedNamespaceUids.length === 0 || bulkDeleteNamespacesMutation.isPending}
            >
              {bulkDeleteNamespacesMutation.isPending
                ? "Deleting..."
                : `Delete selected${selectedNamespaceUids.length > 0 ? ` (${selectedNamespaceUids.length})` : ""}`}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Namespace registry</CardTitle>
              <CardDescription>
                Load namespace rows from `ts_manager/namespace/` and open the related Meta Tables and Data Nodes in a dedicated detail view.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              accessory={<Badge variant="neutral">{`${filteredNamespaces.length} namespaces`}</Badge>}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by namespace name or UUID"
              searchClassName="max-w-lg"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {bulkDeleteNamespacesMutation.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(bulkDeleteNamespacesMutation.error)}
              </div>
            </div>
          ) : null}

          {namespacesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading namespaces
              </div>
            </div>
          ) : null}

          {namespacesQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(namespacesQuery.error)}
              </div>
            </div>
          ) : null}

          {!namespacesQuery.isLoading && !namespacesQuery.isError && filteredNamespaces.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Braces className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No namespaces found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust the current search to locate a namespace by name or UUID.
              </p>
            </div>
          ) : null}

          {!namespacesQuery.isLoading && !namespacesQuery.isError && filteredNamespaces.length > 0 ? (
            <>
              <div className="overflow-x-auto px-4 py-4">
                <table
                  className="w-full min-w-[860px] border-separate text-sm"
                  style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
                >
                  <thead>
                    <tr
                      className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                      style={{ fontSize: "var(--table-meta-font-size)" }}
                    >
                      <th className="w-12 px-4 py-[var(--table-standard-header-padding-y)]">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border/70 bg-background/60"
                          checked={allPageRowsSelected}
                          onChange={toggleVisibleNamespaceSelection}
                          aria-label="Select visible namespaces"
                        />
                      </th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Name</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Namespace UID</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Meta Tables</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Data Nodes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((namespace) => (
                      <tr key={namespace.uid}>
                        <td className={getRegistryTableCellClassName(false, "left")}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border/70 bg-background/60"
                            checked={selectedNamespaceUidSet.has(namespace.uid)}
                            onChange={() => toggleNamespaceSelection(namespace.uid)}
                            aria-label={`Select namespace ${getNamespaceTitle(namespace)}`}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(false, "left")}>
                          <button
                            type="button"
                            className="group inline-flex items-center gap-1.5 rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                            onClick={() => openNamespaceDetail(namespace.uid)}
                          >
                            <span>{getNamespaceTitle(namespace)}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                          </button>
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          <div className="font-mono text-xs text-muted-foreground">{namespace.uid}</div>
                        </td>
                        <td className={getRegistryTableCellClassName(false, "right")}>
                          <div className="text-foreground">{namespace.meta_table_count}</div>
                        </td>
                        <td className={getRegistryTableCellClassName(false, "right")}>
                          <div className="text-foreground">{namespace.dynamic_table_metadata_count}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <MainSequenceRegistryPagination
                count={filteredNamespaces.length}
                itemLabel="namespaces"
                pageIndex={pageIndex}
                pageSize={mainSequenceRegistryPageSize}
                onPageChange={setPageIndex}
              />
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
