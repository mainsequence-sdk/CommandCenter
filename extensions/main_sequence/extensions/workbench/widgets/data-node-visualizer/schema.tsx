import { useState } from "react";

import { RefreshCw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  WidgetFieldCanvasRendererProps,
  WidgetFieldSettingsRendererProps,
  WidgetSettingsSchema,
} from "@/widgets/types";

import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import type { DataNodeVisualizerControllerContext } from "./controller";
import type { MainSequenceDataNodeVisualizerWidgetProps } from "./dataNodeVisualizerModel";
import { DataNodeDateTimeField } from "../data-node-shared/DataNodeDateTimeField";
import { DataNodeQuickSearchPicker } from "../data-node-shared/DataNodeQuickSearchPicker";

const dateRangeModeOptions: PickerOption[] = [
  {
    value: "dashboard",
    label: "Dashboard date",
    description: "Keep this widget in sync with the current dashboard date.",
  },
  {
    value: "fixed",
    label: "Fixed date",
    description: "Give this widget its own saved start and end date.",
  },
];

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

function tokenizeUniqueIdentifierValues(values: string) {
  return values
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeUniqueIdentifierValues(existingValues: string[], nextValues: string[]) {
  const seen = new Set(existingValues);
  const mergedValues = [...existingValues];

  nextValues.forEach((value) => {
    if (!seen.has(value)) {
      seen.add(value);
      mergedValues.push(value);
    }
  });

  return mergedValues;
}

function toUniqueIdentifierList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function DataNodePickerField({
  draftProps,
  onDraftPropsChange,
  editable,
  context,
}: WidgetFieldSettingsRendererProps<
  MainSequenceDataNodeVisualizerWidgetProps,
  DataNodeVisualizerControllerContext
>) {
  return (
    <DataNodeQuickSearchPicker
      value={context.selectedDataNodeId}
      onChange={(nextId) => {
        onDraftPropsChange({
          ...draftProps,
          dataNodeId: nextId,
          xField: undefined,
          yField: undefined,
          groupField: undefined,
          seriesOverrides: undefined,
          uniqueIdentifierList: undefined,
        });
      }}
      editable={editable}
      queryScope="data_node_visualizer"
      selectedDataNode={context.selectedDataNodeDetailQuery.data}
      detailError={context.selectedDataNodeDetailQuery.error}
      hasNoData={context.hasNoData}
      selectionHelpText="Choose the table you want to visualize."
    />
  );
}

function DataNodePickerCanvasField({
  props,
  onPropsChange,
  editable,
  context,
}: WidgetFieldCanvasRendererProps<
  MainSequenceDataNodeVisualizerWidgetProps,
  DataNodeVisualizerControllerContext
>) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Data node
      </div>
      <DataNodeQuickSearchPicker
        value={context.selectedDataNodeId}
        onChange={(nextId) => {
          onPropsChange({
            ...props,
            dataNodeId: nextId,
            xField: undefined,
            yField: undefined,
            groupField: undefined,
            seriesOverrides: undefined,
            uniqueIdentifierList: undefined,
          });
        }}
        editable={editable}
        queryScope="data_node_graph_canvas"
        selectedDataNode={context.selectedDataNodeDetailQuery.data}
        showStatus={false}
      />
    </div>
  );
}

function UniqueIdentifierField({
  draftProps,
  onDraftPropsChange,
  editable,
}: WidgetFieldSettingsRendererProps<
  MainSequenceDataNodeVisualizerWidgetProps,
  DataNodeVisualizerControllerContext
>) {
  const [inputValue, setInputValue] = useState("");
  const uniqueIdentifierList = toUniqueIdentifierList(draftProps.uniqueIdentifierList);

  function commitIdentifierInput(rawValue?: string) {
    const nextInputValue = rawValue ?? inputValue;
    const nextTokens = tokenizeUniqueIdentifierValues(nextInputValue);

    if (nextTokens.length === 0) {
      setInputValue("");
      return;
    }

    onDraftPropsChange({
      ...draftProps,
      uniqueIdentifierList: mergeUniqueIdentifierValues(uniqueIdentifierList, nextTokens),
    });
    setInputValue("");
  }

  function removeIdentifier(identifier: string) {
    onDraftPropsChange({
      ...draftProps,
      uniqueIdentifierList: uniqueIdentifierList.filter((value) => value !== identifier),
    });
  }

  return (
    <div className="space-y-2">
      <div className="rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/35 px-3 py-3 shadow-sm transition-colors focus-within:border-ring/70 focus-within:ring-2 focus-within:ring-ring/20">
        <div className="flex flex-wrap items-center gap-2">
          {uniqueIdentifierList.map((identifier) => (
            <Badge
              key={identifier}
              variant="neutral"
              className="border border-border/70 bg-card/80 px-2.5 py-1 text-[11px] text-foreground"
            >
              <span>{identifier}</span>
              <button
                type="button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                aria-label={`Remove ${identifier}`}
                title={`Remove ${identifier}`}
                onClick={() => {
                  removeIdentifier(identifier);
                }}
                disabled={!editable}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          <input
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                commitIdentifierInput();
                return;
              }

          if (event.key === "Backspace" && !inputValue && uniqueIdentifierList.length > 0) {
            event.preventDefault();
            removeIdentifier(uniqueIdentifierList[uniqueIdentifierList.length - 1]!);
          }
        }}
            onBlur={() => {
              commitIdentifierInput();
            }}
            placeholder={
              uniqueIdentifierList.length > 0
                ? "Add another identifier"
                : "Type an identifier and press Enter"
            }
            className="h-8 min-w-[180px] flex-1 border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            disabled={!editable}
          />
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Use Backspace on an empty field to remove the last identifier.
      </div>
    </div>
  );
}

function UniqueIdentifierCanvasField({
  props,
  onPropsChange,
}: WidgetFieldCanvasRendererProps<
  MainSequenceDataNodeVisualizerWidgetProps,
  DataNodeVisualizerControllerContext
>) {
  const [inputValue, setInputValue] = useState("");
  const uniqueIdentifierList = toUniqueIdentifierList(props.uniqueIdentifierList);

  function commitIdentifierInput(rawValue?: string) {
    const nextInputValue = rawValue ?? inputValue;
    const nextTokens = tokenizeUniqueIdentifierValues(nextInputValue);

    if (nextTokens.length === 0) {
      setInputValue("");
      return;
    }

    onPropsChange({
      ...props,
      uniqueIdentifierList: mergeUniqueIdentifierValues(uniqueIdentifierList, nextTokens),
    });
    setInputValue("");
  }

  function removeIdentifier(identifier: string) {
    onPropsChange({
      ...props,
      uniqueIdentifierList: uniqueIdentifierList.filter((value) => value !== identifier),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Unique identifiers
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px]"
          disabled={uniqueIdentifierList.length === 0}
          onClick={() => {
            onPropsChange({
              ...props,
              uniqueIdentifierList: undefined,
            });
          }}
        >
          Clear
        </Button>
      </div>

      <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/35 px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {uniqueIdentifierList.map((identifier) => (
            <Badge
              key={identifier}
              variant="neutral"
              className="border border-border/70 bg-card/80 px-2 py-1 text-[10px] text-foreground"
            >
              <span>{identifier}</span>
              <button
                type="button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => {
                  removeIdentifier(identifier);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <input
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                commitIdentifierInput();
              }
            }}
            onBlur={() => {
              commitIdentifierInput();
            }}
            placeholder={uniqueIdentifierList.length > 0 ? "Add identifier" : "Filter series"}
            className="h-7 min-w-[120px] flex-1 border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}

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

export const dataNodeVisualizerSettingsSchema: WidgetSettingsSchema<
  MainSequenceDataNodeVisualizerWidgetProps,
  DataNodeVisualizerControllerContext
> = {
  sections: [
    {
      id: "data-source",
      title: "Data source",
      description: "Pick the data node and optional series identifiers to visualize.",
    },
    {
      id: "date-range",
      title: "Date range",
      description: "Choose whether this widget follows the dashboard date or keeps its own range.",
    },
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
  fields: [
    {
      id: "dataNodeId",
      label: "Data node",
      description: "Choose the table you want to visualize.",
      sectionId: "data-source",
      pop: {
        canPop: true,
        defaultPopped: false,
        anchor: "top",
        mode: "inline",
        defaultWidth: 340,
        defaultHeight: 96,
      },
      renderSettings: DataNodePickerField,
      renderCanvas: DataNodePickerCanvasField,
    },
    {
      id: "uniqueIdentifierList",
      label: "Unique identifiers",
      description: "Filter the widget to a saved list of identifiers.",
      sectionId: "data-source",
      pop: {
        canPop: true,
        defaultPopped: true,
        anchor: "top",
        mode: "token-list",
        defaultWidth: 360,
        defaultHeight: 116,
      },
      isVisible: ({ context }) => context.supportsUniqueIdentifierList && !context.hasNoData,
      renderSettings: UniqueIdentifierField,
      renderCanvas: UniqueIdentifierCanvasField,
    },
    {
      id: "dateRangeMode",
      label: "Mode",
      description: "Follow the dashboard range or save an independent fixed range.",
      sectionId: "date-range",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.dateRangeMode}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              dateRangeMode: value === "fixed" ? "fixed" : "dashboard",
            });
          }}
          options={dateRangeModeOptions}
          placeholder="Select a date mode"
          disabled={!editable}
        />
      ),
    },
    {
      id: "fixedStartMs",
      label: "From",
      description: "Saved fixed range start for this widget.",
      sectionId: "date-range",
      isVisible: ({ context }) => context.resolvedConfig.dateRangeMode === "fixed",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <DataNodeDateTimeField
          valueMs={context.resolvedConfig.fixedStartMs}
          editable={editable}
          onChangeValue={(nextValue) => {
            onDraftPropsChange({
              ...draftProps,
              fixedStartMs: nextValue,
            });
          }}
        />
      ),
    },
    {
      id: "fixedEndMs",
      label: "To",
      description: "Saved fixed range end for this widget.",
      sectionId: "date-range",
      isVisible: ({ context }) => context.resolvedConfig.dateRangeMode === "fixed",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <DataNodeDateTimeField
          valueMs={context.resolvedConfig.fixedEndMs}
          editable={editable}
          onChangeValue={(nextValue) => {
            onDraftPropsChange({
              ...draftProps,
              fixedEndMs: nextValue,
            });
          }}
        />
      ),
    },
    {
      id: "chartType",
      label: "Chart type",
      description: "Choose the primary chart renderer mode.",
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
          placeholder="Auto"
          searchPlaceholder="Search Y-axis fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
  ],
};
