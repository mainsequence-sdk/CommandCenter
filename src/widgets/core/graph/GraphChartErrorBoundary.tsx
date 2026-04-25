import { Component, type ErrorInfo, type ReactNode } from "react";

interface GraphChartErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface GraphChartErrorBoundaryState {
  hasError: boolean;
}

export class GraphChartErrorBoundary extends Component<
  GraphChartErrorBoundaryProps,
  GraphChartErrorBoundaryState
> {
  state: GraphChartErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (!import.meta.env.DEV) {
      return;
    }

    console.error("[graph] Chart boundary captured an error.", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}
