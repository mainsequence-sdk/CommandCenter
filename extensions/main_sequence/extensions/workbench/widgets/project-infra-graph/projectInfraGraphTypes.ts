import type { Edge, Node } from "@xyflow/react";

import type {
  ProjectInfraGraphEdge,
  ProjectInfraGraphNode,
  ProjectInfraGraphResponse,
} from "../../../../common/api";

export type ProjectInfraGraphPayload = ProjectInfraGraphResponse;
export type ProjectInfraGraphRecordNode = ProjectInfraGraphNode;
export type ProjectInfraGraphRecordEdge = ProjectInfraGraphEdge;

export interface ProjectInfraGraphScope {
  commitSha?: string | null;
  graphUrl?: string | null;
  key: string;
  label: string;
}

export interface ProjectInfraEntityNodeData extends Record<string, unknown> {
  accentColor: string;
  backgroundColor: string;
  dimmed: boolean;
  glowColor: string;
  groupName?: string;
  highlighted: boolean;
  isRoot: boolean;
  node: ProjectInfraGraphRecordNode;
}

export type ProjectInfraFlowEntityNode = Node<ProjectInfraEntityNodeData, "infraNode">;
export type ProjectInfraFlowNode = ProjectInfraFlowEntityNode;
export type ProjectInfraFlowEdge = Edge;
