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
  component: ComponentType<WidgetComponentProps<TProps>>;
}

export interface WidgetComponentProps<TProps extends Record<string, unknown> = Record<string, unknown>> {
  widget: WidgetDefinition<TProps>;
  props: TProps;
  instanceTitle?: string;
}
