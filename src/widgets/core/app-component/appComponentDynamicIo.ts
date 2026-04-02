import type {
  WidgetIoDefinition,
  WidgetOutputPortDefinition,
} from "@/widgets/types";

import {
  normalizeAppComponentProps,
  normalizeAppComponentRuntimeState,
  resolveAppComponentResponseValueAtPath,
  type AppComponentBindingOutputPortSpec,
  type AppComponentWidgetProps,
} from "./appComponentModel";
import { titleCase } from "@/lib/utils";

function buildResolvedAppComponentOutputLabel(
  port: AppComponentBindingOutputPortSpec,
) {
  if (port.responsePath.length === 0) {
    return "Response Body";
  }

  return port.responsePath.map((segment) => titleCase(segment)).join(" / ");
}

function buildAppComponentOutputPort(
  port: AppComponentBindingOutputPortSpec,
  operationKey: string,
): WidgetOutputPortDefinition<AppComponentWidgetProps> {
  return {
    id: port.id,
    label: buildResolvedAppComponentOutputLabel(port),
    contract: port.contract,
    description: port.description,
    valueDescriptor: port.valueDescriptor,
    resolveValue: ({ runtimeState }) => {
      const normalizedRuntimeState = normalizeAppComponentRuntimeState(runtimeState);

      if (normalizedRuntimeState.operationKey !== operationKey) {
        return undefined;
      }

      if (normalizedRuntimeState.publishedOutputs?.[port.id] !== undefined) {
        return normalizedRuntimeState.publishedOutputs[port.id];
      }

      return resolveAppComponentResponseValueAtPath(
        normalizedRuntimeState.lastResponseBody,
        port.responsePath,
      );
    },
  };
}

export function resolveAppComponentWidgetIo(
  props: AppComponentWidgetProps,
): WidgetIoDefinition<AppComponentWidgetProps> | undefined {
  const normalizedProps = normalizeAppComponentProps(props);
  const bindingSpec = normalizedProps.bindingSpec;

  if (!bindingSpec) {
    return undefined;
  }

  return {
    inputs: bindingSpec.requestPorts.map((port) => ({
      id: port.id,
      label: port.label,
      description: port.description,
      accepts: [...port.accepts],
      required: port.required,
      effects: [
        {
          kind: "drives-value",
          sourcePath: port.id,
          target: { kind: "generated-field", id: port.fieldKey },
          description: `Bound value populates ${port.label}.`,
        },
      ],
    })),
    outputs: bindingSpec.responsePorts.map((port) =>
      buildAppComponentOutputPort(port, bindingSpec.operationKey),
    ),
  };
}
