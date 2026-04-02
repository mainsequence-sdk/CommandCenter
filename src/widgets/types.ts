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

export interface WidgetPortBinding {
  sourceWidgetId: string;
  sourceOutputId: string;
  transformId?: string;
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
    | { kind: "prop"; path: string }
    | { kind: "render"; id: string };
  description?: string;
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
  props: TProps;
  runtimeState?: Record<string, unknown>;
}

export interface WidgetOutputPortDefinition<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  label: string;
  contract: WidgetContractId;
  description?: string;
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
  | "self-reference-blocked";

export interface ResolvedWidgetInput {
  inputId: string;
  label: string;
  status: WidgetInputResolutionStatus;
  sourceWidgetId?: string;
  sourceOutputId?: string;
  contractId?: WidgetContractId;
  binding?: WidgetPortBinding;
  value?: unknown;
  effects?: WidgetInputEffect[];
}

export type ResolvedWidgetInputs = Record<
  string,
  ResolvedWidgetInput | ResolvedWidgetInput[] | undefined
>;

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
  mockRuntimeState?: Record<string, unknown>;
  defaultPresentation?: WidgetInstancePresentation;
  bodyMode?: "default" | "none";
  schema?: WidgetSettingsSchema<TProps, unknown>;
  controller?: WidgetController<TProps, unknown>;
  headerComponent?: ComponentType<WidgetHeaderComponentProps<TProps>>;
  headerActions?: ComponentType<WidgetHeaderActionsProps<TProps>>;
  settingsComponent?: ComponentType<WidgetSettingsComponentProps<TProps>>;
  showRawPropsEditor?: boolean;
  io?: WidgetIoDefinition<TProps>;
  railIcon?: ComponentType<{ className?: string }>;
  railSummaryComponent?: ComponentType<WidgetRailSummaryComponentProps<TProps>>;
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
  presentation?: WidgetInstancePresentation;
  runtimeState?: Record<string, unknown>;
  resolvedInputs?: ResolvedWidgetInputs;
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
