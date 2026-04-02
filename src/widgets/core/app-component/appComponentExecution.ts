import type {
  WidgetExecutionContext,
  WidgetExecutionDefinition,
  WidgetExecutionResult,
} from "@/widgets/types";

import {
  fetchAppComponentOpenApiDocument,
  submitAppComponentRequest,
} from "./appComponentApi";
import {
  buildAppComponentGeneratedForm,
  buildAppComponentRequest,
  extractAppComponentPublishedOutputs,
  normalizeAppComponentProps,
  normalizeAppComponentRuntimeState,
  resolveAppComponentBoundInputOverlay,
  resolveAppComponentInitialDraftValues,
  resolveAppComponentOperation,
  tryResolveAppComponentBaseUrl,
  type AppComponentWidgetProps,
} from "./appComponentModel";

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
  const normalizedProps = normalizeAppComponentProps(
    (context.targetOverrides?.props ?? context.props) as AppComponentWidgetProps,
  );
  const normalizedRuntimeState = normalizeAppComponentRuntimeState(
    context.targetOverrides?.runtimeState ?? context.runtimeState,
  );
  const resolvedBaseUrl = tryResolveAppComponentBaseUrl(normalizedProps.apiBaseUrl);

  if (!resolvedBaseUrl || !normalizedProps.method || !normalizedProps.path) {
    return buildAppComponentErrorResult(
      normalizedRuntimeState,
      undefined,
      context.targetOverrides?.draftValues ?? normalizedRuntimeState.draftValues ?? {},
      "Select a valid API base URL and operation before executing this widget.",
    );
  }

  let document: Awaited<ReturnType<typeof fetchAppComponentOpenApiDocument>>;

  try {
    document = await fetchAppComponentOpenApiDocument({
      baseUrl: resolvedBaseUrl,
      authMode: normalizedProps.authMode,
    });
  } catch (error) {
    return buildAppComponentErrorResult(
      normalizedRuntimeState,
      undefined,
      context.targetOverrides?.draftValues ?? normalizedRuntimeState.draftValues ?? {},
      error instanceof Error
        ? error.message
        : "Unable to load the configured OpenAPI document.",
    );
  }

  const resolvedOperation = resolveAppComponentOperation(
    document,
    normalizedProps.method,
    normalizedProps.path,
  );
  const generatedForm = buildAppComponentGeneratedForm(
    document,
    resolvedOperation,
    normalizedProps.requestBodyContentType,
  );
  const operationKey = resolvedOperation?.record.key;
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
    resolvedOperation,
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
  getRefreshPolicy: () => "manual-only",
  getExecutionKey: (context) => `app-component:${context.instanceId}`,
} satisfies WidgetExecutionDefinition<AppComponentWidgetProps>;
