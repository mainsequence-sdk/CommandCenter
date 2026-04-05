import { useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, Search, Send, ShieldCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useDashboardWidgetDependencies,
  useResolvedWidgetInputs,
} from "@/dashboards/DashboardWidgetDependencies";
import {
  useDashboardWidgetExecution,
  useWidgetExecutionState,
} from "@/dashboards/DashboardWidgetExecution";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  widgetTightFormDescriptionClass,
  widgetTightFormInsetSectionClass,
  widgetTightFormLabelClass,
  widgetTightFormSectionClass,
  widgetTightFormTitleClass,
} from "@/widgets/shared/form-density";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  APP_COMPONENT_OPENAPI_CACHE_TTL_MS,
  buildAppComponentOpenApiQueryKey,
  fetchAppComponentOpenApiDocument,
} from "./appComponentApi";
import { executeAppComponent } from "./appComponentExecution";
import {
  AppComponentFieldEditor,
  AppComponentFormSections,
  type AppComponentFieldBindingDisplayState,
} from "./AppComponentFormSections";
import {
  buildAppComponentBindingSpec,
  buildAppComponentDocsUrl,
  buildAppComponentGeneratedForm,
  buildAppComponentOpenApiUrl,
  formatAppComponentFieldLocation,
  formatAppComponentMethodLabel,
  listAppComponentRenderableFields,
  listAppComponentRenderableParameterFields,
  listAppComponentOperations,
  listAppComponentRequestBodyContentTypes,
  normalizeAppComponentProps,
  normalizeAppComponentBindingSpec,
  normalizeAppComponentRuntimeState,
  reconcileAppComponentRequestInputMap,
  resolveAppComponentFieldBindingStates,
  resolveAppComponentBoundInputOverlay,
  resolveAppComponentInitialDraftValues,
  resolveAppComponentMappedRequestForms,
  resolveAppComponentOperation,
  resolveAppComponentResponseModelPreview,
  resolveAppComponentResponseModelStatus,
  tryResolveAppComponentBaseUrl,
  type AppComponentWidgetProps,
} from "./appComponentModel";

function linkClassName(disabled = false) {
  return cn(
    "inline-flex h-8 items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border bg-card/75 px-3 text-xs font-medium text-foreground transition-colors",
    disabled ? "pointer-events-none opacity-50" : "hover:bg-muted/55",
  );
}

function buildResponseModelWarningMessage(
  responseModelStatus: {
    declaredResponseCodes: string[];
    missingResponseCodes: string[];
    modeledResponseCodes: string[];
    optionalMissingResponseCodes: string[];
  },
) {
  const {
    declaredResponseCodes,
    missingResponseCodes,
    modeledResponseCodes,
    optionalMissingResponseCodes,
  } = responseModelStatus;
  const allMissingResponseCodes = [...missingResponseCodes, ...optionalMissingResponseCodes];

  if (declaredResponseCodes.length === 0) {
    return "Incorrect endpoint: the operation does not declare any OpenAPI responses.";
  }

  if (modeledResponseCodes.length === 0) {
    return `Incorrect endpoint: none of the declared responses include a response model. Missing schema for ${allMissingResponseCodes.join(", ")}.`;
  }

  return `Incorrect endpoint: every required response should include a response model. Missing schema for ${missingResponseCodes.join(", ")}.`;
}

function formatTimestamp(timestampMs?: number) {
  if (!timestampMs) {
    return "Not sent yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestampMs);
}

function renderResponseBody(value: unknown) {
  if (value === undefined) {
    return "No response yet.";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function resolveStatusBadgeVariant(status: "idle" | "submitting" | "success" | "error") {
  switch (status) {
    case "success":
      return "success";
    case "error":
      return "danger";
    case "submitting":
      return "warning";
    case "idle":
    default:
      return "neutral";
  }
}

function resolveTestStateFromRuntimeState(
  runtimeState: Record<string, unknown> | undefined,
): AppComponentSettingsTestState {
  const normalizedRuntimeState = normalizeAppComponentRuntimeState(runtimeState);

  return {
    status: normalizedRuntimeState.status ?? "idle",
    lastExecutedAtMs: normalizedRuntimeState.lastExecutedAtMs,
    lastRequestUrl: normalizedRuntimeState.lastRequestUrl,
    lastResponseStatus: normalizedRuntimeState.lastResponseStatus,
    lastResponseBody: normalizedRuntimeState.lastResponseBody,
    error: normalizedRuntimeState.error,
    publishedOutputs: normalizedRuntimeState.publishedOutputs,
  };
}

interface AppComponentSettingsTestState {
  status: "idle" | "submitting" | "success" | "error";
  lastExecutedAtMs?: number;
  lastRequestUrl?: string;
  lastResponseStatus?: number;
  lastResponseBody?: unknown;
  error?: string;
  publishedOutputs?: Record<string, unknown>;
}

export function AppComponentWidgetSettings({
  instanceId,
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<AppComponentWidgetProps>) {
  const normalizedProps = useMemo(() => normalizeAppComponentProps(draftProps), [draftProps]);
  const draftPropsRef = useRef(draftProps);
  const dependencies = useDashboardWidgetDependencies();
  const widgetExecution = useDashboardWidgetExecution();
  const executionState = useWidgetExecutionState(instanceId);
  const resolvedInputs = useResolvedWidgetInputs(instanceId);
  const resolvedBaseUrl = useMemo(
    () => tryResolveAppComponentBaseUrl(normalizedProps.apiBaseUrl),
    [normalizedProps.apiBaseUrl],
  );
  const docsUrl = useMemo(
    () => buildAppComponentDocsUrl(normalizedProps.apiBaseUrl),
    [normalizedProps.apiBaseUrl],
  );
  const openApiUrl = useMemo(
    () => buildAppComponentOpenApiUrl(normalizedProps.apiBaseUrl),
    [normalizedProps.apiBaseUrl],
  );
  const [searchValue, setSearchValue] = useState("");
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
    staleTime: APP_COMPONENT_OPENAPI_CACHE_TTL_MS,
  });
  const operations = useMemo(
    () => (openApiQuery.data ? listAppComponentOperations(openApiQuery.data) : []),
    [openApiQuery.data],
  );
  const filteredOperations = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return operations;
    }

    return operations.filter((operation) =>
      [operation.method, operation.path, operation.summary, operation.description, operation.operationId, operation.tags.join(" ")]
        .filter((entry): entry is string => Boolean(entry))
        .some((entry) => entry.toLowerCase().includes(normalizedSearch)),
    );
  }, [operations, searchValue]);
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
  const operationResponseStatusByKey = useMemo(() => {
    const next = new Map<string, NonNullable<ReturnType<typeof resolveAppComponentResponseModelStatus>>>();

    if (!openApiQuery.data) {
      return next;
    }

    for (const operation of operations) {
      const status = resolveAppComponentResponseModelStatus(
        openApiQuery.data,
        resolveAppComponentOperation(openApiQuery.data, operation.method, operation.path),
      );

      if (status) {
        next.set(operation.key, status);
      }
    }

    return next;
  }, [openApiQuery.data, operations]);
  const responseModelStatus = useMemo(
    () =>
      openApiQuery.data
        ? resolveAppComponentResponseModelStatus(openApiQuery.data, resolvedOperation)
        : null,
    [openApiQuery.data, resolvedOperation],
  );
  const responseModelPreview = useMemo(
    () =>
      openApiQuery.data
        ? resolveAppComponentResponseModelPreview(openApiQuery.data, resolvedOperation)
        : [],
    [openApiQuery.data, resolvedOperation],
  );
  const contentTypes = useMemo(
    () =>
      openApiQuery.data
        ? listAppComponentRequestBodyContentTypes(openApiQuery.data, resolvedOperation)
        : [],
    [openApiQuery.data, resolvedOperation],
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
  const mappedRequestForms = useMemo(
    () => resolveAppComponentMappedRequestForms(generatedForm, normalizedProps),
    [generatedForm, normalizedProps],
  );
  const mappedSubmissionForm = mappedRequestForms.submissionForm;
  const mappedCardForm = mappedRequestForms.cardForm;
  const requestFieldCatalog = useMemo(
    () => listAppComponentRenderableFields(generatedForm),
    [generatedForm],
  );
  const initialTestDraftValues = useMemo(
    () =>
      resolveAppComponentInitialDraftValues(
        mappedSubmissionForm,
        {},
        resolvedOperation?.record.key,
        {
          prefillValues: mappedRequestForms.prefillValues,
        },
      ),
    [mappedRequestForms.prefillValues, mappedSubmissionForm, resolvedOperation?.record.key],
  );
  const initialTestDraftValuesKey = useMemo(
    () => JSON.stringify(initialTestDraftValues),
    [initialTestDraftValues],
  );
  const [testDraftValues, setTestDraftValues] =
    useState<Record<string, string>>(initialTestDraftValues);
  const boundInputOverlay = useMemo(
    () =>
      resolveAppComponentBoundInputOverlay(
        mappedSubmissionForm,
        testDraftValues,
        resolvedInputs,
      ),
    [mappedSubmissionForm, resolvedInputs, testDraftValues],
  );
  const effectiveTestDraftValues = boundInputOverlay.values;
  const boundFieldKeys = boundInputOverlay.boundFieldKeys;
  const fieldBindingStates = useMemo(
    () => resolveAppComponentFieldBindingStates(mappedSubmissionForm, resolvedInputs),
    [mappedSubmissionForm, resolvedInputs],
  );
  const fieldBindingDisplayStates = useMemo(() => {
    return Object.fromEntries(
      Object.entries(fieldBindingStates).map(([fieldKey, state]) => {
        if (!state.isBound) {
          return [fieldKey, undefined];
        }

        const sourceInstance = state.sourceWidgetId
          ? (dependencies?.entries.find((entry) => entry.instance.id === state.sourceWidgetId)?.instance ??
            null)
          : null;
        const sourceDefinition =
          sourceInstance && dependencies
            ? dependencies.getWidgetDefinition(sourceInstance.widgetId)
            : null;
        const sourceOutputLabel =
          state.sourceWidgetId && state.sourceOutputId && dependencies
            ? (dependencies
                .resolveIo(state.sourceWidgetId)
                ?.outputs?.find((output) => output.id === state.sourceOutputId)?.label ??
              state.sourceOutputId)
            : state.sourceOutputId;
        const sourceWidgetLabel = sourceInstance
          ? sourceInstance.title ?? sourceDefinition?.title ?? sourceInstance.widgetId
          : state.sourceWidgetId;
        const sourceSummary =
          sourceWidgetLabel && sourceOutputLabel
            ? `From ${sourceWidgetLabel} [${state.sourceWidgetId}] / ${sourceOutputLabel}`
            : sourceWidgetLabel
              ? `From ${sourceWidgetLabel} [${state.sourceWidgetId}]`
              : undefined;

        let message: string | undefined;
        let statusVariant: AppComponentFieldBindingDisplayState["statusVariant"] = "neutral";

        switch (state.status) {
          case "valid":
            message = "This value is sourced from the selected binding.";
            statusVariant = "success";
            break;
          case "missing-source":
            message = "The selected source widget is no longer available.";
            statusVariant = "warning";
            break;
          case "missing-output":
            message = "The selected source output is no longer available.";
            statusVariant = "warning";
            break;
          case "contract-mismatch":
            message = "The bound source is currently incompatible with this field.";
            statusVariant = "danger";
            break;
          case "transform-invalid":
            message = "The selected source mapping could not be resolved.";
            statusVariant = "danger";
            break;
          case "self-reference-blocked":
            message = "This field cannot bind to its own widget.";
            statusVariant = "danger";
            break;
          case "unbound":
          default:
            message = undefined;
            statusVariant = "neutral";
            break;
        }

        return [fieldKey, {
          isBound: true,
          sourceSummary,
          message,
          status: state.status,
          statusVariant,
        } satisfies AppComponentFieldBindingDisplayState];
      }),
    ) as Record<string, AppComponentFieldBindingDisplayState | undefined>;
  }, [dependencies, fieldBindingStates]);
  const resolvedBindingSpec = useMemo(
    () =>
      openApiQuery.data
        ? buildAppComponentBindingSpec(openApiQuery.data, resolvedOperation, generatedForm)
        : undefined,
    [generatedForm, openApiQuery.data, resolvedOperation],
  );
  const normalizedResolvedBindingSpec = useMemo(
    () => normalizeAppComponentBindingSpec(resolvedBindingSpec),
    [resolvedBindingSpec],
  );
  const currentBindingSpecSerialized = useMemo(
    () => JSON.stringify(normalizedProps.bindingSpec ?? null),
    [normalizedProps.bindingSpec],
  );
  const nextBindingSpecSerialized = useMemo(
    () => JSON.stringify(normalizedResolvedBindingSpec ?? null),
    [normalizedResolvedBindingSpec],
  );
  const normalizedRequestInputMap = normalizedProps.requestInputMap;
  const reconciledRequestInputMap = useMemo(
    () =>
      reconcileAppComponentRequestInputMap(
        normalizedRequestInputMap,
        generatedForm,
        resolvedOperation?.record.key,
      ),
    [generatedForm, normalizedRequestInputMap, resolvedOperation?.record.key],
  );
  const currentRequestInputMapSerialized = useMemo(
    () => JSON.stringify(normalizedRequestInputMap ?? null),
    [normalizedRequestInputMap],
  );
  const nextRequestInputMapSerialized = useMemo(
    () => JSON.stringify(reconciledRequestInputMap ?? null),
    [reconciledRequestInputMap],
  );
  const [testState, setTestState] = useState<AppComponentSettingsTestState>({
    status: "idle",
  });

  function buildNextDraftProps(
    overrides: Partial<AppComponentWidgetProps>,
    options?: {
      preserveSelection?: boolean;
    },
  ) {
    const nextProps = {
      ...draftPropsRef.current,
      ...overrides,
    };

    if (!openApiQuery.data) {
      return {
        ...nextProps,
        bindingSpec: options?.preserveSelection ? nextProps.bindingSpec : undefined,
        requestInputMap: options?.preserveSelection ? nextProps.requestInputMap : undefined,
      };
    }

    const normalizedNextProps = normalizeAppComponentProps(nextProps);
    const nextResolvedOperation = options?.preserveSelection
      ? resolveAppComponentOperation(
          openApiQuery.data,
          normalizedNextProps.method,
          normalizedNextProps.path,
        )
      : null;
    const nextGeneratedForm = options?.preserveSelection
      ? buildAppComponentGeneratedForm(
          openApiQuery.data,
          nextResolvedOperation,
          normalizedNextProps.requestBodyContentType,
        )
      : null;
    const nextBindingSpec = options?.preserveSelection
      ? normalizeAppComponentBindingSpec(
          buildAppComponentBindingSpec(
            openApiQuery.data,
            nextResolvedOperation,
            nextGeneratedForm,
          ),
        )
      : undefined;
    const nextRequestInputMap = options?.preserveSelection
      ? reconcileAppComponentRequestInputMap(
          normalizedNextProps.requestInputMap,
          nextGeneratedForm,
          nextResolvedOperation?.record.key,
        )
      : undefined;

    return {
      ...nextProps,
      bindingSpec: nextBindingSpec,
      requestInputMap: nextRequestInputMap,
    };
  }

  useEffect(() => {
    draftPropsRef.current = draftProps;
  }, [draftProps]);

  useEffect(() => {
    setTestDraftValues(initialTestDraftValues);
    setTestState({
      status: "idle",
    });
  }, [initialTestDraftValuesKey]);

  useEffect(() => {
    if (!editable) {
      return;
    }

    if (!normalizedProps.method || !normalizedProps.path) {
      if (
        normalizedProps.bindingSpec !== undefined ||
        normalizedProps.requestInputMap !== undefined
      ) {
        onDraftPropsChange({
          ...draftPropsRef.current,
          bindingSpec: undefined,
          requestInputMap: undefined,
        });
      }
      return;
    }

    if (!openApiQuery.data) {
      return;
    }

    if (
      currentBindingSpecSerialized === nextBindingSpecSerialized &&
      currentRequestInputMapSerialized === nextRequestInputMapSerialized
    ) {
      return;
    }

    onDraftPropsChange({
      ...draftPropsRef.current,
      bindingSpec: normalizedResolvedBindingSpec,
      requestInputMap: reconciledRequestInputMap,
    });
  }, [
    currentBindingSpecSerialized,
    currentRequestInputMapSerialized,
    editable,
    nextBindingSpecSerialized,
    nextRequestInputMapSerialized,
    normalizedProps.requestInputMap,
    reconciledRequestInputMap,
    normalizedResolvedBindingSpec,
    normalizedProps.bindingSpec,
    normalizedProps.method,
    normalizedProps.path,
    openApiQuery.data,
    onDraftPropsChange,
  ]);

  const hiddenRequiredFieldWarnings = useMemo(() => {
    if (!mappedSubmissionForm || !mappedCardForm) {
      return [];
    }

    const visibleFieldKeys = new Set(
      listAppComponentRenderableFields(mappedCardForm).map((field) => field.key),
    );

    return listAppComponentRenderableFields(mappedSubmissionForm).flatMap((field) => {
      if (visibleFieldKeys.has(field.key) || !field.required) {
        return [];
      }

      const bindingState = fieldBindingStates[field.key];
      const hasValidBinding = bindingState?.status === "valid";
      const initialValue = initialTestDraftValues[field.key] ?? "";

      if (hasValidBinding || initialValue.trim().length > 0) {
        return [];
      }

      return [{
        key: field.key,
        message: `${field.label} is required, hidden on the card, and currently has no bound or prefilled value.`,
      }];
    });
  }, [
    fieldBindingStates,
    initialTestDraftValues,
    mappedCardForm,
    mappedSubmissionForm,
  ]);

  function updateRequestInputMapField(
    fieldKey: string,
    patch: {
      visibleOnCard?: boolean;
      label?: string;
      prefillValue?: string;
    },
  ) {
    if (!resolvedOperation) {
      return;
    }

    const currentMap =
      normalizedProps.requestInputMap?.operationKey === resolvedOperation.record.key
        ? normalizedProps.requestInputMap
        : {
            version: 1 as const,
            operationKey: resolvedOperation.record.key,
            fields: {},
          };

    onDraftPropsChange(
      buildNextDraftProps(
        {
          requestInputMap: {
            version: 1,
            operationKey: resolvedOperation.record.key,
            fields: {
              ...currentMap.fields,
              [fieldKey]: {
                ...currentMap.fields[fieldKey],
                ...patch,
              },
            },
          },
        },
        { preserveSelection: true },
      ),
    );
  }

  async function handleTestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setTestState({
      status: "submitting",
      lastExecutedAtMs: testState.lastExecutedAtMs,
      lastRequestUrl: testState.lastRequestUrl,
      lastResponseStatus: testState.lastResponseStatus,
      lastResponseBody: testState.lastResponseBody,
      publishedOutputs: testState.publishedOutputs,
    });

    if (widgetExecution) {
      const result = await widgetExecution.executeWidgetGraph(instanceId, {
        reason: "settings-test",
        targetOverrides: {
          props: normalizedProps,
          draftValues: testDraftValues,
        },
      });
      const nextState: AppComponentSettingsTestState = result.targetRuntimeState
        ? resolveTestStateFromRuntimeState(result.targetRuntimeState)
        : {
            ...testState,
            status: result.status === "error" ? "error" : "idle",
            error: result.error,
          };

      setTestState({
        ...nextState,
        error: nextState.error ?? result.error,
      });

      return;
    }

    const result = await executeAppComponent({
      widgetId: "app-component",
      instanceId,
      reason: "settings-test",
      props: normalizedProps,
      resolvedInputs,
      targetOverrides: {
        props: normalizedProps,
        draftValues: testDraftValues,
      },
    });

    setTestState(resolveTestStateFromRuntimeState(result.runtimeStatePatch));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">OpenAPI</Badge>
        <Badge variant="neutral">Core widget</Badge>
        <Badge variant="neutral">JWT by default</Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        Paste the OpenAPI URL, Swagger docs URL, or service root, then bind this widget to one
        route and render the request form directly inside the workspace.
      </div>

      <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-topbar-foreground">API Target</div>
          <p className="text-sm text-muted-foreground">
            If you paste an explicit <code>/openapi.json</code> URL, discovery uses that exact
            endpoint. If you paste <code>/docs</code> or a service root, the widget resolves the
            sibling discovery endpoints from it.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_220px]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-topbar-foreground">OpenAPI or service URL</span>
            <Input
              value={normalizedProps.apiBaseUrl ?? ""}
              readOnly={!editable}
              placeholder="https://api.example.com/service/openapi.json"
              onChange={(event) => {
                onDraftPropsChange(buildNextDraftProps({
                  apiBaseUrl: event.target.value,
                  method: undefined,
                  path: undefined,
                  requestBodyContentType: undefined,
                }));
              }}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-topbar-foreground">Auth mode</span>
            <Select
              value={normalizedProps.authMode ?? "session-jwt"}
              disabled={!editable}
              onChange={(event) => {
                onDraftPropsChange(buildNextDraftProps({
                  authMode: event.target.value as AppComponentWidgetProps["authMode"],
                }, { preserveSelection: true }));
              }}
            >
              <option value="session-jwt">Session JWT</option>
              <option value="none">No auth</option>
            </Select>
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-3 py-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border"
            checked={normalizedProps.refreshOnDashboardRefresh !== false}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange(buildNextDraftProps({
                refreshOnDashboardRefresh: event.target.checked,
              }, { preserveSelection: true }));
            }}
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium text-topbar-foreground">
              Refresh request on dashboard refresh
            </span>
            <span className="block text-sm text-muted-foreground">
              When enabled, dashboard refresh runs this AppComponent request again and republishes its outputs.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-3 py-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border"
            checked={normalizedProps.showResponse === true}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange(buildNextDraftProps({
                showResponse: event.target.checked,
              }, { preserveSelection: true }));
            }}
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium text-topbar-foreground">
              Show response on card
            </span>
            <span className="block text-sm text-muted-foreground">
              When enabled, the canvas card renders the latest response using the same generated field layout as the request inputs, but read-only.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-3 py-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border"
            checked={normalizedProps.hideRequestButton === true}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange(buildNextDraftProps({
                hideRequestButton: event.target.checked,
              }, { preserveSelection: true }));
            }}
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium text-topbar-foreground">
              Hide request button
            </span>
            <span className="block text-sm text-muted-foreground">
              When enabled, the card hides its manual submit button so the widget can act only as an upstream calculation or refresh-driven component.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <a href={docsUrl ?? "#"} target="_blank" rel="noreferrer" className={linkClassName(!docsUrl)}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            Swagger UI
          </a>
          <a href={openApiUrl ?? "#"} target="_blank" rel="noreferrer" className={linkClassName(!openApiUrl)}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            OpenAPI JSON
          </a>
          {normalizedProps.authMode !== "none" ? (
            <span className="inline-flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              Requests attach the current session JWT
            </span>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-medium text-topbar-foreground">Schema Discovery</div>
            <p className="text-sm text-muted-foreground">
              Load the OpenAPI document and choose one operation for this widget instance.
            </p>
          </div>

          {openApiQuery.isLoading ? (
            <div className="inline-flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading schema
            </div>
          ) : openApiQuery.data ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-3 py-2 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">
                {openApiQuery.data.info?.title ?? "OpenAPI schema"}
              </div>
              <div>
                {openApiQuery.data.info?.version ?? "Unknown version"} · {operations.length} routes
              </div>
            </div>
          ) : null}
        </div>

        {!resolvedBaseUrl ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">
            Enter a valid OpenAPI URL, Swagger docs URL, or service root to load the schema.
          </div>
        ) : openApiQuery.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">
            {openApiQuery.error instanceof Error
              ? openApiQuery.error.message
              : "Unable to load the target OpenAPI document."}
          </div>
        ) : openApiQuery.data ? (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
              <div className="space-y-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue}
                  placeholder="Search method, path, tag, or summary"
                  className="pl-9"
                  onChange={(event) => {
                    setSearchValue(event.target.value);
                  }}
                />
              </label>

              <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                {filteredOperations.map((operation) => {
                  const selected =
                    operation.method === normalizedProps.method &&
                    operation.path === normalizedProps.path;
                  const responseStatus = operationResponseStatusByKey.get(operation.key);

                  return (
                    <button
                      key={operation.key}
                      type="button"
                      className={cn(
                        "w-full rounded-[calc(var(--radius)-6px)] border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-primary/45 bg-primary/10"
                          : "border-border/70 bg-background/18 hover:bg-muted/35",
                      )}
                      onClick={() => {
                        if (!editable) {
                          return;
                        }

                        const nextResolvedOperation = resolveAppComponentOperation(
                          openApiQuery.data,
                          operation.method,
                          operation.path,
                        );
                        const nextContentTypes = listAppComponentRequestBodyContentTypes(
                          openApiQuery.data,
                          nextResolvedOperation,
                        );

                        onDraftPropsChange(buildNextDraftProps({
                          method: operation.method,
                          path: operation.path,
                          requestBodyContentType:
                            nextContentTypes.includes("application/json")
                              ? "application/json"
                              : nextContentTypes[0] ?? undefined,
                        }, { preserveSelection: true }));
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={selected ? "primary" : "neutral"}>
                          {formatAppComponentMethodLabel(operation.method)}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {operation.path}
                        </span>
                        {responseStatus && !responseStatus.isValidEndpoint ? (
                          <Badge variant="danger" className="py-0.5">
                            Incorrect
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {operation.summary}
                      </div>
                      {operation.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {operation.tags.map((tag) => (
                            <Badge key={tag} variant="neutral" className="py-0.5">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  );
                })}

                {filteredOperations.length === 0 ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/18 px-4 py-5 text-sm text-muted-foreground">
                    No operations matched the current search.
                  </div>
                ) : null}
              </div>
              </div>

              <div className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 p-4">
                {resolvedOperation ? (
                  <>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="primary">
                        {formatAppComponentMethodLabel(resolvedOperation.record.method)}
                      </Badge>
                      <Badge variant="neutral">{resolvedOperation.record.path}</Badge>
                      {responseModelStatus ? (
                        <Badge
                          variant={responseModelStatus.isValidEndpoint ? "success" : "danger"}
                        >
                          {responseModelStatus.isValidEndpoint
                            ? "Response model"
                            : "Incorrect endpoint"}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {resolvedOperation.record.summary}
                    </div>
                    {resolvedOperation.record.description ? (
                      <p className="text-sm text-muted-foreground">
                        {resolvedOperation.record.description}
                      </p>
                    ) : null}
                  </div>

                  {responseModelStatus && !responseModelStatus.isValidEndpoint ? (
                    <div className="rounded-[calc(var(--radius)-7px)] border border-danger/35 bg-danger/10 px-3 py-3 text-sm text-danger">
                      <div className="flex items-start gap-2">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="space-y-1">
                          <div>
                            {buildResponseModelWarningMessage(responseModelStatus)}
                          </div>
                          {responseModelStatus.modeledResponseCodes.length > 0 ? (
                            <div className="text-xs text-danger/90">
                              Modeled responses:{" "}
                              {responseModelStatus.modeledResponseCodes.join(", ")}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/30 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Response model
                    </div>
                    <div className="mt-2 space-y-3">
                      {responseModelPreview.length > 0 ? (
                        responseModelPreview.map((entry) => (
                          <div
                            key={entry.key}
                            className={cn(
                              "rounded-[calc(var(--radius)-8px)] border px-3 py-3",
                              entry.hasSchema
                                ? "border-border/60 bg-background/45"
                                : "border-danger/30 bg-danger/6",
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={entry.hasSchema ? "success" : "danger"}>
                                {entry.statusCode}
                              </Badge>
                              <Badge variant="neutral">
                                {entry.contentType ?? "no content"}
                              </Badge>
                              {entry.schemaTypeLabel ? (
                                <span className="text-xs font-medium text-foreground">
                                  {entry.schemaTypeLabel}
                                </span>
                              ) : null}
                            </div>
                            {entry.description ? (
                              <div className="mt-2 text-xs text-muted-foreground">
                                {entry.description}
                              </div>
                            ) : null}
                            {entry.hasSchema ? (
                              entry.fields.length > 0 ? (
                                <div className="mt-2 space-y-1.5">
                                  {entry.fields.map((field) => (
                                    <div
                                      key={`${entry.key}:${field.path}`}
                                      className="text-xs text-muted-foreground"
                                    >
                                      <span className="font-mono text-foreground">
                                        {field.path}
                                      </span>{" "}
                                      · {field.typeLabel}
                                      {field.required ? " · required" : ""}
                                      {field.description ? ` · ${field.description}` : ""}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Schema is declared, but no explicit fields were expanded.
                                </div>
                              )
                            ) : (
                              <div className="mt-2 text-xs text-danger">
                                No response schema declared for this response.
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          No responses declared.
                        </div>
                      )}
                    </div>
                  </div>

                  {contentTypes.length > 1 ? (
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-topbar-foreground">
                        Request body content type
                      </span>
                      <Select
                        value={
                          normalizedProps.requestBodyContentType ??
                          contentTypes[0] ??
                          ""
                        }
                        disabled={!editable}
                        onChange={(event) => {
                          onDraftPropsChange(buildNextDraftProps({
                            requestBodyContentType: event.target.value || undefined,
                          }, { preserveSelection: true }));
                        }}
                      >
                        {contentTypes.map((contentType) => (
                          <option key={contentType} value={contentType}>
                            {contentType}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/30 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Parameters
                      </div>
                      <div className="mt-2 space-y-2">
                        {listAppComponentRenderableParameterFields(generatedForm).length ? (
                          listAppComponentRenderableParameterFields(generatedForm).map((field) => (
                            <div key={field.key} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{field.label}</span>{" "}
                              · {formatAppComponentFieldLocation(field.location)}
                              {field.required ? " · required" : ""}
                              {field.uiEnhancement?.widget === "select2" &&
                              field.uiEnhancement.role === "async-select-search"
                                ? " · select2 async search"
                                : ""}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            No explicit parameters.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/30 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Request body
                      </div>
                      <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                        <div>
                          Mode:{" "}
                          <span className="font-medium text-foreground">
                            {generatedForm?.bodyMode ?? "none"}
                          </span>
                        </div>
                        <div>
                          Content type:{" "}
                          <span className="font-medium text-foreground">
                            {generatedForm?.bodyContentType ?? "none"}
                          </span>
                        </div>
                        {generatedForm?.unsupportedReason ? (
                          <div>{generatedForm.unsupportedReason}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  </>
                ) : (
                  <div className="rounded-[calc(var(--radius)-7px)] border border-dashed border-border/70 bg-background/22 px-4 py-5 text-sm text-muted-foreground">
                    Select an operation on the left to bind this widget instance to one route.
                  </div>
                )}
              </div>
            </div>

            {resolvedOperation ? (
              <>
                <section className={widgetTightFormSectionClass}>
                  <div className="space-y-1">
                    <div className={widgetTightFormTitleClass}>Input Mapping</div>
                    <p className={widgetTightFormDescriptionClass}>
                      Overlay the generated request form without mutating the underlying OpenAPI binding. Hide fields from the canvas card, rename their labels, or prefill values that still submit even when the field stays hidden.
                    </p>
                  </div>

                  {requestFieldCatalog.length > 0 ? (
                    <div className="space-y-3">
                      {requestFieldCatalog.map((field) => {
                        const fieldConfig = mappedRequestForms.activeInputMap?.fields[field.key];
                        const showOnCard = fieldConfig?.visibleOnCard !== false;

                        return (
                          <div
                            key={field.key}
                            className="space-y-4 rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/30 p-4"
                          >
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-foreground">
                                  {field.label}
                                </span>
                                <Badge variant="neutral">
                                  {formatAppComponentFieldLocation(field.location)}
                                </Badge>
                                {field.required ? (
                                  <Badge variant="warning" className="py-0.5">
                                    Required
                                  </Badge>
                                ) : null}
                                {fieldBindingDisplayStates[field.key]?.isBound ? (
                                  <Badge variant="success" className="py-0.5">
                                    Bound
                                  </Badge>
                                ) : null}
                              </div>
                              {field.description ? (
                                <p className={widgetTightFormDescriptionClass}>
                                  {field.description}
                                </p>
                              ) : null}
                            </div>

                            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                              <div className="space-y-2">
                                <span className="text-sm font-medium text-topbar-foreground">
                                  Card visibility
                                </span>
                                <div className="flex items-center gap-2 rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/35 px-3 py-2 text-sm text-foreground">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-border"
                                    checked={showOnCard}
                                    disabled={!editable}
                                    onChange={(event) => {
                                      updateRequestInputMapField(field.key, {
                                        visibleOnCard: event.target.checked,
                                      });
                                    }}
                                  />
                                  <span>Show on card</span>
                                </div>
                              </div>

                              <label className="space-y-2">
                                <span className="text-sm font-medium text-topbar-foreground">
                                  Card label
                                </span>
                                <Input
                                  value={fieldConfig?.label ?? ""}
                                  readOnly={!editable}
                                  placeholder={field.label}
                                  onChange={(event) => {
                                    updateRequestInputMapField(field.key, {
                                      label: event.target.value,
                                    });
                                  }}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Leave blank to keep the generated label.
                                </p>
                              </label>
                            </div>

                            <div className="space-y-2">
                              <div className="text-sm font-medium text-topbar-foreground">
                                Prefill value
                              </div>
                              <AppComponentFieldEditor
                                compact
                                disabled={!editable}
                                field={field}
                                title={field.description}
                                value={fieldConfig?.prefillValue ?? ""}
                                onChange={(nextValue) => {
                                  updateRequestInputMapField(field.key, {
                                    prefillValue: nextValue,
                                  });
                                }}
                              />
                              <p className="text-xs text-muted-foreground">
                                Leave blank to keep the generated default/example. Prefills still apply during request execution even when the field is hidden on the card.
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/30 px-3 py-3 text-sm text-muted-foreground">
                      This operation does not expose request inputs to map.
                    </div>
                  )}

                  {hiddenRequiredFieldWarnings.length > 0 ? (
                    <div className="space-y-2 rounded-[calc(var(--radius)-7px)] border border-warning/35 bg-warning/10 px-3 py-3 text-sm text-warning">
                      <div className="font-medium text-foreground">Hidden required fields</div>
                      {hiddenRequiredFieldWarnings.map((warning) => (
                        <div key={warning.key}>{warning.message}</div>
                      ))}
                    </div>
                  ) : null}

                  <div className={widgetTightFormInsetSectionClass}>
                    <div className="space-y-1">
                      <div className={widgetTightFormLabelClass}>Card Preview</div>
                      <p className={widgetTightFormDescriptionClass}>
                        This uses the same generated-form renderer as the canvas card. Hidden fields remain part of request execution but disappear from this preview.
                      </p>
                    </div>

                    {mappedCardForm &&
                    (mappedCardForm.parameterFields.length > 0 ||
                      mappedCardForm.bodyMode !== "none") ? (
                      <AppComponentFormSections
                        boundFieldKeys={boundFieldKeys}
                        disabled
                        fieldBindingStates={fieldBindingDisplayStates}
                        form={mappedCardForm}
                        mode="compact"
                        requestContext={{
                          props: normalizedProps,
                          submissionForm: mappedSubmissionForm,
                        }}
                        values={effectiveTestDraftValues}
                        onValueChange={() => {
                          return;
                        }}
                        onValuePatch={() => {
                          return;
                        }}
                      />
                    ) : (
                      <div className="rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/30 px-3 py-3 text-sm text-muted-foreground">
                        No request inputs are currently exposed on the canvas card.
                      </div>
                    )}
                  </div>
                </section>

                <form className="space-y-4" onSubmit={handleTestSubmit}>
                <section className={widgetTightFormSectionClass}>
                  <div className="space-y-1">
                    <div className={widgetTightFormTitleClass}>Test Request</div>
                    <p className={widgetTightFormDescriptionClass}>
                      Send a request from settings and inspect the live response here. The canvas
                      widget can also render the latest response when Show response on card is enabled.
                    </p>
                  </div>

                  {mappedSubmissionForm &&
                  (mappedSubmissionForm.parameterFields.length > 0 ||
                    mappedSubmissionForm.bodyMode !== "none") ? (
                    <AppComponentFormSections
                      boundFieldKeys={boundFieldKeys}
                      disabled={
                        testState.status === "submitting" ||
                        executionState?.status === "running"
                      }
                      fieldBindingStates={fieldBindingDisplayStates}
                      form={mappedSubmissionForm}
                      requestContext={{
                        props: normalizedProps,
                        submissionForm: mappedSubmissionForm,
                      }}
                      values={effectiveTestDraftValues}
                      onValueChange={(fieldKey, nextValue) => {
                        if (fieldBindingStates[fieldKey]?.isBound) {
                          return;
                        }

                        setTestDraftValues((current) => ({
                          ...current,
                          [fieldKey]: nextValue,
                        }));
                      }}
                      onValuePatch={(patch) => {
                        setTestDraftValues((current) => ({
                          ...current,
                          ...patch,
                        }));
                      }}
                    />
                  ) : (
                    <div className="rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/30 px-3 py-3 text-sm text-muted-foreground">
                      This operation does not define request inputs. You can still send a test
                      request.
                    </div>
                  )}

                  <section className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/65 bg-background/24 px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={resolveStatusBadgeVariant(testState.status)}>
                          {testState.status}
                        </Badge>
                        {testState.lastResponseStatus ? (
                          <Badge variant="neutral">{testState.lastResponseStatus}</Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last request: {formatTimestamp(testState.lastExecutedAtMs)}
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={
                        testState.status === "submitting" ||
                        executionState?.status === "running" ||
                        !editable
                      }
                    >
                      {testState.status === "submitting" || executionState?.status === "running" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Test request
                    </Button>
                  </section>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className={widgetTightFormInsetSectionClass}>
                      <div className={widgetTightFormLabelClass}>Request URL</div>
                      <div className="break-all text-xs text-foreground">
                        {testState.lastRequestUrl ?? "No request sent yet."}
                      </div>
                      {testState.error ? (
                        <div className="rounded-[calc(var(--radius)-7px)] border border-danger/35 bg-danger/10 px-3 py-2 text-xs text-danger">
                          {testState.error}
                        </div>
                      ) : null}
                    </div>

                    <div className={widgetTightFormInsetSectionClass}>
                      <div className={widgetTightFormLabelClass}>Published Outputs</div>
                      <pre className="max-h-[160px] overflow-auto rounded-[calc(var(--radius)-7px)] bg-background/45 p-3 font-mono text-[11px] leading-5 text-foreground">
                        {renderResponseBody(testState.publishedOutputs)}
                      </pre>
                    </div>
                  </div>

                  <div className={widgetTightFormInsetSectionClass}>
                    <div className={widgetTightFormLabelClass}>Response Body</div>
                    <pre className="max-h-[320px] overflow-auto rounded-[calc(var(--radius)-7px)] bg-background/45 p-3 font-mono text-[11px] leading-5 text-foreground">
                      {renderResponseBody(testState.lastResponseBody)}
                    </pre>
                  </div>
                </section>
                </form>
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
