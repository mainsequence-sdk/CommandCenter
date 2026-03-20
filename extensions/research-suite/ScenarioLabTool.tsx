import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchActivity, fetchKpiCards, fetchNews } from "@/data/api";

function buildRunbook(options: {
  symbol: string;
  focus: string;
  horizon: string;
  hypothesis: string;
  leadStory?: string;
  leadMetric?: string;
  lastEvent?: string;
}) {
  return [
    `Frame the ${options.focus.toLowerCase()} scenario for ${options.symbol.toUpperCase()} over the ${options.horizon.toLowerCase()} horizon.`,
    options.leadStory
      ? `Anchor the setup to the lead catalyst: ${options.leadStory}`
      : "Anchor the setup to the highest-conviction catalyst on the tape.",
    options.leadMetric
      ? `Use ${options.leadMetric} as the primary validation metric before escalating the view.`
      : "Define one validation metric before escalating the view.",
    options.lastEvent
      ? `Cross-check recent desk activity: ${options.lastEvent}`
      : "Cross-check the latest desk activity before sharing the playbook.",
    options.hypothesis
      ? `Challenge the base case: ${options.hypothesis}`
      : "Add one explicit risk that would invalidate the current thesis.",
  ];
}

export function ScenarioLabTool() {
  const [symbol, setSymbol] = useState("NVDA");
  const [focus, setFocus] = useState("Momentum");
  const [horizon, setHorizon] = useState("Today");
  const [hypothesis, setHypothesis] = useState(
    "Upside leadership broadens if the open holds after the first hour of liquidity.",
  );
  const [runbook, setRunbook] = useState<string[]>([]);

  const kpisQuery = useQuery({
    queryKey: ["research-suite", "scenario-lab", "kpis", symbol],
    queryFn: () => fetchKpiCards(symbol),
  });
  const newsQuery = useQuery({
    queryKey: ["research-suite", "scenario-lab", "news", symbol],
    queryFn: () => fetchNews(3),
  });
  const activityQuery = useQuery({
    queryKey: ["research-suite", "scenario-lab", "activity", symbol],
    queryFn: () => fetchActivity(3),
  });

  const handleGenerate = () => {
    setRunbook(
      buildRunbook({
        symbol,
        focus,
        horizon,
        hypothesis,
        leadStory: newsQuery.data?.[0]?.title,
        leadMetric: kpisQuery.data?.[0]?.label,
        lastEvent: activityQuery.data?.[0]
          ? `${activityQuery.data[0].actor} ${activityQuery.data[0].action} ${activityQuery.data[0].target}`
          : undefined,
      }),
    );
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
      <Card>
        <CardHeader>
          <CardTitle>Scenario lab</CardTitle>
          <CardDescription>
            Action-oriented extension surface for turning market context into an operator playbook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Symbol
              </label>
              <Input value={symbol} onChange={(event) => setSymbol(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Focus
              </label>
              <Select value={focus} onChange={(event) => setFocus(event.target.value)}>
                <option>Momentum</option>
                <option>Macro</option>
                <option>Risk</option>
                <option>Event</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Horizon
              </label>
              <Select value={horizon} onChange={(event) => setHorizon(event.target.value)}>
                <option>Today</option>
                <option>This week</option>
                <option>Into the open</option>
                <option>Post-event</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Extension contract
              </label>
              <div className="flex h-10 items-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 text-sm text-muted-foreground">
                Repo-root app using shared platform APIs
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Hypothesis
            </label>
            <Textarea value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} />
          </div>

          <Button className="w-full" onClick={handleGenerate}>
            <Sparkles className="h-4 w-4" />
            Generate playbook
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Generated operator plan</CardTitle>
            <CardDescription>
              Tools are free-form surfaces. They are not forced into the dashboard grid renderer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{symbol.toUpperCase()}</Badge>
              <Badge variant="neutral">{focus}</Badge>
              <Badge variant="neutral">{horizon}</Badge>
            </div>

            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-4 text-sm leading-6 text-foreground">
              {hypothesis}
            </div>

            {(runbook.length > 0 ? runbook : buildRunbook({ symbol, focus, horizon, hypothesis })).map(
              (step, index) => (
                <div
                  key={step}
                  className="flex gap-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {index + 1}
                  </div>
                  <div className="text-sm leading-6 text-foreground">{step}</div>
                </div>
              ),
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="h-4 w-4 text-primary" />
                KPI handle
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {kpisQuery.data?.[0]?.label ?? "Loading validation metric..."}
            </CardContent>
          </Card>
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Lead story</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {newsQuery.data?.[0]?.title ?? "Loading catalyst context..."}
            </CardContent>
          </Card>
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Desk event</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {activityQuery.data?.[0]
                ? `${activityQuery.data[0].actor} ${activityQuery.data[0].action} ${activityQuery.data[0].target}`
                : "Loading desk signal..."}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
