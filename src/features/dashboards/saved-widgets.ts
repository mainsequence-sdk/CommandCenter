import { buildCompanionItemId } from "@/dashboards/canvas-items";
import { resolveDashboardLayout } from "@/dashboards/layout";
import {
  getExpandedWorkspaceRowChildren,
  isWorkspaceRowCollapsed,
  isWorkspaceRowWidgetId,
} from "@/dashboards/structural-widgets";
import type {
  DashboardCompanionLayoutItem,
  DashboardDefinition,
  DashboardWidgetInstance,
  DashboardWidgetPlacement,
  DashboardWidgetRowState,
} from "@/dashboards/types";
import { normalizeWidgetInstanceBindings } from "@/dashboards/widget-dependencies";
import type {
  WidgetPortBinding,
} from "@/widgets/types";
import { materializeDashboardLayout } from "./custom-dashboard-storage";
import type {
  SavedWidgetGroupBindingPayload,
  SavedWidgetGroupBindingMutationPayload,
  SavedWidgetGroupMemberWidgetSnapshotPayload,
  SavedWidgetGroupMutationPayload,
  SavedWidgetGroupRecord,
  SavedWidgetInstanceMutationPayload,
  SavedWidgetInstanceRecord,
} from "./saved-widgets-api";

function cloneJson<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) {
    return `${prefix}-${uuid}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "widget";
}

function buildInstanceIdPrefix(
  widget: Pick<DashboardWidgetInstance, "title" | "widgetId"> | Pick<SavedWidgetInstanceRecord, "instanceTitle" | "widgetTypeId" | "title">,
) {
  if ("instanceTitle" in widget) {
    return slugify(widget.instanceTitle || widget.title || widget.widgetTypeId);
  }

  return slugify(widget.title || widget.widgetId);
}

function getWidgetLayout(layout: DashboardWidgetInstance["layout"] | SavedWidgetInstanceRecord["layout"]) {
  const cols = "cols" in layout ? layout.cols : layout.w;
  const rows = "rows" in layout ? layout.rows : layout.h;

  return {
    cols: Math.max(1, Math.round(cols)),
    rows: Math.max(1, Math.round(rows)),
  };
}

function flattenWidgetTree(widget: DashboardWidgetInstance): DashboardWidgetInstance[] {
  return [
    widget,
    ...(widget.row?.children?.flatMap((child) => flattenWidgetTree(child)) ?? []),
  ];
}

function flattenDashboardWidgets(widgets: readonly DashboardWidgetInstance[]) {
  const flat: DashboardWidgetInstance[] = [];

  widgets.forEach((widget) => {
    flat.push(widget);

    if (isWorkspaceRowWidgetId(widget.widgetId) && isWorkspaceRowCollapsed(widget)) {
      (widget.row?.children ?? []).forEach((child) => {
        flat.push(...flattenWidgetTree(child));
      });
    }
  });

  return flat;
}

function createWidgetIndex(dashboard: DashboardDefinition) {
  return new Map(
    flattenDashboardWidgets(dashboard.widgets).map((widget) => [widget.id, widget] as const),
  );
}

function getWidgetCompanions(
  dashboard: DashboardDefinition,
  instanceId: string,
): DashboardCompanionLayoutItem[] {
  return (dashboard.companions ?? [])
    .filter((item) => item.instanceId === instanceId)
    .map((item) => ({
      id: buildCompanionItemId(item.instanceId, item.fieldId),
      instanceId: item.instanceId,
      fieldId: item.fieldId,
      layout: {
        x: item.layout.x,
        y: item.layout.y,
        w: item.layout.w,
        h: item.layout.h,
      },
    }));
}

function getStructuralSelectionIds(
  dashboard: DashboardDefinition,
  instanceId: string,
  widgetIndex: ReadonlyMap<string, DashboardWidgetInstance>,
) {
  const selected = widgetIndex.get(instanceId);

  if (!selected) {
    return [];
  }

  if (!isWorkspaceRowWidgetId(selected.widgetId)) {
    return [selected.id];
  }

  const topLevelIndex = dashboard.widgets.findIndex((widget) => widget.id === instanceId);

  if (topLevelIndex < 0) {
    return flattenWidgetTree(selected).map((widget) => widget.id);
  }

  const childWidgets = isWorkspaceRowCollapsed(selected)
    ? selected.row?.children ?? []
    : getExpandedWorkspaceRowChildren(dashboard.widgets, topLevelIndex);

  return [
    selected.id,
    ...childWidgets.flatMap((child) => flattenWidgetTree(child).map((entry) => entry.id)),
  ];
}

function iterateBindingEntries(bindings: DashboardWidgetInstance["bindings"]) {
  const normalized = normalizeWidgetInstanceBindings(bindings);

  if (!normalized) {
    return [] as Array<{
      inputId: string;
      binding: WidgetPortBinding;
    }>;
  }

  return Object.entries(normalized).flatMap(([inputId, value]) => {
    const bindingsForInput = Array.isArray(value) ? value : [value];

    return bindingsForInput.map((binding) => ({
      inputId,
      binding,
    }));
  });
}

function hasDirectBindings(
  widgetIds: readonly string[],
  widgetIndex: ReadonlyMap<string, DashboardWidgetInstance>,
) {
  return widgetIds.some((widgetId) => {
    const widget = widgetIndex.get(widgetId);
    return widget ? iterateBindingEntries(widget.bindings).length > 0 : false;
  });
}

function collectRequiredWidgetIds(
  dashboard: DashboardDefinition,
  seedIds: readonly string[],
  widgetIndex: ReadonlyMap<string, DashboardWidgetInstance>,
) {
  const upstreamByTarget = new Map<string, Set<string>>();

  flattenDashboardWidgets(dashboard.widgets).forEach((widget) => {
    iterateBindingEntries(widget.bindings).forEach(({ binding }) => {
      if (!widgetIndex.has(binding.sourceWidgetId)) {
        return;
      }

      upstreamByTarget.set(widget.id, upstreamByTarget.get(widget.id) ?? new Set());
      upstreamByTarget.get(widget.id)?.add(binding.sourceWidgetId);
    });
  });

  const visited = new Set<string>();
  const queue = [...seedIds];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || visited.has(current) || !widgetIndex.has(current)) {
      continue;
    }

    visited.add(current);
    upstreamByTarget.get(current)?.forEach((sourceId) => {
      if (!visited.has(sourceId)) {
        queue.push(sourceId);
      }
    });
  }

  return visited;
}

function createMemberKey(
  widget: DashboardWidgetInstance,
  usedKeys: Set<string>,
) {
  const base = slugify(widget.title || widget.widgetId);

  if (!usedKeys.has(base)) {
    usedKeys.add(base);
    return base;
  }

  let index = 2;
  let candidate = `${base}-${index}`;

  while (usedKeys.has(candidate)) {
    index += 1;
    candidate = `${base}-${index}`;
  }

  usedKeys.add(candidate);
  return candidate;
}

function toShallowRowState(
  widget: Pick<DashboardWidgetInstance, "row" | "widgetId">,
): DashboardWidgetRowState | undefined {
  if (!isWorkspaceRowWidgetId(widget.widgetId)) {
    return undefined;
  }

  return {
    collapsed: false,
    children: [],
  };
}

function buildAtomicSavedWidgetPayload(
  dashboard: DashboardDefinition,
  widget: DashboardWidgetInstance,
  metadata: {
    title: string;
    description?: string;
    labels?: string[];
  },
): SavedWidgetInstanceMutationPayload {
  return {
    title: metadata.title,
    description: metadata.description ?? "",
    labels: metadata.labels ?? [],
    category: dashboard.category ?? "Custom",
    source: dashboard.source ?? "user",
    schemaVersion: 1,
    widgetTypeId: widget.widgetId,
    instanceTitle: widget.title ?? "",
    props: cloneJson(widget.props ?? {}),
    presentation: cloneJson(widget.presentation),
    bindings: normalizeWidgetInstanceBindings(cloneJson(widget.bindings)),
    row: toShallowRowState(widget),
    layout: getWidgetLayout(widget.layout),
    position: cloneJson(widget.position),
    companions: getWidgetCompanions(dashboard, widget.id),
    requiredPermissions: cloneJson(widget.requiredPermissions ?? []),
  };
}

function buildGroupMemberPayload(
  dashboard: DashboardDefinition,
  widget: DashboardWidgetInstance,
): SavedWidgetGroupMemberWidgetSnapshotPayload {
  return {
    title: widget.title?.trim() || widget.widgetId,
    description: "",
    labels: [],
    category: dashboard.category ?? "Custom",
    source: dashboard.source ?? "user",
    schemaVersion: 1,
    widgetTypeId: widget.widgetId,
    instanceTitle: widget.title ?? "",
    props: cloneJson(widget.props ?? {}),
    presentation: cloneJson(widget.presentation),
    row: toShallowRowState(widget),
    layout: getWidgetLayout(widget.layout),
    position: cloneJson(widget.position),
    companions: getWidgetCompanions(dashboard, widget.id),
    requiredPermissions: cloneJson(widget.requiredPermissions ?? []),
  };
}

function toGroupBindingPayload(
  binding: WidgetPortBinding,
): SavedWidgetGroupBindingPayload {
  return {
    sourceOutputId: binding.sourceOutputId,
    transformId: binding.transformId,
    transformPath: binding.transformPath,
    transformContractId: binding.transformContractId,
  };
}

function buildCanonicalGroupBindings(
  widgets: readonly DashboardWidgetInstance[],
  memberKeyById: ReadonlyMap<string, string>,
): SavedWidgetGroupBindingMutationPayload[] {
  const includedIds = new Set(widgets.map((widget) => widget.id));

  return widgets.flatMap((targetWidget) =>
    iterateBindingEntries(targetWidget.bindings).flatMap(({ inputId, binding }) => {
      if (!includedIds.has(binding.sourceWidgetId)) {
        return [];
      }

      const sourceMemberKey = memberKeyById.get(binding.sourceWidgetId);
      const targetMemberKey = memberKeyById.get(targetWidget.id);

      if (!sourceMemberKey || !targetMemberKey) {
        return [];
      }

      return [{
        sourceMemberKey,
        targetMemberKey,
        inputId,
        bindingPayload: toGroupBindingPayload(binding),
      } satisfies SavedWidgetGroupBindingMutationPayload];
    }),
  );
}

function getDashboardBottomY(dashboard: DashboardDefinition) {
  const resolved = resolveDashboardLayout(dashboard);

  return resolved.widgets.reduce(
    (bottomY, widget) => Math.max(bottomY, widget.layout.y + widget.layout.h),
    0,
  );
}

function remapCompanionLayouts(
  companions: readonly DashboardCompanionLayoutItem[],
  nextInstanceId: string,
  deltaY: number,
) {
  return companions.map((item) => ({
    id: buildCompanionItemId(nextInstanceId, item.fieldId),
    instanceId: nextInstanceId,
    fieldId: item.fieldId,
    layout: {
      x: item.layout.x,
      y: item.layout.y + deltaY,
      w: item.layout.w,
      h: item.layout.h,
    },
  }));
}

function buildImportedWidgetInstance(
  savedWidget: SavedWidgetInstanceRecord,
  instanceId: string,
  deltaY: number,
): DashboardWidgetInstance {
  const nextPosition: DashboardWidgetPlacement | undefined = savedWidget.position
    ? {
        x: savedWidget.position.x,
        y:
          typeof savedWidget.position.y === "number"
            ? savedWidget.position.y + deltaY
            : savedWidget.position.y,
      }
    : {
        x: isWorkspaceRowWidgetId(savedWidget.widgetTypeId) ? 0 : 0,
        y: deltaY,
      };

  return {
    id: instanceId,
    widgetId: savedWidget.widgetTypeId,
    title: savedWidget.instanceTitle || savedWidget.title || undefined,
    props: cloneJson(savedWidget.props ?? {}),
    presentation: cloneJson(savedWidget.presentation),
    bindings: normalizeWidgetInstanceBindings(cloneJson(savedWidget.bindings)),
    row: savedWidget.row
      ? toShallowRowState({
          widgetId: savedWidget.widgetTypeId,
          row: savedWidget.row,
        })
      : undefined,
    layout: getWidgetLayout(savedWidget.layout),
    position: nextPosition,
    requiredPermissions: cloneJson(savedWidget.requiredPermissions ?? []),
  };
}

function buildCanonicalImportedBindings(
  savedGroup: SavedWidgetGroupRecord,
  memberKeyToInstanceId: ReadonlyMap<string, string>,
) {
  const byTarget = new Map<string, Map<string, WidgetPortBinding[]>>();

  savedGroup.bindings.forEach((bindingRecord) => {
    const sourceWidgetId = memberKeyToInstanceId.get(bindingRecord.sourceMemberKey);
    const targetWidgetId = memberKeyToInstanceId.get(bindingRecord.targetMemberKey);

    if (!sourceWidgetId || !targetWidgetId) {
      return;
    }

    const entry = bindingRecord.bindingPayload;

    const normalizedBindings = entry?.sourceOutputId
      ? [{
          sourceWidgetId,
          sourceOutputId: entry.sourceOutputId,
          transformId: entry.transformId,
          transformPath: entry.transformPath,
          transformContractId: entry.transformContractId,
        } satisfies WidgetPortBinding]
      : [];

    if (!normalizedBindings.length) {
      return;
    }

    const byInput = byTarget.get(targetWidgetId) ?? new Map<string, WidgetPortBinding[]>();
    const currentBindings = byInput.get(bindingRecord.inputId) ?? [];
    byInput.set(bindingRecord.inputId, [...currentBindings, ...normalizedBindings]);
    byTarget.set(targetWidgetId, byInput);
  });

  return byTarget;
}

function buildLegacyImportedBindings(
  members: ReadonlyArray<SavedWidgetGroupRecord["members"][number]>,
  memberKeyToInstanceId: ReadonlyMap<string, string>,
) {
  const byTarget = new Map<string, Map<string, WidgetPortBinding[]>>();
  const sourceIdToMemberKey = new Map(
    members.map((member) => [member.widgetInstance.id, member.memberKey] as const),
  );

  members.forEach((member) => {
    const targetWidgetId = memberKeyToInstanceId.get(member.memberKey);
    const bindings = normalizeWidgetInstanceBindings(member.widgetInstance.bindings);

    if (!targetWidgetId || !bindings) {
      return;
    }

    const byInput = byTarget.get(targetWidgetId) ?? new Map<string, WidgetPortBinding[]>();

    Object.entries(bindings).forEach(([inputId, value]) => {
      const bindingEntries = Array.isArray(value) ? value : [value];
      const remappedBindings = bindingEntries.flatMap((binding) => {
        const sourceMemberKey = sourceIdToMemberKey.get(binding.sourceWidgetId);
        const sourceWidgetId = sourceMemberKey
          ? memberKeyToInstanceId.get(sourceMemberKey)
          : undefined;

        if (!sourceWidgetId) {
          return [];
        }

        return [{
          sourceWidgetId,
          sourceOutputId: binding.sourceOutputId,
          transformId: binding.transformId,
          transformPath: binding.transformPath,
          transformContractId: binding.transformContractId,
        } satisfies WidgetPortBinding];
      });

      if (!remappedBindings.length) {
        return;
      }

      const currentBindings = byInput.get(inputId) ?? [];
      byInput.set(inputId, [...currentBindings, ...remappedBindings]);
    });

    if (byInput.size > 0) {
      byTarget.set(targetWidgetId, byInput);
    }
  });

  return byTarget;
}

function applyImportedBindings(
  widgets: readonly DashboardWidgetInstance[],
  importedBindings: ReadonlyMap<string, Map<string, WidgetPortBinding[]>>,
) {
  return widgets.map((widget) => {
    const byInput = importedBindings.get(widget.id);

    if (!byInput || byInput.size === 0) {
      return {
        ...widget,
        bindings: undefined,
      };
    }

    const bindings = Object.fromEntries(
      Array.from(byInput.entries()).map(([inputId, values]) => [
        inputId,
        values.length === 1 ? values[0] : values,
      ]),
    );

    return {
      ...widget,
      bindings: normalizeWidgetInstanceBindings(bindings),
    };
  });
}

function getSavedWidgetMinY(
  widgets: readonly SavedWidgetInstanceRecord[],
) {
  let minY = Number.POSITIVE_INFINITY;

  widgets.forEach((widget) => {
    if (typeof widget.position?.y === "number") {
      minY = Math.min(minY, widget.position.y);
    }

    widget.companions.forEach((item) => {
      minY = Math.min(minY, item.layout.y);
    });
  });

  return Number.isFinite(minY) ? minY : 0;
}

export interface SavedWidgetSelectionAnalysis {
  hasDependencies: boolean;
  hasStructuralChildren: boolean;
  requiresGroup: boolean;
  recommendedMode: "widget" | "group";
  groupWidgetIds: string[];
}

export function analyzeSavedWidgetSelection(
  dashboard: DashboardDefinition,
  instanceId: string,
): SavedWidgetSelectionAnalysis {
  const widgetIndex = createWidgetIndex(dashboard);
  const structuralIds = getStructuralSelectionIds(dashboard, instanceId, widgetIndex);
  const requiredIds = collectRequiredWidgetIds(dashboard, structuralIds, widgetIndex);
  const orderedIds = flattenDashboardWidgets(dashboard.widgets)
    .map((widget) => widget.id)
    .filter((id, index, allIds) => requiredIds.has(id) && allIds.indexOf(id) === index);
  const hasStructuralChildren = structuralIds.length > 1;
  const hasDependencies =
    hasDirectBindings(structuralIds, widgetIndex) ||
    orderedIds.some((id) => !structuralIds.includes(id));
  const requiresGroup = hasStructuralChildren || hasDependencies;

  return {
    hasDependencies,
    hasStructuralChildren,
    requiresGroup,
    recommendedMode: requiresGroup ? "group" : "widget",
    groupWidgetIds: orderedIds,
  };
}

export function buildSavedWidgetInstancePayloadFromDashboard(
  dashboard: DashboardDefinition,
  instanceId: string,
  metadata: {
    title: string;
    description?: string;
    labels?: string[];
  },
) {
  const widgetIndex = createWidgetIndex(dashboard);
  const widget = widgetIndex.get(instanceId);

  if (!widget) {
    return null;
  }

  const selection = analyzeSavedWidgetSelection(dashboard, instanceId);

  if (selection.requiresGroup) {
    return null;
  }

  return buildAtomicSavedWidgetPayload(dashboard, widget, metadata);
}

export function buildSavedWidgetGroupPayloadFromDashboard(
  dashboard: DashboardDefinition,
  instanceId: string,
  metadata: {
    title: string;
    description?: string;
    labels?: string[];
  },
) {
  const selection = analyzeSavedWidgetSelection(dashboard, instanceId);
  const includedIds = new Set(selection.groupWidgetIds);
  const orderedWidgets = flattenDashboardWidgets(dashboard.widgets).filter((widget, index, allWidgets) =>
    includedIds.has(widget.id) && allWidgets.findIndex((entry) => entry.id === widget.id) === index,
  );

  if (!orderedWidgets.length) {
    return null;
  }

  const usedMemberKeys = new Set<string>();
  const memberKeyById = new Map<string, string>();

  orderedWidgets.forEach((widget) => {
    memberKeyById.set(widget.id, createMemberKey(widget, usedMemberKeys));
  });

  return {
    title: metadata.title,
    description: metadata.description ?? "",
    labels: metadata.labels ?? [],
    category: dashboard.category ?? "Custom",
    source: dashboard.source ?? "user",
    schemaVersion: 1,
    requiredPermissions: cloneJson(dashboard.requiredPermissions ?? []),
    members: orderedWidgets.map((widget, index) => ({
      memberKey: memberKeyById.get(widget.id) ?? `widget-${index + 1}`,
      sortOrder: index,
      layoutOverride: undefined,
      widgetInstance: buildGroupMemberPayload(dashboard, widget),
    })),
    bindings: buildCanonicalGroupBindings(orderedWidgets, memberKeyById),
  } satisfies SavedWidgetGroupMutationPayload;
}

export function appendSavedWidgetInstanceToDashboard(
  dashboard: DashboardDefinition,
  savedWidget: SavedWidgetInstanceRecord,
) {
  const nextInstanceId = createId(buildInstanceIdPrefix(savedWidget));
  const bottomY = getDashboardBottomY(dashboard);
  const minY = getSavedWidgetMinY([savedWidget]);
  const deltaY = bottomY - minY;
  const importedWidget = buildImportedWidgetInstance(savedWidget, nextInstanceId, deltaY);
  const importedCompanions = remapCompanionLayouts(savedWidget.companions, nextInstanceId, deltaY);

  return materializeDashboardLayout({
    ...dashboard,
    companions: [...(dashboard.companions ?? []), ...importedCompanions],
    widgets: [...dashboard.widgets, importedWidget],
  });
}

export function appendSavedWidgetGroupToDashboard(
  dashboard: DashboardDefinition,
  savedGroup: SavedWidgetGroupRecord,
) {
  const bottomY = getDashboardBottomY(dashboard);
  const sourceWidgets = savedGroup.members.map((member) => member.widgetInstance);
  const minY = getSavedWidgetMinY(sourceWidgets);
  const deltaY = bottomY - minY;
  const memberKeyToInstanceId = new Map<string, string>();
  const importedCompanions: DashboardCompanionLayoutItem[] = [];

  const importedWidgets = savedGroup.members
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((member) => {
      const nextInstanceId = createId(buildInstanceIdPrefix(member.widgetInstance));
      memberKeyToInstanceId.set(member.memberKey, nextInstanceId);
      importedCompanions.push(
        ...remapCompanionLayouts(member.widgetInstance.companions, nextInstanceId, deltaY),
      );

      return buildImportedWidgetInstance(member.widgetInstance, nextInstanceId, deltaY);
    });

  const canonicalBindings = savedGroup.bindings.length > 0
    ? buildCanonicalImportedBindings(savedGroup, memberKeyToInstanceId)
    : buildLegacyImportedBindings(savedGroup.members, memberKeyToInstanceId);
  const widgetsWithBindings = applyImportedBindings(importedWidgets, canonicalBindings);

  return materializeDashboardLayout({
    ...dashboard,
    companions: [...(dashboard.companions ?? []), ...importedCompanions],
    widgets: [...dashboard.widgets, ...widgetsWithBindings],
  });
}
