import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { DashboardDefinition } from "@/dashboards/types";
import { PublicDashboardCanvas } from "./DashboardCanvas";
import { fetchPublicWorkspaceDetailFromBackend } from "./workspace-api";

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

    return <PublicDashboardCanvas dashboard={dashboard} />;
  }, [dashboard, error, loading]);

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
