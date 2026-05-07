import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, Server } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  formatMainSequenceError,
  listScalableServices,
  mainSequenceRegistryPageSize,
  type ScalableServiceRecord,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import {
  MainSequenceScalableServiceDetail,
  type ScalableServiceDetailTabId,
} from "./MainSequenceScalableServiceDetail";
import type { KnativePodRuntimeDetailTabId } from "./MainSequenceKnativePodRuntimeDetail";

const mainSequenceScalableServiceIdParam = "msScalableServiceId";
const mainSequenceScalableServiceTabParam = "msScalableServiceTab";
const mainSequenceScalableServicePodRuntimeIdParam = "msScalableServicePodRuntimeId";
const mainSequenceScalableServicePodRuntimeTabParam = "msScalableServicePodRuntimeTab";

function isScalableServiceDetailTabId(value: string | null): value is ScalableServiceDetailTabId {
  return value === "pods";
}

function isKnativePodRuntimeDetailTabId(value: string | null): value is KnativePodRuntimeDetailTabId {
  return value === "logs" || value === "resource_usage";
}

function pickFirstString(record: ScalableServiceRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function formatDateTime(value: string | null) {
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

function getScalableServiceName(record: ScalableServiceRecord) {
  return (
    pickFirstString(record, ["display_name", "name", "release_name", "service_name"]) ??
    `Scalable Service ${record.id}`
  );
}

function getScalableServiceNamespace(record: ScalableServiceRecord) {
  return pickFirstString(record, ["namespace", "kubernetes_namespace"]) ?? "Not available";
}

function getScalableServiceType(record: ScalableServiceRecord) {
  return pickFirstString(record, ["service_type", "scalable_service_type", "class_type"]) ?? "Not available";
}

function getScalableServiceStatus(record: ScalableServiceRecord) {
  return pickFirstString(record, ["status_label", "status"]) ?? "Not available";
}

function getScalableServiceUrl(record: ScalableServiceRecord) {
  return pickFirstString(record, ["public_url", "service_url", "url"]) ?? "Not available";
}

function getScalableServiceUpdatedAt(record: ScalableServiceRecord) {
  return formatDateTime(
    pickFirstString(record, ["updated_at", "creation_date", "created_at"]),
  );
}

export function MainSequenceScalableServicesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const deferredSearchValue = useDeferredValue(searchValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeServiceId = Number(searchParams.get(mainSequenceScalableServiceIdParam) ?? "");
  const requestedTabId = searchParams.get(mainSequenceScalableServiceTabParam);
  const activePodRuntimeId = Number(
    searchParams.get(mainSequenceScalableServicePodRuntimeIdParam) ?? "",
  );
  const requestedPodRuntimeTabId = searchParams.get(mainSequenceScalableServicePodRuntimeTabParam);
  const isDetailOpen = Number.isFinite(activeServiceId) && activeServiceId > 0;
  const activeTabId: ScalableServiceDetailTabId = isScalableServiceDetailTabId(requestedTabId)
    ? requestedTabId
    : "pods";
  const activePodRuntimeTabId: KnativePodRuntimeDetailTabId =
    isKnativePodRuntimeDetailTabId(requestedPodRuntimeTabId)
      ? requestedPodRuntimeTabId
      : "logs";

  const servicesQuery = useQuery({
    queryKey: ["main_sequence", "scalable_services", "list", pageIndex, deferredSearchValue.trim()],
    queryFn: () =>
      listScalableServices({
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
      nextParams.set(mainSequenceScalableServiceIdParam, String(serviceId));
      nextParams.set(mainSequenceScalableServiceTabParam, "pods");
    });
  }

  function closeServiceDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceScalableServiceIdParam);
      nextParams.delete(mainSequenceScalableServiceTabParam);
      nextParams.delete(mainSequenceScalableServicePodRuntimeIdParam);
      nextParams.delete(mainSequenceScalableServicePodRuntimeTabParam);
    });
  }

  function selectDetailTab(tabId: ScalableServiceDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceScalableServiceTabParam, tabId);
    });
  }

  function openPodRuntimeDetail(podRuntimeId: number) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceScalableServicePodRuntimeIdParam, String(podRuntimeId));
      nextParams.set(mainSequenceScalableServicePodRuntimeTabParam, "logs");
    });
  }

  function closePodRuntimeDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceScalableServicePodRuntimeIdParam);
      nextParams.delete(mainSequenceScalableServicePodRuntimeTabParam);
    });
  }

  function selectPodRuntimeDetailTab(tabId: KnativePodRuntimeDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceScalableServicePodRuntimeTabParam, tabId);
    });
  }

  if (isDetailOpen) {
    return (
      <MainSequenceScalableServiceDetail
        activeTabId={activeTabId}
        activePodRuntimeId={Number.isFinite(activePodRuntimeId) && activePodRuntimeId > 0 ? activePodRuntimeId : null}
        activePodRuntimeTabId={activePodRuntimeTabId}
        initialService={selectedServiceFromList}
        onBack={closeServiceDetail}
        onBackFromPodRuntimeDetail={closePodRuntimeDetail}
        onOpenPodRuntimeDetail={openPodRuntimeDetail}
        onSelectPodRuntimeTab={selectPodRuntimeDetailTab}
        onSelectTab={selectDetailTab}
        serviceId={activeServiceId}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title="Scalable Services"
        description="Browse scalable deployment services by name, namespace, type, or numeric id."
        actions={<Badge variant="neutral">{`${totalItems} services`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Service registry</CardTitle>
              <CardDescription>
                Read-only registry of scalable services returned by the pods scalable-service endpoints.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              accessory={<Badge variant="neutral">{`${totalItems} rows`}</Badge>}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by name, namespace, type, or id"
              searchClassName="max-w-lg"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {servicesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading scalable services
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
                <Server className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No scalable services found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust the current search to locate a service by name, namespace, or type.
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
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Service</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Namespace</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Type</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Status</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">URL</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((service) => (
                    <tr
                      key={service.id}
                      className="cursor-pointer rounded-[var(--table-row-radius)] transition hover:bg-muted/35"
                      onClick={() => openServiceDetail(service.id)}
                    >
                      <td className={getRegistryTableCellClassName(false, "left")}>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium text-foreground">{getScalableServiceName(service)}</div>
                            <div className="font-mono text-xs text-muted-foreground">{`ID ${service.id}`}</div>
                          </div>
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                        {getScalableServiceNamespace(service)}
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                        {getScalableServiceType(service)}
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                        {getScalableServiceStatus(service)}
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                        <span className="font-mono text-xs">{getScalableServiceUrl(service)}</span>
                      </td>
                      <td className={getRegistryTableCellClassName(false, "right")}>
                        {getScalableServiceUpdatedAt(service)}
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
