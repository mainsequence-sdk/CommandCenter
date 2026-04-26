import { Select } from "@/components/ui/select";
import { getConnectionTypeById } from "@/app/registry";
import {
  ConnectionQueryField,
  QueryNumberField,
  QueryStringListField,
  QueryTextField,
} from "@/connections/components/ConnectionQueryEditorFields";
import type { ConnectionQueryModel } from "@/connections/types";
import type {
  WidgetFieldCanvasRendererProps,
  WidgetFieldSettingsRendererProps,
  WidgetSettingsSchema,
} from "@/widgets/types";

import {
  normalizeConnectionQueryProps,
  type ConnectionQueryWidgetProps,
} from "./connectionQueryModel";

type ConnectionQueryControlId =
  | "symbols"
  | "timeframe"
  | "feed"
  | "cryptoLocation"
  | "interval"
  | "limit"
  | "pageToken"
  | "sort"
  | "fromId"
  | "timeZone";

interface ConnectionQueryControlDefinition {
  id: ConnectionQueryControlId;
  label: string;
  description: string;
  settingsColumnSpan?: 1 | 2;
}

const alpacaTimeframes = [
  ...Array.from({ length: 59 }, (_, index) => `${index + 1}Min`),
  ...Array.from({ length: 23 }, (_, index) => `${index + 1}Hour`),
  "1Day",
  "1Week",
  "1Month",
  "2Month",
  "3Month",
  "4Month",
  "6Month",
  "12Month",
] as const;

const binanceIntervals = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
] as const;

const equityFeeds = ["iex", "sip", "delayed_sip", "boats", "overnight", "otc"] as const;
const cryptoLocations = ["us", "us-1", "us-2", "eu-1", "bs-1"] as const;
const sortDirections = ["asc", "desc"] as const;

const controlDefinitions = [
  {
    id: "symbols",
    label: "Symbols",
    description:
      "Provider symbols sent in the selected connection query payload.",
    settingsColumnSpan: 2,
  },
  {
    id: "timeframe",
    label: "Timeframe",
    description:
      "OHLC bar timeframe sent in the selected connection query payload.",
    settingsColumnSpan: 1,
  },
  {
    id: "feed",
    label: "Feed",
    description:
      "Equity market-data feed override sent in the selected connection query payload.",
    settingsColumnSpan: 1,
  },
  {
    id: "cryptoLocation",
    label: "Crypto location",
    description:
      "Crypto market-data location override sent in the selected connection query payload.",
    settingsColumnSpan: 1,
  },
  {
    id: "interval",
    label: "Interval",
    description:
      "Kline interval sent in the selected connection query payload.",
    settingsColumnSpan: 1,
  },
  {
    id: "limit",
    label: "Limit",
    description:
      "Provider row limit or page size sent in the selected connection query payload.",
    settingsColumnSpan: 1,
  },
  {
    id: "pageToken",
    label: "Page token",
    description:
      "Provider pagination token sent in the selected connection query payload.",
    settingsColumnSpan: 1,
  },
  {
    id: "sort",
    label: "Sort",
    description:
      "Provider sort order sent in the selected connection query payload.",
    settingsColumnSpan: 1,
  },
  {
    id: "fromId",
    label: "From ID",
    description:
      "Provider trade cursor sent in the selected connection query payload.",
    settingsColumnSpan: 1,
  },
  {
    id: "timeZone",
    label: "Time zone",
    description:
      "Provider kline time zone sent in the selected connection query payload when supported.",
    settingsColumnSpan: 1,
  },
] satisfies ConnectionQueryControlDefinition[];

function getControlFieldId(controlId: ConnectionQueryControlId) {
  return `connectionQuery.${controlId}`;
}

function getControlIdFromFieldId(fieldId: string): ConnectionQueryControlId | undefined {
  const controlId = fieldId.replace(/^connectionQuery\./, "");

  return controlDefinitions.some((control) => control.id === controlId)
    ? (controlId as ConnectionQueryControlId)
    : undefined;
}

function resolveQueryModel(props: ConnectionQueryWidgetProps) {
  const normalizedProps = normalizeConnectionQueryProps(props);
  const connectionType = normalizedProps.connectionRef?.typeId
    ? getConnectionTypeById(normalizedProps.connectionRef.typeId)
    : undefined;

  return normalizedProps.queryModelId
    ? connectionType?.queryModels?.find((model) => model.id === normalizedProps.queryModelId)
    : undefined;
}

function queryModelIncludesControl(
  queryModel: ConnectionQueryModel | undefined,
  controlId: ConnectionQueryControlId,
) {
  return queryModel?.controls?.includes(controlId) === true;
}

function readQueryControlValue(
  props: ConnectionQueryWidgetProps,
  queryModel: ConnectionQueryModel | undefined,
  controlId: ConnectionQueryControlId,
) {
  const normalizedProps = normalizeConnectionQueryProps(props);
  const query = normalizedProps.query ?? {};

  if (Object.prototype.hasOwnProperty.call(query, controlId)) {
    return query[controlId];
  }

  return queryModel?.defaultQuery?.[controlId];
}

function updateQueryControlValue(
  props: ConnectionQueryWidgetProps,
  queryModel: ConnectionQueryModel,
  controlId: ConnectionQueryControlId,
  value: unknown,
): ConnectionQueryWidgetProps {
  const normalizedProps = normalizeConnectionQueryProps(props);
  const nextQuery: Record<string, unknown> = {
    ...(normalizedProps.query ?? {}),
    kind: queryModel.id,
  };

  if (value === undefined || value === "") {
    delete nextQuery[controlId];
  } else {
    nextQuery[controlId] = value;
  }

  return {
    ...props,
    query: nextQuery,
  };
}

function QuerySelectField({
  disabled,
  help,
  hideLabel = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  help: string;
  hideLabel?: boolean;
  label: string;
  onChange: (value: string | undefined) => void;
  options: readonly string[];
  value?: unknown;
}) {
  const stringValue = typeof value === "string" ? value : "";

  return (
    <ConnectionQueryField help={help} hideLabel={hideLabel} label={label}>
      <Select
        value={stringValue}
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

function ConnectionQueryControlField({
  controlId,
  disabled,
  showLabel,
  onChange,
  props,
}: {
  controlId: ConnectionQueryControlId;
  disabled: boolean;
  showLabel: boolean;
  onChange: (props: ConnectionQueryWidgetProps) => void;
  props: ConnectionQueryWidgetProps;
}) {
  const queryModel = resolveQueryModel(props);
  const control = controlDefinitions.find((definition) => definition.id === controlId);

  if (!queryModel || !control) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-4 text-sm text-muted-foreground">
        Select a connection path before editing this setting.
      </div>
    );
  }

  const value = readQueryControlValue(props, queryModel, controlId);
  const updateValue = (nextValue: unknown) => {
    onChange(updateQueryControlValue(props, queryModel, controlId, nextValue));
  };

  if (controlId === "symbols") {
    return (
      <QueryStringListField
        label={control.label}
        hideLabel={!showLabel}
        value={value}
        onChange={(symbols) => updateValue(symbols ?? [])}
        disabled={disabled}
        placeholder="AAPL, MSFT"
        help={control.description}
      />
    );
  }

  if (controlId === "timeframe") {
    return (
      <QuerySelectField
        label={control.label}
        hideLabel={!showLabel}
        value={value}
        onChange={updateValue}
        disabled={disabled}
        options={alpacaTimeframes}
        help={control.description}
      />
    );
  }

  if (controlId === "feed") {
    return (
      <QuerySelectField
        label={control.label}
        hideLabel={!showLabel}
        value={value}
        onChange={updateValue}
        disabled={disabled}
        options={equityFeeds}
        help={control.description}
      />
    );
  }

  if (controlId === "cryptoLocation") {
    return (
      <QuerySelectField
        label={control.label}
        hideLabel={!showLabel}
        value={value}
        onChange={updateValue}
        disabled={disabled}
        options={cryptoLocations}
        help={control.description}
      />
    );
  }

  if (controlId === "interval") {
    return (
      <QuerySelectField
        label={control.label}
        hideLabel={!showLabel}
        value={value}
        onChange={updateValue}
        disabled={disabled}
        options={binanceIntervals}
        help={control.description}
      />
    );
  }

  if (controlId === "sort") {
    return (
      <QuerySelectField
        label={control.label}
        hideLabel={!showLabel}
        value={value}
        onChange={updateValue}
        disabled={disabled}
        options={sortDirections}
        help={control.description}
      />
    );
  }

  if (controlId === "limit" || controlId === "fromId") {
    return (
      <QueryNumberField
        label={control.label}
        hideLabel={!showLabel}
        value={typeof value === "number" ? value : undefined}
        min={controlId === "fromId" ? 0 : 1}
        onChange={updateValue}
        disabled={disabled}
        placeholder={controlId === "limit" ? "1000" : "Optional cursor"}
        help={control.description}
      />
    );
  }

  return (
    <QueryTextField
      label={control.label}
      hideLabel={!showLabel}
      value={typeof value === "string" ? value : undefined}
      onChange={updateValue}
      disabled={disabled}
      placeholder={controlId === "pageToken" ? "Provider next_page_token" : "Optional"}
      help={control.description}
    />
  );
}

function ConnectionQueryControlSettingsField({
  draftProps,
  editable,
  field,
  onDraftPropsChange,
}: WidgetFieldSettingsRendererProps<ConnectionQueryWidgetProps>) {
  const controlId = getControlIdFromFieldId(field.id);

  if (!controlId) {
    return null;
  }

  return (
    <ConnectionQueryControlField
      controlId={controlId}
      disabled={!editable}
      showLabel={false}
      props={draftProps}
      onChange={onDraftPropsChange}
    />
  );
}

function ConnectionQueryControlCanvasField({
  editable,
  field,
  onPropsChange,
  props,
}: WidgetFieldCanvasRendererProps<ConnectionQueryWidgetProps>) {
  const controlId = getControlIdFromFieldId(field.id);

  if (!controlId) {
    return null;
  }

  return (
    <ConnectionQueryControlField
      controlId={controlId}
      disabled={!editable}
      showLabel
      props={props}
      onChange={onPropsChange}
    />
  );
}

export const connectionQuerySettingsSchema: WidgetSettingsSchema<ConnectionQueryWidgetProps> = {
  sections: [
    {
      id: "connection-path",
      title: "Connection path configuration",
      description:
        "Connection-type-specific query fields for the selected connection path.",
    },
  ],
  fields: controlDefinitions.map((control) => ({
    id: getControlFieldId(control.id),
    label: control.label,
    description: control.description,
    sectionId: "connection-path",
    settingsColumnSpan: control.settingsColumnSpan,
    pop: {
      canPop: true,
      anchor: "top",
      mode: control.settingsColumnSpan === 2 ? "panel" : "inline",
      defaultWidth: control.settingsColumnSpan === 2 ? 520 : 280,
      defaultHeight: control.id === "symbols" ? 180 : 120,
    },
    isVisible: ({ props }) => queryModelIncludesControl(resolveQueryModel(props), control.id),
    renderSettings: ConnectionQueryControlSettingsField,
    renderCanvas: ConnectionQueryControlCanvasField,
  })),
};
