import type { WidgetSettingsSchema } from "@/widgets/types";
import { Button } from "@/components/ui/button";

import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import { createDataNodeWidgetSourceSettingsSchema } from "../../../workbench/widgets/data-node-shared/dataNodeWidgetSource";
import type { OhlcBarsControllerContext } from "./controller";
import type {
  MainSequenceOhlcBarsWidgetProps,
  OhlcBarsStudyConfig,
  OhlcBarsStudyType,
} from "./ohlcBarsModel";

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
      searchPlaceholder={searchPlaceholder ?? "Search fields"}
      emptyMessage="No matching fields."
      disabled={disabled}
    />
  );
}

function normalizeDraftStudies(value: MainSequenceOhlcBarsWidgetProps["studies"]) {
  return Array.isArray(value) ? value : [];
}

function addStudy(
  studies: OhlcBarsStudyConfig[],
  type: OhlcBarsStudyType,
) {
  const defaultPeriod = type === "ema" ? 20 : 50;

  return [
    ...studies,
    {
      id: `${type}-${defaultPeriod}-${Date.now()}`,
      period: defaultPeriod,
      type,
    },
  ];
}

function StudySettings({
  draftProps,
  onDraftPropsChange,
  editable,
}: {
  draftProps: MainSequenceOhlcBarsWidgetProps;
  onDraftPropsChange: (props: MainSequenceOhlcBarsWidgetProps) => void;
  editable: boolean;
}) {
  const studies = normalizeDraftStudies(draftProps.studies);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!editable || studies.length >= 5}
          onClick={() => {
            onDraftPropsChange({
              ...draftProps,
              studies: addStudy(studies, "sma"),
            });
          }}
        >
          Add SMA
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!editable || studies.length >= 5}
          onClick={() => {
            onDraftPropsChange({
              ...draftProps,
              studies: addStudy(studies, "ema"),
            });
          }}
        >
          Add EMA
        </Button>
      </div>

      {studies.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No studies are enabled.
        </div>
      ) : null}

      <div className="space-y-2">
        {studies.map((study, index) => {
          const type = study.type === "ema" ? "ema" : "sma";
          const period = Number.isFinite(Number(study.period)) ? Number(study.period) : 20;

          return (
            <div
              key={study.id ?? `${type}-${index}`}
              className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/60 p-2"
            >
              <PickerField
                value={type}
                onChange={(nextType) => {
                  const normalizedType: OhlcBarsStudyType = nextType === "ema" ? "ema" : "sma";
                  const nextStudies: OhlcBarsStudyConfig[] = studies.map((entry, entryIndex) =>
                    entryIndex === index
                      ? {
                          ...entry,
                          type: normalizedType,
                        }
                      : entry,
                  );

                  onDraftPropsChange({
                    ...draftProps,
                    studies: nextStudies,
                  });
                }}
                options={[
                  {
                    value: "sma",
                    label: "SMA",
                    description: "Simple moving average over close prices.",
                  },
                  {
                    value: "ema",
                    label: "EMA",
                    description: "Exponential moving average over close prices.",
                  },
                ]}
                placeholder="Study"
                disabled={!editable}
              />
              <input
                type="number"
                min={2}
                max={500}
                value={period}
                disabled={!editable}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => {
                  const nextStudies = studies.map((entry, entryIndex) =>
                    entryIndex === index
                      ? {
                          ...entry,
                          period: Number(event.target.value),
                        }
                      : entry,
                  );

                  onDraftPropsChange({
                    ...draftProps,
                    studies: nextStudies,
                  });
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!editable}
                onClick={() => {
                  const nextStudies = studies.filter((_, entryIndex) => entryIndex !== index);

                  onDraftPropsChange({
                    ...draftProps,
                    studies: nextStudies.length > 0 ? nextStudies : undefined,
                  });
                }}
              >
                Remove
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ohlcBarsSettingsSchema: WidgetSettingsSchema<
  MainSequenceOhlcBarsWidgetProps,
  OhlcBarsControllerContext
> = createDataNodeWidgetSourceSettingsSchema<
  MainSequenceOhlcBarsWidgetProps,
  OhlcBarsControllerContext
>({
  enableFilterWidgetSource: false,
  filterWidgetOnly: true,
  dataNodeCanvasQueryScope: "ohlc_bars_canvas",
  dataSourceSectionDescription:
    "Use the Bindings tab to connect this OHLC bars widget to the upstream dataset that publishes market bars.",
  selectionHelpText: "Bind this OHLC chart to a Connection Query or Tabular Transform dataset.",
  additionalSections: [
    {
      id: "field-mapping",
      title: "Field mapping",
      description: "Map the linked table into time, open, high, low, close, and optional volume fields.",
    },
    {
      id: "series-filter",
      title: "Series filter",
      description: "Restrict multi-instrument tables to one ticker, symbol, or other series value.",
    },
    {
      id: "studies",
      title: "Studies",
      description: "Add simple price studies rendered as overlays on the close price.",
    },
  ],
  additionalFields: [
    {
      id: "timeField",
      label: "Time field",
      description: "Date, datetime, timestamp, or Unix timestamp field used as the OHLC bar time.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.timeField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              timeField: value || undefined,
            });
          }}
          options={context.timeFieldOptions}
          placeholder="Auto"
          searchPlaceholder="Search time fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
    {
      id: "openField",
      label: "Open field",
      description: "Numeric field containing the bar open price.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.openField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              openField: value || undefined,
            });
          }}
          options={context.openFieldOptions}
          placeholder="Auto"
          searchPlaceholder="Search open fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
    {
      id: "highField",
      label: "High field",
      description: "Numeric field containing the bar high price.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.highField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              highField: value || undefined,
            });
          }}
          options={context.highFieldOptions}
          placeholder="Auto"
          searchPlaceholder="Search high fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
    {
      id: "lowField",
      label: "Low field",
      description: "Numeric field containing the bar low price.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.lowField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              lowField: value || undefined,
            });
          }}
          options={context.lowFieldOptions}
          placeholder="Auto"
          searchPlaceholder="Search low fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
    {
      id: "closeField",
      label: "Close field",
      description: "Numeric field containing the bar close price.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.closeField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              closeField: value || undefined,
            });
          }}
          options={context.closeFieldOptions}
          placeholder="Auto"
          searchPlaceholder="Search close fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
    {
      id: "volumeField",
      label: "Volume field",
      description: "Optional numeric volume field rendered as a histogram pane below price.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.volumeField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              volumeField: value || undefined,
            });
          }}
          options={context.volumeFieldOptions}
          placeholder="No volume"
          searchPlaceholder="Search volume fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
    {
      id: "seriesFilterField",
      label: "Filter column",
      description: "Optional column used to select one series from a multi-ticker OHLC table.",
      sectionId: "series-filter",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.seriesFilterField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              seriesFilterField: value || undefined,
              seriesFilterValue: undefined,
            });
          }}
          options={context.seriesFilterFieldOptions}
          placeholder="No filter"
          searchPlaceholder="Search filter columns"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
    {
      id: "seriesFilterValue",
      label: "Filter value",
      description: "Single value to render from the selected filter column.",
      sectionId: "series-filter",
      isVisible: ({ context }) => Boolean(context.resolvedConfig.seriesFilterField),
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.seriesFilterValue ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              seriesFilterValue: value || undefined,
            });
          }}
          options={context.filterValueOptions}
          placeholder={
            context.filterValueOptions.length > 0
              ? "Select one value"
              : "No values available"
          }
          searchPlaceholder="Search filter values"
          disabled={!editable || context.filterValueOptions.length === 0}
        />
      ),
    },
    {
      id: "studies",
      label: "Price studies",
      description: "Optional SMA and EMA overlays calculated from close prices.",
      sectionId: "studies",
      renderSettings: ({ draftProps, onDraftPropsChange, editable }) => (
        <StudySettings
          draftProps={draftProps}
          onDraftPropsChange={onDraftPropsChange}
          editable={editable}
        />
      ),
    },
  ],
});
