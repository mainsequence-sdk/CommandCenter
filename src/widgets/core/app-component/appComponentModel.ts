import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
  WidgetContractId,
  WidgetInputResolutionStatus,
  WidgetValueDescriptor,
} from "@/widgets/types";
import { titleCase } from "@/lib/utils";
import {
  coerceTabularFrameValueDescriptorContract,
  resolveTabularFrameDescriptorContract,
} from "@/widgets/shared/tabular-frame-source";

import {
  CORE_VALUE_JSON_CONTRACT,
  resolveAppComponentInputAcceptContracts,
  resolveAppComponentOutputContract,
} from "./appComponentContracts";

export type AppComponentHttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "options"
  | "head";

export type AppComponentAuthMode = "session-jwt" | "none";
export type AppComponentApiTargetMode =
  | "manual"
  | "main-sequence-resource-release"
  | "mock-json";
export type AppComponentCompactCardLayout =
  | "one-column"
  | "two-columns"
  | "three-columns";
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

export type AppComponentEditableFormFieldKind =
  | AppComponentGeneratedFieldKind
  | "percent";

export interface AppComponentServiceHeader {
  name: string;
  value: string;
}

export interface AppComponentMainSequenceResourceReleaseRef {
  releaseId: number;
  label?: string;
  projectName?: string;
  releaseKind?: string;
  publicUrl?: string;
  exchangeLaunchUrl?: string;
  subdomain?: string;
}

export interface AppComponentMockJsonResponseUiDefinition {
  role?: "notification" | "editable-form";
  widget?: "banner-v1" | "definition-v1";
}

export interface AppComponentMockJsonOperationUiDefinition {
  role?: "async-select-search";
  widget?: "select2";
  selectionType?: "single";
  searchParam?: string;
  searchParamAliases?: string[];
  itemsPath?: string;
  itemValueField?: string;
  itemLabelField?: string;
  paginationPath?: string;
  paginationMoreField?: string;
}

export interface AppComponentMockJsonDefinition {
  version: 1;
  operation: {
    method?: AppComponentHttpMethod;
    path?: string;
    summary?: string;
    description?: string;
    ui?: AppComponentMockJsonOperationUiDefinition;
  };
  request?: {
    parameters?: OpenApiParameter[];
    bodySchema?: OpenApiSchema;
    bodyRequired?: boolean;
    bodyDescription?: string;
    bodyContentType?: string;
  };
  response: {
    status?: number;
    description?: string;
    contentType?: string;
    body?: unknown;
    schema?: OpenApiSchema;
    ui?: AppComponentMockJsonResponseUiDefinition;
  };
}

export interface AppComponentWidgetProps extends Record<string, unknown> {
  apiTargetMode?: AppComponentApiTargetMode;
  mainSequenceResourceRelease?: AppComponentMainSequenceResourceReleaseRef;
  mockJson?: AppComponentMockJsonDefinition;
  apiBaseUrl?: string;
  serviceHeaders?: AppComponentServiceHeader[];
  authMode?: AppComponentAuthMode;
  method?: AppComponentHttpMethod;
  path?: string;
  requestBodyContentType?: string;
  bindingSpec?: AppComponentBindingSpec;
  requestInputMap?: AppComponentRequestInputMap;
  compactCardLayout?: AppComponentCompactCardLayout;
  showHeader?: boolean;
  showResponse?: boolean;
  hideRequestButton?: boolean;
  requestButtonLabel?: string;
  refreshOnDashboardRefresh?: boolean;
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
  editableFormSession?: AppComponentEditableFormSession;
}

export interface AppComponentEditableFormChoice {
  value: unknown;
  label: string;
}

export interface AppComponentEditableFormFieldDefinition {
  token: string;
  name: string;
  label: string;
  kind: AppComponentEditableFormFieldKind;
  editable: boolean;
  required: boolean;
  value?: unknown;
  defaultValue?: unknown;
  description?: string;
  formatter?: string | null;
  choices?: AppComponentEditableFormChoice[] | null;
  extra?: Record<string, unknown> | null;
}

export interface AppComponentEditableFormSectionDefinition {
  id: string;
  title: string;
  description?: string;
  fields: AppComponentEditableFormFieldDefinition[];
  extra?: Record<string, unknown> | null;
}

export interface AppComponentEditableFormDefinition {
  version: 1;
  formId?: string;
  title?: string;
  description?: string;
  sections: AppComponentEditableFormSectionDefinition[];
  meta?: Record<string, unknown> | null;
}

export interface AppComponentEditableFormSession {
  version: 1;
  operationKey?: string;
  widget: "definition-v1";
  formId?: string;
  title?: string;
  description?: string;
  sections: AppComponentEditableFormSectionDefinition[];
  meta?: Record<string, unknown> | null;
  valuesByToken: Record<string, string>;
}

export interface AppComponentResponseUiEditableFormDescriptor {
  role: "editable-form";
  widget: "definition-v1";
}

export interface AppComponentResponseUiNotificationDescriptor {
  role: "notification";
  widget: "banner-v1";
}

export type AppComponentResponseUiDescriptor =
  | AppComponentResponseUiEditableFormDescriptor
  | AppComponentResponseUiNotificationDescriptor;

export type AppComponentResponseNotificationTone =
  | "success"
  | "primary"
  | "info"
  | "warning"
  | "error";

export interface AppComponentResponseNotification {
  title?: string;
  message: string;
  tone: AppComponentResponseNotificationTone;
  details?: string;
}

export interface AppComponentBindingInputPortSpec {
  id: string;
  fieldKey: string;
  label: string;
  description?: string;
  required: boolean;
  location: AppComponentFieldLocation;
  kind: AppComponentGeneratedFieldKind;
  accepts: WidgetContractId[];
}

export interface AppComponentBindingOutputPortSpec {
  id: string;
  label: string;
  description?: string;
  kind: AppComponentGeneratedFieldKind;
  contract: WidgetContractId;
  valueDescriptor?: WidgetValueDescriptor;
  responsePath: string[];
  statusCode: string;
  contentType: string | null;
}

export interface AppComponentBindingSpec {
  version: 1;
  operationKey: string;
  requestPorts: AppComponentBindingInputPortSpec[];
  responsePorts: AppComponentBindingOutputPortSpec[];
  requestForm?: AppComponentGeneratedForm;
}

export interface AppComponentRequestInputMapFieldConfig {
  visibleOnCard?: boolean;
  label?: string;
  prefillValue?: string;
}

export interface AppComponentRequestInputMap {
  version: 1;
  operationKey: string;
  fields: Record<string, AppComponentRequestInputMapFieldConfig>;
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
  openapi_extra?: Record<string, unknown>;
  json_schema_extra?: Record<string, unknown>;
  "x-ui-role"?: unknown;
  "x-ui-widget"?: unknown;
  "x-ui-selection-type"?: unknown;
  "x-search-param"?: unknown;
  "x-search-param-aliases"?: unknown;
  "x-items-path"?: unknown;
  "x-item-value-field"?: unknown;
  "x-item-label-field"?: unknown;
  "x-pagination-path"?: unknown;
  "x-pagination-more-field"?: unknown;
}

export interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  schema?: OpenApiSchema | OpenApiReference;
  example?: unknown;
  openapi_extra?: Record<string, unknown>;
  json_schema_extra?: Record<string, unknown>;
  "x-ui-role"?: unknown;
  "x-ui-widget"?: unknown;
  "x-ui-selection-type"?: unknown;
  "x-search-param"?: unknown;
  "x-search-param-aliases"?: unknown;
  "x-items-path"?: unknown;
  "x-item-value-field"?: unknown;
  "x-item-label-field"?: unknown;
  "x-pagination-path"?: unknown;
  "x-pagination-more-field"?: unknown;
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
  openapi_extra?: Record<string, unknown>;
  json_schema_extra?: Record<string, unknown>;
  "x-ui-role"?: unknown;
  "x-ui-widget"?: unknown;
  "x-ui-selection-type"?: unknown;
  "x-search-param"?: unknown;
  "x-search-param-aliases"?: unknown;
  "x-items-path"?: unknown;
  "x-item-value-field"?: unknown;
  "x-item-label-field"?: unknown;
  "x-pagination-path"?: unknown;
  "x-pagination-more-field"?: unknown;
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
  optionEntries?: Array<{
    value: string;
    label: string;
  }>;
  paramName?: string;
  bodyPath?: string[];
  rootBodyValue?: boolean;
  contentType?: string | null;
  defaultValue?: unknown;
  exampleValue?: unknown;
  hiddenFromForm?: boolean;
  uiEnhancement?: AppComponentGeneratedFieldUiEnhancement;
}

export interface AppComponentAsyncSelectSearchFieldEnhancement {
  role: "async-select-search";
  widget: "select2";
  selectionType: "single";
  searchFieldKeys: string[];
  pageFieldKey?: string;
  limitFieldKey?: string;
  itemsPath: string[];
  itemValueFieldPath: string[];
  itemLabelFieldPath: string[];
  paginationPath?: string[];
  paginationMoreField?: string;
}

export type AppComponentGeneratedFieldUiEnhancement =
  | AppComponentAsyncSelectSearchFieldEnhancement;

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

export interface AppComponentFieldBindingState {
  fieldKey: string;
  isBound: boolean;
  status: WidgetInputResolutionStatus | "unbound";
  sourceWidgetId?: string;
  sourceOutputId?: string;
  value?: unknown;
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

const openApiUiExtensionKeys = [
  "x-ui-role",
  "x-ui-widget",
  "x-ui-selection-type",
  "x-search-param",
  "x-search-param-aliases",
  "x-items-path",
  "x-item-value-field",
  "x-item-label-field",
  "x-pagination-path",
  "x-pagination-more-field",
] as const;

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

function mergeOpenApiExtensionRecord(
  preferred: Record<string, unknown> | undefined,
  fallback: Record<string, unknown> | undefined,
) {
  if (preferred && fallback) {
    return {
      ...fallback,
      ...preferred,
    };
  }

  return preferred ?? fallback;
}

function mergeOpenApiUiExtensions(
  preferred: OpenApiSchema | undefined,
  fallback: OpenApiSchema | undefined,
) {
  const next: Partial<OpenApiSchema> = {};
  const openApiExtra = mergeOpenApiExtensionRecord(
    preferred?.openapi_extra,
    fallback?.openapi_extra,
  );
  const jsonSchemaExtra = mergeOpenApiExtensionRecord(
    preferred?.json_schema_extra,
    fallback?.json_schema_extra,
  );

  if (openApiExtra) {
    next.openapi_extra = openApiExtra;
  }

  if (jsonSchemaExtra) {
    next.json_schema_extra = jsonSchemaExtra;
  }

  for (const key of openApiUiExtensionKeys) {
    const value = preferred?.[key] ?? fallback?.[key];

    if (value !== undefined) {
      next[key] = value;
    }
  }

  return next;
}

function normalizeExtensionPath(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return value
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function readOpenApiExtensionValue(
  source: unknown,
  key: string,
) {
  if (!isPlainRecord(source)) {
    return undefined;
  }

  if (key in source) {
    return source[key];
  }

  const nestedOpenApiExtra = source.openapi_extra;

  if (isPlainRecord(nestedOpenApiExtra) && key in nestedOpenApiExtra) {
    return nestedOpenApiExtra[key];
  }

  const nestedJsonSchemaExtra = source.json_schema_extra;

  if (isPlainRecord(nestedJsonSchemaExtra) && key in nestedJsonSchemaExtra) {
    return nestedJsonSchemaExtra[key];
  }

  return undefined;
}

function readOpenApiExtensionString(
  parameter: OpenApiParameter | undefined,
  schema: OpenApiSchema | undefined,
  key: string,
) {
  const parameterValue = readOpenApiExtensionValue(parameter, key);

  if (typeof parameterValue === "string" && parameterValue.trim()) {
    return parameterValue.trim();
  }

  const schemaValue = readOpenApiExtensionValue(schema, key);
  return typeof schemaValue === "string" && schemaValue.trim() ? schemaValue.trim() : undefined;
}

function readOpenApiExtensionStringFromSources(
  key: string,
  ...sources: unknown[]
) {
  for (const source of sources) {
    const value = readOpenApiExtensionValue(source, key);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readOpenApiExtensionStringArray(
  parameter: OpenApiParameter | undefined,
  schema: OpenApiSchema | undefined,
  key: string,
) {
  const parameterValue = readOpenApiExtensionValue(parameter, key);

  if (Array.isArray(parameterValue)) {
    return parameterValue.flatMap((entry) =>
      typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
    );
  }

  const schemaValue = readOpenApiExtensionValue(schema, key);

  if (!Array.isArray(schemaValue)) {
    return [];
  }

  return schemaValue.flatMap((entry) =>
    typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
  );
}

function readOpenApiExtensionStringArrayFromSources(
  key: string,
  ...sources: unknown[]
) {
  for (const source of sources) {
    const value = readOpenApiExtensionValue(source, key);

    if (!Array.isArray(value)) {
      continue;
    }

    return value.flatMap((entry) =>
      typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
    );
  }

  return [];
}

function isMeaningfulAppComponentRequestInputMapFieldConfig(
  value: AppComponentRequestInputMapFieldConfig | undefined,
) {
  if (!value) {
    return false;
  }

  return (
    value.visibleOnCard === false ||
    value.label !== undefined ||
    (typeof value.prefillValue === "string" && value.prefillValue.trim().length > 0)
  );
}

function cloneAppComponentGeneratedField(
  field: AppComponentGeneratedField,
): AppComponentGeneratedField {
  return {
    ...field,
    enumValues: field.enumValues ? [...field.enumValues] : undefined,
    optionEntries: field.optionEntries ? cloneJson(field.optionEntries) : undefined,
    bodyPath: field.bodyPath ? [...field.bodyPath] : undefined,
    defaultValue:
      field.defaultValue !== undefined ? cloneJson(field.defaultValue) : undefined,
    exampleValue:
      field.exampleValue !== undefined ? cloneJson(field.exampleValue) : undefined,
    hiddenFromForm: field.hiddenFromForm === true,
    uiEnhancement: field.uiEnhancement ? cloneJson(field.uiEnhancement) : undefined,
  };
}

function cloneAppComponentGeneratedForm(
  form: AppComponentGeneratedForm,
): AppComponentGeneratedForm {
  return {
    parameterFields: form.parameterFields.map((field) =>
      cloneAppComponentGeneratedField(field),
    ),
    bodyFields: form.bodyFields.map((field) => cloneAppComponentGeneratedField(field)),
    bodyMode: form.bodyMode,
    bodyRawField: form.bodyRawField
      ? cloneAppComponentGeneratedField(form.bodyRawField)
      : undefined,
    bodyContentType: form.bodyContentType ?? null,
    bodyRequired: form.bodyRequired,
    unsupportedReason: form.unsupportedReason,
  };
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

function isNullOnlyOpenApiSchema(schema?: OpenApiSchema) {
  if (!schema) {
    return false;
  }

  if (schema.type === "null") {
    return true;
  }

  return Array.isArray(schema.enum) && schema.enum.length > 0 && schema.enum.every((entry) => entry === null);
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

  const merged =
    Array.isArray(schema.allOf) && schema.allOf.length > 0
      ? (() => {
          const nextMerged: OpenApiSchema = {
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

            nextMerged.type = nextMerged.type ?? part.type;
            nextMerged.format = nextMerged.format ?? part.format;
            nextMerged.title = nextMerged.title ?? part.title;
            nextMerged.description = nextMerged.description ?? part.description;
            nextMerged.default = nextMerged.default ?? part.default;
            nextMerged.example = nextMerged.example ?? part.example;
            nextMerged.enum = nextMerged.enum ?? part.enum;
            nextMerged.items = nextMerged.items ?? part.items;
            nextMerged.additionalProperties =
              nextMerged.additionalProperties ?? part.additionalProperties;
            nextMerged.oneOf = nextMerged.oneOf ?? part.oneOf;
            nextMerged.anyOf = nextMerged.anyOf ?? part.anyOf;
            nextMerged.properties = {
              ...(nextMerged.properties ?? {}),
              ...(part.properties ?? {}),
            };
            nextMerged.required = Array.from(
              new Set([...(nextMerged.required ?? []), ...(part.required ?? [])]),
            );
            nextMerged.openapi_extra = mergeOpenApiExtensionRecord(
              nextMerged.openapi_extra,
              part.openapi_extra,
            );
            nextMerged.json_schema_extra = mergeOpenApiExtensionRecord(
              nextMerged.json_schema_extra,
              part.json_schema_extra,
            );

            for (const key of openApiUiExtensionKeys) {
              nextMerged[key] = nextMerged[key] ?? part[key];
            }
          }

          return nextMerged;
        })()
      : schema;

  const unionEntries = merged.oneOf ?? merged.anyOf;

  if (!Array.isArray(unionEntries) || unionEntries.length === 0) {
    return merged;
  }

  const resolvedUnionEntries = unionEntries.flatMap((entry) => {
    const part = resolveOpenApiSchema(document, entry, new Set(seenRefs));
    return part ? [part] : [];
  });
  const nonNullUnionEntries = resolvedUnionEntries.filter((entry) => !isNullOnlyOpenApiSchema(entry));

  if (nonNullUnionEntries.length !== 1) {
    return merged;
  }

  const candidate = nonNullUnionEntries[0];

  return {
    ...candidate,
    ...mergeOpenApiUiExtensions(merged, candidate),
    title: merged.title ?? candidate.title,
    description: merged.description ?? candidate.description,
    default: merged.default ?? candidate.default,
    example: merged.example ?? candidate.example,
    nullable:
      merged.nullable === true || resolvedUnionEntries.length !== nonNullUnionEntries.length,
  };
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

  const seedValue = schema.default ?? schema.example;

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

  if (schema.format === "date") {
    return "date";
  }

  if (schema.format === "date-time") {
    return "date-time";
  }

  if (schema.type === "string") {
    return "string";
  }

  if (typeof seedValue === "boolean") {
    return "boolean";
  }

  if (typeof seedValue === "number") {
    return Number.isInteger(seedValue) ? "integer" : "number";
  }

  if (typeof seedValue === "string") {
    return "string";
  }

  return "json";
}

function resolvePrimitiveDescriptor(
  schema: OpenApiSchema | undefined,
): WidgetValueDescriptor {
  const kind = resolveFieldKind(schema);
  const description = schema?.description;

  switch (kind) {
    case "boolean":
      return {
        kind: "primitive",
        contract: resolveAppComponentOutputContract(kind),
        primitive: "boolean",
        description,
      };
    case "integer":
      return {
        kind: "primitive",
        contract: resolveAppComponentOutputContract(kind),
        primitive: "integer",
        description,
      };
    case "number":
      return {
        kind: "primitive",
        contract: resolveAppComponentOutputContract(kind),
        primitive: "number",
        description,
      };
    case "date":
    case "date-time":
    case "enum":
    case "string":
      return {
        kind: "primitive",
        contract: resolveAppComponentOutputContract(kind),
        primitive: "string",
        format: schema?.format,
        description,
      };
    case "json":
    default:
      return {
        kind: "unknown",
        contract: CORE_VALUE_JSON_CONTRACT,
        description,
      };
  }
}

function buildValueDescriptorFromOpenApiSchema(
  document: OpenApiDocument,
  schemaInput: OpenApiSchema | OpenApiReference | undefined,
  options?: {
    depth?: number;
    maxDepth?: number;
  },
): WidgetValueDescriptor | undefined {
  const schema = resolveOpenApiSchema(document, schemaInput);

  if (!schema) {
    return undefined;
  }

  const depth = options?.depth ?? 0;
  const maxDepth = options?.maxDepth ?? 4;

  if (isArraySchema(schema)) {
    return {
      kind: "array",
      contract: CORE_VALUE_JSON_CONTRACT,
      description: schema.description,
      items:
        depth >= maxDepth
          ? undefined
          : buildValueDescriptorFromOpenApiSchema(document, schema.items, {
              depth: depth + 1,
              maxDepth,
            }),
    };
  }

  if (isObjectSchema(schema)) {
    const requiredSet = new Set(schema.required ?? []);

    return {
      kind: "object",
      contract: CORE_VALUE_JSON_CONTRACT,
      description: schema.description,
      fields:
        depth >= maxDepth
          ? []
          : Object.entries(schema.properties ?? {}).flatMap(([propertyName, propertySchema]) => {
              const valueDescriptor = buildValueDescriptorFromOpenApiSchema(
                document,
                propertySchema,
                {
                  depth: depth + 1,
                  maxDepth,
                },
              );

              if (!valueDescriptor) {
                return [];
              }

              const resolvedPropertySchema = resolveOpenApiSchema(document, propertySchema);

              return [{
                key: propertyName,
                label: titleCase(propertyName),
                description: resolvedPropertySchema?.description,
                required: requiredSet.has(propertyName),
                value: valueDescriptor,
              }];
            }),
    };
  }

  return resolvePrimitiveDescriptor(schema);
}

function normalizeStructuredOutputValueDescriptor(
  valueDescriptor: WidgetValueDescriptor | undefined,
) {
  return coerceTabularFrameValueDescriptorContract(valueDescriptor);
}

function resolveStructuredOutputContract(
  valueDescriptor: WidgetValueDescriptor | undefined,
): WidgetContractId {
  return resolveTabularFrameDescriptorContract(valueDescriptor) ?? CORE_VALUE_JSON_CONTRACT;
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

function buildGeneratedFieldSeedProps({
  defaultValue,
  exampleValue,
}: {
  defaultValue?: unknown;
  exampleValue?: unknown;
}) {
  return {
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(exampleValue !== undefined ? { exampleValue } : {}),
  };
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
    ...buildGeneratedFieldSeedProps({
      defaultValue: schema?.default,
      exampleValue: parameter.example ?? resolveSchemaSeedValue(schema),
    }),
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
    ...buildGeneratedFieldSeedProps({
      defaultValue: schema?.default,
      exampleValue,
    }),
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
      ...buildGeneratedFieldSeedProps({
        exampleValue,
      }),
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
        ...buildGeneratedFieldSeedProps({
          defaultValue: schema.default,
          exampleValue: exampleValue ?? schema.example,
        }),
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

function resolveAsyncSelectSearchOperationEnhancement(
  operation: OpenApiOperation,
  parameterFields: AppComponentGeneratedField[],
): AppComponentAsyncSelectSearchFieldEnhancement | undefined {
  const uiWidget = readOpenApiExtensionStringFromSources("x-ui-widget", operation);
  const uiRole = readOpenApiExtensionStringFromSources("x-ui-role", operation);

  if (uiWidget !== "select2" || uiRole !== "async-select-search") {
    return undefined;
  }

  const selectionType = readOpenApiExtensionStringFromSources(
    "x-ui-selection-type",
    operation,
  );

  if (selectionType && selectionType !== "single") {
    return undefined;
  }

  const searchParam = readOpenApiExtensionStringFromSources(
    "x-search-param",
    operation,
  );
  const searchParamAliases = readOpenApiExtensionStringArrayFromSources(
    "x-search-param-aliases",
    operation,
  );
  const itemsPath = normalizeExtensionPath(
    readOpenApiExtensionStringFromSources("x-items-path", operation),
  );
  const itemValueFieldPath = normalizeExtensionPath(
    readOpenApiExtensionStringFromSources("x-item-value-field", operation),
  );
  const itemLabelFieldPath = normalizeExtensionPath(
    readOpenApiExtensionStringFromSources("x-item-label-field", operation),
  );

  if (!searchParam || !itemsPath || !itemValueFieldPath || !itemLabelFieldPath) {
    return undefined;
  }

  const availableFieldKeys = new Set(parameterFields.map((field) => field.key));
  const searchFieldKeys = [searchParam, ...searchParamAliases]
    .map((name) => `query:${name}`)
    .filter((fieldKey, index, entries) =>
      availableFieldKeys.has(fieldKey) && entries.indexOf(fieldKey) === index,
    );

  if (searchFieldKeys.length === 0) {
    return undefined;
  }

  const pageFieldKey = availableFieldKeys.has("query:page") ? "query:page" : undefined;
  const limitFieldKey = availableFieldKeys.has("query:limit") ? "query:limit" : undefined;
  const paginationPath = normalizeExtensionPath(
    readOpenApiExtensionStringFromSources("x-pagination-path", operation),
  );

  return {
    role: "async-select-search",
    widget: "select2",
    selectionType: "single",
    searchFieldKeys,
    pageFieldKey,
    limitFieldKey,
    itemsPath,
    itemValueFieldPath,
    itemLabelFieldPath,
    paginationPath,
    paginationMoreField: readOpenApiExtensionStringFromSources(
      "x-pagination-more-field",
      operation,
    ),
  };
}

function resolveOperationUiEnhancement(
  operation: OpenApiOperation,
  parameterFields: AppComponentGeneratedField[],
) {
  const uiWidget = readOpenApiExtensionStringFromSources("x-ui-widget", operation);

  if (!uiWidget) {
    return undefined;
  }

  switch (uiWidget) {
    case "select2":
      return resolveAsyncSelectSearchOperationEnhancement(operation, parameterFields);
    default:
      return undefined;
  }
}

function applyOperationUiEnhancements(
  parameterFields: AppComponentGeneratedField[],
  operation: OpenApiOperation,
) {
  if (parameterFields.length === 0) {
    return parameterFields;
  }

  const nextFields = parameterFields.map((field) => cloneAppComponentGeneratedField(field));
  const fieldsByKey = new Map(nextFields.map((field) => [field.key, field] as const));
  const enhancement = resolveOperationUiEnhancement(operation, nextFields);

  if (!enhancement) {
    return parameterFields;
  }

  const searchParam = readOpenApiExtensionStringFromSources("x-search-param", operation);
  const anchorFieldKey =
    searchParam && fieldsByKey.has(`query:${searchParam}`)
      ? `query:${searchParam}`
      : enhancement.searchFieldKeys[0];
  const anchorField = anchorFieldKey ? fieldsByKey.get(anchorFieldKey) : undefined;

  if (!anchorField) {
    return parameterFields;
  }

  anchorField.uiEnhancement = enhancement;

  for (const linkedFieldKey of [
    ...enhancement.searchFieldKeys,
    enhancement.pageFieldKey,
    enhancement.limitFieldKey,
  ]) {
    if (!linkedFieldKey || linkedFieldKey === anchorField.key) {
      continue;
    }

    const linkedField = fieldsByKey.get(linkedFieldKey);

    if (linkedField) {
      linkedField.hiddenFromForm = true;
    }
  }

  return nextFields;
}

function buildAppComponentInputPortSpec(
  field: AppComponentGeneratedField,
): AppComponentBindingInputPortSpec {
  return {
    id: field.key,
    fieldKey: field.key,
    label: field.label,
    description: field.description,
    required: field.required,
    location: field.location,
    kind: field.kind,
    accepts: resolveAppComponentInputAcceptContracts(field.kind),
  };
}

function pickPrimaryAppComponentResponseEntry(
  document: OpenApiDocument,
  resolvedOperation: ResolvedAppComponentOperation | null,
) {
  if (!resolvedOperation) {
    return null;
  }

  const entries = Object.entries(resolvedOperation.operation.responses ?? {}).flatMap(
    ([statusCode, responseInput]) => {
      const response = resolveOpenApiResponse(document, responseInput);

      return Object.entries(response?.content ?? {}).flatMap(([contentType, mediaType]) => {
        const schema = resolveOpenApiSchema(document, mediaType.schema);

        if (!schema) {
          return [];
        }

        return [{
          statusCode,
          contentType,
          schema,
          description: response?.description,
        }] as const;
      });
    },
  );

  if (entries.length === 0) {
    return null;
  }

  const preferredJson2xx = entries.find(
    (entry) => /^2\d\d$/i.test(entry.statusCode) && entry.contentType.includes("json"),
  );

  if (preferredJson2xx) {
    return preferredJson2xx;
  }

  const preferred2xx = entries.find((entry) => /^2\d\d$/i.test(entry.statusCode));

  return preferred2xx ?? entries[0] ?? null;
}

export function resolveAppComponentResponseUiDescriptor(
  document: OpenApiDocument,
  resolvedOperation: ResolvedAppComponentOperation | null,
): AppComponentResponseUiDescriptor | undefined {
  if (!resolvedOperation) {
    return undefined;
  }

  const primaryResponseEntry = pickPrimaryAppComponentResponseEntry(document, resolvedOperation);
  const uiRole = readOpenApiExtensionStringFromSources(
    "x-ui-role",
    primaryResponseEntry?.schema,
    resolvedOperation.operation,
  );
  const uiWidget = readOpenApiExtensionStringFromSources(
    "x-ui-widget",
    primaryResponseEntry?.schema,
    resolvedOperation.operation,
  );

  if (uiRole === "editable-form" && uiWidget === "definition-v1") {
    return {
      role: "editable-form",
      widget: "definition-v1",
    };
  }

  if (uiRole === "notification" && uiWidget === "banner-v1") {
    return {
      role: "notification",
      widget: "banner-v1",
    };
  }

  return undefined;
}

export function resolveAppComponentResponseUiEditableFormDescriptor(
  document: OpenApiDocument,
  resolvedOperation: ResolvedAppComponentOperation | null,
): AppComponentResponseUiEditableFormDescriptor | undefined {
  const descriptor = resolveAppComponentResponseUiDescriptor(document, resolvedOperation);

  return descriptor?.role === "editable-form" ? descriptor : undefined;
}

function isAppComponentResponseNotificationTone(
  value: unknown,
): value is AppComponentResponseNotificationTone {
  return value === "success"
    || value === "primary"
    || value === "info"
    || value === "warning"
    || value === "error";
}

export function normalizeAppComponentResponseNotification(
  value: unknown,
): AppComponentResponseNotification | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const message = typeof value.message === "string" ? value.message.trim() : "";
  const tone = value.tone;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const details = typeof value.details === "string" ? value.details.trim() : "";

  if (!message || !isAppComponentResponseNotificationTone(tone)) {
    return undefined;
  }

  return {
    title: title || undefined,
    message,
    tone,
    details: details || undefined,
  };
}

export function resolveAppComponentResponseNotification(
  responseBody: unknown,
  responseUiDescriptor?: AppComponentResponseUiDescriptor,
): AppComponentResponseNotification | undefined {
  if (
    responseUiDescriptor?.role !== "notification" ||
    responseUiDescriptor.widget !== "banner-v1"
  ) {
    return undefined;
  }

  return normalizeAppComponentResponseNotification(responseBody);
}

function buildAppComponentResponsePortId(path: string[]) {
  return path.length === 0 ? "response:$" : `response:${path.join(".")}`;
}

function buildAppComponentResponsePortLabel(path: string[]) {
  if (path.length === 0) {
    return "Response Body";
  }

  return path.map((segment) => titleCase(segment)).join(" / ");
}

function pushAppComponentResponsePort(
  ports: AppComponentBindingOutputPortSpec[],
  port: AppComponentBindingOutputPortSpec,
) {
  if (!ports.some((entry) => entry.id === port.id)) {
    ports.push(port);
  }
}

function collectResponsePortsFromSchema(
  document: OpenApiDocument,
  schemaInput: OpenApiSchema | OpenApiReference | undefined,
  options: {
    path: string[];
    statusCode: string;
    contentType: string | null;
    ports: AppComponentBindingOutputPortSpec[];
    depth?: number;
    maxDepth?: number;
  },
) {
  const schema = resolveOpenApiSchema(document, schemaInput);

  if (!schema) {
    return;
  }

  const depth = options.depth ?? 0;
  const maxDepth = options.maxDepth ?? 2;
  const responsePath = options.path;
  const valueDescriptor = normalizeStructuredOutputValueDescriptor(
    buildValueDescriptorFromOpenApiSchema(document, schema, {
      maxDepth: 4,
    }),
  );
  const basePort = {
    id: buildAppComponentResponsePortId(responsePath),
    label: buildAppComponentResponsePortLabel(responsePath),
    description: schema.description,
    valueDescriptor,
    responsePath,
    statusCode: options.statusCode,
    contentType: options.contentType,
  };

  if (isArraySchema(schema)) {
    pushAppComponentResponsePort(options.ports, {
      ...basePort,
      kind: "json",
      contract: resolveStructuredOutputContract(valueDescriptor),
    });
    return;
  }

  if (isObjectSchema(schema)) {
    pushAppComponentResponsePort(options.ports, {
      ...basePort,
      kind: "json",
      contract: resolveStructuredOutputContract(valueDescriptor),
    });

    if (depth >= maxDepth) {
      return;
    }

    for (const [propertyName, propertySchemaInput] of Object.entries(schema.properties ?? {})) {
      const propertySchema = resolveOpenApiSchema(document, propertySchemaInput);

      if (!propertySchema) {
        continue;
      }

      const nextPath = [...responsePath, propertyName];

      if (isObjectSchema(propertySchema) || isArraySchema(propertySchema)) {
        collectResponsePortsFromSchema(document, propertySchema, {
          ...options,
          path: nextPath,
          depth: depth + 1,
        });
        continue;
      }

      const kind = resolveFieldKind(propertySchema);

      pushAppComponentResponsePort(options.ports, {
        id: buildAppComponentResponsePortId(nextPath),
        label: buildAppComponentResponsePortLabel(nextPath),
        description: propertySchema.description,
        kind,
        contract: resolveAppComponentOutputContract(kind),
        valueDescriptor: normalizeStructuredOutputValueDescriptor(
          buildValueDescriptorFromOpenApiSchema(document, propertySchema, {
            maxDepth: 4,
          }),
        ),
        responsePath: nextPath,
        statusCode: options.statusCode,
        contentType: options.contentType,
      });
    }

    return;
  }

  const kind = resolveFieldKind(schema);

  pushAppComponentResponsePort(options.ports, {
    ...basePort,
    kind,
    contract: resolveAppComponentOutputContract(kind),
  });
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

export const defaultAppComponentMockJsonDefinition: AppComponentMockJsonDefinition = {
  version: 1,
  operation: {
    method: "post",
    path: "/mock",
    summary: "Inline mock notification",
    description:
      "Synthetic AppComponent endpoint used to prototype response rendering and bindings without a deployed API.",
    ui: {
      role: "async-select-search",
      widget: "select2",
      selectionType: "single",
      searchParam: "country_search",
      searchParamAliases: ["country_query"],
      itemsPath: "items",
      itemValueField: "code",
      itemLabelField: "label",
    },
  },
  request: {
    parameters: [
      {
        name: "country_search",
        in: "query",
        description: "Search countries for the custom select input.",
        required: false,
        schema: {
          type: "string",
        },
      },
      {
        name: "country_query",
        in: "query",
        description: "Alias for the country search term.",
        required: false,
        schema: {
          type: "string",
        },
      },
      {
        name: "page",
        in: "query",
        description: "Mock lookup pagination page.",
        required: false,
        schema: {
          type: "integer",
        },
      },
      {
        name: "limit",
        in: "query",
        description: "Mock lookup pagination size.",
        required: false,
        schema: {
          type: "integer",
        },
      },
    ],
    bodyContentType: "application/json",
    bodyRequired: false,
    bodySchema: {
      type: "object",
      properties: {
        note: {
          type: "string",
          title: "Note",
          description: "Optional note sent with the mock request.",
        },
      },
    },
  },
  response: {
    status: 200,
    contentType: "application/json",
    body: {
      title: "Action completed",
      message: "This is a mock AppComponent notification response.",
      tone: "success",
      details:
        "Use this inline target to prototype response rendering and downstream widget bindings before a real API exists.",
      items: [
        {
          code: "AT",
          label: "Austria",
        },
        {
          code: "DE",
          label: "Germany",
        },
        {
          code: "CH",
          label: "Switzerland",
        },
      ],
    },
    ui: {
      role: "notification",
      widget: "banner-v1",
    },
  },
};

export function normalizeAppComponentAuthMode(
  value: unknown,
): AppComponentAuthMode {
  return value === "none" ? "none" : "session-jwt";
}

export function normalizeAppComponentApiTargetMode(
  value: unknown,
): AppComponentApiTargetMode {
  return value === "main-sequence-resource-release" || value === "mock-json"
    ? value
    : "manual";
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

export function normalizeAppComponentMainSequenceResourceRelease(
  value: unknown,
): AppComponentMainSequenceResourceReleaseRef | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const rawReleaseId =
    typeof value.releaseId === "number" ? value.releaseId : Number(value.releaseId);
  const releaseId =
    Number.isFinite(rawReleaseId) && rawReleaseId > 0 ? Math.trunc(rawReleaseId) : null;

  if (!releaseId) {
    return undefined;
  }

  function readOptionalString(entry: unknown) {
    return typeof entry === "string" && entry.trim() ? entry.trim() : undefined;
  }

  return {
    releaseId,
    label: readOptionalString(value.label),
    projectName: readOptionalString(value.projectName),
    releaseKind: readOptionalString(value.releaseKind)?.toLowerCase(),
    publicUrl: readOptionalString(value.publicUrl),
    exchangeLaunchUrl: readOptionalString(value.exchangeLaunchUrl),
    subdomain: readOptionalString(value.subdomain),
  };
}

function normalizeMockJsonValue(value: unknown) {
  try {
    return value === undefined ? undefined : cloneJson(value);
  } catch {
    return undefined;
  }
}

function normalizeAppComponentMockJsonSchema(
  value: unknown,
): OpenApiSchema | undefined {
  return isPlainRecord(value) ? normalizeMockJsonValue(value) as OpenApiSchema : undefined;
}

function normalizeAppComponentMockJsonParameter(
  value: unknown,
): OpenApiParameter | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const location =
    value.in === "path" || value.in === "query" || value.in === "header"
      ? value.in
      : undefined;

  if (!name || !location) {
    return undefined;
  }

  return {
    name,
    in: location,
    description:
      typeof value.description === "string" && value.description.trim()
        ? value.description.trim()
        : undefined,
    required: location === "path" ? true : value.required === true,
    schema: normalizeAppComponentMockJsonSchema(value.schema),
    example: normalizeMockJsonValue(value.example),
  };
}

function normalizeAppComponentMockJsonResponseUi(
  value: unknown,
): AppComponentMockJsonResponseUiDefinition | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const role =
    value.role === "notification" || value.role === "editable-form"
      ? value.role
      : undefined;
  const widget =
    value.widget === "banner-v1" || value.widget === "definition-v1"
      ? value.widget
      : undefined;

  if (role === "notification" || widget === "banner-v1") {
    return {
      role: "notification",
      widget: "banner-v1",
    };
  }

  if (role === "editable-form" || widget === "definition-v1") {
    return {
      role: "editable-form",
      widget: "definition-v1",
    };
  }

  return undefined;
}

function normalizeAppComponentMockJsonOperationUi(
  value: unknown,
): AppComponentMockJsonOperationUiDefinition | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const role = value.role === "async-select-search" ? value.role : undefined;
  const widget = value.widget === "select2" ? value.widget : undefined;

  if (role !== "async-select-search" || widget !== "select2") {
    return undefined;
  }

  return {
    role,
    widget,
    selectionType: value.selectionType === "single" ? "single" : undefined,
    searchParam:
      typeof value.searchParam === "string" && value.searchParam.trim()
        ? value.searchParam.trim()
        : undefined,
    searchParamAliases: Array.isArray(value.searchParamAliases)
      ? value.searchParamAliases.flatMap((entry) =>
          typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
        )
      : undefined,
    itemsPath:
      typeof value.itemsPath === "string" && value.itemsPath.trim()
        ? value.itemsPath.trim()
        : undefined,
    itemValueField:
      typeof value.itemValueField === "string" && value.itemValueField.trim()
        ? value.itemValueField.trim()
        : undefined,
    itemLabelField:
      typeof value.itemLabelField === "string" && value.itemLabelField.trim()
        ? value.itemLabelField.trim()
        : undefined,
    paginationPath:
      typeof value.paginationPath === "string" && value.paginationPath.trim()
        ? value.paginationPath.trim()
        : undefined,
    paginationMoreField:
      typeof value.paginationMoreField === "string" && value.paginationMoreField.trim()
        ? value.paginationMoreField.trim()
        : undefined,
  };
}

export function buildDefaultAppComponentMockJsonDefinition(options?: {
  method?: AppComponentHttpMethod;
  path?: string;
}): AppComponentMockJsonDefinition {
  const method = options?.method ?? defaultAppComponentMockJsonDefinition.operation.method;
  const path = options?.path ?? defaultAppComponentMockJsonDefinition.operation.path;

  return {
    ...cloneJson(defaultAppComponentMockJsonDefinition),
    operation: {
      ...cloneJson(defaultAppComponentMockJsonDefinition.operation),
      method,
      path,
    },
  };
}

export function normalizeAppComponentMockJsonDefinition(
  value: unknown,
  options?: {
    fallbackMethod?: AppComponentHttpMethod;
    fallbackPath?: string;
  },
): AppComponentMockJsonDefinition | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  if ("version" in value && value.version !== 1) {
    return undefined;
  }

  const rawOperation = isPlainRecord(value.operation) ? value.operation : {};
  const method =
    normalizeAppComponentMethod(rawOperation.method) ?? options?.fallbackMethod;
  const path =
    typeof rawOperation.path === "string" && rawOperation.path.trim()
      ? rawOperation.path.trim()
      : options?.fallbackPath;
  const summary =
    typeof rawOperation.summary === "string" && rawOperation.summary.trim()
      ? rawOperation.summary.trim()
      : undefined;
  const description =
    typeof rawOperation.description === "string" && rawOperation.description.trim()
      ? rawOperation.description.trim()
      : undefined;
  const operationUi = normalizeAppComponentMockJsonOperationUi(rawOperation.ui);

  const rawRequest = isPlainRecord(value.request) ? value.request : undefined;
  const parameters = Array.isArray(rawRequest?.parameters)
    ? rawRequest.parameters.flatMap((entry) => {
        const normalized = normalizeAppComponentMockJsonParameter(entry);
        return normalized ? [normalized] : [];
      })
    : undefined;
  const bodySchema = normalizeAppComponentMockJsonSchema(rawRequest?.bodySchema);
  const bodyContentType =
    typeof rawRequest?.bodyContentType === "string" && rawRequest.bodyContentType.trim()
      ? rawRequest.bodyContentType.trim()
      : undefined;
  const request =
    parameters?.length ||
    bodySchema ||
    rawRequest?.bodyRequired === true ||
    bodyContentType ||
    (typeof rawRequest?.bodyDescription === "string" && rawRequest.bodyDescription.trim())
      ? {
          parameters: parameters?.length ? parameters : undefined,
          bodySchema,
          bodyRequired: rawRequest?.bodyRequired === true,
          bodyDescription:
            typeof rawRequest?.bodyDescription === "string" && rawRequest.bodyDescription.trim()
              ? rawRequest.bodyDescription.trim()
              : undefined,
          bodyContentType,
        }
      : undefined;

  const rawResponse = isPlainRecord(value.response) ? value.response : {};
  const rawStatus =
    typeof rawResponse.status === "number" ? rawResponse.status : Number(rawResponse.status);
  const responseStatus =
    Number.isFinite(rawStatus) && rawStatus >= 100 && rawStatus <= 599
      ? Math.trunc(rawStatus)
      : undefined;
  const response = {
    status: responseStatus,
    description:
      typeof rawResponse.description === "string" && rawResponse.description.trim()
        ? rawResponse.description.trim()
        : undefined,
    contentType:
      typeof rawResponse.contentType === "string" && rawResponse.contentType.trim()
        ? rawResponse.contentType.trim()
        : undefined,
    body: normalizeMockJsonValue(rawResponse.body),
    schema: normalizeAppComponentMockJsonSchema(rawResponse.schema),
    ui: normalizeAppComponentMockJsonResponseUi(rawResponse.ui),
  } satisfies AppComponentMockJsonDefinition["response"];

  return {
    version: 1,
    operation: {
      method,
      path,
      summary,
      description,
      ui: operationUi,
    },
    request,
    response,
  };
}

function normalizeWidgetValueDescriptor(
  value: unknown,
): WidgetValueDescriptor | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const contract = typeof value.contract === "string" ? value.contract.trim() : "";
  const description = typeof value.description === "string" ? value.description : undefined;

  if (!contract) {
    return undefined;
  }

  if (value.kind === "primitive") {
    const primitive = value.primitive;

    if (
      primitive !== "string" &&
      primitive !== "number" &&
      primitive !== "integer" &&
      primitive !== "boolean" &&
      primitive !== "null"
    ) {
      return undefined;
    }

    return {
      kind: "primitive",
      contract: contract as WidgetContractId,
      primitive,
      format: typeof value.format === "string" ? value.format : undefined,
      description,
    };
  }

  if (value.kind === "object") {
    const fields = Array.isArray(value.fields)
      ? value.fields.flatMap((entry) => {
          if (!isPlainRecord(entry)) {
            return [];
          }

          const key = typeof entry.key === "string" ? entry.key.trim() : "";
          const label = typeof entry.label === "string" ? entry.label.trim() : "";
          const nestedValue = normalizeWidgetValueDescriptor(entry.value);

          if (!key || !label || !nestedValue) {
            return [];
          }

          return [{
            key,
            label,
            description: typeof entry.description === "string" ? entry.description : undefined,
            required: entry.required === true,
            value: nestedValue,
          }];
        })
      : [];

    return {
      kind: "object",
      contract: contract as WidgetContractId,
      description,
      fields,
    };
  }

  if (value.kind === "array") {
    return {
      kind: "array",
      contract: contract as WidgetContractId,
      description,
      items: normalizeWidgetValueDescriptor(value.items),
    };
  }

  if (value.kind === "unknown") {
    return {
      kind: "unknown",
      contract: contract as WidgetContractId,
      description,
    };
  }

  return undefined;
}

export function normalizeAppComponentProps(
  props: AppComponentWidgetProps,
): AppComponentWidgetProps {
  const normalizedTargetMode = normalizeAppComponentApiTargetMode(props.apiTargetMode);
  const normalizedTopLevelMethod = normalizeAppComponentMethod(props.method);
  const normalizedMockJson = normalizeAppComponentMockJsonDefinition(props.mockJson, {
    fallbackMethod: normalizedTopLevelMethod,
    fallbackPath:
      typeof props.path === "string" && props.path.trim() ? props.path.trim() : undefined,
  });
  const resolvedMethod = normalizedTopLevelMethod ?? normalizedMockJson?.operation.method;
  const resolvedPath =
    (typeof props.path === "string" && props.path.trim() ? props.path.trim() : undefined) ??
    normalizedMockJson?.operation.path;
  const resolvedRequestBodyContentType =
    typeof props.requestBodyContentType === "string" && props.requestBodyContentType.trim()
      ? props.requestBodyContentType.trim()
      : normalizedMockJson?.request?.bodyContentType;

  return {
    ...props,
    apiTargetMode: normalizedTargetMode,
    mainSequenceResourceRelease: normalizeAppComponentMainSequenceResourceRelease(
      props.mainSequenceResourceRelease,
    ),
    mockJson:
      normalizedMockJson
        ? {
            ...normalizedMockJson,
            operation: {
              ...normalizedMockJson.operation,
              method: resolvedMethod,
              path: resolvedPath,
            },
            request: normalizedMockJson.request
              ? {
                  ...normalizedMockJson.request,
                  bodyContentType:
                    normalizedMockJson.request.bodyContentType ?? resolvedRequestBodyContentType,
                }
              : normalizedMockJson.request,
          }
        : undefined,
    apiBaseUrl:
      typeof props.apiBaseUrl === "string" && props.apiBaseUrl.trim()
        ? props.apiBaseUrl.trim()
        : undefined,
    serviceHeaders: normalizeAppComponentServiceHeaders(props.serviceHeaders),
    authMode: normalizeAppComponentAuthMode(props.authMode),
    method: resolvedMethod,
    path: resolvedPath,
    requestBodyContentType: resolvedRequestBodyContentType,
    bindingSpec: normalizeAppComponentBindingSpec(props.bindingSpec),
    requestInputMap: normalizeAppComponentRequestInputMap(props.requestInputMap),
    compactCardLayout: normalizeAppComponentCompactCardLayout(props.compactCardLayout),
    showHeader: props.showHeader !== false,
    showResponse:
      normalizedTargetMode === "mock-json"
        ? true
        : props.showResponse === true,
    hideRequestButton: props.hideRequestButton === true,
    requestButtonLabel:
      typeof props.requestButtonLabel === "string" && props.requestButtonLabel.trim()
        ? props.requestButtonLabel.trim()
        : undefined,
    refreshOnDashboardRefresh: props.refreshOnDashboardRefresh !== false,
  };
}

export function normalizeAppComponentCompactCardLayout(
  value: unknown,
): AppComponentCompactCardLayout {
  return value === "two-columns" || value === "three-columns" || value === "one-column"
    ? value
    : "one-column";
}

export function normalizeAppComponentServiceHeader(
  value: unknown,
): AppComponentServiceHeader | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const headerValue =
    typeof value.value === "string"
      ? value.value
      : value.value == null
        ? ""
        : String(value.value);

  return {
    name,
    value: headerValue,
  };
}

export function normalizeAppComponentServiceHeaders(
  value: unknown,
): AppComponentServiceHeader[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.flatMap((entry) => {
    const next = normalizeAppComponentServiceHeader(entry);
    return next ? [next] : [];
  });

  return normalized.length > 0 ? normalized : undefined;
}

export function resolveAppComponentConfiguredHeadersRecord(
  value: AppComponentServiceHeader[] | undefined,
) {
  if (!Array.isArray(value) || value.length === 0) {
    return {};
  }

  const headers: Record<string, string> = {};

  for (const entry of value) {
    const name = typeof entry.name === "string" ? entry.name.trim() : "";

    if (!name) {
      continue;
    }

    headers[name] = typeof entry.value === "string" ? entry.value : "";
  }

  return headers;
}

export function buildAppComponentConfiguredHeadersKey(
  value: AppComponentServiceHeader[] | undefined,
) {
  const headers = resolveAppComponentConfiguredHeadersRecord(value);
  const entries = Object.entries(headers).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return JSON.stringify(entries);
}

export function isAppComponentMainSequenceResourceReleaseMode(
  props: Pick<
    AppComponentWidgetProps,
    "apiTargetMode" | "mainSequenceResourceRelease"
  >,
) {
  return (
    normalizeAppComponentApiTargetMode(props.apiTargetMode) ===
      "main-sequence-resource-release" &&
    Boolean(props.mainSequenceResourceRelease?.releaseId)
  );
}

export function isAppComponentMockJsonMode(
  props: Pick<AppComponentWidgetProps, "apiTargetMode">,
) {
  return normalizeAppComponentApiTargetMode(props.apiTargetMode) === "mock-json";
}

function buildAppComponentSyntheticReleaseBaseUrl(releaseId: number) {
  return `https://resource-release-${releaseId}.invalid`;
}

export const APP_COMPONENT_MOCK_JSON_BASE_URL = "https://mock-json.invalid";

export function resolveAppComponentDisplayBaseUrl(
  props: Pick<
    AppComponentWidgetProps,
    "apiBaseUrl" | "apiTargetMode" | "mainSequenceResourceRelease"
  >,
) {
  if (isAppComponentMockJsonMode(props)) {
    return undefined;
  }

  if (isAppComponentMainSequenceResourceReleaseMode(props)) {
    return props.mainSequenceResourceRelease?.publicUrl ?? props.apiBaseUrl ?? undefined;
  }

  return props.apiBaseUrl;
}

export function resolveAppComponentRequestBaseUrl(
  props: Pick<
    AppComponentWidgetProps,
    "apiBaseUrl" | "apiTargetMode" | "mainSequenceResourceRelease"
  >,
) {
  if (isAppComponentMockJsonMode(props)) {
    return APP_COMPONENT_MOCK_JSON_BASE_URL;
  }

  const displayBaseUrl = resolveAppComponentDisplayBaseUrl(props);
  const resolvedDisplayBaseUrl = tryResolveAppComponentBaseUrl(displayBaseUrl);

  if (resolvedDisplayBaseUrl) {
    return resolvedDisplayBaseUrl;
  }

  if (isAppComponentMainSequenceResourceReleaseMode(props)) {
    return buildAppComponentSyntheticReleaseBaseUrl(
      props.mainSequenceResourceRelease!.releaseId,
    );
  }

  return null;
}

export function hasAppComponentDiscoveryTarget(
  props: Pick<
    AppComponentWidgetProps,
    "apiBaseUrl" | "apiTargetMode" | "mainSequenceResourceRelease"
  >,
) {
  if (isAppComponentMockJsonMode(props)) {
    return true;
  }

  if (isAppComponentMainSequenceResourceReleaseMode(props)) {
    return true;
  }

  return tryResolveAppComponentBaseUrl(props.apiBaseUrl) !== null;
}

function setAppComponentRequestHeader(
  headers: Record<string, string>,
  name: string,
  value: string,
) {
  const normalizedName = name.trim();

  if (!normalizedName) {
    return;
  }

  const existingKey = Object.keys(headers).find(
    (key) => key.toLowerCase() === normalizedName.toLowerCase(),
  );

  if (existingKey && existingKey !== normalizedName) {
    delete headers[existingKey];
  }

  headers[normalizedName] = value;
}

export function normalizeAppComponentRequestInputMapFieldConfig(
  value: unknown,
): AppComponentRequestInputMapFieldConfig | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const normalized = {
    visibleOnCard: typeof value.visibleOnCard === "boolean" ? value.visibleOnCard : undefined,
    label:
      typeof value.label === "string" && value.label.trim().length > 0
        ? value.label
        : undefined,
    prefillValue: typeof value.prefillValue === "string" ? value.prefillValue : undefined,
  } satisfies AppComponentRequestInputMapFieldConfig;

  return isMeaningfulAppComponentRequestInputMapFieldConfig(normalized)
    ? normalized
    : undefined;
}

export function normalizeAppComponentRequestInputMap(
  value: unknown,
): AppComponentRequestInputMap | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  if ("version" in value && value.version !== 1) {
    return undefined;
  }

  const operationKey = typeof value.operationKey === "string" ? value.operationKey.trim() : "";

  if (!operationKey) {
    return undefined;
  }

  const fields = isPlainRecord(value.fields)
    ? Object.fromEntries(
        Object.entries(value.fields).flatMap(([fieldKey, entry]) => {
          const normalizedFieldKey = fieldKey.trim();
          const normalizedConfig = normalizeAppComponentRequestInputMapFieldConfig(entry);

          if (!normalizedFieldKey || !normalizedConfig) {
            return [];
          }

          return [[normalizedFieldKey, normalizedConfig] as const];
        }),
      )
    : {};

  return {
    version: 1,
    operationKey,
    fields,
  };
}

export function normalizeAppComponentBindingSpec(
  value: unknown,
): AppComponentBindingSpec | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  if ("version" in value && value.version !== 1) {
    return undefined;
  }

  const operationKey = typeof value.operationKey === "string" ? value.operationKey.trim() : "";

  if (!operationKey) {
    return undefined;
  }

  const requestPorts = Array.isArray(value.requestPorts)
    ? value.requestPorts.flatMap((entry) => {
        if (!isPlainRecord(entry)) {
          return [];
        }

        const id = typeof entry.id === "string" ? entry.id.trim() : "";
        const fieldKey = typeof entry.fieldKey === "string" ? entry.fieldKey.trim() : "";
        const label = typeof entry.label === "string" ? entry.label.trim() : "";
        const accepts = Array.isArray(entry.accepts)
          ? entry.accepts.filter((contract): contract is WidgetContractId => typeof contract === "string")
          : [];

        if (!id || !fieldKey || !label || accepts.length === 0) {
          return [];
        }

        return [{
          id,
          fieldKey,
          label,
          description: typeof entry.description === "string" ? entry.description : undefined,
          required: entry.required === true,
          location:
            entry.location === "path" ||
            entry.location === "query" ||
            entry.location === "header" ||
            entry.location === "body"
              ? entry.location
              : "body",
          kind:
            entry.kind === "string" ||
            entry.kind === "number" ||
            entry.kind === "integer" ||
            entry.kind === "boolean" ||
            entry.kind === "date" ||
            entry.kind === "date-time" ||
            entry.kind === "enum" ||
            entry.kind === "json"
              ? entry.kind
              : "json",
          accepts,
        } satisfies AppComponentBindingInputPortSpec];
      })
    : [];

  const responsePorts = Array.isArray(value.responsePorts)
    ? value.responsePorts.flatMap((entry) => {
        if (!isPlainRecord(entry)) {
          return [];
        }

        const id = typeof entry.id === "string" ? entry.id.trim() : "";
        const label = typeof entry.label === "string" ? entry.label.trim() : "";
        const contract = typeof entry.contract === "string" ? entry.contract.trim() : "";
        const responsePath = Array.isArray(entry.responsePath)
          ? entry.responsePath.filter((segment): segment is string => typeof segment === "string")
          : [];

        if (!id || !label || !contract) {
          return [];
        }

        const valueDescriptor = normalizeStructuredOutputValueDescriptor(
          normalizeWidgetValueDescriptor(entry.valueDescriptor),
        );
        const normalizedContract =
          resolveTabularFrameDescriptorContract(valueDescriptor) ?? (contract as WidgetContractId);

        return [{
          id,
          label,
          description: typeof entry.description === "string" ? entry.description : undefined,
          kind:
            entry.kind === "string" ||
            entry.kind === "number" ||
            entry.kind === "integer" ||
            entry.kind === "boolean" ||
            entry.kind === "date" ||
            entry.kind === "date-time" ||
            entry.kind === "enum" ||
            entry.kind === "json"
              ? entry.kind
              : "json",
          contract: normalizedContract,
          valueDescriptor,
          responsePath,
          statusCode: typeof entry.statusCode === "string" ? entry.statusCode : "200",
          contentType: typeof entry.contentType === "string" ? entry.contentType : null,
        } satisfies AppComponentBindingOutputPortSpec];
      })
    : [];

  const requestForm = normalizeAppComponentGeneratedForm(value.requestForm);

  return {
    version: 1,
    operationKey,
    requestPorts,
    responsePorts,
    requestForm,
  };
}

function normalizeAppComponentGeneratedFieldUiEnhancement(
  value: unknown,
): AppComponentGeneratedFieldUiEnhancement | undefined {
  if (!isPlainRecord(value) || value.role !== "async-select-search") {
    return undefined;
  }

  const searchFieldKeys = Array.isArray(value.searchFieldKeys)
    ? value.searchFieldKeys.flatMap((entry) =>
        typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
      )
    : [];
  const itemsPath = Array.isArray(value.itemsPath)
    ? value.itemsPath.flatMap((entry) =>
        typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
      )
    : [];
  const itemValueFieldPath = Array.isArray(value.itemValueFieldPath)
    ? value.itemValueFieldPath.flatMap((entry) =>
        typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
      )
    : [];
  const itemLabelFieldPath = Array.isArray(value.itemLabelFieldPath)
    ? value.itemLabelFieldPath.flatMap((entry) =>
        typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
      )
    : [];
  const paginationPath = Array.isArray(value.paginationPath)
    ? value.paginationPath.flatMap((entry) =>
        typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
      )
    : undefined;

  if (
    value.widget !== "select2" ||
    searchFieldKeys.length === 0 ||
    itemsPath.length === 0 ||
    itemValueFieldPath.length === 0 ||
    itemLabelFieldPath.length === 0
  ) {
    return undefined;
  }

  return {
    role: "async-select-search",
    widget: "select2",
    selectionType: "single",
    searchFieldKeys,
    pageFieldKey:
      typeof value.pageFieldKey === "string" && value.pageFieldKey.trim()
        ? value.pageFieldKey.trim()
        : undefined,
    limitFieldKey:
      typeof value.limitFieldKey === "string" && value.limitFieldKey.trim()
        ? value.limitFieldKey.trim()
        : undefined,
    itemsPath,
    itemValueFieldPath,
    itemLabelFieldPath,
    paginationPath,
    paginationMoreField:
      typeof value.paginationMoreField === "string" && value.paginationMoreField.trim()
        ? value.paginationMoreField.trim()
        : undefined,
  };
}

function normalizeAppComponentGeneratedField(
  value: unknown,
): AppComponentGeneratedField | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const key = typeof value.key === "string" ? value.key.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";

  if (!key || !label) {
    return undefined;
  }

  return {
    key,
    label,
    description: typeof value.description === "string" ? value.description : undefined,
    location:
      value.location === "path" ||
      value.location === "query" ||
      value.location === "header" ||
      value.location === "body"
        ? value.location
        : "body",
    required: value.required === true,
    kind:
      value.kind === "string" ||
      value.kind === "number" ||
      value.kind === "integer" ||
      value.kind === "boolean" ||
      value.kind === "date" ||
      value.kind === "date-time" ||
      value.kind === "enum" ||
      value.kind === "json"
        ? value.kind
        : "json",
    enumValues: Array.isArray(value.enumValues)
      ? value.enumValues.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    optionEntries: Array.isArray(value.optionEntries)
      ? value.optionEntries.flatMap((entry) => {
          if (!isPlainRecord(entry)) {
            return [];
          }

          const optionValue =
            typeof entry.value === "string" ? entry.value : undefined;
          const optionLabel =
            typeof entry.label === "string" && entry.label.trim()
              ? entry.label.trim()
              : undefined;

          if (!optionValue || !optionLabel) {
            return [];
          }

          return [{
            value: optionValue,
            label: optionLabel,
          }] as const;
        })
      : undefined,
    paramName: typeof value.paramName === "string" ? value.paramName : undefined,
    bodyPath: Array.isArray(value.bodyPath)
      ? value.bodyPath.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    rootBodyValue: value.rootBodyValue === true,
    contentType: typeof value.contentType === "string" ? value.contentType : null,
    defaultValue:
      "defaultValue" in value && value.defaultValue !== undefined
        ? cloneJson(value.defaultValue)
        : undefined,
    exampleValue:
      "exampleValue" in value && value.exampleValue !== undefined
        ? cloneJson(value.exampleValue)
        : undefined,
    hiddenFromForm: value.hiddenFromForm === true,
    uiEnhancement: normalizeAppComponentGeneratedFieldUiEnhancement(value.uiEnhancement),
  };
}

function normalizeAppComponentGeneratedForm(
  value: unknown,
): AppComponentGeneratedForm | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const parameterFields = Array.isArray(value.parameterFields)
    ? value.parameterFields.flatMap((entry) => {
        const normalized = normalizeAppComponentGeneratedField(entry);
        return normalized ? [normalized] : [];
      })
    : [];
  const bodyFields = Array.isArray(value.bodyFields)
    ? value.bodyFields.flatMap((entry) => {
        const normalized = normalizeAppComponentGeneratedField(entry);
        return normalized ? [normalized] : [];
      })
    : [];
  const bodyRawField = normalizeAppComponentGeneratedField(value.bodyRawField);
  const bodyMode =
    value.bodyMode === "generated" || value.bodyMode === "raw" ? value.bodyMode : "none";

  return {
    parameterFields,
    bodyFields,
    bodyMode,
    bodyRawField,
    bodyContentType: typeof value.bodyContentType === "string" ? value.bodyContentType : null,
    bodyRequired: value.bodyRequired === true,
    unsupportedReason:
      typeof value.unsupportedReason === "string" ? value.unsupportedReason : undefined,
  };
}

function normalizeAppComponentEditableFormFieldKind(
  value: unknown,
): AppComponentEditableFormFieldKind | undefined {
  switch (value) {
    case "string":
    case "number":
    case "integer":
    case "boolean":
    case "date":
    case "date-time":
    case "enum":
    case "json":
    case "percent":
      return value;
    default:
      return undefined;
  }
}

function normalizeAppComponentEditableFormChoice(
  value: unknown,
): AppComponentEditableFormChoice | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const label = typeof value.label === "string" ? value.label.trim() : "";

  if (!label) {
    return undefined;
  }

  return {
    label,
    value: "value" in value ? cloneJson(value.value) : undefined,
  };
}

function normalizeAppComponentEditableFormFieldDefinition(
  value: unknown,
): AppComponentEditableFormFieldDefinition | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const token = typeof value.token === "string" ? value.token.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const kind = normalizeAppComponentEditableFormFieldKind(value.kind);

  if (!token || !name || !label || !kind || typeof value.editable !== "boolean") {
    return undefined;
  }

  return {
    token,
    name,
    label,
    kind,
    editable: value.editable,
    required: value.required === true,
    value:
      "value" in value && value.value !== undefined ? cloneJson(value.value) : undefined,
    defaultValue:
      "default_value" in value && value.default_value !== undefined
        ? cloneJson(value.default_value)
        : "defaultValue" in value && value.defaultValue !== undefined
          ? cloneJson(value.defaultValue)
          : undefined,
    description:
      typeof value.description === "string" ? value.description : undefined,
    formatter:
      typeof value.formatter === "string"
        ? value.formatter
        : value.formatter === null
          ? null
          : undefined,
    choices: Array.isArray(value.choices)
      ? value.choices.flatMap((entry) => {
          const normalized = normalizeAppComponentEditableFormChoice(entry);
          return normalized ? [normalized] : [];
        })
      : value.choices === null
        ? null
        : undefined,
    extra: isPlainRecord(value.extra)
      ? cloneJson(value.extra)
      : value.extra === null
        ? null
        : undefined,
  };
}

function normalizeAppComponentEditableFormSectionDefinition(
  value: unknown,
): AppComponentEditableFormSectionDefinition | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";

  if (!id || !title) {
    return undefined;
  }

  return {
    id,
    title,
    description:
      typeof value.description === "string" ? value.description : undefined,
    fields: Array.isArray(value.fields)
      ? value.fields.flatMap((entry) => {
          const normalized = normalizeAppComponentEditableFormFieldDefinition(entry);
          return normalized ? [normalized] : [];
        })
      : [],
    extra: isPlainRecord(value.extra)
      ? cloneJson(value.extra)
      : value.extra === null
        ? null
        : undefined,
  };
}

function normalizeAppComponentEditableFormDefinition(
  value: unknown,
): AppComponentEditableFormDefinition | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  if ("version" in value && value.version !== 1) {
    return undefined;
  }

  const sections = Array.isArray(value.sections)
    ? value.sections.flatMap((entry) => {
        const normalized = normalizeAppComponentEditableFormSectionDefinition(entry);
        return normalized ? [normalized] : [];
      })
    : [];

  if (sections.length === 0) {
    return undefined;
  }

  return {
    version: 1,
    formId:
      typeof value.form_id === "string" && value.form_id.trim()
        ? value.form_id.trim()
        : typeof value.formId === "string" && value.formId.trim()
          ? value.formId.trim()
          : undefined,
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title.trim()
        : undefined,
    description:
      typeof value.description === "string" && value.description.trim()
        ? value.description.trim()
        : undefined,
    sections,
    meta: isPlainRecord(value.meta)
      ? cloneJson(value.meta)
      : value.meta === null
        ? null
        : undefined,
  };
}

function normalizeAppComponentEditableFormSession(
  value: unknown,
): AppComponentEditableFormSession | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  if ("version" in value && value.version !== 1) {
    return undefined;
  }

  if (value.widget !== "definition-v1") {
    return undefined;
  }

  const sections = Array.isArray(value.sections)
    ? value.sections.flatMap((entry) => {
        const normalized = normalizeAppComponentEditableFormSectionDefinition(entry);
        return normalized ? [normalized] : [];
      })
    : [];

  if (sections.length === 0) {
    return undefined;
  }

  return {
    version: 1,
    operationKey:
      typeof value.operationKey === "string" && value.operationKey.trim()
        ? value.operationKey.trim()
        : undefined,
    widget: "definition-v1",
    formId:
      typeof value.formId === "string" && value.formId.trim()
        ? value.formId.trim()
        : undefined,
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title.trim()
        : undefined,
    description:
      typeof value.description === "string" && value.description.trim()
        ? value.description.trim()
        : undefined,
    sections,
    meta: isPlainRecord(value.meta)
      ? cloneJson(value.meta)
      : value.meta === null
        ? null
        : undefined,
    valuesByToken: normalizeStringRecord(value.valuesByToken),
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
    editableFormSession: normalizeAppComponentEditableFormSession(
      cloned.editableFormSession,
    ),
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

export function resolveAppComponentEffectiveOperationKey(
  props: Pick<AppComponentWidgetProps, "bindingSpec" | "method" | "path">,
) {
  if (props.bindingSpec?.operationKey) {
    return props.bindingSpec.operationKey;
  }

  if (!props.method || !props.path) {
    return undefined;
  }

  return buildAppComponentOperationKey(props.method, props.path);
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

  const operationParameters = collectOperationParameters(document, resolvedOperation);
  const parameterFields = applyOperationUiEnhancements(
    operationParameters.map((parameter) => buildParameterField(document, parameter)),
    resolvedOperation.operation,
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

export function buildAppComponentBindingSpec(
  document: OpenApiDocument,
  resolvedOperation: ResolvedAppComponentOperation | null,
  form: AppComponentGeneratedForm | null,
): AppComponentBindingSpec | undefined {
  if (!resolvedOperation || !form) {
    return undefined;
  }

  const requestPorts = [
    ...form.parameterFields.map((field) => buildAppComponentInputPortSpec(field)),
    ...(form.bodyMode === "generated"
      ? form.bodyFields.map((field) => buildAppComponentInputPortSpec(field))
      : form.bodyMode === "raw" && form.bodyRawField
        ? [buildAppComponentInputPortSpec(form.bodyRawField)]
        : []),
  ];
  const responsePorts: AppComponentBindingOutputPortSpec[] = [];
  const primaryResponseEntry = pickPrimaryAppComponentResponseEntry(document, resolvedOperation);
  const responseUiDescriptor = resolveAppComponentResponseUiDescriptor(
    document,
    resolvedOperation,
  );

  if (primaryResponseEntry && responseUiDescriptor?.role !== "editable-form") {
    collectResponsePortsFromSchema(document, primaryResponseEntry.schema, {
      path: [],
      statusCode: primaryResponseEntry.statusCode,
      contentType: primaryResponseEntry.contentType,
      ports: responsePorts,
      maxDepth: 2,
    });
  }

  return {
    version: 1,
    operationKey: resolvedOperation.record.key,
    requestPorts,
    responsePorts,
    requestForm: cloneJson(form),
  };
}

function buildRuntimeGeneratedFieldFromBindingPort(
  port: AppComponentBindingInputPortSpec,
  requestBodyContentType?: string,
): AppComponentGeneratedField {
  const fieldKey = port.fieldKey || port.id;
  const trimmedContentType =
    typeof requestBodyContentType === "string" && requestBodyContentType.trim()
      ? requestBodyContentType.trim()
      : null;

  if (port.location === "body") {
    if (fieldKey === "body:raw") {
      return {
        key: fieldKey,
        label: port.label,
        description: port.description,
        location: "body",
        required: port.required,
        kind: port.kind,
        rootBodyValue: true,
        bodyPath: [],
        contentType: trimmedContentType,
      };
    }

    const bodyPath =
      fieldKey === "body:$"
        ? []
        : fieldKey.startsWith("body:")
          ? fieldKey
              .slice("body:".length)
              .split(".")
              .filter((segment) => segment.trim().length > 0)
          : [];

    return {
      key: fieldKey,
      label: port.label,
      description: port.description,
      location: "body",
      required: port.required,
      kind: port.kind,
      bodyPath,
      rootBodyValue: fieldKey === "body:$",
      contentType: trimmedContentType,
    };
  }

  const paramPrefix = `${port.location}:`;
  const paramName = fieldKey.startsWith(paramPrefix)
    ? fieldKey.slice(paramPrefix.length)
    : fieldKey;

  return {
    key: fieldKey,
    label: port.label,
    description: port.description,
    location: port.location,
    required: port.required,
    kind: port.kind,
    paramName,
  };
}

export function resolveAppComponentRuntimeGeneratedForm(
  props: Pick<AppComponentWidgetProps, "bindingSpec" | "requestBodyContentType">,
): AppComponentGeneratedForm | null {
  const bindingSpec = normalizeAppComponentBindingSpec(props.bindingSpec);

  if (!bindingSpec) {
    return null;
  }

  if (bindingSpec.requestForm) {
    return bindingSpec.requestForm;
  }

  const parameterFields = bindingSpec.requestPorts
    .filter((port) => port.location !== "body")
    .map((port) => buildRuntimeGeneratedFieldFromBindingPort(port, props.requestBodyContentType));
  const bodyPorts = bindingSpec.requestPorts.filter((port) => port.location === "body");
  const rawBodyPort = bodyPorts.find((port) => port.fieldKey === "body:raw");

  if (rawBodyPort) {
    return {
      parameterFields,
      bodyFields: [],
      bodyMode: "raw",
      bodyRawField: buildRuntimeGeneratedFieldFromBindingPort(
        rawBodyPort,
        props.requestBodyContentType,
      ),
      bodyContentType:
        typeof props.requestBodyContentType === "string" && props.requestBodyContentType.trim()
          ? props.requestBodyContentType.trim()
          : null,
      bodyRequired: rawBodyPort.required,
      unsupportedReason:
        "Runtime synthesized this request form from the saved widget binding because the compiled form was not persisted yet.",
    };
  }

  const bodyFields = bodyPorts.map((port) =>
    buildRuntimeGeneratedFieldFromBindingPort(port, props.requestBodyContentType),
  );

  return {
    parameterFields,
    bodyFields,
    bodyMode: bodyFields.length > 0 ? "generated" : "none",
    bodyContentType:
      typeof props.requestBodyContentType === "string" && props.requestBodyContentType.trim()
        ? props.requestBodyContentType.trim()
        : null,
    bodyRequired: bodyFields.some((field) => field.required),
    unsupportedReason:
      bindingSpec.requestForm === undefined
        ? "Runtime synthesized this request form from the saved widget binding because the compiled form was not persisted yet."
        : undefined,
  };
}

export function listAppComponentGeneratedFields(
  form: AppComponentGeneratedForm | null,
): AppComponentGeneratedField[] {
  if (!form) {
    return [];
  }

  return [
    ...form.parameterFields,
    ...(form.bodyMode === "generated" ? form.bodyFields : []),
    ...(form.bodyMode === "raw" && form.bodyRawField ? [form.bodyRawField] : []),
  ];
}

export function listAppComponentRenderableFields(
  form: AppComponentGeneratedForm | null,
): AppComponentGeneratedField[] {
  return listAppComponentGeneratedFields(form).filter((field) => field.hiddenFromForm !== true);
}

export function listAppComponentRenderableParameterFields(
  form: AppComponentGeneratedForm | null,
) {
  return (form?.parameterFields ?? []).filter((field) => field.hiddenFromForm !== true);
}

export function listAppComponentRenderableBodyFields(
  form: AppComponentGeneratedForm | null,
) {
  return (form?.bodyFields ?? []).filter((field) => field.hiddenFromForm !== true);
}

export function resolveAppComponentActiveRequestInputMap(
  props: Pick<AppComponentWidgetProps, "requestInputMap" | "bindingSpec" | "method" | "path">,
): AppComponentRequestInputMap | undefined {
  const inputMap = normalizeAppComponentRequestInputMap(props.requestInputMap);
  const operationKey = resolveAppComponentEffectiveOperationKey(props);

  if (!inputMap || !operationKey || inputMap.operationKey !== operationKey) {
    return undefined;
  }

  return inputMap;
}

export function reconcileAppComponentRequestInputMap(
  inputMap: AppComponentRequestInputMap | undefined,
  form: AppComponentGeneratedForm | null,
  operationKey: string | undefined,
): AppComponentRequestInputMap | undefined {
  if (!inputMap || !form || !operationKey || inputMap.operationKey !== operationKey) {
    return undefined;
  }

  const validFieldKeys = new Set(listAppComponentGeneratedFields(form).map((field) => field.key));
  const fields = Object.fromEntries(
    Object.entries(inputMap.fields).flatMap(([fieldKey, config]) => {
      if (!validFieldKeys.has(fieldKey) || !isMeaningfulAppComponentRequestInputMapFieldConfig(config)) {
        return [];
      }

      return [[fieldKey, config] as const];
    }),
  );

  return Object.keys(fields).length > 0
    ? {
        version: 1,
        operationKey,
        fields,
      }
    : undefined;
}

function applyAppComponentRequestInputFieldConfig(
  field: AppComponentGeneratedField,
  config: AppComponentRequestInputMapFieldConfig | undefined,
) {
  const nextField = cloneAppComponentGeneratedField(field);

  if (config?.label) {
    nextField.label = config.label;
  }

  return nextField;
}

function shouldShowAppComponentRequestFieldOnCard(
  field: AppComponentGeneratedField,
  inputMap: AppComponentRequestInputMap | undefined,
) {
  return (
    field.hiddenFromForm !== true &&
    inputMap?.fields[field.key]?.visibleOnCard !== false
  );
}

function buildAppComponentCardRequestForm(
  submissionForm: AppComponentGeneratedForm,
  inputMap: AppComponentRequestInputMap | undefined,
): AppComponentGeneratedForm {
  const parameterFields = submissionForm.parameterFields.filter((field) =>
    shouldShowAppComponentRequestFieldOnCard(field, inputMap),
  );
  const bodyFields =
    submissionForm.bodyMode === "generated"
      ? submissionForm.bodyFields.filter((field) =>
          shouldShowAppComponentRequestFieldOnCard(field, inputMap),
        )
      : [];
  const bodyRawField =
    submissionForm.bodyMode === "raw" &&
    submissionForm.bodyRawField &&
    shouldShowAppComponentRequestFieldOnCard(submissionForm.bodyRawField, inputMap)
      ? cloneAppComponentGeneratedField(submissionForm.bodyRawField)
      : undefined;
  const bodyMode =
    submissionForm.bodyMode === "generated"
      ? bodyFields.length > 0
        ? "generated"
        : "none"
      : bodyRawField
        ? "raw"
        : "none";

  return {
    parameterFields: parameterFields.map((field) => cloneAppComponentGeneratedField(field)),
    bodyFields: bodyFields.map((field) => cloneAppComponentGeneratedField(field)),
    bodyMode,
    bodyRawField,
    bodyContentType: bodyMode === "none" ? null : submissionForm.bodyContentType ?? null,
    bodyRequired: bodyMode === "none" ? false : submissionForm.bodyRequired,
    unsupportedReason: bodyMode === "none" ? undefined : submissionForm.unsupportedReason,
  };
}

export function resolveAppComponentRequestInputPrefillValues(
  inputMap: AppComponentRequestInputMap | undefined,
  form: AppComponentGeneratedForm | null,
) {
  if (!inputMap || !form) {
    return {} as Record<string, string>;
  }

  const validFieldKeys = new Set(listAppComponentGeneratedFields(form).map((field) => field.key));

  return Object.fromEntries(
    Object.entries(inputMap.fields).flatMap(([fieldKey, config]) => {
      if (
        !validFieldKeys.has(fieldKey) ||
        typeof config.prefillValue !== "string" ||
        config.prefillValue.trim().length === 0
      ) {
        return [];
      }

      return [[fieldKey, config.prefillValue] as const];
    }),
  ) as Record<string, string>;
}

export function resolveAppComponentMappedRequestForms(
  form: AppComponentGeneratedForm | null,
  props: Pick<
    AppComponentWidgetProps,
    "requestInputMap" | "bindingSpec" | "method" | "path"
  >,
) {
  if (!form) {
    return {
      submissionForm: null,
      cardForm: null,
      activeInputMap: undefined,
      prefillValues: {} as Record<string, string>,
    };
  }

  const operationKey = resolveAppComponentEffectiveOperationKey(props);
  const activeInputMap = reconcileAppComponentRequestInputMap(
    resolveAppComponentActiveRequestInputMap(props),
    form,
    operationKey,
  );
  const submissionForm = cloneAppComponentGeneratedForm(form);

  submissionForm.parameterFields = submissionForm.parameterFields.map((field) =>
    applyAppComponentRequestInputFieldConfig(field, activeInputMap?.fields[field.key]),
  );

  if (submissionForm.bodyMode === "generated") {
    submissionForm.bodyFields = submissionForm.bodyFields.map((field) =>
      applyAppComponentRequestInputFieldConfig(field, activeInputMap?.fields[field.key]),
    );
  } else if (submissionForm.bodyMode === "raw" && submissionForm.bodyRawField) {
    submissionForm.bodyRawField = applyAppComponentRequestInputFieldConfig(
      submissionForm.bodyRawField,
      activeInputMap?.fields[submissionForm.bodyRawField.key],
    );
  }

  return {
    submissionForm,
    cardForm: buildAppComponentCardRequestForm(submissionForm, activeInputMap),
    activeInputMap,
    prefillValues: resolveAppComponentRequestInputPrefillValues(activeInputMap, submissionForm),
  };
}

export function resolveAppComponentRequestInputDisplayLabel(
  props: Pick<AppComponentWidgetProps, "requestInputMap" | "bindingSpec" | "method" | "path">,
  fieldKey: string,
  fallbackLabel: string,
) {
  return resolveAppComponentActiveRequestInputMap(props)?.fields[fieldKey]?.label ?? fallbackLabel;
}

export function resolveAppComponentResponseValueAtPath(
  responseBody: unknown,
  responsePath: string[],
): unknown {
  if (responseBody === undefined) {
    return undefined;
  }

  if (responsePath.length === 0) {
    return cloneJson(responseBody);
  }

  let currentValue: unknown = responseBody;

  for (const segment of responsePath) {
    if (!isPlainRecord(currentValue) || !(segment in currentValue)) {
      return undefined;
    }

    currentValue = currentValue[segment];
  }

  return cloneJson(currentValue);
}

function resolveAppComponentResponseDisplayFieldKind(
  kind: AppComponentBindingOutputPortSpec["kind"],
) {
  return kind === "enum" ? "string" : kind;
}

function resolveAppComponentEditableFormGeneratedFieldKind(
  kind: AppComponentEditableFormFieldKind,
): AppComponentGeneratedFieldKind {
  return kind === "percent" ? "number" : kind;
}

function serializeAppComponentEditableFormChoiceValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? "");
  }
}

export function buildAppComponentEditableFormGeneratedField(
  field: AppComponentEditableFormFieldDefinition,
): AppComponentGeneratedField {
  const optionEntries = Array.isArray(field.choices)
    ? field.choices.map((choice) => ({
        value: serializeAppComponentEditableFormChoiceValue(choice.value),
        label: choice.label,
      }))
    : undefined;

  return {
    key: field.token,
    label: field.label,
    description: field.description,
    location: "body",
    required: field.required === true,
    kind: resolveAppComponentEditableFormGeneratedFieldKind(field.kind),
    enumValues: optionEntries?.map((entry) => entry.value),
    optionEntries,
    defaultValue:
      field.value !== undefined
        ? cloneJson(field.value)
        : field.defaultValue !== undefined
          ? cloneJson(field.defaultValue)
          : undefined,
  };
}

function listAppComponentEditableFormFields(
  session: AppComponentEditableFormSession | undefined,
) {
  if (!session) {
    return [];
  }

  return session.sections.flatMap((section) => section.fields);
}

function resolveAppComponentEditableFormFieldSeedValue(
  field: AppComponentEditableFormFieldDefinition,
) {
  const seed = field.value !== undefined ? field.value : field.defaultValue;

  if (seed === undefined) {
    return "";
  }

  return serializeAppComponentBoundFieldValue(
    buildAppComponentEditableFormGeneratedField(field),
    seed,
  );
}

export function resolveAppComponentEditableFormSessionFromResponse(args: {
  responseBody: unknown;
  operationKey?: string;
  previousSession?: AppComponentEditableFormSession;
  responseUiDescriptor?: AppComponentResponseUiEditableFormDescriptor;
}): AppComponentEditableFormSession | undefined {
  if (args.responseUiDescriptor?.widget !== "definition-v1") {
    return undefined;
  }

  const definition = normalizeAppComponentEditableFormDefinition(args.responseBody);

  if (!definition) {
    return undefined;
  }

  const canReusePreviousValues =
    args.previousSession?.widget === "definition-v1" &&
    args.previousSession.operationKey === args.operationKey &&
    (
      (definition.formId && args.previousSession.formId === definition.formId) ||
      (!definition.formId && !args.previousSession.formId)
    );
  const previousValuesByToken = canReusePreviousValues
    ? args.previousSession?.valuesByToken
    : undefined;
  const valuesByToken = Object.fromEntries(
    definition.sections.flatMap((section) =>
      section.fields.map((field) => [
        field.token,
        previousValuesByToken?.[field.token] ??
          resolveAppComponentEditableFormFieldSeedValue(field),
      ] as const),
    ),
  );

  return {
    version: 1,
    operationKey: args.operationKey,
    widget: "definition-v1",
    formId: definition.formId,
    title: definition.title,
    description: definition.description,
    sections: cloneJson(definition.sections),
    meta: definition.meta ? cloneJson(definition.meta) : definition.meta,
    valuesByToken,
  };
}

export function updateAppComponentEditableFormSessionValue(
  session: AppComponentEditableFormSession | undefined,
  token: string,
  rawValue: string,
): AppComponentEditableFormSession | undefined {
  if (!session || !token.trim()) {
    return session;
  }

  const field = listAppComponentEditableFormFields(session).find(
    (entry) => entry.token === token,
  );

  if (!field || field.editable !== true) {
    return session;
  }

  return {
    ...session,
    sections: cloneJson(session.sections),
    meta: session.meta ? cloneJson(session.meta) : session.meta,
    valuesByToken: {
      ...session.valuesByToken,
      [token]: rawValue,
    },
  };
}

export function resolveAppComponentEditableFormFieldParsedValue(
  field: AppComponentEditableFormFieldDefinition,
  rawValue: string,
) {
  if (
    field.kind === "enum" &&
    Array.isArray(field.choices) &&
    field.choices.length > 0
  ) {
    const trimmed = rawValue.trim();

    if (!trimmed) {
      return undefined;
    }

    const matchedChoice = field.choices.find(
      (choice) => serializeAppComponentEditableFormChoiceValue(choice.value) === trimmed,
    );

    return matchedChoice ? cloneJson(matchedChoice.value) : trimmed;
  }

  const parsed = parseFieldInput(
    buildAppComponentEditableFormGeneratedField(field),
    rawValue,
  );

  return parsed.error || parsed.empty ? undefined : parsed.value;
}

export function resolveAppComponentEditableFormRootValue(
  session: AppComponentEditableFormSession | undefined,
) {
  if (!session) {
    return undefined;
  }

  const valuesByToken = Object.fromEntries(
    listAppComponentEditableFormFields(session).map((field) => [
      field.token,
      resolveAppComponentEditableFormFieldParsedValue(
        field,
        session.valuesByToken[field.token] ?? "",
      ),
    ]),
  );

  return {
    form_id: session.formId,
    title: session.title,
    description: session.description,
    values: valuesByToken,
    meta: session.meta ?? null,
  };
}

export function resolveAppComponentEditableFormPublishedOutputs(
  session: AppComponentEditableFormSession | undefined,
) {
  if (!session) {
    return undefined;
  }

  const outputs: Record<string, unknown> = {
    "editable-form:$": resolveAppComponentEditableFormRootValue(session),
  };

  for (const field of listAppComponentEditableFormFields(session)) {
    outputs[`editable-form:field:${field.token}`] =
      resolveAppComponentEditableFormFieldParsedValue(
        field,
        session.valuesByToken[field.token] ?? "",
      );
  }

  return outputs;
}

function buildAppComponentResponseDisplayFields(
  bindingSpec?: AppComponentBindingSpec,
  responseBody?: unknown,
): AppComponentGeneratedField[] {
  const responsePorts = bindingSpec?.responsePorts ?? [];

  if (responsePorts.length > 0) {
    const nonRootPorts = responsePorts.filter((port) => port.responsePath.length > 0);
    const displayPorts = nonRootPorts.length > 0 ? nonRootPorts : responsePorts;

    return displayPorts.map((port) => ({
      key: port.id,
      label: port.label,
      description: port.description,
      location: "body",
      required: false,
      kind: resolveAppComponentResponseDisplayFieldKind(port.kind),
      bodyPath: port.responsePath,
      rootBodyValue: port.responsePath.length === 0,
      contentType: port.contentType,
    }));
  }

  if (responseBody === undefined) {
    return [];
  }

  let kind: AppComponentGeneratedFieldKind;

  if (typeof responseBody === "boolean") {
    kind = "boolean";
  } else if (typeof responseBody === "number") {
    kind = Number.isInteger(responseBody) ? "integer" : "number";
  } else if (typeof responseBody === "string") {
    kind = "string";
  } else {
    kind = "json";
  }

  return [{
    key: "response:$",
    label: "Response Body",
    location: "body",
    required: false,
    kind,
    bodyPath: [],
    rootBodyValue: true,
    contentType: null,
  }];
}

export function resolveAppComponentResponseDisplayForm(
  props: Pick<AppComponentWidgetProps, "bindingSpec">,
  responseBody?: unknown,
): AppComponentGeneratedForm | null {
  const bindingSpec = normalizeAppComponentBindingSpec(props.bindingSpec);
  const fields = buildAppComponentResponseDisplayFields(bindingSpec, responseBody);

  if (fields.length === 0) {
    return null;
  }

  return {
    parameterFields: fields,
    bodyFields: [],
    bodyMode: "none",
    bodyRequired: false,
  };
}

export function resolveAppComponentResponseDisplayValues(
  form: AppComponentGeneratedForm | null,
  props: Pick<AppComponentWidgetProps, "bindingSpec">,
  responseBody?: unknown,
) {
  if (!form || responseBody === undefined) {
    return {};
  }

  const bindingSpec = normalizeAppComponentBindingSpec(props.bindingSpec);
  const responsePortsById = new Map((bindingSpec?.responsePorts ?? []).map((port) => [port.id, port] as const));

  return Object.fromEntries(
    form.parameterFields.map((field) => {
      const port = responsePortsById.get(field.key);
      const value = port
        ? resolveAppComponentResponseValueAtPath(responseBody, port.responsePath)
        : field.rootBodyValue
          ? responseBody
          : undefined;

      return [
        field.key,
        value === undefined ? "" : serializeAppComponentBoundFieldValue(field, value),
      ];
    }),
  ) as Record<string, string>;
}

export function serializeAppComponentBoundFieldValue(
  field: AppComponentGeneratedField,
  value: unknown,
) {
  switch (field.kind) {
    case "boolean":
      return value === true ? "true" : value === false ? "false" : String(value ?? "");
    case "json":
      return typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2);
    case "date":
      return resolveDateInputSeed(value);
    case "date-time":
      return resolveDateTimeInputSeed(value);
    default:
      return value === undefined || value === null ? "" : String(value);
  }
}

function resolveWidgetInputBaseValue(input: ResolvedWidgetInput) {
  return input.upstreamBase ?? input.value;
}

export function resolveAppComponentBoundInputOverlay(
  form: AppComponentGeneratedForm | null,
  draftValues: Record<string, string>,
  resolvedInputs: ResolvedWidgetInputs | undefined,
) {
  const nextValues = { ...draftValues };
  const boundFieldKeys = new Set<string>();

  if (!form || !resolvedInputs) {
    return {
      values: nextValues,
      boundFieldKeys,
    };
  }

  const candidateFields = listAppComponentGeneratedFields(form);

  for (const field of candidateFields) {
    const resolvedEntry = resolvedInputs[field.key];
    const resolvedValues = Array.isArray(resolvedEntry)
      ? resolvedEntry
      : resolvedEntry
        ? [resolvedEntry]
        : [];
    const firstBoundEntry = resolvedValues.find(
      (entry) => entry.binding || entry.status !== "unbound",
    );
    const firstValidValue = resolvedValues.find(
      (entry) => entry.status === "valid" && resolveWidgetInputBaseValue(entry) !== undefined,
    );

    if (firstBoundEntry) {
      boundFieldKeys.add(field.key);
    }

    if (!firstValidValue) {
      continue;
    }

    nextValues[field.key] = serializeAppComponentBoundFieldValue(
      field,
      resolveWidgetInputBaseValue(firstValidValue),
    );
  }

  return {
    values: nextValues,
    boundFieldKeys,
  };
}

export function resolveAppComponentFieldBindingStates(
  form: AppComponentGeneratedForm | null,
  resolvedInputs: ResolvedWidgetInputs | undefined,
): Record<string, AppComponentFieldBindingState> {
  if (!form || !resolvedInputs) {
    return {};
  }

  const candidateFields = listAppComponentGeneratedFields(form);

  return Object.fromEntries(
    candidateFields.map((field) => {
      const resolvedEntry = resolvedInputs[field.key];
      const resolvedValues = Array.isArray(resolvedEntry)
        ? resolvedEntry
        : resolvedEntry
          ? [resolvedEntry]
          : [];
      const firstBoundEntry = resolvedValues.find(
        (entry) => entry.binding || entry.status !== "unbound",
      );
      const firstValidValue = resolvedValues.find(
        (entry) => entry.status === "valid" && resolveWidgetInputBaseValue(entry) !== undefined,
      );

      if (!firstBoundEntry) {
        return [field.key, {
          fieldKey: field.key,
          isBound: false,
          status: "unbound",
        } satisfies AppComponentFieldBindingState] as const;
      }

      return [field.key, {
        fieldKey: field.key,
        isBound: true,
        status: firstBoundEntry.status,
        sourceWidgetId: firstBoundEntry.sourceWidgetId,
        sourceOutputId: firstBoundEntry.sourceOutputId,
        value: firstValidValue ? resolveWidgetInputBaseValue(firstValidValue) : undefined,
      } satisfies AppComponentFieldBindingState] as const;
    }),
  );
}

export function resolveAppComponentInitialDraftValues(
  form: AppComponentGeneratedForm | null,
  runtimeState: AppComponentWidgetRuntimeState,
  operationKey: string | undefined,
  options?: {
    prefillValues?: Record<string, string>;
  },
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

  if (options?.prefillValues) {
    for (const [fieldKey, value] of Object.entries(options.prefillValues)) {
      nextValues[fieldKey] = value;
    }
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
  form: AppComponentGeneratedForm | null,
  draftValues: Record<string, string>,
): BuildAppComponentRequestResult {
  const errors: string[] = [];
  const baseUrl = resolveAppComponentRequestBaseUrl(props);

  if (!baseUrl) {
    return {
      errors: ["Enter a valid API base URL or select a Main Sequence resource release before sending a request."],
    };
  }

  if (!props.method || !props.path || !form) {
    return {
      errors: ["Select an API operation before sending a request."],
    };
  }

  let resolvedPath = props.path;
  const headers = resolveAppComponentConfiguredHeadersRecord(props.serviceHeaders);
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
      setAppComponentRequestHeader(headers, field.paramName, transportValue);
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
      setAppComponentRequestHeader(headers, "Content-Type", form.bodyContentType);
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
        setAppComponentRequestHeader(headers, "Content-Type", form.bodyContentType);
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : "Request body must be valid JSON.",
        );
      }
    } else {
      body = rawValue;

      if (form.bodyContentType) {
        setAppComponentRequestHeader(headers, "Content-Type", form.bodyContentType);
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
      method: props.method.toUpperCase() as Uppercase<AppComponentHttpMethod>,
      url: requestUrl.toString(),
      headers,
      body,
    },
  };
}

export function extractAppComponentPublishedOutputs(
  responseBody: unknown,
  bindingSpec?: AppComponentBindingSpec,
) {
  if (bindingSpec) {
    return Object.fromEntries(
      bindingSpec.responsePorts.map((port) => [
        port.id,
        resolveAppComponentResponseValueAtPath(responseBody, port.responsePath),
      ]),
    );
  }

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
