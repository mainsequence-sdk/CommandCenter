import { useEffect, useMemo, useRef, useState } from "react";

import { AlertTriangle, LineChart, ShieldAlert } from "lucide-react";
import {
  AreaSeries,
  BarSeries,
  BaselineSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type ChartOptions,
  type DeepPartial,
} from "lightweight-charts";

import { useTheme } from "@/themes/ThemeProvider";
import {
  getThemeCategoricalColor,
  getThemeDivergingScale,
  getThemeSequentialScale,
} from "@/themes/chart-palettes";
import type {
  WidgetComponentProps,
  WidgetOrganizationConfigurationContract,
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
} from "@/widgets/types";
import {
  themeTokenKeys,
  type ResolvedThemeDataVizPalette,
  type ThemeTokenKey,
  type ThemeTokens,
} from "@/themes/types";
import { useResolvedWidgetOrganizationConfiguration } from "@/widgets/WidgetOrganizationConfigurationProvider";

const LIGHTWEIGHT_CHARTS_BOUND_PROPS_INPUT_ID = "props-json";
const themeTokenKeySet = new Set<string>(themeTokenKeys);

export type LightweightChartsSpecWidgetProps = Record<string, unknown> & {
  spec?: unknown;
  specJson?: unknown;
};

type LightweightChartsSeriesType =
  | "line"
  | "area"
  | "baseline"
  | "histogram"
  | "candlestick"
  | "bar";

type LightweightChartsSafeSeriesSpec = {
  id: string;
  type: LightweightChartsSeriesType;
  title?: string;
  paneIndex?: number;
  visible?: boolean;
  options?: Record<string, unknown>;
  data: unknown[];
  markers?: unknown[];
  markersOptions?: Record<string, unknown>;
  priceLines?: Record<string, unknown>[];
};

type LightweightChartsSafeSpec = {
  chartOptions?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  localization?: Record<string, unknown>;
  timeScale?: Record<string, unknown>;
  leftPriceScale?: Record<string, unknown>;
  rightPriceScale?: Record<string, unknown>;
  crosshair?: Record<string, unknown>;
  grid?: Record<string, unknown>;
  fitContent?: boolean;
  series: LightweightChartsSafeSeriesSpec[];
};

type ResolvedLightweightChartsOrganizationConfiguration = Record<string, unknown> & {
  capabilityMode: "safe-json";
  resourceBudget: {
    maxOptionDepth: number;
    maxStringLength: number;
    maxArrayLength: number;
    maxSeriesCount: number;
    maxPointsPerSeries: number;
    maxMarkersPerSeries: number;
    maxPriceLinesPerSeries: number;
  };
};

export const DEFAULT_LIGHTWEIGHT_CHARTS_ORGANIZATION_CONFIGURATION: ResolvedLightweightChartsOrganizationConfiguration = {
  capabilityMode: "safe-json",
  resourceBudget: {
    maxOptionDepth: 20,
    maxStringLength: 20_000,
    maxArrayLength: 50_000,
    maxSeriesCount: 12,
    maxPointsPerSeries: 50_000,
    maxMarkersPerSeries: 2_000,
    maxPriceLinesPerSeries: 250,
  },
};

export const LIGHTWEIGHT_CHARTS_WIDGET_ORGANIZATION_CONFIGURATION: WidgetOrganizationConfigurationContract = {
  version: 1,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      capabilityMode: {
        type: "string",
        enum: ["safe-json"],
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
          maxMarkersPerSeries: { type: "integer", minimum: 1 },
          maxPriceLinesPerSeries: { type: "integer", minimum: 1 },
        },
      },
    },
  },
  defaultConfig: DEFAULT_LIGHTWEIGHT_CHARTS_ORGANIZATION_CONFIGURATION,
};

export const starterSpecJson = `{
  "chartOptions": {
    "layout": {
      "background": {
        "type": "solid",
        "color": {
          "$themeToken": "background",
          "alpha": 1
        }
      },
      "textColor": "$theme.muted-foreground"
    },
    "grid": {
      "vertLines": {
        "color": {
          "$themeToken": "chart-grid",
          "alpha": 0.08
        }
      },
      "horzLines": {
        "color": {
          "$themeToken": "chart-grid",
          "alpha": 0.08
        }
      }
    },
    "crosshair": {
      "vertLine": {
        "color": {
          "$paletteScale": "sequential.primary",
          "index": 4,
          "steps": 7,
          "alpha": 0.35
        }
      },
      "horzLine": {
        "color": {
          "$paletteScale": "sequential.primary",
          "index": 4,
          "steps": 7,
          "alpha": 0.35
        }
      }
    },
    "rightPriceScale": {
      "borderColor": "$theme.border"
    },
    "timeScale": {
      "borderColor": "$theme.border",
      "timeVisible": true
    }
  },
  "fitContent": true,
  "series": [
    {
      "id": "ohlc",
      "type": "candlestick",
      "options": {
        "upColor": "$theme.positive",
        "downColor": "$theme.negative",
        "wickUpColor": "$theme.positive",
        "wickDownColor": "$theme.negative",
        "borderVisible": false
      },
      "data": [
        { "time": "2026-04-01", "open": 102.4, "high": 106.3, "low": 100.2, "close": 104.8 },
        { "time": "2026-04-02", "open": 104.8, "high": 107.2, "low": 103.9, "close": 106.1 },
        { "time": "2026-04-03", "open": 106.1, "high": 108.5, "low": 101.7, "close": 102.9 },
        { "time": "2026-04-04", "open": 102.9, "high": 109.8, "low": 102.3, "close": 108.7 },
        { "time": "2026-04-05", "open": 108.7, "high": 111.4, "low": 107.4, "close": 110.5 },
        { "time": "2026-04-06", "open": 110.5, "high": 113.1, "low": 109.6, "close": 112.6 }
      ],
      "priceLines": [
        {
          "price": 108,
          "color": "$theme.accent",
          "lineWidth": 2,
          "title": "Trigger"
        }
      ]
    },
    {
      "id": "volume",
      "type": "histogram",
      "paneIndex": 1,
      "options": {
        "priceFormat": {
          "type": "volume"
        },
        "priceScaleId": ""
      },
      "data": [
        { "time": "2026-04-01", "value": 820, "color": "$palette.categorical.0" },
        { "time": "2026-04-02", "value": 910, "color": "$palette.categorical.1" },
        { "time": "2026-04-03", "value": 1240, "color": "$palette.categorical.2" },
        { "time": "2026-04-04", "value": 1380, "color": "$palette.categorical.3" },
        { "time": "2026-04-05", "value": 1160, "color": "$palette.categorical.4" },
        { "time": "2026-04-06", "value": 980, "color": "$palette.categorical.5" }
      ],
      "markers": [
        {
          "time": "2026-04-04",
          "position": "aboveBar",
          "shape": "circle",
          "color": "$theme.warning",
          "text": "Rebalance"
        }
      ]
    }
  ]
}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJsonObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function looksLikeLightweightChartsSpec(value: Record<string, unknown>) {
  return Array.isArray(value.series);
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
    return firstValidEntry?.value;
  }

  return (resolvedInput as ResolvedWidgetInput).status === "valid" ? resolvedInput.value : undefined;
}

function resolveEffectiveWidgetProps(
  props: LightweightChartsSpecWidgetProps,
  resolvedInputs: ResolvedWidgetInputs | undefined,
): LightweightChartsSpecWidgetProps {
  const boundPropsValue = readResolvedInputValue(resolvedInputs, LIGHTWEIGHT_CHARTS_BOUND_PROPS_INPUT_ID);

  if (!isRecord(boundPropsValue)) {
    return props;
  }

  if (looksLikeLightweightChartsSpec(boundPropsValue)) {
    return {
      spec: boundPropsValue,
    };
  }

  return cloneJsonObject(boundPropsValue) as LightweightChartsSpecWidgetProps;
}

function normalizeJsonSpecSource(props: LightweightChartsSpecWidgetProps) {
  if (typeof props.specJson === "string" && props.specJson.trim()) {
    return props.specJson.trim();
  }

  if (props.specJson !== undefined) {
    return JSON.stringify(props.specJson);
  }

  if (props.spec !== undefined) {
    return JSON.stringify(props.spec);
  }

  return starterSpecJson;
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

function normalizeOrganizationConfiguration(
  value: Record<string, unknown> | null,
): ResolvedLightweightChartsOrganizationConfiguration {
  const budgetSource = isRecord(value?.resourceBudget) ? value.resourceBudget : {};

  return {
    capabilityMode: "safe-json",
    resourceBudget: {
      maxOptionDepth: readPositiveInteger(
        budgetSource.maxOptionDepth,
        DEFAULT_LIGHTWEIGHT_CHARTS_ORGANIZATION_CONFIGURATION.resourceBudget.maxOptionDepth,
      ),
      maxStringLength: readPositiveInteger(
        budgetSource.maxStringLength,
        DEFAULT_LIGHTWEIGHT_CHARTS_ORGANIZATION_CONFIGURATION.resourceBudget.maxStringLength,
      ),
      maxArrayLength: readPositiveInteger(
        budgetSource.maxArrayLength,
        DEFAULT_LIGHTWEIGHT_CHARTS_ORGANIZATION_CONFIGURATION.resourceBudget.maxArrayLength,
      ),
      maxSeriesCount: readPositiveInteger(
        budgetSource.maxSeriesCount,
        DEFAULT_LIGHTWEIGHT_CHARTS_ORGANIZATION_CONFIGURATION.resourceBudget.maxSeriesCount,
      ),
      maxPointsPerSeries: readPositiveInteger(
        budgetSource.maxPointsPerSeries,
        DEFAULT_LIGHTWEIGHT_CHARTS_ORGANIZATION_CONFIGURATION.resourceBudget.maxPointsPerSeries,
      ),
      maxMarkersPerSeries: readPositiveInteger(
        budgetSource.maxMarkersPerSeries,
        DEFAULT_LIGHTWEIGHT_CHARTS_ORGANIZATION_CONFIGURATION.resourceBudget.maxMarkersPerSeries,
      ),
      maxPriceLinesPerSeries: readPositiveInteger(
        budgetSource.maxPriceLinesPerSeries,
        DEFAULT_LIGHTWEIGHT_CHARTS_ORGANIZATION_CONFIGURATION.resourceBudget.maxPriceLinesPerSeries,
      ),
    },
  };
}

function isThemeTokenKey(value: unknown): value is ThemeTokenKey {
  return typeof value === "string" && themeTokenKeySet.has(value);
}

function applyResolvedAlpha(color: string, alpha: unknown) {
  if (
    typeof alpha === "number" &&
    Number.isFinite(alpha) &&
    /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)
  ) {
    const normalized = color.replace("#", "");
    const hex =
      normalized.length === 3
        ? normalized
            .split("")
            .map((part) => `${part}${part}`)
            .join("")
        : normalized.slice(0, 6);

    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(alpha, 1))})`;
  }

  return color;
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

  return applyResolvedAlpha(resolvedTokens[themeToken], value.alpha);
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

  return applyResolvedAlpha(colors[Math.min(index, colors.length - 1)] ?? "", value.alpha) || null;
}

function resolveThemeAwareNode(
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
    return value.map((entry) => resolveThemeAwareNode(entry, resolvedTokens, resolvedDataViz));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      resolveThemeAwareNode(entry, resolvedTokens, resolvedDataViz),
    ]),
  );
}

function readSeriesType(value: unknown): LightweightChartsSeriesType | null {
  return value === "line" ||
    value === "area" ||
    value === "baseline" ||
    value === "histogram" ||
    value === "candlestick" ||
    value === "bar"
    ? value
    : null;
}

function validateNodeBudget(
  value: unknown,
  configuration: ResolvedLightweightChartsOrganizationConfiguration,
  path: string[],
  depth: number,
) {
  if (depth > configuration.resourceBudget.maxOptionDepth) {
    throw new Error(`Spec exceeds the maximum supported depth at ${path.join(".") || "root"}.`);
  }

  if (typeof value === "function") {
    throw new Error(`Functions are not allowed in safe spec mode (${path.join(".") || "root"}).`);
  }

  if (typeof value === "string" && value.length > configuration.resourceBudget.maxStringLength) {
    throw new Error(`String value at ${path.join(".") || "root"} exceeds the configured limit.`);
  }

  if (Array.isArray(value)) {
    if (value.length > configuration.resourceBudget.maxArrayLength) {
      throw new Error(`Array at ${path.join(".") || "root"} exceeds the configured size limit.`);
    }

    value.forEach((entry, index) => {
      validateNodeBudget(entry, configuration, [...path, String(index)], depth + 1);
    });

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  Object.entries(value).forEach(([key, entry]) => {
    validateNodeBudget(entry, configuration, [...path, key], depth + 1);
  });
}

function isFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidTimeValue(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return true;
  }

  return isFiniteNumber(value) || (
    isRecord(value) &&
    Number.isInteger(value.year) &&
    Number.isInteger(value.month) &&
    Number.isInteger(value.day)
  );
}

function validateSeriesDataItem(
  item: unknown,
  seriesType: LightweightChartsSeriesType,
  path: string[],
) {
  if (!isRecord(item) || !isValidTimeValue(item.time)) {
    throw new Error(`Series data item at ${path.join(".")} must include a valid time.`);
  }

  if (seriesType === "candlestick" || seriesType === "bar") {
    const isWhitespace =
      item.open === undefined &&
      item.high === undefined &&
      item.low === undefined &&
      item.close === undefined;

    if (isWhitespace) {
      return;
    }

    if (
      !isFiniteNumber(item.open) ||
      !isFiniteNumber(item.high) ||
      !isFiniteNumber(item.low) ||
      !isFiniteNumber(item.close)
    ) {
      throw new Error(`OHLC series data at ${path.join(".")} must include numeric open/high/low/close values.`);
    }

    return;
  }

  if (item.value === undefined) {
    return;
  }

  if (!isFiniteNumber(item.value)) {
    throw new Error(`Series data at ${path.join(".")} must include a numeric value.`);
  }
}

function normalizeSeriesSpec(
  value: unknown,
  configuration: ResolvedLightweightChartsOrganizationConfiguration,
  path: string[],
): LightweightChartsSafeSeriesSpec {
  if (!isRecord(value)) {
    throw new Error(`Series entry at ${path.join(".")} must be an object.`);
  }

  const type = readSeriesType(value.type);
  const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : null;
  const data = Array.isArray(value.data) ? value.data : null;
  const markers = Array.isArray(value.markers) ? value.markers : undefined;
  const priceLines = Array.isArray(value.priceLines) ? value.priceLines : undefined;

  if (!id) {
    throw new Error(`Series entry at ${path.join(".")} must define a non-empty id.`);
  }

  if (!type) {
    throw new Error(`Series ${id} uses an unsupported Lightweight Charts series type.`);
  }

  if (!data) {
    throw new Error(`Series ${id} must define a data array.`);
  }

  if (data.length > configuration.resourceBudget.maxPointsPerSeries) {
    throw new Error(`Series ${id} exceeds the configured point limit.`);
  }

  if (markers && markers.length > configuration.resourceBudget.maxMarkersPerSeries) {
    throw new Error(`Series ${id} exceeds the configured marker limit.`);
  }

  if (priceLines && priceLines.length > configuration.resourceBudget.maxPriceLinesPerSeries) {
    throw new Error(`Series ${id} exceeds the configured price-line limit.`);
  }

  data.forEach((item, index) => {
    validateSeriesDataItem(item, type, [...path, "data", String(index)]);
  });

  return {
    id,
    type,
    title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : undefined,
    paneIndex:
      typeof value.paneIndex === "number" && Number.isInteger(value.paneIndex) && value.paneIndex >= 0
        ? value.paneIndex
        : undefined,
    visible: value.visible === undefined ? undefined : Boolean(value.visible),
    options: isRecord(value.options) ? cloneJsonObject(value.options) : undefined,
    data: cloneJsonObject(data),
    markers: markers ? cloneJsonObject(markers) : undefined,
    markersOptions: isRecord(value.markersOptions) ? cloneJsonObject(value.markersOptions) : undefined,
    priceLines: priceLines ? cloneJsonObject(priceLines) : undefined,
  };
}

function normalizeSpec(
  value: unknown,
  configuration: ResolvedLightweightChartsOrganizationConfiguration,
): LightweightChartsSafeSpec {
  if (!isRecord(value)) {
    throw new Error("Lightweight Charts spec must be a JSON object.");
  }

  validateNodeBudget(value, configuration, [], 0);

  const seriesSource = Array.isArray(value.series) ? value.series : null;

  if (!seriesSource) {
    throw new Error("Lightweight Charts spec must define a series array.");
  }

  if (seriesSource.length > configuration.resourceBudget.maxSeriesCount) {
    throw new Error("Spec exceeds the configured series limit.");
  }

  return {
    chartOptions: isRecord(value.chartOptions) ? cloneJsonObject(value.chartOptions) : undefined,
    layout: isRecord(value.layout) ? cloneJsonObject(value.layout) : undefined,
    localization: isRecord(value.localization) ? cloneJsonObject(value.localization) : undefined,
    timeScale: isRecord(value.timeScale) ? cloneJsonObject(value.timeScale) : undefined,
    leftPriceScale: isRecord(value.leftPriceScale) ? cloneJsonObject(value.leftPriceScale) : undefined,
    rightPriceScale: isRecord(value.rightPriceScale) ? cloneJsonObject(value.rightPriceScale) : undefined,
    crosshair: isRecord(value.crosshair) ? cloneJsonObject(value.crosshair) : undefined,
    grid: isRecord(value.grid) ? cloneJsonObject(value.grid) : undefined,
    fitContent: value.fitContent === undefined ? true : Boolean(value.fitContent),
    series: seriesSource.map((entry, index) =>
      normalizeSeriesSpec(entry, configuration, ["series", String(index)]),
    ),
  };
}

function buildChartOptions(spec: LightweightChartsSafeSpec) {
  const base = isRecord(spec.chartOptions) ? cloneJsonObject(spec.chartOptions) : {};

  const sections = [
    ["layout", spec.layout],
    ["localization", spec.localization],
    ["timeScale", spec.timeScale],
    ["leftPriceScale", spec.leftPriceScale],
    ["rightPriceScale", spec.rightPriceScale],
    ["crosshair", spec.crosshair],
    ["grid", spec.grid],
  ] as const;

  return sections.reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (value) {
      accumulator[key] = value;
    }

    return accumulator;
  }, base);
}

const seriesDefinitionByType = {
  line: LineSeries,
  area: AreaSeries,
  baseline: BaselineSeries,
  histogram: HistogramSeries,
  candlestick: CandlestickSeries,
  bar: BarSeries,
} as const;

function buildSpec(
  props: LightweightChartsSpecWidgetProps,
  configuration: ResolvedLightweightChartsOrganizationConfiguration,
  resolvedTokens: ThemeTokens,
  resolvedDataViz: ResolvedThemeDataVizPalette,
) {
  const parsed = JSON.parse(normalizeJsonSpecSource(props)) as unknown;
  const normalized = normalizeSpec(parsed, configuration);
  return resolveThemeAwareNode(normalized, resolvedTokens, resolvedDataViz) as LightweightChartsSafeSpec;
}

function useCompiledSpec(
  props: LightweightChartsSpecWidgetProps,
  configuration: ResolvedLightweightChartsOrganizationConfiguration,
  resolvedTokens: ThemeTokens,
  resolvedDataViz: ResolvedThemeDataVizPalette,
) {
  return useMemo(() => {
    try {
      return {
        spec: buildSpec(props, configuration, resolvedTokens, resolvedDataViz),
        error: null,
      };
    } catch (error) {
      return {
        spec: null,
        error: error instanceof Error ? error.message : "Unable to compile the Lightweight Charts spec.",
      };
    }
  }, [configuration, props.spec, props.specJson, resolvedDataViz, resolvedTokens]);
}

type Props = WidgetComponentProps<LightweightChartsSpecWidgetProps>;

export function LightweightChartsSpecWidget({ widget, props, resolvedInputs }: Props) {
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
  const compiled = useCompiledSpec(
    effectiveProps,
    organizationConfiguration,
    resolvedTokens,
    resolvedDataViz,
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !compiled.spec) {
      setChartError(null);
      return;
    }

    let chart: ReturnType<typeof createChart> | null = null;
    const markerPlugins: Array<{ detach: () => void }> = [];
    let resizeObserver: ResizeObserver | null = null;

    try {
      chart = createChart(
        container,
        buildChartOptions(compiled.spec) as DeepPartial<ChartOptions>,
      );

      compiled.spec.series.forEach((seriesSpec) => {
        const series = chart!.addSeries(
          seriesDefinitionByType[seriesSpec.type],
          (seriesSpec.options ?? {}) as never,
          seriesSpec.paneIndex,
        );

        series.setData(seriesSpec.data as never);

        if (seriesSpec.priceLines?.length) {
          seriesSpec.priceLines.forEach((priceLine) => {
            series.createPriceLine(priceLine as never);
          });
        }

        if (seriesSpec.markers?.length) {
          markerPlugins.push(
            createSeriesMarkers(
              series as never,
              seriesSpec.markers as never,
              (seriesSpec.markersOptions ?? {}) as never,
            ),
          );
        }

        if (seriesSpec.visible === false) {
          series.applyOptions({
            visible: false,
          } as never);
        }
      });

      if (compiled.spec.fitContent !== false) {
        chart.timeScale().fitContent();
      }

      resizeObserver = new ResizeObserver(() => {
        chart?.resize(container.clientWidth, container.clientHeight);
      });
      resizeObserver.observe(container);
      setChartError(null);
    } catch (error) {
      resizeObserver?.disconnect();
      markerPlugins.forEach((plugin) => plugin.detach());
      chart?.remove();
      setChartError(
        error instanceof Error ? error.message : "The Lightweight Charts spec could not be rendered.",
      );
      return;
    }

    return () => {
      resizeObserver?.disconnect();
      markerPlugins.forEach((plugin) => plugin.detach());
      chart?.remove();
    };
  }, [compiled.spec]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
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
            <LineChart className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Safe JSON mode is active. The widget expects one declarative Lightweight Charts spec:
              chart options plus series definitions, data, markers, and price lines. Theme tokens
              and palette references are allowed, but arbitrary JavaScript is not.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
