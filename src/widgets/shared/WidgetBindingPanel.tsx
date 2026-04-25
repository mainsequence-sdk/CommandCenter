import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useDashboardWidgetDependencies,
  useResolvedWidgetIo,
} from "@/dashboards/DashboardWidgetDependencies";
import { useDashboardWidgetExecution } from "@/dashboards/DashboardWidgetExecution";
import {
  inferWidgetValueDescriptor,
  listWidgetValueDescriptorPaths,
} from "@/dashboards/widget-binding-transforms";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import { normalizeWidgetInstanceBindings } from "@/dashboards/widget-dependencies";
import type {
  WidgetContractId,
  WidgetDefinition,
  WidgetInputPortDefinition,
  WidgetInstanceBindings,
  WidgetPortBinding,
  WidgetValueDescriptor,
} from "@/widgets/types";
import {
  WidgetSourceExplorer,
  type WidgetSourceExplorerWidgetOption,
} from "@/widgets/shared/WidgetSourceExplorer";

interface BindingDraftRow {
  binding?: WidgetPortBinding;
  selectedSourceWidgetId: string;
}

function createEmptyBindingDraftRow(): BindingDraftRow {
  return {
    selectedSourceWidgetId: "",
  };
}

function toBindingArray(value: WidgetPortBinding | WidgetPortBinding[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function buildInitialBindingDraftRows(
  bindings: WidgetInstanceBindings | undefined,
): Record<string, BindingDraftRow[]> {
  return Object.fromEntries(
    Object.entries(bindings ?? {}).map(([inputId, bindingValue]) => [
      inputId,
      toBindingArray(bindingValue).map((binding) => ({
        binding,
        selectedSourceWidgetId: binding.sourceWidgetId,
      })),
    ]),
  );
}

function updateBindingDraftRows(
  current: Record<string, BindingDraftRow[]>,
  inputId: string,
  rowIndex: number,
  updater: (row: BindingDraftRow) => BindingDraftRow,
): Record<string, BindingDraftRow[]> {
  const next = { ...current };
  const rows = [...(next[inputId] ?? [])];

  while (rows.length <= rowIndex) {
    rows.push(createEmptyBindingDraftRow());
  }

  rows[rowIndex] = updater(rows[rowIndex] ?? createEmptyBindingDraftRow());
  next[inputId] = rows;
  return next;
}

function removeBindingDraftRow(
  current: Record<string, BindingDraftRow[]>,
  inputId: string,
  rowIndex: number,
): Record<string, BindingDraftRow[]> {
  const next = { ...current };
  const rows = [...(next[inputId] ?? [])];

  rows.splice(rowIndex, 1);

  if (rows.length === 0) {
    delete next[inputId];
    return next;
  }

  next[inputId] = rows;
  return next;
}

function appendBindingDraftRow(
  current: Record<string, BindingDraftRow[]>,
  inputId: string,
): Record<string, BindingDraftRow[]> {
  return {
    ...current,
    [inputId]: [...(current[inputId] ?? []), createEmptyBindingDraftRow()],
  };
}

function buildBindingsFromDraftRows(
  draftRowsByInputId: Record<string, BindingDraftRow[]>,
  inputs: WidgetInputPortDefinition<Record<string, unknown>>[],
): WidgetInstanceBindings | undefined {
  const bindingEntries = inputs.flatMap((input) => {
    const validBindings = (draftRowsByInputId[input.id] ?? [])
      .flatMap((row) => (row.binding ? [row.binding] : []));

    if (validBindings.length === 0) {
      return [];
    }

    return [[
      input.id,
      input.cardinality === "many" ? validBindings : validBindings[0],
    ] as const];
  });

  if (bindingEntries.length === 0) {
    return undefined;
  }

  return normalizeWidgetInstanceBindings(
    Object.fromEntries(bindingEntries) as WidgetInstanceBindings,
  );
}

function descriptorCanProduceAcceptedContract(
  descriptor: WidgetValueDescriptor | undefined,
  acceptedContracts: WidgetContractId[],
): boolean {
  if (!descriptor) {
    return false;
  }

  if (acceptedContracts.includes(descriptor.contract)) {
    return true;
  }

  if (descriptor.kind === "array") {
    return descriptorCanProduceAcceptedContract(descriptor.items, acceptedContracts);
  }

  return listWidgetValueDescriptorPaths(descriptor).some((option) =>
    acceptedContracts.includes(option.contractId),
  );
}

function isBindableSourceOutput(
  output: WidgetSourceExplorerWidgetOption["outputs"][number],
  acceptedContracts: WidgetContractId[],
) {
  if (acceptedContracts.includes(output.contract)) {
    return true;
  }

  const descriptor =
    output.valueDescriptor ??
    (output.value === undefined
      ? undefined
      : inferWidgetValueDescriptor(output.value, output.contract));

  return descriptorCanProduceAcceptedContract(descriptor, acceptedContracts);
}

export function WidgetBindingPanel({
  editable,
  instance,
  onBindingsChange,
  widget,
}: {
  editable?: boolean;
  instance: DashboardWidgetInstance;
  onBindingsChange: (bindings: WidgetInstanceBindings | undefined) => void;
  widget: WidgetDefinition;
}) {
  const dependencies = useDashboardWidgetDependencies();
  const widgetExecution = useDashboardWidgetExecution();
  const resolvedIo = useResolvedWidgetIo(instance.id);
  const initialBindings = useMemo(
    () => normalizeWidgetInstanceBindings(instance.bindings),
    [instance.bindings],
  );
  const initialBindingDraftRows = useMemo(
    () => buildInitialBindingDraftRows(initialBindings),
    [initialBindings],
  );
  const [draftBindingRowsByInputId, setDraftBindingRowsByInputId] =
    useState<Record<string, BindingDraftRow[]>>(initialBindingDraftRows);
  const [pendingExecutionBindingsJson, setPendingExecutionBindingsJson] = useState<string | null>(null);

  useEffect(() => {
    setDraftBindingRowsByInputId(initialBindingDraftRows);
  }, [initialBindingDraftRows, instance.id]);

  useEffect(() => {
    const currentBindingsJson = JSON.stringify(initialBindings ?? null);

    if (!widgetExecution || !pendingExecutionBindingsJson || currentBindingsJson !== pendingExecutionBindingsJson) {
      return;
    }

    setPendingExecutionBindingsJson(null);
    void widgetExecution.executeWidgetGraph(instance.id, {
      reason: "manual-recalculate",
    }).catch(() => {
      // Binding application should not fail if upstream execution is unavailable.
    });
  }, [initialBindings, instance.id, pendingExecutionBindingsJson, widgetExecution]);

  const inputs = resolvedIo?.inputs ?? widget.io?.inputs ?? [];
  const draftBindings = useMemo(
    () => buildBindingsFromDraftRows(draftBindingRowsByInputId, inputs),
    [draftBindingRowsByInputId, inputs],
  );

  const sourceWidgetsByInputId = useMemo(() => {
    if (!dependencies) {
      return new Map<string, WidgetSourceExplorerWidgetOption[]>();
    }

    return new Map(
      inputs.map((input) => {
        const options = dependencies.entries.flatMap(({ instance: sourceInstance }) => {
          if (sourceInstance.id === instance.id) {
            return [];
          }

          const sourceDefinition = dependencies.getWidgetDefinition(sourceInstance.widgetId);
          const declaredOutputs = dependencies.resolveIo(sourceInstance.id)?.outputs ?? [];
          const resolvedOutputs = dependencies.resolveOutputs(sourceInstance.id) ?? {};
          const bindableOutputs = declaredOutputs
            .map((output) => ({
              id: output.id,
              label: output.label,
              contract: output.contract,
              description: output.description,
              value: resolvedOutputs[output.id]?.value,
              valueDescriptor:
                resolvedOutputs[output.id]?.valueDescriptor ?? output.valueDescriptor,
            }))
            .filter((output) => isBindableSourceOutput(output, input.accepts));

          if (bindableOutputs.length === 0) {
            return [];
          }

          return [{
            id: sourceInstance.id,
            label: sourceInstance.title ?? sourceDefinition?.title ?? sourceInstance.widgetId,
            title: sourceInstance.title ?? sourceDefinition?.title ?? sourceInstance.widgetId,
            widgetTypeLabel: sourceDefinition?.title ?? sourceInstance.widgetId,
            instanceLabel: sourceInstance.id,
            outputs: bindableOutputs,
          } satisfies WidgetSourceExplorerWidgetOption];
        });

        return [input.id, options] as const;
      }),
    );
  }, [dependencies, inputs, instance.id]);

  const dirty =
    JSON.stringify(draftBindings ?? null) !== JSON.stringify(initialBindings ?? null);

  return (
    <section className="overflow-hidden rounded-[calc(var(--radius)+4px)] border border-border/70 bg-card/88 shadow-[var(--shadow-panel)] backdrop-blur">
      <div className="border-b border-border/70 px-5 py-5 md:px-6 md:py-6">
        <div className="space-y-2">
          <div className="text-xl font-semibold tracking-tight text-foreground">
            Widget bindings
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Bind this widget instance to upstream widget outputs without storing graph edges in raw
            props. Binding changes reset widget runtime state so stale derived data does not linger.
          </p>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 md:px-6 md:py-6">
        {inputs.length === 0 ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/24 px-4 py-4 text-sm text-muted-foreground">
            {widget.resolveIo
              ? "No bindable inputs are available for this widget instance yet. Configure the widget in Settings to generate its dynamic input ports."
              : "This widget instance does not currently declare any bindable inputs."}
          </div>
        ) : null}

        {inputs.map((input) => {
          const storedRows = draftBindingRowsByInputId[input.id] ?? [];
          const rowsToRender =
            storedRows.length > 0 ? storedRows : [createEmptyBindingDraftRow()];
          const sourceWidgetOptions = sourceWidgetsByInputId.get(input.id) ?? [];

          return (
            <section
              key={input.id}
              className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-topbar-foreground">{input.label}</div>
                    {input.required ? <Badge variant="warning">Required</Badge> : null}
                    {input.cardinality === "many" ? <Badge variant="secondary">Multiple</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Accepts {input.accepts.join(", ")}
                  </p>
                </div>
                {input.cardinality === "many" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!editable}
                    onClick={() => {
                      setDraftBindingRowsByInputId((current) =>
                        appendBindingDraftRow(current, input.id),
                      );
                    }}
                  >
                    Add source
                  </Button>
                ) : null}
              </div>

              <div className="space-y-4">
                {rowsToRender.map((row, rowIndex) => (
                  <div
                    key={`${input.id}:${rowIndex}:${row.binding?.sourceWidgetId ?? row.selectedSourceWidgetId ?? "draft"}:${row.binding?.sourceOutputId ?? "unbound"}`}
                    className="space-y-3 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 p-3"
                  >
                    {input.cardinality === "many" ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Source {rowIndex + 1}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!editable || storedRows.length === 0}
                          onClick={() => {
                            setDraftBindingRowsByInputId((current) =>
                              removeBindingDraftRow(current, input.id, rowIndex),
                            );
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : null}

                    <WidgetSourceExplorer
                      editable={editable}
                      inputLabel={input.label}
                      acceptedContracts={input.accepts}
                      selectedSourceWidgetId={row.selectedSourceWidgetId}
                      sourceWidgets={sourceWidgetOptions}
                      value={row.binding}
                      onSelectedSourceWidgetIdChange={(nextSourceWidgetId) => {
                        setDraftBindingRowsByInputId((current) =>
                          updateBindingDraftRows(current, input.id, rowIndex, (currentRow) => ({
                            ...currentRow,
                            selectedSourceWidgetId: nextSourceWidgetId,
                            binding: undefined,
                          })),
                        );
                      }}
                      onBindingChange={(nextBinding) => {
                        setDraftBindingRowsByInputId((current) =>
                          updateBindingDraftRows(current, input.id, rowIndex, (currentRow) => ({
                            ...currentRow,
                            selectedSourceWidgetId:
                              nextBinding?.sourceWidgetId ?? currentRow.selectedSourceWidgetId,
                            binding: nextBinding,
                          })),
                        );
                      }}
                    />
                  </div>
                ))}
              </div>

              {input.effects?.length ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Input effects
                  </div>
                  <div className="space-y-2">
                    {input.effects.map((effect, index) => (
                      <div
                        key={`${input.id}:${effect.kind}:${effect.target.kind}:${index}`}
                        className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 px-3 py-2 text-sm"
                      >
                        <div className="font-medium text-foreground">{effect.kind}</div>
                        <div className="mt-1 text-muted-foreground">
                          {effect.description ??
                            `${effect.sourcePath} -> ${effect.target.kind}:${
                              effect.target.kind === "schema-field"
                                ? effect.target.id
                                : effect.target.kind === "generated-field"
                                  ? effect.target.id
                                : effect.target.kind === "prop"
                                  ? effect.target.path
                                  : effect.target.id
                            }`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}

        {inputs.length > 0 ? (
          <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDraftBindingRowsByInputId(initialBindingDraftRows);
              }}
              disabled={!editable || !dirty}
            >
              Reset bindings
            </Button>
            <Button
              onClick={() => {
                const normalizedBindings = normalizeWidgetInstanceBindings(draftBindings);
                onBindingsChange(normalizedBindings);
                setPendingExecutionBindingsJson(JSON.stringify(normalizedBindings ?? null));
              }}
              disabled={!editable || !dirty}
            >
              Apply bindings
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
