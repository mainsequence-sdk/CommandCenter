import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  widgetTightFormDescriptionClass,
  widgetTightFormInsetSectionClass,
  widgetTightFormLabelClass,
  widgetTightFormSectionClass,
  widgetTightFormTitleClass,
} from "@/widgets/shared/form-density";

import {
  buildDefaultAppComponentMockJsonDefinition,
  type AppComponentApiTargetMode,
  type AppComponentHttpMethod,
  type AppComponentMockJsonDefinition,
} from "./appComponentModel";

type AppComponentMockJsonRequestDefinition =
  NonNullable<AppComponentMockJsonDefinition["request"]>;

function formatJson(value: unknown) {
  return value === undefined ? "" : JSON.stringify(value, null, 2);
}

function parseJsonText(
  value: string,
  options?: {
    allowEmpty?: boolean;
    requireArray?: boolean;
    requireObject?: boolean;
  },
) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      value: undefined,
      error: options?.allowEmpty === false ? "A JSON value is required." : undefined,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (options?.requireArray && !Array.isArray(parsed)) {
      return {
        value: undefined,
        error: "This field expects a JSON array.",
      };
    }

    if (
      options?.requireObject &&
      (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    ) {
      return {
        value: undefined,
        error: "This field expects a JSON object.",
      };
    }

    return {
      value: parsed,
      error: undefined,
    };
  } catch (error) {
    return {
      value: undefined,
      error: error instanceof Error ? error.message : "Invalid JSON.",
    };
  }
}

function resolveResponseUiMode(definition: AppComponentMockJsonDefinition) {
  if (definition.response.ui?.role === "notification") {
    return "notification";
  }

  if (definition.response.ui?.role === "editable-form") {
    return "editable-form";
  }

  return "default";
}

const supportedMethods: AppComponentHttpMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
];

export function AppComponentMockJsonEditor({
  editable,
  targetMode,
  value,
  onChange,
}: {
  editable: boolean;
  targetMode: AppComponentApiTargetMode;
  value: AppComponentMockJsonDefinition | undefined;
  onChange: (nextValue: AppComponentMockJsonDefinition) => void;
}) {
  const definition = useMemo(
    () => value ?? buildDefaultAppComponentMockJsonDefinition(),
    [value],
  ) as AppComponentMockJsonDefinition;
  const serializedDefinition = useMemo(
    () => JSON.stringify(definition),
    [definition],
  );
  const [parametersText, setParametersText] = useState(
    formatJson(definition.request?.parameters),
  );
  const [parametersError, setParametersError] = useState<string>();
  const [bodySchemaText, setBodySchemaText] = useState(
    formatJson(definition.request?.bodySchema),
  );
  const [bodySchemaError, setBodySchemaError] = useState<string>();
  const [responseDefinitionText, setResponseDefinitionText] = useState(
    formatJson(definition.response),
  );
  const [responseDefinitionError, setResponseDefinitionError] = useState<string>();
  const [responseSchemaText, setResponseSchemaText] = useState(
    formatJson(definition.response.schema),
  );
  const [responseSchemaError, setResponseSchemaError] = useState<string>();

  useEffect(() => {
    setParametersText(formatJson(definition.request?.parameters));
    setParametersError(undefined);
    setBodySchemaText(formatJson(definition.request?.bodySchema));
    setBodySchemaError(undefined);
    setResponseDefinitionText(formatJson(definition.response));
    setResponseDefinitionError(undefined);
    setResponseSchemaText(formatJson(definition.response.schema));
    setResponseSchemaError(undefined);
  }, [serializedDefinition]);

  function patch(nextValue: Partial<AppComponentMockJsonDefinition>) {
    onChange({
      ...definition,
      ...nextValue,
      operation: {
        ...definition.operation,
        ...nextValue.operation,
      },
      request:
        nextValue.request === undefined
          ? definition.request
          : {
              ...definition.request,
              ...nextValue.request,
            },
      response: {
        ...definition.response,
        ...nextValue.response,
        ui:
          nextValue.response && "ui" in nextValue.response
            ? nextValue.response.ui
            : definition.response.ui,
      },
    });
  }

  return (
    <section className={widgetTightFormSectionClass}>
      <div className="space-y-1">
        <div className={widgetTightFormTitleClass}>Mock JSON Target</div>
        <p className={widgetTightFormDescriptionClass}>
          This target generates a synthetic OpenAPI document from inline JSON so you can prototype
          AppComponent request forms, response rendering, and downstream bindings without deploying
          an API.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Method</span>
          <Select
            value={definition.operation.method ?? "post"}
            disabled={!editable || targetMode !== "mock-json"}
            onChange={(event) => {
              patch({
                operation: {
                  method: event.target.value as AppComponentHttpMethod,
                },
              });
            }}
          >
            {supportedMethods.map((method) => (
              <option key={method} value={method}>
                {method.toUpperCase()}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Path</span>
          <Input
            value={definition.operation.path ?? ""}
            disabled={!editable || targetMode !== "mock-json"}
            placeholder="/mock"
            onChange={(event) => {
              patch({
                operation: {
                  path: event.target.value,
                },
              });
            }}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Summary</span>
          <Input
          value={definition.operation.summary ?? ""}
          disabled={!editable || targetMode !== "mock-json"}
          placeholder="Inline mock notification"
            onChange={(event) => {
              patch({
                operation: {
                  summary: event.target.value,
                },
              });
            }}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Response status</span>
          <Input
            type="number"
            min={100}
            max={599}
            value={definition.response.status ?? 200}
            disabled={!editable || targetMode !== "mock-json"}
            onChange={(event) => {
              const rawStatus = Number(event.target.value);

              patch({
                response: {
                  status: Number.isFinite(rawStatus) ? Math.trunc(rawStatus) : 200,
                },
              });
            }}
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-topbar-foreground">Description</span>
        <Textarea
          value={definition.operation.description ?? ""}
          disabled={!editable || targetMode !== "mock-json"}
          rows={3}
          placeholder="Explain what this mocked endpoint is simulating."
          onChange={(event) => {
            patch({
              operation: {
                description: event.target.value,
              },
            });
          }}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Request body content type</span>
          <Input
            value={definition.request?.bodyContentType ?? "application/json"}
            disabled={!editable || targetMode !== "mock-json"}
            placeholder="application/json"
            onChange={(event) => {
              patch({
                request: {
                  bodyContentType: event.target.value,
                },
              });
            }}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Response content type</span>
          <Input
            value={definition.response.contentType ?? "application/json"}
            disabled={!editable || targetMode !== "mock-json"}
            placeholder="application/json"
            onChange={(event) => {
              patch({
                response: {
                  contentType: event.target.value,
                },
              });
            }}
          />
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-3 py-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          checked={definition.request?.bodyRequired === true}
          disabled={!editable || targetMode !== "mock-json"}
          onChange={(event) => {
            patch({
              request: {
                bodyRequired: event.target.checked,
              },
            });
          }}
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium text-topbar-foreground">
            Require request body
          </span>
          <span className="block text-sm text-muted-foreground">
            When enabled, the generated request body is required before the mock target will build
            a valid request.
          </span>
        </span>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-topbar-foreground">
          Request parameters JSON
        </span>
        <Textarea
          value={parametersText}
          disabled={!editable || targetMode !== "mock-json"}
          rows={8}
          className="font-mono text-xs"
          placeholder='[{"name":"trade_id","in":"query","required":true,"schema":{"type":"string"}}]'
          onChange={(event) => {
            const nextText = event.target.value;
            setParametersText(nextText);
            const parsed = parseJsonText(nextText, {
              allowEmpty: true,
              requireArray: true,
            });
            setParametersError(parsed.error);

            if (!parsed.error) {
              patch({
                request: {
                  parameters: parsed.value as AppComponentMockJsonRequestDefinition["parameters"],
                },
              });
            }
          }}
        />
        <p className={widgetTightFormDescriptionClass}>
          Optional OpenAPI parameter array for path, query, or header fields.
        </p>
        {parametersError ? <div className="text-xs text-danger">{parametersError}</div> : null}
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-topbar-foreground">
          Request body schema JSON
        </span>
        <Textarea
          value={bodySchemaText}
          disabled={!editable || targetMode !== "mock-json"}
          rows={10}
          className="font-mono text-xs"
          placeholder='{"type":"object","properties":{"trade_date":{"type":"string","format":"date"}}}'
          onChange={(event) => {
            const nextText = event.target.value;
            setBodySchemaText(nextText);
            const parsed = parseJsonText(nextText, {
              allowEmpty: true,
              requireObject: true,
            });
            setBodySchemaError(parsed.error);

            if (!parsed.error) {
              patch({
                request: {
                  bodySchema: parsed.value as AppComponentMockJsonRequestDefinition["bodySchema"],
                },
              });
            }
          }}
        />
        <p className={widgetTightFormDescriptionClass}>
          Optional OpenAPI schema object for the generated request body.
        </p>
        {bodySchemaError ? <div className="text-xs text-danger">{bodySchemaError}</div> : null}
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-topbar-foreground">
          Response definition JSON
        </span>
        <Textarea
          value={responseDefinitionText}
          disabled={!editable || targetMode !== "mock-json"}
          rows={12}
          className="font-mono text-xs"
          placeholder='{"status":200,"contentType":"application/json","ui":{"role":"notification","widget":"banner-v1"},"body":{"title":"Action completed","message":"This is a mock AppComponent notification response.","tone":"success","details":"Use this inline target to prototype response rendering and downstream widget bindings before a real API exists."}}'
          onChange={(event) => {
            const nextText = event.target.value;
            setResponseDefinitionText(nextText);
            const parsed = parseJsonText(nextText, {
              allowEmpty: true,
              requireObject: true,
            });
            setResponseDefinitionError(parsed.error);

            if (!parsed.error) {
              onChange({
                ...definition,
                response: parsed.value as AppComponentMockJsonDefinition["response"],
              });
            }
          }}
        />
        <p className={widgetTightFormDescriptionClass}>
          This is the full saved mock response definition. Include `status`, `contentType`, `ui`,
          and `body` here so the mock target matches how the response is compiled and displayed.
        </p>
        {responseDefinitionError ? (
          <div className="text-xs text-danger">{responseDefinitionError}</div>
        ) : null}
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-topbar-foreground">
          Response schema JSON
        </span>
        <Textarea
          value={responseSchemaText}
          disabled={!editable || targetMode !== "mock-json"}
          rows={10}
          className="font-mono text-xs"
          placeholder='{"type":"object","properties":{"status":{"type":"string"}}}'
          onChange={(event) => {
            const nextText = event.target.value;
            setResponseSchemaText(nextText);
            const parsed = parseJsonText(nextText, {
              allowEmpty: true,
              requireObject: true,
            });
            setResponseSchemaError(parsed.error);

            if (!parsed.error) {
              patch({
                response: {
                  schema: parsed.value as AppComponentMockJsonDefinition["response"]["schema"],
                },
              });
            }
          }}
        />
        <p className={widgetTightFormDescriptionClass}>
          Optional explicit OpenAPI schema object. Leave blank to infer a lightweight schema from
          the response body JSON.
        </p>
        {responseSchemaError ? <div className="text-xs text-danger">{responseSchemaError}</div> : null}
      </label>

      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Response UI</span>
          <Select
            value={resolveResponseUiMode(definition)}
            disabled={!editable || targetMode !== "mock-json"}
            onChange={(event) => {
              const nextMode = event.target.value;

              patch({
                response: {
                  ui:
                    nextMode === "notification"
                      ? { role: "notification", widget: "banner-v1" }
                      : nextMode === "editable-form"
                        ? { role: "editable-form", widget: "definition-v1" }
                        : undefined,
                },
              });
            }}
          >
            <option value="default">Default response viewer</option>
            <option value="notification">Notification banner</option>
            <option value="editable-form">Editable form</option>
          </Select>
        </label>

        <div className={widgetTightFormInsetSectionClass}>
          <div className={widgetTightFormLabelClass}>Target Behavior</div>
          <p className={widgetTightFormDescriptionClass}>
            The mock target never makes a network request. It compiles a synthetic OpenAPI
            document, validates request inputs through the normal AppComponent form builder, and
            then returns the configured response body as the latest response and published outputs.
          </p>
        </div>
      </div>
    </section>
  );
}
