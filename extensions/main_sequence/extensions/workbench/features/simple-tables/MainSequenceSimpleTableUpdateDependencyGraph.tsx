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
  simpleTableUpdateId: string;
  runtimeState?: MainSequenceDependencyGraphRuntimeState;
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  variant?: "card" | "widget";
}) {
  return (
    <MainSequenceUpdateDependencyGraph
      direction={direction}
      enabled={enabled && Boolean(String(simpleTableUpdateId).trim())}
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
