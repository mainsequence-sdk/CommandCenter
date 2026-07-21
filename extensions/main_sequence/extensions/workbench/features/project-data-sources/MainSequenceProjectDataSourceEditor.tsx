import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Table2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  createProjectDataSourceEditor,
  deleteProjectDataSourceEditor,
  fetchProjectDataSourceEditor,
  fetchProjectDataSourceEditorConfig,
  formatMainSequenceError,
  listProjectDataSourceRelatedResourceOptions,
  updateProjectDataSourceEditor,
  type ProjectDataSourceEditorField,
  type ProjectDataSourceEditorPayload,
  type ProjectDataSourceEditorWriteResponse,
} from "../../../../common/api";
import { MainSequenceDataSourcePickerField } from "../../../../common/components/MainSequenceDataSourcePickerField";
import type { PickerOption } from "../../../../common/components/PickerField";
import { toPhysicalDataSourcePickerOption } from "../../../../common/components/dataSourcePickerOptions";
import { MainSequenceProjectDataSourceMetaTableImportDialog } from "./MainSequenceProjectDataSourceMetaTableImportDialog";

const metaTableNamespaceParam = "msMetaTableNamespace";

function getEditorField(
  payload: ProjectDataSourceEditorPayload | undefined,
  key: ProjectDataSourceEditorField["key"],
) {
  return payload?.fields.find((field) => field.key === key);
}

function extractProjectDataSourceUidFromRedirectPath(redirectPath: string | undefined) {
  if (!redirectPath) {
    return null;
  }

  const segments = redirectPath.split("/").map((segment) => segment.trim()).filter(Boolean);
  const uid = segments.at(-1);

  if (!uid) {
    return null;
  }

  return decodeURIComponent(uid);
}

export function MainSequenceProjectDataSourceEditor({
  mode,
  projectDataSourceUid,
  onBack,
  onOpenProjectDataSourceDetail,
}: {
  mode: "create" | "edit";
  projectDataSourceUid?: string;
  onBack: () => void;
  onOpenProjectDataSourceDetail: (projectDataSourceUid: string) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [relatedResourceUid, setRelatedResourceUid] = useState("");
  const [relatedResourceDisplayValue, setRelatedResourceDisplayValue] = useState("");
  const [isDefaultDataSource, setIsDefaultDataSource] = useState(false);
  const [relatedResourceSearchValue, setRelatedResourceSearchValue] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const deferredRelatedResourceSearchValue = useDeferredValue(relatedResourceSearchValue);
  const isEditMode = mode === "edit";
  const editorQueryKey = useMemo(
    () => ["main_sequence", "project_data_sources", "editor", mode, projectDataSourceUid ?? null],
    [mode, projectDataSourceUid],
  );

  const editorQuery = useQuery({
    queryKey: editorQueryKey,
    queryFn: () =>
      isEditMode && projectDataSourceUid
        ? fetchProjectDataSourceEditor(projectDataSourceUid)
        : fetchProjectDataSourceEditorConfig(),
    enabled: !isEditMode || Boolean(projectDataSourceUid),
  });
  const editorPayload = editorQuery.data;

  const relatedResourceOptionsQuery = useQuery({
    queryKey: [
      "main_sequence",
      "project_data_sources",
      "related_resource_options",
      deferredRelatedResourceSearchValue.trim(),
    ],
    queryFn: () =>
      listProjectDataSourceRelatedResourceOptions(deferredRelatedResourceSearchValue),
    enabled: !!editorQuery.data,
  });

  const relatedResourceOptions = useMemo<PickerOption[]>(() => {
    const options: PickerOption[] = (relatedResourceOptionsQuery.data ?? []).map(
      toPhysicalDataSourcePickerOption,
    );

    if (
      relatedResourceUid &&
      relatedResourceDisplayValue &&
      !options.some((option) => option.value === relatedResourceUid)
    ) {
      options.unshift({
        value: relatedResourceUid,
        label: relatedResourceDisplayValue,
      });
    }

    return options;
  }, [relatedResourceDisplayValue, relatedResourceUid, relatedResourceOptionsQuery.data]);

  useEffect(() => {
    const payload = editorQuery.data;

    if (!payload) {
      return;
    }

    const displayNameField = getEditorField(payload, "display_name");
    const relatedResourceField = getEditorField(payload, "related_resource_uid");
    const defaultField = getEditorField(payload, "is_default_data_source");

    setDisplayName(typeof displayNameField?.value === "string" ? displayNameField.value : "");
    const nextRelatedResourceUid =
      relatedResourceField?.value !== null &&
        relatedResourceField?.value !== undefined &&
        `${relatedResourceField.value}` !== "0"
        ? String(relatedResourceField.value)
        : "";
    setRelatedResourceUid(nextRelatedResourceUid);
    setRelatedResourceDisplayValue(relatedResourceField?.display_value ?? "");
    setIsDefaultDataSource(Boolean(defaultField?.value));
    setRelatedResourceSearchValue("");
  }, [editorQuery.data]);

  useEffect(() => {
    if (!relatedResourceUid || relatedResourceDisplayValue.trim().length > 0) {
      return;
    }

    const matchingOption = relatedResourceOptions.find((option) => option.value === relatedResourceUid);

    if (matchingOption) {
      setRelatedResourceDisplayValue(matchingOption.label);
    }
  }, [relatedResourceDisplayValue, relatedResourceOptions, relatedResourceUid]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        display_name: displayName.trim(),
        related_resource_uid: relatedResourceUid,
        is_default_data_source: isDefaultDataSource,
      };

      if (isEditMode && projectDataSourceUid) {
        return updateProjectDataSourceEditor(projectDataSourceUid, payload);
      }

      return createProjectDataSourceEditor(payload);
    },
    onSuccess: async (result: ProjectDataSourceEditorWriteResponse) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "project_data_sources"],
      });

      if (isEditMode) {
        await queryClient.invalidateQueries({
          queryKey: editorQueryKey,
        });
        await editorQuery.refetch();
      }

      toast({
        variant: "success",
        title: isEditMode ? "Project data source updated" : "Project data source created",
        description: result.detail,
      });

      if (isEditMode) {
        return;
      }

      const redirectUid = extractProjectDataSourceUidFromRedirectPath(result.redirect_path) ?? result.uid;
      onOpenProjectDataSourceDetail(redirectUid);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: isEditMode
          ? "Project data source update failed"
          : "Project data source creation failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!projectDataSourceUid) {
        throw new Error("Project data source uid is required.");
      }

      return deleteProjectDataSourceEditor(projectDataSourceUid);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "project_data_sources"],
      });

      toast({
        variant: "success",
        title: "Project data source deleted",
        description: result.detail,
      });

      setDeleteDialogOpen(false);
      onBack();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Project data source deletion failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const displayNameField = getEditorField(editorPayload, "display_name");
  const relatedResourceField = getEditorField(editorPayload, "related_resource_uid");
  const isDefaultField = getEditorField(editorPayload, "is_default_data_source");
  const editorTitle =
    editorPayload?.entity?.title ??
    (isEditMode ? `Project data source ${projectDataSourceUid}` : "Create project data source");
  const canSubmit = displayName.trim().length > 0 && relatedResourceUid.trim().length > 0;

  function openMetaTables(namespace: string | null | undefined) {
    const searchParams = new URLSearchParams();

    if (namespace?.trim()) {
      searchParams.set(metaTableNamespaceParam, namespace.trim());
    }

    navigate({
      pathname: getAppPath("main-sequence-foundry", "meta-tables"),
      search: searchParams.toString() ? `?${searchParams.toString()}` : "",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title={editorTitle}
        description={
          isEditMode
            ? "Edit the project data source fields returned by the backend editor payload."
            : "Create a new project data source from the backend editor configuration."
        }
        actions={
          <>
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back to list
            </Button>
            {isEditMode && projectDataSourceUid ? (
              <Button type="button" variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Table2 className="h-4 w-4" />
                Import MetaTables
              </Button>
            ) : null}
            {isEditMode ? <Badge variant="neutral">Edit</Badge> : <Badge variant="neutral">Create</Badge>}
          </>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>{isEditMode ? "Project data source editor" : "New project data source"}</CardTitle>
          <CardDescription>
            Display name, related physical data source, and default assignment are editable here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {editorQuery.isLoading ? (
            <div className="flex min-h-56 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading editor
              </div>
            </div>
          ) : null}

          {editorQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(editorQuery.error)}
            </div>
          ) : null}

          {!editorQuery.isLoading && !editorQuery.isError && editorPayload ? (
            <>
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {displayNameField?.label ?? "Display name"}
                  </label>
                  <Input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Research Timescale"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {relatedResourceField?.label ?? "Related resource"}
                  </label>
                  <MainSequenceDataSourcePickerField
                    value={relatedResourceUid}
                    displayValue={relatedResourceDisplayValue}
                    onChange={(value) => {
                      setRelatedResourceUid(value);
                      const selectedOption = relatedResourceOptions.find((option) => option.value === value);
                      setRelatedResourceDisplayValue(selectedOption?.label ?? "");
                    }}
                    options={relatedResourceOptions}
                    placeholder="Select a physical data source"
                    searchValue={relatedResourceSearchValue}
                    onSearchValueChange={setRelatedResourceSearchValue}
                    searchPlaceholder="Search physical data sources"
                    emptyMessage="No physical data sources found."
                    loading={relatedResourceOptionsQuery.isLoading}
                  />
                </div>
              </div>

              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/25 px-4 py-3">
                <div className="flex items-start gap-3">
                  <input
                    id="project-data-source-default"
                    type="checkbox"
                    checked={isDefaultDataSource}
                    onChange={(event) => setIsDefaultDataSource(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border bg-background"
                  />
                  <label htmlFor="project-data-source-default" className="space-y-1">
                    <div className="text-sm text-foreground">
                      {isDefaultField?.label ?? "Is default data source"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Mark this project data source as the default one exposed by the backend.
                    </div>
                  </label>
                </div>
              </div>

              {submitMutation.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(submitMutation.error)}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-between gap-3 border-t border-border/70 pt-4">
                <div>
                  {isEditMode && editorPayload.actions.delete ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-danger/25 text-danger hover:bg-danger/10"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete project data source
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={onBack}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending || !canSubmit}
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isEditMode ? "Save changes" : "Create project data source"}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <ActionConfirmationDialog
        title="Delete project data source"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        tone="danger"
        actionLabel="delete"
        objectLabel="project data source"
        confirmWord="DELETE PROJECT DATA SOURCE"
        confirmButtonLabel="Delete project data source"
        description="This will remove the current project data source."
        specialText="This action cannot be undone."
        objectSummary={
          <>
            <div className="font-medium">{editorTitle}</div>
            <div className="mt-1 text-muted-foreground">
              {projectDataSourceUid ? `Project data source UID ${projectDataSourceUid}` : null}
            </div>
          </>
        }
        onConfirm={() => deleteMutation.mutateAsync()}
        errorToast={{
          title: "Project data source deletion failed",
          description: (error) => formatMainSequenceError(error),
          variant: "error",
        }}
      />

      {projectDataSourceUid ? (
        <MainSequenceProjectDataSourceMetaTableImportDialog
          dataSourceUid={projectDataSourceUid}
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          onOpenMetaTables={(namespace) => {
            setImportDialogOpen(false);
            openMetaTables(namespace);
          }}
        />
      ) : null}
    </div>
  );
}
