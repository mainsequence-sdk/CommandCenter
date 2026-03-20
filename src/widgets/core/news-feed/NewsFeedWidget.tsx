import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Minus, TrendingDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { Separator } from "@/components/ui/separator";
import { fetchNews } from "@/data/api";
import type { WidgetComponentProps } from "@/widgets/types";

type Props = WidgetComponentProps<{ limit?: number }>;

export function NewsFeedWidget({ props }: Props) {
  const limit = props.limit ?? 6;
  const { rangeStartMs, rangeEndMs, timeRangeKey } = useDashboardControls();
  const query = useQuery({
    queryKey: ["news", limit, timeRangeKey, rangeStartMs, rangeEndMs],
    queryFn: () => fetchNews(limit),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: limit }).map((_, index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded-[calc(var(--radius)-6px)] bg-muted/70"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {query.data?.map((item, index) => (
        <div key={item.id}>
          <div className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3 transition-colors hover:bg-muted/35">
            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
              {item.sentiment === "positive" ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-success" />
              ) : item.sentiment === "negative" ? (
                <TrendingDown className="h-3.5 w-3.5 text-danger" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-medium leading-6 text-foreground">
                {item.title}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{item.source}</Badge>
                <span className="text-xs text-muted-foreground">{item.time}</span>
                {item.tags.map((tag) => (
                  <span key={tag} className="text-xs text-muted-foreground">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {index < (query.data?.length ?? 0) - 1 ? <Separator className="my-3" /> : null}
        </div>
      ))}
    </div>
  );
}
