import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  ConnectionQueryField,
  QueryNumberField,
  QueryStringListField,
  QueryTextField,
} from "@/connections/components/ConnectionQueryEditorFields";

import type {
  AlpacaConnectionQuery,
  AlpacaCryptoLocation,
  AlpacaFeed,
  AlpacaQueryKind,
  AlpacaSortDirection,
} from "./index";

const equityFeeds = ["iex", "sip", "delayed_sip", "boats", "overnight", "otc"] satisfies AlpacaFeed[];
const cryptoLocations = ["us", "us-1", "us-2", "eu-1", "bs-1"] satisfies AlpacaCryptoLocation[];
const commonAlpacaTimeframes = [
  "1Min",
  "5Min",
  "15Min",
  "30Min",
  "1Hour",
  "2Hour",
  "4Hour",
  "1Day",
  "1Week",
  "1Month",
] as const;
const alpacaTimeframeHelp =
  "Alpaca bar timeframe. Use the documented bars values: 1-59Min, 1-23Hour, 1Day, 1Week, or 1/2/3/4/6/12Month. Short aliases like 5T, 1H, 1D, 1W, and 1M also work.";
type CommonAlpacaTimeframe = (typeof commonAlpacaTimeframes)[number];

function readKind(
  queryModelId: string | undefined,
  value: AlpacaConnectionQuery,
): AlpacaQueryKind {
  if (queryModelId?.startsWith("alpaca-")) {
    return queryModelId as AlpacaQueryKind;
  }

  return value.kind ?? "alpaca-equity-ohlc";
}

function patchQuery(
  value: AlpacaConnectionQuery,
  onChange: (value: AlpacaConnectionQuery) => void,
  kind: AlpacaQueryKind,
  patch: Partial<AlpacaConnectionQuery>,
) {
  onChange({
    ...value,
    ...patch,
    kind,
  });
}

function isCommonAlpacaTimeframe(value: string | undefined): value is CommonAlpacaTimeframe {
  return !!value && commonAlpacaTimeframes.includes(value as CommonAlpacaTimeframe);
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
  value?: string;
}) {
  return (
    <ConnectionQueryField help={help} label={label}>
      <Select value={value ?? ""} onChange={(event) => onChange(event.target.value || undefined)} disabled={disabled}>
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

function QueryTimeframeField({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (value: string | undefined) => void;
  value?: string;
}) {
  const selectedPreset = isCommonAlpacaTimeframe(value) ? value : "";
  const customValue = value && !isCommonAlpacaTimeframe(value) ? value : "";

  return (
    <ConnectionQueryField help={alpacaTimeframeHelp} label="Timeframe">
      <div className="space-y-2">
        <Select
          value={selectedPreset}
          onChange={(event) => onChange(event.target.value || undefined)}
          disabled={disabled}
        >
          <option value="">Use connection default</option>
          {commonAlpacaTimeframes.map((timeframe) => (
            <option key={timeframe} value={timeframe}>
              {timeframe}
            </option>
          ))}
        </Select>
        <Input
          value={customValue}
          onChange={(event) => {
            const nextValue = event.target.value.trim();
            onChange(nextValue || undefined);
          }}
          disabled={disabled}
          placeholder="Or enter custom timeframe like 12Hour or 3Month"
        />
      </div>
    </ConnectionQueryField>
  );
}

export function AlpacaConnectionQueryEditor({
  connectionInstance,
  disabled = false,
  onChange,
  queryModel,
  value,
}: ConnectionQueryEditorProps<AlpacaConnectionQuery>) {
  const kind = readKind(queryModel?.id, value);
  const isEquity = kind.startsWith("alpaca-equity-");
  const isCrypto = kind.startsWith("alpaca-crypto-");
  const isOhlc = kind.endsWith("-ohlc");
  const isHistorical = kind.includes("historical");
  const supportsPageToken = isOhlc || isHistorical;

  return (
    <div className="space-y-5">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Configured source</div>
        <div className="mt-1 break-words">
          {connectionInstance?.name ?? "Alpaca Market Data connection"}
        </div>
      </div>

      <ConnectionQueryEditorSection
        title={queryModel?.label ?? "Alpaca market data"}
        description="The backend adapter sends this payload through Alpaca's market-data REST API and returns canonical tabular frames."
      >
        <QueryStringListField
          label="Symbols"
          value={value.symbols}
          onChange={(symbols) => patchQuery(value, onChange, kind, { symbols: symbols ?? [] })}
          disabled={disabled}
          placeholder={isCrypto ? "BTC/USD, ETH/USD" : "AAPL, MSFT"}
          help="Provider symbols to request. The backend normalizes format and rejects empty or oversized lists."
        />

        {isOhlc ? (
          <QueryTimeframeField
            value={value.timeframe}
            onChange={(timeframe) => patchQuery(value, onChange, kind, { timeframe })}
            disabled={disabled}
          />
        ) : null}

        {isEquity ? (
          <QuerySelectField
            label="Feed"
            value={value.feed}
            onChange={(feed) => patchQuery(value, onChange, kind, { feed: feed as AlpacaFeed | undefined })}
            disabled={disabled}
            options={equityFeeds}
            help="Optional stock data feed override for this query. Provider entitlements determine which feeds work."
          />
        ) : null}

        {isCrypto ? (
          <QuerySelectField
            label="Crypto location"
            value={value.cryptoLocation}
            onChange={(cryptoLocation) =>
              patchQuery(value, onChange, kind, {
                cryptoLocation: cryptoLocation as AlpacaCryptoLocation | undefined,
              })
            }
            disabled={disabled}
            options={cryptoLocations}
            help="Optional crypto endpoint location override for this query."
          />
        ) : null}

        <QueryNumberField
          label="Limit"
          value={value.limit}
          min={1}
          onChange={(limit) => patchQuery(value, onChange, kind, { limit })}
          disabled={disabled}
          placeholder="1000"
          help="Provider page size or latest-record symbol budget. Maximum is enforced by the backend adapter."
        />

        {supportsPageToken ? (
          <QueryTextField
            label="Page token"
            value={value.pageToken}
            onChange={(pageToken) => patchQuery(value, onChange, kind, { pageToken })}
            disabled={disabled}
            placeholder="Provider next_page_token"
            help="Optional provider pagination token from the previous response metadata."
          />
        ) : null}

        {isHistorical ? (
          <QuerySelectField
            label="Sort"
            value={value.sort}
            onChange={(sort) =>
              patchQuery(value, onChange, kind, {
                sort: sort as AlpacaSortDirection | undefined,
              })
            }
            disabled={disabled}
            options={["asc", "desc"]}
            help="Historical trade ordering requested from Alpaca."
          />
        ) : null}
      </ConnectionQueryEditorSection>
    </div>
  );
}
