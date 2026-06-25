import { useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { useAuthStore } from "@/auth/auth-store";
import { useToast } from "@/components/ui/toaster";

import {
  deployCodingAgentService,
  fetchCodingAgentDeploymentDefaults,
  fetchProjectExecutorAutomaticDeploymentRuns,
  formatMainSequenceError,
  type AstroCommandCenterAgentServiceDeployResponse,
  type CodingAgentDeploymentDefaultsRecord,
  type CodingAgentServiceSummary,
  type DeployCodingAgentServiceInput,
  type ProjectExecutorAutomaticDeploymentRun,
  type ProjectExecutorAgentServiceDeployResponse,
} from "../../../main_sequence/common/api";
import {
  buildMainSequenceCostEstimateResources,
  normalizeMainSequenceCpuQuantity,
} from "../../../main_sequence/common/components/MainSequenceResourceRequirementsSection";
import {
  buildAvailableRunConfigCacheKey,
  fetchAvailableRunConfigOptions,
} from "../../runtime/available-models-api";
import { resolveMainSequenceAiConfiguredAssistantEndpoint } from "../../runtime/assistant-endpoint";
import {
  buildCurrentModelOptionId,
  normalizeRunConfigKey,
  resolveRunConfigSelection,
} from "../../runtime/run-config-selection";

export interface DeploymentComputeState {
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  gpuRequest: string;
  gpuType: string;
  spot: boolean | null;
}

export type CodingAgentDeploymentResult =
  | ProjectExecutorAgentServiceDeployResponse
  | AstroCommandCenterAgentServiceDeployResponse;

export interface CodingAgentDeploymentControllerConfig {
  agentType: "astro-orchestrator" | "project-executor";
  currentServiceQueryKey: QueryKey;
  enableAutomaticDeployment?: boolean;
  enableDefaultsFallback?: boolean;
  enabled: boolean;
  getDeployStatusSummary: (
    result: CodingAgentDeploymentResult | ProjectExecutorAutomaticDeploymentRun,
  ) => string;
  includeGpuFields?: boolean;
  loadCurrentService: (options: { signal?: AbortSignal }) => Promise<CodingAgentServiceSummary | null>;
  modelCatalogAgentType?: string;
  onDeploySuccess?: (result: CodingAgentDeploymentResult) => Promise<void> | void;
  postSubmitStrategy?:
    | {
        kind: "invalidate-current-service";
      }
    | {
        kind: "none";
      }
    | {
        kind: "poll-project-runs";
        limit?: number;
        ordering?: string;
      };
  resetKey: string;
  scope: DeployCodingAgentServiceInput["scope"];
  toastTitles: {
    failed: string;
    ready: string;
    requested: string;
  };
}

const deploymentProgressStatuses = new Set([
  "waiting_sdk_update",
  "waiting_project_image",
  "waiting_executor_image",
  "running",
  "pending",
]);

const deploymentSuccessStatuses = new Set(["deployed", "no_action"]);
const deploymentFailureStatuses = new Set(["blocked", "failed"]);

function normalizeConfigValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizeDeploymentStatus(status: string | null | undefined) {
  return typeof status === "string" && status.trim() ? status.trim() : "";
}

export function formatDeploymentToken(value: string | null | undefined) {
  const normalized = normalizeDeploymentStatus(value);

  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function isDeploymentProgressStatus(status: string | null | undefined) {
  return deploymentProgressStatuses.has(normalizeDeploymentStatus(status));
}

export function isDeploymentSuccessStatus(status: string | null | undefined) {
  return deploymentSuccessStatuses.has(normalizeDeploymentStatus(status));
}

export function isDeploymentFailureStatus(status: string | null | undefined) {
  return deploymentFailureStatuses.has(normalizeDeploymentStatus(status));
}

function selectDeploymentProgressRun(
  runs: ProjectExecutorAutomaticDeploymentRun[] | undefined,
  deployResult: CodingAgentDeploymentResult | null,
) {
  if (!deployResult || !runs?.length) {
    return null;
  }

  const resultUid = deployResult.uid?.trim();
  const matchingRun = resultUid ? runs.find((run) => run.uid === resultUid) : null;
  return matchingRun ?? runs[0] ?? null;
}

function createDefaultDeploymentComputeState(): DeploymentComputeState {
  return {
    cpuRequest: "",
    cpuLimit: "",
    memoryRequest: "",
    memoryLimit: "",
    gpuRequest: "",
    gpuType: "",
    spot: null,
  };
}

function readDeploymentComputeState(
  value: CodingAgentServiceSummary | CodingAgentDeploymentDefaultsRecord | null,
) {
  if (!value) {
    return createDefaultDeploymentComputeState();
  }

  return {
    cpuRequest: normalizeMainSequenceCpuQuantity(value.cpu_request),
    cpuLimit: normalizeMainSequenceCpuQuantity(value.cpu_limit),
    memoryRequest: normalizeConfigValue(value.memory_request),
    memoryLimit: normalizeConfigValue(value.memory_limit),
    gpuRequest: normalizeConfigValue(value.gpu_request),
    gpuType: normalizeConfigValue(value.gpu_type),
    spot: typeof value.spot === "boolean" ? value.spot : null,
  };
}

export function useCodingAgentDeploymentController(
  config: CodingAgentDeploymentControllerConfig,
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const sessionUserUid = useAuthStore((state) => state.session?.user.uid ?? null);
  const configuredAssistantEndpoint = resolveMainSequenceAiConfiguredAssistantEndpoint();
  const modelCatalogAgentType = config.modelCatalogAgentType ?? "astro-orchestrator";
  const includeGpuFields = config.includeGpuFields === true;
  const automaticDeploymentEnabledByConfig = config.enableAutomaticDeployment === true;
  const defaultsFallbackEnabled = config.enableDefaultsFallback !== false;
  const postSubmitStrategy = config.postSubmitStrategy ?? { kind: "none" as const };
  const serviceQueryKey = [...config.currentServiceQueryKey];
  const modelCatalogCacheKey = useMemo(
    () =>
      buildAvailableRunConfigCacheKey({
        agentType: modelCatalogAgentType,
        userId: sessionUserUid,
      }),
    [modelCatalogAgentType, sessionUserUid],
  );
  const hydratedAutomationKeyRef = useRef<string | null>(null);
  const hydratedComputeKeyRef = useRef<string | null>(null);
  const hydratedLlmKeyRef = useRef<string | null>(null);
  const reportedDeploymentTerminalKeyRef = useRef<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedThinking, setSelectedThinking] = useState("");
  const [computeState, setComputeState] = useState(() => createDefaultDeploymentComputeState());
  const [automaticDeploymentEnabled, setAutomaticDeploymentEnabled] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deployResult, setDeployResult] = useState<CodingAgentDeploymentResult | null>(null);

  const currentServiceQuery = useQuery({
    queryKey: serviceQueryKey,
    queryFn: ({ signal }) => config.loadCurrentService({ signal }),
    enabled: config.enabled,
    staleTime: 60_000,
  });
  const currentService = currentServiceQuery.data ?? null;
  const shouldLoadDefaults =
    config.enabled &&
    defaultsFallbackEnabled &&
    currentServiceQuery.status === "success" &&
    !currentService;
  const deploymentDefaultsQuery = useQuery({
    queryKey: ["main-sequence-ai", "coding-agent-deployment", "defaults", sessionToken],
    queryFn: () => fetchCodingAgentDeploymentDefaults(),
    enabled: shouldLoadDefaults,
    staleTime: 30_000,
  });
  const deploymentDefaults = shouldLoadDefaults ? deploymentDefaultsQuery.data ?? null : null;
  const commandCenterModelOptionsQuery = useQuery({
    queryKey: [
      "main-sequence-ai",
      "coding-agent-deployment",
      "model-options",
      modelCatalogCacheKey,
      sessionToken,
    ],
    queryFn: ({ signal }) =>
      fetchAvailableRunConfigOptions({
        assistantEndpoint: configuredAssistantEndpoint ?? undefined,
        cacheKey: modelCatalogCacheKey,
        createdByUserUid: sessionUserUid,
        runtimeTarget: configuredAssistantEndpoint ? "configured" : "command-center-base",
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: config.enabled && Boolean(sessionToken && sessionUserUid),
    staleTime: 300_000,
  });

  const configurationSource = currentService ?? deploymentDefaults ?? null;
  const currentProvider = normalizeConfigValue(configurationSource?.llm_provider);
  const currentModel = normalizeConfigValue(configurationSource?.llm_model);
  const currentThinking = normalizeConfigValue(configurationSource?.llm_thinking);
  const availableProviders = commandCenterModelOptionsQuery.data?.providers ?? [];
  const availableModels = commandCenterModelOptionsQuery.data?.models ?? [];
  const hasModelCatalog = availableProviders.length > 0 || availableModels.length > 0;
  const runConfigSelection = useMemo(
    () =>
      resolveRunConfigSelection({
        availableModels,
        availableProviders,
        currentModel,
        currentProvider,
        currentThinking,
        selectedModelId,
        selectedProvider,
        selectedThinking,
      }),
    [
      availableModels,
      availableProviders,
      currentModel,
      currentProvider,
      currentThinking,
      selectedModelId,
      selectedProvider,
      selectedThinking,
    ],
  );
  const resolvedLlmProvider = runConfigSelection.resolvedProvider;
  const resolvedLlmModelId = runConfigSelection.resolvedModel;
  const resolvedLlmThinking = runConfigSelection.resolvedThinking;
  const configurationLoading =
    currentServiceQuery.isLoading ||
    (shouldLoadDefaults && deploymentDefaultsQuery.isLoading);
  const configurationReady =
    currentServiceQuery.isSuccess &&
    (!shouldLoadDefaults || deploymentDefaultsQuery.status !== "pending");
  const currentConfigurationKey = [
    currentService?.uid ?? "no-service",
    deploymentDefaults?.uid ?? (shouldLoadDefaults ? "no-defaults" : "defaults-disabled"),
  ].join("::");
  const currentServiceKey =
    currentServiceQuery.isSuccess && !currentServiceQuery.isError
      ? currentService?.uid?.trim() || `${config.resetKey}:new`
      : null;

  const deployMutation = useMutation({
    mutationFn: async () => {
      const body: DeployCodingAgentServiceInput = {
        agent_type: config.agentType,
        scope: config.scope,
        llm_provider: resolvedLlmProvider || undefined,
        llm_model: resolvedLlmModelId || undefined,
        llm_thinking: resolvedLlmThinking || undefined,
        cpu_request: normalizeMainSequenceCpuQuantity(computeState.cpuRequest) || undefined,
        cpu_limit: normalizeMainSequenceCpuQuantity(computeState.cpuLimit) || undefined,
        memory_request: computeState.memoryRequest.trim() || undefined,
        memory_limit: computeState.memoryLimit.trim() || undefined,
        spot: computeState.spot ?? undefined,
      };

      if (automaticDeploymentEnabledByConfig) {
        body.automatic_deployment = automaticDeploymentEnabled;
      }

      if (includeGpuFields) {
        body.gpu_request = computeState.gpuRequest.trim() || undefined;
        body.gpu_type = computeState.gpuType.trim() || undefined;
      }

      return deployCodingAgentService<CodingAgentDeploymentResult>(body);
    },
    onSuccess: async (result) => {
      reportedDeploymentTerminalKeyRef.current = null;
      setDeployResult(result);
      await config.onDeploySuccess?.(result);

      if (postSubmitStrategy.kind === "invalidate-current-service") {
        await queryClient.invalidateQueries({
          queryKey: serviceQueryKey,
        });
      }

      const status = normalizeDeploymentStatus(result.status);
      toast({
        variant: isDeploymentFailureStatus(status)
          ? "error"
          : isDeploymentProgressStatus(status)
            ? "info"
            : "success",
        title: isDeploymentFailureStatus(status)
          ? config.toastTitles.failed
          : isDeploymentProgressStatus(status)
            ? config.toastTitles.requested
            : config.toastTitles.ready,
        description: config.getDeployStatusSummary(result),
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: config.toastTitles.failed,
        description: formatMainSequenceError(error),
      });
    },
  });

  const deploymentRunsPollingQuery = useQuery({
    queryKey: [
      ...serviceQueryKey,
      "deployment-progress-runs",
      deployResult?.uid ?? "none",
    ],
    queryFn: () =>
      fetchProjectExecutorAutomaticDeploymentRuns({
        ordering: postSubmitStrategy.kind === "poll-project-runs" ? postSubmitStrategy.ordering : undefined,
        limit: postSubmitStrategy.kind === "poll-project-runs" ? postSubmitStrategy.limit : undefined,
      }),
    enabled:
      postSubmitStrategy.kind === "poll-project-runs" &&
      Boolean(deployResult && isDeploymentProgressStatus(deployResult.status)),
    refetchInterval:
      postSubmitStrategy.kind === "poll-project-runs" &&
      isDeploymentProgressStatus(deployResult?.status)
        ? 5_000
        : false,
    staleTime: 0,
  });
  const latestDeploymentProgressRun = useMemo(
    () => selectDeploymentProgressRun(deploymentRunsPollingQuery.data, deployResult),
    [deploymentRunsPollingQuery.data, deployResult],
  );

  useEffect(() => {
    if (!config.enabled) {
      setSelectedProvider("");
      setSelectedModelId("");
      setSelectedThinking("");
      setComputeState(createDefaultDeploymentComputeState());
      setAutomaticDeploymentEnabled(false);
      setDeployDialogOpen(false);
      setDeployResult(null);
      hydratedAutomationKeyRef.current = null;
      hydratedComputeKeyRef.current = null;
      hydratedLlmKeyRef.current = null;
      reportedDeploymentTerminalKeyRef.current = null;
    }
  }, [config.enabled]);

  useEffect(() => {
    setSelectedProvider("");
    setSelectedModelId("");
    setSelectedThinking("");
    setComputeState(createDefaultDeploymentComputeState());
    setAutomaticDeploymentEnabled(false);
    setDeployDialogOpen(false);
    setDeployResult(null);
    hydratedAutomationKeyRef.current = null;
    hydratedComputeKeyRef.current = null;
    hydratedLlmKeyRef.current = null;
    reportedDeploymentTerminalKeyRef.current = null;
  }, [config.resetKey]);

  useEffect(() => {
    if (configurationLoading || currentServiceQuery.isError || !currentServiceKey) {
      return;
    }

    if (hydratedComputeKeyRef.current === currentConfigurationKey) {
      return;
    }

    setComputeState(readDeploymentComputeState(configurationSource));
    hydratedComputeKeyRef.current = currentConfigurationKey;
  }, [
    configurationLoading,
    configurationSource,
    currentConfigurationKey,
    currentServiceKey,
    currentServiceQuery.isError,
  ]);

  useEffect(() => {
    if (!automaticDeploymentEnabledByConfig || configurationLoading || currentServiceQuery.isError || !currentServiceKey) {
      return;
    }

    if (hydratedAutomationKeyRef.current === currentServiceKey) {
      return;
    }

    setAutomaticDeploymentEnabled(currentService?.automatic_deployment === true);
    hydratedAutomationKeyRef.current = currentServiceKey;
  }, [
    automaticDeploymentEnabledByConfig,
    configurationLoading,
    currentService?.automatic_deployment,
    currentServiceKey,
    currentServiceQuery.isError,
  ]);

  useEffect(() => {
    if (!currentProvider && !currentModel && !currentThinking) {
      return;
    }

    const hydrationKey = [
      currentConfigurationKey,
      currentProvider,
      currentModel,
      currentThinking,
      availableProviders.length,
      availableModels.length,
    ].join("::");

    if (hydratedLlmKeyRef.current === hydrationKey) {
      return;
    }

    const providerMatch =
      availableProviders.find(
        (provider) =>
          normalizeRunConfigKey(provider.value) === normalizeRunConfigKey(currentProvider),
      ) ?? null;
    const modelMatch =
      availableModels.find(
        (model) =>
          normalizeRunConfigKey(model.value) === normalizeRunConfigKey(currentModel) &&
          normalizeRunConfigKey(model.provider) === normalizeRunConfigKey(currentProvider),
      ) ?? null;

    setSelectedProvider(providerMatch?.value ?? currentProvider);
    setSelectedModelId(
      modelMatch?.id ??
        (currentProvider && currentModel
          ? buildCurrentModelOptionId(currentProvider, currentModel)
          : ""),
    );
    setSelectedThinking(currentThinking);
    hydratedLlmKeyRef.current = hydrationKey;
  }, [
    availableModels,
    availableProviders,
    currentConfigurationKey,
    currentModel,
    currentProvider,
    currentThinking,
  ]);

  useEffect(() => {
    const providerOptions = runConfigSelection.providerOptions;

    if (providerOptions.length === 0) {
      if (selectedProvider) {
        setSelectedProvider("");
      }
      return;
    }

    if (
      selectedProvider &&
      providerOptions.some(
        (provider) =>
          normalizeRunConfigKey(provider.value) === normalizeRunConfigKey(selectedProvider),
      )
    ) {
      return;
    }

    const preferredProvider =
      providerOptions.find(
        (provider) =>
          normalizeRunConfigKey(provider.value) === normalizeRunConfigKey(currentProvider),
      )?.value ?? providerOptions[0]?.value ?? "";

    if (preferredProvider !== selectedProvider) {
      setSelectedProvider(preferredProvider);
    }
  }, [currentProvider, runConfigSelection.providerOptions, selectedProvider]);

  useEffect(() => {
    const modelOptions = runConfigSelection.modelOptions;

    if (modelOptions.length === 0) {
      if (selectedModelId) {
        setSelectedModelId("");
      }
      return;
    }

    if (selectedModelId && modelOptions.some((option) => option.value === selectedModelId)) {
      return;
    }

    const preferredModel =
      modelOptions.find(
        (option) =>
          normalizeRunConfigKey(option.modelValue) === normalizeRunConfigKey(currentModel),
      )?.value ?? null;
    const firstUsableModel = modelOptions.find((option) => !option.disabled) ?? modelOptions[0] ?? null;
    const nextModelId = preferredModel ?? firstUsableModel?.value ?? "";

    if (nextModelId !== selectedModelId) {
      setSelectedModelId(nextModelId);
    }
  }, [currentModel, runConfigSelection.modelOptions, selectedModelId]);

  useEffect(() => {
    const reasoningOptions = runConfigSelection.reasoningOptions;
    const selectedReasoningIsValid = reasoningOptions.some(
      (option) => option.value === selectedThinking,
    );

    if (selectedReasoningIsValid) {
      return;
    }

    const nextThinking =
      runConfigSelection.selectedCatalogModel?.defaultReasoningEffort ??
      reasoningOptions[0]?.value ??
      currentThinking ??
      "";

    if (nextThinking !== selectedThinking) {
      setSelectedThinking(nextThinking);
    }
  }, [
    currentThinking,
    runConfigSelection.reasoningOptions,
    runConfigSelection.selectedCatalogModel,
    selectedThinking,
  ]);

  useEffect(() => {
    if (!latestDeploymentProgressRun) {
      return;
    }

    setDeployResult((current) => {
      if (!current || !isDeploymentProgressStatus(current.status)) {
        return current;
      }

      const nextStatus = latestDeploymentProgressRun.status || current.status;
      const nextStep = latestDeploymentProgressRun.current_step ?? current.current_step;
      const nextResult = latestDeploymentProgressRun.result ?? current.result;
      const nextErrorCode = latestDeploymentProgressRun.error_code ?? current.error_code;
      const nextErrorDetail = latestDeploymentProgressRun.error_detail ?? current.error_detail;

      if (
        current.status === nextStatus &&
        current.current_step === nextStep &&
        current.result === nextResult &&
        current.error_code === nextErrorCode &&
        current.error_detail === nextErrorDetail
      ) {
        return current;
      }

      return {
        ...current,
        status: nextStatus,
        current_step: nextStep,
        result: nextResult,
        error_code: nextErrorCode,
        error_detail: nextErrorDetail,
      };
    });
  }, [latestDeploymentProgressRun]);

  useEffect(() => {
    if (postSubmitStrategy.kind !== "poll-project-runs" || !deployResult || !latestDeploymentProgressRun) {
      return;
    }

    const status = normalizeDeploymentStatus(deployResult.status);

    if (!isDeploymentSuccessStatus(status) && !isDeploymentFailureStatus(status)) {
      return;
    }

    const reportKey = `${deployResult.uid}:${status}`;

    if (reportedDeploymentTerminalKeyRef.current === reportKey) {
      return;
    }

    reportedDeploymentTerminalKeyRef.current = reportKey;

    toast({
      variant: isDeploymentFailureStatus(status) ? "error" : "success",
      title: isDeploymentFailureStatus(status)
        ? config.toastTitles.failed
        : config.toastTitles.ready,
      description: config.getDeployStatusSummary(deployResult),
    });
  }, [
    config,
    deployResult,
    latestDeploymentProgressRun,
    postSubmitStrategy.kind,
    toast,
  ]);

  const currentSelectionUsesCurrentConfiguration = Boolean(
    currentProvider &&
      currentModel &&
      normalizeRunConfigKey(resolvedLlmProvider) === normalizeRunConfigKey(currentProvider) &&
      normalizeRunConfigKey(resolvedLlmModelId) === normalizeRunConfigKey(currentModel),
  );
  const thinkingRequired =
    runConfigSelection.reasoningOptions.length > 0 || Boolean(currentThinking);
  const llmSelectionIsValid = Boolean(
    configurationReady &&
      resolvedLlmProvider &&
      resolvedLlmModelId &&
      (!thinkingRequired || resolvedLlmThinking) &&
      (runConfigSelection.selectedCatalogModel
        ? runConfigSelection.selectedCatalogModelIsUsable
        : currentSelectionUsesCurrentConfiguration),
  );
  const resolvedCpuRequest = normalizeMainSequenceCpuQuantity(computeState.cpuRequest);
  const resolvedCpuLimit = normalizeMainSequenceCpuQuantity(computeState.cpuLimit);
  const resolvedMemoryRequest = computeState.memoryRequest.trim();
  const resolvedMemoryLimit = computeState.memoryLimit.trim();
  const resourceSelectionIsValid = Boolean(
    configurationReady &&
      resolvedCpuRequest &&
      resolvedCpuLimit &&
      resolvedMemoryRequest &&
      resolvedMemoryLimit,
  );
  const costEstimateResources =
    computeState.spot === null
      ? null
      : buildMainSequenceCostEstimateResources({
          cpuRequest: computeState.cpuRequest,
          gpuRequest: includeGpuFields ? computeState.gpuRequest : null,
          gpuType: includeGpuFields ? computeState.gpuType : null,
          memoryRequest: computeState.memoryRequest,
          spot: computeState.spot,
        });
  const deployResultStatus = normalizeDeploymentStatus(deployResult?.status);
  const deployResultIsProgress = isDeploymentProgressStatus(deployResultStatus);
  const deployResultIsFailure = isDeploymentFailureStatus(deployResultStatus);
  const deployResultIsSuccess = isDeploymentSuccessStatus(deployResultStatus);
  const automaticDeploymentReady =
    !automaticDeploymentEnabledByConfig ||
    Boolean(currentServiceKey && hydratedAutomationKeyRef.current === currentServiceKey);

  async function confirmDeploy() {
    if (!llmSelectionIsValid) {
      throw new Error("Select a usable LLM provider, model, and thinking configuration before deploying.");
    }

    if (!resourceSelectionIsValid) {
      throw new Error("Enter CPU request, CPU limit, memory request, and memory limit before deploying.");
    }

    if (!automaticDeploymentReady) {
      throw new Error("Wait for the current deployment configuration to finish loading.");
    }

    return deployMutation.mutateAsync();
  }

  async function refetchAll() {
    await Promise.all([
      currentServiceQuery.refetch(),
      shouldLoadDefaults ? deploymentDefaultsQuery.refetch() : Promise.resolve(null),
      commandCenterModelOptionsQuery.refetch(),
    ]);
  }

  return {
    automaticDeploymentEnabled,
    automaticDeploymentEnabledByConfig,
    automaticDeploymentReady,
    commandCenterModelOptionsQuery,
    configurationLoading,
    configurationReady,
    configurationSource,
    confirmDeploy,
    costEstimateResources,
    currentModel,
    currentProvider,
    currentSelectionUsesCurrentConfiguration,
    currentService,
    currentServiceQuery,
    currentThinking,
    deployDialogOpen,
    deployMutation,
    deployResult,
    deployResultIsFailure,
    deployResultIsProgress,
    deployResultIsSuccess,
    deployResultStatus,
    deploymentDefaults,
    deploymentDefaultsQuery,
    deploymentRunsPollingQuery,
    formatDeploymentToken,
    getDeployStatusSummary: config.getDeployStatusSummary,
    hasModelCatalog,
    includeGpuFields,
    llmSelectionIsValid,
    latestDeploymentProgressRun,
    refetchAll,
    resolvedCpuLimit,
    resolvedCpuRequest,
    resolvedLlmModelId,
    resolvedLlmProvider,
    resolvedLlmThinking,
    resolvedMemoryLimit,
    resolvedMemoryRequest,
    resourceSelectionIsValid,
    runConfigSelection,
    selectedModelId,
    selectedProvider,
    selectedThinking,
    setAutomaticDeploymentEnabled,
    setComputeState,
    setDeployDialogOpen,
    setSelectedModelId,
    setSelectedProvider,
    setSelectedThinking,
    showDefaultsWarning:
      shouldLoadDefaults &&
      deploymentDefaultsQuery.isError &&
      !configurationLoading &&
      !currentService,
    shouldLoadDefaults,
    usesDefaultsFallback: Boolean(!currentService && deploymentDefaults),
    computeState,
  };
}

export type CodingAgentDeploymentController = ReturnType<
  typeof useCodingAgentDeploymentController
>;
