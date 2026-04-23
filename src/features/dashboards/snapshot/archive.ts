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
  const basePath = `widgets/${buildWidgetArchiveDirectoryName(record.widgetId, record.instanceId)}`;
  const snapshotPath = `${basePath}/snapshot.json`;
  const payloadEntries: PreparedArchiveEntry[] = [];
  const snapshotData = record.snapshot.data ?? {};

  if (isRecordArray(snapshotData.rows)) {
    payloadEntries.push({
      path: `${basePath}/data.json`,
      mediaType: "application/json",
      description: `Structured row export for ${record.title}.`,
      bytes: jsonBytes(snapshotData.rows),
    });
  }

  if (Array.isArray(snapshotData.series)) {
    payloadEntries.push({
      path: `${basePath}/chart-data.json`,
      mediaType: "application/json",
      description: `Chart series export for ${record.title}.`,
      bytes: jsonBytes(snapshotData.series),
    });
  }

  if (snapshotData.lastResponseBody !== undefined) {
    payloadEntries.push({
      path: `${basePath}/response.json`,
      mediaType: "application/json",
      description: `Last AppComponent response payload for ${record.title}.`,
      bytes: jsonBytes(snapshotData.lastResponseBody),
    });
  }

  record.artifactPaths.push(snapshotPath, ...payloadEntries.map((entry) => entry.path));

  return [
    {
      path: snapshotPath,
      mediaType: "application/json",
      description: `Structured live widget snapshot for ${record.title}.`,
      bytes: jsonBytes(record),
    },
    ...payloadEntries,
  ];
}

export async function buildWorkspaceAgentSnapshotArchive(input: {
  dashboard: DashboardDefinition;
  workspaceDefinitionDashboard?: DashboardDefinition;
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

    const widgetArtifactEntries = buildWidgetArtifactEntries(record);

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
    bytes: jsonBytes(createWorkspaceSnapshot(input.workspaceDefinitionDashboard ?? input.dashboard)),
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
