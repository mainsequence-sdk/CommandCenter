import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useDashboardWidgetDependencies,
  useResolvedWidgetIo,
} from "@/dashboards/DashboardWidgetDependencies";
import {
  applyWidgetBindingTransform,
  listWidgetValueDescriptorPaths,
} from "@/dashboards/widget-binding-transforms";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import { normalizeWidgetInstanceBindings } from "@/dashboards/widget-dependencies";
import { cn } from "@/lib/utils";
import type {
  WidgetDefinition,
  WidgetContractId,
  WidgetInstanceBindings,
  WidgetPortBinding,
  WidgetValueDescriptor,
} from "@/widgets/types";

interface SourceOutputOption {
  id: string;
  label: string;
  contract: WidgetContractId;
  description?: string;
  value?: unknown;
  valueDescriptor?: WidgetValueDescriptor;
}

interface SourceWidgetOption {
  id: string;
  label: string;
  outputs: SourceOutputOption[];
}

function isStructuredOutput(option: SourceOutputOption | undefined) {
  return option?.valueDescriptor?.kind === "object" || option?.valueDescriptor?.kind === "array";
}

type DraftBindingEvaluation = {
  status:
    | "valid"
    | "unbound"
    | "missing-source"
    | "missing-output"
    | "contract-mismatch"
    | "transform-invalid"
    | "pending";
  message: string;
  contractId?: WidgetContractId;
  value?: unknown;
};

function formatSourceWidgetLabel(
  instance: DashboardWidgetInstance,
  widgetTitle: string,
) {
  return `${widgetTitle} [${instance.id}]`;
}

function updateBindingDraft(
  current: WidgetInstanceBindings | undefined,
  inputId: string,
  nextBinding: WidgetPortBinding | undefined,
): WidgetInstanceBindings | undefined {
  const next = { ...(current ?? {}) };

  if (!nextBinding) {
    delete next[inputId];
    return Object.keys(next).length > 0 ? next : undefined;
  }

  next[inputId] = nextBinding;
  return next;
}

function formatBindingPreviewValue(value: unknown) {
  if (value === undefined) {
    return "No value available.";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resolveDraftBindingStatusVariant(
  status:
    | "valid"
    | "unbound"
    | "missing-source"
    | "missing-output"
    | "contract-mismatch"
    | "transform-invalid"
    | "pending",
) {
  switch (status) {
    case "valid":
      return "success";
    case "contract-mismatch":
    case "transform-invalid":
      return "danger";
    case "missing-source":
    case "missing-output":
      return "warning";
    case "pending":
    case "unbound":
    default:
      return "neutral";
  }
}

function buildBindingMappingSummary(
  inputLabel: string,
  sourceOutputLabel: string | undefined,
  transformId: string,
  transformPath: string[] | undefined,
) {
  if (!sourceOutputLabel) {
    return "No mapping selected";
  }

  if (transformId === "extract-path" && transformPath && transformPath.length > 0) {
    return `${sourceOutputLabel}.${transformPath.join(".")} -> ${inputLabel}`;
  }

  return `${sourceOutputLabel} -> ${inputLabel}`;
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
  const resolvedIo = useResolvedWidgetIo(instance.id);
  const initialBindings = useMemo(
    () => normalizeWidgetInstanceBindings(instance.bindings),
    [instance.bindings],
  );
  const initialSourceWidgetIds = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(initialBindings ?? {}).flatMap(([inputId, bindingValue]) => {
          const firstBinding = Array.isArray(bindingValue) ? bindingValue[0] : bindingValue;

          if (!firstBinding?.sourceWidgetId) {
            return [];
          }

          return [[inputId, firstBinding.sourceWidgetId] as const];
        }),
      ) as Record<string, string>,
    [initialBindings],
  );
  const [draftBindings, setDraftBindings] = useState<WidgetInstanceBindings | undefined>(initialBindings);
  const [draftSourceWidgetIds, setDraftSourceWidgetIds] =
    useState<Record<string, string>>(initialSourceWidgetIds);

  useEffect(() => {
    setDraftBindings(initialBindings);
    setDraftSourceWidgetIds(initialSourceWidgetIds);
  }, [initialBindings, initialSourceWidgetIds, instance.id]);

  const inputs = resolvedIo?.inputs ?? widget.io?.inputs ?? [];

  const sourceWidgetsByInputId = useMemo(() => {
    if (!dependencies) {
      return new Map<string, SourceWidgetOption[]>();
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

          return [{
            id: sourceInstance.id,
            label: formatSourceWidgetLabel(
              sourceInstance,
              sourceInstance.title ?? sourceDefinition?.title ?? sourceInstance.widgetId,
            ),
            outputs: declaredOutputs.map((output) => ({
              id: output.id,
              label: output.label,
              contract: output.contract,
              description: output.description,
              value: resolvedOutputs[output.id]?.value,
              valueDescriptor:
                resolvedOutputs[output.id]?.valueDescriptor ?? output.valueDescriptor,
            })) satisfies SourceOutputOption[],
          } satisfies SourceWidgetOption];
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
          const currentBindingValue = draftBindings?.[input.id];
          const currentBinding = Array.isArray(currentBindingValue)
            ? currentBindingValue[0]
            : currentBindingValue;
          const sourceWidgetOptions = sourceWidgetsByInputId.get(input.id) ?? [];
          const selectedSourceWidgetId =
            draftSourceWidgetIds[input.id] ?? currentBinding?.sourceWidgetId ?? "";
          const selectedSourceWidget = sourceWidgetOptions.find(
            (option) => option.id === selectedSourceWidgetId,
          );
          const selectedOutputOptions = selectedSourceWidget?.outputs ?? [];
          const selectedOutput = selectedOutputOptions.find(
            (option) => option.id === currentBinding?.sourceOutputId,
          );
          const currentTransformId =
            currentBinding?.transformId === "extract-path" ? "extract-path" : "identity";
          const pathOptions = listWidgetValueDescriptorPaths(selectedOutput?.valueDescriptor);
          const selectedPathKey = (currentBinding?.transformPath ?? []).join(".");
          const selectedPathOption = pathOptions.find(
            (option) => option.path.join(".") === selectedPathKey,
          );
          const transformedOutput =
            selectedOutput && currentBinding
              ? applyWidgetBindingTransform(currentBinding, {
                  contractId: selectedOutput.contract,
                  value: selectedOutput.value,
                  valueDescriptor: selectedOutput.valueDescriptor,
                })
              : undefined;
          const evaluation: DraftBindingEvaluation =
            !selectedSourceWidgetId
              ? {
                  status: "unbound",
                  message: "No mapping selected.",
                  contractId: undefined,
                  value: undefined,
                }
              : !selectedSourceWidget
                ? {
                    status: "missing-source",
                    message: "The selected source widget is no longer available.",
                    contractId: undefined,
                    value: undefined,
                  }
                : !currentBinding?.sourceOutputId
                  ? {
                      status: "pending",
                      message: "Choose a source output to continue.",
                      contractId: undefined,
                      value: undefined,
                    }
                  : !selectedOutput
                    ? {
                        status: "missing-output",
                        message: "The selected source output is no longer available.",
                        contractId: undefined,
                        value: undefined,
                      }
                    : currentTransformId === "extract-path" &&
                        (!currentBinding.transformPath || currentBinding.transformPath.length === 0)
                      ? {
                          status: "pending",
                          message: "Choose a nested field to continue.",
                          contractId: selectedOutput.contract,
                          value: selectedOutput.value,
                        }
                    : !transformedOutput || transformedOutput.status !== "valid"
                      ? {
                          status: "transform-invalid",
                          message:
                            currentTransformId === "extract-path"
                              ? "The selected nested path could not be resolved from this output."
                              : "The selected output could not be transformed.",
                          contractId: selectedOutput.contract,
                          value: selectedOutput.value,
                        }
                      : input.accepts.includes(transformedOutput.contractId)
                        ? {
                            status: "valid",
                            message: `Compatible after ${currentTransformId === "extract-path" ? "nested field extraction" : "direct binding"}.`,
                            contractId: transformedOutput.contractId,
                            value: transformedOutput.value,
                          }
                        : {
                            status: "contract-mismatch",
                            message: `Incompatible. ${input.label} accepts ${input.accepts.join(", ")} but the current source resolves to ${transformedOutput.contractId}.`,
                            contractId: transformedOutput.contractId,
                            value: transformedOutput.value,
                          };
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
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Accepts {input.accepts.join(", ")}
                  </p>
                </div>

                <Badge variant={resolveDraftBindingStatusVariant(evaluation.status)}>
                  {evaluation.status}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Source widget
                    </label>
                    <select
                      className={cn(
                        "h-10 w-full rounded-[calc(var(--radius)-6px)] border border-border bg-background/55 px-3 text-sm text-foreground shadow-none",
                        !editable ? "cursor-not-allowed opacity-70" : undefined,
                      )}
                      value={selectedSourceWidgetId}
                      disabled={!editable}
                      onChange={(event) => {
                        const nextSourceWidgetId = event.target.value;
                        setDraftSourceWidgetIds((current) => ({
                          ...current,
                          [input.id]: nextSourceWidgetId,
                        }));

                        if (!nextSourceWidgetId) {
                          setDraftBindings((current) =>
                            updateBindingDraft(current, input.id, undefined),
                          );
                          return;
                        }

                        setDraftBindings((current) =>
                          updateBindingDraft(current, input.id, undefined),
                        );
                      }}
                    >
                      <option value="">No widget selected</option>
                      {sourceWidgetOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Source output
                    </label>
                    <select
                      className={cn(
                        "h-10 w-full rounded-[calc(var(--radius)-6px)] border border-border bg-background/55 px-3 text-sm text-foreground shadow-none",
                        !editable ? "cursor-not-allowed opacity-70" : undefined,
                      )}
                      value={currentBinding?.sourceOutputId ?? ""}
                      disabled={!editable || !selectedSourceWidget}
                      onChange={(event) => {
                        const nextSourceOutputId = event.target.value;
                        const nextOutput = selectedSourceWidget?.outputs.find(
                          (output) => output.id === nextSourceOutputId,
                        );
                        const shouldDefaultToNestedPath = isStructuredOutput(nextOutput);

                        setDraftBindings((current) =>
                          updateBindingDraft(
                            current,
                            input.id,
                            selectedSourceWidget && nextSourceOutputId && nextOutput
                              ? {
                                  sourceWidgetId: selectedSourceWidget.id,
                                  sourceOutputId: nextSourceOutputId,
                                  transformId: shouldDefaultToNestedPath ? "extract-path" : undefined,
                                  transformPath: undefined,
                                  transformContractId: undefined,
                                }
                              : undefined,
                          ),
                        );
                      }}
                    >
                      <option value="">
                        {selectedSourceWidget ? "Select an output" : "Choose a widget first"}
                      </option>
                      {selectedOutputOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {selectedSourceWidget && selectedOutputOptions.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        This widget does not currently expose any outputs.
                      </div>
                    ) : null}
                    {selectedOutput?.description ? (
                      <div className="text-xs text-muted-foreground">
                        {selectedOutput.description}
                      </div>
                    ) : null}
                    {selectedOutput && isStructuredOutput(selectedOutput) ? (
                      <div className="text-xs text-muted-foreground">
                        Structured output. Use <span className="font-medium text-foreground">Value mapping</span> to extract a nested field.
                      </div>
                    ) : null}
                  </div>
                </div>

                {currentBinding?.sourceOutputId ? (
                  <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Value mapping
                      </label>
                      <select
                        className={cn(
                          "h-10 w-full rounded-[calc(var(--radius)-6px)] border border-border bg-background/55 px-3 text-sm text-foreground shadow-none",
                          !editable ? "cursor-not-allowed opacity-70" : undefined,
                        )}
                        value={currentTransformId}
                        disabled={!editable}
                        onChange={(event) => {
                          const nextTransformId = event.target.value;

                          setDraftBindings((current) =>
                            updateBindingDraft(
                              current,
                              input.id,
                              currentBinding
                                ? {
                                    sourceWidgetId: currentBinding.sourceWidgetId,
                                    sourceOutputId: currentBinding.sourceOutputId,
                                    transformId:
                                      nextTransformId === "extract-path" ? "extract-path" : undefined,
                                    transformPath: undefined,
                                    transformContractId: undefined,
                                  }
                                : undefined,
                            ),
                          );
                        }}
                      >
                        <option value="identity">Use whole output</option>
                        <option value="extract-path" disabled={pathOptions.length === 0}>
                          Extract nested field
                        </option>
                      </select>
                    </div>

                    {currentTransformId === "extract-path" ? (
                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Nested path
                        </label>
                        <select
                          className={cn(
                            "h-10 w-full rounded-[calc(var(--radius)-6px)] border border-border bg-background/55 px-3 text-sm text-foreground shadow-none",
                            !editable ? "cursor-not-allowed opacity-70" : undefined,
                          )}
                          value={selectedPathKey}
                          disabled={!editable || pathOptions.length === 0}
                          onChange={(event) => {
                            const nextPathKey = event.target.value;
                            const nextPathOption = pathOptions.find(
                              (option) => option.path.join(".") === nextPathKey,
                            );

                            setDraftBindings((current) =>
                              updateBindingDraft(
                                current,
                                input.id,
                                currentBinding && nextPathOption
                                  ? {
                                      sourceWidgetId: currentBinding.sourceWidgetId,
                                      sourceOutputId: currentBinding.sourceOutputId,
                                      transformId: "extract-path",
                                      transformPath: nextPathOption.path,
                                      transformContractId: nextPathOption.contractId,
                                    }
                                  : currentBinding
                                    ? {
                                        sourceWidgetId: currentBinding.sourceWidgetId,
                                        sourceOutputId: currentBinding.sourceOutputId,
                                        transformId: "extract-path",
                                        transformPath: undefined,
                                        transformContractId: undefined,
                                      }
                                    : undefined,
                              ),
                            );
                          }}
                        >
                          <option value="">
                            {pathOptions.length > 0 ? "Select a nested path" : "No nested fields"}
                          </option>
                          {pathOptions.map((option) => (
                            <option key={option.path.join(".")} value={option.path.join(".")}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {selectedPathOption?.description ? (
                          <div className="text-xs text-muted-foreground">
                            {selectedPathOption.description}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 px-3 py-2 text-sm">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Mapping
                  </div>
                  <div className="mt-1 font-medium text-foreground">
                    {buildBindingMappingSummary(
                      input.label,
                      selectedOutput?.label,
                      currentTransformId,
                      currentBinding?.transformPath,
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{evaluation.message}</div>
                  {evaluation.contractId ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Current value contract: {evaluation.contractId}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 px-3 py-2 text-sm">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Preview
                  </div>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                    {formatBindingPreviewValue(evaluation.value)}
                  </pre>
                </div>
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
                setDraftBindings(initialBindings);
                setDraftSourceWidgetIds(initialSourceWidgetIds);
              }}
              disabled={!editable || !dirty}
            >
              Reset bindings
            </Button>
            <Button
              onClick={() => {
                onBindingsChange(normalizeWidgetInstanceBindings(draftBindings));
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
