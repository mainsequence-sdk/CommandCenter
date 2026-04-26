import { describe, expect, it } from "vitest";

import {
  buildPrometheusMatcherForMetadata,
  buildPrometheusQuery,
  buildPrometheusSelector,
  escapePrometheusString,
} from "./promqlBuilder";

describe("prometheus query builder", () => {
  it("uses bare metric syntax for standard metric names", () => {
    expect(
      buildPrometheusSelector({
        metric: "http_requests_total",
        filters: [{ id: "1", label: "job", operator: "=", value: "api" }],
      }),
    ).toBe('http_requests_total{job="api"}');
  });

  it("uses __name__ matcher syntax for Google Managed Prometheus metric names", () => {
    expect(
      buildPrometheusSelector({
        metric: "actions.googleapis.com/smarthome_action/request_count",
        filters: [{ id: "1", label: "API", operator: "=", value: "camera" }],
      }),
    ).toBe(
      '{__name__="actions.googleapis.com/smarthome_action/request_count",API="camera"}',
    );
  });

  it("escapes label and metric string values", () => {
    expect(escapePrometheusString('one\\two"three\nfour')).toBe(
      'one\\\\two\\"three\\nfour',
    );
  });

  it("builds function and aggregate expressions", () => {
    expect(
      buildPrometheusQuery({
        metric: "container_cpu_usage_seconds_total",
        filters: [{ id: "1", label: "cluster", operator: "=~", value: "prod-.*" }],
        metricFunction: "rate",
        rangeWindow: "5m",
        aggregate: "sum",
        groupBy: ["namespace", "pod"],
      }),
    ).toBe(
      'sum by (namespace, pod) (rate(container_cpu_usage_seconds_total{cluster=~"prod-.*"}[5m]))',
    );
  });

  it("builds metadata matchers from the generated selector", () => {
    expect(
      buildPrometheusMatcherForMetadata({
        metric: "up",
        filters: [{ id: "1", label: "job", operator: "!=", value: "blackbox" }],
      }),
    ).toEqual(['up{job!="blackbox"}']);
  });
});
