import {
  APP_COMPONENT_MOCK_JSON_BASE_URL,
  type AppComponentMockJsonDefinition,
  type AppComponentWidgetProps,
  type OpenApiDocument,
  type OpenApiOperation,
  type OpenApiRequestBody,
  type OpenApiResponse,
  type OpenApiSchema,
} from "./appComponentModel";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIsoDateTimeString(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function mergeInferredObjectSchemas(schemas: OpenApiSchema[]) {
  const objectSchemas = schemas.filter((schema) => schema.type === "object");

  if (objectSchemas.length === 0) {
    return schemas[0];
  }

  const propertyEntries = new Map<string, OpenApiSchema>();
  const requiredCounts = new Map<string, number>();

  for (const schema of objectSchemas) {
    for (const requiredField of schema.required ?? []) {
      requiredCounts.set(requiredField, (requiredCounts.get(requiredField) ?? 0) + 1);
    }

    for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (!propertyEntries.has(key)) {
        propertyEntries.set(key, propertySchema as OpenApiSchema);
      }
    }
  }

  const required = Array.from(requiredCounts.entries())
    .filter(([, count]) => count === objectSchemas.length)
    .map(([key]) => key);

  return {
    type: "object",
    properties: Object.fromEntries(propertyEntries.entries()),
    required: required.length > 0 ? required : undefined,
  } satisfies OpenApiSchema;
}

export function inferOpenApiSchemaFromJsonValue(value: unknown): OpenApiSchema | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return {
      nullable: true,
    };
  }

  if (typeof value === "boolean") {
    return {
      type: "boolean",
      example: value,
    };
  }

  if (typeof value === "number") {
    return {
      type: Number.isInteger(value) ? "integer" : "number",
      example: value,
    };
  }

  if (typeof value === "string") {
    return {
      type: "string",
      format: isIsoDateTimeString(value)
        ? "date-time"
        : isIsoDateString(value)
          ? "date"
          : undefined,
      example: value,
    };
  }

  if (Array.isArray(value)) {
    const inferredItems = value
      .map((entry) => inferOpenApiSchemaFromJsonValue(entry))
      .filter((entry): entry is OpenApiSchema => Boolean(entry));
    const itemSchema = inferredItems.length === 0
      ? undefined
      : inferredItems.every((entry) => entry.type === "object")
        ? mergeInferredObjectSchemas(inferredItems)
        : inferredItems[0];

    return {
      type: "array",
      items: itemSchema,
      example: cloneJson(value),
    };
  }

  if (isPlainRecord(value)) {
    const properties = Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) => {
        const schema = inferOpenApiSchemaFromJsonValue(entry);
        return schema ? [[key, schema] as const] : [];
      }),
    );

    return {
      type: "object",
      properties,
      required: Object.keys(properties),
      example: cloneJson(value),
    };
  }

  return {
    type: "string",
    example: String(value),
  };
}

function applyResponseUiMetadata(
  schema: OpenApiSchema | undefined,
  definition: AppComponentMockJsonDefinition | undefined,
) {
  if (!schema || !definition?.response.ui?.role || !definition.response.ui.widget) {
    return schema;
  }

  return {
    ...schema,
    "x-ui-role": definition.response.ui.role,
    "x-ui-widget": definition.response.ui.widget,
  } satisfies OpenApiSchema;
}

function applyOperationUiMetadata(
  operation: OpenApiOperation,
  definition: AppComponentMockJsonDefinition | undefined,
) {
  const ui = definition?.operation.ui;

  if (!ui?.role || !ui.widget) {
    return operation;
  }

  const nextOperation: OpenApiOperation = {
    ...operation,
    "x-ui-role": ui.role,
    "x-ui-widget": ui.widget,
  };

  if (ui.selectionType) {
    nextOperation["x-ui-selection-type"] = ui.selectionType;
  }

  if (ui.searchParam) {
    nextOperation["x-search-param"] = ui.searchParam;
  }

  if (ui.searchParamAliases?.length) {
    nextOperation["x-search-param-aliases"] = [...ui.searchParamAliases];
  }

  if (ui.itemsPath) {
    nextOperation["x-items-path"] = ui.itemsPath;
  }

  if (ui.itemValueField) {
    nextOperation["x-item-value-field"] = ui.itemValueField;
  }

  if (ui.itemLabelField) {
    nextOperation["x-item-label-field"] = ui.itemLabelField;
  }

  if (ui.paginationPath) {
    nextOperation["x-pagination-path"] = ui.paginationPath;
  }

  if (ui.paginationMoreField) {
    nextOperation["x-pagination-more-field"] = ui.paginationMoreField;
  }

  return nextOperation;
}

export function buildAppComponentMockJsonOpenApiDocument(
  props: Pick<
    AppComponentWidgetProps,
    "method" | "path" | "requestBodyContentType" | "mockJson"
  >,
) {
  const definition = props.mockJson;
  const method = props.method ?? definition?.operation.method;
  const path = props.path ?? definition?.operation.path;

  if (!method || !path) {
    return {
      openapi: "3.0.3",
      info: {
        title: "AppComponent Mock JSON",
        version: "1.0.0",
        description:
          "Synthetic OpenAPI document generated from the inline mock-json AppComponent target.",
      },
      paths: {},
      servers: [
        {
          url: APP_COMPONENT_MOCK_JSON_BASE_URL,
          description: "Synthetic inline mock-json target",
        },
      ],
    } satisfies OpenApiDocument;
  }

  const requestBodyContentType =
    props.requestBodyContentType ??
    definition?.request?.bodyContentType ??
    "application/json";
  const requestBodySchema = definition?.request?.bodySchema
    ? cloneJson(definition.request.bodySchema)
    : undefined;
  const requestBody = requestBodySchema
    ? {
        description: definition?.request?.bodyDescription,
        required: definition?.request?.bodyRequired === true,
        content: {
          [requestBodyContentType]: {
            schema: requestBodySchema,
          },
        },
      } satisfies OpenApiRequestBody
    : undefined;
  const responseBody = definition?.response.body;
  const responseSchema = applyResponseUiMetadata(
    definition?.response.schema
      ? cloneJson(definition.response.schema)
      : inferOpenApiSchemaFromJsonValue(responseBody),
    definition,
  );
  const responseContentType = definition?.response.contentType ?? "application/json";
  const response = {
    description:
      definition?.response.description ??
      "Synthetic response published from the AppComponent mock-json target.",
    content: {
      [responseContentType]: {
        schema: responseSchema,
        example: responseBody === undefined ? undefined : cloneJson(responseBody),
      },
    },
  } satisfies OpenApiResponse;
  const operation: OpenApiOperation = {
    summary: definition?.operation.summary,
    description: definition?.operation.description,
    parameters:
      definition?.request?.parameters?.map((parameter) => cloneJson(parameter)) ?? undefined,
    requestBody,
    responses: {
      [String(definition?.response.status ?? 200)]: response,
    },
  };

  const operationWithUi = applyOperationUiMetadata(operation, definition);

  return {
    openapi: "3.0.3",
    info: {
      title: definition?.operation.summary || "AppComponent Mock JSON",
      version: "1.0.0",
      description:
        "Synthetic OpenAPI document generated from the inline mock-json AppComponent target.",
    },
    servers: [
      {
        url: APP_COMPONENT_MOCK_JSON_BASE_URL,
        description: "Synthetic inline mock-json target",
      },
    ],
    paths: {
      [path]: {
        [method]: operationWithUi,
      },
    },
  } satisfies OpenApiDocument;
}
