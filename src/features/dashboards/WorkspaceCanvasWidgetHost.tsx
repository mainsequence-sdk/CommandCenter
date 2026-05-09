import {
  createPortal,
} from "react-dom";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from "react";

import {
  BookOpenText,
  Copy,
  GripVertical,
  MoreVertical,
  Save,
  Settings2,
  Trash2,
  Waypoints,
} from "lucide-react";

import {
  useResolvedWidgetInputs,
  useResolvedWidgetIo,
} from "@/dashboards/DashboardWidgetDependencies";
import { resolveReferenceBackedWidgetState } from "@/dashboards/widget-instance-references";
import {
  workspaceGridDraggableCancelClassName,
  workspaceGridDraggableHandleClassName,
} from "@/dashboards/react-grid-layout-adapter";
import { WORKSPACE_ROW_WIDGET_ID, isWorkspaceRowWidgetId } from "@/dashboards/structural-widgets";
import { getWidgetExplorerPath } from "@/features/widgets/widget-explorer";
import { cn } from "@/lib/utils";
import { WorkspaceRowCard } from "@/widgets/core/workspace-row/WorkspaceRowCard";
import {
  resolveWidgetHeaderVisibility,
  resolveWidgetMinimalChrome,
  resolveWidgetTransparentSurface,
  widgetShellClassName,
  widgetShellHeaderClassName,
} from "@/widgets/shared/chrome";
import { WidgetCanvasControls } from "@/widgets/shared/widget-canvas-controls";
import { WidgetErrorBoundary } from "@/widgets/shared/widget-error-boundary";
import type {
  WidgetComponentProps,
  WidgetDefinition,
  WidgetInstancePresentation,
} from "@/widgets/types";

function useDismissibleMenu(
  open: boolean,
  refs: Array<RefObject<HTMLElement | null>>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (refs.some((ref) => ref.current?.contains(target))) {
        return;
      }

      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open, refs]);
}

export function WidgetActionMenu({
  editable,
  floating = false,
  hasBindingsAction = false,
  onOpenBindings,
  onDuplicate,
  onOpenSettings,
  onRemove,
  onSaveWidget,
  widgetId,
  widgetTitle,
}: {
  editable: boolean;
  floating?: boolean;
  hasBindingsAction?: boolean;
  onOpenBindings?: () => void;
  onDuplicate: () => void;
  onOpenSettings: () => void;
  onRemove: () => void;
  onSaveWidget?: () => void;
  widgetId: string;
  widgetTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [portalStyle, setPortalStyle] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useDismissibleMenu(open, [rootRef, menuRef], () => {
    setOpen(false);
  });

  useLayoutEffect(() => {
    if (!open) {
      setPortalStyle(undefined);
      return undefined;
    }

    let frameId = 0;

    function updatePortalPosition() {
      const triggerRect = triggerRef.current?.getBoundingClientRect();

      if (!triggerRect) {
        return;
      }

      const menuWidth = menuRef.current?.offsetWidth ?? 220;
      const menuHeight = menuRef.current?.offsetHeight ?? 220;
      const horizontalPadding = 12;
      const verticalPadding = 12;
      const maxLeft = Math.max(horizontalPadding, window.innerWidth - menuWidth - horizontalPadding);
      const maxTop = Math.max(verticalPadding, window.innerHeight - menuHeight - verticalPadding);
      const preferredLeft = triggerRect.right - menuWidth;
      const preferredTop = triggerRect.bottom + 8;

      setPortalStyle({
        left: Math.max(horizontalPadding, Math.min(preferredLeft, maxLeft)),
        top: Math.max(verticalPadding, Math.min(preferredTop, maxTop)),
      });
    }

    updatePortalPosition();
    frameId = window.requestAnimationFrame(updatePortalPosition);

    window.addEventListener("resize", updatePortalPosition);
    window.addEventListener("scroll", updatePortalPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePortalPosition);
      window.removeEventListener("scroll", updatePortalPosition, true);
    };
  }, [open]);

  const triggerClassName = cn(
    "inline-flex h-6 w-6 items-center justify-center rounded-[6px] border-none bg-transparent text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
    floating ? "bg-transparent" : undefined,
    open ? "bg-muted/40 text-foreground" : undefined,
  );
  const itemClassName =
    "flex w-full items-center gap-2.5 rounded-[calc(var(--radius)-6px)] px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/45";

  return (
    <div ref={rootRef} className="relative" data-no-widget-drag="true">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open actions for ${widgetTitle}`}
        title={`Open actions for ${widgetTitle}`}
        className={triggerClassName}
        data-no-widget-drag="true"
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreVertical className="h-3.25 w-3.25" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              style={portalStyle}
              className="pointer-events-auto fixed z-[165] w-[220px] overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 p-2 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur"
              role="menu"
              data-no-widget-drag="true"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Widget actions
              </div>
              <div className="mt-1 flex flex-col gap-1">
                <a
                  href={getWidgetExplorerPath(widgetId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  className={itemClassName}
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  <BookOpenText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">Open guide</span>
                </a>

                {hasBindingsAction && onOpenBindings ? (
                  <button
                    type="button"
                    role="menuitem"
                    className={itemClassName}
                    onClick={() => {
                      setOpen(false);
                      onOpenBindings();
                    }}
                  >
                    <Waypoints className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">Bindings</span>
                  </button>
                ) : null}

                {editable ? (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className={itemClassName}
                      onClick={() => {
                        setOpen(false);
                        onSaveWidget?.();
                      }}
                    >
                      <Save className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">Save widget</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={itemClassName}
                      onClick={() => {
                        setOpen(false);
                        onOpenSettings();
                      }}
                    >
                      <Settings2 className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">Settings</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={itemClassName}
                      onClick={() => {
                        setOpen(false);
                        onDuplicate();
                      }}
                    >
                      <Copy className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">Duplicate</span>
                    </button>
                    <div className="my-1 border-t border-border/70" />
                    <button
                      type="button"
                      role="menuitem"
                      className={cn(itemClassName, "text-danger hover:bg-danger/10")}
                      onClick={() => {
                        setOpen(false);
                        onRemove();
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                      <span className="flex-1">Remove</span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function WorkspaceRowCanvasCard({
  accentColor,
  childCount,
  collapsed,
  editable,
  onDuplicate,
  onOpenBindings,
  onOpenSettings,
  onRemove,
  onSaveWidget,
  onToggleCollapse,
  showCollapseToggle = true,
  selected,
  title,
}: {
  accentColor?: string;
  childCount: number;
  collapsed: boolean;
  editable: boolean;
  onDuplicate: () => void;
  onOpenBindings?: () => void;
  onOpenSettings: () => void;
  onRemove: () => void;
  onSaveWidget: () => void;
  onToggleCollapse: () => void;
  showCollapseToggle?: boolean;
  selected: boolean;
  title: string;
}) {
  return (
    <WorkspaceRowCard
      title={title}
      accentColor={accentColor}
      childCount={childCount}
      collapsed={collapsed}
      editable={editable}
      selected={selected}
      showCollapseToggle={showCollapseToggle}
      showDragHint={editable}
      onToggleCollapse={onToggleCollapse}
      className={cn(
        editable ? workspaceGridDraggableHandleClassName : undefined,
        editable ? "cursor-grab select-none active:cursor-grabbing" : undefined,
      )}
      trailingContent={
        editable ? (
          <WidgetActionMenu
            editable
            widgetId={WORKSPACE_ROW_WIDGET_ID}
            widgetTitle={title}
            hasBindingsAction={Boolean(onOpenBindings)}
            onOpenBindings={onOpenBindings}
            onOpenSettings={onOpenSettings}
            onDuplicate={onDuplicate}
            onSaveWidget={onSaveWidget}
            onRemove={onRemove}
          />
        ) : null
      }
    />
  );
}

export function WorkspaceCanvasWidgetCard({
  instanceId,
  instanceTitle,
  selected,
  editable,
  style,
  headerActions,
  widget,
  widgetProps,
  widgetPresentation,
  widgetRuntimeState,
  onRemove,
  onDuplicate,
  onSaveWidget,
  onPropsChange,
  onPresentationChange,
  onRuntimeStateChange,
  onSelect,
  onOpenBindings,
  onOpenSettings,
  customContent,
  renderCanvasFields = true,
  dragHandleClassName = workspaceGridDraggableHandleClassName,
  shellVariant = "default",
  bodyDraggable = true,
  selectOnPointerDown = true,
  rowChildCount = 0,
  rowCollapsed = false,
  onToggleRowCollapse,
}: {
  instanceId: string;
  instanceTitle?: string;
  selected: boolean;
  editable: boolean;
  style?: CSSProperties;
  headerActions?: ReactNode;
  widget: WidgetDefinition;
  widgetProps: Record<string, unknown>;
  widgetPresentation?: WidgetInstancePresentation;
  widgetRuntimeState?: Record<string, unknown>;
  onRemove: (instanceId: string) => void;
  onDuplicate: (instanceId: string) => void;
  onSaveWidget: (instanceId: string) => void;
  onPropsChange: (instanceId: string, props: Record<string, unknown>) => void;
  onPresentationChange: (
    instanceId: string,
    presentation: WidgetInstancePresentation,
  ) => void;
  onRuntimeStateChange: (
    instanceId: string,
    runtimeState: Record<string, unknown> | undefined,
  ) => void;
  onSelect: (instanceId: string) => void;
  onOpenBindings: (instanceId: string) => void;
  onOpenSettings: (instanceId: string) => void;
  customContent?: ReactNode;
  renderCanvasFields?: boolean;
  dragHandleClassName?: string;
  shellVariant?: "default" | "transparent";
  bodyDraggable?: boolean;
  selectOnPointerDown?: boolean;
  rowChildCount?: number;
  rowCollapsed?: boolean;
  onToggleRowCollapse?: (instanceId: string) => void;
}) {
  const Component =
    widget.component as ComponentType<WidgetComponentProps<Record<string, unknown>>>;
  const resolvedInputs = useResolvedWidgetInputs(instanceId);
  const resolvedWidgetIo = useResolvedWidgetIo(instanceId);
  const effectiveState = useMemo(
    () =>
      resolveReferenceBackedWidgetState({
        instanceTitle,
        props: widgetProps,
        resolvedInputs,
      }),
    [instanceTitle, resolvedInputs, widgetProps],
  );
  const title = effectiveState.title ?? widget.title;
  const headerVisible = resolveWidgetHeaderVisibility(effectiveState.props);
  const rowWidget = isWorkspaceRowWidgetId(widget.id);
  const inlineCanvasEditable = editable && widget.canvasEditing?.mode === "inline";
  const minimalChrome = !rowWidget && resolveWidgetMinimalChrome(effectiveState.props);
  const transparentSurface = resolveWidgetTransparentSurface(widgetPresentation);
  const transparentShell = shellVariant === "transparent";
  const floatingChromeWidget = rowWidget || minimalChrome;
  const structuralVisible = effectiveState.props.visible === true;
  const widgetRenderProps =
    rowWidget && editable && !structuralVisible
      ? {
          ...effectiveState.props,
          visible: true,
        }
      : effectiveState.props;
  const hasBindingsAction = Boolean(
    resolvedWidgetIo?.inputs?.length ||
    widget.io?.inputs?.length ||
    widget.resolveIo,
  );
  const editControlsVisibilityClass = editable
    ? selected
      ? "opacity-100"
      : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
    : "pointer-events-none opacity-0";
  const editOutlineClassName = cn(
    "pointer-events-none absolute inset-0 z-0 border border-dashed transition-colors",
    selected && editable
      ? "border-primary/65"
      : "border-border/55",
  );

  if (rowWidget) {
    return (
      <div
        style={style}
        data-workspace-widget-instance-id={instanceId}
        data-workspace-widget-id={widget.id}
        data-workspace-widget-visibility="visible"
        className="group relative isolate h-full overflow-visible"
        onPointerDownCapture={() => {
          if (editable) {
            onSelect(instanceId);
          }
        }}
      >
        {editable ? (
          <div
            className={cn(editOutlineClassName, "rounded-none")}
            aria-hidden="true"
          />
        ) : null}
        <WorkspaceRowCanvasCard
          accentColor={typeof widgetRenderProps.color === "string" ? widgetRenderProps.color : undefined}
          title={title}
          selected={selected}
          editable={editable}
          collapsed={rowCollapsed}
          childCount={rowChildCount}
          showCollapseToggle={Boolean(onToggleRowCollapse)}
          onToggleCollapse={() => {
            onToggleRowCollapse?.(instanceId);
          }}
          onOpenSettings={() => {
            onOpenSettings(instanceId);
          }}
          onOpenBindings={
            hasBindingsAction
              ? () => {
                  onOpenBindings(instanceId);
                }
              : undefined
          }
          onDuplicate={() => {
            onDuplicate(instanceId);
          }}
          onSaveWidget={() => {
            onSaveWidget(instanceId);
          }}
          onRemove={() => {
            onRemove(instanceId);
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={style}
      data-workspace-widget-instance-id={instanceId}
      data-workspace-widget-id={widget.id}
      data-workspace-widget-visibility="visible"
      className="group relative isolate h-full overflow-visible"
      onPointerDownCapture={() => {
        if (editable && selectOnPointerDown) {
          onSelect(instanceId);
        }
      }}
    >
      {editable ? (
        <div
          className={cn(editOutlineClassName, "rounded-none")}
          aria-hidden="true"
        />
      ) : null}
      {renderCanvasFields ? (
        <WidgetCanvasControls
          widget={widget}
          instanceId={instanceId}
          instanceTitle={effectiveState.title}
          props={widgetRenderProps}
          presentation={widgetPresentation}
          runtimeState={widgetRuntimeState}
          onPropsChange={(props) => {
            onPropsChange(instanceId, props);
          }}
          onRuntimeStateChange={(state) => {
            onRuntimeStateChange(instanceId, state);
          }}
          onPresentationChange={(nextPresentation) => {
            onPresentationChange(instanceId, nextPresentation);
          }}
          editable={editable}
        />
      ) : null}

      <section
        data-widget-shell="default"
        data-widget-surface={
          floatingChromeWidget || transparentSurface || transparentShell ? "bare" : "card"
        }
        className={cn(
          editable && bodyDraggable ? dragHandleClassName : undefined,
          "relative z-10 flex h-full min-h-0 flex-col transition-colors",
          floatingChromeWidget
            ? "overflow-visible rounded-none border-none bg-transparent text-card-foreground shadow-none backdrop-blur-0"
              : transparentSurface
                ? "overflow-visible rounded-none border-none bg-transparent text-card-foreground shadow-none backdrop-blur-0"
              : transparentShell
                ? "overflow-visible rounded-none border-none bg-transparent text-card-foreground shadow-none backdrop-blur-0"
              : cn(
                  widgetShellClassName,
                  inlineCanvasEditable ? "overflow-visible" : "overflow-hidden",
                  "rounded-none border bg-card/92 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur-xl",
                  selected && editable
                    ? "border-primary/70 ring-2 ring-primary/30"
                    : "border-border/70 hover:border-border",
                ),
          editable && bodyDraggable ? "cursor-grab select-none active:cursor-grabbing" : undefined,
        )}
      >
        {editable && !floatingChromeWidget ? (
          <div
            className="absolute left-0 top-0 z-20"
          >
            <div
              className={cn(
                dragHandleClassName,
                "flex h-5 w-5 items-center justify-center rounded-none rounded-br-[10px] border-b border-r border-border/70 bg-background/92 text-muted-foreground shadow-[var(--shadow-panel)] backdrop-blur-md cursor-grab select-none active:cursor-grabbing",
              )}
              data-widget-grid-handle="true"
              title={`Drag ${title}`}
            >
              <GripVertical className="h-3 w-3" />
            </div>
          </div>
        ) : null}

        {headerActions || editable ? (
          <div
            className={cn(
              "absolute top-2 right-2 z-20 flex items-center gap-1",
              workspaceGridDraggableCancelClassName,
            )}
            data-no-widget-drag="true"
            data-widget-grid-cancel="true"
          >
            {headerActions ? (
              <div className="flex items-center gap-1" data-no-widget-drag="true">
                {headerActions}
              </div>
            ) : null}
            {editable ? (
              <div className={cn("transition-opacity", editControlsVisibilityClass)}>
                <WidgetActionMenu
                  editable={editable}
                  floating
                  widgetId={widget.id}
                  widgetTitle={title}
                  hasBindingsAction={hasBindingsAction}
                  onOpenBindings={() => {
                    onOpenBindings(instanceId);
                  }}
                  onOpenSettings={() => {
                    onOpenSettings(instanceId);
                  }}
                  onDuplicate={() => {
                    onDuplicate(instanceId);
                  }}
                  onSaveWidget={() => {
                    onSaveWidget(instanceId);
                  }}
                  onRemove={() => {
                    onRemove(instanceId);
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {headerVisible && !floatingChromeWidget ? (
          <header
            data-widget-shell-header=""
            data-widget-grid-handle={editable ? "true" : undefined}
            className={cn(
              editable ? dragHandleClassName : undefined,
              widgetShellHeaderClassName,
              "flex items-center gap-2 border-b border-border/70 px-3 py-1.5",
              editable ? "cursor-grab select-none active:cursor-grabbing" : undefined,
            )}
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium leading-5 text-card-foreground">{title}</div>
            </div>
          </header>
        ) : null}

        <div
          className={cn(
            "min-h-0 flex-1",
            editable && !inlineCanvasEditable ? "pointer-events-none select-none" : undefined,
          )}
        >
          <WidgetErrorBoundary
            widgetId={widget.id}
            widgetTitle={title}
            instanceId={instanceId}
            surface="canvas"
          >
            {customContent ?? (
              <Component
                widget={widget}
                instanceId={instanceId}
                instanceTitle={effectiveState.title}
                props={widgetRenderProps}
                editable={inlineCanvasEditable}
                presentation={widgetPresentation}
                runtimeState={widgetRuntimeState}
                resolvedInputs={resolvedInputs}
                onPropsChange={(nextProps: Record<string, unknown>) => {
                  onPropsChange(instanceId, nextProps);
                }}
                onRuntimeStateChange={(state) => {
                  onRuntimeStateChange(instanceId, state);
                }}
              />
            )}
          </WidgetErrorBoundary>
        </div>
      </section>
    </div>
  );
}
