import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import GridLayout, {
  verticalCompactor,
  type Layout as ReactGridLayoutLayout,
  type LayoutItem as ReactGridLayoutItem,
  type ResizeHandleAxis,
} from "react-grid-layout";

import {
  BookOpenText,
  Bug,
  Boxes,
  Camera,
  Clock3,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  GripVertical,
  Pencil,
  Plus,
  Rows3,
  Save,
  Search,
  Settings2,
  Star,
  Loader2,
  Waypoints,
  X,
} from "lucide-react";

import { appRegistry, getWidgetById } from "@/app/registry";
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
import {
  DashboardWidgetDependenciesProvider,
} from "@/dashboards/DashboardWidgetDependencies";
import {
  DashboardWidgetExecutionProvider,
  useDashboardWidgetExecution,
} from "@/dashboards/DashboardWidgetExecution";
import { DashboardWidgetRegistryProvider } from "@/dashboards/DashboardWidgetRegistry";
import { shouldMountSidebarOnlyWidgets } from "@/dashboards/dashboard-surface-hydration";
import {
  resolveDashboardCanvasCompanionCandidates,
  parseCompanionItemId,
  resolveDashboardCompanionMap,
  resolveDashboardCompanionLayoutMap,
  type DashboardCanvasCompanionCandidate,
  type ResolvedDashboardWidgetEntry,
} from "@/dashboards/canvas-items";
import {
  resolvedDashboardToGridLayout,
  type WorkspaceGridLayoutItem,
  workspaceGridDraggableCancelSelector,
  workspaceGridDraggableCancelClassName,
  workspaceGridDraggableHandleSelector,
  workspaceGridDraggableHandleClassName,
} from "@/dashboards/react-grid-layout-adapter";
import {
  resolveAutoGridTemplateColumns,
  resolveCustomRuntimeGridLayout,
} from "@/dashboards/responsive-layout";
import {
  getWorkspaceRowChildCount,
  isWorkspaceRowCollapsed,
  isWorkspaceRowWidgetId,
  WORKSPACE_SLIDE_WIDGET_ID,
  WORKSPACE_ROW_HEIGHT_ROWS,
  WORKSPACE_ROW_WIDGET_ID,
} from "@/dashboards/structural-widgets";
import type {
  DashboardDefinition,
  DashboardLayoutKind,
  DashboardSlideRegionId,
  DashboardWidgetPlacement,
  ResolvedDashboardDefinition,
  ResolvedDashboardWidgetLayout,
} from "@/dashboards/types";
import { cn, titleCase } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import { useRegisteredWidgetTypesCatalog } from "@/widgets/registered-widget-types-api";
import { resolveWidgetSidebarOnly } from "@/widgets/shared/chrome";
import {
  getVisibleWidgetSchemaFields,
  resolveWidgetFieldState,
  resolveWidgetInstancePresentation,
  useResolvedWidgetControllerContext,
} from "@/widgets/shared/widget-schema";
import type {
  WidgetDefinition,
  WidgetHeaderActionsProps,
} from "@/widgets/types";
import {
  appendCatalogWidgetToSlideRegion,
  commitDashboardCompanionLayout,
  commitDashboardGridLayout,
  commitDashboardSlideRegionLayout,
  appendCatalogWidget,
  collapseDashboardRow,
  duplicateDashboardWidget,
  expandDashboardRow,
  moveDashboardWidgetToRootCanvas,
  moveDashboardWidgetToSlideRegion,
  placeCatalogWidget,
  reorderDashboardWidgets,
  removeDashboardWidget,
  updateDashboardControlsState,
  updateDashboardWidgetRuntimeState,
  updateDashboardWidgetSettings,
} from "./custom-dashboard-storage";
import { SavedWidgetLibraryDialog } from "./SavedWidgetLibraryDialog";
import { SavedWidgetSaveDialog } from "./SavedWidgetSaveDialog";
import { WorkspaceComponentBrowser } from "./WorkspaceComponentBrowser";
import {
  WorkspaceSavingStatus,
  WorkspaceLoadingStatus,
  WorkspaceToolbarButton,
  WorkspaceWidgetRail,
} from "./WorkspaceChrome";
import { WorkspaceRequestDebugPanel } from "./WorkspaceRequestDebugPanel";
import { CustomWidgetSettingsPage } from "./CustomWidgetSettingsPage";
import {
  appendSavedWidgetGroupToDashboard,
  appendSavedWidgetInstanceToDashboard,
} from "./saved-widgets";
import {
  downloadWorkspaceSnapshotArchive,
  useWorkspaceSnapshotCaptureController,
  WorkspaceSnapshotStatusCard,
} from "./snapshot/WorkspaceSnapshotCapture";
import type { WorkspaceSnapshotCaptureProfile } from "./snapshot/types";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import { useWorkspaceStudioSurfaceConfig } from "./workspace-studio-surface-config";
import { normalizeDashboardDefinitionType } from "./workspace-definition-type";
import { isManagedDashboardWidgetHiddenFromNormalRail } from "./workspace-widget-visibility";
import {
  loadWidgetCatalogPreferences,
  pushRecentWidgetId,
  saveWidgetCatalogPreferences,
} from "./widget-catalog-preferences";
import {
  DEFAULT_WORKSPACE_CANVAS_BOTTOM_BUFFER_ROWS,
  DEFAULT_WORKSPACE_CANVAS_EDIT_MODE_BOTTOM_BUFFER_ROWS,
  resolveWorkspaceCanvasMinHeight,
} from "./workspace-canvas-height";
import { resolveWorkspaceWidgetIcon } from "./workspace-widget-icons";
import { WidgetErrorBoundary } from "@/widgets/shared/widget-error-boundary";
import { MissingWidgetFrame } from "@/widgets/shared/widget-frame";
import type { WidgetInstancePresentation } from "@/widgets/types";
import { WorkspaceCanvasWidgetCard as BuilderWidgetCard } from "./WorkspaceCanvasWidgetHost";
import {
  WORKSPACE_SLIDE_GRID_COLUMNS,
  WORKSPACE_SLIDE_GRID_ROW_HEIGHT,
  sanitizeWorkspaceSlideProps,
  type WorkspaceSlideRegionId,
} from "@/widgets/core/workspace-slide/slide-model";
import { WorkspaceSlideSurface } from "@/widgets/core/workspace-slide/WorkspaceSlideWidget";
import { WorkspaceSlideSubgridHost } from "./WorkspaceSlideSubgridHost";
import { PublicWorkspaceStatusBar } from "./PublicWorkspaceStatusBar";

interface CatalogDragPayload {
  widgetId: string;
}

interface ActiveCatalogDrag {
  widgetId: string;
  clientX: number;
  clientY: number;
}

interface AutoGridReorderState {
  draggedInstanceId: string;
  targetInstanceId: string | null;
  position: "before" | "after" | null;
}

type CatalogScope = "browse" | "favorites" | "recent";

interface CatalogSection {
  id: string;
  title: string;
  description?: string;
  widgets: WidgetDefinition[];
}

type CloneableWorkspaceGridLayoutItem = Pick<
  ReactGridLayoutItem,
  "h" | "i" | "isBounded" | "isDraggable" | "isResizable" | "maxH" | "maxW" | "minH" | "minW" | "moved" | "static" | "w" | "x" | "y"
>;

const slideRegionDraggableHandleClassName = "slide-region-grid-handle";
const slideRegionDraggableHandleSelector = `.${slideRegionDraggableHandleClassName}`;

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

function layoutToStyle(layout: ResolvedDashboardWidgetLayout): CSSProperties {
  return {
    gridColumn: `${layout.x + 1} / span ${layout.w}`,
    gridRow: `${layout.y + 1} / span ${layout.h}`,
  };
}

function autoGridItemStyle(
  layout: Pick<ResolvedDashboardWidgetLayout, "h">,
  options?: { fullWidth?: boolean },
): CSSProperties {
  return {
    minWidth: 0,
    gridRow: `span ${Math.max(1, layout.h)}`,
    gridColumn: options?.fullWidth ? "1 / -1" : undefined,
  };
}

function SidebarOnlyRuntimeMounts({
  sidebarOnlyWidgets,
  permissions,
  onRuntimeStateChange,
}: {
  sidebarOnlyWidgets: DashboardDefinition["widgets"];
  permissions: readonly string[];
  onRuntimeStateChange: (
    instanceId: string,
    state: Record<string, unknown> | undefined,
  ) => void;
}) {
  const widgetExecution = useDashboardWidgetExecution();
  const mountSidebarOnlyWidgets = shouldMountSidebarOnlyWidgets({
    dashboardSurfaceHydrationActive:
      widgetExecution?.dashboardSurfaceHydrationActive === true,
  });

  if (!mountSidebarOnlyWidgets) {
    return null;
  }

  return (
    <>
      {sidebarOnlyWidgets.map((instance) => {
        const widget = getWidgetById(instance.widgetId);

        if (!widget) {
          return null;
        }

        const required = [
          ...(widget.requiredPermissions ?? []),
          ...(instance.requiredPermissions ?? []),
        ];

        if (!hasAllPermissions(permissions, required)) {
          return null;
        }

        const Component = widget.component as ComponentType<{
          widget: typeof widget;
          instanceId?: string;
          instanceTitle?: string;
          props: Record<string, unknown>;
          presentation?: WidgetInstancePresentation;
          runtimeState?: Record<string, unknown>;
          onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
        }>;

        return (
          <div
            key={instance.id}
            className="h-px w-px overflow-hidden"
            data-workspace-widget-instance-id={instance.id}
            data-workspace-widget-id={widget.id}
            data-workspace-widget-visibility="hidden"
          >
            <WidgetErrorBoundary
              widgetId={widget.id}
              widgetTitle={instance.title ?? widget.title}
              instanceId={instance.id}
              surface="hidden"
            >
              <Component
                widget={widget}
                instanceId={instance.id}
                instanceTitle={instance.title}
                props={instance.props ?? {}}
                presentation={instance.presentation}
                runtimeState={instance.runtimeState}
                onRuntimeStateChange={(state) => {
                  onRuntimeStateChange(instance.id, state);
                }}
              />
            </WidgetErrorBoundary>
          </div>
        );
      })}
    </>
  );
}

function DashboardSurfaceReturnOverlay() {
  const widgetExecution = useDashboardWidgetExecution();

  if (widgetExecution?.dashboardSurfaceHydrationReason !== "surface-return") {
    return null;
  }

  return (
    <div className="absolute inset-0 z-35 flex items-center justify-center bg-background/36 backdrop-blur-sm">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-sm">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        <span>Loading canvas…</span>
      </div>
    </div>
  );
}

function resolveAutoGridDropPosition(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): "before" | "after" {
  const offsetX = clientX - rect.left;
  const offsetY = clientY - rect.top;
  const widthRatio = rect.width > 0 ? offsetX / rect.width : 0;
  const heightRatio = rect.height > 0 ? offsetY / rect.height : 0;

  if (rect.width >= rect.height) {
    return widthRatio < 0.5 ? "before" : "after";
  }

  return heightRatio < 0.5 ? "before" : "after";
}

function isAutoGridReorderTarget(target: HTMLElement | null) {
  return Boolean(target?.closest("button, input, textarea, select, a, [data-no-widget-drag='true']"));
}

function layoutToAbsoluteStyle(
  layout: ResolvedDashboardWidgetLayout,
  metrics: GridMetrics,
): CSSProperties {
  const bounds = getLayoutBounds(layout, metrics);

  return {
    position: "absolute",
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  };
}

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function compareWorkspaceGridItems(
  left: Pick<WorkspaceGridLayoutItem, "i" | "x" | "y">,
  right: Pick<WorkspaceGridLayoutItem, "i" | "x" | "y">,
) {
  if (left.y !== right.y) {
    return left.y - right.y;
  }

  if (left.x !== right.x) {
    return left.x - right.x;
  }

  return left.i.localeCompare(right.i);
}

function cloneWorkspaceGridLayout(
  layout: readonly CloneableWorkspaceGridLayoutItem[],
) {
  return layout.map((item) => ({
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    maxW: item.maxW,
    minH: item.minH,
    maxH: item.maxH,
    moved: item.moved,
    static: item.static,
    isDraggable: item.isDraggable,
    isResizable: item.isResizable,
    isBounded: item.isBounded,
  }));
}

function serializeWorkspaceGridLayout(
  layout: readonly CloneableWorkspaceGridLayoutItem[],
) {
  return JSON.stringify(
    [...layout]
      .sort(compareWorkspaceGridItems)
      .map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        maxW: item.maxW,
        minH: item.minH,
        maxH: item.maxH,
        moved: item.moved,
        static: item.static,
        isDraggable: item.isDraggable,
        isResizable: item.isResizable,
        isBounded: item.isBounded,
      })),
  );
}

function resolveGridItemInsetStyle(gap: number): CSSProperties | undefined {
  if (gap <= 0) {
    return undefined;
  }

  return {
    boxSizing: "border-box",
    padding: `${gap / 2}px`,
  };
}

const showWorkspaceCanvasEditGrid = false;

interface GridMetrics {
  rect: DOMRect;
  columns: number;
  gap: number;
  rowHeight: number;
  cellWidth: number;
  stepX: number;
  stepY: number;
}

interface ActiveCrossHostTransferDrag {
  instanceId: string;
  sourceHost: "root" | "slide";
  sourceSlideWidgetId?: string;
  sourceRegion?: WorkspaceSlideRegionId;
  lastClientX: number | null;
  lastClientY: number | null;
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
  const WidgetIcon = resolveWorkspaceWidgetIcon(widget);

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
            <WidgetIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 truncate text-sm font-medium text-foreground">{widget.title}</div>
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{widget.description}</div>
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

function GridCompanionCard({
  candidate,
  editable,
  onPropsChange,
  onPresentationChange,
  onRuntimeStateChange,
  onVisibilityChange,
}: {
  candidate: DashboardCanvasCompanionCandidate;
  editable: boolean;
  onPropsChange: (props: Record<string, unknown>) => void;
  onPresentationChange: (presentation: WidgetInstancePresentation) => void;
  onRuntimeStateChange: (runtimeState: Record<string, unknown> | undefined) => void;
  onVisibilityChange: (itemId: string, visible: boolean) => void;
}) {
  const context = useResolvedWidgetControllerContext(candidate.widget, {
    instanceId: candidate.instanceId,
    props: candidate.props,
    runtimeState: candidate.runtimeState,
    mode: "canvas",
  });
  const visibleField = useMemo(
    () =>
      getVisibleWidgetSchemaFields(candidate.widget, candidate.props, editable, context).find(
        (field) => field.id === candidate.fieldId,
      ) ?? null,
    [candidate.fieldId, candidate.props, candidate.widget, context, editable],
  );

  useEffect(() => {
    onVisibilityChange(candidate.itemId, Boolean(visibleField?.renderCanvas));
  }, [candidate.itemId, onVisibilityChange, visibleField]);

  if (!visibleField?.renderCanvas) {
    return null;
  }

  const CanvasRenderer = visibleField.renderCanvas;
  const fieldState = resolveWidgetFieldState(
    candidate.presentation,
    visibleField,
    candidate.fieldIndex,
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border border-border/70 bg-background/18 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur-md">
      <div
        className={cn(
          workspaceGridDraggableHandleClassName,
          "flex min-h-7 items-center border-b border-border/70 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground",
          editable ? "cursor-grab select-none active:cursor-grabbing" : undefined,
        )}
      >
        <span className="truncate">{candidate.title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <CanvasRenderer
          field={visibleField}
          widget={candidate.widget}
          props={candidate.props}
          onPropsChange={onPropsChange}
          fieldState={fieldState}
          runtimeState={candidate.runtimeState}
          onRuntimeStateChange={onRuntimeStateChange}
          editable={editable}
          context={context}
        />
      </div>
    </div>
  );
}


function WorkspaceSnapshotToolbarControl({
  dashboard,
  permissions,
  profile,
  resolvedDashboard,
}: {
  dashboard: DashboardDefinition;
  resolvedDashboard: ResolvedDashboardDefinition;
  permissions: readonly string[];
  profile: WorkspaceSnapshotCaptureProfile;
}) {
  const { snapshotState, startCapture } = useWorkspaceSnapshotCaptureController({
    dashboard,
    resolvedDashboard,
    permissions,
    profile,
  });

  return (
    <>
      <WorkspaceToolbarButton
        active={snapshotState.status === "ready"}
        title="Create snapshot"
        onClick={() => {
          if (snapshotState.status === "running") {
            return;
          }

          void startCapture().then((state) => {
            if (state.status === "ready" && state.archiveUrl && state.archiveName) {
              downloadWorkspaceSnapshotArchive(state.archiveUrl, state.archiveName);
            }
          });
        }}
        disabled={snapshotState.status === "running"}
      >
        <Camera className="h-3.5 w-3.5" />
      </WorkspaceToolbarButton>
      {snapshotState.status !== "idle" ? (
        <WorkspaceSnapshotStatusCard
          snapshotState={snapshotState}
          profile={profile}
        />
      ) : null}
    </>
  );
}

export function CustomDashboardStudioPage({
  publicPreview = false,
  withRuntimeProviders = true,
  renderPermissions,
}: {
  publicPreview?: boolean;
  withRuntimeProviders?: boolean;
  renderPermissions?: readonly string[];
} = {}) {
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const canvasScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const {
    user,
    permissions,
    selectedDashboard,
    resolvedDashboard,
    selectedWorkspaceDirty,
    isSaving,
    selectedWorkspaceEditing,
    persistenceMode,
    requestedWidgetId,
    snapshotMode,
    snapshotProfile,
    selectedWorkspaceView,
    workspaceSelectionPending,
    openWidgetSettings,
    openWorkspaceGraph,
    openWorkspaceSettings,
    setSelectedWorkspaceEditing,
    updateSelectedWorkspace,
    updateSelectedWorkspaceUserState,
    commitSelectedWorkspaceControlsState,
    saveWorkspaceDraft,
  } = useCustomWorkspaceStudio();
  const effectivePermissions = renderPermissions ?? permissions;
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
  const [activeSlideWidgetId, setActiveSlideWidgetId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [requestDebugOpen, setRequestDebugOpen] = useState(false);
  const [savedWidgetLibraryOpen, setSavedWidgetLibraryOpen] = useState(false);
  const [savedWidgetSaveTargetId, setSavedWidgetSaveTargetId] = useState<string | null>(null);
  const [slideRegionComposer, setSlideRegionComposer] = useState<{
    slideWidgetId: string;
    region: DashboardSlideRegionId;
  } | null>(null);
  const [canvasScrollSync, setCanvasScrollSync] = useState({
    progress: 0,
    canScroll: false,
  });
  const editMode = publicPreview ? false : selectedWorkspaceEditing;
  const selectedDashboardType = selectedDashboard
    ? normalizeDashboardDefinitionType(selectedDashboard.type, selectedDashboard.labels)
    : null;
  const publicPreviewSupported =
    !publicPreview &&
    selectedDashboardType !== null &&
    selectedDashboardType !== "agent-monitor";
  const [measuredGridMetrics, setMeasuredGridMetrics] = useState<GridMetrics | null>(null);
  const [companionVisibilityById, setCompanionVisibilityById] = useState<Record<string, boolean>>(
    {},
  );
  const activeCrossHostTransferDragRef = useRef<ActiveCrossHostTransferDrag | null>(null);
  const [customGridLayoutDraft, setCustomGridLayoutDraft] = useState<WorkspaceGridLayoutItem[]>([]);
  const [autoGridReorderState, setAutoGridReorderState] = useState<AutoGridReorderState | null>(
    null,
  );
  const {
    allowedWidgetIds,
    catalogDescription,
    catalogTitle,
    deniedWidgetIds,
    savedWidgetsPath,
    toolbarActions,
    workspaceListPath,
  } = useWorkspaceStudioSurfaceConfig();
  const registeredWidgetTypes = useRegisteredWidgetTypesCatalog();
  const widgetSettingsOpen =
    selectedWorkspaceView === "widget-settings" && Boolean(requestedWidgetId);
  const deferredCatalogQuery = useDeferredValue(catalogQuery);
  const kioskMode = useShellStore((state) => state.kioskMode);
  const setKioskMode = useShellStore((state) => state.setKioskMode);
  const dashboardMenuHidden = useShellStore((state) => state.workspaceCanvasMenuHidden);
  const setDashboardMenuHidden = useShellStore((state) => state.setWorkspaceCanvasMenuHidden);
  const catalogPreferencesUserId = user?.id ?? null;
  const allowedWidgetIdSet = useMemo(
    () => (allowedWidgetIds ? new Set(allowedWidgetIds) : null),
    [allowedWidgetIds],
  );
  const deniedWidgetIdSet = useMemo(
    () => (deniedWidgetIds ? new Set(deniedWidgetIds) : null),
    [deniedWidgetIds],
  );

  const allowedWidgets = useMemo(
    () =>
      appRegistry.widgets.filter((widget) =>
        hasAllPermissions(effectivePermissions, widget.requiredPermissions ?? []) &&
        (!allowedWidgetIdSet || allowedWidgetIdSet.has(widget.id)) &&
        (!deniedWidgetIdSet || !deniedWidgetIdSet.has(widget.id)) &&
        (
          !registeredWidgetTypes.endpointConfigured ||
          registeredWidgetTypes.activeWidgetIdSet.has(widget.id)
        ),
      ),
    [
      allowedWidgetIdSet,
      deniedWidgetIdSet,
      effectivePermissions,
      registeredWidgetTypes.activeWidgetIdSet,
      registeredWidgetTypes.endpointConfigured,
    ],
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

  const previousWorkspaceIdRef = useRef<string | null>(null);
  const previousKioskModeRef = useRef(kioskMode);

  useEffect(() => {
    const currentWorkspaceId = selectedDashboard?.id ?? null;
    const workspaceChanged = previousWorkspaceIdRef.current !== currentWorkspaceId;
    const enteringKiosk = kioskMode && !previousKioskModeRef.current;

    if (workspaceChanged || enteringKiosk) {
      setDashboardMenuHidden(false);
    }

    previousWorkspaceIdRef.current = currentWorkspaceId;
    previousKioskModeRef.current = kioskMode;
  }, [kioskMode, selectedDashboard?.id, setDashboardMenuHidden]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.key.toLowerCase() !== "m" ||
        isEditableKeyboardTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      const shellState = useShellStore.getState();
      shellState.setWorkspaceCanvasMenuHidden(!shellState.workspaceCanvasMenuHidden);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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

  const resolvedWidgetInstances = useMemo(
    () =>
      resolvedDashboard?.widgets
        .map((instance) => {
          const widget = getWidgetById(instance.widgetId);

          return widget
            ? {
                ...instance,
                presentation: resolveWidgetInstancePresentation(widget, instance.presentation),
              }
            : instance;
        })
        ?? [],
    [resolvedDashboard?.widgets],
  );
  const canvasWidgets = useMemo(
    () => resolvedWidgetInstances.filter((widget) => !resolveWidgetSidebarOnly(widget.presentation)),
    [resolvedWidgetInstances],
  );
  const rootCanvasWidgets = useMemo(
    () => canvasWidgets.filter((widget) => !widget.slidePlacement),
    [canvasWidgets],
  );
  const slidePlacedWidgetsBySlideRegion = useMemo(() => {
    const map = new Map<string, Map<DashboardSlideRegionId, typeof canvasWidgets>>();

    canvasWidgets.forEach((widget) => {
      if (!widget.slidePlacement) {
        return;
      }

      const byRegion = map.get(widget.slidePlacement.slideWidgetId) ?? new Map();
      const current = (byRegion.get(widget.slidePlacement.region) ?? []) as typeof canvasWidgets;
      byRegion.set(widget.slidePlacement.region, [...current, widget]);
      map.set(widget.slidePlacement.slideWidgetId, byRegion);
    });

    return map;
  }, [canvasWidgets]);
  const handleCrossHostTransferPointerMove = useCallback((event: PointerEvent) => {
    if (!activeCrossHostTransferDragRef.current) {
      return;
    }

    activeCrossHostTransferDragRef.current = {
      ...activeCrossHostTransferDragRef.current,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };
  }, []);
  const clearCrossHostTransferDrag = useCallback(() => {
    activeCrossHostTransferDragRef.current = null;
    window.removeEventListener("pointermove", handleCrossHostTransferPointerMove, true);
  }, [handleCrossHostTransferPointerMove]);
  const beginCrossHostTransferDrag = useCallback((
    instanceId: string,
    source: {
      host: "root" | "slide";
      slideWidgetId?: string;
      region?: WorkspaceSlideRegionId;
    },
  ) => {
    activeCrossHostTransferDragRef.current = {
      instanceId,
      sourceHost: source.host,
      sourceSlideWidgetId: source.slideWidgetId,
      sourceRegion: source.region,
      lastClientX: null,
      lastClientY: null,
    };
    window.addEventListener("pointermove", handleCrossHostTransferPointerMove, true);
  }, [handleCrossHostTransferPointerMove]);
  useEffect(
    () => () => {
      clearCrossHostTransferDrag();
    },
    [clearCrossHostTransferDrag],
  );
  const sidebarOnlyWidgets = useMemo(
    () => resolvedWidgetInstances.filter((widget) => resolveWidgetSidebarOnly(widget.presentation)),
    [resolvedWidgetInstances],
  );
  const gridManagedWidgets = useMemo(
    () => rootCanvasWidgets,
    [rootCanvasWidgets],
  );
  const structuralCanvasWidgets = useMemo(
    () => [] as typeof rootCanvasWidgets,
    [rootCanvasWidgets],
  );
  const committedGridLayout = useMemo(
    () => (resolvedDashboard ? resolvedDashboardToGridLayout(resolvedDashboard) : []),
    [resolvedDashboard],
  );
  const effectiveGridLayout = useMemo(
    () =>
      committedGridLayout.filter(
        (item) => parseCompanionItemId(item.i) == null,
      ),
    [committedGridLayout],
  );
  const effectiveGridLayoutById = useMemo(
    () =>
      new Map(
        effectiveGridLayout.map((item) => [
          item.i,
          {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          } satisfies ResolvedDashboardWidgetLayout,
        ]),
      ),
    [effectiveGridLayout],
  );
  const storedCompanionLayoutById = useMemo(
    () => resolveDashboardCompanionLayoutMap(resolvedDashboard?.companions),
    [resolvedDashboard?.companions],
  );
  const storedCompanionById = useMemo(
    () => resolveDashboardCompanionMap(resolvedDashboard?.companions),
    [resolvedDashboard?.companions],
  );
  const companionCandidates = useMemo<DashboardCanvasCompanionCandidate[]>(() => {
    if (!resolvedDashboard) {
      return [];
    }

    const widgetEntries: ResolvedDashboardWidgetEntry[] = resolvedWidgetInstances
      .filter((instance) => !instance.slidePlacement)
      .flatMap((instance) => {
        const widget = getWidgetById(instance.widgetId);

        return widget
          ? [
              {
                instance,
                widget,
              },
            ]
          : [];
      });

    return resolveDashboardCanvasCompanionCandidates(widgetEntries, {
      columns: resolvedDashboard.grid.columns,
      layoutOverrideById: effectiveGridLayoutById,
      storedCompanionLayoutById,
      storedCompanionById,
    });
  }, [
    effectiveGridLayoutById,
    storedCompanionById,
    storedCompanionLayoutById,
    resolvedDashboard,
    resolvedWidgetInstances,
  ]);
  const visibleCompanionCandidates = useMemo(
    () =>
      companionCandidates.filter((candidate) => companionVisibilityById[candidate.itemId] !== false),
    [companionCandidates, companionVisibilityById],
  );
  const layoutKind: DashboardLayoutKind = resolvedDashboard?.layoutKind ?? "custom";
  const runtimeRowHeight =
    layoutKind === "auto-grid"
      ? Math.max(1, resolvedDashboard?.autoGrid?.rowHeight ?? resolvedDashboard?.grid.rowHeight ?? 18)
      : (resolvedDashboard?.grid.rowHeight ?? 18);
  const customGridVisualGap = layoutKind === "custom" ? (resolvedDashboard?.grid.gap ?? 0) : 0;
  const autoGridFillScreen =
    layoutKind === "auto-grid" && resolvedDashboard?.autoGrid?.fillScreen === true;
  const autoGridTemplateColumns = useMemo(
    () =>
      resolvedDashboard
        ? resolveAutoGridTemplateColumns({
            maxColumns: resolvedDashboard.autoGrid?.maxColumns,
            minColumnWidthPx: resolvedDashboard.autoGrid?.minColumnWidthPx,
            gap: resolvedDashboard.grid.gap,
          })
        : undefined,
    [
      resolvedDashboard?.autoGrid?.maxColumns,
      resolvedDashboard?.autoGrid?.minColumnWidthPx,
      resolvedDashboard?.grid.gap,
    ],
  );
  const activeCanvasGridColumns = resolvedDashboard?.grid.columns ?? 1;
  const activeCanvasGridLayout = useMemo(
    () =>
      (
        [
          ...committedGridLayout,
          ...visibleCompanionCandidates.map((candidate) => {
            const layout = candidate.layout;

            return {
              i: candidate.itemId,
              x: layout.x,
              y: layout.y,
              w: layout.w,
              h: layout.h,
            } satisfies WorkspaceGridLayoutItem;
          }),
        ]
      ).sort(compareWorkspaceGridItems),
    [committedGridLayout, visibleCompanionCandidates],
  );
  const customRuntimeGridLayout = useMemo(
    () =>
      resolveCustomRuntimeGridLayout(
        activeCanvasGridLayout,
        activeCanvasGridColumns,
        measuredGridMetrics?.rect.width ?? null,
      ),
    [activeCanvasGridColumns, activeCanvasGridLayout, measuredGridMetrics?.rect.width],
  );
  const committedCustomGridLayoutSignature = useMemo(
    () =>
      `${selectedDashboard?.id ?? "none"}:${serializeWorkspaceGridLayout(customRuntimeGridLayout.layout)}`,
    [customRuntimeGridLayout.layout, selectedDashboard?.id],
  );
  const lastSyncedCustomGridLayoutSignatureRef = useRef<string | null>(null);
  const previousEditModeRef = useRef(editMode);
  const hasUnsyncedCommittedCustomGridLayout =
    committedCustomGridLayoutSignature !== lastSyncedCustomGridLayoutSignatureRef.current;
  const renderedCustomGridLayout =
    hasUnsyncedCommittedCustomGridLayout
      ? customRuntimeGridLayout.layout
      : customGridLayoutDraft.length > 0
        ? customGridLayoutDraft
        : customRuntimeGridLayout.layout;
  const customRuntimeGridLayoutById = useMemo(
    () =>
      new Map(
        renderedCustomGridLayout.map((item) => [
          item.i,
          {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          } satisfies ResolvedDashboardWidgetLayout,
        ]),
      ),
    [renderedCustomGridLayout],
  );
  const customMobileLayout = layoutKind === "custom" && customRuntimeGridLayout.mobile;
  const customGridInteractive = editMode && layoutKind === "custom" && !customMobileLayout;
  // Keep one bottom-right handle so custom resize stays a single combined width+height gesture.
  const customGridResizeHandles = useMemo<ResizeHandleAxis[]>(
    () => (customGridInteractive ? ["se"] : []),
    [customGridInteractive],
  );
  const customGridConfig = useMemo(
    () => ({
      cols: activeCanvasGridColumns,
      rowHeight: runtimeRowHeight,
      margin: [0, 0] as const,
      containerPadding: [0, 0] as const,
    }),
    [activeCanvasGridColumns, runtimeRowHeight],
  );
  const customGridDragConfig = useMemo(
    () => ({
      enabled: customGridInteractive,
      handle: customGridInteractive
        ? workspaceGridDraggableHandleSelector
        : ".workspace-grid-handle-disabled",
      cancel: customGridInteractive ? workspaceGridDraggableCancelSelector : undefined,
      threshold: 0,
    }),
    [customGridInteractive],
  );
  const customGridResizeConfig = useMemo(
    () => ({
      enabled: customGridInteractive,
      handles: customGridResizeHandles,
    }),
    [customGridInteractive, customGridResizeHandles],
  );
  const rowChildCountById = useMemo(
    () =>
      new Map(
        resolvedWidgetInstances
          .filter((instance) => isWorkspaceRowWidgetId(instance.widgetId))
          .map((instance) => [
            instance.id,
            getWorkspaceRowChildCount(resolvedWidgetInstances, instance.id),
          ]),
      ),
    [resolvedWidgetInstances],
  );
  const resolveSlideRegionDropTarget = useCallback(
    (
      instanceId: string,
      layoutItem: Pick<WorkspaceGridLayoutItem, "h" | "w">,
    ) => {
      const activeDrag = activeCrossHostTransferDragRef.current;

      if (!activeDrag || activeDrag.instanceId !== instanceId) {
        return null;
      }

      if (activeDrag.lastClientX == null || activeDrag.lastClientY == null) {
        return null;
      }

      const regionElement = document
        .elementsFromPoint(activeDrag.lastClientX, activeDrag.lastClientY)
        .find(
          (element) =>
            element instanceof HTMLElement &&
            Boolean(
              element.dataset.workspaceSlideWidgetId &&
              element.dataset.workspaceSlideRegionId,
            ),
        );

      if (!(regionElement instanceof HTMLElement)) {
        return null;
      }

      const slideWidgetId = regionElement.dataset.workspaceSlideWidgetId?.trim();
      const region = regionElement.dataset.workspaceSlideRegionId as
        | WorkspaceSlideRegionId
        | undefined;

      if (
        !slideWidgetId ||
        region !== "body"
      ) {
        return null;
      }

      const rect = regionElement.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        return {
          slideWidgetId,
          region,
        };
      }

      const sourceColumns = Math.max(activeCanvasGridColumns, 1);
      const previewTargetCols = Math.max(
        3,
        Math.min(
          WORKSPACE_SLIDE_GRID_COLUMNS,
          Math.round((layoutItem.w / sourceColumns) * WORKSPACE_SLIDE_GRID_COLUMNS),
        ),
      );
      const targetX = clampInteger(
        ((activeDrag.lastClientX - rect.left) / rect.width) * WORKSPACE_SLIDE_GRID_COLUMNS,
        0,
        Math.max(0, WORKSPACE_SLIDE_GRID_COLUMNS - previewTargetCols),
      );
      const targetY = clampInteger(
        WORKSPACE_SLIDE_GRID_ROW_HEIGHT > 0
          ? (activeDrag.lastClientY - rect.top) / WORKSPACE_SLIDE_GRID_ROW_HEIGHT
          : 0,
        0,
        Number.MAX_SAFE_INTEGER,
      );

      return {
        slideWidgetId,
        region,
        layout: {
          x: targetX,
          y: targetY,
          w: layoutItem.w,
          h: layoutItem.h,
        },
      };
    },
    [activeCanvasGridColumns],
  );
  const resolveRootCanvasDropTarget = useCallback(
    (
      instanceId: string,
      layoutItem: Pick<WorkspaceGridLayoutItem, "h" | "w">,
    ) => {
      const activeDrag = activeCrossHostTransferDragRef.current;

      if (!activeDrag || activeDrag.instanceId !== instanceId || !measuredGridMetrics) {
        return null;
      }

      if (activeDrag.lastClientX == null || activeDrag.lastClientY == null) {
        return null;
      }

      const overSlideRegion = document
        .elementsFromPoint(activeDrag.lastClientX, activeDrag.lastClientY)
        .some(
          (element) =>
            element instanceof HTMLElement &&
            Boolean(
              element.dataset.workspaceSlideWidgetId &&
              element.dataset.workspaceSlideRegionId,
            ),
        );

      if (overSlideRegion) {
        return null;
      }

      const placement = resolveGridCellFromPoint(
        measuredGridMetrics,
        activeDrag.lastClientX,
        activeDrag.lastClientY,
      );

      if (!placement) {
        return null;
      }

      const sourceColumns =
        activeDrag.sourceHost === "slide" ? WORKSPACE_SLIDE_GRID_COLUMNS : activeCanvasGridColumns;
      const sourceRowHeight =
        activeDrag.sourceHost === "slide"
          ? WORKSPACE_SLIDE_GRID_ROW_HEIGHT
          : runtimeRowHeight;
      const targetCols = Math.max(
        1,
        Math.round((Math.max(layoutItem.w, 1) / Math.max(sourceColumns, 1)) * activeCanvasGridColumns),
      );
      const targetRows = Math.max(
        1,
        Math.round((Math.max(layoutItem.h, 1) * Math.max(sourceRowHeight, 1)) / Math.max(runtimeRowHeight, 1)),
      );

      return {
        layout: {
          x: Math.max(0, Math.min(placement.x ?? 0, Math.max(0, activeCanvasGridColumns - targetCols))),
          y: placement.y ?? 0,
          w: targetCols,
          h: targetRows,
        },
      };
    },
    [activeCanvasGridColumns, measuredGridMetrics, runtimeRowHeight],
  );
  const visibleCompanionsByInstanceId = useMemo(() => {
    const map = new Map<string, DashboardCanvasCompanionCandidate[]>();

    visibleCompanionCandidates.forEach((candidate) => {
      const current = map.get(candidate.instanceId) ?? [];
      current.push(candidate);
      map.set(candidate.instanceId, current);
    });

    return map;
  }, [visibleCompanionCandidates]);
  const autoGridRenderItems = useMemo(
    () =>
      rootCanvasWidgets.flatMap((instance) => {
        const companionItems = (visibleCompanionsByInstanceId.get(instance.id) ?? []).map((candidate) => ({
          kind: "companion" as const,
          candidate,
        }));

        return [
          {
            kind: "widget" as const,
            instance,
          },
          ...companionItems,
        ];
      }),
    [rootCanvasWidgets, visibleCompanionsByInstanceId],
  );

  useEffect(() => {
    const wasEditMode = previousEditModeRef.current;
    previousEditModeRef.current = editMode;

    if (!wasEditMode || editMode) {
      return;
    }

    setLibraryOpen(false);
    setRequestDebugOpen(false);
    setSelectedInstanceId(null);
    setCatalogDragPayload(null);
    setActiveCatalogDrag(null);
    setHoveredPlacement(null);
    setCompanionVisibilityById({});
    setCustomGridLayoutDraft(cloneWorkspaceGridLayout(customRuntimeGridLayout.layout));
    setAutoGridReorderState(null);
  }, [customRuntimeGridLayout.layout, editMode]);

  useEffect(() => {
    setLibraryOpen(false);
    setRequestDebugOpen(false);
    setSelectedInstanceId(null);
    setActiveSlideWidgetId(null);
    setCatalogDragPayload(null);
    setActiveCatalogDrag(null);
    setHoveredPlacement(null);
    setCompanionVisibilityById({});
    setCustomGridLayoutDraft(cloneWorkspaceGridLayout(customRuntimeGridLayout.layout));
    setAutoGridReorderState(null);
  }, [selectedDashboard?.id]);

  useEffect(() => {
    if (committedCustomGridLayoutSignature === lastSyncedCustomGridLayoutSignatureRef.current) {
      return;
    }

    lastSyncedCustomGridLayoutSignatureRef.current = committedCustomGridLayoutSignature;
    setCustomGridLayoutDraft(cloneWorkspaceGridLayout(customRuntimeGridLayout.layout));
  }, [committedCustomGridLayoutSignature, customRuntimeGridLayout.layout]);

  useEffect(() => {
    if (!resolvedDashboard || !gridRef.current || layoutKind !== "custom") {
      setMeasuredGridMetrics(null);
      return undefined;
    }

    const gridElement = gridRef.current;
    const grid = {
      ...resolvedDashboard.grid,
      columns: activeCanvasGridColumns,
      gap: 0,
      rowHeight: runtimeRowHeight,
    };

    let lastMeasuredWidth: number | null = null;

    function updateGridMetrics(options?: { force?: boolean }) {
      const nextMetrics = getGridMetrics(gridElement, grid);

      if (!nextMetrics) {
        lastMeasuredWidth = null;
        setMeasuredGridMetrics(null);
        return;
      }

      if (
        !options?.force &&
        lastMeasuredWidth !== null &&
        Math.abs(lastMeasuredWidth - nextMetrics.rect.width) < 0.5
      ) {
        return;
      }

      lastMeasuredWidth = nextMetrics.rect.width;
      setMeasuredGridMetrics((current) => {
        if (
          current &&
          Math.abs(current.rect.width - nextMetrics.rect.width) < 0.5 &&
          current.columns === nextMetrics.columns &&
          current.gap === nextMetrics.gap &&
          current.rowHeight === nextMetrics.rowHeight
        ) {
          return current;
        }

        return nextMetrics;
      });
    }

    updateGridMetrics({ force: true });

    const observer = new ResizeObserver(() => {
      updateGridMetrics();
    });
    const handleWindowResize = () => {
      updateGridMetrics();
    };

    observer.observe(gridElement);
    window.addEventListener("resize", handleWindowResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [
    layoutKind,
    activeCanvasGridColumns,
    runtimeRowHeight,
    resolvedDashboard?.id,
    resolvedDashboard?.grid.gap,
  ]);

  useEffect(() => {
    if (
      selectedInstanceId &&
      !resolvedDashboard?.widgets.some((widget) => widget.id === selectedInstanceId)
    ) {
      setSelectedInstanceId(null);
    }
  }, [resolvedDashboard, selectedInstanceId]);

  useEffect(() => {
    if (
      activeSlideWidgetId &&
      !resolvedDashboard?.widgets.some((widget) => widget.id === activeSlideWidgetId)
    ) {
      setActiveSlideWidgetId(null);
    }
  }, [activeSlideWidgetId, resolvedDashboard]);

  useEffect(() => {
    if (!slideRegionComposer) {
      return;
    }

    if (!editMode) {
      setSlideRegionComposer(null);
      return;
    }

    const slideStillExists = resolvedDashboard?.widgets.some(
      (widget) => widget.id === slideRegionComposer.slideWidgetId,
    );

    if (slideStillExists) {
      return;
    }

    setSlideRegionComposer(null);
  }, [editMode, resolvedDashboard, slideRegionComposer]);

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

    const dotStepX = measuredGridMetrics.stepX / 2;
    const dotStepY = measuredGridMetrics.stepY / 2;

    return {
      backgroundImage:
        "radial-gradient(circle at 0 0, var(--workspace-grid-dot) 0, var(--workspace-grid-dot) 1.55px, transparent 1.9px)",
      backgroundPosition: "0 0",
      backgroundRepeat: "repeat",
      backgroundSize: `${dotStepX}px ${dotStepY}px`,
    };
  }, [measuredGridMetrics]);

  useEffect(() => {
    if (!activeCatalogDrag || !resolvedDashboard?.grid || !editMode || layoutKind !== "custom") {
      return undefined;
    }

    const draggedWidgetId = activeCatalogDrag.widgetId;
    const grid = {
      ...resolvedDashboard.grid,
      columns: activeCanvasGridColumns,
      gap: 0,
      rowHeight: runtimeRowHeight,
    };
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
            activeSlideWidgetId &&
            widget.id !== WORKSPACE_ROW_WIDGET_ID &&
            widget.id !== WORKSPACE_SLIDE_WIDGET_ID &&
            widget.fixedPlacementMode !== "sidebar"
              ? appendCatalogWidgetToSlideRegion(dashboard, activeSlideWidgetId, "body", widget)
              : placeCatalogWidget(dashboard, widget, placement),
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
    layoutKind,
    activeCanvasGridColumns,
    runtimeRowHeight,
    resolvedDashboard?.grid.columns,
    resolvedDashboard?.grid.gap,
    activeSlideWidgetId,
    widgetMap,
  ]);

  const handleGridLayoutCommit = useCallback(
    (layout: ReactGridLayoutLayout | WorkspaceGridLayoutItem[]) => {
      const committedLayout = cloneWorkspaceGridLayout(layout);

      setCustomGridLayoutDraft(committedLayout);
      updateSelectedWorkspace((dashboard) => {
        const widgetItems = committedLayout.filter((item) => parseCompanionItemId(item.i) == null);
        const companionItems = committedLayout.filter((item) => parseCompanionItemId(item.i) != null);
        const nextDashboard = commitDashboardGridLayout(dashboard, widgetItems);

        return commitDashboardCompanionLayout(nextDashboard, companionItems);
      });
    },
    [updateSelectedWorkspace],
  );

  const handleCompanionVisibilityChange = useCallback((itemId: string, visible: boolean) => {
    setCompanionVisibilityById((current) => {
      if (current[itemId] === visible) {
        return current;
      }

      return {
        ...current,
        [itemId]: visible,
      };
    });
  }, []);

  function handleCatalogAdd(widget: WidgetDefinition) {
    setSelectedWorkspaceEditing(true);
    setRecentWidgetIds((current) => pushRecentWidgetId(current, widget.id));
    updateSelectedWorkspace((dashboard) =>
      activeSlideWidgetId &&
      widget.id !== WORKSPACE_ROW_WIDGET_ID &&
      widget.id !== WORKSPACE_SLIDE_WIDGET_ID &&
      widget.fixedPlacementMode !== "sidebar"
        ? appendCatalogWidgetToSlideRegion(dashboard, activeSlideWidgetId, "body", widget)
        : appendCatalogWidget(dashboard, widget),
    );
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
    if (!editMode || layoutKind !== "custom" || customMobileLayout || event.button !== 0) {
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
    setSelectedWorkspaceEditing(!editMode);
  }

  function handleSaveAction() {
    saveWorkspaceDraft();
  }

  const handleWidgetRuntimeStateChange = useCallback(
    (
      instanceId: string,
      runtimeState: Record<string, unknown> | undefined,
    ) => {
      updateSelectedWorkspaceUserState((dashboard) =>
        updateDashboardWidgetRuntimeState(dashboard, instanceId, runtimeState),
        { bumpRevision: false },
      );
    },
    [updateSelectedWorkspaceUserState],
  );

  function handleAutoGridDragStart(
    instanceId: string,
    event: ReactDragEvent<HTMLDivElement>,
  ) {
    if (!editMode || layoutKind !== "auto-grid") {
      event.preventDefault();
      return;
    }

    const target = event.target as HTMLElement | null;

    if (isAutoGridReorderTarget(target)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", instanceId);
    setSelectedInstanceId(instanceId);
    setAutoGridReorderState({
      draggedInstanceId: instanceId,
      targetInstanceId: null,
      position: null,
    });
  }

  function handleAutoGridDragOver(
    targetInstanceId: string,
    event: ReactDragEvent<HTMLDivElement>,
  ) {
    if (!editMode || layoutKind !== "auto-grid" || !autoGridReorderState) {
      return;
    }

    if (autoGridReorderState.draggedInstanceId === targetInstanceId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const position = resolveAutoGridDropPosition(
      event.currentTarget.getBoundingClientRect(),
      event.clientX,
      event.clientY,
    );

    setAutoGridReorderState((current) => {
      if (!current || current.draggedInstanceId === targetInstanceId) {
        return current;
      }

      if (current.targetInstanceId === targetInstanceId && current.position === position) {
        return current;
      }

      return {
        ...current,
        targetInstanceId,
        position,
      };
    });
  }

  function handleAutoGridDragLeave(
    targetInstanceId: string,
    event: ReactDragEvent<HTMLDivElement>,
  ) {
    if (!autoGridReorderState || autoGridReorderState.targetInstanceId !== targetInstanceId) {
      return;
    }

    const nextTarget = event.relatedTarget as Node | null;

    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setAutoGridReorderState((current) =>
      current?.targetInstanceId === targetInstanceId
        ? {
            ...current,
            targetInstanceId: null,
            position: null,
          }
        : current,
    );
  }

  function handleAutoGridDrop(
    targetInstanceId: string,
    event: ReactDragEvent<HTMLDivElement>,
  ) {
    if (!editMode || layoutKind !== "auto-grid" || !autoGridReorderState) {
      return;
    }

    event.preventDefault();

    const draggedInstanceId = autoGridReorderState.draggedInstanceId;

    if (draggedInstanceId === targetInstanceId) {
      setAutoGridReorderState(null);
      return;
    }

    const position =
      autoGridReorderState.targetInstanceId === targetInstanceId && autoGridReorderState.position
        ? autoGridReorderState.position
        : resolveAutoGridDropPosition(
            event.currentTarget.getBoundingClientRect(),
            event.clientX,
            event.clientY,
          );

    updateSelectedWorkspace((dashboard) =>
      reorderDashboardWidgets(dashboard, draggedInstanceId, targetInstanceId, position),
    );
    setAutoGridReorderState(null);
  }

  function handleAutoGridDragEnd() {
    setAutoGridReorderState(null);
  }

  const renderCanvasWidget = useCallback(
    (
      instance: (typeof canvasWidgets)[number],
      options?: {
        dragHandleClassName?: string;
        style?: CSSProperties;
      },
    ) => {
      const widget = getWidgetById(instance.widgetId);

      if (!widget) {
        return (
          <MissingWidgetFrame
            key={instance.id}
            widgetId={instance.widgetId}
            style={options?.style}
            onRemove={() => {
              updateSelectedWorkspace((dashboard) =>
                removeDashboardWidget(dashboard, instance.id),
              );
              setSelectedInstanceId((current) => (current === instance.id ? null : current));
            }}
          />
        );
      }

      const HeaderActions =
        widget.headerActions as
          | ComponentType<WidgetHeaderActionsProps<Record<string, unknown>>>
          | undefined;

      if (widget.id === WORKSPACE_SLIDE_WIDGET_ID) {
        const slideProps = sanitizeWorkspaceSlideProps(instance.props ?? {});
        const slideRegions = slidePlacedWidgetsBySlideRegion.get(instance.id);
        const bodyWidgets = slideRegions?.get("body") ?? [];
        const bodyContent =
          bodyWidgets.length > 0 ? (
            <WorkspaceSlideSubgridHost
              items={bodyWidgets.map((regionWidget) => ({
                id: regionWidget.id,
                layout: {
                  x: regionWidget.layout.x,
                  y: regionWidget.layout.y,
                  w: regionWidget.layout.w,
                  h: regionWidget.layout.h,
                },
                content: renderCanvasWidget(regionWidget, {
                  dragHandleClassName: slideRegionDraggableHandleClassName,
                }),
              }))}
              editable={editMode}
              dragHandleSelector={slideRegionDraggableHandleSelector}
              dragCancelSelector={workspaceGridDraggableCancelSelector}
              onDragStart={(itemId) => {
                beginCrossHostTransferDrag(itemId, {
                  host: "slide",
                  slideWidgetId: instance.id,
                  region: "body",
                });
              }}
              onDragStop={(nextLayout, draggedItem) => {
                const activeDrag = activeCrossHostTransferDragRef.current;
                const slideDropTarget = resolveSlideRegionDropTarget(draggedItem.i, draggedItem);

                if (
                  slideDropTarget &&
                  (
                    activeDrag?.sourceHost !== "slide" ||
                    activeDrag.sourceSlideWidgetId !== slideDropTarget.slideWidgetId ||
                    activeDrag.sourceRegion !== slideDropTarget.region
                  )
                ) {
                  clearCrossHostTransferDrag();
                  updateSelectedWorkspace((dashboard) =>
                    moveDashboardWidgetToSlideRegion(
                      dashboard,
                      draggedItem.i,
                      slideDropTarget.slideWidgetId,
                      slideDropTarget.region,
                      slideDropTarget.layout,
                    ),
                  );
                  return;
                }

                const rootDropTarget = resolveRootCanvasDropTarget(draggedItem.i, draggedItem);

                if (rootDropTarget) {
                  clearCrossHostTransferDrag();
                  updateSelectedWorkspace((dashboard) =>
                    moveDashboardWidgetToRootCanvas(
                      dashboard,
                      draggedItem.i,
                      rootDropTarget.layout,
                      {
                        sourceColumns: WORKSPACE_SLIDE_GRID_COLUMNS,
                        sourceRowHeight: WORKSPACE_SLIDE_GRID_ROW_HEIGHT,
                      },
                    ),
                  );
                  return;
                }

                clearCrossHostTransferDrag();
                updateSelectedWorkspace((dashboard) =>
                  commitDashboardSlideRegionLayout(dashboard, instance.id, "body", nextLayout),
                );
              }}
              onLayoutCommit={(nextLayout) => {
                updateSelectedWorkspace((dashboard) =>
                  commitDashboardSlideRegionLayout(dashboard, instance.id, "body", nextLayout),
                );
              }}
            />
          ) : undefined;

        return (
          <BuilderWidgetCard
            key={instance.id}
            instanceId={instance.id}
            instanceTitle={instance.title}
            selected={selectedInstanceId === instance.id}
            editable={editMode}
            dragHandleClassName={options?.dragHandleClassName}
            shellVariant="transparent"
            style={options?.style}
            bodyDraggable={false}
            selectOnPointerDown={false}
            renderCanvasFields={false}
            widget={widget}
            widgetProps={instance.props ?? {}}
            widgetPresentation={instance.presentation}
            widgetRuntimeState={instance.runtimeState}
            customContent={
              <div className="h-full" data-no-widget-drag="true">
                <WorkspaceSlideSurface
                  slideWidgetId={instance.id}
                  slide={slideProps}
                  active={activeSlideWidgetId === instance.id}
                  editable={editMode}
                  regionContent={bodyContent ? { body: bodyContent } : undefined}
                  onSlideChange={(nextProps) => {
                    updateSelectedWorkspace((dashboard) =>
                      updateDashboardWidgetSettings(dashboard, instance.id, {
                        props: nextProps,
                      }),
                    );
                  }}
                />
              </div>
            }
            onRemove={(instanceId) => {
              updateSelectedWorkspace((dashboard) =>
                removeDashboardWidget(dashboard, instanceId),
              );
              setSelectedInstanceId((current) => (current === instanceId ? null : current));
              setActiveSlideWidgetId((current) => (current === instanceId ? null : current));
            }}
            onDuplicate={(instanceId) => {
              updateSelectedWorkspace((dashboard) =>
                duplicateDashboardWidget(dashboard, instanceId),
              );
            }}
            onSaveWidget={(instanceId) => {
              setSelectedInstanceId(instanceId);
              setSavedWidgetSaveTargetId(instanceId);
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
              setActiveSlideWidgetId(instanceId);
            }}
            onOpenSettings={(instanceId) => {
              setSelectedInstanceId(instanceId);
              setActiveSlideWidgetId(instanceId);
              openWidgetSettings(instanceId);
            }}
            onOpenBindings={(instanceId) => {
              setSelectedInstanceId(instanceId);
              setActiveSlideWidgetId(instanceId);
              openWidgetSettings(instanceId, "bindings");
            }}
          />
        );
      }

      return (
        <BuilderWidgetCard
          key={instance.id}
          instanceId={instance.id}
          instanceTitle={instance.title}
          selected={selectedInstanceId === instance.id}
          editable={editMode}
          dragHandleClassName={options?.dragHandleClassName}
          style={options?.style}
          renderCanvasFields={false}
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
            setActiveSlideWidgetId((current) =>
              current === instance.slidePlacement?.slideWidgetId ? null : current,
            );
          }}
          onDuplicate={(instanceId) => {
            updateSelectedWorkspace((dashboard) =>
              duplicateDashboardWidget(dashboard, instanceId),
            );
          }}
          onSaveWidget={(instanceId) => {
            setSelectedInstanceId(instanceId);
            setSavedWidgetSaveTargetId(instanceId);
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
            setActiveSlideWidgetId(instance.slidePlacement?.slideWidgetId ?? null);
          }}
          onOpenSettings={(instanceId) => {
            setSelectedInstanceId(instanceId);
            setActiveSlideWidgetId(instance.slidePlacement?.slideWidgetId ?? null);
            openWidgetSettings(instanceId);
          }}
          onOpenBindings={(instanceId) => {
            setSelectedInstanceId(instanceId);
            setActiveSlideWidgetId(instance.slidePlacement?.slideWidgetId ?? null);
            openWidgetSettings(instanceId, "bindings");
          }}
          rowCollapsed={isWorkspaceRowCollapsed(instance)}
          rowChildCount={rowChildCountById.get(instance.id) ?? 0}
          onToggleRowCollapse={(instanceId) => {
            updateSelectedWorkspace((dashboard) => {
              const target = dashboard.widgets.find((entry) => entry.id === instanceId);

              if (!target || !isWorkspaceRowWidgetId(target.widgetId)) {
                return dashboard;
              }

              return isWorkspaceRowCollapsed(target)
                ? expandDashboardRow(dashboard, instanceId)
                : collapseDashboardRow(dashboard, instanceId);
            });
          }}
        />
      );
    },
    [
      editMode,
      handleWidgetRuntimeStateChange,
      openWidgetSettings,
      rowChildCountById,
      selectedInstanceId,
      slidePlacedWidgetsBySlideRegion,
      updateSelectedWorkspace,
    ],
  );
  const gridChildren = useMemo(
    () => [
      ...gridManagedWidgets.map((instance) => (
        <div
          key={instance.id}
          className="box-border h-full overflow-visible"
          style={resolveGridItemInsetStyle(customGridVisualGap)}
        >
          {renderCanvasWidget(instance)}
        </div>
      )),
      ...visibleCompanionCandidates.map((candidate) => (
        <div
          key={candidate.itemId}
          className="box-border h-full overflow-visible"
          style={resolveGridItemInsetStyle(customGridVisualGap)}
        >
          <GridCompanionCard
            candidate={candidate}
            editable={editMode}
            onPropsChange={(props) => {
              updateSelectedWorkspace((dashboard) =>
                updateDashboardWidgetSettings(dashboard, candidate.instanceId, {
                  props,
                }),
              );
            }}
            onPresentationChange={(presentation) => {
              updateSelectedWorkspace((dashboard) =>
                updateDashboardWidgetSettings(dashboard, candidate.instanceId, {
                  presentation,
                }),
              );
            }}
            onRuntimeStateChange={(state) => {
              handleWidgetRuntimeStateChange(candidate.instanceId, state);
            }}
            onVisibilityChange={handleCompanionVisibilityChange}
          />
        </div>
      )),
    ],
    [
      customGridVisualGap,
      editMode,
      gridManagedWidgets,
      handleCompanionVisibilityChange,
      handleWidgetRuntimeStateChange,
      renderCanvasWidget,
      updateSelectedWorkspace,
      visibleCompanionCandidates,
    ],
  );

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

  const railWidgets = resolvedDashboard.widgets.flatMap((instance) => {
    const widget = getWidgetById(instance.widgetId);
    const required = [
      ...(widget?.requiredPermissions ?? []),
      ...(instance.requiredPermissions ?? []),
    ];

    return widget &&
      hasAllPermissions(effectivePermissions, required) &&
      !isManagedDashboardWidgetHiddenFromNormalRail(instance)
      ? [
          {
            id: instance.id,
            title: instance.title,
            layout: instance.layout,
            props: instance.props,
            presentation: instance.presentation,
            runtimeState: instance.runtimeState,
            widget,
          },
        ]
      : [];
  });
  const canvasBottomBufferRows =
    layoutKind === "custom"
      ? (editMode
          ? DEFAULT_WORKSPACE_CANVAS_EDIT_MODE_BOTTOM_BUFFER_ROWS
          : DEFAULT_WORKSPACE_CANVAS_BOTTOM_BUFFER_ROWS)
      : 0;
  const canvasMinHeight = resolveWorkspaceCanvasMinHeight(
    (layoutKind === "custom" ? renderedCustomGridLayout : activeCanvasGridLayout).map((item) => ({
      y: item.y,
      h: item.h,
    })),
    {
      bottomBufferRows: canvasBottomBufferRows,
      grid: {
        gap: layoutKind === "custom" ? 0 : (resolvedDashboard?.grid.gap ?? 0),
        rowHeight: runtimeRowHeight,
      },
    },
  );

  const handleCanvasScrollProgressChange = useCallback((nextProgress: number) => {
    const scrollElement = canvasScrollContainerRef.current;

    if (!scrollElement) {
      return;
    }

    const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
    const clampedProgress = Math.min(1, Math.max(0, nextProgress));
    scrollElement.scrollTop = maxScrollTop * clampedProgress;
  }, []);

  useLayoutEffect(() => {
    const scrollElement = canvasScrollContainerRef.current;

    if (!scrollElement || typeof window === "undefined") {
      setCanvasScrollSync({
        progress: 0,
        canScroll: false,
      });
      return undefined;
    }

    const element = scrollElement;

    let frameId = 0;

    function updateScrollSync() {
      const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
      const nextCanScroll = maxScrollTop > 0;
      const nextProgress = nextCanScroll ? element.scrollTop / maxScrollTop : 0;

      setCanvasScrollSync((current) => {
        if (
          current.canScroll === nextCanScroll &&
          Math.abs(current.progress - nextProgress) < 0.001
        ) {
          return current;
        }

        return {
          progress: nextProgress,
          canScroll: nextCanScroll,
        };
      });
    }

    function scheduleUpdate() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateScrollSync);
    }

    scheduleUpdate();

    const resizeObserver = new ResizeObserver(() => {
      scheduleUpdate();
    });

    resizeObserver.observe(scrollElement);
    Array.from(element.children).forEach((child) => {
      resizeObserver.observe(child);
    });
    element.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      element.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [
    canvasMinHeight,
    dashboardMenuHidden,
    editMode,
    layoutKind,
    resolvedDashboard?.widgets.length,
    visibleCompanionCandidates.length,
    widgetSettingsOpen,
  ]);

  const content = (
    <div
      className="relative h-full min-h-full overflow-hidden"
      style={{ backgroundColor: "var(--workspace-canvas-base-color)" }}
    >
      {!publicPreview ? <DashboardRefreshProgressLine /> : null}
      {!publicPreview ? <DashboardSurfaceReturnOverlay /> : null}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--workspace-canvas-background)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--workspace-canvas-overlay)" }}
      />

        {editMode && !publicPreview ? (
          <WorkspaceWidgetRail
            widgets={railWidgets}
            activeInstanceId={selectedInstanceId}
            topOffsetClassName="top-4"
            scrollSync={canvasScrollSync.canScroll ? {
              progress: canvasScrollSync.progress,
              canScroll: canvasScrollSync.canScroll,
              onProgressChange: handleCanvasScrollProgressChange,
            } : undefined}
            onOpenWidget={(instanceId) => {
              setSelectedInstanceId(instanceId);
              openWidgetSettings(instanceId);
            }}
          />
        ) : publicPreview ? (
          <WorkspaceWidgetRail
            widgets={railWidgets}
            activeInstanceId={null}
            topOffsetClassName="top-12"
            interactive={false}
            scrollSync={canvasScrollSync.canScroll ? {
              progress: canvasScrollSync.progress,
              canScroll: canvasScrollSync.canScroll,
              onProgressChange: handleCanvasScrollProgressChange,
            } : undefined}
            onOpenWidget={() => {}}
          />
        ) : null}

        <div
          className={cn(
            "relative h-full min-h-full",
            widgetSettingsOpen ? "pointer-events-none select-none" : undefined,
          )}
          aria-hidden={widgetSettingsOpen}
        >

        <div className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0">
          <SidebarOnlyRuntimeMounts
            sidebarOnlyWidgets={sidebarOnlyWidgets}
            permissions={effectivePermissions}
            onRuntimeStateChange={handleWidgetRuntimeStateChange}
          />
        </div>

        <div
          ref={canvasScrollContainerRef}
          data-workspace-canvas-scroll-container="true"
          className={cn(
            "absolute inset-0 overflow-auto pb-4 transition-[padding] duration-200",
            publicPreview ? "pl-12 pr-0" : editMode ? "pl-12 pr-4" : "px-4",
            !publicPreview && dashboardMenuHidden ? "pt-3" : "pt-0",
          )}
          style={{ scrollbarGutter: "stable" }}
        >
          {publicPreview ? <PublicWorkspaceStatusBar /> : null}
          {!publicPreview && dashboardMenuHidden ? (
            <div className="sticky top-0 z-40 mb-3 flex items-center justify-between gap-3">
              <div className="rounded-full border border-border/70 bg-background/86 p-1 shadow-[var(--shadow-panel)] backdrop-blur-xl">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full px-0 text-foreground"
                  title="Show controls (M)"
                  onClick={() => {
                    setDashboardMenuHidden(false);
                  }}
                >
                  <Rows3 className="h-4 w-4" />
                </Button>
              </div>
              {kioskMode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-background/80 backdrop-blur-xl"
                  onClick={() => {
                    setKioskMode(false);
                  }}
                >
                  Exit kiosk
                </Button>
              ) : null}
            </div>
          ) : null}

          {!publicPreview && !dashboardMenuHidden ? (
            <div
              className={cn(
                "sticky top-0 z-40 mb-3 border-b px-0 py-2 backdrop-blur-xl",
                editMode
                  ? "border-primary/55 bg-background/82 shadow-[inset_0_-1px_0_color-mix(in_srgb,var(--primary)_22%,transparent)]"
                  : "border-border/60 bg-background/72",
              )}
            >
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
                        active={selectedWorkspaceDirty}
                        title="Save workspace"
                        onClick={handleSaveAction}
                        disabled={!selectedWorkspaceDirty}
                        className={!selectedWorkspaceDirty ? "opacity-50" : undefined}
                      >
                        {selectedWorkspaceDirty ? (
                          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-warning" />
                        ) : null}
                        <Save className="h-3.5 w-3.5" />
                      </WorkspaceToolbarButton>
                    ) : null}
                    {editMode ? <WorkspaceLoadingStatus /> : null}
                    {editMode && isSaving ? <WorkspaceSavingStatus /> : null}
                    {editMode ? (
                      <Badge variant="primary" className="px-2 py-0.5 text-[10px] tracking-[0.14em]">
                        Editing
                      </Badge>
                    ) : null}
                    {workspaceSelectionPending ? (
                      <Badge variant="neutral" className="px-2 py-0.5 text-[10px] tracking-[0.14em]">
                        Syncing
                      </Badge>
                    ) : null}
                    {publicPreviewSupported ? (
                      <WorkspaceToolbarButton
                        title="Public preview"
                        onClick={() => {
                          if (!selectedDashboard) {
                            return;
                          }

                          const nextParams = new URLSearchParams({
                            workspace: selectedDashboard.id,
                            mode: "public-preview",
                          });

                          navigate(`${workspaceListPath}?${nextParams.toString()}`);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </WorkspaceToolbarButton>
                    ) : null}
                    {editMode ? (
                      <WorkspaceToolbarButton
                        active={libraryOpen}
                        title="Components"
                        onClick={() => {
                          setLibraryOpen((current) => !current);
                        }}
                      >
                        <Boxes className="h-3.5 w-3.5" />
                      </WorkspaceToolbarButton>
                    ) : null}
                    {editMode ? (
                      <WorkspaceSnapshotToolbarControl
                        dashboard={selectedDashboard}
                        resolvedDashboard={resolvedDashboard}
                        permissions={effectivePermissions}
                        profile={snapshotProfile}
                      />
                    ) : null}
                    {editMode ? (
                      <WorkspaceToolbarButton
                        active={requestDebugOpen}
                        title="Debug Request"
                        onClick={() => {
                          setRequestDebugOpen((current) => !current);
                        }}
                      >
                        <Bug className="h-3.5 w-3.5" />
                      </WorkspaceToolbarButton>
                    ) : null}
                    {toolbarActions}
                    {editMode && !snapshotMode ? (
                      <WorkspaceToolbarButton
                        title="Workspace graph"
                        onClick={() => {
                          openWorkspaceGraph();
                        }}
                      >
                        <Waypoints className="h-3.5 w-3.5" />
                      </WorkspaceToolbarButton>
                    ) : null}
                    {editMode && !snapshotMode ? (
                      <WorkspaceToolbarButton
                        title="Workspace settings"
                        onClick={() => {
                          openWorkspaceSettings();
                        }}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </WorkspaceToolbarButton>
                    ) : null}
                    <WorkspaceToolbarButton
                      title="Collapse controls"
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
          ) : null}

          <div
            ref={gridRef}
            data-workspace-canvas-content="true"
            className="relative min-h-full"
            style={{
              minHeight:
                layoutKind === "auto-grid"
                  ? (autoGridFillScreen ? "calc(100vh - 17rem)" : undefined)
                  : `${canvasMinHeight}px`,
            }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedInstanceId(null);
                setActiveSlideWidgetId(null);
              }
            }}
          >
            {showWorkspaceCanvasEditGrid &&
            dotGridBackgroundStyle &&
            (editMode || activeCatalogDrag) ? (
              <div
                className="pointer-events-none absolute inset-0"
                style={dotGridBackgroundStyle}
              />
            ) : null}

            {resolvedDashboard.widgets.length === 0 ? (
              <div className="absolute inset-x-0 top-0 flex min-h-[160px] items-center justify-center">
                <div className="rounded-full border border-border/70 bg-card/82 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground shadow-[var(--shadow-panel)] backdrop-blur-xl">
                  Use the toolbar to add components
                </div>
              </div>
            ) : null}

            {layoutKind === "custom" && measuredGridMetrics ? (
              <>
                <GridLayout
                  className="min-h-full"
                  width={measuredGridMetrics.rect.width}
                  layout={renderedCustomGridLayout}
                  gridConfig={customGridConfig}
                  dragConfig={customGridDragConfig}
                  resizeConfig={customGridResizeConfig}
                  compactor={verticalCompactor}
                  onDragStart={(_layout, _oldItem, newItem) => {
                    if (!editMode) {
                      return;
                    }
                    if (newItem) {
                      const companion = parseCompanionItemId(newItem.i);
                      setSelectedInstanceId(companion?.instanceId ?? newItem.i);

                      if (!companion) {
                        const draggedInstance = rootCanvasWidgets.find((widget) => widget.id === newItem.i);

                        if (
                          draggedInstance &&
                          !draggedInstance.slidePlacement &&
                          draggedInstance.widgetId !== WORKSPACE_SLIDE_WIDGET_ID
                        ) {
                          beginCrossHostTransferDrag(draggedInstance.id, {
                            host: "root",
                          });
                        } else {
                          clearCrossHostTransferDrag();
                        }
                      } else {
                        clearCrossHostTransferDrag();
                      }
                    }
                  }}
                  onLayoutChange={(layout) => {
                    if (!editMode || customMobileLayout) {
                      return;
                    }

                    setCustomGridLayoutDraft(cloneWorkspaceGridLayout(layout));
                  }}
                  onDragStop={(layout, _oldItem, newItem) => {
                    if (!editMode) {
                      return;
                    }

                    if (newItem) {
                      const dropTarget = resolveSlideRegionDropTarget(newItem.i, newItem);

                      if (dropTarget) {
                        clearCrossHostTransferDrag();
                        setCustomGridLayoutDraft(
                          cloneWorkspaceGridLayout(layout).filter((item) => item.i !== newItem.i),
                        );
                        updateSelectedWorkspace((dashboard) =>
                          moveDashboardWidgetToSlideRegion(
                            dashboard,
                            newItem.i,
                            dropTarget.slideWidgetId,
                            dropTarget.region,
                            dropTarget.layout,
                          ),
                        );
                        return;
                      }
                    }

                    clearCrossHostTransferDrag();
                    handleGridLayoutCommit(layout);
                  }}
                  onResizeStart={(_layout, _oldItem, newItem) => {
                    if (!editMode) {
                      return;
                    }
                    if (newItem) {
                      const companion = parseCompanionItemId(newItem.i);
                      setSelectedInstanceId(companion?.instanceId ?? newItem.i);
                    }
                  }}
                  onResizeStop={(layout) => {
                    if (!editMode) {
                      return;
                    }
                    handleGridLayoutCommit(layout);
                  }}
                >
                  {gridChildren}
                </GridLayout>

                {structuralCanvasWidgets.map((instance) =>
                  renderCanvasWidget(instance, {
                    style: layoutToAbsoluteStyle(instance.layout, measuredGridMetrics),
                  }),
                )}
              </>
            ) : layoutKind === "auto-grid" ? (
              <div
                className="grid min-h-full"
                style={{
                  gap: `${resolvedDashboard.grid.gap}px`,
                  gridAutoRows: `${runtimeRowHeight}px`,
                  gridTemplateColumns: autoGridTemplateColumns,
                  minHeight: autoGridFillScreen ? "calc(100vh - 17rem)" : undefined,
                }}
              >
                {autoGridRenderItems.map((item) => {
                  if (item.kind === "companion") {
                    const companionTargetInstanceId = item.candidate.instanceId;
                    const companionDropActive =
                      autoGridReorderState?.draggedInstanceId !== companionTargetInstanceId &&
                      autoGridReorderState?.targetInstanceId === companionTargetInstanceId;

                    return (
                      <div
                        key={item.candidate.itemId}
                        style={autoGridItemStyle(item.candidate.layout)}
                        className={cn(
                          "relative isolate h-full min-w-0 overflow-visible",
                          companionDropActive && autoGridReorderState?.position === "before"
                            ? "shadow-[inset_0_3px_0_0_color-mix(in_srgb,var(--primary)_72%,transparent)]"
                            : undefined,
                          companionDropActive && autoGridReorderState?.position === "after"
                            ? "shadow-[inset_0_-3px_0_0_color-mix(in_srgb,var(--primary)_72%,transparent)]"
                            : undefined,
                        )}
                        onDragOver={(event) => {
                          handleAutoGridDragOver(companionTargetInstanceId, event);
                        }}
                        onDragLeave={(event) => {
                          handleAutoGridDragLeave(companionTargetInstanceId, event);
                        }}
                        onDrop={(event) => {
                          handleAutoGridDrop(companionTargetInstanceId, event);
                        }}
                      >
                        <GridCompanionCard
                          candidate={item.candidate}
                          editable={editMode}
                          onPropsChange={(props) => {
                            updateSelectedWorkspace((dashboard) =>
                              updateDashboardWidgetSettings(dashboard, item.candidate.instanceId, {
                                props,
                              }),
                            );
                          }}
                          onPresentationChange={(presentation) => {
                            updateSelectedWorkspace((dashboard) =>
                              updateDashboardWidgetSettings(dashboard, item.candidate.instanceId, {
                                presentation,
                              }),
                            );
                          }}
                          onRuntimeStateChange={(state) => {
                            handleWidgetRuntimeStateChange(item.candidate.instanceId, state);
                          }}
                          onVisibilityChange={handleCompanionVisibilityChange}
                        />
                      </div>
                    );
                  }

                  const dropActive =
                    autoGridReorderState?.draggedInstanceId !== item.instance.id &&
                    autoGridReorderState?.targetInstanceId === item.instance.id;
                  const autoGridDraggable = editMode;

                  return (
                    <div
                      key={item.instance.id}
                      style={autoGridItemStyle(item.instance.layout, {
                        fullWidth:
                          isWorkspaceRowWidgetId(item.instance.widgetId) ||
                          item.instance.widgetId === WORKSPACE_SLIDE_WIDGET_ID,
                      })}
                      className={cn(
                        "relative isolate h-full min-w-0 overflow-visible",
                        autoGridDraggable ? "cursor-grab active:cursor-grabbing" : undefined,
                        dropActive && autoGridReorderState?.position === "before"
                          ? "shadow-[inset_0_3px_0_0_color-mix(in_srgb,var(--primary)_72%,transparent)]"
                          : undefined,
                        dropActive && autoGridReorderState?.position === "after"
                          ? "shadow-[inset_0_-3px_0_0_color-mix(in_srgb,var(--primary)_72%,transparent)]"
                          : undefined,
                      )}
                      draggable={autoGridDraggable}
                      onDragStart={(event) => {
                        handleAutoGridDragStart(item.instance.id, event);
                      }}
                      onDragOver={(event) => {
                        handleAutoGridDragOver(item.instance.id, event);
                      }}
                      onDragLeave={(event) => {
                        handleAutoGridDragLeave(item.instance.id, event);
                      }}
                      onDrop={(event) => {
                        handleAutoGridDrop(item.instance.id, event);
                      }}
                      onDragEnd={handleAutoGridDragEnd}
                    >
                      {renderCanvasWidget(item.instance)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="grid min-h-full"
                style={{
                  gap: `${resolvedDashboard.grid.gap}px`,
                  gridAutoRows: `${runtimeRowHeight}px`,
                  gridTemplateColumns: `repeat(${activeCanvasGridColumns}, minmax(0, 1fr))`,
                }}
              >
                {gridManagedWidgets.map((instance) => {
                  const layout = customRuntimeGridLayoutById.get(instance.id) ?? instance.layout;

                  return renderCanvasWidget(instance, {
                    style: layoutToStyle(layout),
                  });
                })}
                {visibleCompanionCandidates.map((candidate) => {
                  const layout = customRuntimeGridLayoutById.get(candidate.itemId) ?? candidate.layout;

                  return (
                    <div
                      key={candidate.itemId}
                      style={layoutToStyle(layout)}
                      className="relative isolate h-full overflow-visible"
                    >
                      <GridCompanionCard
                        candidate={candidate}
                        editable={editMode}
                        onPropsChange={(props) => {
                          updateSelectedWorkspace((dashboard) =>
                            updateDashboardWidgetSettings(dashboard, candidate.instanceId, {
                              props,
                            }),
                          );
                        }}
                        onPresentationChange={(presentation) => {
                          updateSelectedWorkspace((dashboard) =>
                            updateDashboardWidgetSettings(dashboard, candidate.instanceId, {
                              presentation,
                            }),
                          );
                        }}
                        onRuntimeStateChange={(state) => {
                          handleWidgetRuntimeStateChange(candidate.instanceId, state);
                        }}
                        onVisibilityChange={handleCompanionVisibilityChange}
                      />
                    </div>
                  );
                })}
                {structuralCanvasWidgets.map((instance) => {
                  const layout = customRuntimeGridLayoutById.get(instance.id) ?? instance.layout;

                  return renderCanvasWidget(instance, {
                    style: layoutToStyle(layout),
                  });
                })}
              </div>
            )}

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
          aria-hidden={!libraryOpen}
          className={cn(
            "absolute left-12 bottom-4 z-30 w-[420px] max-w-[calc(100%-4rem)] overflow-hidden rounded-[24px] border border-border/70 bg-card/92 shadow-[var(--shadow-panel)] backdrop-blur-xl transition-[top,transform,opacity] duration-200",
            dashboardMenuHidden ? "top-4" : "top-12",
            libraryOpen
              ? "translate-x-0 opacity-100"
              : "pointer-events-none -translate-x-[calc(100%+5rem)] opacity-0",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-border/70 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{catalogTitle}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {catalogDescription}
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

              {savedWidgetsPath ? (
                <div className="mt-3 rounded-[18px] border border-border/70 bg-background/32 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">Saved widgets</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Open the saved widgets library page to browse and manage reusable widget instances and groups.
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => {
                        navigate(savedWidgetsPath);
                      }}
                    >
                      <BookOpenText className="h-3.5 w-3.5" />
                      Open
                    </Button>
                  </div>
                </div>
              ) : null}
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

        <WorkspaceComponentBrowser
          open={slideRegionComposer !== null}
          title="Add widget to slide"
          description="Place a normal workspace widget into the selected slide region."
          permissions={effectivePermissions}
          userId={catalogPreferencesUserId}
          topOffsetClassName={dashboardMenuHidden ? "top-4" : "top-12"}
          widgetFilter={(widget) =>
            widget.id !== WORKSPACE_ROW_WIDGET_ID &&
            widget.id !== WORKSPACE_SLIDE_WIDGET_ID &&
            widget.fixedPlacementMode !== "sidebar"
          }
          onOpenChange={(open) => {
            if (!open) {
              setSlideRegionComposer(null);
            }
          }}
          onAddWidget={(widget) => {
            if (!slideRegionComposer) {
              return;
            }

            updateSelectedWorkspace((dashboard) =>
              appendCatalogWidgetToSlideRegion(
                dashboard,
                slideRegionComposer.slideWidgetId,
                slideRegionComposer.region,
                widget,
              ),
            );
            setSlideRegionComposer(null);
          }}
        />

        <WorkspaceRequestDebugPanel
          open={requestDebugOpen}
          onClose={() => {
            setRequestDebugOpen(false);
          }}
          placementClassName={dashboardMenuHidden ? "right-4 top-4 bottom-4" : "right-4 top-16 bottom-4"}
          scopeId={selectedDashboard.id}
          widgets={resolvedDashboard.widgets}
        />

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
        {widgetSettingsOpen ? <CustomWidgetSettingsPage embedded /> : null}
        <SavedWidgetSaveDialog
          dashboard={selectedDashboard}
          instanceId={savedWidgetSaveTargetId}
          open={Boolean(savedWidgetSaveTargetId)}
          onClose={() => {
            setSavedWidgetSaveTargetId(null);
          }}
        />
        <SavedWidgetLibraryDialog
          open={savedWidgetLibraryOpen}
          onClose={() => {
            setSavedWidgetLibraryOpen(false);
          }}
          onImportWidget={(savedWidget) => {
            updateSelectedWorkspace((dashboard) =>
              appendSavedWidgetInstanceToDashboard(dashboard, savedWidget),
            );
            setSavedWidgetLibraryOpen(false);
          }}
          onImportGroup={(savedGroup) => {
            updateSelectedWorkspace((dashboard) =>
              appendSavedWidgetGroupToDashboard(dashboard, savedGroup),
            );
            setSavedWidgetLibraryOpen(false);
          }}
        />
      </div>
  );

  if (!withRuntimeProviders) {
    return content;
  }

  return (
    <DashboardControlsProvider
      key={selectedDashboard.id}
      controls={selectedDashboard.controls}
      onStateChange={(state) => {
        updateSelectedWorkspaceUserState((dashboard) =>
          updateDashboardControlsState(dashboard, state),
        );
      }}
      onStateCommit={commitSelectedWorkspaceControlsState}
    >
      <DashboardWidgetRegistryProvider widgets={resolvedDashboard.widgets}>
        <DashboardWidgetExecutionProvider
          activeSurface="dashboard"
          scopeId={selectedDashboard.id}
          widgets={resolvedDashboard.widgets}
          writeRuntimeState={handleWidgetRuntimeStateChange}
        >
          <DashboardWidgetDependenciesProvider widgets={resolvedDashboard.widgets}>
            {content}
          </DashboardWidgetDependenciesProvider>
        </DashboardWidgetExecutionProvider>
      </DashboardWidgetRegistryProvider>
    </DashboardControlsProvider>
  );
}
