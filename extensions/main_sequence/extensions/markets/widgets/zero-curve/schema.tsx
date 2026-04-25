import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WidgetSettingsSchema } from "@/widgets/types";

import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import { createDataNodeWidgetSourceSettingsSchema } from "../../../workbench/widgets/data-node-shared/dataNodeWidgetSource";
import type { ZeroCurveControllerContext } from "./controller";
import type { MainSequenceZeroCurveWidgetProps } from "./zeroCurveModel";

const curveSelectionModeOptions: PickerOption[] = [
  {
    value: "all",
    label: "All curves",
    description: "Render every zero curve found in the linked dataset.",
  },
  {
    value: "include",
    label: "Include curves",
    description: "Render only the selected zero curve values.",
  },
  {
    value: "exclude",
    label: "Exclude curves",
    description: "Render every zero curve except the selected values.",
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

function renderCurveValueChips({
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

export const zeroCurveSettingsSchema: WidgetSettingsSchema<
  MainSequenceZeroCurveWidgetProps,
  ZeroCurveControllerContext
> = createDataNodeWidgetSourceSettingsSchema<
  MainSequenceZeroCurveWidgetProps,
  ZeroCurveControllerContext
>({
  enableFilterWidgetSource: false,
  filterWidgetOnly: true,
  dataNodeCanvasQueryScope: "zero_curve_canvas",
  dataSourceSectionDescription:
    "Use the Bindings tab to connect this zero curve widget to the upstream dataset that owns the canonical compressed curve rows.",
  selectionHelpText: "Bind this zero curve widget to a Connection Query or Tabular Transform dataset.",
  additionalSections: [
    {
      id: "zero-curve-contract",
      title: "Compressed Curve Contract",
      description: "Zero Curve expects the standard compressed Main Sequence curve payload contract.",
    },
    {
      id: "curve-selection",
      title: "Curve selection",
      description: "Filter which unique curve identifiers should be rendered.",
    },
  ],
  additionalFields: [
    {
      id: "curveDataNodeInfo",
      label: "Compressed curve rows",
      description:
        "Compressed curve datasets must include time_index, unique_identifier, and curve fields.",
      sectionId: "zero-curve-contract",
      renderSettings: () => (
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3 text-sm text-muted-foreground">
          Compressed curve datasets include <code>time_index</code>, <code>unique_identifier</code>,
          {" "}and <code>curve</code>. The <code>curve</code> payload is decompressed and plotted on a
          numeric days axis.
        </div>
      ),
    },
    {
      id: "curveSelectionMode",
      label: "Curve selection",
      description: "Filter the rendered zero curves by unique identifier.",
      sectionId: "curve-selection",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.curveSelectionMode}
          onChange={(value) => {
            const nextMode =
              value === "include" || value === "exclude" ? value : "all";

            onDraftPropsChange({
              ...draftProps,
              curveSelectionMode: nextMode,
              selectedCurveValues:
                nextMode === "all" ? undefined : draftProps.selectedCurveValues,
            });
          }}
          options={curveSelectionModeOptions}
          placeholder="Select a curve filter mode"
          disabled={!editable}
        />
      ),
    },
    {
      id: "selectedCurveValues",
      label: "Selected curves",
      description: "Pick the unique identifiers that should be included or excluded.",
      sectionId: "curve-selection",
      isVisible: ({ context }) => context.resolvedConfig.curveSelectionMode !== "all",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => {
        const selectedValues = Array.isArray(draftProps.selectedCurveValues)
          ? draftProps.selectedCurveValues.filter((value): value is string => typeof value === "string")
          : [];
        const availableOptions = context.curveValueOptions.filter(
          (option) => !selectedValues.includes(option.value),
        );
        const labelsByValue = new Map(
          context.curveValueOptions.map((option) => [option.value, option.label] as const),
        );

        return (
          <div className="space-y-3">
            {renderCurveValueChips({
              values: selectedValues,
              labelsByValue,
              editable,
              onRemove: (value) => {
                const nextValues = selectedValues.filter((entry) => entry !== value);

                onDraftPropsChange({
                  ...draftProps,
                  selectedCurveValues: nextValues.length > 0 ? nextValues : undefined,
                });
              },
            })}
            {selectedValues.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No curve values selected yet.
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
                  selectedCurveValues: [...selectedValues, value],
                });
              }}
              options={availableOptions}
              placeholder={
                availableOptions.length > 0
                  ? "Add a curve value"
                  : "No more curves available"
              }
              searchPlaceholder="Search curve values"
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
                    selectedCurveValues: undefined,
                  });
                }}
              >
                Clear curve values
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ],
});
