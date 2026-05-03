import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { DashboardDefinition } from "@/dashboards/types";
import { resolveDashboardLayout } from "@/dashboards/layout";
import { PublicDashboardCanvas } from "./DashboardCanvas";
import { SlideStudioSlideshowRuntime } from "./SlideStudioSlideshowPage";
import { normalizeDashboardDefinitionType } from "./workspace-definition-type";
import { fetchPublicWorkspaceDetailFromBackend } from "./workspace-api";

const PUBLIC_RENDER_PERMISSIONS: readonly string[] = ["workspaces:view"];

export function PublicWorkspacePage() {
  const { token = "" } = useParams();
  const [dashboard, setDashboard] = useState<DashboardDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
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
              ? nextError.message
              : "Unable to load the public workspace.",
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
        <div className="flex min-h-[40vh] items-center justify-center px-6 py-12">
          <div className="rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/80 px-5 py-4 text-sm text-muted-foreground shadow-[var(--shadow-panel)]">
            Loading workspace...
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center px-6 py-12">
          <div className="max-w-lg rounded-[calc(var(--radius)+2px)] border border-danger/25 bg-danger/8 px-5 py-4 text-sm text-danger shadow-[var(--shadow-panel)]">
            {error}
          </div>
        </div>
      );
    }

    if (!dashboard) {
      return null;
    }

    if (resolvedPublicDashboard.error) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center px-6 py-12">
          <div className="max-w-lg rounded-[calc(var(--radius)+2px)] border border-danger/25 bg-danger/8 px-5 py-4 text-sm text-danger shadow-[var(--shadow-panel)]">
            {resolvedPublicDashboard.error}
          </div>
        </div>
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
          permissions={PUBLIC_RENDER_PERMISSIONS}
          manageKioskMode={false}
        />
      );
    }

    return <PublicDashboardCanvas dashboard={dashboard} />;
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
