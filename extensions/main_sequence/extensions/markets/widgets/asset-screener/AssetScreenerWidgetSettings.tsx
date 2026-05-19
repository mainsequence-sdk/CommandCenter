import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TableWidgetSettings } from "@/widgets/core/table/TableWidgetSettings";
import type {
  TableWidgetProps,
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
  prepareAssetScreenerColumnsForPersistence,
  resolveAssetScreenerState,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";
import { buildAssetScreenerTableFrame } from "./AssetScreenerWidget";

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

function buildTableDraftProps(
  props: MainSequenceAssetScreenerWidgetProps,
): TableWidgetProps {
  const table = props.table ?? {};

  return {
    tableSourceMode: "bound",
    density: table.density ?? props.density ?? "compact",
    groupBy:
      typeof table.groupBy === "string" && table.groupBy.trim()
        ? table.groupBy.trim()
        : props.groupBy,
    showToolbar: false,
    showSearch: false,
    zebraRows: table.zebraRows ?? false,
    pagination: false,
    pageSize: 100,
    schema: table.schema,
    columnOverrides: table.columnOverrides,
    valueLabels: table.valueLabels,
    conditionalRules: table.conditionalRules,
    selectionMode: table.selectionMode,
    selectionKeyFields: ["assetKey"],
    publishSelectionOutputs: table.publishSelectionOutputs,
  };
}

function pickTableSettings(value: TableWidgetProps): Partial<TableWidgetProps> {
  return {
    density: value.density,
    groupBy: value.groupBy,
    zebraRows: value.zebraRows,
    schema: value.schema,
    columnOverrides: value.columnOverrides,
    valueLabels: value.valueLabels,
    conditionalRules: value.conditionalRules,
    selectionMode: value.selectionMode,
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
  const state = useMemo(
    () =>
      resolveAssetScreenerState({
        props,
        resolvedInputs,
        runtimeDataStore,
      }),
    [props, resolvedInputs, runtimeDataStore],
  );
  const displayedColumns = state.columns;
  const sourceColumns = state.sourceColumns ?? [];
  const tableFrameInput = useMemo(
    () =>
      buildAssetScreenerTableFrame({
        columns: displayedColumns,
        rows: [],
        sourceColumns,
        sourceFrame: state.sourceFrame,
      }).frame,
    [displayedColumns, sourceColumns, state.sourceFrame],
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

  useEffect(() => {
    setColumnsText(displayedColumnsJson);
    setColumnsError(null);
  }, [displayedColumnsJson]);

  return (
    <div className="space-y-4">
      <section className={sectionClass}>
        <div>
          <h3 className={titleClass}>Screener Runtime</h3>
          <p className={descriptionClass}>
            Screener-specific runtime caps stay here. Shared density, grouping, table formatting,
            and selection outputs now live in the embedded Table Settings section below.
          </p>
        </div>
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
            Example: {"{"} "seed": {"{"} "assetKeyField": "unique_identifier",
            "symbolField": "Symbol", "valueFields": {"{"} "price": "last_price" {"}"} {"}"} {"}"}
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
            help="Source metadata lets the backend propose the table columns through meta.marketAsset, meta.tableTransforms, and meta.tableVisuals. Instance override saves only the screener column semantics locally; shared table visuals still resolve from live source metadata or shared table settings."
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
                columns:
                  nextMode === "custom"
                    ? prepareAssetScreenerColumnsForPersistence(displayedColumns)
                    : undefined,
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
              columns: prepareAssetScreenerColumnsForPersistence(normalizedColumns),
            });
            setColumnsText(
              stringifyJson(
                prepareAssetScreenerColumnsForPersistence(normalizedColumns),
              ),
            );
          }}
        />
        {columnsError ? (
          <p className="text-xs text-destructive">{columnsError}</p>
        ) : (
          <p className={descriptionClass}>
            {props.columnConfigMode === "custom"
              ? "This instance override owns the screener column semantics until you switch back to Source metadata. Shared table visuals still resolve from the live source or local table settings."
              : state.columnConfigSource === "source"
                ? "Derived from source metadata. Switch to Instance override to edit and save a local semantic copy."
                : "No source column metadata is available yet. Bind a semantic table or switch to Instance override to define local columns."}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!editable || sourceColumns.length === 0}
            type="button"
            variant="outline"
            onClick={() => {
              setColumnsText(
                stringifyJson(
                  prepareAssetScreenerColumnsForPersistence(sourceColumns),
                ),
              );
              setColumnsError(null);
              onDraftPropsChange({
                ...props,
                columnConfigMode: "custom",
                columns: prepareAssetScreenerColumnsForPersistence(sourceColumns),
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
            Screener only supplies the market-derived frame. Selection outputs are always keyed to
            the canonical asset identity (`assetKey` / `unique_identifier`) even though the shared
            table settings UI also exposes generic stable row key fields.
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
              groupBy: undefined,
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
          hideToolbarSearchToggles
          hidePaginationControls
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
