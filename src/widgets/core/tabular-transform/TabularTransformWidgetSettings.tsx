import { useMemo } from "react";

import { normalizeTabularFrameSource } from "@/widgets/shared/tabular-frame-source";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  TABULAR_TRANSFORM_SOURCE_INPUT_ID,
  formatFieldListText,
  normalizeTabularTransformProps,
  parseFieldListText,
  type TabularAggregateMode,
  type TabularTransformMode,
  type TabularTransformWidgetProps,
} from "./tabularTransformModel";

type Props = WidgetSettingsComponentProps<TabularTransformWidgetProps>;

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

export function TabularTransformWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
  resolvedInputs,
}: Props) {
  const props = normalizeTabularTransformProps(draftProps);
  const sourceInput = resolvedInputs?.[TABULAR_TRANSFORM_SOURCE_INPUT_ID];
  const sourceEntry = Array.isArray(sourceInput)
    ? sourceInput.find((entry) => entry.status === "valid")
    : sourceInput;
  const sourceFrame = normalizeTabularFrameSource(
    sourceEntry?.upstreamBase ?? sourceEntry?.value,
  );
  const availableColumns = useMemo(
    () => sourceFrame?.columns ?? [],
    [sourceFrame?.columns],
  );

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
              disabled={!editable}
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

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Fields</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Use comma-separated field keys. Available fields:{" "}
            {availableColumns.length > 0 ? availableColumns.join(", ") : "none resolved"}.
          </p>
        </div>
        <FieldListInput
          label="Key fields"
          value={props.keyFields}
          disabled={!editable}
          onChange={(keyFields) => {
            onDraftPropsChange({ ...draftProps, keyFields });
          }}
        />
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
        <FieldListInput
          label="Project columns"
          value={props.projectFields}
          disabled={!editable}
          onChange={(projectFields) => {
            onDraftPropsChange({ ...draftProps, projectFields });
          }}
        />
      </section>
    </div>
  );
}
