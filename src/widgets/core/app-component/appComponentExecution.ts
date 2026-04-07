import { buildDashboardExecutionRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import type {
  WidgetExecutionContext,
  WidgetExecutionDefinition,
  WidgetExecutionResult,
} from "@/widgets/types";

import {
  APP_COMPONENT_SAFE_RESPONSE_CACHE_TTL_MS,
  fetchAppComponentOpenApiDocument,
  submitAppComponentRequest,
} from "./appComponentApi";
import {
  buildAppComponentGeneratedForm,
  buildAppComponentOperationKey,
  buildAppComponentRequest,
  extractAppComponentPublishedOutputs,
  normalizeAppComponentProps,
  normalizeAppComponentRuntimeState,
  hasAppComponentDiscoveryTarget,
  resolveAppComponentEditableFormPublishedOutputs,
  resolveAppComponentEditableFormSessionFromResponse,
  resolveAppComponentBoundInputOverlay,
  resolveAppComponentEffectiveOperationKey,
  resolveAppComponentInitialDraftValues,
  resolveAppComponentMappedRequestForms,
  resolveAppComponentOperation,
  resolveAppComponentResponseUiEditableFormDescriptor,
  resolveAppComponentRuntimeGeneratedForm,
  resolveAppComponentDisplayBaseUrl,
  resolveAppComponentRequestBaseUrl,
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
      lastExecutedAtMs: undefined,
      lastRequestUrl: undefined,
      lastResponseStatus: undefined,
      lastResponseStatusText: undefined,
      lastResponseHeaders: undefined,
      lastResponseBody: undefined,
      publishedOutputs: undefined,
      editableFormSession: undefined,
      error,
    },
    error,
  };
}

async function resolveLiveAppComponentExecutionArtifacts(
  props: AppComponentWidgetProps,
) {
  const fallbackForm = resolveAppComponentRuntimeGeneratedForm(props);
  const resolvedBaseUrl = resolveAppComponentRequestBaseUrl(props);

  if (!resolvedBaseUrl || !props.method || !props.path) {
    return {
      form: fallbackForm,
      document: null,
      resolvedOperation: null,
    };
  }

  try {
    const document = await fetchAppComponentOpenApiDocument({
      props,
    });
    const resolvedOperation = resolveAppComponentOperation(
      document,
      props.method,
      props.path,
    );
    const liveForm = buildAppComponentGeneratedForm(
      document,
      resolvedOperation,
      props.requestBodyContentType,
    );

    return {
      form: liveForm ?? fallbackForm,
      document,
      resolvedOperation,
    };
  } catch {
    return {
      form: fallbackForm,
      document: null,
      resolvedOperation: null,
    };
  }
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
  const resolvedBaseUrl = resolveAppComponentRequestBaseUrl(normalizedProps);
  const displayBaseUrl = resolveAppComponentDisplayBaseUrl(normalizedProps);
  const executionArtifacts = await resolveLiveAppComponentExecutionArtifacts(normalizedProps);
  const generatedForm = executionArtifacts.form;
  const mappedRequestForms = resolveAppComponentMappedRequestForms(generatedForm, normalizedProps);
  const submissionForm = mappedRequestForms.submissionForm;
  const operationKey = resolveAppComponentEffectiveOperationKey(normalizedProps) ??
    (normalizedProps.method && normalizedProps.path
      ? buildAppComponentOperationKey(normalizedProps.method, normalizedProps.path)
      : undefined);

  if (!resolvedBaseUrl || !normalizedProps.method || !normalizedProps.path) {
    return buildAppComponentErrorResult(
      normalizedRuntimeState,
      operationKey,
      context.targetOverrides?.draftValues ?? normalizedRuntimeState.draftValues ?? {},
      displayBaseUrl
        ? "Select an API operation before executing this widget."
        : "Select a valid API base URL or Main Sequence resource release and operation before executing this widget.",
    );
  }

  if (!submissionForm) {
    return buildAppComponentErrorResult(
      normalizedRuntimeState,
      operationKey,
      context.targetOverrides?.draftValues ?? normalizedRuntimeState.draftValues ?? {},
      "This widget runtime is missing both its compiled request form and enough saved binding metadata to rebuild one.",
    );
  }
  const initialDraftValues = resolveAppComponentInitialDraftValues(
    submissionForm,
    normalizedRuntimeState,
    operationKey,
    {
      prefillValues: mappedRequestForms.prefillValues,
    },
  );
  const requestedDraftValues = {
    ...initialDraftValues,
    ...(normalizedRuntimeState.draftValues ?? {}),
    ...(context.targetOverrides?.draftValues ?? {}),
  };
  const boundInputOverlay = resolveAppComponentBoundInputOverlay(
    submissionForm,
    requestedDraftValues,
    context.resolvedInputs,
  );
  const effectiveDraftValues = boundInputOverlay.values;
  const buildResult = buildAppComponentRequest(
    normalizedProps,
    submissionForm,
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
      transportProps: normalizedProps,
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

    const editableFormSession =
      response.ok &&
      executionArtifacts.document &&
      executionArtifacts.resolvedOperation
        ? resolveAppComponentEditableFormSessionFromResponse({
            responseBody: response.body,
            operationKey,
            previousSession: normalizedRuntimeState.editableFormSession,
            responseUiDescriptor: resolveAppComponentResponseUiEditableFormDescriptor(
              executionArtifacts.document,
              executionArtifacts.resolvedOperation,
            ),
          })
        : undefined;
    const publishedOutputs = response.ok
      ? editableFormSession
        ? resolveAppComponentEditableFormPublishedOutputs(editableFormSession)
        : extractAppComponentPublishedOutputs(
            response.body,
            normalizedProps.bindingSpec,
          )
      : undefined;

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
        editableFormSession,
        error:
          response.ok
            ? undefined
            : typeof response.body === "string"
              ? response.body
              : `Request failed with ${response.status}.`,
        publishedOutputs,
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
      hasAppComponentDiscoveryTarget(normalizedProps) &&
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
