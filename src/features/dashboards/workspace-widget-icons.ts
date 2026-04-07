import type { ComponentType } from "react";

import {
  BarChart3,
  Boxes,
  Clock3,
  Database,
  Rows3,
  Table,
} from "lucide-react";

import { isWorkspaceRowWidgetId } from "@/dashboards/structural-widgets";

export interface WorkspaceWidgetIconDescriptor {
  id: string;
  title?: string;
  kind?: string;
  workspaceIcon?: ComponentType<{ className?: string }>;
  railIcon?: ComponentType<{ className?: string }>;
}

export function resolveWorkspaceWidgetIcon({
  id,
  title,
  kind,
  workspaceIcon,
  railIcon,
}: WorkspaceWidgetIconDescriptor): ComponentType<{ className?: string }> {
  if (workspaceIcon) {
    return workspaceIcon;
  }

  if (railIcon) {
    return railIcon;
  }

  if (isWorkspaceRowWidgetId(id)) {
    return Rows3;
  }

  if (/data-node/i.test(id) || /data node/i.test(title ?? "")) {
    return Database;
  }

  if (kind === "chart") {
    return BarChart3;
  }

  if (kind === "table") {
    return Table;
  }

  if (kind === "feed") {
    return Clock3;
  }

  return Boxes;
}
