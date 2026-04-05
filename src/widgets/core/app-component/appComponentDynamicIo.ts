import type {
  WidgetIoDefinition,
  WidgetOutputPortDefinition,
  WidgetValueDescriptor,
} from "@/widgets/types";

import {
  normalizeAppComponentProps,
  normalizeAppComponentRuntimeState,
  resolveAppComponentEditableFormFieldParsedValue,
  resolveAppComponentEditableFormRootValue,
  resolveAppComponentRequestInputDisplayLabel,
  resolveAppComponentResponseValueAtPath,
  type AppComponentEditableFormFieldDefinition,
  type AppComponentEditableFormSession,
  type AppComponentBindingOutputPortSpec,
  type AppComponentWidgetProps,
} from "./appComponentModel";
import { titleCase } from "@/lib/utils";
import {
  CORE_VALUE_JSON_CONTRACT,
  resolveAppComponentOutputContract,
} from "./appComponentContracts";

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

function buildEditableFormFieldValueDescriptor(
  field: AppComponentEditableFormFieldDefinition,
): WidgetValueDescriptor {
  switch (field.kind) {
    case "boolean":
      return {
        kind: "primitive",
        contract: resolveAppComponentOutputContract("boolean"),
        primitive: "boolean",
        description: field.description,
      };
    case "integer":
      return {
        kind: "primitive",
        contract: resolveAppComponentOutputContract("integer"),
        primitive: "integer",
        description: field.description,
      };
    case "number":
    case "percent":
      return {
        kind: "primitive",
        contract: resolveAppComponentOutputContract("number"),
        primitive: "number",
        description: field.description,
      };
    case "json":
      return {
        kind: "unknown",
        contract: CORE_VALUE_JSON_CONTRACT,
        description: field.description,
      };
    case "date":
      return {
        kind: "primitive",
        contract: resolveAppComponentOutputContract("string"),
        primitive: "string",
        format: "date",
        description: field.description,
      };
    case "date-time":
      return {
        kind: "primitive",
        contract: resolveAppComponentOutputContract("string"),
        primitive: "string",
        format: "date-time",
        description: field.description,
      };
    case "enum":
    case "string":
    default:
      return {
        kind: "primitive",
        contract: resolveAppComponentOutputContract("string"),
        primitive: "string",
        description: field.description,
      };
  }
}

function listEditableFormFields(
  session: AppComponentEditableFormSession,
) {
  return session.sections.flatMap((section) => section.fields);
}

function buildEditableFormRootOutputPort(
  session: AppComponentEditableFormSession,
  operationKey: string,
): WidgetOutputPortDefinition<AppComponentWidgetProps> {
  return {
    id: "editable-form:$",
    label: "Form Values",
    contract: CORE_VALUE_JSON_CONTRACT,
    description: "Current editable form values for this AppComponent response session.",
    valueDescriptor: {
      kind: "object",
      contract: CORE_VALUE_JSON_CONTRACT,
      fields: listEditableFormFields(session).map((field) => ({
        key: field.token,
        label: field.label,
        description: field.description,
        required: field.required,
        value: buildEditableFormFieldValueDescriptor(field),
      })),
    },
    resolveValue: ({ runtimeState }) => {
      const normalizedRuntimeState = normalizeAppComponentRuntimeState(runtimeState);

      if (normalizedRuntimeState.operationKey !== operationKey) {
        return undefined;
      }

      return (
        normalizedRuntimeState.publishedOutputs?.["editable-form:$"] ??
        resolveAppComponentEditableFormRootValue(
          normalizedRuntimeState.editableFormSession,
        )
      );
    },
  };
}

function buildEditableFormFieldOutputPort(
  field: AppComponentEditableFormFieldDefinition,
  operationKey: string,
): WidgetOutputPortDefinition<AppComponentWidgetProps> {
  const outputId = `editable-form:field:${field.token}`;

  return {
    id: outputId,
    label: field.label,
    description: field.description,
    contract: resolveAppComponentOutputContract(
      field.kind === "percent" ? "number" : field.kind === "enum" ? "string" : field.kind,
    ),
    valueDescriptor: buildEditableFormFieldValueDescriptor(field),
    resolveValue: ({ runtimeState }) => {
      const normalizedRuntimeState = normalizeAppComponentRuntimeState(runtimeState);

      if (normalizedRuntimeState.operationKey !== operationKey) {
        return undefined;
      }

      if (normalizedRuntimeState.publishedOutputs?.[outputId] !== undefined) {
        return normalizedRuntimeState.publishedOutputs[outputId];
      }

      const session = normalizedRuntimeState.editableFormSession;
      const currentField = session
        ? listEditableFormFields(session).find((entry) => entry.token === field.token)
        : undefined;

      if (!session || !currentField) {
        return undefined;
      }

      return resolveAppComponentEditableFormFieldParsedValue(
        currentField,
        session.valuesByToken[currentField.token] ?? "",
      );
    },
  };
}

export function resolveAppComponentWidgetIo(
  props: AppComponentWidgetProps,
  runtimeState?: Record<string, unknown>,
): WidgetIoDefinition<AppComponentWidgetProps> | undefined {
  const normalizedProps = normalizeAppComponentProps(props);
  const bindingSpec = normalizedProps.bindingSpec;

  if (!bindingSpec) {
    return undefined;
  }

  const normalizedRuntimeState = normalizeAppComponentRuntimeState(
    runtimeState,
  );
  const editableFormSession = normalizedRuntimeState.editableFormSession;
  const editableFormOutputs =
    editableFormSession &&
    editableFormSession.operationKey === bindingSpec.operationKey
      ? [
          buildEditableFormRootOutputPort(
            editableFormSession,
            bindingSpec.operationKey,
          ),
          ...listEditableFormFields(editableFormSession).map((field) =>
            buildEditableFormFieldOutputPort(field, bindingSpec.operationKey),
          ),
        ]
      : null;

  return {
    inputs: bindingSpec.requestPorts.map((port) => ({
      id: port.id,
      label: resolveAppComponentRequestInputDisplayLabel(
        normalizedProps,
        port.fieldKey,
        port.label,
      ),
      description: port.description,
      accepts: [...port.accepts],
      required: port.required,
      effects: [
        {
          kind: "drives-value",
          sourcePath: port.id,
          target: { kind: "generated-field", id: port.fieldKey },
          description: `Bound value populates ${resolveAppComponentRequestInputDisplayLabel(
            normalizedProps,
            port.fieldKey,
            port.label,
          )}.`,
        },
      ],
    })),
    outputs:
      editableFormOutputs ??
      bindingSpec.responsePorts.map((port) =>
        buildAppComponentOutputPort(port, bindingSpec.operationKey),
      ),
  };
}
