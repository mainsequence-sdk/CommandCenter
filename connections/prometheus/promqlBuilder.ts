export type PrometheusLabelOperator = "=" | "!=" | "=~" | "!~";
export type PrometheusMetricFunction = "raw" | "rate" | "irate" | "increase";
export type PrometheusAggregateOperation = "none" | "sum" | "avg" | "min" | "max" | "count";

export interface PrometheusLabelFilter {
  id: string;
  label: string;
  operator: PrometheusLabelOperator;
  value: string;
}

export interface PrometheusQueryBuilderState {
  metric: string;
  filters: PrometheusLabelFilter[];
  metricFunction: PrometheusMetricFunction;
  rangeWindow: string;
  aggregate: PrometheusAggregateOperation;
  groupBy: string[];
}

const bareMetricPattern = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;

export function normalizePrometheusList(values: readonly unknown[]) {
  const seen = new Set<string>();

  return values
    .flatMap((value) => {
      if (typeof value !== "string" && typeof value !== "number") {
        return [];
      }

      const normalized = String(value).trim();

      if (!normalized || seen.has(normalized)) {
        return [];
      }

      seen.add(normalized);
      return [normalized];
    })
    .sort((left, right) => left.localeCompare(right));
}

export function escapePrometheusString(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
}

export function canUseBareMetricName(metric: string) {
  return bareMetricPattern.test(metric.trim());
}

function normalizeGroupByLabels(labels: readonly string[]) {
  return normalizePrometheusList(labels).filter((label) => label !== "__name__");
}

export function buildPrometheusSelector(input: {
  metric: string;
  filters?: readonly PrometheusLabelFilter[];
}) {
  const metric = input.metric.trim();
  const filters = (input.filters ?? []).flatMap((filter) => {
    const label = filter.label.trim();
    const value = filter.value.trim();

    if (!label || !value) {
      return [];
    }

    return [`${label}${filter.operator}"${escapePrometheusString(value)}"`];
  });

  if (!metric) {
    return "";
  }

  if (canUseBareMetricName(metric)) {
    return filters.length > 0 ? `${metric}{${filters.join(",")}}` : metric;
  }

  return `{${[`__name__="${escapePrometheusString(metric)}"`, ...filters].join(",")}}`;
}

export function buildPrometheusQuery(state: PrometheusQueryBuilderState) {
  const selector = buildPrometheusSelector({
    metric: state.metric,
    filters: state.filters,
  });

  if (!selector) {
    return "";
  }

  const rangeWindow = state.rangeWindow.trim() || "5m";
  const expression =
    state.metricFunction === "rate"
      ? `rate(${selector}[${rangeWindow}])`
      : state.metricFunction === "irate"
        ? `irate(${selector}[${rangeWindow}])`
        : state.metricFunction === "increase"
          ? `increase(${selector}[${rangeWindow}])`
          : selector;

  if (state.aggregate === "none") {
    return expression;
  }

  const groupBy = normalizeGroupByLabels(state.groupBy);

  if (groupBy.length === 0) {
    return `${state.aggregate}(${expression})`;
  }

  return `${state.aggregate} by (${groupBy.join(", ")}) (${expression})`;
}

export function buildPrometheusMatcherForMetadata(input: {
  metric: string;
  filters?: readonly PrometheusLabelFilter[];
}) {
  const selector = buildPrometheusSelector(input);
  return selector ? [selector] : [];
}
