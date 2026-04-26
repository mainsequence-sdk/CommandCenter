import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  ConnectionQueryField,
  QueryBooleanField,
  QueryJsonRecordField,
  QueryNumberField,
  QueryTextField,
} from "@/connections/components/ConnectionQueryEditorFields";

import {
  formatMassiveAssetClassLabel,
  formatMassiveQueryKindLabel,
  isMassiveQueryKind,
  massiveEndpointCatalog,
  massiveEndpointCatalogByKind,
  type MassiveConnectionQuery,
  type MassiveQueryKind,
} from "./massiveShared";

const timespanOptions = ["minute", "hour", "day", "week", "month", "quarter", "year"] as const;
const directionOptions = ["gainers", "losers"] as const;

function readKind(
  queryModelId: string | undefined,
  value: MassiveConnectionQuery,
): MassiveQueryKind {
  if (isMassiveQueryKind(queryModelId)) {
    return queryModelId;
  }

  if (isMassiveQueryKind(value.kind)) {
    return value.kind;
  }

  return massiveEndpointCatalog[0]!.kind;
}

function patchQuery(
  value: MassiveConnectionQuery,
  onChange: (value: MassiveConnectionQuery) => void,
  kind: MassiveQueryKind,
  patch: Partial<MassiveConnectionQuery>,
) {
  onChange({
    ...value,
    ...patch,
    kind,
  });
}

function updatePathParam(
  value: MassiveConnectionQuery,
  onChange: (value: MassiveConnectionQuery) => void,
  kind: MassiveQueryKind,
  key: string,
  nextValue: string | number | boolean | undefined,
) {
  const nextPathParams = { ...(value.pathParams ?? {}) };

  if (nextValue === undefined || nextValue === "") {
    delete nextPathParams[key];
  } else {
    nextPathParams[key] = nextValue;
  }

  patchQuery(value, onChange, kind, {
    pathParams: Object.keys(nextPathParams).length > 0 ? nextPathParams : undefined,
  });
}

function readPathParam(value: MassiveConnectionQuery, key: string) {
  const candidate = value.pathParams?.[key];

  if (
    typeof candidate === "string" ||
    typeof candidate === "number" ||
    typeof candidate === "boolean"
  ) {
    return candidate;
  }

  return undefined;
}

function labelForPathParam(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (value) => value.toUpperCase());
}

function helpForPathParam(key: string, providerPath: string) {
  return `Provider path parameter \`${key}\` for ${providerPath}. The backend substitutes this only into the catalog path template and rejects unknown path parameters.`;
}

function PathParamField({
  disabled,
  kind,
  onChange,
  paramKey,
  providerPath,
  value,
}: {
  disabled?: boolean;
  kind: MassiveQueryKind;
  onChange: (key: string, value: string | number | boolean | undefined) => void;
  paramKey: string;
  providerPath: string;
  value: MassiveConnectionQuery;
}) {
  const currentValue = readPathParam(value, paramKey);
  const normalizedKey = paramKey.toLowerCase();
  const label = labelForPathParam(paramKey);
  const help = helpForPathParam(paramKey, providerPath);

  if (normalizedKey === "multiplier") {
    return (
      <QueryNumberField
        label={label}
        value={typeof currentValue === "number" ? currentValue : undefined}
        min={1}
        onChange={(nextValue) => onChange(paramKey, nextValue)}
        disabled={disabled}
        placeholder="1"
        help={help}
      />
    );
  }

  if (normalizedKey === "timespan") {
    return (
      <ConnectionQueryField help={help} label={label}>
        <Select
          value={typeof currentValue === "string" ? currentValue : "day"}
          onChange={(event) => onChange(paramKey, event.target.value || undefined)}
          disabled={disabled}
        >
          {timespanOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </ConnectionQueryField>
    );
  }

  if (normalizedKey === "direction") {
    return (
      <ConnectionQueryField help={help} label={label}>
        <Select
          value={typeof currentValue === "string" ? currentValue : "gainers"}
          onChange={(event) => onChange(paramKey, event.target.value || undefined)}
          disabled={disabled}
        >
          {directionOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </ConnectionQueryField>
    );
  }

  return (
    <QueryTextField
      label={label}
      value={typeof currentValue === "string" ? currentValue : String(currentValue ?? "")}
      onChange={(nextValue) => onChange(paramKey, nextValue)}
      disabled={disabled}
      placeholder={
        kind.includes("-crypto-")
          ? "X:BTCUSD"
          : kind.includes("-forex-")
            ? "C:EURUSD"
            : "AAPL"
      }
      help={help}
    />
  );
}

export function MassiveConnectionQueryEditor({
  connectionInstance,
  disabled = false,
  onChange,
  queryModel,
  value,
}: ConnectionQueryEditorProps<MassiveConnectionQuery>) {
  const kind = readKind(queryModel?.id, value);
  const catalogEntry = massiveEndpointCatalogByKind.get(kind) ?? massiveEndpointCatalog[0]!;
  const queryValue = value.kind === kind ? value : catalogEntry.defaultQuery;

  return (
    <div className="space-y-5">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Configured source</div>
        <div className="mt-1 break-words">
          {connectionInstance?.name ?? "Massive Market Data connection"}
        </div>
      </div>

      <ConnectionQueryEditorSection
        title={queryModel?.label ?? formatMassiveQueryKindLabel(kind)}
        description="The backend adapter resolves this catalog kind to a Massive REST GET endpoint and returns one canonical tabular frame."
      >
        <div className="md:col-span-2 flex flex-wrap gap-2">
          <Badge variant="neutral">{formatMassiveAssetClassLabel(catalogEntry.assetClass)}</Badge>
          {catalogEntry.beta ? <Badge variant="secondary">beta</Badge> : null}
          {catalogEntry.deprecated ? <Badge variant="secondary">deprecated</Badge> : null}
          <Badge variant="neutral">tabular</Badge>
        </div>

        <div className="md:col-span-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs">
          <div className="font-medium text-foreground">Provider path</div>
          <code className="mt-1 block break-all text-[11px] text-muted-foreground">
            {catalogEntry.providerPath}
          </code>
        </div>

        {catalogEntry.pathParamKeys.map((paramKey) => (
          <PathParamField
            key={paramKey}
            kind={kind}
            paramKey={paramKey}
            providerPath={catalogEntry.providerPath}
            value={queryValue}
            onChange={(key, nextValue) =>
              updatePathParam(queryValue, onChange, kind, key, nextValue)
            }
            disabled={disabled}
          />
        ))}

        <QueryJsonRecordField
          label="Provider query params"
          value={queryValue.params}
          onChange={(params) => patchQuery(queryValue, onChange, kind, { params })}
          disabled={disabled}
          placeholder={JSON.stringify(catalogEntry.defaultQuery.params ?? {}, null, 2)}
          help="Provider query parameters for this catalog entry. The backend allowlist rejects unknown parameters and strips credentials from logs, cache keys, traces, exceptions, and pagination metadata."
        />

        <QueryBooleanField
          label="Follow provider pages"
          checked={queryValue.followPages === true}
          onChange={(followPages) => patchQuery(queryValue, onChange, kind, { followPages })}
          disabled={disabled}
          help="When enabled, the backend may follow safe Massive next_url pagination while the effective maxRows budget has not been reached."
        />
      </ConnectionQueryEditorSection>
    </div>
  );
}
