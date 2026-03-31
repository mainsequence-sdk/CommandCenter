import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";

import {
  createProjectSecret,
  deleteProjectSecret,
  fetchProjectDetail,
  fetchProjectFormOptions,
  formatMainSequenceError,
  listProjectSecrets,
  listSecrets,
  type ProjectBaseImageOption,
  type ProjectSecretRecord,
  type SummaryResponse,
  updateProjectSettings,
} from "../../../../common/api";
import { PickerField, type PickerOption } from "../../../../common/components/PickerField";

function normalizeMatchValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function getSummaryFieldText(summary: SummaryResponse | null | undefined, key: string) {
  const field = [...(summary?.inline_fields ?? []), ...(summary?.highlight_fields ?? [])].find(
    (item) => item.key === key,
  );

  return typeof field?.value === "string" ? field.value : "";
}

function resolveBaseImageValueFromSummary(
  projectBaseImages: ProjectBaseImageOption[],
  summary: SummaryResponse | null | undefined,
) {
  const summaryValue = normalizeMatchValue(getSummaryFieldText(summary, "base_image"));

  if (!summaryValue || summaryValue === "default" || summaryValue === "not available") {
    return "";
  }

  const exactMatch = projectBaseImages.find(
    (option) => normalizeMatchValue(option.title) === summaryValue,
  );

  if (exactMatch) {
    return String(exactMatch.id);
  }

  const fuzzyMatch = projectBaseImages.find((option) =>
    normalizeMatchValue(`${option.title} ${option.description}`).includes(summaryValue),
  );

  return fuzzyMatch ? String(fuzzyMatch.id) : "";
}

export function MainSequenceProjectSettingsTab({
  projectId,
  projectSummary,
}: {
  projectId: number;
  projectSummary?: SummaryResponse | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formState, setFormState] = useState({
    dataSourceId: "",
    defaultBaseImageId: "",
  });
  const [hasUserEditedSettings, setHasUserEditedSettings] = useState(false);
  const [secretSearchValue, setSecretSearchValue] = useState("");
  const [selectedSecretId, setSelectedSecretId] = useState("");
  const deferredSecretSearchValue = useDeferredValue(secretSearchValue);

  const projectDetailQuery = useQuery({
    queryKey: ["main_sequence", "projects", "detail", projectId],
    queryFn: () => fetchProjectDetail(projectId),
    enabled: projectId > 0,
  });

  const formOptionsQuery = useQuery({
    queryKey: ["main_sequence", "projects", "form-options"],
    queryFn: fetchProjectFormOptions,
    enabled: projectId > 0,
    staleTime: 300_000,
  });

  const availableSecretsQuery = useQuery({
    queryKey: ["main_sequence", "projects", "available-secrets", deferredSecretSearchValue],
    queryFn: () =>
      listSecrets({
        limit: 50,
        search: deferredSecretSearchValue,
      }),
    enabled: projectId > 0,
    staleTime: 60_000,
  });

  const projectSecretsQuery = useQuery({
    queryKey: ["main_sequence", "projects", "project-secrets", projectId],
    queryFn: () => listProjectSecrets(projectId),
    enabled: projectId > 0,
  });

  const projectDataSourceOptions: PickerOption[] = useMemo(
    () =>
      (formOptionsQuery.data?.dataSources ?? []).map((option) => ({
        value: String(option.id),
        label: option.related_resource?.display_name ?? `Data source ${option.id}`,
        description: option.related_resource
          ? `${option.related_resource_class_type} · ${option.related_resource.status}`
          : option.related_resource_class_type,
        keywords: [
          option.related_resource?.display_name ?? "",
          option.related_resource_class_type,
          option.related_resource?.status ?? "",
        ],
      })),
    [formOptionsQuery.data?.dataSources],
  );

  const projectBaseImageOptions: PickerOption[] = useMemo(
    () => [
      {
        value: "",
        label: "Optional",
        description: "Use the standard image.",
      },
      ...(formOptionsQuery.data?.projectBaseImages ?? []).map((option) => ({
        value: String(option.id),
        label: option.title,
        description: option.description || option.latest_digest,
        keywords: [option.title, option.description, option.latest_digest],
      })),
    ],
    [formOptionsQuery.data?.projectBaseImages],
  );

  const projectSecretOptions: PickerOption[] = useMemo(
    () => [
      {
        value: "",
        label: "Search a secret",
        description: "Find a secret to assign to this project.",
      },
      ...(availableSecretsQuery.data?.results ?? []).map((secret) => ({
        value: String(secret.id),
        label: secret.name,
        description: `Secret ${secret.id}`,
        keywords: [secret.name, String(secret.id)],
      })),
    ],
    [availableSecretsQuery.data?.results],
  );

  const initialFormState = useMemo(
    () => ({
      dataSourceId: projectDetailQuery.data?.data_source?.id
        ? String(projectDetailQuery.data.data_source.id)
        : "",
      defaultBaseImageId: projectDetailQuery.data?.default_base_image?.id
        ? String(projectDetailQuery.data.default_base_image.id)
        : resolveBaseImageValueFromSummary(
            formOptionsQuery.data?.projectBaseImages ?? [],
            projectSummary,
          ),
    }),
    [
      formOptionsQuery.data?.projectBaseImages,
      projectDetailQuery.data?.data_source?.id,
      projectDetailQuery.data?.default_base_image?.id,
      projectSummary,
    ],
  );

  const isDirty =
    formState.dataSourceId !== initialFormState.dataSourceId ||
    formState.defaultBaseImageId !== initialFormState.defaultBaseImageId;

  useEffect(() => {
    if (hasUserEditedSettings) {
      return;
    }

    setFormState(initialFormState);
  }, [hasUserEditedSettings, initialFormState]);

  useEffect(() => {
    setHasUserEditedSettings(false);
    setFormState({
      dataSourceId: "",
      defaultBaseImageId: "",
    });
  }, [projectId]);

  const updateProjectSettingsMutation = useMutation({
    mutationFn: updateProjectSettings,
    onSuccess: async () => {
      setHasUserEditedSettings(false);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "projects", "detail", projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "projects", "summary", projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "projects", "list"],
        }),
      ]);

      toast({
        variant: "success",
        title: "Project settings updated",
        description: "The project defaults were saved.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Project settings update failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const createProjectSecretMutation = useMutation({
    mutationFn: createProjectSecret,
    onSuccess: async (projectSecret) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "project-secrets", projectId],
      });

      setSelectedSecretId("");
      setSecretSearchValue("");

      toast({
        variant: "success",
        title: "Secret added",
        description: `${projectSecret.secret_name} is now linked to this project.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Secret assignment failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const removeProjectSecretMutation = useMutation({
    mutationFn: async (projectSecret: ProjectSecretRecord) => {
      await deleteProjectSecret(projectSecret.id);
      return projectSecret;
    },
    onSuccess: async (projectSecret) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "project-secrets", projectId],
      });

      toast({
        variant: "success",
        title: "Secret removed",
        description: `${projectSecret.secret_name} was removed from this project.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Secret removal failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProjectSettingsMutation.reset();

    await updateProjectSettingsMutation.mutateAsync({
      projectId,
      defaultDataSourceId: formState.dataSourceId ? Number(formState.dataSourceId) : undefined,
      defaultBaseImageId: formState.defaultBaseImageId
        ? Number(formState.defaultBaseImageId)
        : null,
    });
  }

  async function handleAddProjectSecret() {
    createProjectSecretMutation.reset();

    await createProjectSecretMutation.mutateAsync({
      project: projectId,
      secret: Number(selectedSecretId),
    });
  }

  function formatCreatedAt(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  return (
    <Card className="border-border/70 bg-background/18">
      <CardHeader className="border-b border-border/70 pb-4">
        <CardTitle>Project settings</CardTitle>
        <CardDescription>Choose the default data source and base image for this project.</CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Data source
              </label>
              <PickerField
                value={formState.dataSourceId}
                onChange={(value) => {
                  updateProjectSettingsMutation.reset();
                  setHasUserEditedSettings(true);
                  setFormState((current) => ({
                    ...current,
                    dataSourceId: value,
                  }));
                }}
                options={projectDataSourceOptions}
                placeholder="Choose a data source"
                searchPlaceholder="Search data sources"
                emptyMessage="No matching data sources."
                loading={formOptionsQuery.isLoading}
                disabled={projectDetailQuery.isLoading && !projectDetailQuery.data}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Base image
              </label>
              <PickerField
                value={formState.defaultBaseImageId}
                onChange={(value) => {
                  updateProjectSettingsMutation.reset();
                  setHasUserEditedSettings(true);
                  setFormState((current) => ({
                    ...current,
                    defaultBaseImageId: value,
                  }));
                }}
                options={projectBaseImageOptions}
                placeholder="Optional"
                searchPlaceholder="Search base images"
                emptyMessage="No matching base images."
                loading={formOptionsQuery.isLoading}
                disabled={projectDetailQuery.isLoading && !projectDetailQuery.data}
              />
            </div>
          </div>

          {projectDetailQuery.isLoading && !projectDetailQuery.data ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading project settings
            </div>
          ) : null}

          {projectDetailQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(projectDetailQuery.error)}
            </div>
          ) : null}

          {formOptionsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(formOptionsQuery.error)}
            </div>
          ) : null}

          {updateProjectSettingsMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(updateProjectSettingsMutation.error)}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                updateProjectSettingsMutation.reset();
                setHasUserEditedSettings(false);
                setFormState(initialFormState);
              }}
              disabled={updateProjectSettingsMutation.isPending || !isDirty}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button
              type="submit"
              disabled={
                updateProjectSettingsMutation.isPending ||
                !isDirty ||
                !formState.dataSourceId ||
                projectDetailQuery.isLoading ||
                formOptionsQuery.isLoading
              }
            >
              {updateProjectSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </form>

        <div className="mt-6 space-y-4 border-t border-border/70 pt-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Project secrets
            </div>
            <p className="text-sm text-muted-foreground">
              Search for a secret, add it to this project, or remove an assigned secret.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <PickerField
              value={selectedSecretId}
              onChange={(value) => {
                createProjectSecretMutation.reset();
                setSelectedSecretId(value);
              }}
              options={projectSecretOptions}
              placeholder="Search a secret"
              searchPlaceholder="Search secrets"
              emptyMessage={
                deferredSecretSearchValue.trim()
                  ? "No matching secrets."
                  : "No secrets available."
              }
              loading={availableSecretsQuery.isLoading}
              searchable
              searchValue={secretSearchValue}
              onSearchValueChange={setSecretSearchValue}
            />
            <Button
              type="button"
              onClick={() => void handleAddProjectSecret()}
              disabled={
                createProjectSecretMutation.isPending ||
                !selectedSecretId ||
                availableSecretsQuery.isLoading
              }
            >
              {createProjectSecretMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add secret
            </Button>
          </div>

          {availableSecretsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(availableSecretsQuery.error)}
            </div>
          ) : null}

          {createProjectSecretMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(createProjectSecretMutation.error)}
            </div>
          ) : null}

          {removeProjectSecretMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(removeProjectSecretMutation.error)}
            </div>
          ) : null}

          {projectSecretsQuery.isLoading && !projectSecretsQuery.data ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading project secrets
            </div>
          ) : null}

          {projectSecretsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(projectSecretsQuery.error)}
            </div>
          ) : null}

          {!projectSecretsQuery.isLoading &&
          !projectSecretsQuery.isError &&
          (projectSecretsQuery.data?.length ?? 0) === 0 ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/24 px-4 py-6 text-sm text-muted-foreground">
              No secrets are linked to this project.
            </div>
          ) : null}

          {!projectSecretsQuery.isLoading &&
          !projectSecretsQuery.isError &&
          (projectSecretsQuery.data?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {(projectSecretsQuery.data ?? []).map((projectSecret) => (
                <div
                  key={projectSecret.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">{projectSecret.secret_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {projectSecret.alias
                        ? `Alias: ${projectSecret.alias} · `
                        : ""}
                      Added {formatCreatedAt(projectSecret.created_at)}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => void removeProjectSecretMutation.mutateAsync(projectSecret)}
                    disabled={removeProjectSecretMutation.isPending}
                  >
                    {removeProjectSecretMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
