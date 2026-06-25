import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

import {
  deleteProjectExecutorAgentServiceByProject,
  fetchProjectExecutorAgentServiceByProject,
  formatMainSequenceError,
  type ProjectExecutorAutomaticDeploymentRun,
  type ProjectExecutorAgentServiceDeployResponse,
} from "../../../main_sequence/common/api";
import { normalizeAgentImageDriftRecord } from "../../image-drift";
import { AgentDeploymentConfigurationForm } from "./AgentDeploymentConfigurationForm";
import {
  CodingAgentDeploymentConfirmationDialog,
  CodingAgentDeploymentLlmSection,
  CodingAgentDeploymentResourcesSection,
  CodingAgentDeploymentResultPanel,
} from "./CodingAgentDeploymentSharedSections";
import {
  useCodingAgentDeploymentController,
  type CodingAgentDeploymentResult,
} from "./useCodingAgentDeploymentController";

function normalizeDeploymentStatus(status: string | null | undefined) {
  return typeof status === "string" && status.trim() ? status.trim() : "";
}

function getDeployResultMessage(
  result: CodingAgentDeploymentResult | ProjectExecutorAutomaticDeploymentRun,
) {
  const message = result.result?.message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function getDeployStatusSummary(
  result: CodingAgentDeploymentResult | ProjectExecutorAutomaticDeploymentRun,
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
      return "Project agent deployment is running.";
    case "blocked":
      return result.error_detail?.trim() || getDeployResultMessage(result) || "Deployment is blocked.";
    case "failed":
      return result.error_detail?.trim() || getDeployResultMessage(result) || "Deployment failed.";
    default:
      return result.error_detail?.trim() || getDeployResultMessage(result) || `Status: ${status}`;
  }
}

function readServiceImageDrift(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return normalizeAgentImageDriftRecord(candidate.image_drift);
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const controller = useCodingAgentDeploymentController(
    useMemo(
      () => ({
        agentType: "project-executor" as const,
        currentServiceQueryKey: [
          "main_sequence_ai",
          "coding-agent-deployment",
          "project-executor",
          "service",
          projectUid,
        ],
        enableAutomaticDeployment: true,
        enableDefaultsFallback: false,
        enabled: Boolean(projectUid) && hasAgentCapabilities === true,
        getDeployStatusSummary,
        includeGpuFields: false,
        loadCurrentService: ({ signal }) =>
          fetchProjectExecutorAgentServiceByProject(projectUid, { signal }),
        postSubmitStrategy: {
          kind: "poll-project-runs",
          limit: 20,
          ordering: "-created_at",
        },
        resetKey: projectUid,
        scope: {
          kind: "project",
          project_uid: projectUid,
        },
        toastTitles: {
          failed: "Project agent deployment did not complete",
          ready: "Project agent deployment ready",
          requested: "Project agent deployment started",
        },
      }),
      [hasAgentCapabilities, projectUid],
    ),
  );

  const deleteProjectAgentMutation = useMutation({
    mutationFn: () => deleteProjectExecutorAgentServiceByProject(projectUid),
    onSuccess: async () => {
      setDeleteDialogOpen(false);
      controller.setDeployDialogOpen(false);
      controller.setAutomaticDeploymentEnabled(false);
      controller.setSelectedProvider("");
      controller.setSelectedModelId("");
      controller.setSelectedThinking("");
      controller.setComputeState({
        cpuRequest: "",
        cpuLimit: "",
        memoryRequest: "",
        memoryLimit: "",
        gpuRequest: "",
        gpuType: "",
        spot: null,
      });
      await queryClient.invalidateQueries({
        queryKey: [
          "main_sequence_ai",
          "coding-agent-deployment",
          "project-executor",
          "service",
          projectUid,
        ],
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
    onAutomaticDeploymentStateChange?.(
      controller.automaticDeploymentReady && controller.automaticDeploymentEnabled,
    );
  }, [
    controller.automaticDeploymentEnabled,
    controller.automaticDeploymentReady,
    onAutomaticDeploymentStateChange,
  ]);

  useEffect(
    () => () => {
      onAutomaticDeploymentStateChange?.(false);
    },
    [onAutomaticDeploymentStateChange],
  );

  if (!hasAgentCapabilities) {
    return null;
  }

  const imageDrift = readServiceImageDrift(controller.currentService);
  const driftedImageChecks = (imageDrift?.checks ?? []).filter((check) => check.has_drift === true);
  const shouldShowImageDrift = imageDrift?.has_drift === true;
  const imageDriftAutohealMessage = imageDrift?.autoheal_message?.trim() || null;

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

      <AgentDeploymentConfigurationForm
        description="Configure the runtime and deploy the project agent for this project."
        llm={
          <CodingAgentDeploymentLlmSection
            controller={controller}
            loadingCopy="Loading project agent deployment configuration."
          />
        }
        resources={
          controller.configurationReady ? (
            <CodingAgentDeploymentResourcesSection
              controller={controller}
              gridClassName="md:grid-cols-2 xl:grid-cols-5"
              placeholders={{
                cpuLimit: "1000m",
                cpuRequest: "250m",
                memoryLimit: "2Gi",
                memoryRequest: "512Mi",
              }}
            />
          ) : null
        }
        automation={
          controller.automaticDeploymentReady ? (
            <div className="main-sequence-ai-automation-panel">
              <div className="main-sequence-ai-automation-panel__content">
                <button
                  type="button"
                  role="switch"
                  aria-checked={controller.automaticDeploymentEnabled}
                  aria-label="Toggle project agent deployment automation"
                  className="main-sequence-ai-automation-toggle"
                  onClick={() =>
                    controller.setAutomaticDeploymentEnabled((current) => !current)
                  }
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
                      {controller.automaticDeploymentEnabled ? "Enabled" : "Manual"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {controller.automaticDeploymentEnabled
                      ? "Automatic releases"
                      : "Manual deploys"}
                  </div>
                  <p className="max-w-3xl text-sm text-muted-foreground">
                    {controller.automaticDeploymentEnabled
                      ? "A new agent version will be released whenever the project version is upgraded."
                      : "Project agent releases only happen when you deploy from this form."}
                  </p>
                </div>
              </div>
            </div>
          ) : null
        }
        actions={
          <>
            <Button
              onClick={() => controller.setDeployDialogOpen(true)}
              disabled={
                !controller.llmSelectionIsValid ||
                !controller.automaticDeploymentReady ||
                !controller.resourceSelectionIsValid ||
                controller.deployMutation.isPending
              }
            >
              {controller.deployMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deploying agent
                </>
              ) : (
                "Deploy Agent"
              )}
            </Button>
            {controller.currentService ? (
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
          </>
        }
      >
        {controller.configurationReady && !controller.llmSelectionIsValid ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            Select a usable LLM provider, model, and thinking configuration for the project agent
            deployment.
          </div>
        ) : null}

        {controller.configurationReady && !controller.resourceSelectionIsValid ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            Enter CPU request, CPU limit, memory request, and memory limit before deploying.
          </div>
        ) : null}

        <CodingAgentDeploymentResultPanel controller={controller} />
      </AgentDeploymentConfigurationForm>

      {controller.currentServiceQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(controller.currentServiceQuery.error)}
        </div>
      ) : null}

      <CodingAgentDeploymentConfirmationDialog
        controller={controller}
        title="Deploy Agent"
        actionLabel="deploy the project agent runtime"
        objectLabel="project agent configuration"
        confirmWord="DEPLOY AGENT"
        confirmButtonLabel="Deploy Agent"
        description="This deploys the current project agent runtime for this project."
        specialText="Deploying here will replace the current project agent runtime for this project."
        objectSummary={
          <div className="space-y-1">
            <div className="text-muted-foreground">
              CPU {controller.resolvedCpuRequest || "Not set"} /{" "}
              {controller.resolvedCpuLimit || "Not set"} · Memory{" "}
              {controller.resolvedMemoryRequest || "Not set"} /{" "}
              {controller.resolvedMemoryLimit || "Not set"} ·{" "}
              {controller.computeState.spot === null
                ? "Capacity not set"
                : controller.computeState.spot
                  ? "Spot"
                  : "Standard"}
            </div>
            <div className="text-muted-foreground">
              LLM {controller.resolvedLlmProvider || "Unknown"} /{" "}
              {controller.resolvedLlmModelId || "Unknown"}
            </div>
            {controller.resolvedLlmThinking ? (
              <div className="text-muted-foreground">
                Reasoning {controller.resolvedLlmThinking}
              </div>
            ) : null}
            <div className="text-muted-foreground">
              Automatic deployment{" "}
              {controller.automaticDeploymentReady && controller.automaticDeploymentEnabled
                ? "enabled"
                : "disabled"}
            </div>
          </div>
        }
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
          controller.currentService ? (
            <div className="space-y-1">
              <div className="font-medium text-foreground">
                {controller.currentService.subdomain ?? "Project agent service"}
              </div>
              <div className="text-muted-foreground">
                Related job {controller.currentService.related_job_uid ?? "Unknown"}
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
