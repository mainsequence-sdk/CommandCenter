import { LineChart } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { CORE_VALUE_JSON_CONTRACT } from "@/widgets/shared/value-contracts";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import {
  ECHARTS_WIDGET_ORGANIZATION_CONFIGURATION,
  EChartsSpecWidget,
  starterOptionBuilderSource,
  starterOptionJson,
  type EChartsSpecWidgetProps,
} from "./EChartsSpecWidget";
import { EChartsSpecWidgetSettings } from "./EChartsSpecWidgetSettings";

export const echartsSpecWidget = defineWidget<EChartsSpecWidgetProps>({
  id: "echarts-spec",
  widgetVersion: "1.2.0",
  title: "ECharts Spec",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Visualization",
  kind: "chart",
  source: "echarts",
  requiredPermissions: ["workspaces:view"],
  tags: ["echarts", "chart", "json", "spec", "organization-config"],
  exampleProps: {
    sourceMode: "json",
    optionJson: starterOptionJson,
  },
  mockProps: {
    sourceMode: "json",
    optionJson: starterOptionJson,
  },
  io: {
    inputs: [
      {
        id: "props-json",
        label: "Props JSON",
        accepts: [CORE_VALUE_JSON_CONTRACT],
        description:
          "Consumes one JSON object and merges it over the local widget props before the ECharts option is compiled. Upstream payloads can provide sourceMode plus either optionJson or a structured option object.",
        effects: [
          {
            kind: "drives-render",
            sourcePath: "$",
            target: {
              kind: "render",
              id: "compiled-option",
            },
            description:
              "Bound JSON can replace or extend sourceMode, optionJson, and optionBuilderSource without editing the widget locally.",
          },
        ],
      },
    ],
  },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Configures a spec-driven ECharts renderer from local props JSON, bound props JSON, or an optionally unsafe JavaScript builder.",
      fields: [
        {
          id: "sourceMode",
          label: "Source mode",
          type: "string",
          source: "custom-settings",
        },
        {
          id: "optionJson",
          label: "Option JSON",
          type: "json-string",
          source: "custom-settings",
        },
        {
          id: "optionBuilderSource",
          label: "Option builder source",
          type: "javascript-string",
          source: "custom-settings",
        },
      ],
      requiredSetupSteps: [
        "Choose whether the widget should render JSON or an unsafe JavaScript builder.",
        "Provide an ECharts option payload compatible with the effective organization capability mode.",
        "Optionally bind one core.value.json@v1 payload from an upstream widget to drive the ECharts widget props.",
      ],
      configurationNotes: [
        "Both JSON mode and JavaScript builder mode can consume semantic theme tokens inside plain returned option objects, for example \"$theme.primary\" or { \"$themeToken\": \"warning\", \"alpha\": 0.2 }.",
        "Both JSON mode and JavaScript builder mode also support theme palette references inside plain returned option objects, for example \"$palette.categorical.0\" or { \"$paletteScale\": \"sequential.primary\", \"index\": 4, \"steps\": 7 }.",
        "Bound props JSON may provide the ECharts option either as optionJson or directly as a structured option object under option.",
      ],
    },
    io: {
      mode: "static",
      summary:
        "This widget can consume one bound JSON payload as effective widget props before compiling the ECharts option.",
      inputContracts: [CORE_VALUE_JSON_CONTRACT],
      ioNotes: [
        "Bind an upstream AppComponent JSON output when the chart spec should be produced dynamically.",
        "The bound JSON object is merged over the widget's saved local props.",
      ],
    },
    capabilities: {
      supportsBoundPropsJson: true,
      supportedSourceModes: ["json", "javascript"],
      supportedCapabilityModes: [
        "safe-json",
        "safe-html-tooltips",
        "trusted-snippets",
        "unsafe-custom-js",
      ],
      trustedSnippetKeys: [
        "tooltip.formatterSnippetId",
        "xAxis[].axisLabel.formatterSnippetId",
        "yAxis[].axisLabel.formatterSnippetId",
        "series[].label.formatterSnippetId",
      ],
      themeColorTokenSyntax: [
        "\"$theme.primary\"",
        "{ \"$themeToken\": \"warning\", \"alpha\": 0.16 }",
        "\"$palette.categorical.0\"",
        "{ \"$paletteScale\": \"diverging.default\", \"index\": 2, \"steps\": 5 }",
      ],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
    examples: [
      {
        label: "JSON starter",
        summary: "Simple multi-series chart rendered from parsed JSON with semantic theme tokens.",
        props: {
          sourceMode: "json",
          optionJson: starterOptionJson,
        },
        notes: [
          "You can replace the local props entirely by binding one upstream core.value.json@v1 payload into the Props JSON input.",
        ],
      },
      {
        label: "Unsafe JS starter",
        summary: "Organization-gated JavaScript builder example.",
        props: {
          sourceMode: "javascript",
          optionBuilderSource: starterOptionBuilderSource,
        },
      },
    ],
  },
  organizationConfiguration: ECHARTS_WIDGET_ORGANIZATION_CONFIGURATION,
  settingsComponent: EChartsSpecWidgetSettings,
  workspaceIcon: LineChart,
  railIcon: LineChart,
  component: EChartsSpecWidget,
});
