import type { ConnectionQueryEditorProps } from "@/connections/types";
import {
  ConnectionQueryEditorSection,
  QueryBooleanField,
  QueryJsonRecordField,
  QueryNumberField,
  QueryStringListField,
} from "@/connections/components/ConnectionQueryEditorFields";

import {
  DEFAULT_MAIN_SEQUENCE_DATA_NODE_ROW_LIMIT,
  type MainSequenceDataNodeConnectionPublicConfig,
  type MainSequenceDataNodeConnectionQuery,
} from "./dataNodeConnection";

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function readPublicConfig(value: unknown): MainSequenceDataNodeConnectionPublicConfig {
  return value && typeof value === "object"
    ? (value as MainSequenceDataNodeConnectionPublicConfig)
    : {};
}

function getQueryKind(
  queryModelId: string | undefined,
  value: MainSequenceDataNodeConnectionQuery,
): MainSequenceDataNodeConnectionQuery["kind"] {
  if (queryModelId === "data-node-last-observation") {
    return "data-node-last-observation";
  }

  if (queryModelId === "data-node-rows-between-dates") {
    return "data-node-rows-between-dates";
  }

  return value.kind ?? "data-node-rows-between-dates";
}

export function DataNodeConnectionQueryEditor({
  connectionInstance,
  disabled = false,
  onChange,
  queryModel,
  value,
}: ConnectionQueryEditorProps<MainSequenceDataNodeConnectionQuery>) {
  const publicConfig = readPublicConfig(connectionInstance?.publicConfig);
  const configuredDataNodeId = normalizePositiveInteger(publicConfig.dataNodeId);
  const defaultLimit =
    normalizePositiveInteger(publicConfig.defaultLimit) ?? DEFAULT_MAIN_SEQUENCE_DATA_NODE_ROW_LIMIT;
  const queryKind = getQueryKind(queryModel?.id, value);
  const query = { ...value, kind: queryKind } as MainSequenceDataNodeConnectionQuery;
  const showLegacyDataNodeField = !configuredDataNodeId;

  function updateQuery(nextQuery: MainSequenceDataNodeConnectionQuery) {
    onChange(nextQuery);
  }

  function updateDataNodeId(dataNodeId: number | undefined) {
    updateQuery({
      ...query,
      dataNodeId,
    } as MainSequenceDataNodeConnectionQuery);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Configured source</div>
        <div className="mt-1 break-words">
          {configuredDataNodeId
            ? `${publicConfig.dataNodeLabel ?? "Data Node"} · ${configuredDataNodeId}`
            : "No Data Node id is stored on this connection instance."}
        </div>
      </div>

      {queryKind === "data-node-rows-between-dates" ? (
        <ConnectionQueryEditorSection
          title="Rows between dates"
          description="These fields become the Data Node query payload. The date window is still supplied by the widget runtime range."
        >
          {showLegacyDataNodeField ? (
            <QueryNumberField
              label="Legacy Data Node id"
              value={normalizePositiveInteger(query.dataNodeId)}
              min={1}
              onChange={updateDataNodeId}
              disabled={disabled}
              help="Only used when the selected connection instance does not already store a Data Node id."
            />
          ) : null}
          <QueryStringListField
            label="Columns"
            value={"columns" in query ? query.columns : undefined}
            onChange={(columns) => {
              updateQuery({
                ...query,
                columns: columns ?? [],
              } as MainSequenceDataNodeConnectionQuery);
            }}
            disabled={disabled}
            placeholder={"unique_identifier\nvalue\nasof"}
            help="Required Data Node columns to request. Enter one column per line or comma-separated."
          />
          <QueryStringListField
            label="Unique identifiers"
            value={"unique_identifier_list" in query ? query.unique_identifier_list : undefined}
            onChange={(uniqueIdentifierList) => {
              updateQuery({
                ...query,
                unique_identifier_list: uniqueIdentifierList,
              } as MainSequenceDataNodeConnectionQuery);
            }}
            disabled={disabled}
            placeholder={"AAPL\nMSFT"}
            help="Optional Data Node unique_identifier values used to narrow the row query."
          />
          <QueryNumberField
            label="Limit"
            value={"limit" in query ? query.limit : undefined}
            min={1}
            onChange={(limit) => {
              updateQuery({
                ...query,
                limit,
              } as MainSequenceDataNodeConnectionQuery);
            }}
            disabled={disabled}
            placeholder={String(defaultLimit)}
            help="Optional Data Node API row limit. If omitted, the request maxRows and connection default are used by the backend."
          />
          <QueryBooleanField
            label="Inclusive start"
            checked={!("great_or_equal" in query) || query.great_or_equal !== false}
            onChange={(greatOrEqual) => {
              updateQuery({
                ...query,
                great_or_equal: greatOrEqual,
              } as MainSequenceDataNodeConnectionQuery);
            }}
            disabled={disabled}
            help="Maps to the Data Node great_or_equal flag."
          />
          <QueryBooleanField
            label="Inclusive end"
            checked={!("less_or_equal" in query) || query.less_or_equal !== false}
            onChange={(lessOrEqual) => {
              updateQuery({
                ...query,
                less_or_equal: lessOrEqual,
              } as MainSequenceDataNodeConnectionQuery);
            }}
            disabled={disabled}
            help="Maps to the Data Node less_or_equal flag."
          />
          <QueryJsonRecordField
            label="Identifier ranges"
            value={"unique_identifier_range_map" in query ? query.unique_identifier_range_map : undefined}
            onChange={(uniqueIdentifierRangeMap) => {
              updateQuery({
                ...query,
                unique_identifier_range_map: uniqueIdentifierRangeMap as
                  | Record<string, [number, number]>
                  | undefined,
              } as MainSequenceDataNodeConnectionQuery);
            }}
            disabled={disabled}
            placeholder={"{\n  \"AAPL\": [0, 100]\n}"}
            help="Optional unique_identifier_range_map object passed to the Data Node API."
          />
        </ConnectionQueryEditorSection>
      ) : (
        <ConnectionQueryEditorSection title="Last observation">
          {showLegacyDataNodeField ? (
            <QueryNumberField
              label="Legacy Data Node id"
              value={normalizePositiveInteger(query.dataNodeId)}
              min={1}
              onChange={updateDataNodeId}
              disabled={disabled}
              help="Only used when the selected connection instance does not already store a Data Node id."
            />
          ) : (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-sm text-muted-foreground md:col-span-2">
              This query uses the Data Node stored on the selected connection instance.
            </div>
          )}
        </ConnectionQueryEditorSection>
      )}
    </div>
  );
}
