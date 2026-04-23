import { Braces } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { resolveAppComponentWidgetIo } from "./appComponentDynamicIo";
import { appComponentExecutionDefinition } from "./appComponentExecution";
import { AppComponentRailSummary } from "./AppComponentRailSummary";
import { AppComponentWidget } from "./AppComponentWidget";
import { AppComponentWidgetSettings } from "./AppComponentWidgetSettings";
import {
  normalizeAppComponentRuntimeState,
  type AppComponentWidgetProps,
} from "./appComponentModel";

export const appComponentWidget = defineWidget<AppComponentWidgetProps>({
  id: "app-component",
  widgetVersion: "1.1.0",
  title: "AppComponent",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
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
    apiTargetMode: "mock-json",
    method: "post",
    path: "/mock",
    requestBodyContentType: "application/json",
    mockJson: {
      version: 1,
      operation: {
        method: "post",
        path: "/mock",
        summary: "Inline mock notification",
        ui: {
          role: "async-select-search",
          widget: "select2",
          selectionType: "single",
          searchParam: "country_search",
          searchParamAliases: ["country_query"],
          itemsPath: "items",
          itemValueField: "code",
          itemLabelField: "label",
        },
      },
      request: {
        parameters: [
          {
            name: "country_search",
            in: "query",
            description: "Search countries for the custom select input.",
            required: false,
            schema: {
              type: "string",
            },
          },
          {
            name: "country_query",
            in: "query",
            description: "Alias for the country search term.",
            required: false,
            schema: {
              type: "string",
            },
          },
          {
            name: "page",
            in: "query",
            description: "Mock lookup pagination page.",
            required: false,
            schema: {
              type: "integer",
            },
          },
          {
            name: "limit",
            in: "query",
            description: "Mock lookup pagination size.",
            required: false,
            schema: {
              type: "integer",
            },
          },
        ],
        bodyContentType: "application/json",
        bodySchema: {
          type: "object",
          properties: {
            note: {
              type: "string",
              title: "Note",
              description: "Optional note sent with the mock request.",
            },
          },
        },
      },
      response: {
        status: 200,
        contentType: "application/json",
        body: {
          title: "Action completed",
          message: "This is a mock AppComponent notification response.",
          tone: "success",
          details:
            "Use this inline target to prototype response rendering and downstream widget bindings before a real API exists.",
          items: [
            {
              code: "AT",
              label: "Austria",
            },
            {
              code: "DE",
              label: "Germany",
            },
            {
              code: "CH",
              label: "Switzerland",
            },
          ],
        },
        ui: {
          role: "notification",
          widget: "banner-v1",
        },
      },
    },
    showHeader: true,
    showResponse: true,
    hideRequestButton: false,
    requestButtonLabel: "Submit",
    refreshOnDashboardRefresh: true,
  },
  settingsComponent: AppComponentWidgetSettings,
  showRawPropsEditor: false,
  workspaceIcon: Braces,
  railSummaryComponent: AppComponentRailSummary,
  buildAgentSnapshot: ({ props, runtimeState }) => {
    const normalizedRuntimeState = normalizeAppComponentRuntimeState(runtimeState);

    return {
      displayKind: "form",
      state:
        normalizedRuntimeState.status === "submitting"
          ? "loading"
          : normalizedRuntimeState.status === "error"
            ? "error"
            : normalizedRuntimeState.lastResponseStatus || normalizedRuntimeState.editableFormSession
              ? "ready"
              : "idle",
      summary:
        normalizedRuntimeState.status === "error"
          ? normalizedRuntimeState.error || "AppComponent request failed."
          : normalizedRuntimeState.lastResponseStatus
            ? `AppComponent last responded with ${normalizedRuntimeState.lastResponseStatus}.`
            : "AppComponent is configured and waiting for execution.",
      data: {
        apiTargetMode: props.apiTargetMode ?? "manual",
        method: props.method ?? "get",
        path: props.path ?? "",
        authMode: props.authMode ?? "session-jwt",
        operationKey: normalizedRuntimeState.operationKey,
        lastExecutedAtMs: normalizedRuntimeState.lastExecutedAtMs,
        lastRequestUrl: normalizedRuntimeState.lastRequestUrl,
        lastResponseStatus: normalizedRuntimeState.lastResponseStatus,
        lastResponseStatusText: normalizedRuntimeState.lastResponseStatusText,
        error: normalizedRuntimeState.error,
        draftValues: normalizedRuntimeState.draftValues,
        lastResponseBody: normalizedRuntimeState.lastResponseBody,
        editableFormSession: normalizedRuntimeState.editableFormSession,
      },
    };
  },
  resolveIo: ({ props, runtimeState }) => resolveAppComponentWidgetIo(props, runtimeState),
  execution: appComponentExecutionDefinition,
  workspaceRuntimeMode: "execution-owner",
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Builds one request widget from a selected OpenAPI operation, then stores the compiled binding spec and any supported request/response UI metadata behavior in widget props.",
      fields: [
        {
          id: "apiTargetMode",
          label: "Target mode",
          type: "enum",
          required: true,
          source: "custom-settings",
          description: "Choose a manual base URL, a Main Sequence FastAPI resource release, or an inline Mock JSON target.",
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
          id: "mockJson",
          label: "Mock JSON definition",
          type: "object",
          source: "custom-settings",
          description: "Inline synthetic API definition used when the target mode is Mock JSON.",
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
        "The exact request fields, response ports, and supported request/response UI metadata are compiled from the selected OpenAPI operation and saved into bindingSpec request/response contracts.",
      requiredSetupSteps: [
        "Choose a target mode and valid API target or mock definition.",
        "Load OpenAPI discovery and select one operation.",
        "Save the compiled binding spec before using the widget on runtime surfaces.",
      ],
      configurationNotes: [
        "Runtime still prefers live or synthetic OpenAPI metadata when it is available, but the saved binding spec remains the canonical contract for dynamic IO.",
        "Operation-level request UI metadata can replace standard generated inputs with supported widget-specific controls.",
        "Primary response-schema UI metadata can replace the generic response viewer with supported response-side UI such as notification banners or editable forms.",
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
        "Inputs and outputs are generated from the compiled binding spec for the selected OpenAPI operation, with rendering optionally enriched by supported OpenAPI UI metadata.",
      dynamicIoSummary:
        "Concrete request input ports and response output ports depend on the saved bindingSpec for the authored operation, while request-side operation UI metadata and response-side schema UI metadata can alter how those contracts render.",
      ioNotes: [
        "Type-level registry metadata explains the dynamic contract, but exact ports remain instance-specific.",
        "Request-side UI metadata lives on the selected operation and can swap supported generated request controls.",
        "Response-side UI metadata lives on the primary response schema and can swap supported response renderers without changing the published outputs.",
      ],
    },
    capabilities: {
      supportedTargetModes: ["manual", "main-sequence-resource-release", "mock-json"],
      supportedAuthModes: ["session-jwt", "none"],
      requestInputLocations: ["path", "query", "header", "body"],
      requestFormSource: "openapi-binding-spec",
      responsePublication: ["status", "headers", "body", "publishedOutputs"],
      supportedRequestUiMetadata: [
        "operation:x-ui-widget=select2 with x-ui-role=async-select-search",
      ],
      supportedResponseUiMetadata: [
        "response:x-ui-role=notification with x-ui-widget=banner-v1",
        "response:x-ui-role=editable-form with x-ui-widget=definition-v1",
      ],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
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
      {
        label: "Inline mock request",
        summary: "Compiles one synthetic endpoint locally and publishes its configured response.",
        props: {
          apiTargetMode: "mock-json",
          refreshOnDashboardRefresh: true,
        },
      },
    ],
  },
  component: AppComponentWidget,
});
