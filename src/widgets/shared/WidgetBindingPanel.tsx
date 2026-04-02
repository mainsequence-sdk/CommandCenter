import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardWidgetDependencies } from "@/dashboards/DashboardWidgetDependencies";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import { normalizeWidgetInstanceBindings } from "@/dashboards/widget-dependencies";
import { cn } from "@/lib/utils";
import type {
  WidgetDefinition,
  WidgetInstanceBindings,
  WidgetPortBinding,
} from "@/widgets/types";

interface SourceOutputOption {
  id: string;
  label: string;
  description?: string;
}

interface SourceWidgetOption {
  id: string;
  label: string;
  outputs: SourceOutputOption[];
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

function findCurrentOutputOption(
  widgetOptions: SourceWidgetOption[],
  binding: WidgetPortBinding | undefined,
): SourceOutputOption | undefined {
  if (!binding) {
    return undefined;
  }

  const widgetOption = widgetOptions.find((option) => option.id === binding.sourceWidgetId);
  return widgetOption?.outputs.find((option) => option.id === binding.sourceOutputId);
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
  const resolvedInputs = dependencies?.resolveInputs(instance.id);
  const initialBindings = useMemo(
    () => normalizeWidgetInstanceBindings(instance.bindings),
    [instance.bindings],
  );
  const [draftBindings, setDraftBindings] = useState<WidgetInstanceBindings | undefined>(initialBindings);

  useEffect(() => {
    setDraftBindings(initialBindings);
  }, [initialBindings, instance.id]);

  const inputs = widget.io?.inputs ?? [];

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
          const outputs = sourceDefinition?.io?.outputs ?? [];

          const compatibleOutputs = outputs
            .filter((output) => input.accepts.includes(output.contract))
            .map((output) => ({
              id: output.id,
              label: output.label,
              description: output.description,
            })) satisfies SourceOutputOption[];

          if (compatibleOutputs.length === 0) {
            return [];
          }

          return [{
            id: sourceInstance.id,
            label: sourceInstance.title ?? sourceDefinition?.title ?? sourceInstance.widgetId,
            outputs: compatibleOutputs,
          } satisfies SourceWidgetOption];
        });

        return [input.id, options] as const;
      }),
    );
  }, [dependencies, inputs, instance.id]);

  if (inputs.length === 0) {
    return null;
  }

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
        {inputs.map((input) => {
          const currentBindingValue = draftBindings?.[input.id];
          const currentBinding = Array.isArray(currentBindingValue)
            ? currentBindingValue[0]
            : currentBindingValue;
          const resolvedInputValue = resolvedInputs?.[input.id];
          const currentResolved = Array.isArray(resolvedInputValue)
            ? resolvedInputValue[0]
            : resolvedInputValue;
          const sourceWidgetOptions = sourceWidgetsByInputId.get(input.id) ?? [];
          const selectedSourceWidgetId = currentBinding?.sourceWidgetId ?? "";
          const selectedSourceWidget = sourceWidgetOptions.find(
            (option) => option.id === selectedSourceWidgetId,
          );
          const selectedOutputOptions = selectedSourceWidget?.outputs ?? [];
          const selectedOutput = findCurrentOutputOption(sourceWidgetOptions, currentBinding);
          const resolvedSourceWidget = currentResolved?.sourceWidgetId
            ? sourceWidgetOptions.find((option) => option.id === currentResolved.sourceWidgetId)
            : undefined;
          const resolvedSourceOutput = currentResolved?.sourceOutputId
            ? resolvedSourceWidget?.outputs.find(
                (option) => option.id === currentResolved.sourceOutputId,
              )
            : undefined;
          const mappingSummary =
            currentBinding?.sourceOutputId && currentBinding?.sourceWidgetId
              ? `${selectedOutput?.label ?? currentBinding.sourceOutputId} -> ${input.label}`
              : "No mapping selected";

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

                {currentResolved ? (
                  <Badge
                    variant={currentResolved.status === "valid" ? "success" : "warning"}
                  >
                    {currentResolved.status}
                  </Badge>
                ) : null}
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

                        if (!nextSourceWidgetId) {
                          setDraftBindings((current) =>
                            updateBindingDraft(current, input.id, undefined),
                          );
                          return;
                        }

                        const nextSourceWidget = sourceWidgetOptions.find(
                          (option) => option.id === nextSourceWidgetId,
                        );
                        const nextSourceOutputId =
                          nextSourceWidget?.outputs[0]?.id;

                        setDraftBindings((current) =>
                          updateBindingDraft(
                            current,
                            input.id,
                            nextSourceOutputId
                              ? {
                                  sourceWidgetId: nextSourceWidgetId,
                                  sourceOutputId: nextSourceOutputId,
                                }
                              : undefined,
                          ),
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

                        setDraftBindings((current) =>
                          updateBindingDraft(
                            current,
                            input.id,
                            selectedSourceWidget && nextSourceOutputId
                              ? {
                                  sourceWidgetId: selectedSourceWidget.id,
                                  sourceOutputId: nextSourceOutputId,
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
                    {selectedOutput?.description ? (
                      <div className="text-xs text-muted-foreground">
                        {selectedOutput.description}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 px-3 py-2 text-sm">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Mapping
                  </div>
                  <div className="mt-1 font-medium text-foreground">{mappingSummary}</div>
                  {resolvedSourceWidget && resolvedSourceOutput ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Current source: {resolvedSourceWidget.label} / {resolvedSourceOutput.label}
                    </div>
                  ) : null}
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

        <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              setDraftBindings(initialBindings);
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
      </div>
    </section>
  );
}
