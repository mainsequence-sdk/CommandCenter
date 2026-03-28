import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  resolveWidgetFieldState,
  updateWidgetFieldState,
  useResolvedWidgetControllerContext,
  useVisibleWidgetSchemaFields,
} from "@/widgets/shared/widget-schema";
import type {
  WidgetDefinition,
  WidgetFieldDefinition,
  WidgetFieldAnchor,
  WidgetInstancePresentation,
} from "@/widgets/types";

interface ExposedFieldEntry<TProps extends Record<string, unknown>> {
  field: WidgetFieldDefinition<TProps, unknown>;
  fieldState: ReturnType<typeof resolveWidgetFieldState>;
  fieldIndex: number;
}

const companionGap = 8;
const minCompanionWidth = 220;
const minCompanionHeight = 90;

type CompanionInteraction<TProps extends Record<string, unknown>> =
  | {
      type: "drag";
      entry: ExposedFieldEntry<TProps>;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
    }
  | {
      type: "resize-x";
      entry: ExposedFieldEntry<TProps>;
      startClientX: number;
      startWidth: number;
    }
  | {
      type: "resize-y";
      entry: ExposedFieldEntry<TProps>;
      startClientY: number;
      startHeight: number;
    };

function companionCardStyle<TProps extends Record<string, unknown>>(
  entry: ExposedFieldEntry<TProps>,
) {
  const {
    anchor,
    x = 0,
    y = 0,
    width = 320,
    height = 120,
  } = entry.fieldState;

  switch (anchor) {
    case "bottom":
      return {
        left: x,
        top: `calc(100% + ${companionGap + y}px)`,
        width,
        height,
      };
    case "left":
      return {
        left: x - width - companionGap,
        top: y,
        width,
        height,
      };
    case "right":
      return {
        left: `calc(100% + ${companionGap + x}px)`,
        top: y,
        width,
        height,
      };
    case "top":
    default:
      return {
        left: x,
        top: y - height - companionGap,
        width,
        height,
      };
  }
}

function companionConnectorClass(anchor: WidgetFieldAnchor) {
  switch (anchor) {
    case "bottom":
      return "before:absolute before:left-8 before:bottom-full before:h-[8px] before:w-px before:bg-border/70";
    case "left":
      return "before:absolute before:top-8 before:left-full before:h-px before:w-[8px] before:bg-border/70";
    case "right":
      return "before:absolute before:top-8 before:right-full before:h-px before:w-[8px] before:bg-border/70";
    case "top":
    default:
      return "before:absolute before:left-8 before:top-full before:h-[8px] before:w-px before:bg-border/70";
  }
}

function renderCompanionField<TProps extends Record<string, unknown>>(
  widget: WidgetDefinition<TProps>,
  props: TProps,
  runtimeState: Record<string, unknown> | undefined,
  onPropsChange: (props: TProps) => void,
  onRuntimeStateChange: ((state: Record<string, unknown> | undefined) => void) | undefined,
  editable: boolean,
  context: unknown,
  entry: ExposedFieldEntry<TProps>,
  onStartDrag: (
    event: React.PointerEvent<HTMLElement>,
    entry: ExposedFieldEntry<TProps>,
  ) => void,
  onStartResize: (
    event: React.PointerEvent<HTMLDivElement>,
    entry: ExposedFieldEntry<TProps>,
    axis: "x" | "y",
  ) => void,
) {
  const CardRenderer = entry.field.renderCanvas;

  if (!CardRenderer) {
    return null;
  }

  return (
    <div
      key={entry.field.id}
      data-widget-companion-card=""
      data-no-widget-drag="true"
      className={cn(
        "absolute z-30 flex flex-col overflow-visible rounded-[18px] border border-border/55 bg-background/18 text-card-foreground shadow-[0_18px_40px_rgba(0,0,0,0.16)] backdrop-blur-md",
        companionConnectorClass(entry.fieldState.anchor),
      )}
      style={companionCardStyle(entry)}
      onPointerDown={(event) => {
        if (!editable) {
          return;
        }

        const target = event.target as HTMLElement;

        if (
          target.closest(
            "button, a, input, textarea, select, [role='combobox'], [role='listbox'], [role='option'], [data-companion-resize='true']",
          )
        ) {
          return;
        }

        onStartDrag(event, entry);
      }}
    >
      {editable ? (
        <div className="pointer-events-none absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background/92 text-muted-foreground shadow-[var(--shadow-panel)]">
          <GripHorizontal className="h-3 w-3" />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <CardRenderer
          field={entry.field}
          widget={widget}
          props={props}
          onPropsChange={onPropsChange}
          fieldState={entry.fieldState}
          runtimeState={runtimeState}
          onRuntimeStateChange={onRuntimeStateChange}
          editable={editable}
          context={context}
        />
      </div>

      {editable ? (
        <>
          <div
            data-companion-resize="true"
            data-no-widget-drag="true"
            className="absolute top-0 right-0 h-full w-2 cursor-ew-resize"
            aria-label={`Resize ${entry.field.label} width`}
            onPointerDown={(event) => {
              onStartResize(event, entry, "x");
            }}
          />
          <div
            data-companion-resize="true"
            data-no-widget-drag="true"
            className="absolute right-0 bottom-0 h-2 w-full cursor-ns-resize"
            aria-label={`Resize ${entry.field.label} height`}
            onPointerDown={(event) => {
              onStartResize(event, entry, "y");
            }}
          />
          <div className="pointer-events-none absolute top-2 right-0 bottom-2 w-px bg-border/60" />
          <div className="pointer-events-none absolute right-2 bottom-0 left-2 h-px bg-border/60" />
        </>
      ) : null}
    </div>
  );
}

export function WidgetCanvasControls<
  TProps extends Record<string, unknown> = Record<string, unknown>,
>({
  widget,
  props,
  presentation,
  runtimeState,
  onPropsChange,
  onRuntimeStateChange,
  onPresentationChange,
  editable = false,
  containerClassName,
  containerStyle,
}: {
  widget: WidgetDefinition<TProps>;
  props: TProps;
  presentation?: WidgetInstancePresentation;
  runtimeState?: Record<string, unknown>;
  onPropsChange: (props: TProps) => void;
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  onPresentationChange?: (presentation: WidgetInstancePresentation) => void;
  editable?: boolean;
  containerClassName?: string;
  containerStyle?: CSSProperties;
}) {
  const presentationRef = useRef(presentation);
  const [interaction, setInteraction] = useState<CompanionInteraction<TProps> | null>(null);
  const context = useResolvedWidgetControllerContext(widget, {
    props,
    runtimeState,
    mode: "canvas",
  });

  useEffect(() => {
    presentationRef.current = presentation;
  }, [presentation]);

  const visibleFields = useVisibleWidgetSchemaFields(widget, props, editable, context).filter(
    (field) => field.pop?.canPop && field.renderCanvas,
  );

  const exposedFields = useMemo(() => {
    return visibleFields
      .map((field, index) => ({
        field,
        fieldState: resolveWidgetFieldState(presentation, field, index),
        fieldIndex: index,
      }))
      .filter((entry) => entry.fieldState.visible);
  }, [presentation, visibleFields]);

  useEffect(() => {
    if (!interaction || !editable || !onPresentationChange) {
      return;
    }

    const activeInteraction = interaction;
    const applyPresentationChange = onPresentationChange;

    function handlePointerMove(event: PointerEvent) {
      if (activeInteraction.type === "drag") {
        const dx = event.clientX - activeInteraction.startClientX;
        const dy = event.clientY - activeInteraction.startClientY;

        applyPresentationChange(
          updateWidgetFieldState(
            presentationRef.current,
            activeInteraction.entry.field,
            {
              x: activeInteraction.startX + dx,
              y: activeInteraction.startY + dy,
            },
            activeInteraction.entry.fieldIndex,
          ),
        );
        return;
      }

      if (activeInteraction.type === "resize-x") {
        const dx = event.clientX - activeInteraction.startClientX;

        applyPresentationChange(
          updateWidgetFieldState(
            presentationRef.current,
            activeInteraction.entry.field,
            {
              width: Math.max(minCompanionWidth, activeInteraction.startWidth + dx),
            },
            activeInteraction.entry.fieldIndex,
          ),
        );
        return;
      }

      const dy = event.clientY - activeInteraction.startClientY;

      applyPresentationChange(
        updateWidgetFieldState(
          presentationRef.current,
          activeInteraction.entry.field,
          {
            height: Math.max(minCompanionHeight, activeInteraction.startHeight + dy),
          },
          activeInteraction.entry.fieldIndex,
        ),
      );
    }

    function handlePointerUp() {
      setInteraction(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [editable, interaction, onPresentationChange]);

  if (exposedFields.length === 0) {
    return null;
  }

  function handleStartDrag(
    event: ReactPointerEvent<HTMLElement>,
    entry: ExposedFieldEntry<TProps>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setInteraction({
      type: "drag",
      entry,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: entry.fieldState.x ?? 0,
      startY: entry.fieldState.y ?? 0,
    });
  }

  function handleStartResize(
    event: ReactPointerEvent<HTMLDivElement>,
    entry: ExposedFieldEntry<TProps>,
    axis: "x" | "y",
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (axis === "x") {
      setInteraction({
        type: "resize-x",
        entry,
        startClientX: event.clientX,
        startWidth: entry.fieldState.width ?? minCompanionWidth,
      });
      return;
    }

    setInteraction({
      type: "resize-y",
      entry,
      startClientY: event.clientY,
      startHeight: entry.fieldState.height ?? minCompanionHeight,
    });
  }

  const content = (
    <>
      {exposedFields.map((entry) =>
        renderCompanionField(
          widget,
          props,
          runtimeState,
          onPropsChange,
          onRuntimeStateChange,
          editable,
          context,
          entry,
          handleStartDrag,
          handleStartResize,
        ),
      )}
    </>
  );

  if (containerClassName || containerStyle) {
    return (
      <div className={containerClassName} style={containerStyle}>
        {content}
      </div>
    );
  }

  return content;
}
