import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowUpRight, ShieldCheck } from "lucide-react";

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

import { executeAppComponent } from "./appComponentExecution";
import {
  AppComponentRequestTestSection,
  type AppComponentRequestTestState,
} from "./AppComponentRequestTestSection";
import { AppComponentMockJsonEditor } from "./AppComponentMockJsonEditor";
import { AppComponentResponseNotification } from "./AppComponentResponseNotification";
import { AppComponentMainSequenceResourceReleasePicker } from "./AppComponentMainSequenceResourceReleasePicker";
import { AppComponentSchemaDiscoverySection } from "./AppComponentSchemaDiscoverySection";
import { AppComponentServiceHeadersEditor } from "./AppComponentServiceHeadersEditor";
import {
  AppComponentFieldEditor,
  AppComponentFormSections,
  type AppComponentFieldBindingDisplayState,
} from "./AppComponentFormSections";
import {
  buildAppComponentBindingSpec,
  buildDefaultAppComponentMockJsonDefinition,
  buildAppComponentGeneratedForm,
  formatAppComponentFieldLocation,
  isAppComponentMainSequenceResourceReleaseMode,
  listAppComponentRenderableFields,
  listAppComponentRequestBodyContentTypes,
  normalizeAppComponentProps,
  normalizeAppComponentBindingSpec,
  normalizeAppComponentRuntimeState,
  reconcileAppComponentRequestInputMap,
  resolveAppComponentOperation,
  resolveAppComponentFieldBindingStates,
  resolveAppComponentBoundInputOverlay,
  resolveAppComponentInitialDraftValues,
  resolveAppComponentResponseNotification,
  type AppComponentWidgetProps,
} from "./appComponentModel";
import { useAppComponentSchemaExplorer } from "./useAppComponentSchemaExplorer";

function linkClassName(disabled = false) {
  return cn(
    "inline-flex h-8 items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border bg-card/75 px-3 text-xs font-medium text-foreground transition-colors",
    disabled ? "pointer-events-none opacity-50" : "hover:bg-muted/55",
  );
}

function resolveTestStateFromRuntimeState(
  runtimeState: Record<string, unknown> | undefined,
): AppComponentRequestTestState {
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
  const [searchValue, setSearchValue] = useState("");
  const {
    discoveryConfigured,
    docsUrl,
    openApiUrl,
    openApiQuery,
    filteredOperations,
    resolvedOperation,
    operationResponseStatusByKey,
    responseModelStatus,
    responseModelPreview,
    responseUiDescriptor,
    contentTypes,
    generatedForm,
    mappedRequestForms,
    normalizedResolvedBindingSpec,
    reconciledRequestInputMap,
  } = useAppComponentSchemaExplorer({
    normalizedProps,
    searchValue,
  });
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
  const currentBindingSpecSerialized = useMemo(
    () => JSON.stringify(normalizedProps.bindingSpec ?? null),
    [normalizedProps.bindingSpec],
  );
  const nextBindingSpecSerialized = useMemo(
    () => JSON.stringify(normalizedResolvedBindingSpec ?? null),
    [normalizedResolvedBindingSpec],
  );
  const normalizedRequestInputMap = normalizedProps.requestInputMap;
  const currentRequestInputMapSerialized = useMemo(
    () => JSON.stringify(normalizedRequestInputMap ?? null),
    [normalizedRequestInputMap],
  );
  const nextRequestInputMapSerialized = useMemo(
    () => JSON.stringify(reconciledRequestInputMap ?? null),
    [reconciledRequestInputMap],
  );
  const [testState, setTestState] = useState<AppComponentRequestTestState>({
    status: "idle",
  });
  const responsePreview = useMemo(() => {
    if (
      typeof testState.lastResponseStatus !== "number" ||
      testState.lastResponseStatus < 200 ||
      testState.lastResponseStatus >= 300
    ) {
      return undefined;
    }

    const notification = resolveAppComponentResponseNotification(
      testState.lastResponseBody,
      responseUiDescriptor,
    );

    return notification
      ? <AppComponentResponseNotification notification={notification} />
      : undefined;
  }, [responseUiDescriptor, testState.lastResponseBody, testState.lastResponseStatus]);
  const [showMainSequenceReleasePicker, setShowMainSequenceReleasePicker] = useState(false);
  const selectedMainSequenceRelease = normalizedProps.mainSequenceResourceRelease;
  const usingMainSequenceRelease = isAppComponentMainSequenceResourceReleaseMode(
    normalizedProps,
  );
  const usingMockJson = normalizedProps.apiTargetMode === "mock-json";

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

  function handleSelectMainSequenceRelease(release: {
    id: number;
    title: string;
    project_name: string;
    release_kind: string;
    public_url: string | null;
    exchange_launch_url?: string | null;
    subdomain: string;
  }) {
    onDraftPropsChange(
      buildNextDraftProps({
        apiTargetMode: "main-sequence-resource-release",
        mainSequenceResourceRelease: {
          releaseId: release.id,
          label: release.title,
          projectName: release.project_name,
          releaseKind: release.release_kind,
          publicUrl: release.public_url ?? undefined,
          exchangeLaunchUrl: release.exchange_launch_url ?? undefined,
          subdomain: release.subdomain,
        },
        apiBaseUrl: release.public_url ?? draftPropsRef.current.apiBaseUrl,
        method: undefined,
        path: undefined,
        requestBodyContentType: undefined,
      }),
    );
    setShowMainSequenceReleasePicker(false);
  }

  function handleUseManualUrl() {
    onDraftPropsChange(
      buildNextDraftProps({
        apiTargetMode: "manual",
        mainSequenceResourceRelease: undefined,
      }),
    );
    setShowMainSequenceReleasePicker(false);
  }

  function handleTargetModeChange(nextMode: AppComponentWidgetProps["apiTargetMode"]) {
    if (nextMode === "mock-json") {
      const nextMockJson = normalizedProps.mockJson ?? buildDefaultAppComponentMockJsonDefinition({
        method: normalizedProps.method,
        path: normalizedProps.path,
      });

      onDraftPropsChange(
        buildNextDraftProps({
          apiTargetMode: "mock-json",
          mainSequenceResourceRelease: undefined,
          mockJson: nextMockJson,
          showResponse: true,
          method: nextMockJson.operation.method,
          path: nextMockJson.operation.path,
          requestBodyContentType:
            nextMockJson.request?.bodyContentType ?? normalizedProps.requestBodyContentType,
        }),
      );
      setShowMainSequenceReleasePicker(false);
      return;
    }

    if (nextMode === "main-sequence-resource-release") {
      onDraftPropsChange(
        buildNextDraftProps({
          apiTargetMode: "main-sequence-resource-release",
        }),
      );
      setShowMainSequenceReleasePicker(true);
      return;
    }

    handleUseManualUrl();
  }

  async function handleTestSubmit() {
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
      const nextState: AppComponentRequestTestState = result.targetRuntimeState
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
        <Badge variant="neutral">
          {usingMainSequenceRelease ? "Release transport" : "JWT by default"}
        </Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        Paste the OpenAPI URL, Swagger docs URL, or service root, or switch this widget to a Main
        Sequence FastAPI resource release, or define an inline Mock JSON API, then bind the widget
        to one route and render the request form directly inside the workspace.
      </div>

      <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-topbar-foreground">API Target</div>
          <p className="text-sm text-muted-foreground">
            If you paste an explicit <code>/openapi.json</code> URL, discovery uses that exact
            endpoint. If you paste <code>/docs</code> or a service root, the widget resolves the
            sibling discovery endpoints from it. You can also switch this widget to a Main Sequence
            FastAPI resource release, which uses the exchange-launch token flow instead of the
            generic session-JWT transport, or define an inline mock API that never leaves the
            browser.
          </p>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Target mode</span>
          <Select
            value={normalizedProps.apiTargetMode ?? "manual"}
            disabled={!editable}
            onChange={(event) => {
              handleTargetModeChange(event.target.value as AppComponentWidgetProps["apiTargetMode"]);
            }}
          >
            <option value="manual">Manual URL</option>
            <option value="main-sequence-resource-release">Main Sequence release</option>
            <option value="mock-json">Mock JSON</option>
          </Select>
        </label>

        {usingMockJson ? (
          <AppComponentMockJsonEditor
            editable={editable}
            targetMode={normalizedProps.apiTargetMode ?? "mock-json"}
            value={normalizedProps.mockJson}
            onChange={(nextMockJson) => {
              onDraftPropsChange(
                buildNextDraftProps({
                  apiTargetMode: "mock-json",
                  mainSequenceResourceRelease: undefined,
                  mockJson: nextMockJson,
                  showResponse: true,
                  method: nextMockJson.operation.method,
                  path: nextMockJson.operation.path,
                  requestBodyContentType:
                    nextMockJson.request?.bodyContentType ??
                    normalizedProps.requestBodyContentType,
                }),
              );
            }}
          />
        ) : null}

        {!usingMockJson && usingMainSequenceRelease && selectedMainSequenceRelease ? (
          <div className="space-y-3 rounded-[calc(var(--radius)-7px)] border border-primary/25 bg-primary/8 p-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-topbar-foreground">
                Main Sequence resource release
              </div>
              <div className="text-sm text-foreground">
                {selectedMainSequenceRelease.label ?? `Release ${selectedMainSequenceRelease.releaseId}`}
              </div>
              <div className="text-sm text-muted-foreground">
                {[selectedMainSequenceRelease.projectName, selectedMainSequenceRelease.releaseKind]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {selectedMainSequenceRelease.publicUrl ? (
                <div className="break-all text-xs text-muted-foreground">
                  {selectedMainSequenceRelease.publicUrl}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!editable}
                onClick={() => {
                  setShowMainSequenceReleasePicker((current) => !current);
                }}
              >
                {showMainSequenceReleasePicker ? "Hide release search" : "Change release"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!editable}
                onClick={handleUseManualUrl}
              >
                Use manual URL instead
              </Button>
            </div>
          </div>
        ) : !usingMockJson ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!editable}
              onClick={() => {
                setShowMainSequenceReleasePicker((current) => !current);
              }}
            >
              {showMainSequenceReleasePicker
                ? "Hide Main Sequence API search"
                : "Select Main Sequence API"}
            </Button>
          </div>
        ) : null}

        {!usingMockJson && showMainSequenceReleasePicker ? (
          <AppComponentMainSequenceResourceReleasePicker
            editable={editable}
            enabled={showMainSequenceReleasePicker}
            selectedRelease={selectedMainSequenceRelease}
            value={selectedMainSequenceRelease?.releaseId}
            onSelect={handleSelectMainSequenceRelease}
          />
        ) : null}

        {!usingMockJson ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_220px]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-topbar-foreground">OpenAPI or service URL</span>
            <Input
              value={normalizedProps.apiBaseUrl ?? ""}
              readOnly={!editable || usingMainSequenceRelease}
              placeholder="https://api.example.com/service/openapi.json"
              onChange={(event) => {
                if (usingMainSequenceRelease) {
                  return;
                }

                onDraftPropsChange(buildNextDraftProps({
                  apiBaseUrl: event.target.value,
                  apiTargetMode: "manual",
                  mainSequenceResourceRelease: undefined,
                  method: undefined,
                  path: undefined,
                  requestBodyContentType: undefined,
                }));
              }}
            />
            {usingMainSequenceRelease ? (
              <p className="text-xs text-muted-foreground">
                This field mirrors the selected release public URL. Runtime discovery and requests
                use the exchange-launch RPC target behind the scenes.
              </p>
            ) : null}
          </label>

          {usingMainSequenceRelease ? (
            <div className="space-y-2">
              <span className="text-sm font-medium text-topbar-foreground">Transport</span>
              <div className="rounded-[calc(var(--radius)-6px)] border border-success/30 bg-success/10 px-3 py-3 text-sm text-success">
                Requests use the Main Sequence exchange-launch token and <code>X-FastAPI-ID</code>.
                The session JWT is only used when the app asks Command Center for a fresh launch
                token.
              </div>
            </div>
          ) : (
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
          )}
          </div>
        ) : null}

        {!usingMockJson ? (
          <AppComponentServiceHeadersEditor
            editable={editable}
            headers={normalizedProps.serviceHeaders}
            onChange={(serviceHeaders) => {
              onDraftPropsChange(buildNextDraftProps({
                serviceHeaders,
              }, { preserveSelection: true }));
            }}
          />
        ) : null}

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
            checked={usingMockJson ? true : normalizedProps.showResponse === true}
            disabled={!editable || usingMockJson}
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
              {usingMockJson
                ? "Mock JSON always renders its latest response on the canvas card so response UI previews and downstream bindings stay visible."
                : "When enabled, the canvas card renders the latest response using any supported response UI metadata first, then falls back to the read-only generated field layout."}
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

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">
            Request button label
          </span>
          <Input
            value={normalizedProps.requestButtonLabel ?? ""}
            disabled={!editable || normalizedProps.hideRequestButton === true}
            placeholder="Submit"
            onChange={(event) => {
              onDraftPropsChange(buildNextDraftProps({
                requestButtonLabel: event.target.value,
              }, { preserveSelection: true }));
            }}
          />
          <p className="text-sm text-muted-foreground">
            Changes only the canvas request button text. Leave blank to use the default label.
          </p>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">
            Card form columns
          </span>
          <Select
            value={normalizedProps.compactCardLayout ?? "one-column"}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange(
                buildNextDraftProps(
                  {
                    compactCardLayout: event.target.value as AppComponentWidgetProps["compactCardLayout"],
                  },
                  { preserveSelection: true },
                ),
              );
            }}
          >
            <option value="one-column">1 column</option>
            <option value="two-columns">2 columns</option>
            <option value="three-columns">3 columns</option>
          </Select>
          <p className="text-sm text-muted-foreground">
            Controls the mounted card layout for request inputs and response fields. Use 2 or 3
            columns for wide forms; JSON and raw body editors still stay full-width.
          </p>
        </label>

        {!usingMockJson ? (
          <div className="flex flex-wrap items-center gap-2">
          <a href={docsUrl ?? "#"} target="_blank" rel="noreferrer" className={linkClassName(!docsUrl)}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            Swagger UI
          </a>
          <a href={openApiUrl ?? "#"} target="_blank" rel="noreferrer" className={linkClassName(!openApiUrl)}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            OpenAPI JSON
          </a>
          {usingMainSequenceRelease ? (
            <span className="inline-flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              Requests use a temporary Main Sequence launch token
            </span>
          ) : normalizedProps.authMode !== "none" ? (
            <span className="inline-flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              Requests attach the current session JWT
            </span>
          ) : null}
          </div>
        ) : null}
      </section>

      <AppComponentSchemaDiscoverySection
        contentTypes={contentTypes}
        discoveryConfigured={discoveryConfigured}
        editable={editable}
        filteredOperations={filteredOperations}
        generatedForm={generatedForm}
        onRequestBodyContentTypeChange={(contentType) => {
          onDraftPropsChange(buildNextDraftProps({
            requestBodyContentType: contentType,
          }, { preserveSelection: true }));
        }}
        onSearchValueChange={setSearchValue}
        onSelectOperation={(operation) => {
          if (!openApiQuery.data) {
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
        openApiDocument={openApiQuery.data}
        openApiError={openApiQuery.error}
        openApiLoading={openApiQuery.isLoading}
        operationResponseStatusByKey={operationResponseStatusByKey}
        resolvedOperation={resolvedOperation}
        responseModelPreview={responseModelPreview}
        responseModelStatus={responseModelStatus}
        searchValue={searchValue}
        selectedMethod={normalizedProps.method}
        selectedPath={normalizedProps.path}
      />

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
                        compactColumnCount={
                          normalizedProps.compactCardLayout === "three-columns"
                            ? 3
                            : normalizedProps.compactCardLayout === "two-columns"
                              ? 2
                              : 1
                        }
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

                <AppComponentRequestTestSection
                  boundFieldKeys={boundFieldKeys}
                  description="Send a request from settings and inspect the live response here. The canvas widget can also render the latest response when Show response on card is enabled."
                  disabled={
                    testState.status === "submitting" ||
                    executionState?.status === "running"
                  }
                  effectiveDraftValues={effectiveTestDraftValues}
                  fieldBindingStates={fieldBindingDisplayStates}
                  form={mappedSubmissionForm}
                  onSubmit={handleTestSubmit}
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
                  requestProps={normalizedProps}
                  responsePreview={responsePreview}
                  showPublishedOutputs
                  state={testState}
                  submitDisabled={
                    testState.status === "submitting" ||
                    executionState?.status === "running" ||
                    !editable
                  }
	                />
	              </>
	            ) : null}
	    </div>
	  );
	}
