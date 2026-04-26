import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WidgetSettingsSchema } from "@/widgets/types";

import { PickerField, type PickerOption } from "@/widgets/shared/picker-field";
import type { GraphControllerContext } from "./controller";
import type { GraphWidgetProps } from "./graphModel";
import { TabularDateTimeField } from "@/widgets/shared/tabular-date-time-field";
import { createTabularWidgetSourceSettingsSchema } from "@/widgets/shared/tabular-widget-source";

const chartTypeOptions: PickerOption[] = [
  { value: "line", label: "Line", description: "Standard line chart." },
  { value: "area", label: "Area", description: "Filled area chart." },
  { value: "bar", label: "Bar", description: "Bar-style time series." },
];

const providerOptions: PickerOption[] = [
  {
    value: "tradingview",
    label: "TradingView",
    description: "Lightweight Charts renderer with dense time-scale controls.",
  },
  {
    value: "echarts",
    label: "ECharts",
    description: "Canvas renderer with richer axis and pane layout handling.",
  },
];

const axisModeOptions: PickerOption[] = [
  { value: "shared", label: "Shared axis", description: "Keep all series in one pane." },
  {
    value: "separate",
    label: "Separate axes",
    description: "Render each series in aligned panes.",
  },
];

const timeAxisModeOptions: PickerOption[] = [
  {
    value: "auto",
    label: "Auto",
    description: "Infer date-only vs datetime behavior from the current X-field values.",
  },
  {
    value: "date",
    label: "Date",
    description: "Treat the X axis as daily business dates like YYYY-MM-DD.",
  },
  {
    value: "datetime",
    label: "DateTime",
    description: "Treat the X axis as timestamped intraday data.",
  },
];

function PickerFieldSetting({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholder: string;
  searchPlaceholder?: string;
  disabled: boolean;
}) {
  return (
    <PickerField
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder ?? "Search options"}
      emptyMessage="No matching fields."
      disabled={disabled}
    />
  );
}

function ToggleButtonField({
  enabled,
  editable,
  onChange,
  onLabel = "On",
  offLabel = "Off",
}: {
  enabled: boolean;
  editable: boolean;
  onChange: (nextValue: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={enabled ? "default" : "outline"}
        disabled={!editable}
        onClick={() => onChange(true)}
      >
        {onLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={!enabled ? "default" : "outline"}
        disabled={!editable}
        onClick={() => onChange(false)}
      >
        {offLabel}
      </Button>
    </div>
  );
}

export const graphSettingsSchema: WidgetSettingsSchema<
  GraphWidgetProps,
  GraphControllerContext
> = createTabularWidgetSourceSettingsSchema<
  GraphWidgetProps,
  GraphControllerContext
>({
  enableFilterWidgetSource: false,
  filterWidgetOnly: true,
  canvasQueryScope: "graph_canvas",
  dataSourceSectionDescription:
    "Use the Bindings tab to connect this chart to a tabular source that owns the canonical dataset.",
  selectionHelpText: "Bind this chart to the source you want to visualize.",
  additionalSections: [
    {
      id: "field-mapping",
      title: "Field mapping",
      description: "Map tabular fields to the chart X axis, Y axis, and optional grouping field.",
    },
    {
      id: "visualization",
      title: "Visualization",
      description: "Choose how the mounted chart should render the selected data.",
    },
  ],
  additionalFields: [
    {
      id: "provider",
      label: "Provider",
      description: "Choose which chart engine renders this graph.",
      settingsColumnSpan: 1,
      sectionId: "visualization",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.provider}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              provider: value === "echarts" ? "echarts" : "tradingview",
            });
          }}
          options={providerOptions}
          placeholder="Select a provider"
          disabled={!editable}
        />
      ),
    },
    {
      id: "chartType",
      label: "Chart type",
      description: "Choose the primary chart renderer mode.",
      settingsColumnSpan: 1,
      sectionId: "visualization",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.chartType}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              chartType: value === "area" || value === "bar" ? value : "line",
            });
          }}
          options={chartTypeOptions}
          placeholder="Select a chart type"
          disabled={!editable}
        />
      ),
    },
    {
      id: "seriesAxisMode",
      label: "Series axes",
      description: "Use separate panes when series need independent scales.",
      settingsColumnSpan: 1,
      sectionId: "visualization",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.seriesAxisMode}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              seriesAxisMode: value === "separate" ? "separate" : "shared",
            });
          }}
          options={axisModeOptions}
          placeholder="Select an axis layout"
          disabled={!editable}
        />
      ),
    },
    {
      id: "normalizeSeries",
      label: "Normalization",
      description: "Rebase each series to 100 at the selected date.",
      sectionId: "visualization",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <ToggleButtonField
          enabled={context.resolvedConfig.normalizeSeries}
          editable={editable}
          onChange={(nextValue) => {
            onDraftPropsChange({
              ...draftProps,
              normalizeSeries: nextValue,
            });
          }}
          onLabel="Normalize"
          offLabel="Raw values"
        />
      ),
    },
    {
      id: "normalizeAtMs",
      label: "Normalize at",
      description: "Leave blank to use the first visible point in each series.",
      sectionId: "visualization",
      isVisible: ({ context }) => context.resolvedConfig.normalizeSeries,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <TabularDateTimeField
          valueMs={context.resolvedConfig.normalizeAtMs}
          editable={editable}
          onChangeValue={(nextValue) => {
            onDraftPropsChange({
              ...draftProps,
              normalizeAtMs: nextValue,
            });
          }}
        />
      ),
    },
    {
      id: "xField",
      label: "X axis",
      description: "Usually the time field.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.xField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              xField: value || undefined,
            });
          }}
          options={context.xAxisOptions}
          placeholder="Select X field"
          searchPlaceholder="Search X-axis fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
    {
      id: "timeAxisMode",
      label: "Time axis mode",
      description: "Interpret the selected X field as daily dates or full timestamps.",
      settingsColumnSpan: 1,
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.timeAxisMode}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              timeAxisMode: value === "date" || value === "datetime" ? value : "auto",
            });
          }}
          options={timeAxisModeOptions}
          placeholder="Auto"
          disabled={!editable}
        />
      ),
    },
    {
      id: "minBarSpacingPx",
      label: "Min point spacing",
      description: "TradingView only. Lower this to fit longer histories into the initial X-axis viewport.",
      settingsColumnSpan: 1,
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData && context.resolvedConfig.provider === "tradingview",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <Input
          type="number"
          min={0}
          max={6}
          step="0.01"
          value={String(context.resolvedConfig.minBarSpacingPx)}
          disabled={!editable}
          onChange={(event) => {
            const rawValue = event.target.value.trim();

            onDraftPropsChange({
              ...draftProps,
              minBarSpacingPx:
                rawValue === "" ? undefined : Number(rawValue),
            });
          }}
        />
      ),
    },
    {
      id: "groupField",
      label: "Group by",
      description: "Split the chart into separate series.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.groupField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              groupField: value || undefined,
            });
          }}
          options={context.groupOptions}
          placeholder="No grouping"
          searchPlaceholder="Search grouping fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
    {
      id: "yField",
      label: "Y axis",
      description: "Choose the value you want to plot.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.yField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              yField: value || undefined,
            });
          }}
          options={context.yAxisOptions}
          placeholder="Select Y field"
          searchPlaceholder="Search Y-axis fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
  ],
});
