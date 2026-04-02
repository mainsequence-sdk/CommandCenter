import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useResolvedWidgetInputs } from "@/dashboards/DashboardWidgetDependencies";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  buildAppComponentOpenApiQueryKey,
  fetchAppComponentOpenApiDocument,
  submitAppComponentRequest,
} from "./appComponentApi";
import { AppComponentFormSections } from "./AppComponentFormSections";
import {
  buildAppComponentRequest,
  buildAppComponentGeneratedForm,
  extractAppComponentPublishedOutputs,
  normalizeAppComponentProps,
  normalizeAppComponentRuntimeState,
  resolveAppComponentBoundInputOverlay,
  resolveAppComponentInitialDraftValues,
  resolveAppComponentOperation,
  tryResolveAppComponentBaseUrl,
  type AppComponentWidgetProps,
  type AppComponentWidgetRuntimeState,
} from "./appComponentModel";

type Props = WidgetComponentProps<AppComponentWidgetProps>;

function AppComponentPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center p-4 md:p-5">
      <div className="max-w-lg space-y-4 rounded-[calc(var(--radius)-4px)] border border-dashed border-border/70 bg-background/24 px-5 py-6 text-center">
        <div className="space-y-2">
          <div className="text-base font-semibold text-foreground">{title}</div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function AppComponentWidget({
  instanceId,
  props,
  runtimeState,
  onRuntimeStateChange,
}: Props) {
  const normalizedProps = useMemo(() => normalizeAppComponentProps(props), [props]);
  const resolvedInputs = useResolvedWidgetInputs(instanceId);
  const normalizedRuntimeState = useMemo(
    () => normalizeAppComponentRuntimeState(runtimeState),
    [runtimeState],
  );
  const resolvedBaseUrl = useMemo(
    () => tryResolveAppComponentBaseUrl(normalizedProps.apiBaseUrl),
    [normalizedProps.apiBaseUrl],
  );
  const openApiQuery = useQuery({
    queryKey: buildAppComponentOpenApiQueryKey(
      resolvedBaseUrl,
      normalizedProps.authMode ?? "session-jwt",
    ),
    queryFn: () =>
      fetchAppComponentOpenApiDocument({
        baseUrl: resolvedBaseUrl ?? "",
        authMode: normalizedProps.authMode,
      }),
    enabled: resolvedBaseUrl !== null,
    staleTime: 300_000,
  });
  const resolvedOperation = useMemo(
    () =>
      openApiQuery.data
        ? resolveAppComponentOperation(
            openApiQuery.data,
            normalizedProps.method,
            normalizedProps.path,
          )
        : null,
    [normalizedProps.method, normalizedProps.path, openApiQuery.data],
  );
  const generatedForm = useMemo(
    () =>
      openApiQuery.data
        ? buildAppComponentGeneratedForm(
            openApiQuery.data,
            resolvedOperation,
            normalizedProps.requestBodyContentType,
          )
        : null,
    [normalizedProps.requestBodyContentType, openApiQuery.data, resolvedOperation],
  );
  const initialDraftValues = useMemo(
    () =>
      resolveAppComponentInitialDraftValues(
        generatedForm,
        normalizedRuntimeState,
        resolvedOperation?.record.key,
      ),
    [generatedForm, normalizedRuntimeState, resolvedOperation?.record.key],
  );
  const initialDraftValuesKey = useMemo(
    () => JSON.stringify(initialDraftValues),
    [initialDraftValues],
  );
  const [draftValues, setDraftValues] = useState<Record<string, string>>(initialDraftValues);
  const [localRuntimeState, setLocalRuntimeState] =
    useState<AppComponentWidgetRuntimeState>(normalizedRuntimeState);
  const boundInputOverlay = useMemo(
    () => resolveAppComponentBoundInputOverlay(generatedForm, draftValues, resolvedInputs),
    [draftValues, generatedForm, resolvedInputs],
  );
  const effectiveDraftValues = boundInputOverlay.values;
  const boundFieldKeys = boundInputOverlay.boundFieldKeys;

  useEffect(() => {
    setDraftValues(initialDraftValues);
  }, [initialDraftValuesKey]);

  useEffect(() => {
    setLocalRuntimeState(normalizedRuntimeState);
  }, [runtimeState]);

  function commitRuntimeState(nextState: AppComponentWidgetRuntimeState) {
    setLocalRuntimeState(nextState);
    onRuntimeStateChange?.(nextState);
  }

  function updateDraftValue(fieldKey: string, nextValue: string) {
    setDraftValues((current) => {
      const nextDraftValues = {
        ...current,
        [fieldKey]: nextValue,
      };

      commitRuntimeState({
        ...localRuntimeState,
        operationKey: resolvedOperation?.record.key,
        draftValues: nextDraftValues,
      });

      return nextDraftValues;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const buildResult = buildAppComponentRequest(
      normalizedProps,
      resolvedOperation,
      generatedForm,
      effectiveDraftValues,
    );

    if (!buildResult.request) {
      commitRuntimeState({
        ...localRuntimeState,
        operationKey: resolvedOperation?.record.key,
        draftValues,
        status: "error",
        error: buildResult.errors.join(" "),
      });
      return;
    }

    commitRuntimeState({
      ...localRuntimeState,
      operationKey: resolvedOperation?.record.key,
        draftValues,
        status: "submitting",
        error: undefined,
    });

    try {
      const response = await submitAppComponentRequest({
        authMode: normalizedProps.authMode,
        method: buildResult.request.method,
        url: buildResult.request.url,
        headers: buildResult.request.headers,
        body: buildResult.request.body,
      });

      commitRuntimeState({
        operationKey: resolvedOperation?.record.key,
        draftValues,
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
      });
    } catch (error) {
      commitRuntimeState({
        ...localRuntimeState,
        operationKey: resolvedOperation?.record.key,
        draftValues,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "The request failed before the API returned a response.",
      });
    }
  }

  if (!resolvedBaseUrl) {
    return (
      <AppComponentPlaceholder
        title="No API URL configured"
        description="Open widget settings and enter the OpenAPI URL, Swagger docs URL, or service root before trying to build a request form."
      />
    );
  }

  if (openApiQuery.isLoading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4 md:p-5">
        <div className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading OpenAPI schema…
        </div>
      </div>
    );
  }

  if (openApiQuery.isError) {
    return (
      <AppComponentPlaceholder
        title="Unable to load /openapi.json"
        description={
          openApiQuery.error instanceof Error
            ? openApiQuery.error.message
            : "The widget could not load the target OpenAPI document."
        }
      />
    );
  }

  if (!normalizedProps.method || !normalizedProps.path || !resolvedOperation || !generatedForm) {
    return (
      <AppComponentPlaceholder
        title="No operation selected"
        description="Open widget settings, explore the API, and bind this widget instance to one route before sending requests."
      />
    );
  }

  return (
    <div className="h-full min-h-0 p-4 md:p-5">
      <form className="flex h-full min-h-0 flex-col gap-3" onSubmit={handleSubmit}>
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          {generatedForm.parameterFields.length === 0 && generatedForm.bodyMode === "none" ? (
            <p className="text-xs text-muted-foreground">
              This operation does not define any request inputs.
            </p>
          ) : (
            <AppComponentFormSections
              boundFieldKeys={boundFieldKeys}
              disabled={localRuntimeState.status === "submitting"}
              form={generatedForm}
              mode="compact"
              values={effectiveDraftValues}
              onValueChange={updateDraftValue}
            />
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="min-h-4 text-xs text-danger">
            {localRuntimeState.status === "error" ? localRuntimeState.error : ""}
          </div>
          <Button type="submit" disabled={localRuntimeState.status === "submitting"}>
            {localRuntimeState.status === "submitting" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit
          </Button>
        </div>
      </form>
    </div>
  );
}
