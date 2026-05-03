import { getWidgetById } from "@/app/registry";
import type {
  DashboardDefinition,
  DashboardDefinitionType,
  DashboardWidgetInstance,
} from "@/dashboards/types";
import { PUBLIC_WORKSPACE_RENDER_PERMISSIONS } from "./public-workspace-permissions";
import { normalizeDashboardDefinitionType } from "./workspace-definition-type";
const PUBLIC_WORKSPACE_BASELINE_PERMISSION_SET = new Set<string>(
  PUBLIC_WORKSPACE_RENDER_PERMISSIONS,
);

export interface PublicWorkspaceReadinessIssue {
  id: string;
  severity: "error";
  title: string;
  description: string;
  widgetId?: string;
  instanceId?: string;
}

export interface PublicWorkspaceReadinessReport {
  workspaceType: DashboardDefinitionType;
  allowed: boolean;
  checkedWidgetCount: number;
  issues: PublicWorkspaceReadinessIssue[];
}

function collectDashboardWidgets(
  widgets: readonly DashboardWidgetInstance[],
  collected: DashboardWidgetInstance[] = [],
): DashboardWidgetInstance[] {
  widgets.forEach((widget) => {
    collected.push(widget);

    if (widget.row?.children?.length) {
      collectDashboardWidgets(widget.row.children, collected);
    }
  });

  return collected;
}

function uniquePermissions(permissions: readonly string[] | undefined) {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return Array.from(
    new Set(
      permissions.filter((permission): permission is string => typeof permission === "string" && permission.trim().length > 0),
    ),
  );
}

function findDisallowedPermissions(permissions: readonly string[] | undefined) {
  return uniquePermissions(permissions).filter(
    (permission) => !PUBLIC_WORKSPACE_BASELINE_PERMISSION_SET.has(permission),
  );
}

function resolveWidgetLabel(
  instance: DashboardWidgetInstance,
  instanceTitleById: Map<string, string>,
) {
  return (
    instance.title?.trim() ||
    instanceTitleById.get(instance.id) ||
    instance.widgetId
  );
}

export function assessWorkspacePublicReadiness(
  dashboard: Pick<
    DashboardDefinition,
    "type" | "labels" | "requiredPermissions" | "widgets"
  >,
): PublicWorkspaceReadinessReport {
  const workspaceType = normalizeDashboardDefinitionType(dashboard.type, dashboard.labels);
  const widgets = collectDashboardWidgets(dashboard.widgets);
  const instanceTitleById = new Map(
    widgets.map((widget) => [widget.id, widget.title?.trim() || widget.widgetId] as const),
  );
  const issues: PublicWorkspaceReadinessIssue[] = [];

  if (workspaceType !== "workspace" && workspaceType !== "slide-studio") {
    issues.push({
      id: `workspace-type:${workspaceType}`,
      severity: "error",
      title: "Unsupported workspace type",
      description: `Public view supports only workspace and slide-studio workspaces. This workspace is "${workspaceType}".`,
    });
  }

  const disallowedWorkspacePermissions = findDisallowedPermissions(dashboard.requiredPermissions);

  if (disallowedWorkspacePermissions.length > 0) {
    issues.push({
      id: "workspace-permissions",
      severity: "error",
      title: "Workspace requires private permissions",
      description: `Workspace-level permissions exceed the public baseline: ${disallowedWorkspacePermissions.join(", ")}.`,
    });
  }

  widgets.forEach((instance) => {
    const widget = getWidgetById(instance.widgetId);
    const widgetLabel = resolveWidgetLabel(instance, instanceTitleById);

    if (!widget) {
      issues.push({
        id: `unknown-widget:${instance.id}`,
        severity: "error",
        title: "Unknown widget type",
        description: `Widget "${widgetLabel}" uses unregistered widget type "${instance.widgetId}", so its public safety cannot be validated.`,
        widgetId: instance.widgetId,
        instanceId: instance.id,
      });
      return;
    }

    const disallowedPermissions = Array.from(
      new Set([
        ...findDisallowedPermissions(widget.requiredPermissions),
        ...findDisallowedPermissions(instance.requiredPermissions),
      ]),
    );

    if (disallowedPermissions.length > 0) {
      issues.push({
        id: `widget-permissions:${instance.id}`,
        severity: "error",
        title: "Widget requires non-public permissions",
        description: `Widget "${widgetLabel}" requires permissions outside the public baseline: ${disallowedPermissions.join(", ")}.`,
        widgetId: widget.id,
        instanceId: instance.id,
      });
    }

  });

  return {
    workspaceType,
    allowed: issues.length === 0,
    checkedWidgetCount: widgets.length,
    issues,
  };
}
