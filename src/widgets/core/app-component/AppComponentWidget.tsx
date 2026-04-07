import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useResolvedWidgetInputs,
} from "@/dashboards/DashboardWidgetDependencies";
import {
  useDashboardWidgetExecution,
  useWidgetExecutionState,
} from "@/dashboards/DashboardWidgetExecution";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  APP_COMPONENT_OPENAPI_CACHE_TTL_MS,
  buildAppComponentOpenApiQueryKey,
  fetchAppComponentOpenApiDocument,
} from "./appComponentApi";
import { executeAppComponent } from "./appComponentExecution";
import {
  AppComponentEditableFormSections,
  AppComponentFormSections,
} from "./AppComponentFormSections";
import {
  buildAppComponentGeneratedForm,
  hasAppComponentDiscoveryTarget,
  normalizeAppComponentProps,
  normalizeAppComponentRuntimeState,
  resolveAppComponentEditableFormPublishedOutputs,
  resolveAppComponentBoundInputOverlay,
  resolveAppComponentEffectiveOperationKey,
  resolveAppComponentInitialDraftValues,
  resolveAppComponentMappedRequestForms,
  resolveAppComponentOperation,
  resolveAppComponentResponseDisplayForm,
  resolveAppComponentResponseDisplayValues,
  resolveAppComponentRuntimeGeneratedForm,
  updateAppComponentEditableFormSessionValue,
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
  const widgetExecution = useDashboardWidgetExecution();
  const executionState = useWidgetExecutionState(instanceId);
  const resolvedInputs = useResolvedWidgetInputs(instanceId);
  const normalizedRuntimeState = useMemo(
    () => normalizeAppComponentRuntimeState(runtimeState),
    [runtimeState],
  );
  const discoveryConfigured = useMemo(
    () => hasAppComponentDiscoveryTarget(normalizedProps),
    [normalizedProps],
  );
  const runtimeOpenApiQuery = useQuery({
    queryKey: buildAppComponentOpenApiQueryKey(normalizedProps),
    queryFn: () =>
      fetchAppComponentOpenApiDocument({
        props: normalizedProps,
      }),
    enabled:
      discoveryConfigured &&
      Boolean(normalizedProps.method) &&
      Boolean(normalizedProps.path),
    staleTime: APP_COMPONENT_OPENAPI_CACHE_TTL_MS,
  });
  const runtimeResolvedOperation = useMemo(
    () =>
      runtimeOpenApiQuery.data
        ? resolveAppComponentOperation(
            runtimeOpenApiQuery.data,
            normalizedProps.method,
            normalizedProps.path,
          )
        : null,
    [normalizedProps.method, normalizedProps.path, runtimeOpenApiQuery.data],
  );
  const persistedGeneratedForm = useMemo(
    () => resolveAppComponentRuntimeGeneratedForm(normalizedProps),
    [normalizedProps],
  );
  const liveGeneratedForm = useMemo(
    () =>
      runtimeOpenApiQuery.data
        ? buildAppComponentGeneratedForm(
            runtimeOpenApiQuery.data,
            runtimeResolvedOperation,
            normalizedProps.requestBodyContentType,
          )
        : null,
    [normalizedProps.requestBodyContentType, runtimeOpenApiQuery.data, runtimeResolvedOperation],
  );
  const generatedForm = liveGeneratedForm ?? persistedGeneratedForm;
  const mappedRequestForms = useMemo(
    () => resolveAppComponentMappedRequestForms(generatedForm, normalizedProps),
    [generatedForm, normalizedProps],
  );
  const submissionForm = mappedRequestForms.submissionForm;
  const cardForm = mappedRequestForms.cardForm;
  const operationKey = resolveAppComponentEffectiveOperationKey(normalizedProps);
  const initialDraftValues = useMemo(
    () =>
      resolveAppComponentInitialDraftValues(
        submissionForm,
        normalizedRuntimeState,
        operationKey,
        {
          prefillValues: mappedRequestForms.prefillValues,
        },
      ),
    [mappedRequestForms.prefillValues, normalizedRuntimeState, operationKey, submissionForm],
  );
  const initialDraftValuesKey = useMemo(
    () => JSON.stringify(initialDraftValues),
    [initialDraftValues],
  );
  const [draftValues, setDraftValues] = useState<Record<string, string>>(initialDraftValues);
  const [localRuntimeState, setLocalRuntimeState] =
    useState<AppComponentWidgetRuntimeState>(normalizedRuntimeState);
  const boundInputOverlay = useMemo(
    () => resolveAppComponentBoundInputOverlay(submissionForm, draftValues, resolvedInputs),
    [draftValues, resolvedInputs, submissionForm],
  );
  const responseForm = useMemo(
    () =>
      normalizedProps.showResponse
        ? resolveAppComponentResponseDisplayForm(
            normalizedProps,
            localRuntimeState.lastResponseBody,
          )
        : null,
    [localRuntimeState.lastResponseBody, normalizedProps],
  );
  const responseValues = useMemo(
    () =>
      resolveAppComponentResponseDisplayValues(
        responseForm,
        normalizedProps,
        localRuntimeState.lastResponseBody,
      ),
    [localRuntimeState.lastResponseBody, normalizedProps, responseForm],
  );
  const editableFormSession = localRuntimeState.editableFormSession;
  const effectiveDraftValues = boundInputOverlay.values;
  const boundFieldKeys = boundInputOverlay.boundFieldKeys;
  const isExecuting = executionState?.status === "running";

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
        operationKey,
        draftValues: nextDraftValues,
      });

      return nextDraftValues;
    });
  }

  function updateEditableFormValue(token: string, nextValue: string) {
    const nextSession = updateAppComponentEditableFormSessionValue(
      localRuntimeState.editableFormSession,
      token,
      nextValue,
    );

    if (!nextSession) {
      return;
    }

    commitRuntimeState({
      ...localRuntimeState,
      editableFormSession: nextSession,
      publishedOutputs: resolveAppComponentEditableFormPublishedOutputs(nextSession),
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (normalizedProps.hideRequestButton) {
      return;
    }

    if (widgetExecution && instanceId) {
      await widgetExecution.executeWidgetFlow(instanceId, {
        reason: "manual-submit",
      });
      return;
    }

    const result = await executeAppComponent({
      widgetId: "app-component",
      instanceId: instanceId ?? "app-component-preview",
      reason: "manual-submit",
      props: normalizedProps,
      runtimeState: {
        ...localRuntimeState,
        draftValues,
      },
      resolvedInputs,
    });

    if (result.runtimeStatePatch) {
      commitRuntimeState(result.runtimeStatePatch as AppComponentWidgetRuntimeState);
    }
  }

  if (!discoveryConfigured) {
    return (
      <AppComponentPlaceholder
        title="No API URL configured"
        description="Open widget settings and enter the OpenAPI URL, Swagger docs URL, or service root, or select a Main Sequence FastAPI resource release before trying to build a request form."
      />
    );
  }

  if (!normalizedProps.method || !normalizedProps.path) {
    return (
      <AppComponentPlaceholder
        title="No operation selected"
        description="Open widget settings, explore the API, and bind this widget instance to one route before sending requests."
      />
    );
  }

  if (!submissionForm || !cardForm) {
    return (
      <AppComponentPlaceholder
        title="Request form not compiled"
        description="This widget is missing both its saved compiled request form and enough binding metadata to rebuild one at runtime."
      />
    );
  }

  return (
    <div className="h-full min-h-0 p-4 md:p-5">
      <form className="flex h-full min-h-0 flex-col gap-3" onSubmit={handleSubmit}>
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          {cardForm.parameterFields.length === 0 && cardForm.bodyMode === "none" ? (
            <p className="text-xs text-muted-foreground">
              No request inputs are exposed on this card. Configure them in widget settings or drive this widget through upstream bindings and refresh execution.
            </p>
          ) : (
            <AppComponentFormSections
              boundFieldKeys={boundFieldKeys}
              disabled={isExecuting || localRuntimeState.status === "submitting"}
              form={cardForm}
              mode="compact"
              requestContext={{
                props: normalizedProps,
                submissionForm,
              }}
              values={effectiveDraftValues}
              onValueChange={updateDraftValue}
              onValuePatch={(patch) => {
                setDraftValues((current) => {
                  const nextDraftValues = {
                    ...current,
                    ...patch,
                  };

                  commitRuntimeState({
                    ...localRuntimeState,
                    operationKey,
                    draftValues: nextDraftValues,
                  });

                  return nextDraftValues;
                });
              }}
            />
          )}

          {normalizedProps.showResponse ? (
            <section className="mt-4 space-y-2 border-t border-border/60 pt-3">
              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Response
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {localRuntimeState.lastResponseStatus ? (
                    <span className="rounded-[calc(var(--radius)-7px)] border border-border/70 bg-background/45 px-2 py-1 font-medium text-foreground">
                      {localRuntimeState.lastResponseStatus}
                    </span>
                  ) : null}
                  <span>
                    {localRuntimeState.lastResponseBody === undefined
                      ? "No response yet."
                      : "Latest response body from this widget instance."}
                  </span>
                </div>
              </div>

              {editableFormSession ? (
                <AppComponentEditableFormSections
                  disabled={isExecuting || localRuntimeState.status === "submitting"}
                  session={editableFormSession}
                  onValueChange={updateEditableFormValue}
                />
              ) : responseForm && localRuntimeState.lastResponseBody !== undefined ? (
                <AppComponentFormSections
                  disabled
                  form={responseForm}
                  mode="compact"
                  values={responseValues}
                  onValueChange={() => {
                    return;
                  }}
                />
              ) : null}
            </section>
          ) : null}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="min-h-4 text-xs text-danger">
            {localRuntimeState.status === "error" ? localRuntimeState.error : ""}
          </div>
          {!normalizedProps.hideRequestButton ? (
            <Button type="submit" disabled={isExecuting || localRuntimeState.status === "submitting"}>
              {isExecuting || localRuntimeState.status === "submitting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
