import { useEffect, useMemo, useState, type ComponentType } from "react";

import { getConnectionTypeById } from "@/app/registry";
import { ConnectionPicker } from "@/connections/components/ConnectionPicker";
import type { ConnectionQueryEditorProps } from "@/connections/types";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  normalizeConnectionQueryProps,
  type ConnectionQueryTimeRangeMode,
  type ConnectionQueryWidgetProps,
} from "./connectionQueryModel";

type Props = WidgetSettingsComponentProps<ConnectionQueryWidgetProps>;

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJsonObject(value: string) {
  const parsed = value.trim() ? JSON.parse(value) : {};

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON value must be an object.");
  }

  return parsed as Record<string, unknown>;
}

function JsonObjectEditor({
  disabled,
  label,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  value: Record<string, unknown> | undefined;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState(formatJson(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(formatJson(value));
    setError(null);
  }, [value]);

  function commit(nextDraft = draft) {
    try {
      const parsed = parseJsonObject(nextDraft);
      setError(null);
      onChange(parsed);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Invalid JSON object.");
    }
  }

  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          commit();
        }}
        disabled={disabled}
        spellCheck={false}
        className="min-h-[160px] w-full resize-y rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 py-2 font-mono text-xs text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

function NumberInput({
  disabled,
  label,
  value,
  onChange,
  min,
}: {
  disabled: boolean;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        min={min}
        value={value ?? ""}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          onChange(Number.isFinite(nextValue) ? nextValue : undefined);
        }}
        disabled={disabled}
        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function DateTimeInput({
  disabled,
  label,
  valueMs,
  onChange,
}: {
  disabled: boolean;
  label: string;
  valueMs: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const value =
    typeof valueMs === "number" && Number.isFinite(valueMs)
      ? new Date(valueMs).toISOString().slice(0, 16)
      : "";

  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => {
          const parsed = Date.parse(event.target.value);
          onChange(Number.isNaN(parsed) ? undefined : parsed);
        }}
        disabled={disabled}
        className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

export function ConnectionQueryWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: Props) {
  const normalizedProps = normalizeConnectionQueryProps(draftProps);
  const connectionType = normalizedProps.connectionRef?.typeId
    ? getConnectionTypeById(normalizedProps.connectionRef.typeId)
    : undefined;
  const queryModels = useMemo(() => connectionType?.queryModels ?? [], [connectionType]);
  const selectedQueryModel =
    queryModels.find((model) => model.id === normalizedProps.queryModelId) ?? queryModels[0];
  const QueryEditor = connectionType?.queryEditor as
    | ComponentType<ConnectionQueryEditorProps<Record<string, unknown>>>
    | undefined;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Connection</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Select the backend-owned data source that will execute this query.
          </p>
        </div>
        <ConnectionPicker
          value={normalizedProps.connectionRef}
          onChange={(nextRef) => {
            const nextType = nextRef?.typeId ? getConnectionTypeById(nextRef.typeId) : undefined;
            const nextQueryModelId = nextType?.queryModels?.[0]?.id;

            onDraftPropsChange({
              ...draftProps,
              connectionRef: nextRef,
              queryModelId: nextQueryModelId ?? undefined,
              query: nextQueryModelId ? { kind: nextQueryModelId } : {},
            });
          }}
          accepts={{ capabilities: ["query"] }}
          disabled={!editable}
          placeholder="Select a connection"
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Query model</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose the operation exposed by this connection type.
          </p>
        </div>
        <select
          value={selectedQueryModel?.id ?? ""}
          onChange={(event) => {
            const nextQueryModelId = event.target.value;
            onDraftPropsChange({
              ...draftProps,
              queryModelId: nextQueryModelId || undefined,
              query: {
                ...(normalizedProps.query ?? {}),
                kind: nextQueryModelId || undefined,
              },
            });
          }}
          disabled={!editable || queryModels.length === 0}
          className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {queryModels.length > 0 ? (
            queryModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))
          ) : (
            <option value="">No query models</option>
          )}
        </select>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Query</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure the payload passed to the selected connection query model.
          </p>
        </div>
        {QueryEditor && selectedQueryModel ? (
          <QueryEditor
            value={normalizedProps.query ?? {}}
            onChange={(nextQuery) => {
              onDraftPropsChange({
                ...draftProps,
                query: {
                  ...nextQuery,
                  kind:
                    typeof nextQuery.kind === "string"
                      ? nextQuery.kind
                      : selectedQueryModel.id,
                },
              });
            }}
            disabled={!editable}
            queryModel={selectedQueryModel}
          />
        ) : (
          <JsonObjectEditor
            label="Query JSON"
            value={normalizedProps.query}
            onChange={(nextQuery) => {
              onDraftPropsChange({
                ...draftProps,
                query: {
                  ...nextQuery,
                  kind:
                    typeof nextQuery.kind === "string"
                      ? nextQuery.kind
                      : selectedQueryModel?.id,
                },
              });
            }}
            disabled={!editable}
          />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Runtime</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Control range handling, row limits, variables, and selected response frame.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Time range</span>
            <select
              value={normalizedProps.timeRangeMode ?? "dashboard"}
              onChange={(event) => {
                onDraftPropsChange({
                  ...draftProps,
                  timeRangeMode: event.target.value as ConnectionQueryTimeRangeMode,
                });
              }}
              disabled={!editable}
              className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 px-3 text-sm text-foreground outline-none transition-colors focus:border-ring/70 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="dashboard">Dashboard range</option>
              <option value="fixed">Fixed range</option>
              <option value="none">No range</option>
            </select>
          </label>
          <NumberInput
            label="Max rows"
            value={normalizedProps.maxRows}
            min={1}
            disabled={!editable}
            onChange={(maxRows) => {
              onDraftPropsChange({ ...draftProps, maxRows });
            }}
          />
          {normalizedProps.timeRangeMode === "fixed" ? (
            <>
              <DateTimeInput
                label="From"
                valueMs={normalizedProps.fixedStartMs}
                disabled={!editable}
                onChange={(fixedStartMs) => {
                  onDraftPropsChange({ ...draftProps, fixedStartMs });
                }}
              />
              <DateTimeInput
                label="To"
                valueMs={normalizedProps.fixedEndMs}
                disabled={!editable}
                onChange={(fixedEndMs) => {
                  onDraftPropsChange({ ...draftProps, fixedEndMs });
                }}
              />
            </>
          ) : null}
          <NumberInput
            label="Selected frame"
            value={normalizedProps.selectedFrame ?? 0}
            min={0}
            disabled={!editable}
            onChange={(selectedFrame) => {
              onDraftPropsChange({ ...draftProps, selectedFrame });
            }}
          />
        </div>
        <JsonObjectEditor
          label="Variables JSON"
          value={normalizedProps.variables}
          onChange={(variables) => {
            onDraftPropsChange({
              ...draftProps,
              variables: variables as Record<string, string | number | boolean>,
            });
          }}
          disabled={!editable}
        />
      </section>
    </div>
  );
}
