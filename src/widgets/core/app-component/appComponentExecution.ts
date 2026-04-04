import { buildDashboardExecutionRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import type {
  WidgetExecutionContext,
  WidgetExecutionDefinition,
  WidgetExecutionResult,
} from "@/widgets/types";

import {
  APP_COMPONENT_SAFE_RESPONSE_CACHE_TTL_MS,
  submitAppComponentRequest,
} from "./appComponentApi";
import {
  buildAppComponentOperationKey,
  buildAppComponentRequest,
  extractAppComponentPublishedOutputs,
  normalizeAppComponentProps,
  normalizeAppComponentRuntimeState,
  resolveAppComponentBoundInputOverlay,
  resolveAppComponentEffectiveOperationKey,
  resolveAppComponentInitialDraftValues,
  resolveAppComponentRuntimeGeneratedForm,
  tryResolveAppComponentBaseUrl,
  type AppComponentWidgetProps,
} from "./appComponentModel";

function shouldUseCachedAppComponentResponse(reason: WidgetExecutionContext["reason"]) {
  return reason === "dashboard-refresh" || reason === "manual-recalculate";
}

function buildAppComponentErrorResult(
  runtimeState: Record<string, unknown> | undefined,
  operationKey: string | undefined,
  draftValues: Record<string, string>,
  error: string,
): WidgetExecutionResult {
  return {
    status: "error",
    runtimeStatePatch: {
      ...normalizeAppComponentRuntimeState(runtimeState),
      operationKey,
      draftValues,
      status: "error",
      error,
    },
    error,
  };
}

export async function executeAppComponent(
  context: WidgetExecutionContext<AppComponentWidgetProps>,
): Promise<WidgetExecutionResult> {
  const requestTraceMeta = buildDashboardExecutionRequestTraceMeta(context);
  const normalizedProps = normalizeAppComponentProps(
    (context.targetOverrides?.props ?? context.props) as AppComponentWidgetProps,
  );
  const normalizedRuntimeState = normalizeAppComponentRuntimeState(
    context.targetOverrides?.runtimeState ?? context.runtimeState,
  );
  const resolvedBaseUrl = tryResolveAppComponentBaseUrl(normalizedProps.apiBaseUrl);
  const generatedForm = resolveAppComponentRuntimeGeneratedForm(normalizedProps);
  const operationKey = resolveAppComponentEffectiveOperationKey(normalizedProps) ??
    (normalizedProps.method && normalizedProps.path
      ? buildAppComponentOperationKey(normalizedProps.method, normalizedProps.path)
      : undefined);

  if (!resolvedBaseUrl || !normalizedProps.method || !normalizedProps.path) {
    return buildAppComponentErrorResult(
      normalizedRuntimeState,
      operationKey,
      context.targetOverrides?.draftValues ?? normalizedRuntimeState.draftValues ?? {},
      "Select a valid API base URL and operation before executing this widget.",
    );
  }

  if (!generatedForm) {
    return buildAppComponentErrorResult(
      normalizedRuntimeState,
      operationKey,
      context.targetOverrides?.draftValues ?? normalizedRuntimeState.draftValues ?? {},
      "This widget runtime is missing both its compiled request form and enough saved binding metadata to rebuild one.",
    );
  }
  const initialDraftValues = resolveAppComponentInitialDraftValues(
    generatedForm,
    normalizedRuntimeState,
    operationKey,
  );
  const requestedDraftValues = {
    ...initialDraftValues,
    ...(normalizedRuntimeState.draftValues ?? {}),
    ...(context.targetOverrides?.draftValues ?? {}),
  };
  const boundInputOverlay = resolveAppComponentBoundInputOverlay(
    generatedForm,
    requestedDraftValues,
    context.resolvedInputs,
  );
  const effectiveDraftValues = boundInputOverlay.values;
  const buildResult = buildAppComponentRequest(
    normalizedProps,
    generatedForm,
    effectiveDraftValues,
  );

  if (!buildResult.request) {
    return buildAppComponentErrorResult(
      normalizedRuntimeState,
      operationKey,
      effectiveDraftValues,
      buildResult.errors.join(" "),
    );
  }

  try {
    const response = await submitAppComponentRequest({
      authMode: normalizedProps.authMode,
      method: buildResult.request.method,
      url: buildResult.request.url,
      headers: buildResult.request.headers,
      body: buildResult.request.body,
      cache: {
        enabled: shouldUseCachedAppComponentResponse(context.reason),
        ttlMs: APP_COMPONENT_SAFE_RESPONSE_CACHE_TTL_MS,
      },
      traceMeta: requestTraceMeta,
    });

    return {
      status: response.ok ? "success" : "error",
      runtimeStatePatch: {
        operationKey,
        draftValues: effectiveDraftValues,
        status: response.ok ? "success" : "error",
        lastExecutedAtMs: Date.now(),
        lastRequestUrl: response.url,
        lastResponseStatus: response.status,
        lastResponseStatusText: response.statusText,
        lastResponseHeaders: response.headers,
        lastResponseBody: response.body,
        error:
          response.ok
            ? undefined
            : typeof response.body === "string"
              ? response.body
              : `Request failed with ${response.status}.`,
        publishedOutputs: response.ok
          ? extractAppComponentPublishedOutputs(
              response.body,
              normalizedProps.bindingSpec,
            )
          : undefined,
      },
      error:
        response.ok
          ? undefined
          : typeof response.body === "string"
            ? response.body
            : `Request failed with ${response.status}.`,
    };
  } catch (error) {
    return buildAppComponentErrorResult(
      normalizedRuntimeState,
      operationKey,
      effectiveDraftValues,
      error instanceof Error
        ? error.message
        : "The request failed before the API returned a response.",
    );
  }
}

export const appComponentExecutionDefinition = {
  canExecute: (context) => {
    const normalizedProps = normalizeAppComponentProps(
      (context.targetOverrides?.props ?? context.props) as AppComponentWidgetProps,
    );

    return Boolean(
      tryResolveAppComponentBaseUrl(normalizedProps.apiBaseUrl) &&
        normalizedProps.method &&
        normalizedProps.path,
    );
  },
  execute: executeAppComponent,
  getRefreshPolicy: (context) => {
    const normalizedProps = normalizeAppComponentProps(
      (context.targetOverrides?.props ?? context.props) as AppComponentWidgetProps,
    );

    return normalizedProps.refreshOnDashboardRefresh !== false
      ? "allow-refresh"
      : "manual-only";
  },
  getExecutionKey: (context) => `app-component:${context.instanceId}`,
} satisfies WidgetExecutionDefinition<AppComponentWidgetProps>;
