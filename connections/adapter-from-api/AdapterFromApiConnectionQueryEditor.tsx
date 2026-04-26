import { useEffect, useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ConnectionQueryEditorSection,
  ConnectionQueryField,
} from "@/connections/components/ConnectionQueryEditorFields";
import type { ConnectionQueryEditorProps } from "@/connections/types";

import {
  ADAPTER_FROM_API_QUERY_KIND,
  type AdapterFromApiCompiledContract,
  type AdapterFromApiConnectionQuery,
  type AdapterFromApiFieldType,
  type AdapterFromApiOperationDefinition,
  type AdapterFromApiOperationParameter,
  type AdapterFromApiParameterLocation,
  type AdapterFromApiResponseMapping,
} from "./index";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readCompiledContract(value: unknown): AdapterFromApiCompiledContract | undefined {
  return isRecord(value) ? (value as unknown as AdapterFromApiCompiledContract) : undefined;
}

function readQueryOperations(contract: AdapterFromApiCompiledContract | undefined) {
  return (contract?.availableOperations ?? []).filter((operation) => {
    const capabilities = operation.capabilities ?? [];
    return operation.kind === "query" || capabilities.includes("query");
  });
}

function findOperation(
  operations: AdapterFromApiOperationDefinition[],
  operationId: string | undefined,
) {
  return (
    operations.find((operation) => operation.operationId === operationId) ??
    operations[0]
  );
}

function operationLabel(operation: AdapterFromApiOperationDefinition) {
  return operation.label ?? operation.operationId;
}

function operationDescription(operation: AdapterFromApiOperationDefinition | undefined) {
  if (!operation) {
    return "Select an operation from the backend-compiled API contract.";
  }

  return [
    operation.description,
    `${operation.method.toUpperCase()} ${operation.path}`,
  ].filter(Boolean).join(" ");
}

function patchQuery(
  value: AdapterFromApiConnectionQuery,
  onChange: (value: AdapterFromApiConnectionQuery) => void,
  patch: Partial<AdapterFromApiConnectionQuery>,
) {
  onChange({
    ...value,
    ...patch,
    kind: ADAPTER_FROM_API_QUERY_KIND,
  });
}

function patchParameter(
  value: AdapterFromApiConnectionQuery,
  onChange: (value: AdapterFromApiConnectionQuery) => void,
  location: AdapterFromApiParameterLocation,
  key: string,
  nextValue: unknown,
) {
  const parameters = value.parameters ?? {};
  const locationValues = parameters[location] ?? {};

  patchQuery(value, onChange, {
    parameters: {
      ...parameters,
      [location]: {
        ...locationValues,
        [key]: nextValue,
      },
    },
  });
}

function formatValue(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function parseValue(type: AdapterFromApiFieldType, rawValue: string): unknown {
  if (!rawValue.trim()) {
    return undefined;
  }

  if (type === "number") {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (type === "boolean") {
    return rawValue === "true";
  }

  if (type === "json") {
    try {
      return JSON.parse(rawValue) as unknown;
    } catch {
      return rawValue;
    }
  }

  return rawValue;
}

function OperationField({
  disabled,
  field,
  onChange,
  value,
}: {
  disabled?: boolean;
  field: AdapterFromApiOperationParameter;
  onChange: (value: unknown) => void;
  value: unknown;
}) {
  const formattedValue = formatValue(value ?? field.defaultValue);
  const help = field.description ?? `Operation parameter ${field.key}.`;

  if (field.type === "select") {
    return (
      <ConnectionQueryField help={help} label={field.label}>
        <Select
          value={formattedValue}
          onChange={(event) => onChange(event.target.value || undefined)}
          disabled={disabled}
        >
          <option value="">Select {field.label.toLowerCase()}</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </ConnectionQueryField>
    );
  }

  if (field.type === "boolean") {
    return (
      <ConnectionQueryField help={help} label={field.label}>
        <Select
          value={formattedValue}
          onChange={(event) => onChange(parseValue(field.type, event.target.value))}
          disabled={disabled}
        >
          <option value="">Not set</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </Select>
      </ConnectionQueryField>
    );
  }

  if (field.type === "json") {
    return (
      <ConnectionQueryField help={help} label={field.label} className="md:col-span-2">
        <Textarea
          className="min-h-28 font-mono text-xs"
          value={formattedValue}
          onChange={(event) => onChange(parseValue(field.type, event.target.value))}
          disabled={disabled}
          spellCheck={false}
          placeholder={String(field.example ?? '{"key": "value"}')}
        />
      </ConnectionQueryField>
    );
  }

  return (
    <ConnectionQueryField help={help} label={field.label}>
      <Input
        type={field.type === "number" ? "number" : "text"}
        value={formattedValue}
        onChange={(event) => onChange(parseValue(field.type, event.target.value))}
        disabled={disabled}
        placeholder={field.example === undefined ? field.label : String(field.example)}
      />
    </ConnectionQueryField>
  );
}

function getLocationParameters(
  operation: AdapterFromApiOperationDefinition | undefined,
  location: AdapterFromApiParameterLocation,
) {
  return operation?.parameters?.[location] ?? [];
}

function getMappingOptions(operation: AdapterFromApiOperationDefinition | undefined) {
  return operation?.responseMappings ?? [];
}

function defaultMappingId(mappings: AdapterFromApiResponseMapping[]) {
  return mappings[0]?.id;
}

export function AdapterFromApiConnectionQueryEditor({
  connectionInstance,
  disabled = false,
  onChange,
  queryModel,
  value,
}: ConnectionQueryEditorProps<AdapterFromApiConnectionQuery>) {
  const compiledContract = readCompiledContract(connectionInstance?.publicConfig.compiledContract);
  const operations = useMemo(() => readQueryOperations(compiledContract), [compiledContract]);
  const selectedOperation = findOperation(operations, value.operationId);
  const mappings = getMappingOptions(selectedOperation);
  const selectedMappingId = value.responseMappingId ?? defaultMappingId(mappings);
  const pathParameters = getLocationParameters(selectedOperation, "path");
  const queryParameters = getLocationParameters(selectedOperation, "query");
  const headerParameters = getLocationParameters(selectedOperation, "headers");
  const parameters = value.parameters ?? {};

  useEffect(() => {
    if (value.operationId || !selectedOperation) {
      return;
    }

    patchQuery(value, onChange, {
      operationId: selectedOperation.operationId,
      parameters: { path: {}, query: {}, headers: {} },
      body: selectedOperation.requestBody ? {} : null,
      responseMappingId: defaultMappingId(mappings),
    });
  }, [mappings, onChange, selectedOperation, value]);

  function selectOperation(operationId: string) {
    const nextOperation = findOperation(operations, operationId);
    const nextMappings = getMappingOptions(nextOperation);

    patchQuery(value, onChange, {
      operationId,
      parameters: { path: {}, query: {}, headers: {} },
      body: nextOperation?.requestBody ? {} : null,
      responseMappingId: defaultMappingId(nextMappings),
    });
  }

  if (!compiledContract) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-warning/35 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">
        No compiled API contract is available on this connection instance. The backend adapter must
        discover and store a sanitized compiledContract before queries can be authored.
      </div>
    );
  }

  if (operations.length === 0) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-warning/35 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">
        The compiled API contract does not declare any query operations.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Configured API</div>
        <div className="mt-1 break-words">
          {compiledContract.adapter?.title ??
            compiledContract.adapter?.id ??
            connectionInstance?.name ??
            "Adapter From API"}
        </div>
      </div>

      <ConnectionQueryEditorSection
        title={queryModel?.label ?? "API operation"}
        description={operationDescription(selectedOperation)}
      >
        <ConnectionQueryField
          label="Operation"
          help="Operation declared by the backend-compiled API contract. The backend rejects undeclared operation ids."
          className="md:col-span-2"
        >
          <Select
            value={selectedOperation?.operationId ?? ""}
            onChange={(event) => selectOperation(event.target.value)}
            disabled={disabled}
          >
            {operations.map((operation) => (
              <option key={operation.operationId} value={operation.operationId}>
                {operationLabel(operation)} · {operation.method.toUpperCase()} {operation.path}
              </option>
            ))}
          </Select>
        </ConnectionQueryField>

        {mappings.length > 0 ? (
          <ConnectionQueryField
            label="Response mapping"
            help="Response mapping declared by the API contract. The backend uses this to normalize provider responses into Command Center frames."
            className="md:col-span-2"
          >
            <Select
              value={selectedMappingId ?? ""}
              onChange={(event) =>
                patchQuery(value, onChange, { responseMappingId: event.target.value || undefined })
              }
              disabled={disabled}
            >
              {mappings.map((mapping) => (
                <option key={mapping.id} value={mapping.id}>
                  {mapping.label ?? mapping.id} · {mapping.contract}
                </option>
              ))}
            </Select>
          </ConnectionQueryField>
        ) : null}
      </ConnectionQueryEditorSection>

      {pathParameters.length > 0 ? (
        <ConnectionQueryEditorSection
          title="Path parameters"
          description="Path parameters declared by the selected operation."
        >
          {pathParameters.map((field) => (
            <OperationField
              key={field.key}
              field={field}
              value={parameters.path?.[field.key]}
              onChange={(nextValue) => patchParameter(value, onChange, "path", field.key, nextValue)}
              disabled={disabled}
            />
          ))}
        </ConnectionQueryEditorSection>
      ) : null}

      {queryParameters.length > 0 ? (
        <ConnectionQueryEditorSection
          title="Query parameters"
          description="Query string parameters declared by the selected operation."
        >
          {queryParameters.map((field) => (
            <OperationField
              key={field.key}
              field={field}
              value={parameters.query?.[field.key]}
              onChange={(nextValue) => patchParameter(value, onChange, "query", field.key, nextValue)}
              disabled={disabled}
            />
          ))}
        </ConnectionQueryEditorSection>
      ) : null}

      {headerParameters.length > 0 ? (
        <ConnectionQueryEditorSection
          title="Headers"
          description="Only safe user-configurable headers declared by the contract are shown here."
        >
          {headerParameters.map((field) => (
            <OperationField
              key={field.key}
              field={field}
              value={parameters.headers?.[field.key]}
              onChange={(nextValue) =>
                patchParameter(value, onChange, "headers", field.key, nextValue)
              }
              disabled={disabled}
            />
          ))}
        </ConnectionQueryEditorSection>
      ) : null}

      {selectedOperation?.requestBody ? (
        <ConnectionQueryEditorSection
          title="Request body"
          description={selectedOperation.requestBody.description ?? "JSON request body for this operation."}
        >
          <ConnectionQueryField
            label="Body JSON"
            help="The backend validates this body against the operation contract before sending it upstream."
            className="md:col-span-2"
          >
            <Textarea
              className="min-h-40 font-mono text-xs"
              value={formatValue(value.body)}
              onChange={(event) => {
                const rawValue = event.target.value;
                let body: unknown = rawValue;

                try {
                  body = rawValue.trim() ? JSON.parse(rawValue) : null;
                } catch {
                  body = rawValue;
                }

                patchQuery(value, onChange, { body });
              }}
              disabled={disabled}
              spellCheck={false}
              placeholder='{"key": "value"}'
            />
          </ConnectionQueryField>
        </ConnectionQueryEditorSection>
      ) : null}
    </div>
  );
}
