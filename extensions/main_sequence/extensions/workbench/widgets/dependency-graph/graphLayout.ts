import type {
  LocalTimeSerieDependencyGraphGroup,
  LocalTimeSerieDependencyGraphNode,
  LocalTimeSerieDependencyGraphResponse,
} from "../../../../common/api";

export const dependencyGraphConfig = {
  minZoom: 0.2,
  maxZoom: 5,
  fitPadding: 40,
  node: {
    width: 340,
    height: 92,
  },
  layout: {
    baseX: 200,
    baseY: 60,
    depthSpacing: 160,
    xSpacing: 50,
    groupPaddingX: 22,
    groupPaddingY: 18,
    groupLabelOffsetY: 32,
  },
  minimap: {
    width: 220,
    height: 148,
    padding: 10,
  },
} as const;

export type MainSequenceDependencyGraphDirection = "downstream" | "upstream";

export interface DependencyGraphLayoutNode extends LocalTimeSerieDependencyGraphNode {
  id: string;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  color: string;
  backgroundColor: string;
  badges: string[];
  parentId: string | null;
}

export interface DependencyGraphLayoutEdge {
  id: string;
  source: string;
  target: string;
}

export interface DependencyGraphLayoutGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DependencyGraphLayoutResult {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  edges: DependencyGraphLayoutEdge[];
  groups: DependencyGraphLayoutGroup[];
  nodes: DependencyGraphLayoutNode[];
  nodesById: Map<string, DependencyGraphLayoutNode>;
}

function getGroupId(group: LocalTimeSerieDependencyGraphGroup) {
  const dataId = group.data?.id;
  return typeof dataId === "string" && dataId.trim() ? dataId.trim() : null;
}

function getGroupLabel(group: LocalTimeSerieDependencyGraphGroup, fallbackId: string) {
  const groupName = group.data?.name;
  return typeof groupName === "string" && groupName.trim() ? groupName.trim() : fallbackId;
}

function getNormalizedNodes(payload: LocalTimeSerieDependencyGraphResponse) {
  const nodes = (payload.nodes ?? []).map<DependencyGraphLayoutNode>((node) => {
    const id = String(node.id);
    const depth = Number.isFinite(Number(node.depth)) ? Number(node.depth) : 0;
    const properties =
      node.properties && typeof node.properties === "object" && !Array.isArray(node.properties)
        ? { ...node.properties }
        : {};

    if (node.node_type && !("node_type" in properties)) {
      properties.node_type = node.node_type;
    }

    if (node.remote_table_type && !("remote_table_type" in properties)) {
      properties.remote_table_type = node.remote_table_type;
    }

    return {
      ...node,
      properties,
      id,
      depth,
      x: 0,
      y: 0,
      width: dependencyGraphConfig.node.width,
      height: dependencyGraphConfig.node.height,
      title: node.card_title?.trim() || node.update_hash?.trim() || id,
      subtitle: node.card_subtitle?.trim() || "",
      color: node.color?.trim() || "#64748b",
      backgroundColor: node.background_color?.trim() || node.color?.trim() || "#64748b",
      badges: Array.isArray(node.badges)
        ? node.badges.filter((badge): badge is string => typeof badge === "string" && badge.trim().length > 0)
        : [],
      parentId: typeof node.parent === "string" && node.parent.trim() ? node.parent.trim() : null,
    };
  });

  return nodes;
}

function getNormalizedEdges(
  payload: LocalTimeSerieDependencyGraphResponse,
  nodeIds: Set<string>,
) {
  const edges: DependencyGraphLayoutEdge[] = [];

  (payload.edges ?? []).forEach((edge, index) => {
    // Keep the legacy direction from the previous explorer implementation.
    const source = String(edge.target);
    const target = String(edge.source);

    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      return;
    }

    edges.push({
      id: `edge-${index}-${source}-${target}`,
      source,
      target,
    });
  });

  return edges;
}

function getGroupLabelMap(
  payload: LocalTimeSerieDependencyGraphResponse,
  nodes: DependencyGraphLayoutNode[],
) {
  const labels = new Map<string, string>();

  (payload.groups ?? []).forEach((group) => {
    const id = getGroupId(group);

    if (!id) {
      return;
    }

    labels.set(id, getGroupLabel(group, id));
  });

  nodes.forEach((node) => {
    if (node.parentId && !labels.has(node.parentId)) {
      labels.set(node.parentId, node.parentId);
    }
  });

  return labels;
}

function computeNodePositions(
  nodes: DependencyGraphLayoutNode[],
  direction: MainSequenceDependencyGraphDirection,
) {
  const byDepth = new Map<number, DependencyGraphLayoutNode[]>();

  nodes.forEach((node) => {
    const current = byDepth.get(node.depth) ?? [];
    current.push(node);
    byDepth.set(node.depth, current);
  });

  const depths = [...byDepth.keys()].sort((left, right) => left - right);
  const maxDepth = depths.at(-1) ?? 0;
  const maxRowWidth = Math.max(
    ...depths.map((depth) => {
      const row = byDepth.get(depth) ?? [];
      return row.length * dependencyGraphConfig.node.width + Math.max(0, row.length - 1) * dependencyGraphConfig.layout.xSpacing;
    }),
    dependencyGraphConfig.node.width,
  );

  depths.forEach((depth) => {
    const row = byDepth.get(depth) ?? [];
    const rowWidth =
      row.length * dependencyGraphConfig.node.width +
      Math.max(0, row.length - 1) * dependencyGraphConfig.layout.xSpacing;
    let x =
      dependencyGraphConfig.layout.baseX + Math.max(0, (maxRowWidth - rowWidth) / 2);
    const y =
      direction === "upstream"
        ? dependencyGraphConfig.layout.baseY +
          (maxDepth - depth) * dependencyGraphConfig.layout.depthSpacing
        : dependencyGraphConfig.layout.baseY +
          depth * dependencyGraphConfig.layout.depthSpacing;

    row.forEach((node) => {
      node.x = x;
      node.y = y;
      x += dependencyGraphConfig.node.width + dependencyGraphConfig.layout.xSpacing;
    });
  });
}

function computeGroupBoxes(
  nodes: DependencyGraphLayoutNode[],
  groupLabels: Map<string, string>,
) {
  const byGroup = new Map<string, DependencyGraphLayoutNode[]>();

  nodes.forEach((node) => {
    if (!node.parentId) {
      return;
    }

    const current = byGroup.get(node.parentId) ?? [];
    current.push(node);
    byGroup.set(node.parentId, current);
  });

  return [...byGroup.entries()].map<DependencyGraphLayoutGroup>(([groupId, groupNodes]) => {
    const minX = Math.min(...groupNodes.map((node) => node.x));
    const minY = Math.min(...groupNodes.map((node) => node.y));
    const maxX = Math.max(...groupNodes.map((node) => node.x + node.width));
    const maxY = Math.max(...groupNodes.map((node) => node.y + node.height));

    return {
      id: groupId,
      label: groupLabels.get(groupId) ?? groupId,
      x: minX - dependencyGraphConfig.layout.groupPaddingX,
      y: minY - dependencyGraphConfig.layout.groupLabelOffsetY,
      width:
        maxX -
        minX +
        dependencyGraphConfig.layout.groupPaddingX * 2,
      height:
        maxY -
        minY +
        dependencyGraphConfig.layout.groupPaddingY * 2 +
        dependencyGraphConfig.layout.groupLabelOffsetY,
    };
  });
}

function computeBounds(
  nodes: DependencyGraphLayoutNode[],
  groups: DependencyGraphLayoutGroup[],
) {
  const left = Math.min(
    ...nodes.map((node) => node.x),
    ...groups.map((group) => group.x),
    0,
  );
  const top = Math.min(
    ...nodes.map((node) => node.y),
    ...groups.map((group) => group.y),
    0,
  );
  const right = Math.max(
    ...nodes.map((node) => node.x + node.width),
    ...groups.map((group) => group.x + group.width),
    dependencyGraphConfig.node.width,
  );
  const bottom = Math.max(
    ...nodes.map((node) => node.y + node.height),
    ...groups.map((group) => group.y + group.height),
    dependencyGraphConfig.node.height,
  );

  return {
    x: left,
    y: top,
    width: right - left + dependencyGraphConfig.layout.baseX,
    height: bottom - top + dependencyGraphConfig.layout.baseY,
  };
}

export function buildDependencyGraphLayout(
  payload: LocalTimeSerieDependencyGraphResponse | undefined,
  direction: MainSequenceDependencyGraphDirection,
): DependencyGraphLayoutResult | null {
  if (!payload) {
    return null;
  }

  const nodes = getNormalizedNodes(payload);

  if (!nodes.length) {
    return {
      bounds: {
        x: 0,
        y: 0,
        width: dependencyGraphConfig.node.width,
        height: dependencyGraphConfig.node.height,
      },
      edges: [],
      groups: [],
      nodes: [],
      nodesById: new Map(),
    };
  }

  computeNodePositions(nodes, direction);

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = getNormalizedEdges(payload, nodeIds);
  const groupLabels = getGroupLabelMap(payload, nodes);
  const groups = computeGroupBoxes(nodes, groupLabels);
  const bounds = computeBounds(nodes, groups);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return {
    bounds,
    edges,
    groups,
    nodes,
    nodesById,
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getFitTransform(
  bounds: DependencyGraphLayoutResult["bounds"],
  viewport: { width: number; height: number },
) {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const availableWidth = Math.max(1, width - dependencyGraphConfig.fitPadding * 2);
  const availableHeight = Math.max(1, height - dependencyGraphConfig.fitPadding * 2);
  const nextZoom = clamp(
    Math.min(availableWidth / bounds.width, availableHeight / bounds.height),
    dependencyGraphConfig.minZoom,
    dependencyGraphConfig.maxZoom,
  );

  return {
    panX: (width - bounds.width * nextZoom) / 2 - bounds.x * nextZoom,
    panY: (height - bounds.height * nextZoom) / 2 - bounds.y * nextZoom,
    zoom: nextZoom,
  };
}

export function getHighlightedPathEdgeIds(
  selectedNodeId: string | null,
  edges: DependencyGraphLayoutEdge[],
) {
  if (!selectedNodeId) {
    return new Set<string>();
  }

  const edgesByTarget = new Map<string, DependencyGraphLayoutEdge[]>();

  edges.forEach((edge) => {
    const current = edgesByTarget.get(edge.target) ?? [];
    current.push(edge);
    edgesByTarget.set(edge.target, current);
  });

  const visited = new Set<string>();
  const highlightedEdges = new Set<string>();
  const stack = [selectedNodeId];

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (!currentId || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    (edgesByTarget.get(currentId) ?? []).forEach((edge) => {
      highlightedEdges.add(edge.id);
      stack.push(edge.source);
    });
  }

  return highlightedEdges;
}
