import { Button } from "@/components/ui/button";
import type { WidgetSettingsSchema } from "@/widgets/types";
import { X } from "lucide-react";

import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import type { DataNodeVisualizerControllerContext } from "./controller";
import type { MainSequenceDataNodeVisualizerWidgetProps } from "./dataNodeVisualizerModel";
import { DataNodeDateTimeField } from "../data-node-shared/DataNodeDateTimeField";
import { createDataNodeWidgetSourceSettingsSchema } from "../data-node-shared/dataNodeWidgetSource";

const chartTypeOptions: PickerOption[] = [
  { value: "line", label: "Line", description: "Standard time-series line chart." },
  { value: "area", label: "Area", description: "Filled area chart." },
  { value: "bar", label: "Bar", description: "Bar-style time series." },
];

const axisModeOptions: PickerOption[] = [
  { value: "shared", label: "Shared axis", description: "Keep all series in one pane." },
  {
    value: "separate",
    label: "Separate axes",
    description: "Render each series in aligned panes.",
  },
];

const groupSelectionModeOptions: PickerOption[] = [
  {
    value: "all",
    label: "All groups",
    description: "Render every resolved group from the incoming dataset.",
  },
  {
    value: "include",
    label: "Include groups",
    description: "Render only the selected groups.",
  },
  {
    value: "exclude",
    label: "Exclude groups",
    description: "Render every group except the selected ones.",
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

function renderGroupValueChips({
  values,
  labelsByValue,
  editable,
  onRemove,
}: {
  values: string[];
  labelsByValue: Map<string, string>;
  editable: boolean;
  onRemove: (value: string) => void;
}) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-xs text-foreground"
        >
          <span>{labelsByValue.get(value) ?? value}</span>
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(value)}
            disabled={!editable}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export const dataNodeVisualizerSettingsSchema: WidgetSettingsSchema<
  MainSequenceDataNodeVisualizerWidgetProps,
  DataNodeVisualizerControllerContext
> = createDataNodeWidgetSourceSettingsSchema<
  MainSequenceDataNodeVisualizerWidgetProps,
  DataNodeVisualizerControllerContext
>({
  enableFilterWidgetSource: false,
  filterWidgetOnly: true,
  dataNodeCanvasQueryScope: "data_node_graph_canvas",
  dataSourceSectionDescription:
    "Use the Bindings tab to connect this chart to a Data Node that owns the canonical row dataset.",
  selectionHelpText: "Bind this chart to the Data Node you want to visualize.",
  additionalSections: [
    {
      id: "visualization",
      title: "Visualization",
      description: "Choose how the mounted chart should render the selected data.",
    },
    {
      id: "field-mapping",
      title: "Field mapping",
      description: "Map the table fields to chart axes and grouping.",
    },
  ],
  additionalFields: [
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
      description: "Leave blank to use the first date in the selected range.",
      sectionId: "visualization",
      isVisible: ({ context }) => context.resolvedConfig.normalizeSeries,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <DataNodeDateTimeField
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
          placeholder="Auto"
          searchPlaceholder="Search X-axis fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
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
              groupSelectionMode: "all",
              selectedGroupValues: undefined,
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
      id: "groupSelectionMode",
      label: "Visible groups",
      description: "Optionally include or exclude specific groups from the rendered series list.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData && Boolean(context.resolvedConfig.groupField),
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.groupSelectionMode}
          onChange={(value) => {
            const nextMode =
              value === "include" || value === "exclude" ? value : "all";

            onDraftPropsChange({
              ...draftProps,
              groupSelectionMode: nextMode,
              selectedGroupValues:
                nextMode === "all" ? undefined : draftProps.selectedGroupValues,
            });
          }}
          options={groupSelectionModeOptions}
          placeholder="All groups"
          disabled={!editable || context.groupValueOptions.length === 0}
        />
      ),
    },
    {
      id: "selectedGroupValues",
      label: "Group values",
      description: "Choose the group values this chart should include or exclude from the incoming dataset.",
      sectionId: "field-mapping",
      isVisible: ({ context }) =>
        !context.hasNoData &&
        Boolean(context.resolvedConfig.groupField) &&
        context.resolvedConfig.groupSelectionMode !== "all",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => {
        const selectedValues = Array.isArray(draftProps.selectedGroupValues)
          ? draftProps.selectedGroupValues.filter((value): value is string => typeof value === "string")
          : [];
        const availableOptions = context.groupValueOptions.filter(
          (option) => !selectedValues.includes(option.value),
        );
        const labelsByValue = new Map(
          context.groupValueOptions.map((option) => [option.value, option.label] as const),
        );

        return (
          <div className="space-y-2">
            {renderGroupValueChips({
              values: selectedValues,
              labelsByValue,
              editable,
              onRemove: (value) => {
                const nextValues = selectedValues.filter((entry) => entry !== value);
                onDraftPropsChange({
                  ...draftProps,
                  selectedGroupValues: nextValues.length > 0 ? nextValues : undefined,
                });
              },
            })}
            {selectedValues.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No group values selected yet.
              </div>
            ) : null}
            <PickerFieldSetting
              value=""
              onChange={(value) => {
                if (!value) {
                  return;
                }

                onDraftPropsChange({
                  ...draftProps,
                  selectedGroupValues: [...selectedValues, value],
                });
              }}
              options={availableOptions}
              placeholder={
                availableOptions.length > 0
                  ? "Add a group value"
                  : "No more groups available"
              }
              searchPlaceholder="Search group values"
              disabled={!editable || availableOptions.length === 0}
            />
            {selectedValues.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!editable}
                onClick={() => {
                  onDraftPropsChange({
                    ...draftProps,
                    selectedGroupValues: undefined,
                  });
                }}
              >
                Clear group values
              </Button>
            ) : null}
          </div>
        );
      },
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
          placeholder="Auto"
          searchPlaceholder="Search Y-axis fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
  ],
});
