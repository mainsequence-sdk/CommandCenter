import type { WidgetSettingsSchema } from "@/widgets/types";

import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import { createDataNodeWidgetSourceSettingsSchema } from "../../../workbench/widgets/data-node-shared/dataNodeWidgetSource";
import type { OhlcBarsControllerContext } from "./controller";
import type { MainSequenceOhlcBarsWidgetProps } from "./ohlcBarsModel";

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
      description: "Map the linked table into time, open, high, low, and close fields.",
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
  ],
});
