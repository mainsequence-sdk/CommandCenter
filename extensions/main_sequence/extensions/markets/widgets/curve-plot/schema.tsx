import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WidgetSettingsSchema } from "@/widgets/types";

import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import { createDataNodeWidgetSourceSettingsSchema } from "../../../workbench/widgets/data-node-shared/dataNodeWidgetSource";
import type { CurvePlotControllerContext } from "./controller";
import type { MainSequenceCurvePlotWidgetProps } from "./curvePlotModel";

const maturityUnitOptions: PickerOption[] = [
  {
    value: "auto",
    label: "Auto",
    description: "Parse common tenor labels like 3M or 10Y. Bare numbers are treated as years.",
  },
  {
    value: "years",
    label: "Years",
    description: "Treat numeric maturity values as years to maturity.",
  },
  {
    value: "months",
    label: "Months",
    description: "Treat numeric maturity values as months to maturity.",
  },
];

const curveSelectionModeOptions: PickerOption[] = [
  {
    value: "all",
    label: "All curves",
    description: "Render every curve found in the linked dataset.",
  },
  {
    value: "include",
    label: "Include curves",
    description: "Render only the selected curve values.",
  },
  {
    value: "exclude",
    label: "Exclude curves",
    description: "Render every curve except the selected values.",
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

export const curvePlotSettingsSchema: WidgetSettingsSchema<
  MainSequenceCurvePlotWidgetProps,
  CurvePlotControllerContext
> = createDataNodeWidgetSourceSettingsSchema<
  MainSequenceCurvePlotWidgetProps,
  CurvePlotControllerContext
>({
  enableFilterWidgetSource: true,
  filterWidgetOnly: true,
  dataNodeCanvasQueryScope: "curve_plot_canvas",
  dataSourceSectionDescription:
    "Point this curve plot at a Data Node widget that already owns the canonical row dataset.",
  selectionHelpText: "Choose the Data Node widget that should feed this curve plot.",
  additionalSections: [
    {
      id: "field-mapping",
      title: "Field mapping",
      description: "Map the linked dataset into curve maturities, yields, and optional grouped curves.",
    },
  ],
  additionalFields: [
    {
      id: "maturityField",
      label: "Maturity field",
      description: "Field containing tenor values such as 3M, 2Y, or numeric maturities.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.maturityField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              maturityField: value || undefined,
            });
          }}
          options={context.maturityFieldOptions}
          placeholder="Auto"
          searchPlaceholder="Search maturity fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
    {
      id: "maturityUnit",
      label: "Numeric maturity unit",
      description: "How numeric maturity values should be interpreted.",
      sectionId: "field-mapping",
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.maturityUnit}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              maturityUnit: value === "months" || value === "years" ? value : "auto",
            });
          }}
          options={maturityUnitOptions}
          placeholder="Select a maturity unit"
          disabled={!editable}
        />
      ),
    },
    {
      id: "valueField",
      label: "Yield field",
      description: "Numeric field containing the plotted curve values.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.valueField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              valueField: value || undefined,
            });
          }}
          options={context.valueFieldOptions}
          placeholder="Auto"
          searchPlaceholder="Search yield fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
    {
      id: "curveField",
      label: "Curve field",
      description: "Optional field used to split rows into multiple curves like Current, 1D ago, or Scenario.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => !context.hasNoData,
      renderSettings: ({ draftProps, onDraftPropsChange, editable, context }) => (
        <PickerFieldSetting
          value={context.resolvedConfig.curveField ?? ""}
          onChange={(value) => {
            onDraftPropsChange({
              ...draftProps,
              curveField: value || undefined,
              selectedCurveValues: undefined,
            });
          }}
          options={context.curveFieldOptions}
          placeholder="No grouping"
          searchPlaceholder="Search curve fields"
          disabled={!editable || context.resolvedConfig.availableFields.length === 0}
        />
      ),
    },
    {
      id: "curveSelectionMode",
      label: "Curve selection",
      description: "Filter the rendered curves when a grouping field is present.",
      sectionId: "field-mapping",
      isVisible: ({ context }) => Boolean(context.resolvedConfig.curveField),
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
      description: "Pick the curve values that should be included or excluded.",
      sectionId: "field-mapping",
      isVisible: ({ context }) =>
        Boolean(context.resolvedConfig.curveField) &&
        context.resolvedConfig.curveSelectionMode !== "all",
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
