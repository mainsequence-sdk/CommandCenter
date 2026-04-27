import { createElement, type ComponentType } from "react";

import { getConnectionTypeById } from "@/app/registry";
import { ConnectionTypeIcon } from "@/connections/components/ConnectionTypeIcon";
import { cn } from "@/lib/utils";
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
  props?: Record<string, unknown>;
  workspaceIcon?: ComponentType<{ className?: string }>;
  railIcon?: ComponentType<{ className?: string }>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveConnectionQueryTypeIcon(
  props: Record<string, unknown> | undefined,
): ComponentType<{ className?: string }> | null {
  if (!isPlainRecord(props)) {
    return null;
  }

  const connectionRef = props.connectionRef;

  if (!isPlainRecord(connectionRef)) {
    return null;
  }

  const typeId =
    typeof connectionRef.typeId === "string" ? connectionRef.typeId.trim() : "";

  if (!typeId) {
    return null;
  }

  const connectionType = getConnectionTypeById(typeId);

  if (!connectionType) {
    return null;
  }

  return function WorkspaceConnectionTypeBadgeIcon({ className }: { className?: string }) {
    return createElement(ConnectionTypeIcon, {
      title: connectionType.title,
      iconUrl: connectionType.iconUrl,
      className: cn(
        "border-0 bg-transparent p-0 text-[8px]",
        className,
      ),
    });
  };
}

export function resolveWorkspaceWidgetIcon({
  id,
  title,
  kind,
  props,
  workspaceIcon,
  railIcon,
}: WorkspaceWidgetIconDescriptor): ComponentType<{ className?: string }> {
  if (id === "connection-query") {
    const connectionTypeIcon = resolveConnectionQueryTypeIcon(props);

    if (connectionTypeIcon) {
      return connectionTypeIcon;
    }
  }

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
