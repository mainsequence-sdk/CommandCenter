import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCcw } from "lucide-react";

import type { AppShellMenuRenderProps } from "@/apps/types";
import { Button } from "@/components/ui/button";
import { buildMainSequenceAiAssistantUrl } from "../../runtime/assistant-endpoint";
import { fetchAssistantHealth } from "../../runtime/assistant-health-api";
import { useAssistantRuntimeAccess } from "./useAssistantRuntimeAccess";

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
  const hasAssistantRuntimeEndpoint = assistantRuntime.isReady && Boolean(assistantEndpoint);

  const healthQuery = useQuery({
    queryKey: ["main-sequence-ai", "assistant-health", assistantEndpoint, sessionToken],
    enabled: hasAssistantRuntimeEndpoint,
    queryFn: ({ signal }) => {
      if (!assistantEndpoint) {
        throw new Error("Assistant runtime endpoint is not resolved.");
      }

      return fetchAssistantHealth({
        assistantEndpoint,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      });
    },
  });

  const healthSnapshot = healthQuery.data ?? null;
  const healthEndpointUrl = assistantEndpoint
    ? buildMainSequenceAiAssistantUrl(assistantEndpoint, "/health")
    : null;
  const healthCapturedAt = formatTimestamp(healthSnapshot?.capturedAt ?? null);
  const settingsRefreshing = assistantRuntime.isLoading || healthQuery.isFetching;

  return (
    <div className="space-y-4 py-4">
      <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">Agents Settings</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Runtime diagnostics for Agents.
            </div>
            {assistantEndpoint ? (
              <div className="mt-2 break-all font-mono text-xs text-muted-foreground">
                Runtime root: {assistantEndpoint}
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={settingsRefreshing}
            onClick={() => {
              if (!hasAssistantRuntimeEndpoint) {
                void assistantRuntime.refetch();
                return;
              }

              void Promise.all([
                assistantRuntime.refetch(),
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
            {healthEndpointUrl ? (
              <div className="mt-2 break-all font-mono text-xs text-muted-foreground">
                {healthEndpointUrl}
              </div>
            ) : null}
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
              <DetailRow label="URL" value={healthSnapshot.url || healthEndpointUrl || "/health"} />
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

    </div>
  );
}
