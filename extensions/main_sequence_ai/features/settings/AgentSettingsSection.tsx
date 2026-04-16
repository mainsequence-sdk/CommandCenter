import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCcw } from "lucide-react";

import type { AppShellMenuRenderProps } from "@/apps/types";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/button";
import { resolveMainSequenceAiAssistantEndpoint } from "../../runtime/assistant-endpoint";
import { fetchStorageUsage } from "../../runtime/storage-usage-api";

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
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-topbar-foreground">{value}</div>
    </div>
  );
}

export function AgentSettingsSection(_props: AppShellMenuRenderProps) {
  const assistantEndpoint = resolveMainSequenceAiAssistantEndpoint();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");

  const storageUsageQuery = useQuery({
    queryKey: ["main-sequence-ai", "storage-usage", assistantEndpoint, sessionToken],
    queryFn: () =>
      fetchStorageUsage({
        assistantEndpoint,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
  });

  const snapshot = storageUsageQuery.data ?? null;
  const capturedAt = formatTimestamp(snapshot?.capturedAt ?? null);
  const consumedPercent = snapshot ? Math.min(Math.max(snapshot.consumedPercentOfTotal, 0), 100) : 0;

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
            disabled={storageUsageQuery.isFetching}
            onClick={() => {
              void storageUsageQuery.refetch();
            }}
          >
            {storageUsageQuery.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
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
