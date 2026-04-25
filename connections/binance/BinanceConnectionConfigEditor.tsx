import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ConnectionConfigEditorProps } from "@/connections/types";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";

import type { BinanceMarketType, BinancePublicConfig, BinanceQueryCachePolicy } from "./index";

const marketTypeOptions = [
  { label: "Spot", value: "spot" },
  { label: "USD-M futures", value: "usdm_futures" },
] satisfies Array<{ label: string; value: BinanceMarketType }>;

function normalizeMarketTypes(value: BinancePublicConfig["marketTypes"]) {
  const fallback: BinanceMarketType[] = ["spot"];
  return Array.isArray(value) && value.length > 0 ? value : fallback;
}

function readOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function updateConfig(
  value: BinancePublicConfig,
  onChange: (value: BinancePublicConfig) => void,
  patch: Partial<BinancePublicConfig>,
) {
  onChange({ ...value, ...patch });
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

export function BinanceConnectionConfigEditor({
  disabled = false,
  onChange,
  value,
}: ConnectionConfigEditorProps<BinancePublicConfig>) {
  const marketTypes = normalizeMarketTypes(value.marketTypes);

  function toggleMarketType(marketType: BinanceMarketType, checked: boolean) {
    const nextMarketTypes = checked
      ? Array.from(new Set([...marketTypes, marketType]))
      : marketTypes.filter((entry) => entry !== marketType);

    updateConfig(value, onChange, {
      marketTypes: nextMarketTypes.length > 0 ? nextMarketTypes : ["spot"],
    });
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-2">
        <Field
          label="Spot base URL"
          help="Binance Spot REST API root used by the backend adapter for spot prices, klines, and trades. Default: https://api.binance.com."
        >
          <Input
            value={value.spotBaseUrl ?? ""}
            onChange={(event) => updateConfig(value, onChange, { spotBaseUrl: event.target.value })}
            disabled={disabled}
            placeholder="https://api.binance.com"
          />
        </Field>

        <Field
          label="USD-M futures base URL"
          help="Binance USD-M Futures REST API root used by the backend adapter for futures prices, klines, and trades. Default: https://fapi.binance.com."
        >
          <Input
            value={value.usdmFuturesBaseUrl ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, { usdmFuturesBaseUrl: event.target.value })
            }
            disabled={disabled}
            placeholder="https://fapi.binance.com"
          />
        </Field>
      </section>

      <section className="space-y-2">
        <WidgetSettingFieldLabel
          className="text-xs font-medium text-muted-foreground"
          help="Market types enabled for this connection. The backend rejects queries for disabled market types. Default: spot."
          required
        >
          Market types
        </WidgetSettingFieldLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {marketTypeOptions.map((option) => (
            <label
              key={option.value}
              className="flex min-h-10 items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-transparent accent-primary"
                checked={marketTypes.includes(option.value)}
                onChange={(event) => toggleMarketType(option.value, event.target.checked)}
                disabled={disabled}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Field
          label="Default quote asset"
          help="Default quote asset used by frontend symbol helpers and backend metadata filtering when applicable. Example: USDT."
        >
          <Input
            value={value.defaultQuoteAsset ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, { defaultQuoteAsset: event.target.value })
            }
            disabled={disabled}
            placeholder="USDT"
          />
        </Field>

        <Field
          label="Default interval"
          help="Default Binance kline interval used by OHLC queries when a query does not override it. Example: 1m."
        >
          <Input
            value={value.defaultInterval ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, { defaultInterval: event.target.value })
            }
            disabled={disabled}
            placeholder="1m"
          />
        </Field>

        <Field
          label="Default limit"
          help="Default provider row limit for market-data requests. Spot klines cap at 1000, USD-M futures klines cap at 1500, and trade endpoints cap at 1000."
        >
          <Input
            type="number"
            min={1}
            max={1500}
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
          help="Backend HTTP timeout for Binance provider calls. Valid range: 1000 to 30000 milliseconds. Default: 10000."
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
          help="Backend market-data query cache policy. Use read for short-lived provider response caching or disabled to bypass query-result caching."
        >
          <Select
            value={value.queryCachePolicy ?? "read"}
            onChange={(event) =>
              updateConfig(value, onChange, {
                queryCachePolicy: event.target.value as BinanceQueryCachePolicy,
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
          help="Backend cache lifetime for successful market-data query responses in milliseconds. Default: 30000."
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
            placeholder="30000"
          />
        </Field>

        <Field
          label="Metadata cache TTL ms"
          help="Backend cache lifetime for exchange-info symbol metadata in milliseconds. Default: 300000."
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
            placeholder="300000"
          />
        </Field>
      </section>

      <label className="flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2.5">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border bg-transparent accent-primary"
          checked={value.dedupeInFlight ?? true}
          onChange={(event) =>
            updateConfig(value, onChange, { dedupeInFlight: event.target.checked })
          }
          disabled={disabled}
        />
        <WidgetSettingFieldLabel
          help="When enabled, the backend shares one in-flight provider request for identical Binance queries. Default: true."
          textClassName="text-sm font-medium text-foreground"
        >
          Dedupe in-flight identical queries
        </WidgetSettingFieldLabel>
      </label>
    </div>
  );
}
