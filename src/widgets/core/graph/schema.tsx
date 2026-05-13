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
  { value: "markers", label: "Markers", description: "Points only, with no connecting line." },
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

const timeQuantizationOptions: PickerOption[] = [
  {
    value: "auto",
    label: "Auto",
    description: "Use raw timestamps on ECharts and 1-second buckets on TradingView.",
  },
  {
    value: "raw",
    label: "Raw",
    description: "Keep exact timestamps when the provider supports them. TradingView falls back to 1 second.",
  },
  { value: "1s", label: "1 second", description: "Bucket intraday points into 1-second windows." },
  { value: "5s", label: "5 seconds", description: "Bucket intraday points into 5-second windows." },
  { value: "15s", label: "15 seconds", description: "Bucket intraday points into 15-second windows." },
  { value: "30s", label: "30 seconds", description: "Bucket intraday points into 30-second windows." },
  { value: "1m", label: "1 minute", description: "Bucket intraday points into 1-minute windows." },
  { value: "5m", label: "5 minutes", description: "Bucket intraday points into 5-minute windows." },
  { value: "15m", label: "15 minutes", description: "Bucket intraday points into 15-minute windows." },
  { value: "30m", label: "30 minutes", description: "Bucket intraday points into 30-minute windows." },
  { value: "1h", label: "1 hour", description: "Bucket intraday points into 1-hour windows." },
  { value: "4h", label: "4 hours", description: "Bucket intraday points into 4-hour windows." },
  { value: "1d", label: "1 day", description: "Bucket points into UTC day windows." },
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
  trueFirst = true,
}: {
  enabled: boolean;
  editable: boolean;
  onChange: (nextValue: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  trueFirst?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {trueFirst ? (
        <>
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
        </>
      ) : (
        <>
          <Button
            type="button"
            size="sm"
            variant={!enabled ? "default" : "outline"}
            disabled={!editable}
            onClick={() => onChange(false)}
          >
            {offLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={enabled ? "default" : "outline"}
            disabled={!editable}
            onClick={() => onChange(true)}
          >
            {onLabel}
          </Button>
        </>
      )}
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
      id: "value-axis",
      title: "Value axis",
      description: "Control how Y-axis values are scaled and labeled.",
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
              chartType:
                value === "area" || value === "bar" || value === "markers" ? value : "line",
            });
          }}
          options={chartTypeOptions}
          placeholder="Select a chart type"
          disabled={!editable}
        />
      ),
    },
    {
      id: "markerSizePx",
      label: "Marker size",
      description: "Controls point size when chart type is Markers.",
      settingsColumnSpan: 1,
      sectionId: "visualization",
      isVisible: ({ context }) => context.resolvedConfig.chartType === "markers",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <Input
          type="number"
          min={2}
          max={24}
          step={1}
          value={String(context.resolvedConfig.markerSizePx)}
          disabled={!editable}
          onChange={(event) => {
            onDraftPropsChange({
              ...draftProps,
              markerSizePx: Number(event.target.value),
            });
          }}
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
      id: "stackSeries",
      label: "Series layout",
      description:
        "Choose whether grouped series overlay each other or stack on one shared axis. Shared-axis only and hidden for Markers.",
      settingsColumnSpan: 1,
      sectionId: "visualization",
      isVisible: ({ context }) =>
        context.resolvedConfig.chartType !== "markers" &&
        context.resolvedConfig.seriesAxisMode === "shared",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <ToggleButtonField
          enabled={context.resolvedConfig.stackSeries}
          editable={editable}
          onChange={(nextValue) => {
            onDraftPropsChange({
              ...draftProps,
              stackSeries: nextValue,
            });
          }}
          onLabel="Stacked"
          offLabel="Overlay"
          trueFirst={false}
        />
      ),
    },
    {
      id: "limit",
      label: "Max points per series",
      description:
        "Limits the plotted history window per rendered series. This only caps chart rendering; it does not prune upstream source rows.",
      settingsColumnSpan: 1,
      sectionId: "visualization",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <Input
          type="number"
          min={1}
          max={14000}
          step={1}
          value={String(context.resolvedConfig.limit)}
          disabled={!editable}
          onChange={(event) => {
            onDraftPropsChange({
              ...draftProps,
              limit: Number(event.target.value),
            });
          }}
        />
      ),
    },
    {
      id: "maxSeries",
      label: "Max series",
      description: "Limits how many grouped series render at once. Extra groups are dropped by descending point count.",
      settingsColumnSpan: 1,
      sectionId: "visualization",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <Input
          type="number"
          min={1}
          max={200}
          step={1}
          value={String(context.resolvedConfig.maxSeries)}
          disabled={!editable}
          onChange={(event) => {
            onDraftPropsChange({
              ...draftProps,
              maxSeries: Number(event.target.value),
            });
          }}
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
      id: "timeQuantization",
      label: "Time quantization",
      description:
        "Bucket datetime points before plotting. TradingView requires at least 1-second timestamps; raw sub-second ticks need ECharts.",
      settingsColumnSpan: 1,
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.timeQuantization}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              timeQuantization:
                value === "raw" ||
                value === "1s" ||
                value === "5s" ||
                value === "15s" ||
                value === "30s" ||
                value === "1m" ||
                value === "5m" ||
                value === "15m" ||
                value === "30m" ||
                value === "1h" ||
                value === "4h" ||
                value === "1d"
                  ? value
                  : "auto",
            });
          }}
          options={timeQuantizationOptions}
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
    {
      id: "yAxisScaleZeros",
      label: "Divide by 10^N",
      description: "Display Y values after dividing by 10^N. Example: 6 with suffix M renders millions as 12.5M.",
      settingsColumnSpan: 1,
      sectionId: "value-axis",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <Input
          type="number"
          min={0}
          max={18}
          step={1}
          value={String(context.resolvedConfig.yAxisScaleZeros)}
          disabled={!editable}
          onChange={(event) => {
            const rawValue = event.target.value.trim();

            onDraftPropsChange({
              ...draftProps,
              yAxisScaleZeros:
                rawValue === "" ? undefined : Number(rawValue),
            });
          }}
        />
      ),
    },
    {
      id: "yAxisDecimals",
      label: "Decimal places",
      description: "Leave blank to let the chart choose a reasonable number of decimals.",
      settingsColumnSpan: 1,
      sectionId: "value-axis",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <Input
          type="number"
          min={0}
          max={12}
          step={1}
          value={context.resolvedConfig.yAxisDecimals ?? ""}
          disabled={!editable}
          onChange={(event) => {
            const rawValue = event.target.value.trim();

            onDraftPropsChange({
              ...draftProps,
              yAxisDecimals:
                rawValue === "" ? undefined : Number(rawValue),
            });
          }}
        />
      ),
    },
    {
      id: "yAxisSuffix",
      label: "Suffix",
      description: "Append a suffix to displayed Y-axis values, such as %, K, M, or B. This changes labels only.",
      settingsColumnSpan: 1,
      sectionId: "value-axis",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <Input
          type="text"
          value={context.resolvedConfig.yAxisSuffix ?? ""}
          disabled={!editable}
          onChange={(event) => {
            onDraftPropsChange({
              ...draftProps,
              yAxisSuffix: event.target.value,
            });
          }}
        />
      ),
    },
  ],
});
