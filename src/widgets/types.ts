import type { ComponentType } from "react";

export type WidgetKind = "kpi" | "chart" | "table" | "feed" | "custom";
export type WidgetFieldAnchor = "top" | "right" | "bottom" | "left";
export type WidgetFieldPopMode = "inline" | "chip-group" | "token-list" | "panel";
export const DEFAULT_WIDGET_SIZE = { w: 8, h: 6 } as const;

export interface WidgetExposedFieldState {
  visible: boolean;
  anchor: WidgetFieldAnchor;
  order: number;
  mode?: WidgetFieldPopMode;
  collapsed?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  gridX?: number;
  gridY?: number;
  gridW?: number;
  gridH?: number;
}

export interface WidgetInstancePresentation {
  exposedFields?: Record<string, WidgetExposedFieldState>;
  surfaceMode?: "default" | "transparent";
  placementMode?: "canvas" | "sidebar";
}

export interface WidgetRailSummaryComponentProps<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  title: string;
  instanceId?: string;
  props: TProps;
  presentation?: WidgetInstancePresentation;
  runtimeState?: Record<string, unknown>;
}

export interface WidgetFieldSection {
  id: string;
  title: string;
  description?: string;
}

export interface WidgetFieldPopConfig {
  canPop: boolean;
  defaultPopped?: boolean;
  anchor?: WidgetFieldAnchor;
  mode?: WidgetFieldPopMode;
  title?: string;
  defaultWidth?: number;
  defaultHeight?: number;
}

export type WidgetContractId = `${string}@v${number}`;

export interface WidgetPrimitiveValueDescriptor {
  kind: "primitive";
  contract: WidgetContractId;
  primitive: "string" | "number" | "integer" | "boolean" | "null";
  format?: string;
  description?: string;
}

export interface WidgetObjectValueFieldDescriptor {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
  value: WidgetValueDescriptor;
}

export interface WidgetObjectValueDescriptor {
  kind: "object";
  contract: WidgetContractId;
  description?: string;
  fields: WidgetObjectValueFieldDescriptor[];
}

export interface WidgetArrayValueDescriptor {
  kind: "array";
  contract: WidgetContractId;
  description?: string;
  items?: WidgetValueDescriptor;
}

export interface WidgetUnknownValueDescriptor {
  kind: "unknown";
  contract: WidgetContractId;
  description?: string;
}

export type WidgetValueDescriptor =
  | WidgetPrimitiveValueDescriptor
  | WidgetObjectValueDescriptor
  | WidgetArrayValueDescriptor
  | WidgetUnknownValueDescriptor;

export type WidgetSelectArrayItemMode = "first" | "last" | "index";

export interface WidgetSelectArrayItemTransformStep {
  id: "select-array-item";
  mode?: WidgetSelectArrayItemMode;
  index?: number;
}

export interface WidgetExtractPathTransformStep {
  id: "extract-path";
  path?: string[];
  contractId?: WidgetContractId;
}

export type WidgetBindingTransformStep =
  | WidgetSelectArrayItemTransformStep
  | WidgetExtractPathTransformStep;

export interface WidgetPortBinding {
  sourceWidgetId: string;
  sourceOutputId: string;
  transformSteps?: WidgetBindingTransformStep[];
  transformId?: string;
  transformPath?: string[];
  transformContractId?: WidgetContractId;
}

export type WidgetPortBindingValue = WidgetPortBinding | WidgetPortBinding[];
export type WidgetInstanceBindings = Record<string, WidgetPortBindingValue>;

export interface WidgetInputEffect {
  kind:
    | "drives-options"
    | "drives-default"
    | "drives-value"
    | "drives-validation"
    | "drives-render";
  sourcePath: string;
  target:
    | { kind: "schema-field"; id: string }
    | { kind: "generated-field"; id: string }
    | { kind: "prop"; path: string }
    | { kind: "render"; id: string };
  description?: string;
}

export interface WidgetIoResolverArgs<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  widgetId: string;
  instanceId?: string;
  props: TProps;
  runtimeState?: Record<string, unknown>;
}

export interface WidgetInputPortDefinition<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  label: string;
  accepts: WidgetContractId[];
  description?: string;
  required?: boolean;
  cardinality?: "one" | "many";
  effects?: WidgetInputEffect[];
}

export interface WidgetOutputResolverArgs<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  widgetId: string;
  instanceId?: string;
  instanceTitle?: string;
  props: TProps;
  presentation?: WidgetInstancePresentation;
  runtimeState?: Record<string, unknown>;
  resolvedInputs?: ResolvedWidgetInputs;
}

export interface WidgetOutputPortDefinition<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  label: string;
  contract: WidgetContractId;
  description?: string;
  valueDescriptor?: WidgetValueDescriptor;
  resolveValue?: (args: WidgetOutputResolverArgs<TProps>) => unknown;
}

export interface WidgetIoDefinition<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  inputs?: WidgetInputPortDefinition<TProps>[];
  outputs?: WidgetOutputPortDefinition<TProps>[];
}

export type WidgetInputResolutionStatus =
  | "valid"
  | "unbound"
  | "missing-source"
  | "missing-output"
  | "contract-mismatch"
  | "self-reference-blocked"
  | "transform-invalid";

export interface ResolvedWidgetInput {
  inputId: string;
  label: string;
  status: WidgetInputResolutionStatus;
  sourceWidgetId?: string;
  sourceOutputId?: string;
  contractId?: WidgetContractId;
  binding?: WidgetPortBinding;
  value?: unknown;
  valueDescriptor?: WidgetValueDescriptor;
  effects?: WidgetInputEffect[];
}

export type ResolvedWidgetInputs = Record<
  string,
  ResolvedWidgetInput | ResolvedWidgetInput[] | undefined
>;

export type WidgetExecutionReason =
  | "manual-submit"
  | "settings-test"
  | "dashboard-refresh"
  | "manual-recalculate"
  | "upstream-update";

export interface WidgetExecutionDashboardState {
  timeRangeKey: string;
  rangeStartMs: number;
  rangeEndMs: number;
  refreshIntervalMs: number | null;
}

export type WidgetAgentSnapshotDisplayKind =
  | "table"
  | "chart"
  | "form"
  | "note"
  | "filter"
  | "graph"
  | "custom";

export type WidgetAgentSnapshotState =
  | "ready"
  | "loading"
  | "empty"
  | "error"
  | "idle";

export interface WidgetAgentSnapshot {
  displayKind: WidgetAgentSnapshotDisplayKind;
  state: WidgetAgentSnapshotState;
  summary: string;
  data?: Record<string, unknown>;
}

export interface WidgetAgentContextValue {
  contractVersion: "v1";
  widgetId: string;
  instanceId: string;
  title: string;
  snapshot: WidgetAgentSnapshot;
}

export interface WidgetAgentSnapshotContext<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  widgetId: string;
  instanceId: string;
  title: string;
  snapshotProfile: "evidence" | "full-data";
  props: TProps;
  presentation?: WidgetInstancePresentation;
  runtimeState?: Record<string, unknown>;
  resolvedInputs?: ResolvedWidgetInputs;
  dashboardState?: WidgetExecutionDashboardState;
  domTextContent?: string;
}

export interface WidgetExecutionTargetOverrides<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  props?: TProps;
  runtimeState?: Record<string, unknown>;
  draftValues?: Record<string, string>;
}

export interface WidgetExecutionContext<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  scopeId?: string;
  widgetId: string;
  instanceId: string;
  reason: WidgetExecutionReason;
  props: TProps;
  runtimeState?: Record<string, unknown>;
  resolvedInputs?: ResolvedWidgetInputs;
  dashboardState?: WidgetExecutionDashboardState;
  targetOverrides?: WidgetExecutionTargetOverrides<TProps>;
  refreshCycleId?: string;
  signal?: AbortSignal;
}

export interface WidgetExecutionResult {
  status: "success" | "error" | "skipped";
  runtimeStatePatch?: Record<string, unknown>;
  error?: string;
}

export type WidgetExecutionRefreshPolicy = "manual-only" | "allow-refresh";
export type WidgetWorkspaceRuntimeMode =
  | "execution-owner"
  | "consumer"
  | "local-ui";
export type WidgetCanvasEditingMode = "none" | "inline";
export type WidgetRegistryConfigurationMode =
  | "none"
  | "static-schema"
  | "custom-settings"
  | "hybrid";
export type WidgetRegistryIoMode =
  | "none"
  | "static"
  | "dynamic"
  | "consumer";
export type WidgetRegistryRefreshPolicy =
  | WidgetExecutionRefreshPolicy
  | "not-applicable";
export type WidgetRegistryConfigurationFieldSource =
  | "schema"
  | "custom-settings"
  | "runtime-derived";

export interface WidgetRegistryConfigurationFieldDescriptor {
  id: string;
  label: string;
  type: string;
  description?: string;
  sectionId?: string;
  required?: boolean;
  source?: WidgetRegistryConfigurationFieldSource;
}

export interface WidgetRegistryConfigurationContract {
  mode: WidgetRegistryConfigurationMode;
  summary: string;
  sections?: WidgetFieldSection[];
  fields?: WidgetRegistryConfigurationFieldDescriptor[];
  dynamicConfigSummary?: string;
  configurationNotes?: string[];
  requiredSetupSteps?: string[];
}

export interface WidgetRegistryRuntimeContract {
  workspaceRuntimeMode: WidgetWorkspaceRuntimeMode;
  canvasEditingMode: WidgetCanvasEditingMode;
  supportsExecution: boolean;
  refreshPolicy: WidgetRegistryRefreshPolicy;
  executionTriggers: WidgetExecutionReason[];
  executionSummary: string;
  notes?: string[];
}

export interface WidgetRegistryIoContract {
  mode: WidgetRegistryIoMode;
  summary: string;
  dynamicIoSummary?: string;
  inputContracts?: WidgetContractId[];
  outputContracts?: WidgetContractId[];
  ioNotes?: string[];
}

export interface WidgetRegistryUsageGuidance {
  buildPurpose: string;
  whenToUse: string[];
  whenNotToUse: string[];
  authoringSteps: string[];
  blockingRequirements?: string[];
  commonPitfalls?: string[];
}

export interface WidgetRegistryExample {
  label: string;
  summary: string;
  props?: Record<string, unknown>;
  notes?: string[];
}

export interface WidgetOrganizationConfigurationContract {
  version: number;
  schema: Record<string, unknown>;
  defaultConfig?: Record<string, unknown>;
}

export interface WidgetRegistryContractInput {
  configuration?: Partial<WidgetRegistryConfigurationContract>;
  runtime?: Partial<
    Omit<
      WidgetRegistryRuntimeContract,
      "workspaceRuntimeMode" | "canvasEditingMode" | "supportsExecution"
    >
  >;
  io?: Partial<WidgetRegistryIoContract>;
  capabilities?: Record<string, unknown>;
  usageGuidance: WidgetRegistryUsageGuidance;
  examples?: WidgetRegistryExample[];
}

export interface WidgetExecutionDefinition<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  canExecute?: (context: WidgetExecutionContext<TProps>) => boolean;
  execute: (context: WidgetExecutionContext<TProps>) => Promise<WidgetExecutionResult>;
  getRefreshPolicy?: (
    context: WidgetExecutionContext<TProps>,
  ) => WidgetExecutionRefreshPolicy;
  getExecutionKey?: (context: WidgetExecutionContext<TProps>) => string;
}

export interface WidgetControllerArgs<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  props: TProps;
  runtimeState?: Record<string, unknown>;
  instanceId?: string;
  resolvedInputs?: ResolvedWidgetInputs;
  mode: "settings" | "canvas" | "render" | "preview";
}

export interface WidgetController<
  TProps extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown,
> {
  normalizeProps?: (props: TProps) => TProps;
  useContext?: (args: WidgetControllerArgs<TProps>) => TContext;
}

export interface WidgetFieldVisibilityContext<
  TProps extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown,
> {
  widget: WidgetDefinition<TProps>;
  props: TProps;
  editable: boolean;
  context: TContext;
}

export interface WidgetFieldSettingsRendererProps<
  TProps extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown,
> {
  field: WidgetFieldDefinition<TProps, TContext>;
  widget: WidgetDefinition<TProps>;
  draftProps: TProps;
  onDraftPropsChange: (props: TProps) => void;
  draftPresentation: WidgetInstancePresentation;
  onDraftPresentationChange: (presentation: WidgetInstancePresentation) => void;
  editable: boolean;
  context: TContext;
}

export interface WidgetFieldCanvasRendererProps<
  TProps extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown,
> {
  field: WidgetFieldDefinition<TProps, TContext>;
  widget: WidgetDefinition<TProps>;
  props: TProps;
  onPropsChange: (props: TProps) => void;
  fieldState: WidgetExposedFieldState;
  runtimeState?: Record<string, unknown>;
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  editable: boolean;
  context: TContext;
}

export interface WidgetFieldDefinition<
  TProps extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown,
> {
  id: string;
  label: string;
  description?: string;
  sectionId: string;
  settingsColumnSpan?: 1 | 2;
  category?: string;
  tags?: string[];
  pop?: WidgetFieldPopConfig;
  isVisible?: (context: WidgetFieldVisibilityContext<TProps, TContext>) => boolean;
  renderSettings?: ComponentType<WidgetFieldSettingsRendererProps<TProps, TContext>>;
  renderCanvas?: ComponentType<WidgetFieldCanvasRendererProps<TProps, TContext>>;
}

export interface WidgetSettingsSchema<
  TProps extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown,
> {
  sections: WidgetFieldSection[];
  fields: WidgetFieldDefinition<TProps, TContext>[];
}

export interface WidgetDefinition<TProps extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  widgetVersion: string;
  title: string;
  description: string;
  category: string;
  kind: WidgetKind;
  source: string;
  defaultSize: {
    w: number;
    h: number;
  };
  responsive?: {
    minWidthPx?: number;
  };
  requiredPermissions?: string[];
  tags?: string[];
  exampleProps?: TProps;
  mockProps?: TProps;
  mockTitle?: string;
  mockPresentation?: WidgetInstancePresentation;
  mockResolvedInputs?: ResolvedWidgetInputs;
  mockRuntimeState?: Record<string, unknown>;
  defaultPresentation?: WidgetInstancePresentation;
  fixedPlacementMode?: WidgetInstancePresentation["placementMode"];
  bodyMode?: "default" | "none";
  schema?: WidgetSettingsSchema<TProps, any>;
  controller?: WidgetController<TProps, any>;
  headerComponent?: ComponentType<WidgetHeaderComponentProps<TProps>>;
  headerActions?: ComponentType<WidgetHeaderActionsProps<TProps>>;
  settingsComponent?: ComponentType<WidgetSettingsComponentProps<TProps>>;
  showRawPropsEditor?: boolean;
  io?: WidgetIoDefinition<TProps>;
  resolveIo?: (args: WidgetIoResolverArgs<TProps>) => WidgetIoDefinition<TProps> | undefined;
  execution?: WidgetExecutionDefinition<TProps>;
  workspaceRuntimeMode?: WidgetWorkspaceRuntimeMode;
  canvasEditing?: {
    mode?: WidgetCanvasEditingMode;
  };
  registryContract?: WidgetRegistryContractInput;
  organizationConfiguration?: WidgetOrganizationConfigurationContract;
  workspaceIcon?: ComponentType<{ className?: string }>;
  railIcon?: ComponentType<{ className?: string }>;
  railSummaryComponent?: ComponentType<WidgetRailSummaryComponentProps<TProps>>;
  buildAgentSnapshot?: (
    context: WidgetAgentSnapshotContext<TProps>,
  ) => WidgetAgentSnapshot | Promise<WidgetAgentSnapshot>;
  component: ComponentType<WidgetComponentProps<TProps>>;
}

export type WidgetDefinitionInput<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> = Omit<WidgetDefinition<TProps>, "defaultSize"> & {
  defaultSize?: WidgetDefinition<TProps>["defaultSize"];
};

export function defineWidget<TProps extends Record<string, unknown> = Record<string, unknown>>(
  definition: WidgetDefinitionInput<TProps>,
): WidgetDefinition<TProps> {
  return {
    ...definition,
    defaultSize: definition.defaultSize ?? { ...DEFAULT_WIDGET_SIZE },
  };
}

export interface WidgetComponentProps<TProps extends Record<string, unknown> = Record<string, unknown>> {
  widget: WidgetDefinition<TProps>;
  instanceId?: string;
  props: TProps;
  instanceTitle?: string;
  editable?: boolean;
  presentation?: WidgetInstancePresentation;
  runtimeState?: Record<string, unknown>;
  resolvedInputs?: ResolvedWidgetInputs;
  onPropsChange?: (props: TProps) => void;
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
}

export interface WidgetHeaderActionsProps<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  widget: WidgetDefinition<TProps>;
  props: TProps;
  runtimeState?: Record<string, unknown>;
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
}

export interface WidgetHeaderComponentProps<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  widget: WidgetDefinition<TProps>;
  props: TProps;
  instanceTitle?: string;
  runtimeState?: Record<string, unknown>;
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
}

export interface WidgetSettingsComponentProps<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  widget: WidgetDefinition<TProps>;
  instanceId: string;
  draftProps: TProps;
  onDraftPropsChange: (props: TProps) => void;
  draftPresentation: WidgetInstancePresentation;
  onDraftPresentationChange: (presentation: WidgetInstancePresentation) => void;
  resolvedInputs?: ResolvedWidgetInputs;
  controllerContext?: unknown;
  instanceTitle: string;
  onInstanceTitleChange: (title: string) => void;
  editable: boolean;
}
