import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useDashboardWidgetDependencies,
  useResolvedWidgetIo,
} from "@/dashboards/DashboardWidgetDependencies";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import { normalizeWidgetInstanceBindings } from "@/dashboards/widget-dependencies";
import type {
  WidgetDefinition,
  WidgetInstanceBindings,
  WidgetPortBinding,
} from "@/widgets/types";
import {
  WidgetSourceExplorer,
  type WidgetSourceExplorerWidgetOption,
} from "@/widgets/shared/WidgetSourceExplorer";

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
            })),
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
          const currentBindingValue = draftBindings?.[input.id];
          const currentBinding = Array.isArray(currentBindingValue)
            ? currentBindingValue[0]
            : currentBindingValue;
          const sourceWidgetOptions = sourceWidgetsByInputId.get(input.id) ?? [];
          const selectedSourceWidgetId = draftSourceWidgetIds[input.id] ?? currentBinding?.sourceWidgetId ?? "";

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
              </div>

              <WidgetSourceExplorer
                editable={editable}
                inputLabel={input.label}
                acceptedContracts={input.accepts}
                selectedSourceWidgetId={selectedSourceWidgetId}
                sourceWidgets={sourceWidgetOptions}
                value={currentBinding}
                onSelectedSourceWidgetIdChange={(nextSourceWidgetId) => {
                  setDraftSourceWidgetIds((current) => ({
                    ...current,
                    [input.id]: nextSourceWidgetId,
                  }));
                }}
                onBindingChange={(nextBinding) => {
                  setDraftBindings((current) =>
                    updateBindingDraft(current, input.id, nextBinding),
                  );
                }}
              />

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
                setDraftBindings(undefined);
                setDraftSourceWidgetIds({});
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
