import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import {
  GripHorizontal,
  LayoutTemplate,
  Maximize2,
  Minimize2,
  MoveDiagonal2,
  Pencil,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { appRegistry, getWidgetById } from "@/app/registry";
import { getAppPath } from "@/apps/utils";
import { hasAllPermissions } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DashboardControlsProvider,
  DashboardDataControls,
} from "@/dashboards/DashboardControls";
import type { DashboardWidgetPlacement, ResolvedDashboardWidgetLayout } from "@/dashboards/types";
import { cn, titleCase } from "@/lib/utils";
import type { WidgetDefinition } from "@/widgets/types";
import {
  appendCatalogWidget,
  CUSTOM_WORKSPACE_COLUMN_SCALE,
  CUSTOM_WORKSPACE_ROW_SCALE,
  placeCatalogWidget,
  removeDashboardWidget,
  setDashboardWidgetGeometry,
} from "./custom-dashboard-storage";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";

interface CatalogDragPayload {
  widgetId: string;
}

interface ActiveCatalogDrag {
  widgetId: string;
  clientX: number;
  clientY: number;
}

interface ActiveInteraction {
  type: "drag" | "resize";
  instanceId: string;
  startClientX: number;
  startClientY: number;
  anchorOffsetX: number;
  anchorOffsetY: number;
  initialLayout: ResolvedDashboardWidgetLayout;
}

function layoutToStyle(layout: ResolvedDashboardWidgetLayout): CSSProperties {
  return {
    gridColumn: `${layout.x + 1} / span ${layout.w}`,
    gridRow: `${layout.y + 1} / span ${layout.h}`,
  };
}

interface GridMetrics {
  rect: DOMRect;
  columns: number;
  gap: number;
  rowHeight: number;
  cellWidth: number;
  stepX: number;
  stepY: number;
}

function getGridMetrics(
  gridElement: HTMLDivElement | null,
  grid: { columns: number; gap: number; rowHeight: number },
): GridMetrics | null {
  if (!gridElement) {
    return null;
  }

  const rect = gridElement.getBoundingClientRect();

  if (!rect.width) {
    return null;
  }

  const cellWidth = (rect.width - grid.gap * (grid.columns - 1)) / grid.columns;

  return {
    rect,
    columns: grid.columns,
    gap: grid.gap,
    rowHeight: grid.rowHeight,
    cellWidth,
    stepX: cellWidth + grid.gap,
    stepY: grid.rowHeight + grid.gap,
  };
}

function getLayoutBounds(layout: ResolvedDashboardWidgetLayout, metrics: GridMetrics) {
  const left = layout.x * metrics.stepX;
  const top = layout.y * metrics.stepY;
  const width = layout.w * metrics.cellWidth + (layout.w - 1) * metrics.gap;
  const height = layout.h * metrics.rowHeight + (layout.h - 1) * metrics.gap;

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function getPlacementBounds(position: DashboardWidgetPlacement, metrics: GridMetrics) {
  return {
    left: (position.x ?? 0) * metrics.stepX,
    top: (position.y ?? 0) * metrics.stepY,
    width: metrics.cellWidth,
    height: metrics.rowHeight,
  };
}

function resolveGridCellFromPoint(
  metrics: GridMetrics,
  clientX: number,
  clientY: number,
): DashboardWidgetPlacement | null {
  const offsetX = clientX - metrics.rect.left;
  const offsetY = clientY - metrics.rect.top;

  if (
    offsetX < 0 ||
    offsetX > metrics.rect.width ||
    offsetY < 0 ||
    offsetY > metrics.rect.height
  ) {
    return null;
  }

  return {
    x: Math.max(
      0,
      Math.min(
        Math.round(offsetX / metrics.stepX),
        metrics.columns - 1,
      ),
    ),
    y: Math.max(0, Math.round(offsetY / metrics.stepY)),
  };
}

function WorkspaceToolbarButton({
  active = false,
  className,
  children,
  title,
  ...props
}: {
  active?: boolean;
  children: ReactNode;
  title: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-[calc(var(--radius)-8px)] border border-border/70 bg-card/82 text-foreground shadow-sm transition-colors hover:bg-muted/35 disabled:pointer-events-none disabled:opacity-50",
        active
          ? "border-primary/60 bg-muted/45 text-foreground"
          : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function BuilderWidgetCard({
  instanceId,
  instanceTitle,
  layout,
  selected,
  editable,
  style,
  widget,
  widgetProps,
  expanded,
  onRemove,
  onSelect,
  onStartDrag,
  onStartResize,
  onToggleExpanded,
}: {
  instanceId: string;
  instanceTitle?: string;
  layout: ResolvedDashboardWidgetLayout;
  selected: boolean;
  editable: boolean;
  style?: CSSProperties;
  widget: WidgetDefinition;
  widgetProps: Record<string, unknown>;
  expanded: boolean;
  onRemove: (instanceId: string) => void;
  onSelect: (instanceId: string) => void;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onStartResize: (event: ReactPointerEvent<HTMLElement>) => void;
  onToggleExpanded: (instanceId: string) => void;
}) {
  const Component = widget.component as ComponentType<{
    widget: typeof widget;
    instanceTitle?: string;
    props: Record<string, unknown>;
  }>;

  const title = instanceTitle ?? widget.title;

  return (
    <section
      style={style}
      className={cn(
        "group relative z-10 flex min-h-0 flex-col overflow-hidden rounded-[20px] border bg-[rgba(7,12,22,0.9)] text-card-foreground shadow-[0_18px_48px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-colors",
        selected && editable
          ? "border-primary/70 ring-2 ring-primary/30"
          : "border-white/8 hover:border-white/14",
      )}
      onPointerDownCapture={() => {
        if (editable) {
          onSelect(instanceId);
        }
      }}
    >
      {editable ? (
        <button
          type="button"
          className="absolute top-3 left-1/2 z-20 flex h-8 -translate-x-1/2 cursor-grab items-center gap-1.5 rounded-full border border-white/12 bg-[rgba(7,12,22,0.96)] px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground shadow-[0_10px_26px_rgba(0,0,0,0.28)] transition-colors hover:border-white/20 hover:bg-[rgba(10,16,30,0.98)] hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag ${title}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            onStartDrag(event);
          }}
        >
          <GripHorizontal className="h-3.5 w-3.5" />
          Move
        </button>
      ) : null}

      <header
        className={cn(
          "flex items-center justify-between gap-3 border-b border-white/8 px-3 py-2.5",
          editable ? "cursor-grab pt-12 active:cursor-grabbing" : undefined,
        )}
        onPointerDown={(event) => {
          if (!editable) {
            return;
          }

          const target = event.target as HTMLElement;

          if (target.closest("button")) {
            return;
          }

          onStartDrag(event);
        }}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-card-foreground">{title}</div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(instanceId);
            }}
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          {editable ? (
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-danger/30 bg-danger/8 text-danger transition-colors hover:bg-danger/16"
              aria-label={`Remove ${title}`}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onRemove(instanceId);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 p-3">
        <Component widget={widget} instanceTitle={instanceTitle} props={widgetProps} />
      </div>

      {selected && editable && !expanded ? (
        <button
          type="button"
          className="absolute right-3 bottom-3 flex h-8 w-8 cursor-se-resize items-center justify-center rounded-full border border-primary/40 bg-[rgba(8,16,30,0.92)] text-primary shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-colors hover:bg-[rgba(12,22,40,0.96)]"
          aria-label={`Resize ${title}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            onStartResize(event);
          }}
        >
          <MoveDiagonal2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </section>
  );
}

export function CustomDashboardStudioPage() {
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const {
    user,
    permissions,
    selectedDashboard,
    resolvedDashboard,
    dirty,
    updateSelectedWorkspace,
    saveWorkspaceDraft,
  } = useCustomWorkspaceStudio();
  const updateSelectedWorkspaceRef = useRef<typeof updateSelectedWorkspace | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogDragPayload, setCatalogDragPayload] = useState<CatalogDragPayload | null>(null);
  const [activeCatalogDrag, setActiveCatalogDrag] = useState<ActiveCatalogDrag | null>(null);
  const [hoveredPlacement, setHoveredPlacement] = useState<DashboardWidgetPlacement | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [activeInteraction, setActiveInteraction] = useState<ActiveInteraction | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [expandedInstanceId, setExpandedInstanceId] = useState<string | null>(null);
  const [measuredGridMetrics, setMeasuredGridMetrics] = useState<GridMetrics | null>(null);
  const deferredCatalogQuery = useDeferredValue(catalogQuery);

  const allowedWidgets = useMemo(
    () =>
      appRegistry.widgets.filter((widget) =>
        hasAllPermissions(permissions, widget.requiredPermissions ?? []),
      ),
    [permissions],
  );
  const widgetMap = useMemo(
    () => new Map(allowedWidgets.map((widget) => [widget.id, widget])),
    [allowedWidgets],
  );

  const filteredWidgets = useMemo(() => {
    const query = deferredCatalogQuery.trim().toLowerCase();

    if (!query) {
      return allowedWidgets;
    }

    return allowedWidgets.filter((widget) => {
      const haystack = [
        widget.title,
        widget.description,
        widget.category,
        widget.kind,
        widget.tags?.join(" ") ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [allowedWidgets, deferredCatalogQuery]);

  useEffect(() => {
    updateSelectedWorkspaceRef.current = updateSelectedWorkspace;
  }, [updateSelectedWorkspace]);

  const selectedLayout = useMemo(
    () =>
      editMode
        ? resolvedDashboard?.widgets.find((widget) => widget.id === selectedInstanceId)?.layout ?? null
        : null,
    [editMode, resolvedDashboard, selectedInstanceId],
  );

  const expandedWidget = useMemo(
    () =>
      resolvedDashboard?.widgets.find((widget) => widget.id === expandedInstanceId) ?? null,
    [expandedInstanceId, resolvedDashboard],
  );

  useEffect(() => {
    if (!editMode) {
      setLibraryOpen(false);
      setSelectedInstanceId(null);
      setCatalogDragPayload(null);
      setActiveCatalogDrag(null);
      setHoveredPlacement(null);
      setActiveInteraction(null);
    }
  }, [editMode]);

  useEffect(() => {
    setLibraryOpen(false);
    setSelectedInstanceId(null);
    setCatalogDragPayload(null);
    setActiveCatalogDrag(null);
    setHoveredPlacement(null);
    setActiveInteraction(null);
    setExpandedInstanceId(null);
    setEditMode(false);
  }, [selectedDashboard?.id]);

  useEffect(() => {
    if (!resolvedDashboard || !gridRef.current) {
      setMeasuredGridMetrics(null);
      return undefined;
    }

    const gridElement = gridRef.current;
    const grid = resolvedDashboard.grid;

    function updateGridMetrics() {
      setMeasuredGridMetrics(getGridMetrics(gridElement, grid));
    }

    updateGridMetrics();

    const observer = new ResizeObserver(() => {
      updateGridMetrics();
    });

    observer.observe(gridElement);
    window.addEventListener("resize", updateGridMetrics);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateGridMetrics);
    };
  }, [
    resolvedDashboard?.id,
    resolvedDashboard?.grid.columns,
    resolvedDashboard?.grid.gap,
    resolvedDashboard?.grid.rowHeight,
  ]);

  useEffect(() => {
    if (
      selectedInstanceId &&
      !resolvedDashboard?.widgets.some((widget) => widget.id === selectedInstanceId)
    ) {
      setSelectedInstanceId(null);
    }

    if (
      expandedInstanceId &&
      !resolvedDashboard?.widgets.some((widget) => widget.id === expandedInstanceId)
    ) {
      setExpandedInstanceId(null);
    }
  }, [expandedInstanceId, resolvedDashboard, selectedInstanceId]);

  const selectedBounds = useMemo(
    () =>
      selectedLayout && measuredGridMetrics
        ? getLayoutBounds(selectedLayout, measuredGridMetrics)
        : null,
    [measuredGridMetrics, selectedLayout],
  );

  const hoveredPlacementBounds = useMemo(
    () =>
      hoveredPlacement && measuredGridMetrics
        ? getPlacementBounds(hoveredPlacement, measuredGridMetrics)
        : null,
    [hoveredPlacement, measuredGridMetrics],
  );

  const dotGridBackgroundStyle = useMemo<CSSProperties | null>(() => {
    if (!measuredGridMetrics) {
      return null;
    }

    return {
      backgroundImage:
        "radial-gradient(circle at 0 0, var(--workspace-grid-dot) 0, var(--workspace-grid-dot) 1.55px, transparent 1.9px)",
      backgroundPosition: "0 0",
      backgroundRepeat: "repeat",
      backgroundSize: `${measuredGridMetrics.stepX}px ${measuredGridMetrics.stepY}px`,
    };
  }, [measuredGridMetrics]);

  useEffect(() => {
    if (!activeInteraction || !resolvedDashboard?.grid) {
      return undefined;
    }

    const interaction = activeInteraction;
    const grid = resolvedDashboard.grid;
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;

    document.body.style.userSelect = "none";
    document.body.style.cursor = interaction.type === "resize" ? "se-resize" : "grabbing";

    function handlePointerMove(event: PointerEvent) {
      const metrics = getGridMetrics(gridRef.current, grid);

      if (!metrics) {
        return;
      }

      if (interaction.type === "drag") {
        const desiredLeft = event.clientX - metrics.rect.left - interaction.anchorOffsetX;
        const desiredTop = event.clientY - metrics.rect.top - interaction.anchorOffsetY;
        const nextX = Math.max(
          0,
          Math.min(
            Math.round(desiredLeft / metrics.stepX),
            metrics.columns - interaction.initialLayout.w,
          ),
        );
        const nextY = Math.max(0, Math.round(desiredTop / metrics.stepY));

        updateSelectedWorkspaceRef.current?.((dashboard) =>
          setDashboardWidgetGeometry(dashboard, interaction.instanceId, {
            x: nextX,
            y: nextY,
          }),
        );
        return;
      }

      const bounds = getLayoutBounds(interaction.initialLayout, metrics);
      const desiredRight = event.clientX - metrics.rect.left + interaction.anchorOffsetX;
      const desiredBottom = event.clientY - metrics.rect.top + interaction.anchorOffsetY;
      const nextCols = Math.max(
        1,
        Math.min(
          Math.round((desiredRight - bounds.left + metrics.gap) / metrics.stepX),
          metrics.columns - interaction.initialLayout.x,
        ),
      );
      const nextRows = Math.max(
        1,
        Math.round((desiredBottom - bounds.top + metrics.gap) / metrics.stepY),
      );

      updateSelectedWorkspaceRef.current?.((dashboard) =>
        setDashboardWidgetGeometry(dashboard, interaction.instanceId, {
          cols: nextCols,
          rows: nextRows,
          x: interaction.initialLayout.x,
          y: interaction.initialLayout.y,
        }),
      );
    }

    function handlePointerUp() {
      setActiveInteraction(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    activeInteraction,
    resolvedDashboard?.grid.columns,
    resolvedDashboard?.grid.gap,
    resolvedDashboard?.grid.rowHeight,
  ]);

  useEffect(() => {
    if (!activeCatalogDrag || !resolvedDashboard?.grid || !editMode) {
      return undefined;
    }

    const draggedWidgetId = activeCatalogDrag.widgetId;
    const grid = resolvedDashboard.grid;
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    function handlePointerMove(event: PointerEvent) {
      setActiveCatalogDrag((current) =>
        current
          ? {
              ...current,
              clientX: event.clientX,
              clientY: event.clientY,
            }
          : current,
      );

      const metrics = getGridMetrics(gridRef.current, grid);
      const placement = metrics
        ? resolveGridCellFromPoint(metrics, event.clientX, event.clientY)
        : null;
      setHoveredPlacement(placement);
    }

    function handlePointerUp(event: PointerEvent) {
      const metrics = getGridMetrics(gridRef.current, grid);
      const placement = metrics
        ? resolveGridCellFromPoint(metrics, event.clientX, event.clientY)
        : null;

      if (placement) {
        const widget = widgetMap.get(draggedWidgetId);

        if (widget) {
          updateSelectedWorkspaceRef.current?.((dashboard) =>
            placeCatalogWidget(dashboard, widget, placement),
          );
        }
      }

      setActiveCatalogDrag(null);
      setCatalogDragPayload(null);
      setHoveredPlacement(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    activeCatalogDrag,
    editMode,
    resolvedDashboard?.grid.columns,
    resolvedDashboard?.grid.gap,
    resolvedDashboard?.grid.rowHeight,
    widgetMap,
  ]);

  function startInteraction(
    type: ActiveInteraction["type"],
    instanceId: string,
    layout: ResolvedDashboardWidgetLayout,
    event: ReactPointerEvent<HTMLElement>,
  ) {
    if (!editMode || !resolvedDashboard) {
      return;
    }

    event.preventDefault();
    setSelectedInstanceId(instanceId);

    const metrics = getGridMetrics(gridRef.current, resolvedDashboard.grid);

    if (!metrics) {
      return;
    }

    const bounds = getLayoutBounds(layout, metrics);

    setActiveInteraction({
      type,
      instanceId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      anchorOffsetX:
        type === "drag"
          ? event.clientX - metrics.rect.left - bounds.left
          : bounds.right - (event.clientX - metrics.rect.left),
      anchorOffsetY:
        type === "drag"
          ? event.clientY - metrics.rect.top - bounds.top
          : bounds.bottom - (event.clientY - metrics.rect.top),
      initialLayout: layout,
    });
  }

  function handleCatalogAdd(widget: WidgetDefinition) {
    setEditMode(true);
    updateSelectedWorkspace((dashboard) => appendCatalogWidget(dashboard, widget));
  }

  function handleCatalogPointerStart(
    widget: WidgetDefinition,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!editMode || event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest("button, input, textarea, select, a")) {
      return;
    }

    event.preventDefault();
    setCatalogDragPayload({ widgetId: widget.id });
    setActiveCatalogDrag({
      widgetId: widget.id,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    setHoveredPlacement(null);
  }

  function handleEditAction() {
    setEditMode((current) => !current);
  }

  function handleSaveAction() {
    saveWorkspaceDraft();
  }

  if (!user) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        Resolve a user session before opening the custom workspace studio.
      </div>
    );
  }

  if (!selectedDashboard || !resolvedDashboard) {
    return null;
  }

  return (
    <DashboardControlsProvider key={selectedDashboard.id} controls={selectedDashboard.controls}>
      <div
        className="relative h-full min-h-full overflow-hidden"
        style={{ backgroundColor: "var(--workspace-canvas-base-color)" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "var(--workspace-canvas-background)" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "var(--workspace-canvas-overlay)" }}
        />

        <div className="pointer-events-none absolute top-4 left-4 right-4 z-40">
          <div className="pointer-events-auto">
            <DashboardDataControls
              controls={selectedDashboard.controls}
              leftActions={
                <>
                  <WorkspaceToolbarButton
                    active={editMode}
                    title="Edit workspace"
                    onClick={handleEditAction}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </WorkspaceToolbarButton>
                  {editMode ? (
                    <WorkspaceToolbarButton
                      active={dirty}
                      title="Save workspace"
                      onClick={handleSaveAction}
                      disabled={!dirty}
                      className={!dirty ? "opacity-50" : undefined}
                    >
                      {dirty ? (
                        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-warning" />
                      ) : null}
                      <Save className="h-3.5 w-3.5" />
                    </WorkspaceToolbarButton>
                  ) : null}
                  <WorkspaceToolbarButton
                    active={libraryOpen}
                    title="Components"
                    onClick={() => {
                      if (!editMode) {
                        setEditMode(true);
                        setLibraryOpen(true);
                        return;
                      }

                      setLibraryOpen((current) => !current);
                    }}
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" />
                  </WorkspaceToolbarButton>
                  <WorkspaceToolbarButton
                    title="Workspace settings"
                    onClick={() => {
                      navigate(
                        `${getAppPath("workspace-studio", "settings")}?workspace=${encodeURIComponent(selectedDashboard.id)}`,
                      );
                    }}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </WorkspaceToolbarButton>
                </>
              }
            />
          </div>
        </div>

        <div className="absolute inset-0 overflow-auto px-4 pt-16 pb-4">
          <div
            className="relative min-h-full"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedInstanceId(null);
              }
            }}
          >
          {dotGridBackgroundStyle && (editMode || activeCatalogDrag || selectedBounds) ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={dotGridBackgroundStyle}
            />
          ) : null}

          {selectedBounds && dotGridBackgroundStyle ? (
            <div
              className="pointer-events-none absolute rounded-[22px] bg-primary/6 ring-1 ring-primary/18"
              style={{
                left: `${selectedBounds.left}px`,
                top: `${selectedBounds.top}px`,
                width: `${selectedBounds.width}px`,
                height: `${selectedBounds.height}px`,
                backgroundImage:
                  "radial-gradient(circle at 0 0, var(--workspace-grid-dot-selected) 0, var(--workspace-grid-dot-selected) 1.75px, transparent 2.1px)",
                backgroundPosition: `${-selectedBounds.left}px ${-selectedBounds.top}px`,
                backgroundRepeat: "repeat",
                backgroundSize: dotGridBackgroundStyle.backgroundSize,
              }}
            />
          ) : null}

          <div
            ref={gridRef}
            className="grid min-h-full"
            style={{
              gap: `${resolvedDashboard.grid.gap}px`,
              gridAutoRows: `${resolvedDashboard.grid.rowHeight}px`,
              gridTemplateColumns: `repeat(${resolvedDashboard.grid.columns}, minmax(0, 1fr))`,
            }}
          >
            {resolvedDashboard.widgets.length === 0 ? (
              <div
                className="col-span-full flex items-center justify-center"
                style={{
                  gridColumn: `1 / span ${resolvedDashboard.grid.columns}`,
                  gridRow: "1 / span 6",
                }}
              >
                <div className="rounded-full border border-white/10 bg-[rgba(7,12,22,0.84)] px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground shadow-[0_14px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
                  Use the toolbar to add components
                </div>
              </div>
            ) : null}

            {resolvedDashboard.widgets.map((instance) => {
              const widget = getWidgetById(instance.widgetId);

              if (!widget) {
                return (
                  <div
                    key={instance.id}
                    style={layoutToStyle(instance.layout)}
                    className="relative z-10 flex items-center justify-center rounded-[20px] border border-dashed border-danger/40 bg-danger/8 p-5 text-center text-sm text-muted-foreground"
                  >
                    Missing widget definition: {instance.widgetId}
                  </div>
                );
              }

              return (
                <BuilderWidgetCard
                  key={instance.id}
                  instanceId={instance.id}
                  instanceTitle={instance.title}
                  layout={instance.layout}
                  selected={selectedInstanceId === instance.id}
                  editable={editMode}
                  style={layoutToStyle(instance.layout)}
                  widget={widget}
                  widgetProps={instance.props ?? {}}
                  expanded={expandedInstanceId === instance.id}
                  onRemove={(instanceId) => {
                    updateSelectedWorkspace((dashboard) =>
                      removeDashboardWidget(dashboard, instanceId),
                    );
                    setSelectedInstanceId((current) => (current === instanceId ? null : current));
                    setExpandedInstanceId((current) => (current === instanceId ? null : current));
                  }}
                  onSelect={(instanceId) => {
                    setSelectedInstanceId(instanceId);
                  }}
                  onStartDrag={(event) => {
                    startInteraction("drag", instance.id, instance.layout, event);
                  }}
                  onStartResize={(event) => {
                    startInteraction("resize", instance.id, instance.layout, event);
                  }}
                  onToggleExpanded={(instanceId) => {
                    setExpandedInstanceId((current) => (current === instanceId ? null : instanceId));
                    setLibraryOpen(false);
                  }}
                />
              );
            })}
          </div>

          {hoveredPlacementBounds && catalogDragPayload && editMode ? (
            <div
              className="pointer-events-none absolute rounded-[10px] border border-dashed border-primary/80 bg-primary/18"
              style={{
                left: `${hoveredPlacementBounds.left}px`,
                top: `${hoveredPlacementBounds.top}px`,
                width: `${hoveredPlacementBounds.width}px`,
                height: `${hoveredPlacementBounds.height}px`,
              }}
            />
          ) : null}
        </div>
      </div>

        <aside
          className={cn(
            "absolute top-16 left-4 bottom-4 z-30 w-[320px] max-w-[calc(100%-2rem)] overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(7,12,22,0.92)] shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-transform duration-200",
            libraryOpen ? "translate-x-0" : "-translate-x-[calc(100%+24px)]",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-4">
              <div>
                <div className="text-sm font-semibold text-foreground">Components</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Drag onto the canvas or add directly.
                </div>
              </div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                aria-label="Close components"
                onClick={() => {
                  setLibraryOpen(false);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-white/8 px-4 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="border-white/10 bg-white/[0.04] pl-9"
                  value={catalogQuery}
                  onChange={(event) => {
                    setCatalogQuery(event.target.value);
                  }}
                  placeholder="Search components"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              <div className="space-y-3">
                {filteredWidgets.map((widget) => (
                  <div
                    key={widget.id}
                    className={cn(
                      "rounded-[18px] border border-white/8 bg-white/[0.03] p-3 transition-colors",
                      editMode ? "cursor-grab active:cursor-grabbing" : undefined,
                    )}
                    onPointerDown={(event) => {
                      handleCatalogPointerStart(widget, event);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {widget.title}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {widget.description}
                        </div>
                      </div>
                      <Badge variant="neutral">
                        {widget.defaultSize.w * CUSTOM_WORKSPACE_COLUMN_SCALE} x{" "}
                        {widget.defaultSize.h * CUSTOM_WORKSPACE_ROW_SCALE}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="neutral">{titleCase(widget.category)}</Badge>
                      <Badge variant="neutral">{widget.kind}</Badge>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {editMode ? "Drag to canvas" : "Open edit to place"}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                        }}
                        onClick={() => {
                          handleCatalogAdd(widget);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                  </div>
                ))}

                {filteredWidgets.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-center text-sm text-muted-foreground">
                    No components match the current search.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        {expandedWidget ? (
          <div
            className="absolute inset-0 z-50 bg-[rgba(2,6,17,0.68)] backdrop-blur-sm"
            onClick={() => {
              setExpandedInstanceId(null);
            }}
          >
            <div className="absolute inset-4" onClick={(event) => event.stopPropagation()}>
              {(() => {
                const expandedWidgetDefinition = getWidgetById(expandedWidget.widgetId);

                if (!expandedWidgetDefinition) {
                  return null;
                }

                return (
                  <BuilderWidgetCard
                    instanceId={expandedWidget.id}
                    instanceTitle={expandedWidget.title}
                    layout={expandedWidget.layout}
                    selected={false}
                    editable={false}
                    expanded
                    style={{ height: "100%" }}
                    widget={expandedWidgetDefinition}
                    widgetProps={expandedWidget.props ?? {}}
                    onRemove={() => {}}
                    onSelect={() => {}}
                    onStartDrag={() => {}}
                    onStartResize={() => {}}
                    onToggleExpanded={() => {
                      setExpandedInstanceId(null);
                    }}
                  />
                );
              })()}
            </div>
          </div>
        ) : null}

        {activeCatalogDrag ? (
          <div
            className="pointer-events-none fixed z-[90]"
            style={{
              left: activeCatalogDrag.clientX + 14,
              top: activeCatalogDrag.clientY + 14,
            }}
          >
            <div className="rounded-[16px] border border-primary/30 bg-[rgba(7,12,22,0.92)] px-3 py-2 shadow-[0_18px_48px_rgba(0,0,0,0.32)] backdrop-blur-xl">
              <div className="text-xs font-medium text-foreground">
                {widgetMap.get(activeCatalogDrag.widgetId)?.title ?? "Component"}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Drop on canvas
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardControlsProvider>
  );
}
