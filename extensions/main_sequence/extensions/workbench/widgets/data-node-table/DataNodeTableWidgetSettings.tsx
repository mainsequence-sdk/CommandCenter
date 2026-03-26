import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PickerField } from "../../../../common/components/PickerField";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import {
  fetchDataNodeDetail,
} from "../../../../common/api";
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
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import { useResolvedDataNodeWidgetSourceBinding } from "../data-node-shared/dataNodeWidgetSource";
import { normalizeDataNodeFilterRuntimeState } from "../data-node-filter/dataNodeFilterModel";
import {
  buildDataNodeTableVisualizerFrameFromRemoteData,
  buildDataNodeTableVisualizerRowObjects,
  cloneDataNodeTableVisualizerSchema,
  createDataNodeTableVisualizerRuleId,
  getDataNodeTableVisualizerCategoricalValues,
  resolveDataNodeTableVisualizerColumns,
  resolveDataNodeTableVisualizerProps,
  resolveDataNodeTableVisualizerPropsWithFrame,
  validateDataNodeTableVisualizerSchema,
  dataNodeTableVisualizerAlignOptions,
  dataNodeTableVisualizerBarModeOptions,
  dataNodeTableVisualizerDefaultProps,
  dataNodeTableVisualizerDensityOptions,
  dataNodeTableVisualizerFormatOptions,
  dataNodeTableVisualizerOperatorOptions,
  dataNodeTableVisualizerPinnedOptions,
  dataNodeTableVisualizerToneOptions,
  type DataNodeTableVisualizerColumnSchema,
  type DataNodeTableVisualizerColumnOverride,
  type DataNodeTableVisualizerConditionalRule,
  type DataNodeTableVisualizerProps,
  type DataNodeTableVisualizerSchemaValidationIssue,
  type DataNodeTableVisualizerTone,
  type DataNodeTableVisualizerValueLabel,
} from "./dataNodeTableModel";

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

function normalizeColumnOverride(override: DataNodeTableVisualizerColumnOverride) {
  const nextValue: DataNodeTableVisualizerColumnOverride = {};

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

  if (override.align) {
    nextValue.align = override.align;
  }

  if (override.pinned) {
    nextValue.pinned = override.pinned;
  }

  return Object.keys(nextValue).length > 0 ? nextValue : undefined;
}

function normalizeValueLabel(entry: DataNodeTableVisualizerValueLabel) {
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
  } satisfies DataNodeTableVisualizerValueLabel;
}

function normalizeConditionalRule(entry: DataNodeTableVisualizerConditionalRule) {
  return {
    ...entry,
    id: entry.id.trim() || createDataNodeTableVisualizerRuleId(),
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
  } satisfies DataNodeTableVisualizerConditionalRule;
}

function normalizeTone(value: string): DataNodeTableVisualizerTone | undefined {
  return value === "neutral" ||
    value === "primary" ||
    value === "success" ||
    value === "warning" ||
    value === "danger"
    ? value
    : undefined;
}

function formatSchemaValidationIssue(issue: DataNodeTableVisualizerSchemaValidationIssue) {
  if (issue.code === "empty_schema") {
    return "No schema fields are configured for this widget instance.";
  }

  if (issue.code === "missing_columns") {
    return `Configured fields not found in the current data rows: ${(issue.columnKeys ?? []).join(", ")}`;
  }

  return `Fields formatted as numeric but backed by non-numeric data: ${(issue.columnKeys ?? []).join(", ")}`;
}

function stripLegacyTableSourceFields(
  value: DataNodeTableVisualizerProps,
): DataNodeTableVisualizerProps {
  const nextValue = {
    ...value,
  } as DataNodeTableVisualizerProps & {
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

export function DataNodeTableWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<DataNodeTableVisualizerProps>) {
  const {
    rangeStartMs: dashboardRangeStartMs,
    rangeEndMs: dashboardRangeEndMs,
  } = useDashboardControls();
  const { resolvedTokens } = useTheme();
  const resolvedDraft = resolveDataNodeTableVisualizerProps(draftProps);
  const sourceReferenceProps = useMemo<DataNodeTableVisualizerProps>(
    () => ({
      sourceMode: "filter_widget",
      sourceWidgetId: resolvedDraft.sourceWidgetId,
    }),
    [resolvedDraft.sourceWidgetId],
  );
  const sourceBinding = useResolvedDataNodeWidgetSourceBinding({
    props: sourceReferenceProps,
  });
  const linkedFilterRuntime = useMemo(
    () => normalizeDataNodeFilterRuntimeState(sourceBinding.referencedFilterWidget?.runtimeState),
    [sourceBinding.referencedFilterWidget?.runtimeState],
  );
  const effectiveDataNodeId = Number(
    linkedFilterRuntime?.dataNodeId ?? sourceBinding.resolvedSourceProps.dataNodeId ?? 0,
  );
  const effectiveDraftProps = useMemo(
    () => ({
      ...resolvedDraft,
      ...sourceBinding.resolvedSourceProps,
      dataNodeId: effectiveDataNodeId || undefined,
    }),
    [effectiveDataNodeId, resolvedDraft, sourceBinding.resolvedSourceProps],
  );
  const selectedDataNodeId = effectiveDataNodeId;

  const dataNodeDetailQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "data_node_table_visualizer",
      "detail",
      selectedDataNodeId,
    ],
    queryFn: () => fetchDataNodeDetail(selectedDataNodeId),
    enabled: Number.isFinite(selectedDataNodeId) && selectedDataNodeId > 0,
    staleTime: 300_000,
  });

  const hasSourceTableConfiguration = Boolean(
    dataNodeDetailQuery.data?.sourcetableconfiguration,
  );
  const hasResolvedSource = sourceBinding.hasResolvedFilterWidgetSource;
  const frameColumnsSource = linkedFilterRuntime?.columns ?? [];
  const frameRowsSource = linkedFilterRuntime?.rows ?? [];

  const remoteFrameInput = useMemo(
    () =>
      buildDataNodeTableVisualizerFrameFromRemoteData(
        dataNodeDetailQuery.data,
        frameRowsSource,
        frameColumnsSource,
      ),
    [dataNodeDetailQuery.data, frameColumnsSource, frameRowsSource],
  );
  const scopedDraft = useMemo(
    () => stripLegacyTableSourceFields(draftProps),
    [draftProps],
  );
  const resolvedScopedDraft = useMemo(
    () =>
      resolveDataNodeTableVisualizerPropsWithFrame(
        {
          ...scopedDraft,
          ...sourceBinding.resolvedSourceProps,
          dataNodeId: effectiveDataNodeId || undefined,
        },
        remoteFrameInput,
      ),
    [effectiveDataNodeId, remoteFrameInput, scopedDraft, sourceBinding.resolvedSourceProps],
  );
  const frameRows = buildDataNodeTableVisualizerRowObjects(
    resolvedScopedDraft.columns,
    resolvedScopedDraft.rows,
  );
  const schemaColumns = resolvedScopedDraft.schema;
  const resolvedColumns = resolveDataNodeTableVisualizerColumns(resolvedScopedDraft);
  const displayedColumns = hasResolvedSource ? resolvedColumns : [];
  const textFormattedColumns = displayedColumns.filter((column) => column.format === "text");
  const numericFormattedColumns = displayedColumns.filter((column) => column.format !== "text");
  const schemaValidation = validateDataNodeTableVisualizerSchema(frameRows, resolvedColumns);
  const shouldShowSchemaValidation =
    hasResolvedSource &&
    selectedDataNodeId > 0 &&
    (resolvedScopedDraft.columns.length > 0 || schemaColumns.length > 0) &&
    !schemaValidation.isValid;
  const valueLabels = scopedDraft.valueLabels ?? [];
  const conditionalRules = scopedDraft.conditionalRules ?? [];
  const fallbackTextColor = resolvedTokens.primary;
  const fallbackFillColor = resolvedTokens.primary;

  function commit(nextProps: DataNodeTableVisualizerProps) {
    onDraftPropsChange(stripLegacyTableSourceFields(nextProps));
  }

  function buildSourceSelectionProps(nextSourceWidgetId?: string) {
    return stripLegacyTableSourceFields({
      ...scopedDraft,
      sourceMode: "filter_widget",
      sourceWidgetId: nextSourceWidgetId,
      schema: [],
      columnOverrides: {},
      valueLabels: [],
      conditionalRules: [],
    });
  }

  function updateColumnOverride(
    columnKey: string,
    updater: (current: DataNodeTableVisualizerColumnOverride) => DataNodeTableVisualizerColumnOverride,
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
    updater: (current: DataNodeTableVisualizerValueLabel) => DataNodeTableVisualizerValueLabel,
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
    updater: (current: DataNodeTableVisualizerConditionalRule) => DataNodeTableVisualizerConditionalRule,
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
    updater: (current: DataNodeTableVisualizerColumnSchema) => DataNodeTableVisualizerColumnSchema,
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
            Configure a frame-to-table view around a live data node. The widget consumes remote
            `columns[] + rows[][]`, then lets each instance define fields, mappings, thresholds, and
            display behavior.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!editable}
          onClick={() => {
            onDraftPropsChange(dataNodeTableVisualizerDefaultProps);
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
            Point the table at a Data Node, then control how the incoming fields
            should render.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className={labelClass}>Data Node</label>
            <PickerField
              value={resolvedDraft.sourceWidgetId ?? ""}
              onChange={(value) => {
                const nextSourceWidgetId = value || undefined;

                if (resolvedDraft.sourceWidgetId === nextSourceWidgetId) {
                  return;
                }

                onDraftPropsChange(buildSourceSelectionProps(nextSourceWidgetId));
              }}
              options={sourceBinding.filterWidgetOptions}
              placeholder={
                sourceBinding.filterWidgetOptions.length > 0
                  ? "Select a Data Node"
                  : "No Data Nodes are available"
              }
              searchPlaceholder="Search data nodes"
              emptyMessage="No Data Nodes are available in this dashboard."
              disabled={!editable || sourceBinding.filterWidgetOptions.length === 0}
            />
            <p className={descriptionClass}>
              The linked Data Node owns source selection and dataset shape. This table only formats the incoming rows.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            {sourceBinding.isFilterWidgetSource && linkedFilterRuntime?.status === "error" ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {linkedFilterRuntime.error ?? "The linked Data Node failed to load rows."}
              </div>
            ) : null}

            {resolvedDraft.sourceMode === "filter_widget" && !sourceBinding.hasResolvedFilterWidgetSource ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-3 text-sm text-muted-foreground">
                Select a Data Node in this dashboard to resolve the table source.
              </div>
            ) : null}

            {selectedDataNodeId > 0 && !dataNodeDetailQuery.isLoading && !hasSourceTableConfiguration ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                This data node has no source-table metadata, so the table cannot infer fields.
              </div>
            ) : null}
          </div>

          <div className={fieldClass}>
            <label className={labelClass}>
              Density
            </label>
            <Select
              className={selectClass}
              value={resolvedDraft.density}
              disabled={!editable}
              onChange={(event) => {
                commit({
                  ...scopedDraft,
                  density: event.target.value as DataNodeTableVisualizerProps["density"],
                });
              }}
            >
              {dataNodeTableVisualizerDensityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className={fieldClass}>
            <label className={labelClass}>
              Page size
            </label>
            <Input
              className={inputClass}
              type="number"
              min={5}
              max={50}
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
            <label className={labelClass}>
              Surface toggles
            </label>
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
            disabled={!editable || !hasResolvedSource || remoteFrameInput.schemaFallback.length === 0}
            onClick={() => {
              if (!hasResolvedSource || remoteFrameInput.schemaFallback.length === 0) {
                return;
              }

              commit({
                ...scopedDraft,
                schema: cloneDataNodeTableVisualizerSchema(remoteFrameInput.schemaFallback),
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
              No source fields are available yet. Select a Data Node to load the current frame.
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
                    <label className={labelClass}>
                      Key
                    </label>
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
                    <label className={labelClass}>
                      Label
                    </label>
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
                    <label className={labelClass}>
                      Format
                    </label>
                    <Select
                      className={selectClass}
                      value={column.format}
                      disabled={!editable}
                      onChange={(event) => {
                        updateSchemaColumn(index, (current) => ({
                          ...current,
                          format: event.target.value as DataNodeTableVisualizerColumnSchema["format"],
                        }));
                      }}
                    >
                      {dataNodeTableVisualizerFormatOptions
                        .filter((option) => option.value !== "auto")
                        .map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <label className={labelClass}>
                      Description
                    </label>
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
                    <label className={labelClass}>
                      Align
                    </label>
                    <Select
                      className={selectClass}
                      value={override.align ?? "auto"}
                      disabled={!editable}
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          align: event.target.value as DataNodeTableVisualizerColumnOverride["align"],
                        }));
                      }}
                    >
                      {dataNodeTableVisualizerAlignOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <label className={labelClass}>
                      Pin
                    </label>
                    <Select
                      className={selectClass}
                      value={override.pinned ?? "none"}
                      disabled={!editable}
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          pinned: event.target.value as DataNodeTableVisualizerColumnOverride["pinned"],
                        }));
                      }}
                    >
                      {dataNodeTableVisualizerPinnedOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <label className={labelClass}>
                      Decimals
                    </label>
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

                <div className="grid gap-3 lg:grid-cols-5">
                  <div className={fieldClass}>
                    <label className={labelClass}>
                      Prefix
                    </label>
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
                    <label className={labelClass}>
                      Suffix
                    </label>
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
                    <label className={labelClass}>
                      Compact numbers
                    </label>
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

                  <div className="space-y-2">
                    <label className={labelClass}>
                      Heatmap
                    </label>
                    <div className={widgetTightFormButtonGroupClass}>
                      <Button
                        type="button"
                        size="sm"
                        variant={column.heatmap ? "default" : "outline"}
                        disabled={!editable || column.format === "text"}
                        onClick={() => {
                          updateColumnOverride(column.key, (current) => ({
                            ...current,
                            heatmap: true,
                          }));
                        }}
                      >
                        On
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!column.heatmap ? "default" : "outline"}
                        disabled={!editable || column.format === "text"}
                        onClick={() => {
                          updateColumnOverride(column.key, (current) => ({
                            ...current,
                            heatmap: false,
                          }));
                        }}
                      >
                        Off
                      </Button>
                    </div>
                  </div>

                  <div className={fieldClass}>
                    <label className={labelClass}>
                      Data bar
                    </label>
                    <Select
                      className={selectClass}
                      value={override.barMode ?? "none"}
                      disabled={!editable || column.format === "text"}
                      onChange={(event) => {
                        updateColumnOverride(column.key, (current) => ({
                          ...current,
                          barMode: event.target.value as DataNodeTableVisualizerColumnOverride["barMode"],
                        }));
                      }}
                    >
                      {dataNodeTableVisualizerBarModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
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
              const firstValue = getDataNodeTableVisualizerCategoricalValues(frameRows, firstColumn.key)[0] ?? "";

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
              const availableValues = getDataNodeTableVisualizerCategoricalValues(frameRows, entry.columnKey);
              const valueLabelColumns = getValueLabelColumns(entry.columnKey);

              return (
                <div
                  key={`${entry.columnKey}-${entry.value}-${index}`}
                  className="grid gap-3 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 p-3 lg:grid-cols-[1.1fr,1.1fr,1.2fr,1fr,auto,auto,auto]"
                >
                  <div className={fieldClass}>
                    <label className={labelClass}>
                      Column
                    </label>
                    <Select
                      className={selectClass}
                      value={entry.columnKey}
                      disabled={!editable}
                      onChange={(event) => {
                        const nextColumnKey = event.target.value;
                        const nextValues = getDataNodeTableVisualizerCategoricalValues(frameRows, nextColumnKey);
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
                    <label className={labelClass}>
                      Value
                    </label>
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
                    <label className={labelClass}>
                      Display label
                    </label>
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
                    <label className={labelClass}>
                      Tone
                    </label>
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
                      {dataNodeTableVisualizerToneOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className={fieldClass}>
                    <label className={labelClass}>
                      Text
                    </label>
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
                    <label className={labelClass}>
                      Fill
                    </label>
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
                    id: createDataNodeTableVisualizerRuleId(),
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
                  <label className={labelClass}>
                    Column
                  </label>
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
                  <label className={labelClass}>
                    Operator
                  </label>
                  <Select
                    className={selectClass}
                    value={rule.operator}
                    disabled={!editable}
                    onChange={(event) => {
                      updateConditionalRule(index, (current) => ({
                        ...current,
                        operator: event.target.value as DataNodeTableVisualizerConditionalRule["operator"],
                      }));
                    }}
                  >
                    {dataNodeTableVisualizerOperatorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className={fieldClass}>
                  <label className={labelClass}>
                    Threshold
                  </label>
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
                  <label className={labelClass}>
                    Tone
                  </label>
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
                    {dataNodeTableVisualizerToneOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className={fieldClass}>
                  <label className={labelClass}>
                    Text
                  </label>
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
                  <label className={labelClass}>
                    Fill
                  </label>
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
