import { type FormEvent, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";

import {
  createJob,
  fetchAvailableGpuTypes,
  fetchProjectImages,
  formatMainSequenceError,
} from "../../../../common/api";
import { PickerField, type PickerOption } from "../../../../common/components/PickerField";

function getDefaultJobName(filePath: string) {
  const fileName = filePath.split("/").filter(Boolean).at(-1) ?? "job";
  return fileName.replace(/\.[^.]+$/, "") || "job";
}

function createDefaultFormState(filePath: string) {
  return {
    name: getDefaultJobName(filePath),
    relatedImageId: "",
    cpuRequest: "0.25",
    memoryRequest: "0.5",
    gpuRequest: "",
    gpuType: "",
    maxRuntimeSeconds: "3600",
    spot: true,
  };
}

const cpuOptions: PickerOption[] = [
  { value: "0.25", label: "0.25 vCPU" },
  { value: "0.5", label: "0.5 vCPU" },
  { value: "1", label: "1 vCPU" },
  { value: "2", label: "2 vCPU" },
  { value: "4", label: "4 vCPU" },
  { value: "8", label: "8 vCPU" },
  { value: "16", label: "16 vCPU" },
  { value: "30", label: "30 vCPU" },
];

const memoryOptions: PickerOption[] = [
  { value: "0.5", label: "0.5 GiB" },
  { value: "1", label: "1 GiB" },
  { value: "2", label: "2 GiB" },
  { value: "4", label: "4 GiB" },
  { value: "8", label: "8 GiB" },
  { value: "16", label: "16 GiB" },
  { value: "32", label: "32 GiB" },
  { value: "64", label: "64 GiB" },
  { value: "96", label: "96 GiB" },
  { value: "110", label: "110 GiB" },
];

const gpuCountOptions: PickerOption[] = [
  { value: "", label: "No GPU" },
  { value: "1", label: "1 GPU" },
  { value: "2", label: "2 GPUs" },
  { value: "3", label: "3 GPUs" },
  { value: "4", label: "4 GPUs" },
  { value: "5", label: "5 GPUs" },
  { value: "6", label: "6 GPUs" },
  { value: "7", label: "7 GPUs" },
  { value: "8", label: "8 GPUs" },
];

function shortenCommit(value: string | null | undefined) {
  if (!value) {
    return "Image";
  }

  return value.slice(0, 12);
}

export function MainSequenceCreateJobDialog({
  filePath,
  onCreated,
  onClose,
  open,
  projectId,
}: {
  filePath: string;
  onCreated?: () => void;
  onClose: () => void;
  open: boolean;
  projectId: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formState, setFormState] = useState(() => createDefaultFormState(filePath));

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormState(createDefaultFormState(filePath));
  }, [filePath, open]);

  const projectImagesQuery = useQuery({
    queryKey: ["main_sequence", "projects", "job-images", projectId],
    queryFn: () => fetchProjectImages(projectId),
    enabled: open && projectId > 0,
    staleTime: 300_000,
  });

  const createJobMutation = useMutation({
    mutationFn: createJob,
    onSuccess: async (_, input) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "jobs", projectId],
      });
      toast({
        variant: "success",
        title: "Job created",
        description: `${input.name} is now available in this project.`,
      });
      onClose();
      onCreated?.();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Job creation failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const availableGpuTypesQuery = useQuery({
    queryKey: ["main_sequence", "billing", "available-gpu-types"],
    queryFn: fetchAvailableGpuTypes,
    enabled: open,
    staleTime: 300_000,
  });

  const projectImageOptions = useMemo<PickerOption[]>(() => {
    const readyImages = (projectImagesQuery.data ?? []).filter((image) => image.is_ready);

    return [
      {
        value: "",
        label: "Latest commit (dynamic)",
      },
      ...readyImages.map((image) => ({
        value: String(image.id),
        label: shortenCommit(image.project_repo_hash),
        description: image.base_image?.title ?? "Ready image",
        keywords: [
          image.project_repo_hash ?? "",
          image.base_image?.title ?? "",
          image.base_image?.description ?? "",
        ],
      })),
    ];
  }, [projectImagesQuery.data]);
  const gpuTypeOptions = useMemo<PickerOption[]>(
    () =>
      (availableGpuTypesQuery.data ?? []).map((gpuType) => ({
        value: gpuType.value,
        label: gpuType.label,
        keywords: [gpuType.value, gpuType.label],
      })),
    [availableGpuTypesQuery.data],
  );

  const parsedCpu = Number(formState.cpuRequest);
  const parsedMemory = Number(formState.memoryRequest);
  const parsedMaxRuntimeSeconds = Number(formState.maxRuntimeSeconds);
  const parsedGpuRequest = formState.gpuRequest ? Number(formState.gpuRequest) : undefined;
  const gpuSelectionIsValid =
    (!formState.gpuRequest && !formState.gpuType.trim()) ||
    (Boolean(formState.gpuRequest) &&
      parsedGpuRequest !== undefined &&
      Number.isFinite(parsedGpuRequest) &&
      parsedGpuRequest > 0 &&
      formState.gpuType.trim().length > 0);
  const hasValidRequiredValues =
    formState.name.trim().length > 0 &&
    filePath.trim().length > 0 &&
    Number.isFinite(parsedCpu) &&
    parsedCpu > 0 &&
    Number.isFinite(parsedMemory) &&
    parsedMemory > 0 &&
    Number.isFinite(parsedMaxRuntimeSeconds) &&
    parsedMaxRuntimeSeconds > 0 &&
    gpuSelectionIsValid;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createJobMutation.reset();

    await createJobMutation.mutateAsync({
      name: formState.name.trim(),
      project: projectId,
      execution_path: filePath,
      related_image: formState.relatedImageId ? Number(formState.relatedImageId) : undefined,
      cpu_request: formState.cpuRequest,
      memory_request: formState.memoryRequest,
      gpu_request: parsedGpuRequest,
      gpu_type: formState.gpuType.trim() || undefined,
      max_runtime_seconds: parsedMaxRuntimeSeconds,
      spot: formState.spot,
    });
  }

  function handleClose() {
    if (createJobMutation.isPending) {
      return;
    }

    createJobMutation.reset();
    onClose();
  }

  return (
    <Dialog
      title="Create job"
      open={open}
      onClose={handleClose}
      className="max-w-[min(940px,calc(100vw-24px))]"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-5">
          <div className="rounded-[24px] border border-border/70 bg-background/18 p-5">
            <input type="hidden" name="project" value={String(projectId)} />

            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Job name
                </label>
                <Input
                  value={formState.name}
                  onChange={(event) => {
                    createJobMutation.reset();
                    setFormState((current) => ({
                      ...current,
                      name: event.target.value,
                    }));
                  }}
                  placeholder="daily_ingest"
                  required
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Execution file
              </label>
              <Input
                value={filePath}
                readOnly
                className="font-mono text-xs text-foreground/90"
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-background/18 p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(220px,0.6fr)_minmax(220px,0.6fr)]">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Execution image
                </label>
                <PickerField
                  value={formState.relatedImageId}
                  onChange={(value) => {
                    createJobMutation.reset();
                    setFormState((current) => ({
                      ...current,
                      relatedImageId: value,
                    }));
                  }}
                  options={projectImageOptions}
                  placeholder="Latest commit (dynamic)"
                  searchPlaceholder="Search images"
                  emptyMessage="No ready images available."
                  loading={projectImagesQuery.isLoading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  CPU
                </label>
                <PickerField
                  value={formState.cpuRequest}
                  onChange={(value) => {
                    createJobMutation.reset();
                    setFormState((current) => ({
                      ...current,
                      cpuRequest: value,
                    }));
                  }}
                  options={cpuOptions}
                  placeholder="Select CPU"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Memory
                </label>
                <PickerField
                  value={formState.memoryRequest}
                  onChange={(value) => {
                    createJobMutation.reset();
                    setFormState((current) => ({
                      ...current,
                      memoryRequest: value,
                    }));
                  }}
                  options={memoryOptions}
                  placeholder="Select memory"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-background/18 p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,0.55fr)_minmax(220px,0.75fr)_minmax(220px,0.6fr)_auto]">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  GPUs
                </label>
                <PickerField
                  value={formState.gpuRequest}
                  onChange={(value) => {
                    createJobMutation.reset();
                    setFormState((current) => ({
                      ...current,
                      gpuRequest: value,
                      gpuType: value ? current.gpuType : "",
                    }));
                  }}
                  options={gpuCountOptions}
                  placeholder="No GPU"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  GPU type
                </label>
                <PickerField
                  value={formState.gpuType}
                  onChange={(value) => {
                    createJobMutation.reset();
                    setFormState((current) => ({
                      ...current,
                      gpuType: value,
                    }));
                  }}
                  options={gpuTypeOptions}
                  placeholder="Select GPU type"
                  searchPlaceholder="Search GPU types"
                  emptyMessage="No GPU types available."
                  searchable={false}
                  loading={availableGpuTypesQuery.isLoading}
                  disabled={!formState.gpuRequest}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Max runtime (seconds)
                </label>
                <Input
                  value={formState.maxRuntimeSeconds}
                  onChange={(event) => {
                    createJobMutation.reset();
                    setFormState((current) => ({
                      ...current,
                      maxRuntimeSeconds: event.target.value,
                    }));
                  }}
                  inputMode="numeric"
                  placeholder="3600"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Capacity
                </label>
                <div className="flex h-11 items-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-1">
                  <button
                    type="button"
                    className={
                      formState.spot
                        ? "flex-1 rounded-[calc(var(--radius)-8px)] bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                        : "flex-1 rounded-[calc(var(--radius)-8px)] px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    }
                    onClick={() => {
                      createJobMutation.reset();
                      setFormState((current) => ({
                        ...current,
                        spot: true,
                      }));
                    }}
                  >
                    Spot
                  </button>
                  <button
                    type="button"
                    className={
                      !formState.spot
                        ? "flex-1 rounded-[calc(var(--radius)-8px)] bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                        : "flex-1 rounded-[calc(var(--radius)-8px)] px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    }
                    onClick={() => {
                      createJobMutation.reset();
                      setFormState((current) => ({
                        ...current,
                        spot: false,
                      }));
                    }}
                  >
                    Standard
                  </button>
                </div>
              </div>
            </div>
          </div>

          {formState.relatedImageId ? (
            <div className="flex items-center gap-2">
              <Badge variant="neutral">Pinned image</Badge>
            </div>
          ) : null}

          {projectImagesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(projectImagesQuery.error)}
            </div>
          ) : null}

          {availableGpuTypesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(availableGpuTypesQuery.error)}
            </div>
          ) : null}

          {createJobMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(createJobMutation.error)}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/8 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={createJobMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createJobMutation.isPending || !hasValidRequiredValues}
          >
            {createJobMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create job
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
