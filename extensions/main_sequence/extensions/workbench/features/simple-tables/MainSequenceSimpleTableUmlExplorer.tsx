import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import {
  ArrowRightLeft,
  KeyRound,
  Loader2,
  Move,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { withAlpha } from "@/lib/color";
import { useTheme } from "@/themes/ThemeProvider";

import type {
  SimpleTableSchemaGraphRelationshipRecord,
  SimpleTableSchemaGraphResponse,
  SimpleTableSchemaGraphTableRecord,
} from "../../../../common/api";

interface MainSequenceSimpleTableUmlExplorerProps {
  error: string | null;
  isLoading: boolean;
  payload: SimpleTableSchemaGraphResponse | undefined;
}

interface PointerPanState {
  originPanX: number;
  originPanY: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
}

interface SimpleTableUmlLayoutCard extends SimpleTableSchemaGraphTableRecord {
  columnAnchors: Map<string, { leftX: number; rightX: number; y: number }>;
  depth: number;
  height: number;
  width: number;
  x: number;
  y: number;
}

interface SimpleTableUmlLayoutResult {
  bounds: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  cards: SimpleTableUmlLayoutCard[];
  cardsById: Map<number, SimpleTableUmlLayoutCard>;
  maxDepth: number;
  minDepth: number;
  relationships: SimpleTableSchemaGraphRelationshipRecord[];
}

const umlGraphConfig = {
  bodyBottomSafety: 20,
  bodyPaddingY: 24,
  cardWidth: 360,
  columnGap: 144,
  columnRowGap: 8,
  fitPadding: 52,
  headerHeight: 94,
  indexBlockGapTop: 16,
  indexHeaderHeight: 18,
  indexPillGap: 8,
  indexPillHeight: 26,
  indexSectionTopPadding: 12,
  innerHorizontalPadding: 32,
  minCardHeight: 186,
  minZoom: 0.42,
  paddingX: 64,
  paddingY: 56,
  rowGap: 34,
  rowHeight: 36,
  maxZoom: 1.8,
};

function alphaColor(color: string, alpha: number) {
  return color.startsWith("#") ? withAlpha(color, alpha) : color;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function estimateIndexPillWidth(index: SimpleTableSchemaGraphTableRecord["indexes"][number]) {
  const content = [index.name, index.columns.join(", ")].filter(Boolean).join(" · ");

  return Math.max(96, Math.min(308, 28 + content.length * 6.8));
}

function estimateIndexRows(table: SimpleTableSchemaGraphTableRecord) {
  if (table.indexes.length === 0) {
    return 0;
  }

  const availableWidth = umlGraphConfig.cardWidth - umlGraphConfig.innerHorizontalPadding;
  let rows = 1;
  let currentRowWidth = 0;

  table.indexes.forEach((index) => {
    const pillWidth = estimateIndexPillWidth(index);

    if (currentRowWidth === 0) {
      currentRowWidth = pillWidth;
      return;
    }

    if (currentRowWidth + umlGraphConfig.indexPillGap + pillWidth <= availableWidth) {
      currentRowWidth += umlGraphConfig.indexPillGap + pillWidth;
      return;
    }

    rows += 1;
    currentRowWidth = pillWidth;
  });

  return rows;
}

function getCardHeight(table: SimpleTableSchemaGraphTableRecord) {
  const columnCount = Math.max(1, table.columns.length);
  const columnHeight =
    columnCount * umlGraphConfig.rowHeight +
    Math.max(0, columnCount - 1) * umlGraphConfig.columnRowGap;
  const indexRows = estimateIndexRows(table);
  const indexesHeight =
    indexRows > 0
      ? umlGraphConfig.indexBlockGapTop +
        umlGraphConfig.indexSectionTopPadding +
        umlGraphConfig.indexHeaderHeight +
        8 +
        indexRows * umlGraphConfig.indexPillHeight +
        Math.max(0, indexRows - 1) * umlGraphConfig.indexPillGap
      : 0;

  return Math.max(
    umlGraphConfig.minCardHeight,
    umlGraphConfig.headerHeight +
      umlGraphConfig.bodyPaddingY +
      columnHeight +
      indexesHeight +
      umlGraphConfig.bodyBottomSafety,
  );
}

function getFitTransform(
  bounds: SimpleTableUmlLayoutResult["bounds"],
  viewport: { height: number; width: number },
) {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const availableWidth = Math.max(1, width - umlGraphConfig.fitPadding * 2);
  const availableHeight = Math.max(1, height - umlGraphConfig.fitPadding * 2);
  const zoom = clamp(
    Math.min(availableWidth / bounds.width, availableHeight / bounds.height),
    umlGraphConfig.minZoom,
    umlGraphConfig.maxZoom,
  );

  return {
    panX: (width - bounds.width * zoom) / 2 - bounds.x * zoom,
    panY: (height - bounds.height * zoom) / 2 - bounds.y * zoom,
    zoom,
  };
}

function buildDepthMap(payload: SimpleTableSchemaGraphResponse) {
  const outgoing = new Map<number, Set<number>>();
  const incoming = new Map<number, Set<number>>();

  payload.relationships.forEach((relationship) => {
    const currentOutgoing = outgoing.get(relationship.source_table_id) ?? new Set<number>();
    currentOutgoing.add(relationship.target_table_id);
    outgoing.set(relationship.source_table_id, currentOutgoing);

    const currentIncoming = incoming.get(relationship.target_table_id) ?? new Set<number>();
    currentIncoming.add(relationship.source_table_id);
    incoming.set(relationship.target_table_id, currentIncoming);
  });

  const depths = new Map<number, number>();
  const queue: number[] = [payload.root_table_id];
  depths.set(payload.root_table_id, 0);

  while (queue.length > 0) {
    const currentTableId = queue.shift();

    if (currentTableId === undefined) {
      continue;
    }

    const currentDepth = depths.get(currentTableId) ?? 0;

    (outgoing.get(currentTableId) ?? []).forEach((tableId) => {
      if (!depths.has(tableId)) {
        depths.set(tableId, currentDepth + 1);
        queue.push(tableId);
      }
    });

    (incoming.get(currentTableId) ?? []).forEach((tableId) => {
      if (!depths.has(tableId)) {
        depths.set(tableId, currentDepth - 1);
        queue.push(tableId);
      }
    });
  }

  let fallbackDepth =
    Math.max(
      0,
      ...Array.from(depths.values()).filter((value) => Number.isFinite(value) && value >= 0),
    ) + 1;

  payload.tables.forEach((table) => {
    if (!depths.has(table.id)) {
      depths.set(table.id, fallbackDepth);
      fallbackDepth += 1;
    }
  });

  return depths;
}

function buildColumnAnchors(card: {
  height: number;
  width: number;
  x: number;
  y: number;
  columns: SimpleTableSchemaGraphTableRecord["columns"];
}) {
  const anchors = new Map<string, { leftX: number; rightX: number; y: number }>();
  const startY = card.y + umlGraphConfig.headerHeight;

  card.columns.forEach((column, index) => {
    anchors.set(column.column_name, {
      leftX: card.x,
      rightX: card.x + card.width,
      y: startY + index * umlGraphConfig.rowHeight + umlGraphConfig.rowHeight / 2,
    });
  });

  return anchors;
}

function buildSimpleTableUmlLayout(
  payload: SimpleTableSchemaGraphResponse | undefined,
): SimpleTableUmlLayoutResult | null {
  if (!payload) {
    return null;
  }

  if (!payload.tables.length) {
    return {
      bounds: {
        x: 0,
        y: 0,
        width: umlGraphConfig.cardWidth,
        height: umlGraphConfig.minCardHeight,
      },
      cards: [],
      cardsById: new Map(),
      minDepth: 0,
      maxDepth: 0,
      relationships: [],
    };
  }

  const depths = buildDepthMap(payload);
  const relationCounts = new Map<number, number>();

  payload.relationships.forEach((relationship) => {
    relationCounts.set(
      relationship.source_table_id,
      (relationCounts.get(relationship.source_table_id) ?? 0) + 1,
    );
    relationCounts.set(
      relationship.target_table_id,
      (relationCounts.get(relationship.target_table_id) ?? 0) + 1,
    );
  });

  const groups = new Map<number, SimpleTableSchemaGraphTableRecord[]>();
  payload.tables.forEach((table) => {
    const depth = depths.get(table.id) ?? 0;
    const current = groups.get(depth) ?? [];
    current.push(table);
    groups.set(depth, current);
  });

  const orderedDepths = Array.from(groups.keys()).sort((left, right) => left - right);
  const minDepth = orderedDepths[0] ?? 0;
  const maxDepth = orderedDepths[orderedDepths.length - 1] ?? 0;

  const groupHeights = new Map<number, number>();
  orderedDepths.forEach((depth) => {
    const tables = [...(groups.get(depth) ?? [])].sort((left, right) => {
      if (left.id === payload.root_table_id) {
        return -1;
      }

      if (right.id === payload.root_table_id) {
        return 1;
      }

      const relationDelta = (relationCounts.get(right.id) ?? 0) - (relationCounts.get(left.id) ?? 0);

      if (relationDelta !== 0) {
        return relationDelta;
      }

      return (left.identifier || `Table ${left.id}`).localeCompare(
        right.identifier || `Table ${right.id}`,
      );
    });

    groups.set(depth, tables);

    const totalHeight =
      tables.reduce((sum, table) => sum + getCardHeight(table), 0) +
      Math.max(0, tables.length - 1) * umlGraphConfig.rowGap;
    groupHeights.set(depth, totalHeight);
  });

  const maxGroupHeight = Math.max(...Array.from(groupHeights.values()), umlGraphConfig.minCardHeight);
  const cards: SimpleTableUmlLayoutCard[] = [];

  orderedDepths.forEach((depth) => {
    const tables = groups.get(depth) ?? [];
    const groupHeight = groupHeights.get(depth) ?? 0;
    let currentY = umlGraphConfig.paddingY + (maxGroupHeight - groupHeight) / 2;
    const x =
      umlGraphConfig.paddingX +
      (depth - minDepth) * (umlGraphConfig.cardWidth + umlGraphConfig.columnGap);

    tables.forEach((table) => {
      const height = getCardHeight(table);
      const card: SimpleTableUmlLayoutCard = {
        ...table,
        depth,
        height,
        width: umlGraphConfig.cardWidth,
        x,
        y: currentY,
        columnAnchors: new Map(),
      };
      card.columnAnchors = buildColumnAnchors(card);
      cards.push(card);
      currentY += height + umlGraphConfig.rowGap;
    });
  });

  const left = Math.min(...cards.map((card) => card.x), 0);
  const top = Math.min(...cards.map((card) => card.y), 0);
  const right = Math.max(...cards.map((card) => card.x + card.width), umlGraphConfig.cardWidth);
  const bottom = Math.max(
    ...cards.map((card) => card.y + card.height),
    umlGraphConfig.minCardHeight,
  );
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  return {
    bounds: {
      x: left,
      y: top,
      width: right - left + umlGraphConfig.paddingX,
      height: bottom - top + umlGraphConfig.paddingY,
    },
    cards,
    cardsById,
    minDepth,
    maxDepth,
    relationships: payload.relationships,
  };
}

function buildRelationshipPath(
  relationship: SimpleTableSchemaGraphRelationshipRecord,
  cardsById: Map<number, SimpleTableUmlLayoutCard>,
) {
  const sourceCard = cardsById.get(relationship.source_table_id);
  const targetCard = cardsById.get(relationship.target_table_id);

  if (!sourceCard || !targetCard) {
    return null;
  }

  const sourceAnchor = sourceCard.columnAnchors.get(relationship.source_column) ?? {
    leftX: sourceCard.x,
    rightX: sourceCard.x + sourceCard.width,
    y: sourceCard.y + sourceCard.height / 2,
  };
  const targetAnchor = targetCard.columnAnchors.get(relationship.target_column) ?? {
    leftX: targetCard.x,
    rightX: targetCard.x + targetCard.width,
    y: targetCard.y + targetCard.height / 2,
  };
  const leftToRight = sourceCard.x <= targetCard.x;
  const startX = leftToRight ? sourceAnchor.rightX : sourceAnchor.leftX;
  const endX = leftToRight ? targetAnchor.leftX : targetAnchor.rightX;
  const startY = sourceAnchor.y;
  const endY = targetAnchor.y;
  const curve = Math.max(56, Math.abs(endX - startX) * 0.34);
  const controlOneX = startX + (leftToRight ? curve : -curve);
  const controlTwoX = endX - (leftToRight ? curve : -curve);
  const labelX = (startX + endX) / 2;
  const labelY = (startY + endY) / 2;

  return {
    endX,
    endY,
    labelX,
    labelY,
    leftToRight,
    path: `M ${startX} ${startY} C ${controlOneX} ${startY}, ${controlTwoX} ${endY}, ${endX} ${endY}`,
    startX,
    startY,
  };
}

function getSelectedTable(
  payload: SimpleTableSchemaGraphResponse | undefined,
  selectedTableId: number | null,
) {
  if (!payload || !payload.tables.length) {
    return null;
  }

  return (
    payload.tables.find((table) => table.id === selectedTableId) ??
    payload.tables.find((table) => table.id === payload.root_table_id) ??
    payload.tables[0]
  );
}

function formatNullable(nullable: boolean) {
  return nullable ? "nullable" : "required";
}

export function MainSequenceSimpleTableUmlExplorer({
  error,
  isLoading,
  payload,
}: MainSequenceSimpleTableUmlExplorerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTokens } = useTheme();
  const layout = useMemo(() => buildSimpleTableUmlLayout(payload), [payload]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [pointerPan, setPointerPan] = useState<PointerPanState | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(payload?.root_table_id ?? null);
  const fittedLayoutKeyRef = useRef<string | null>(null);
  const layoutKey = useMemo(() => {
    if (!payload) {
      return "empty";
    }

    return `${payload.root_table_id}:${payload.tables.map((table) => table.id).join("|")}:${payload.relationships.map((relationship) => relationship.id).join("|")}`;
  }, [payload]);

  const selectedTable = useMemo(
    () => getSelectedTable(payload, selectedTableId),
    [payload, selectedTableId],
  );

  useEffect(() => {
    const viewportElement = viewportRef.current;

    if (!viewportElement || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(viewportElement);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSelectedTableId((currentValue) => {
      if (payload?.tables.some((table) => table.id === currentValue)) {
        return currentValue;
      }

      return payload?.root_table_id ?? payload?.tables[0]?.id ?? null;
    });
    fittedLayoutKeyRef.current = null;
  }, [payload, layoutKey]);

  useEffect(() => {
    if (!layout || viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    if (fittedLayoutKeyRef.current === layoutKey) {
      return;
    }

    const nextTransform = getFitTransform(layout.bounds, viewport);
    setZoom(nextTransform.zoom);
    setPanX(nextTransform.panX);
    setPanY(nextTransform.panY);
    fittedLayoutKeyRef.current = layoutKey;
  }, [layout, layoutKey, viewport]);

  useEffect(() => {
    if (!pointerPan) {
      return undefined;
    }

    const activePan = pointerPan;

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activePan.pointerId) {
        return;
      }

      setPanX(activePan.originPanX + event.clientX - activePan.startClientX);
      setPanY(activePan.originPanY + event.clientY - activePan.startClientY);
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerId === activePan.pointerId) {
        setPointerPan(null);
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [pointerPan]);

  function fitView() {
    if (!layout || viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    const nextTransform = getFitTransform(layout.bounds, viewport);
    setZoom(nextTransform.zoom);
    setPanX(nextTransform.panX);
    setPanY(nextTransform.panY);
  }

  function updateZoom(nextZoom: number) {
    const clampedZoom = clamp(nextZoom, umlGraphConfig.minZoom, umlGraphConfig.maxZoom);
    const centerWorldX = (viewport.width / 2 - panX) / zoom;
    const centerWorldY = (viewport.height / 2 - panY) / zoom;
    setZoom(clampedZoom);
    setPanX(viewport.width / 2 - centerWorldX * clampedZoom);
    setPanY(viewport.height / 2 - centerWorldY * clampedZoom);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!layout) {
      return;
    }

    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const nextZoom = clamp(
      zoom * (event.deltaY > 0 ? 0.92 : 1.08),
      umlGraphConfig.minZoom,
      umlGraphConfig.maxZoom,
    );
    const worldX = (cursorX - panX) / zoom;
    const worldY = (cursorY - panY) / zoom;

    setZoom(nextZoom);
    setPanX(cursorX - worldX * nextZoom);
    setPanY(cursorY - worldY * nextZoom);
  }

  function handleViewportPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest("[data-uml-card]") || target.closest("[data-uml-overlay]")) {
      return;
    }

    setPointerPan({
      pointerId: event.pointerId,
      originPanX: panX,
      originPanY: panY,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
  }

  const tablesById = useMemo(() => {
    const map = new Map<number, SimpleTableSchemaGraphTableRecord>();
    payload?.tables.forEach((table) => {
      map.set(table.id, table);
    });
    return map;
  }, [payload]);

  const selectedOutgoingRelationships = useMemo(
    () =>
      payload?.relationships.filter((relationship) => relationship.source_table_id === selectedTable?.id) ?? [],
    [payload, selectedTable?.id],
  );
  const selectedIncomingRelationships = useMemo(
    () =>
      payload?.relationships.filter((relationship) => relationship.target_table_id === selectedTable?.id) ?? [],
    [payload, selectedTable?.id],
  );

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">Root table</Badge>
          <Badge variant="neutral">Columns + indexes</Badge>
          <Badge variant="neutral">FK multiplicities</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => updateZoom(zoom / 1.12)}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-[4.5rem] text-center text-xs font-medium text-muted-foreground">
            {Math.round(zoom * 100)}%
          </div>
          <Button variant="outline" size="sm" onClick={() => updateZoom(zoom * 1.12)}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={fitView}>
            <RefreshCw className="h-3.5 w-3.5" />
            Fit
          </Button>
        </div>
      </div>

      <div
        ref={viewportRef}
        onPointerDown={handleViewportPointerDown}
        onWheel={handleWheel}
        className="relative min-h-[700px] overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 xl:min-h-[760px]"
        style={{
          backgroundImage: `linear-gradient(${withAlpha(
            resolvedTokens["chart-grid"],
            0.18,
          )} 1px, transparent 1px), linear-gradient(90deg, ${withAlpha(
            resolvedTokens["chart-grid"],
            0.18,
          )} 1px, transparent 1px), radial-gradient(circle at top left, ${withAlpha(
            resolvedTokens.primary,
            0.1,
          )} 0%, transparent 42%), radial-gradient(circle at bottom right, ${withAlpha(
            resolvedTokens.accent,
            0.1,
          )} 0%, transparent 42%)`,
          backgroundPosition: "0 0, 0 0, 0 0, 100% 100%",
          backgroundSize: "34px 34px, 34px 34px, auto, auto",
          cursor: pointerPan ? "grabbing" : "grab",
        }}
      >
        {isLoading ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/30 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading schema graph
            </div>
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="absolute inset-4 z-20 rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {!isLoading && !error && payload && payload.tables.length === 0 ? (
          <div className="absolute inset-4 z-20 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
            No schema graph data is available for this simple table.
          </div>
        ) : null}

        {layout && !isLoading && !error && layout.cards.length > 0 ? (
          <>
            <div
              className="absolute top-0 left-0"
              style={{
                width: layout.bounds.width,
                height: layout.bounds.height,
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              <svg
                className="absolute inset-0 overflow-visible"
                width={layout.bounds.width}
                height={layout.bounds.height}
                viewBox={`0 0 ${layout.bounds.width} ${layout.bounds.height}`}
              >
                {layout.relationships.map((relationship) => {
                  const geometry = buildRelationshipPath(relationship, layout.cardsById);

                  if (!geometry) {
                    return null;
                  }

                  const label = `${relationship.source_column} -> ${relationship.target_column}`;
                  const labelWidth = Math.max(112, label.length * 6.6);
                  const isRootRelationship =
                    relationship.source_table_id === payload?.root_table_id ||
                    relationship.target_table_id === payload?.root_table_id;
                  const strokeColor = isRootRelationship
                    ? resolvedTokens.primary
                    : resolvedTokens.accent;

                  return (
                    <g key={relationship.id}>
                      <path
                        d={geometry.path}
                        fill="none"
                        stroke={alphaColor(strokeColor, 0.14)}
                        strokeLinecap="round"
                        strokeWidth={10}
                      />
                      <path
                        d={geometry.path}
                        fill="none"
                        stroke={alphaColor(strokeColor, 0.74)}
                        strokeLinecap="round"
                        strokeWidth={2.25}
                        strokeDasharray={relationship.on_delete?.toLowerCase() === "cascade" ? undefined : "7 5"}
                      />

                      <rect
                        x={geometry.labelX - labelWidth / 2}
                        y={geometry.labelY - 13}
                        width={labelWidth}
                        height={26}
                        rx={13}
                        fill={withAlpha(resolvedTokens.card, 0.96)}
                        stroke={withAlpha(resolvedTokens.border, 0.82)}
                      />
                      <text
                        x={geometry.labelX}
                        y={geometry.labelY + 4}
                        fill={resolvedTokens.foreground}
                        fontSize="11"
                        fontFamily="var(--font-family-mono, ui-monospace, monospace)"
                        textAnchor="middle"
                      >
                        {label}
                      </text>

                      {relationship.source_to_target_multiplicity ? (
                        <text
                          x={geometry.startX + (geometry.leftToRight ? 12 : -12)}
                          y={geometry.startY - 10}
                          fill={resolvedTokens["muted-foreground"]}
                          fontSize="11"
                          fontWeight="600"
                          textAnchor={geometry.leftToRight ? "start" : "end"}
                        >
                          {relationship.source_to_target_multiplicity}
                        </text>
                      ) : null}
                      {relationship.target_to_source_multiplicity ? (
                        <text
                          x={geometry.endX + (geometry.leftToRight ? -12 : 12)}
                          y={geometry.endY - 10}
                          fill={resolvedTokens["muted-foreground"]}
                          fontSize="11"
                          fontWeight="600"
                          textAnchor={geometry.leftToRight ? "end" : "start"}
                        >
                          {relationship.target_to_source_multiplicity}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </svg>

              {layout.cards.map((table) => {
                const isRootTable = table.id === payload?.root_table_id;
                const isSelected = selectedTable?.id === table.id;

                return (
                  <button
                    key={table.id}
                    type="button"
                    data-uml-card
                    onClick={() => setSelectedTableId(table.id)}
                    className="absolute text-left"
                    style={{
                      left: table.x,
                      top: table.y,
                      width: table.width,
                      height: table.height,
                    }}
                  >
                    <div
                      className="flex h-full w-full flex-col overflow-hidden rounded-[20px] border backdrop-blur transition-transform duration-150 hover:-translate-y-1"
                      style={{
                        borderColor: isSelected
                          ? alphaColor(resolvedTokens.primary, 0.82)
                          : isRootTable
                            ? alphaColor(resolvedTokens.primary, 0.48)
                            : alphaColor(resolvedTokens.border, 0.78),
                        background: isRootTable
                          ? `linear-gradient(165deg, ${alphaColor(
                              resolvedTokens.primary,
                              0.18,
                            )} 0%, ${alphaColor(resolvedTokens.card, 0.96)} 54%, ${alphaColor(
                              resolvedTokens.background,
                              0.96,
                            )} 100%)`
                          : `linear-gradient(165deg, ${alphaColor(
                              resolvedTokens.secondary,
                              0.12,
                            )} 0%, ${alphaColor(resolvedTokens.card, 0.96)} 52%, ${alphaColor(
                              resolvedTokens.background,
                              0.98,
                            )} 100%)`,
                        boxShadow: isSelected
                          ? `0 24px 52px ${alphaColor(resolvedTokens.primary, 0.18)}`
                          : isRootTable
                            ? `0 18px 42px ${alphaColor(resolvedTokens.primary, 0.14)}`
                            : `0 18px 38px ${alphaColor(resolvedTokens.background, 0.2)}`,
                      }}
                    >
                      <div
                        className="border-b px-4 py-3"
                        style={{
                          borderColor: withAlpha(resolvedTokens.border, 0.7),
                          background: `linear-gradient(90deg, ${alphaColor(
                            isRootTable ? resolvedTokens.primary : resolvedTokens.accent,
                            isRootTable ? 0.16 : 0.08,
                          )} 0%, ${alphaColor(resolvedTokens.background, 0)} 100%)`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-card-foreground">
                              {table.identifier || `Table ${table.id}`}
                            </div>
                            <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                              {table.storage_hash}
                            </div>
                          </div>
                          <Badge variant={isRootTable ? "primary" : "neutral"}>
                            {isRootTable ? "Root" : `${table.columns.length} cols`}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full border border-border/70 bg-background/55 px-2.5 py-1">
                            {table.source_class_name?.trim() || "No updater"}
                          </span>
                          <span className="rounded-full border border-border/70 bg-background/55 px-2.5 py-1">
                            DS {table.data_source_id ?? "?"}
                          </span>
                        </div>
                      </div>

                      <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
                        <div className="space-y-2">
                          {table.columns.map((column) => (
                            <div
                              key={`${table.id}-${column.column_name}`}
                              className="rounded-[14px] border px-3 py-2"
                              style={{
                                borderColor: column.is_primary_key
                                  ? alphaColor(resolvedTokens.primary, 0.42)
                                  : alphaColor(resolvedTokens.border, 0.56),
                                background: column.is_primary_key
                                  ? `linear-gradient(90deg, ${alphaColor(
                                      resolvedTokens.primary,
                                      0.14,
                                    )} 0%, ${alphaColor(resolvedTokens.background, 0.42)} 100%)`
                                  : column.is_unique
                                    ? `linear-gradient(90deg, ${alphaColor(
                                        resolvedTokens.accent,
                                        0.1,
                                      )} 0%, ${alphaColor(resolvedTokens.background, 0.38)} 100%)`
                                    : alphaColor(resolvedTokens.background, 0.36),
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate font-mono text-[12px] font-semibold text-foreground">
                                    {column.column_name}
                                  </div>
                                  {column.attr_name !== column.column_name ? (
                                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                      {column.attr_name}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                                  <span className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    {column.db_type}
                                  </span>
                                  {column.is_primary_key ? (
                                    <span className="rounded-full border border-primary/35 bg-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                                      PK
                                    </span>
                                  ) : null}
                                  {column.is_unique ? (
                                    <span className="rounded-full border border-accent/35 bg-accent/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                                      UQ
                                    </span>
                                  ) : null}
                                  <span className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    {column.nullable ? "NULL" : "NOT NULL"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {table.indexes.length ? (
                          <div className="mt-4 border-t border-border/60 pt-3">
                            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              <ArrowRightLeft className="h-3 w-3" />
                              Indexes
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {table.indexes.map((index) => (
                                <div
                                  key={`${table.id}-index-${index.id}`}
                                  className="rounded-full border border-border/70 bg-background/52 px-3 py-1.5 text-[11px] text-foreground"
                                >
                                  <span className="font-medium">{index.name}</span>
                                  {index.columns.length ? (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · {index.columns.join(", ")}
                                    </span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedTable ? (
              <div
                data-uml-overlay
                className="absolute top-4 right-4 bottom-4 z-20 flex w-[min(380px,calc(100%-2rem))] flex-col overflow-hidden rounded-[calc(var(--radius)-2px)] border border-border/80 bg-card/96 shadow-[var(--shadow-panel)] backdrop-blur"
              >
                <div className="border-b border-border/70 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-card-foreground">
                        {selectedTable.identifier || `Table ${selectedTable.id}`}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {selectedTable.storage_hash}
                      </div>
                    </div>
                    {selectedTable.id === payload?.root_table_id ? (
                      <Badge variant="primary">Root</Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="neutral">{selectedTable.columns.length} columns</Badge>
                    <Badge variant="neutral">{selectedTable.indexes.length} indexes</Badge>
                    <Badge variant="neutral">
                      {selectedOutgoingRelationships.length + selectedIncomingRelationships.length} relations
                    </Badge>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/45 px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Source Class
                        </div>
                        <div className="mt-1 text-sm text-foreground">
                          {selectedTable.source_class_name?.trim() || "Not set"}
                        </div>
                      </div>
                      <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/45 px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Data Source
                        </div>
                        <div className="mt-1 text-sm text-foreground">
                          {selectedTable.data_source_id ?? "Not set"}
                        </div>
                      </div>
                    </div>

                    <section className="space-y-3">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        <KeyRound className="h-3.5 w-3.5" />
                        Columns
                      </div>
                      <div className="space-y-2">
                        {selectedTable.columns.map((column) => (
                          <div
                            key={`${selectedTable.id}-drawer-${column.column_name}`}
                            className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/45 px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-mono text-sm font-semibold text-foreground">
                                  {column.column_name}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {column.attr_name} · {column.db_type} · {formatNullable(column.nullable)}
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                                {column.is_primary_key ? <Badge variant="primary">PK</Badge> : null}
                                {column.is_unique ? <Badge variant="neutral">Unique</Badge> : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="space-y-3">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Relationships
                      </div>
                      <div className="space-y-2">
                        {selectedOutgoingRelationships.map((relationship) => {
                          const targetTable = tablesById.get(relationship.target_table_id);
                          return (
                            <div
                              key={`outgoing-${relationship.id}`}
                              className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/45 px-3 py-3"
                            >
                              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                Outgoing
                              </div>
                              <div className="mt-1 text-sm text-foreground">
                                {relationship.source_column}
                                {" -> "}
                                {targetTable?.identifier || `Table ${relationship.target_table_id}`}.
                                {relationship.target_column}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {relationship.source_to_target_multiplicity || "?"} /{" "}
                                {relationship.target_to_source_multiplicity || "?"} · on delete{" "}
                                {relationship.on_delete || "not set"}
                              </div>
                            </div>
                          );
                        })}
                        {selectedIncomingRelationships.map((relationship) => {
                          const sourceTable = tablesById.get(relationship.source_table_id);
                          return (
                            <div
                              key={`incoming-${relationship.id}`}
                              className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/45 px-3 py-3"
                            >
                              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                Incoming
                              </div>
                              <div className="mt-1 text-sm text-foreground">
                                {sourceTable?.identifier || `Table ${relationship.source_table_id}`}.
                                {relationship.source_column}
                                {" -> "}
                                {relationship.target_column}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {relationship.source_to_target_multiplicity || "?"} /{" "}
                                {relationship.target_to_source_multiplicity || "?"} · on delete{" "}
                                {relationship.on_delete || "not set"}
                              </div>
                            </div>
                          );
                        })}
                        {selectedOutgoingRelationships.length === 0 && selectedIncomingRelationships.length === 0 ? (
                          <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
                            This table has no relationships in the current graph depth.
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {!isLoading && !error ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="neutral">
            {payload?.tables.length ?? 0} table{payload?.tables.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="neutral">
            {payload?.relationships.length ?? 0} relationship
            {(payload?.relationships.length ?? 0) === 1 ? "" : "s"}
          </Badge>
          <span className="inline-flex items-center gap-1.5">
            <Move className="h-3.5 w-3.5" />
            Drag canvas to pan
          </span>
          <span>•</span>
          <span>Scroll to zoom</span>
          <span>•</span>
          <span>Click a table to inspect columns and foreign keys</span>
        </div>
      ) : null}
    </div>
  );
}
