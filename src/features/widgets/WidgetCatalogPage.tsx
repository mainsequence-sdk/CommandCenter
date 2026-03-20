import { useMemo } from "react";

import { appRegistry } from "@/app/registry";
import { useAuthStore } from "@/auth/auth-store";
import { hasAllPermissions } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { titleCase } from "@/lib/utils";

export function WidgetCatalogPage() {
  const permissions = useAuthStore((state) => state.session?.user.permissions ?? []);

  const grouped = useMemo(() => {
    return appRegistry.widgets.reduce<Record<string, typeof appRegistry.widgets>>((acc, widget) => {
      if (!acc[widget.category]) acc[widget.category] = [];
      acc[widget.category].push(widget);
      return acc;
    }, {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Registry"
        title="Widget Catalog"
        description="Each widget is a module with metadata, permission requirements and typed props. Teams can add more widgets by shipping new extensions."
      />

      <div className="space-y-6">
        {Object.entries(grouped).map(([category, widgets]) => (
          <section key={category} className="space-y-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {titleCase(category)}
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {widgets.map((widget) => {
                const allowed = hasAllPermissions(
                  permissions,
                  widget.requiredPermissions ?? [],
                );
                const snippet = `{
  id: "${widget.id}-instance",
  widgetId: "${widget.id}",
  title: "${widget.title}",
  props: ${JSON.stringify(widget.exampleProps ?? {}, null, 2).replace(/\n/g, "\n  ")},
  layout: { cols: ${widget.defaultSize.w}, rows: ${widget.defaultSize.h} }
}`;

                return (
                  <Card key={widget.id}>
                    <CardHeader className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle>{widget.title}</CardTitle>
                          <CardDescription>{widget.description}</CardDescription>
                        </div>
                        <Badge variant={allowed ? "success" : "warning"}>
                          {allowed ? "allowed" : "restricted"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="neutral">{widget.kind}</Badge>
                        <Badge variant="neutral">{widget.source}</Badge>
                        {widget.tags?.map((tag) => (
                          <Badge key={tag} variant="neutral">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em]">ID</div>
                          <div className="mt-1 font-mono text-foreground">{widget.id}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em]">Default size</div>
                          <div className="mt-1 text-foreground">
                            {widget.defaultSize.w} × {widget.defaultSize.h}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em]">Permissions</div>
                          <div className="mt-1 text-foreground">
                            {(widget.requiredPermissions ?? ["none"]).join(", ")}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Dashboard surface snippet
                        </div>
                        <pre className="overflow-x-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/55 p-4 text-xs text-foreground">
{snippet}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
