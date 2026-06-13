import { useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";

import {
  deleteProjectExecutorAgentServiceByProject,
  deployProjectExecutorAgentService,
  fetchProjectExecutorAutomaticDeploymentRuns,
  fetchProjectExecutorAgentServiceByProject,
  formatMainSequenceError,
  type ProjectExecutorAgentServiceDeployResponse,
  type ProjectExecutorAutomaticDeploymentRun,
} from "../../../main_sequence/common/api";
import {
  buildMainSequenceCostEstimateResources,
  MainSequenceCapacityToggle,
  MainSequenceResourceField,
  MainSequenceResourceRequirementsSection,
} from "../../../main_sequence/common/components/MainSequenceResourceRequirementsSection";
import { fetchAgentDetail } from "../../agent-search";
import { normalizeAgentImageDriftRecord } from "../../image-drift";
import {
  buildAvailableRunConfigCacheKey,
  fetchAvailableRunConfigOptions,
} from "../../runtime/available-models-api";
import { resolveMainSequenceAiConfiguredAssistantEndpoint } from "../../runtime/assistant-endpoint";

interface DeploymentComputeState {
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  spot: boolean | null;
}

function createDefaultDeploymentComputeState(): DeploymentComputeState {
  return {
    cpuRequest: "",
    cpuLimit: "",
    memoryRequest: "",
    memoryLimit: "",
    spot: null,
  };
}

function normalizeCatalogKey(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

const commandCenterAgentType = "astro-orchestrator";

const deploymentProgressStatuses = new Set([
  "waiting_sdk_update",
  "waiting_project_image",
  "waiting_executor_image",
  "running",
  "pending",
]);

const deploymentSuccessStatuses = new Set(["deployed", "no_action"]);
const deploymentFailureStatuses = new Set(["blocked", "failed"]);

function normalizeConfigValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeDeploymentStatus(status: string | null | undefined) {
  return typeof status === "string" && status.trim() ? status.trim() : "";
}

function formatDeploymentToken(value: string | null | undefined) {
  const normalized = normalizeDeploymentStatus(value);

  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function isDeploymentProgressStatus(status: string | null | undefined) {
  return deploymentProgressStatuses.has(normalizeDeploymentStatus(status));
}

function isDeploymentSuccessStatus(status: string | null | undefined) {
  return deploymentSuccessStatuses.has(normalizeDeploymentStatus(status));
}

function isDeploymentFailureStatus(status: string | null | undefined) {
  return deploymentFailureStatuses.has(normalizeDeploymentStatus(status));
}

function getDeployResultMessage(
  result: ProjectExecutorAgentServiceDeployResponse | ProjectExecutorAutomaticDeploymentRun,
) {
  const message = result.result?.message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function getDeployStatusSummary(
  result: ProjectExecutorAgentServiceDeployResponse | ProjectExecutorAutomaticDeploymentRun,
) {
  const status = normalizeDeploymentStatus(result.status);

  switch (status) {
    case "deployed":
      return "Deployment completed. Refreshing the project agent service state.";
    case "no_action":
      return "Project agent is already current. Refreshing the project agent service state.";
    case "waiting_sdk_update":
      return "Waiting for the SDK update before deployment can continue.";
    case "waiting_project_image":
      return "Project image is still building.";
    case "waiting_executor_image":
      return "Executor image is still building.";
    case "running":
    case "pending":
      return `Current step: ${formatDeploymentToken(result.current_step)}`;
    case "blocked":
      return result.error_detail?.trim() || getDeployResultMessage(result) || "Deployment is blocked.";
    case "failed":
      return result.error_detail?.trim() || getDeployResultMessage(result) || "Deployment failed.";
    default:
      return result.error_detail?.trim() || getDeployResultMessage(result) || `Status: ${formatDeploymentToken(status)}`;
  }
}

function selectDeploymentProgressRun(
  runs: ProjectExecutorAutomaticDeploymentRun[] | undefined,
  deployResult: ProjectExecutorAgentServiceDeployResponse | null,
) {
  if (!deployResult || !runs?.length) {
    return null;
  }

  const resultUid = deployResult.uid?.trim();
  const matchingRun = resultUid ? runs.find((run) => run.uid === resultUid) : null;
  return matchingRun ?? runs[0] ?? null;
}

function buildCurrentModelOptionId(provider: string, model: string) {
  return ["current", provider.trim(), model.trim()].join("::");
}

function readServiceImageDrift(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return normalizeAgentImageDriftRecord(candidate.image_drift);
}

function readLinkedAgentUid(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const agentUid = normalizeConfigValue(candidate.agent_uid);
  return agentUid || null;
}

function readServiceComputeState(value: unknown): DeploymentComputeState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createDefaultDeploymentComputeState();
  }

  const candidate = value as Record<string, unknown>;

  return {
    cpuRequest: normalizeConfigValue(candidate.cpu_request),
    cpuLimit: normalizeConfigValue(candidate.cpu_limit),
    memoryRequest: normalizeConfigValue(candidate.memory_request),
    memoryLimit: normalizeConfigValue(candidate.memory_limit),
    spot: typeof candidate.spot === "boolean" ? candidate.spot : null,
  };
}

export function ProjectAgentConfigurator({
  projectUid,
  hasAgentCapabilities,
  onAutomaticDeploymentStateChange,
}: {
  projectUid: string;
  hasAgentCapabilities: boolean | null;
  onAutomaticDeploymentStateChange?: (enabled: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const sessionUserUid = useAuthStore((state) => state.session?.user.uid ?? null);
  const [selectedLlmProvider, setSelectedLlmProvider] = useState("");
  const [selectedLlmModelId, setSelectedLlmModelId] = useState("");
  const [selectedLlmThinking, setSelectedLlmThinking] = useState("");
  const hydratedProjectAgentModelKeyRef = useRef<string | null>(null);
  const reportedDeploymentTerminalKeyRef = useRef<string | null>(null);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deployResult, setDeployResult] = useState<ProjectExecutorAgentServiceDeployResponse | null>(
    null,
  );
  const [automaticDeploymentEnabled, setAutomaticDeploymentEnabled] = useState(false);
  const [hydratedAutomationServiceKey, setHydratedAutomationServiceKey] = useState<string | null>(
    null,
  );
  const [hydratedComputeServiceKey, setHydratedComputeServiceKey] = useState<string | null>(null);
  const [computeState, setComputeState] = useState(() => createDefaultDeploymentComputeState());
  const commandCenterModelCatalogCacheKey = useMemo(
    () =>
      buildAvailableRunConfigCacheKey({
        agentType: commandCenterAgentType,
        userId: sessionUserUid,
      }),
    [sessionUserUid],
  );
  const configuredAssistantEndpoint = resolveMainSequenceAiConfiguredAssistantEndpoint();
  const commandCenterModelOptionsQuery = useQuery({
    queryKey: [
      "main_sequence_ai",
      "project-agent",
      "command-center-model-options",
      commandCenterModelCatalogCacheKey,
      sessionToken,
    ],
    queryFn: ({ signal }) =>
      fetchAvailableRunConfigOptions({
        assistantEndpoint: configuredAssistantEndpoint ?? undefined,
        cacheKey: commandCenterModelCatalogCacheKey,
        createdByUserUid: sessionUserUid,
        runtimeTarget: configuredAssistantEndpoint ? "configured" : "command-center-base",
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: hasAgentCapabilities === true && Boolean(sessionToken && sessionUserUid),
    staleTime: 300_000,
  });

  const currentProjectAgentServiceQuery = useQuery({
    queryKey: ["main_sequence", "projects", "project-agent", "service", projectUid],
    queryFn: () => fetchProjectExecutorAgentServiceByProject(projectUid),
    enabled: Boolean(projectUid) && hasAgentCapabilities === true,
    staleTime: 60_000,
  });
  const currentProjectAgentService = currentProjectAgentServiceQuery.data ?? null;
  const currentAutomationServiceKey =
    !currentProjectAgentServiceQuery.isLoading && !currentProjectAgentServiceQuery.isError
      ? currentProjectAgentService?.uid?.trim() || `${projectUid}:new`
      : null;
  const automationConfigurationReady = Boolean(
    currentAutomationServiceKey && hydratedAutomationServiceKey === currentAutomationServiceKey,
  );
  const resourceConfigurationReady = Boolean(
    currentAutomationServiceKey && hydratedComputeServiceKey === currentAutomationServiceKey,
  );
  const currentProjectAgentUid = readLinkedAgentUid(currentProjectAgentServiceQuery.data);
  const currentProjectAgentDetailQuery = useQuery({
    queryKey: [
      "main_sequence_ai",
      "project-agent",
      "agent-detail",
      currentProjectAgentUid,
      sessionToken,
    ],
    queryFn: () =>
      fetchAgentDetail({
        agentId: currentProjectAgentUid!,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: Boolean(currentProjectAgentUid && sessionToken),
    staleTime: 60_000,
  });

  const availableProviders = commandCenterModelOptionsQuery.data?.providers ?? [];
  const availableModels = commandCenterModelOptionsQuery.data?.models ?? [];
  const hasRuntimeModelCatalog = availableModels.length > 0;
  const currentProjectAgentProvider = normalizeConfigValue(
    currentProjectAgentDetailQuery.data?.llm_provider,
  );
  const currentProjectAgentModel = normalizeConfigValue(
    currentProjectAgentDetailQuery.data?.llm_model,
  );
  const currentProjectAgentThinking = normalizeConfigValue(
    currentProjectAgentDetailQuery.data?.llm_thinking,
  );
  const requiresBackendAgentModelConfiguration = Boolean(currentProjectAgentUid);
  const currentProjectAgentDetailIsPending = Boolean(
    currentProjectAgentUid && currentProjectAgentDetailQuery.isLoading,
  );
  const linkedAgentModelConfigurationReady =
    !requiresBackendAgentModelConfiguration ||
    Boolean(currentProjectAgentDetailQuery.data && currentProjectAgentProvider && currentProjectAgentModel);
  const linkedAgentModelConfigurationMissing = Boolean(
    currentProjectAgentUid &&
      currentProjectAgentDetailQuery.data &&
      (!currentProjectAgentProvider || !currentProjectAgentModel),
  );
  const llmConfigurationIsPending =
    currentProjectAgentServiceQuery.isLoading || currentProjectAgentDetailIsPending;
  const imageDrift = readServiceImageDrift(currentProjectAgentServiceQuery.data);
  const driftedImageChecks = (imageDrift?.checks ?? []).filter((check) => check.has_drift === true);
  const shouldShowImageDrift = imageDrift?.has_drift === true;
  const imageDriftAutohealMessage = imageDrift?.autoheal_message?.trim() || null;
  const currentProjectAgentCatalogModel = useMemo(
    () =>
      currentProjectAgentProvider && currentProjectAgentModel
        ? availableModels.find(
            (model) =>
              normalizeCatalogKey(model.value) === normalizeCatalogKey(currentProjectAgentModel) &&
              normalizeCatalogKey(model.provider) === normalizeCatalogKey(currentProjectAgentProvider),
          ) ?? null
        : null,
    [availableModels, currentProjectAgentModel, currentProjectAgentProvider],
  );
  const currentProjectAgentModelOptionId =
    currentProjectAgentCatalogModel?.id ||
    (currentProjectAgentProvider && currentProjectAgentModel
      ? buildCurrentModelOptionId(currentProjectAgentProvider, currentProjectAgentModel)
      : "");
  const effectiveSelectedLlmProvider =
    selectedLlmProvider || (requiresBackendAgentModelConfiguration ? currentProjectAgentProvider : "");
  const effectiveSelectedLlmModelId =
    selectedLlmModelId || (requiresBackendAgentModelConfiguration ? currentProjectAgentModelOptionId : "");
  const effectiveSelectedLlmThinking =
    selectedLlmThinking || (requiresBackendAgentModelConfiguration ? currentProjectAgentThinking : "");
  const llmConfigurationCanRender = Boolean(
    !llmConfigurationIsPending &&
      !currentProjectAgentServiceQuery.isError &&
      !currentProjectAgentDetailQuery.isError &&
      linkedAgentModelConfigurationReady,
  );
  const providerOptions = useMemo(
    () => {
      const options = availableProviders.map((entry) => ({
        label: entry.label,
        value: entry.value,
      }));
      const hasCurrentProvider =
        currentProjectAgentProvider &&
        options.some(
          (entry) =>
            normalizeCatalogKey(entry.value) === normalizeCatalogKey(currentProjectAgentProvider),
        );

      if (currentProjectAgentProvider && !hasCurrentProvider) {
        options.unshift({
          label: `${currentProjectAgentProvider} (current)`,
          value: currentProjectAgentProvider,
        });
      }

      return options;
    },
    [availableProviders, currentProjectAgentProvider],
  );
  const filteredModelOptions = useMemo(() => {
    const scopedModels = effectiveSelectedLlmProvider
      ? availableModels.filter((entry) => entry.provider === effectiveSelectedLlmProvider)
      : availableModels;

    const options = scopedModels.map((entry) => {
      const unusable = Boolean(entry.auth?.required && !entry.auth.usable);

      return {
        disabled: unusable,
        label: unusable ? `${entry.label} (Not authenticated)` : entry.label,
        provider: entry.provider,
        value: entry.id,
        modelValue: entry.value,
      };
    });

    if (currentProjectAgentProvider && currentProjectAgentModel) {
      const selectedProviderMatchesCurrent =
        !effectiveSelectedLlmProvider ||
        normalizeCatalogKey(effectiveSelectedLlmProvider) === normalizeCatalogKey(currentProjectAgentProvider);
      const hasCurrentModel = scopedModels.some(
        (model) =>
          normalizeCatalogKey(model.value) === normalizeCatalogKey(currentProjectAgentModel) &&
          normalizeCatalogKey(model.provider) === normalizeCatalogKey(currentProjectAgentProvider),
      );

      if (selectedProviderMatchesCurrent && !hasCurrentModel) {
        options.unshift({
          disabled: false,
          label: `${currentProjectAgentModel} (current)`,
          provider: currentProjectAgentProvider,
          value: buildCurrentModelOptionId(currentProjectAgentProvider, currentProjectAgentModel),
          modelValue: currentProjectAgentModel,
        });
      }
    }

    return options;
  }, [
    availableModels,
    currentProjectAgentModel,
    currentProjectAgentProvider,
    effectiveSelectedLlmProvider,
  ]);
  const selectedModelOption =
    filteredModelOptions.find((entry) => entry.value === effectiveSelectedLlmModelId) ?? null;
  const selectedDeploymentModel =
    availableModels.find((entry) => entry.id === effectiveSelectedLlmModelId) ?? null;
  const selectedReasoningEffortOptions = useMemo(() => {
    const options = selectedDeploymentModel?.reasoningEfforts.length
      ? [...selectedDeploymentModel.reasoningEfforts]
      : [];
    const selectedThinking = effectiveSelectedLlmThinking.trim();
    const hasSelectedThinking =
      selectedThinking &&
      options.some((entry) => normalizeCatalogKey(entry.value) === normalizeCatalogKey(selectedThinking));

    if (selectedThinking && !hasSelectedThinking) {
      options.unshift({
        label: `${selectedThinking} (current)`,
        value: selectedThinking,
      });
    }

    return options;
  }, [effectiveSelectedLlmThinking, selectedDeploymentModel]);
  const resolvedLlmProvider =
    selectedDeploymentModel?.provider?.trim() ||
    selectedModelOption?.provider?.trim() ||
    effectiveSelectedLlmProvider.trim() ||
    currentProjectAgentProvider;
  const resolvedLlmModelId =
    selectedDeploymentModel?.value.trim() ||
    selectedModelOption?.modelValue?.trim() ||
    currentProjectAgentModel;
  const resolvedLlmThinking = effectiveSelectedLlmThinking.trim() || currentProjectAgentThinking;
  const selectedCatalogModelIsUsable = !(
    selectedDeploymentModel?.auth?.required && !selectedDeploymentModel.auth.usable
  );
  const llmSelectionIsValid = Boolean(
      llmConfigurationCanRender &&
      resolvedLlmProvider &&
      resolvedLlmModelId &&
      selectedCatalogModelIsUsable &&
      !(currentProjectAgentUid && currentProjectAgentDetailQuery.isLoading),
  );
  const hasReasoningEffortOptions = selectedReasoningEffortOptions.length > 0;
  const currentAgentModelMissingFromCatalog = Boolean(
    currentProjectAgentProvider &&
      currentProjectAgentModel &&
      hasRuntimeModelCatalog &&
      !availableModels.some(
        (model) =>
          normalizeCatalogKey(model.value) === normalizeCatalogKey(currentProjectAgentModel) &&
          normalizeCatalogKey(model.provider) === normalizeCatalogKey(currentProjectAgentProvider),
      ),
  );
  const resolvedCpuRequest = computeState.cpuRequest.trim();
  const resolvedCpuLimit = computeState.cpuLimit.trim();
  const resolvedMemoryRequest = computeState.memoryRequest.trim();
  const resolvedMemoryLimit = computeState.memoryLimit.trim();
  const resourceSelectionIsValid = Boolean(
    resourceConfigurationReady &&
      resolvedCpuRequest &&
      resolvedCpuLimit &&
      resolvedMemoryRequest &&
      resolvedMemoryLimit,
  );
  const costEstimateResources = useMemo(
    () =>
      computeState.spot === null
        ? null
        : buildMainSequenceCostEstimateResources({
            cpuRequest: computeState.cpuRequest,
            memoryRequest: computeState.memoryRequest,
            spot: computeState.spot,
          }),
    [computeState.cpuRequest, computeState.memoryRequest, computeState.spot],
  );

  const deployAgentMutation = useMutation({
    mutationFn: async (input: {
      project_uid: string;
      llm_provider: string;
      llm_model: string;
      llm_thinking?: string;
      automatic_deployment?: boolean;
      cpu_request?: string;
      cpu_limit?: string;
      memory_request?: string;
      memory_limit?: string;
      spot?: boolean;
    }) => {
      return await deployProjectExecutorAgentService(input);
    },
    onSuccess: async (result) => {
      reportedDeploymentTerminalKeyRef.current = null;
      setDeployResult(result);

      const status = normalizeDeploymentStatus(result.status);

      toast({
        variant: isDeploymentFailureStatus(status)
          ? "error"
          : isDeploymentProgressStatus(status)
            ? "info"
            : "success",
        title: isDeploymentFailureStatus(status)
          ? "Project agent deployment did not complete"
          : isDeploymentProgressStatus(status)
            ? "Project agent deployment started"
            : "Project agent deployment ready",
        description: getDeployStatusSummary(result),
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Project agent deployment failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const deploymentRunsPollingQuery = useQuery({
    queryKey: [
      "main_sequence_ai",
      "project-agent",
      "deployment-progress-runs",
      deployResult?.uid ?? "none",
    ],
    queryFn: () =>
      fetchProjectExecutorAutomaticDeploymentRuns({
        ordering: "-created_at",
        limit: 20,
      }),
    enabled: Boolean(deployResult && isDeploymentProgressStatus(deployResult.status)),
    refetchInterval: isDeploymentProgressStatus(deployResult?.status) ? 5_000 : false,
    staleTime: 0,
  });
  const latestDeploymentProgressRun = useMemo(
    () => selectDeploymentProgressRun(deploymentRunsPollingQuery.data, deployResult),
    [deploymentRunsPollingQuery.data, deployResult],
  );

  const deleteProjectAgentMutation = useMutation({
    mutationFn: () => deleteProjectExecutorAgentServiceByProject(projectUid),
    onSuccess: async () => {
      setDeployResult(null);
      setSelectedLlmProvider("");
      setSelectedLlmModelId("");
      setSelectedLlmThinking("");
      hydratedProjectAgentModelKeyRef.current = null;
      setAutomaticDeploymentEnabled(false);
      setHydratedAutomationServiceKey(null);
      setComputeState(createDefaultDeploymentComputeState());
      setHydratedComputeServiceKey(null);
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "project-agent", "service", projectUid],
      });

      toast({
        variant: "success",
        title: "Project agent deleted",
        description: "The current project agent service was removed.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Delete project agent failed",
        description: formatMainSequenceError(error),
      });
    },
  });

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
    if (!deployResult || !latestDeploymentProgressRun) {
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
        ? "Project agent deployment did not complete"
        : "Project agent deployment ready",
      description: getDeployStatusSummary(deployResult),
    });
  }, [deployResult, latestDeploymentProgressRun, projectUid, queryClient, toast]);

  useEffect(() => {
    if (!hasAgentCapabilities) {
      setSelectedLlmProvider("");
      setSelectedLlmModelId("");
      setSelectedLlmThinking("");
      setDeployResult(null);
      setAutomaticDeploymentEnabled(false);
      setHydratedAutomationServiceKey(null);
      setHydratedComputeServiceKey(null);
      hydratedProjectAgentModelKeyRef.current = null;
      reportedDeploymentTerminalKeyRef.current = null;
      setComputeState(createDefaultDeploymentComputeState());
      return;
    }
  }, [hasAgentCapabilities]);

  useEffect(() => {
    setSelectedLlmProvider("");
    setSelectedLlmModelId("");
    setSelectedLlmThinking("");
    setHydratedAutomationServiceKey(null);
    setHydratedComputeServiceKey(null);
    setComputeState(createDefaultDeploymentComputeState());
    hydratedProjectAgentModelKeyRef.current = null;
    reportedDeploymentTerminalKeyRef.current = null;
  }, [projectUid]);

  useEffect(() => {
    onAutomaticDeploymentStateChange?.(
      automationConfigurationReady && automaticDeploymentEnabled,
    );
  }, [
    automationConfigurationReady,
    automaticDeploymentEnabled,
    onAutomaticDeploymentStateChange,
  ]);

  useEffect(
    () => () => {
      onAutomaticDeploymentStateChange?.(false);
    },
    [onAutomaticDeploymentStateChange],
  );

  useEffect(() => {
    if (
      currentProjectAgentServiceQuery.isLoading ||
      currentProjectAgentServiceQuery.isError ||
      !currentAutomationServiceKey
    ) {
      return;
    }

    if (hydratedAutomationServiceKey === currentAutomationServiceKey) {
      return;
    }

    setAutomaticDeploymentEnabled(currentProjectAgentService?.automatic_deployment === true);
    setHydratedAutomationServiceKey(currentAutomationServiceKey);
  }, [
    currentAutomationServiceKey,
    currentProjectAgentService?.automatic_deployment,
    currentProjectAgentServiceQuery.isError,
    currentProjectAgentServiceQuery.isLoading,
    hydratedAutomationServiceKey,
  ]);

  useEffect(() => {
    if (
      currentProjectAgentServiceQuery.isLoading ||
      currentProjectAgentServiceQuery.isError ||
      !currentAutomationServiceKey
    ) {
      return;
    }

    if (hydratedComputeServiceKey === currentAutomationServiceKey) {
      return;
    }

    setComputeState(readServiceComputeState(currentProjectAgentService));
    setHydratedComputeServiceKey(currentAutomationServiceKey);
  }, [
    currentAutomationServiceKey,
    currentProjectAgentService,
    currentProjectAgentServiceQuery.isError,
    currentProjectAgentServiceQuery.isLoading,
    hydratedComputeServiceKey,
  ]);

  useEffect(() => {
    if (!currentProjectAgentUid) {
      hydratedProjectAgentModelKeyRef.current = null;
      return;
    }

    if (currentProjectAgentDetailQuery.isLoading) {
      return;
    }

    if (!currentProjectAgentProvider || !currentProjectAgentModel) {
      return;
    }

    const hydrationKey = [
      currentProjectAgentUid,
      currentProjectAgentProvider,
      currentProjectAgentModel,
      currentProjectAgentThinking,
    ].join("::");

    if (hydratedProjectAgentModelKeyRef.current === hydrationKey) {
      return;
    }

    const providerMatch =
      availableProviders.find(
        (provider) =>
          normalizeCatalogKey(provider.value) === normalizeCatalogKey(currentProjectAgentProvider),
      ) ?? null;
    const modelMatch =
      availableModels.find(
        (model) =>
          normalizeCatalogKey(model.value) === normalizeCatalogKey(currentProjectAgentModel) &&
          normalizeCatalogKey(model.provider) === normalizeCatalogKey(currentProjectAgentProvider),
      ) ?? null;

    if (providerMatch) {
      setSelectedLlmProvider(providerMatch.value);
    } else {
      setSelectedLlmProvider(currentProjectAgentProvider);
    }

    if (modelMatch) {
      setSelectedLlmModelId(modelMatch.id);
    } else {
      setSelectedLlmModelId(buildCurrentModelOptionId(currentProjectAgentProvider, currentProjectAgentModel));
    }

    setSelectedLlmThinking(currentProjectAgentThinking);
    hydratedProjectAgentModelKeyRef.current = hydrationKey;
  }, [
    availableModels,
    availableProviders,
    currentProjectAgentDetailQuery.isLoading,
    currentProjectAgentUid,
    currentProjectAgentModel,
    currentProjectAgentProvider,
    currentProjectAgentThinking,
  ]);

  useEffect(() => {
    if (currentProjectAgentServiceQuery.isLoading) {
      return;
    }

    if (currentProjectAgentUid) {
      return;
    }

    if (availableProviders.length === 0) {
      if (selectedLlmProvider) {
        setSelectedLlmProvider("");
      }
      return;
    }

    if (
      selectedLlmProvider &&
      availableProviders.some(
        (provider) => normalizeCatalogKey(provider.value) === normalizeCatalogKey(selectedLlmProvider),
      )
    ) {
      return;
    }

    const preferredProvider =
      availableProviders.find(
        (provider) =>
          normalizeCatalogKey(provider.value) === normalizeCatalogKey(currentProjectAgentProvider),
      )?.value ?? null;
    setSelectedLlmProvider(preferredProvider ?? availableProviders[0]?.value ?? "");
  }, [
    availableProviders,
    currentProjectAgentServiceQuery.isError,
    currentProjectAgentServiceQuery.isLoading,
    currentProjectAgentUid,
    currentProjectAgentProvider,
    selectedLlmProvider,
  ]);

  useEffect(() => {
    if (currentProjectAgentServiceQuery.isLoading || currentProjectAgentServiceQuery.isError) {
      return;
    }

    if (currentProjectAgentUid && !currentProjectAgentDetailQuery.data) {
      return;
    }

    if (filteredModelOptions.length === 0) {
      if (selectedLlmModelId) {
        setSelectedLlmModelId("");
      }
      return;
    }

    if (
      selectedLlmModelId &&
      filteredModelOptions.some((model) => model.value === selectedLlmModelId)
    ) {
      return;
    }

    const preferredModel =
      filteredModelOptions.find(
        (model) => normalizeCatalogKey(model.modelValue) === normalizeCatalogKey(currentProjectAgentModel),
      )?.value ?? null;
    const firstUsableModel =
      filteredModelOptions.find((model) => !model.disabled) ?? filteredModelOptions[0] ?? null;
    setSelectedLlmModelId(preferredModel ?? firstUsableModel?.value ?? "");
  }, [
    currentProjectAgentDetailQuery.data,
    currentProjectAgentServiceQuery.isError,
    currentProjectAgentServiceQuery.isLoading,
    currentProjectAgentUid,
    currentProjectAgentModel,
    filteredModelOptions,
    selectedLlmModelId,
  ]);

  useEffect(() => {
    if (currentProjectAgentServiceQuery.isLoading || currentProjectAgentServiceQuery.isError) {
      return;
    }

    if (currentProjectAgentUid && !currentProjectAgentDetailQuery.data) {
      return;
    }

    const modelProvider = selectedDeploymentModel?.provider ?? selectedModelOption?.provider ?? "";
    const modelValue = selectedDeploymentModel?.value ?? selectedModelOption?.modelValue ?? "";
    const selectedModelMatchesCurrent =
      currentProjectAgentProvider &&
      currentProjectAgentModel &&
      normalizeCatalogKey(modelProvider) === normalizeCatalogKey(currentProjectAgentProvider) &&
      normalizeCatalogKey(modelValue) === normalizeCatalogKey(currentProjectAgentModel);

    if (selectedModelMatchesCurrent && currentProjectAgentThinking) {
      if (selectedLlmThinking !== currentProjectAgentThinking) {
        setSelectedLlmThinking(currentProjectAgentThinking);
      }
      return;
    }

    const reasoningOptions = selectedDeploymentModel?.reasoningEfforts ?? [];

    if (reasoningOptions.length === 0) {
      if (selectedLlmThinking) {
        setSelectedLlmThinking("");
      }
      return;
    }

    if (
      selectedLlmThinking &&
      reasoningOptions.some(
        (entry) => normalizeCatalogKey(entry.value) === normalizeCatalogKey(selectedLlmThinking),
      )
    ) {
      return;
    }

    setSelectedLlmThinking(
      selectedDeploymentModel?.defaultReasoningEffort ?? reasoningOptions[0]?.value ?? "",
    );
  }, [
    currentProjectAgentDetailQuery.data,
    currentProjectAgentServiceQuery.isError,
    currentProjectAgentServiceQuery.isLoading,
    currentProjectAgentUid,
    currentProjectAgentModel,
    currentProjectAgentProvider,
    currentProjectAgentThinking,
    selectedDeploymentModel,
    selectedLlmThinking,
    selectedModelOption,
  ]);

  const deployResultStatus = normalizeDeploymentStatus(deployResult?.status);
  const deployResultIsProgress = isDeploymentProgressStatus(deployResultStatus);
  const deployResultIsFailure = isDeploymentFailureStatus(deployResultStatus);
  const deployResultIsSuccess = isDeploymentSuccessStatus(deployResultStatus);
  const deployResultPanelClassName = deployResultIsFailure
    ? "rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
    : deployResultIsSuccess
      ? "rounded-[calc(var(--radius)-6px)] border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
      : "rounded-[calc(var(--radius)-6px)] border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-primary";

  if (!hasAgentCapabilities) {
    return null;
  }

  return (
    <div className="max-w-6xl space-y-5">
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">Project Agent</div>
        <p className="text-sm text-muted-foreground">
          Deploy the project execution agent runtime for this project.
        </p>
      </div>

      <div className="rounded-[calc(var(--radius)-6px)] border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Project Agents are intended to be unique per project. This means that project agents
        should always have an image updated to the latest Main Sequence SDK to guarantee proper
        performance.
      </div>

      {shouldShowImageDrift ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-4 text-sm text-warning">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="text-sm font-medium text-warning">Runtime image drift detected</div>
            </div>
            {imageDriftAutohealMessage ? <div>{imageDriftAutohealMessage}</div> : null}
            <div className="space-y-2">
              {driftedImageChecks.map((check) => (
                <div
                  key={check.key || check.label || check.reason || check.message}
                  className="rounded-[calc(var(--radius)-8px)] border border-warning/30 bg-background/20 px-3 py-3 text-warning"
                >
                  <div className="font-medium text-warning">
                    {check.label?.trim() || check.key?.trim() || "Image drift"}
                  </div>
                  {check.message?.trim() ? (
                    <div className="mt-1 text-sm">{check.message.trim()}</div>
                  ) : null}
                  {check.autoheal_message?.trim() ? (
                    <div className="mt-2 rounded-[calc(var(--radius)-10px)] border border-warning/25 bg-warning/10 px-2.5 py-2 text-xs text-warning">
                      {check.autoheal_message.trim()}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-4 py-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Agent configuration</div>
          <p className="text-sm text-muted-foreground">
            Configure the runtime and deploy the project agent for this project.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/22 p-3">
            <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              LLM
            </div>

            {llmConfigurationIsPending ? (
              <div className="flex items-center gap-3 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/36 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading project agent model configuration...
              </div>
            ) : null}

            {!llmConfigurationIsPending && linkedAgentModelConfigurationMissing ? (
              <div className="rounded-[calc(var(--radius)-8px)] border border-warning/35 bg-warning/10 px-3 py-3 text-sm text-warning">
                The linked project agent detail did not include an LLM provider and model. The
                deployment form is waiting for backend agent configuration before enabling deploy.
              </div>
            ) : null}

            {!llmConfigurationIsPending && !linkedAgentModelConfigurationMissing && !hasRuntimeModelCatalog ? (
              <div className="space-y-3">
                <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/36 px-3 py-3 text-sm text-muted-foreground">
                  {commandCenterModelOptionsQuery.isLoading
                    ? "Loading Command Center model options..."
                    : resolvedLlmProvider && resolvedLlmModelId
                      ? "Using the current project agent model configuration."
                      : commandCenterModelOptionsQuery.isError
                        ? "Unable to load Command Center model options for deployment."
                        : "No Command Center model options are available right now."}
                </div>
                {commandCenterModelOptionsQuery.isError ? (
                  <div className="flex items-center justify-start">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void commandCenterModelOptionsQuery.refetch();
                      }}
                    >
                      Retry model load
                    </Button>
                  </div>
                ) : null}
                {resolvedLlmProvider && resolvedLlmModelId ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Provider</label>
                      <Input value={resolvedLlmProvider} readOnly disabled />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Model</label>
                      <Input value={resolvedLlmModelId} readOnly disabled />
                    </div>
                    {resolvedLlmThinking ? (
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Reasoning</label>
                        <Input value={resolvedLlmThinking} readOnly disabled />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {llmConfigurationCanRender && hasRuntimeModelCatalog ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Provider</label>
                    <Select
                      aria-label="LLM provider"
                      className="h-11 w-full bg-card/70"
                      disabled={providerOptions.length === 0}
                      value={effectiveSelectedLlmProvider}
                      onChange={(event) => {
                        setSelectedLlmProvider(event.target.value);
                      }}
                    >
                      {providerOptions.length === 0 ? (
                        <option value="">No providers available</option>
                      ) : null}
                      {providerOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Model</label>
                    <Select
                      aria-label="LLM model"
                      className="h-11 w-full bg-card/70"
                      disabled={filteredModelOptions.length === 0}
                      value={effectiveSelectedLlmModelId}
                      onChange={(event) => {
                        setSelectedLlmModelId(event.target.value);
                      }}
                    >
                      {filteredModelOptions.length === 0 ? (
                        <option value="">No models available</option>
                      ) : null}
                      {filteredModelOptions.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.disabled}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {hasReasoningEffortOptions ? (
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Reasoning</label>
                      <Select
                        aria-label="LLM reasoning"
                        className="h-11 w-full bg-card/70"
                        value={resolvedLlmThinking}
                        onChange={(event) => {
                          setSelectedLlmThinking(event.target.value);
                        }}
                      >
                        {selectedReasoningEffortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : null}
                </div>
                {currentAgentModelMissingFromCatalog ? (
                  <div className="rounded-[calc(var(--radius)-8px)] border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning">
                    The current agent model is not in the available model catalog. Keeping the
                    backend agent configuration until you select a different model.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {resourceConfigurationReady ? (
            <MainSequenceResourceRequirementsSection
              costEstimate={{ resources: costEstimateResources }}
              gridClassName="md:grid-cols-2 xl:grid-cols-5"
            >
              <MainSequenceResourceField label="CPU request">
                <Input
                  value={computeState.cpuRequest}
                  onChange={(event) =>
                    setComputeState((current) => ({
                      ...current,
                      cpuRequest: event.target.value,
                    }))
                  }
                  placeholder="250m"
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="CPU limit">
                <Input
                  value={computeState.cpuLimit}
                  onChange={(event) =>
                    setComputeState((current) => ({
                      ...current,
                      cpuLimit: event.target.value,
                    }))
                  }
                  placeholder="1000m"
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="Memory request">
                <Input
                  value={computeState.memoryRequest}
                  onChange={(event) =>
                    setComputeState((current) => ({
                      ...current,
                      memoryRequest: event.target.value,
                    }))
                  }
                  placeholder="512Mi"
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="Memory limit">
                <Input
                  value={computeState.memoryLimit}
                  onChange={(event) =>
                    setComputeState((current) => ({
                      ...current,
                      memoryLimit: event.target.value,
                    }))
                  }
                  placeholder="2Gi"
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="Capacity">
                <MainSequenceCapacityToggle
                  spot={computeState.spot}
                  onChange={(spot) =>
                    setComputeState((current) => ({
                      ...current,
                      spot,
                    }))
                  }
                />
              </MainSequenceResourceField>
            </MainSequenceResourceRequirementsSection>
          ) : null}

          {automationConfigurationReady ? (
            <div className="main-sequence-ai-automation-panel">
              <div className="main-sequence-ai-automation-panel__content">
                <button
                  type="button"
                  role="switch"
                  aria-checked={automaticDeploymentEnabled}
                  aria-label="Toggle project agent deployment automation"
                  className="main-sequence-ai-automation-toggle"
                  onClick={() => setAutomaticDeploymentEnabled((current) => !current)}
                >
                  <span className="main-sequence-ai-automation-toggle__track">
                    <span className="main-sequence-ai-automation-toggle__thumb" />
                  </span>
                </button>
                <div className="main-sequence-ai-automation-panel__copy">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Deployment automation
                    </div>
                    <span className="rounded-full border border-border/60 bg-background/35 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      {automaticDeploymentEnabled ? "Enabled" : "Manual"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {automaticDeploymentEnabled ? "Automatic releases" : "Manual deploys"}
                  </div>
                  <p className="max-w-3xl text-sm text-muted-foreground">
                    {automaticDeploymentEnabled
                      ? "A new agent version will be released whenever the project version is upgraded."
                      : "Project agent releases only happen when you deploy from this form."}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {hasRuntimeModelCatalog && !llmSelectionIsValid ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            Select an authenticated LLM provider and model for the project agent deployment.
          </div>
        ) : null}

        {resourceConfigurationReady && !resourceSelectionIsValid ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            Enter CPU request, CPU limit, memory request, and memory limit before deploying.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setDeployDialogOpen(true)}
            disabled={
              !llmSelectionIsValid ||
              !automationConfigurationReady ||
              !resourceSelectionIsValid ||
              deployAgentMutation.isPending
            }
          >
            {deployAgentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deploying agent
              </>
            ) : (
              "Deploy Agent"
            )}
          </Button>
          {currentProjectAgentServiceQuery.data ? (
            <Button
              variant="danger"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteProjectAgentMutation.isPending}
            >
              {deleteProjectAgentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting project agent
                </>
              ) : (
                "Delete Project Agent"
              )}
            </Button>
          ) : null}
        </div>

        {deployResult ? (
          <div className={deployResultPanelClassName}>
            <div className="flex items-start gap-2">
              {deployResultIsProgress ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              ) : null}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="font-medium">
                  Deployment status: {formatDeploymentToken(deployResult.status)}
                </div>
                <div>{getDeployStatusSummary(deployResult)}</div>
                {deployResult.current_step ? (
                  <div className="text-xs opacity-85">
                    Step: {formatDeploymentToken(deployResult.current_step)}
                  </div>
                ) : null}
                {deployResult.result?.service_uid ? (
                  <div className="break-all font-mono text-xs opacity-85">
                    Service {deployResult.result.service_uid}
                  </div>
                ) : null}
                {deployResult.error_code ? (
                  <div className="font-mono text-xs opacity-85">
                    Error {deployResult.error_code}
                  </div>
                ) : null}
                {deployResultIsProgress ? (
                  <div className="text-xs opacity-85">
                    Polling deployment runs for progress updates.
                  </div>
                ) : null}
                {deployResultIsProgress && deploymentRunsPollingQuery.isError ? (
                  <div className="text-xs opacity-85">
                    Unable to refresh deployment runs:{" "}
                    {formatMainSequenceError(deploymentRunsPollingQuery.error)}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

      </div>

      {currentProjectAgentServiceQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(currentProjectAgentServiceQuery.error)}
        </div>
      ) : null}

      {currentProjectAgentDetailQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(currentProjectAgentDetailQuery.error)}
        </div>
      ) : null}

      <ActionConfirmationDialog
        open={deployDialogOpen}
        onClose={() => {
          if (!deployAgentMutation.isPending) {
            setDeployDialogOpen(false);
          }
        }}
        title="Deploy Agent"
        actionLabel="deploy the project agent runtime"
        objectLabel="project agent configuration"
        confirmWord="DEPLOY AGENT"
        confirmButtonLabel="Deploy Agent"
        tone="warning"
        description="This deploys the current project agent runtime for this project."
        specialText="Deploying here will replace the current project agent runtime for this project."
        objectSummary={
          <div className="space-y-1">
            <div className="text-muted-foreground">
              CPU {computeState.cpuRequest || "Not set"} /{" "}
              {computeState.cpuLimit || "Not set"} · Memory{" "}
              {computeState.memoryRequest || "Not set"} /{" "}
              {computeState.memoryLimit || "Not set"} ·{" "}
              {computeState.spot === null
                ? "Capacity not set"
                : computeState.spot
                  ? "Spot"
                  : "Standard"}
            </div>
            <div className="text-muted-foreground">
              LLM {resolvedLlmProvider || "Unknown"} / {resolvedLlmModelId || "Unknown"}
            </div>
            {resolvedLlmThinking ? (
              <div className="text-muted-foreground">Reasoning {resolvedLlmThinking}</div>
            ) : null}
            <div className="text-muted-foreground">
              Automatic deployment{" "}
              {automationConfigurationReady && automaticDeploymentEnabled ? "enabled" : "disabled"}
            </div>
          </div>
        }
        isPending={deployAgentMutation.isPending}
        onConfirm={() => {
          if (!resourceSelectionIsValid) {
            toast({
              title: "Resource values required",
              description: "Enter CPU request, CPU limit, memory request, and memory limit.",
              variant: "error",
            });
            return;
          }

          return deployAgentMutation.mutateAsync({
            project_uid: projectUid,
            llm_provider: resolvedLlmProvider,
            llm_model: resolvedLlmModelId,
            llm_thinking: resolvedLlmThinking,
            automatic_deployment: automationConfigurationReady && automaticDeploymentEnabled,
            cpu_request: resolvedCpuRequest,
            cpu_limit: resolvedCpuLimit,
            memory_request: resolvedMemoryRequest,
            memory_limit: resolvedMemoryLimit,
            spot: computeState.spot ?? undefined,
          });
        }}
        onSuccess={() => {
          setDeployDialogOpen(false);
        }}
        errorToast={{
          title: "Project agent deployment failed",
          description: (error) => formatMainSequenceError(error),
          variant: "error",
        }}
      />

      <ActionConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!deleteProjectAgentMutation.isPending) {
            setDeleteDialogOpen(false);
          }
        }}
        title="Delete Project Agent"
        actionLabel="delete the current project agent service"
        objectLabel="project agent"
        confirmWord="DELETE AGENT"
        confirmButtonLabel="Delete Project Agent"
        tone="danger"
        description="This removes the current project agent service for the selected project."
        objectSummary={
          currentProjectAgentServiceQuery.data ? (
            <div className="space-y-1">
              <div className="font-medium text-foreground">
                {currentProjectAgentServiceQuery.data.subdomain ?? "Project agent service"}
              </div>
              <div className="text-muted-foreground">
                Related job {currentProjectAgentServiceQuery.data.related_job ?? "Unknown"}
              </div>
            </div>
          ) : null
        }
        isPending={deleteProjectAgentMutation.isPending}
        onConfirm={() => deleteProjectAgentMutation.mutateAsync()}
        onSuccess={() => {
          setDeleteDialogOpen(false);
        }}
        errorToast={{
          title: "Delete project agent failed",
          description: (error) => formatMainSequenceError(error),
          variant: "error",
        }}
      />
    </div>
  );
}
