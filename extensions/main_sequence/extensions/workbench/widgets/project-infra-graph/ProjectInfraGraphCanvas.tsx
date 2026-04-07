import { memo, useMemo } from "react";

import {
  Background,
  Controls,
  ReactFlow,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  buildProjectInfraGraphFlow,
  buildProjectInfraGroupLegend,
  resolveProjectInfraNodeIcon,
} from "./projectInfraGraphLayout";
import type {
  ProjectInfraFlowEntityNode,
  ProjectInfraGraphPayload,
} from "./projectInfraGraphTypes";

const ProjectInfraEntityNode = memo(function ProjectInfraEntityNode({
  data,
  selected,
}: NodeProps<ProjectInfraFlowEntityNode>) {
  const Icon = resolveProjectInfraNodeIcon(data.node.node_type);

  return (
    <div
      className={cn(
        "flex h-full w-full select-none items-center justify-center rounded-full border text-center shadow-[var(--shadow-panel)] backdrop-blur-xl transition-all",
        data.isRoot ? "p-6" : "p-4.5",
        selected
          ? "ring-4 ring-primary/28"
          : data.highlighted
            ? "ring-2 ring-primary/18"
            : undefined,
        data.dimmed ? "opacity-35" : "opacity-100",
      )}
      style={{
        backgroundColor: data.backgroundColor,
        borderColor: data.accentColor,
        boxShadow: selected || data.highlighted
          ? `0 0 0 1px ${data.glowColor}, 0 24px 44px -28px ${data.glowColor}`
          : `0 18px 38px -26px ${data.glowColor}`,
      }}
      title={data.node.card_subtitle ?? data.node.card_title}
    >
      <div className="flex min-w-0 flex-col items-center gap-2">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/60",
            data.isRoot ? "h-12 w-12" : "h-9 w-9",
          )}
          style={{ color: data.accentColor }}
        >
          <Icon className={cn(data.isRoot ? "h-5 w-5" : "h-4 w-4")} />
        </div>
        <div className={cn("min-w-0 space-y-1", data.isRoot ? "max-w-[120px]" : "max-w-[92px]")}>
          <div
            className={cn(
              "line-clamp-3 font-semibold text-foreground",
              data.isRoot ? "text-sm leading-5" : "text-[12px] leading-4",
            )}
          >
            {data.node.card_title}
          </div>
          {data.isRoot ? (
            <div className="line-clamp-2 text-xs leading-4 text-muted-foreground">
              {data.node.card_subtitle?.trim() || data.groupName || "Project root"}
            </div>
          ) : data.node.card_subtitle?.trim() ? (
            <div className="line-clamp-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {data.node.card_subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

const projectInfraNodeTypes = {
  infraNode: ProjectInfraEntityNode,
};

export function ProjectInfraGraphCanvas({
  compact = false,
  onSelectNode,
  payload,
  selectedNodeId,
}: {
  compact?: boolean;
  onSelectNode: (nodeId: string | null) => void;
  payload: ProjectInfraGraphPayload;
  selectedNodeId: string | null;
}) {
  const flow = useMemo(
    () => buildProjectInfraGraphFlow(payload, selectedNodeId),
    [payload, selectedNodeId],
  );
  const groupLegend = useMemo(() => buildProjectInfraGroupLegend(payload), [payload]);

  return (
    <div
      className={cn(
        "relative h-full overflow-hidden rounded-[20px] border border-border/70 bg-[var(--workspace-canvas-base-color)]",
        compact ? "min-h-[440px]" : "min-h-[760px]",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap gap-2 p-3">
        {groupLegend.map((group) => (
          <Badge
            key={group.id}
            variant="neutral"
            className="pointer-events-auto gap-2 rounded-full px-3 py-1 text-[10px] tracking-[0.14em]"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: group.accentColor }}
            />
            <span>{group.name}</span>
            <span className="text-muted-foreground">{group.count}</span>
          </Badge>
        ))}
      </div>

      <ReactFlow
        key={payload.nodes.map((node) => node.id).join("|")}
        className="workspace-graph-flow"
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={projectInfraNodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        panOnScroll
        selectionOnDrag={false}
        zoomOnDoubleClick={false}
        minZoom={0.3}
        maxZoom={1.7}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          onSelectNode(node.id);
        }}
        onPaneClick={() => {
          onSelectNode(null);
        }}
      >
        <Background
          color="var(--workspace-grid-dot)"
          gap={24}
          size={1.2}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
