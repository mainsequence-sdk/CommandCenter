import { useEffect, useState, type ReactNode } from "react";

import type { WidgetDefinition } from "@/widgets/types";

let widgetPreviewScopeDepth = 0;

function clonePreviewValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function enterWidgetPreviewScope() {
  widgetPreviewScopeDepth += 1;

  return () => {
    widgetPreviewScopeDepth = Math.max(0, widgetPreviewScopeDepth - 1);
  };
}

export function isWidgetPreviewMode() {
  return widgetPreviewScopeDepth > 0;
}

export function getWidgetExplorerPath(widgetId: string) {
  return getWidgetDetailsPath(widgetId);
}

export function getWidgetDetailsPath(widgetId: string) {
  return `/app/workspace-studio/widget-catalog/${encodeURIComponent(widgetId)}`;
}

export function resolveWidgetMockProps<TProps extends Record<string, unknown>>(
  widget: WidgetDefinition<TProps>,
) {
  return clonePreviewValue((widget.mockProps ?? widget.exampleProps ?? {}) as TProps);
}

export function resolveWidgetMockRuntimeState(widget: WidgetDefinition) {
  return clonePreviewValue(widget.mockRuntimeState ?? {});
}

export function WidgetPreviewModeBoundary({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const release = enterWidgetPreviewScope();
    setActive(true);

    return () => {
      release();
    };
  }, []);

  return active ? <>{children}</> : <>{fallback}</>;
}
