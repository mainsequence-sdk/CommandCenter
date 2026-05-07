import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchScalableServiceSummary,
  formatMainSequenceError,
  listScalableServicePods,
  type ScalableServicePodRow,
  type ScalableServiceRecord,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import {
  MainSequenceKnativePodRuntimeDetail,
  type KnativePodRuntimeDetailTabId,
} from "./MainSequenceKnativePodRuntimeDetail";

export type ScalableServiceDetailTabId = "pods";

function getScalableServiceTitle(
  serviceId: number,
  {
    initialService,
    summaryTitle,
  }: {
    initialService: ScalableServiceRecord | null;
    summaryTitle: string | null;
  },
) {
  return (
    summaryTitle?.trim() ||
    (typeof initialService?.display_name === "string" && initialService.display_name.trim()
      ? initialService.display_name.trim()
      : null) ||
    (typeof initialService?.name === "string" && initialService.name.trim()
      ? initialService.name.trim()
      : null) ||
    (typeof initialService?.release_name === "string" && initialService.release_name.trim()
      ? initialService.release_name.trim()
      : null) ||
    `Scalable Service ${serviceId}`
  );
}

function formatPodCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function formatPodTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getKnativeServiceLabel(row: ScalableServicePodRow) {
  const value = row.pod_events?.labels?.["serving.knative.dev/service"];
  return value?.trim() || null;
}

function renderTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={
        active
          ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
          : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
      }
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ScalableServicePodsTableWithSelection({
  rows,
  onOpenPodRuntimeDetail,
}: {
  rows: ScalableServicePodRow[];
  onOpenPodRuntimeDetail: (podRuntimeId: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-4 pb-2">Pod Name</th>
            <th className="px-4 pb-2">Status</th>
            <th className="px-4 pb-2">Knative Service</th>
            <th className="px-4 pb-2">Service Runtime</th>
            <th className="px-4 pb-2">Revision Runtime</th>
            <th className="px-4 pb-2">Pod UID</th>
            <th className="px-4 pb-2">Created</th>
            <th className="px-4 pb-2">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.pod_uid || row.id}
              className="cursor-pointer rounded-[var(--table-row-radius)] transition hover:bg-muted/35"
              onClick={() => onOpenPodRuntimeDetail(row.id)}
            >
              <td className={getRegistryTableCellClassName(false, "left")}>
                <div className="flex items-center gap-2">
                  <div className="font-medium text-foreground">{formatPodCellValue(row.gke_pod_name)}</div>
                </div>
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                {formatPodCellValue(row.status)}
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                {formatPodCellValue(getKnativeServiceLabel(row))}
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                {formatPodCellValue(row.service_runtime)}
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                {formatPodCellValue(row.revision_runtime)}
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                <span className="font-mono text-xs">{formatPodCellValue(row.pod_uid)}</span>
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                {formatPodTimestamp(row.creation_date)}
              </td>
              <td className={getRegistryTableCellClassName(false, "right")}>
                {formatPodTimestamp(row.last_seen_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MainSequenceScalableServiceDetail({
  activeTabId,
  activePodRuntimeId,
  activePodRuntimeTabId,
  initialService,
  onBack,
  onBackFromPodRuntimeDetail,
  onOpenPodRuntimeDetail,
  onSelectPodRuntimeTab,
  onSelectTab,
  serviceId,
}: {
  activeTabId: ScalableServiceDetailTabId;
  activePodRuntimeId: number | null;
  activePodRuntimeTabId: KnativePodRuntimeDetailTabId;
  initialService: ScalableServiceRecord | null;
  onBack: () => void;
  onBackFromPodRuntimeDetail: () => void;
  onOpenPodRuntimeDetail: (podRuntimeId: number) => void;
  onSelectPodRuntimeTab: (tabId: KnativePodRuntimeDetailTabId) => void;
  onSelectTab: (tabId: ScalableServiceDetailTabId) => void;
  serviceId: number;
}) {
  const summaryQuery = useQuery({
    queryKey: ["main_sequence", "scalable_services", "summary", serviceId],
    queryFn: () => fetchScalableServiceSummary(serviceId),
    enabled: serviceId > 0,
  });
  const podsQuery = useQuery({
    queryKey: ["main_sequence", "scalable_services", "pods", serviceId],
    queryFn: () => listScalableServicePods(serviceId),
    enabled: serviceId > 0 && (activeTabId === "pods" || Boolean(activePodRuntimeId)),
  });

  const summary = summaryQuery.data ?? null;
  const pods = useMemo(() => podsQuery.data ?? [], [podsQuery.data]);
  const selectedPodRuntime = useMemo(
    () => pods.find((row) => row.id === activePodRuntimeId) ?? null,
    [activePodRuntimeId, pods],
  );
  const serviceTitle = getScalableServiceTitle(serviceId, {
    initialService,
    summaryTitle: summary?.entity.title ?? null,
  });
  const subtitleParts = useMemo(
    () =>
      [
        typeof initialService?.namespace === "string" && initialService.namespace.trim()
          ? initialService.namespace.trim()
          : typeof initialService?.kubernetes_namespace === "string" &&
              initialService.kubernetes_namespace.trim()
            ? initialService.kubernetes_namespace.trim()
            : null,
        typeof initialService?.service_type === "string" && initialService.service_type.trim()
          ? initialService.service_type.trim()
          : typeof initialService?.scalable_service_type === "string" &&
              initialService.scalable_service_type.trim()
            ? initialService.scalable_service_type.trim()
            : null,
      ].filter(Boolean),
    [initialService],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title={serviceTitle}
        description={
          subtitleParts.length > 0
            ? subtitleParts.join(" · ")
            : "Detail view for the selected scalable service."
        }
        actions={
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to scalable services
          </Button>
        }
      />

      {summaryQuery.isError && !summary ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(summaryQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <MainSequenceEntitySummaryCard summary={summary} />
      ) : (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading scalable service summary
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap gap-2">
            {renderTabButton({
              active: activeTabId === "pods",
              label: "Pods",
              onClick: () => onSelectTab("pods"),
            })}
          </div>
        </CardHeader>
      </Card>

      {selectedPodRuntime ? (
        <MainSequenceKnativePodRuntimeDetail
          activeTabId={activePodRuntimeTabId}
          onBack={onBackFromPodRuntimeDetail}
          onSelectTab={onSelectPodRuntimeTab}
          podRuntime={selectedPodRuntime}
        />
      ) : null}

      {activeTabId === "pods" && !selectedPodRuntime ? (
        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Pods</CardTitle>
            <CardDescription>
              Pods currently returned by the scalable service pods endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {podsQuery.isLoading ? (
              <div className="flex min-h-56 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading scalable service pods
                </div>
              </div>
            ) : null}

            {podsQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(podsQuery.error)}
              </div>
            ) : null}

            {!podsQuery.isLoading && !podsQuery.isError && pods.length === 0 ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/12 px-4 py-4 text-sm text-muted-foreground">
                No pods were returned for this scalable service.
              </div>
            ) : null}

            {!podsQuery.isLoading && !podsQuery.isError && pods.length > 0 ? (
              <ScalableServicePodsTableWithSelection
                rows={pods}
                onOpenPodRuntimeDetail={onOpenPodRuntimeDetail}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
