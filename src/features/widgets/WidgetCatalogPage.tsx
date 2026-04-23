import { useMemo } from "react";

import { Link } from "react-router-dom";

import { appRegistry } from "@/app/registry";
import { useAuthStore } from "@/auth/auth-store";
import { hasAllPermissions } from "@/auth/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getWidgetDetailsPath } from "@/features/widgets/widget-explorer";
import { titleCase } from "@/lib/utils";
import { useRegisteredWidgetTypesCatalog } from "@/widgets/registered-widget-types-api";
import type { WidgetDefinition } from "@/widgets/types";

function formatSource(source: string) {
  return titleCase(source.replace(/[_-]+/g, " "));
}

function resolveRuntimeMode(widget: WidgetDefinition) {
  if (widget.workspaceRuntimeMode) {
    return widget.workspaceRuntimeMode;
  }

  return widget.execution ? "execution-owner" : "local-ui";
}

function formatPermissions(permissions: string[] | undefined) {
  return permissions?.length ? permissions.join(", ") : "None";
}

export function WidgetCatalogPage() {
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);
  const registeredWidgetTypes = useRegisteredWidgetTypesCatalog();
  const availableWidgets = useMemo(
    () =>
      appRegistry.widgets.filter((widget) =>
        hasAllPermissions(permissions, widget.requiredPermissions ?? []) &&
        (
          !registeredWidgetTypes.endpointConfigured ||
          registeredWidgetTypes.activeWidgetIdSet.has(widget.id)
        ),
      ),
    [permissions, registeredWidgetTypes.activeWidgetIdSet, registeredWidgetTypes.endpointConfigured],
  );

  const rows = useMemo(
    () =>
      [...availableWidgets].sort((left, right) => {
        if (left.category !== right.category) {
          return left.category.localeCompare(right.category);
        }

        return left.title.localeCompare(right.title);
      }),
    [availableWidgets],
  );

  return (
    <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Registry"
          title="Widget Catalog"
          description="Browse the widget types available for workspace design. Open a row for full usage details, ports, configuration, and examples."
        />

        {registeredWidgetTypes.endpointConfigured && registeredWidgetTypes.isLoading ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-sm text-muted-foreground">
            Loading backend-registered widget types.
          </div>
        ) : null}

        {registeredWidgetTypes.endpointConfigured && registeredWidgetTypes.error ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            The backend widget-type registry could not be loaded. Unsynced widgets stay hidden until
            the registry is available again.
          </div>
        ) : null}

        <Card>
          <CardContent className="p-0">
            {availableWidgets.length === 0 ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-8 text-center">
                <div className="text-sm font-medium text-foreground">No registered widgets available</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {registeredWidgetTypes.endpointConfigured
                    ? "The backend does not currently expose any active registered widget types for this user."
                    : "No widgets matched the current permission set."}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1160px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/35 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Widget</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                      <th className="px-4 py-3 font-medium">Application / Source</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Runtime</th>
                      <th className="px-4 py-3 font-medium">Permissions</th>
                      <th className="px-4 py-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((widget) => (
                      <tr
                        key={widget.id}
                        className="border-b border-border/60 align-top transition-colors hover:bg-muted/25"
                      >
                        <td className="w-[220px] px-4 py-3">
                          <Link
                            to={getWidgetDetailsPath(widget.id)}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {widget.title}
                          </Link>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">
                            {widget.id}
                          </div>
                        </td>
                        <td className="max-w-[420px] px-4 py-3 text-muted-foreground">
                          <div
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {widget.description}
                          </div>
                        </td>
                        <td className="w-[170px] px-4 py-3 text-foreground">
                          {formatSource(widget.source)}
                        </td>
                        <td className="w-[190px] px-4 py-3 text-foreground">
                          {titleCase(widget.category)}
                        </td>
                        <td className="w-[100px] px-4 py-3 text-foreground">
                          {widget.kind}
                        </td>
                        <td className="w-[150px] px-4 py-3 text-foreground">
                          {resolveRuntimeMode(widget)}
                        </td>
                        <td className="w-[220px] px-4 py-3 font-mono text-xs text-muted-foreground">
                          {formatPermissions(widget.requiredPermissions)}
                        </td>
                        <td className="w-[110px] px-4 py-3">
                          <Link
                            to={getWidgetDetailsPath(widget.id)}
                            className="inline-flex h-8 items-center rounded-[calc(var(--radius)-6px)] border border-border bg-card/80 px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
                          >
                            View details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
