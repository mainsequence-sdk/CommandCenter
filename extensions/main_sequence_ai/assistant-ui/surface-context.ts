import { getAppById, getAppSurfaceById } from "@/app/registry";
import type {
  AppSurfaceAssistantContextDetails,
  AppSurfaceAssistantContextInput,
} from "@/apps/types";
import { matchPath } from "react-router-dom";

export interface ResolveChatSurfaceContextInput {
  currentPath: string;
  pathname: string;
  permissionCount: number;
  routeAppId?: string;
  routeSurfaceId?: string;
  role?: string;
  searchParams: URLSearchParams;
  userId?: string;
}

export interface ResolvedChatSurfaceContext {
  appId?: string;
  appTitle?: string;
  availableActions: string[];
  details: Record<string, string>;
  source: "surface" | "route" | "fallback";
  summary: string;
  surfaceId?: string;
  surfaceTitle?: string;
}

function normalizeDetails(details?: AppSurfaceAssistantContextDetails) {
  const entries = Object.entries(details ?? {}).flatMap<[string, string]>(
    ([label, value]) => {
      if (value === undefined || value === null || value === "") {
        return [];
      }

      if (typeof value === "boolean") {
        return [[label, value ? "Yes" : "No"]];
      }

      return [[label, String(value)]];
    },
  );

  return Object.fromEntries(entries);
}

function buildSurfaceAssistantInput(
  input: ResolveChatSurfaceContextInput,
  appId: string,
  surfaceId: string,
): AppSurfaceAssistantContextInput {
  return {
    appId,
    currentPath: input.currentPath,
    pathname: input.pathname,
    permissionCount: input.permissionCount,
    role: input.role,
    searchParams: input.searchParams,
    surfaceId,
    userId: input.userId,
  };
}

function resolveLinkedSurfaceContext(
  input: ResolveChatSurfaceContextInput,
  appId: string,
  surfaceId: string,
  overrides?: {
    availableActions?: string[];
    details?: AppSurfaceAssistantContextDetails;
    summary?: string;
  },
  source: ResolvedChatSurfaceContext["source"] = "surface",
): ResolvedChatSurfaceContext | null {
  const app = getAppById(appId);
  const surface = getAppSurfaceById(appId, surfaceId);

  if (!app || !surface) {
    return null;
  }

  const assistantInput = buildSurfaceAssistantInput(input, appId, surfaceId);
  const resolvedOverride = surface.assistantContext?.resolve?.(assistantInput);
  const summary =
    overrides?.summary ??
    resolvedOverride?.summary ??
    surface.assistantContext?.summary ??
    surface.description;
  const availableActions =
    overrides?.availableActions ??
    resolvedOverride?.availableActions ??
    surface.assistantContext?.availableActions ??
    [];
  const details = normalizeDetails({
    ...(surface.assistantContext?.details ?? {}),
    ...(resolvedOverride?.details ?? {}),
    ...(overrides?.details ?? {}),
  });

  return {
    appId: app.id,
    appTitle: app.title,
    availableActions,
    details,
    source,
    summary,
    surfaceId: surface.id,
    surfaceTitle: surface.title,
  };
}

function resolveSpecialRouteContext(
  input: ResolveChatSurfaceContextInput,
): ResolvedChatSurfaceContext | null {
  const widgetDetailsMatch =
    matchPath("/app/workspace-studio/widget-catalog/:widgetId", input.pathname) ??
    matchPath("/app/widgets/:widgetId", input.pathname);

  if (widgetDetailsMatch) {
    return {
      availableActions: [
        "Inspect widget metadata",
        "Review widget ports and contracts",
        "Review usage guidance",
      ],
      details: normalizeDetails({
        "Widget ID": widgetDetailsMatch.params.widgetId,
      }),
      source: "route",
      summary:
        "User is in Widget Details. This page explains one widget definition, its ports, metadata, and usage guidance.",
    };
  }

  if (matchPath("/app/themes", input.pathname)) {
    return {
      availableActions: [
        "Browse available theme presets",
        "Inspect active theme tokens",
        "Preview visual theme changes",
      ],
      details: {},
      source: "route",
      summary:
        "User is in Theme Studio. This page is used to inspect and preview the shell theme system.",
    };
  }

  if (matchPath("/app/main_sequence_ai/chat", input.pathname)) {
    return {
      availableActions: [
        "Continue a longer assistant conversation",
        "Review shared surface context",
        "Expand or minimize the assistant experience",
      ],
      details: {},
      source: "route",
      summary:
        "User is on the Main Sequence AI chat surface. This page shares the same runtime as the overlay assistant rail.",
    };
  }

  const teamDetailMatch = matchPath("/app/access-rbac/teams/:teamId", input.pathname);

  if (teamDetailMatch) {
    return resolveLinkedSurfaceContext(
      input,
      "access-rbac",
      "teams",
      {
        summary:
          "User is viewing a specific organization team inside Access & RBAC.",
        availableActions: [
          "Review team metadata",
          "Inspect memberships",
          "Manage team sharing and access",
        ],
        details: {
          "Team ID": teamDetailMatch.params.teamId,
          View: "Team detail",
        },
      },
      "route",
    );
  }

  const assetCategoryDetailMatch = matchPath(
    "/app/main_sequence_markets/asset-categories/:categoryId",
    input.pathname,
  );

  if (assetCategoryDetailMatch) {
    return resolveLinkedSurfaceContext(
      input,
      "main_sequence_markets",
      "asset-categories",
      {
        summary:
          "User is viewing one asset category and its nested asset relationships.",
        details: {
          "Category ID": assetCategoryDetailMatch.params.categoryId,
          View: "Asset category detail",
        },
      },
      "route",
    );
  }

  const translationTableDetailMatch = matchPath(
    "/app/main_sequence_markets/asset-translation-tables/:tableId",
    input.pathname,
  );

  if (translationTableDetailMatch) {
    return resolveLinkedSurfaceContext(
      input,
      "main_sequence_markets",
      "asset-translation-tables",
      {
        summary:
          "User is viewing one asset translation table and its rule set.",
        details: {
          "Table ID": translationTableDetailMatch.params.tableId,
          View: "Translation table detail",
        },
      },
      "route",
    );
  }

  const executionVenueDetailMatch = matchPath(
    "/app/main_sequence_markets/execution-venues/:venueId",
    input.pathname,
  );

  if (executionVenueDetailMatch) {
    return resolveLinkedSurfaceContext(
      input,
      "main_sequence_markets",
      "execution-venues",
      {
        summary:
          "User is viewing one execution venue and its editable metadata.",
        details: {
          "Venue ID": executionVenueDetailMatch.params.venueId,
          View: "Execution venue detail",
        },
      },
      "route",
    );
  }

  const portfolioGroupDetailMatch = matchPath(
    "/app/main_sequence_markets/portfolio-groups/:groupId",
    input.pathname,
  );

  if (portfolioGroupDetailMatch) {
    return resolveLinkedSurfaceContext(
      input,
      "main_sequence_markets",
      "portfolio-groups",
      {
        summary:
          "User is viewing one portfolio group and its linked portfolio state.",
        details: {
          "Portfolio Group ID": portfolioGroupDetailMatch.params.groupId,
          View: "Portfolio group detail",
        },
      },
      "route",
    );
  }

  const clusterDetailMatch = matchPath("/clusters/:clusterId", input.pathname);

  if (clusterDetailMatch) {
    return resolveLinkedSurfaceContext(
      input,
      "main_sequence_workbench",
      "clusters",
      {
        summary:
          "User is viewing a specific Main Sequence Foundry cluster.",
        details: {
          "Cluster ID": clusterDetailMatch.params.clusterId,
          View: "Cluster detail",
        },
      },
      "route",
    );
  }

  return null;
}

export function resolveChatSurfaceContext(
  input: ResolveChatSurfaceContextInput,
): ResolvedChatSurfaceContext {
  const routeContext = resolveSpecialRouteContext(input);

  if (routeContext) {
    return routeContext;
  }

  if (input.routeAppId && input.routeSurfaceId) {
    const linkedSurfaceContext = resolveLinkedSurfaceContext(
      input,
      input.routeAppId,
      input.routeSurfaceId,
      undefined,
      "surface",
    );

    if (linkedSurfaceContext) {
      return linkedSurfaceContext;
    }
  }

  return {
    appId: input.routeAppId,
    availableActions: [],
    details: {},
    source: "fallback",
    summary:
      "User is on a shell route that does not yet provide assistant-facing surface context metadata.",
    surfaceId: input.routeSurfaceId,
  };
}
