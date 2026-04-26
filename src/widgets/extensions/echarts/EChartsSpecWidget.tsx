import { useEffect, useMemo, useRef, useState } from "react";

import { AlertTriangle, Code2, ShieldAlert } from "lucide-react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

import { withAlpha } from "@/lib/color";
import { useTheme } from "@/themes/ThemeProvider";
import {
  getThemeCategoricalColor,
  getThemeDivergingScale,
  getThemeSequentialScale,
} from "@/themes/chart-palettes";
import {
  themeTokenKeys,
  type ResolvedThemeDataVizPalette,
  type ThemeTokenKey,
  type ThemeTokens,
} from "@/themes/types";
import { useResolvedWidgetOrganizationConfiguration } from "@/widgets/WidgetOrganizationConfigurationProvider";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
  WidgetComponentProps,
  WidgetOrganizationConfigurationContract,
} from "@/widgets/types";

export type EChartsCapabilityMode =
  | "safe-json"
  | "safe-html-tooltips"
  | "trusted-snippets"
  | "unsafe-custom-js";

export type EChartsSpecSourceMode = "json" | "javascript";

export type EChartsSpecWidgetProps = Record<string, unknown> & {
  sourceMode?: EChartsSpecSourceMode;
  option?: unknown;
  optionJson?: unknown;
  optionBuilderSource?: string;
};

const ECHARTS_BOUND_PROPS_INPUT_ID = "props-json";
const themeTokenKeySet = new Set<string>(themeTokenKeys);

export type ResolvedEChartsOrganizationConfiguration = Record<string, unknown> & {
  capabilityMode: EChartsCapabilityMode;
  allowedSnippetIds: string[];
  resourceBudget: {
    maxOptionDepth: number;
    maxStringLength: number;
    maxArrayLength: number;
    maxSeriesCount: number;
    maxPointsPerSeries: number;
  };
};

export const DEFAULT_ECHARTS_ORGANIZATION_CONFIGURATION: ResolvedEChartsOrganizationConfiguration = {
  capabilityMode: "safe-json",
  allowedSnippetIds: [],
  resourceBudget: {
    maxOptionDepth: 20,
    maxStringLength: 20_000,
    maxArrayLength: 50_000,
    maxSeriesCount: 24,
    maxPointsPerSeries: 20_000,
  },
};

export const ECHARTS_WIDGET_ORGANIZATION_CONFIGURATION: WidgetOrganizationConfigurationContract = {
  version: 1,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      capabilityMode: {
        type: "string",
        enum: [
          "safe-json",
          "safe-html-tooltips",
          "trusted-snippets",
          "unsafe-custom-js",
        ],
      },
      allowedSnippetIds: {
        type: "array",
        items: {
          type: "string",
        },
      },
      resourceBudget: {
        type: "object",
        additionalProperties: false,
        properties: {
          maxOptionDepth: { type: "integer", minimum: 1 },
          maxStringLength: { type: "integer", minimum: 1 },
          maxArrayLength: { type: "integer", minimum: 1 },
          maxSeriesCount: { type: "integer", minimum: 1 },
          maxPointsPerSeries: { type: "integer", minimum: 1 },
        },
      },
    },
  },
  defaultConfig: DEFAULT_ECHARTS_ORGANIZATION_CONFIGURATION,
};

export const starterOptionJson = `{
  "title": {
    "text": "Execution latency by route",
    "left": 16,
    "top": 12,
    "textStyle": {
      "fontWeight": 600
    },
    "subtext": "JSON-safe starter using theme chart palettes",
    "subtextStyle": {
      "color": "$theme.muted-foreground"
    }
  },
  "tooltip": {
    "trigger": "axis",
    "axisPointer": {
      "type": "shadow"
    }
  },
  "grid": {
    "left": 16,
    "right": 16,
    "top": 72,
    "bottom": 16,
    "containLabel": true
  },
  "xAxis": {
    "type": "category",
    "axisTick": {
      "show": false
    },
    "axisLine": {
      "lineStyle": {
        "color": "$theme.border"
      }
    },
    "axisLabel": {
      "color": "$theme.muted-foreground",
      "interval": 0,
      "rotate": 40
    },
    "data": [
      "Router-01",
      "Router-02",
      "Router-03",
      "Router-04",
      "Router-05",
      "Router-06",
      "Router-07",
      "Router-08",
      "Router-09",
      "Router-10",
      "Router-11",
      "Router-12"
    ]
  },
  "yAxis": {
    "type": "value",
    "splitNumber": 4,
    "axisLabel": {
      "color": "$theme.muted-foreground"
    },
    "splitLine": {
      "lineStyle": {
        "color": {
          "$themeToken": "chart-grid",
          "alpha": 0.12
        }
      }
    }
  },
  "animationDuration": 1400,
  "animationEasing": "elasticOut",
  "series": [
    {
      "name": "Latency (ms)",
      "type": "bar",
      "barWidth": "56%",
      "showBackground": true,
      "backgroundStyle": {
        "color": {
          "$themeToken": "muted",
          "alpha": 0.32
        },
        "borderRadius": [8, 8, 0, 0]
      },
      "label": {
        "show": true,
        "position": "top",
        "color": "$theme.foreground"
      },
      "emphasis": {
        "focus": "series"
      },
      "data": [
        {
          "value": 220,
          "itemStyle": {
            "borderRadius": [8, 8, 0, 0],
            "color": "$palette.categorical.0"
          }
        },
        {
          "value": 182,
          "itemStyle": {
            "borderRadius": [8, 8, 0, 0],
            "color": "$palette.categorical.1"
          }
        },
        {
          "value": 191,
          "itemStyle": {
            "borderRadius": [8, 8, 0, 0],
            "color": "$palette.categorical.2"
          }
        },
        {
          "value": 234,
          "itemStyle": {
            "borderRadius": [8, 8, 0, 0],
            "color": "$palette.categorical.3"
          }
        },
        {
          "value": 290,
          "itemStyle": {
            "borderRadius": [8, 8, 0, 0],
            "color": "$palette.categorical.4"
          }
        },
        {
          "value": 330,
          "itemStyle": {
            "borderRadius": [8, 8, 0, 0],
            "color": "$palette.categorical.5"
          }
        },
        {
          "value": 310,
          "itemStyle": {
            "borderRadius": [8, 8, 0, 0],
            "color": {
              "$paletteScale": "sequential.primary",
              "index": 4,
              "steps": 7
            }
          }
        },
        {
          "value": 123,
          "itemStyle": {
            "borderRadius": [8, 8, 0, 0],
            "color": {
              "$paletteScale": "sequential.primary",
              "index": 2,
              "steps": 7
            }
          }
        },
        {
          "value": 442,
          "itemStyle": {
            "borderRadius": [8, 8, 0, 0],
            "color": {
              "$paletteScale": "diverging.default",
              "index": 4,
              "steps": 5
            }
          }
        },
        {
          "value": 321,
          "itemStyle": {
            "borderRadius": [8, 8, 0, 0],
            "color": {
              "$paletteScale": "sequential.warning",
              "index": 5,
              "steps": 7
            }
          }
        },
        {
          "value": 290,
          "itemStyle": {
            "borderRadius": [8, 8, 0, 0],
            "color": {
              "$paletteScale": "sequential.success",
              "index": 4,
              "steps": 7
            }
          }
        },
        {
          "value": 149,
          "itemStyle": {
            "borderRadius": [8, 8, 0, 0],
            "color": {
              "$paletteScale": "sequential.neutral",
              "index": 4,
              "steps": 7
            }
          }
        }
      ]
    }
  ]
}`;

export const starterOptionBuilderSource = `const dates = ["1M", "3M", "6M", "1Y", "2Y", "5Y", "10Y"];
const levels = [2.1, 2.35, 2.55, 2.8, 2.95, 3.12, 3.28];

return {
  title: {
    text: "Unsafe JS builder example",
    left: "center",
  },
  tooltip: {
    trigger: "axis",
  },
  xAxis: {
    type: "category",
    data: dates,
  },
  yAxis: {
    type: "value",
  },
  series: [
    {
      type: "line",
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(59, 130, 246, 0.38)" },
          { offset: 1, color: "rgba(59, 130, 246, 0.02)" },
        ]),
      },
      data: levels,
    },
  ],
};`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function isThemeTokenKey(value: unknown): value is ThemeTokenKey {
  return typeof value === "string" && themeTokenKeySet.has(value);
}

function mergeRecords(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base };

  Object.entries(override).forEach(([key, value]) => {
    if (isRecord(value) && isRecord(next[key])) {
      next[key] = mergeRecords(next[key] as Record<string, unknown>, value);
      return;
    }

    next[key] = value;
  });

  return next;
}

function readResolvedInputValue(
  resolvedInputs: ResolvedWidgetInputs | undefined,
  inputId: string,
) {
  const resolvedInput = resolvedInputs?.[inputId];

  if (!resolvedInput) {
    return undefined;
  }

  if (Array.isArray(resolvedInput)) {
    const firstValidEntry = resolvedInput.find((entry) => entry.status === "valid");
    return firstValidEntry
      ? firstValidEntry.upstreamBase ?? firstValidEntry.value
      : undefined;
  }

  const singleInput = resolvedInput as ResolvedWidgetInput;

  return singleInput.status === "valid"
    ? singleInput.upstreamBase ?? singleInput.value
    : undefined;
}

function resolveEffectiveWidgetProps(
  props: EChartsSpecWidgetProps,
  resolvedInputs: ResolvedWidgetInputs | undefined,
): EChartsSpecWidgetProps {
  const boundPropsValue = readResolvedInputValue(resolvedInputs, ECHARTS_BOUND_PROPS_INPUT_ID);

  if (!isRecord(boundPropsValue)) {
    return props;
  }

  return mergeRecords(props, boundPropsValue) as EChartsSpecWidgetProps;
}

function readPositiveInteger(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  return fallback;
}

function escapeHtml(value: unknown) {
  return echarts.format.encodeHTML(String(value ?? ""));
}

function readCapabilityMode(value: unknown): EChartsCapabilityMode {
  return value === "safe-html-tooltips" ||
    value === "trusted-snippets" ||
    value === "unsafe-custom-js"
    ? value
    : "safe-json";
}

function normalizeOrganizationConfiguration(
  value: Record<string, unknown> | null,
): ResolvedEChartsOrganizationConfiguration {
  const budgetSource = isRecord(value?.resourceBudget) ? value.resourceBudget : {};

  return {
    capabilityMode: readCapabilityMode(value?.capabilityMode),
    allowedSnippetIds: Array.isArray(value?.allowedSnippetIds)
      ? Array.from(
          new Set(
            value.allowedSnippetIds
              .filter((entry): entry is string => typeof entry === "string")
              .map((entry) => entry.trim())
              .filter(Boolean),
          ),
        )
      : [],
    resourceBudget: {
      maxOptionDepth: readPositiveInteger(
        budgetSource.maxOptionDepth,
        DEFAULT_ECHARTS_ORGANIZATION_CONFIGURATION.resourceBudget.maxOptionDepth,
      ),
      maxStringLength: readPositiveInteger(
        budgetSource.maxStringLength,
        DEFAULT_ECHARTS_ORGANIZATION_CONFIGURATION.resourceBudget.maxStringLength,
      ),
      maxArrayLength: readPositiveInteger(
        budgetSource.maxArrayLength,
        DEFAULT_ECHARTS_ORGANIZATION_CONFIGURATION.resourceBudget.maxArrayLength,
      ),
      maxSeriesCount: readPositiveInteger(
        budgetSource.maxSeriesCount,
        DEFAULT_ECHARTS_ORGANIZATION_CONFIGURATION.resourceBudget.maxSeriesCount,
      ),
      maxPointsPerSeries: readPositiveInteger(
        budgetSource.maxPointsPerSeries,
        DEFAULT_ECHARTS_ORGANIZATION_CONFIGURATION.resourceBudget.maxPointsPerSeries,
      ),
    },
  };
}

function extractNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    const last = value[value.length - 1];
    return typeof last === "number" && Number.isFinite(last) ? last : null;
  }

  return null;
}

function formatNumericValue(value: unknown) {
  const numericValue = extractNumericValue(value);

  if (numericValue === null) {
    return String(value ?? "—");
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function formatCompactNumber(value: unknown) {
  const numericValue =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim())
        : NaN;

  if (!Number.isFinite(numericValue)) {
    return String(value ?? "");
  }

  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numericValue);
}

const tooltipSnippetRegistry: Record<string, (params: unknown) => string> = {
  "tooltip.series-value-v1": (params) => {
    const typedParams = isRecord(params) ? params : {};
    return [
      `<div style="display:flex;flex-direction:column;gap:4px">`,
      `<div style="font-weight:600">${escapeHtml(typedParams.seriesName ?? typedParams.name ?? "Series")}</div>`,
      `<div><span style="opacity:0.72">Category</span> ${escapeHtml(typedParams.name ?? typedParams.axisValueLabel ?? "—")}</div>`,
      `<div><span style="opacity:0.72">Value</span> ${escapeHtml(formatNumericValue(typedParams.value))}</div>`,
      `</div>`,
    ].join("");
  },
  "tooltip.axis-shared-v1": (params) => {
    const entries = Array.isArray(params) ? params.filter(isRecord) : [];
    if (entries.length === 0) {
      return "<div>No values</div>";
    }

    const title = escapeHtml(entries[0]?.axisValueLabel ?? entries[0]?.name ?? "Selection");
    const rows = entries
      .map((entry) => {
        const marker = typeof entry.marker === "string" ? entry.marker : "";
        return `<div style="display:flex;gap:8px;justify-content:space-between">${marker}<span>${escapeHtml(entry.seriesName ?? "Series")}</span><span style="font-weight:600">${escapeHtml(formatNumericValue(entry.value))}</span></div>`;
      })
      .join("");

    return `<div style="display:flex;flex-direction:column;gap:6px"><div style="font-weight:600">${title}</div>${rows}</div>`;
  },
};

const axisLabelSnippetRegistry: Record<string, (value: unknown) => string> = {
  "axis.compact-number-v1": (value) => formatCompactNumber(value),
  "axis.percent-v1": (value) => `${formatNumericValue(value)}%`,
};

const seriesLabelSnippetRegistry: Record<string, (params: unknown) => string> = {
  "series.value-v1": (params) => {
    const typedParams = isRecord(params) ? params : {};
    return formatNumericValue(typedParams.value);
  },
};

function assertSnippetAllowed(
  id: string,
  configuration: ResolvedEChartsOrganizationConfiguration,
) {
  if (
    configuration.capabilityMode !== "trusted-snippets" &&
    configuration.capabilityMode !== "unsafe-custom-js"
  ) {
    throw new Error(`Trusted snippet ${id} is not allowed in ${configuration.capabilityMode} mode.`);
  }

  if (
    configuration.capabilityMode === "trusted-snippets" &&
    !configuration.allowedSnippetIds.includes(id)
  ) {
    throw new Error(`Trusted snippet ${id} is not allowlisted for this organization.`);
  }
}

function resolveTooltipSnippet(
  id: string,
  configuration: ResolvedEChartsOrganizationConfiguration,
) {
  assertSnippetAllowed(id, configuration);
  const formatter = tooltipSnippetRegistry[id];

  if (!formatter) {
    throw new Error(`Unknown tooltip formatter snippet ${id}.`);
  }

  return formatter;
}

function resolveAxisLabelSnippet(
  id: string,
  configuration: ResolvedEChartsOrganizationConfiguration,
) {
  assertSnippetAllowed(id, configuration);
  const formatter = axisLabelSnippetRegistry[id];

  if (!formatter) {
    throw new Error(`Unknown axis-label formatter snippet ${id}.`);
  }

  return formatter;
}

function resolveSeriesLabelSnippet(
  id: string,
  configuration: ResolvedEChartsOrganizationConfiguration,
) {
  assertSnippetAllowed(id, configuration);
  const formatter = seriesLabelSnippetRegistry[id];

  if (!formatter) {
    throw new Error(`Unknown series-label formatter snippet ${id}.`);
  }

  return formatter;
}

function validateOptionNode(
  value: unknown,
  configuration: ResolvedEChartsOrganizationConfiguration,
  path: string[],
  depth: number,
) {
  const pathLabel = path.length > 0 ? path.join(".") : "root";

  if (depth > configuration.resourceBudget.maxOptionDepth) {
    throw new Error(
      `The option exceeds the organization depth budget at ${pathLabel}.`,
    );
  }

  if (typeof value === "string") {
    if (value.length > configuration.resourceBudget.maxStringLength) {
      throw new Error(
        `The option exceeds the organization string budget at ${pathLabel}.`,
      );
    }
    return;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return;
  }

  if (typeof value === "function") {
    throw new Error(`Functions are not allowed in JSON option mode at ${pathLabel}.`);
  }

  if (Array.isArray(value)) {
    if (value.length > configuration.resourceBudget.maxArrayLength) {
      throw new Error(
        `The option exceeds the organization array budget at ${pathLabel}.`,
      );
    }

    if (path.length === 1 && path[0] === "series" && value.length > configuration.resourceBudget.maxSeriesCount) {
      throw new Error(
        `The option exceeds the organization series budget (${configuration.resourceBudget.maxSeriesCount}).`,
      );
    }

    if (
      path.length >= 2 &&
      path[path.length - 1] === "data" &&
      path.includes("series") &&
      value.length > configuration.resourceBudget.maxPointsPerSeries
    ) {
      throw new Error(
        `A series data array exceeds the organization point budget at ${pathLabel}.`,
      );
    }

    value.forEach((entry, index) => {
      validateOptionNode(entry, configuration, [...path, String(index)], depth + 1);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  Object.entries(value).forEach(([key, entry]) => {
    if (key === "optionToContent" || key === "extraCssText" || key === "link" || key === "sublink" || key === "reg") {
      throw new Error(`The option path ${[...path, key].join(".")} is not allowed in JSON mode.`);
    }

    if (key === "formatter") {
      if (typeof entry !== "string") {
        throw new Error(`Only string formatter values are allowed in JSON mode at ${[...path, key].join(".")}.`);
      }

      if (configuration.capabilityMode === "safe-json") {
        throw new Error(`String formatter values require at least safe-html-tooltips mode (${[...path, key].join(".")}).`);
      }
    }

    if (key === "formatterSnippetId") {
      if (
        configuration.capabilityMode !== "trusted-snippets" &&
        configuration.capabilityMode !== "unsafe-custom-js"
      ) {
        throw new Error(
          `Formatter snippets require trusted-snippets or unsafe-custom-js mode (${[...path, key].join(".")}).`,
        );
      }
    }

    validateOptionNode(entry, configuration, [...path, key], depth + 1);
  });
}

function cloneJsonObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeJsonOptionSource(props: EChartsSpecWidgetProps) {
  if (typeof props.optionJson === "string") {
    return props.optionJson.trim() || starterOptionJson;
  }

  if (props.optionJson !== undefined) {
    return JSON.stringify(props.optionJson);
  }

  if (props.option !== undefined) {
    return JSON.stringify(props.option);
  }

  return starterOptionJson;
}

function resolveThemeTokenReference(
  value: unknown,
  resolvedTokens: ThemeTokens,
): string | null {
  if (typeof value === "string") {
    const match = /^\$theme\.([a-z-]+)$/.exec(value.trim());

    if (!match || !isThemeTokenKey(match[1])) {
      return null;
    }

    return resolvedTokens[match[1]];
  }

  if (!isRecord(value)) {
    return null;
  }

  const themeToken = value.$themeToken;

  if (!isThemeTokenKey(themeToken)) {
    return null;
  }

  const baseColor = resolvedTokens[themeToken];
  const alpha = value.alpha;

  if (
    typeof alpha === "number" &&
    Number.isFinite(alpha) &&
    /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(baseColor)
  ) {
    return withAlpha(baseColor, alpha);
  }

  return baseColor;
}

function applyResolvedAlpha(color: string, alpha: unknown) {
  return typeof alpha === "number" &&
    Number.isFinite(alpha) &&
    /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)
    ? withAlpha(color, alpha)
    : color;
}

function resolveThemePaletteReference(
  value: unknown,
  resolvedDataViz: ResolvedThemeDataVizPalette,
): string | null {
  if (typeof value === "string") {
    const categoricalMatch = /^\$palette\.categorical\.(\d+)$/.exec(value.trim());

    if (categoricalMatch) {
      return getThemeCategoricalColor(resolvedDataViz, Number(categoricalMatch[1]));
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (value.$palette === "categorical") {
    const index =
      typeof value.index === "number" && Number.isFinite(value.index)
        ? Math.max(0, Math.floor(value.index))
        : 0;

    return applyResolvedAlpha(
      getThemeCategoricalColor(resolvedDataViz, index),
      value.alpha,
    );
  }

  if (typeof value.$paletteScale !== "string" || !value.$paletteScale.trim()) {
    return null;
  }

  const scaleMatch = /^(sequential|diverging)\.([a-z-]+)$/.exec(value.$paletteScale.trim());

  if (!scaleMatch) {
    return null;
  }

  const steps =
    typeof value.steps === "number" && Number.isFinite(value.steps)
      ? Math.max(scaleMatch[1] === "diverging" ? 3 : 2, Math.floor(value.steps))
      : 7;
  const index =
    typeof value.index === "number" && Number.isFinite(value.index)
      ? Math.max(0, Math.floor(value.index))
      : 0;
  const colors =
    scaleMatch[1] === "sequential"
      ? getThemeSequentialScale(
          resolvedDataViz,
          scaleMatch[2] as "primary" | "success" | "warning" | "neutral",
          steps,
        )
      : getThemeDivergingScale(
          resolvedDataViz,
          scaleMatch[2] as "default" | "positive-negative",
          steps,
        );
  const resolved = colors[Math.min(index, colors.length - 1)] ?? null;

  return resolved ? applyResolvedAlpha(resolved, value.alpha) : null;
}

function resolveThemeAwareOptionNode(
  value: unknown,
  resolvedTokens: ThemeTokens,
  resolvedDataViz: ResolvedThemeDataVizPalette,
): unknown {
  const tokenValue = resolveThemeTokenReference(value, resolvedTokens);

  if (tokenValue !== null) {
    return tokenValue;
  }

  const paletteValue = resolveThemePaletteReference(value, resolvedDataViz);

  if (paletteValue !== null) {
    return paletteValue;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveThemeAwareOptionNode(entry, resolvedTokens, resolvedDataViz));
  }

  if (!isPlainRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      resolveThemeAwareOptionNode(entry, resolvedTokens, resolvedDataViz),
    ]),
  );
}

function applyTooltipSnippetBindings(
  option: Record<string, unknown>,
  configuration: ResolvedEChartsOrganizationConfiguration,
) {
  if (!isRecord(option.tooltip)) {
    return;
  }

  const snippetId = option.tooltip.formatterSnippetId;

  if (typeof snippetId !== "string" || !snippetId.trim()) {
    return;
  }

  option.tooltip.formatter = resolveTooltipSnippet(snippetId.trim(), configuration);
  delete option.tooltip.formatterSnippetId;
}

function applyAxisSnippetBindings(
  axisValue: unknown,
  configuration: ResolvedEChartsOrganizationConfiguration,
) {
  const axes = Array.isArray(axisValue) ? axisValue : [axisValue];

  axes.forEach((axisEntry) => {
    if (!isRecord(axisEntry) || !isRecord(axisEntry.axisLabel)) {
      return;
    }

    const snippetId = axisEntry.axisLabel.formatterSnippetId;

    if (typeof snippetId !== "string" || !snippetId.trim()) {
      return;
    }

    axisEntry.axisLabel.formatter = resolveAxisLabelSnippet(snippetId.trim(), configuration);
    delete axisEntry.axisLabel.formatterSnippetId;
  });
}

function applySeriesLabelSnippetBindings(
  option: Record<string, unknown>,
  configuration: ResolvedEChartsOrganizationConfiguration,
) {
  if (!Array.isArray(option.series)) {
    return;
  }

  option.series.forEach((seriesEntry) => {
    if (!isRecord(seriesEntry) || !isRecord(seriesEntry.label)) {
      return;
    }

    const snippetId = seriesEntry.label.formatterSnippetId;

    if (typeof snippetId !== "string" || !snippetId.trim()) {
      return;
    }

    seriesEntry.label.formatter = resolveSeriesLabelSnippet(snippetId.trim(), configuration);
    delete seriesEntry.label.formatterSnippetId;
  });
}

function buildJsonOption(
  source: string,
  configuration: ResolvedEChartsOrganizationConfiguration,
  resolvedTokens: ThemeTokens,
  resolvedDataViz: ResolvedThemeDataVizPalette,
): EChartsOption {
  const parsed = JSON.parse(source) as Record<string, unknown>;
  validateOptionNode(parsed, configuration, [], 0);
  const option = resolveThemeAwareOptionNode(
    cloneJsonObject(parsed),
    resolvedTokens,
    resolvedDataViz,
  ) as Record<string, unknown>;

  applyTooltipSnippetBindings(option, configuration);
  applyAxisSnippetBindings(option.xAxis, configuration);
  applyAxisSnippetBindings(option.yAxis, configuration);
  applySeriesLabelSnippetBindings(option, configuration);

  return option as EChartsOption;
}

function buildUnsafeJavaScriptOption(source: string) {
  const optionFactory = new Function(
    "echarts",
    `"use strict";\n${source}`,
  ) as (echartsNamespace: typeof echarts) => unknown;
  const option = optionFactory(echarts);

  if (!isRecord(option)) {
    throw new Error("Unsafe option builder must return an ECharts option object.");
  }

  return option as EChartsOption;
}

function buildThemeAwareUnsafeJavaScriptOption(
  source: string,
  resolvedTokens: ThemeTokens,
  resolvedDataViz: ResolvedThemeDataVizPalette,
) {
  const option = buildUnsafeJavaScriptOption(source);

  return resolveThemeAwareOptionNode(
    option,
    resolvedTokens,
    resolvedDataViz,
  ) as EChartsOption;
}

function resolveEffectiveSourceMode(
  props: EChartsSpecWidgetProps,
  configuration: ResolvedEChartsOrganizationConfiguration,
): EChartsSpecSourceMode {
  const preferredMode = props.sourceMode === "javascript" ? "javascript" : "json";

  if (preferredMode === "javascript" && configuration.capabilityMode !== "unsafe-custom-js") {
    return "json";
  }

  return preferredMode;
}

function resolveEChartsSourceModeHelpText(
  sourceMode: EChartsSpecSourceMode,
  errorMessage: string | null,
) {
  const normalizedError = errorMessage?.toLowerCase() ?? "";

  if (sourceMode === "javascript") {
    if (
      normalizedError.includes("unexpected token")
      || normalizedError.includes("invalid or unexpected token")
    ) {
      return "JavaScript builder mode is active. The source is not valid JavaScript. If a node name or label needs multiple lines, use \\n inside the string or a template literal instead of a raw line break inside single quotes.";
    }

    return "JavaScript builder mode is active. The source must be valid JavaScript that returns one ECharts option object. Theme tokens and palette references are resolved after that object is returned.";
  }

  return "JSON mode is active. This path only accepts parsed JSON plus local trusted snippet injection. Functions and JavaScript expressions are not valid in JSON mode.";
}

function useCompiledOption(
  props: EChartsSpecWidgetProps,
  configuration: ResolvedEChartsOrganizationConfiguration,
  resolvedTokens: ThemeTokens,
  resolvedDataViz: ResolvedThemeDataVizPalette,
) {
  return useMemo(() => {
    const sourceMode = resolveEffectiveSourceMode(props, configuration);

    try {
      const option = sourceMode === "javascript"
        ? buildThemeAwareUnsafeJavaScriptOption(
            typeof props.optionBuilderSource === "string"
              ? props.optionBuilderSource.trim()
              : "",
            resolvedTokens,
            resolvedDataViz,
          )
        : buildJsonOption(
            normalizeJsonOptionSource(props),
            configuration,
            resolvedTokens,
            resolvedDataViz,
          );

      return {
        option,
        sourceMode,
        error: null,
      };
    } catch (error) {
      return {
        option: null,
        sourceMode,
        error: error instanceof Error ? error.message : "Unable to compile the ECharts option.",
      };
    }
  }, [configuration, props.optionBuilderSource, props.optionJson, props.sourceMode, resolvedDataViz, resolvedTokens]);
}

type Props = WidgetComponentProps<EChartsSpecWidgetProps>;

export function EChartsSpecWidget({ widget, props, resolvedInputs }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const { resolvedDataViz, resolvedTokens } = useTheme();
  const organizationConfigurationState = useResolvedWidgetOrganizationConfiguration(widget);
  const organizationConfiguration = useMemo(
    () => normalizeOrganizationConfiguration(organizationConfigurationState.resolvedConfig),
    [organizationConfigurationState.resolvedConfig],
  );
  const effectiveProps = useMemo(
    () => resolveEffectiveWidgetProps(props, resolvedInputs),
    [props, resolvedInputs],
  );
  const compiled = useCompiledOption(
    effectiveProps,
    organizationConfiguration,
    resolvedTokens,
    resolvedDataViz,
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !compiled.option) {
      setChartError(null);
      return;
    }

    let chart: echarts.ECharts | null = null;
    let resizeObserver: ResizeObserver | null = null;

    try {
      chart = echarts.init(container, undefined, {
        renderer: "canvas",
      });
      chart.setOption(compiled.option, true);
      resizeObserver = new ResizeObserver(() => {
        chart?.resize();
      });
      resizeObserver.observe(container);
      setChartError(null);
    } catch (error) {
      resizeObserver?.disconnect();
      chart?.dispose();
      setChartError(
        error instanceof Error
          ? error.message
          : "The ECharts option could not be rendered.",
      );
      return;
    }

    return () => {
      resizeObserver?.disconnect();
      chart?.dispose();
    };
  }, [compiled.option]);

  const requestedSourceMode = effectiveProps.sourceMode === "javascript" ? "javascript" : "json";
  const sourceModeBlocked =
    requestedSourceMode === "javascript" && compiled.sourceMode !== requestedSourceMode;
  const sourceModeHelpText = resolveEChartsSourceModeHelpText(
    compiled.sourceMode,
    compiled.error ?? chartError,
  );
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {sourceModeBlocked ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          The widget requested unsafe JavaScript mode, but the effective organization capability is{" "}
          <strong>{organizationConfiguration.capabilityMode}</strong>. The renderer fell back to
          JSON mode.
        </div>
      ) : null}

      {organizationConfigurationState.error ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Unable to load organization widget configuration. Using widget defaults instead.
        </div>
      ) : null}

      {compiled.error ? (
        <div className="flex flex-1 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/10 px-4 py-6 text-center text-sm text-danger">
          <div className="flex max-w-lg flex-col items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <div>{compiled.error}</div>
          </div>
        </div>
      ) : chartError ? (
        <div className="flex flex-1 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/10 px-4 py-6 text-center text-sm text-danger">
          <div className="flex max-w-lg flex-col items-center gap-3">
            <ShieldAlert className="h-5 w-5" />
            <div>{chartError}</div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/40">
          <div ref={containerRef} className="h-full min-h-[220px] w-full" />
        </div>
      )}

      {compiled.error || chartError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            {compiled.sourceMode === "javascript" ? (
              <Code2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              Source mode <strong>{compiled.sourceMode}</strong>. {sourceModeHelpText}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
