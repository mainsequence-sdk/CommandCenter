import { useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Loader2 } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";

import {
  buildProjectExecutorAgentServiceImage,
  deleteProjectExecutorAgentServiceByProject,
  deployProjectExecutorAgentService,
  fetchAvailableProjectExecutorAgentImages,
  fetchProjectExecutorAgentServiceByProject,
  fetchProjectImages,
  formatMainSequenceError,
  type ProjectExecutorAgentServiceRecord,
  type ProjectImageOption,
} from "../../../main_sequence/common/api";
import { PickerField, type PickerOption } from "../../../main_sequence/common/components/PickerField";
import {
  buildMainSequenceCostEstimateResources,
  MainSequenceCapacityToggle,
  MainSequenceResourceField,
  MainSequenceResourceRequirementsSection,
} from "../../../main_sequence/common/components/MainSequenceResourceRequirementsSection";
import { toProjectImageTitlePickerOption } from "../../../main_sequence/common/components/projectImagePickerOptions";
import { fetchAgentDetail } from "../../agent-search";
import { normalizeAgentImageDriftRecord } from "../../image-drift";
import {
  buildAvailableRunConfigCacheKey,
  fetchAvailableRunConfigOptions,
} from "../../runtime/available-models-api";

function createDefaultDeploymentComputeState() {
  return {
    cpuRequest: "250m",
    cpuLimit: "1000m",
    memoryRequest: "512Mi",
    memoryLimit: "2Gi",
    spot: true,
  };
}

function normalizeCatalogKey(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

const commandCenterAgentType = "astro-orchestrator";

function formatProjectAgentImageStatus(image: ProjectImageOption) {
  if (image.build_error) {
    return "Error";
  }

  return image.is_ready ? "Ready" : "Building";
}

function formatProjectAgentImageLabel(image: ProjectImageOption) {
  return image.title?.trim() || `Image ${image.id}`;
}

function toProjectAgentImageOption(image: ProjectImageOption): PickerOption {
  return toProjectImageTitlePickerOption(image, {
    fallbackLabel: `Image ${image.id}`,
    status: formatProjectAgentImageStatus(image),
  });
}

function isSelectableProjectAgentImage(image: ProjectImageOption) {
  return image.is_ready === true && image.build_error !== true;
}

function isProjectAgentImagePending(result: ProjectExecutorAgentServiceRecord | null) {
  if (!result) {
    return false;
  }

  return (
    result.image_ready !== true &&
    (result.image_building === true ||
      result.image_status === "building" ||
      result.build_status === "WORKING")
  );
}

function getProjectAgentImageStateLabel(result: ProjectExecutorAgentServiceRecord) {
  if (result.image_ready === true) {
    return "Ready";
  }

  if (isProjectAgentImagePending(result)) {
    return "Building";
  }

  return "Not ready";
}

function getProjectAgentImageStateBadgeVariant(result: ProjectExecutorAgentServiceRecord) {
  if (result.image_ready === true) {
    return "success" as const;
  }

  if (isProjectAgentImagePending(result)) {
    return "warning" as const;
  }

  return "secondary" as const;
}

function readServiceImageDrift(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return normalizeAgentImageDriftRecord(candidate.image_drift);
}

export function ProjectAgentConfigurator({
  projectId,
  hasAgentCapabilities,
  onOpenImagesTab,
}: {
  projectId: number;
  hasAgentCapabilities: boolean | null;
  onOpenImagesTab: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const sessionUserId = useAuthStore((state) => state.session?.user.id ?? null);
  const [selectedBuildSourceImageId, setSelectedBuildSourceImageId] = useState("");
  const [selectedDeploymentImageId, setSelectedDeploymentImageId] = useState("");
  const [selectedLlmProvider, setSelectedLlmProvider] = useState("");
  const [selectedLlmModelId, setSelectedLlmModelId] = useState("");
  const hydratedProjectAgentModelKeyRef = useRef<string | null>(null);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [buildImageResult, setBuildImageResult] = useState<ProjectExecutorAgentServiceRecord | null>(
    null,
  );
  const [deployResult, setDeployResult] = useState<ProjectExecutorAgentServiceRecord | null>(
    null,
  );
  const [computeState, setComputeState] = useState(() => createDefaultDeploymentComputeState());
  const commandCenterModelCatalogCacheKey = useMemo(
    () =>
      buildAvailableRunConfigCacheKey({
        agentType: commandCenterAgentType,
        userId: sessionUserId,
      }),
    [sessionUserId],
  );
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
        cacheKey: commandCenterModelCatalogCacheKey,
        runtimeTarget: "command-center-base",
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: hasAgentCapabilities === true && Boolean(sessionToken),
    staleTime: 300_000,
  });

  const projectAgentImagesQuery = useQuery({
    queryKey: ["main_sequence", "projects", "project-agent", "build-source-images", projectId],
    queryFn: () =>
      fetchProjectImages(projectId, {
        catalogImagePrefixStartswith: "base_pod_images",
      }),
    enabled: projectId > 0 && hasAgentCapabilities === true,
    staleTime: 300_000,
  });
  const deploymentImagesQuery = useQuery({
    queryKey: ["main_sequence", "projects", "project-agent", "deployment-images", projectId],
    queryFn: () => fetchAvailableProjectExecutorAgentImages(projectId),
    enabled: projectId > 0 && hasAgentCapabilities === true,
    staleTime: 300_000,
  });
  const currentProjectAgentServiceQuery = useQuery({
    queryKey: ["main_sequence", "projects", "project-agent", "service", projectId],
    queryFn: () => fetchProjectExecutorAgentServiceByProject(projectId),
    enabled: projectId > 0 && hasAgentCapabilities === true,
    staleTime: 60_000,
  });
  const currentProjectAgentId =
    currentProjectAgentServiceQuery.data?.agent_id !== null &&
    currentProjectAgentServiceQuery.data?.agent_id !== undefined &&
    `${currentProjectAgentServiceQuery.data.agent_id}`.trim()
      ? `${currentProjectAgentServiceQuery.data.agent_id}`.trim()
      : null;
  const currentProjectAgentDetailQuery = useQuery({
    queryKey: ["main_sequence_ai", "project-agent", "agent-detail", currentProjectAgentId, sessionToken],
    queryFn: () =>
      fetchAgentDetail({
        agentId: currentProjectAgentId!,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: Boolean(currentProjectAgentId && sessionToken),
    staleTime: 60_000,
  });

  const projectAgentImageOptions = useMemo(
    () =>
      (projectAgentImagesQuery.data ?? [])
        .filter(isSelectableProjectAgentImage)
        .map(toProjectAgentImageOption),
    [projectAgentImagesQuery.data],
  );
  const deploymentImageOptions = useMemo(
    () =>
      (deploymentImagesQuery.data ?? [])
        .filter(isSelectableProjectAgentImage)
        .map(toProjectAgentImageOption),
    [deploymentImagesQuery.data],
  );
  const availableProviders = commandCenterModelOptionsQuery.data?.providers ?? [];
  const availableModels = commandCenterModelOptionsQuery.data?.models ?? [];
  const hasRuntimeModelCatalog = availableModels.length > 0;
  const currentProjectAgentProvider = currentProjectAgentDetailQuery.data?.llm_provider?.trim() || "";
  const currentProjectAgentModel = currentProjectAgentDetailQuery.data?.llm_model?.trim() || "";
  const imageDrift = readServiceImageDrift(currentProjectAgentServiceQuery.data);
  const driftedImageChecks = (imageDrift?.checks ?? []).filter((check) => check.has_drift === true);
  const shouldShowImageDrift = imageDrift?.has_drift === true;
  const imageDriftAutohealMessage = imageDrift?.autoheal_message?.trim() || null;
  const providerOptions = useMemo(
    () => availableProviders.map((entry) => ({ label: entry.label, value: entry.value })),
    [availableProviders],
  );
  const filteredModelOptions = useMemo(() => {
    const scopedModels = selectedLlmProvider
      ? availableModels.filter((entry) => entry.provider === selectedLlmProvider)
      : availableModels;

    return scopedModels.map((entry) => {
      const unusable = Boolean(entry.auth?.required && !entry.auth.usable);

      return {
        disabled: unusable,
        label: unusable ? `${entry.label} (Not authenticated)` : entry.label,
        provider: entry.provider,
        value: entry.id,
        modelValue: entry.value,
      };
    });
  }, [availableModels, selectedLlmProvider]);
  const selectedBuildSourceImage =
    (projectAgentImagesQuery.data ?? []).find(
      (image) => String(image.id) === selectedBuildSourceImageId,
    ) ?? null;
  const selectedDeploymentImage =
    (deploymentImagesQuery.data ?? []).find(
      (image) => String(image.id) === selectedDeploymentImageId,
    ) ?? null;
  const selectedDeploymentModel =
    availableModels.find((entry) => entry.id === selectedLlmModelId) ?? null;
  const resolvedLlmProvider =
    selectedDeploymentModel?.provider?.trim() ||
    selectedLlmProvider.trim() ||
    currentProjectAgentProvider;
  const resolvedLlmModelId =
    selectedDeploymentModel?.value.trim() ||
    currentProjectAgentModel;
  const llmSelectionIsValid = Boolean(
    selectedDeploymentModel &&
      (!selectedDeploymentModel.auth?.required || selectedDeploymentModel.auth.usable),
  ) || Boolean(!hasRuntimeModelCatalog && resolvedLlmProvider && resolvedLlmModelId);
  const costEstimateResources = useMemo(
    () =>
      buildMainSequenceCostEstimateResources({
        cpuRequest: computeState.cpuRequest,
        memoryRequest: computeState.memoryRequest,
        spot: computeState.spot,
      }),
    [computeState.cpuRequest, computeState.memoryRequest, computeState.spot],
  );

  const buildAgentImageMutation = useMutation({
    mutationFn: (input: { project_id: number; project_related_image_id: number }) =>
      buildProjectExecutorAgentServiceImage(input),
    onSuccess: async (result) => {
      setBuildImageResult(result);
      setDeployResult(null);
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", projectId],
      });

      toast({
        variant: isProjectAgentImagePending(result) ? "info" : "success",
        title: isProjectAgentImagePending(result) ? "Agent image pending" : "Agent image ready",
        description:
          result.detail?.trim() ||
          (result.image_ready === true
            ? "The selected image is ready for agent deployment."
            : "The selected image is still building."),
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Build agent image failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const deployAgentMutation = useMutation({
    mutationFn: async (input: {
      project_id: number;
      runtime_image_id: number;
      llm_provider: string;
      llm_model: string;
      cpu_request?: string;
      cpu_limit?: string;
      memory_request?: string;
      memory_limit?: string;
      spot?: boolean;
    }) => {
      const result = await deployProjectExecutorAgentService(input);

      if (!result.runtime_access) {
        throw new Error("Deploy response did not include runtime access.");
      }

      return result;
    },
    onSuccess: async (result) => {
      setDeployResult(result);
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "project-agent", "service", projectId],
      });

      toast({
        variant: "success",
        title: result.created_service ? "Project agent deployed" : "Project agent ready",
        description: "Runtime access is available for this project agent.",
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

  const deleteProjectAgentMutation = useMutation({
    mutationFn: () => deleteProjectExecutorAgentServiceByProject(projectId),
    onSuccess: async () => {
      setDeployResult(null);
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "project-agent", "service", projectId],
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
    if (!hasAgentCapabilities) {
      setSelectedBuildSourceImageId("");
      setSelectedDeploymentImageId("");
      setSelectedLlmProvider("");
      setSelectedLlmModelId("");
      setBuildImageResult(null);
      setDeployResult(null);
      setComputeState(createDefaultDeploymentComputeState());
      return;
    }

    if (!projectAgentImageOptions.some((option) => option.value === selectedBuildSourceImageId)) {
      setSelectedBuildSourceImageId(projectAgentImageOptions[0]?.value ?? "");
    }
  }, [hasAgentCapabilities, projectAgentImageOptions, selectedBuildSourceImageId]);

  useEffect(() => {
    if (!hasAgentCapabilities) {
      return;
    }

    const runtimeImageId = String(buildImageResult?.runtime_image_id ?? "");
    if (
      runtimeImageId &&
      deploymentImageOptions.some((option) => option.value === runtimeImageId) &&
      selectedDeploymentImageId !== runtimeImageId
    ) {
      setSelectedDeploymentImageId(runtimeImageId);
      return;
    }

    if (!deploymentImageOptions.some((option) => option.value === selectedDeploymentImageId)) {
      setSelectedDeploymentImageId(deploymentImageOptions[0]?.value ?? "");
    }
  }, [
    buildImageResult?.runtime_image_id,
    deploymentImageOptions,
    hasAgentCapabilities,
    selectedDeploymentImageId,
  ]);

  useEffect(() => {
    if (
      buildImageResult &&
      selectedBuildSourceImageId &&
      String(buildImageResult.project_related_image_id ?? "") !== selectedBuildSourceImageId
    ) {
      setBuildImageResult(null);
      setDeployResult(null);
    }
  }, [buildImageResult, selectedBuildSourceImageId]);

  useEffect(() => {
    if (!currentProjectAgentId) {
      hydratedProjectAgentModelKeyRef.current = null;
      return;
    }

    if (!currentProjectAgentProvider || !currentProjectAgentModel) {
      return;
    }

    const hydrationKey = [
      currentProjectAgentId,
      currentProjectAgentProvider,
      currentProjectAgentModel,
    ].join("::");

    if (hydratedProjectAgentModelKeyRef.current === hydrationKey) {
      return;
    }

    if (!hasRuntimeModelCatalog) {
      hydratedProjectAgentModelKeyRef.current = hydrationKey;
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
    }

    if (modelMatch) {
      setSelectedLlmModelId(modelMatch.id);
    }

    hydratedProjectAgentModelKeyRef.current = hydrationKey;
  }, [
    availableModels,
    availableProviders,
    currentProjectAgentId,
    currentProjectAgentModel,
    currentProjectAgentProvider,
    hasRuntimeModelCatalog,
  ]);

  useEffect(() => {
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
  }, [availableProviders, currentProjectAgentProvider, selectedLlmProvider]);

  useEffect(() => {
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
  }, [currentProjectAgentModel, filteredModelOptions, selectedLlmModelId]);

  if (!hasAgentCapabilities) {
    return null;
  }

  return (
    <div className="max-w-6xl space-y-5">
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">Project Agent</div>
        <p className="text-sm text-muted-foreground">
          Select the project image to use for the project execution agent workflow.
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

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Image
        </div>
        <PickerField
          value={selectedBuildSourceImageId}
          onChange={setSelectedBuildSourceImageId}
          options={projectAgentImageOptions}
          placeholder="Select an image"
          searchPlaceholder="Search images"
          emptyMessage="No ready project images available."
          loading={projectAgentImagesQuery.isLoading}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            void buildAgentImageMutation.mutateAsync({
              project_id: projectId,
              project_related_image_id: Number(selectedBuildSourceImageId),
            });
          }}
          disabled={
            !selectedBuildSourceImageId ||
            projectAgentImagesQuery.isLoading ||
            buildAgentImageMutation.isPending
          }
        >
          {buildAgentImageMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Building agent image
            </>
          ) : (
            "Build Agent image"
          )}
        </Button>
      </div>

      {buildImageResult ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">Runtime image build state</div>
              <div className="text-sm text-muted-foreground">
                Review runtime images from the project images registry.
              </div>
            </div>
            <Badge variant={getProjectAgentImageStateBadgeVariant(buildImageResult)}>
              {getProjectAgentImageStateLabel(buildImageResult)}
            </Badge>
          </div>

          {buildImageResult.detail?.trim() ? (
            <div className="mt-4 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/36 px-3 py-3 text-sm text-muted-foreground">
              {buildImageResult.detail.trim()}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={onOpenImagesTab}>
              Open Images tab
            </Button>
            {buildImageResult.log_url ? (
              <a
                href={buildImageResult.log_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary underline decoration-primary/40 underline-offset-4"
              >
                <span>Open build log</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-4 py-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Agent deployment</div>
          <p className="text-sm text-muted-foreground">
            Select the executor runtime image that should be deployed for this project agent.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Runtime image
            </div>
            <PickerField
              value={selectedDeploymentImageId}
              onChange={setSelectedDeploymentImageId}
              options={deploymentImageOptions}
              placeholder="Select a deployment image"
              searchPlaceholder="Search runtime images"
              emptyMessage="No ready project executor images available."
              loading={deploymentImagesQuery.isLoading}
            />
          </div>

          <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/22 p-3">
            <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              LLM
            </div>

            {!hasRuntimeModelCatalog ? (
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Provider</label>
                      <Input value={resolvedLlmProvider} readOnly disabled />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Model</label>
                      <Input value={resolvedLlmModelId} readOnly disabled />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {hasRuntimeModelCatalog ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Provider</label>
                  <Select
                    aria-label="LLM provider"
                    className="h-11 w-full bg-card/70"
                    disabled={providerOptions.length === 0}
                    value={selectedLlmProvider}
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
                    value={selectedLlmModelId}
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
              </div>
            ) : null}
          </div>

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
        </div>

        {hasRuntimeModelCatalog && !llmSelectionIsValid ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            Select an authenticated LLM provider and model for the project agent deployment.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setDeployDialogOpen(true)}
            disabled={
              !selectedDeploymentImageId ||
              selectedDeploymentImage?.is_ready !== true ||
              !llmSelectionIsValid ||
              deployAgentMutation.isPending ||
              buildAgentImageMutation.isPending
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
          {selectedDeploymentImage ? (
            <Badge variant={selectedDeploymentImage.is_ready ? "success" : "warning"}>
              {selectedDeploymentImage.is_ready ? "Runtime image ready" : "Runtime image building"}
            </Badge>
          ) : null}
        </div>

      </div>

      {projectAgentImagesQuery.isLoading ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading project-agent images
        </div>
      ) : null}

      {projectAgentImagesQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(projectAgentImagesQuery.error)}
        </div>
      ) : null}

      {deploymentImagesQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(deploymentImagesQuery.error)}
        </div>
      ) : null}

      {currentProjectAgentServiceQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(currentProjectAgentServiceQuery.error)}
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
        actionLabel="deploy the project agent runtime image"
        objectLabel="project agent configuration"
        confirmWord="DEPLOY AGENT"
        confirmButtonLabel="Deploy Agent"
        tone="warning"
        description="This deploys the selected executor runtime image for the current project agent."
        specialText="Deploying a different runtime image here will replace the current project agent runtime for this project."
        objectSummary={
          selectedDeploymentImage ? (
            <div className="space-y-1">
              <div className="font-medium text-foreground">
                {formatProjectAgentImageLabel(selectedDeploymentImage)}
              </div>
              <div className="text-muted-foreground">
                {selectedDeploymentImage.base_image?.title?.trim() || "Default base image"} -{" "}
                {formatProjectAgentImageStatus(selectedDeploymentImage)}
              </div>
              <div className="text-muted-foreground">
                CPU {computeState.cpuRequest || "250m"} / {computeState.cpuLimit || "1000m"} ·
                Memory {computeState.memoryRequest || "512Mi"} / {computeState.memoryLimit || "2Gi"} ·{" "}
                {computeState.spot ? "Spot" : "Standard"}
              </div>
              <div className="text-muted-foreground">
                LLM {resolvedLlmProvider || "Unknown"} / {resolvedLlmModelId || "Unknown"}
              </div>
            </div>
          ) : null
        }
        isPending={deployAgentMutation.isPending}
        onConfirm={() =>
          deployAgentMutation.mutateAsync({
            project_id: projectId,
            runtime_image_id: Number(selectedDeploymentImageId),
            llm_provider: resolvedLlmProvider,
            llm_model: resolvedLlmModelId,
            cpu_request: computeState.cpuRequest.trim() || "250m",
            cpu_limit: computeState.cpuLimit.trim() || "1000m",
            memory_request: computeState.memoryRequest.trim() || "512Mi",
            memory_limit: computeState.memoryLimit.trim() || "2Gi",
            spot: computeState.spot,
          })
        }
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
