import { useMemo } from "react";

import { getConnectionTypeById } from "@/app/registry";
import { QueryStringListField } from "@/connections/components/ConnectionQueryEditorFields";
import {
  resolveConnectionStreamAuthoringCopy,
  resolveConnectionStreamAuthoringQueryModels,
} from "@/connections/connectionAuthoringContract";
import { resolveConnectionRefSelection } from "@/connections/connectionRefResolution";
import { ConnectionQuerySettingsSurface } from "@/connections/ConnectionQuerySettingsSurface";
import { ConnectionStreamQueryTestPanel } from "@/connections/ConnectionStreamQueryTestPanel";
import { isConnectionQueryModelStreamable } from "@/connections/types";
import { useConnectionInstances } from "@/connections/hooks";
import { useDashboardWidgetRegistry } from "@/dashboards/DashboardWidgetRegistry";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";
import { WidgetSchemaForm } from "@/widgets/shared/widget-schema-form";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  normalizeConnectionStreamQueryProps,
  normalizeConnectionStreamQueryRuntimeState,
  type ConnectionStreamQueryWidgetProps,
} from "./connectionStreamQueryModel";

type Props = WidgetSettingsComponentProps<ConnectionStreamQueryWidgetProps>;

function RetentionMaxRowsInput({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="block space-y-2">
      <WidgetSettingFieldLabel
        help="Maximum retained row count after stream updates are merged into the source dataset. Leave blank to keep every row received during this browser session."
        textClassName="text-xs font-medium text-muted-foreground"
      >
        Retention rows
      </WidgetSettingFieldLabel>
      <input
        type="number"
        min={1}
        value={value ?? ""}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined);
        }}
        disabled={disabled}
        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

export function ConnectionStreamQueryWidgetSettings({
  widget,
  instanceId,
  instanceTitle,
  draftProps,
  draftPresentation,
  editable,
  controllerContext,
  onDraftPropsChange,
  onDraftPresentationChange,
}: Props) {
  const widgetRegistry = useDashboardWidgetRegistry();
  const connectionInstancesQuery = useConnectionInstances();
  const currentWidget = widgetRegistry.find((entry) => entry.id === instanceId) ?? null;
  const normalizedDraftProps = useMemo(
    () => normalizeConnectionStreamQueryProps(draftProps),
    [draftProps],
  );
  const selectedConnectionType = normalizedDraftProps.connectionRef?.typeId
    ? getConnectionTypeById(normalizedDraftProps.connectionRef.typeId)
    : undefined;
  const selectedConnectionInstance = useMemo(
    () =>
      resolveConnectionRefSelection({
        requestedRef: normalizedDraftProps.connectionRef,
        backendInstances: connectionInstancesQuery.data ?? [],
      }).connectionInstance,
    [connectionInstancesQuery.data, normalizedDraftProps.connectionRef],
  );
  const streamQueryModels = useMemo(
    () =>
      resolveConnectionStreamAuthoringQueryModels({
        connectionInstance: selectedConnectionInstance,
        connectionType: selectedConnectionType,
      }),
    [selectedConnectionInstance, selectedConnectionType],
  );
  const selectedQueryModel = normalizedDraftProps.queryModelId
    ? streamQueryModels.find((model) => model.id === normalizedDraftProps.queryModelId)
    : undefined;
  const streamModes = isConnectionQueryModelStreamable(selectedQueryModel)
    ? selectedQueryModel.stream.modes
    : [];
  const supportsRetainedAccumulation = streamModes.length > 0;
  const useTypedQueryEditor = Boolean(selectedConnectionType?.queryEditor);
  const runtimeFrame = normalizeConnectionStreamQueryRuntimeState(currentWidget?.runtimeState);
  const streamCopy = resolveConnectionStreamAuthoringCopy(selectedConnectionType);
  const fieldSuggestions = [
    ...(runtimeFrame?.fields?.map((field) => field.key) ?? []),
    ...(runtimeFrame?.columns ?? []),
  ].filter((value, index, values) => value.trim() && values.indexOf(value) === index)
    .map((value) => ({
      value,
      label: value,
      description: "Published by the current stream runtime.",
    }));

  function updateStreamProps(nextPatch: Partial<ConnectionStreamQueryWidgetProps>) {
    onDraftPropsChange(
      normalizeConnectionStreamQueryProps({
        ...normalizedDraftProps,
        ...nextPatch,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <ConnectionQuerySettingsSurface
        authoringMode="stream"
        value={normalizedDraftProps as ConnectionQueryWidgetProps}
        onChange={(nextValue) => {
          updateStreamProps(nextValue as ConnectionStreamQueryWidgetProps);
        }}
        editable={editable}
        runtimeState={currentWidget?.runtimeState}
        runtimeStatusTitle="Current stream runtime"
        runtimeStatusDescription="This is the last live runtime state published by this stream source while you edit the draft query."
        runtimeStatusEmptyMessage="This stream source has not published a live dataset yet."
        sourceTitle={instanceTitle}
        connectionPathSettings={useTypedQueryEditor ? undefined : (
          <WidgetSchemaForm
            widget={widget}
            draftProps={normalizedDraftProps}
            onDraftPropsChange={(nextValue) => {
              updateStreamProps(nextValue as ConnectionStreamQueryWidgetProps);
            }}
            draftPresentation={draftPresentation}
            onDraftPresentationChange={onDraftPresentationChange}
            editable={editable}
            context={controllerContext}
          />
        )}
        queryModelFilter={isConnectionQueryModelStreamable}
        showConnectionPicker
        showIncrementalRefreshControls={false}
        showTestAction={false}
        showQueryEditor={useTypedQueryEditor}
      />

      {supportsRetainedAccumulation ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Retained rows</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure how retained rows are merged when this stream path publishes live updates.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <RetentionMaxRowsInput
              value={normalizedDraftProps.retentionMaxRows}
              disabled={!editable}
              onChange={(retentionMaxRows) => {
                updateStreamProps({ retentionMaxRows });
              }}
            />
            <div className="md:col-span-2">
              <QueryStringListField
                label="Merge key columns"
                value={normalizedDraftProps.mergeKeyFields}
                onChange={(mergeKeyFields) => {
                  updateStreamProps({ mergeKeyFields });
                }}
                disabled={!editable}
                placeholder="symbol, timestamp"
                suggestions={fieldSuggestions}
                help="Column combination used to replace retained rows when live updates arrive. Leave blank to use the connection path defaults when available, or append each incoming row when no default identity is published."
              />
            </div>
          </div>
        </section>
      ) : null}

      <ConnectionStreamQueryTestPanel
        editable={editable}
        value={normalizedDraftProps}
        queryModel={selectedQueryModel}
        sourceWidgetId={instanceId}
        runButtonLabel={streamCopy.runButtonLabel}
        resultDescription={streamCopy.resultDescription}
        resultTitle={streamCopy.resultTitle}
      />
    </div>
  );
}
