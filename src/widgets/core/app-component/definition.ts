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
    "OpenAPI-driven request form widget that discovers one route and can run either against a manual service URL or a Main Sequence FastAPI resource release.",
  category: "Core",
  kind: "custom",
  source: "core",
  defaultSize: { w: 8, h: 8 },
  responsive: {
    minWidthPx: 420,
  },
  requiredPermissions: ["workspaces:view"],
  tags: ["openapi", "swagger", "api", "forms", "requests"],
  exampleProps: {
    apiTargetMode: "manual",
    apiBaseUrl: "",
    authMode: "session-jwt",
    showHeader: true,
    showResponse: false,
    hideRequestButton: false,
    requestButtonLabel: "Submit",
    refreshOnDashboardRefresh: true,
  },
  mockProps: {
    apiTargetMode: "manual",
    apiBaseUrl: "",
    authMode: "session-jwt",
    method: "post",
    path: "/price/swap",
    requestBodyContentType: "application/json",
    showHeader: true,
    showResponse: false,
    hideRequestButton: false,
    requestButtonLabel: "Submit",
    refreshOnDashboardRefresh: true,
  },
  settingsComponent: AppComponentWidgetSettings,
  showRawPropsEditor: false,
  workspaceIcon: Braces,
  railSummaryComponent: AppComponentRailSummary,
  resolveIo: ({ props, runtimeState }) => resolveAppComponentWidgetIo(props, runtimeState),
  execution: appComponentExecutionDefinition,
  workspaceRuntimeMode: "execution-owner",
  component: AppComponentWidget,
});
