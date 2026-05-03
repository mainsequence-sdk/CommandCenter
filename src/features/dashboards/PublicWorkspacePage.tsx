import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import type { DashboardDefinition } from "@/dashboards/types";
import { resolveDashboardLayout } from "@/dashboards/layout";
import { Badge } from "@/components/ui/badge";
import { PublicDashboardCanvas } from "./DashboardCanvas";
import { clonePublicWorkspaceRenderPermissions } from "./public-workspace-permissions";
import { SlideStudioSlideshowRuntime } from "./SlideStudioSlideshowPage";
import { normalizeDashboardDefinitionType } from "./workspace-definition-type";
import {
  fetchPublicWorkspaceDetailFromBackend,
  isWorkspaceBackendNotFoundError,
  PublicWorkspaceUnsupportedTypeError,
  WorkspaceBackendRequestError,
} from "./workspace-api";

function PublicWorkspaceStateCard({
  badge,
  title,
  description,
}: {
  badge: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg rounded-[calc(var(--radius)+2px)] border border-border/70 bg-card/80 px-6 py-6 text-center shadow-[var(--shadow-panel)]">
        <div className="flex justify-center">{badge}</div>
        <div className="mt-3 space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function PublicWorkspacePage() {
  const { token = "" } = useParams();
  const [dashboard, setDashboard] = useState<DashboardDefinition | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPublicWorkspace() {
      setLoading(true);
      setError(null);

      try {
        const nextDashboard = await fetchPublicWorkspaceDetailFromBackend(token);

        if (!cancelled) {
          setDashboard(nextDashboard);
        }
      } catch (nextError) {
        if (!cancelled) {
          setDashboard(null);
          setError(
            nextError instanceof Error
              ? nextError
              : new Error("Unable to load the public workspace."),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPublicWorkspace();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const resolvedPublicDashboard = useMemo(() => {
    if (!dashboard) {
      return {
        error: null,
        resolvedDashboard: null,
        type: null,
      };
    }

    try {
      return {
        error: null,
        resolvedDashboard: resolveDashboardLayout(dashboard),
        type: normalizeDashboardDefinitionType(dashboard.type, dashboard.labels),
      };
    } catch (nextError) {
      return {
        error:
          nextError instanceof Error
            ? nextError.message
            : "Unable to render the public workspace.",
        resolvedDashboard: null,
        type: normalizeDashboardDefinitionType(dashboard.type, dashboard.labels),
      };
    }
  }, [dashboard]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <PublicWorkspaceStateCard
          badge={
            <Badge variant="neutral" className="border border-border/70 bg-card/55">
              Loading
            </Badge>
          }
          title="Loading public workspace"
          description="Resolving the published workspace and preparing its public runtime."
        />
      );
    }

    if (error) {
      if (error instanceof PublicWorkspaceUnsupportedTypeError) {
        return (
          <PublicWorkspaceStateCard
            badge={
              <Badge variant="warning" className="border border-warning/30 bg-warning/12 text-warning">
                Unsupported type
              </Badge>
            }
            title="Public view is not available for this workspace"
            description={`The published workspace type "${error.workspaceType}" is not supported on the public surface.`}
          />
        );
      }

      if (error instanceof WorkspaceBackendRequestError && error.status === 403) {
        return (
          <PublicWorkspaceStateCard
            badge={
              <Badge variant="warning" className="border border-warning/30 bg-warning/12 text-warning">
                Access denied
              </Badge>
            }
            title="Public access is not allowed"
            description="This workspace is not currently available through a public link."
          />
        );
      }

      if (isWorkspaceBackendNotFoundError(error)) {
        return (
          <PublicWorkspaceStateCard
            badge={
              <Badge variant="warning" className="border border-warning/30 bg-warning/12 text-warning">
                Not found
              </Badge>
            }
            title="Public workspace not found"
            description="The public link is missing, expired, or no longer points to a published workspace."
          />
        );
      }

      return (
        <PublicWorkspaceStateCard
          badge={
            <Badge variant="danger" className="border border-danger/25 bg-danger/10 text-danger">
              Render error
            </Badge>
          }
          title="Unable to render public workspace"
          description={error.message}
        />
      );
    }

    if (!dashboard) {
      return null;
    }

    if (resolvedPublicDashboard.error) {
      return (
        <PublicWorkspaceStateCard
          badge={
            <Badge variant="danger" className="border border-danger/25 bg-danger/10 text-danger">
              Render error
            </Badge>
          }
          title="Unable to resolve public workspace"
          description={resolvedPublicDashboard.error}
        />
      );
    }

    if (
      resolvedPublicDashboard.type !== "workspace" &&
      resolvedPublicDashboard.type !== "slide-studio"
    ) {
      return (
        <PublicWorkspaceStateCard
          badge={
            <Badge variant="warning" className="border border-warning/30 bg-warning/12 text-warning">
              Unsupported type
            </Badge>
          }
          title="Public view is not available for this workspace"
          description="Only workspace and slide-studio workspaces can render on the public surface."
        />
      );
    }

    if (
      resolvedPublicDashboard.type === "slide-studio" &&
      resolvedPublicDashboard.resolvedDashboard
    ) {
      return (
        <SlideStudioSlideshowRuntime
          dashboard={dashboard}
          resolvedDashboard={resolvedPublicDashboard.resolvedDashboard}
          permissions={clonePublicWorkspaceRenderPermissions()}
          executionSurface="public-workspace"
          publicWorkspaceToken={token}
          manageKioskMode={false}
        />
      );
    }

    return <PublicDashboardCanvas dashboard={dashboard} publicWorkspaceToken={token} />;
  }, [dashboard, error, loading, resolvedPublicDashboard]);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: "var(--workspace-canvas-base-color)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--workspace-canvas-background)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--workspace-canvas-overlay)" }}
      />

      <div className="relative z-10 min-h-screen">
        <div className="min-h-screen">{content}</div>
      </div>
    </div>
  );
}
