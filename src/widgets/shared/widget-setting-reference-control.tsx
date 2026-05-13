import { useEffect, useMemo, useState } from "react";

import { Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardWidgetDependencies } from "@/dashboards/DashboardWidgetDependencies";
import {
  inferWidgetValueDescriptor,
  listWidgetValueDescriptorPaths,
} from "@/dashboards/widget-binding-transforms";
import {
  WIDGET_REFERENCE_TITLE_INPUT_ID,
} from "@/dashboards/widget-instance-references";
import { normalizeWidgetInstanceBindings } from "@/dashboards/widget-dependencies";
import { cn } from "@/lib/utils";
import type {
  WidgetContractId,
  WidgetInputPortDefinition,
  WidgetInstanceBindings,
  WidgetPortBinding,
  WidgetValueDescriptor,
} from "@/widgets/types";

import {
  WidgetSourceExplorer,
  type WidgetSourceExplorerWidgetOption,
} from "./WidgetSourceExplorer";

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
  acceptedOutputIds?: string[],
) {
  if (acceptedOutputIds?.length && !acceptedOutputIds.includes(output.id)) {
    return false;
  }

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

function toSingleBinding(value: WidgetPortBinding | WidgetPortBinding[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function updateSingleWidgetBinding(
  bindings: WidgetInstanceBindings | undefined,
  inputId: string,
  binding: WidgetPortBinding | undefined,
) {
  const nextBindings = {
    ...(normalizeWidgetInstanceBindings(bindings) ?? {}),
  } satisfies NonNullable<WidgetInstanceBindings>;

  if (!binding) {
    delete nextBindings[inputId];
  } else {
    nextBindings[inputId] = binding;
  }

  return normalizeWidgetInstanceBindings(nextBindings);
}

export function WidgetSettingReferenceControl({
  editable,
  instanceId,
  input,
  value,
  onBindingChange,
}: {
  editable: boolean;
  instanceId: string;
  input: WidgetInputPortDefinition<Record<string, unknown>>;
  value: WidgetPortBinding | WidgetPortBinding[] | undefined;
  onBindingChange: (binding: WidgetPortBinding | undefined) => void;
}) {
  const dependencies = useDashboardWidgetDependencies();
  const binding = toSingleBinding(value);
  const [open, setOpen] = useState(Boolean(binding));
  const [selectedSourceWidgetId, setSelectedSourceWidgetId] = useState(binding?.sourceWidgetId ?? "");

  useEffect(() => {
    if (binding) {
      setOpen(true);
    }
  }, [binding]);

  useEffect(() => {
    setSelectedSourceWidgetId(binding?.sourceWidgetId ?? "");
  }, [binding?.sourceOutputId, binding?.sourceWidgetId, input.id, instanceId]);

  const sourceWidgets = useMemo(() => {
    if (!dependencies) {
      return [] satisfies WidgetSourceExplorerWidgetOption[];
    }

    return dependencies.entries.flatMap(({ instance: sourceInstance }) => {
      if (sourceInstance.id === instanceId) {
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
          valueDescriptor: resolvedOutputs[output.id]?.valueDescriptor ?? output.valueDescriptor,
        }))
        .filter((output) =>
          isBindableSourceOutput(output, input.accepts, input.acceptedOutputIds),
        );

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
  }, [dependencies, input.acceptedOutputIds, input.accepts, instanceId]);

  const active = Boolean(binding);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        {active ? <Badge variant="secondary">Reference</Badge> : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!editable}
          aria-pressed={active}
          aria-label={active ? `Edit reference for ${input.label}` : `Use reference for ${input.label}`}
          title={active ? `Edit reference for ${input.label}` : `Use reference for ${input.label}`}
          className={cn(
            "h-8 w-8 shrink-0 border",
            active
              ? "border-primary/55 bg-primary/12 text-primary hover:bg-primary/16 hover:text-primary"
              : "border-border/70 text-muted-foreground hover:border-primary/45 hover:text-foreground",
          )}
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {open ? (
        <div className="space-y-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/18 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-xl text-sm text-muted-foreground">
              Use an upstream widget output for this setting instead of the local literal value.
            </p>
            {active ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!editable}
                onClick={() => {
                  onBindingChange(undefined);
                }}
              >
                Use literal value
              </Button>
            ) : null}
          </div>

          <WidgetSourceExplorer
            editable={editable}
            inputLabel={input.label}
            acceptedContracts={input.accepts}
            selectedSourceWidgetId={selectedSourceWidgetId}
            sourceWidgets={sourceWidgets}
            value={binding}
            onSelectedSourceWidgetIdChange={setSelectedSourceWidgetId}
            onBindingChange={onBindingChange}
          />

          <p className="text-xs text-muted-foreground">
            The literal value stays in widget props and becomes active again if you remove the
            reference.
          </p>
        </div>
      ) : null}
    </div>
  );
}
