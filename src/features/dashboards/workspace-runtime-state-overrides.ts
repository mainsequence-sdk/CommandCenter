import type { DashboardDefinition, DashboardWidgetInstance } from "@/dashboards/types";

export type RuntimeWidgetStateOverrides = Record<string, Record<string, unknown> | null>;

export function runtimeStateEquals(left: unknown, right: unknown) {
  if (Object.is(left, right)) {
    return true;
  }

  try {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  } catch {
    return false;
  }
}

export function resolveRuntimeSelectionSignature(runtimeState: unknown) {
  const runtimeRecord =
    runtimeState && typeof runtimeState === "object"
      ? (runtimeState as Record<string, unknown>)
      : null;
  const interactionRecord =
    runtimeRecord?.interaction && typeof runtimeRecord.interaction === "object"
      ? (runtimeRecord.interaction as Record<string, unknown>)
      : null;

  if (
    !interactionRecord ||
    !Object.prototype.hasOwnProperty.call(interactionRecord, "selection")
  ) {
    return "";
  }

  try {
    return JSON.stringify(interactionRecord.selection ?? null);
  } catch {
    return String(interactionRecord.selection);
  }
}

export function applyRuntimeStateOverride<T extends DashboardWidgetInstance>(
  instance: T,
  overrides: RuntimeWidgetStateOverrides,
): T {
  let nextInstance: DashboardWidgetInstance = instance;

  if (Object.prototype.hasOwnProperty.call(overrides, instance.id)) {
    nextInstance = {
      ...instance,
      runtimeState: overrides[instance.id] ?? undefined,
    };
  }

  if (!nextInstance.row?.children?.length) {
    return nextInstance as T;
  }

  let childrenChanged = false;
  const nextChildren: DashboardWidgetInstance[] = nextInstance.row.children.map((child) => {
    const nextChild: DashboardWidgetInstance = applyRuntimeStateOverride(child, overrides);

    if (nextChild !== child) {
      childrenChanged = true;
    }

    return nextChild;
  });

  if (!childrenChanged) {
    return nextInstance as T;
  }

  return {
    ...nextInstance,
    row: {
      ...nextInstance.row,
      children: nextChildren,
    },
  } as T;
}

export function applyRuntimeStateOverridesToWidgets<T extends DashboardWidgetInstance>(
  widgets: T[],
  overrides: RuntimeWidgetStateOverrides,
) {
  if (Object.keys(overrides).length === 0) {
    return widgets;
  }

  return widgets.map((instance) => applyRuntimeStateOverride(instance, overrides));
}

export function applyRuntimeStateOverridesToDashboard<T extends DashboardDefinition>(
  dashboard: T,
  overrides: RuntimeWidgetStateOverrides,
): T {
  const widgets = applyRuntimeStateOverridesToWidgets(dashboard.widgets, overrides);

  if (widgets === dashboard.widgets) {
    return dashboard;
  }

  return {
    ...dashboard,
    widgets,
  };
}
