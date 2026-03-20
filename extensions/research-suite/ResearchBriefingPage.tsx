import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Clock3, Newspaper, Radar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchActivity, fetchKpiCards, fetchNews } from "@/data/api";
import { formatCurrency, formatPercent } from "@/lib/format";

export function ResearchBriefingPage() {
  const kpisQuery = useQuery({
    queryKey: ["research-suite", "briefing", "kpis"],
    queryFn: () => fetchKpiCards("MSFT"),
  });
  const newsQuery = useQuery({
    queryKey: ["research-suite", "briefing", "news"],
    queryFn: () => fetchNews(5),
  });
  const activityQuery = useQuery({
    queryKey: ["research-suite", "briefing", "activity"],
    queryFn: () => fetchActivity(4),
  });

  const heroMetrics = (kpisQuery.data ?? []).slice(0, 3);
  const leadStory = newsQuery.data?.[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Morning narrative</CardTitle>
            <CardDescription>
              Extension-owned research surface rendered outside the dashboard grid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
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
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
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
            </div>

            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Lead catalyst
                  </div>
                  <div className="text-xl font-semibold text-foreground">
                    {leadStory?.title ?? "Loading narrative context..."}
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    This page lives entirely in a repo-root extension and still uses the shell&apos;s
                    shared query, theme, and RBAC primitives.
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/70 text-primary">
                  <Radar className="h-5 w-5" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Research threads</CardTitle>
            <CardDescription>
              Opinionated workflows can own their own content layout without pretending to be tiles.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "AI leadership",
                body: "Track whether mega-cap strength is broadening into the next tranche of infra names.",
              },
              {
                title: "Rates sensitivity",
                body: "Watch whether softer auction tails keep duration supportive into the European close.",
              },
              {
                title: "Desk coordination",
                body: "Pair catalyst review with routing and risk notes before handing off to execution teams.",
              },
            ].map((thread) => (
              <div
                key={thread.title}
                className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-4"
              >
                <div className="text-sm font-medium text-foreground">{thread.title}</div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{thread.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Catalyst tape</CardTitle>
            <CardDescription>
              The same mocked or live adapters used by widgets can be reused by an extension page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(newsQuery.data ?? []).map((item) => (
              <div
                key={item.id}
                className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-4"
              >
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
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desk alignment</CardTitle>
            <CardDescription>Activity notes stay readable without going through widget chrome.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(activityQuery.data ?? []).map((item) => (
              <div
                key={item.id}
                className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-3"
              >
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
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
