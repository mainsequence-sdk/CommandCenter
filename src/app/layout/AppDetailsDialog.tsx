import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import type { AppDefinition, AppSurfaceDefinition } from "@/apps/types";
import { getAppPath } from "@/apps/utils";

interface AppDetailsDialogProps {
  app: AppDefinition;
  open: boolean;
  onClose: () => void;
  surfaces: AppSurfaceDefinition[];
}

function DetailBlock({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[calc(var(--radius)-6px)] border border-white/8 bg-white/[0.03] p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={mono ? "mt-2 font-mono text-sm text-topbar-foreground" : "mt-2 text-sm text-topbar-foreground"}>
        {value}
      </div>
    </div>
  );
}

export function AppDetailsDialog({
  app,
  open,
  onClose,
  surfaces,
}: AppDetailsDialogProps) {
  const AppIcon = app.icon;
  const defaultSurface =
    surfaces.find((surface) => surface.id === app.defaultSurfaceId) ?? surfaces[0];
  const permissions = (app.requiredPermissions ?? ["none"]).join(", ");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={app.title}
      description={app.description}
      className="max-w-[min(1080px,calc(100vw-24px))]"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px]">
        <section className="space-y-4">
          <div className="rounded-[calc(var(--radius)-2px)] border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-topbar-foreground">
                <AppIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  App Details
                </div>
                <div className="mt-2 text-lg font-semibold text-topbar-foreground">
                  {app.title}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">{app.description}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="neutral">{app.source}</Badge>
                  <Badge variant="neutral">{surfaces.length} surfaces</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[calc(var(--radius)-2px)] border border-white/8 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Surfaces
            </div>
            <div className="mt-4 space-y-3">
              {surfaces.map((surface) => (
                <div
                  key={surface.id}
                  className="rounded-[calc(var(--radius)-6px)] border border-white/8 bg-white/[0.03] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-topbar-foreground">
                        {surface.title}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {surface.description}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {surface.id === defaultSurface?.id ? (
                        <Badge variant="primary">home</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </section>

        <aside className="space-y-4">
          <DetailBlock label="Shows In" value="Left rail, topbar surface selector, global search" />
          <DetailBlock label="Home Route" value={getAppPath(app.id)} mono />
          <DetailBlock
            label="Default Surface"
            value={defaultSurface?.title ?? app.defaultSurfaceId}
          />
          <DetailBlock label="Permissions" value={permissions} />
          <DetailBlock label="Documentation" value="Not configured" />
        </aside>
      </div>
    </Dialog>
  );
}
