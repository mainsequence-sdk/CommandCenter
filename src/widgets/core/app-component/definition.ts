import { Braces } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { resolveAppComponentWidgetIo } from "./appComponentDynamicIo";
import { appComponentExecutionDefinition } from "./appComponentExecution";
import { AppComponentRailSummary } from "./AppComponentRailSummary";
import { AppComponentWidget } from "./AppComponentWidget";
import { AppComponentWidgetSettings } from "./AppComponentWidgetSettings";
import type { AppComponentWidgetProps } from "./appComponentModel";

export const appComponentWidget = defineWidget<AppComponentWidgetProps>({
  id: "app-component",
  title: "AppComponent",
  description:
    "OpenAPI-driven request form widget that discovers one route and submits requests with the current session JWT by default.",
  category: "API",
  kind: "custom",
  source: "core",
  defaultSize: { w: 8, h: 8 },
  responsive: {
    minWidthPx: 420,
  },
  requiredPermissions: ["dashboard:view"],
  tags: ["openapi", "swagger", "api", "forms", "requests"],
  exampleProps: {
    apiBaseUrl: "",
    authMode: "session-jwt",
    showHeader: true,
    refreshOnDashboardRefresh: true,
  },
  mockProps: {
    apiBaseUrl: "",
    authMode: "session-jwt",
    method: "post",
    path: "/price/swap",
    requestBodyContentType: "application/json",
    showHeader: true,
    refreshOnDashboardRefresh: true,
  },
  settingsComponent: AppComponentWidgetSettings,
  showRawPropsEditor: false,
  railIcon: Braces,
  railSummaryComponent: AppComponentRailSummary,
  resolveIo: ({ props }) => resolveAppComponentWidgetIo(props),
  execution: appComponentExecutionDefinition,
  component: AppComponentWidget,
});
