import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Clock3, Newspaper, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchActivity, fetchKpiCards, fetchNews } from "@/data/api";
import { formatCurrency, formatPercent } from "@/lib/format";

export function MarketBriefApp() {
  const kpisQuery = useQuery({
    queryKey: ["market-brief-kpis"],
    queryFn: () => fetchKpiCards("AAPL"),
  });
  const newsQuery = useQuery({
    queryKey: ["market-brief-news"],
    queryFn: () => fetchNews(4),
  });
  const activityQuery = useQuery({
    queryKey: ["market-brief-activity"],
    queryFn: () => fetchActivity(4),
  });

  const heroMetrics = useMemo(
    () => (kpisQuery.data ?? []).slice(0, 2),
    [kpisQuery.data],
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Desk brief</CardTitle>
            <CardDescription>
              Curated summary surface for operators who want context before opening a full
              dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            {heroMetrics.map((metric) => {
              const positive = metric.changePct >= 0;

              return (
                <div
                  key={metric.label}
                  className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-4"
                >
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {metric.label}
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                    {metric.format === "currency"
                      ? formatCurrency(metric.value, true)
                      : `${metric.value}`}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <Badge variant={positive ? "success" : "danger"}>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      {formatPercent(metric.changePct)}
                    </Badge>
                    <div className="text-xs text-muted-foreground">{metric.hint}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operator checklist</CardTitle>
            <CardDescription>Fast-moving actions that belong in an application flow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Review overnight risk alerts before the open.",
              "Confirm routing limits and restricted-symbol controls.",
              "Scan catalyst tape before switching into execution dashboards.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-3 text-sm text-foreground"
              >
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Market catalysts</CardTitle>
            <CardDescription>News is grouped here as narrative context instead of dashboard tiles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(newsQuery.data ?? []).map((item, index) => (
              <div key={item.id}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 text-primary">
                    <Newspaper className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-6 text-foreground">
                      {item.title}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{item.source}</Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 className="h-3 w-3" />
                        {item.time}
                      </span>
                    </div>
                  </div>
                </div>
                {index < (newsQuery.data?.length ?? 0) - 1 ? <Separator className="mt-4" /> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk and routing notes</CardTitle>
            <CardDescription>
              Recent activity can live inside an app surface without being modeled as a widget grid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(activityQuery.data ?? []).map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-3"
              >
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted/70 text-warning">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground">
                    <span className="font-medium">{item.actor}</span> {item.action}{" "}
                    <span className="font-medium">{item.target}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={item.level === "success" ? "success" : "warning"}>
                      {item.level}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
