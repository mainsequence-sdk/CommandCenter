import { useQuery } from "@tanstack/react-query";
import { Bot, CheckCircle2, Info, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { fetchActivity } from "@/data/api";
import type { WidgetComponentProps } from "@/widgets/types";

type Props = WidgetComponentProps<{ limit?: number }>;

const levelToVariant = {
  success: "success",
  warning: "warning",
  info: "secondary",
} as const;

export function ActivityFeedWidget({ props }: Props) {
  const limit = props.limit ?? 6;
  const query = useQuery({
    queryKey: ["activity-feed", limit],
    queryFn: () => fetchActivity(limit),
  });

  return (
    <div className="space-y-3">
      {query.data?.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3"
        >
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
            {item.level === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : item.level === "warning" ? (
              <TriangleAlert className="h-4 w-4 text-warning" />
            ) : item.actor.toLowerCase().includes("bot") ? (
              <Bot className="h-4 w-4 text-primary" />
            ) : (
              <Info className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-foreground">
              <span className="font-medium">{item.actor}</span> {item.action}{" "}
              <span className="font-medium">{item.target}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={levelToVariant[item.level]}>{item.level}</Badge>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
