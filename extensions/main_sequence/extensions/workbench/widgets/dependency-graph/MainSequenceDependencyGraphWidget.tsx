import { Network } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { WidgetComponentProps } from "@/widgets/types";

import { MainSequenceLocalUpdateDependencyGraph } from "../../features/data-nodes/MainSequenceLocalUpdateDependencyGraph";

export interface MainSequenceDependencyGraphWidgetProps extends Record<string, unknown> {
  direction?: "downstream" | "upstream";
  localTimeSerieId?: number;
}

export function MainSequenceDependencyGraphWidget({
  props,
}: WidgetComponentProps<MainSequenceDependencyGraphWidgetProps>) {
  const direction = props.direction === "upstream" ? "upstream" : "downstream";
  const localTimeSerieId = Number(props.localTimeSerieId ?? 0);

  if (!Number.isFinite(localTimeSerieId) || localTimeSerieId <= 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Network className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Dependency graph needs a LocalTimeSerie id</div>
          <p className="text-sm text-muted-foreground">
            Set <code>localTimeSerieId</code> in the widget props to load upstream or downstream dependencies.
          </p>
        </div>
        <Badge variant="neutral">{direction}</Badge>
      </div>
    );
  }

  return (
    <MainSequenceLocalUpdateDependencyGraph
      direction={direction}
      localTimeSerieId={localTimeSerieId}
      variant="widget"
    />
  );
}
