import { appRegistry } from "@/app/registry";
import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import type {
  WidgetContractId,
  WidgetDefinition,
  WidgetExecutionReason,
  WidgetInputEffect,
  WidgetInstancePresentation,
  WidgetIoDefinition,
  WidgetRegistryUsageGuidance,
  WidgetRegistryConfigurationContract,
  WidgetRegistryConfigurationFieldDescriptor,
  WidgetRegistryConfigurationMode,
  WidgetRegistryExample,
  WidgetRegistryIoContract,
  WidgetRegistryIoMode,
  WidgetRegistryRefreshPolicy,
  WidgetRegistryRuntimeContract,
  WidgetSettingsSchema,
  WidgetValueDescriptor,
  WidgetCanvasEditingMode,
  WidgetWorkspaceRuntimeMode,
} from "@/widgets/types";
import { appendWidgetAgentContextOutput } from "@/widgets/shared/agent-context";

const devAuthProxyPrefix = "/__command_center_auth__";

// Bump when the JSON manifest contract changes in a backend-visible way.
export const WIDGET_REGISTRY_VERSION = "2026-04-26-connection-query-companions";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface SyncedWidgetTypePayload {
  widgetId: string;
  title: string;
  description: string;
  widgetVersion: string;
  category: string;
  kind: WidgetDefinition["kind"];
  source: string;
  tags: string[];
  requiredPermissions: string[];
  schema: JsonValue;
  io: JsonValue;
  defaultSize: JsonValue;
  defaultPresentation: JsonValue;
  responsive: JsonValue;
  usageGuidance: JsonValue;
  capabilities: JsonValue;
  examples: JsonValue;
  organizationConfigurationSchema: JsonValue;
  defaultOrganizationConfiguration: JsonValue;
  organizationConfigurationVersion: number | null;
  isActive: boolean;
}

export interface WidgetTypeSyncPayload {
  registryVersion: string;
  checksum: string;
  widgets: SyncedWidgetTypePayload[];
}

export interface WidgetTypeSyncValidationIssue {
  widgetId: string;
  section: string;
  message: string;
}

export interface WidgetTypeSyncDraft {
  payload: WidgetTypeSyncPayload;
  validationIssues: WidgetTypeSyncValidationIssue[];
}

export interface WidgetTypeSyncResponse {
  status: "noop" | "synced";
  registryVersion?: string;
  checksum?: string;
  lastSyncedAt?: string;
  created?: number;
  updated?: number;
  deactivated?: number;
  total?: number;
}

class WidgetTypeSyncError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "WidgetTypeSyncError";
    this.status = status;
    this.payload = payload;
  }
}

const inFlightSyncs = new Map<string, Promise<WidgetTypeSyncResponse>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function buildEndpointUrl(path: string) {
  const url = new URL(path, env.apiBaseUrl);

  if (import.meta.env.DEV && isLoopbackHostname(url.hostname)) {
    return `${devAuthProxyPrefix}${url.pathname}${url.search}`;
  }

  return url.toString();
}

function toJsonValue(value: unknown): JsonValue {
  const serialized = JSON.stringify(value, (_key, candidate) => {
    if (candidate === undefined) {
      return undefined;
    }

    if (
      typeof candidate === "function" ||
      typeof candidate === "symbol" ||
      typeof candidate === "bigint"
    ) {
      return undefined;
    }

    return candidate;
  });

  return serialized ? (JSON.parse(serialized) as JsonValue) : {};
}

function stableNormalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => stableNormalizeJson(entry));
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonValue>>((result, key) => {
        result[key] = stableNormalizeJson(value[key] as JsonValue);
        return result;
      }, {});
  }

  return value;
}

function stableStringifyJson(value: JsonValue) {
  return JSON.stringify(stableNormalizeJson(value));
}

async function sha256Hex(value: string) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function projectValueDescriptor(descriptor: WidgetValueDescriptor | undefined): JsonValue {
  return descriptor ? toJsonValue(descriptor) : {};
}

function projectInputEffects(effects: WidgetInputEffect[] | undefined): JsonValue {
  if (!effects?.length) {
    return [];
  }

  return toJsonValue(
    effects.map((effect) => ({
      kind: effect.kind,
      sourcePath: effect.sourcePath,
      target: effect.target,
      description: effect.description,
    })),
  );
}

function compactStringList(values: Array<string | null | undefined> | undefined) {
  if (!values?.length) {
    return [];
  }

  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function uniqueContractIds(values: Array<WidgetContractId | undefined>) {
  return [...new Set(values.filter((value): value is WidgetContractId => Boolean(value?.trim())))];
}

function projectSchemaFieldDescriptors(
  schema: WidgetSettingsSchema | undefined,
): WidgetRegistryConfigurationFieldDescriptor[] {
  if (!schema?.fields.length) {
    return [];
  }

  return schema.fields.map((field) => ({
    id: field.id,
    label: field.label,
    type: "custom",
    description: field.description,
    sectionId: field.sectionId,
    source: "schema",
  }));
}

function deriveConfigurationMode(widget: WidgetDefinition): WidgetRegistryConfigurationMode {
  if (widget.registryContract?.configuration?.mode) {
    return widget.registryContract.configuration.mode;
  }

  if (widget.schema && widget.settingsComponent) {
    return "hybrid";
  }

  if (widget.schema) {
    return "static-schema";
  }

  if (widget.settingsComponent) {
    return "custom-settings";
  }

  return "none";
}

function deriveWorkspaceRuntimeMode(widget: WidgetDefinition): WidgetWorkspaceRuntimeMode {
  if (widget.workspaceRuntimeMode) {
    return widget.workspaceRuntimeMode;
  }

  if (widget.execution) {
    return "execution-owner";
  }

  return "local-ui";
}

function deriveCanvasEditingMode(widget: WidgetDefinition): WidgetCanvasEditingMode {
  if (widget.canvasEditing?.mode === "inline") {
    return "inline";
  }

  return "none";
}

function deriveIoMode(
  widget: WidgetDefinition,
  explicitMode: WidgetRegistryIoMode | undefined,
): WidgetRegistryIoMode {
  if (explicitMode) {
    return explicitMode;
  }

  const hasDynamicIo = typeof widget.resolveIo === "function";
  const effectiveIo = appendWidgetAgentContextOutput(widget, widget.io);
  const hasStaticIo = Boolean(effectiveIo?.inputs?.length || effectiveIo?.outputs?.length);
  const runtimeMode = deriveWorkspaceRuntimeMode(widget);

  if (runtimeMode === "consumer") {
    return "consumer";
  }

  if (hasDynamicIo) {
    return "dynamic";
  }

  if (hasStaticIo) {
    return "static";
  }

  return "none";
}

function deriveDefaultExecutionTriggers(widget: WidgetDefinition): WidgetExecutionReason[] {
  const runtimeMode = deriveWorkspaceRuntimeMode(widget);

  if (runtimeMode === "execution-owner") {
    return ["dashboard-refresh", "manual-recalculate"];
  }

  return [];
}

function deriveDefaultRefreshPolicy(widget: WidgetDefinition): WidgetRegistryRefreshPolicy {
  return widget.execution ? "allow-refresh" : "not-applicable";
}

function resolveConfigurationContract(
  widget: WidgetDefinition,
): WidgetRegistryConfigurationContract {
  const explicit = widget.registryContract?.configuration;
  const mode = deriveConfigurationMode(widget);
  const schemaSections = widget.schema?.sections ?? [];
  const schemaFields = projectSchemaFieldDescriptors(widget.schema);

  return {
    mode,
    summary:
      explicit?.summary ??
      (mode === "none"
        ? "This widget does not expose user-editable configuration."
        : mode === "custom-settings"
          ? "This widget is configured through a custom settings surface instead of only static schema fields."
          : mode === "hybrid"
            ? "This widget combines shared schema-driven controls with custom settings workflows."
            : "This widget is configured through shared schema-driven settings fields."),
    sections: explicit?.sections ?? schemaSections,
    fields: explicit?.fields ?? schemaFields,
    dynamicConfigSummary: explicit?.dynamicConfigSummary,
    configurationNotes: compactStringList(explicit?.configurationNotes),
    requiredSetupSteps: compactStringList(explicit?.requiredSetupSteps),
  };
}

function resolveRuntimeContract(widget: WidgetDefinition): WidgetRegistryRuntimeContract {
  const explicit = widget.registryContract?.runtime;
  const workspaceRuntimeMode = deriveWorkspaceRuntimeMode(widget);
  const canvasEditingMode = deriveCanvasEditingMode(widget);
  const supportsExecution = Boolean(widget.execution);

  return {
    workspaceRuntimeMode,
    canvasEditingMode,
    supportsExecution,
    refreshPolicy: explicit?.refreshPolicy ?? deriveDefaultRefreshPolicy(widget),
    executionTriggers:
      explicit?.executionTriggers ?? deriveDefaultExecutionTriggers(widget),
    executionSummary:
      explicit?.executionSummary ??
      (supportsExecution
        ? "This widget can execute work and publish runtime outputs."
        : workspaceRuntimeMode === "consumer"
          ? "This widget renders upstream published outputs and does not execute work itself."
          : "This widget is local UI and does not participate in shared execution."),
    notes: compactStringList(explicit?.notes),
  };
}

function resolveIoContract(widget: WidgetDefinition): WidgetRegistryIoContract {
  const explicit = widget.registryContract?.io;
  const effectiveIo = appendWidgetAgentContextOutput(widget, widget.io);
  const inputs = effectiveIo?.inputs ?? [];
  const outputs = effectiveIo?.outputs ?? [];
  const hasEffectiveIo = Boolean(inputs.length || outputs.length);
  const explicitMode =
    explicit?.mode === "none" && hasEffectiveIo ? undefined : explicit?.mode;
  const mode = deriveIoMode(widget, explicitMode);
  const explicitSummary =
    explicit?.mode === "none" && hasEffectiveIo ? undefined : explicit?.summary;
  const explicitDynamicIoSummary =
    explicit?.mode === "none" && hasEffectiveIo ? undefined : explicit?.dynamicIoSummary;
  const explicitInputContracts =
    explicit?.mode === "none" && hasEffectiveIo ? undefined : explicit?.inputContracts;
  const explicitOutputContracts =
    explicit?.mode === "none" && hasEffectiveIo ? undefined : explicit?.outputContracts;
  const explicitIoNotes =
    explicit?.mode === "none" && hasEffectiveIo ? undefined : explicit?.ioNotes;

  return {
    mode,
    summary:
      explicitSummary ??
      (mode === "none"
        ? "This widget does not participate in typed widget IO."
        : mode === "consumer"
          ? "This widget consumes upstream typed outputs and does not publish a new canonical runtime contract."
          : mode === "dynamic"
            ? "This widget exposes instance-derived ports whose exact shape depends on saved configuration."
            : "This widget exposes stable typed input and output ports."),
    dynamicIoSummary:
      explicitDynamicIoSummary ??
      (mode === "dynamic"
        ? "Concrete ports depend on saved widget configuration and are resolved per instance."
        : undefined),
    inputContracts:
      explicitInputContracts ??
      uniqueContractIds(inputs.flatMap((input) => input.accepts)),
    outputContracts:
      explicitOutputContracts ??
      uniqueContractIds(outputs.map((output) => output.contract)),
    ioNotes: compactStringList(explicitIoNotes),
  };
}

function resolveUsageGuidance(widget: WidgetDefinition): WidgetRegistryUsageGuidance {
  return widget.registryContract?.usageGuidance ?? {
    buildPurpose: widget.description,
    whenToUse: [`Use when you need ${widget.title.toLowerCase()} behavior.`],
    whenNotToUse: ["Do not use when a more specific widget type already matches the use case."],
    authoringSteps: ["Add the widget to a workspace and configure its saved props in settings."],
    blockingRequirements: [],
    commonPitfalls: [],
  };
}

function resolveExamples(widget: WidgetDefinition): WidgetRegistryExample[] {
  const explicitExamples = widget.registryContract?.examples;

  if (explicitExamples?.length) {
    return explicitExamples;
  }

  if (widget.exampleProps) {
    return [{
      label: "Default example",
      summary: "Example props shipped with the widget definition.",
      props: widget.exampleProps,
    }];
  }

  return [];
}

function resolveWidgetSchemaPayload(widget: WidgetDefinition): JsonValue {
  const configuration = resolveConfigurationContract(widget);
  const runtime = resolveRuntimeContract(widget);

  return toJsonValue({
    contractVersion: 1,
    configuration,
    runtime,
  });
}

function projectWidgetIo(
  io: WidgetIoDefinition | undefined,
  hasDynamicIo: boolean,
  contract: WidgetRegistryIoContract,
): JsonValue {
  const inputs = io?.inputs ?? [];
  const outputs = io?.outputs ?? [];

  return toJsonValue({
    mode: contract.mode,
    summary: contract.summary,
    dynamic: hasDynamicIo || undefined,
    dynamicIoSummary: contract.dynamicIoSummary,
    inputContracts: contract.inputContracts ?? [],
    outputContracts: contract.outputContracts ?? [],
    ioNotes: contract.ioNotes ?? [],
    inputs: inputs.map((input) => ({
        id: input.id,
        label: input.label,
        description: input.description,
        accepts: input.accepts,
        required: input.required,
        cardinality: input.cardinality,
        effects: projectInputEffects(input.effects),
      })),
    outputs: outputs.map((output) => ({
        id: output.id,
        label: output.label,
        description: output.description,
        contract: output.contract,
        valueDescriptor: projectValueDescriptor(output.valueDescriptor),
      })),
  });
}

function projectDefaultPresentation(
  defaultPresentation: WidgetInstancePresentation | undefined,
): JsonValue {
  return defaultPresentation ? toJsonValue(defaultPresentation) : {};
}

function projectDefaultSize(widget: WidgetDefinition): JsonValue {
  return toJsonValue(widget.defaultSize);
}

function projectResponsive(widget: WidgetDefinition): JsonValue {
  return widget.responsive ? toJsonValue(widget.responsive) : null;
}

function projectUsageGuidance(widget: WidgetDefinition): JsonValue {
  return toJsonValue(resolveUsageGuidance(widget));
}

function projectCapabilities(widget: WidgetDefinition): JsonValue {
  return toJsonValue(widget.registryContract?.capabilities ?? {});
}

function projectExamples(widget: WidgetDefinition): JsonValue {
  return toJsonValue(resolveExamples(widget));
}

function projectOrganizationConfigurationSchema(
  widget: WidgetDefinition,
): JsonValue {
  return widget.organizationConfiguration?.schema
    ? toJsonValue(widget.organizationConfiguration.schema)
    : null;
}

function projectDefaultOrganizationConfiguration(
  widget: WidgetDefinition,
): JsonValue {
  return widget.organizationConfiguration?.defaultConfig
    ? toJsonValue(widget.organizationConfiguration.defaultConfig)
    : null;
}

function validateWidgetType(widget: WidgetDefinition): WidgetTypeSyncValidationIssue[] {
  const issues: WidgetTypeSyncValidationIssue[] = [];
  const configuration = resolveConfigurationContract(widget);
  const runtime = resolveRuntimeContract(widget);
  const io = resolveIoContract(widget);
  const usageGuidance = resolveUsageGuidance(widget);

  if (!widget.widgetVersion.trim()) {
    issues.push({
      widgetId: widget.id,
      section: "identity",
      message: "widgetVersion is required.",
    });
  }

  if (!configuration.summary.trim()) {
    issues.push({
      widgetId: widget.id,
      section: "configuration",
      message: "Configuration summary is required.",
    });
  }

  if (!runtime.executionSummary.trim()) {
    issues.push({
      widgetId: widget.id,
      section: "runtime",
      message: "Execution summary is required.",
    });
  }

  if (!io.summary.trim()) {
    issues.push({
      widgetId: widget.id,
      section: "io",
      message: "IO summary is required.",
    });
  }

  if (io.mode === "dynamic" && !io.dynamicIoSummary?.trim()) {
    issues.push({
      widgetId: widget.id,
      section: "io",
      message: "Dynamic IO widgets must explain how their ports are derived.",
    });
  }

  if (!usageGuidance.buildPurpose.trim()) {
    issues.push({
      widgetId: widget.id,
      section: "usage_guidance",
      message: "buildPurpose is required.",
    });
  }

  if ((usageGuidance.whenToUse?.length ?? 0) === 0) {
    issues.push({
      widgetId: widget.id,
      section: "usage_guidance",
      message: "At least one whenToUse hint is required.",
    });
  }

  if ((usageGuidance.whenNotToUse?.length ?? 0) === 0) {
    issues.push({
      widgetId: widget.id,
      section: "usage_guidance",
      message: "At least one whenNotToUse hint is required.",
    });
  }

  if ((usageGuidance.authoringSteps?.length ?? 0) === 0) {
    issues.push({
      widgetId: widget.id,
      section: "usage_guidance",
      message: "At least one authoring step is required.",
    });
  }

  if (widget.organizationConfiguration) {
    if (!Number.isInteger(widget.organizationConfiguration.version) || widget.organizationConfiguration.version < 1) {
      issues.push({
        widgetId: widget.id,
        section: "organizationConfiguration",
        message: "organizationConfiguration.version must be an integer greater than 0.",
      });
    }

    if (!isRecord(widget.organizationConfiguration.schema)) {
      issues.push({
        widgetId: widget.id,
        section: "organizationConfiguration",
        message: "organizationConfiguration.schema must be a JSON object.",
      });
    }

    if (
      widget.organizationConfiguration.defaultConfig !== undefined &&
      !isRecord(widget.organizationConfiguration.defaultConfig)
    ) {
      issues.push({
        widgetId: widget.id,
        section: "organizationConfiguration",
        message: "organizationConfiguration.defaultConfig must be a JSON object when provided.",
      });
    }
  }

  return issues;
}

function formatValidationIssues(issues: WidgetTypeSyncValidationIssue[]) {
  return issues
    .map((issue) => `${issue.widgetId} (${issue.section}): ${issue.message}`)
    .join(" | ");
}

function projectWidgetType(widget: WidgetDefinition): SyncedWidgetTypePayload {
  const ioContract = resolveIoContract(widget);
  const effectiveIo = appendWidgetAgentContextOutput(widget, widget.io);

  return {
    widgetId: widget.id,
    title: widget.title,
    description: widget.description,
    widgetVersion: widget.widgetVersion,
    category: widget.category,
    kind: widget.kind,
    source: widget.source,
    tags: widget.tags ?? [],
    requiredPermissions: widget.requiredPermissions ?? [],
    schema: resolveWidgetSchemaPayload(widget),
    io: projectWidgetIo(effectiveIo, typeof widget.resolveIo === "function", ioContract),
    defaultSize: projectDefaultSize(widget),
    defaultPresentation: projectDefaultPresentation(widget.defaultPresentation),
    responsive: projectResponsive(widget),
    usageGuidance: projectUsageGuidance(widget),
    capabilities: projectCapabilities(widget),
    examples: projectExamples(widget),
    organizationConfigurationSchema: projectOrganizationConfigurationSchema(widget),
    defaultOrganizationConfiguration: projectDefaultOrganizationConfiguration(widget),
    organizationConfigurationVersion: widget.organizationConfiguration?.version ?? null,
    isActive: true,
  };
}

export async function buildWidgetTypeSyncDraft(): Promise<WidgetTypeSyncDraft> {
  const validationIssues = [...appRegistry.widgets]
    .flatMap((widget) => validateWidgetType(widget))
    .sort((left, right) =>
      left.widgetId === right.widgetId
        ? left.section.localeCompare(right.section)
        : left.widgetId.localeCompare(right.widgetId),
    );
  const widgets = [...appRegistry.widgets]
    .map((widget) => projectWidgetType(widget))
    .sort((left, right) => left.widgetId.localeCompare(right.widgetId));

  const registryBody = {
    registryVersion: WIDGET_REGISTRY_VERSION,
    widgets,
  } satisfies Omit<WidgetTypeSyncPayload, "checksum">;
  const checksum = `sha256:${await sha256Hex(
    stableStringifyJson(registryBody as unknown as JsonValue),
  )}`;

  return {
    payload: {
      ...registryBody,
      checksum,
    },
    validationIssues,
  };
}

export async function buildWidgetTypeSyncPayload(): Promise<WidgetTypeSyncPayload> {
  const draft = await buildWidgetTypeSyncDraft();

  if (draft.validationIssues.length > 0) {
    throw new Error(
      `Widget registry manifest is invalid. ${formatValidationIssues(draft.validationIssues)}`,
    );
  }

  return draft.payload;
}

async function readResponsePayload(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.trim() ? text : null;
}

function readErrorMessage(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (!isRecord(payload)) {
    return "";
  }

  const messages: string[] = [];

  function appendMessage(rawMessage: string, path: string[]) {
    const message = rawMessage.trim();

    if (!message) {
      return;
    }

    if (path.length === 0) {
      messages.push(message);
      return;
    }

    messages.push(`${path.join(".")}: ${message}`);
  }

  function visit(value: unknown, path: string[]) {
    if (typeof value === "string") {
      appendMessage(value, path);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        const nextPath =
          typeof entry === "string" && path.length > 0 ? path : [...path, String(index)];
        visit(entry, nextPath);
      });
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    Object.entries(value).forEach(([key, entry]) => {
      visit(entry, [...path, key]);
    });
  }

  Object.entries(payload).forEach(([key, value]) => {
    if (key === "detail" && typeof value === "string") {
      return;
    }

    visit(value, [key]);
  });

  if (messages.length > 0) {
    return messages.join(" | ");
  }

  const detail = payload.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  return "";
}

async function requestWidgetTypeSync(
  payload: WidgetTypeSyncPayload,
): Promise<WidgetTypeSyncResponse> {
  const syncPath = commandCenterConfig.widgetTypes.syncUrl.trim();

  if (!syncPath) {
    throw new Error("Command Center widget-type sync endpoint is not configured.");
  }

  const requestUrl = buildEndpointUrl(syncPath);

  async function sendRequest() {
    const session = useAuthStore.getState().session;

    if (!session?.token) {
      throw new Error("You need to be signed in before the widget registry can sync.");
    }

    return fetch(requestUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `${session.tokenType ?? "Bearer"} ${session.token}`,
      },
      body: JSON.stringify(payload),
    });
  }

  let response = await sendRequest();

  if (response.status === 401) {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      response = await sendRequest();
    }
  }

  const responsePayload = await readResponsePayload(response);

  if (!response.ok) {
    throw new WidgetTypeSyncError(
      response.status,
      responsePayload,
      readErrorMessage(responsePayload) || `Widget registry sync failed with ${response.status}.`,
    );
  }

  return (responsePayload ?? { status: "noop" }) as WidgetTypeSyncResponse;
}

export async function syncWidgetTypes(
  payload?: WidgetTypeSyncPayload,
) {
  if (env.useMockData) {
    return { status: "noop" } satisfies WidgetTypeSyncResponse;
  }

  const session = useAuthStore.getState().session;

  if (!session?.token || !session.user.id) {
    throw new Error("You need to be signed in before the widget registry can sync.");
  }

  const effectivePayload = payload ?? await buildWidgetTypeSyncPayload();
  const syncMarker = `${effectivePayload.registryVersion}:${effectivePayload.checksum}`;
  const inFlightKey = `${session.user.id}:${syncMarker}`;
  const existingPromise = inFlightSyncs.get(inFlightKey);

  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = requestWidgetTypeSync(effectivePayload)
    .finally(() => {
      inFlightSyncs.delete(inFlightKey);
    });

  inFlightSyncs.set(inFlightKey, nextPromise);
  return nextPromise;
}
