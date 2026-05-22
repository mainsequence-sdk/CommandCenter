import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getWidgetById } from "@/app/registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildWidgetGraphHandleId,
  type WidgetGraphPortKind,
} from "@/dashboards/widget-dependencies";
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  Network,
  PencilLine,
  Plus,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { resolveWorkspaceWidgetIcon } from "./workspace-widget-icons";
import type { WidgetStatusIndicator, WidgetStatusTone } from "@/dashboards/widget-status";

export type WorkspaceGraphPortStatus = "connected" | "unbound" | "broken";

export interface WorkspaceGraphInputPortData {
  id: string;
  label: string;
  accepts: string[];
  description?: string;
  required?: boolean;
  status: WorkspaceGraphPortStatus;
  dependencyHighlighted?: boolean;
}

export interface WorkspaceGraphOutputPortData {
  id: string;
  label: string;
  contract: string;
  description?: string;
  connectionCount: number;
  removable?: boolean;
  dependencyHighlighted?: boolean;
}

export const WORKSPACE_GRAPH_REFERENCE_FRAME_OUTPUT_ID = "__workspace-reference-frame__";
export const WORKSPACE_GRAPH_REFERENCE_SOURCE_INPUT_ID = "__workspace-reference-source__";
const MARKDOWN_NOTE_WIDGET_ID = "markdown-note";
const AGENT_TERMINAL_WIDGET_ID = "main-sequence-ai-agent-terminal";

export interface WorkspaceGraphNodeData extends Record<string, unknown> {
  title: string;
  widgetId: string;
  widgetKind?: string;
  widgetProps?: Record<string, unknown>;
  widgetSource?: string;
  managedRole?: string;
  ownedManagedConnectionSourceCount?: number;
  managedSourcesVisible?: boolean;
  placementMode?: "canvas" | "sidebar";
  railVisibility?: "visible" | "hidden";
  hiddenFromNormalRail?: boolean;
  hiddenInCollapsedRow: boolean;
  parentRowId?: string;
  inputs: WorkspaceGraphInputPortData[];
  outputs: WorkspaceGraphOutputPortData[];
  availableOutputs: WorkspaceGraphOutputPortData[];
  executionStatus?: "idle" | "running" | "success" | "waiting" | "error" | "upstream-error";
  executionMessage?: string;
  executionFinishedAtMs?: number;
  statusIndicator?: WidgetStatusIndicator;
  statusIsLoading?: boolean;
  statusLabel?: string;
  statusTone?: WidgetStatusTone;
  expanded?: boolean;
  readOnly?: boolean;
  dependencyHighlighted?: boolean;
  dependencyRoot?: boolean;
  referenceFrame?: {
    childCount?: number;
    error?: string;
    height: number;
    openPath?: string;
    status: "loading" | "ready" | "missing" | "error";
    width: number;
    workspaceId: string;
    workspaceTitle?: string;
  };
  referenceExpansion?: {
    expanded: boolean;
    status: "idle" | "loading" | "ready" | "missing" | "error";
    targetWorkspaceId: string;
    onToggle: () => void;
  };
  onHeightChange?: (height: number) => void;
  onToggleExpanded?: () => void;
  onRevealOutput?: (outputId: string) => void;
  onHideOutput?: (outputId: string) => void;
  onRevealManagedSources?: () => void;
  onOpenSettings?: () => void;
  onUpdateWidgetProps?: (props: Record<string, unknown>) => void;
  attachedEditorState?: {
    close: () => void;
    draft: string;
    editMode: boolean;
    open: boolean;
    setDraft: (draft: string) => void;
    startEditing: (draft: string) => void;
    stopEditing: (draft: string) => void;
    toggle: (draft: string) => void;
  };
}

export type WorkspaceGraphFlowNode = Node<WorkspaceGraphNodeData, "workspaceWidget">;

function getPortStatusClassName(status: WorkspaceGraphPortStatus) {
  switch (status) {
    case "connected":
      return "bg-success";
    case "broken":
      return "bg-danger";
    default:
      return "bg-muted-foreground/60";
  }
}

function getGraphStatusForegroundClass(tone?: WidgetStatusTone) {
  switch (tone) {
    case "danger":
      return "text-danger";
    case "primary":
      return "text-primary";
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    default:
      return "text-muted-foreground";
  }
}

function getGraphStatusDotClass(tone?: WidgetStatusTone) {
  switch (tone) {
    case "danger":
      return "bg-danger";
    case "primary":
      return "bg-primary";
    case "success":
      return "bg-success";
    case "warning":
      return "bg-warning";
    default:
      return "bg-muted-foreground";
  }
}

function GraphStatusIndicator({
  indicator,
  tone,
}: {
  indicator?: WidgetStatusIndicator;
  tone?: WidgetStatusTone;
}) {
  if (!indicator) {
    return null;
  }

  if (indicator === "lightning") {
    return <Zap className={cn("h-2.5 w-2.5", getGraphStatusForegroundClass(tone))} />;
  }

  if (indicator === "dot+lightning") {
    return (
      <span className="inline-flex items-center gap-0.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", getGraphStatusDotClass(tone))} />
        <Zap className={cn("h-2.5 w-2.5", getGraphStatusForegroundClass(tone))} />
      </span>
    );
  }

  return <span className={cn("h-1.5 w-1.5 rounded-full", getGraphStatusDotClass(tone))} />;
}

function logGraphPortEvent(
  eventName: string,
  event: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>,
  details: {
    interactionMode?: "compact" | "rail" | "row";
    kind: WidgetGraphPortKind;
    label?: string;
    nodeId?: string;
    portId: string;
    readOnly?: boolean;
  },
) {
  void eventName;
  void event;
  void details;
}

function GraphPortHandle({
  connectable = true,
  kind,
  portId,
  position,
  className,
  style,
  highlighted = false,
  interactionMode = "compact",
  label,
  nodeId,
}: {
  connectable?: boolean;
  kind: WidgetGraphPortKind;
  portId: string;
  position: Position;
  className?: string;
  style?: React.CSSProperties;
  highlighted?: boolean;
  interactionMode?: "compact" | "rail" | "row";
  label?: string;
  nodeId?: string;
}) {
  const handleId = buildWidgetGraphHandleId(kind, portId);

  return (
    <Handle
      id={handleId}
      data-graph-port-handle={handleId}
      type={kind === "output" ? "source" : "target"}
      position={position}
      isConnectable={connectable}
      isConnectableStart={connectable}
      isConnectableEnd={connectable}
      style={style}
      onMouseEnter={(event) => {
        logGraphPortEvent("handle mouseenter", event, {
          interactionMode,
          kind,
          label,
          nodeId,
          portId,
        });
      }}
      onMouseDown={(event) => {
        logGraphPortEvent("handle mousedown", event, {
          interactionMode,
          kind,
          label,
          nodeId,
          portId,
        });
      }}
      onMouseUp={(event) => {
        logGraphPortEvent("handle mouseup", event, {
          interactionMode,
          kind,
          label,
          nodeId,
          portId,
        });
      }}
      className={cn(
        "workspace-graph-port-handle",
        interactionMode === "row" ? "workspace-graph-port-row-handle" : undefined,
        "!border-transparent !bg-transparent !shadow-none before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-primary/10 before:opacity-0 before:transition-opacity after:pointer-events-none after:absolute after:top-1/2 after:h-3 after:w-3 after:-translate-y-1/2 after:rounded-full after:border-2 after:border-background after:bg-primary after:shadow-sm after:transition-transform",
        interactionMode === "rail"
          ? cn(
              "!z-20 !top-1 !h-[calc(100%-8px)] !w-8 !-translate-y-0 !rounded-[12px]",
              kind === "input"
                ? "after:!left-0 after:!-translate-x-1/2"
                : "after:!left-auto after:!right-0 after:translate-x-1/2",
            )
          : interactionMode === "row"
            ? cn(
                "!z-10 !left-0 !right-0 !top-0 !h-full !w-full !translate-x-0 !translate-y-0 !rounded-[12px]",
                kind === "input"
                  ? "after:!left-0 after:!-translate-x-1/2"
                  : "after:!left-auto after:!right-0 after:translate-x-1/2",
              )
            : "!z-20 !h-6 !w-6 !rounded-full after:!left-1/2 after:!-translate-x-1/2",
        connectable
          ? "!pointer-events-auto !cursor-crosshair hover:before:opacity-100 hover:after:scale-110 active:after:scale-125"
          : "!pointer-events-none after:!bg-muted-foreground/80",
        highlighted &&
          "!ring-4 !ring-primary/25 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent),0_0_16px_-4px_color-mix(in_srgb,var(--primary)_65%,transparent)] after:!bg-primary",
        interactionMode === "row" ? undefined : kind === "input" ? "!-left-4" : "!-right-4",
        className,
      )}
    />
  );
}

function resolveCollapsedHandleTop(index: number, total: number) {
  if (total <= 1) {
    return 56;
  }

  const start = 36;
  const end = 76;
  return start + ((end - start) * index) / Math.max(1, total - 1);
}

const ADD_OUTPUT_PANEL_WIDTH_PX = 340;
const ADD_OUTPUT_PANEL_MAX_HEIGHT_PX = 440;
const ADD_OUTPUT_PANEL_GAP_PX = 12;
const ADD_OUTPUT_PANEL_VIEWPORT_PADDING_PX = 12;

interface GraphAttachedEditorConfig {
  actionAriaLabel: string;
  anchor: "right" | "top";
  buttonIcon: "markdown" | "prompt";
  description: string;
  editable: boolean;
  emptyState: string;
  openLinksInNewTab: boolean;
  placeholder: string;
  title: string;
  value: string;
  buildNextProps: (draft: string) => Record<string, unknown>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export const WorkspaceGraphNode = memo(function WorkspaceGraphNode({
  id,
  data,
  selected,
}: NodeProps<WorkspaceGraphFlowNode>) {
  const [selectedHiddenOutputId, setSelectedHiddenOutputId] = useState("");
  const [addOutputOpen, setAddOutputOpen] = useState(false);
  const [addOutputPanelPosition, setAddOutputPanelPosition] = useState<{
    left: number;
    maxHeight: number;
    top: number;
  } | null>(null);
  const addOutputPanelRef = useRef<HTMLDivElement | null>(null);
  const addOutputTriggerRef = useRef<HTMLDivElement | null>(null);
  const nodeContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetDefinition = getWidgetById(data.widgetId);
  const expanded = Boolean(data.expanded);
  const readOnly = Boolean(data.readOnly);
  const updateNodeInternals = useUpdateNodeInternals();
  const inputHandleSignature = data.inputs.map((input) => input.id).join("\u001f");
  const outputHandleSignature = data.outputs.map((output) => output.id).join("\u001f");
  const referenceHandleSignature = data.referenceExpansion?.expanded ? "reference-expanded" : "reference-collapsed";
  const WidgetIcon = resolveWorkspaceWidgetIcon({
    ...(widgetDefinition ?? {
      id: data.widgetId,
      title: data.title,
      kind: data.widgetKind,
    }),
    props: data.widgetProps,
  });
  const selectedAvailableOutput = useMemo(
    () =>
      data.availableOutputs.find((output) => output.id === selectedHiddenOutputId) ??
      data.availableOutputs[0] ??
      null,
    [data.availableOutputs, selectedHiddenOutputId],
  );
  const attachedEditorConfig = useMemo<GraphAttachedEditorConfig | null>(() => {
    if (data.widgetId === MARKDOWN_NOTE_WIDGET_ID) {
      const content = typeof data.widgetProps?.content === "string" ? data.widgetProps.content : "";

      return {
        actionAriaLabel: `Open markdown note for ${data.title}`,
        anchor: "right",
        buttonIcon: "markdown",
        description: "Rendered Markdown note content for this widget.",
        editable: true,
        emptyState: "Markdown note is empty.",
        openLinksInNewTab: data.widgetProps?.openLinksInNewTab !== false,
        placeholder: "# Note\n\nWrite Markdown here.",
        title: "Markdown note",
        value: content,
        buildNextProps: (draft) => ({
          ...(data.widgetProps ?? {}),
          content: draft,
        }),
      };
    }

    if (data.widgetId === AGENT_TERMINAL_WIDGET_ID) {
      const promptOnRefresh =
        typeof data.widgetProps?.promptOnRefresh === "string"
          ? data.widgetProps.promptOnRefresh
          : "";

      return {
        actionAriaLabel: `Open prompt editor for ${data.title}`,
        anchor: "top",
        buttonIcon: "prompt",
        description: "Saved Prompt on refresh Markdown for this Agent Terminal widget.",
        editable: false,
        emptyState: "No Prompt on refresh is configured for this Agent Terminal widget.",
        openLinksInNewTab: true,
        placeholder: "## Refresh instruction\n\nSummarize what changed since the last refresh.",
        title: "Prompt on refresh",
        value: promptOnRefresh,
        buildNextProps: (draft) => {
          const nextProps = {
            ...(data.widgetProps ?? {}),
          };

          if (draft.trim()) {
            nextProps.promptOnRefresh = draft;
          } else {
            delete nextProps.promptOnRefresh;
          }

          return nextProps;
        },
      };
    }

    return null;
  }, [data.title, data.widgetId, data.widgetProps]);
  const attachedEditorValue = attachedEditorConfig?.value ?? "";
  const attachedEditorOpen = Boolean(data.attachedEditorState?.open);
  const attachedEditorEditMode = Boolean(data.attachedEditorState?.editMode);
  const attachedEditorDraft = data.attachedEditorState?.draft ?? attachedEditorValue;
  const canEditAttachedCard =
    !readOnly &&
    Boolean(data.onUpdateWidgetProps) &&
    Boolean(attachedEditorConfig?.editable);
  const attachedEditorVisible = Boolean(attachedEditorConfig && attachedEditorOpen);
  const executionNotice =
    data.statusTone === "danger"
      ? {
          label: data.statusLabel?.trim() || "Issue",
          message:
            data.executionMessage?.trim() ||
            "Execution failed. Open the widget settings or inspect upstream inputs for details.",
          tone: "danger" as const,
        }
      : data.statusTone === "warning" && data.executionMessage
        ? {
            label: data.statusLabel?.trim() || "Waiting",
            message:
              data.executionMessage?.trim() ||
              "Waiting for an upstream widget before execution can continue.",
            tone: "warning" as const,
          }
        : null;
  const statusShowsLightning =
    data.statusIndicator === "lightning" || data.statusIndicator === "dot+lightning";

  useEffect(() => {
    if (data.availableOutputs.length === 0) {
      setSelectedHiddenOutputId("");
      setAddOutputOpen(false);
      return;
    }

    if (
      selectedHiddenOutputId &&
      data.availableOutputs.some((output) => output.id === selectedHiddenOutputId)
    ) {
      return;
    }

    setSelectedHiddenOutputId(data.availableOutputs[0]?.id ?? "");
  }, [data.availableOutputs, selectedHiddenOutputId]);

  useEffect(() => {
    if (!expanded) {
      setAddOutputOpen(false);
    }
  }, [expanded]);

  useLayoutEffect(() => {
    updateNodeInternals(id);
    const frame = window.requestAnimationFrame(() => {
      updateNodeInternals(id);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    expanded,
    id,
    inputHandleSignature,
    outputHandleSignature,
    readOnly,
    referenceHandleSignature,
    updateNodeInternals,
  ]);

  useLayoutEffect(() => {
    const container = nodeContainerRef.current;

    if (!container || !data.onHeightChange) {
      return undefined;
    }

    const publishHeight = (height: number) => {
      data.onHeightChange?.(Math.ceil(height));
    };

    publishHeight(container.getBoundingClientRect().height);

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      publishHeight(entry.contentRect.height);
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [data.onHeightChange]);

  useLayoutEffect(() => {
    if (!addOutputOpen) {
      setAddOutputPanelPosition(null);
      return;
    }

    const trigger = addOutputTriggerRef.current;

    if (!trigger) {
      return;
    }

    const updatePosition = () => {
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const preferredRightLeft = rect.right + ADD_OUTPUT_PANEL_GAP_PX;
      const preferredLeftLeft = rect.left - ADD_OUTPUT_PANEL_GAP_PX - ADD_OUTPUT_PANEL_WIDTH_PX;
      const fitsRight =
        preferredRightLeft + ADD_OUTPUT_PANEL_WIDTH_PX <=
        viewportWidth - ADD_OUTPUT_PANEL_VIEWPORT_PADDING_PX;
      const fitsLeft = preferredLeftLeft >= ADD_OUTPUT_PANEL_VIEWPORT_PADDING_PX;
      const left = fitsRight
        ? preferredRightLeft
        : fitsLeft
          ? preferredLeftLeft
          : clamp(
              rect.left + rect.width / 2 - ADD_OUTPUT_PANEL_WIDTH_PX / 2,
              ADD_OUTPUT_PANEL_VIEWPORT_PADDING_PX,
              viewportWidth - ADD_OUTPUT_PANEL_WIDTH_PX - ADD_OUTPUT_PANEL_VIEWPORT_PADDING_PX,
            );
      const maxHeight = Math.min(
        ADD_OUTPUT_PANEL_MAX_HEIGHT_PX,
        viewportHeight - ADD_OUTPUT_PANEL_VIEWPORT_PADDING_PX * 2,
      );
      const top = clamp(
        rect.top - 16,
        ADD_OUTPUT_PANEL_VIEWPORT_PADDING_PX,
        viewportHeight - maxHeight - ADD_OUTPUT_PANEL_VIEWPORT_PADDING_PX,
      );

      setAddOutputPanelPosition({
        left,
        maxHeight,
        top,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [addOutputOpen]);

  useEffect(() => {
    if (!addOutputOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as globalThis.Node | null;

      if (!target) {
        return;
      }

      if (
        addOutputPanelRef.current?.contains(target) ||
        addOutputTriggerRef.current?.contains(target)
      ) {
        return;
      }

      setAddOutputOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAddOutputOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [addOutputOpen]);

  useEffect(() => {
    if (!attachedEditorVisible) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        data.attachedEditorState?.stopEditing(attachedEditorValue);
        data.attachedEditorState?.close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [attachedEditorValue, attachedEditorVisible, data.attachedEditorState]);

  if (data.referenceFrame) {
    return (
      <div
        className="relative rounded-[18px] border border-primary/25 bg-background/18 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_10%,transparent),0_18px_44px_-30px_rgba(0,0,0,0.65)] backdrop-blur-sm"
        style={{
          height: data.referenceFrame.height,
          width: data.referenceFrame.width,
        }}
      >
        <GraphPortHandle
          connectable={false}
          kind="output"
          portId={WORKSPACE_GRAPH_REFERENCE_FRAME_OUTPUT_ID}
          position={Position.Right}
          className="!bg-primary"
          style={{ top: 62 }}
        />
        <div className="h-full w-full overflow-hidden rounded-[18px]">
          <div className="flex items-center justify-between gap-4 border-b border-primary/20 bg-primary/6 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Referenced workspace
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-foreground">
                {data.referenceFrame.workspaceTitle ?? data.referenceFrame.workspaceId}
              </div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                {data.referenceFrame.workspaceId}
              </div>
            </div>
            <Badge
              variant={
                data.referenceFrame.status === "error"
                  ? "danger"
                  : data.referenceFrame.status === "missing"
                    ? "warning"
                    : data.referenceFrame.status === "loading"
                      ? "neutral"
                      : "success"
              }
              className="shrink-0 px-2 py-0.5 text-[9px] tracking-[0.12em]"
            >
              {data.referenceFrame.status}
            </Badge>
          </div>
          <div className="px-4 py-3 text-[11px] text-muted-foreground">
            {data.referenceFrame.error ? (
              <span className="text-danger">{data.referenceFrame.error}</span>
            ) : data.referenceFrame.status === "ready" ? (
              <span>
                {data.referenceFrame.childCount ?? 0} graph node
                {(data.referenceFrame.childCount ?? 0) === 1 ? "" : "s"} shown
              </span>
            ) : data.referenceFrame.status === "loading" ? (
              <span>Loading workspace graph...</span>
            ) : null}
            {data.referenceFrame.openPath ? (
              <Link
                to={data.referenceFrame.openPath}
                className="ml-3 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                Open workspace
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={nodeContainerRef}
        className={cn(
          "relative min-w-[250px] max-w-[300px] rounded-[18px] border bg-card/96 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur-xl",
            attachedEditorVisible ? "z-50" : undefined,
          data.statusIsLoading
            ? "border-primary/80 ring-2 ring-primary/20 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_18%,transparent),0_18px_34px_-24px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
            : undefined,
          data.statusTone === "success" &&
            !selected &&
            !data.dependencyHighlighted &&
            !data.dependencyRoot
            ? "border-success/70 ring-2 ring-success/10"
            : undefined,
          data.statusTone === "danger"
            ? "border-danger/70 ring-2 ring-danger/15"
            : undefined,
          data.statusTone === "warning"
            ? "border-warning/70 ring-2 ring-warning/15"
            : undefined,
          data.dependencyHighlighted
            ? "border-primary/55 bg-primary/5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_18%,transparent),0_18px_34px_-24px_color-mix(in_srgb,var(--primary)_32%,transparent)]"
            : undefined,
          data.dependencyRoot
            ? "border-primary ring-2 ring-primary/30 bg-primary/7 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_26%,transparent),0_18px_34px_-20px_color-mix(in_srgb,var(--primary)_46%,transparent)]"
            : undefined,
          selected && data.dependencyRoot
            ? "border-primary/85 ring-2 ring-primary/30"
            : selected
              ? "border-primary/70 ring-2 ring-primary/25"
              : "border-border/75",
          executionNotice?.tone === "danger"
            ? "border-2 border-danger/90 bg-danger/5 ring-4 ring-danger/25 shadow-[0_0_0_1px_color-mix(in_srgb,var(--danger)_40%,transparent),0_18px_40px_-22px_color-mix(in_srgb,var(--danger)_65%,transparent)]"
            : undefined,
          executionNotice?.tone === "warning"
            ? "border-2 border-warning/85 bg-warning/6 ring-4 ring-warning/20 shadow-[0_0_0_1px_color-mix(in_srgb,var(--warning)_34%,transparent),0_18px_40px_-22px_color-mix(in_srgb,var(--warning)_52%,transparent)]"
            : undefined,
        )}
      >
      {data.dependencyRoot && !readOnly && (data.onOpenSettings || data.referenceExpansion) ? (
        <div className="pointer-events-none absolute -top-10 left-2 z-20 flex items-center gap-2">
          {data.referenceExpansion ? (
            <Button
              variant={data.referenceExpansion.expanded ? "outline" : "default"}
              size="sm"
              className="pointer-events-auto nodrag nopan h-8 rounded-full px-3 text-[11px] font-medium shadow-[var(--shadow-panel)] backdrop-blur-md"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.referenceExpansion?.onToggle();
              }}
            >
              {data.referenceExpansion.status === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Network className="h-3.5 w-3.5" />
              )}
              {data.referenceExpansion.expanded ? "Hide workspace" : "Expand workspace"}
            </Button>
          ) : null}
          {data.onOpenSettings ? (
            <Button
              variant="outline"
              size="sm"
              className="pointer-events-auto nodrag nopan h-8 rounded-full border-primary/35 bg-background/96 px-3 text-[11px] font-medium shadow-[var(--shadow-panel)] backdrop-blur-md hover:border-primary/55 hover:bg-background"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onOpenSettings?.();
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Open settings
            </Button>
          ) : null}
        </div>
      ) : null}

      {!expanded ? (
        <>
          {data.referenceExpansion?.expanded ? (
            <GraphPortHandle
              connectable={false}
              kind="input"
              portId={WORKSPACE_GRAPH_REFERENCE_SOURCE_INPUT_ID}
              position={Position.Left}
              className="!bg-primary"
              style={{ top: 56 }}
            />
          ) : null}
          {data.inputs.map((input, index) => (
            <GraphPortHandle
              key={`collapsed-input-${input.id}`}
              connectable={!readOnly}
              kind="input"
              label={input.label}
              nodeId={id}
              portId={input.id}
              position={Position.Left}
              className="!opacity-100"
              highlighted={input.dependencyHighlighted}
              style={{ top: resolveCollapsedHandleTop(index, data.inputs.length) }}
            />
          ))}
          {data.outputs.map((output, index) => (
            <GraphPortHandle
              key={`collapsed-output-${output.id}`}
              connectable={!readOnly}
              kind="output"
              label={output.label}
              nodeId={id}
              portId={output.id}
              position={Position.Right}
              className="!opacity-100"
              highlighted={output.dependencyHighlighted}
              style={{ top: resolveCollapsedHandleTop(index, data.outputs.length) }}
            />
          ))}
        </>
      ) : null}

      <div
        className={cn(
          "workspace-graph-node-drag-handle select-none border-b border-border/70 px-3.5 py-2.5",
          readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-border/70 bg-background/55 text-muted-foreground">
              <WidgetIcon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="truncate text-[13px] font-semibold leading-4 text-foreground">
                {data.title}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {data.statusIsLoading ? (
                  <Badge
                    variant="neutral"
                    className="px-1.5 py-0.5 text-[8px] tracking-[0.12em] text-primary"
                  >
                    {data.statusLabel?.trim() || "Running"}
                  </Badge>
                ) : null}
                {executionNotice ? (
                  <Badge
                    variant={executionNotice.tone}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] tracking-[0.12em]"
                  >
                    <GraphStatusIndicator
                      indicator={data.statusIndicator}
                      tone={data.statusTone}
                    />
                    {executionNotice.label}
                  </Badge>
                ) : null}
                {!executionNotice && statusShowsLightning && data.statusTone === "success" ? (
                  <Badge
                    variant="success"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] tracking-[0.12em]"
                  >
                    <GraphStatusIndicator
                      indicator={data.statusIndicator}
                      tone={data.statusTone}
                    />
                    {data.statusLabel?.trim() || "Live"}
                  </Badge>
                ) : null}
                {data.widgetKind ? (
                  <Badge variant="neutral" className="px-1.5 py-0.5 text-[8px] tracking-[0.12em]">
                    {data.widgetKind}
                  </Badge>
                ) : null}
                {data.widgetSource ? (
                  <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    {data.widgetSource}
                  </span>
                ) : null}
                {data.placementMode === "sidebar" ? (
                  <Badge variant="warning" className="px-1.5 py-0.5 text-[8px] tracking-[0.12em]">
                    Sidebar
                  </Badge>
                ) : null}
                {data.managedRole ? (
                  <Badge variant="neutral" className="px-1.5 py-0.5 text-[8px] tracking-[0.12em]">
                    Managed
                  </Badge>
                ) : null}
                {(data.ownedManagedConnectionSourceCount ?? 0) > 0 ? (
                  <Badge variant="neutral" className="px-1.5 py-0.5 text-[8px] tracking-[0.12em]">
                    {(data.ownedManagedConnectionSourceCount ?? 0) === 1
                      ? "Managed connection"
                      : `${data.ownedManagedConnectionSourceCount} managed connections`}
                  </Badge>
                ) : null}
                {data.hiddenFromNormalRail ? (
                  <Badge variant="warning" className="px-1.5 py-0.5 text-[8px] tracking-[0.12em]">
                    Hidden rail
                  </Badge>
                ) : null}
                {data.hiddenInCollapsedRow ? (
                  <Badge variant="warning" className="px-1.5 py-0.5 text-[8px] tracking-[0.12em]">
                    Hidden row
                  </Badge>
                ) : null}
                {readOnly ? (
                  <Badge variant="neutral" className="px-1.5 py-0.5 text-[8px] tracking-[0.12em]">
                    Read-only
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          {data.referenceExpansion ? (
            <Button
              variant={data.referenceExpansion.expanded ? "outline" : "ghost"}
              size="sm"
              className="nodrag nopan h-7 w-7 shrink-0 rounded-[10px] px-0 text-muted-foreground hover:text-foreground"
              aria-label={
                data.referenceExpansion.expanded
                  ? `Hide referenced workspace ${data.referenceExpansion.targetWorkspaceId}`
                  : `Show referenced workspace ${data.referenceExpansion.targetWorkspaceId}`
              }
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.referenceExpansion?.onToggle();
              }}
            >
              {data.referenceExpansion.status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Network className="h-4 w-4" />
              )}
            </Button>
          ) : null}
          {data.onRevealManagedSources ? (
            <Button
              variant="ghost"
              size="sm"
              className="nodrag nopan h-7 shrink-0 rounded-[10px] px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              aria-label={`Show managed connection source for ${data.title}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onRevealManagedSources?.();
              }}
            >
              <Network className="h-3.5 w-3.5" />
              Source
            </Button>
          ) : null}
          {attachedEditorConfig ? (
            <div className="shrink-0">
              <Button
                variant={attachedEditorVisible ? "outline" : "ghost"}
                size="sm"
                className="nodrag nopan h-7 w-7 shrink-0 rounded-[10px] px-0 text-muted-foreground hover:text-foreground"
                aria-label={attachedEditorConfig.actionAriaLabel}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  data.attachedEditorState?.toggle(attachedEditorValue);
                }}
              >
                {attachedEditorConfig.buttonIcon === "markdown" ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <PencilLine className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="nodrag nopan h-7 w-7 shrink-0 rounded-[10px] px-0 text-muted-foreground hover:text-foreground"
            aria-label={expanded ? `Collapse ${data.title}` : `Expand ${data.title}`}
            onClick={() => {
              data.onToggleExpanded?.();
            }}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

        {executionNotice ? (
          <div
            className={cn(
              "border-b px-3.5 py-2",
              executionNotice.tone === "danger"
                ? "border-danger/35 bg-danger/10"
                : "border-warning/35 bg-warning/10",
            )}
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em]",
                  executionNotice.tone === "danger"
                    ? "border-danger/30 bg-danger/12 text-danger"
                    : "border-warning/30 bg-warning/12 text-warning",
                )}
              >
                {executionNotice.label}
              </span>
              <p
                className={cn(
                  "line-clamp-3 text-[11px] leading-4",
                  executionNotice.tone === "danger" ? "text-danger" : "text-warning",
                )}
              >
                {executionNotice.message}
              </p>
            </div>
          </div>
        ) : null}

        {!expanded ? (
          <div className="px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>{data.inputs.length} input{data.inputs.length === 1 ? "" : "s"}</span>
              <span>{data.outputs.length} output{data.outputs.length === 1 ? "" : "s"}</span>
              {(data.ownedManagedConnectionSourceCount ?? 0) > 0 ? (
                <span>
                  {(data.ownedManagedConnectionSourceCount ?? 0) === 1
                    ? data.managedSourcesVisible
                      ? "managed source visible"
                      : "managed source hidden"
                    : data.managedSourcesVisible
                      ? `${data.ownedManagedConnectionSourceCount} managed sources visible`
                      : `${data.ownedManagedConnectionSourceCount} managed sources hidden`}
                </span>
              ) : null}
              {data.availableOutputs.length > 0 ? (
                <span>+{data.availableOutputs.length} hidden</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-2.5 p-3 md:grid-cols-2">
            {data.referenceExpansion?.expanded ? (
              <GraphPortHandle
                connectable={false}
                kind="input"
                portId={WORKSPACE_GRAPH_REFERENCE_SOURCE_INPUT_ID}
                position={Position.Left}
                className="!bg-primary"
                style={{ top: 56 }}
              />
            ) : null}
            <section className="space-y-2">
              <div className="px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Inputs
              </div>
              {data.inputs.length > 0 ? (
                data.inputs.map((input) => (
                  <div
                    key={input.id}
                    className={cn(
                      "workspace-graph-port-row nodrag nopan group/port relative rounded-[12px] border px-3 py-2",
                      !readOnly ? "cursor-crosshair" : undefined,
                      input.dependencyHighlighted
                        ? "border-primary/45 bg-primary/8 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
                        : "border-border/70 bg-background/28",
                    )}
                    onClickCapture={(event) => {
                      logGraphPortEvent("row click", event, {
                        kind: "input",
                        label: input.label,
                        nodeId: id,
                        portId: input.id,
                        readOnly,
                      });
                    }}
                    onMouseEnter={(event) => {
                      logGraphPortEvent("row mouseenter", event, {
                        kind: "input",
                        label: input.label,
                        nodeId: id,
                        portId: input.id,
                        readOnly,
                      });
                    }}
                    onPointerDownCapture={(event) => {
                      logGraphPortEvent("row pointerdown", event, {
                        kind: "input",
                        label: input.label,
                        nodeId: id,
                        portId: input.id,
                        readOnly,
                      });
                    }}
                  >
                    <GraphPortHandle
                      connectable={!readOnly}
                      kind="input"
                      label={input.label}
                      nodeId={id}
                      portId={input.id}
                      position={Position.Left}
                      interactionMode="row"
                      highlighted={input.dependencyHighlighted}
                    />
                    <div className="pointer-events-none relative z-20 flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-medium leading-4 text-foreground">
                          {input.label}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-4 text-muted-foreground">
                          {input.required ? (
                            <span className="font-medium uppercase tracking-[0.12em] text-warning">
                              Required
                            </span>
                          ) : null}
                          {input.accepts.length > 0 ? (
                            <span className="truncate">
                              {input.accepts.join(", ")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "mt-1 h-2 w-2 shrink-0 rounded-full",
                          getPortStatusClassName(input.status),
                        )}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[14px] border border-dashed border-border/70 bg-background/25 px-3 py-3 text-[11px] text-muted-foreground">
                  No input ports
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="min-w-0 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Outputs
                </div>
                {data.availableOutputs.length > 0 ? (
                  !readOnly ? (
                    <div ref={addOutputTriggerRef} className="shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="nodrag nopan h-6 min-w-0 shrink-0 rounded-full px-1.5 text-[9px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setAddOutputOpen((current) => !current);
                        }}
                        aria-label={`Reveal ${data.availableOutputs.length} hidden output${data.availableOutputs.length === 1 ? "" : "s"}`}
                      >
                        <Plus className="h-3 w-3" />
                        {data.availableOutputs.length}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      +{data.availableOutputs.length} hidden
                    </span>
                  )
                ) : null}
              </div>
              {data.outputs.length > 0 ? (
                data.outputs.map((output) => (
                  <div
                    key={output.id}
                    className={cn(
                      "workspace-graph-port-row nodrag nopan group/port relative rounded-[12px] border px-3 py-2",
                      !readOnly ? "cursor-crosshair" : undefined,
                      output.dependencyHighlighted
                        ? "border-primary/45 bg-primary/8 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
                        : "border-border/70 bg-background/28",
                    )}
                    onClickCapture={(event) => {
                      logGraphPortEvent("row click", event, {
                        kind: "output",
                        label: output.label,
                        nodeId: id,
                        portId: output.id,
                        readOnly,
                      });
                    }}
                    onMouseEnter={(event) => {
                      logGraphPortEvent("row mouseenter", event, {
                        kind: "output",
                        label: output.label,
                        nodeId: id,
                        portId: output.id,
                        readOnly,
                      });
                    }}
                    onPointerDownCapture={(event) => {
                      logGraphPortEvent("row pointerdown", event, {
                        kind: "output",
                        label: output.label,
                        nodeId: id,
                        portId: output.id,
                        readOnly,
                      });
                    }}
                  >
                    <GraphPortHandle
                      connectable={!readOnly}
                      kind="output"
                      label={output.label}
                      nodeId={id}
                      portId={output.id}
                      position={Position.Right}
                      interactionMode="row"
                      highlighted={output.dependencyHighlighted}
                    />
                    <div className="pointer-events-none relative z-20 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-medium leading-4 text-foreground">
                          {output.label}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-4 text-muted-foreground">
                          <span className="truncate">{output.contract}</span>
                          <span className="uppercase tracking-[0.12em]">
                            {output.connectionCount} connection{output.connectionCount === 1 ? "" : "s"}
                          </span>
                        </div>
                        {output.description ? (
                          <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                            {output.description}
                          </div>
                        ) : null}
                      </div>
                      {output.removable && !readOnly ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="pointer-events-auto nodrag nopan relative z-30 h-6 w-6 shrink-0 px-0 text-muted-foreground hover:text-foreground"
                          data-graph-port-control="true"
                          onClick={() => {
                            data.onHideOutput?.(output.id);
                          }}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                          }}
                          aria-label={`Hide ${output.label}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : data.availableOutputs.length > 0 ? (
                <div className="rounded-[14px] border border-dashed border-border/70 bg-background/25 px-3 py-3 text-[11px] text-muted-foreground">
                  No outputs shown yet. Use the + control above to reveal one and start a connection.
                </div>
              ) : (
                <div className="rounded-[14px] border border-dashed border-border/70 bg-background/25 px-3 py-3 text-[11px] text-muted-foreground">
                  No output ports
                </div>
              )}
            </section>
          </div>
        )}
        {attachedEditorConfig && attachedEditorVisible ? (
          <div
            className={cn(
              "nodrag nopan absolute z-40 flex flex-col overflow-hidden rounded-[18px] border border-border/80 bg-background/96 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur-xl",
              attachedEditorConfig.anchor === "top" ? "h-[420px] w-[560px]" : "min-h-[280px] w-[560px]",
              attachedEditorConfig.anchor === "top"
                ? "bottom-[calc(100%+72px)] left-1/2 -translate-x-1/2 before:absolute before:left-1/2 before:top-full before:h-[72px] before:w-px before:-translate-x-1/2 before:bg-border/70"
                : "top-14 left-[calc(100%+12px)] before:absolute before:top-9 before:right-full before:h-px before:w-[12px] before:bg-border/70",
            )}
            onPointerDownCapture={(event) => {
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="border-b border-border/70 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {attachedEditorConfig.title}
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {data.title}
                  </div>
                  <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    {attachedEditorConfig.description}
                  </div>
                </div>
                {canEditAttachedCard ? (
                  <Button
                    variant={attachedEditorEditMode ? "outline" : "ghost"}
                    size="sm"
                    className="nodrag nopan shrink-0"
                    onPointerDownCapture={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={() => {
                      if (attachedEditorEditMode) {
                        data.onUpdateWidgetProps?.(attachedEditorConfig.buildNextProps(attachedEditorDraft));
                        data.attachedEditorState?.stopEditing(attachedEditorDraft);
                        return;
                      }

                      data.attachedEditorState?.startEditing(attachedEditorValue);
                    }}
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                    {attachedEditorEditMode ? "Apply" : "Edit"}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
              {attachedEditorEditMode && canEditAttachedCard ? (
                <Textarea
                  value={attachedEditorDraft}
                  spellCheck={false}
                  placeholder={attachedEditorConfig.placeholder}
                  className={cn(
                    "font-mono text-xs leading-6",
                    attachedEditorConfig.anchor === "top"
                      ? "h-full min-h-0 resize-none overflow-auto"
                      : "min-h-[360px]",
                  )}
                  onPointerDownCapture={(event) => {
                    event.stopPropagation();
                  }}
                  onChange={(event) => {
                    data.attachedEditorState?.setDraft(event.target.value);
                  }}
                />
              ) : attachedEditorValue.trim() ? (
                <MarkdownContent
                  content={attachedEditorValue}
                  openLinksInNewTab={attachedEditorConfig.openLinksInNewTab}
                />
              ) : (
                <div className="rounded-[14px] border border-dashed border-border/70 bg-background/25 px-4 py-5 text-sm text-muted-foreground">
                  {attachedEditorConfig.emptyState}
                </div>
              )}
            </div>
            <div className="border-t border-border/70 px-4 py-3">
              <div className="flex items-center justify-end gap-2">
                {attachedEditorEditMode && canEditAttachedCard ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="nodrag nopan"
                  onPointerDownCapture={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={() => {
                    data.attachedEditorState?.stopEditing(attachedEditorValue);
                  }}
                >
                  Cancel
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="nodrag nopan"
                  onPointerDownCapture={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={() => {
                    data.attachedEditorState?.stopEditing(attachedEditorValue);
                    data.attachedEditorState?.close();
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {addOutputOpen && addOutputPanelPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={addOutputPanelRef}
              className="nodrag nopan fixed z-[140] flex w-[340px] flex-col overflow-hidden rounded-[18px] border border-border/80 bg-background/96 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur-xl"
              style={{
                left: addOutputPanelPosition.left,
                maxHeight: addOutputPanelPosition.maxHeight,
                top: addOutputPanelPosition.top,
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="border-b border-border/70 px-4 py-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Add output
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  Reveal one hidden output on this node
                </div>
                <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  Scroll inside the list below or use the arrow keys after selecting an item.
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <div className="space-y-2">
                  {data.availableOutputs.map((output) => {
                    const selectedOutput = output.id === selectedAvailableOutput?.id;

                    return (
                      <button
                        key={output.id}
                        type="button"
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-[14px] border px-3 py-2 text-left transition-colors",
                          selectedOutput
                            ? "border-primary/55 bg-primary/8 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
                            : "border-border/70 bg-background/28 hover:bg-background/44",
                        )}
                        onClick={() => {
                          setSelectedHiddenOutputId(output.id);
                        }}
                      >
                        <div className="text-[12px] font-medium leading-4 text-foreground">
                          {output.label}
                        </div>
                        <div className="text-[10px] leading-4 text-muted-foreground">
                          {output.contract}
                        </div>
                        {output.description ? (
                          <div className="text-[10px] leading-4 text-muted-foreground">
                            {output.description}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="border-t border-border/70 px-4 py-3">
                {selectedAvailableOutput ? (
                  <div className="rounded-[12px] border border-border/70 bg-background/28 px-3 py-2">
                    <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Selected output
                    </div>
                    <div className="mt-1 text-[12px] font-medium text-foreground">
                      {selectedAvailableOutput.label}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                      {selectedAvailableOutput.contract}
                    </div>
                    {selectedAvailableOutput.description ? (
                      <div className="mt-1 text-[10px] leading-4 text-muted-foreground">
                        {selectedAvailableOutput.description}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="nodrag nopan"
                    onClick={() => {
                      setAddOutputOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="nodrag nopan"
                    disabled={!selectedAvailableOutput}
                    onClick={() => {
                      if (selectedAvailableOutput) {
                        data.onRevealOutput?.(selectedAvailableOutput.id);
                        setAddOutputOpen(false);
                      }
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
});
