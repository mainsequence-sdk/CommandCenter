import { useEffect, useMemo, useState } from "react";

import { StreamLanguage } from "@codemirror/language";

import { Button } from "@/components/ui/button";

import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  QueryCodeField,
  QueryNumberField,
} from "@/connections/components/ConnectionQueryEditorFields";

import type { PrometheusConnectionQuery } from "./index";
import { PrometheusQueryBuilder } from "./PrometheusQueryBuilder";
import {
  buildPrometheusDefaultFixedRange,
  PrometheusConnectionSourceSummary,
  readPrometheusPublicConfig,
  readPrometheusPublicConfigNumber,
  readPrometheusPublicConfigString,
} from "./prometheusAuthoring";

const PROMQL_WORD_TOKENS = new Set([
  "and",
  "avg",
  "bottomk",
  "bool",
  "by",
  "count",
  "count_values",
  "group",
  "group_left",
  "group_right",
  "ignoring",
  "limit_ratio",
  "limitk",
  "max",
  "min",
  "offset",
  "on",
  "or",
  "quantile",
  "stddev",
  "stdvar",
  "sum",
  "topk",
  "unless",
  "without",
]);

const PROMQL_FUNCTIONS = new Set([
  "abs",
  "absent",
  "absent_over_time",
  "acos",
  "acosh",
  "asin",
  "asinh",
  "atan",
  "atanh",
  "avg_over_time",
  "ceil",
  "changes",
  "clamp",
  "clamp_max",
  "clamp_min",
  "cos",
  "cosh",
  "count_over_time",
  "day_of_month",
  "day_of_week",
  "day_of_year",
  "days_in_month",
  "deg",
  "delta",
  "deriv",
  "exp",
  "floor",
  "histogram_avg",
  "histogram_count",
  "histogram_fraction",
  "histogram_quantile",
  "histogram_sum",
  "holt_winters",
  "hour",
  "idelta",
  "increase",
  "irate",
  "label_join",
  "label_replace",
  "last_over_time",
  "ln",
  "log2",
  "log10",
  "max_over_time",
  "min_over_time",
  "minute",
  "month",
  "pi",
  "predict_linear",
  "present_over_time",
  "quantile_over_time",
  "rad",
  "rate",
  "resets",
  "round",
  "scalar",
  "sgn",
  "sin",
  "sinh",
  "sort",
  "sort_by_label",
  "sort_by_label_desc",
  "sort_desc",
  "sqrt",
  "sum_over_time",
  "tan",
  "tanh",
  "time",
  "timestamp",
  "vector",
  "year",
]);

const PROMQL_EDITOR_EXTENSIONS = [
  StreamLanguage.define({
    name: "promql",
    languageData: {
      commentTokens: { line: "#" },
    },
    token(stream) {
      if (stream.eatSpace()) {
        return null;
      }

      if (stream.peek() === "#") {
        stream.skipToEnd();
        return "comment";
      }

      const quote = stream.peek();

      if (quote === "\"" || quote === "'") {
        let escaped = false;

        stream.next();

        while (!stream.eol()) {
          const next = stream.next();

          if (next === quote && !escaped) {
            break;
          }

          escaped = next === "\\" && !escaped;
          if (next !== "\\") {
            escaped = false;
          }
        }

        return "string";
      }

      if (stream.match(/^\$[A-Za-z_][\w_]*/)) {
        return "variableName";
      }

      if (stream.match(/^(?:\d+(?:\.\d+)?|\.\d+)(?:ms|s|m|h|d|w|y)\b/)) {
        return "number";
      }

      if (stream.match(/^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?\b/i)) {
        return "number";
      }

      if (stream.match(/^(?:=~|!~|!=|==|>=|<=|[+\-*/%^=<>])/)) {
        return "operator";
      }

      if (stream.match(/^[()[\]{},:]/)) {
        return "punctuation";
      }

      if (stream.match(/^[A-Za-z_:][A-Za-z0-9_:]*/)) {
        const normalizedWord = stream.current().toLowerCase();

        if (PROMQL_WORD_TOKENS.has(normalizedWord)) {
          return "keyword";
        }

        if (PROMQL_FUNCTIONS.has(normalizedWord) && stream.match(/^\s*\(/, false)) {
          return "variableName";
        }

        return "propertyName";
      }

      stream.next();
      return null;
    },
  }),
];

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
  connectionType,
  disabled = false,
  onChange,
  queryModel,
  value,
}: ConnectionQueryEditorProps<PrometheusConnectionQuery>) {
  const publicConfig = readPrometheusPublicConfig(connectionInstance?.publicConfig);
  const queryKind = readQueryKind(queryModel?.id, value);
  const maxDataPoints = readPrometheusPublicConfigNumber(publicConfig.maxDataPoints) ?? 1100;
  const seriesLimit =
    readPrometheusPublicConfigNumber(publicConfig.seriesLimit) ?? Number.MAX_SAFE_INTEGER;
  const defaultLookback =
    readPrometheusPublicConfigString(publicConfig.defaultExploreLookback) ?? "1h";
  const defaultEditorMode = publicConfig.defaultEditor === "code" ? "code" : "builder";
  const lookupDisabled = publicConfig.disableMetricsLookup === true;
  const defaultRange = useMemo(
    () => buildPrometheusDefaultFixedRange(defaultLookback),
    [defaultLookback, connectionInstance?.id],
  );
  const supportsBuilder = queryKind === "promql-range";
  const [editorMode, setEditorMode] = useState<"builder" | "code">(
    supportsBuilder ? defaultEditorMode : "code",
  );

  useEffect(() => {
    setEditorMode(supportsBuilder ? defaultEditorMode : "code");
  }, [connectionInstance?.id, defaultEditorMode, queryKind, supportsBuilder]);

  return (
    <div className="space-y-5">
      {connectionInstance && connectionType ? (
        <PrometheusConnectionSourceSummary
          connectionInstance={connectionInstance}
          connectionType={connectionType}
        />
      ) : (
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Configured source</div>
          <div className="mt-1 break-words">
            {publicConfig.baseUrl || connectionInstance?.name || "Prometheus connection"}
          </div>
        </div>
      )}

      {supportsBuilder ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
          <div>
            <div className="text-sm font-semibold text-foreground">Query authoring</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Builder metadata loads only when you request metrics, labels, or values.
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/60 p-0.5">
            {(["builder", "code"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={editorMode === mode ? "default" : "ghost"}
                className="h-8 px-3"
                onClick={() => setEditorMode(mode)}
                disabled={disabled}
              >
                {mode === "builder" ? "Builder" : "Code"}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {supportsBuilder && editorMode === "builder" ? (
        <PrometheusQueryBuilder
          connectionId={connectionInstance?.id ?? ""}
          defaultRange={defaultRange}
          initialQuery={readQueryText(value)}
          lookupDisabled={lookupDisabled}
          onQueryChange={(query) => {
            const normalizedQuery = query.trim();

            if (!normalizedQuery) {
              return;
            }

            onChange({
              kind: "promql-range",
              query: normalizedQuery,
              stepMs: "stepMs" in value ? value.stepMs : undefined,
              maxDataPoints:
                "maxDataPoints" in value && typeof value.maxDataPoints === "number"
                  ? value.maxDataPoints
                  : maxDataPoints,
            });
          }}
          seriesLimit={seriesLimit}
        />
      ) : null}

      {queryKind === "promql-instant" ? (
        <ConnectionQueryEditorSection
          title="PromQL instant query"
          description="Evaluates one PromQL expression and returns the normalized backend result."
        >
          <QueryCodeField
            ariaLabel="PromQL instant query editor"
            extensions={PROMQL_EDITOR_EXTENSIONS}
            languageLabel="PromQL"
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

      {queryKind === "promql-range" && editorMode === "code" ? (
        <ConnectionQueryEditorSection
          title="PromQL range query"
          description="Uses the widget runtime date window and returns a normalized time-series frame."
        >
          <QueryCodeField
            ariaLabel="PromQL range query editor"
            extensions={PROMQL_EDITOR_EXTENSIONS}
            languageLabel="PromQL"
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
