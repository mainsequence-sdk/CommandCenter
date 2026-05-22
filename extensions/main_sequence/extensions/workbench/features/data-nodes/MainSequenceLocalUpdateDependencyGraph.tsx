import { fetchLocalTimeSerieDependencyGraph } from "../../../../common/api";
import {
  MainSequenceUpdateDependencyGraph,
} from "../../widgets/dependency-graph/MainSequenceUpdateDependencyGraph";
import type {
  MainSequenceDependencyGraphRuntimeState,
} from "../../widgets/dependency-graph/MainSequenceDependencyGraphExplorer";
import type {
  MainSequenceDependencyGraphDirection,
} from "../../widgets/dependency-graph/graphLayout";

export function MainSequenceLocalUpdateDependencyGraph({
  direction,
  enabled = true,
  localTimeSerieId,
  runtimeState,
  onRuntimeStateChange,
  variant = "card",
}: {
  direction: MainSequenceDependencyGraphDirection;
  enabled?: boolean;
  localTimeSerieId: string;
  runtimeState?: MainSequenceDependencyGraphRuntimeState;
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  variant?: "card" | "widget";
}) {
  return (
    <MainSequenceUpdateDependencyGraph
      direction={direction}
      enabled={enabled && Boolean(String(localTimeSerieId).trim())}
      queryKey={["main_sequence", "data_nodes", "local_updates", "graph", localTimeSerieId]}
      queryFn={() => fetchLocalTimeSerieDependencyGraph(localTimeSerieId, direction)}
      runtimeState={runtimeState}
      onRuntimeStateChange={onRuntimeStateChange}
      variant={variant}
    />
  );
}
