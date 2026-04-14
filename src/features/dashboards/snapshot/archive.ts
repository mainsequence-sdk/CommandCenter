import { getWidgetById } from "@/app/registry";
import { hasAllPermissions } from "@/auth/permissions";
import type {
  DashboardControlsState,
  DashboardDefinition,
  DashboardWidgetInstance,
  ResolvedDashboardDefinition,
} from "@/dashboards/types";
import {
  collectDashboardWidgetEntries,
  type DashboardWidgetDependencyGraph,
} from "@/dashboards/widget-dependencies";
import { createWorkspaceSnapshot } from "@/features/dashboards/custom-dashboard-storage";
import type { ResolvedWidgetInputs, WidgetAgentSnapshot } from "@/widgets/types";

import {
  blobToUint8Array,
  captureElementToPng,
  captureScrollableFullContentToPng,
  captureScrollableViewportToPng,
  renderSvgMarkupToPng,
} from "./capture";
import type {
  BuiltWorkspaceSnapshotArchive,
  WorkspaceAgentLiveState,
  WorkspaceAgentWidgetSnapshotRecord,
  WorkspaceSnapshotArchiveManifest,
  WorkspaceSnapshotCaptureProfile,
} from "./types";
import { createStoredZipBlob } from "./zip";

interface PreparedArchiveEntry {
  path: string;
  mediaType: string;
  description?: string;
  bytes: Uint8Array;
}

function appendSnapshotWarning(
  warnings: string[],
  message: string,
  details?: Record<string, unknown>,
) {
  warnings.push(message);

  if (details) {
    console.warn("[workspace snapshot]", message, details);
    return;
  }

  console.warn("[workspace snapshot]", message);
}

function jsonBytes(value: unknown) {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function sanitizeFileComponent(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function extractWidgetInstanceArchiveSuffix(instanceId: string) {
  const matchedUuid = instanceId.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  );

  if (matchedUuid?.[1]) {
    return matchedUuid[1].toLowerCase();
  }

  return sanitizeFileComponent(instanceId);
}

function buildWidgetArchiveDirectoryName(widgetId: string, instanceId: string) {
  return sanitizeFileComponent(
    `${widgetId.toLowerCase()}-${extractWidgetInstanceArchiveSuffix(instanceId)}`,
  );
}

function buildArchiveFileName(workspaceTitle: string, generatedAt: string) {
  const safeTitle = sanitizeFileComponent(workspaceTitle.toLowerCase());
  const safeTimestamp = generatedAt.replace(/[:.]/g, "-");

  return `${safeTitle || "workspace"}-live-snapshot-${safeTimestamp}.zip`;
}

function resolvePlacementMode(instance: DashboardWidgetInstance) {
  return instance.presentation?.placementMode === "sidebar" ? "sidebar" : "canvas";
}

function resolveDisplayKind(widgetId: string, widgetKind?: string): WidgetAgentSnapshot["displayKind"] {
  if (widgetId === "dependency-graph" || widgetId === "main-sequence-project-infra-graph") {
    return "graph";
  }

  if (widgetKind === "table" || widgetKind === "chart") {
    return widgetKind;
  }

  return widgetKind === "custom" ? "custom" : "custom";
}

function buildGenericWidgetSnapshot(input: {
  title: string;
  widgetId: string;
  widgetKind?: string;
  domTextContent?: string;
  error?: string;
}) {
  return {
    displayKind: resolveDisplayKind(input.widgetId, input.widgetKind),
    state: input.error ? "error" : input.domTextContent?.trim() ? "ready" : "idle",
    summary: input.error
      ? input.error
      : input.domTextContent?.trim()
        ? input.domTextContent.trim().slice(0, 240)
        : `${input.title} does not provide a widget-specific agent snapshot.`,
    data: input.domTextContent?.trim()
      ? {
          renderedText: input.domTextContent.trim(),
        }
      : undefined,
  } satisfies WidgetAgentSnapshot;
}

function isRecordArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
}

function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replaceAll(`"`, `""`)}"`;
  }

  return normalized;
}

function buildCsvFromRows(rows: Array<Record<string, unknown>>, preferredKeys?: string[]) {
  const keys = preferredKeys && preferredKeys.length > 0
    ? preferredKeys
    : Array.from(
        new Set(rows.flatMap((row) => Object.keys(row))),
      );

  const lines = [
    keys.join(","),
    ...rows.map((row) => keys.map((key) => escapeCsvCell(row[key])).join(",")),
  ];

  return new TextEncoder().encode(lines.join("\n"));
}

function summarizeHiddenReason(input: {
  placementMode: "canvas" | "sidebar";
  hiddenInCollapsedRow: boolean;
  permissionDenied: boolean;
  hasVisibleElement: boolean;
}) {
  if (input.permissionDenied) {
    return "permission-denied";
  }

  if (input.hiddenInCollapsedRow) {
    return "collapsed-row";
  }

  if (input.placementMode === "sidebar" && !input.hasVisibleElement) {
    return "sidebar-only";
  }

  return undefined;
}

function buildWidgetGraphSvg(graph: DashboardWidgetDependencyGraph) {
  if (graph.nodes.length === 0) {
    return { svg: "", width: 0, height: 0 };
  }

  const nodeWidth = 220;
  const nodeHeight = 72;
  const columnGap = 120;
  const rowGap = 48;
  const padding = 56;
  const depthById = new Map(graph.nodes.map((node) => [node.id, 0]));

  for (let pass = 0; pass < graph.nodes.length; pass += 1) {
    graph.edges.forEach((edge) => {
      const sourceDepth = depthById.get(edge.from) ?? 0;
      const targetDepth = depthById.get(edge.to) ?? 0;

      if (sourceDepth + 1 > targetDepth) {
        depthById.set(edge.to, sourceDepth + 1);
      }
    });
  }

  const columns = new Map<number, typeof graph.nodes>();

  graph.nodes.forEach((node) => {
    const depth = depthById.get(node.id) ?? 0;
    const currentColumn = columns.get(depth) ?? [];

    currentColumn.push(node);
    columns.set(depth, currentColumn);
  });

  const orderedDepths = [...columns.keys()].sort((left, right) => left - right);
  const maxRows = Math.max(...orderedDepths.map((depth) => columns.get(depth)?.length ?? 0));
  const width = padding * 2 + orderedDepths.length * nodeWidth + Math.max(0, orderedDepths.length - 1) * columnGap;
  const height = padding * 2 + maxRows * nodeHeight + Math.max(0, maxRows - 1) * rowGap;
  const positionById = new Map<string, { x: number; y: number }>();

  orderedDepths.forEach((depth, depthIndex) => {
    const columnNodes = [...(columns.get(depth) ?? [])].sort((left, right) =>
      left.title.localeCompare(right.title),
    );
    const columnHeight = columnNodes.length * nodeHeight + Math.max(0, columnNodes.length - 1) * rowGap;
    const columnStartY = padding + Math.max(0, (height - padding * 2 - columnHeight) / 2);

    columnNodes.forEach((node, rowIndex) => {
      positionById.set(node.id, {
        x: padding + depthIndex * (nodeWidth + columnGap),
        y: columnStartY + rowIndex * (nodeHeight + rowGap),
      });
    });
  });

  const edgeMarkup = graph.edges.map((edge) => {
    const source = positionById.get(edge.from);
    const target = positionById.get(edge.to);

    if (!source || !target) {
      return "";
    }

    const startX = source.x + nodeWidth;
    const startY = source.y + nodeHeight / 2;
    const endX = target.x;
    const endY = target.y + nodeHeight / 2;
    const curve = Math.max(42, Math.abs(endX - startX) / 2);

    return `<path d="M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}" fill="none" stroke="rgba(148,163,184,0.65)" stroke-width="2" />`;
  }).join("");

  const nodeMarkup = graph.nodes.map((node) => {
    const position = positionById.get(node.id);

    if (!position) {
      return "";
    }

    const subtitle = node.placementMode === "sidebar"
      ? "Sidebar widget"
      : node.hiddenInCollapsedRow
        ? "Collapsed row child"
        : node.widgetId;

    return [
      `<g transform="translate(${position.x} ${position.y})">`,
      `<rect x="0" y="0" width="${nodeWidth}" height="${nodeHeight}" rx="18" fill="#0f172a" fill-opacity="0.94" stroke="#334155" stroke-width="1.5" />`,
      `<text x="16" y="28" font-size="15" font-family="ui-sans-serif, system-ui, sans-serif" fill="#e2e8f0">${escapeXml(node.title)}</text>`,
      `<text x="16" y="50" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="#94a3b8">${escapeXml(subtitle)}</text>`,
      `</g>`,
    ].join("");
  }).join("");

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#020617" />`,
    edgeMarkup,
    nodeMarkup,
    `</svg>`,
  ].join("");

  return { svg, width, height };
}

function buildHiddenWidgetsSheetSvg(records: WorkspaceAgentWidgetSnapshotRecord[]) {
  if (records.length === 0) {
    return { svg: "", width: 0, height: 0 };
  }

  const columns = 2;
  const cardWidth = 420;
  const cardHeight = 132;
  const gap = 24;
  const padding = 40;
  const rows = Math.ceil(records.length / columns);
  const width = padding * 2 + columns * cardWidth + Math.max(0, columns - 1) * gap;
  const height = padding * 2 + rows * cardHeight + Math.max(0, rows - 1) * gap + 48;
  const cards = records.map((record, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + column * (cardWidth + gap);
    const y = padding + 48 + row * (cardHeight + gap);

    return [
      `<g transform="translate(${x} ${y})">`,
      `<rect x="0" y="0" width="${cardWidth}" height="${cardHeight}" rx="20" fill="#111827" fill-opacity="0.96" stroke="#374151" stroke-width="1.25" />`,
      `<text x="18" y="28" font-size="16" font-family="ui-sans-serif, system-ui, sans-serif" fill="#f8fafc">${escapeXml(record.title)}</text>`,
      `<text x="18" y="52" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="#93c5fd">${escapeXml(record.widgetId)}</text>`,
      `<text x="18" y="74" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="#94a3b8">${escapeXml(record.hiddenReason ?? "hidden")}</text>`,
      `<text x="18" y="100" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="#cbd5e1">${escapeXml(record.snapshot.summary.slice(0, 180))}</text>`,
      `</g>`,
    ].join("");
  }).join("");

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#020617" />`,
    `<text x="${padding}" y="${padding}" font-size="22" font-family="ui-sans-serif, system-ui, sans-serif" fill="#f8fafc">Hidden Workspace Widgets</text>`,
    `<text x="${padding}" y="${padding + 24}" font-size="13" font-family="ui-sans-serif, system-ui, sans-serif" fill="#94a3b8">Sidebar-only, collapsed, or otherwise non-visible widgets captured in the live archive.</text>`,
    cards,
    `</svg>`,
  ].join("");

  return { svg, width, height };
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(`"`, "&quot;")
    .replaceAll("'", "&apos;");
}

function collectWidgetDomElements() {
  const visibleElements = new Map<string, HTMLElement>();
  const hiddenElements = new Map<string, HTMLElement>();

  Array.from(
    document.querySelectorAll<HTMLElement>("[data-workspace-widget-instance-id]"),
  ).forEach((element) => {
    const instanceId = element.dataset.workspaceWidgetInstanceId;

    if (!instanceId) {
      return;
    }

    if (element.dataset.workspaceWidgetVisibility === "hidden") {
      hiddenElements.set(instanceId, element);
      return;
    }

    visibleElements.set(instanceId, element);
  });

  return { visibleElements, hiddenElements };
}

function buildWidgetArtifactEntries(
  record: WorkspaceAgentWidgetSnapshotRecord,
) {
  const entries: PreparedArchiveEntry[] = [];
  const basePath = `widgets/${buildWidgetArchiveDirectoryName(record.widgetId, record.instanceId)}`;
  const snapshotData = record.snapshot.data ?? {};

  entries.push({
    path: `${basePath}/snapshot.json`,
    mediaType: "application/json",
    description: `Structured live widget snapshot for ${record.title}.`,
    bytes: jsonBytes(record),
  });

  if (isRecordArray(snapshotData.rows)) {
    entries.push({
      path: `${basePath}/data.json`,
      mediaType: "application/json",
      description: `Structured row export for ${record.title}.`,
      bytes: jsonBytes(snapshotData.rows),
    });

    const preferredKeys =
      Array.isArray(snapshotData.columns) && snapshotData.columns.every((entry) => typeof entry === "string")
        ? (snapshotData.columns as string[])
        : Array.isArray(snapshotData.visibleColumns)
          ? snapshotData.visibleColumns.flatMap((entry) =>
              entry && typeof entry === "object" && typeof entry.key === "string"
                ? [entry.key]
                : [],
            )
          : undefined;

    entries.push({
      path: `${basePath}/data.csv`,
      mediaType: "text/csv",
      description: `CSV row export for ${record.title}.`,
      bytes: buildCsvFromRows(snapshotData.rows, preferredKeys),
    });
  }

  if (Array.isArray(snapshotData.series)) {
    entries.push({
      path: `${basePath}/chart-data.json`,
      mediaType: "application/json",
      description: `Chart series export for ${record.title}.`,
      bytes: jsonBytes(snapshotData.series),
    });
  }

  if (snapshotData.lastResponseBody !== undefined) {
    entries.push({
      path: `${basePath}/response.json`,
      mediaType: "application/json",
      description: `Last AppComponent response payload for ${record.title}.`,
      bytes: jsonBytes(snapshotData.lastResponseBody),
    });
  }

  return entries;
}

export async function buildWorkspaceAgentSnapshotArchive(input: {
  dashboard: DashboardDefinition;
  resolvedDashboard: ResolvedDashboardDefinition;
  permissions: string[];
  controlsState: DashboardControlsState & {
    refreshProgress: number;
    isRefreshing: boolean;
    lastRefreshedAt: number | null;
  };
  profile: WorkspaceSnapshotCaptureProfile;
  dependencyGraph: DashboardWidgetDependencyGraph;
  resolveInputs: (instanceId: string) => ResolvedWidgetInputs | undefined;
}) {
  const generatedAt = new Date().toISOString();
  const warnings: string[] = [];
  const errors: string[] = [];
  const entries: PreparedArchiveEntry[] = [];
  const flattenedEntries = collectDashboardWidgetEntries(
    input.resolvedDashboard.widgets,
  );
  const { hiddenElements, visibleElements } = collectWidgetDomElements();
  const widgetRecords: WorkspaceAgentWidgetSnapshotRecord[] = [];

  const scrollContainer = document.querySelector<HTMLElement>(
    "[data-workspace-snapshot-scroll-container]",
  );
  const canvasRoot = document.querySelector<HTMLElement>(
    "[data-workspace-snapshot-canvas-root]",
  );

  if (scrollContainer) {
    try {
      const viewportScreenshot = await captureScrollableViewportToPng(scrollContainer);

      entries.push({
        path: "screenshots/viewport.png",
        mediaType: "image/png",
        description: "Top-of-dashboard viewport screenshot.",
        bytes: await blobToUint8Array(viewportScreenshot),
      });
    } catch (error) {
      appendSnapshotWarning(
        warnings,
        error instanceof Error
          ? `Viewport screenshot failed: ${error.message}`
          : "Viewport screenshot failed.",
        {
          artifactPath: "screenshots/viewport.png",
        },
      );
    }
  } else {
    appendSnapshotWarning(
      warnings,
      "Workspace scroll container was not found, so viewport screenshot was skipped.",
      {
        selector: "[data-workspace-snapshot-scroll-container]",
        artifactPath: "screenshots/viewport.png",
      },
    );
  }

  if (canvasRoot) {
    try {
      const rect = canvasRoot.getBoundingClientRect();
      const fullCanvasScreenshot = await captureElementToPng(canvasRoot, {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(
          1,
          Math.round(Math.max(rect.height, canvasRoot.scrollHeight)),
        ),
        mutateClone: (clone) => {
          clone.style.position = "relative";
          clone.style.inset = "auto";
          clone.style.left = "0";
          clone.style.top = "0";
          clone.style.right = "auto";
          clone.style.bottom = "auto";
          clone.style.width = `${Math.max(1, Math.round(rect.width))}px`;
          clone.style.height = `${Math.max(1, Math.round(Math.max(rect.height, canvasRoot.scrollHeight)))}px`;
          clone.style.minHeight = `${Math.max(1, Math.round(Math.max(rect.height, canvasRoot.scrollHeight)))}px`;
        },
      });

      entries.push({
        path: "screenshots/full-canvas.png",
        mediaType: "image/png",
        description: "Full workspace canvas capture without shell chrome.",
        bytes: await blobToUint8Array(fullCanvasScreenshot),
      });
    } catch (error) {
      appendSnapshotWarning(
        warnings,
        error instanceof Error
          ? `Full canvas screenshot failed: ${error.message}`
          : "Full canvas screenshot failed.",
        {
          artifactPath: "screenshots/full-canvas.png",
          captureMode: "canvas-root",
        },
      );

      if (scrollContainer) {
        try {
          const fallbackScreenshot = await captureScrollableFullContentToPng(scrollContainer);

          entries.push({
            path: "screenshots/full-canvas.png",
            mediaType: "image/png",
            description: "Full workspace canvas capture stitched from the scroll container.",
            bytes: await blobToUint8Array(fallbackScreenshot),
          });
        } catch (fallbackError) {
          appendSnapshotWarning(
            warnings,
            fallbackError instanceof Error
              ? `Full canvas fallback screenshot failed: ${fallbackError.message}`
              : "Full canvas fallback screenshot failed.",
            {
              artifactPath: "screenshots/full-canvas.png",
              captureMode: "scroll-stitch-fallback",
            },
          );
        }
      }
    }
  } else {
    appendSnapshotWarning(
      warnings,
      "Workspace canvas root was not found, so full canvas screenshot was skipped.",
      {
        selector: "[data-workspace-snapshot-canvas-root]",
        artifactPath: "screenshots/full-canvas.png",
      },
    );
  }

  for (const entry of flattenedEntries) {
    const instance = entry.instance;
    const widget = getWidgetById(instance.widgetId);
    const visibleElement = visibleElements.get(instance.id);
    const hiddenElement = hiddenElements.get(instance.id);
    const domTextContent =
      visibleElement?.textContent?.trim() ||
      hiddenElement?.textContent?.trim() ||
      undefined;
    const permissionDenied = widget
      ? !hasAllPermissions(input.permissions, [
          ...(widget.requiredPermissions ?? []),
          ...(instance.requiredPermissions ?? []),
        ])
      : false;
    const placementMode = resolvePlacementMode(instance);
    const hiddenReason = summarizeHiddenReason({
      placementMode,
      hiddenInCollapsedRow: entry.hiddenInCollapsedRow,
      permissionDenied,
      hasVisibleElement: Boolean(visibleElement),
    });
    const hidden = Boolean(hiddenReason);

    let snapshot: WidgetAgentSnapshot;

    if (!widget) {
      snapshot = buildGenericWidgetSnapshot({
        title: instance.title ?? instance.widgetId,
        widgetId: instance.widgetId,
        domTextContent,
        error: `Widget definition ${instance.widgetId} is not registered in the current client.`,
      });
    } else if (permissionDenied) {
      snapshot = buildGenericWidgetSnapshot({
        title: instance.title ?? widget.title,
        widgetId: widget.id,
        widgetKind: widget.kind,
        error: "Widget is not available for the current authenticated user permissions.",
      });
    } else if (widget.buildAgentSnapshot) {
      try {
        snapshot = await widget.buildAgentSnapshot({
          widgetId: widget.id,
          instanceId: instance.id,
          title: instance.title ?? widget.title,
          snapshotProfile: input.profile,
          props: (instance.props ?? {}) as Record<string, unknown>,
          presentation: instance.presentation,
          runtimeState: instance.runtimeState,
          resolvedInputs: input.resolveInputs(instance.id),
          dashboardState: input.controlsState,
          domTextContent,
        });
      } catch (error) {
        appendSnapshotWarning(
          warnings,
          error instanceof Error
            ? `Widget snapshot failed for ${instance.title ?? widget.title}: ${error.message}`
            : `Widget snapshot failed for ${instance.title ?? widget.title}.`,
          {
            instanceId: instance.id,
            widgetId: widget.id,
            widgetTitle: instance.title ?? widget.title,
          },
        );
        snapshot = buildGenericWidgetSnapshot({
          title: instance.title ?? widget.title,
          widgetId: widget.id,
          widgetKind: widget.kind,
          domTextContent,
          error: "Widget-specific snapshot builder failed during archive capture.",
        });
      }
    } else {
      snapshot = buildGenericWidgetSnapshot({
        title: instance.title ?? widget.title,
        widgetId: widget.id,
        widgetKind: widget.kind,
        domTextContent,
      });
    }

    const record: WorkspaceAgentWidgetSnapshotRecord = {
      instanceId: instance.id,
      widgetId: instance.widgetId,
      title: instance.title ?? widget?.title ?? instance.widgetId,
      category: widget?.category,
      kind: widget?.kind,
      source: widget?.source,
      placementMode,
      hidden,
      hiddenReason,
      layout: (() => {
        if (
          typeof entry.instance.layout === "object" &&
          "x" in entry.instance.layout &&
          "y" in entry.instance.layout &&
          "w" in entry.instance.layout &&
          "h" in entry.instance.layout &&
          typeof entry.instance.layout.x === "number" &&
          typeof entry.instance.layout.y === "number"
        ) {
          return {
            x: entry.instance.layout.x,
            y: entry.instance.layout.y,
            w: entry.instance.layout.w,
            h: entry.instance.layout.h,
          };
        }

        return undefined;
      })(),
      parentRowId: entry.parentRowId,
      domTextContent,
      artifactPaths: [],
      snapshot,
    };

    if (visibleElement && !hidden) {
      try {
        const screenshotBlob = await captureElementToPng(visibleElement);
        const screenshotPath = `widgets/${buildWidgetArchiveDirectoryName(instance.widgetId, instance.id)}/screenshot.png`;

        record.screenshotPath = screenshotPath;
        entries.push({
          path: screenshotPath,
          mediaType: "image/png",
          description: `Rendered widget screenshot for ${record.title}.`,
          bytes: await blobToUint8Array(screenshotBlob),
        });
      } catch (error) {
        appendSnapshotWarning(
          warnings,
          error instanceof Error
            ? `Widget screenshot failed for ${record.title}: ${error.message}`
            : `Widget screenshot failed for ${record.title}.`,
          {
            instanceId: instance.id,
            widgetId: instance.widgetId,
            artifactPath: `widgets/${buildWidgetArchiveDirectoryName(instance.widgetId, instance.id)}/screenshot.png`,
          },
        );
      }
    }

    const widgetArtifactEntries = buildWidgetArtifactEntries(record);

    record.artifactPaths.push(...widgetArtifactEntries.map((artifact) => artifact.path));
    entries.push(...widgetArtifactEntries);
    widgetRecords.push(record);
  }

  if (input.dependencyGraph.nodes.length > 0) {
    entries.push({
      path: "relationships/widget-graph.json",
      mediaType: "application/json",
      description: "Resolved workspace widget dependency graph.",
      bytes: jsonBytes(input.dependencyGraph),
    });

    try {
      const graphSvg = buildWidgetGraphSvg(input.dependencyGraph);

      if (graphSvg.svg) {
        const graphPng = await renderSvgMarkupToPng(
          graphSvg.svg,
          graphSvg.width,
          graphSvg.height,
        );

        entries.push({
          path: "relationships/widget-graph.png",
          mediaType: "image/png",
          description: "Rendered workspace widget dependency graph.",
          bytes: await blobToUint8Array(graphPng),
        });
      }
    } catch (error) {
      appendSnapshotWarning(
        warnings,
        error instanceof Error
          ? `Relationship graph render failed: ${error.message}`
          : "Relationship graph render failed.",
        {
          artifactPath: "relationships/widget-graph.png",
        },
      );
    }
  }

  const hiddenRecords = widgetRecords.filter((record) => record.hidden);

  if (hiddenRecords.length > 0) {
    try {
      const hiddenSheetSvg = buildHiddenWidgetsSheetSvg(hiddenRecords);

      if (hiddenSheetSvg.svg) {
        const hiddenSheetPng = await renderSvgMarkupToPng(
          hiddenSheetSvg.svg,
          hiddenSheetSvg.width,
          hiddenSheetSvg.height,
        );

        entries.push({
          path: "screenshots/hidden-widgets-sheet.png",
          mediaType: "image/png",
          description: "Report of hidden or non-visible widgets in the workspace.",
          bytes: await blobToUint8Array(hiddenSheetPng),
        });
      }
    } catch (error) {
      appendSnapshotWarning(
        warnings,
        error instanceof Error
          ? `Hidden widget report render failed: ${error.message}`
          : "Hidden widget report render failed.",
        {
          artifactPath: "screenshots/hidden-widgets-sheet.png",
        },
      );
    }
  }

  const liveState: WorkspaceAgentLiveState = {
    schema: "mainsequence.workspace-agent-live-state",
    version: 1,
    generatedAt,
    profile: input.profile,
    workspaceId: input.dashboard.id,
    workspaceTitle: input.dashboard.title,
    view: "dashboard",
    controls: input.controlsState,
    relationshipGraph: input.dependencyGraph,
    widgets: widgetRecords,
    summary: {
      widgetCount: widgetRecords.length,
      visibleWidgetCount: widgetRecords.filter((record) => !record.hidden).length,
      hiddenWidgetCount: widgetRecords.filter((record) => record.hidden).length,
      relationshipEdgeCount: input.dependencyGraph.edges.length,
    },
  };

  entries.unshift({
    path: "workspace-definition.json",
    mediaType: "application/json",
    description: "Canonical persisted workspace document export.",
    bytes: jsonBytes(createWorkspaceSnapshot(input.dashboard)),
  });
  entries.push({
    path: "workspace-live-state.json",
    mediaType: "application/json",
    description: "Live runtime workspace state assembled from the mounted client.",
    bytes: jsonBytes(liveState),
  });
  entries.push({
    path: "controls.json",
    mediaType: "application/json",
    description: "Resolved live dashboard control state.",
    bytes: jsonBytes(input.controlsState),
  });

  const manifest: WorkspaceSnapshotArchiveManifest = {
    schema: "mainsequence.workspace-agent-archive",
    version: 1,
    generatedAt,
    profile: input.profile,
    workspaceId: input.dashboard.id,
    workspaceTitle: input.dashboard.title,
    fileCount: entries.length + 1,
    warnings,
    errors,
    entries: entries.map((entry) => ({
      path: entry.path,
      mediaType: entry.mediaType,
      sizeBytes: entry.bytes.byteLength,
      description: entry.description,
    })),
  };
  const manifestEntry: PreparedArchiveEntry = {
    path: "manifest.json",
    mediaType: "application/json",
    description: "Archive manifest and capture summary.",
    bytes: jsonBytes(manifest),
  };
  const zipBlob = await createStoredZipBlob(
    [...entries, manifestEntry].map((entry) => ({
      path: entry.path,
      bytes: entry.bytes,
    })),
  );

  return {
    blob: zipBlob,
    fileName: buildArchiveFileName(input.dashboard.title, generatedAt),
    manifest: {
      ...manifest,
      entries: [
        ...manifest.entries,
        {
          path: manifestEntry.path,
          mediaType: manifestEntry.mediaType,
          sizeBytes: manifestEntry.bytes.byteLength,
          description: manifestEntry.description,
        },
      ],
    },
    liveState,
    warnings,
    errors,
  } satisfies BuiltWorkspaceSnapshotArchive;
}
