import { Component, type ErrorInfo, type ReactNode } from "react";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WidgetErrorSurface = "canvas" | "settings" | "hidden";

interface WidgetErrorBoundaryProps {
  children: ReactNode;
  instanceId?: string;
  surface?: WidgetErrorSurface;
  widgetId: string;
  widgetTitle: string;
}

interface WidgetErrorBoundaryState {
  error: Error | null;
}

function resolveWidgetErrorCopy(surface: WidgetErrorSurface) {
  switch (surface) {
    case "settings":
      return {
        title: "Widget settings failed to render",
        description:
          "This widget threw while rendering its settings. The rest of the workspace is still available.",
        className:
          "rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/8 px-4 py-4 text-sm text-danger shadow-[var(--shadow-panel)]",
      };
    case "hidden":
      return null;
    case "canvas":
    default:
      return {
        title: "Widget failed to render",
        description:
          "This widget crashed while rendering. The rest of the workspace should remain usable.",
        className:
          "flex h-full min-h-0 flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-danger/35 bg-danger/8 p-4 text-center text-danger",
      };
  }
}

export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  state: WidgetErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return {
      error,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[WidgetErrorBoundary] widget render failed", {
      widgetId: this.props.widgetId,
      widgetTitle: this.props.widgetTitle,
      instanceId: this.props.instanceId,
      surface: this.props.surface ?? "canvas",
      error,
      componentStack: info.componentStack,
    });
  }

  render() {
    const error = this.state.error;

    if (!error) {
      return this.props.children;
    }

    const surface = this.props.surface ?? "canvas";
    const copy = resolveWidgetErrorCopy(surface);

    if (!copy) {
      return null;
    }

    return (
      <section className={cn(copy.className)}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">{copy.title}</span>
        </div>
        <div className="space-y-1">
          <p className="text-sm">
            {this.props.widgetTitle}{" "}
            <span className="font-mono text-[11px]">({this.props.widgetId})</span>
          </p>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <details className="w-full max-w-full rounded-[calc(var(--radius)-8px)] border border-danger/20 bg-background/40 px-3 py-2 text-left">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Developer details
          </summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs text-danger">
            {error.stack ?? error.message}
          </pre>
        </details>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            this.setState({ error: null });
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retry render
        </Button>
      </section>
    );
  }
}
