import { LineChart } from "lucide-react";

import { resolveWidgetDescription } from "@/widgets/shared/widget-description";
import { CORE_VALUE_JSON_CONTRACT } from "@/widgets/shared/value-contracts";
import { defineWidget } from "@/widgets/types";

import descriptionMarkdown from "./DESCRIPTION.md?raw";
import {
  LIGHTWEIGHT_CHARTS_WIDGET_ORGANIZATION_CONFIGURATION,
  LightweightChartsSpecWidget,
  starterSpecJson,
  type LightweightChartsSpecWidgetProps,
} from "./LightweightChartsSpecWidget";
import { LightweightChartsSpecWidgetSettings } from "./LightweightChartsSpecWidgetSettings";
import { PriceChartWidget } from "./PriceChartWidget";

export const priceChartWidget = defineWidget<{ symbol?: string }>({
  id: "price-chart",
  widgetVersion: "1.0.0",
  title: "Price Chart",
  description: resolveWidgetDescription(descriptionMarkdown, "price-chart"),
  category: "Main Sequence Markets",
  kind: "chart",
  source: "main_sequence_markets",
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["main-sequence", "markets", "market", "price-chart", "lightweight-charts"],
  exampleProps: { symbol: "AAPL" },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary: "Configures a simple symbol-driven legacy price chart widget.",
      fields: [
        {
          id: "symbol",
          label: "Symbol",
          type: "string",
          source: "custom-settings",
        },
      ],
    },
    io: {
      mode: "none",
      summary: "This legacy chart widget owns its own local query behavior and does not use typed widget IO.",
    },
    agentHints: {
      buildPurpose: "Use this widget for a legacy simple market price chart.",
      whenToUse: ["Use only when this legacy lightweight-charts widget is explicitly desired."],
      whenNotToUse: ["Do not use when a newer data-node-backed chart should own the visualization."],
      authoringSteps: ["Set the symbol to chart."],
      blockingRequirements: [],
      commonPitfalls: ["This widget is not part of the canonical typed Data Node chart pipeline."],
    },
  },
  component: PriceChartWidget,
});

export const lightweightChartsSpecWidget = defineWidget<LightweightChartsSpecWidgetProps>({
  id: "lightweight-charts-spec",
  widgetVersion: "1.0.0",
  title: "Lightweight Charts Spec",
  description: resolveWidgetDescription(descriptionMarkdown, "lightweight-charts-spec"),
  category: "Visualization",
  kind: "chart",
  source: "lightweight-charts",
  requiredPermissions: ["workspaces:view"],
  tags: ["lightweight-charts", "chart", "json", "spec", "time-series", "organization-config"],
  exampleProps: {
    specJson: starterSpecJson,
  },
  mockProps: {
    specJson: starterSpecJson,
  },
  io: {
    inputs: [
      {
        id: "props-json",
        label: "Props JSON",
        accepts: [CORE_VALUE_JSON_CONTRACT],
        description:
          "Consumes one JSON object as the effective widget props before the Lightweight Charts spec is compiled. Upstream payloads can provide specJson, a structured spec object, or the spec object directly.",
        effects: [
          {
            kind: "drives-render",
            sourcePath: "$",
            target: {
              kind: "render",
            id: "compiled-spec",
          },
          description:
              "Bound JSON replaces the local starter props while the binding is valid.",
        },
      ],
      },
    ],
  },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Configures a spec-driven Lightweight Charts renderer from local props JSON or bound props JSON.",
      fields: [
        {
          id: "specJson",
          label: "Spec JSON",
          type: "json-string",
          source: "custom-settings",
        },
      ],
      requiredSetupSteps: [
        "Author one declarative Lightweight Charts spec with chart options, series, data, markers, and optional price lines.",
        "Keep the spec inside safe JSON mode and ensure it fits the effective organization resource budgets.",
        "Optionally bind one core.value.json@v1 payload from an upstream widget to drive the Lightweight Charts widget props.",
      ],
      configurationNotes: [
        "Safe mode is JSON-only. Arbitrary JavaScript is not executed in this widget.",
        "Theme and palette references are supported anywhere the final Lightweight Charts options expect colors, for example \"$theme.primary\" or { \"$paletteScale\": \"sequential.primary\", \"index\": 4, \"steps\": 7 }.",
        "Bound props JSON may provide the chart spec either as specJson or directly as a structured spec object under spec.",
      ],
    },
    io: {
      mode: "static",
      summary:
        "This widget can consume one bound JSON payload as effective widget props before compiling the Lightweight Charts spec.",
      inputContracts: [CORE_VALUE_JSON_CONTRACT],
      ioNotes: [
        "Bind an upstream AppComponent JSON output when the chart spec should be produced dynamically.",
        "The bound JSON object replaces the widget's saved local props while the binding is valid, so starter specJson cannot shadow a bound spec.",
      ],
    },
    capabilities: {
      supportsBoundPropsJson: true,
      supportedSourceModes: ["json"],
      supportedCapabilityModes: ["safe-json"],
      supportedSeriesTypes: ["line", "area", "baseline", "histogram", "candlestick", "bar"],
      themeColorTokenSyntax: [
        "\"$theme.primary\"",
        "{ \"$themeToken\": \"warning\", \"alpha\": 0.16 }",
        "\"$palette.categorical.0\"",
        "{ \"$paletteScale\": \"diverging.default\", \"index\": 2, \"steps\": 5 }",
      ],
    },
    agentHints: {
      buildPurpose:
        "Use this widget to render declarative time-series and financial charts directly through Lightweight Charts when a fixed-purpose chart widget would be too restrictive.",
      whenToUse: [
        "Use when the chart should be authored as a full Lightweight Charts spec instead of a tiny typed DSL.",
        "Use when the visualization is time-series-native and fits Lightweight Charts better than ECharts.",
        "Use when an upstream AppComponent or other JSON-producing widget should publish the chart props dynamically.",
      ],
      whenNotToUse: [
        "Do not use for arbitrary graph, sankey, or layout-heavy visualizations that belong in ECharts.",
        "Do not expect arbitrary JavaScript execution in this first version; the widget is safe JSON only.",
      ],
      authoringSteps: [
        "Author the chartOptions and series definitions in JSON.",
        "Attach the series data, markers, and price lines in the same spec.",
        "Use theme tokens and palette references instead of hardcoded colors.",
      ],
      commonPitfalls: [
        "The spec is declarative. It does not run arbitrary chart lifecycle code.",
        "Bound props JSON overrides matching local widget props when both are present.",
        "Series data still needs to match the chosen series type, for example OHLC objects for candlestick/bar series.",
      ],
    },
    examples: [
      {
        label: "Safe starter",
        summary: "Candlestick plus volume starter rendered from JSON with theme-aware colors and chart palettes.",
        props: {
          specJson: starterSpecJson,
        },
        notes: [
          "You can replace the local props entirely by binding one upstream core.value.json@v1 payload into the Props JSON input.",
        ],
      },
    ],
  },
  organizationConfiguration: LIGHTWEIGHT_CHARTS_WIDGET_ORGANIZATION_CONFIGURATION,
  settingsComponent: LightweightChartsSpecWidgetSettings,
  workspaceIcon: LineChart,
  railIcon: LineChart,
  component: LightweightChartsSpecWidget,
});
