import { fetchSimpleTableUpdateDependencyGraph } from "../../../../common/api";
import {
  MainSequenceUpdateDependencyGraph,
} from "../../widgets/dependency-graph/MainSequenceUpdateDependencyGraph";
import type {
  MainSequenceDependencyGraphRuntimeState,
} from "../../widgets/dependency-graph/MainSequenceDependencyGraphExplorer";
import type {
  MainSequenceDependencyGraphDirection,
} from "../../widgets/dependency-graph/graphLayout";

export function MainSequenceSimpleTableUpdateDependencyGraph({
  direction,
  enabled = true,
  simpleTableUpdateId,
  runtimeState,
  onRuntimeStateChange,
  variant = "card",
}: {
  direction: MainSequenceDependencyGraphDirection;
  enabled?: boolean;
  simpleTableUpdateId: number;
  runtimeState?: MainSequenceDependencyGraphRuntimeState;
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  variant?: "card" | "widget";
}) {
  return (
    <MainSequenceUpdateDependencyGraph
      direction={direction}
      enabled={enabled && simpleTableUpdateId > 0}
      queryKey={[
        "main_sequence",
        "simple_tables",
        "updates",
        "graph",
        simpleTableUpdateId,
      ]}
      queryFn={() => fetchSimpleTableUpdateDependencyGraph(simpleTableUpdateId, direction)}
      runtimeState={runtimeState}
      onRuntimeStateChange={onRuntimeStateChange}
      variant={variant}
    />
  );
}
