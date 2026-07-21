import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import {
  fetchKnativePodRuntimeResourceUsage,
  formatMainSequenceError,
  type EntitySummaryHeader,
  type ScalableServicePodRow,
  type SummaryField,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceJobRunResourceUsageSection } from "../projects/MainSequenceJobRunResourceUsageSection";
import { MainSequenceKnativePodRuntimeLogsTab } from "./MainSequenceKnativePodRuntimeLogsTab";

export type KnativePodRuntimeDetailTabId = "logs" | "resource_usage";

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

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildPodRuntimeSummary(row: ScalableServicePodRow): EntitySummaryHeader {
  const knativeService = row.pod_events?.labels?.["serving.knative.dev/service"]?.trim() || null;
  const highlightFields: SummaryField[] = [
    {
      key: "service_runtime",
      label: "Service Runtime",
      value: row.service_runtime,
      kind: "text",
      icon: "server",
    },
    {
      key: "revision_runtime",
      label: "Revision Runtime",
      value: row.revision_runtime,
      kind: "text",
      icon: "git-branch",
    },
    {
      key: "pod_uid",
      label: "Pod UID",
      value: row.pod_uid,
      kind: "code",
      icon: "fingerprint",
    },
  ];

  if (knativeService) {
    highlightFields.unshift({
      key: "owning_service",
      label: "Owning Service",
      value: knativeService,
      kind: "text",
      icon: "cloud",
    });
  }

  return {
    entity: {
      id: row.uid,
      type: "pod",
      title: row.gke_pod_name,
    },
    badges: [
      {
        key: "status",
        label: row.status || "Unknown",
        tone:
          row.status === "RUNNING"
            ? "success"
            : row.status === "FAILED"
              ? "danger"
              : "neutral",
      },
      ...(row.deleted_at
        ? [
            {
              key: "deleted",
              label: "Deleted",
              tone: "warning" as const,
            },
          ]
        : []),
    ],
    inline_fields: [
      {
        key: "created",
        label: "Created",
        value: formatTimestamp(row.creation_date),
        kind: "text",
        icon: "calendar",
      },
      {
        key: "last_seen",
        label: "Last Seen",
        value: formatTimestamp(row.last_seen_at),
        kind: "text",
        icon: "timer",
      },
      {
        key: "deleted_at",
        label: "Deleted At",
        value: formatTimestamp(row.deleted_at),
        kind: "text",
        icon: "timer-reset",
      },
    ],
    highlight_fields: highlightFields,
    stats: [],
    extensions: {},
    summary_warning: null,
  };
}

export function MainSequenceKnativePodRuntimeDetail({
  activeTabId,
  podRuntime,
  onBack,
  onSelectTab,
}: {
  activeTabId: KnativePodRuntimeDetailTabId;
  podRuntime: ScalableServicePodRow;
  onBack: () => void;
  onSelectTab: (tabId: KnativePodRuntimeDetailTabId) => void;
}) {
  const summary = useMemo(() => buildPodRuntimeSummary(podRuntime), [podRuntime]);
  const resourceUsageQuery = useQuery({
    queryKey: ["main_sequence", "pods", "knative_pod_runtimes", "resource_usage", podRuntime.uid],
    queryFn: () => fetchKnativePodRuntimeResourceUsage(podRuntime.uid),
    enabled: Boolean(podRuntime.uid) && activeTabId === "resource_usage",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            className="transition-colors hover:text-foreground"
            onClick={onBack}
          >
            Pods
          </button>
          <span>/</span>
          <span className="text-foreground">{podRuntime.gke_pod_name}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to pods
        </Button>
      </div>

      <MainSequenceEntitySummaryCard summary={summary} />

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap gap-2">
            {renderTabButton({
              active: activeTabId === "logs",
              label: "Logs",
              onClick: () => onSelectTab("logs"),
            })}
            {renderTabButton({
              active: activeTabId === "resource_usage",
              label: "Resource Usage",
              onClick: () => onSelectTab("resource_usage"),
            })}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {activeTabId === "logs" ? (
            <MainSequenceKnativePodRuntimeLogsTab podRuntimeUid={podRuntime.uid} />
          ) : null}

          {activeTabId === "resource_usage" ? (
            <div className="space-y-4">
              {resourceUsageQuery.isLoading ? (
                <div className="flex min-h-64 items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading resource usage
                  </div>
                </div>
              ) : null}

              {resourceUsageQuery.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(resourceUsageQuery.error)}
                </div>
              ) : null}

              {!resourceUsageQuery.isLoading &&
              !resourceUsageQuery.isError &&
              (resourceUsageQuery.data?.length ?? 0) === 0 ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/12 px-4 py-4 text-sm text-muted-foreground">
                  No resource usage samples were returned for this pod runtime.
                </div>
              ) : null}

              {!resourceUsageQuery.isLoading &&
              !resourceUsageQuery.isError &&
              (resourceUsageQuery.data?.length ?? 0) > 0 ? (
                <MainSequenceJobRunResourceUsageSection points={resourceUsageQuery.data ?? []} />
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
