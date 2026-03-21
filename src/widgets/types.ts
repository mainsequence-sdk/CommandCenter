import type { ComponentType } from "react";

export type WidgetKind = "kpi" | "chart" | "table" | "feed" | "custom";

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

export interface WidgetSettingsComponentProps<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  widget: WidgetDefinition<TProps>;
  draftProps: TProps;
  onDraftPropsChange: (props: TProps) => void;
  instanceTitle: string;
  onInstanceTitleChange: (title: string) => void;
  editable: boolean;
}
