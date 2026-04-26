import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ConnectionConfigEditorProps } from "@/connections/types";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";

import type {
  FredAggregationMethod,
  FredFrequency,
  FredPublicConfig,
  FredQueryCachePolicy,
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
const aggregationMethodOptions = ["avg", "sum", "eop"] as const;

function updateConfig(
  value: FredPublicConfig,
  onChange: (value: FredPublicConfig) => void,
  patch: Partial<FredPublicConfig>,
) {
  onChange({ ...value, ...patch });
}

function readOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function Field({
  children,
  help,
  label,
  required,
}: {
  children: React.ReactNode;
  help: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <WidgetSettingFieldLabel
        className="text-xs font-medium text-muted-foreground"
        help={help}
        required={required}
      >
        {label}
      </WidgetSettingFieldLabel>
      {children}
    </label>
  );
}

export function FredConnectionConfigEditor({
  disabled = false,
  onChange,
  value,
}: ConnectionConfigEditorProps<FredPublicConfig>) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-2">
        <Field
          label="Base URL"
          required
          help="FRED API root used by the backend adapter for all provider requests. Production default: https://api.stlouisfed.org."
        >
          <Input
            value={value.baseUrl ?? ""}
            onChange={(event) => updateConfig(value, onChange, { baseUrl: event.target.value })}
            disabled={disabled}
            placeholder="https://api.stlouisfed.org"
          />
        </Field>

        <Field
          label="Default series ID"
          help="Default FRED series id used by query editors and backend defaults when a query omits seriesId. Example: GDP."
        >
          <Input
            value={value.defaultSeriesId ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, { defaultSeriesId: event.target.value.toUpperCase() })
            }
            disabled={disabled}
            placeholder="GDP"
          />
        </Field>

        <Field
          label="Default units"
          help="Default FRED units transformation when a query omits units. Use lin for levels."
        >
          <Select
            value={value.defaultUnits ?? "lin"}
            onChange={(event) =>
              updateConfig(value, onChange, { defaultUnits: event.target.value as FredUnits })
            }
            disabled={disabled}
          >
            {unitOptions.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Default frequency"
          help="Optional FRED frequency aggregation for observations when a query omits frequency. Leave blank to use the native provider frequency."
        >
          <Select
            value={value.defaultFrequency ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, {
                defaultFrequency: (event.target.value || null) as FredFrequency | null,
              })
            }
            disabled={disabled}
          >
            <option value="">Native frequency</option>
            {frequencyOptions.map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Default aggregation method"
          help="FRED aggregation method used when frequency aggregation is requested and a query omits aggregationMethod."
        >
          <Select
            value={value.defaultAggregationMethod ?? "avg"}
            onChange={(event) =>
              updateConfig(value, onChange, {
                defaultAggregationMethod: event.target.value as FredAggregationMethod,
              })
            }
            disabled={disabled}
          >
            {aggregationMethodOptions.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Default limit"
          help="Default FRED observation page size. Valid range: 1 to 100000. The backend also respects request maxRows and provider caps."
        >
          <Input
            type="number"
            min={1}
            max={100000}
            value={value.defaultLimit ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, { defaultLimit: readOptionalNumber(event.target.value) })
            }
            disabled={disabled}
            placeholder="1000"
          />
        </Field>

        <Field
          label="Request timeout ms"
          help="Backend HTTP timeout for FRED provider calls. Valid range: 1000 to 30000 milliseconds. Default: 10000."
        >
          <Input
            type="number"
            min={1000}
            max={30000}
            value={value.requestTimeoutMs ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, {
                requestTimeoutMs: readOptionalNumber(event.target.value),
              })
            }
            disabled={disabled}
            placeholder="10000"
          />
        </Field>

        <Field
          label="Query cache policy"
          help="Backend FRED observation query cache policy. Use read for successful provider response caching or disabled to bypass query-result caching."
        >
          <Select
            value={value.queryCachePolicy ?? "read"}
            onChange={(event) =>
              updateConfig(value, onChange, {
                queryCachePolicy: event.target.value as FredQueryCachePolicy,
              })
            }
            disabled={disabled}
          >
            <option value="read">read</option>
            <option value="disabled">disabled</option>
          </Select>
        </Field>

        <Field
          label="Query cache TTL ms"
          help="Backend cache lifetime for successful FRED observation query responses in milliseconds. Default: 900000."
        >
          <Input
            type="number"
            min={0}
            value={value.queryCacheTtlMs ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, {
                queryCacheTtlMs: readOptionalNumber(event.target.value),
              })
            }
            disabled={disabled}
            placeholder="900000"
          />
        </Field>

        <Field
          label="Metadata cache TTL ms"
          help="Backend cache lifetime for FRED selector resources such as series search, releases, and vintage dates. Default: 3600000."
        >
          <Input
            type="number"
            min={0}
            value={value.metadataCacheTtlMs ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, {
                metadataCacheTtlMs: readOptionalNumber(event.target.value),
              })
            }
            disabled={disabled}
            placeholder="3600000"
          />
        </Field>

        <Field
          label="Dedupe in-flight identical queries"
          help="When enabled, the backend shares one in-flight provider request for identical cacheable FRED requests. Default: true."
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border bg-transparent accent-primary"
            checked={value.dedupeInFlight !== false}
            onChange={(event) =>
              updateConfig(value, onChange, { dedupeInFlight: event.target.checked })
            }
            disabled={disabled}
          />
        </Field>
      </section>
    </div>
  );
}
