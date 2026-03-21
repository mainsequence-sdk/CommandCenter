import { Network } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { WidgetComponentProps } from "@/widgets/types";

import { MainSequenceLocalUpdateDependencyGraph } from "../../features/data-nodes/MainSequenceLocalUpdateDependencyGraph";

export interface MainSequenceDependencyGraphWidgetProps extends Record<string, unknown> {
  direction?: "downstream" | "upstream";
  localTimeSerieId?: number;
}

export function MainSequenceDependencyGraphWidget({
  props,
  runtimeState,
  onRuntimeStateChange,
}: WidgetComponentProps<MainSequenceDependencyGraphWidgetProps>) {
  const { t } = useTranslation();
  const direction = props.direction === "upstream" ? "upstream" : "downstream";
  const localTimeSerieId = Number(props.localTimeSerieId ?? 0);
  const directionLabel =
    direction === "upstream"
      ? t("mainSequenceDependencyGraph.settings.directionUpstreamShort")
      : t("mainSequenceDependencyGraph.settings.directionDownstreamShort");

  if (!Number.isFinite(localTimeSerieId) || localTimeSerieId <= 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Network className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">
            {t("mainSequenceDependencyGraph.widget.titleMissingLocalTimeSerieId")}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("mainSequenceDependencyGraph.widget.descriptionMissingLocalTimeSerieId", {
              prop: "localTimeSerieId",
            })}
          </p>
        </div>
        <Badge variant="neutral">{directionLabel}</Badge>
      </div>
    );
  }

  return (
    <MainSequenceLocalUpdateDependencyGraph
      direction={direction}
      localTimeSerieId={localTimeSerieId}
      runtimeState={runtimeState}
      onRuntimeStateChange={onRuntimeStateChange}
      variant="widget"
    />
  );
}
