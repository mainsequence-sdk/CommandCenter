import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  assetScreenerDefaultColumns,
  normalizeAssetScreenerProps,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";

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

export function AssetScreenerWidgetSettings({
  draftProps,
  onDraftPropsChange,
  editable,
}: Props) {
  const props = normalizeAssetScreenerProps(draftProps);
  const [mappingText, setMappingText] = useState(() => stringifyJson(props.fieldMappings ?? {}));
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [columnsText, setColumnsText] = useState(() => stringifyJson(props.columns ?? assetScreenerDefaultColumns));
  const [columnsError, setColumnsError] = useState<string | null>(null);
  const groupableColumns = useMemo(
    () =>
      (props.columns ?? []).filter((column) =>
        column.kind === "asset-field" && column.groupable !== false,
      ) as Array<Extract<NonNullable<typeof props.columns>[number], { kind: "asset-field" }>>,
    [props.columns],
  );

  return (
    <div className="space-y-4">
      <section className={sectionClass}>
        <div>
          <h3 className={titleClass}>Screener Layout</h3>
          <p className={descriptionClass}>
            Configure row density, grouping, and bounded rendering. Data still comes from widget
            bindings.
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
            Optional overrides for generic tabular frames. Semantic market frames can auto-map from
            their field-role metadata.
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
            sparkline columns by pointing each column at a `valueField` such as `price`, `volume`,
            or `marketCap`.
          </p>
        </div>
        <Textarea
          className="min-h-[220px] font-mono text-xs"
          disabled={!editable}
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
              columns: normalizedColumns,
            });
            setColumnsText(stringifyJson(normalizedColumns));
          }}
        />
        {columnsError ? (
          <p className="text-xs text-destructive">{columnsError}</p>
        ) : (
          <p className={descriptionClass}>
            Example dynamic metric column: {"{"} "id": "volume", "kind": "latest-value",
            "label": "Volume", "valueField": "volume", "format": "volume" {"}"}.
          </p>
        )}
        <Button
          disabled={!editable}
          type="button"
          variant="outline"
          onClick={() => {
            setColumnsText(stringifyJson(assetScreenerDefaultColumns));
            setColumnsError(null);
            onDraftPropsChange({
              ...props,
              columns: assetScreenerDefaultColumns,
            });
          }}
        >
          Reset Default Columns
        </Button>
      </section>
    </div>
  );
}
