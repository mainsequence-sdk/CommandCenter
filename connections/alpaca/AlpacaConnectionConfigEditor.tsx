import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ConnectionConfigEditorProps } from "@/connections/types";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";

import type {
  AlpacaAssetClass,
  AlpacaCryptoLocation,
  AlpacaFeed,
  AlpacaPublicConfig,
  AlpacaQueryCachePolicy,
  AlpacaWebSocketCryptoLocation,
  AlpacaWebSocketStockFeed,
} from "./index";

const assetClassOptions = [
  { label: "US equities", value: "us_equity" },
  { label: "Crypto", value: "crypto" },
] satisfies Array<{ label: string; value: AlpacaAssetClass }>;

const feedOptions = [
  "iex",
  "sip",
  "delayed_sip",
  "boats",
  "overnight",
  "otc",
] satisfies AlpacaFeed[];

const cryptoLocationOptions = ["us", "us-1", "us-2", "eu-1", "bs-1"] satisfies AlpacaCryptoLocation[];
const webSocketEquityFeedOptions = [
  "iex",
  "sip",
  "delayed_sip",
  "boats",
  "overnight",
] satisfies AlpacaWebSocketStockFeed[];
const webSocketCryptoLocationOptions = [
  "us",
  "us-1",
  "eu-1",
] satisfies AlpacaWebSocketCryptoLocation[];

function normalizeAssetClasses(value: AlpacaPublicConfig["assetClasses"]) {
  const defaultAssetClasses: AlpacaAssetClass[] = ["us_equity"];
  return Array.isArray(value) && value.length > 0 ? value : defaultAssetClasses;
}

function updateConfig(
  value: AlpacaPublicConfig,
  onChange: (value: AlpacaPublicConfig) => void,
  patch: Partial<AlpacaPublicConfig>,
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

export function AlpacaConnectionConfigEditor({
  disabled = false,
  onChange,
  value,
}: ConnectionConfigEditorProps<AlpacaPublicConfig>) {
  const assetClasses = normalizeAssetClasses(value.assetClasses);

  function toggleAssetClass(assetClass: AlpacaAssetClass, checked: boolean) {
    const nextAssetClasses = checked
      ? Array.from(new Set([...assetClasses, assetClass]))
      : assetClasses.filter((entry) => entry !== assetClass);

    updateConfig(value, onChange, {
      assetClasses: nextAssetClasses.length > 0 ? nextAssetClasses : ["us_equity"],
    });
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-2">
        <Field
          label="Data base URL"
          required
          help="Alpaca Market Data API root used by the backend adapter for bars, trades, and quotes. Default: https://data.alpaca.markets."
        >
          <Input
            value={value.dataBaseUrl ?? ""}
            onChange={(event) => updateConfig(value, onChange, { dataBaseUrl: event.target.value })}
            disabled={disabled}
            placeholder="https://data.alpaca.markets"
          />
        </Field>

        <Field
          label="Trading base URL"
          help="Alpaca Trading API root used by the backend adapter for provider asset metadata. Default: https://paper-api.alpaca.markets."
        >
          <Input
            value={value.tradingBaseUrl ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, { tradingBaseUrl: event.target.value })
            }
            disabled={disabled}
            placeholder="https://paper-api.alpaca.markets"
          />
        </Field>
      </section>

      <section className="space-y-2">
        <WidgetSettingFieldLabel
          className="text-xs font-medium text-muted-foreground"
          help="Asset classes enabled for this connection. The backend rejects queries for disabled classes. Default: us_equity."
          required
        >
          Asset classes
        </WidgetSettingFieldLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {assetClassOptions.map((option) => (
            <label
              key={option.value}
              className="flex min-h-10 items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-transparent accent-primary"
                checked={assetClasses.includes(option.value)}
                onChange={(event) => toggleAssetClass(option.value, event.target.checked)}
                disabled={disabled}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Field
          label="Equity feed"
          help="Default Alpaca stock market-data feed for equity queries. IEX works for basic plans; SIP and other feeds require provider entitlements."
        >
          <Select
            value={value.feed ?? "iex"}
            onChange={(event) => updateConfig(value, onChange, { feed: event.target.value as AlpacaFeed })}
            disabled={disabled}
          >
            {feedOptions.map((feed) => (
              <option key={feed} value={feed}>
                {feed}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Crypto location"
          help="Default Alpaca crypto market-data location used by crypto bars and trades endpoints. Default: us."
        >
          <Select
            value={value.cryptoLocation ?? "us"}
            onChange={(event) =>
              updateConfig(value, onChange, {
                cryptoLocation: event.target.value as AlpacaCryptoLocation,
              })
            }
            disabled={disabled}
          >
            {cryptoLocationOptions.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Default timeframe"
          help="Default Alpaca timeframe used by OHLC bar queries when a query does not override it. Use Alpaca's documented bars values such as 1Min, 5Min, 1Hour, 1Day, 1Week, 1Month, or aliases like 5T and 1H."
        >
          <Input
            value={value.defaultTimeframe ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, { defaultTimeframe: event.target.value })
            }
            disabled={disabled}
            placeholder="1Min or 5T"
          />
        </Field>

        <Field
          label="Default limit"
          help="Default provider page size for market-data requests. Valid range: 1 to 10000. Default: 1000."
        >
          <Input
            type="number"
            min={1}
            max={10000}
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
          help="Backend HTTP timeout for Alpaca provider calls. Valid range: 1000 to 30000 milliseconds. Default: 10000."
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
                queryCachePolicy: event.target.value as AlpacaQueryCachePolicy,
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
          help="Backend cache lifetime for successful market-data query responses in milliseconds. Default: 15000."
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
            placeholder="15000"
          />
        </Field>

        <Field
          label="Metadata cache TTL ms"
          help="Backend cache lifetime for provider asset metadata in milliseconds. Default: 300000."
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

      <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/20 p-4">
        <div>
          <div className="text-sm font-semibold text-foreground">WebSocket streams</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional backend-owned defaults for Alpaca live subscriptions opened through the generic
            stream-query route.
          </p>
        </div>

        <section className="grid gap-4 xl:grid-cols-2">
          <Field
            label="WebSocket base URL"
            help="Alpaca production Market Data WebSocket root used only by the backend adapter. Default: wss://stream.data.alpaca.markets."
          >
            <Input
              value={value.webSocketBaseUrl ?? ""}
              onChange={(event) => updateConfig(value, onChange, { webSocketBaseUrl: event.target.value })}
              disabled={disabled}
              placeholder="wss://stream.data.alpaca.markets"
            />
          </Field>

          <Field
            label="WebSocket sandbox base URL"
            help="Alpaca sandbox Market Data WebSocket root used only when WebSocket sandbox mode is enabled."
          >
            <Input
              value={value.webSocketSandboxBaseUrl ?? ""}
              onChange={(event) =>
                updateConfig(value, onChange, { webSocketSandboxBaseUrl: event.target.value })
              }
              disabled={disabled}
              placeholder="wss://stream.data.sandbox.alpaca.markets"
            />
          </Field>

          <Field
            label="WebSocket equity feed"
            help="Default Alpaca equity WebSocket feed for live trades, quotes, and bars. IEX works for basic plans; SIP and other feeds require provider entitlements."
          >
            <Select
              value={value.webSocketStockFeed ?? "iex"}
              onChange={(event) =>
                updateConfig(value, onChange, {
                  webSocketStockFeed: event.target.value as AlpacaWebSocketStockFeed,
                })
              }
              disabled={disabled}
            >
              {webSocketEquityFeedOptions.map((feed) => (
                <option key={feed} value={feed}>
                  {feed}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="WebSocket crypto location"
            help="Default Alpaca crypto WebSocket location for live trades, quotes, and bars. Unsupported REST-only locations are rejected for streams."
          >
            <Select
              value={value.webSocketCryptoLocation ?? "us"}
              onChange={(event) =>
                updateConfig(value, onChange, {
                  webSocketCryptoLocation: event.target.value as AlpacaWebSocketCryptoLocation,
                })
              }
              disabled={disabled}
            >
              {webSocketCryptoLocationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="WebSocket auth timeout ms"
            help="Alpaca provider authentication timeout for backend-owned WebSocket sessions. Must be at most 10000 milliseconds."
          >
            <Input
              type="number"
              min={1}
              max={10000}
              value={value.webSocketAuthTimeoutMs ?? ""}
              onChange={(event) =>
                updateConfig(value, onChange, {
                  webSocketAuthTimeoutMs: readOptionalNumber(event.target.value),
                })
              }
              disabled={disabled}
              placeholder="10000"
            />
          </Field>

          <Field
            label="Provider WS endpoint limit"
            help="Documents Alpaca's provider connection limit per endpoint. Keep at 1 unless the backend adapter and provider plan explicitly support more."
          >
            <Input
              type="number"
              min={1}
              value={value.webSocketProviderConnectionLimitPerEndpoint ?? ""}
              onChange={(event) =>
                updateConfig(value, onChange, {
                  webSocketProviderConnectionLimitPerEndpoint: readOptionalNumber(
                    event.target.value,
                  ),
                })
              }
              disabled={disabled}
              placeholder="1"
            />
          </Field>
        </section>

        <label className="flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2.5">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border bg-transparent accent-primary"
            checked={value.webSocketUseSandbox ?? false}
            onChange={(event) =>
              updateConfig(value, onChange, { webSocketUseSandbox: event.target.checked })
            }
            disabled={disabled}
          />
          <WidgetSettingFieldLabel
            help="Route live Alpaca subscriptions through the sandbox WebSocket host. HTTP REST routes continue to use their own configured base URLs."
            textClassName="text-sm font-medium text-foreground"
          >
            Use WebSocket sandbox
          </WidgetSettingFieldLabel>
        </label>
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
          help="When enabled, the backend shares one in-flight provider request for identical Alpaca queries. Default: true."
          textClassName="text-sm font-medium text-foreground"
        >
          Dedupe in-flight identical queries
        </WidgetSettingFieldLabel>
      </label>
    </div>
  );
}
