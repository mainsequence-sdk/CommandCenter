import { useMemo } from "react";

import { Bot, Loader2, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  clearMainSequenceAiResolvedRuntimeAccess,
} from "../../runtime/assistant-endpoint";
import {
  fetchAstroCommandCenterAgentServiceByUser,
  formatMainSequenceError,
} from "../../../main_sequence/common/api";
import { useAuthStore } from "@/auth/auth-store";
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

function getDeployStatusSummary(result: CodingAgentDeploymentResult) {
  const status = normalizeDeploymentStatus(result.status);

  switch (status) {
    case "deployed":
      return "Astro deployment completed. Chat will become available when the runtime reports healthy.";
    case "no_action":
      return "Astro is already current. Chat will become available when the runtime reports healthy.";
    case "running":
    case "pending":
    case "waiting_executor_image":
      return "Astro deployment is running.";
    case "blocked":
    case "failed":
      return result.error_detail?.trim() || "Astro deployment did not complete.";
    default:
      return result.error_detail?.trim() || "Astro deployment was requested.";
  }
}

export function AstroAgentDeploymentConfigurator({
  onDeployed,
}: {
  onDeployed?: () => void;
}) {
  const sessionUserUid = useAuthStore((state) => state.session?.user.uid ?? null);
  const controller = useCodingAgentDeploymentController(
    useMemo(
      () => ({
        agentType: "astro-orchestrator" as const,
        currentServiceQueryKey: [
          "main_sequence_ai",
          "coding-agent-deployment",
          "astro-orchestrator",
          "service",
          sessionUserUid ?? "anonymous",
        ],
        enableDefaultsFallback: true,
        enabled: Boolean(sessionUserUid),
        getDeployStatusSummary,
        includeGpuFields: true,
        loadCurrentService: ({ signal }) =>
          sessionUserUid
            ? fetchAstroCommandCenterAgentServiceByUser(sessionUserUid, { signal })
            : Promise.resolve(null),
        onDeploySuccess: async () => {
          clearMainSequenceAiResolvedRuntimeAccess();
          onDeployed?.();
        },
        postSubmitStrategy: {
          kind: "invalidate-current-service",
        },
        resetKey: sessionUserUid ?? "anonymous",
        scope: {
          kind: "user",
        },
        toastTitles: {
          failed: "Astro deploy failed",
          ready: "Astro deploy ready",
          requested: "Astro deploy requested",
        },
      }),
      [onDeployed, sessionUserUid],
    ),
  );

  return (
    <div className="max-w-4xl space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Bot className="h-4 w-4" />
          Astro Agent
        </div>
        <p className="text-sm text-muted-foreground">
          Deploy or update the user-scoped Astro orchestrator used by Command Center chat.
        </p>
      </div>

      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Deployment state</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {controller.currentServiceQuery.isLoading
                ? "Checking Astro deployment."
                : controller.currentService?.agent_uid
                  ? controller.currentService.is_ready
                    ? "Astro is deployed and marked ready."
                    : "Astro is deployed and the runtime is starting."
                  : "Astro is not deployed for this user."}
            </div>
          </div>
          <div
            className={
              controller.currentService?.agent_uid
                ? "rounded-full border border-success/35 bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
                : "rounded-full border border-warning/35 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning"
            }
          >
            {controller.currentService?.agent_uid ? "Deployed" : "Deployment needed"}
          </div>
        </div>
      </div>

      <AgentDeploymentConfigurationForm
        description="Configure the runtime and deploy Astro for Command Center chat."
        llm={
          <CodingAgentDeploymentLlmSection
            controller={controller}
            loadingCopy="Loading Astro deployment configuration."
          />
        }
        resources={
          controller.configurationReady ? (
            <CodingAgentDeploymentResourcesSection
              controller={controller}
              gridClassName="sm:grid-cols-2 xl:grid-cols-3"
              placeholders={{
                cpuLimit: "2000m",
                cpuRequest: "500m",
                gpuRequest: "0",
                gpuType: "",
                memoryLimit: "2Gi",
                memoryRequest: "1Gi",
              }}
            />
          ) : null
        }
        actions={
          <>
            <Button
              onClick={() => controller.setDeployDialogOpen(true)}
              disabled={
                !controller.llmSelectionIsValid ||
                !controller.resourceSelectionIsValid ||
                controller.deployMutation.isPending
              }
            >
              {controller.deployMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              Deploy Astro
            </Button>
            <Button
              variant="outline"
              disabled={
                controller.currentServiceQuery.isFetching ||
                controller.commandCenterModelOptionsQuery.isFetching ||
                controller.deploymentDefaultsQuery.isFetching
              }
              onClick={() => {
                void controller.refetchAll();
              }}
            >
              Refresh
            </Button>
          </>
        }
      >
        {controller.showDefaultsWarning ? (
          <div className="rounded-[calc(var(--radius)-8px)] border border-warning/35 bg-warning/10 px-3 py-3 text-sm text-warning">
            Global deployment defaults could not be loaded. Fill the runtime values manually before
            deploying.
          </div>
        ) : null}

        {controller.configurationReady && !controller.llmSelectionIsValid ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            Select a usable LLM provider, model, and thinking configuration before deploying Astro.
          </div>
        ) : null}

        {controller.configurationReady && !controller.resourceSelectionIsValid ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            Enter CPU request, CPU limit, memory request, and memory limit before deploying Astro.
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
        title="Deploy Astro"
        actionLabel="deploy the Astro runtime"
        objectLabel="Astro deployment configuration"
        confirmWord="DEPLOY ASTRO"
        confirmButtonLabel="Deploy Astro"
        description="This deploys or updates the user-scoped Astro orchestrator used by Command Center chat."
        specialText="Deploying here updates the current Astro runtime for this user."
        objectSummary={
          <div className="space-y-1">
            <div className="text-muted-foreground">
              CPU {controller.resolvedCpuRequest || "Not set"} /{" "}
              {controller.resolvedCpuLimit || "Not set"} · Memory{" "}
              {controller.resolvedMemoryRequest || "Not set"} /{" "}
              {controller.resolvedMemoryLimit || "Not set"}
            </div>
            <div className="text-muted-foreground">
              GPU {controller.computeState.gpuRequest || "0"} ·{" "}
              {controller.computeState.gpuType || "No GPU type"}
            </div>
            <div className="text-muted-foreground">
              Capacity{" "}
              {controller.computeState.spot === null
                ? "not set"
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
                Thinking {controller.resolvedLlmThinking}
              </div>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
