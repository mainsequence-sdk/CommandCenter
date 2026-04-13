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
  widgetVersion: "1.0.0",
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
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Builds one request widget from a selected OpenAPI operation, then stores the compiled binding spec in widget props.",
      fields: [
        {
          id: "apiTargetMode",
          label: "Target mode",
          type: "enum",
          required: true,
          source: "custom-settings",
          description: "Choose manual base URL or a Main Sequence FastAPI resource release.",
        },
        {
          id: "apiBaseUrl",
          label: "API base URL",
          type: "url",
          source: "custom-settings",
          description: "Manual target base URL used for OpenAPI discovery and request execution.",
        },
        {
          id: "mainSequenceResourceRelease",
          label: "Resource release",
          type: "resource-release-ref",
          source: "custom-settings",
          description: "Selected Main Sequence FastAPI resource release for exchange-launch transport.",
        },
        {
          id: "authMode",
          label: "Auth mode",
          type: "enum",
          source: "custom-settings",
          description: "Controls whether requests use the current session JWT or no auth.",
        },
        {
          id: "bindingSpec",
          label: "Compiled binding spec",
          type: "compiled-binding",
          required: true,
          source: "custom-settings",
          description: "Saved operation contract generated from OpenAPI discovery and route selection.",
        },
        {
          id: "requestInputMap",
          label: "Request input map",
          type: "object",
          source: "custom-settings",
          description: "Controls visible fields, labels, and prefills for generated request inputs.",
        },
      ],
      dynamicConfigSummary:
        "The exact request fields and response ports are compiled from the selected OpenAPI operation and saved into bindingSpec.requestForm and bindingSpec port specs.",
      requiredSetupSteps: [
        "Choose a target mode and valid API target.",
        "Load OpenAPI discovery and select one operation.",
        "Save the compiled binding spec before using the widget on runtime surfaces.",
      ],
      configurationNotes: [
        "Runtime no longer performs OpenAPI discovery. The saved binding spec is the canonical contract.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["manual-submit", "dashboard-refresh", "settings-test"],
      executionSummary:
        "Owns canonical API execution for the selected operation and publishes response-derived runtime outputs.",
      notes: [
        "Dashboard refresh only executes when the saved widget instance is configured to refresh on dashboard refresh.",
      ],
    },
    io: {
      mode: "dynamic",
      summary:
        "Inputs and outputs are generated from the compiled binding spec for the selected OpenAPI operation.",
      dynamicIoSummary:
        "Concrete request input ports and response output ports depend on the saved bindingSpec for the authored operation.",
      ioNotes: [
        "Type-level registry metadata explains the dynamic contract, but exact ports remain instance-specific.",
      ],
    },
    capabilities: {
      supportedTargetModes: ["manual", "main-sequence-resource-release"],
      supportedAuthModes: ["session-jwt", "none"],
      requestInputLocations: ["path", "query", "header", "body"],
      requestFormSource: "openapi-binding-spec",
      responsePublication: ["status", "headers", "body", "publishedOutputs"],
    },
    agentHints: {
      buildPurpose:
        "Use this widget when a workspace needs to call one HTTP endpoint from an OpenAPI-described service and expose the result to users or downstream bindings.",
      whenToUse: [
        "Use when the service is OpenAPI-described and one selected operation is the unit of work.",
        "Use when the request should be executable from the workspace refresh/runtime layer.",
      ],
      whenNotToUse: [
        "Do not use when the request is a static data source better modeled as a Data Node.",
        "Do not use when the service has no stable OpenAPI discovery path or release target.",
      ],
      authoringSteps: [
        "Select target mode and valid service target.",
        "Discover OpenAPI and choose one operation.",
        "Review generated request inputs and save the compiled binding spec.",
      ],
      blockingRequirements: [
        "A saved bindingSpec is required before the widget can execute meaningfully at runtime.",
      ],
      commonPitfalls: [
        "Changing the target or operation without recompiling the binding spec leaves the runtime contract stale.",
      ],
    },
    examples: [
      {
        label: "Manual service request",
        summary: "Calls one manual API base URL using the current session JWT.",
        props: {
          apiTargetMode: "manual",
          authMode: "session-jwt",
          refreshOnDashboardRefresh: true,
        },
      },
    ],
  },
  component: AppComponentWidget,
});
