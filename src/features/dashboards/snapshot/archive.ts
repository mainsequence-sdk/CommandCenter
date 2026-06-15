import { getConnectionTypeById, getWidgetById } from "@/app/registry";
import { hasAllPermissions } from "@/auth/permissions";
import type {
  DashboardControlsState,
  DashboardDefinition,
  DashboardWidgetInstance,
  ResolvedDashboardDefinition,
} from "@/dashboards/types";
import { collectDashboardWidgetEntries } from "@/dashboards/widget-dependencies";
import type { ResolvedWidgetInputs, WidgetAgentSnapshot } from "@/widgets/types";
import {
  MAIN_SEQUENCE_FOUNDRY_DEPENDENCY_GRAPH_WIDGET_ID,
  MAIN_SEQUENCE_FOUNDRY_PROJECT_INFRA_GRAPH_WIDGET_ID,
  normalizeWidgetTypeId,
} from "@/widgets/widget-type-normalization";

import type {
  BuiltWorkspaceSnapshotArchive,
  WorkspaceAgentWidgetSnapshotRecord,
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
  const normalizedWidgetId = normalizeWidgetTypeId(widgetId);

  if (
    normalizedWidgetId === MAIN_SEQUENCE_FOUNDRY_DEPENDENCY_GRAPH_WIDGET_ID ||
    normalizedWidgetId === MAIN_SEQUENCE_FOUNDRY_PROJECT_INFRA_GRAPH_WIDGET_ID
  ) {
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveConnectionTypeName(props: Record<string, unknown> | undefined) {
  if (!isPlainRecord(props)) {
    return undefined;
  }

  const connectionRef = props.connectionRef;

  if (!isPlainRecord(connectionRef)) {
    return undefined;
  }

  const typeId = typeof connectionRef.typeId === "string" ? connectionRef.typeId.trim() : "";

  if (!typeId) {
    return undefined;
  }

  return getConnectionTypeById(typeId)?.title ?? typeId;
}

function buildWidgetArtifactEntries(
  record: WorkspaceAgentWidgetSnapshotRecord,
) {
  const basePath = `widgets/${buildWidgetArchiveDirectoryName(record.widgetType, record.instanceId)}`;
  const snapshotPath = `${basePath}/snapshot.json`;

  return [
    {
      path: snapshotPath,
      mediaType: "application/json",
      description: `Structured live widget snapshot for ${record.widgetName}.`,
      bytes: jsonBytes(record),
    },
  ];
}

export async function buildWorkspaceAgentSnapshotArchive(input: {
  dashboard: DashboardDefinition;
  resolvedDashboard: ResolvedDashboardDefinition;
  permissions: readonly string[];
  controlsState: DashboardControlsState & {
    refreshProgress: number;
    isRefreshing: boolean;
    lastRefreshedAt: number | null;
  };
  profile: WorkspaceSnapshotCaptureProfile;
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
          resolveWidgetRuntimeState: (targetInstanceId) =>
            typeof targetInstanceId === "string"
              ? (input.resolvedDashboard.widgets.find((candidate) => candidate.id === targetInstanceId)
                  ?.runtimeState as Record<string, unknown> | undefined)
              : undefined,
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
          error: "Widget-specific state dump failed during archive capture.",
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
      widgetName: instance.title ?? widget?.title ?? instance.widgetId,
      widgetType: instance.widgetId,
      source: widget?.source,
      connectionTypeName: resolveConnectionTypeName(
        (instance.props ?? {}) as Record<string, unknown>,
      ),
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
      snapshot,
    };

    const widgetArtifactEntries = buildWidgetArtifactEntries(record);

    entries.push(...widgetArtifactEntries);
  }
  const zipBlob = await createStoredZipBlob(
    entries.map((entry) => ({
      path: entry.path,
      bytes: entry.bytes,
    })),
  );

  return {
    blob: zipBlob,
    fileName: buildArchiveFileName(input.dashboard.title, generatedAt),
    warnings,
    errors,
  } satisfies BuiltWorkspaceSnapshotArchive;
}
