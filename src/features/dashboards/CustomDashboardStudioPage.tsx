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
  Clock3,
  ChevronUp,
  GripVertical,
  LayoutTemplate,
  MoveDiagonal2,
  Pencil,
  Plus,
  Save,
  Search,
  Settings2,
  Star,
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
import { Select } from "@/components/ui/select";
import {
  DashboardControlsProvider,
  DashboardDataControls,
  DashboardRefreshProgressLine,
} from "@/dashboards/DashboardControls";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import {
  isWorkspaceRowWidgetId,
  WORKSPACE_ROW_HEIGHT_ROWS,
} from "@/dashboards/structural-widgets";
import type { DashboardWidgetPlacement, ResolvedDashboardWidgetLayout } from "@/dashboards/types";
import { cn, titleCase } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import {
  resolveWidgetHeaderVisibility,
  resolveWidgetMinimalChrome,
  widgetShellClassName,
  widgetShellHeaderClassName,
} from "@/widgets/shared/chrome";
import type { WidgetDefinition, WidgetHeaderActionsProps } from "@/widgets/types";
import {
  appendCatalogWidget,
  CUSTOM_WORKSPACE_COLUMN_SCALE,
  CUSTOM_WORKSPACE_ROW_SCALE,
  duplicateDashboardWidget,
  placeCatalogWidget,
  removeDashboardWidget,
  setDashboardWidgetGeometry,
  updateDashboardControlsState,
  updateDashboardWidgetRuntimeState,
  updateDashboardWidgetSettings,
} from "./custom-dashboard-storage";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import {
  loadWidgetCatalogPreferences,
  pushRecentWidgetId,
  saveWidgetCatalogPreferences,
} from "./widget-catalog-preferences";
import {
  WidgetDuplicateTrigger,
  WidgetSettingsDialog,
  WidgetSettingsTrigger,
} from "@/widgets/shared/widget-settings";
import { WidgetCanvasControls } from "@/widgets/shared/widget-canvas-controls";
import { MissingWidgetFrame } from "@/widgets/shared/widget-frame";
import { WidgetExplorerTrigger } from "@/widgets/shared/widget-explorer-trigger";
import type { WidgetInstancePresentation } from "@/widgets/types";

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

type CatalogScope = "browse" | "favorites" | "recent";

interface CatalogSection {
  id: string;
  title: string;
  description?: string;
  widgets: WidgetDefinition[];
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

function getWidgetCatalogSearchScore(widget: WidgetDefinition, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();

  if (!query) {
    return 0;
  }

  const terms = query.split(/\s+/).filter(Boolean);
  const title = widget.title.toLowerCase();
  const description = widget.description.toLowerCase();
  const category = widget.category.toLowerCase();
  const kind = widget.kind.toLowerCase();
  const source = widget.source.toLowerCase();
  const tags = widget.tags?.join(" ").toLowerCase() ?? "";

  let score = 0;

  for (const term of terms) {
    let termScore = 0;

    if (title === term) {
      termScore = Math.max(termScore, 140);
    } else if (title.startsWith(term)) {
      termScore = Math.max(termScore, 100);
    } else if (title.includes(term)) {
      termScore = Math.max(termScore, 70);
    }

    if (tags.includes(term)) {
      termScore = Math.max(termScore, 50);
    }

    if (category.includes(term) || kind.includes(term) || source.includes(term)) {
      termScore = Math.max(termScore, 35);
    }

    if (description.includes(term)) {
      termScore = Math.max(termScore, 20);
    }

    if (termScore === 0) {
      return -1;
    }

    score += termScore;
  }

  return score;
}

function CatalogScopeButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/70 bg-background/35 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
      onClick={onClick}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] tracking-[0.12em]",
          active ? "bg-primary/14 text-primary" : "bg-muted/70 text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function CatalogSectionHeader({
  title,
  count,
  description,
}: {
  title: string;
  count: number;
  description?: string;
}) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">
          {title}
        </div>
        {description ? (
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <Badge variant="neutral" className="shrink-0 px-2 py-0.5 text-[10px] tracking-[0.12em]">
        {count}
      </Badge>
    </div>
  );
}

function CatalogWidgetRow({
  editable,
  favorite,
  onAdd,
  onPointerDown,
  onToggleFavorite,
  widget,
}: {
  editable: boolean;
  favorite: boolean;
  onAdd: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleFavorite: () => void;
  widget: WidgetDefinition;
}) {
  const sizeLabel = `${widget.defaultSize.w * CUSTOM_WORKSPACE_COLUMN_SCALE} x ${
    widget.defaultSize.h * CUSTOM_WORKSPACE_ROW_SCALE
  }`;

  return (
    <div
      className={cn(
        "rounded-[18px] border border-border/70 bg-background/35 px-3 py-3 transition-colors hover:bg-background/55",
        editable ? "cursor-grab active:cursor-grabbing" : undefined,
      )}
      onPointerDown={onPointerDown}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
            favorite
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/70 bg-background/35 text-muted-foreground hover:text-foreground",
          )}
          aria-label={favorite ? `Remove ${widget.title} from favorites` : `Favorite ${widget.title}`}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
        >
          <Star className={cn("h-4 w-4", favorite ? "fill-current" : undefined)} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {editable ? <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
            <div className="min-w-0 truncate text-sm font-medium text-foreground">{widget.title}</div>
            <Badge variant="neutral" className="shrink-0 px-2 py-0.5 text-[10px] tracking-[0.12em]">
              {titleCase(widget.kind)}
            </Badge>
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{widget.description}</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>{widget.category}</span>
            <span>{titleCase(widget.source)}</span>
            <span>{sizeLabel}</span>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

function BuilderWidgetCard({
  instanceId,
  instanceTitle,
  layout,
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
  onPropsChange,
  onPresentationChange,
  onRuntimeStateChange,
  onSelect,
  onStartDrag,
  onStartResize,
  onOpenSettings,
}: {
  instanceId: string;
  instanceTitle?: string;
  layout: ResolvedDashboardWidgetLayout;
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
  onStartDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onStartResize: (event: ReactPointerEvent<HTMLElement>) => void;
  onOpenSettings: (instanceId: string) => void;
}) {
  const Component = widget.component as ComponentType<{
    widget: typeof widget;
    instanceTitle?: string;
    props: Record<string, unknown>;
    runtimeState?: Record<string, unknown>;
    onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  }>;

  const title = instanceTitle ?? widget.title;
  const headerVisible = editable || resolveWidgetHeaderVisibility(widgetProps);
  const rowWidget = isWorkspaceRowWidgetId(widget.id);
  const minimalChrome = !rowWidget && resolveWidgetMinimalChrome(widgetProps);
  const floatingChromeWidget = rowWidget || minimalChrome;
  const structuralVisible = widgetProps.visible === true;
  const widgetRenderProps =
    rowWidget && editable && !structuralVisible
      ? {
          ...widgetProps,
          visible: true,
        }
      : widgetProps;
  const editControlsVisibilityClass = !editable
    ? "pointer-events-none opacity-0"
    : selected
      ? "opacity-100"
      : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100";

  return (
    <div
      style={style}
      className="group relative isolate h-full overflow-visible"
      onPointerDownCapture={() => {
        if (editable) {
          onSelect(instanceId);
        }
      }}
    >
      <WidgetCanvasControls
        widget={widget}
        props={widgetProps}
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

      <section
        data-widget-shell="default"
        className={cn(
          "relative z-10 flex h-full min-h-0 flex-col transition-colors",
          floatingChromeWidget
            ? "overflow-visible rounded-none border-none bg-transparent text-card-foreground shadow-none backdrop-blur-0"
            : cn(
                widgetShellClassName,
                "overflow-hidden rounded-[20px] border bg-card/92 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur-xl",
                selected && editable
                  ? "border-primary/70 ring-2 ring-primary/30"
                : "border-border/70 hover:border-border",
              ),
          floatingChromeWidget && editable ? "cursor-grab select-none active:cursor-grabbing" : undefined,
        )}
        onPointerDown={(event) => {
          if (!editable || !floatingChromeWidget) {
            return;
          }

          const target = event.target as HTMLElement;

          if (target.closest("button, a, input, textarea, select, [data-no-widget-drag='true']")) {
            return;
          }

          onStartDrag(event);
        }}
      >
        {headerVisible && !floatingChromeWidget ? (
        <header
          data-widget-shell-header=""
          className={cn(
            widgetShellHeaderClassName,
            "flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5",
            editable ? "cursor-grab select-none active:cursor-grabbing" : undefined,
          )}
          onPointerDown={(event) => {
            if (!editable) {
              return;
            }

            const target = event.target as HTMLElement;

            if (target.closest("button, a, input, textarea, select, [data-no-widget-drag='true']")) {
              return;
            }

            onStartDrag(event);
          }}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-card-foreground">{title}</div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2">
            {headerActions ? (
              <div className="flex items-center gap-2" data-no-widget-drag="true">
                {headerActions}
              </div>
            ) : null}

            <WidgetExplorerTrigger
              widgetId={widget.id}
              widgetTitle={title}
              className="h-7 w-7 rounded-md border border-border/70 bg-background/35 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              data-no-widget-drag="true"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
            />

            <div
              className={cn("flex items-center gap-1 transition-opacity", editControlsVisibilityClass)}
            >
              <WidgetSettingsTrigger
                widgetTitle={title}
                className="h-7 w-7 rounded-md border border-border/70 bg-background/35 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                data-no-widget-drag="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenSettings(instanceId);
                }}
                tabIndex={editable ? 0 : -1}
                aria-hidden={!editable}
              />
              <WidgetDuplicateTrigger
                widgetTitle={title}
                className="h-7 w-7 rounded-md border border-border/70 bg-background/35 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                data-no-widget-drag="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onDuplicate(instanceId);
                }}
                tabIndex={editable ? 0 : -1}
                aria-hidden={!editable}
              />
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-danger/30 bg-danger/8 text-danger transition-colors hover:bg-danger/16"
                aria-label={`Remove ${title}`}
                data-no-widget-drag="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(instanceId);
                }}
                tabIndex={editable ? 0 : -1}
                aria-hidden={!editable}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>
        ) : null}

        {floatingChromeWidget ? (
        <div
          className={cn(
            "absolute z-20 flex items-center gap-1 rounded-full border border-border/70 bg-background/88 px-1.5 py-1 shadow-[var(--shadow-panel)] backdrop-blur-md transition-opacity",
            "top-1/2 right-0 -translate-y-1/2",
            editControlsVisibilityClass,
          )}
          data-no-widget-drag="true"
        >
          <WidgetExplorerTrigger
            widgetId={widget.id}
            widgetTitle={title}
            className="h-7 w-7 rounded-full border border-border/70 bg-background/40 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            data-no-widget-drag="true"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
          />
          <WidgetSettingsTrigger
            widgetTitle={title}
            className="h-7 w-7 rounded-full border border-border/70 bg-background/40 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            data-no-widget-drag="true"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onOpenSettings(instanceId);
            }}
            tabIndex={editable ? 0 : -1}
            aria-hidden={!editable}
          />
          <WidgetDuplicateTrigger
            widgetTitle={title}
            className="h-7 w-7 rounded-full border border-border/70 bg-background/40 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            data-no-widget-drag="true"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(instanceId);
            }}
            tabIndex={editable ? 0 : -1}
            aria-hidden={!editable}
          />
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-danger/30 bg-danger/8 text-danger transition-colors hover:bg-danger/16"
            aria-label={`Remove ${title}`}
            data-no-widget-drag="true"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(instanceId);
            }}
            tabIndex={editable ? 0 : -1}
            aria-hidden={!editable}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        ) : null}

        <div
          className={cn(
            "min-h-0 flex-1",
            editable ? "pointer-events-none select-none" : undefined,
          )}
        >
          <Component
            widget={widget}
            instanceTitle={instanceTitle}
            props={widgetRenderProps}
            runtimeState={widgetRuntimeState}
            onRuntimeStateChange={(state) => {
              onRuntimeStateChange(instanceId, state);
            }}
          />
        </div>

        {selected && editable && !floatingChromeWidget ? (
          <button
            type="button"
            className="absolute right-3 bottom-3 flex h-8 w-8 cursor-se-resize items-center justify-center rounded-full border border-primary/40 bg-background/88 text-primary shadow-[var(--shadow-panel)] transition-colors hover:bg-muted/55"
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
    </div>
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
    persistenceMode,
    updateSelectedWorkspace,
    saveWorkspaceDraft,
  } = useCustomWorkspaceStudio();
  const backendMode = persistenceMode === "backend";
  const updateSelectedWorkspaceRef = useRef<typeof updateSelectedWorkspace | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("all");
  const [catalogKindFilter, setCatalogKindFilter] = useState<WidgetDefinition["kind"] | "all">("all");
  const [catalogSourceFilter, setCatalogSourceFilter] = useState("all");
  const [catalogScope, setCatalogScope] = useState<CatalogScope>("browse");
  const [favoriteWidgetIds, setFavoriteWidgetIds] = useState<string[]>([]);
  const [recentWidgetIds, setRecentWidgetIds] = useState<string[]>([]);
  const [catalogDragPayload, setCatalogDragPayload] = useState<CatalogDragPayload | null>(null);
  const [activeCatalogDrag, setActiveCatalogDrag] = useState<ActiveCatalogDrag | null>(null);
  const [hoveredPlacement, setHoveredPlacement] = useState<DashboardWidgetPlacement | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [activeInteraction, setActiveInteraction] = useState<ActiveInteraction | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [settingsInstanceId, setSettingsInstanceId] = useState<string | null>(null);
  const [measuredGridMetrics, setMeasuredGridMetrics] = useState<GridMetrics | null>(null);
  const deferredCatalogQuery = useDeferredValue(catalogQuery);
  const dashboardMenuHidden = useShellStore((state) => state.workspaceCanvasMenuHidden);
  const setDashboardMenuHidden = useShellStore((state) => state.setWorkspaceCanvasMenuHidden);
  const catalogPreferencesUserId = user?.id ?? null;

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
  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(allowedWidgets.map((widget) => widget.category))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [allowedWidgets],
  );
  const kindOptions = useMemo(
    () =>
      Array.from(new Set(allowedWidgets.map((widget) => widget.kind))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [allowedWidgets],
  );
  const sourceOptions = useMemo(
    () =>
      Array.from(new Set(allowedWidgets.map((widget) => widget.source))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [allowedWidgets],
  );
  const favoriteWidgetSet = useMemo(() => new Set(favoriteWidgetIds), [favoriteWidgetIds]);
  const recentWidgetIndexMap = useMemo(
    () => new Map(recentWidgetIds.map((widgetId, index) => [widgetId, index])),
    [recentWidgetIds],
  );
  const favoriteWidgets = useMemo(
    () =>
      favoriteWidgetIds
        .map((widgetId) => widgetMap.get(widgetId))
        .filter((widget): widget is WidgetDefinition => Boolean(widget)),
    [favoriteWidgetIds, widgetMap],
  );
  const recentWidgets = useMemo(
    () =>
      recentWidgetIds
        .map((widgetId) => widgetMap.get(widgetId))
        .filter((widget): widget is WidgetDefinition => Boolean(widget)),
    [recentWidgetIds, widgetMap],
  );
  const catalogBaseWidgets = useMemo(() => {
    if (catalogScope === "favorites") {
      return favoriteWidgets;
    }

    if (catalogScope === "recent") {
      return recentWidgets;
    }

    return allowedWidgets;
  }, [allowedWidgets, catalogScope, favoriteWidgets, recentWidgets]);

  const filteredWidgets = useMemo(() => {
    const query = deferredCatalogQuery.trim().toLowerCase();
    const hasCategoryFilter = catalogCategoryFilter !== "all";
    const hasKindFilter = catalogKindFilter !== "all";
    const hasSourceFilter = catalogSourceFilter !== "all";

    return catalogBaseWidgets
      .map((widget) => ({
        widget,
        score: getWidgetCatalogSearchScore(widget, query),
      }))
      .filter(({ score, widget }) => {
        if (score < 0) {
          return false;
        }

        if (hasCategoryFilter && widget.category !== catalogCategoryFilter) {
          return false;
        }

        if (hasKindFilter && widget.kind !== catalogKindFilter) {
          return false;
        }

        if (hasSourceFilter && widget.source !== catalogSourceFilter) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const scoreDifference = right.score - left.score;

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        const favoriteDifference =
          Number(favoriteWidgetSet.has(right.widget.id)) - Number(favoriteWidgetSet.has(left.widget.id));

        if (favoriteDifference !== 0) {
          return favoriteDifference;
        }

        const leftRecentIndex = recentWidgetIndexMap.get(left.widget.id) ?? Number.MAX_SAFE_INTEGER;
        const rightRecentIndex = recentWidgetIndexMap.get(right.widget.id) ?? Number.MAX_SAFE_INTEGER;

        if (leftRecentIndex !== rightRecentIndex) {
          return leftRecentIndex - rightRecentIndex;
        }

        return left.widget.title.localeCompare(right.widget.title);
      })
      .map(({ widget }) => widget);
  }, [
    catalogBaseWidgets,
    catalogCategoryFilter,
    catalogKindFilter,
    catalogSourceFilter,
    deferredCatalogQuery,
    favoriteWidgetSet,
    recentWidgetIndexMap,
  ]);
  const catalogFiltersActive =
    catalogCategoryFilter !== "all" || catalogKindFilter !== "all" || catalogSourceFilter !== "all";
  const catalogSearchActive = deferredCatalogQuery.trim().length > 0;
  const catalogSections = useMemo<CatalogSection[]>(() => {
    if (catalogScope === "favorites") {
      return [
        {
          id: "favorites",
          title: "Favorites",
          description: "Pin the components you reach for most often.",
          widgets: filteredWidgets,
        },
      ];
    }

    if (catalogScope === "recent") {
      return [
        {
          id: "recent",
          title: "Recently used",
          description: "Components you placed most recently.",
          widgets: filteredWidgets,
        },
      ];
    }

    if (catalogSearchActive || catalogFiltersActive) {
      return [
        {
          id: "results",
          title: "Results",
          description: "Filtered components for the current search.",
          widgets: filteredWidgets,
        },
      ];
    }

    const sections: CatalogSection[] = [];

    if (favoriteWidgets.length > 0) {
      sections.push({
        id: "favorites",
        title: "Favorites",
        description: "Pinned components stay at the top for quick access.",
        widgets: favoriteWidgets,
      });
    }

    if (recentWidgets.length > 0) {
      sections.push({
        id: "recent",
        title: "Recently used",
        description: "Latest components added to a workspace.",
        widgets: recentWidgets,
      });
    }

    const widgetsByCategory = allowedWidgets.reduce<Map<string, WidgetDefinition[]>>((groups, widget) => {
      const current = groups.get(widget.category) ?? [];
      current.push(widget);
      groups.set(widget.category, current);
      return groups;
    }, new Map());

    Array.from(widgetsByCategory.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([category, widgets]) => {
        sections.push({
          id: `category:${category}`,
          title: category,
          widgets: [...widgets].sort((left, right) => {
            const leftFavorite = favoriteWidgetSet.has(left.id);
            const rightFavorite = favoriteWidgetSet.has(right.id);

            if (leftFavorite !== rightFavorite) {
              return Number(rightFavorite) - Number(leftFavorite);
            }

            return left.title.localeCompare(right.title);
          }),
        });
      });

    return sections;
  }, [
    allowedWidgets,
    catalogFiltersActive,
    catalogScope,
    catalogSearchActive,
    favoriteWidgetSet,
    favoriteWidgets,
    filteredWidgets,
    recentWidgets,
  ]);

  useEffect(() => {
    updateSelectedWorkspaceRef.current = updateSelectedWorkspace;
  }, [updateSelectedWorkspace]);

  useEffect(() => {
    if (!catalogPreferencesUserId) {
      setFavoriteWidgetIds([]);
      setRecentWidgetIds([]);
      return;
    }

    const preferences = loadWidgetCatalogPreferences(
      catalogPreferencesUserId,
      allowedWidgets.map((widget) => widget.id),
    );

    setFavoriteWidgetIds(preferences.favoriteWidgetIds);
    setRecentWidgetIds(preferences.recentWidgetIds);
  }, [allowedWidgets, catalogPreferencesUserId]);

  useEffect(() => {
    if (!catalogPreferencesUserId) {
      return;
    }

    saveWidgetCatalogPreferences(catalogPreferencesUserId, {
      favoriteWidgetIds,
      recentWidgetIds,
    });
  }, [catalogPreferencesUserId, favoriteWidgetIds, recentWidgetIds]);

  const selectedLayout = useMemo(
    () =>
      editMode
        ? resolvedDashboard?.widgets.find((widget) => widget.id === selectedInstanceId)?.layout ?? null
        : null,
    [editMode, resolvedDashboard, selectedInstanceId],
  );

  const settingsWidget = useMemo(
    () =>
      resolvedDashboard?.widgets.find((widget) => widget.id === settingsInstanceId) ?? null,
    [resolvedDashboard, settingsInstanceId],
  );
  const settingsWidgetDefinition = useMemo(
    () => (settingsWidget ? getWidgetById(settingsWidget.widgetId) : null),
    [settingsWidget],
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
    setSettingsInstanceId(null);
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
      settingsInstanceId &&
      !resolvedDashboard?.widgets.some((widget) => widget.id === settingsInstanceId)
    ) {
      setSettingsInstanceId(null);
    }
  }, [resolvedDashboard, selectedInstanceId, settingsInstanceId]);

  const selectedBounds = useMemo(
    () =>
      selectedLayout && measuredGridMetrics
        ? getLayoutBounds(selectedLayout, measuredGridMetrics)
        : null,
    [measuredGridMetrics, selectedLayout],
  );

  const hoveredPlacementBounds = useMemo(() => {
    if (!hoveredPlacement || !measuredGridMetrics || !activeCatalogDrag) {
      return null;
    }

    const draggedWidget = widgetMap.get(activeCatalogDrag.widgetId);

    if (!draggedWidget) {
      return getPlacementBounds(hoveredPlacement, measuredGridMetrics);
    }

    if (isWorkspaceRowWidgetId(draggedWidget.id)) {
      return {
        left: 0,
        top: (hoveredPlacement.y ?? 0) * measuredGridMetrics.stepY,
        width: measuredGridMetrics.rect.width,
        height: WORKSPACE_ROW_HEIGHT_ROWS * measuredGridMetrics.rowHeight,
      };
    }

    return getPlacementBounds(hoveredPlacement, measuredGridMetrics);
  }, [activeCatalogDrag, hoveredPlacement, measuredGridMetrics, widgetMap]);

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
          setRecentWidgetIds((current) => pushRecentWidgetId(current, widget.id));
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
    setRecentWidgetIds((current) => pushRecentWidgetId(current, widget.id));
    updateSelectedWorkspace((dashboard) => appendCatalogWidget(dashboard, widget));
  }

  function handleCatalogFavoriteToggle(widgetId: string) {
    setFavoriteWidgetIds((current) =>
      current.includes(widgetId)
        ? current.filter((entry) => entry !== widgetId)
        : [widgetId, ...current],
    );
  }

  function handleCatalogFiltersReset() {
    setCatalogQuery("");
    setCatalogCategoryFilter("all");
    setCatalogKindFilter("all");
    setCatalogSourceFilter("all");
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

  function handleWidgetRuntimeStateChange(
    instanceId: string,
    runtimeState: Record<string, unknown> | undefined,
  ) {
    updateSelectedWorkspace((dashboard) =>
      updateDashboardWidgetRuntimeState(dashboard, instanceId, runtimeState),
    );
  }

  if (!user) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        Resolve a user session before opening Workspaces.
      </div>
    );
  }

  if (!selectedDashboard || !resolvedDashboard) {
    return null;
  }

  return (
    <DashboardControlsProvider
      key={selectedDashboard.id}
      controls={selectedDashboard.controls}
      onStateChange={(state) => {
        updateSelectedWorkspace((dashboard) => updateDashboardControlsState(dashboard, state));
      }}
    >
      <DashboardWidgetRegistryProvider widgets={resolvedDashboard.widgets}>
        <div
          className="relative h-full min-h-full overflow-hidden"
          style={{ backgroundColor: "var(--workspace-canvas-base-color)" }}
        >
        <DashboardRefreshProgressLine />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "var(--workspace-canvas-background)" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "var(--workspace-canvas-overlay)" }}
        />

        {!dashboardMenuHidden ? (
          <div className="pointer-events-none absolute top-2 left-4 right-4 z-40">
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
                        `${getAppPath("workspace-studio", "workspaces")}?workspace=${encodeURIComponent(selectedDashboard.id)}&view=settings`,
                      );
                    }}
                  >
                      <Settings2 className="h-3.5 w-3.5" />
                    </WorkspaceToolbarButton>
                    <WorkspaceToolbarButton
                      title="Hide dashboard menu"
                      onClick={() => {
                        setDashboardMenuHidden(true);
                      }}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </WorkspaceToolbarButton>
                  </>
                }
              />
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "absolute inset-0 overflow-auto pl-2 pr-4 pb-4 transition-[padding] duration-200",
            dashboardMenuHidden ? "pt-3" : "pt-12",
          )}
        >
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
                <div className="rounded-full border border-border/70 bg-card/82 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground shadow-[var(--shadow-panel)] backdrop-blur-xl">
                  Use the toolbar to add components
                </div>
              </div>
            ) : null}

            {resolvedDashboard.widgets.map((instance) => {
              const widget = getWidgetById(instance.widgetId);

              if (!widget) {
                return (
                  <MissingWidgetFrame
                    key={instance.id}
                    widgetId={instance.widgetId}
                    style={layoutToStyle(instance.layout)}
                    onRemove={() => {
                      updateSelectedWorkspace((dashboard) =>
                        removeDashboardWidget(dashboard, instance.id),
                      );
                      setSelectedInstanceId((current) => (current === instance.id ? null : current));
                      setSettingsInstanceId((current) => (current === instance.id ? null : current));
                    }}
                  />
                );
              }

              const HeaderActions =
                widget.headerActions as
                  | ComponentType<WidgetHeaderActionsProps<Record<string, unknown>>>
                  | undefined;

              return (
                <BuilderWidgetCard
                  key={instance.id}
                  instanceId={instance.id}
                  instanceTitle={instance.title}
                  layout={instance.layout}
                  selected={selectedInstanceId === instance.id}
                  editable={editMode}
                  style={layoutToStyle(instance.layout)}
                  headerActions={
                    HeaderActions ? (
                      <HeaderActions
                        widget={widget}
                        props={instance.props ?? {}}
                        runtimeState={instance.runtimeState}
                        onRuntimeStateChange={(state) => {
                          handleWidgetRuntimeStateChange(instance.id, state);
                        }}
                      />
                    ) : undefined
                  }
                  widget={widget}
                  widgetProps={instance.props ?? {}}
                  widgetPresentation={instance.presentation}
                  widgetRuntimeState={instance.runtimeState}
                  onRemove={(instanceId) => {
                    updateSelectedWorkspace((dashboard) =>
                      removeDashboardWidget(dashboard, instanceId),
                    );
                    setSelectedInstanceId((current) => (current === instanceId ? null : current));
                  }}
                  onDuplicate={(instanceId) => {
                    updateSelectedWorkspace((dashboard) =>
                      duplicateDashboardWidget(dashboard, instanceId),
                    );
                  }}
                  onPropsChange={(instanceId, props) => {
                    updateSelectedWorkspace((dashboard) =>
                      updateDashboardWidgetSettings(dashboard, instanceId, {
                        props,
                      }),
                    );
                  }}
                  onPresentationChange={(instanceId, presentation) => {
                    updateSelectedWorkspace((dashboard) =>
                      updateDashboardWidgetSettings(dashboard, instanceId, {
                        presentation,
                      }),
                    );
                  }}
                  onRuntimeStateChange={handleWidgetRuntimeStateChange}
                  onSelect={(instanceId) => {
                    setSelectedInstanceId(instanceId);
                  }}
                  onStartDrag={(event) => {
                    startInteraction("drag", instance.id, instance.layout, event);
                  }}
                  onStartResize={(event) => {
                    startInteraction("resize", instance.id, instance.layout, event);
                  }}
                  onOpenSettings={(instanceId) => {
                    setSelectedInstanceId(instanceId);
                    setSettingsInstanceId(instanceId);
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
            "absolute left-4 bottom-4 z-30 w-[420px] max-w-[calc(100%-2rem)] overflow-hidden rounded-[24px] border border-border/70 bg-card/92 shadow-[var(--shadow-panel)] backdrop-blur-xl transition-[top,transform] duration-200",
            dashboardMenuHidden ? "top-4" : "top-12",
            libraryOpen ? "translate-x-0" : "-translate-x-[calc(100%+24px)]",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-border/70 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">Components</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Search, filter, favorite, or drag directly onto the canvas.
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background/35 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  aria-label="Close components"
                  onClick={() => {
                    setLibraryOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="border-border/70 bg-background/45 pl-9"
                  value={catalogQuery}
                  onChange={(event) => {
                    setCatalogQuery(event.target.value);
                  }}
                  placeholder="Search by name, category, source, or tag"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <CatalogScopeButton
                  active={catalogScope === "browse"}
                  count={allowedWidgets.length}
                  label="Browse"
                  onClick={() => {
                    setCatalogScope("browse");
                  }}
                />
                <CatalogScopeButton
                  active={catalogScope === "favorites"}
                  count={favoriteWidgets.length}
                  label="Favorites"
                  onClick={() => {
                    setCatalogScope("favorites");
                  }}
                />
                <CatalogScopeButton
                  active={catalogScope === "recent"}
                  count={recentWidgets.length}
                  label="Recent"
                  onClick={() => {
                    setCatalogScope("recent");
                  }}
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Select
                  value={catalogCategoryFilter}
                  onChange={(event) => {
                    setCatalogCategoryFilter(event.target.value);
                  }}
                >
                  <option value="all">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
                <Select
                  value={catalogKindFilter}
                  onChange={(event) => {
                    setCatalogKindFilter(event.target.value as WidgetDefinition["kind"] | "all");
                  }}
                >
                  <option value="all">All kinds</option>
                  {kindOptions.map((kind) => (
                    <option key={kind} value={kind}>
                      {titleCase(kind)}
                    </option>
                  ))}
                </Select>
                <Select
                  value={catalogSourceFilter}
                  onChange={(event) => {
                    setCatalogSourceFilter(event.target.value);
                  }}
                >
                  <option value="all">All sources</option>
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {titleCase(source)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {catalogSearchActive || catalogFiltersActive ? (
                    <span>{filteredWidgets.length} matching components</span>
                  ) : (
                    <span>{allowedWidgets.length} available components</span>
                  )}
                </div>
                {catalogSearchActive || catalogFiltersActive ? (
                  <Button size="sm" variant="ghost" onClick={handleCatalogFiltersReset}>
                    Clear filters
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {catalogSections.some((section) => section.widgets.length > 0) ? (
                <div className="space-y-5">
                  {catalogSections.map((section) =>
                    section.widgets.length > 0 ? (
                      <section key={section.id}>
                        <CatalogSectionHeader
                          title={section.title}
                          description={section.description}
                          count={section.widgets.length}
                        />
                        <div className="space-y-2">
                          {section.widgets.map((widget) => (
                            <CatalogWidgetRow
                              key={`${section.id}:${widget.id}`}
                              widget={widget}
                              editable={editMode}
                              favorite={favoriteWidgetSet.has(widget.id)}
                              onToggleFavorite={() => {
                                handleCatalogFavoriteToggle(widget.id);
                              }}
                              onAdd={() => {
                                handleCatalogAdd(widget);
                              }}
                              onPointerDown={(event) => {
                                handleCatalogPointerStart(widget, event);
                              }}
                            />
                          ))}
                        </div>
                      </section>
                    ) : null,
                  )}
                </div>
              ) : (
                <div className="rounded-[18px] border border-dashed border-border/70 bg-background/35 p-5 text-center">
                  <div className="text-sm font-medium text-foreground">
                    {allowedWidgets.length === 0
                      ? "No components are available for this workspace."
                      : catalogScope === "favorites"
                        ? "No favorite components yet."
                        : catalogScope === "recent"
                          ? "No recent components yet."
                          : "No components match the current search."}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {allowedWidgets.length === 0
                      ? "Your current permissions do not expose any widget definitions here."
                      : catalogScope === "favorites"
                        ? "Use the star on a component to pin it for faster access."
                        : catalogScope === "recent"
                          ? "Components you add to a workspace will appear here."
                          : "Try another search or clear the active filters."}
                  </div>
                  {catalogSearchActive || catalogFiltersActive ? (
                    <Button className="mt-4" size="sm" variant="outline" onClick={handleCatalogFiltersReset}>
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </aside>

        {settingsWidget && settingsWidgetDefinition ? (
          <WidgetSettingsDialog
            open
            widget={settingsWidgetDefinition}
            instance={settingsWidget}
            persistenceNote={
              "Changes apply to this workspace draft immediately. Save workspace when you want to persist them."
            }
            onClose={() => {
              setSettingsInstanceId(null);
            }}
            onSave={({ title, props, presentation }) => {
              setEditMode(true);
              updateSelectedWorkspace((dashboard) =>
                updateDashboardWidgetSettings(dashboard, settingsWidget.id, {
                  title,
                  props,
                  presentation,
                }),
              );
            }}
          />
        ) : null}

        {activeCatalogDrag ? (
          <div
            className="pointer-events-none fixed z-[90]"
            style={{
              left: activeCatalogDrag.clientX + 14,
              top: activeCatalogDrag.clientY + 14,
            }}
          >
            <div className="rounded-[16px] border border-primary/30 bg-card/92 px-3 py-2 shadow-[var(--shadow-panel)] backdrop-blur-xl">
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
      </DashboardWidgetRegistryProvider>
    </DashboardControlsProvider>
  );
}
