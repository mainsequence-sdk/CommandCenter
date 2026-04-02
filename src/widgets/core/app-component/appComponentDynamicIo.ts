import type {
  WidgetIoDefinition,
  WidgetOutputPortDefinition,
} from "@/widgets/types";

import {
  buildAppComponentOperationKey,
  normalizeAppComponentProps,
  normalizeAppComponentRuntimeState,
  resolveAppComponentResponseValueAtPath,
  type AppComponentBindingOutputPortSpec,
  type AppComponentWidgetProps,
} from "./appComponentModel";

function buildAppComponentOutputPort(
  port: AppComponentBindingOutputPortSpec,
  operationKey: string,
): WidgetOutputPortDefinition<AppComponentWidgetProps> {
  return {
    id: port.id,
    label: port.label,
    contract: port.contract,
    description: port.description,
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

  if (!bindingSpec || !normalizedProps.method || !normalizedProps.path) {
    return undefined;
  }

  const currentOperationKey = buildAppComponentOperationKey(
    normalizedProps.method,
    normalizedProps.path,
  );

  if (bindingSpec.operationKey !== currentOperationKey) {
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
