import { Component, type ErrorInfo, type ReactNode } from "react";

interface DataNodeVisualizerChartErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface DataNodeVisualizerChartErrorBoundaryState {
  hasError: boolean;
}

export class DataNodeVisualizerChartErrorBoundary extends Component<
  DataNodeVisualizerChartErrorBoundaryProps,
  DataNodeVisualizerChartErrorBoundaryState
> {
  state: DataNodeVisualizerChartErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (!import.meta.env.DEV) {
      return;
    }

    console.error("[data-node-visualizer] Chart boundary captured an error.", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}
