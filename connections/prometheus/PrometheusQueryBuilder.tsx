import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  BookOpen,
  Database,
  ListFilter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchConnectionResource } from "@/connections/api";

import {
  buildPrometheusMatcherForMetadata,
  buildPrometheusQuery,
  normalizePrometheusList,
  type PrometheusAggregateOperation,
  type PrometheusLabelFilter,
  type PrometheusLabelOperator,
  type PrometheusMetricFunction,
} from "./promqlBuilder";

interface PrometheusMetricOption {
  name: string;
  type?: string;
  description?: string;
}

interface PrometheusMetadataState<T> {
  error?: string;
  loaded: boolean;
  loading: boolean;
  values: T[];
}

interface PrometheusQueryBuilderProps {
  connectionUid: string;
  defaultRange: { fixedStartMs: number; fixedEndMs: number };
  disabled?: boolean;
  initialQuery?: string;
  lookupDisabled?: boolean;
  onQueryChange: (query: string) => void;
  seriesLimit: number;
}

const labelOperators: PrometheusLabelOperator[] = ["=", "!=", "=~", "!~"];
const metricFunctions: Array<{ label: string; value: PrometheusMetricFunction }> = [
  { label: "Raw metric", value: "raw" },
  { label: "Rate", value: "rate" },
  { label: "Instant rate", value: "irate" },
  { label: "Increase", value: "increase" },
];
const aggregateOperations: Array<{ label: string; value: PrometheusAggregateOperation }> = [
  { label: "No aggregation", value: "none" },
  { label: "Sum", value: "sum" },
  { label: "Average", value: "avg" },
  { label: "Minimum", value: "min" },
  { label: "Maximum", value: "max" },
  { label: "Count", value: "count" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function createFilter(): PrometheusLabelFilter {
  return {
    id: crypto.randomUUID(),
    label: "",
    operator: "=",
    value: "",
  };
}

function collectStringsFromArray(value: unknown, output: unknown[]) {
  if (!Array.isArray(value)) {
    return;
  }

  value.forEach((entry) => {
    if (typeof entry === "string" || typeof entry === "number") {
      output.push(entry);
      return;
    }

    if (isRecord(entry)) {
      output.push(entry.value, entry.label, entry.name, entry.metric);
    }
  });
}

function readPrometheusApiData(response: unknown) {
  if (!isRecord(response)) {
    return undefined;
  }

  const wrappedData = response.data;

  if (isRecord(wrappedData) && "data" in wrappedData) {
    return wrappedData.data;
  }

  return wrappedData;
}

function extractOptionStrings(response: unknown) {
  const output: unknown[] = [];
  const root = isRecord(response) ? response : {};
  const prometheusData = readPrometheusApiData(response);

  collectStringsFromArray(prometheusData, output);
  collectStringsFromArray(root.values, output);
  collectStringsFromArray(root.options, output);
  collectStringsFromArray(root.items, output);
  collectStringsFromArray(root.results, output);

  if (Array.isArray(root.frames)) {
    root.frames.forEach((frame) => {
      if (!isRecord(frame)) {
        return;
      }

      collectStringsFromArray(frame.values, output);
      collectStringsFromArray(frame.options, output);
      collectStringsFromArray(frame.items, output);
      collectStringsFromArray(frame.results, output);

      if (Array.isArray(frame.fields)) {
        frame.fields.forEach((field) => {
          if (isRecord(field)) {
            collectStringsFromArray(field.values, output);
          }
        });
      }

      if (Array.isArray(frame.rows)) {
        frame.rows.forEach((row) => {
          if (!isRecord(row)) {
            return;
          }

          const preferred = [
            row.value,
            row.name,
            row.metric,
            row.label,
            row.__name__,
          ].filter((value) => value !== undefined);
          const candidates =
            preferred.length > 0
              ? preferred
              : Object.keys(row).length <= 3
                ? Object.values(row)
                : [];
          output.push(...candidates);
        });
      }
    });
  }

  return normalizePrometheusList(output);
}

function extractMetricOptions(response: unknown) {
  const metricByName = new Map<string, PrometheusMetricOption>();
  const root = isRecord(response) ? response : {};
  const frames = Array.isArray(root.frames) ? root.frames : [];
  const prometheusData = readPrometheusApiData(response);

  if (isRecord(prometheusData)) {
    Object.entries(prometheusData).forEach(([name, entries]) => {
      const firstEntry = Array.isArray(entries) ? entries.find(isRecord) : undefined;

      metricByName.set(name, {
        name,
        type: isRecord(firstEntry) ? readString(firstEntry.type) : undefined,
        description: isRecord(firstEntry)
          ? readString(firstEntry.help) ?? readString(firstEntry.description)
          : undefined,
      });
    });
  }

  frames.forEach((frame) => {
    if (!isRecord(frame) || !Array.isArray(frame.rows)) {
      return;
    }

    frame.rows.forEach((row) => {
      if (!isRecord(row)) {
        return;
      }

      const name =
        readString(row.name) ??
        readString(row.metric) ??
        readString(row.__name__) ??
        readString(row.value);

      if (!name) {
        return;
      }

      metricByName.set(name, {
        name,
        type: readString(row.type),
        description: readString(row.description) ?? readString(row.help),
      });
    });
  });

  extractOptionStrings(response).forEach((name) => {
    if (!metricByName.has(name)) {
      metricByName.set(name, { name });
    }
  });

  return [...metricByName.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function buildPrometheusResourceParams(input: {
  defaultRange: PrometheusQueryBuilderProps["defaultRange"];
  matchers?: string[];
  seriesLimit: number;
}) {
  const params: Record<string, unknown> = {
    start: Math.floor(input.defaultRange.fixedStartMs / 1000),
    end: Math.floor(input.defaultRange.fixedEndMs / 1000),
  };
  const matchers = normalizePrometheusList(input.matchers ?? []);

  if (matchers.length > 0) {
    params["match[]"] = matchers;
  }

  if (
    Number.isFinite(input.seriesLimit) &&
    input.seriesLimit > 0 &&
    input.seriesLimit < Number.MAX_SAFE_INTEGER
  ) {
    params.limit = input.seriesLimit;
  }

  return params;
}

function usePrometheusMetadata<T>(initialValues: T[] = []) {
  return useState<PrometheusMetadataState<T>>({
    loaded: initialValues.length > 0,
    loading: false,
    values: initialValues,
  });
}

function MetadataError({ value }: { value?: string }) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-[calc(var(--radius)-7px)] border border-danger/35 bg-danger/8 px-3 py-2 text-xs text-danger">
      {value}
    </div>
  );
}

function MetricsBrowser({
  metrics,
  onClose,
  onLoadMetrics,
  onSelectMetric,
  loading,
}: {
  loading: boolean;
  metrics: PrometheusMetricOption[];
  onClose: () => void;
  onLoadMetrics: () => void;
  onSelectMetric: (metric: string) => void;
}) {
  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const metricTypes = useMemo(
    () => normalizePrometheusList(metrics.map((metric) => metric.type)),
    [metrics],
  );
  const filteredMetrics = useMemo(() => {
    const needle = searchValue.trim().toLowerCase();

    return metrics
      .filter((metric) => !typeFilter || metric.type === typeFilter)
      .filter((metric) => {
        if (!needle) {
          return true;
        }

        return [
          metric.name,
          metric.type,
          metric.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .slice(0, 250);
  }, [metrics, searchValue, typeFilter]);

  const modal = (
    <div
      className="fixed inset-0 z-[1000] flex min-h-screen items-center justify-center overflow-y-auto bg-background/70 px-6 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prometheus-metrics-browser-title"
    >
      <div className="max-h-[86vh] w-full max-w-6xl overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card shadow-[var(--shadow-panel)]">
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <h3 id="prometheus-metrics-browser-title" className="text-lg font-semibold text-foreground">
                Metrics browser
              </h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Search loaded metric names. Use Load metrics to query the backend explicitly.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search metrics by name"
              />
            </div>
            <Select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              disabled={metricTypes.length === 0}
            >
              <option value="">All types</option>
              {metricTypes.map((metricType) => (
                <option key={metricType} value={metricType}>
                  {metricType}
                </option>
              ))}
            </Select>
            <Button type="button" variant="outline" disabled={loading} onClick={onLoadMetrics}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Load metrics
            </Button>
          </div>

          <div className="max-h-[56vh] overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="w-44 px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredMetrics.map((metric) => (
                  <tr
                    key={metric.name}
                    className="cursor-pointer border-t border-border/70 transition-colors hover:bg-muted/35"
                    onClick={() => onSelectMetric(metric.name)}
                  >
                    <td className="max-w-[420px] break-all px-4 py-3 font-mono text-xs text-foreground">
                      {metric.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {metric.type ?? "unknown"}
                    </td>
                    <td className="px-4 py-3 text-xs leading-5 text-muted-foreground">
                      {metric.description ?? "No description returned by the backend."}
                    </td>
                  </tr>
                ))}
                {filteredMetrics.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={3}>
                      {metrics.length === 0
                        ? "No metrics loaded yet."
                        : "No metrics match that filter."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modal;
  }

  return createPortal(modal, document.body);
}

export function PrometheusQueryBuilder({
  connectionUid,
  defaultRange,
  disabled = false,
  initialQuery,
  lookupDisabled = false,
  onQueryChange,
  seriesLimit,
}: PrometheusQueryBuilderProps) {
  const metricListId = useId();
  const labelListId = useId();
  const valueListId = useId();
  const [metric, setMetric] = useState("");
  const [metricSearchValue, setMetricSearchValue] = useState("");
  const [filters, setFilters] = useState<PrometheusLabelFilter[]>([createFilter()]);
  const [metricFunction, setMetricFunction] = useState<PrometheusMetricFunction>("raw");
  const [rangeWindow, setRangeWindow] = useState("5m");
  const [aggregate, setAggregate] = useState<PrometheusAggregateOperation>("none");
  const [groupByDraft, setGroupByDraft] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);
  const [metricsState, setMetricsState] = usePrometheusMetadata<PrometheusMetricOption>();
  const [labelsState, setLabelsState] = usePrometheusMetadata<string>();
  const [labelValueStateByFilterId, setLabelValueStateByFilterId] = useState<
    Record<string, PrometheusMetadataState<string>>
  >({});
  const groupBy = useMemo(
    () =>
      groupByDraft
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    [groupByDraft],
  );
  const generatedQuery = useMemo(
    () =>
      buildPrometheusQuery({
        metric,
        filters,
        metricFunction,
        rangeWindow,
        aggregate,
        groupBy,
      }),
    [aggregate, filters, groupBy, metric, metricFunction, rangeWindow],
  );
  const filteredMetricOptions = useMemo(() => {
    const needle = metricSearchValue.trim().toLowerCase();
    const values = metricsState.values;

    if (!needle) {
      return values.slice(0, 80);
    }

    return values
      .filter((entry) => entry.name.toLowerCase().includes(needle))
      .slice(0, 80);
  }, [metricSearchValue, metricsState.values]);
  const labelOptions = labelsState.values;

  useEffect(() => {
    if (generatedQuery) {
      onQueryChange(generatedQuery);
    }
  }, [generatedQuery, onQueryChange]);

  async function runMetadataResource(
    resource: "labels" | "label-values" | "metadata",
    input: { label?: string; matchers?: string[] } = {},
  ) {
    return fetchConnectionResource({
      connectionUid,
      resource,
      params: {
        ...(input.label ? { label: input.label } : {}),
        params: buildPrometheusResourceParams({
          defaultRange,
          matchers: input.matchers,
          seriesLimit,
        }),
      },
    });
  }

  async function loadMetrics() {
    setMetricsState((current) => ({ ...current, error: undefined, loading: true }));

    try {
      const response = await runMetadataResource("label-values", {
        label: "__name__",
        matchers: [],
      });
      setMetricsState({
        loaded: true,
        loading: false,
        values: extractMetricOptions(response),
      });
    } catch (error) {
      setMetricsState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Unable to load metrics.",
        loaded: true,
        loading: false,
      }));
    }
  }

  async function loadLabels() {
    setLabelsState((current) => ({ ...current, error: undefined, loading: true }));

    try {
      const response = await runMetadataResource("labels", {
        matchers: buildPrometheusMatcherForMetadata({ metric, filters: [] }),
      });
      setLabelsState({
        loaded: true,
        loading: false,
        values: extractOptionStrings(response),
      });
    } catch (error) {
      setLabelsState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Unable to load labels.",
        loaded: true,
        loading: false,
      }));
    }
  }

  async function loadLabelValues(filter: PrometheusLabelFilter) {
    const label = filter.label.trim();

    if (!label) {
      setLabelValueStateByFilterId((current) => ({
        ...current,
        [filter.id]: {
          loaded: true,
          loading: false,
          error: "Select a label before loading values.",
          values: current[filter.id]?.values ?? [],
        },
      }));
      return;
    }

    setLabelValueStateByFilterId((current) => ({
      ...current,
      [filter.id]: {
        loaded: current[filter.id]?.loaded ?? false,
        loading: true,
        values: current[filter.id]?.values ?? [],
      },
    }));

    try {
      const response = await runMetadataResource("label-values", {
        label,
        matchers: buildPrometheusMatcherForMetadata({
          metric,
          filters: filters.filter(
            (entry) => entry.id !== filter.id && entry.label.trim() && entry.value.trim(),
          ),
        }),
      });
      setLabelValueStateByFilterId((current) => ({
        ...current,
        [filter.id]: {
          loaded: true,
          loading: false,
          values: extractOptionStrings(response),
        },
      }));
    } catch (error) {
      setLabelValueStateByFilterId((current) => ({
        ...current,
        [filter.id]: {
          loaded: true,
          loading: false,
          error: error instanceof Error ? error.message : "Unable to load values.",
          values: current[filter.id]?.values ?? [],
        },
      }));
    }
  }

  function updateFilter(filterId: string, patch: Partial<PrometheusLabelFilter>) {
    setFilters((current) =>
      current.map((filter) => (filter.id === filterId ? { ...filter, ...patch } : filter)),
    );
  }

  function selectMetric(nextMetric: string) {
    setMetric(nextMetric);
    setMetricSearchValue(nextMetric);
    setLabelsState({ loaded: false, loading: false, values: [] });
    setLabelValueStateByFilterId({});
    setShowBrowser(false);
  }

  return (
    <div className="space-y-4 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/35 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">PromQL builder</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Build a PromQL selector from metric and label metadata. Metadata is queried only when
            you click a load button.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">click-loaded metadata</Badge>
          {initialQuery?.trim() ? <Badge variant="neutral">code query preserved</Badge> : null}
        </div>
      </div>

      {lookupDisabled ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/35 bg-warning/8 px-3 py-2 text-xs text-warning">
          Metrics lookup is disabled on this connection. You can still type a metric and labels
          manually.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`${metricListId}-input`}>
                Metric
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || lookupDisabled || metricsState.loading}
                onClick={() => setShowBrowser(true)}
              >
                <BookOpen className="h-4 w-4" />
                Browser
              </Button>
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={`${metricListId}-input`}
                  className="pl-9 font-mono text-xs"
                  list={metricListId}
                  value={metricSearchValue}
                  onChange={(event) => selectMetric(event.target.value)}
                  disabled={disabled}
                  placeholder="Select or type metric"
                  spellCheck={false}
                />
                <datalist id={metricListId}>
                  {filteredMetricOptions.map((entry) => (
                    <option key={entry.name} value={entry.name}>
                      {entry.description ?? entry.type ?? entry.name}
                    </option>
                  ))}
                </datalist>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || lookupDisabled || metricsState.loading}
                onClick={() => {
                  void loadMetrics();
                }}
              >
                {metricsState.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Load
              </Button>
            </div>
            <MetadataError value={metricsState.error} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Series limit</label>
            <Input value={seriesLimit.toLocaleString()} readOnly disabled />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <ListFilter className="h-4 w-4" />
                Label filters
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Load labels after selecting a metric. Load values per row when needed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || lookupDisabled || labelsState.loading || !metric.trim()}
                onClick={() => {
                  void loadLabels();
                }}
              >
                {labelsState.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Load labels
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => setFilters((current) => [...current, createFilter()])}
              >
                <Plus className="h-4 w-4" />
                Add filter
              </Button>
            </div>
          </div>
          <MetadataError value={labelsState.error} />

          <div className="space-y-2">
            {filters.map((filter) => {
              const valueState = labelValueStateByFilterId[filter.id] ?? {
                loaded: false,
                loading: false,
                values: [],
              };

              return (
                <div
                  key={filter.id}
                  className="grid gap-2 rounded-[calc(var(--radius)-7px)] border border-border/70 bg-card/45 p-2 lg:grid-cols-[minmax(150px,0.8fr)_90px_minmax(160px,1fr)_auto_auto]"
                >
                  <div>
                    <Input
                      className="font-mono text-xs"
                      list={labelListId}
                      value={filter.label}
                      onChange={(event) => updateFilter(filter.id, { label: event.target.value })}
                      disabled={disabled}
                      placeholder="Select label"
                      spellCheck={false}
                    />
                  </div>
                  <Select
                    value={filter.operator}
                    onChange={(event) =>
                      updateFilter(filter.id, {
                        operator: event.target.value as PrometheusLabelOperator,
                      })
                    }
                    disabled={disabled}
                  >
                    {labelOperators.map((operator) => (
                      <option key={operator} value={operator}>
                        {operator}
                      </option>
                    ))}
                  </Select>
                  <div>
                    <Input
                      className="font-mono text-xs"
                      list={`${valueListId}-${filter.id}`}
                      value={filter.value}
                      onChange={(event) => updateFilter(filter.id, { value: event.target.value })}
                      disabled={disabled}
                      placeholder="Select value"
                      spellCheck={false}
                    />
                    <datalist id={`${valueListId}-${filter.id}`}>
                      {valueState.values.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || lookupDisabled || valueState.loading}
                    onClick={() => {
                      void loadLabelValues(filter);
                    }}
                  >
                    {valueState.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Values
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={disabled || filters.length === 1}
                    onClick={() =>
                      setFilters((current) => current.filter((entry) => entry.id !== filter.id))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="lg:col-span-5">
                    <MetadataError value={valueState.error} />
                  </div>
                </div>
              );
            })}
            <datalist id={labelListId}>
              {labelOptions.map((label) => (
                <option key={label} value={label} />
              ))}
            </datalist>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/45 p-3 lg:grid-cols-[180px_160px_minmax(160px,1fr)]">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Function</label>
          <Select
            value={metricFunction}
            onChange={(event) => setMetricFunction(event.target.value as PrometheusMetricFunction)}
            disabled={disabled}
          >
            {metricFunctions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Range</label>
          <Input
            value={rangeWindow}
            onChange={(event) => setRangeWindow(event.target.value)}
            disabled={disabled || metricFunction === "raw"}
            placeholder="5m"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Aggregation</label>
            <Select
              value={aggregate}
              onChange={(event) =>
                setAggregate(event.target.value as PrometheusAggregateOperation)
              }
              disabled={disabled}
            >
              {aggregateOperations.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Group by labels</label>
            <Input
              className="font-mono text-xs"
              list={labelListId}
              value={groupByDraft}
              onChange={(event) => setGroupByDraft(event.target.value)}
              disabled={disabled || aggregate === "none"}
              placeholder="namespace, pod"
              spellCheck={false}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">Generated PromQL</span>
          <Badge variant={generatedQuery ? "primary" : "neutral"}>
            {generatedQuery ? "ready" : "select metric"}
          </Badge>
        </div>
        <pre className="mt-2 min-h-12 overflow-x-auto rounded-[calc(var(--radius)-8px)] bg-background/75 p-3 font-mono text-xs leading-6 text-foreground">
          {generatedQuery || "Select a metric to generate a PromQL query."}
        </pre>
      </section>

      {showBrowser ? (
        <MetricsBrowser
          loading={metricsState.loading}
          metrics={metricsState.values}
          onClose={() => setShowBrowser(false)}
          onLoadMetrics={() => {
            void loadMetrics();
          }}
          onSelectMetric={selectMetric}
        />
      ) : null}
    </div>
  );
}
