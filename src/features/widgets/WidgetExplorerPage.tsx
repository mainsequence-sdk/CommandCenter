import { useMemo, type ReactNode } from "react";

import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { getWidgetById } from "@/app/registry";
import { useAuthStore } from "@/auth/auth-store";
import { hasAllPermissions } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn, titleCase } from "@/lib/utils";
import { useRegisteredWidgetTypesCatalog } from "@/widgets/registered-widget-types-api";
import type { WidgetDefinition, WidgetFieldDefinition } from "@/widgets/types";

const catalogPath = "/app/workspace-studio/widget-catalog";

function WidgetDetailsShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1500px] pb-8">{children}</div>
    </div>
  );
}

function formatSource(source: string) {
  return titleCase(source.replace(/[_-]+/g, " "));
}

function formatPermissions(permissions: string[] | undefined) {
  return permissions?.length ? permissions.join(", ") : "None";
}

function resolveRuntimeMode(widget: WidgetDefinition) {
  if (widget.workspaceRuntimeMode) {
    return widget.workspaceRuntimeMode;
  }

  return widget.execution ? "execution-owner" : "local-ui";
}

function resolveConfigurationMode(widget: WidgetDefinition) {
  if (widget.registryContract?.configuration?.mode) {
    return widget.registryContract.configuration.mode;
  }

  if (widget.schema && widget.settingsComponent) {
    return "hybrid";
  }

  if (widget.schema) {
    return "static-schema";
  }

  if (widget.settingsComponent) {
    return "custom-settings";
  }

  return "none";
}

function resolveRefreshPolicy(widget: WidgetDefinition) {
  return widget.registryContract?.runtime?.refreshPolicy ?? (widget.execution ? "allow-refresh" : "not-applicable");
}

function PrettyJsonBlock({
  className,
  value,
}: {
  className?: string;
  value: unknown;
}) {
  return (
    <pre
      className={cn(
        "max-h-[360px] overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/55 p-4 text-xs text-foreground",
        className,
      )}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function KeyValueTable({
  rows,
}: {
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/60 last:border-b-0">
              <th className="w-[220px] px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {row.label}
              </th>
              <td className="px-4 py-3 text-foreground">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

function formatFieldMeta(field: WidgetFieldDefinition<Record<string, unknown>, unknown>) {
  const items = [field.id];

  if (field.category) {
    items.push(`category: ${field.category}`);
  }

  if (field.pop?.canPop) {
    items.push(field.pop.defaultPopped ? "canvas default" : "canvas available");
  }

  return items.join(" | ");
}

export function WidgetExplorerPage() {
  const { widgetId = "" } = useParams();
  const widget = widgetId ? getWidgetById(widgetId) : undefined;
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const registeredWidgetTypes = useRegisteredWidgetTypesCatalog();
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

  if (widget && registeredWidgetTypes.endpointConfigured && registeredWidgetTypes.isLoading) {
    return (
      <WidgetDetailsShell>
        <div className="space-y-6">
        <PageHeader
          eyebrow="Widget Details"
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
      </WidgetDetailsShell>
    );
  }

  if (!widget || !backendRegistered) {
    return (
      <WidgetDetailsShell>
        <div className="space-y-6">
        <PageHeader
          eyebrow="Widget Details"
          title="Widget not found"
          description="The requested widget id is not available in the current registered widget catalog."
          actions={
            <Link
              to={catalogPath}
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
      </WidgetDetailsShell>
    );
  }

  const inputs = widget.io?.inputs ?? [];
  const outputs = widget.io?.outputs ?? [];
  const registryContract = widget.registryContract;
  const usageGuidance = registryContract?.usageGuidance;

  return (
    <WidgetDetailsShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Widget Details"
          title={widget.title}
          description={widget.description}
          actions={
            <Link
              to={catalogPath}
              className="inline-flex h-10 items-center gap-2 rounded-[calc(var(--radius)-4px)] border border-border bg-card/80 px-4 text-sm font-medium text-card-foreground transition-colors hover:bg-muted/60"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to catalog
            </Link>
          }
        />

        {usageGuidance ? (
          <Card>
            <CardHeader>
              <CardTitle>Usage Guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Purpose</div>
                <p className="mt-1 text-foreground">{usageGuidance.buildPurpose}</p>
              </div>
              <GuidanceList title="When to use" values={usageGuidance.whenToUse} />
              <GuidanceList title="When not to use" values={usageGuidance.whenNotToUse} />
              <GuidanceList title="Authoring steps" values={usageGuidance.authoringSteps} />
              <GuidanceList title="Requirements" values={usageGuidance.blockingRequirements ?? []} />
              <GuidanceList title="Common pitfalls" values={usageGuidance.commonPitfalls ?? []} />
            </CardContent>
          </Card>
        ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Catalog Profile</CardTitle>
              <CardDescription>
                Stable registry fields used to choose and place this widget in a workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <KeyValueTable
                rows={[
                  { label: "Widget ID", value: widget.id },
                  { label: "Application / Source", value: formatSource(widget.source) },
                  { label: "Category", value: titleCase(widget.category) },
                  { label: "Type", value: widget.kind },
                  { label: "Version", value: widget.widgetVersion },
                  { label: "Runtime", value: resolveRuntimeMode(widget) },
                  { label: "Configuration", value: resolveConfigurationMode(widget) },
                  { label: "Refresh policy", value: resolveRefreshPolicy(widget) },
                  { label: "Default size", value: `${widget.defaultSize.w} x ${widget.defaultSize.h}` },
                  { label: "Required permissions", value: formatPermissions(widget.requiredPermissions) },
                  { label: "Current user access", value: allowed ? "Allowed" : "Restricted" },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ports</CardTitle>
              <CardDescription>
                Typed widget bindings this widget can consume or publish.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Inbound ports
                </div>
                {inputs.length > 0 ? (
                  <div className="overflow-x-auto rounded-[calc(var(--radius)-6px)] border border-border/70">
                    <table className="w-full min-w-[760px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border/70 bg-muted/35 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          <th className="px-4 py-3 text-left font-medium">Port ID</th>
                          <th className="px-4 py-3 text-left font-medium">Label</th>
                          <th className="px-4 py-3 text-left font-medium">Accepted contracts</th>
                          <th className="px-4 py-3 text-left font-medium">Cardinality</th>
                          <th className="px-4 py-3 text-left font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inputs.map((input) => (
                          <tr key={input.id} className="border-b border-border/60 last:border-b-0 align-top">
                            <td className="px-4 py-3 font-mono text-xs text-foreground">{input.id}</td>
                            <td className="px-4 py-3 text-foreground">{input.label}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {input.accepts.join(", ")}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {input.cardinality ?? "one"}
                              {input.required ? " required" : ""}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {input.description ??
                                input.effects?.map((effect) => effect.description).filter(Boolean).join(" ") ??
                                "No description provided."}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-sm text-muted-foreground">
                    This widget does not declare inbound typed ports.
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Outbound ports
                </div>
                {outputs.length > 0 ? (
                  <div className="overflow-x-auto rounded-[calc(var(--radius)-6px)] border border-border/70">
                    <table className="w-full min-w-[700px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border/70 bg-muted/35 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          <th className="px-4 py-3 text-left font-medium">Port ID</th>
                          <th className="px-4 py-3 text-left font-medium">Label</th>
                          <th className="px-4 py-3 text-left font-medium">Published contract</th>
                          <th className="px-4 py-3 text-left font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outputs.map((output) => (
                          <tr key={output.id} className="border-b border-border/60 last:border-b-0 align-top">
                            <td className="px-4 py-3 font-mono text-xs text-foreground">{output.id}</td>
                            <td className="px-4 py-3 text-foreground">{output.label}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {output.contract}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {output.description ?? "No description provided."}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-sm text-muted-foreground">
                    This widget does not declare outbound typed ports.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {schemaSections.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Configuration Fields</CardTitle>
                <CardDescription>
                  Settings fields exposed by this widget definition.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border/70 bg-muted/35 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">Section</th>
                        <th className="px-4 py-3 text-left font-medium">Field</th>
                        <th className="px-4 py-3 text-left font-medium">Description</th>
                        <th className="px-4 py-3 text-left font-medium">Metadata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schemaSections.flatMap(({ section, fields }) =>
                        fields.map((field) => (
                          <tr key={field.id} className="border-b border-border/60 last:border-b-0 align-top">
                            <td className="px-4 py-3 text-foreground">{section.title}</td>
                            <td className="px-4 py-3 text-foreground">{field.label}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {field.description ?? section.description ?? "No description provided."}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {formatFieldMeta(field)}
                            </td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>Search and grouping hints attached to the widget type.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(widget.tags ?? []).length > 0 ? (
                  widget.tags?.map((tag) => (
                    <Badge key={tag} variant="neutral">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No tags declared.</span>
                )}
              </div>
            </CardContent>
          </Card>

          {widget.exampleProps ? (
            <Card>
              <CardHeader>
                <CardTitle>Example Props</CardTitle>
                <CardDescription>
                  Type-level example configuration shipped with this widget.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PrettyJsonBlock value={widget.exampleProps} />
              </CardContent>
            </Card>
          ) : null}

          {registryContract?.capabilities ? (
            <Card>
              <CardHeader>
                <CardTitle>Capabilities</CardTitle>
                <CardDescription>
                  Supported modes and behaviors declared by the widget type.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PrettyJsonBlock value={registryContract.capabilities} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
      </div>
    </WidgetDetailsShell>
  );
}

function GuidanceList({
  title,
  values,
}: {
  title: string;
  values: string[];
}) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
}
