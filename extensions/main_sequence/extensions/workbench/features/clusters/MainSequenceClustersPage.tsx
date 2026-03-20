import { useDeferredValue, useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Cloud, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  formatMainSequenceError,
  listClusters,
  mainSequenceRegistryPageSize,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";

export function MainSequenceClustersPage() {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const deferredSearchValue = useDeferredValue(searchValue);

  const clustersQuery = useQuery({
    queryKey: ["main_sequence", "clusters", "list", pageIndex, deferredSearchValue.trim()],
    queryFn: () =>
      listClusters({
        page: pageIndex + 1,
        pageSize: mainSequenceRegistryPageSize,
        search: deferredSearchValue,
      }),
  });

  const pageRows = clustersQuery.data?.rows ?? [];
  const totalItems = clustersQuery.data?.pagination.total_items ?? 0;

  useEffect(() => {
    setPageIndex(0);
  }, [deferredSearchValue]);

  useEffect(() => {
    const totalPages = Math.max(clustersQuery.data?.pagination.total_pages ?? 1, 1);

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [clustersQuery.data?.pagination.total_pages, pageIndex]);

  function openClusterDetail(clusterId: number) {
    navigate(`/clusters/${clusterId}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title="Clusters"
        description="Search cluster records by name or UUID and open the cluster detail route."
        actions={<Badge variant="neutral">{`${totalItems} clusters`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Cluster registry</CardTitle>
              <CardDescription>
                Load cluster rows from the pods cluster registry and route to the numeric-id cluster detail page.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              accessory={<Badge variant="neutral">{`${totalItems} rows`}</Badge>}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by cluster name or UUID"
              searchClassName="max-w-lg"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {clustersQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading clusters
              </div>
            </div>
          ) : null}

          {clustersQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(clustersQuery.error)}
              </div>
            </div>
          ) : null}

          {!clustersQuery.isLoading && !clustersQuery.isError && totalItems === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Cloud className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No clusters found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust the current search to locate a cluster by name or UUID.
              </p>
            </div>
          ) : null}

          {!clustersQuery.isLoading && !clustersQuery.isError && totalItems > 0 ? (
            <div className="overflow-x-auto px-4 py-4">
              <table
                className="w-full min-w-[760px] border-separate text-sm"
                style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
              >
                <thead>
                  <tr
                    className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                    style={{ fontSize: "var(--table-meta-font-size)" }}
                  >
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Cluster name</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">UUID</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.id}>
                      <td className={getRegistryTableCellClassName(false, "left")}>
                        <button
                          type="button"
                          className="group inline-flex items-center gap-1.5 rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                          onClick={() => openClusterDetail(row.id)}
                        >
                          <span>{row.cluster_name || `Cluster ${row.id}`}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                        </button>
                      </td>
                      <td className={getRegistryTableCellClassName(false, "right")}>
                        <button
                          type="button"
                          className="block text-left font-mono text-xs text-muted-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                          onClick={() => openClusterDetail(row.id)}
                        >
                          {row.uuid}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!clustersQuery.isLoading && !clustersQuery.isError && totalItems > 0 ? (
            <MainSequenceRegistryPagination
              count={totalItems}
              itemLabel="clusters"
              pageIndex={pageIndex}
              pageSize={clustersQuery.data?.pagination.page_size ?? mainSequenceRegistryPageSize}
              onPageChange={setPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
