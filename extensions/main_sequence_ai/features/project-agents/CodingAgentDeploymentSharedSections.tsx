import { Loader2 } from "lucide-react";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  MainSequenceCapacityToggle,
  MainSequenceResourceField,
  MainSequenceResourceRequirementsSection,
} from "../../../main_sequence/common/components/MainSequenceResourceRequirementsSection";
import { RunConfigFields } from "../../components/RunConfigFields";
import {
  formatDeploymentToken,
  type CodingAgentDeploymentController,
} from "./useCodingAgentDeploymentController";

export function CodingAgentDeploymentLlmSection({
  controller,
  loadingCopy,
}: {
  controller: CodingAgentDeploymentController;
  loadingCopy: string;
}) {
  return (
    <div className="space-y-3">
      {controller.configurationLoading ? (
        <div className="flex items-center gap-3 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/36 px-3 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingCopy}
        </div>
      ) : null}

      {!controller.configurationLoading ? (
        <RunConfigFields
          selection={controller.runConfigSelection}
          disabled={
            !controller.configurationReady ||
            controller.commandCenterModelOptionsQuery.isLoading ||
            controller.deployMutation.isPending
          }
          onProviderChange={(provider) => {
            controller.setSelectedProvider(provider);
            controller.setSelectedModelId("");
            controller.setSelectedThinking("");
          }}
          onModelChange={(modelId) => {
            controller.setSelectedModelId(modelId);
            controller.setSelectedThinking("");
          }}
          onThinkingChange={controller.setSelectedThinking}
        />
      ) : null}

      {controller.commandCenterModelOptionsQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/36 px-3 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Command Center model catalog.
        </div>
      ) : null}

      {controller.commandCenterModelOptionsQuery.isError ? (
        <div className="space-y-3 rounded-[calc(var(--radius)-8px)] border border-warning/35 bg-warning/10 px-3 py-3 text-sm text-warning">
          <div>
            Command Center model options could not be loaded. The current deployment configuration
            is preserved until the catalog refresh succeeds.
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void controller.commandCenterModelOptionsQuery.refetch();
              }}
            >
              Retry model load
            </Button>
          </div>
        </div>
      ) : null}

      {!controller.commandCenterModelOptionsQuery.isLoading &&
      !controller.commandCenterModelOptionsQuery.isError &&
      !controller.hasModelCatalog ? (
        <div className="rounded-[calc(var(--radius)-8px)] border border-warning/35 bg-warning/10 px-3 py-3 text-sm text-warning">
          No Command Center model catalog entries were returned. The current configuration remains
          selected until catalog entries become available.
        </div>
      ) : null}

      {controller.runConfigSelection.currentModelMissingFromCatalog ? (
        <div className="rounded-[calc(var(--radius)-8px)] border border-warning/35 bg-warning/10 px-3 py-3 text-sm text-warning">
          The current deployed model is not in the available model catalog. The backend
          configuration stays selected until you choose a replacement.
        </div>
      ) : null}

      {controller.hasModelCatalog && !controller.runConfigSelection.selectedCatalogModelIsUsable ? (
        <div className="rounded-[calc(var(--radius)-8px)] border border-warning/35 bg-warning/10 px-3 py-3 text-sm text-warning">
          The selected model is not authenticated for this user. Pick an authenticated model before
          deploying.
        </div>
      ) : null}
    </div>
  );
}

export function CodingAgentDeploymentResourcesSection({
  controller,
  gridClassName,
  placeholders,
}: {
  controller: CodingAgentDeploymentController;
  gridClassName: string;
  placeholders: {
    cpuLimit: string;
    cpuRequest: string;
    gpuRequest?: string;
    gpuType?: string;
    memoryLimit: string;
    memoryRequest: string;
  };
}) {
  return (
    <MainSequenceResourceRequirementsSection
      costEstimate={{ resources: controller.costEstimateResources }}
      gridClassName={gridClassName}
    >
      <MainSequenceResourceField label="CPU request">
        <Input
          value={controller.computeState.cpuRequest}
          onChange={(event) =>
            controller.setComputeState((current) => ({
              ...current,
              cpuRequest: event.target.value,
            }))
          }
          placeholder={placeholders.cpuRequest}
        />
      </MainSequenceResourceField>

      <MainSequenceResourceField label="CPU limit">
        <Input
          value={controller.computeState.cpuLimit}
          onChange={(event) =>
            controller.setComputeState((current) => ({
              ...current,
              cpuLimit: event.target.value,
            }))
          }
          placeholder={placeholders.cpuLimit}
        />
      </MainSequenceResourceField>

      <MainSequenceResourceField label="Memory request">
        <Input
          value={controller.computeState.memoryRequest}
          onChange={(event) =>
            controller.setComputeState((current) => ({
              ...current,
              memoryRequest: event.target.value,
            }))
          }
          placeholder={placeholders.memoryRequest}
        />
      </MainSequenceResourceField>

      <MainSequenceResourceField label="Memory limit">
        <Input
          value={controller.computeState.memoryLimit}
          onChange={(event) =>
            controller.setComputeState((current) => ({
              ...current,
              memoryLimit: event.target.value,
            }))
          }
          placeholder={placeholders.memoryLimit}
        />
      </MainSequenceResourceField>

      {controller.includeGpuFields ? (
        <MainSequenceResourceField label="GPU request">
          <Input
            value={controller.computeState.gpuRequest}
            onChange={(event) =>
              controller.setComputeState((current) => ({
                ...current,
                gpuRequest: event.target.value,
              }))
            }
            placeholder={placeholders.gpuRequest ?? "0"}
          />
        </MainSequenceResourceField>
      ) : null}

      {controller.includeGpuFields ? (
        <MainSequenceResourceField label="GPU type">
          <Input
            value={controller.computeState.gpuType}
            onChange={(event) =>
              controller.setComputeState((current) => ({
                ...current,
                gpuType: event.target.value,
              }))
            }
            placeholder={placeholders.gpuType ?? ""}
          />
        </MainSequenceResourceField>
      ) : null}

      <MainSequenceResourceField label="Capacity">
        <MainSequenceCapacityToggle
          spot={controller.computeState.spot}
          onChange={(spot) =>
            controller.setComputeState((current) => ({
              ...current,
              spot,
            }))
          }
        />
      </MainSequenceResourceField>
    </MainSequenceResourceRequirementsSection>
  );
}

export function CodingAgentDeploymentResultPanel({
  controller,
}: {
  controller: CodingAgentDeploymentController;
}) {
  if (!controller.deployResult) {
    return null;
  }

  const panelClassName = controller.deployResultIsFailure
    ? "rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
    : controller.deployResultIsSuccess
      ? "rounded-[calc(var(--radius)-6px)] border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
      : "rounded-[calc(var(--radius)-6px)] border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-primary";

  return (
    <div className={panelClassName}>
      <div className="flex items-start gap-2">
        {controller.deployResultIsProgress ? (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="font-medium">
            Deployment status: {formatDeploymentToken(controller.deployResult.status)}
          </div>
          <div>{controller.getDeployStatusSummary(controller.deployResult)}</div>
          {controller.deployResult.current_step ? (
            <div className="text-xs opacity-85">
              Step: {formatDeploymentToken(controller.deployResult.current_step)}
            </div>
          ) : null}
          {controller.deployResult.result?.service_uid ? (
            <div className="break-all font-mono text-xs opacity-85">
              Service {controller.deployResult.result.service_uid}
            </div>
          ) : null}
          {controller.deployResult.error_code ? (
            <div className="font-mono text-xs opacity-85">
              Error {controller.deployResult.error_code}
            </div>
          ) : null}
          {controller.deployResultIsProgress ? (
            <div className="text-xs opacity-85">Waiting for deployment progress updates.</div>
          ) : null}
          {controller.deployResultIsProgress && controller.deploymentRunsPollingQuery.isError ? (
            <div className="text-xs opacity-85">
              Unable to refresh deployment runs.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CodingAgentDeploymentConfirmationDialog({
  actionLabel,
  confirmButtonLabel,
  confirmWord,
  controller,
  description,
  objectLabel,
  objectSummary,
  specialText,
  title,
}: {
  actionLabel: string;
  confirmButtonLabel: string;
  confirmWord: string;
  controller: CodingAgentDeploymentController;
  description: string;
  objectLabel: string;
  objectSummary: React.ReactNode;
  specialText?: string;
  title: string;
}) {
  return (
    <ActionConfirmationDialog
      open={controller.deployDialogOpen}
      onClose={() => {
        if (!controller.deployMutation.isPending) {
          controller.setDeployDialogOpen(false);
        }
      }}
      title={title}
      actionLabel={actionLabel}
      objectLabel={objectLabel}
      confirmWord={confirmWord}
      confirmButtonLabel={confirmButtonLabel}
      tone="warning"
      description={description}
      specialText={specialText}
      objectSummary={objectSummary}
      isPending={controller.deployMutation.isPending}
      onConfirm={controller.confirmDeploy}
      onSuccess={() => {
        controller.setDeployDialogOpen(false);
      }}
      errorToast={{
        title,
        description: (error) =>
          error instanceof Error ? error.message : "Deployment could not be requested.",
        variant: "error",
      }}
    />
  );
}
