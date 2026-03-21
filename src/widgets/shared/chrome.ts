export const widgetShellClassName = "widget-shell";
export const widgetShellHeaderClassName = "widget-shell-header";

export function resolveWidgetHeaderVisibility(
  props?: Record<string, unknown> | null,
) {
  return props?.showHeader !== false;
}
