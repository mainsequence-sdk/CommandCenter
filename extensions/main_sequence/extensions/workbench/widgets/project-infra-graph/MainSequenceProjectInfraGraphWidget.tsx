import { Network } from "lucide-react";

import type { WidgetComponentProps } from "@/widgets/types";

import { MainSequenceProjectInfraGraph } from "./MainSequenceProjectInfraGraph";
import {
  normalizeProjectInfraGraphWidgetProps,
  type MainSequenceProjectInfraGraphWidgetProps,
} from "./projectInfraGraphRuntime";

export function MainSequenceProjectInfraGraphWidget({
  props,
}: WidgetComponentProps<MainSequenceProjectInfraGraphWidgetProps>) {
  const normalizedProps = normalizeProjectInfraGraphWidgetProps(props);

  if (!normalizedProps.projectId) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Network className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">
            Infrastructure graph needs a project
          </div>
          <p className="text-sm text-muted-foreground">
            Choose a positive project id in widget settings to load the Main Sequence infrastructure
            graph.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MainSequenceProjectInfraGraph
      initialCommitSha={normalizedProps.commitSha}
      projectId={normalizedProps.projectId}
      variant="widget"
    />
  );
}
