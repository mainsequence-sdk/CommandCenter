import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getWidgetById } from "@/app/registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildWidgetGraphHandleId,
  type WidgetGraphPortKind,
} from "@/dashboards/widget-dependencies";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { resolveWorkspaceWidgetIcon } from "./workspace-widget-icons";

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

export interface WorkspaceGraphNodeData extends Record<string, unknown> {
  title: string;
  widgetId: string;
  widgetKind?: string;
  widgetSource?: string;
  placementMode?: "canvas" | "sidebar";
  hiddenInCollapsedRow: boolean;
  parentRowId?: string;
  inputs: WorkspaceGraphInputPortData[];
  outputs: WorkspaceGraphOutputPortData[];
  availableOutputs: WorkspaceGraphOutputPortData[];
  executionStatus?: "idle" | "running" | "success" | "error";
  executionFinishedAtMs?: number;
  animationNowMs?: number;
  expanded?: boolean;
  dependencyHighlighted?: boolean;
  dependencyRoot?: boolean;
  onHeightChange?: (height: number) => void;
  onToggleExpanded?: () => void;
  onRevealOutput?: (outputId: string) => void;
  onHideOutput?: (outputId: string) => void;
  onOpenSettings?: () => void;
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

function GraphPortHandle({
  kind,
  portId,
  position,
  className,
  style,
  highlighted = false,
}: {
  kind: WidgetGraphPortKind;
  portId: string;
  position: Position;
  className?: string;
  style?: React.CSSProperties;
  highlighted?: boolean;
}) {
  return (
    <Handle
      id={buildWidgetGraphHandleId(kind, portId)}
      type={kind === "output" ? "source" : "target"}
      position={position}
      isConnectable
      isConnectableStart
      isConnectableEnd
      style={style}
      className={cn(
        "!h-3 !w-3 !border-2 !border-background !bg-primary shadow-sm",
        highlighted &&
          "!bg-primary !ring-4 !ring-primary/25 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent),0_0_16px_-4px_color-mix(in_srgb,var(--primary)_65%,transparent)]",
        kind === "input" ? "!-left-1.5" : "!-right-1.5",
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export const WorkspaceGraphNode = memo(function WorkspaceGraphNode({
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
  const WidgetIcon = resolveWorkspaceWidgetIcon(
    widgetDefinition ?? {
      id: data.widgetId,
      title: data.title,
      kind: data.widgetKind,
    },
  );
  const recentlyCompleted = Boolean(
    data.executionStatus === "success" &&
      data.executionFinishedAtMs &&
      data.animationNowMs &&
      data.animationNowMs - data.executionFinishedAtMs < 1800,
  );
  const selectedAvailableOutput = useMemo(
    () =>
      data.availableOutputs.find((output) => output.id === selectedHiddenOutputId) ??
      data.availableOutputs[0] ??
      null,
    [data.availableOutputs, selectedHiddenOutputId],
  );

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

  return (
    <>
      <div
        ref={nodeContainerRef}
        className={cn(
          "relative min-w-[250px] max-w-[300px] rounded-[18px] border bg-card/96 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur-xl",
          data.executionStatus === "running"
            ? "border-primary/80 ring-2 ring-primary/20 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_18%,transparent),0_18px_34px_-24px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
            : undefined,
          data.executionStatus === "error"
            ? "border-danger/70 ring-2 ring-danger/15"
            : undefined,
          recentlyCompleted
            ? "border-success/75 ring-2 ring-success/15 shadow-[0_0_0_1px_color-mix(in_srgb,var(--success)_20%,transparent),0_18px_34px_-24px_color-mix(in_srgb,var(--success)_55%,transparent)]"
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
        )}
      >
      {data.dependencyRoot && data.onOpenSettings ? (
        <div className="pointer-events-none absolute -top-10 right-2 z-20">
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
        </div>
      ) : null}

      {!expanded ? (
        <>
          {data.inputs.map((input, index) => (
            <GraphPortHandle
              key={`collapsed-input-${input.id}`}
              kind="input"
              portId={input.id}
              position={Position.Left}
              className="!opacity-0"
              highlighted={input.dependencyHighlighted}
              style={{ top: resolveCollapsedHandleTop(index, data.inputs.length) }}
            />
          ))}
          {data.outputs.map((output, index) => (
            <GraphPortHandle
              key={`collapsed-output-${output.id}`}
              kind="output"
              portId={output.id}
              position={Position.Right}
              className="!opacity-0"
              highlighted={output.dependencyHighlighted}
              style={{ top: resolveCollapsedHandleTop(index, data.outputs.length) }}
            />
          ))}
        </>
      ) : null}

      <div className="workspace-graph-node-drag-handle cursor-grab select-none border-b border-border/70 px-3.5 py-2.5 active:cursor-grabbing">
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
                {data.executionStatus === "running" ? (
                  <Badge
                    variant="neutral"
                    className="px-1.5 py-0.5 text-[8px] tracking-[0.12em] text-primary"
                  >
                    Running
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
                {data.hiddenInCollapsedRow ? (
                  <Badge variant="warning" className="px-1.5 py-0.5 text-[8px] tracking-[0.12em]">
                    Hidden row
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
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

        {!expanded ? (
          <div className="px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>{data.inputs.length} input{data.inputs.length === 1 ? "" : "s"}</span>
              <span>{data.outputs.length} output{data.outputs.length === 1 ? "" : "s"}</span>
              {data.availableOutputs.length > 0 ? (
                <span>+{data.availableOutputs.length} hidden</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-2.5 p-3 md:grid-cols-2">
            <section className="space-y-2">
              <div className="px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Inputs
              </div>
              {data.inputs.length > 0 ? (
                data.inputs.map((input) => (
                  <div
                    key={input.id}
                    className={cn(
                      "nodrag nopan relative rounded-[12px] border px-3 py-2",
                      input.dependencyHighlighted
                        ? "border-primary/45 bg-primary/8 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
                        : "border-border/70 bg-background/28",
                    )}
                  >
                    <GraphPortHandle
                      kind="input"
                      portId={input.id}
                      position={Position.Left}
                      highlighted={input.dependencyHighlighted}
                    />
                    <div className="flex items-start justify-between gap-2.5">
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
                <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Outputs
                </div>
                {data.availableOutputs.length > 0 ? (
                  <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    +{data.availableOutputs.length} hidden
                  </span>
                ) : null}
              </div>
              {data.outputs.length > 0 ? (
                data.outputs.map((output) => (
                  <div
                    key={output.id}
                    className={cn(
                      "nodrag nopan relative rounded-[12px] border px-3 py-2",
                      output.dependencyHighlighted
                        ? "border-primary/45 bg-primary/8 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
                        : "border-border/70 bg-background/28",
                    )}
                  >
                    <GraphPortHandle
                      kind="output"
                      portId={output.id}
                      position={Position.Right}
                      highlighted={output.dependencyHighlighted}
                    />
                    <div className="flex items-start justify-between gap-2">
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
                      {output.removable ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="nodrag nopan h-6 w-6 shrink-0 px-0 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            data.onHideOutput?.(output.id);
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
                  No outputs shown yet. Add one below to start a connection.
                </div>
              ) : (
                <div className="rounded-[14px] border border-dashed border-border/70 bg-background/25 px-3 py-3 text-[11px] text-muted-foreground">
                  No output ports
                </div>
              )}
              {data.availableOutputs.length > 0 ? (
                <div ref={addOutputTriggerRef}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="nodrag nopan w-full justify-center"
                    onClick={() => {
                      setAddOutputOpen((current) => !current);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add output
                  </Button>
                </div>
              ) : null}
            </section>
          </div>
        )}
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
