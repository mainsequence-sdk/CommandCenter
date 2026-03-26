import { useMemo } from "react";

import type {
  WidgetControllerArgs,
  WidgetDefinition,
  WidgetExposedFieldState,
  WidgetFieldDefinition,
  WidgetInstancePresentation,
} from "@/widgets/types";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getDefaultFieldCardWidth(field: Pick<WidgetFieldDefinition, "pop">) {
  return field.pop?.defaultWidth ?? 320;
}

function getDefaultFieldCardHeight(field: Pick<WidgetFieldDefinition, "pop">) {
  return field.pop?.defaultHeight ?? 120;
}

function getDefaultFieldOffsetX(
  field: Pick<WidgetFieldDefinition, "pop">,
  fieldIndex: number,
) {
  const anchor = field.pop?.anchor ?? "top";

  if (anchor === "left" || anchor === "right") {
    return 0;
  }

  return fieldIndex * (getDefaultFieldCardWidth(field) + 12);
}

function getDefaultFieldOffsetY(
  field: Pick<WidgetFieldDefinition, "pop">,
  fieldIndex: number,
) {
  const anchor = field.pop?.anchor ?? "top";

  if (anchor === "top" || anchor === "bottom") {
    return 0;
  }

  return fieldIndex * (getDefaultFieldCardHeight(field) + 12);
}

export function normalizeWidgetPresentation(
  value?: WidgetInstancePresentation | null,
): WidgetInstancePresentation {
  const cloned = value ? cloneJson(value) : {};

  return {
    ...cloned,
    exposedFields: cloned.exposedFields,
    surfaceMode: cloned.surfaceMode === "transparent" ? "transparent" : "default",
    placementMode: cloned.placementMode === "sidebar" ? "sidebar" : "canvas",
  };
}

export function resolveDefaultWidgetPresentation(
  widget: Pick<WidgetDefinition, "schema">,
): WidgetInstancePresentation {
  const fields = widget.schema?.fields ?? [];
  const exposedFields = Object.fromEntries(
    fields.flatMap((field, index) => {
      if (!field.pop?.canPop || field.pop.defaultPopped !== true) {
        return [];
      }

      return [[
        field.id,
        {
          visible: true,
          anchor: field.pop.anchor ?? "top",
          order: index,
          mode: field.pop.mode,
        } satisfies WidgetExposedFieldState,
      ] as const];
    }),
  );

  return Object.keys(exposedFields).length > 0 ? { exposedFields } : {};
}

export function resolveWidgetFieldState(
  presentation: WidgetInstancePresentation | undefined,
  field: Pick<WidgetFieldDefinition, "id" | "pop">,
  fieldIndex = 0,
): WidgetExposedFieldState {
  const current = presentation?.exposedFields?.[field.id];

  return {
    visible: current?.visible ?? field.pop?.defaultPopped ?? false,
    anchor: current?.anchor ?? field.pop?.anchor ?? "top",
    order: current?.order ?? fieldIndex,
    mode: current?.mode ?? field.pop?.mode,
    collapsed: current?.collapsed ?? false,
    x: current?.x ?? getDefaultFieldOffsetX(field, fieldIndex),
    y: current?.y ?? getDefaultFieldOffsetY(field, fieldIndex),
    width: current?.width ?? getDefaultFieldCardWidth(field),
    height: current?.height ?? getDefaultFieldCardHeight(field),
  };
}

export function updateWidgetFieldState(
  presentation: WidgetInstancePresentation | undefined,
  field: Pick<WidgetFieldDefinition, "id" | "pop">,
  patch: Partial<WidgetExposedFieldState>,
  fieldIndex = 0,
): WidgetInstancePresentation {
  const current = normalizeWidgetPresentation(presentation);
  const nextState = resolveWidgetFieldState(current, field, fieldIndex);

  return {
    ...current,
    exposedFields: {
      ...(current.exposedFields ?? {}),
      [field.id]: {
        ...nextState,
        ...patch,
      },
    },
  };
}

export function updateWidgetFieldExposure(
  presentation: WidgetInstancePresentation | undefined,
  field: Pick<WidgetFieldDefinition, "id" | "pop">,
  nextVisible: boolean,
  fieldIndex = 0,
): WidgetInstancePresentation {
  return updateWidgetFieldState(
    presentation,
    field,
    {
      visible: nextVisible,
    },
    fieldIndex,
  );
}

export function getVisibleWidgetSchemaFields<TProps extends Record<string, unknown>, TContext>(
  widget: WidgetDefinition<TProps>,
  props: TProps,
  editable: boolean,
  context: TContext,
) {
  const fields = widget.schema?.fields ?? [];

  return fields.filter((field) =>
    field.isVisible
      ? field.isVisible({
          widget,
          props,
          editable,
          context,
        })
      : true,
  );
}

export function useResolvedWidgetControllerContext<
  TProps extends Record<string, unknown>,
  TContext = unknown,
>(
  widget: WidgetDefinition<TProps>,
  args: WidgetControllerArgs<TProps>,
) {
  const controller = widget.controller as
    | { useContext?: (controllerArgs: WidgetControllerArgs<TProps>) => TContext }
    | undefined;

  return controller?.useContext?.(args);
}

export function useVisibleWidgetSchemaFields<
  TProps extends Record<string, unknown>,
  TContext = unknown,
>(
  widget: WidgetDefinition<TProps>,
  props: TProps,
  editable: boolean,
  context: TContext,
) {
  return useMemo(
    () => getVisibleWidgetSchemaFields(widget, props, editable, context),
    [context, editable, props, widget],
  );
}
