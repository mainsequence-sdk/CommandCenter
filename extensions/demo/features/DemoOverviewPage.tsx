import { useCallback, useMemo, useState } from "react";

import {
  ArrowRight,
  Boxes,
  Database,
  LayoutDashboard,
  LineChart,
  Network,
  Stethoscope,
  Truck,
  Workflow,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getWidgetById } from "@/app/registry";
import { getAppPath } from "@/apps/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardControlsProvider } from "@/dashboards/DashboardControls";
import {
  DashboardWidgetRegistryProvider,
  type DashboardWidgetRegistryEntry,
} from "@/dashboards/DashboardWidgetRegistry";
import { getWorkspacePath } from "@/features/dashboards/workspace-favorites";
import { cn } from "@/lib/utils";
import { WidgetFrame, MissingWidgetFrame } from "@/widgets/shared/widget-frame";
import type { WidgetDefinition } from "@/widgets/types";

const globalMacroWorkspaceId = "workspace-global-macro";
const globalMacroWorkspacePath = getWorkspacePath(globalMacroWorkspaceId);

const tabularSourceWidgetId = "demo-overview-tabular-source";
const landingControls = {
  enabled: false,
  timeRange: { enabled: false, defaultRange: "90d" },
  refresh: { enabled: false, defaultIntervalMs: null },
  actions: { enabled: false, share: false, view: false },
} as const;

interface EmbeddedWidgetSpec {
  id: string;
  widgetId: string;
  title: string;
  props: Record<string, unknown>;
  className?: string;
  contentClassName?: string;
  showHeader?: boolean;
}

const tabularWidgetSpecs: EmbeddedWidgetSpec[] = [
  {
    id: tabularSourceWidgetId,
    widgetId: "connection-query",
    title: "Connection Dataset",
    props: {
      queryModelId: "data-node-rows-between-dates",
      query: {
        kind: "data-node-rows-between-dates",
        dataNodeId: 714,
        uniqueIdentifierList: ["BBG000BBJQV0", "BBG000BS1YV5"],
      },
      timeRangeMode: "fixed",
      fixedStartMs: Date.parse("2022-04-01T00:00:00Z"),
      fixedEndMs: Date.parse("2022-06-30T23:59:59Z"),
      maxRows: 120,
      selectedFrame: 0,
      showHeader: false,
    },
    className: "min-h-[148px]",
  },
  {
    id: "demo-overview-tabular-last-close",
    widgetId: "statistic",
    title: "Last Close By Ticker",
    props: {
      sourceMode: "filter_widget",
      sourceWidgetId: tabularSourceWidgetId,
      groupField: "ticker",
      orderField: "time_index",
      valueField: "close",
      statisticMode: "last",
      prefix: "$",
      decimals: 2,
    },
    className: "min-h-[220px]",
  },
  {
    id: "demo-overview-tabular-last-volume",
    widgetId: "statistic",
    title: "Last Volume By Ticker",
    props: {
      sourceMode: "filter_widget",
      sourceWidgetId: tabularSourceWidgetId,
      groupField: "ticker",
      orderField: "time_index",
      valueField: "volume",
      statisticMode: "last",
      suffix: " sh",
      decimals: 0,
    },
    className: "min-h-[220px]",
  },
  {
    id: "demo-overview-tabular-chart",
    widgetId: "graph",
    title: "Same Data, Instant Visualization",
    props: {
      sourceMode: "filter_widget",
      sourceWidgetId: tabularSourceWidgetId,
      provider: "tradingview",
      chartType: "line",
      xField: "time_index",
      yField: "close",
      groupField: "ticker",
      groupSelectionMode: "include",
      selectedGroupValues: ["NVDA", "TTWO"],
      seriesAxisMode: "shared",
    },
    className: "min-h-[360px]",
  },
  {
    id: "demo-overview-tabular-table",
    widgetId: "table",
    title: "Same Data, Application Table",
    props: {
      sourceMode: "filter_widget",
      sourceWidgetId: tabularSourceWidgetId,
      density: "comfortable",
      showSearch: false,
      showToolbar: true,
      pagination: true,
      pageSize: 6,
      zebraRows: true,
      columnOverrides: {
        time_index: { width: 170, pinned: "left" },
        ticker: { width: 90, pinned: "left" },
        name: { width: 220 },
        close: { width: 110, decimals: 2, prefix: "$" },
        volume: { width: 130, decimals: 0 },
        vwap: { width: 110, decimals: 2, prefix: "$" },
      },
      schema: [
        { key: "time_index", label: "Time", format: "text", visible: true },
        { key: "ticker", label: "Ticker", format: "text", visible: true },
        { key: "name", label: "Name", format: "text", visible: true },
        { key: "close", label: "Close", format: "number", visible: true },
        { key: "volume", label: "Volume", format: "number", visible: true },
        { key: "vwap", label: "VWAP", format: "number", visible: true },
      ],
    },
    className: "min-h-[360px]",
    contentClassName: "min-h-[300px]",
  },
];

function EmbeddedWidgetCard({
  className,
  contentClassName,
  runtimeState,
  showHeader,
  spec,
  onRuntimeStateChange,
}: {
  className?: string;
  contentClassName?: string;
  runtimeState?: Record<string, unknown>;
  showHeader?: boolean;
  spec: EmbeddedWidgetSpec;
  onRuntimeStateChange: (state: Record<string, unknown> | undefined) => void;
}) {
  const widget = getWidgetById(spec.widgetId);

  if (!widget) {
    return (
      <div className={className}>
        <MissingWidgetFrame widgetId={spec.widgetId} />
      </div>
    );
  }

  const WidgetComponent = widget.component as React.ComponentType<{
    widget: WidgetDefinition;
    props: Record<string, unknown>;
    instanceTitle?: string;
    runtimeState?: Record<string, unknown>;
    onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  }>;

  return (
    <div className={className}>
      <WidgetFrame
        widget={widget}
        instance={{ title: spec.title, props: spec.props }}
        presentation={widget.defaultPresentation}
        showExplorerTrigger={false}
        showHeader={showHeader ?? spec.showHeader}
      >
        <div className={cn("h-full min-h-0", contentClassName ?? spec.contentClassName)}>
          <WidgetComponent
            widget={widget}
            instanceTitle={spec.title}
            props={spec.props}
            runtimeState={runtimeState}
            onRuntimeStateChange={onRuntimeStateChange}
          />
        </div>
      </WidgetFrame>
    </div>
  );
}

function TabularDataShowcase() {
  const [runtimeStates, setRuntimeStates] = useState<Record<string, Record<string, unknown> | undefined>>({});
  const updateRuntimeState = useCallback(
    (widgetId: string, nextState: Record<string, unknown> | undefined) => {
      setRuntimeStates((current) => {
        const previousState = current[widgetId];

        if (JSON.stringify(previousState ?? null) === JSON.stringify(nextState ?? null)) {
          return current;
        }

        return {
          ...current,
          [widgetId]: nextState,
        };
      });
    },
    [],
  );
  const widgetRegistry = useMemo<DashboardWidgetRegistryEntry[]>(
    () =>
      tabularWidgetSpecs.map((spec) => ({
        id: spec.id,
        widgetId: spec.widgetId,
        title: spec.title,
        props: spec.props,
        runtimeState: runtimeStates[spec.id],
      })),
    [runtimeStates],
  );

  return (
    <DashboardControlsProvider controls={landingControls}>
      <DashboardWidgetRegistryProvider widgets={widgetRegistry}>
        <div className="grid gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-4">
            <CardHeader>
              <Badge variant="primary" className="w-fit">
                Connection Query
              </Badge>
              <CardTitle>One canonical dataset, many surfaces</CardTitle>
              <CardDescription>
                The source node owns the connection query. Downstream widgets bind to its tabular
                output and immediately turn that dataset into statistics, charts, tables, and
                application panels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-3">
                  Run one connection query instead of wiring separate data code into each surface.
                </div>
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-3">
                  Apply transformations once, then reuse the published dataset across applications.
                </div>
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-3">
                  Move from raw rows to operator-facing visualization without rebuilding the data layer.
                </div>
              </div>
              <EmbeddedWidgetCard
                spec={tabularWidgetSpecs[0]}
                className="min-h-[148px]"
                showHeader
                runtimeState={runtimeStates[tabularWidgetSpecs[0].id]}
                onRuntimeStateChange={(state) => updateRuntimeState(tabularWidgetSpecs[0].id, state)}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:col-span-8 md:grid-cols-2">
            {tabularWidgetSpecs.slice(1, 3).map((spec) => (
              <EmbeddedWidgetCard
                key={spec.id}
                spec={spec}
                className={spec.className}
                runtimeState={runtimeStates[spec.id]}
                onRuntimeStateChange={(state) => updateRuntimeState(spec.id, state)}
              />
            ))}
          </div>

          {tabularWidgetSpecs.slice(3).map((spec, index) => (
            <EmbeddedWidgetCard
              key={spec.id}
              spec={spec}
              className={cn(spec.className, index === 0 ? "xl:col-span-7" : "xl:col-span-5")}
              runtimeState={runtimeStates[spec.id]}
              onRuntimeStateChange={(state) => updateRuntimeState(spec.id, state)}
            />
          ))}
        </div>
      </DashboardWidgetRegistryProvider>
    </DashboardControlsProvider>
  );
}

function EntryCard({
  actionLabel,
  description,
  icon: Icon,
  title,
  onOpen,
}: {
  actionLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onOpen: () => void;
}) {
  return (
    <Card className="group h-full border-border/70 bg-card/80 transition-transform duration-200 hover:-translate-y-0.5">
      <CardHeader className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-border/70 bg-background/50 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Button variant="outline" onClick={onOpen}>
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function DemoOverviewPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-[30px] border border-border/70 bg-[linear-gradient(140deg,rgba(245,247,250,0.96),rgba(237,241,246,0.82)_42%,rgba(225,234,242,0.72))] p-6 shadow-[var(--shadow-panel)] dark:bg-[linear-gradient(140deg,rgba(15,23,36,0.98),rgba(11,18,28,0.92)_42%,rgba(16,31,45,0.88))] sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-[34%] bg-[radial-gradient(circle_at_top_right,rgba(12,89,155,0.18),transparent_58%)] lg:block" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <div className="space-y-6">
            <div className="space-y-3">
              <Badge variant="primary" className="w-fit">
                Demo Landing
              </Badge>
              <div className="max-w-3xl space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Welcome to the Command Center demo
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  You are in the guided demo surface for the application. This is where users can
                  understand the platform, open the default workspace, and see how Main Sequence
                  widgets turn platform data into dashboards, applications, and operating views.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate(globalMacroWorkspacePath)}>
                Open Default Workspace
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(getAppPath("demo", "markets-monitor"))}
              >
                Explore Financial Markets
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[calc(var(--radius)+2px)] border border-border/70 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Where you are</div>
                <div className="mt-2 font-medium text-foreground">Demo application landing</div>
              </div>
              <div className="rounded-[calc(var(--radius)+2px)] border border-border/70 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Default workspace</div>
                <div className="mt-2 font-medium text-foreground">Global Macro Desk</div>
              </div>
              <div className="rounded-[calc(var(--radius)+2px)] border border-border/70 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Platform story</div>
                <div className="mt-2 font-medium text-foreground">Widgets, connections, and applications</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Card className="border-border/70 bg-background/68">
              <CardHeader>
                <Badge variant="neutral" className="w-fit">
                  Demo scope
                </Badge>
                <CardTitle>What you can explore here</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Network className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    Main Sequence data exposed through reusable widgets and connection-backed datasets.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <LayoutDashboard className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    Workspace Studio with a seeded macro workspace that users can modify in mock mode.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Workflow className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    Scenario surfaces across Financial Markets, Supply Chain, and Healthcare Operations.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Boxes className="mt-0.5 h-4 w-4 text-primary" />
                  <div>Main Sequence Foundry application with demo data.</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/68">
              <CardHeader>
                <Badge variant="success" className="w-fit">
                  Loaded by default
                </Badge>
                <CardTitle>Global Macro Desk</CardTitle>
                <CardDescription>
                  The default workspace already seeded in mock mode. It gives users a concrete place to
                  start, edit layouts, and understand how widgets compose into a working desk surface.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">Trading</Badge>
                  <Badge variant="neutral">macro</Badge>
                  <Badge variant="neutral">rates</Badge>
                  <Badge variant="neutral">desk</Badge>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <div>Includes a rates proxy chart, macro headlines, and an exposure watch table.</div>
                  <div>Acts as the editable default workspace in mock mode.</div>
                  <div>Shows how reusable widgets become a working operator-facing environment.</div>
                </div>
                <Button variant="outline" onClick={() => navigate(globalMacroWorkspacePath)}>
                  Open Global Macro Desk
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <Badge variant="primary" className="w-fit">
              Main Sequence Widgets
            </Badge>
            <CardTitle>Bring platform data into dashboards and applications quickly</CardTitle>
            <CardDescription>
              The same widget model works across dashboard surfaces, workspace layouts, and app pages.
              The goal is not just to display data, but to make platform capabilities reusable wherever
              the workflow lives.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-4">
              <div className="font-medium text-foreground">Dashboards</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Add platform widgets to monitoring boards without building one-off data plumbing.
              </div>
            </div>
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-4">
              <div className="font-medium text-foreground">Applications</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Use the same data-driven components directly inside business screens and operational tools.
              </div>
            </div>
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-4">
              <div className="font-medium text-foreground">Workspaces</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Start from code-seeded layouts, then let users adapt and persist them locally in mock mode.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="warning" className="w-fit">
              Current demo path
            </Badge>
            <CardTitle>Financial Markets stays the primary story</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              The dedicated monitor remains available as a separate surface so the landing page can orient
              users first, then let them dive into the richer market board.
            </div>
            <Button variant="outline" onClick={() => navigate(getAppPath("demo", "markets-monitor"))}>
              Open Markets Monitor
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="max-w-3xl space-y-2">
          <Badge variant="primary" className="w-fit">
            Connections
          </Badge>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Unified data access that turns datasets into applications and visualizations
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            Connections expose a unified way to query your data, regardless of where the raw data
            comes from. Once a source widget publishes a tabular dataset, the platform can reuse it
            across dashboards, applications, tables, and charts without rebuilding the integration
            each time.
          </p>
        </div>
        <TabularDataShowcase />
      </section>

      <section className="space-y-4">
        <div className="max-w-3xl space-y-2">
          <Badge variant="secondary" className="w-fit">
            Explore the demo
          </Badge>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Jump into the industry scenarios
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            The landing page explains the platform. The scenario surfaces show how the same building
            blocks can support different operating environments.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <EntryCard
            title="Financial Markets"
            description="Monitor a market-facing board, open the seeded macro workspace, and see how platform widgets support desk workflows."
            icon={LineChart}
            actionLabel="Open Markets Monitor"
            onOpen={() => navigate(getAppPath("demo", "markets-monitor"))}
          />
          <EntryCard
            title="Supply Chain"
            description="View a control-tower style surface for inventory pressure, supplier reliability, and lane disruption."
            icon={Truck}
            actionLabel="Open Control Tower"
            onOpen={() => navigate(getAppPath("demo", "supply-chain-control-tower"))}
          />
          <EntryCard
            title="Healthcare Operations"
            description="View a hospital operations command surface for capacity, staffing, and patient-flow pressure."
            icon={Stethoscope}
            actionLabel="Open Hospital Command"
            onOpen={() => navigate(getAppPath("demo", "healthcare-operations-command"))}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <Badge variant="neutral" className="w-fit">
              How this demo works
            </Badge>
            <CardTitle>Code-seeded, editable, and widget-driven</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3">
              <Boxes className="mt-0.5 h-4 w-4 text-primary" />
              <div>The demo starts from code-defined surfaces and seeded mock datasets.</div>
            </div>
            <div className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3">
              <LayoutDashboard className="mt-0.5 h-4 w-4 text-primary" />
              <div>Workspace Studio can still modify and persist the mock workspaces locally.</div>
            </div>
            <div className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3">
              <Database className="mt-0.5 h-4 w-4 text-primary" />
              <div>Connection-backed datasets and platform widgets make the same data reusable across multiple UX patterns.</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="primary" className="w-fit">
              Suggested next steps
            </Badge>
            <CardTitle>Where users should go next</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button onClick={() => navigate(globalMacroWorkspacePath)}>
              Open the default workspace
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate(getAppPath("demo", "markets-monitor"))}>
              Open the market monitor
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate(getAppPath("workspace-studio", "workspaces"))}>
              Browse Workspace Studio
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
