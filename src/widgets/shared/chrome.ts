export const widgetShellClassName = "widget-shell";
export const widgetShellHeaderClassName = "widget-shell-header";

export function resolveWidgetHeaderVisibility(
  props?: Record<string, unknown> | null,
) {
  return props?.showHeader !== false;
}

export function resolveWidgetMinimalChrome(
  props?: Record<string, unknown> | null,
) {
  return props?.chromeMode === "minimal";
}

export function resolveWidgetTransparentSurface(
  presentation?: { surfaceMode?: string } | null,
) {
  return presentation?.surfaceMode === "transparent";
}

export function resolveWidgetSidebarOnly(
  presentation?: { placementMode?: string } | null,
) {
  return presentation?.placementMode === "sidebar";
}
