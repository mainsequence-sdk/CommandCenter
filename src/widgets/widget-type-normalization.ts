export const LEGACY_PORTFOLIO_WEIGHTS_WIDGET_ID = "portfolio-weights-table";
export const POSITION_DETAIL_WIDGET_ID = "position-detail";

const LEGACY_WIDGET_TYPE_ID_ALIASES: Record<string, string> = {
  [LEGACY_PORTFOLIO_WEIGHTS_WIDGET_ID]: POSITION_DETAIL_WIDGET_ID,
};

export function normalizeWidgetTypeId(widgetId: string) {
  const normalized = widgetId.trim();

  if (!normalized) {
    return normalized;
  }

  return LEGACY_WIDGET_TYPE_ID_ALIASES[normalized] ?? normalized;
}

export function normalizeWidgetTypeIds(widgetIds: Iterable<string>) {
  return Array.from(
    new Set(
      Array.from(widgetIds, (widgetId) => normalizeWidgetTypeId(widgetId)).filter(
        (widgetId) => widgetId.length > 0,
      ),
    ),
  );
}
