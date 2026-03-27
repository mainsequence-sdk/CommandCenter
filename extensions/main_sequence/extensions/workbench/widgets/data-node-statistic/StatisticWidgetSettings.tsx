import { useMemo } from "react";

import { Calculator } from "lucide-react";

import { Input } from "@/components/ui/input";
import { PickerField } from "../../../../common/components/PickerField";
import {
  widgetTightFormDescriptionClass,
  widgetTightFormFieldClass,
  widgetTightFormInsetSectionClass,
  widgetTightFormLabelClass,
  widgetTightFormSectionClass,
  widgetTightFormTitleClass,
} from "@/widgets/shared/form-density";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import { StatisticCardGrid } from "./StatisticCardGrid";
import {
  buildDataNodeStatisticCards,
  buildDataNodeStatisticFieldOptions,
  normalizeDataNodeStatisticProps,
  resolveDataNodeStatisticConfig,
  resolveStatisticValueFieldPickerOptions,
  type DataNodeStatisticMode,
  type MainSequenceDataNodeStatisticWidgetProps,
} from "./statisticModel";
import { useResolvedDataNodeWidgetSourceBinding } from "../data-node-shared/dataNodeWidgetSource";
import { normalizeDataNodePublishedDataset } from "../data-node-shared/dataNodePublishedDataset";

const sectionClass = widgetTightFormSectionClass;
const insetSectionClass = widgetTightFormInsetSectionClass;
const fieldClass = widgetTightFormFieldClass;
const labelClass = widgetTightFormLabelClass;
const titleClass = widgetTightFormTitleClass;
const descriptionClass = widgetTightFormDescriptionClass;

const statisticModeOptions: Array<{
  value: DataNodeStatisticMode;
  label: string;
  description: string;
}> = [
  {
    value: "last",
    label: "Last",
    description: "Use the last visible row value after optional ordering.",
  },
  {
    value: "first",
    label: "First",
    description: "Use the first visible row value after optional ordering.",
  },
  {
    value: "max",
    label: "Max",
    description: "Show the maximum numeric value.",
  },
  {
    value: "min",
    label: "Min",
    description: "Show the minimum numeric value.",
  },
  {
    value: "sum",
    label: "Sum",
    description: "Add numeric values together.",
  },
  {
    value: "mean",
    label: "Mean",
    description: "Show the average numeric value.",
  },
  {
    value: "count",
    label: "Count",
    description: "Count rows in the incoming dataset or each group.",
  },
];

export function StatisticWidgetSettings({
  draftProps,
  editable,
  instanceId,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<MainSequenceDataNodeStatisticWidgetProps>) {
  const sourceBinding = useResolvedDataNodeWidgetSourceBinding({
    props: {
      sourceMode: "filter_widget",
      sourceWidgetId: draftProps.sourceWidgetId,
    },
    currentWidgetInstanceId: instanceId,
  });
  const linkedDataset = useMemo(
    () => normalizeDataNodePublishedDataset(sourceBinding.referencedFilterWidget?.runtimeState),
    [sourceBinding.referencedFilterWidget?.runtimeState],
  );
  const availableFields = useMemo(
    () =>
      buildDataNodeStatisticFieldOptions({
        columns: linkedDataset?.columns,
        rows: linkedDataset?.rows,
      }),
    [linkedDataset?.columns, linkedDataset?.rows],
  );
  const resolvedDraft = useMemo(
    () => normalizeDataNodeStatisticProps(draftProps, availableFields),
    [availableFields, draftProps],
  );
  const resolvedConfig = useMemo(
    () => resolveDataNodeStatisticConfig(resolvedDraft, availableFields),
    [availableFields, resolvedDraft],
  );
  const statisticResult = useMemo(
    () => buildDataNodeStatisticCards(linkedDataset?.rows ?? [], resolvedConfig),
    [linkedDataset?.rows, resolvedConfig],
  );
  const fieldOptions = useMemo(
    () => resolveStatisticValueFieldPickerOptions(availableFields),
    [availableFields],
  );
  const groupFieldOptions = useMemo(
    () => [
      {
        value: "",
        label: "No grouping",
        description: "Render one statistic tile for the whole Data Node dataset.",
      },
      ...fieldOptions,
    ],
    [fieldOptions],
  );
  const orderFieldOptions = useMemo(
    () => [
      {
        value: "",
        label: "Use published row order",
        description: "Keep the upstream Data Node row order for first/last and sparkline shape.",
      },
      ...fieldOptions,
    ],
    [fieldOptions],
  );

  return (
    <div className="space-y-3">
      <section className={sectionClass}>
        <div className="space-y-1">
          <div className={titleClass}>Statistic source</div>
          <p className={descriptionClass}>
            This widget consumes the published table-shaped dataset from a Data Node and reduces it into one or more statistic tiles.
          </p>
        </div>

        <div className={fieldClass}>
          <label className={labelClass}>Data Node</label>
          <PickerField
            value={resolvedDraft.sourceWidgetId ?? ""}
            onChange={(value) => {
              onDraftPropsChange({
                ...draftProps,
                sourceMode: "filter_widget",
                sourceWidgetId: value || undefined,
                valueField: undefined,
                groupField: undefined,
                orderField: undefined,
              });
            }}
            options={sourceBinding.filterWidgetOptions}
            placeholder={
              sourceBinding.filterWidgetOptions.length > 0
                ? "Select a Data Node"
                : "No Data Nodes are available"
            }
            emptyMessage="No Data Nodes are available in this dashboard."
            disabled={!editable || sourceBinding.filterWidgetOptions.length === 0}
          />
        </div>
      </section>

      <section className={sectionClass}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className={fieldClass}>
            <label className={labelClass}>Statistic</label>
            <PickerField
              value={resolvedDraft.statisticMode ?? "last"}
              onChange={(value) => {
                onDraftPropsChange({
                  ...draftProps,
                  statisticMode: value as DataNodeStatisticMode,
                });
              }}
              options={statisticModeOptions}
              placeholder="Select a statistic"
              disabled={!editable}
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass}>Value field</label>
            <PickerField
              value={resolvedDraft.valueField ?? ""}
              onChange={(value) => {
                onDraftPropsChange({
                  ...draftProps,
                  valueField: value || undefined,
                });
              }}
              options={[
                ...(resolvedDraft.statisticMode === "count"
                  ? [
                      {
                        value: "",
                        label: "No value field",
                        description: "Count rows without selecting a specific field.",
                      },
                    ]
                  : []),
                ...fieldOptions,
              ]}
              placeholder={
                fieldOptions.length > 0
                  ? "Select a field"
                  : "Select a Data Node first"
              }
              emptyMessage="No source fields are available yet."
              disabled={!editable || fieldOptions.length === 0}
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass}>Group by</label>
            <PickerField
              value={resolvedDraft.groupField ?? ""}
              onChange={(value) => {
                onDraftPropsChange({
                  ...draftProps,
                  groupField: value || undefined,
                });
              }}
              options={groupFieldOptions}
              placeholder="No grouping"
              disabled={!editable || fieldOptions.length === 0}
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass}>Order field</label>
            <PickerField
              value={resolvedDraft.orderField ?? ""}
              onChange={(value) => {
                onDraftPropsChange({
                  ...draftProps,
                  orderField: value || undefined,
                });
              }}
              options={orderFieldOptions}
              placeholder="Use published row order"
              disabled={!editable || fieldOptions.length === 0}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className={fieldClass}>
            <label className={labelClass}>Decimals</label>
            <Input
              type="number"
              min={0}
              max={6}
              step={1}
              value={resolvedDraft.decimals ?? ""}
              onChange={(event) => {
                const nextValue = event.target.value.trim();

                onDraftPropsChange({
                  ...draftProps,
                  decimals: nextValue === "" ? undefined : Number(nextValue),
                });
              }}
              className="h-8 text-xs"
              disabled={!editable}
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass}>Prefix</label>
            <Input
              value={resolvedDraft.prefix ?? ""}
              onChange={(event) => {
                onDraftPropsChange({
                  ...draftProps,
                  prefix: event.target.value || undefined,
                });
              }}
              className="h-8 text-xs"
              disabled={!editable}
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass}>Suffix</label>
            <Input
              value={resolvedDraft.suffix ?? ""}
              onChange={(event) => {
                onDraftPropsChange({
                  ...draftProps,
                  suffix: event.target.value || undefined,
                });
              }}
              className="h-8 text-xs"
              disabled={!editable}
            />
          </div>
        </div>

        <div className={descriptionClass}>
          `Last` and `First` use the selected order field when present. If no order field is selected, the statistic uses the published row order from the Data Node.
        </div>
      </section>

      <section className={sectionClass}>
        <div className="space-y-1">
          <div className={titleClass}>Preview</div>
          <p className={descriptionClass}>
            The preview uses the live published dataset coming from the selected Data Node.
          </p>
        </div>

        <div className={insetSectionClass}>
          {!sourceBinding.hasResolvedFilterWidgetSource ? (
            <div className="rounded-[calc(var(--radius)-8px)] border border-dashed border-border/70 bg-background/24 px-4 py-5 text-sm text-muted-foreground">
              Select a Data Node in this dashboard to preview the statistic output.
            </div>
          ) : linkedDataset?.status === "loading" || linkedDataset == null ? (
            <div className="rounded-[calc(var(--radius)-8px)] border border-dashed border-border/70 bg-background/24 px-4 py-5 text-sm text-muted-foreground">
              Loading preview rows from the linked Data Node.
            </div>
          ) : linkedDataset.status === "error" ? (
            <div className="rounded-[calc(var(--radius)-8px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {linkedDataset.error ?? "The linked Data Node failed to load rows."}
            </div>
          ) : statisticResult.issue === "missing_value_field" ? (
            <div className="flex items-center gap-3 rounded-[calc(var(--radius)-8px)] border border-dashed border-border/70 bg-background/24 px-4 py-5 text-sm text-muted-foreground">
              <Calculator className="h-4 w-4 text-primary" />
              Select a value field to preview this statistic.
            </div>
          ) : statisticResult.issue === "non_numeric_value_field" ? (
            <div className="rounded-[calc(var(--radius)-8px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              The selected statistic needs a numeric field, but the current preview rows do not expose numeric values for that field.
            </div>
          ) : statisticResult.cards.length === 0 ? (
            <div className="rounded-[calc(var(--radius)-8px)] border border-dashed border-border/70 bg-background/24 px-4 py-5 text-sm text-muted-foreground">
              No statistic output is available for the current Data Node rows.
            </div>
          ) : (
            <StatisticCardGrid cards={statisticResult.cards} />
          )}
        </div>
      </section>
    </div>
  );
}
