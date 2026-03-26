import type { ComponentType } from "react";

export type WidgetKind = "kpi" | "chart" | "table" | "feed" | "custom";
export type WidgetFieldAnchor = "top" | "right" | "bottom" | "left";
export type WidgetFieldPopMode = "inline" | "chip-group" | "token-list" | "panel";

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
}

export interface WidgetInstancePresentation {
  exposedFields?: Record<string, WidgetExposedFieldState>;
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

export interface WidgetControllerArgs<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  props: TProps;
  runtimeState?: Record<string, unknown>;
  instanceId?: string;
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
  requiredPermissions?: string[];
  tags?: string[];
  exampleProps?: TProps;
  mockProps?: TProps;
  mockRuntimeState?: Record<string, unknown>;
  bodyMode?: "default" | "none";
  schema?: WidgetSettingsSchema<TProps, unknown>;
  controller?: WidgetController<TProps, unknown>;
  headerComponent?: ComponentType<WidgetHeaderComponentProps<TProps>>;
  headerActions?: ComponentType<WidgetHeaderActionsProps<TProps>>;
  settingsComponent?: ComponentType<WidgetSettingsComponentProps<TProps>>;
  component: ComponentType<WidgetComponentProps<TProps>>;
}

export interface WidgetComponentProps<TProps extends Record<string, unknown> = Record<string, unknown>> {
  widget: WidgetDefinition<TProps>;
  props: TProps;
  instanceTitle?: string;
  runtimeState?: Record<string, unknown>;
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
  controllerContext?: unknown;
  instanceTitle: string;
  onInstanceTitleChange: (title: string) => void;
  editable: boolean;
}
