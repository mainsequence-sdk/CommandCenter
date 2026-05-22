import { useMemo, useState } from "react";

import { Plus, Trash2 } from "lucide-react";

import { TabularMergeMappingEditor } from "@/widgets/shared/TabularMergeMappingEditor";
import type { TabularFrameFieldType } from "@/widgets/shared/tabular-frame-source";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  formatFieldListText,
  normalizeTabularTransformProps,
  parseFieldListText,
  resolveTabularTransformComputedColumns,
  resolveTabularTransformSourceConsumerState,
  type TabularAggregateMode,
  type TabularTransformComputedColumnConfig,
  type TabularTransformComputedColumnType,
  type TabularFilterOperator,
  type TabularFilterRule,
  type TabularTransformRowMergeMode,
  type TabularTransformMode,
  type TabularTransformWidgetProps,
} from "./tabularTransformModel";

type Props = WidgetSettingsComponentProps<TabularTransformWidgetProps>;

const FILTER_OPERATOR_OPTIONS: Array<{ value: TabularFilterOperator; label: string }> = [
  { value: "equals", label: "Equals" },
  { value: "not-equals", label: "Does not equal" },
  { value: "in", label: "In list" },
  { value: "not-in", label: "Not in list" },
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater than or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less than or equal" },
  { value: "is-empty", label: "Is empty" },
  { value: "is-not-empty", label: "Is not empty" },
];

const COMPUTED_COLUMN_TYPE_OPTIONS: Array<{
  value: TabularTransformComputedColumnType;
  label: string;
}> = [
  { value: "number", label: "Number" },
  { value: "string", label: "String" },
  { value: "boolean", label: "Boolean" },
  { value: "json", label: "JSON" },
];

const rowMergeHelp =
  "Maps retained transformed rows to incoming transformed rows. Use this when a live stream should patch existing rows by identity instead of passing every event through.";

function getKeyFieldsHelpText(mode: TabularTransformMode) {
  switch (mode) {
    case "aggregate":
      return "Group rows by these fields before reducing the other columns with the selected aggregate mode.";
    case "pivot":
      return "Keep one output row per key-field combination while the pivot field becomes output columns.";
    case "unpivot":
      return "Copy these fields into every generated long-form row.";
    default:
      return null;
  }
}

function operatorNeedsValue(operator: TabularFilterOperator | undefined) {
  return operator !== "is-empty" && operator !== "is-not-empty";
}

function operatorUsesListValue(operator: TabularFilterOperator | undefined) {
  return operator === "in" || operator === "not-in";
}

function normalizeFilterTextToken(token: string) {
  const normalized = token.trim();

  if (normalized === "") {
    return undefined;
  }

  if (normalized === "null") {
    return null;
  }

  return normalized;
}

function parseFilterScalarValue(rawValue: string, fieldType: TabularFrameFieldType | undefined) {
  const normalized = normalizeFilterTextToken(rawValue);

  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  if (fieldType === "number" || fieldType === "integer") {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : normalized;
  }

  if (fieldType === "boolean") {
    if (normalized.toLowerCase() === "true") {
      return true;
    }

    if (normalized.toLowerCase() === "false") {
      return false;
    }
  }

  if (fieldType === "datetime" || fieldType === "date" || fieldType === "time") {
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : normalized;
  }

  return normalized;
}

function parseFilterRuleValue(
  rawValue: string,
  operator: TabularFilterOperator | undefined,
  fieldType: TabularFrameFieldType | undefined,
) {
  if (!operatorNeedsValue(operator)) {
    return undefined;
  }

  if (operatorUsesListValue(operator)) {
    const values = rawValue
      .split(/[\n,]+/)
      .map((entry) => parseFilterScalarValue(entry, fieldType))
      .filter((entry) => entry !== undefined);

    return values.length > 0 ? values : undefined;
  }

  return parseFilterScalarValue(rawValue, fieldType);
}

function formatFilterRuleValue(value: TabularFilterRule["value"]) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry === null ? "null" : String(entry)))
      .join(", ");
  }

  if (value === null) {
    return "null";
  }

  return value === undefined ? "" : String(value);
}

function FieldListInput({
  disabled,
  label,
  value,
  onChange,
  placeholder,
}: {
  disabled: boolean;
  label: string;
  value: string[] | undefined;
  onChange: (value: string[] | undefined) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        value={formatFieldListText(value)}
        onChange={(event) => {
          const nextValue = parseFieldListText(event.target.value);
          onChange(nextValue.length > 0 ? nextValue : undefined);
        }}
        disabled={disabled}
        placeholder={placeholder ?? "field_a, field_b"}
        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function addUniqueFields(
  current: string[] | undefined,
  additions: string[],
) {
  const seen = new Set<string>();
  const next: string[] = [];

  [...(current ?? []), ...additions].forEach((entry) => {
    const normalized = entry.trim();

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    next.push(normalized);
  });

  return next.length > 0 ? next : undefined;
}

function TokenFieldListInput({
  disabled,
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string[] | undefined) => void;
  options: string[];
  placeholder?: string;
  value: string[] | undefined;
}) {
  const [draftValue, setDraftValue] = useState("");
  const selectedValues = value ?? [];
  const availableOptions = options.filter((option) => !selectedValues.includes(option));

  function commitDraft(rawValue: string) {
    const fields = parseFieldListText(rawValue);

    if (fields.length === 0) {
      setDraftValue("");
      return;
    }

    onChange(addUniqueFields(selectedValues, fields));
    setDraftValue("");
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="min-h-10 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-2 py-2 transition-colors focus-within:border-ring/70 focus-within:ring-2 focus-within:ring-ring/20">
        <div className="flex flex-wrap gap-2">
          {selectedValues.map((field) => (
            <span
              key={field}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/70 bg-background/70 px-2 py-1 text-xs text-foreground"
            >
              <span className="truncate">{field}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const nextValue = selectedValues.filter((entry) => entry !== field);
                  onChange(nextValue.length > 0 ? nextValue : undefined);
                }}
                className="rounded px-1 text-muted-foreground transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`Remove ${field}`}
              >
                x
              </button>
            </span>
          ))}
          <input
            value={draftValue}
            onChange={(event) => {
              const nextValue = event.target.value;

              if (/[\n,]/.test(nextValue)) {
                commitDraft(nextValue);
                return;
              }

              setDraftValue(nextValue);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Tab" || event.key === ",") {
                if (draftValue.trim()) {
                  event.preventDefault();
                  commitDraft(draftValue);
                }
              } else if (event.key === "Backspace" && !draftValue && selectedValues.length > 0) {
                event.preventDefault();
                const nextValue = selectedValues.slice(0, -1);
                onChange(nextValue.length > 0 ? nextValue : undefined);
              }
            }}
            onBlur={() => {
              if (draftValue.trim()) {
                commitDraft(draftValue);
              }
            }}
            disabled={disabled}
            placeholder={selectedValues.length === 0 ? placeholder ?? "Add field" : "Add field"}
            className="min-w-[11rem] flex-1 bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>
      {availableOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {availableOptions.slice(0, 24).map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                onChange(addUniqueFields(selectedValues, [option]));
              }}
              className="rounded-md border border-border/70 bg-background/35 px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TextInput({
  disabled,
  label,
  value,
  onChange,
  placeholder,
}: {
  disabled: boolean;
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        value={value ?? ""}
        onChange={(event) => {
          const nextValue = event.target.value.trim();
          onChange(nextValue || undefined);
        }}
        disabled={disabled}
        placeholder={placeholder}
        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function FieldSelect({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string | undefined) => void;
  options: Array<{ key: string; label: string }>;
  value: string | undefined;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => {
          const nextValue = event.target.value.trim();
          onChange(nextValue || undefined);
        }}
        disabled={disabled}
        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">Select field</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TabularTransformWidgetSettings({
  draftProps,
  editable,
  instanceId,
  onDraftPropsChange,
  resolvedInputs,
}: Props) {
  const props = normalizeTabularTransformProps(draftProps);
  const sourceConsumerState = resolveTabularTransformSourceConsumerState(
    resolvedInputs,
  );
  const sourceFrame = sourceConsumerState.dataset ?? sourceConsumerState.deltaDataset;
  const availableColumns = useMemo(
    () => sourceFrame?.columns ?? [],
    [sourceFrame?.columns],
  );
  const availableFields = useMemo(() => {
    const sourceFields = sourceFrame?.fields ?? [];

    if (sourceFields.length > 0) {
      return sourceFields.map((field) => ({
        key: field.key,
        label: field.label?.trim() || field.key,
        type: field.type,
      }));
    }

    return availableColumns.map((column) => ({
      key: column,
      label: column,
      type: undefined,
    }));
  }, [availableColumns, sourceFrame?.fields]);
  const fieldTypeByKey = useMemo(
    () =>
      new Map(
        availableFields.map((field) => [field.key, field.type] as const),
      ),
    [availableFields],
  );
  const filterRules = props.filterRules ?? [];
  const computedColumns = Array.isArray(draftProps.computedColumns)
    ? draftProps.computedColumns
    : props.computedColumns ?? [];
  const computedColumnErrors = useMemo(
    () => resolveTabularTransformComputedColumns(props).errorsByIndex,
    [props],
  );
  const keyFieldsHelpText = getKeyFieldsHelpText(props.transformMode);
  const projectableColumns = useMemo(
    () =>
      Array.from(new Set([
        ...availableColumns,
        ...computedColumns.flatMap((column) => (column.key ? [column.key] : [])),
      ])),
    [availableColumns, computedColumns],
  );
  const mergeFieldOptions = props.projectFields?.length ? props.projectFields : projectableColumns;
  const draftRowMergeKeyMappings = Array.isArray(draftProps.rowMergeKeyMappings)
    ? draftProps.rowMergeKeyMappings
    : undefined;
  const rowMergeKeyMappings =
    draftRowMergeKeyMappings ??
    (props.rowMergeKeyMappings?.length
      ? props.rowMergeKeyMappings
      : undefined) ??
    (props.rowMergeKeyFields ?? []).map((field) => ({
        seedField: field,
        liveField: field,
      }));

  function updateFilterRules(nextRules: TabularFilterRule[] | undefined) {
    onDraftPropsChange({
      ...draftProps,
      filterRules: nextRules && nextRules.length > 0 ? nextRules : undefined,
    });
  }

  function updateComputedColumns(nextColumns: TabularTransformComputedColumnConfig[] | undefined) {
    onDraftPropsChange({
      ...draftProps,
      computedColumns: nextColumns && nextColumns.length > 0 ? nextColumns : undefined,
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Source</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Bind this widget's source input to a tabular dataset in the Bindings tab.
          </p>
        </div>
        <div className="rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
          {sourceFrame
            ? `${sourceFrame.rows.length.toLocaleString()} rows across ${sourceFrame.columns.length.toLocaleString()} columns.`
            : "No compatible source dataset is currently resolved."}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Transform</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure the analytical transform that will publish a new dataset.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Mode</span>
            <select
              value={props.transformMode}
              onChange={(event) => {
                onDraftPropsChange({
                  ...draftProps,
                  transformMode: event.target.value as TabularTransformMode,
                });
              }}
              disabled={!editable}
              className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="none">None</option>
              <option value="filter">Filter</option>
              <option value="aggregate">Aggregate</option>
              <option value="pivot">Pivot</option>
              <option value="unpivot">Unpivot</option>
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Aggregate mode</span>
            <select
              value={props.aggregateMode}
              onChange={(event) => {
                onDraftPropsChange({
                  ...draftProps,
                  aggregateMode: event.target.value as TabularAggregateMode,
                });
              }}
              disabled={!editable || (props.transformMode !== "aggregate" && props.transformMode !== "pivot")}
              className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="first">First</option>
              <option value="last">Last</option>
              <option value="sum">Sum</option>
              <option value="mean">Mean</option>
              <option value="min">Min</option>
              <option value="max">Max</option>
            </select>
          </label>
        </div>
      </section>

      {props.transformMode === "filter" ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Filters</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Apply lightweight row predicates to the bound dataset before republishing it.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Combine rules</span>
              <select
                value={props.filterCombineMode}
                onChange={(event) => {
                  onDraftPropsChange({
                    ...draftProps,
                    filterCombineMode: event.target.value === "any" ? "any" : "all",
                  });
                }}
                disabled={!editable}
                className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="all">All rules</option>
                <option value="any">Any rule</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            {filterRules.length === 0 ? (
              <div className="rounded-[calc(var(--radius)-4px)] border border-dashed border-border/70 bg-background/25 px-3 py-3 text-xs text-muted-foreground">
                Add at least one rule. Available fields:{" "}
                {availableColumns.length > 0 ? availableColumns.join(", ") : "none resolved"}.
              </div>
            ) : null}

            {filterRules.map((rule, index) => {
              const fieldOptions = [...availableFields];

              if (
                rule.field &&
                !fieldOptions.some((field) => field.key === rule.field)
              ) {
                fieldOptions.unshift({
                  key: rule.field,
                  label: `${rule.field} (saved)`,
                  type: undefined,
                });
              }

              const fieldType = rule.field ? fieldTypeByKey.get(rule.field) : undefined;

              return (
                <div
                  key={`filter-rule:${index}`}
                  className="space-y-3 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/25 p-3"
                >
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_auto]">
                    <FieldSelect
                      label="Field"
                      value={rule.field}
                      disabled={!editable}
                      options={fieldOptions}
                      onChange={(field) => {
                        const nextRules = [...filterRules];
                        nextRules[index] = {
                          ...rule,
                          field,
                        };
                        updateFilterRules(nextRules);
                      }}
                    />
                    <label className="block space-y-2">
                      <span className="text-xs font-medium text-muted-foreground">Operator</span>
                      <select
                        value={rule.operator ?? ""}
                        onChange={(event) => {
                          const nextOperator =
                            (event.target.value as TabularFilterOperator | "") || undefined;
                          const nextRules = [...filterRules];
                          nextRules[index] = {
                            ...rule,
                            operator: nextOperator,
                            value: operatorNeedsValue(nextOperator) ? rule.value : undefined,
                          };
                          updateFilterRules(nextRules);
                        }}
                        disabled={!editable}
                        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">Select operator</option>
                        {FILTER_OPERATOR_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          updateFilterRules(filterRules.filter((_, ruleIndex) => ruleIndex !== index));
                        }}
                        disabled={!editable}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>

                  {operatorNeedsValue(rule.operator) ? (
                    <label className="block space-y-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {operatorUsesListValue(rule.operator) ? "Values" : "Value"}
                      </span>
                      <input
                        value={formatFilterRuleValue(rule.value)}
                        onChange={(event) => {
                          const nextRules = [...filterRules];
                          nextRules[index] = {
                            ...rule,
                            value: parseFilterRuleValue(
                              event.target.value,
                              rule.operator,
                              fieldType,
                            ),
                          };
                          updateFilterRules(nextRules);
                        }}
                        disabled={!editable}
                        placeholder={
                          operatorUsesListValue(rule.operator)
                            ? "value_a, value_b"
                            : fieldType === "boolean"
                              ? "true"
                              : "value"
                        }
                        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>
                  ) : null}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              updateFilterRules([
                ...filterRules,
                {
                  operator: "equals",
                },
              ]);
            }}
            disabled={!editable}
            className="inline-flex h-10 items-center gap-2 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add rule
          </button>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Fields</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Available source fields:{" "}
            {availableColumns.length > 0 ? availableColumns.join(", ") : "none resolved"}.{" "}
            Mode-specific field inputs appear only when the selected transform uses them.
          </p>
        </div>
        {keyFieldsHelpText ? (
          <div className="space-y-2">
            <FieldListInput
              label="Key fields"
              value={props.keyFields}
              disabled={!editable}
              onChange={(keyFields) => {
                onDraftPropsChange({ ...draftProps, keyFields });
              }}
            />
            <p className="text-[11px] text-muted-foreground">{keyFieldsHelpText}</p>
          </div>
        ) : null}
        {props.transformMode === "pivot" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label="Pivot field"
              value={props.pivotField}
              disabled={!editable}
              onChange={(pivotField) => {
                onDraftPropsChange({ ...draftProps, pivotField });
              }}
            />
            <TextInput
              label="Value field"
              value={props.pivotValueField}
              disabled={!editable}
              onChange={(pivotValueField) => {
                onDraftPropsChange({ ...draftProps, pivotValueField });
              }}
            />
          </div>
        ) : null}
        {props.transformMode === "unpivot" ? (
          <>
            <FieldListInput
              label="Value columns"
              value={props.unpivotValueFields}
              disabled={!editable}
              onChange={(unpivotValueFields) => {
                onDraftPropsChange({ ...draftProps, unpivotValueFields });
              }}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <TextInput
                label="Series field"
                value={props.unpivotFieldName}
                disabled={!editable}
                onChange={(unpivotFieldName) => {
                  onDraftPropsChange({ ...draftProps, unpivotFieldName });
                }}
                placeholder="series"
              />
              <TextInput
                label="Value field"
                value={props.unpivotValueFieldName}
                disabled={!editable}
                onChange={(unpivotValueFieldName) => {
                  onDraftPropsChange({ ...draftProps, unpivotValueFieldName });
                }}
                placeholder="value"
              />
            </div>
          </>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Computed columns</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Add reusable derived columns to the published dataset. Formulas run after the selected
            transform and before projection. Wrap field names in brackets, for example{" "}
            <code>[last_price] * 10</code> or{" "}
            <code>PERCENT_CHANGE([last_price], [previous_close])</code>.
          </p>
        </div>

        {computedColumns.length === 0 ? (
          <div className="rounded-[calc(var(--radius)-4px)] border border-dashed border-border/70 bg-background/25 px-3 py-3 text-xs text-muted-foreground">
            No computed columns yet. Use this section when the transformed dataset should publish
            derived fields for downstream widgets.
          </div>
        ) : null}

        <div className="space-y-3">
          {computedColumns.map((column, index) => {
            const error = computedColumnErrors.get(index);

            return (
              <div
                key={`computed-column:${index}`}
                className="space-y-3 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/25 p-3"
              >
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,160px)_auto]">
                  <TextInput
                    label="Column key"
                    value={column.key}
                    disabled={!editable}
                    onChange={(key) => {
                      const nextColumns = [...computedColumns];
                      nextColumns[index] = {
                        ...column,
                        key,
                      };
                      updateComputedColumns(nextColumns);
                    }}
                    placeholder="one_day_return"
                  />
                  <TextInput
                    label="Label"
                    value={column.label}
                    disabled={!editable}
                    onChange={(label) => {
                      const nextColumns = [...computedColumns];
                      nextColumns[index] = {
                        ...column,
                        label,
                      };
                      updateComputedColumns(nextColumns);
                    }}
                    placeholder="1D"
                  />
                  <label className="block space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">Result type</span>
                    <select
                      value={column.type ?? "number"}
                      onChange={(event) => {
                        const nextColumns = [...computedColumns];
                        nextColumns[index] = {
                          ...column,
                          type: event.target.value as TabularTransformComputedColumnType,
                        };
                        updateComputedColumns(nextColumns);
                      }}
                      disabled={!editable}
                      className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {COMPUTED_COLUMN_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        updateComputedColumns(
                          computedColumns.filter((_, columnIndex) => columnIndex !== index),
                        );
                      }}
                      disabled={!editable}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Formula</span>
                  <input
                    value={column.formulaExpression ?? ""}
                    onChange={(event) => {
                      const nextColumns = [...computedColumns];
                      nextColumns[index] = {
                        ...column,
                        formulaExpression: event.target.value,
                      };
                      updateComputedColumns(nextColumns);
                    }}
                    disabled={!editable}
                    placeholder="[last_price] * 10"
                    className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <p className="text-[11px] text-muted-foreground">
                  Available upstream fields: {availableColumns.length > 0 ? availableColumns.join(", ") : "none resolved"}.
                </p>
                {error ? <p className="text-[11px] text-danger">{error}</p> : null}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            updateComputedColumns([
              ...computedColumns,
              {
                type: "number",
              },
            ]);
          }}
          disabled={!editable}
          className="inline-flex h-10 items-center gap-2 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Add computed column
        </button>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Projection</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Keep only the columns that downstream widgets should receive. Computed columns can be
            projected by key after you add them above. Available fields:{" "}
            {projectableColumns.length > 0 ? projectableColumns.join(", ") : "none resolved"}.
          </p>
        </div>
        <TokenFieldListInput
          label="Project columns"
          value={props.projectFields}
          disabled={!editable}
          options={projectableColumns}
          placeholder="symbol, last"
          onChange={(projectFields) => {
            onDraftPropsChange({ ...draftProps, projectFields });
          }}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Row merge</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose whether this transform passes the transformed frame through unchanged or acts as
            a latest-row gate that collapses repeated rows by identity. Use latest-by-key for live
            feeds such as one current price per symbol.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Merge mode</span>
            <select
              value={props.rowMergeMode}
              onChange={(event) => {
                const rowMergeMode = event.target.value as TabularTransformRowMergeMode;
                onDraftPropsChange({
                  ...draftProps,
                  rowMergeMode,
                  rowMergeKeyMappings:
                    rowMergeMode === "latest" ? draftRowMergeKeyMappings ?? props.rowMergeKeyMappings : undefined,
                  rowMergeKeyFields:
                    rowMergeMode === "latest" ? props.rowMergeKeyFields : undefined,
                });
              }}
              disabled={!editable}
              className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="passthrough">Passthrough</option>
              <option value="latest">Latest row per key</option>
            </select>
          </label>
        </div>

        {props.rowMergeMode === "latest" ? (
          <TabularMergeMappingEditor
            title="Latest row mapping"
            description="Tell the transform which incoming rows update which retained transformed rows. If all mapped values match, the incoming row patches that retained row; otherwise the row passes through as a separate row."
            emptyDescription="Add one mapping for a single-row identity, for example retained field `symbol` and incoming field `symbol`. Add multiple mappings when identity needs more than one field."
            editable={editable}
            help={rowMergeHelp}
            idBase={`tabular-transform-row-merge-${instanceId ?? "draft"}`}
            liveFieldLabel="Incoming field"
            liveFieldOptions={mergeFieldOptions}
            mappings={rowMergeKeyMappings}
            onChange={(rowMergeKeyMappings) => {
              onDraftPropsChange({
                ...draftProps,
                rowMergeKeyMappings,
                rowMergeKeyFields:
                  rowMergeKeyMappings.length > 0
                    ? rowMergeKeyMappings.map((mapping) => mapping.seedField).filter(Boolean)
                    : undefined,
              });
            }}
            seedFieldLabel="Retained field"
            seedFieldOptions={mergeFieldOptions}
            showNoSharedFieldSuggestion={false}
          />
        ) : (
          <div className="rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/25 px-3 py-3 text-xs text-muted-foreground">
            Passthrough mode does not add row-merge semantics. The transform publishes whatever the
            upstream tabular source currently provides after the selected transform, computed
            columns, and projection have run.
          </div>
        )}
      </section>
    </div>
  );
}
