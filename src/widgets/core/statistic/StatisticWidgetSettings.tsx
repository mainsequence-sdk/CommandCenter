import { useMemo } from "react";

import { Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PickerField } from "@/widgets/shared/picker-field";
import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
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
  buildStatisticCards,
  buildStatisticFieldOptions,
  createStatisticRangeRuleId,
  normalizeStatisticProps,
  resolveStatisticConfig,
  resolveStatisticValueFieldPickerOptions,
  type StatisticColorMode,
  type StatisticMode,
  type StatisticOperator,
  type StatisticTone,
  type StatisticWidgetProps,
} from "./statisticModel";
import { resolveStatisticSourceDataset } from "./statisticPreview";
import { TabularFieldSchemaInspector } from "@/widgets/shared/tabular-field-schema-inspector";
import { useResolvedTabularWidgetSourceBinding } from "@/widgets/shared/tabular-widget-source";

const sectionClass = widgetTightFormSectionClass;
const insetSectionClass = widgetTightFormInsetSectionClass;
const fieldClass = widgetTightFormFieldClass;
const labelClass = widgetTightFormLabelClass;
const titleClass = widgetTightFormTitleClass;
const descriptionClass = widgetTightFormDescriptionClass;

const statisticModeOptions: Array<{
  value: StatisticMode;
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

const colorModeOptions: Array<{
  value: StatisticColorMode;
  label: string;
  description: string;
}> = [
  {
    value: "none",
    label: "No color formatting",
    description: "Render the statistic card with the default theme surface.",
  },
  {
    value: "range-rules",
    label: "Range rules",
    description: "Color the card when the resolved statistic matches a threshold like > 0 or < -5.",
  },
  {
    value: "change-from-last",
    label: "Change from last observation",
    description: "Color the card by whether the latest numeric observation moved up, down, or stayed flat.",
  },
];

const statisticOperatorOptions: Array<{
  value: StatisticOperator;
  label: string;
}> = [
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
];

const statisticToneOptions: Array<{
  value: StatisticTone;
  label: string;
}> = [
  { value: "neutral", label: "Neutral" },
  { value: "primary", label: "Primary" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "danger", label: "Danger" },
];

const sourceLabelDisplayOptions = [
  {
    value: "hidden",
    label: "Hidden",
    description: "Do not render the source widget label on the statistic card.",
  },
  {
    value: "visible",
    label: "Show source label",
    description: "Render the bound dataset title in the lower-left corner of each card.",
  },
];

export function StatisticWidgetSettings({
  draftProps,
  editable,
  instanceId,
  onDraftPropsChange,
  resolvedInputs,
}: WidgetSettingsComponentProps<StatisticWidgetProps>) {
  const previewDataset = useMemo(
    () => resolveStatisticSourceDataset(resolvedInputs),
    [resolvedInputs],
  );
  const sourceBinding = useResolvedTabularWidgetSourceBinding({
    props: draftProps,
    currentWidgetInstanceId: instanceId,
  });
  useResolveWidgetUpstream(instanceId, {
    enabled: previewDataset == null && sourceBinding.requiresUpstreamResolution,
  });
  const linkedDataset = previewDataset ?? sourceBinding.resolvedSourceDataset;
  const availableFields = useMemo(
    () =>
      buildStatisticFieldOptions({
        columns: linkedDataset?.columns,
        fields: linkedDataset?.fields,
        rows: linkedDataset?.rows,
      }),
    [linkedDataset?.columns, linkedDataset?.fields, linkedDataset?.rows],
  );
  const resolvedDraft = useMemo(
    () => normalizeStatisticProps(draftProps, availableFields),
    [availableFields, draftProps],
  );
  const resolvedConfig = useMemo(
    () => resolveStatisticConfig(resolvedDraft, availableFields),
    [availableFields, resolvedDraft],
  );
  const statisticResult = useMemo(
    () => buildStatisticCards(linkedDataset?.rows ?? [], resolvedConfig),
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
        description: "Render one statistic tile for the whole tabular dataset.",
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
        description: "Keep the upstream tabular source row order for first/last and sparkline shape.",
      },
      ...fieldOptions,
    ],
    [fieldOptions],
  );
  const colorMode = resolvedDraft.colorMode ?? "none";
  const rangeRules = resolvedDraft.rangeRules ?? [];
  const changeStyles = resolvedDraft.changeStyles ?? {};
  const sourceLabel =
    previewDataset?.source?.label?.trim() ||
    sourceBinding.resolvedSourceWidget?.title?.trim() ||
    undefined;

  return (
    <div className="space-y-3">
      <section className={sectionClass}>
        <div className="space-y-1">
          <div className={titleClass}>Statistic source</div>
          <p className={descriptionClass}>
            This widget consumes the published table-shaped dataset from a tabular source and reduces it into one or more statistic tiles.
          </p>
        </div>

        <div className={fieldClass}>
          <label className={labelClass}>Source binding</label>
          <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
            {previewDataset ? (
              <>
                <div className="font-medium text-foreground">
                  {previewDataset.source?.label?.trim() || "Demo source dataset"}
                </div>
                <div className="mt-1">
                  Preview-only demo bundle for the shared panel preview and demo settings mode.
                </div>
              </>
            ) : sourceBinding.resolvedSourceWidget ? (
              <>
                <div className="font-medium text-foreground">
                  {sourceBinding.resolvedSourceWidget.title?.trim() || "Bound source widget"}
                </div>
                <div className="mt-1">
                  This statistic is consuming the published dataset from the selected source widget.
                </div>
              </>
            ) : (
              "Use the Bindings tab to connect this statistic to a source widget in the dashboard."
            )}
          </div>
        </div>
      </section>

      <TabularFieldSchemaInspector
        title="Resolved source schema"
        description="Inspect the field schema this statistic resolves before it reduces the incoming dataset into cards."
        fields={availableFields}
        rows={linkedDataset?.rows ?? []}
        emptyMessage="Bind this statistic to a tabular source to inspect its source schema."
      />

      <section className={sectionClass}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className={fieldClass}>
            <label className={labelClass}>Statistic</label>
            <PickerField
              value={resolvedDraft.statisticMode ?? "last"}
              onChange={(value) => {
                onDraftPropsChange({
                  ...draftProps,
                  statisticMode: value as StatisticMode,
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
                  : "Bind a tabular source first"
              }
              emptyMessage="No source fields are available yet."
              disabled={!editable || fieldOptions.length === 0}
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass}>Value display label</label>
            <Input
              value={resolvedDraft.valueFieldLabel ?? ""}
              onChange={(event) => {
                onDraftPropsChange({
                  ...draftProps,
                  valueFieldLabel: event.target.value || undefined,
                });
              }}
              placeholder={
                resolvedDraft.valueField
                  ? "Use source field label"
                  : "Select a value field first"
              }
              className="h-8 text-xs"
              disabled={!editable || resolvedDraft.statisticMode === "count"}
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
            <label className={labelClass}>Source label</label>
            <PickerField
              value={resolvedDraft.showSourceLabel ? "visible" : "hidden"}
              onChange={(value) => {
                onDraftPropsChange({
                  ...draftProps,
                  showSourceLabel: value === "visible",
                });
              }}
              options={sourceLabelDisplayOptions}
              placeholder="Hidden"
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
          `Last` and `First` use the selected order field when present. If no order field is selected, the statistic uses the published row order from the tabular source.
        </div>
      </section>

      <section className={sectionClass}>
        <div className="space-y-1">
          <div className={titleClass}>Color formatting</div>
          <p className={descriptionClass}>
            Tint the statistic card by threshold rules or by the move between the latest two numeric observations.
          </p>
        </div>

        <div className={fieldClass}>
          <label className={labelClass}>Mode</label>
          <PickerField
            value={colorMode}
            onChange={(value) => {
              onDraftPropsChange({
                ...draftProps,
                colorMode: value as StatisticColorMode,
              });
            }}
            options={colorModeOptions}
            placeholder="Select color mode"
            disabled={!editable}
          />
        </div>

        {colorMode === "range-rules" ? (
          <div className="space-y-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-foreground">Range rules</div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!editable}
                onClick={() => {
                  onDraftPropsChange({
                    ...draftProps,
                    rangeRules: [
                      ...rangeRules,
                      {
                        id: createStatisticRangeRuleId(),
                        operator: "gt",
                        value: 0,
                        tone: "primary",
                      },
                    ],
                  });
                }}
              >
                Add rule
              </Button>
            </div>

            {rangeRules.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Add threshold rules like `&gt; 0` or `&lt; -5` to color the statistic card.
              </div>
            ) : (
              <div className="space-y-3">
                {rangeRules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className="grid gap-3 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/36 px-3 py-3 md:grid-cols-[110px_minmax(0,1fr)_160px_auto]"
                  >
                    <div className={fieldClass}>
                      <label className={labelClass}>Operator</label>
                      <Select
                        value={rule.operator}
                        disabled={!editable}
                        onChange={(event) => {
                          const nextRules = [...rangeRules];
                          nextRules[index] = {
                            ...rule,
                            operator: event.target.value as StatisticOperator,
                          };
                          onDraftPropsChange({
                            ...draftProps,
                            rangeRules: nextRules,
                          });
                        }}
                        className="h-8 text-xs"
                      >
                        {statisticOperatorOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className={fieldClass}>
                      <label className={labelClass}>Value</label>
                      <Input
                        type="number"
                        step="any"
                        value={rule.value}
                        disabled={!editable}
                        onChange={(event) => {
                          const nextRules = [...rangeRules];
                          nextRules[index] = {
                            ...rule,
                            value: Number(event.target.value),
                          };
                          onDraftPropsChange({
                            ...draftProps,
                            rangeRules: nextRules,
                          });
                        }}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className={fieldClass}>
                      <label className={labelClass}>Tone</label>
                      <Select
                        value={rule.tone ?? "primary"}
                        disabled={!editable}
                        onChange={(event) => {
                          const nextRules = [...rangeRules];
                          nextRules[index] = {
                            ...rule,
                            tone: event.target.value as StatisticTone,
                          };
                          onDraftPropsChange({
                            ...draftProps,
                            rangeRules: nextRules,
                          });
                        }}
                        className="h-8 text-xs"
                      >
                        {statisticToneOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!editable}
                        onClick={() => {
                          onDraftPropsChange({
                            ...draftProps,
                            rangeRules: rangeRules.filter((currentRule) => currentRule.id !== rule.id),
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {colorMode === "change-from-last" ? (
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { key: "positive", label: "Up move", fallbackTone: "success" },
              { key: "negative", label: "Down move", fallbackTone: "danger" },
              { key: "neutral", label: "Flat move", fallbackTone: "neutral" },
            ].map((entry) => (
              <div key={entry.key} className={fieldClass}>
                <label className={labelClass}>{entry.label}</label>
                <Select
                  value={
                    (changeStyles[entry.key as keyof typeof changeStyles]?.tone as StatisticTone | undefined) ??
                    (entry.fallbackTone as StatisticTone)
                  }
                  disabled={!editable}
                  onChange={(event) => {
                    onDraftPropsChange({
                      ...draftProps,
                      changeStyles: {
                        ...changeStyles,
                        [entry.key]: {
                          ...(changeStyles[entry.key as keyof typeof changeStyles] ?? {}),
                          tone: event.target.value as StatisticTone,
                        },
                      },
                    });
                  }}
                  className="h-8 text-xs"
                >
                  {statisticToneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        ) : null}

        {colorMode === "change-from-last" ? (
          <div className={descriptionClass}>
            Change-from-last compares the latest two numeric observations from the selected value field,
            using the order field when present or the published row order otherwise.
          </div>
        ) : null}
      </section>

    </div>
  );
}
