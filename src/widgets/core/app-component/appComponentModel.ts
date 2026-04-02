import { titleCase } from "@/lib/utils";

export type AppComponentHttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "options"
  | "head";

export type AppComponentAuthMode = "session-jwt" | "none";
export type AppComponentFieldLocation = "path" | "query" | "header" | "body";
export type AppComponentGeneratedFieldKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "date-time"
  | "enum"
  | "json";

export interface AppComponentWidgetProps extends Record<string, unknown> {
  apiBaseUrl?: string;
  authMode?: AppComponentAuthMode;
  method?: AppComponentHttpMethod;
  path?: string;
  requestBodyContentType?: string;
  showHeader?: boolean;
}

export interface AppComponentWidgetRuntimeState extends Record<string, unknown> {
  operationKey?: string;
  draftValues?: Record<string, string>;
  status?: "idle" | "submitting" | "success" | "error";
  lastExecutedAtMs?: number;
  lastRequestUrl?: string;
  lastResponseStatus?: number;
  lastResponseStatusText?: string;
  lastResponseBody?: unknown;
  lastResponseHeaders?: Record<string, string>;
  error?: string;
  publishedOutputs?: Record<string, unknown>;
}

export interface OpenApiReference {
  $ref: string;
}

export interface OpenApiSchema {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  example?: unknown;
  enum?: unknown[];
  nullable?: boolean;
  properties?: Record<string, OpenApiSchema | OpenApiReference>;
  required?: string[];
  items?: OpenApiSchema | OpenApiReference;
  additionalProperties?: boolean | OpenApiSchema | OpenApiReference;
  allOf?: Array<OpenApiSchema | OpenApiReference>;
  anyOf?: Array<OpenApiSchema | OpenApiReference>;
  oneOf?: Array<OpenApiSchema | OpenApiReference>;
}

export interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  schema?: OpenApiSchema | OpenApiReference;
  example?: unknown;
}

export interface OpenApiMediaType {
  schema?: OpenApiSchema | OpenApiReference;
  example?: unknown;
}

export interface OpenApiResponse {
  description?: string;
  content?: Record<string, OpenApiMediaType>;
}

export interface OpenApiRequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, OpenApiMediaType>;
}

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Array<OpenApiParameter | OpenApiReference>;
  requestBody?: OpenApiRequestBody | OpenApiReference;
  responses?: Record<string, OpenApiResponse | OpenApiReference>;
}

export interface OpenApiPathItem {
  parameters?: Array<OpenApiParameter | OpenApiReference>;
  get?: OpenApiOperation | OpenApiReference;
  post?: OpenApiOperation | OpenApiReference;
  put?: OpenApiOperation | OpenApiReference;
  patch?: OpenApiOperation | OpenApiReference;
  delete?: OpenApiOperation | OpenApiReference;
  options?: OpenApiOperation | OpenApiReference;
  head?: OpenApiOperation | OpenApiReference;
}

export interface OpenApiDocument {
  openapi?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  paths?: Record<string, OpenApiPathItem>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
    parameters?: Record<string, OpenApiParameter>;
    requestBodies?: Record<string, OpenApiRequestBody>;
    responses?: Record<string, OpenApiResponse>;
  };
  servers?: Array<{
    url?: string;
    description?: string;
  }>;
}

export interface AppComponentOperationRecord {
  key: string;
  method: AppComponentHttpMethod;
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  operationId?: string;
}

export interface ResolvedAppComponentOperation {
  record: AppComponentOperationRecord;
  operation: OpenApiOperation;
  pathItem: OpenApiPathItem;
}

export interface AppComponentGeneratedField {
  key: string;
  label: string;
  description?: string;
  location: AppComponentFieldLocation;
  required: boolean;
  kind: AppComponentGeneratedFieldKind;
  enumValues?: string[];
  paramName?: string;
  bodyPath?: string[];
  rootBodyValue?: boolean;
  contentType?: string | null;
  defaultValue?: unknown;
  exampleValue?: unknown;
}

export interface AppComponentGeneratedForm {
  parameterFields: AppComponentGeneratedField[];
  bodyFields: AppComponentGeneratedField[];
  bodyMode: "none" | "generated" | "raw";
  bodyRawField?: AppComponentGeneratedField;
  bodyContentType?: string | null;
  bodyRequired: boolean;
  unsupportedReason?: string;
}

export interface BuiltAppComponentRequest {
  method: Uppercase<AppComponentHttpMethod>;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface AppComponentResponseModelStatus {
  declaredResponseCodes: string[];
  requiredResponseCodes: string[];
  modeledResponseCodes: string[];
  missingResponseCodes: string[];
  optionalMissingResponseCodes: string[];
  isValidEndpoint: boolean;
}

export interface AppComponentResponseModelPreviewField {
  path: string;
  typeLabel: string;
  required: boolean;
  description?: string;
}

export interface AppComponentResponseModelPreviewEntry {
  key: string;
  statusCode: string;
  contentType: string | null;
  description?: string;
  hasSchema: boolean;
  schemaTypeLabel: string | null;
  fields: AppComponentResponseModelPreviewField[];
}

export interface BuildAppComponentRequestResult {
  errors: string[];
  request?: BuiltAppComponentRequest;
}

const supportedHttpMethods: AppComponentHttpMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isOpenApiReference(value: unknown): value is OpenApiReference {
  return isPlainRecord(value) && typeof value.$ref === "string";
}

function normalizeStringRecord(value: unknown) {
  if (!isPlainRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === "string" ? [[key, entry] as const] : [],
    ),
  );
}

function normalizeHeadersRecord(value: unknown) {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const next = Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === "string" ? [[key, entry] as const] : [],
    ),
  );

  return Object.keys(next).length > 0 ? next : undefined;
}

function unescapeOpenApiRefToken(token: string) {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveLocalOpenApiRef<T>(document: OpenApiDocument, ref: string): T | undefined {
  if (!ref.startsWith("#/")) {
    return undefined;
  }

  const path = ref
    .slice(2)
    .split("/")
    .map(unescapeOpenApiRefToken);

  let current: unknown = document;

  for (const segment of path) {
    if (!isPlainRecord(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current as T | undefined;
}

function resolveOpenApiSchema(
  document: OpenApiDocument,
  input?: OpenApiSchema | OpenApiReference,
  seenRefs: Set<string> = new Set(),
): OpenApiSchema | undefined {
  if (!input) {
    return undefined;
  }

  const schema = isOpenApiReference(input)
    ? (() => {
        if (seenRefs.has(input.$ref)) {
          return undefined;
        }

        seenRefs.add(input.$ref);
        return resolveOpenApiSchema(
          document,
          resolveLocalOpenApiRef<OpenApiSchema>(document, input.$ref),
          seenRefs,
        );
      })()
    : input;

  if (!schema) {
    return undefined;
  }

  if (!Array.isArray(schema.allOf) || schema.allOf.length === 0) {
    return schema;
  }

  const merged: OpenApiSchema = {
    ...schema,
    allOf: undefined,
    properties: { ...(schema.properties ?? {}) },
    required: [...(schema.required ?? [])],
  };

  for (const entry of schema.allOf) {
    const part = resolveOpenApiSchema(document, entry, new Set(seenRefs));

    if (!part) {
      continue;
    }

    merged.type = merged.type ?? part.type;
    merged.format = merged.format ?? part.format;
    merged.title = merged.title ?? part.title;
    merged.description = merged.description ?? part.description;
    merged.default = merged.default ?? part.default;
    merged.example = merged.example ?? part.example;
    merged.enum = merged.enum ?? part.enum;
    merged.items = merged.items ?? part.items;
    merged.additionalProperties = merged.additionalProperties ?? part.additionalProperties;
    merged.oneOf = merged.oneOf ?? part.oneOf;
    merged.anyOf = merged.anyOf ?? part.anyOf;
    merged.properties = {
      ...(merged.properties ?? {}),
      ...(part.properties ?? {}),
    };
    merged.required = Array.from(new Set([...(merged.required ?? []), ...(part.required ?? [])]));
  }

  return merged;
}

function resolveOpenApiParameter(
  document: OpenApiDocument,
  input?: OpenApiParameter | OpenApiReference,
): OpenApiParameter | undefined {
  if (!input) {
    return undefined;
  }

  if (isOpenApiReference(input)) {
    return resolveLocalOpenApiRef<OpenApiParameter>(document, input.$ref);
  }

  return input;
}

function resolveOpenApiRequestBody(
  document: OpenApiDocument,
  input?: OpenApiRequestBody | OpenApiReference,
): OpenApiRequestBody | undefined {
  if (!input) {
    return undefined;
  }

  if (isOpenApiReference(input)) {
    return resolveLocalOpenApiRef<OpenApiRequestBody>(document, input.$ref);
  }

  return input;
}

function resolveOpenApiResponse(
  document: OpenApiDocument,
  input?: OpenApiResponse | OpenApiReference,
): OpenApiResponse | undefined {
  if (!input) {
    return undefined;
  }

  if (isOpenApiReference(input)) {
    return resolveLocalOpenApiRef<OpenApiResponse>(document, input.$ref);
  }

  return input;
}

function resolveOpenApiOperation(
  document: OpenApiDocument,
  input?: OpenApiOperation | OpenApiReference,
): OpenApiOperation | undefined {
  if (!input) {
    return undefined;
  }

  if (isOpenApiReference(input)) {
    return resolveLocalOpenApiRef<OpenApiOperation>(document, input.$ref);
  }

  return input;
}

function getPathItemOperation(pathItem: OpenApiPathItem, method: AppComponentHttpMethod) {
  return pathItem[method];
}

function isObjectSchema(schema?: OpenApiSchema) {
  return Boolean(
    schema &&
      (schema.type === "object" ||
        (isPlainRecord(schema.properties) && Object.keys(schema.properties).length > 0)),
  );
}

function isArraySchema(schema?: OpenApiSchema) {
  return Boolean(schema && schema.type === "array");
}

function resolveFieldKind(schema?: OpenApiSchema): AppComponentGeneratedFieldKind {
  if (!schema) {
    return "json";
  }

  if (
    Array.isArray(schema.enum) &&
    schema.enum.length > 0 &&
    schema.enum.every(
      (entry) =>
        typeof entry === "string" ||
        typeof entry === "number" ||
        typeof entry === "boolean",
    )
  ) {
    return "enum";
  }

  if (schema.type === "boolean") {
    return "boolean";
  }

  if (schema.type === "integer") {
    return "integer";
  }

  if (schema.type === "number") {
    return "number";
  }

  if (schema.type === "string" && schema.format === "date") {
    return "date";
  }

  if (schema.type === "string" && schema.format === "date-time") {
    return "date-time";
  }

  if (schema.type === "string") {
    return "string";
  }

  return "json";
}

function buildFieldLabel(
  name: string,
  bodyPath?: string[],
  schema?: OpenApiSchema,
) {
  if (schema?.title?.trim()) {
    return schema.title.trim();
  }

  const source = bodyPath?.length ? bodyPath[bodyPath.length - 1] : name;
  return titleCase(source);
}

function resolveSchemaSeedValue(schema?: OpenApiSchema) {
  return schema?.default ?? schema?.example;
}

function resolveDateInputSeed(value: unknown) {
  if (typeof value !== "string") {
    return value === undefined || value === null ? "" : String(value);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().slice(0, 10);
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function resolveDateTimeInputSeed(value: unknown) {
  if (typeof value !== "string") {
    return value === undefined || value === null ? "" : String(value);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 16);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return `${parsed.getFullYear()}-${padDatePart(parsed.getMonth() + 1)}-${padDatePart(parsed.getDate())}T${padDatePart(parsed.getHours())}:${padDatePart(parsed.getMinutes())}`;
}

function resolveFieldSeedValue(field: AppComponentGeneratedField) {
  const seed = field.defaultValue ?? field.exampleValue;

  if (seed === undefined || seed === null) {
    return "";
  }

  switch (field.kind) {
    case "boolean":
      return seed === true ? "true" : seed === false ? "false" : "";
    case "date":
      return resolveDateInputSeed(seed);
    case "date-time":
      return resolveDateTimeInputSeed(seed);
    case "json":
      return typeof seed === "string" ? seed : JSON.stringify(seed, null, 2);
    default:
      return String(seed);
  }
}

function formatSchemaTypeLabel(
  document: OpenApiDocument,
  schema?: OpenApiSchema,
): string {
  if (!schema) {
    return "unknown";
  }

  if (
    Array.isArray(schema.enum) &&
    schema.enum.length > 0 &&
    schema.enum.every(
      (entry) =>
        typeof entry === "string" ||
        typeof entry === "number" ||
        typeof entry === "boolean",
    )
  ) {
    return `enum(${schema.enum.map((entry) => String(entry)).join(", ")})`;
  }

  if (schema.type === "string" && schema.format) {
    return `string (${schema.format})`;
  }

  if (isObjectSchema(schema)) {
    return "object";
  }

  if (isArraySchema(schema)) {
    const itemSchema = resolveOpenApiSchema(document, schema.items);
    return itemSchema ? `array<${formatSchemaTypeLabel(document, itemSchema)}>` : "array";
  }

  return schema.type ?? "object";
}

function collectSchemaPreviewFields(
  document: OpenApiDocument,
  schemaInput: OpenApiSchema | OpenApiReference | undefined,
  {
    path = "",
    required = true,
    depth = 0,
    fields,
  }: {
    path?: string;
    required?: boolean;
    depth?: number;
    fields: AppComponentResponseModelPreviewField[];
  },
) {
  const schema = resolveOpenApiSchema(document, schemaInput);

  if (!schema) {
    return;
  }

  const pathLabel = path || "response";

  if (isObjectSchema(schema)) {
    const entries = Object.entries(schema.properties ?? {});

    if (entries.length === 0 || depth >= 1) {
      fields.push({
        path: pathLabel,
        typeLabel: "object",
        required,
        description: schema.description,
      });
      return;
    }

    for (const [propertyName, propertySchemaInput] of entries) {
      const propertySchema = resolveOpenApiSchema(document, propertySchemaInput);
      const propertyPath = path ? `${path}.${propertyName}` : propertyName;
      const propertyRequired = schema.required?.includes(propertyName) ?? false;

      if (isObjectSchema(propertySchema) || isArraySchema(propertySchema)) {
        collectSchemaPreviewFields(document, propertySchema, {
          path: propertyPath,
          required: propertyRequired,
          depth: depth + 1,
          fields,
        });
        continue;
      }

      fields.push({
        path: propertyPath,
        typeLabel: formatSchemaTypeLabel(document, propertySchema),
        required: propertyRequired,
        description: propertySchema?.description,
      });
    }

    return;
  }

  if (isArraySchema(schema)) {
    const itemSchema = resolveOpenApiSchema(document, schema.items);

    if (isObjectSchema(itemSchema) && depth < 1) {
      collectSchemaPreviewFields(document, itemSchema, {
        path: path ? `${path}[]` : "[]",
        required,
        depth: depth + 1,
        fields,
      });
      return;
    }

    fields.push({
      path: pathLabel,
      typeLabel: formatSchemaTypeLabel(document, schema),
      required,
      description: schema.description,
    });
    return;
  }

  fields.push({
    path: pathLabel,
    typeLabel: formatSchemaTypeLabel(document, schema),
    required,
    description: schema.description,
  });
}

function resolveRawBodySeed(contentType: string | null | undefined, example: unknown) {
  if (example === undefined || example === null) {
    return contentType?.includes("json") ? "{\n  \n}" : "";
  }

  if (typeof example === "string") {
    if (contentType?.includes("json")) {
      try {
        return JSON.stringify(JSON.parse(example), null, 2);
      } catch {
        return example;
      }
    }

    return example;
  }

  return JSON.stringify(example, null, 2);
}

function buildParameterField(
  document: OpenApiDocument,
  parameter: OpenApiParameter,
): AppComponentGeneratedField {
  const schema = resolveOpenApiSchema(document, parameter.schema);

  return {
    key: `${parameter.in}:${parameter.name}`,
    label: buildFieldLabel(parameter.name, undefined, schema),
    description: parameter.description ?? schema?.description,
    location: parameter.in as Exclude<OpenApiParameter["in"], "cookie">,
    required: parameter.in === "path" ? true : parameter.required === true,
    kind: resolveFieldKind(schema),
    enumValues: Array.isArray(schema?.enum) ? schema.enum.map((entry) => String(entry)) : undefined,
    paramName: parameter.name,
    defaultValue: schema?.default,
    exampleValue: parameter.example ?? resolveSchemaSeedValue(schema),
  };
}

function createBodyField(
  schema: OpenApiSchema | undefined,
  {
    path,
    required,
    contentType,
    rootBodyValue = false,
    exampleValue,
  }: {
    path: string[];
    required: boolean;
    contentType: string | null;
    rootBodyValue?: boolean;
    exampleValue?: unknown;
  },
): AppComponentGeneratedField {
  const labelSource = path[path.length - 1] ?? "Body";

  return {
    key: path.length > 0 ? `body:${path.join(".")}` : "body:$",
    label: buildFieldLabel(labelSource, path, schema),
    description: schema?.description,
    location: "body",
    required,
    kind: resolveFieldKind(schema),
    enumValues: Array.isArray(schema?.enum) ? schema.enum.map((entry) => String(entry)) : undefined,
    bodyPath: path,
    rootBodyValue,
    contentType,
    defaultValue: schema?.default,
    exampleValue,
  };
}

function collectBodyFieldsFromSchema(
  document: OpenApiDocument,
  schemaInput: OpenApiSchema | OpenApiReference | undefined,
  {
    path,
    required,
    contentType,
    fields,
    exampleValue,
  }: {
    path: string[];
    required: boolean;
    contentType: string | null;
    fields: AppComponentGeneratedField[];
    exampleValue?: unknown;
  },
) {
  const schema = resolveOpenApiSchema(document, schemaInput);

  if (!schema) {
    fields.push({
      key: path.length > 0 ? `body:${path.join(".")}` : "body:$",
      label: buildFieldLabel(path[path.length - 1] ?? "Body", path),
      location: "body",
      required,
      kind: "json",
      bodyPath: path,
      rootBodyValue: path.length === 0,
      contentType,
      exampleValue,
    });
    return;
  }

  if (isObjectSchema(schema)) {
    const properties = schema.properties ?? {};
    const entries = Object.entries(properties);

    if (entries.length === 0 || schema.additionalProperties) {
      fields.push({
        key: path.length > 0 ? `body:${path.join(".")}` : "body:$",
        label: buildFieldLabel(path[path.length - 1] ?? "Body", path, schema),
        description: schema.description,
        location: "body",
        required,
        kind: "json",
        bodyPath: path,
        rootBodyValue: path.length === 0,
        contentType,
        defaultValue: schema.default,
        exampleValue: exampleValue ?? schema.example,
      });
      return;
    }

    const requiredSet = new Set(schema.required ?? []);

    for (const [propertyName, propertySchema] of entries) {
      const childPath = [...path, propertyName];
      const childSchema = resolveOpenApiSchema(document, propertySchema);
      const childRequired = required && requiredSet.has(propertyName);
      const childExample =
        isPlainRecord(exampleValue) && propertyName in exampleValue
          ? exampleValue[propertyName]
          : childSchema?.example;

      if (
        childSchema &&
        isObjectSchema(childSchema) &&
        !Array.isArray(childSchema.oneOf) &&
        !Array.isArray(childSchema.anyOf)
      ) {
        collectBodyFieldsFromSchema(document, childSchema, {
          path: childPath,
          required: childRequired,
          contentType,
          fields,
          exampleValue: childExample,
        });
        continue;
      }

      fields.push(
        createBodyField(childSchema, {
          path: childPath,
          required: childRequired,
          contentType,
          exampleValue: childExample,
        }),
      );
    }

    return;
  }

  fields.push(
    createBodyField(schema, {
      path,
      required,
      contentType,
      rootBodyValue: path.length === 0,
      exampleValue,
    }),
  );
}

function collectOperationParameters(
  document: OpenApiDocument,
  resolvedOperation: ResolvedAppComponentOperation,
) {
  const entries = new Map<string, OpenApiParameter>();

  for (const candidate of resolvedOperation.pathItem.parameters ?? []) {
    const parameter = resolveOpenApiParameter(document, candidate);

    if (!parameter || parameter.in === "cookie") {
      continue;
    }

    entries.set(`${parameter.in}:${parameter.name}`, parameter);
  }

  for (const candidate of resolvedOperation.operation.parameters ?? []) {
    const parameter = resolveOpenApiParameter(document, candidate);

    if (!parameter || parameter.in === "cookie") {
      continue;
    }

    entries.set(`${parameter.in}:${parameter.name}`, parameter);
  }

  return Array.from(entries.values());
}

function pickDefaultRequestBodyContentType(content: Record<string, OpenApiMediaType> | undefined) {
  const entries = Object.keys(content ?? {});

  if (entries.length === 0) {
    return null;
  }

  if (entries.includes("application/json")) {
    return "application/json";
  }

  const jsonLike = entries.find((entry) => entry.includes("json"));

  return jsonLike ?? entries[0] ?? null;
}

function parseDateTimeInput(value: string) {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseFieldInput(field: AppComponentGeneratedField, rawValue: string) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return {
      empty: true,
      error: null,
      value: undefined,
    };
  }

  switch (field.kind) {
    case "number": {
      const next = Number(trimmed);

      return Number.isNaN(next)
        ? { empty: false, error: `${field.label} must be a number.`, value: undefined }
        : { empty: false, error: null, value: next };
    }
    case "integer": {
      const next = Number(trimmed);

      return !Number.isInteger(next)
        ? { empty: false, error: `${field.label} must be an integer.`, value: undefined }
        : { empty: false, error: null, value: next };
    }
    case "boolean":
      return trimmed === "true" || trimmed === "false"
        ? {
            empty: false,
            error: null,
            value: trimmed === "true",
          }
        : {
            empty: false,
            error: `${field.label} must be true or false.`,
            value: undefined,
          };
    case "json":
      try {
        return {
          empty: false,
          error: null,
          value: JSON.parse(trimmed),
        };
      } catch (error) {
        return {
          empty: false,
          error: error instanceof Error ? error.message : `Invalid JSON for ${field.label}.`,
          value: undefined,
        };
      }
    case "date-time": {
      const next = parseDateTimeInput(trimmed);

      return next
        ? { empty: false, error: null, value: next }
        : { empty: false, error: `${field.label} must be a valid date-time.`, value: undefined };
    }
    case "date":
    case "enum":
    case "string":
    default:
      return {
        empty: false,
        error: null,
        value: trimmed,
      };
  }
}

function setNestedBodyValue(
  target: Record<string, unknown>,
  path: string[],
  value: unknown,
) {
  if (path.length === 0) {
    return;
  }

  let current: Record<string, unknown> = target;

  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      current[segment] = value;
      return;
    }

    if (!isPlainRecord(current[segment])) {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  });
}

function collectParameterValue(
  field: AppComponentGeneratedField,
  draftValues: Record<string, string>,
  errors: string[],
) {
  const rawValue = draftValues[field.key] ?? "";
  const parsed = parseFieldInput(field, rawValue);

  if (parsed.error) {
    errors.push(parsed.error);
    return undefined;
  }

  if (parsed.empty) {
    if (field.required) {
      errors.push(`${field.label} is required.`);
    }

    return undefined;
  }

  return parsed.value;
}

function resolveParameterTransportValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

export const appComponentMockOpenApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "AppComponent Mock API",
    version: "1.0.0",
    description:
      "Built-in mock OpenAPI document used by the AppComponent widget in explorer and mock mode.",
  },
  paths: {
    "/context": {
      get: {
        tags: ["Context"],
        summary: "Resolve a context date",
        description:
          "Returns a mock context payload that can seed another request in a later widget phase.",
        parameters: [
          {
            name: "offset_days",
            in: "query",
            description: "Optional day offset applied to the current date.",
            required: false,
            schema: {
              type: "integer",
              default: 2,
            },
          },
        ],
        responses: {
          "200": {
            description: "Context resolved successfully.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["random_date"],
                  properties: {
                    random_date: {
                      type: "string",
                      format: "date",
                      example: "2026-04-03",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/price/swap": {
      post: {
        tags: ["Pricing"],
        summary: "Submit a swap price request",
        description:
          "Accepts a request date and a rate, then returns a normalized pricing payload.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["date", "rate"],
                properties: {
                  date: {
                    type: "string",
                    format: "date",
                    description: "Trade date used for the swap calculation.",
                    example: "2026-04-01",
                  },
                  rate: {
                    type: "number",
                    description: "Input rate to invert in the mock response.",
                    example: 0.97,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Pricing response.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["date", "rate", "price"],
                  properties: {
                    date: {
                      type: "string",
                      format: "date",
                      example: "2026-04-01",
                    },
                    rate: {
                      type: "number",
                      example: 0.97,
                    },
                    price: {
                      type: "number",
                      example: 1.0309278351,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health probe",
        description: "Simple readiness endpoint with no request parameters.",
        responses: {
          "200": {
            description: "Health status payload.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: {
                    status: {
                      type: "string",
                      example: "ok",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies OpenApiDocument;

export function normalizeAppComponentAuthMode(
  value: unknown,
): AppComponentAuthMode {
  return value === "none" ? "none" : "session-jwt";
}

export function normalizeAppComponentMethod(
  value: unknown,
): AppComponentHttpMethod | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  return supportedHttpMethods.includes(normalized as AppComponentHttpMethod)
    ? (normalized as AppComponentHttpMethod)
    : undefined;
}

export function normalizeAppComponentProps(
  props: AppComponentWidgetProps,
): AppComponentWidgetProps {
  return {
    ...props,
    apiBaseUrl:
      typeof props.apiBaseUrl === "string" && props.apiBaseUrl.trim()
        ? props.apiBaseUrl.trim()
        : undefined,
    authMode: normalizeAppComponentAuthMode(props.authMode),
    method: normalizeAppComponentMethod(props.method),
    path:
      typeof props.path === "string" && props.path.trim() ? props.path.trim() : undefined,
    requestBodyContentType:
      typeof props.requestBodyContentType === "string" && props.requestBodyContentType.trim()
        ? props.requestBodyContentType.trim()
        : undefined,
    showHeader: props.showHeader !== false,
  };
}

export function normalizeAppComponentRuntimeState(
  value?: Record<string, unknown>,
): AppComponentWidgetRuntimeState {
  const cloned = isPlainRecord(value) ? cloneJson(value) : {};

  return {
    operationKey:
      typeof cloned.operationKey === "string" && cloned.operationKey.trim()
        ? cloned.operationKey
        : undefined,
    draftValues: normalizeStringRecord(cloned.draftValues),
    status:
      cloned.status === "submitting" ||
      cloned.status === "success" ||
      cloned.status === "error"
        ? cloned.status
        : "idle",
    lastExecutedAtMs:
      typeof cloned.lastExecutedAtMs === "number" &&
      Number.isFinite(cloned.lastExecutedAtMs)
        ? cloned.lastExecutedAtMs
        : undefined,
    lastRequestUrl:
      typeof cloned.lastRequestUrl === "string" && cloned.lastRequestUrl.trim()
        ? cloned.lastRequestUrl
        : undefined,
    lastResponseStatus:
      typeof cloned.lastResponseStatus === "number" &&
      Number.isFinite(cloned.lastResponseStatus)
        ? cloned.lastResponseStatus
        : undefined,
    lastResponseStatusText:
      typeof cloned.lastResponseStatusText === "string" &&
      cloned.lastResponseStatusText.trim()
        ? cloned.lastResponseStatusText
        : undefined,
    lastResponseBody: "lastResponseBody" in cloned ? cloned.lastResponseBody : undefined,
    lastResponseHeaders: normalizeHeadersRecord(cloned.lastResponseHeaders),
    error:
      typeof cloned.error === "string" && cloned.error.trim() ? cloned.error : undefined,
    publishedOutputs: isPlainRecord(cloned.publishedOutputs)
      ? cloneJson(cloned.publishedOutputs)
      : undefined,
  };
}

export function tryResolveAppComponentBaseUrl(value?: string) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : "";

  if (!raw) {
    return null;
  }

  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function resolveAppComponentUrlSuffix(
  value: string | undefined,
  suffix: "/openapi.json" | "/docs",
) {
  const resolved = tryResolveAppComponentBaseUrl(value);

  if (!resolved) {
    return null;
  }

  const url = new URL(resolved);

  if (url.pathname.endsWith(suffix)) {
    url.search = "";
    url.hash = "";
    return trimTrailingSlash(url.toString());
  }

  return null;
}

export function buildAppComponentDiscoveryUrl(value?: string) {
  return buildAppComponentOpenApiUrl(value);
}

function buildAppComponentServiceRootUrl(baseUrl?: string) {
  const openApiUrl = resolveAppComponentUrlSuffix(baseUrl, "/openapi.json");

  if (openApiUrl) {
    const url = new URL(openApiUrl);
    url.pathname = url.pathname.slice(0, -"/openapi.json".length) || "/";
    url.search = "";
    url.hash = "";
    return trimTrailingSlash(url.toString());
  }

  const docsUrl = resolveAppComponentUrlSuffix(baseUrl, "/docs");

  if (docsUrl) {
    const url = new URL(docsUrl);
    url.pathname = url.pathname.slice(0, -"/docs".length) || "/";
    url.search = "";
    url.hash = "";
    return trimTrailingSlash(url.toString());
  }

  return tryResolveAppComponentBaseUrl(baseUrl);
}

export function buildAppComponentRelativeUrl(
  baseUrl: string | undefined,
  relativePath: string,
) {
  const resolved = buildAppComponentServiceRootUrl(baseUrl);

  if (!resolved) {
    return null;
  }

  const root = new URL(resolved.endsWith("/") ? resolved : `${resolved}/`);

  return new URL(relativePath.replace(/^\/+/, ""), root).toString();
}

export function buildAppComponentDocsUrl(baseUrl?: string) {
  const explicitDocsUrl = resolveAppComponentUrlSuffix(baseUrl, "/docs");

  if (explicitDocsUrl) {
    return explicitDocsUrl;
  }

  const explicitOpenApiUrl = resolveAppComponentUrlSuffix(baseUrl, "/openapi.json");

  if (explicitOpenApiUrl) {
    const url = new URL(explicitOpenApiUrl);
    url.pathname = `${url.pathname.slice(0, -"/openapi.json".length) || ""}/docs`;
    return trimTrailingSlash(url.toString());
  }

  return buildAppComponentRelativeUrl(baseUrl, "/docs");
}

export function buildAppComponentOpenApiUrl(baseUrl?: string) {
  const explicitOpenApiUrl = resolveAppComponentUrlSuffix(baseUrl, "/openapi.json");

  if (explicitOpenApiUrl) {
    return explicitOpenApiUrl;
  }

  const explicitDocsUrl = resolveAppComponentUrlSuffix(baseUrl, "/docs");

  if (explicitDocsUrl) {
    const url = new URL(explicitDocsUrl);
    url.pathname = `${url.pathname.slice(0, -"/docs".length) || ""}/openapi.json`;
    return trimTrailingSlash(url.toString());
  }

  return buildAppComponentRelativeUrl(baseUrl, "/openapi.json");
}

export function buildAppComponentOperationKey(
  method: AppComponentHttpMethod,
  path: string,
) {
  return `${method.toUpperCase()} ${path}`;
}

export function formatAppComponentMethodLabel(method: AppComponentHttpMethod) {
  return method.toUpperCase();
}

export function formatAppComponentFieldLocation(
  location: AppComponentFieldLocation,
) {
  switch (location) {
    case "path":
      return "Path";
    case "query":
      return "Query";
    case "header":
      return "Header";
    case "body":
    default:
      return "Body";
  }
}

export function listAppComponentOperations(document: OpenApiDocument) {
  const operations: AppComponentOperationRecord[] = [];

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of supportedHttpMethods) {
      const operation = resolveOpenApiOperation(document, getPathItemOperation(pathItem, method));

      if (!operation) {
        continue;
      }

      operations.push({
        key: buildAppComponentOperationKey(method, path),
        method,
        path,
        summary: operation.summary?.trim() || buildAppComponentOperationKey(method, path),
        description: operation.description?.trim() || undefined,
        tags: operation.tags?.filter((entry): entry is string => Boolean(entry?.trim())) ?? [],
        operationId: operation.operationId?.trim() || undefined,
      });
    }
  }

  return operations.sort((left, right) => {
    if (left.path !== right.path) {
      return left.path.localeCompare(right.path);
    }

    return supportedHttpMethods.indexOf(left.method) - supportedHttpMethods.indexOf(right.method);
  });
}

export function resolveAppComponentOperation(
  document: OpenApiDocument,
  method: AppComponentHttpMethod | undefined,
  path: string | undefined,
): ResolvedAppComponentOperation | null {
  if (!method || !path) {
    return null;
  }

  const pathItem = document.paths?.[path];

  if (!pathItem) {
    return null;
  }

  const operation = resolveOpenApiOperation(document, getPathItemOperation(pathItem, method));

  if (!operation) {
    return null;
  }

  return {
    record: {
      key: buildAppComponentOperationKey(method, path),
      method,
      path,
      summary: operation.summary?.trim() || buildAppComponentOperationKey(method, path),
      description: operation.description?.trim() || undefined,
      tags: operation.tags?.filter((entry): entry is string => Boolean(entry?.trim())) ?? [],
      operationId: operation.operationId?.trim() || undefined,
    },
    operation,
    pathItem,
  };
}

function isOptionalResponseModelStatusCode(statusCode: string) {
  const normalizedStatusCode = statusCode.trim();

  return /^5\d\d$/i.test(normalizedStatusCode) || /^5XX$/i.test(normalizedStatusCode);
}

export function resolveAppComponentResponseModelStatus(
  document: OpenApiDocument,
  resolvedOperation: ResolvedAppComponentOperation | null,
): AppComponentResponseModelStatus | null {
  if (!resolvedOperation) {
    return null;
  }

  const declaredResponseCodes = Object.keys(resolvedOperation.operation.responses ?? {});

  if (declaredResponseCodes.length === 0) {
    return {
      declaredResponseCodes: [],
      requiredResponseCodes: [],
      modeledResponseCodes: [],
      missingResponseCodes: [],
      optionalMissingResponseCodes: [],
      isValidEndpoint: false,
    };
  }

  const requiredResponseCodes = declaredResponseCodes.filter(
    (statusCode) => !isOptionalResponseModelStatusCode(statusCode),
  );
  const modeledResponseCodes: string[] = [];
  const missingResponseCodes: string[] = [];
  const optionalMissingResponseCodes: string[] = [];

  for (const [statusCode, responseInput] of Object.entries(
    resolvedOperation.operation.responses ?? {},
  )) {
    const response = resolveOpenApiResponse(document, responseInput);
    const hasResponseModel = Object.values(response?.content ?? {}).some((mediaType) =>
      Boolean(resolveOpenApiSchema(document, mediaType?.schema)),
    );

    if (hasResponseModel) {
      modeledResponseCodes.push(statusCode);
      continue;
    }

    if (isOptionalResponseModelStatusCode(statusCode)) {
      optionalMissingResponseCodes.push(statusCode);
      continue;
    }

    missingResponseCodes.push(statusCode);
  }

  return {
    declaredResponseCodes,
    requiredResponseCodes,
    modeledResponseCodes,
    missingResponseCodes,
    optionalMissingResponseCodes,
    isValidEndpoint:
      declaredResponseCodes.length > 0 &&
      modeledResponseCodes.length > 0 &&
      missingResponseCodes.length === 0 &&
      (
        requiredResponseCodes.length === 0 ||
        modeledResponseCodes.some((statusCode) => requiredResponseCodes.includes(statusCode))
      ),
  };
}

export function resolveAppComponentResponseModelPreview(
  document: OpenApiDocument,
  resolvedOperation: ResolvedAppComponentOperation | null,
): AppComponentResponseModelPreviewEntry[] {
  if (!resolvedOperation) {
    return [];
  }

  return Object.entries(resolvedOperation.operation.responses ?? {}).reduce<
    AppComponentResponseModelPreviewEntry[]
  >((entries, [statusCode, responseInput]) => {
      const response = resolveOpenApiResponse(document, responseInput);
      const contentEntries = Object.entries(response?.content ?? {});

      if (contentEntries.length === 0) {
        entries.push({
          key: `${statusCode}:none`,
          statusCode,
          contentType: null,
          description: response?.description,
          hasSchema: false,
          schemaTypeLabel: null,
          fields: [],
        });
        return entries;
      }

      for (const [contentType, mediaType] of contentEntries) {
        const schema = resolveOpenApiSchema(document, mediaType.schema);
        const fields: AppComponentResponseModelPreviewField[] = [];

        if (schema) {
          collectSchemaPreviewFields(document, schema, { fields });
        }

        entries.push({
          key: `${statusCode}:${contentType}`,
          statusCode,
          contentType,
          description: response?.description,
          hasSchema: Boolean(schema),
          schemaTypeLabel: schema ? formatSchemaTypeLabel(document, schema) : null,
          fields,
        });
      }

      return entries;
    }, []);
}

export function listAppComponentRequestBodyContentTypes(
  document: OpenApiDocument,
  resolvedOperation: ResolvedAppComponentOperation | null,
) {
  if (!resolvedOperation) {
    return [];
  }

  return Object.keys(
    resolveOpenApiRequestBody(document, resolvedOperation.operation.requestBody)?.content ?? {},
  );
}

export function buildAppComponentGeneratedForm(
  document: OpenApiDocument,
  resolvedOperation: ResolvedAppComponentOperation | null,
  requestedContentType?: string,
): AppComponentGeneratedForm | null {
  if (!resolvedOperation) {
    return null;
  }

  const parameterFields = collectOperationParameters(document, resolvedOperation).map((parameter) =>
    buildParameterField(document, parameter),
  );
  const requestBody = resolveOpenApiRequestBody(document, resolvedOperation.operation.requestBody);
  const contentType =
    requestedContentType &&
    requestBody?.content &&
    requestedContentType in requestBody.content
      ? requestedContentType
      : pickDefaultRequestBodyContentType(requestBody?.content);

  if (!requestBody || !contentType) {
    return {
      parameterFields,
      bodyFields: [],
      bodyMode: "none",
      bodyContentType: null,
      bodyRequired: false,
    };
  }

  const mediaType = requestBody.content?.[contentType];
  const schema = resolveOpenApiSchema(document, mediaType?.schema);
  const bodyExample = mediaType?.example ?? resolveSchemaSeedValue(schema);

  if (!contentType.includes("json")) {
    return {
      parameterFields,
      bodyFields: [],
      bodyMode: "raw",
      bodyRawField: {
        key: "body:raw",
        label: "Raw Body",
        description:
          requestBody.description ??
          "This content type is not expanded into generated fields yet, so send it as raw text.",
        location: "body",
        required: requestBody.required === true,
        kind: "string",
        rootBodyValue: true,
        contentType,
        exampleValue: resolveRawBodySeed(contentType, bodyExample),
      },
      bodyContentType: contentType,
      bodyRequired: requestBody.required === true,
      unsupportedReason:
        "Generated field mode currently targets JSON request bodies. This operation falls back to a raw body editor.",
    };
  }

  const bodyFields: AppComponentGeneratedField[] = [];

  collectBodyFieldsFromSchema(document, schema, {
    path: [],
    required: requestBody.required === true,
    contentType,
    fields: bodyFields,
    exampleValue: bodyExample,
  });

  if (bodyFields.length === 0) {
    return {
      parameterFields,
      bodyFields: [],
      bodyMode: "raw",
      bodyRawField: {
        key: "body:raw",
        label: "JSON Body",
        description:
          requestBody.description ??
          "No expandable fields were discovered for this request body, so send it as raw JSON.",
        location: "body",
        required: requestBody.required === true,
        kind: "json",
        rootBodyValue: true,
        contentType,
        exampleValue: resolveRawBodySeed(contentType, bodyExample),
      },
      bodyContentType: contentType,
      bodyRequired: requestBody.required === true,
      unsupportedReason:
        "This request body could not be expanded into individual fields, so the widget uses a raw JSON editor.",
    };
  }

  if (
    bodyFields.length === 1 &&
    bodyFields[0]?.rootBodyValue &&
    bodyFields[0]?.kind === "json" &&
    !schema?.properties
  ) {
    return {
      parameterFields,
      bodyFields: [],
      bodyMode: "raw",
      bodyRawField: {
        key: "body:raw",
        label: bodyFields[0].label,
        description:
          bodyFields[0].description ??
          requestBody.description ??
          "Send the full JSON payload for this operation.",
        location: "body",
        required: bodyFields[0].required,
        kind: "json",
        rootBodyValue: true,
        contentType,
        exampleValue: resolveRawBodySeed(contentType, bodyExample),
      },
      bodyContentType: contentType,
      bodyRequired: requestBody.required === true,
      unsupportedReason:
        "This request body uses a complex JSON shape, so the widget falls back to a raw JSON editor.",
    };
  }

  return {
    parameterFields,
    bodyFields,
    bodyMode: "generated",
    bodyContentType: contentType,
    bodyRequired: requestBody.required === true,
  };
}

export function resolveAppComponentInitialDraftValues(
  form: AppComponentGeneratedForm | null,
  runtimeState: AppComponentWidgetRuntimeState,
  operationKey: string | undefined,
) {
  if (!form) {
    return {};
  }

  const reuseRuntimeValues =
    operationKey &&
    runtimeState.operationKey &&
    runtimeState.operationKey === operationKey &&
    isPlainRecord(runtimeState.draftValues);

  const nextValues = Object.fromEntries(
    form.parameterFields.map((field) => [field.key, resolveFieldSeedValue(field)]),
  );

  if (form.bodyMode === "generated") {
    for (const field of form.bodyFields) {
      nextValues[field.key] = resolveFieldSeedValue(field);
    }
  } else if (form.bodyMode === "raw" && form.bodyRawField) {
    nextValues[form.bodyRawField.key] = resolveRawBodySeed(
      form.bodyRawField.contentType,
      form.bodyRawField.exampleValue,
    );
  }

  if (!reuseRuntimeValues) {
    return nextValues;
  }

  return {
    ...nextValues,
    ...runtimeState.draftValues,
  };
}

export function buildAppComponentRequest(
  props: AppComponentWidgetProps,
  resolvedOperation: ResolvedAppComponentOperation | null,
  form: AppComponentGeneratedForm | null,
  draftValues: Record<string, string>,
): BuildAppComponentRequestResult {
  const errors: string[] = [];
  const baseUrl = tryResolveAppComponentBaseUrl(props.apiBaseUrl);

  if (!baseUrl) {
    return {
      errors: ["Enter a valid API base URL before sending a request."],
    };
  }

  if (!resolvedOperation || !form) {
    return {
      errors: ["Select an API operation before sending a request."],
    };
  }

  let resolvedPath = resolvedOperation.record.path;
  const headers: Record<string, string> = {};
  const queryEntries = new Map<string, string>();

  for (const field of form.parameterFields) {
    const value = collectParameterValue(field, draftValues, errors);

    if (value === undefined) {
      continue;
    }

    const transportValue = resolveParameterTransportValue(value);

    if (field.location === "path" && field.paramName) {
      resolvedPath = resolvedPath.replaceAll(
        `{${field.paramName}}`,
        encodeURIComponent(transportValue),
      );
      continue;
    }

    if (field.location === "query" && field.paramName) {
      queryEntries.set(field.paramName, transportValue);
      continue;
    }

    if (field.location === "header" && field.paramName) {
      headers[field.paramName] = transportValue;
    }
  }

  let body: string | undefined;

  if (form.bodyMode === "generated" && form.bodyFields.length > 0) {
    const rootField = form.bodyFields.length === 1 && form.bodyFields[0]?.rootBodyValue
      ? form.bodyFields[0]
      : null;

    if (rootField) {
      const value = collectParameterValue(rootField, draftValues, errors);

      if (value !== undefined) {
        body = JSON.stringify(value);
      } else if (form.bodyRequired) {
        errors.push("Request body is required.");
      }
    } else {
      const bodyObject: Record<string, unknown> = {};
      let hasBodyValue = false;

      for (const field of form.bodyFields) {
        const value = collectParameterValue(field, draftValues, errors);

        if (value === undefined) {
          continue;
        }

        hasBodyValue = true;
        setNestedBodyValue(bodyObject, field.bodyPath ?? [], value);
      }

      if (hasBodyValue) {
        body = JSON.stringify(bodyObject);
      } else if (form.bodyRequired) {
        errors.push("Request body is required.");
      }
    }

    if (body && form.bodyContentType) {
      headers["Content-Type"] = form.bodyContentType;
    }
  } else if (form.bodyMode === "raw" && form.bodyRawField) {
    const rawValue = draftValues[form.bodyRawField.key] ?? "";

    if (!rawValue.trim()) {
      if (form.bodyRequired) {
        errors.push("Request body is required.");
      }
    } else if (form.bodyContentType?.includes("json")) {
      try {
        body = JSON.stringify(JSON.parse(rawValue));
        headers["Content-Type"] = form.bodyContentType;
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : "Request body must be valid JSON.",
        );
      }
    } else {
      body = rawValue;

      if (form.bodyContentType) {
        headers["Content-Type"] = form.bodyContentType;
      }
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  const requestUrlString = buildAppComponentRelativeUrl(baseUrl, resolvedPath);

  if (!requestUrlString) {
    return {
      errors: ["Enter a valid API URL before sending a request."],
    };
  }

  const requestUrl = new URL(requestUrlString);

  for (const [name, value] of queryEntries.entries()) {
    requestUrl.searchParams.set(name, value);
  }

  return {
    errors: [],
    request: {
      method: resolvedOperation.record.method.toUpperCase() as Uppercase<AppComponentHttpMethod>,
      url: requestUrl.toString(),
      headers,
      body,
    },
  };
}

export function extractAppComponentPublishedOutputs(responseBody: unknown) {
  if (isPlainRecord(responseBody)) {
    return {
      response: cloneJson(responseBody),
      ...cloneJson(responseBody),
    };
  }

  if (responseBody === undefined) {
    return undefined;
  }

  return {
    response: cloneJson(responseBody),
  };
}
