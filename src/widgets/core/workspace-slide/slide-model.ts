import type {
  DashboardSlideRegionId,
  DashboardWidgetInstance,
} from "@/dashboards/types";

export type WorkspaceSlideRegionId = DashboardSlideRegionId;

export type WorkspaceSlideBandId = "header" | "footer";
export type WorkspaceSlideBandSlotId = "left" | "middle" | "right";
export type WorkspaceSlideSlotContentType = "empty" | "text" | "image";

export interface WorkspaceSlideSlotContent extends Record<string, unknown> {
  type: WorkspaceSlideSlotContentType;
  text?: string;
  imageUrl?: string;
  imageAlt?: string;
}

export type WorkspaceSlideBandSlots = Record<WorkspaceSlideBandSlotId, WorkspaceSlideSlotContent>;

export interface WorkspaceSlideWidgetProps extends Record<string, unknown> {
  showHeader?: boolean;
  headerHeightPct: number;
  footerHeightPct: number;
  headerEnabled: boolean;
  footerEnabled: boolean;
  headerSlots: WorkspaceSlideBandSlots;
  footerSlots: WorkspaceSlideBandSlots;
}

export interface LegacyWorkspaceSlideChild {
  instance: DashboardWidgetInstance;
  region: WorkspaceSlideRegionId;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export const WORKSPACE_SLIDE_REGION_IDS: WorkspaceSlideRegionId[] = [
  "body",
];
export const WORKSPACE_SLIDE_GRID_COLUMNS = 12;
export const WORKSPACE_SLIDE_GRID_ROW_HEIGHT = 28;
export const WORKSPACE_SLIDE_BAND_SLOT_IDS: WorkspaceSlideBandSlotId[] = [
  "left",
  "middle",
  "right",
];
export const LEGACY_WORKSPACE_SLIDE_REGION_IDS: DashboardSlideRegionId[] = [
  "header",
  "left",
  "body",
  "right",
  "footer",
];

const DEFAULT_HEADER_HEIGHT_PCT = 16;
const DEFAULT_FOOTER_HEIGHT_PCT = 12;
const DEFAULT_WIDGET_WIDTH = 6;
const DEFAULT_WIDGET_HEIGHT = 4;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) {
    return `${prefix}-${uuid}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampInteger(value: unknown, fallback: number, minimum = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.round(value));
}

function clampPercentPair(
  first: unknown,
  second: unknown,
  fallbackFirst: number,
  fallbackSecond: number,
  maxCombined: number,
) {
  const resolvedFirst = clampInteger(first, fallbackFirst, 0);
  const resolvedSecond = clampInteger(second, fallbackSecond, 0);
  const total = resolvedFirst + resolvedSecond;

  if (total <= maxCombined) {
    return {
      first: resolvedFirst,
      second: resolvedSecond,
    };
  }

  const scale = maxCombined / Math.max(total, 1);

  return {
    first: Math.max(0, Math.round(resolvedFirst * scale)),
    second: Math.max(0, Math.round(resolvedSecond * scale)),
  };
}

function sanitizeSlideSlotContent(value: unknown): WorkspaceSlideSlotContent {
  if (!isPlainRecord(value)) {
    return {
      type: "empty",
    };
  }

  const type =
    value.type === "text" || value.type === "image" || value.type === "empty"
      ? value.type
      : "empty";
  const text = typeof value.text === "string" ? value.text : "";
  const imageUrl = typeof value.imageUrl === "string" ? value.imageUrl.trim() : "";
  const imageAlt = typeof value.imageAlt === "string" ? value.imageAlt : "";

  if (type === "text") {
    return {
      type,
      text,
    };
  }

  if (type === "image") {
    return {
      type,
      imageUrl,
      imageAlt,
    };
  }

  return {
    type: "empty",
  };
}

export function createEmptyWorkspaceSlideSlotContent(): WorkspaceSlideSlotContent {
  return {
    type: "empty",
  };
}

export function createEmptyWorkspaceSlideBandSlots(): WorkspaceSlideBandSlots {
  return {
    left: createEmptyWorkspaceSlideSlotContent(),
    middle: createEmptyWorkspaceSlideSlotContent(),
    right: createEmptyWorkspaceSlideSlotContent(),
  };
}

function sanitizeWorkspaceSlideBandSlots(value: unknown): WorkspaceSlideBandSlots {
  const record = isPlainRecord(value) ? value : {};

  return {
    left: sanitizeSlideSlotContent(record.left),
    middle: sanitizeSlideSlotContent(record.middle),
    right: sanitizeSlideSlotContent(record.right),
  };
}

function sanitizeEmbeddedWidget(widget: unknown): DashboardWidgetInstance | null {
  if (!isPlainRecord(widget)) {
    return null;
  }

  const widgetId = typeof widget.widgetId === "string" ? widget.widgetId.trim() : "";

  if (!widgetId) {
    return null;
  }

  return {
    id: typeof widget.id === "string" && widget.id.trim() ? widget.id.trim() : createId(widgetId),
    widgetId,
    title: typeof widget.title === "string" && widget.title.trim() ? widget.title.trim() : undefined,
    props: isPlainRecord(widget.props)
      ? cloneJson(widget.props as Record<string, unknown>)
      : {},
    runtimeState: isPlainRecord(widget.runtimeState)
      ? cloneJson(widget.runtimeState as Record<string, unknown>)
      : { status: "ready" },
    presentation: isPlainRecord(widget.presentation)
      ? cloneJson(widget.presentation as DashboardWidgetInstance["presentation"])
      : undefined,
    bindings:
      widget.bindings !== undefined
        ? cloneJson(widget.bindings as DashboardWidgetInstance["bindings"])
        : undefined,
    layout: isPlainRecord(widget.layout)
      ? cloneJson(widget.layout) as unknown as DashboardWidgetInstance["layout"]
      : {
          cols: DEFAULT_WIDGET_WIDTH,
          rows: DEFAULT_WIDGET_HEIGHT,
        },
    position: isPlainRecord(widget.position)
      ? cloneJson(widget.position as DashboardWidgetInstance["position"])
      : {
          x: 0,
          y: 0,
        },
    requiredPermissions: Array.isArray(widget.requiredPermissions)
      ? widget.requiredPermissions.filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
        )
      : undefined,
  };
}

function sanitizeLegacyLayout(layout: unknown) {
  const raw = isPlainRecord(layout) ? layout : {};

  return {
    x: clampInteger(raw.x, 0, 0),
    y: clampInteger(raw.y, 0, 0),
    w: clampInteger(raw.w, DEFAULT_WIDGET_WIDTH, 1),
    h: clampInteger(raw.h, DEFAULT_WIDGET_HEIGHT, 1),
  };
}

export function createEmptyWorkspaceSlideProps(): WorkspaceSlideWidgetProps {
  return {
    showHeader: false,
    headerHeightPct: DEFAULT_HEADER_HEIGHT_PCT,
    footerHeightPct: DEFAULT_FOOTER_HEIGHT_PCT,
    headerEnabled: false,
    footerEnabled: false,
    headerSlots: createEmptyWorkspaceSlideBandSlots(),
    footerSlots: createEmptyWorkspaceSlideBandSlots(),
  };
}

export function sanitizeWorkspaceSlideProps(props: unknown): WorkspaceSlideWidgetProps {
  if (!isPlainRecord(props)) {
    return createEmptyWorkspaceSlideProps();
  }

  const verticalPercents = clampPercentPair(
    props.headerHeightPct,
    props.footerHeightPct,
    DEFAULT_HEADER_HEIGHT_PCT,
    DEFAULT_FOOTER_HEIGHT_PCT,
    80,
  );
  const headerEnabled =
    typeof props.headerEnabled === "boolean"
      ? props.headerEnabled
      : props.showHeader === true;
  const footerEnabled =
    typeof props.footerEnabled === "boolean"
      ? props.footerEnabled
      : props.showFooter === true;

  return {
    showHeader: props.showHeader === true ? true : false,
    headerHeightPct: verticalPercents.first,
    footerHeightPct: verticalPercents.second,
    headerEnabled,
    footerEnabled,
    headerSlots: sanitizeWorkspaceSlideBandSlots(props.headerSlots),
    footerSlots: sanitizeWorkspaceSlideBandSlots(props.footerSlots),
  };
}

export function setWorkspaceSlideBandVisible(
  props: WorkspaceSlideWidgetProps,
  bandId: WorkspaceSlideBandId,
  visible: boolean,
): WorkspaceSlideWidgetProps {
  switch (bandId) {
    case "header":
      return {
        ...props,
        headerEnabled: visible,
      };
    case "footer":
      return {
        ...props,
        footerEnabled: visible,
      };
    default:
      return props;
  }
}

export function updateWorkspaceSlideBandSlot(
  props: WorkspaceSlideWidgetProps,
  bandId: WorkspaceSlideBandId,
  slotId: WorkspaceSlideBandSlotId,
  slot: WorkspaceSlideSlotContent,
): WorkspaceSlideWidgetProps {
  if (bandId === "header") {
    return {
      ...props,
      headerSlots: {
        ...props.headerSlots,
        [slotId]: sanitizeSlideSlotContent(slot),
      },
    };
  }

  return {
    ...props,
    footerSlots: {
      ...props.footerSlots,
      [slotId]: sanitizeSlideSlotContent(slot),
    },
  };
}

export function extractLegacyWorkspaceSlideChildren(props: unknown): {
  slide: WorkspaceSlideWidgetProps;
  children: LegacyWorkspaceSlideChild[];
} {
  const slide = sanitizeWorkspaceSlideProps(props);

  if (!isPlainRecord(props)) {
    return {
      slide,
      children: [],
    };
  }

  const widgetById = new Map(
    (Array.isArray(props.widgets) ? props.widgets : [])
      .map((widget) => sanitizeEmbeddedWidget(widget))
      .filter((widget): widget is DashboardWidgetInstance => widget !== null)
      .map((widget) => [widget.id, widget] as const),
  );

  const children: LegacyWorkspaceSlideChild[] = [];
  const rawRegions = isPlainRecord(props.regions) ? props.regions : {};

  LEGACY_WORKSPACE_SLIDE_REGION_IDS.forEach((regionId) => {
    const region = isPlainRecord(rawRegions[regionId]) ? rawRegions[regionId] : null;
    const placements = Array.isArray(region?.widgets) ? region.widgets : [];

    placements.forEach((placement) => {
      const rawPlacement = isPlainRecord(placement) ? placement : null;
      const widgetInstanceId =
        rawPlacement && typeof rawPlacement.widgetInstanceId === "string"
          ? rawPlacement.widgetInstanceId.trim()
          : "";

      if (!widgetInstanceId) {
        return;
      }

      const instance = widgetById.get(widgetInstanceId);

      if (!instance) {
        return;
      }

      children.push({
        instance,
        region: regionId,
        layout: sanitizeLegacyLayout(rawPlacement?.layout),
      });
    });
  });

  return {
    slide,
    children,
  };
}
