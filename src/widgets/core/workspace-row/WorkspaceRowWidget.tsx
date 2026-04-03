import type { WidgetComponentProps } from "@/widgets/types";

import { WorkspaceRowCard } from "./WorkspaceRowCard";

export interface WorkspaceRowWidgetProps extends Record<string, unknown> {
  color?: string;
}

type WorkspaceRowWidgetComponentProps = WidgetComponentProps<WorkspaceRowWidgetProps>;

export function WorkspaceRowWidget({
  instanceTitle,
  props,
}: WorkspaceRowWidgetComponentProps) {
  return (
    <WorkspaceRowCard
      title={instanceTitle ?? "Row"}
      accentColor={props.color}
    />
  );
}
