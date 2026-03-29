import type {
  DashboardCompanionLayoutItem,
  ResolvedDashboardWidgetInstance,
  ResolvedDashboardWidgetLayout,
} from "@/dashboards/types";
import { resolveWidgetFieldState } from "@/widgets/shared/widget-schema";
import type {
  WidgetDefinition,
  WidgetFieldDefinition,
  WidgetInstancePresentation,
} from "@/widgets/types";

const DEFAULT_COMPANION_GRID_WIDTH = 4;
const DEFAULT_COMPANION_GRID_HEIGHT = 2;
const WIDE_COMPANION_GRID_WIDTH = 6;
const TALL_COMPANION_GRID_HEIGHT = 3;

export interface ResolvedDashboardWidgetEntry {
  instance: ResolvedDashboardWidgetInstance;
  widget: WidgetDefinition;
}

export interface DashboardCanvasCompanionCandidate {
  itemId: string;
  instanceId: string;
  fieldId: string;
  field: WidgetFieldDefinition<Record<string, unknown>, unknown>;
  fieldIndex: number;
  title: string;
  layout: ResolvedDashboardWidgetLayout;
  ownerLayout: ResolvedDashboardWidgetLayout;
  props: Record<string, unknown>;
  presentation?: WidgetInstancePresentation;
  runtimeState?: Record<string, unknown>;
  widget: WidgetDefinition;
}

export function resolveDashboardCompanionLayoutMap(
  companions: readonly DashboardCompanionLayoutItem[] | undefined,
) {
  return new Map(
    (companions ?? []).map((item) => [
      item.id,
      {
        x: item.layout.x,
        y: item.layout.y,
        w: item.layout.w,
        h: item.layout.h,
      } satisfies ResolvedDashboardWidgetLayout,
    ] as const),
  );
}

export function resolveDashboardCompanionMap(
  companions: readonly DashboardCompanionLayoutItem[] | undefined,
) {
  return new Map((companions ?? []).map((item) => [item.id, item] as const));
}

export function buildCompanionItemId(instanceId: string, fieldId: string) {
  return `widget-companion:${instanceId}:${fieldId}`;
}

export function parseCompanionItemId(itemId: string) {
  if (!itemId.startsWith("widget-companion:")) {
    return null;
  }

  const [, instanceId, fieldId] = itemId.split(":");

  if (!instanceId || !fieldId) {
    return null;
  }

  return {
    instanceId,
    fieldId,
  };
}

export function resolveCompanionGridLayout(
  ownerLayout: ResolvedDashboardWidgetLayout,
  field: Pick<WidgetFieldDefinition, "pop">,
  fieldState: ReturnType<typeof resolveWidgetFieldState>,
  columns: number,
  storedLayout?: ResolvedDashboardWidgetLayout,
): ResolvedDashboardWidgetLayout {
  if (storedLayout) {
    return {
      x: Math.max(0, Math.min(storedLayout.x, Math.max(0, columns - storedLayout.w))),
      y: Math.max(0, storedLayout.y),
      w: Math.max(1, Math.min(storedLayout.w, columns)),
      h: Math.max(1, storedLayout.h),
    };
  }

  if (
    typeof fieldState.gridX === "number" &&
    typeof fieldState.gridY === "number" &&
    typeof fieldState.gridW === "number" &&
    typeof fieldState.gridH === "number"
  ) {
    return {
      x: Math.max(0, Math.min(fieldState.gridX, Math.max(0, columns - fieldState.gridW))),
      y: Math.max(0, fieldState.gridY),
      w: Math.max(1, Math.min(fieldState.gridW, columns)),
      h: Math.max(1, fieldState.gridH),
    };
  }

  const compactDefaultWidth =
    field.pop?.mode === "token-list" || field.pop?.mode === "panel"
      ? WIDE_COMPANION_GRID_WIDTH
      : DEFAULT_COMPANION_GRID_WIDTH;
  const compactDefaultHeight =
    field.pop?.mode === "token-list" || field.pop?.mode === "panel"
      ? TALL_COMPANION_GRID_HEIGHT
      : DEFAULT_COMPANION_GRID_HEIGHT;
  const widthUnits = compactDefaultWidth;
  const heightUnits = compactDefaultHeight;

  switch (fieldState.anchor) {
    case "bottom":
      return {
        x: ownerLayout.x,
        y: ownerLayout.y + ownerLayout.h,
        w: Math.min(widthUnits, columns),
        h: heightUnits,
      };
    case "left":
      return {
        x: Math.max(0, ownerLayout.x - widthUnits),
        y: ownerLayout.y,
        w: Math.min(widthUnits, columns),
        h: heightUnits,
      };
    case "right":
      return {
        x: Math.min(Math.max(0, columns - widthUnits), ownerLayout.x + ownerLayout.w),
        y: ownerLayout.y,
        w: Math.min(widthUnits, columns),
        h: heightUnits,
      };
    case "top":
    default:
      return {
        x: ownerLayout.x,
        y: Math.max(0, ownerLayout.y - heightUnits),
        w: Math.min(widthUnits, columns),
        h: heightUnits,
      };
  }
}

export function resolveDashboardCanvasCompanionCandidates(
  widgetEntries: readonly ResolvedDashboardWidgetEntry[],
  options: {
    columns: number;
    layoutOverrideById?: ReadonlyMap<string, ResolvedDashboardWidgetLayout>;
    storedCompanionLayoutById?: ReadonlyMap<string, ResolvedDashboardWidgetLayout>;
    storedCompanionById?: ReadonlyMap<string, DashboardCompanionLayoutItem>;
  },
): DashboardCanvasCompanionCandidate[] {
  return widgetEntries.flatMap(({ instance, widget }) => {
    if (!widget.schema?.fields?.length) {
      return [];
    }

    const ownerLayout = options.layoutOverrideById?.get(instance.id) ?? instance.layout;

    return widget.schema.fields.flatMap((field, fieldIndex) => {
      if (!field.pop?.canPop || !field.renderCanvas) {
        return [];
      }

      const fieldState = resolveWidgetFieldState(instance.presentation, field, fieldIndex);
      const itemId = buildCompanionItemId(instance.id, field.id);
      if (!fieldState.visible) {
        return [];
      }

      const layout = resolveCompanionGridLayout(
        ownerLayout,
        field,
        fieldState,
        options.columns,
        options.storedCompanionLayoutById?.get(itemId),
      );

      return [
        {
          itemId,
          instanceId: instance.id,
          fieldId: field.id,
          field,
          fieldIndex,
          title: instance.title ?? widget.title,
          layout,
          ownerLayout,
          props: (instance.props ?? {}) as Record<string, unknown>,
          presentation: instance.presentation,
          runtimeState: instance.runtimeState,
          widget,
        },
      ] satisfies DashboardCanvasCompanionCandidate[];
    });
  });
}
