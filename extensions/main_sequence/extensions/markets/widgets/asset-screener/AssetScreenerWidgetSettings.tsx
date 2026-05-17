import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TableWidgetSettings } from "@/widgets/core/table/TableWidgetSettings";
import type {
  TableWidgetColumnFormat,
  TableWidgetColumnSchema,
  TableWidgetProps,
  TableWidgetResolvedFrameInput,
} from "@/widgets/core/table/tableModel";
import { useRuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import {
  widgetTightFormDescriptionClass,
  widgetTightFormFieldClass,
  widgetTightFormInputClass,
  widgetTightFormLabelClass,
  widgetTightFormSectionClass,
  widgetTightFormSelectClass,
  widgetTightFormTitleClass,
} from "@/widgets/shared/form-density";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  normalizeAssetScreenerProps,
  resolveAssetScreenerColumnConfigFromResolvedInputs,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";
import type { MarketAssetScreenerColumn } from "../../widget-contracts/marketAssetFrames";

type Props = WidgetSettingsComponentProps<MainSequenceAssetScreenerWidgetProps>;

const fieldClass = widgetTightFormFieldClass;
const labelClass = widgetTightFormLabelClass;
const inputClass = widgetTightFormInputClass;
const selectClass = widgetTightFormSelectClass;
const sectionClass = widgetTightFormSectionClass;
const titleClass = widgetTightFormTitleClass;
const descriptionClass = widgetTightFormDescriptionClass;

function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function tableFormatForScreenerColumn(
  column: MarketAssetScreenerColumn,
): Exclude<TableWidgetColumnFormat, "auto"> {
  if (column.kind === "asset-field" || column.kind === "sparkline") {
    return "text";
  }

  if ("format" in column && column.format === "percent") {
    return "percent";
  }

  return "number";
}

function buildTableSettingsFrameInput(
  columns: MarketAssetScreenerColumn[],
): TableWidgetResolvedFrameInput {
  const schemaFallback = columns.map<TableWidgetColumnSchema>((column) => ({
    key: column.id,
    label: column.label,
    format: tableFormatForScreenerColumn(column),
    minWidth: column.width,
    categorical: column.kind === "asset-field",
    heatmapEligible: column.kind !== "asset-field" && column.kind !== "sparkline",
  }));

  return {
    columns: columns.map((column) => column.id),
    rows: [],
    schemaFallback,
    sourceLabel: "Asset screener columns",
  };
}

function buildTableDraftProps(
  props: MainSequenceAssetScreenerWidgetProps,
): TableWidgetProps {
  const table = props.table ?? {};

  return {
    tableSourceMode: "bound",
    density: table.density ?? props.density ?? "compact",
    showToolbar: table.showToolbar ?? true,
    showSearch: table.showSearch ?? true,
    zebraRows: table.zebraRows ?? false,
    pagination: table.pagination ?? false,
    pageSize: table.pageSize ?? 100,
    schema: table.schema,
    columnOverrides: table.columnOverrides,
    valueLabels: table.valueLabels,
    conditionalRules: table.conditionalRules,
    selectionMode: table.selectionMode,
    selectionKeyFields: table.selectionKeyFields,
    publishSelectionOutputs: table.publishSelectionOutputs,
  };
}

function pickTableSettings(value: TableWidgetProps): Partial<TableWidgetProps> {
  return {
    density: value.density,
    showToolbar: value.showToolbar,
    showSearch: value.showSearch,
    zebraRows: value.zebraRows,
    pagination: value.pagination,
    pageSize: value.pageSize,
    schema: value.schema,
    columnOverrides: value.columnOverrides,
    valueLabels: value.valueLabels,
    conditionalRules: value.conditionalRules,
    selectionMode: value.selectionMode,
    selectionKeyFields: value.selectionKeyFields,
    publishSelectionOutputs: value.publishSelectionOutputs,
  };
}

export function AssetScreenerWidgetSettings({
  widget,
  instanceId,
  draftProps,
  onDraftPropsChange,
  draftPresentation,
  onDraftPresentationChange,
  controllerContext,
  instanceTitle,
  onInstanceTitleChange,
  editable,
  resolvedInputs,
}: Props) {
  const props = normalizeAssetScreenerProps(draftProps);
  const runtimeDataStore = useRuntimeDataStore();
  const columnConfig = useMemo(
    () =>
      resolveAssetScreenerColumnConfigFromResolvedInputs({
        props,
        resolvedInputs,
        runtimeDataStore,
      }),
    [props, resolvedInputs, runtimeDataStore],
  );
  const displayedColumns = columnConfig.columns;
  const sourceColumns = columnConfig.sourceColumns ?? [];
  const tableFrameInput = useMemo(
    () => buildTableSettingsFrameInput(displayedColumns),
    [displayedColumns],
  );
  const tableDraftProps = useMemo(
    () => buildTableDraftProps(props),
    [props],
  );
  const displayedColumnsJson = useMemo(
    () => stringifyJson(displayedColumns),
    [displayedColumns],
  );
  const [mappingText, setMappingText] = useState(() => stringifyJson(props.fieldMappings ?? {}));
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [columnsText, setColumnsText] = useState(() => displayedColumnsJson);
  const [columnsError, setColumnsError] = useState<string | null>(null);
  const groupableColumns = useMemo(
    () =>
      displayedColumns.filter((column) =>
        column.kind === "asset-field" && column.groupable !== false,
      ) as Array<Extract<NonNullable<typeof props.columns>[number], { kind: "asset-field" }>>,
    [displayedColumns],
  );

  useEffect(() => {
    setColumnsText(displayedColumnsJson);
    setColumnsError(null);
  }, [displayedColumnsJson]);

  return (
    <div className="space-y-4">
      <section className={sectionClass}>
        <div>
          <h3 className={titleClass}>Screener Layout</h3>
          <p className={descriptionClass}>
            Configure row density, grouping, and bounded rendering. Data comes from normal bindings
            or the widget-owned managed connection source configured on this settings page.
          </p>
        </div>
        <label className={fieldClass}>
          <WidgetSettingFieldLabel
            className={labelClass}
            help="Controls table row height. Compact is intended for terminal-style market screens."
          >
            Density
          </WidgetSettingFieldLabel>
          <Select
            className={selectClass}
            disabled={!editable}
            value={props.density}
            onChange={(event) => {
              onDraftPropsChange({
                ...props,
                density: event.target.value === "comfortable" ? "comfortable" : "compact",
              });
            }}
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
          </Select>
        </label>
        <label className={fieldClass}>
          <WidgetSettingFieldLabel
            className={labelClass}
            help="Optional asset identity field used to create dense section headers."
          >
            Group by
          </WidgetSettingFieldLabel>
          <Select
            className={selectClass}
            disabled={!editable}
            value={props.groupBy ?? ""}
            onChange={(event) => {
              onDraftPropsChange({
                ...props,
                groupBy: event.target.value || undefined,
              });
            }}
          >
            <option value="">No grouping</option>
            {groupableColumns.map((column) => (
              <option key={column.id} value={String(column.field)}>
                {column.label}
              </option>
            ))}
          </Select>
        </label>
        <label className={fieldClass}>
          <WidgetSettingFieldLabel
            className={labelClass}
            help="Caps rows rendered after filtering and sorting. Use this to keep large universes responsive."
          >
            Max rendered rows
          </WidgetSettingFieldLabel>
          <Input
            className={inputClass}
            disabled={!editable}
            min={50}
            type="number"
            value={props.maxRenderedRows ?? 500}
            onChange={(event) => {
              onDraftPropsChange({
                ...props,
                maxRenderedRows: Number(event.target.value),
              });
            }}
          />
        </label>
        <label className={fieldClass}>
          <WidgetSettingFieldLabel
            className={labelClass}
            help="Saved staleness threshold for future runtime diagnostics. It does not trigger backend refreshes."
          >
            Stale after seconds
          </WidgetSettingFieldLabel>
          <Input
            className={inputClass}
            disabled={!editable}
            min={0}
            type="number"
            value={Math.round((props.staleAfterMs ?? 0) / 1000)}
            onChange={(event) => {
              onDraftPropsChange({
                ...props,
                staleAfterMs: Number(event.target.value) * 1000,
              });
            }}
          />
        </label>
      </section>

      <section className={sectionClass}>
        <div>
          <h3 className={titleClass}>Field Mappings</h3>
          <p className={descriptionClass}>
            Optional overrides for seedData and liveUpdates. Reference prices and sparklines should
            be declared in seedData metadata.
          </p>
        </div>
        <Textarea
          className="min-h-[180px] font-mono text-xs"
          disabled={!editable}
          value={mappingText}
          onChange={(event) => {
            setMappingText(event.target.value);
            setMappingError(null);
          }}
          onBlur={() => {
            const parsed = parseJsonObject(mappingText);

            if (!parsed) {
              setMappingError("Mappings must be a JSON object.");
              return;
            }

            onDraftPropsChange({
              ...props,
              fieldMappings: parsed,
            });
          }}
        />
        {mappingError ? (
          <p className="text-xs text-destructive">{mappingError}</p>
        ) : (
          <p className={descriptionClass}>
            Example: {"{"} "seed": {"{"} "assetKeyField": "symbol", "valueFields": {"{"}
            "price": "last_price" {"}"} {"}"} {"}"}
          </p>
        )}
      </section>

      <section className={sectionClass}>
        <div>
          <h3 className={titleClass}>Columns</h3>
          <p className={descriptionClass}>
            Dynamic view columns over stable market value keys. Add latest, reference, return, or
            sparkline columns by pointing each column at a seeded `valueField` such as `price`,
            `volume`, or `marketCap`.
          </p>
        </div>
        <label className={fieldClass}>
          <WidgetSettingFieldLabel
            className={labelClass}
            help="Source metadata lets the backend propose the table columns through meta.marketAsset, meta.tableTransforms, and meta.tableVisuals. Instance override saves a local copy that wins over source metadata."
          >
            Column configuration
          </WidgetSettingFieldLabel>
          <Select
            className={selectClass}
            disabled={!editable}
            value={props.columnConfigMode ?? "source"}
            onChange={(event) => {
              const nextMode = event.target.value === "custom" ? "custom" : "source";

              onDraftPropsChange({
                ...props,
                columnConfigMode: nextMode,
                columns: nextMode === "custom" ? displayedColumns : undefined,
              });
            }}
          >
            <option value="source">Source metadata</option>
            <option value="custom">Instance override</option>
          </Select>
        </label>
        <Textarea
          className="min-h-[220px] font-mono text-xs"
          disabled={!editable || props.columnConfigMode !== "custom"}
          value={columnsText}
          onChange={(event) => {
            setColumnsText(event.target.value);
            setColumnsError(null);
          }}
          onBlur={() => {
            const parsed = parseJsonArray(columnsText);

            if (!parsed) {
              setColumnsError("Columns must be a JSON array.");
              return;
            }

            const normalizedColumns = normalizeAssetScreenerProps({
              ...props,
              columns: parsed,
            }).columns;

            if (!normalizedColumns || normalizedColumns.length === 0) {
              setColumnsError("Columns must include at least one valid column.");
              return;
            }

            onDraftPropsChange({
              ...props,
              columnConfigMode: "custom",
              columns: normalizedColumns,
            });
            setColumnsText(stringifyJson(normalizedColumns));
          }}
        />
        {columnsError ? (
          <p className="text-xs text-destructive">{columnsError}</p>
        ) : (
          <p className={descriptionClass}>
            {props.columnConfigMode === "custom"
              ? "This instance override wins over backend metadata until you switch back to Source metadata."
              : columnConfig.source === "source"
                ? "Derived from source metadata. Switch to Instance override to edit and save a local copy."
                : "No source column metadata is available yet. Bind a semantic table or switch to Instance override to define local columns."}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!editable || sourceColumns.length === 0}
            type="button"
            variant="outline"
            onClick={() => {
              setColumnsText(stringifyJson(sourceColumns));
              setColumnsError(null);
              onDraftPropsChange({
                ...props,
                columnConfigMode: "custom",
                columns: sourceColumns,
              });
            }}
          >
            Copy Source Columns To Override
          </Button>
        </div>
      </section>

      <section className={sectionClass}>
        <div>
          <h3 className={titleClass}>Table Settings</h3>
          <p className={descriptionClass}>
            These are the shared table display settings used by the core Table widget. The Asset
            Screener only supplies the market-derived frame.
          </p>
        </div>
        <TableWidgetSettings
          widget={widget as never}
          instanceId={instanceId}
          draftProps={tableDraftProps}
          onDraftPropsChange={(nextTableProps) => {
            onDraftPropsChange({
              ...props,
              density: nextTableProps.density === "comfortable" ? "comfortable" : "compact",
              table: pickTableSettings(nextTableProps),
            });
          }}
          draftPresentation={draftPresentation}
          onDraftPresentationChange={onDraftPresentationChange}
          resolvedInputs={resolvedInputs}
          controllerContext={controllerContext}
          instanceTitle={instanceTitle}
          onInstanceTitleChange={onInstanceTitleChange}
          editable={editable}
          presentationOnly
          presentationFrameInput={tableFrameInput}
          resetLabel="Reset table settings"
          onReset={() => {
            onDraftPropsChange({
              ...props,
              table: undefined,
            });
          }}
        />
      </section>
    </div>
  );
}
