import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCcw } from "lucide-react";

import type { AppShellMenuRenderProps } from "@/apps/types";
import { Button } from "@/components/ui/button";
import { fetchAssistantHealth } from "../../runtime/assistant-health-api";
import { fetchStorageUsage } from "../../runtime/storage-usage-api";
import { useAssistantRuntimeAccess } from "./useAssistantRuntimeAccess";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="rounded-[calc(var(--radius)-6px)] border border-white/8 bg-black/10 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-semibold text-topbar-foreground">{value}</div>
      {detail ? <div className="mt-1 text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/8 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="shrink-0 text-sm text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words text-right text-sm font-medium text-topbar-foreground">
        {value}
      </div>
    </div>
  );
}

function getHealthStatusClassName(ok: boolean) {
  return ok
    ? "border-success/25 bg-success/10 text-success"
    : "border-danger/30 bg-danger/10 text-danger";
}

export function AgentSettingsSection(_props: AppShellMenuRenderProps) {
  const assistantRuntime = useAssistantRuntimeAccess();
  const assistantEndpoint = assistantRuntime.assistantEndpoint;
  const sessionToken = assistantRuntime.sessionToken;
  const sessionTokenType = assistantRuntime.sessionTokenType;

  const storageUsageQuery = useQuery({
    queryKey: ["main-sequence-ai", "storage-usage", assistantEndpoint, sessionToken],
    enabled: assistantRuntime.isReady,
    queryFn: ({ signal }) =>
      fetchStorageUsage({
        assistantEndpoint,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
  });
  const healthQuery = useQuery({
    queryKey: ["main-sequence-ai", "assistant-health", assistantEndpoint, sessionToken],
    enabled: assistantRuntime.isReady,
    queryFn: ({ signal }) =>
      fetchAssistantHealth({
        assistantEndpoint,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
  });

  const snapshot = storageUsageQuery.data ?? null;
  const healthSnapshot = healthQuery.data ?? null;
  const capturedAt = formatTimestamp(snapshot?.capturedAt ?? null);
  const healthCapturedAt = formatTimestamp(healthSnapshot?.capturedAt ?? null);
  const consumedPercent = snapshot ? Math.min(Math.max(snapshot.consumedPercentOfTotal, 0), 100) : 0;
  const settingsRefreshing =
    assistantRuntime.isLoading || storageUsageQuery.isFetching || healthQuery.isFetching;

  return (
    <div className="space-y-4 py-4">
      <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">Agents Settings</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Global runtime storage for Agents. This is deployment-level storage usage, not chat or session-only usage.
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={settingsRefreshing}
            onClick={() => {
              if (!assistantRuntime.isReady) {
                void assistantRuntime.refetch();
                return;
              }

              void Promise.all([
                assistantRuntime.refetch(),
                storageUsageQuery.refetch(),
                healthQuery.refetch(),
              ]);
            }}
          >
            {settingsRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {assistantRuntime.isLoading ? (
        <div className="flex items-center gap-2 rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Resolving assistant runtime session
        </div>
      ) : null}

      {assistantRuntime.isError ? (
        <div className="rounded-[calc(var(--radius)-4px)] border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {assistantRuntime.error instanceof Error
            ? assistantRuntime.error.message
            : "Unable to resolve the assistant runtime session."}
        </div>
      ) : null}

      <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">Health endpoint</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Raw response from <span className="font-mono">GET /health</span> on the assistant runtime.
            </div>
          </div>
          {healthSnapshot ? (
            <div
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getHealthStatusClassName(healthSnapshot.ok)}`}
            >
              {healthSnapshot.status} {healthSnapshot.statusText || (healthSnapshot.ok ? "OK" : "Error")}
            </div>
          ) : null}
        </div>

        {healthQuery.isLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading health endpoint
          </div>
        ) : null}

        {healthQuery.isError ? (
          <div className="mt-4 rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {healthQuery.error instanceof Error
              ? healthQuery.error.message
              : "Health endpoint is unavailable right now."}
          </div>
        ) : null}

        {healthSnapshot ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailRow label="URL" value={healthSnapshot.url} />
              <DetailRow label="Captured" value={healthCapturedAt ?? healthSnapshot.capturedAt} />
              <DetailRow
                label="Content type"
                value={healthSnapshot.contentType || "not provided"}
              />
              <DetailRow label="Fetch state" value={healthSnapshot.ok ? "Healthy" : "Unhealthy"} />
            </div>
            <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-words rounded-[calc(var(--radius)-6px)] border border-white/8 bg-black/20 p-3 font-mono text-xs leading-6 text-topbar-foreground">
              {healthSnapshot.bodyText || "(empty response)"}
            </pre>
          </div>
        ) : null}
      </div>

      {storageUsageQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading storage usage
        </div>
      ) : null}

      {storageUsageQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-4px)] border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {storageUsageQuery.error instanceof Error
            ? storageUsageQuery.error.message
            : "Storage usage is unavailable right now."}
        </div>
      ) : null}

      {snapshot ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <SummaryMetric
              label="Total storage"
              value={formatBytes(snapshot.totalBytes)}
              detail={snapshot.root}
            />
            <SummaryMetric
              label="Agents used"
              value={formatBytes(snapshot.consumedBytes)}
              detail={`${formatPercent(snapshot.consumedPercentOfTotal)} of total`}
            />
            <SummaryMetric
              label="Available"
              value={formatBytes(snapshot.availableBytes)}
              detail={capturedAt ? `Captured ${capturedAt}` : null}
            />
          </div>

          <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-topbar-foreground">Agents storage usage</div>
              <div className="text-xs text-muted-foreground">
                {formatBytes(snapshot.consumedBytes)} / {formatBytes(snapshot.totalBytes)}
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${consumedPercent}%` }}
              />
            </div>
          </div>

          <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
            <div className="text-sm font-medium text-topbar-foreground">Storage detail</div>
            <div className="mt-4 space-y-0">
              <DetailRow
                label="Main Sequence"
                value={formatBytes(snapshot.detail.mainsequence.bytes)}
              />
              <DetailRow label="Pi runtime" value={formatBytes(snapshot.detail.pi.bytes)} />
              <DetailRow label="Agents runtime" value={formatBytes(snapshot.detail.astro.bytes)} />
              <DetailRow label="Sessions" value={formatBytes(snapshot.detail.sessions.bytes)} />
              <DetailRow label="System" value={formatBytes(snapshot.detail.system.bytes)} />
            </div>
          </div>

          <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
            <div className="text-sm font-medium text-topbar-foreground">Infrastructure detail</div>
            <div className="mt-4 space-y-0">
              <DetailRow label="Filesystem used" value={formatBytes(snapshot.filesystemUsedBytes)} />
              <DetailRow
                label="Filesystem usage"
                value={formatPercent(snapshot.filesystemUsagePercent)}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
