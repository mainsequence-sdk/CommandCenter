import { Cable } from "lucide-react";

import type { AppExtension } from "@/app/registry/types";
import { defineSurfaceAssistantContext, type AppDefinition } from "@/apps/types";
import { PLATFORM_ADMIN_PERMISSION } from "@/auth/permissions";
import {
  ConnectionDataSourcesPage,
  ConnectionsAddNewPage,
  ConnectionsExplorePage,
} from "@/extensions/core/apps/connections/ConnectionsPage";

const connectionsSection = {
  id: "connections",
  label: "Connections",
  description: "Connection registry and configured data-source instances.",
  order: 10,
};

const connectionsApp: AppDefinition = {
  id: "connections",
  title: "Connections",
  description: "Platform-admin connection registry and backend-owned data-source instances.",
  source: "connections",
  icon: Cable,
  navigationOrder: 500,
  topNavigationStyle: "hidden",
  requiredPermissions: [PLATFORM_ADMIN_PERMISSION],
  permissionDefinitions: [
    {
      id: PLATFORM_ADMIN_PERMISSION,
      label: "Platform admin / access",
      description: "Open platform-level admin settings and diagnostics.",
      category: "Shell",
    },
  ],
  defaultSurfaceId: "add-new-connection",
  surfaces: [
    {
      id: "add-new-connection",
      title: "Add A New Connection",
      navLabel: "Add A New Connection",
      description:
        "Browse backend-synced connection types and create configured data sources.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Add A New Connection. This page shows backend-synced connection types and a generic data-source creation form.",
        availableActions: [
          "Search synced connection types",
          "Select a connection type",
          "Create a configured data source",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: [PLATFORM_ADMIN_PERMISSION],
      navigationSection: connectionsSection,
      component: ConnectionsAddNewPage,
    },
    {
      id: "data-sources",
      title: "Data Sources",
      navLabel: "Data Sources",
      description:
        "List backend-owned configured data-source instances available to widgets.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Data Sources. This page shows configured backend-owned connection instances.",
        availableActions: [
          "Review configured data sources",
          "Inspect instance type and status",
          "Confirm default and system fallback instances",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: [PLATFORM_ADMIN_PERMISSION],
      navigationSection: connectionsSection,
      component: ConnectionDataSourcesPage,
    },
    {
      id: "explore",
      title: "Explore",
      navLabel: "Explore",
      description:
        "Run live query requests against configured data-source instances.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Explore. This page runs live query requests against configured data sources.",
        availableActions: [
          "Select a configured data source",
          "Use the selected connection type's Explore editor",
          "Run a connection query",
          "Inspect the normalized response",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: [PLATFORM_ADMIN_PERMISSION],
      navigationSection: connectionsSection,
      component: ConnectionsExplorePage,
    },
  ],
};

const connectionsExtension: AppExtension = {
  id: "connections",
  title: "Connections",
  description: "Connection registry and configured data-source management surfaces.",
  apps: [connectionsApp],
};

export default connectionsExtension;
