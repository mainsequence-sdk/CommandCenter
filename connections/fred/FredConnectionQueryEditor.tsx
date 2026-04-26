import { Select } from "@/components/ui/select";
import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  ConnectionQueryField,
  QueryNumberField,
  QueryTextField,
} from "@/connections/components/ConnectionQueryEditorFields";

import type {
  FredAggregationMethod,
  FredConnectionQuery,
  FredFrequency,
  FredQueryKind,
  FredSortOrder,
  FredUnits,
} from "./index";

const unitOptions = ["lin", "chg", "ch1", "pch", "pc1", "pca", "cch", "cca", "log"] as const;
const frequencyOptions = [
  "d",
  "w",
  "bw",
  "m",
  "q",
  "sa",
  "a",
  "wef",
  "weth",
  "wew",
  "wetu",
  "wem",
  "wesu",
  "wesa",
  "bwew",
  "bwem",
] as const;

function readKind(queryModelId: string | undefined, value: FredConnectionQuery): FredQueryKind {
  if (queryModelId === "fred-series-observations") {
    return queryModelId;
  }

  return value.kind ?? "fred-series-observations";
}

function patchQuery(
  value: FredConnectionQuery,
  onChange: (value: FredConnectionQuery) => void,
  kind: FredQueryKind,
  patch: Partial<FredConnectionQuery>,
) {
  onChange({
    ...value,
    ...patch,
    kind,
  });
}

function normalizeSeriesId(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function QuerySelectField({
  disabled,
  help,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  help: string;
  label: string;
  onChange: (value: string | undefined) => void;
  options: readonly string[];
  value?: string | null;
}) {
  return (
    <ConnectionQueryField help={help} label={label}>
      <Select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        disabled={disabled}
      >
        <option value="">Use connection default</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </ConnectionQueryField>
  );
}

export function FredConnectionQueryEditor({
  connectionInstance,
  disabled = false,
  onChange,
  queryModel,
  value,
}: ConnectionQueryEditorProps<FredConnectionQuery>) {
  const kind = readKind(queryModel?.id, value);
  const defaultSeriesId =
    typeof connectionInstance?.publicConfig.defaultSeriesId === "string"
      ? connectionInstance.publicConfig.defaultSeriesId
      : "GDP";

  return (
    <div className="space-y-5">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Configured source</div>
        <div className="mt-1 break-words">
          {connectionInstance?.name ?? "FRED Economic Data connection"}
        </div>
      </div>

      <ConnectionQueryEditorSection
        title={queryModel?.label ?? "FRED series observations"}
        description="The backend adapter sends this payload to FRED's series observations endpoint and returns one canonical tabular frame."
      >
        <QueryTextField
          label="Series ID"
          value={value.seriesId}
          onChange={(seriesId) =>
            patchQuery(value, onChange, kind, {
              seriesId: seriesId ? normalizeSeriesId(seriesId) : undefined,
            })
          }
          disabled={disabled}
          placeholder={defaultSeriesId}
          help="Required FRED series id such as GDP, UNRATE, CPIAUCSL, or FEDFUNDS. The backend rejects missing ids before provider calls."
        />

        <QuerySelectField
          label="Units"
          value={value.units}
          onChange={(units) => patchQuery(value, onChange, kind, { units: units as FredUnits })}
          disabled={disabled}
          options={unitOptions}
          help="Optional FRED units transformation. Use lin for levels or provider-supported change and percent-change transformations."
        />

        <QuerySelectField
          label="Frequency"
          value={value.frequency}
          onChange={(frequency) =>
            patchQuery(value, onChange, kind, {
              frequency: frequency as FredFrequency | undefined,
            })
          }
          disabled={disabled}
          options={frequencyOptions}
          help="Optional FRED frequency aggregation. Leave blank to use the series native frequency."
        />

        <QuerySelectField
          label="Aggregation method"
          value={value.aggregationMethod}
          onChange={(aggregationMethod) =>
            patchQuery(value, onChange, kind, {
              aggregationMethod: aggregationMethod as FredAggregationMethod | undefined,
            })
          }
          disabled={disabled}
          options={["avg", "sum", "eop"]}
          help="Aggregation method used by FRED when frequency aggregation is requested."
        />

        <QueryTextField
          label="Realtime start"
          value={value.realtimeStart}
          onChange={(realtimeStart) => patchQuery(value, onChange, kind, { realtimeStart })}
          disabled={disabled}
          placeholder="YYYY-MM-DD"
          help="Optional FRED realtime_start date for vintage-aware observations."
        />

        <QueryTextField
          label="Realtime end"
          value={value.realtimeEnd}
          onChange={(realtimeEnd) => patchQuery(value, onChange, kind, { realtimeEnd })}
          disabled={disabled}
          placeholder="YYYY-MM-DD"
          help="Optional FRED realtime_end date for vintage-aware observations."
        />

        <QueryTextField
          label="Vintage dates"
          value={value.vintageDates}
          onChange={(vintageDates) => patchQuery(value, onChange, kind, { vintageDates })}
          disabled={disabled}
          placeholder="2020-01-01,2021-01-01"
          help="Optional comma-separated FRED vintage_dates parameter when comparing specific vintages."
        />

        <QueryNumberField
          label="Limit"
          value={value.limit}
          min={1}
          onChange={(limit) => patchQuery(value, onChange, kind, { limit })}
          disabled={disabled}
          placeholder="1000"
          help="Observation page size. Backend caps this to the connection default, request maxRows, query limit, and FRED maximum of 100000."
        />

        <QueryNumberField
          label="Offset"
          value={value.offset}
          min={0}
          onChange={(offset) => patchQuery(value, onChange, kind, { offset })}
          disabled={disabled}
          placeholder="0"
          help="Provider pagination offset. The first adapter does not auto-follow pages."
        />

        <QuerySelectField
          label="Sort order"
          value={value.sortOrder}
          onChange={(sortOrder) =>
            patchQuery(value, onChange, kind, {
              sortOrder: sortOrder as FredSortOrder | undefined,
            })
          }
          disabled={disabled}
          options={["asc", "desc"]}
          help="Observation sort order requested from FRED."
        />
      </ConnectionQueryEditorSection>
    </div>
  );
}
