export const CORE_MARKDOWN_NOTE_WIDGET_ID = "core__markdown-note";
export const CORE_RICH_TEXT_NOTE_WIDGET_ID = "core__rich-text-note";
export const CORE_APP_COMPONENT_WIDGET_ID = "core__app-component";
export const CORE_CONNECTION_QUERY_WIDGET_ID = "core__connection-query";
export const CORE_CONNECTION_STREAM_QUERY_WIDGET_ID = "core__connection-stream-query";
export const CORE_DEBUG_STREAM_WIDGET_ID = "core__debug-stream";
export const CORE_TABULAR_TRANSFORM_WIDGET_ID = "core__tabular-transform";
export const CORE_TABLE_WIDGET_ID = "core__table";
export const CORE_PRO_TABLE_WIDGET_ID = "core__pro-table";
export const CORE_GRAPH_WIDGET_ID = "core__graph";
export const CORE_STATISTIC_WIDGET_ID = "core__statistic";
export const CORE_WORKSPACE_ROW_WIDGET_ID = "core__workspace-row";
export const CORE_WORKSPACE_SLIDE_WIDGET_ID = "core__workspace-slide";
export const ECHARTS_SPEC_WIDGET_ID = "echarts__spec";
export const LIGHTWEIGHT_CHARTS_SPEC_WIDGET_ID = "lightweight-charts__spec";
export const DEMO_YIELD_CURVE_PLOT_WIDGET_ID = "demo__yield-curve-plot";
export const DEMO_HEATMAP_MATRIX_CHART_WIDGET_ID = "demo__heatmap-matrix-chart";
export const MAIN_SEQUENCE_AI_AGENT_TERMINAL_WIDGET_ID = "main-sequence-ai__agent-terminal";
export const MAIN_SEQUENCE_AI_WORKSPACE_WIDGET_ID = "main-sequence-ai__workspace";
export const MAIN_SEQUENCE_AI_UPSTREAM_INSPECTOR_WIDGET_ID = "main-sequence-ai__upstream-inspector";
export const MAIN_SEQUENCE_FOUNDRY_DEPENDENCY_GRAPH_WIDGET_ID =
  "main-sequence-foundry__dependency-graph";
export const MAIN_SEQUENCE_FOUNDRY_PROJECT_INFRA_GRAPH_WIDGET_ID =
  "main-sequence-foundry__project-infra-graph";
export const MAIN_SEQUENCE_MARKETS_ZERO_CURVE_WIDGET_ID = "main-sequence-markets__zero-curve";
export const MAIN_SEQUENCE_MARKETS_OHLC_BARS_WIDGET_ID = "main-sequence-markets__ohlc-bars";
export const MAIN_SEQUENCE_MARKETS_CURVE_PLOT_WIDGET_ID = "main-sequence-markets__curve-plot";
export const MAIN_SEQUENCE_MARKETS_POSITION_DETAIL_WIDGET_ID =
  "main-sequence-markets__position-detail";
export const MAIN_SEQUENCE_MARKETS_ASSET_SCREENER_WIDGET_ID =
  "main-sequence-markets__asset-screener";

export const LEGACY_PORTFOLIO_WEIGHTS_WIDGET_ID = "portfolio-weights-table";
export const POSITION_DETAIL_WIDGET_ID = MAIN_SEQUENCE_MARKETS_POSITION_DETAIL_WIDGET_ID;

const LEGACY_WIDGET_TYPE_ID_ALIASES: Record<string, string> = {
  "markdown-note": CORE_MARKDOWN_NOTE_WIDGET_ID,
  "rich-text-note": CORE_RICH_TEXT_NOTE_WIDGET_ID,
  "app-component": CORE_APP_COMPONENT_WIDGET_ID,
  "connection-query": CORE_CONNECTION_QUERY_WIDGET_ID,
  "connection-stream-query": CORE_CONNECTION_STREAM_QUERY_WIDGET_ID,
  debug_stream: CORE_DEBUG_STREAM_WIDGET_ID,
  "tabular-transform": CORE_TABULAR_TRANSFORM_WIDGET_ID,
  table: CORE_TABLE_WIDGET_ID,
  "pro-table": CORE_PRO_TABLE_WIDGET_ID,
  graph: CORE_GRAPH_WIDGET_ID,
  statistic: CORE_STATISTIC_WIDGET_ID,
  "workspace-row": CORE_WORKSPACE_ROW_WIDGET_ID,
  "workspace-slide": CORE_WORKSPACE_SLIDE_WIDGET_ID,
  "echarts-spec": ECHARTS_SPEC_WIDGET_ID,
  "lightweight-charts-spec": LIGHTWEIGHT_CHARTS_SPEC_WIDGET_ID,
  "yield-curve-plot": DEMO_YIELD_CURVE_PLOT_WIDGET_ID,
  "heatmap-matrix-chart": DEMO_HEATMAP_MATRIX_CHART_WIDGET_ID,
  "main-sequence-ai-agent-terminal": MAIN_SEQUENCE_AI_AGENT_TERMINAL_WIDGET_ID,
  "main-sequence-ai-workspace": MAIN_SEQUENCE_AI_WORKSPACE_WIDGET_ID,
  "main-sequence-ai-upstream-inspector": MAIN_SEQUENCE_AI_UPSTREAM_INSPECTOR_WIDGET_ID,
  "main-sequence-dependency-graph": MAIN_SEQUENCE_FOUNDRY_DEPENDENCY_GRAPH_WIDGET_ID,
  "main-sequence-project-infra-graph": MAIN_SEQUENCE_FOUNDRY_PROJECT_INFRA_GRAPH_WIDGET_ID,
  "main-sequence-zero-curve": MAIN_SEQUENCE_MARKETS_ZERO_CURVE_WIDGET_ID,
  "main-sequence-ohlc-bars": MAIN_SEQUENCE_MARKETS_OHLC_BARS_WIDGET_ID,
  "main-sequence-curve-plot": MAIN_SEQUENCE_MARKETS_CURVE_PLOT_WIDGET_ID,
  "position-detail": MAIN_SEQUENCE_MARKETS_POSITION_DETAIL_WIDGET_ID,
  "ms-markets-asset-screener": MAIN_SEQUENCE_MARKETS_ASSET_SCREENER_WIDGET_ID,
  [LEGACY_PORTFOLIO_WEIGHTS_WIDGET_ID]: MAIN_SEQUENCE_MARKETS_POSITION_DETAIL_WIDGET_ID,
};

export function normalizeWidgetTypeId(widgetId: string) {
  const normalized = widgetId.trim();

  if (!normalized) {
    return normalized;
  }

  return LEGACY_WIDGET_TYPE_ID_ALIASES[normalized] ?? normalized;
}

export function isLegacyWidgetTypeId(widgetId: string) {
  const normalized = widgetId.trim();

  return Boolean(normalized && LEGACY_WIDGET_TYPE_ID_ALIASES[normalized]);
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
