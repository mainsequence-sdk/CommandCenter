import { memo, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  buildWidgetGraphHandleId,
  type WidgetGraphPortKind,
} from "@/dashboards/widget-dependencies";
import { isWorkspaceRowWidgetId } from "@/dashboards/structural-widgets";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  BarChart3,
  Boxes,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  Plus,
  Rows3,
  Table,
  X,
} from "lucide-react";

export type WorkspaceGraphPortStatus = "connected" | "unbound" | "broken";

export interface WorkspaceGraphInputPortData {
  id: string;
  label: string;
  accepts: string[];
  description?: string;
  required?: boolean;
  status: WorkspaceGraphPortStatus;
}

export interface WorkspaceGraphOutputPortData {
  id: string;
  label: string;
  contract: string;
  description?: string;
  connectionCount: number;
  removable?: boolean;
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
  onRevealOutput?: (outputId: string) => void;
  onHideOutput?: (outputId: string) => void;
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
}: {
  kind: WidgetGraphPortKind;
  portId: string;
  position: Position;
  className?: string;
  style?: React.CSSProperties;
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
        kind === "input" ? "!-left-1.5" : "!-right-1.5",
        className,
      )}
    />
  );
}

function resolveWidgetGraphIcon(data: WorkspaceGraphNodeData) {
  if (isWorkspaceRowWidgetId(data.widgetId)) {
    return Rows3;
  }

  if (/data-node/i.test(data.widgetId) || /data node/i.test(data.title)) {
    return Database;
  }

  if (data.widgetKind === "chart") {
    return BarChart3;
  }

  if (data.widgetKind === "table") {
    return Table;
  }

  if (data.widgetKind === "feed") {
    return Clock3;
  }

  return Boxes;
}

function resolveCollapsedHandleTop(index: number, total: number) {
  if (total <= 1) {
    return 56;
  }

  const start = 36;
  const end = 76;
  return start + ((end - start) * index) / Math.max(1, total - 1);
}

export const WorkspaceGraphNode = memo(function WorkspaceGraphNode({
  data,
  selected,
}: NodeProps<WorkspaceGraphFlowNode>) {
  const [selectedHiddenOutputId, setSelectedHiddenOutputId] = useState("");
  const [addOutputOpen, setAddOutputOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const WidgetIcon = resolveWidgetGraphIcon(data);

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

  return (
    <div
      className={cn(
        "relative min-w-[250px] max-w-[300px] rounded-[18px] border bg-card/96 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur-xl",
        selected ? "border-primary/70 ring-2 ring-primary/25" : "border-border/75",
      )}
    >
      {!expanded ? (
        <>
          {data.inputs.map((input, index) => (
            <GraphPortHandle
              key={`collapsed-input-${input.id}`}
              kind="input"
              portId={input.id}
              position={Position.Left}
              className="!opacity-0"
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
              setExpanded((current) => !current);
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
                className="nodrag nopan relative rounded-[12px] border border-border/70 bg-background/28 px-3 py-2"
              >
                <GraphPortHandle kind="input" portId={input.id} position={Position.Left} />
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
                className="nodrag nopan relative rounded-[12px] border border-border/70 bg-background/28 px-3 py-2"
              >
                <GraphPortHandle kind="output" portId={output.id} position={Position.Right} />
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
            addOutputOpen ? (
              <div className="nodrag nopan rounded-[12px] border border-border/70 bg-background/24 p-2.5">
                <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Add output
                </div>
                <div className="space-y-2">
                  <Select
                    className="nodrag nopan h-8 w-full text-xs"
                    value={selectedHiddenOutputId}
                    onChange={(event) => {
                      setSelectedHiddenOutputId(event.target.value);
                    }}
                  >
                    <option value="" disabled>
                      Select an output
                    </option>
                    {data.availableOutputs.map((output) => (
                      <option key={output.id} value={output.id}>
                        {`${output.label} · ${output.contract}`}
                      </option>
                    ))}
                  </Select>
                  {selectedHiddenOutputId ? (
                    (() => {
                      const selectedOutput =
                        data.availableOutputs.find((output) => output.id === selectedHiddenOutputId) ??
                        null;

                      if (!selectedOutput) {
                        return null;
                      }

                      return (
                        <div className="text-[10px] leading-4 text-muted-foreground">
                          <div className="truncate">{selectedOutput.contract}</div>
                          {selectedOutput.description ? (
                            <div className="mt-1 line-clamp-2">{selectedOutput.description}</div>
                          ) : null}
                        </div>
                      );
                    })()
                  ) : null}
                  <div className="flex items-center justify-end gap-2">
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
                      disabled={!selectedHiddenOutputId}
                      onClick={() => {
                        if (selectedHiddenOutputId) {
                          data.onRevealOutput?.(selectedHiddenOutputId);
                          setAddOutputOpen(false);
                        }
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="nodrag nopan w-full justify-center"
                onClick={() => {
                  setAddOutputOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add output
              </Button>
            )
          ) : null}
        </section>
      </div>
      )}
    </div>
  );
});
