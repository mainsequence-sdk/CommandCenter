import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PickerField } from "@/widgets/shared/picker-field";
import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import { useTheme } from "@/themes/ThemeProvider";
import {
  widgetTightFormButtonGroupClass,
  widgetTightFormColorInputClass,
  widgetTightFormDescriptionClass,
  widgetTightFormFieldClass,
  widgetTightFormInputClass,
  widgetTightFormInsetSectionClass,
  widgetTightFormLabelClass,
  widgetTightFormSectionClass,
  widgetTightFormSelectClass,
  widgetTightFormTitleClass,
} from "@/widgets/shared/form-density";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import { TabularFieldSchemaInspector } from "@/widgets/shared/tabular-field-schema-inspector";
import {
  isEmptyTabularFrameSource,
  normalizeManualTableColumns,
  normalizeManualTableRows,
  useResolvedTabularWidgetSourceBinding,
} from "@/widgets/shared/tabular-widget-source";
import { ManualTableEditor } from "./ManualTableEditor";
import {
  buildTableWidgetFrameFromRemoteData,
  buildTableWidgetFrameFromManualData,
  buildTableWidgetRowObjects,
  cloneTableWidgetSchema,
  createTableWidgetRuleId,
  getTableWidgetCategoricalValues,
  resolveTableWidgetColumns,
  resolveTableWidgetProps,
  resolveTableWidgetPropsWithFrame,
  resolveTableWidgetSourceDataset,
  validateTableWidgetSchema,
  tableWidgetAlignOptions,
  tableWidgetBarModeOptions,
  tableWidgetDefaultProps,
  tableWidgetDensityOptions,
  tableWidgetFormatOptions,
  tableWidgetGaugeModeOptions,
  tableWidgetGradientModeOptions,
  tableWidgetHeatmapPaletteOptions,
  tableWidgetOperatorOptions,
  tableWidgetPinnedOptions,
  tableWidgetRangeModeOptions,
  tableWidgetToneOptions,
  type TableWidgetColumnSchema,
  type TableWidgetColumnOverride,
  type TableWidgetConditionalRule,
  type TableWidgetProps,
  type TableWidgetSchemaValidationIssue,
  type TableWidgetTone,
  type TableWidgetValueLabel,
} from "./tableModel";

const sectionClass = widgetTightFormSectionClass;
const insetSectionClass = widgetTightFormInsetSectionClass;
const fieldClass = widgetTightFormFieldClass;
const labelClass = widgetTightFormLabelClass;
const titleClass = widgetTightFormTitleClass;
const descriptionClass = widgetTightFormDescriptionClass;
const inputClass = widgetTightFormInputClass;
const selectClass = widgetTightFormSelectClass;
const colorInputClass = widgetTightFormColorInputClass;
const hexColorPattern = /^#(?:[0-9a-fA-F]{6})$/;
const tableFieldHelp = {
  density: "Controls row and cell spacing in the rendered table.",
  tableSourceMode: "Selects whether this table formats a bound dataset or renders manually authored rows stored on this table widget.",
  sourceBinding: "Shows the upstream Connection Query or Tabular Transform widget bound to this table. The binding supplies a canonical tabular or time-series dataset; this widget only formats it.",
  pageSize: "Sets how many rows AG Grid shows per page when pagination is enabled.",
  surfaceToggles: "Turns optional table surface features on or off without changing the upstream dataset.",
  columnKey: "Maps this table column to an incoming field key from the bound dataset frame.",
  columnLabel: "Overrides the header text shown for this column.",
  columnFormat: "Controls how values are parsed and displayed. Text enables value chips; numeric formats enable decimals, compact numbers, heatmaps, data bars, gauges, and thresholds.",
  columnDescription: "Optional header tooltip text for this table column.",
  align: "Controls horizontal cell alignment. Auto chooses a default from the current column format.",
  pin: "Keeps the column fixed on the left or right side while the table scrolls horizontally.",
  decimals: "Overrides numeric precision for Number, Currency, Percent, and Bps columns. Leave blank for the inferred default.",
  prefix: "Adds static text before the formatted value, for example $, USD, or approximately.",
  suffix: "Adds static text after the formatted value, for example %, bps, kg, or units.",
  compactNumbers: "Displays large numeric values in compact notation such as 1.2K or 4.5M.",
  dataBar: "Draws an inline filled bar behind numeric values using the configured numeric bounds.",
  heatmap: "Tints the full numeric cell background by normalized value intensity.",
  heatmapPalette: "Selects the color ramp used by the heatmap. Auto uses a diverging ramp for mixed-sign columns and Viridis otherwise.",
  gauge: "Adds an inline ring gauge for numeric values using the configured numeric bounds.",
  numericBounds: "Controls the min and max used to normalize heatmaps, data bars, and gauges. Auto derives bounds from current rows; Fixed uses saved min and max values.",
  minBound: "Saved lower bound used when Numeric bounds is set to Fixed.",
  maxBound: "Saved upper bound used when Numeric bounds is set to Fixed.",
  mappingColumn: "Text-formatted column where raw values should be converted into chips.",
  mappingValue: "Raw source value that triggers this value mapping.",
  mappingLabel: "Chip text shown instead of the raw value.",
  tone: "Theme-aware semantic color used for the chip or threshold match.",
  textColor: "Optional custom text color. Leave the theme color unless a specific override is required.",
  fillColor: "Optional custom fill color. Leave the theme color unless a specific override is required.",
  thresholdColumn: "Numeric-formatted column evaluated by this threshold rule.",
  thresholdOperator: "Comparison used to match numeric cell values.",
  thresholdValue: "Numeric value compared against each cell.",
} satisfies Record<string, string>;
function toColorInputValue(value: string | undefined, fallback: string) {
  if (value && hexColorPattern.test(value.trim())) {
    return value.trim().toLowerCase();
  }

  return fallback;
}

function normalizeColor(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return hexColorPattern.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

function normalizeColumnOverride(override: TableWidgetColumnOverride) {
  const nextValue: TableWidgetColumnOverride = {};

  if (typeof override.visible === "boolean") {
    nextValue.visible = override.visible;
  }

  if (typeof override.label === "string" && override.label.trim()) {
    nextValue.label = override.label.trim();
  }

  if (override.format) {
    nextValue.format = override.format;
  }

  if (typeof override.decimals === "number" && Number.isFinite(override.decimals)) {
    nextValue.decimals = Math.max(0, Math.min(Math.trunc(override.decimals), 6));
  }

  if (typeof override.prefix === "string" && override.prefix.length > 0) {
    nextValue.prefix = override.prefix;
  }

  if (typeof override.suffix === "string" && override.suffix.length > 0) {
    nextValue.suffix = override.suffix;
  }

  if (typeof override.heatmap === "boolean") {
    nextValue.heatmap = override.heatmap;
  }

  if (typeof override.compact === "boolean") {
    nextValue.compact = override.compact;
  }

  if (override.barMode) {
    nextValue.barMode = override.barMode;
  }

  if (override.gradientMode) {
    nextValue.gradientMode = override.gradientMode;
  }

  if (override.heatmapPalette) {
    nextValue.heatmapPalette = override.heatmapPalette;
  }

  if (override.gaugeMode) {
    nextValue.gaugeMode = override.gaugeMode;
  }

  if (override.visualRangeMode) {
    nextValue.visualRangeMode = override.visualRangeMode;
  }

  if (typeof override.visualMin === "number" && Number.isFinite(override.visualMin)) {
    nextValue.visualMin = override.visualMin;
  }

  if (typeof override.visualMax === "number" && Number.isFinite(override.visualMax)) {
    nextValue.visualMax = override.visualMax;
  }

  if (override.align) {
    nextValue.align = override.align;
  }

  if (override.pinned) {
    nextValue.pinned = override.pinned;
  }

  return Object.keys(nextValue).length > 0 ? nextValue : undefined;
}

function normalizeValueLabel(entry: TableWidgetValueLabel) {
  return {
    ...entry,
    columnKey: entry.columnKey.trim(),
    value: entry.value,
    label: entry.label?.trim() || undefined,
    tone:
      entry.tone === "neutral" ||
      entry.tone === "primary" ||
      entry.tone === "success" ||
      entry.tone === "warning" ||
      entry.tone === "danger"
        ? entry.tone
        : undefined,
    textColor: normalizeColor(entry.textColor),
    backgroundColor: normalizeColor(entry.backgroundColor),
  } satisfies TableWidgetValueLabel;
}

function normalizeConditionalRule(entry: TableWidgetConditionalRule) {
  return {
    ...entry,
    id: entry.id.trim() || createTableWidgetRuleId(),
    columnKey: entry.columnKey.trim(),
    value: Number.isFinite(entry.value) ? entry.value : 0,
    tone:
      entry.tone === "neutral" ||
      entry.tone === "primary" ||
      entry.tone === "success" ||
      entry.tone === "warning" ||
      entry.tone === "danger"
        ? entry.tone
        : undefined,
    textColor: normalizeColor(entry.textColor),
    backgroundColor: normalizeColor(entry.backgroundColor),
  } satisfies TableWidgetConditionalRule;
}

function normalizeTone(value: string): TableWidgetTone | undefined {
  return value === "neutral" ||
    value === "primary" ||
    value === "success" ||
    value === "warning" ||
    value === "danger"
    ? value
    : undefined;
}

function formatSchemaValidationIssue(issue: TableWidgetSchemaValidationIssue) {
  if (issue.code === "empty_schema") {
    return "No schema fields are configured for this widget instance.";
  }

  if (issue.code === "missing_columns") {
    return `Configured fields not found in the current data rows: ${(issue.columnKeys ?? []).join(", ")}`;
  }

  return `Fields formatted as numeric but backed by non-numeric data: ${(issue.columnKeys ?? []).join(", ")}`;
}

function stripLegacyTableSourceFields(
  value: TableWidgetProps,
): TableWidgetProps {
  const nextValue = {
    ...value,
  } as TableWidgetProps & {
    columns?: unknown;
    rows?: unknown;
    datasetId?: unknown;
    sourceMode?: unknown;
  };

  delete nextValue.columns;
  delete nextValue.rows;
  delete nextValue.datasetId;
  return nextValue;
}

export function TableWidgetSettings({
  draftProps,
  editable,
  instanceId,
  onDraftPropsChange,
  resolvedInputs,
}: WidgetSettingsComponentProps<TableWidgetProps>) {
  const { resolvedTokens } = useTheme();
  const resolvedDraft = resolveTableWidgetProps(draftProps);
  const isManualTableMode = resolvedDraft.tableSourceMode === "manual";
  const sourceBindingProps = useMemo(
    () => ({
      sourceMode: resolvedDraft.sourceMode,
      sourceWidgetId: resolvedDraft.sourceWidgetId,
      sourceId: resolvedDraft.sourceId,
      dateRangeMode: resolvedDraft.dateRangeMode,
      fixedStartMs: resolvedDraft.fixedStartMs,
      fixedEndMs: resolvedDraft.fixedEndMs,
      uniqueIdentifierList: resolvedDraft.uniqueIdentifierList,
    }),
    [
      resolvedDraft.sourceId,
      resolvedDraft.dateRangeMode,
      resolvedDraft.fixedEndMs,
      resolvedDraft.fixedStartMs,
      resolvedDraft.sourceMode,
      resolvedDraft.sourceWidgetId,
      resolvedDraft.uniqueIdentifierList,
    ],
  );
  const sourceBinding = useResolvedTabularWidgetSourceBinding({
    props: sourceBindingProps,
    currentWidgetInstanceId: instanceId,
  });
  const resolvedInputDataset = useMemo(
    () => resolveTableWidgetSourceDataset(resolvedInputs),
    [resolvedInputs],
  );
  const hasResolvedInputDataset = Boolean(
    resolvedInputDataset && !isEmptyTabularFrameSource(resolvedInputDataset),
  );
  useResolveWidgetUpstream(instanceId, {
    enabled:
      !isManualTableMode &&
      !hasResolvedInputDataset &&
      sourceBinding.requiresUpstreamResolution,
  });
  const linkedDataset = hasResolvedInputDataset
    ? resolvedInputDataset
    : sourceBinding.resolvedSourceDataset ?? resolvedInputDataset;
  const hasRenderableLinkedDataset = Boolean(
    linkedDataset && !isEmptyTabularFrameSource(linkedDataset),
  );
  const frameColumnsSource = linkedDataset?.columns ?? [];
  const frameRowsSource = linkedDataset?.rows ?? [];

  const remoteFrameInput = useMemo(
    () =>
      buildTableWidgetFrameFromRemoteData(
        null,
        frameRowsSource,
        frameColumnsSource,
        linkedDataset?.fields ?? [],
      ),
    [frameColumnsSource, frameRowsSource, linkedDataset?.fields],
  );
  const scopedDraft = useMemo(
    () => stripLegacyTableSourceFields(draftProps),
    [draftProps],
  );
  const manualColumns = useMemo(
    () => normalizeManualTableColumns(scopedDraft.manualColumns),
    [scopedDraft.manualColumns],
  );
  const manualRows = useMemo(
    () => normalizeManualTableRows(scopedDraft.manualRows),
    [scopedDraft.manualRows],
  );
  const manualFrameInput = useMemo(
    () =>
      buildTableWidgetFrameFromManualData({
        manualColumns,
        manualRows,
      }),
    [manualColumns, manualRows],
  );
  const activeFrameInput = isManualTableMode ? manualFrameInput : remoteFrameInput;
  const resolvedScopedDraft = useMemo(
    () =>
      resolveTableWidgetPropsWithFrame(
        isManualTableMode
          ? scopedDraft
          : {
              ...scopedDraft,
              ...sourceBinding.resolvedSourceProps,
            },
        activeFrameInput,
      ),
    [
      activeFrameInput,
      isManualTableMode,
      scopedDraft,
      sourceBinding.resolvedSourceProps,
    ],
  );
  const frameRows = buildTableWidgetRowObjects(
    resolvedScopedDraft.columns,
    resolvedScopedDraft.rows,
  );
  const schemaColumns = resolvedScopedDraft.schema;
  const resolvedColumns = resolveTableWidgetColumns(resolvedScopedDraft);
  const hasResolvedSource = isManualTableMode
    ? resolvedScopedDraft.columns.length > 0
    : hasRenderableLinkedDataset;
  const displayedColumns = hasResolvedSource ? resolvedColumns : [];
  const textFormattedColumns = displayedColumns.filter((column) => column.format === "text");
  const numericFormattedColumns = displayedColumns.filter((column) => column.format !== "text");
  const schemaValidation = validateTableWidgetSchema(frameRows, resolvedColumns);
  const inspectorFields = useMemo(
    () =>
      isManualTableMode
        ? manualFrameInput.schemaFallback.map((column) => ({
            key: column.key,
            label: column.label,
            type: column.format === "text" ? ("string" as const) : ("number" as const),
            description: column.description,
            provenance: "manual" as const,
            reason: "Authored in the Table manual table mode.",
          }))
        : linkedDataset?.fields ?? [],
    [isManualTableMode, linkedDataset?.fields, manualFrameInput.schemaFallback],
  );
  const shouldShowSchemaValidation =
    hasResolvedSource &&
    (resolvedScopedDraft.columns.length > 0 || schemaColumns.length > 0) &&
    !schemaValidation.isValid;
  const valueLabels = scopedDraft.valueLabels ?? [];
  const conditionalRules = scopedDraft.conditionalRules ?? [];
  const fallbackTextColor = resolvedTokens.primary;
  const fallbackFillColor = resolvedTokens.primary;

  function commit(nextProps: TableWidgetProps) {
    onDraftPropsChange(stripLegacyTableSourceFields(nextProps));
  }

  function updateColumnOverride(
    columnKey: string,
    updater: (current: TableWidgetColumnOverride) => TableWidgetColumnOverride,
  ) {
    const current = scopedDraft.columnOverrides?.[columnKey] ?? {};
    const nextOverride = normalizeColumnOverride(updater(current));
    const nextOverrides = { ...(scopedDraft.columnOverrides ?? {}) };

    if (nextOverride) {
      nextOverrides[columnKey] = nextOverride;
    } else {
      delete nextOverrides[columnKey];
    }

    commit({
      ...scopedDraft,
      columnOverrides: nextOverrides,
    });
  }

  function updateValueLabel(
    index: number,
    updater: (current: TableWidgetValueLabel) => TableWidgetValueLabel,
  ) {
    const nextLabels = [...valueLabels];
    nextLabels[index] = normalizeValueLabel(updater(nextLabels[index]));
    commit({
      ...scopedDraft,
      valueLabels: nextLabels,
    });
  }

  function updateConditionalRule(
    index: number,
    updater: (current: TableWidgetConditionalRule) => TableWidgetConditionalRule,
  ) {
    const nextRules = [...conditionalRules];
    nextRules[index] = normalizeConditionalRule(updater(nextRules[index]));
    commit({
      ...scopedDraft,
      conditionalRules: nextRules,
    });
  }

  function updateSchemaColumn(
    index: number,
    updater: (current: TableWidgetColumnSchema) => TableWidgetColumnSchema,
  ) {
    const currentColumn = schemaColumns[index];

    if (!currentColumn) {
      return;
    }

    const nextColumn = updater(currentColumn);
    const nextKey = nextColumn.key.trim();

    if (!nextKey) {
      return;
    }

    if (schemaColumns.some((column, columnIndex) => columnIndex !== index && column.key === nextKey)) {
      return;
    }

    const nextSchema = schemaColumns.map((column, columnIndex) =>
      columnIndex === index
        ? {
            ...column,
            ...nextColumn,
            key: nextKey,
            label: nextColumn.label.trim() || column.label,
            description: nextColumn.description?.trim() || undefined,
          }
        : column,
    );

    const previousKey = currentColumn.key;
    const nextOverrides = { ...(scopedDraft.columnOverrides ?? {}) };

    if (previousKey !== nextKey && nextOverrides[previousKey]) {
      nextOverrides[nextKey] = nextOverrides[previousKey];
      delete nextOverrides[previousKey];
    }

    commit({
      ...scopedDraft,
      schema: nextSchema,
      columnOverrides: nextOverrides,
      valueLabels: valueLabels.map((entry) =>
        entry.columnKey === previousKey ? { ...entry, columnKey: nextKey } : entry,
      ),
      conditionalRules: conditionalRules.map((rule) =>
        rule.columnKey === previousKey ? { ...rule, columnKey: nextKey } : rule,
      ),
    });
  }

  function removeSchemaColumn(columnKey: string) {
    commit({
      ...scopedDraft,
      schema: schemaColumns.filter((column) => column.key !== columnKey),
      columnOverrides: Object.fromEntries(
        Object.entries(scopedDraft.columnOverrides ?? {}).filter(([key]) => key !== columnKey),
      ),
      valueLabels: valueLabels.filter((entry) => entry.columnKey !== columnKey),
      conditionalRules: conditionalRules.filter((rule) => rule.columnKey !== columnKey),
    });
  }

  function getValueLabelColumns(currentColumnKey?: string) {
    const currentColumn =
      currentColumnKey == null
        ? null
        : resolvedColumns.find((column) => column.key === currentColumnKey) ?? null;

    if (!currentColumn || textFormattedColumns.some((column) => column.key === currentColumn.key)) {
      return textFormattedColumns;
    }

    return [currentColumn, ...textFormattedColumns];
  }

  function getConditionalRuleColumns(currentColumnKey?: string) {
    const currentColumn =
      currentColumnKey == null
        ? null
        : resolvedColumns.find((column) => column.key === currentColumnKey) ?? null;

    if (!currentColumn || numericFormattedColumns.some((column) => column.key === currentColumn.key)) {
      return numericFormattedColumns;
    }

    return [currentColumn, ...numericFormattedColumns];
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
            Configure a frame-to-table view around a live tabular or time-series source. The widget
            consumes canonical frame rows, then lets each instance define fields, mappings,
            thresholds, and display behavior.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!editable}
          onClick={() => {
            onDraftPropsChange(tableWidgetDefaultProps);
          }}
        >
          Reset widget defaults
        </Button>
      </div>

      {shouldShowSchemaValidation ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <div className="font-medium text-foreground">Wrong schema affects rendering</div>
          <p className="mt-1 text-danger/90">
            Fix the schema below before using this widget instance.
          </p>
          <ul className="mt-3 space-y-1">
            {schemaValidation.issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>{formatSchemaValidationIssue(issue)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className={sectionClass}>
        <div>
          <div className={titleClass}>Table options</div>
          <p className={descriptionClass}>
            Point the table at a tabular or time-series source, then control how the incoming fields
            should render.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className={fieldClass}>
            <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.tableSourceMode}>
              Table data
            </WidgetSettingFieldLabel>
            <Select
              className={selectClass}
              value={isManualTableMode ? "manual" : "bound"}
              disabled={!editable}
              onChange={(event) => {
                const nextSourceMode = event.target.value === "manual" ? "manual" : "bound";

                commit({
                  ...scopedDraft,
                  tableSourceMode: nextSourceMode,
                  sourceMode: nextSourceMode === "manual" ? "direct" : "filter_widget",
                  schema: [],
                  columnOverrides: {},
                  valueLabels: [],
                  conditionalRules: [],
                });
              }}
            >
              <option value="bound">Bound dataset</option>
              <option value="manual">Manual table</option>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            {isManualTableMode ? (
              <ManualTableEditor
                columns={manualColumns}
                rows={manualRows}
                editable={editable}
                onChange={({ columns: nextColumns, rows: nextRows }) => {
                  commit({
                    ...scopedDraft,
                    tableSourceMode: "manual",
                    sourceMode: "direct",
                    manualColumns: nextColumns,
                    manualRows: nextRows,
                  });
                }}
              />
            ) : (
              <>
                <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.sourceBinding}>
                  Source binding
                </WidgetSettingFieldLabel>
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-sm text-muted-foreground">
                  {sourceBinding.resolvedSourceWidget ? (
                    <>
                      <div className="font-medium text-foreground">
                        {sourceBinding.resolvedSourceWidget.title?.trim() || "Bound source widget"}
                      </div>
                      <div className="mt-1">
                        This table reads the published dataset from the selected source widget.
                      </div>
                    </>
                  ) : (
                    "Use the Bindings tab to connect this table to a source widget in the dashboard."
                  )}
                </div>
                <p className={descriptionClass}>
                  The linked source widget owns dataset publication. This table only formats the incoming rows.
                </p>

                {sourceBinding.isFilterWidgetSource && linkedDataset?.status === "error" ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {linkedDataset.error ?? "The bound source failed to load rows."}
                  </div>
                ) : null}

                {sourceBinding.isFilterWidgetSource &&
                !hasResolvedInputDataset &&
                !sourceBinding.hasResolvedFilterWidgetSource ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-3 text-sm text-muted-foreground">
                    Use the Bindings tab to connect this table to a source widget in this dashboard.
                  </div>
                ) : null}

                {!hasResolvedInputDataset && sourceBinding.isAwaitingBoundSourceValue ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/20 px-4 py-3 text-sm text-muted-foreground">
                    Refreshing the bound source widget so the table preview can load its dataset.
                  </div>
                ) : null}

              </>
            )}
          </div>

          <div className={fieldClass}>
            <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.density}>
              Density
            </WidgetSettingFieldLabel>
            <Select
              className={selectClass}
              value={resolvedDraft.density}
              disabled={!editable}
              onChange={(event) => {
                commit({
                  ...scopedDraft,
                  density: event.target.value as TableWidgetProps["density"],
                });
              }}
            >
              {tableWidgetDensityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className={fieldClass}>
            <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.pageSize}>
              Page size
            </WidgetSettingFieldLabel>
            <Input
              className={inputClass}
              type="number"
              min={5}
              max={200}
              value={resolvedDraft.pageSize}
              disabled={!editable}
              onChange={(event) => {
                commit({
                  ...scopedDraft,
                  pageSize: Number(event.target.value),
                });
              }}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.surfaceToggles}>
              Surface toggles
            </WidgetSettingFieldLabel>
            <div className={widgetTightFormButtonGroupClass}>
              <Button
                type="button"
                size="sm"
                variant={resolvedDraft.showToolbar ? "default" : "outline"}
                disabled={!editable}
                onClick={() => {
                  commit({
                    ...scopedDraft,
                    showToolbar: !resolvedDraft.showToolbar,
                  });
                }}
              >
                Toolbar
              </Button>
              <Button
                type="button"
                size="sm"
                variant={resolvedDraft.zebraRows ? "default" : "outline"}
                disabled={!editable}
                onClick={() => {
                  commit({
                    ...scopedDraft,
                    zebraRows: !resolvedDraft.zebraRows,
                  });
                }}
              >
                Zebra rows
              </Button>
              <Button
                type="button"
                size="sm"
                variant={resolvedDraft.showSearch ? "default" : "outline"}
                disabled={!editable}
                onClick={() => {
                  commit({
                    ...scopedDraft,
                    showSearch: !resolvedDraft.showSearch,
                  });
                }}
              >
                Search
              </Button>
              <Button
                type="button"
                size="sm"
                variant={resolvedDraft.pagination ? "default" : "outline"}
                disabled={!editable}
                onClick={() => {
                  commit({
                    ...scopedDraft,
                    pagination: !resolvedDraft.pagination,
                  });
                }}
              >
                Pagination
              </Button>
            </div>
          </div>
        </div>
      </section>

      <TabularFieldSchemaInspector
        title={isManualTableMode ? "Manual field schema" : "Incoming field schema"}
        description={
          isManualTableMode
            ? "Inspect the manual table schema before local column formatting is applied."
            : "Inspect the resolved source schema this table receives before local column formatting is applied."
        }
        fields={inspectorFields}
        rows={isManualTableMode ? frameRows : frameRowsSource}
        emptyMessage={
          isManualTableMode
            ? "Add manual table columns to inspect the schema."
            : "Bind this table to a tabular or time-series source to inspect its incoming schema."
        }
      />

      <section className={sectionClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className={titleClass}>Columns</div>
            <p className={descriptionClass}>
              Each column owns both its schema fields and its display formatting here. Reset from the
              current live frame when the source shape changes.
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!editable || !hasResolvedSource || activeFrameInput.schemaFallback.length === 0}
            onClick={() => {
              if (!hasResolvedSource || activeFrameInput.schemaFallback.length === 0) {
                return;
              }

              commit({
                ...scopedDraft,
                schema: cloneTableWidgetSchema(activeFrameInput.schemaFallback),
                columnOverrides: {},
                valueLabels: [],
                conditionalRules: [],
              });
            }}
          >
            Reset columns from current frame
          </Button>
        </div>

        <div className="space-y-3">
          {displayedColumns.length === 0 ? (
            <p className={descriptionClass}>
              {isManualTableMode
                ? "No manual fields are available yet. Open the editor and add at least one column."
                : "No source fields are available yet. Select a tabular or time-series source to load the current frame."}
            </p>
          ) : displayedColumns.map((column, index) => {
            const override = scopedDraft.columnOverrides?.[column.key] ?? {};
            return (
              <div
                key={column.key}
                className={insetSectionClass}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className={titleClass}>{column.label}</div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className={widgetTightFormButtonGroupClass}>
                      <Button
                        type="button"
                        size="sm"
                        variant={column.visible ? "default" : "outline"}
                        disabled={!editable}
                        onClick={() => {
                          updateColumnOverride(column.key, (current) => ({
                            ...current,
                            visible: true,
                          }));
                        }}
                      >
                        Visible
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!column.visible ? "default" : "outline"}
                        disabled={!editable}
                        onClick={() => {
                          updateColumnOverride(column.key, (current) => ({
                            ...current,
                            visible: false,
                          }));
                        }}
                      >
                        Hidden
                      </Button>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!editable}
                      onClick={() => {
                        removeSchemaColumn(column.key);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr,1.1fr,0.9fr,1.3fr]">
                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.columnKey}>
                      Key
                    </WidgetSettingFieldLabel>
                    <Input
                      className={inputClass}
                      value={column.key}
                      disabled={!editable}
                      onChange={(event) => {
                        updateSchemaColumn(index, (current) => ({
                          ...current,
                          key: event.target.value,
                        }));
                      }}
                    />
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.columnLabel}>
                      Label
                    </WidgetSettingFieldLabel>
                    <Input
                      className={inputClass}
                      value={column.label}
                      disabled={!editable}
                      onChange={(event) => {
                        updateSchemaColumn(index, (current) => ({
                          ...current,
                          label: event.target.value,
                        }));
                      }}
                    />
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.columnFormat}>
                      Format
                    </WidgetSettingFieldLabel>
                    <Select
                      className={selectClass}
                      value={column.format}
                      disabled={!editable}
                      onChange={(event) => {
                        updateSchemaColumn(index, (current) => ({
                          ...current,
                          format: event.target.value as TableWidgetColumnSchema["format"],
                        }));
                      }}
                    >
                      {tableWidgetFormatOptions
                        .filter((option) => option.value !== "auto")
                        .map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.columnDescription}>
                      Description
                    </WidgetSettingFieldLabel>
                    <Input
                      className={inputClass}
                      value={column.description ?? ""}
                      placeholder="Optional"
                      disabled={!editable}
                      onChange={(event) => {
                        updateSchemaColumn(index, (current) => ({
                          ...current,
                          description: event.target.value,
                        }));
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.align}>
                      Align
                    </WidgetSettingFieldLabel>
                    <Select
                      className={selectClass}
                      value={override.align ?? "auto"}
                      disabled={!editable}
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          align: event.target.value as TableWidgetColumnOverride["align"],
                        }));
                      }}
                    >
                      {tableWidgetAlignOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.pin}>
                      Pin
                    </WidgetSettingFieldLabel>
                    <Select
                      className={selectClass}
                      value={override.pinned ?? "none"}
                      disabled={!editable}
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          pinned: event.target.value as TableWidgetColumnOverride["pinned"],
                        }));
                      }}
                    >
                      {tableWidgetPinnedOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.decimals}>
                      Decimals
                    </WidgetSettingFieldLabel>
                    <Input
                      className={inputClass}
                      type="number"
                      min={0}
                      max={6}
                      value={override.decimals ?? ""}
                      placeholder={column.decimals == null ? "auto" : String(column.decimals)}
                      disabled={!editable || column.format === "text"}
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          decimals:
                            event.target.value === ""
                              ? undefined
                              : Number(event.target.value),
                        }));
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-4">
                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.prefix}>
                      Prefix
                    </WidgetSettingFieldLabel>
                    <Input
                      className={inputClass}
                      value={override.prefix ?? ""}
                      placeholder={column.prefix ?? "none"}
                      disabled={!editable}
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          prefix: event.target.value || undefined,
                        }));
                      }}
                    />
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.suffix}>
                      Suffix
                    </WidgetSettingFieldLabel>
                    <Input
                      className={inputClass}
                      value={override.suffix ?? ""}
                      placeholder={column.suffix ?? "none"}
                      disabled={!editable}
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          suffix: event.target.value || undefined,
                        }));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.compactNumbers}>
                      Compact numbers
                    </WidgetSettingFieldLabel>
                    <div className={widgetTightFormButtonGroupClass}>
                      <Button
                        type="button"
                        size="sm"
                        variant={column.compact ? "default" : "outline"}
                        disabled={!editable || column.format === "text"}
                        onClick={() => {
                          updateColumnOverride(column.key, (current) => ({
                            ...current,
                            compact: true,
                          }));
                        }}
                      >
                        Compact
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!column.compact ? "default" : "outline"}
                        disabled={!editable || column.format === "text"}
                        onClick={() => {
                          updateColumnOverride(column.key, (current) => ({
                            ...current,
                            compact: false,
                          }));
                        }}
                      >
                        Standard
                      </Button>
                    </div>
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.dataBar}>
                      Data bar
                    </WidgetSettingFieldLabel>
                    <Select
                      className={selectClass}
                      value={override.barMode ?? "none"}
                      disabled={!editable || column.format === "text"}
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          barMode: event.target.value as TableWidgetColumnOverride["barMode"],
                        }));
                      }}
                    >
                      {tableWidgetBarModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.heatmap}>
                      Heatmap
                    </WidgetSettingFieldLabel>
                    <Select
                      className={selectClass}
                      value={override.gradientMode ?? (override.heatmap ? "fill" : "none")}
                      disabled={!editable || column.format === "text"}
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          gradientMode:
                            event.target.value as TableWidgetColumnOverride["gradientMode"],
                          heatmap: event.target.value === "fill",
                        }));
                      }}
                    >
                      {tableWidgetGradientModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.heatmapPalette}>
                      Heatmap palette
                    </WidgetSettingFieldLabel>
                    <Select
                      className={selectClass}
                      value={override.heatmapPalette ?? "auto"}
                      disabled={
                        !editable ||
                        column.format === "text" ||
                        (override.gradientMode ?? (override.heatmap ? "fill" : "none")) === "none"
                      }
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          heatmapPalette: event.target.value as TableWidgetColumnOverride["heatmapPalette"],
                        }));
                      }}
                    >
                      {tableWidgetHeatmapPaletteOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.gauge}>
                      Gauge
                    </WidgetSettingFieldLabel>
                    <Select
                      className={selectClass}
                      value={override.gaugeMode ?? "none"}
                      disabled={!editable || column.format === "text"}
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          gaugeMode:
                            event.target.value as TableWidgetColumnOverride["gaugeMode"],
                        }));
                      }}
                    >
                      {tableWidgetGaugeModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.numericBounds}>
                      Numeric bounds
                    </WidgetSettingFieldLabel>
                    <Select
                      className={selectClass}
                      value={override.visualRangeMode ?? "auto"}
                      disabled={
                        !editable ||
                        column.format === "text" ||
                        ((override.gradientMode ?? (override.heatmap ? "fill" : "none")) === "none" &&
                          (override.gaugeMode ?? "none") === "none" &&
                          (override.barMode ?? "none") === "none")
                      }
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          visualRangeMode:
                            event.target.value as TableWidgetColumnOverride["visualRangeMode"],
                        }));
                      }}
                    >
                      {tableWidgetRangeModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.minBound}>
                      Min bound
                    </WidgetSettingFieldLabel>
                    <Input
                      className={inputClass}
                      type="number"
                      value={override.visualMin ?? ""}
                      placeholder="auto"
                      disabled={
                        !editable ||
                        column.format === "text" ||
                        (override.visualRangeMode ?? "auto") !== "fixed"
                      }
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          visualMin:
                            event.target.value === ""
                              ? undefined
                              : Number(event.target.value),
                        }));
                      }}
                    />
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.maxBound}>
                      Max bound
                    </WidgetSettingFieldLabel>
                    <Input
                      className={inputClass}
                      type="number"
                      value={override.visualMax ?? ""}
                      placeholder="auto"
                      disabled={
                        !editable ||
                        column.format === "text" ||
                        (override.visualRangeMode ?? "auto") !== "fixed"
                      }
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          visualMax:
                            event.target.value === ""
                              ? undefined
                              : Number(event.target.value),
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={sectionClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className={titleClass}>Value mappings</div>
            <p className={descriptionClass}>
              Map raw values to badge labels and theme-aware tones. Nothing is pre-seeded here: chips
              only appear when this widget instance defines them, and they render only on columns whose
              current format is `Text`.
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!editable || textFormattedColumns.length === 0}
            onClick={() => {
              const firstColumn = textFormattedColumns[0];
              const firstValue = getTableWidgetCategoricalValues(frameRows, firstColumn.key)[0] ?? "";

              commit({
                ...scopedDraft,
                valueLabels: [
                  ...valueLabels,
                  {
                    columnKey: firstColumn.key,
                    value: firstValue,
                    label: firstValue,
                    tone: "primary",
                  },
                ],
              });
            }}
          >
            Add mapping
          </Button>
        </div>

        {textFormattedColumns.length === 0 ? (
          <p className={descriptionClass}>
            No columns are currently formatted as `Text`. Set a column format to `Text` to add value labels.
          </p>
        ) : valueLabels.length === 0 ? (
          <p className={descriptionClass}>
            No custom value labels yet. Add one to turn any matching raw value into a colored chip.
          </p>
        ) : (
          <div className="space-y-3">
            {valueLabels.map((entry, index) => {
              const availableValues = getTableWidgetCategoricalValues(frameRows, entry.columnKey);
              const valueLabelColumns = getValueLabelColumns(entry.columnKey);

              return (
                <div
                  key={`${entry.columnKey}-${entry.value}-${index}`}
                  className="grid gap-3 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 p-3 lg:grid-cols-[1.1fr,1.1fr,1.2fr,1fr,auto,auto,auto]"
                >
                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.mappingColumn}>
                      Column
                    </WidgetSettingFieldLabel>
                    <Select
                      className={selectClass}
                      value={entry.columnKey}
                      disabled={!editable}
                      onChange={(event) => {
                        const nextColumnKey = event.target.value;
                        const nextValues = getTableWidgetCategoricalValues(frameRows, nextColumnKey);
                        updateValueLabel(index, (current) => ({
                          ...current,
                          columnKey: nextColumnKey,
                          value: nextValues[0] ?? "",
                          label: nextValues[0] ?? undefined,
                        }));
                      }}
                    >
                      {valueLabelColumns.map((column) => (
                        <option key={column.key} value={column.key}>
                          {column.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.mappingValue}>
                      Value
                    </WidgetSettingFieldLabel>
                    <Select
                      className={selectClass}
                      value={entry.value}
                      disabled={!editable}
                      onChange={(event) => {
                        updateValueLabel(index, (current) => ({
                          ...current,
                          value: event.target.value,
                          label: current.label ?? event.target.value,
                        }));
                      }}
                    >
                      {availableValues.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.mappingLabel}>
                      Display label
                    </WidgetSettingFieldLabel>
                    <Input
                      className={inputClass}
                      value={entry.label ?? ""}
                      placeholder={entry.value}
                      disabled={!editable}
                      onChange={(event) => {
                        updateValueLabel(index, (current) => ({
                          ...current,
                          label: event.target.value || undefined,
                        }));
                      }}
                    />
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.tone}>
                      Tone
                    </WidgetSettingFieldLabel>
                    <Select
                      className={selectClass}
                      value={entry.tone ?? "primary"}
                      disabled={!editable}
                      onChange={(event) => {
                        updateValueLabel(index, (current) => ({
                          ...current,
                          tone: normalizeTone(event.target.value) ?? "primary",
                        }));
                      }}
                    >
                      {tableWidgetToneOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.textColor}>
                      Text
                    </WidgetSettingFieldLabel>
                    <input
                      type="color"
                      value={toColorInputValue(entry.textColor, fallbackTextColor)}
                      disabled={!editable}
                      onChange={(event) => {
                        updateValueLabel(index, (current) => ({
                          ...current,
                          textColor: event.target.value,
                        }));
                      }}
                      className={colorInputClass}
                    />
                  </div>

                  <div className={fieldClass}>
                    <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.fillColor}>
                      Fill
                    </WidgetSettingFieldLabel>
                    <input
                      type="color"
                      value={toColorInputValue(entry.backgroundColor, fallbackFillColor)}
                      disabled={!editable}
                      onChange={(event) => {
                        updateValueLabel(index, (current) => ({
                          ...current,
                          backgroundColor: event.target.value,
                        }));
                      }}
                      className={colorInputClass}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!editable}
                      onClick={() => {
                        commit({
                          ...scopedDraft,
                          valueLabels: valueLabels.filter((_, ruleIndex) => ruleIndex !== index),
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className={titleClass}>Thresholds</div>
            <p className={descriptionClass}>
              Apply numeric thresholds like `&gt; 0`, `&lt; -5`, or `&gt; 80` to tint cells with theme-aware tones.
              Rules are evaluated top to bottom, and the first match wins. No threshold styling is applied
              unless this widget instance adds rules here. Rules target columns whose current format is not
              `Text`, and non-numeric cells are ignored at render time.
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!editable || numericFormattedColumns.length === 0}
            onClick={() => {
              commit({
                ...scopedDraft,
                conditionalRules: [
                  ...conditionalRules,
                  {
                    id: createTableWidgetRuleId(),
                    columnKey: numericFormattedColumns[0]?.key ?? "",
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

        {numericFormattedColumns.length === 0 ? (
          <p className={descriptionClass}>
            No columns are currently using a numeric display format. Set a column format to `Number`,
            `Currency`, `Percent`, or `Bps` to add threshold rules.
          </p>
        ) : conditionalRules.length === 0 ? (
          <p className={descriptionClass}>
            No rules yet. Add threshold-based rules to numeric display columns. If a cell is not numeric,
            the rule is simply ignored at render time.
          </p>
        ) : (
          <div className="space-y-3">
            {conditionalRules.map((rule, index) => {
              const conditionalRuleColumns = getConditionalRuleColumns(rule.columnKey);

              return (
                <div
                  key={rule.id}
                  className="grid gap-3 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 p-3 lg:grid-cols-[1.1fr,1fr,1fr,1fr,auto,auto,auto]"
                >
                <div className={fieldClass}>
                  <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.thresholdColumn}>
                    Column
                  </WidgetSettingFieldLabel>
                  <Select
                    className={selectClass}
                    value={rule.columnKey}
                    disabled={!editable}
                    onChange={(event) => {
                      updateConditionalRule(index, (current) => ({
                        ...current,
                        columnKey: event.target.value,
                      }));
                    }}
                    >
                    {conditionalRuleColumns.map((column) => (
                      <option key={column.key} value={column.key}>
                        {column.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className={fieldClass}>
                  <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.thresholdOperator}>
                    Operator
                  </WidgetSettingFieldLabel>
                  <Select
                    className={selectClass}
                    value={rule.operator}
                    disabled={!editable}
                    onChange={(event) => {
                      updateConditionalRule(index, (current) => ({
                        ...current,
                        operator: event.target.value as TableWidgetConditionalRule["operator"],
                      }));
                    }}
                  >
                    {tableWidgetOperatorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className={fieldClass}>
                  <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.thresholdValue}>
                    Threshold
                  </WidgetSettingFieldLabel>
                  <Input
                    className={inputClass}
                    type="number"
                    value={rule.value}
                    disabled={!editable}
                    onChange={(event) => {
                      updateConditionalRule(index, (current) => ({
                        ...current,
                        value: Number(event.target.value),
                      }));
                    }}
                  />
                </div>

                <div className={fieldClass}>
                  <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.tone}>
                    Tone
                  </WidgetSettingFieldLabel>
                  <Select
                    className={selectClass}
                    value={rule.tone ?? "primary"}
                    disabled={!editable}
                    onChange={(event) => {
                      updateConditionalRule(index, (current) => ({
                        ...current,
                        tone: normalizeTone(event.target.value) ?? "primary",
                      }));
                    }}
                  >
                    {tableWidgetToneOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className={fieldClass}>
                  <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.textColor}>
                    Text
                  </WidgetSettingFieldLabel>
                  <input
                    type="color"
                    value={toColorInputValue(rule.textColor, fallbackTextColor)}
                    disabled={!editable}
                    onChange={(event) => {
                      updateConditionalRule(index, (current) => ({
                        ...current,
                        textColor: event.target.value,
                      }));
                    }}
                    className={colorInputClass}
                  />
                </div>

                <div className={fieldClass}>
                  <WidgetSettingFieldLabel className={labelClass} help={tableFieldHelp.fillColor}>
                    Fill
                  </WidgetSettingFieldLabel>
                  <input
                    type="color"
                    value={toColorInputValue(rule.backgroundColor, fallbackFillColor)}
                    disabled={!editable}
                    onChange={(event) => {
                      updateConditionalRule(index, (current) => ({
                        ...current,
                        backgroundColor: event.target.value,
                      }));
                    }}
                    className={colorInputClass}
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!editable}
                    onClick={() => {
                      commit({
                        ...scopedDraft,
                        conditionalRules: conditionalRules.filter((_, ruleIndex) => ruleIndex !== index),
                      });
                    }}
                  >
                    Remove
                  </Button>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
