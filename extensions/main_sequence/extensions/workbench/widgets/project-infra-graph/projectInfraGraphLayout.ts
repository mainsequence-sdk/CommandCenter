import type { ComponentType } from "react";

import { MarkerType, Position } from "@xyflow/react";
import {
  Boxes,
  Database,
  Fingerprint,
  FolderKanban,
  Package,
  PlaySquare,
  Server,
} from "lucide-react";

import type {
  ProjectInfraGraphEdge,
  ProjectInfraGraphGroup,
  ProjectInfraGraphNode,
  ProjectInfraGraphResponse,
} from "../../../../common/api";
import type {
  ProjectInfraFlowEdge,
  ProjectInfraFlowNode,
} from "./projectInfraGraphTypes";

const ROOT_NODE_SIZE = 184;
const STANDARD_NODE_SIZE = 132;
const ROOT_RING_RADIUS = 320;
const RING_STEP = 156;
const FORCE_ITERATIONS = 180;

interface ProjectInfraGroupTheme {
  accentColor: string;
  backgroundColor: string;
  glowColor: string;
}

export interface ProjectInfraGroupLegendEntry {
  accentColor: string;
  count: number;
  id: string;
  name: string;
}

const projectInfraGroupPalette: ProjectInfraGroupTheme[] = [
  {
    accentColor: "var(--color-primary)",
    backgroundColor: "color-mix(in srgb, var(--color-primary) 15%, var(--card) 85%)",
    glowColor: "color-mix(in srgb, var(--color-primary) 16%, transparent)",
  },
  {
    accentColor: "var(--color-success)",
    backgroundColor: "color-mix(in srgb, var(--color-success) 14%, var(--card) 86%)",
    glowColor: "color-mix(in srgb, var(--color-success) 15%, transparent)",
  },
  {
    accentColor: "var(--color-warning)",
    backgroundColor: "color-mix(in srgb, var(--color-warning) 15%, var(--card) 85%)",
    glowColor: "color-mix(in srgb, var(--color-warning) 16%, transparent)",
  },
  {
    accentColor: "var(--color-accent)",
    backgroundColor: "color-mix(in srgb, var(--color-accent) 15%, var(--card) 85%)",
    glowColor: "color-mix(in srgb, var(--color-accent) 16%, transparent)",
  },
  {
    accentColor: "color-mix(in srgb, var(--color-foreground) 70%, var(--color-primary) 30%)",
    backgroundColor:
      "color-mix(in srgb, color-mix(in srgb, var(--color-foreground) 70%, var(--color-primary) 30%) 14%, var(--card) 86%)",
    glowColor:
      "color-mix(in srgb, color-mix(in srgb, var(--color-foreground) 70%, var(--color-primary) 30%) 15%, transparent)",
  },
  {
    accentColor: "var(--color-danger)",
    backgroundColor: "color-mix(in srgb, var(--color-danger) 13%, var(--card) 87%)",
    glowColor: "color-mix(in srgb, var(--color-danger) 14%, transparent)",
  },
];

function getNodeSortLabel(node: ProjectInfraGraphNode) {
  return `${node.depth.toString().padStart(4, "0")}:${node.card_title.toLowerCase()}:${node.id}`;
}

function getImplicitGroups(payload: ProjectInfraGraphResponse) {
  const groups = new Map(payload.groups.map((group) => [group.data.id, group] as const));

  payload.nodes.forEach((node) => {
    if (!node.parent || groups.has(node.parent)) {
      return;
    }

    groups.set(node.parent, {
      data: {
        id: node.parent,
        name: node.parent.replace(/^group:/, "").replace(/_/g, " "),
      },
    } satisfies ProjectInfraGraphGroup);
  });

  return groups;
}

function getOrderedGroups(payload: ProjectInfraGraphResponse) {
  const implicitGroups = getImplicitGroups(payload);
  const orderedIds = [
    ...payload.groups.map((group) => group.data.id),
    ...Array.from(implicitGroups.keys()).filter(
      (groupId) => !payload.groups.some((group) => group.data.id === groupId),
    ),
  ];

  return orderedIds
    .map((groupId) => implicitGroups.get(groupId))
    .filter((group): group is ProjectInfraGraphGroup => Boolean(group));
}

function getGroupTheme(index: number): ProjectInfraGroupTheme {
  return projectInfraGroupPalette[index % projectInfraGroupPalette.length]!;
}

export function buildProjectInfraGroupLegend(
  payload: ProjectInfraGraphResponse,
): ProjectInfraGroupLegendEntry[] {
  return getOrderedGroups(payload)
    .map((group, index) => ({
      accentColor: getGroupTheme(index).accentColor,
      count: payload.nodes.filter((node) => node.parent === group.data.id).length,
      id: group.data.id,
      name: group.data.name,
    }))
    .filter((entry) => entry.count > 0);
}

function findRootNode(payload: ProjectInfraGraphResponse) {
  return (
    payload.nodes.find((node) => node.node_type === "project") ??
    [...payload.nodes].sort((left, right) => left.depth - right.depth)[0] ??
    null
  );
}

function buildInitialNodeTargets(
  payload: ProjectInfraGraphResponse,
  rootNode: ProjectInfraGraphNode | null,
) {
  const groupLegend = buildProjectInfraGroupLegend(payload);
  const targets = new Map<string, { accentColor: string; backgroundColor: string; glowColor: string; groupName?: string; x: number; y: number; }>();
  const rootColor: ProjectInfraGroupTheme = {
    accentColor: "var(--color-primary)",
    backgroundColor: "color-mix(in srgb, var(--color-primary) 18%, var(--card) 82%)",
    glowColor: "color-mix(in srgb, var(--color-primary) 18%, transparent)",
  };

  if (rootNode) {
    targets.set(rootNode.id, {
      ...rootColor,
      groupName: undefined,
      x: 0,
      y: 0,
    });
  }

  const groupedNodesById = new Map(groupLegend.map((group) => [group.id, payload.nodes
    .filter((node) => node.parent === group.id && node.id !== rootNode?.id)
    .sort((left, right) => getNodeSortLabel(left).localeCompare(getNodeSortLabel(right)))] as const));

  const startAngle = -Math.PI / 2;
  groupLegend.forEach((group, groupIndex) => {
    const nodes = groupedNodesById.get(group.id) ?? [];
    const baseAngle =
      startAngle + (groupIndex / Math.max(groupLegend.length, 1)) * Math.PI * 2;
    const theme = getGroupTheme(groupIndex);
    const depthBuckets = new Map<number, ProjectInfraGraphNode[]>();

    nodes.forEach((node) => {
      const bucket = depthBuckets.get(node.depth) ?? [];
      bucket.push(node);
      depthBuckets.set(node.depth, bucket);
    });

    depthBuckets.forEach((bucketNodes) => {
      const sectorWidth = Math.min(1.04, Math.max(0.34, 0.2 * bucketNodes.length));

      bucketNodes.forEach((node, index) => {
        const baseRadius = ROOT_RING_RADIUS + Math.max(node.depth - 1, 0) * RING_STEP;
        const angleOffset =
          bucketNodes.length <= 1
            ? 0
            : ((index / Math.max(1, bucketNodes.length - 1)) - 0.5) * sectorWidth;
        const angle = baseAngle + angleOffset;
        const radius = baseRadius + ((index % 3) - 1) * 20;

        targets.set(node.id, {
          accentColor: theme.accentColor,
          backgroundColor: theme.backgroundColor,
          glowColor: theme.glowColor,
          groupName: group.name,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
      });
    });
  });

  const ungroupedNodes = payload.nodes
    .filter((node) => node.id !== rootNode?.id && !node.parent)
    .sort((left, right) => getNodeSortLabel(left).localeCompare(getNodeSortLabel(right)));

  ungroupedNodes.forEach((node, index) => {
    const angle =
      startAngle + (index / Math.max(ungroupedNodes.length, 1)) * Math.PI * 2;
    const radius = ROOT_RING_RADIUS + Math.max(node.depth - 1, 0) * RING_STEP;

    targets.set(node.id, {
      accentColor: "color-mix(in srgb, var(--color-foreground) 68%, var(--color-primary) 32%)",
      backgroundColor:
        "color-mix(in srgb, color-mix(in srgb, var(--color-foreground) 68%, var(--color-primary) 32%) 12%, var(--card) 88%)",
      glowColor:
        "color-mix(in srgb, color-mix(in srgb, var(--color-foreground) 68%, var(--color-primary) 32%) 14%, transparent)",
      groupName: undefined,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  });

  return targets;
}

function getNodeRadius(node: ProjectInfraGraphNode, rootNodeId: string | null) {
  return node.id === rootNodeId ? ROOT_NODE_SIZE / 2 : STANDARD_NODE_SIZE / 2;
}

function runRadialRelaxation(
  payload: ProjectInfraGraphResponse,
  rootNodeId: string | null,
  targets: Map<string, { x: number; y: number }>,
) {
  const positions = new Map<
    string,
    {
      fixed: boolean;
      radius: number;
      x: number;
      y: number;
    }
  >(
    payload.nodes.map((node) => [
      node.id,
      {
        fixed: node.id === rootNodeId,
        radius: getNodeRadius(node, rootNodeId),
        x: targets.get(node.id)?.x ?? 0,
        y: targets.get(node.id)?.y ?? 0,
      },
    ]),
  );
  const validEdges = payload.edges.filter(
    (edge) => positions.has(edge.source) && positions.has(edge.target),
  );

  for (let iteration = 0; iteration < FORCE_ITERATIONS; iteration += 1) {
    const nodes = payload.nodes;

    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      const left = positions.get(nodes[leftIndex]!.id)!;

      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const right = positions.get(nodes[rightIndex]!.id)!;
        let dx = right.x - left.x;
        let dy = right.y - left.y;
        let distance = Math.hypot(dx, dy);

        if (distance < 0.001) {
          dx = 0.01;
          dy = 0.01;
          distance = 0.014;
        }

        const minDistance = left.radius + right.radius + 34;

        if (distance >= minDistance) {
          continue;
        }

        const push = (minDistance - distance) * 0.18;
        const normalX = dx / distance;
        const normalY = dy / distance;

        if (!left.fixed) {
          left.x -= normalX * push;
          left.y -= normalY * push;
        }

        if (!right.fixed) {
          right.x += normalX * push;
          right.y += normalY * push;
        }
      }
    }

    validEdges.forEach((edge) => {
      const source = positions.get(edge.source)!;
      const target = positions.get(edge.target)!;
      let dx = target.x - source.x;
      let dy = target.y - source.y;
      let distance = Math.hypot(dx, dy);

      if (distance < 0.001) {
        dx = 0.01;
        dy = 0.01;
        distance = 0.014;
      }

      const desiredDistance =
        (edge.source === rootNodeId || edge.target === rootNodeId ? ROOT_RING_RADIUS - 32 : 190) +
        26 * Math.max(0, Math.abs((payload.nodes.find((node) => node.id === edge.source)?.depth ?? 0) - (payload.nodes.find((node) => node.id === edge.target)?.depth ?? 0)));
      const pull = (distance - desiredDistance) * 0.018;
      const normalX = dx / distance;
      const normalY = dy / distance;

      if (!source.fixed) {
        source.x += normalX * pull;
        source.y += normalY * pull;
      }

      if (!target.fixed) {
        target.x -= normalX * pull;
        target.y -= normalY * pull;
      }
    });

    nodes.forEach((node) => {
      const position = positions.get(node.id)!;
      const target = targets.get(node.id);

      if (position.fixed || !target) {
        return;
      }

      position.x += (target.x - position.x) * 0.05;
      position.y += (target.y - position.y) * 0.05;
    });
  }

  return positions;
}

function getEdgeLabel(edge: ProjectInfraGraphEdge) {
  return edge.kind === "has_secret" &&
    typeof edge.properties.alias === "string" &&
    edge.properties.alias.trim()
    ? edge.properties.alias.trim()
    : null;
}

function buildSelectionState(
  payload: ProjectInfraGraphResponse,
  selectedNodeId: string | null,
) {
  const highlightedNodeIds = new Set<string>();
  const highlightedEdgeIds = new Set<string>();

  if (!selectedNodeId) {
    return { highlightedEdgeIds, highlightedNodeIds };
  }

  highlightedNodeIds.add(selectedNodeId);
  payload.edges.forEach((edge, index) => {
    if (edge.source !== selectedNodeId && edge.target !== selectedNodeId) {
      return;
    }

    highlightedNodeIds.add(edge.source);
    highlightedNodeIds.add(edge.target);
    highlightedEdgeIds.add(`${edge.source}:${edge.target}:${edge.kind}:${index}`);
  });

  return { highlightedEdgeIds, highlightedNodeIds };
}

export function resolveProjectInfraNodeIcon(
  nodeType: string,
): ComponentType<{ className?: string }> {
  switch (nodeType) {
    case "project":
      return FolderKanban;
    case "project_resource":
      return Boxes;
    case "job":
      return PlaySquare;
    case "project_image":
      return Package;
    case "resource_release":
      return Server;
    case "local_time_serie":
      return Database;
    case "secret":
      return Fingerprint;
    default:
      return Boxes;
  }
}

export function buildProjectInfraGraphFlow(
  payload: ProjectInfraGraphResponse,
  selectedNodeId: string | null,
): {
  edges: ProjectInfraFlowEdge[];
  nodes: ProjectInfraFlowNode[];
} {
  const rootNode = findRootNode(payload);
  const targets = buildInitialNodeTargets(payload, rootNode);
  const positions = runRadialRelaxation(payload, rootNode?.id ?? null, targets);
  const selectionState = buildSelectionState(payload, selectedNodeId);

  const nodes: ProjectInfraFlowNode[] = payload.nodes.map((node) => {
    const position = positions.get(node.id)!;
    const theme = targets.get(node.id)!;
    const isRoot = node.id === rootNode?.id;
    const highlighted = selectionState.highlightedNodeIds.has(node.id);
    const dimmed = Boolean(selectedNodeId) && !highlighted;

    return {
      id: node.id,
      type: "infraNode",
      data: {
        accentColor: theme.accentColor,
        backgroundColor: theme.backgroundColor,
        dimmed,
        glowColor: theme.glowColor,
        groupName: theme.groupName,
        highlighted,
        isRoot,
        node,
      },
      draggable: false,
      position: {
        x: position.x - (isRoot ? ROOT_NODE_SIZE : STANDARD_NODE_SIZE) / 2,
        y: position.y - (isRoot ? ROOT_NODE_SIZE : STANDARD_NODE_SIZE) / 2,
      },
      selectable: true,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        width: isRoot ? ROOT_NODE_SIZE : STANDARD_NODE_SIZE,
        height: isRoot ? ROOT_NODE_SIZE : STANDARD_NODE_SIZE,
      },
    };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: ProjectInfraFlowEdge[] = payload.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge, index) => {
      const id = `${edge.source}:${edge.target}:${edge.kind}:${index}`;
      const highlighted = selectionState.highlightedEdgeIds.has(id);
      const dimmed = Boolean(selectedNodeId) && !highlighted;
      const label = getEdgeLabel(edge);

      return {
        id,
        source: edge.source,
        target: edge.target,
        selectable: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: highlighted
            ? "var(--color-primary)"
            : "color-mix(in srgb, var(--border) 80%, transparent)",
        },
        style: {
          opacity: dimmed ? 0.24 : 0.92,
          stroke: highlighted
            ? "var(--color-primary)"
            : "color-mix(in srgb, var(--border) 80%, transparent)",
          strokeWidth: highlighted ? 3 : 1.9,
        },
        label: label ?? undefined,
        labelShowBg: Boolean(label),
        labelBgStyle: {
          fill: "color-mix(in srgb, var(--card) 92%, transparent)",
          fillOpacity: 0.94,
        },
        labelStyle: {
          fill: "color-mix(in srgb, var(--foreground) 82%, transparent)",
          fontSize: 11,
          fontWeight: 600,
        },
      } satisfies ProjectInfraFlowEdge;
    });

  return { nodes, edges };
}
