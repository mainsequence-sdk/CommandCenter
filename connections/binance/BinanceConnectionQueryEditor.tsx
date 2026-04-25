import { Input } from "@/components/ui/input";
import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  QueryNumberField,
  QueryStringListField,
  QueryTextField,
} from "@/connections/components/ConnectionQueryEditorFields";

import type { BinanceConnectionQuery, BinanceQueryKind } from "./index";

function readKind(
  queryModelId: string | undefined,
  value: BinanceConnectionQuery,
): BinanceQueryKind {
  if (queryModelId?.startsWith("binance-")) {
    return queryModelId as BinanceQueryKind;
  }

  return value.kind ?? "binance-spot-prices";
}

function patchQuery(
  value: BinanceConnectionQuery,
  onChange: (value: BinanceConnectionQuery) => void,
  kind: BinanceQueryKind,
  patch: Partial<BinanceConnectionQuery>,
) {
  onChange({
    ...value,
    ...patch,
    kind,
  });
}

export function BinanceConnectionQueryEditor({
  connectionInstance,
  disabled = false,
  onChange,
  queryModel,
  value,
}: ConnectionQueryEditorProps<BinanceConnectionQuery>) {
  const kind = readKind(queryModel?.id, value);
  const isOhlc = kind.endsWith("-ohlc");
  const isAggregateTrades = kind.endsWith("-aggregate-trades");

  return (
    <div className="space-y-5">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Configured source</div>
        <div className="mt-1 break-words">
          {connectionInstance?.name ?? "Binance Market Data connection"}
        </div>
      </div>

      <ConnectionQueryEditorSection
        title={queryModel?.label ?? "Binance market data"}
        description="The backend adapter sends this payload through Binance public market-data REST APIs and returns one canonical tabular frame."
      >
        <QueryStringListField
          label="Symbols"
          value={value.symbols}
          onChange={(symbols) => patchQuery(value, onChange, kind, { symbols: symbols ?? [] })}
          disabled={disabled}
          placeholder="BTCUSDT, ETHUSDT"
          help="Provider symbols to request. The backend uppercases symbols and rejects unsupported symbols when exchange-info metadata is available."
        />

        {isOhlc ? (
          <QueryTextField
            label="Interval"
            value={value.interval}
            onChange={(interval) => patchQuery(value, onChange, kind, { interval })}
            disabled={disabled}
            placeholder="1m"
            help="Binance kline interval such as 1m, 5m, 1h, or 1d."
          />
        ) : null}

        <QueryNumberField
          label="Limit"
          value={value.limit}
          min={1}
          onChange={(limit) => patchQuery(value, onChange, kind, { limit })}
          disabled={disabled}
          placeholder="1000"
          help="Provider row limit. Backend caps this to each Binance endpoint maximum."
        />

        {isAggregateTrades ? (
          <>
            <QueryNumberField
              label="From ID"
              value={value.fromId}
              min={0}
              onChange={(fromId) => patchQuery(value, onChange, kind, { fromId })}
              disabled={disabled}
              placeholder="Optional aggregate trade id"
              help="Optional aggregate trade id cursor. When present, the backend omits startTime and endTime."
            />
          </>
        ) : null}

        {isOhlc ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Time zone</span>
            <Input
              value={value.timeZone ?? ""}
              onChange={(event) =>
                patchQuery(value, onChange, kind, { timeZone: event.target.value || undefined })
              }
              disabled={disabled}
              placeholder="Spot klines only"
            />
            <span className="block text-[11px] leading-4 text-muted-foreground">
              Optional Binance spot kline timeZone. USD-M futures ignores this field.
            </span>
          </label>
        ) : null}
      </ConnectionQueryEditorSection>
    </div>
  );
}
