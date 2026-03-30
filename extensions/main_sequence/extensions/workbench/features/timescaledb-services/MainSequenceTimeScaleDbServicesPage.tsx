import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Database, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  formatMainSequenceError,
  listTimeScaleDBServices,
  mainSequenceRegistryPageSize,
  type TimeScaleDBServiceRecord,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { MainSequenceTimeScaleDbServiceDetail } from "./MainSequenceTimeScaleDbServiceDetail";

const mainSequenceTimeScaleDbServiceIdParam = "msTimeScaleDbServiceId";
const mainSequenceTimeScaleDbServiceTabParam = "msTimeScaleDbServiceTab";

const timeScaleDbServiceDetailTabs = [
  { id: "details", label: "Details" },
  { id: "databases", label: "Databases" },
] as const;

type TimeScaleDbServiceDetailTabId = (typeof timeScaleDbServiceDetailTabs)[number]["id"];

function isTimeScaleDbServiceDetailTabId(
  value: string | null,
): value is TimeScaleDbServiceDetailTabId {
  return timeScaleDbServiceDetailTabs.some((tab) => tab.id === value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

export function MainSequenceTimeScaleDbServicesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const deferredSearchValue = useDeferredValue(searchValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeServiceId = Number(searchParams.get(mainSequenceTimeScaleDbServiceIdParam) ?? "");
  const requestedTabId = searchParams.get(mainSequenceTimeScaleDbServiceTabParam);
  const isDetailOpen = Number.isFinite(activeServiceId) && activeServiceId > 0;
  const activeTabId: TimeScaleDbServiceDetailTabId = isTimeScaleDbServiceDetailTabId(requestedTabId)
    ? requestedTabId
    : "details";

  const servicesQuery = useQuery({
    queryKey: ["main_sequence", "timescaledb_services", "list", pageIndex, deferredSearchValue.trim()],
    queryFn: () =>
      listTimeScaleDBServices({
        page: pageIndex + 1,
        pageSize: mainSequenceRegistryPageSize,
        search: deferredSearchValue,
      }),
  });

  const pageRows = servicesQuery.data?.results ?? [];
  const selectedServiceFromList = useMemo(
    () => pageRows.find((service) => service.id === activeServiceId) ?? null,
    [activeServiceId, pageRows],
  );
  const totalItems = servicesQuery.data?.count ?? 0;

  useEffect(() => {
    setPageIndex(0);
  }, [deferredSearchValue]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalItems / mainSequenceRegistryPageSize));

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalItems]);

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

  function openServiceDetail(serviceId: number) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceTimeScaleDbServiceIdParam, String(serviceId));
      nextParams.set(mainSequenceTimeScaleDbServiceTabParam, "details");
    });
  }

  function closeServiceDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceTimeScaleDbServiceIdParam);
      nextParams.delete(mainSequenceTimeScaleDbServiceTabParam);
    });
  }

  function selectDetailTab(tabId: TimeScaleDbServiceDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceTimeScaleDbServiceTabParam, tabId);
    });
  }

  if (isDetailOpen) {
    return (
      <MainSequenceTimeScaleDbServiceDetail
        activeTabId={activeTabId}
        initialService={selectedServiceFromList}
        onBack={closeServiceDetail}
        onSelectTab={selectDetailTab}
        serviceId={activeServiceId}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title="TimeScaleDB Services"
        description="Browse deployment services by release name, namespace, or numeric id."
        actions={<Badge variant="neutral">{`${totalItems} services`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Service registry</CardTitle>
              <CardDescription>
                Read-only registry of deployment services returned by the pods TimeScaleDB service endpoints.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              accessory={<Badge variant="neutral">{`${totalItems} rows`}</Badge>}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by release name, namespace, or id"
              searchClassName="max-w-lg"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {servicesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading deployment services
              </div>
            </div>
          ) : null}

          {servicesQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(servicesQuery.error)}
              </div>
            </div>
          ) : null}

          {!servicesQuery.isLoading && !servicesQuery.isError && totalItems === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No deployment services found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust the current search to locate a service by release name or namespace.
              </p>
            </div>
          ) : null}

          {!servicesQuery.isLoading && !servicesQuery.isError && totalItems > 0 ? (
            <div className="overflow-x-auto px-4 py-4">
              <table
                className="w-full min-w-[1080px] border-separate text-sm"
                style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
              >
                <thead>
                  <tr
                    className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                    style={{ fontSize: "var(--table-meta-font-size)" }}
                  >
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Release</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Namespace</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Load Balancer</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Storage</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Linked DBs</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((service) => (
                    <tr key={service.id}>
                      <td className={getRegistryTableCellClassName(false, "left")}>
                        <button
                          type="button"
                          className="group inline-flex items-center gap-1.5 rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                          onClick={() => openServiceDetail(service.id)}
                        >
                          <span>{service.release_name?.trim() || `Service ${service.id}`}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                        </button>
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                        <span className="font-mono text-xs text-foreground">
                          {service.namespace?.trim() || "Not set"}
                        </span>
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                        {service.load_balancer_ip?.trim() || "Pending"}
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                        {service.persistence_size?.trim() || "Unknown"}
                      </td>
                      <td className={getRegistryTableCellClassName(false, "right")}>
                        {String(service.linked_data_sources_count ?? 0)}
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                        {formatDateTime(service.creation_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!servicesQuery.isLoading && !servicesQuery.isError && totalItems > 0 ? (
            <MainSequenceRegistryPagination
              count={totalItems}
              itemLabel="services"
              pageIndex={pageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
