import { useMemo, type ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { env } from "@/config/env";

import {
  fetchMarketsSettings,
  formatMainSequenceError,
  type MarketsSettingsAssumption,
} from "../../../../common/api";

const marketsSettingsQueryKey = ["main_sequence", "markets", "settings"];

function resolveDocumentationUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = env.debugMainSequence || env.apiBaseUrl;

  return new URL(normalizedPath, baseUrl).toString();
}

function formatBooleanBadge(value: boolean) {
  return value ? (
    <Badge variant="success">Enabled</Badge>
  ) : (
    <Badge variant="neutral">Disabled</Badge>
  );
}

function FactRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid gap-1.5 border-b border-border/60 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}

function AssumptionRow({ assumption }: { assumption: MarketsSettingsAssumption }) {
  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{assumption.label}</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">{assumption.key}</div>
      </td>
      <td className="px-4 py-3">
        <code className="rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
          {assumption.value}
        </code>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{assumption.source}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{assumption.description}</td>
    </tr>
  );
}

export function MainSequenceMarketsSettingsPage() {
  const settingsQuery = useQuery({
    queryKey: marketsSettingsQueryKey,
    queryFn: () => fetchMarketsSettings(),
    staleTime: 60_000,
  });

  const documentationLinks = useMemo(() => {
    const documentation = settingsQuery.data?.documentation;

    if (!documentation) {
      return [];
    }

    return [
      {
        label: "OpenAPI JSON",
        description: documentation.openapi_url,
        href: resolveDocumentationUrl(documentation.openapi_url),
      },
      {
        label: "Swagger UI",
        description: documentation.swagger_url,
        href: resolveDocumentationUrl(documentation.swagger_url),
      },
      {
        label: "ReDoc",
        description: documentation.redoc_url,
        href: resolveDocumentationUrl(documentation.redoc_url),
      },
    ];
  }, [settingsQuery.data?.documentation]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Settings"
        description="Inspect the public Markets API metadata, runtime assumptions, and documentation entrypoints."
        actions={
          settingsQuery.data ? (
            <>
              <Badge variant="neutral">{settingsQuery.data.app.scope}</Badge>
              <Badge variant="secondary">v{settingsQuery.data.app.version}</Badge>
            </>
          ) : null
        }
      />

      {settingsQuery.isLoading ? (
        <Card>
          <CardContent className="flex min-h-64 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Markets settings
            </div>
          </CardContent>
        </Card>
      ) : null}

      {settingsQuery.isError ? (
        <Card className="border-danger/60">
          <CardHeader>
            <CardTitle>Settings unavailable</CardTitle>
            <CardDescription>{formatMainSequenceError(settingsQuery.error)}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {settingsQuery.data ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Card>
              <CardHeader className="border-b border-border/70">
                <div>
                  <CardTitle>Application</CardTitle>
                  <CardDescription>Backend-authored public metadata for the Markets app.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                <FactRow label="Name" value={settingsQuery.data.app.name} />
                <FactRow label="Scope" value={<code className="font-mono text-xs">{settingsQuery.data.app.scope}</code>} />
                <FactRow
                  label="Version"
                  value={<code className="font-mono text-xs">{settingsQuery.data.app.version}</code>}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border/70">
                <div>
                  <CardTitle>Runtime</CardTitle>
                  <CardDescription>Operational assumptions exposed by the Markets backend.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                <FactRow
                  label="Namespace"
                  value={<code className="font-mono text-xs">{settingsQuery.data.runtime.namespace}</code>}
                />
                <FactRow
                  label="Namespace source"
                  value={
                    <code className="font-mono text-xs">
                      {settingsQuery.data.runtime.namespace_source}
                    </code>
                  }
                />
                <FactRow
                  label="Default namespace"
                  value={
                    <code className="font-mono text-xs">
                      {settingsQuery.data.runtime.default_namespace}
                    </code>
                  }
                />
                <FactRow
                  label="Management mode"
                  value={<Badge variant="secondary">{settingsQuery.data.runtime.management_mode}</Badge>}
                />
                <FactRow
                  label="Auto register"
                  value={formatBooleanBadge(settingsQuery.data.runtime.auto_register_enabled)}
                />
                <FactRow
                  label="Schema mutation allowed"
                  value={formatBooleanBadge(settingsQuery.data.runtime.schema_mutation_allowed)}
                />
                <FactRow
                  label="Requires migrations"
                  value={formatBooleanBadge(settingsQuery.data.runtime.requires_migrations)}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b border-border/70">
              <div>
                <CardTitle>Documentation</CardTitle>
                <CardDescription>Direct backend documentation endpoints resolved from the Markets root.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pt-5 md:grid-cols-3">
              {documentationLinks.map((link) => (
                <button
                  key={link.label}
                  type="button"
                  className="flex items-start justify-between rounded-[calc(var(--radius)-4px)] border border-border/70 bg-card/70 p-4 text-left transition-colors hover:bg-muted/40"
                  onClick={() => window.open(link.href, "_blank", "noopener,noreferrer")}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{link.label}</div>
                    <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      {link.description}
                    </div>
                  </div>
                  <ArrowUpRight className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/50 text-primary">
                  <Settings2 className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>Assumptions</CardTitle>
                  <CardDescription>
                    Backend-declared runtime assumptions used to interpret the Markets environment.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 pt-0">
              {settingsQuery.data.assumptions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        <th className="px-4 py-3">Assumption</th>
                        <th className="px-4 py-3">Value</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settingsQuery.data.assumptions.map((assumption) => (
                        <AssumptionRow key={assumption.key} assumption={assumption} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-10 text-sm text-muted-foreground">No assumptions were returned.</div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
