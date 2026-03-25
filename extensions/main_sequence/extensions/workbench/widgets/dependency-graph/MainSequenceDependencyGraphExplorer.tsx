import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import type { TFunction } from "i18next";
import { ArrowUpRight, Database, Loader2, Network, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/themes/ThemeProvider";
import { withAlpha } from "@/lib/color";

import type { LocalTimeSerieDependencyGraphResponse } from "../../../../common/api";
import type {
  DependencyGraphLayoutEdge,
  DependencyGraphLayoutNode,
  MainSequenceDependencyGraphDirection,
} from "./graphLayout";
import {
  buildDependencyGraphLayout,
  clamp,
  dependencyGraphConfig,
  getFitTransform,
  getHighlightedPathEdgeIds,
} from "./graphLayout";

interface MainSequenceDependencyGraphExplorerProps {
  direction: MainSequenceDependencyGraphDirection;
  error: string | null;
  isLoading: boolean;
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  payload: LocalTimeSerieDependencyGraphResponse | undefined;
  runtimeState?: MainSequenceDependencyGraphRuntimeState;
  variant?: "card" | "widget";
}

export interface MainSequenceDependencyGraphRuntimeState extends Record<string, unknown> {
  minimapVisible?: boolean;
  panX?: number;
  panY?: number;
  selectedNodeId?: string | null;
  zoom?: number;
}

interface PointerPanState {
  pointerId: number;
  originPanX: number;
  originPanY: number;
  startClientX: number;
  startClientY: number;
}

interface MinimapDragState {
  pointerId: number;
  offsetX: number;
  offsetY: number;
}

const dependencyGraphPropertyLabelKeyMap: Record<string, string> = {
  data_node_update_id: "dataNodeUpdateId",
  human_readable: "humanReadable",
  node_type: "nodeType",
  update_hash: "updateHash",
  local_time_serie_id: "localTimeSerieId",
  remote_table_type: "remoteTableType",
  remote_table_hash_id: "remoteTableHashId",
  remote_table_id: "remoteTableId",
  data_source_id: "dataSourceId",
  is_api: "isApi",
  error_on_last_update: "errorOnLastUpdate",
  last_update: "lastUpdate",
  next_update: "nextUpdate",
  simple_table_update_id: "simpleTableUpdateId",
};

function getDirectionLabel(direction: MainSequenceDependencyGraphDirection, t: TFunction) {
  return direction === "downstream"
    ? t("mainSequenceDependencyGraph.directionDownstream")
    : t("mainSequenceDependencyGraph.directionUpstream");
}

function alphaColor(color: string, alpha: number) {
  return color.startsWith("#") ? withAlpha(color, alpha) : color;
}

function getVisibleWorldRect(
  viewport: { width: number; height: number },
  panX: number,
  panY: number,
  zoom: number,
) {
  if (zoom <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  return {
    x: -panX / zoom,
    y: -panY / zoom,
    width: viewport.width / zoom,
    height: viewport.height / zoom,
  };
}

function buildEdgePath(
  edge: DependencyGraphLayoutEdge,
  nodesById: Map<string, DependencyGraphLayoutNode>,
) {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);

  if (!source || !target) {
    return "";
  }

  const sameDepth = source.depth === target.depth;

  if (sameDepth) {
    const fromX = source.x + source.width;
    const fromY = source.y + source.height / 2;
    const toX = target.x;
    const toY = target.y + target.height / 2;
    const curve = Math.max(42, Math.abs(toX - fromX) * 0.35);

    return `M ${fromX} ${fromY} C ${fromX + curve} ${fromY}, ${toX - curve} ${toY}, ${toX} ${toY}`;
  }

  const downward = source.y <= target.y;
  const fromX = source.x + source.width / 2;
  const fromY = downward ? source.y + source.height : source.y;
  const toX = target.x + target.width / 2;
  const toY = downward ? target.y : target.y + target.height;
  const curve = Math.max(56, Math.abs(toY - fromY) * 0.38);

  return `M ${fromX} ${fromY} C ${fromX} ${fromY + (downward ? curve : -curve)}, ${toX} ${toY - (downward ? curve : -curve)}, ${toX} ${toY}`;
}

function formatPropertyLabel(key: string, t: TFunction) {
  const translationKey = dependencyGraphPropertyLabelKeyMap[key];

  if (translationKey) {
    return t(`mainSequenceDependencyGraph.properties.${translationKey}`);
  }

  return key.replace(/_/g, " ").replace(/^\w/, (value) => value.toUpperCase());
}

function formatPropertyValue(key: string, value: unknown, t: TFunction) {
  if (value === null || value === undefined || value === "") {
    return t("mainSequenceDependencyGraph.values.notSet");
  }

  if (key === "last_update" || key === "next_update") {
    const parsed = Date.parse(String(value));

    if (Number.isFinite(parsed)) {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(parsed));
    }
  }

  if (typeof value === "boolean") {
    return value
      ? t("mainSequenceDependencyGraph.values.booleanTrue")
      : t("mainSequenceDependencyGraph.values.booleanFalse");
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getPropertyEntries(node: DependencyGraphLayoutNode | null, t: TFunction) {
  if (!node?.properties) {
    return [];
  }

  const preferredKeys = [
    "node_type",
    "remote_table_type",
    "human_readable",
    "update_hash",
    "data_node_update_id",
    "simple_table_update_id",
    "local_time_serie_id",
    "remote_table_hash_id",
    "remote_table_id",
    "data_source_id",
    "is_api",
    "error_on_last_update",
    "last_update",
    "next_update",
  ];
  const propertyKeys = Object.keys(node.properties);
  const orderedKeys = [
    ...preferredKeys.filter((key) => key in node.properties!),
    ...propertyKeys.filter((key) => !preferredKeys.includes(key)),
  ];

  return orderedKeys.map((key) => ({
    key,
    label: formatPropertyLabel(key, t),
    value: formatPropertyValue(key, node.properties?.[key], t),
    monospace: key.includes("hash") || key.endsWith("_id"),
  }));
}

function getBadgeVariant(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("error") || normalized.includes("fail")) {
    return "danger" as const;
  }

  if (normalized.includes("warn")) {
    return "warning" as const;
  }

  if (normalized.includes("ok") || normalized.includes("ready") || normalized.includes("active")) {
    return "success" as const;
  }

  return "neutral" as const;
}

function getNumericPropertyValue(value: unknown) {
  const parsedValue = Number(value ?? "");

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function getRemoteTableType(node: DependencyGraphLayoutNode | null) {
  if (!node) {
    return null;
  }

  if (typeof node.remote_table_type === "string" && node.remote_table_type.trim()) {
    return node.remote_table_type.trim();
  }

  const propertyValue = node.properties?.remote_table_type;

  return typeof propertyValue === "string" && propertyValue.trim() ? propertyValue.trim() : null;
}

function getNodeType(node: DependencyGraphLayoutNode | null) {
  if (!node) {
    return null;
  }

  if (typeof node.node_type === "string" && node.node_type.trim()) {
    return node.node_type.trim();
  }

  const propertyValue = node.properties?.node_type;

  return typeof propertyValue === "string" && propertyValue.trim() ? propertyValue.trim() : null;
}

function buildDataNodeUrl(node: DependencyGraphLayoutNode | null) {
  const remoteTableType = getRemoteTableType(node);
  const nodeType = getNodeType(node);

  if (remoteTableType && remoteTableType !== "dynamic_table_metadata") {
    return null;
  }

  if (
    nodeType === "simple_table_update" ||
    getNumericPropertyValue(node?.properties?.simple_table_update_id) !== null
  ) {
    return null;
  }

  const remoteTableId = getNumericPropertyValue(node?.properties?.remote_table_id);

  if (remoteTableId === null) {
    return null;
  }

  return `/app/main_sequence_workbench/data-nodes?msDataNodeId=${remoteTableId}&msDataNodeTab=details`;
}

function buildSimpleTableUrl(node: DependencyGraphLayoutNode | null) {
  const remoteTableType = getRemoteTableType(node);
  const nodeType = getNodeType(node);

  if (remoteTableType && remoteTableType !== "simple_table") {
    return null;
  }

  if (
    nodeType === "data_node_update" ||
    getNumericPropertyValue(node?.properties?.data_node_update_id) !== null ||
    getNumericPropertyValue(node?.properties?.local_time_serie_id) !== null
  ) {
    return null;
  }

  const remoteTableId = getNumericPropertyValue(node?.properties?.remote_table_id);

  if (remoteTableId === null) {
    return null;
  }

  return `/app/main_sequence_workbench/simple-tables?msSimpleTableId=${remoteTableId}&msSimpleTableTab=details`;
}

function buildDataNodeUpdateUrl(node: DependencyGraphLayoutNode | null) {
  if (getNodeType(node) === "simple_table_update") {
    return null;
  }

  const localUpdateId =
    getNumericPropertyValue(node?.properties?.data_node_update_id) ??
    getNumericPropertyValue(node?.properties?.local_time_serie_id);

  if (localUpdateId === null) {
    return null;
  }

  const remoteTableId = getNumericPropertyValue(node?.properties?.remote_table_id);
  const search = new URLSearchParams();

  if (remoteTableId !== null) {
    search.set("msDataNodeId", String(remoteTableId));
  }

  search.set("msDataNodeTab", "local-time-series");
  search.set("msLocalUpdateId", String(localUpdateId));
  search.set("msLocalUpdateTab", "graphs");

  return `/app/main_sequence_workbench/data-nodes?${search.toString()}`;
}

function buildSimpleTableUpdateUrl(node: DependencyGraphLayoutNode | null) {
  if (getNodeType(node) === "data_node_update") {
    return null;
  }

  const simpleTableUpdateId = getNumericPropertyValue(node?.properties?.simple_table_update_id);

  if (simpleTableUpdateId === null) {
    return null;
  }

  const remoteTableId = getNumericPropertyValue(node?.properties?.remote_table_id);
  const search = new URLSearchParams();

  if (remoteTableId !== null) {
    search.set("msSimpleTableId", String(remoteTableId));
  }

  search.set("msSimpleTableTab", "local-update");
  search.set("msSimpleTableUpdateId", String(simpleTableUpdateId));
  search.set("msSimpleTableUpdateTab", "graphs");

  return `/app/main_sequence_workbench/simple-tables?${search.toString()}`;
}

function getNodeIcon(node: DependencyGraphLayoutNode) {
  if (node.node_type === "simple_table_update") {
    return <Table2 className="h-3.5 w-3.5" />;
  }

  if (node.node_type === "data_node_update") {
    return <Database className="h-3.5 w-3.5" />;
  }

  if (node.icon) {
    return <span>{node.icon}</span>;
  }

  return null;
}

function sanitizeDependencyGraphRuntimeState(
  runtimeState: MainSequenceDependencyGraphRuntimeState | undefined,
) {
  if (!runtimeState) {
    return null;
  }

  return {
    zoom:
      typeof runtimeState.zoom === "number" && Number.isFinite(runtimeState.zoom)
        ? clamp(
            runtimeState.zoom,
            dependencyGraphConfig.minZoom,
            dependencyGraphConfig.maxZoom,
          )
        : 1,
    panX:
      typeof runtimeState.panX === "number" && Number.isFinite(runtimeState.panX)
        ? runtimeState.panX
        : 0,
    panY:
      typeof runtimeState.panY === "number" && Number.isFinite(runtimeState.panY)
        ? runtimeState.panY
        : 0,
    selectedNodeId:
      typeof runtimeState.selectedNodeId === "string"
        ? runtimeState.selectedNodeId
        : null,
    minimapVisible: runtimeState.minimapVisible === true,
  };
}

export function MainSequenceDependencyGraphExplorer({
  direction,
  error,
  isLoading,
  onRuntimeStateChange,
  payload,
  runtimeState,
  variant = "card",
}: MainSequenceDependencyGraphExplorerProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const hydratedRuntimeState = useMemo(
    () => sanitizeDependencyGraphRuntimeState(runtimeState),
    [runtimeState],
  );
  const hydratedRuntimeStateKey = useMemo(
    () => JSON.stringify(hydratedRuntimeState ?? null),
    [hydratedRuntimeState],
  );
  const lastHydratedStateKeyRef = useRef<string | null>(hydratedRuntimeStateKey);
  const lastReportedStateKeyRef = useRef<string | null>(null);
  const runtimeStateEnabledRef = useRef(Boolean(hydratedRuntimeState));
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(() => hydratedRuntimeState?.zoom ?? 1);
  const [panX, setPanX] = useState(() => hydratedRuntimeState?.panX ?? 0);
  const [panY, setPanY] = useState(() => hydratedRuntimeState?.panY ?? 0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => hydratedRuntimeState?.selectedNodeId ?? null,
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [minimapVisible, setMinimapVisible] = useState(
    () => hydratedRuntimeState?.minimapVisible ?? false,
  );
  const [pointerPan, setPointerPan] = useState<PointerPanState | null>(null);
  const [minimapDrag, setMinimapDrag] = useState<MinimapDragState | null>(null);
  const fittedLayoutKeyRef = useRef<string | null>(null);
  const { resolvedTokens } = useTheme();

  const layout = useMemo(
    () => buildDependencyGraphLayout(payload, direction),
    [direction, payload],
  );
  const layoutKey = useMemo(() => {
    if (!payload) {
      return `${direction}:empty`;
    }

    return `${direction}:${payload.nodes.map((node) => String(node.id)).join("|")}:${payload.edges.length}`;
  }, [direction, payload]);

  const selectedNode = layout?.nodesById.get(selectedNodeId ?? "") ?? null;
  const hoveredNode = layout?.nodesById.get(hoveredNodeId ?? "") ?? null;
  const highlightedEdgeIds = useMemo(
    () => getHighlightedPathEdgeIds(selectedNodeId, layout?.edges ?? []),
    [layout?.edges, selectedNodeId],
  );
  const propertyEntries = useMemo(
    () => getPropertyEntries(selectedNode, t),
    [selectedNode, t],
  );
  const visibleWorldRect = useMemo(
    () => getVisibleWorldRect(viewport, panX, panY, zoom),
    [panX, panY, viewport, zoom],
  );
  const persistentRuntimeState = useMemo<MainSequenceDependencyGraphRuntimeState>(
    () => ({
      zoom: Number(zoom.toFixed(4)),
      panX: Number(panX.toFixed(2)),
      panY: Number(panY.toFixed(2)),
      selectedNodeId,
      minimapVisible,
    }),
    [minimapVisible, panX, panY, selectedNodeId, zoom],
  );
  const persistentRuntimeStateKey = useMemo(
    () => JSON.stringify(persistentRuntimeState),
    [persistentRuntimeState],
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

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    fittedLayoutKeyRef.current = null;
  }, [layoutKey]);

  useEffect(() => {
    if (hydratedRuntimeStateKey === lastReportedStateKeyRef.current) {
      lastHydratedStateKeyRef.current = hydratedRuntimeStateKey;
      return;
    }

    if (hydratedRuntimeStateKey === lastHydratedStateKeyRef.current) {
      return;
    }

    lastHydratedStateKeyRef.current = hydratedRuntimeStateKey;
    runtimeStateEnabledRef.current = Boolean(hydratedRuntimeState);
    setHoveredNodeId(null);
    setSelectedNodeId(hydratedRuntimeState?.selectedNodeId ?? null);
    setMinimapVisible(hydratedRuntimeState?.minimapVisible ?? false);

    if (hydratedRuntimeState) {
      setZoom(hydratedRuntimeState.zoom);
      setPanX(hydratedRuntimeState.panX);
      setPanY(hydratedRuntimeState.panY);
      fittedLayoutKeyRef.current = layoutKey;
      return;
    }

    fittedLayoutKeyRef.current = null;
  }, [hydratedRuntimeState, hydratedRuntimeStateKey, layoutKey]);

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
    if (!onRuntimeStateChange || !runtimeStateEnabledRef.current) {
      return undefined;
    }

    if (persistentRuntimeStateKey === lastHydratedStateKeyRef.current) {
      lastReportedStateKeyRef.current = persistentRuntimeStateKey;
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      lastReportedStateKeyRef.current = persistentRuntimeStateKey;
      lastHydratedStateKeyRef.current = persistentRuntimeStateKey;
      onRuntimeStateChange(persistentRuntimeState);
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onRuntimeStateChange, persistentRuntimeState, persistentRuntimeStateKey]);

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

  const minimapTransform = useMemo(() => {
    if (!layout) {
      return null;
    }

    const scale = Math.min(
      (dependencyGraphConfig.minimap.width - dependencyGraphConfig.minimap.padding * 2) /
        Math.max(layout.bounds.width, 1),
      (dependencyGraphConfig.minimap.height - dependencyGraphConfig.minimap.padding * 2) /
        Math.max(layout.bounds.height, 1),
    );

    return {
      scale,
      offsetX:
        dependencyGraphConfig.minimap.padding -
        layout.bounds.x * scale +
        (dependencyGraphConfig.minimap.width - layout.bounds.width * scale - dependencyGraphConfig.minimap.padding * 2) / 2,
      offsetY:
        dependencyGraphConfig.minimap.padding -
        layout.bounds.y * scale +
        (dependencyGraphConfig.minimap.height - layout.bounds.height * scale - dependencyGraphConfig.minimap.padding * 2) / 2,
    };
  }, [layout]);

  const minimapViewport = useMemo(() => {
    if (!minimapTransform) {
      return null;
    }

    return {
      x: minimapTransform.offsetX + visibleWorldRect.x * minimapTransform.scale,
      y: minimapTransform.offsetY + visibleWorldRect.y * minimapTransform.scale,
      width: visibleWorldRect.width * minimapTransform.scale,
      height: visibleWorldRect.height * minimapTransform.scale,
    };
  }, [minimapTransform, visibleWorldRect]);

  useEffect(() => {
    if (!minimapDrag || !minimapTransform || zoom <= 0) {
      return undefined;
    }

    const activeDrag = minimapDrag;
    const activeTransform = minimapTransform;

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activeDrag.pointerId || !viewportRef.current) {
        return;
      }

      const rect = viewportRef.current.getBoundingClientRect();
      const minimapLeft =
        rect.right - dependencyGraphConfig.minimap.width - 16;
      const minimapTop =
        rect.bottom - dependencyGraphConfig.minimap.height - 16;
      const nextCenterX =
        event.clientX - minimapLeft - activeDrag.offsetX;
      const nextCenterY =
        event.clientY - minimapTop - activeDrag.offsetY;
      const worldX = (nextCenterX - activeTransform.offsetX) / activeTransform.scale;
      const worldY = (nextCenterY - activeTransform.offsetY) / activeTransform.scale;

      setPanX(viewport.width / 2 - worldX * zoom);
      setPanY(viewport.height / 2 - worldY * zoom);
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerId === activeDrag.pointerId) {
        setMinimapDrag(null);
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
  }, [minimapDrag, minimapTransform, viewport.height, viewport.width, zoom]);

  function handleFit() {
    if (!layout || viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    runtimeStateEnabledRef.current = true;
    const nextTransform = getFitTransform(layout.bounds, viewport);
    setZoom(nextTransform.zoom);
    setPanX(nextTransform.panX);
    setPanY(nextTransform.panY);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (isLoading || error || !layout || viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    event.preventDefault();
    runtimeStateEnabledRef.current = true;

    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - panX) / zoom;
    const worldY = (cursorY - panY) / zoom;
    const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92;
    const nextZoom = clamp(
      zoom * zoomFactor,
      dependencyGraphConfig.minZoom,
      dependencyGraphConfig.maxZoom,
    );

    setZoom(nextZoom);
    setPanX(cursorX - worldX * nextZoom);
    setPanY(cursorY - worldY * nextZoom);
  }

  function handleViewportPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest("[data-graph-node]") || target.closest("[data-graph-overlay]")) {
      return;
    }

    runtimeStateEnabledRef.current = true;
    setPointerPan({
      pointerId: event.pointerId,
      originPanX: panX,
      originPanY: panY,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
  }

  function handleMinimapPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!minimapTransform || !minimapViewport) {
      return;
    }

    runtimeStateEnabledRef.current = true;
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    const insideViewport =
      relativeX >= minimapViewport.x &&
      relativeX <= minimapViewport.x + minimapViewport.width &&
      relativeY >= minimapViewport.y &&
      relativeY <= minimapViewport.y + minimapViewport.height;

    if (insideViewport) {
      setMinimapDrag({
        pointerId: event.pointerId,
        offsetX: relativeX - (minimapViewport.x + minimapViewport.width / 2),
        offsetY: relativeY - (minimapViewport.y + minimapViewport.height / 2),
      });
      return;
    }

    const worldX = (relativeX - minimapTransform.offsetX) / minimapTransform.scale;
    const worldY = (relativeY - minimapTransform.offsetY) / minimapTransform.scale;

    setPanX(viewport.width / 2 - worldX * zoom);
    setPanY(viewport.height / 2 - worldY * zoom);
  }

  async function handleFullscreenToggle() {
    if (!rootRef.current) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await rootRef.current.requestFullscreen?.();
  }

  function handleOpenExternal(url: string | null) {
    if (!url) {
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  const tooltipStyle = useMemo(() => {
    if (!hoveredNode || viewport.width <= 0 || viewport.height <= 0) {
      return null;
    }

    const estimatedWidth = 240;
    const estimatedHeight = hoveredNode.subtitle ? 72 : 48;
    const targetLeft = panX + (hoveredNode.x + hoveredNode.width) * zoom + 14;
    const targetTop = panY + hoveredNode.y * zoom;
    const maxLeft = viewport.width - estimatedWidth - 12;
    const maxTop = viewport.height - estimatedHeight - 12;
    const left =
      targetLeft > maxLeft
        ? Math.max(12, panX + hoveredNode.x * zoom - estimatedWidth - 14)
        : Math.max(12, targetLeft);

    return {
      left,
      top: clamp(targetTop, 12, maxTop),
    };
  }, [hoveredNode, panX, viewport.height, viewport.width, zoom]);

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleFullscreenToggle}>
            {t("mainSequenceDependencyGraph.explorer.fullscreen")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleFit} disabled={!layout || isLoading || Boolean(error)}>
            {t("mainSequenceDependencyGraph.explorer.fit")}
          </Button>
          <Button
            variant={minimapVisible ? "default" : "outline"}
            size="sm"
            onClick={() => {
              runtimeStateEnabledRef.current = true;
              setMinimapVisible((currentValue) => !currentValue);
            }}
            disabled={!layout || isLoading || Boolean(error)}
          >
            {t("mainSequenceDependencyGraph.explorer.minimap")}
          </Button>
        </div>
        <div className="flex min-w-[220px] flex-1 items-center justify-end gap-3">
          <Badge variant="neutral">{`${Math.round(zoom * 100)}%`}</Badge>
          <input
            type="range"
            min={dependencyGraphConfig.minZoom * 100}
            max={dependencyGraphConfig.maxZoom * 100}
            value={Math.round(zoom * 100)}
            onChange={(event) => {
              runtimeStateEnabledRef.current = true;
              const nextZoom = clamp(
                Number(event.target.value) / 100,
                dependencyGraphConfig.minZoom,
                dependencyGraphConfig.maxZoom,
              );
              const centerWorldX = (viewport.width / 2 - panX) / zoom;
              const centerWorldY = (viewport.height / 2 - panY) / zoom;
              setZoom(nextZoom);
              setPanX(viewport.width / 2 - centerWorldX * nextZoom);
              setPanY(viewport.height / 2 - centerWorldY * nextZoom);
            }}
            className="h-2 w-full max-w-[220px] cursor-pointer accent-primary"
          />
        </div>
      </div>

      <div
        ref={viewportRef}
        onPointerDown={handleViewportPointerDown}
        onWheel={handleWheel}
        className={
          variant === "widget"
            ? "relative min-h-0 flex-1 overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35"
            : "relative min-h-[640px] overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 xl:min-h-[720px]"
        }
        style={{
          backgroundImage: `linear-gradient(${withAlpha(
            resolvedTokens["chart-grid"],
            0.18,
          )} 1px, transparent 1px), linear-gradient(90deg, ${withAlpha(
            resolvedTokens["chart-grid"],
            0.18,
          )} 1px, transparent 1px), radial-gradient(circle at top left, ${withAlpha(
            resolvedTokens.primary,
            0.12,
          )} 0%, transparent 36%), radial-gradient(circle at bottom right, ${withAlpha(
            resolvedTokens.accent,
            0.12,
          )} 0%, transparent 40%)`,
          backgroundSize: "36px 36px, 36px 36px, auto, auto",
          backgroundPosition: "0 0, 0 0, 0 0, 100% 100%",
          cursor: pointerPan ? "grabbing" : "grab",
        }}
      >
        {isLoading ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/30 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("mainSequenceDependencyGraph.explorer.loading")}
            </div>
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="absolute inset-4 z-20 rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {!isLoading && !error && payload && (layout?.nodes.length ?? 0) === 0 ? (
          <div className="absolute inset-4 z-20 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
            {t("mainSequenceDependencyGraph.explorer.noNodes")}
          </div>
        ) : null}

        {layout && !isLoading && !error && layout.nodes.length > 0 ? (
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
                {layout.groups.map((group) => (
                  <g key={group.id}>
                    <rect
                      x={group.x}
                      y={group.y}
                      width={group.width}
                      height={group.height}
                      rx={20}
                      fill={alphaColor(resolvedTokens.secondary, 0.08)}
                      stroke={withAlpha(resolvedTokens.border, 0.72)}
                      strokeDasharray="8 6"
                    />
                    <rect
                      x={group.x + 16}
                      y={group.y + 10}
                      width={Math.max(72, group.label.length * 7.2)}
                      height={22}
                      rx={11}
                      fill={withAlpha(resolvedTokens.background, 0.92)}
                      stroke={withAlpha(resolvedTokens.border, 0.62)}
                    />
                    <text
                      x={group.x + 28}
                      y={group.y + 24}
                      fill={resolvedTokens["muted-foreground"]}
                      fontSize="11"
                      letterSpacing="0.14em"
                      style={{ textTransform: "uppercase" }}
                    >
                      {group.label}
                    </text>
                  </g>
                ))}

                {layout.edges.map((edge) => {
                  const path = buildEdgePath(edge, layout.nodesById);
                  const isHighlighted = highlightedEdgeIds.has(edge.id);
                  const stroke = isHighlighted
                    ? resolvedTokens.primary
                    : resolvedTokens["muted-foreground"];

                  return (
                    <g key={edge.id}>
                      <path
                        d={path}
                        fill="none"
                        stroke={alphaColor(stroke, isHighlighted ? 0.16 : 0.08)}
                        strokeLinecap="round"
                        strokeWidth={isHighlighted ? 12 : 8}
                      />
                      <path
                        d={path}
                        fill="none"
                        stroke={stroke}
                        strokeLinecap="round"
                        strokeWidth={isHighlighted ? 3 : 2}
                      />
                    </g>
                  );
                })}
              </svg>

              {layout.nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;

                return (
                  <button
                    key={node.id}
                    type="button"
                    data-graph-node
                    onClick={() => {
                      runtimeStateEnabledRef.current = true;
                      setSelectedNodeId(node.id);
                    }}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId((currentValue) => (currentValue === node.id ? null : currentValue))}
                    className="absolute text-left"
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      height: node.height,
                    }}
                  >
                    <div
                      className="flex h-full w-full flex-col justify-between rounded-[18px] border px-4 py-3 shadow-[var(--shadow-panel)] backdrop-blur transition-transform duration-150"
                      style={{
                        borderColor: isSelected
                          ? alphaColor(resolvedTokens.primary, 0.8)
                          : isHovered
                            ? alphaColor(resolvedTokens.primary, 0.55)
                            : alphaColor(node.color, 0.36),
                        background: `linear-gradient(165deg, ${alphaColor(
                          node.backgroundColor,
                          0.2,
                        )} 0%, ${alphaColor(resolvedTokens.card, 0.94)} 58%, ${alphaColor(
                          resolvedTokens.background,
                          0.96,
                        )} 100%)`,
                        boxShadow: isSelected
                          ? `0 18px 40px ${alphaColor(resolvedTokens.primary, 0.22)}`
                          : undefined,
                        transform: isHovered ? "translateY(-2px)" : undefined,
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {getNodeIcon(node) ? (
                              <span
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background/60 text-xs text-foreground"
                                aria-hidden="true"
                              >
                                {getNodeIcon(node)}
                              </span>
                            ) : null}
                            <div className="truncate text-sm font-semibold text-card-foreground">
                              {node.title}
                            </div>
                          </div>
                          {node.subtitle ? (
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {node.subtitle}
                            </div>
                          ) : null}
                        </div>
                        <Badge variant="neutral">
                          {t("mainSequenceDependencyGraph.explorer.depthBadge", {
                            depth: node.depth,
                          })}
                        </Badge>
                      </div>

                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
                          {node.properties?.remote_table_hash_id ? (
                            <div className="truncate font-mono">
                              {String(node.properties.remote_table_hash_id)}
                            </div>
                          ) : null}
                          {node.properties?.human_readable ? (
                            <div className="truncate">{String(node.properties.human_readable)}</div>
                          ) : null}
                        </div>
                        {node.badges.length ? (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {node.badges.slice(0, 2).map((badge) => (
                              <Badge key={`${node.id}-${badge}`} variant={getBadgeVariant(badge)}>
                                {badge}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {tooltipStyle && hoveredNode ? (
              <div
                data-graph-overlay
                className="pointer-events-none absolute z-20 max-w-[240px] rounded-[calc(var(--radius)-6px)] border border-border/80 bg-card/96 px-3 py-2 shadow-[var(--shadow-panel)] backdrop-blur"
                style={tooltipStyle}
              >
                <div className="text-sm font-medium text-card-foreground">
                  {hoveredNode.title}
                </div>
                {hoveredNode.subtitle ? (
                  <div className="mt-1 text-xs text-muted-foreground">{hoveredNode.subtitle}</div>
                ) : null}
              </div>
            ) : null}

            {selectedNode ? (
              <div
                data-graph-overlay
                className="absolute top-4 right-4 bottom-4 z-20 flex w-[min(340px,calc(100%-2rem))] flex-col overflow-hidden rounded-[calc(var(--radius)-2px)] border border-border/80 bg-card/96 shadow-[var(--shadow-panel)] backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-card-foreground">
                      {selectedNode.title}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {selectedNode.subtitle || t("mainSequenceDependencyGraph.explorer.nodeDetails")}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      runtimeStateEnabledRef.current = true;
                      setSelectedNodeId(null);
                    }}
                  >
                    {t("mainSequenceDependencyGraph.explorer.close")}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-border/70 px-4 py-3">
                  {buildDataNodeUpdateUrl(selectedNode) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenExternal(buildDataNodeUpdateUrl(selectedNode))}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Open Data Node Update
                    </Button>
                  ) : null}
                  {buildSimpleTableUpdateUrl(selectedNode) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenExternal(buildSimpleTableUpdateUrl(selectedNode))}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Open Simple Table Update
                    </Button>
                  ) : null}
                  {buildDataNodeUrl(selectedNode) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenExternal(buildDataNodeUrl(selectedNode))}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Open Data Node
                    </Button>
                  ) : null}
                  {buildSimpleTableUrl(selectedNode) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenExternal(buildSimpleTableUrl(selectedNode))}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Open Simple Table
                    </Button>
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  <div className="space-y-3">
                    {propertyEntries.map((entry) => (
                      <div
                        key={entry.key}
                        className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/45 px-3 py-2.5"
                      >
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          {entry.label}
                        </div>
                        <div
                          className={
                            entry.monospace
                              ? "mt-1 break-all font-mono text-xs text-foreground"
                              : "mt-1 whitespace-pre-wrap break-words text-sm text-foreground"
                          }
                        >
                          {entry.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {minimapVisible && minimapTransform ? (
              <div
                data-graph-overlay
                onPointerDown={handleMinimapPointerDown}
                className="absolute right-4 bottom-4 z-20 overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/80 bg-card/92 shadow-[var(--shadow-panel)] backdrop-blur"
                style={{
                  width: dependencyGraphConfig.minimap.width,
                  height: dependencyGraphConfig.minimap.height,
                }}
              >
                <svg
                  width={dependencyGraphConfig.minimap.width}
                  height={dependencyGraphConfig.minimap.height}
                  viewBox={`0 0 ${dependencyGraphConfig.minimap.width} ${dependencyGraphConfig.minimap.height}`}
                  className="block"
                >
                  <rect
                    x="0"
                    y="0"
                    width={dependencyGraphConfig.minimap.width}
                    height={dependencyGraphConfig.minimap.height}
                    fill={withAlpha(resolvedTokens.background, 0.96)}
                  />

                  {layout.edges.map((edge) => {
                    const source = layout.nodesById.get(edge.source);
                    const target = layout.nodesById.get(edge.target);

                    if (!source || !target) {
                      return null;
                    }

                    return (
                      <line
                        key={`mini-${edge.id}`}
                        x1={minimapTransform.offsetX + (source.x + source.width / 2) * minimapTransform.scale}
                        y1={minimapTransform.offsetY + (source.y + source.height / 2) * minimapTransform.scale}
                        x2={minimapTransform.offsetX + (target.x + target.width / 2) * minimapTransform.scale}
                        y2={minimapTransform.offsetY + (target.y + target.height / 2) * minimapTransform.scale}
                        stroke={withAlpha(resolvedTokens["muted-foreground"], 0.8)}
                        strokeWidth="1.4"
                      />
                    );
                  })}

                  {layout.nodes.map((node) => (
                    <rect
                      key={`mini-node-${node.id}`}
                      x={minimapTransform.offsetX + node.x * minimapTransform.scale}
                      y={minimapTransform.offsetY + node.y * minimapTransform.scale}
                      width={Math.max(4, node.width * minimapTransform.scale)}
                      height={Math.max(3, node.height * minimapTransform.scale)}
                      rx="3"
                      fill={selectedNodeId === node.id ? resolvedTokens.primary : node.backgroundColor}
                      opacity={selectedNodeId === node.id ? 1 : 0.92}
                    />
                  ))}

                  {minimapViewport ? (
                    <rect
                      x={minimapViewport.x}
                      y={minimapViewport.y}
                      width={Math.max(18, minimapViewport.width)}
                      height={Math.max(14, minimapViewport.height)}
                      rx="8"
                      fill={withAlpha(resolvedTokens.primary, 0.12)}
                      stroke={resolvedTokens.primary}
                      strokeWidth="1.5"
                    />
                  ) : null}
                </svg>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {!isLoading && !error ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="neutral">{getDirectionLabel(direction, t)}</Badge>
          <span>
            {pointerPan
              ? t("mainSequenceDependencyGraph.explorer.panning")
              : t("mainSequenceDependencyGraph.explorer.dragCanvasToPan")}
          </span>
          <span>•</span>
          <span>{t("mainSequenceDependencyGraph.explorer.scrollToZoom")}</span>
          <span>•</span>
          <span>{t("mainSequenceDependencyGraph.explorer.clickNodeToInspect")}</span>
        </div>
      ) : null}
    </div>
  );
}
