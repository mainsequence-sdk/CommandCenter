import { useEffect, useMemo, useState, type ComponentType } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { getWidgetById } from "@/app/registry";
import { useAuthStore } from "@/auth/auth-store";
import { hasAllPermissions } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  DashboardControlsProvider,
  DashboardDataControls,
} from "@/dashboards/DashboardControls";
import type { DashboardControlsConfig } from "@/dashboards/types";
import { cn } from "@/lib/utils";
import { useRegisteredWidgetTypesCatalog } from "@/widgets/registered-widget-types-api";
import { WidgetFrame } from "@/widgets/shared/widget-frame";
import type { WidgetDefinition, WidgetHeaderActionsProps } from "@/widgets/types";

import {
  WidgetPreviewModeBoundary,
  resolveWidgetMockProps,
  resolveWidgetMockRuntimeState,
} from "./widget-explorer";

const widgetExplorerControls: DashboardControlsConfig = {
  enabled: true,
  timeRange: {
    enabled: true,
    defaultRange: "30d",
    options: ["15m", "1h", "6h", "24h", "7d", "30d", "90d"],
  },
  refresh: {
    enabled: true,
    defaultIntervalMs: 300_000,
    intervals: [null, 30_000, 60_000, 300_000, 600_000, 3_600_000],
  },
  actions: {
    enabled: false,
    share: false,
    view: false,
  },
};

function PrettyJsonBlock({
  className,
  value,
}: {
  className?: string;
  value: Record<string, unknown>;
}) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/55 p-4 text-xs text-foreground",
        className,
      )}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function groupSchemaFieldsBySection(widget: WidgetDefinition<Record<string, unknown>>) {
  const schema = widget.schema;

  if (!schema) {
    return [];
  }

  return schema.sections
    .map((section) => ({
      section,
      fields: schema.fields.filter((field) => field.sectionId === section.id),
    }))
    .filter((entry) => entry.fields.length > 0);
}

export function WidgetExplorerPage() {
  const { widgetId = "" } = useParams();
  const widget = widgetId ? getWidgetById(widgetId) : undefined;
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const registeredWidgetTypes = useRegisteredWidgetTypesCatalog();
  const queryClient = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
          },
        },
      }),
  )[0];

  const previewProps = useMemo(
    () =>
      widget
        ? resolveWidgetMockProps(widget as WidgetDefinition<Record<string, unknown>>)
        : {},
    [widget],
  );
  const [runtimeState, setRuntimeState] = useState<Record<string, unknown>>(() =>
    widget ? resolveWidgetMockRuntimeState(widget) : {},
  );
  const schemaSections = useMemo(
    () =>
      widget
        ? groupSchemaFieldsBySection(widget as WidgetDefinition<Record<string, unknown>>)
        : [],
    [widget],
  );
  const allowed = widget
    ? hasAllPermissions(permissions, widget.requiredPermissions ?? [])
    : false;
  const backendRegistered =
    !registeredWidgetTypes.endpointConfigured ||
    (widget ? registeredWidgetTypes.activeWidgetIdSet.has(widget.id) : false);

  useEffect(() => {
    return () => {
      queryClient.clear();
    };
  }, [queryClient]);

  useEffect(() => {
    setRuntimeState(widget ? resolveWidgetMockRuntimeState(widget) : {});
  }, [widget]);

  if (widget && registeredWidgetTypes.endpointConfigured && registeredWidgetTypes.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Widget Explorer"
          title="Loading widget registry"
          description="Waiting for the backend registered widget catalog before resolving this widget."
        />

        <Card>
          <CardContent className="flex items-center gap-3 pt-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading backend-registered widget types.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!widget || !backendRegistered) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Widget Explorer"
          title="Widget not found"
          description="The requested widget id is not available in the current registered widget catalog."
          actions={
            <Link
              to="/app/widgets"
              className="inline-flex h-10 items-center gap-2 rounded-[calc(var(--radius)-4px)] border border-border bg-card/80 px-4 text-sm font-medium text-card-foreground transition-colors hover:bg-muted/60"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to catalog
            </Link>
          }
        />

        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            Widget id <span className="font-mono text-foreground">{widgetId}</span> is not available
            in the current registered widget catalog.
          </CardContent>
        </Card>
      </div>
    );
  }

  const Component = widget.component as ComponentType<{
    widget: typeof widget;
    instanceTitle?: string;
    props: Record<string, unknown>;
    runtimeState?: Record<string, unknown>;
    onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  }>;
  const HeaderActions =
    widget.headerActions as
      | ComponentType<WidgetHeaderActionsProps<Record<string, unknown>>>
      | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Widget Explorer"
        title={widget.title}
        description={widget.description}
        actions={
          <>
            <Link
              to="/app/widgets"
              className="inline-flex h-10 items-center gap-2 rounded-[calc(var(--radius)-4px)] border border-border bg-card/80 px-4 text-sm font-medium text-card-foreground transition-colors hover:bg-muted/60"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to catalog
            </Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="neutral">{widget.kind}</Badge>
                    <Badge variant="neutral">{widget.category}</Badge>
                    <Badge variant="neutral">{widget.source}</Badge>
                    <Badge variant={allowed ? "success" : "warning"}>
                      {allowed ? "allowed" : "restricted"}
                    </Badge>
                  </div>
                  <CardTitle>Interactive preview</CardTitle>
                  <CardDescription>
                    This route mounts the real widget component with isolated mock data, isolated
                    query cache, and local-only runtime state.
                  </CardDescription>
                </div>

                <div className="rounded-[calc(var(--radius)-6px)] border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Mock explorer mode
                  </div>
                  <div className="mt-1">
                    Runtime changes here do not touch the live dashboard instance.
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <WidgetPreviewModeBoundary
                fallback={
                  <div className="flex min-h-[480px] items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 text-sm text-muted-foreground">
                    Preparing widget preview…
                  </div>
                }
              >
                <QueryClientProvider client={queryClient}>
                  <DashboardControlsProvider controls={widgetExplorerControls}>
                    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3">
                      <DashboardDataControls controls={widgetExplorerControls} />
                    </div>
                    <WidgetFrame
                      widget={widget}
                      instance={{ title: widget.title }}
                      showExplorerTrigger={false}
                      headerActions={
                        HeaderActions ? (
                          <HeaderActions
                            widget={widget}
                            props={previewProps}
                            runtimeState={runtimeState}
                            onRuntimeStateChange={(state) => {
                              setRuntimeState(state ?? {});
                            }}
                          />
                        ) : undefined
                      }
                    >
                      <div className="min-h-[520px]">
                        <Component
                          widget={widget}
                          instanceTitle={widget.title}
                          props={previewProps}
                          runtimeState={runtimeState}
                          onRuntimeStateChange={(state) => {
                            setRuntimeState(state ?? {});
                          }}
                        />
                      </div>
                    </WidgetFrame>
                  </DashboardControlsProvider>
                </QueryClientProvider>
              </WidgetPreviewModeBoundary>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Widget profile</CardTitle>
              <CardDescription>Registry metadata, access rules, and default layout.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <div className="grid gap-1">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">ID</div>
                <div className="font-mono text-foreground">{widget.id}</div>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Category</div>
                  <div className="mt-1 text-foreground">{widget.category}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Kind</div>
                  <div className="mt-1 text-foreground">{widget.kind}</div>
                </div>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Source</div>
                  <div className="mt-1 text-foreground">{widget.source}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Default size</div>
                  <div className="mt-1 text-foreground">
                    {widget.defaultSize.w} × {widget.defaultSize.h}
                  </div>
                </div>
              </div>
              <div className="grid gap-1">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Permissions</div>
                <div className="mt-1 text-foreground">
                  {(widget.requiredPermissions ?? ["none"]).join(", ")}
                </div>
              </div>
              <div className="grid gap-1">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tags</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(widget.tags ?? ["preview"]).map((tag) => (
                    <Badge key={tag} variant="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview payload</CardTitle>
              <CardDescription>
                Props injected into the explorer preview instead of a live workspace instance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PrettyJsonBlock value={previewProps} />
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Runtime state
                </div>
                <PrettyJsonBlock value={runtimeState} />
              </div>
            </CardContent>
          </Card>

          {schemaSections.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Configuration schema</CardTitle>
                <CardDescription>
                  Field sections, descriptions, and which controls can be exposed on canvas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {schemaSections.map(({ section, fields }) => (
                  <div
                    key={section.id}
                    className="space-y-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-4"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-foreground">{section.title}</div>
                      {section.description ? (
                        <p className="text-sm text-muted-foreground">{section.description}</p>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      {fields.map((field) => (
                        <div
                          key={field.id}
                          className="space-y-2 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-card/70 p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-foreground">{field.label}</div>
                              {field.description ? (
                                <p className="text-sm text-muted-foreground">{field.description}</p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="neutral">{field.id}</Badge>
                              {field.category ? <Badge variant="neutral">{field.category}</Badge> : null}
                              {field.pop?.canPop ? (
                                <Badge variant="success">
                                  {field.pop.defaultPopped ? "canvas default" : "canvas available"}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Explorer behavior</CardTitle>
              <CardDescription>What this documentation tab guarantees.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                The explorer runs the widget in a fresh React Query cache, so previews do not reuse
                data that may already be cached by the live application.
              </p>
              <p>
                Data-backed widgets are forced onto mock adapters here, including chart streams and
                the registered Main Sequence widgets used in the current build.
              </p>
              <p>
                Runtime interactions such as selected cells, chart toggles, zoom, and node
                selection remain local to this page and are discarded when the tab closes.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
