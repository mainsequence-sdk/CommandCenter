import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  QueryNumberField,
  QuerySqlField,
} from "@/connections/components/ConnectionQueryEditorFields";

import type { PrometheusConnectionQuery, PrometheusPublicConfig } from "./index";

function readPublicConfig(value: unknown): PrometheusPublicConfig {
  return value && typeof value === "object" ? (value as PrometheusPublicConfig) : {};
}

function readQueryKind(
  queryModelId: string | undefined,
  value: PrometheusConnectionQuery,
): PrometheusConnectionQuery["kind"] {
  if (queryModelId === "promql-instant" || queryModelId === "promql-range") {
    return queryModelId;
  }

  return value.kind === "promql-instant" ? "promql-instant" : "promql-range";
}

function readQueryText(value: PrometheusConnectionQuery) {
  return typeof (value as { query?: unknown }).query === "string"
    ? (value as { query: string }).query
    : "";
}

export function PrometheusConnectionQueryEditor({
  connectionInstance,
  disabled = false,
  onChange,
  queryModel,
  value,
}: ConnectionQueryEditorProps<PrometheusConnectionQuery>) {
  const publicConfig = readPublicConfig(connectionInstance?.publicConfig);
  const queryKind = readQueryKind(queryModel?.id, value);
  const maxDataPoints = publicConfig.maxDataPoints ?? 1100;

  return (
    <div className="space-y-5">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Configured source</div>
        <div className="mt-1 break-words">
          {publicConfig.baseUrl || connectionInstance?.name || "Prometheus connection"}
        </div>
      </div>

      {queryKind === "promql-instant" ? (
        <ConnectionQueryEditorSection
          title="PromQL instant query"
          description="Evaluates one PromQL expression and returns the normalized backend result."
        >
          <QuerySqlField
            label="PromQL"
            value={readQueryText(value)}
            onChange={(query) => {
              onChange({
                kind: "promql-instant",
                query: query ?? "",
                timeMs: "timeMs" in value ? value.timeMs : undefined,
              });
            }}
            disabled={disabled}
            placeholder="up"
            help="PromQL expression sent to the backend adapter."
          />
          <QueryNumberField
            label="Evaluation time ms"
            value={"timeMs" in value ? value.timeMs : undefined}
            min={0}
            onChange={(timeMs) => {
              onChange({
                kind: "promql-instant",
                query: readQueryText(value),
                timeMs,
              });
            }}
            disabled={disabled}
            placeholder="Current backend time"
            help="Optional Unix epoch millisecond evaluation timestamp."
          />
        </ConnectionQueryEditorSection>
      ) : null}

      {queryKind === "promql-range" ? (
        <ConnectionQueryEditorSection
          title="PromQL range query"
          description="Uses the widget runtime date window and returns a normalized time-series frame."
        >
          <QuerySqlField
            label="PromQL"
            value={readQueryText(value)}
            onChange={(query) => {
              onChange({
                kind: "promql-range",
                query: query ?? "",
                stepMs: "stepMs" in value ? value.stepMs : undefined,
                maxDataPoints: "maxDataPoints" in value ? value.maxDataPoints : undefined,
              });
            }}
            disabled={disabled}
            placeholder={'sum by (job) (rate(http_requests_total[$__rate_interval]))'}
            help="PromQL range expression sent to the backend adapter."
          />
          <QueryNumberField
            label="Step ms"
            value={"stepMs" in value ? value.stepMs : undefined}
            min={1}
            onChange={(stepMs) => {
              onChange({
                kind: "promql-range",
                query: readQueryText(value),
                stepMs,
                maxDataPoints: "maxDataPoints" in value ? value.maxDataPoints : undefined,
              });
            }}
            disabled={disabled}
            placeholder="Auto"
            help="Optional Prometheus range step in milliseconds."
          />
          <QueryNumberField
            label="Max data points"
            value={"maxDataPoints" in value ? value.maxDataPoints : undefined}
            min={1}
            onChange={(nextMaxDataPoints) => {
              onChange({
                kind: "promql-range",
                query: readQueryText(value),
                stepMs: "stepMs" in value ? value.stepMs : undefined,
                maxDataPoints: nextMaxDataPoints,
              });
            }}
            disabled={disabled}
            placeholder={String(maxDataPoints)}
            help="Optional point budget used by the backend adapter when choosing a step."
          />
        </ConnectionQueryEditorSection>
      ) : null}
    </div>
  );
}
