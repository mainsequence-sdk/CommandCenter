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
          <QueryTextField
            label="Timeframe"
            value={value.timeframe}
            onChange={(timeframe) => patchQuery(value, onChange, kind, { timeframe })}
            disabled={disabled}
            placeholder="1Min"
            help="Alpaca bar timeframe such as 1Min, 5Min, 1Hour, or 1Day."
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
