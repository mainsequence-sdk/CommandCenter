import { Component, type ErrorInfo, type ReactNode } from "react";

import { AlertTriangle, ArrowLeft, RotateCcw, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WorkspaceRenderErrorStateProps {
  error: Error;
  onBackToWorkspaces: () => void;
  onOpenSettings?: () => void;
  onRetry?: () => void;
  workspaceId: string;
  workspaceTitle?: string;
}

export function WorkspaceRenderErrorState({
  error,
  onBackToWorkspaces,
  onOpenSettings,
  onRetry,
  workspaceId,
  workspaceTitle,
}: WorkspaceRenderErrorStateProps) {
  return (
    <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex min-h-[320px] max-w-4xl items-center justify-center">
        <section className="w-full max-w-2xl rounded-[calc(var(--radius)+4px)] border border-danger/25 bg-card/80 px-6 py-8 shadow-[var(--shadow-panel)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning" className="border border-danger/25 bg-danger/10 text-danger">
              Workspace render failed
            </Badge>
            <Badge variant="neutral" className="border border-border/70 bg-card/55 font-mono text-[11px]">
              {workspaceId}
            </Badge>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-danger" />
              <h1 className="text-lg font-semibold tracking-tight">
                Unable to render this workspace
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {workspaceTitle?.trim() || "This workspace"} contains invalid or unsupported client
              data for the current view. The workspace settings route is still available so you can
              export or repair the JSON instead of losing access to the whole workspace.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {onOpenSettings ? (
              <Button
                onClick={() => {
                  onOpenSettings();
                }}
              >
                <Settings2 className="h-4 w-4" />
                Open workspace settings
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => {
                onBackToWorkspaces();
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to workspaces
            </Button>
            {onRetry ? (
              <Button
                variant="outline"
                onClick={() => {
                  onRetry();
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Retry render
              </Button>
            ) : null}
          </div>
          <details className="mt-5 rounded-[calc(var(--radius)-6px)] border border-danger/20 bg-background/40 px-3 py-2 text-left">
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Developer details
            </summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs text-danger">
              {error.stack ?? error.message}
            </pre>
          </details>
        </section>
      </div>
    </div>
  );
}

interface WorkspaceRenderErrorBoundaryProps {
  children: ReactNode;
  onBackToWorkspaces: () => void;
  onOpenSettings?: () => void;
  resetKey: string;
  workspaceId: string;
  workspaceTitle?: string;
}

interface WorkspaceRenderErrorBoundaryState {
  error: Error | null;
}

export class WorkspaceRenderErrorBoundary extends Component<
  WorkspaceRenderErrorBoundaryProps,
  WorkspaceRenderErrorBoundaryState
> {
  state: WorkspaceRenderErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): WorkspaceRenderErrorBoundaryState {
    return {
      error,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[WorkspaceRenderErrorBoundary] workspace render failed", {
      workspaceId: this.props.workspaceId,
      workspaceTitle: this.props.workspaceTitle,
      error,
      componentStack: info.componentStack,
    });
  }

  componentDidUpdate(
    prevProps: WorkspaceRenderErrorBoundaryProps,
    prevState: WorkspaceRenderErrorBoundaryState,
  ) {
    if (prevProps.resetKey !== this.props.resetKey && prevState.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <WorkspaceRenderErrorState
        error={this.state.error}
        onBackToWorkspaces={this.props.onBackToWorkspaces}
        onOpenSettings={this.props.onOpenSettings}
        onRetry={() => {
          this.setState({ error: null });
        }}
        workspaceId={this.props.workspaceId}
        workspaceTitle={this.props.workspaceTitle}
      />
    );
  }
}
