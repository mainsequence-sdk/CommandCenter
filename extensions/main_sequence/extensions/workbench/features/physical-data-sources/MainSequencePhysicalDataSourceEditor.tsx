import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";

import {
  createPhysicalDataSourceEditor,
  deletePhysicalDataSourceEditor,
  fetchPhysicalDataSourceEditor,
  fetchPhysicalDataSourceEditorConfig,
  formatMainSequenceError,
  updatePhysicalDataSourceEditor,
  type PhysicalDataSourceEditorField,
  type PhysicalDataSourceEditorPayload,
  type PhysicalDataSourceEditorWriteResponse,
} from "../../../../common/api";

type PhysicalDataSourceCreateSourceType =
  | "duck_db"
  | "timescale_db"
  | "timescale_db_gcp_cloud";

function extractPhysicalDataSourceIdFromRedirectPath(redirectPath: string | undefined) {
  if (!redirectPath) {
    return null;
  }

  const matches = redirectPath.match(/(\d+)/g);

  if (!matches || matches.length === 0) {
    return null;
  }

  const id = Number(matches[matches.length - 1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeFieldValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function getField(
  payload: PhysicalDataSourceEditorPayload | undefined,
  key: PhysicalDataSourceEditorField["key"],
) {
  return payload?.fields.find((field) => field.key === key);
}

export function MainSequencePhysicalDataSourceEditor({
  createSourceType,
  mode,
  onBack,
  onOpenPhysicalDataSourceDetail,
  physicalDataSourceId,
}: {
  createSourceType?: PhysicalDataSourceCreateSourceType;
  mode: "create" | "edit";
  onBack: () => void;
  onOpenPhysicalDataSourceDetail: (physicalDataSourceId: number) => void;
  physicalDataSourceId?: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isEditMode = mode === "edit";
  const editorQueryKey = useMemo(
    () => [
      "main_sequence",
      "physical_data_sources",
      "editor",
      mode,
      isEditMode ? physicalDataSourceId ?? null : createSourceType ?? null,
    ],
    [createSourceType, isEditMode, mode, physicalDataSourceId],
  );

  const editorQuery = useQuery({
    queryKey: editorQueryKey,
    queryFn: () => {
      if (isEditMode) {
        return fetchPhysicalDataSourceEditor(physicalDataSourceId!);
      }

      return fetchPhysicalDataSourceEditorConfig(createSourceType!);
    },
    enabled: isEditMode
      ? Number.isFinite(physicalDataSourceId) && (physicalDataSourceId ?? 0) > 0
      : !!createSourceType,
  });

  useEffect(() => {
    const payload = editorQuery.data;

    if (!payload) {
      return;
    }

    const nextState = Object.fromEntries(
      payload.fields.map((field) => [field.key, normalizeFieldValue(field.value)]),
    );

    setFormState(nextState);
  }, [editorQuery.data]);

  function setFieldValue(key: string, value: string) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = editorQuery.data;

      if (!payload) {
        throw new Error("Editor payload is not available.");
      }

      if (isEditMode) {
        return updatePhysicalDataSourceEditor(physicalDataSourceId!, {
          display_name: formState.display_name ?? "",
          description: formState.description ?? "",
          internal_code: formState.internal_code ?? "",
        });
      }

      if (!createSourceType) {
        throw new Error("Source type is required.");
      }

      if (createSourceType === "duck_db") {
        return createPhysicalDataSourceEditor({
          source_type: createSourceType,
          display_name: formState.display_name ?? "",
          file_path: formState.file_path ?? "",
        });
      }

      if (createSourceType === "timescale_db") {
        return createPhysicalDataSourceEditor({
          source_type: createSourceType,
          display_name: formState.display_name ?? "",
          database_user: formState.database_user ?? "",
          password: formState.password ?? "",
          host: formState.host ?? "",
          port: Number(formState.port ?? ""),
          database_name: formState.database_name ?? "",
        });
      }

      return createPhysicalDataSourceEditor({
        source_type: createSourceType,
        display_name: formState.display_name ?? "",
        description: formState.description ?? "",
        tags: formState.tags ?? "",
      });
    },
    onSuccess: async (result: PhysicalDataSourceEditorWriteResponse) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "physical_data_sources"],
      });

      if (isEditMode) {
        await queryClient.invalidateQueries({
          queryKey: editorQueryKey,
        });
        await editorQuery.refetch();

        toast({
          variant: "success",
          title: "Physical data source updated",
          description: result.detail,
        });
        return;
      }

      toast({
        variant: "success",
        title: "Physical data source created",
        description: result.detail,
      });

      const redirectId = extractPhysicalDataSourceIdFromRedirectPath(result.redirect_path) ?? result.id;
      onOpenPhysicalDataSourceDetail(redirectId);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: isEditMode
          ? "Physical data source update failed"
          : "Physical data source creation failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!physicalDataSourceId) {
        throw new Error("Physical data source id is required.");
      }

      return deletePhysicalDataSourceEditor(physicalDataSourceId);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "physical_data_sources"],
      });

      toast({
        variant: "success",
        title: "Physical data source deleted",
        description: result.detail,
      });

      setDeleteDialogOpen(false);
      onBack();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Physical data source deletion failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const payload = editorQuery.data;
  const editableFields = payload?.fields.filter((field) => !field.read_only) ?? [];
  const readOnlyFields = payload?.fields.filter((field) => field.read_only) ?? [];
  const editorTitle =
    payload?.title ??
    payload?.entity?.title ??
    (isEditMode ? `Physical data source ${physicalDataSourceId}` : "Create physical data source");
  const canSubmit =
    editableFields.length > 0 &&
    editableFields.every((field) =>
      !field.required || String(formState[field.key] ?? "").trim().length > 0,
    );

  function renderField(field: PhysicalDataSourceEditorField) {
    const value = formState[field.key] ?? "";
    const readOnly = Boolean(field.read_only);

    if (field.editor === "textarea") {
      return (
        <Textarea
          value={value}
          onChange={(event) => setFieldValue(field.key, event.target.value)}
          placeholder={field.placeholder}
          disabled={readOnly}
          rows={4}
        />
      );
    }

    return (
      <Input
        type={field.editor === "password" ? "password" : field.editor === "number" ? "number" : "text"}
        value={value}
        onChange={(event) => setFieldValue(field.key, event.target.value)}
        placeholder={field.placeholder}
        disabled={readOnly}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title={editorTitle}
        description={
          isEditMode
            ? "Update the editable physical data source fields returned by the backend editor payload."
            : "Create a physical data source using the selected backend editor configuration."
        }
        actions={
          <>
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back to list
            </Button>
            {payload?.source_type_label ? (
              <Badge variant="neutral">{payload.source_type_label}</Badge>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>{isEditMode ? "Physical data source editor" : "New physical data source"}</CardTitle>
          <CardDescription>
            Create and edit the fields exposed by the backend editor flow.
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

          {!editorQuery.isLoading && !editorQuery.isError && payload ? (
            <>
              {editableFields.length > 0 ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  {editableFields.map((field) => (
                    <div
                      key={field.key}
                      className={field.editor === "textarea" ? "space-y-2 lg:col-span-2" : "space-y-2"}
                    >
                      <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {field.label}
                      </label>
                      {renderField(field)}
                      {field.help_text ? (
                        <div className="text-xs text-muted-foreground">{field.help_text}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {readOnlyFields.length > 0 ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  {readOnlyFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {field.label}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              ) : null}

              {submitMutation.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(submitMutation.error)}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-between gap-3 border-t border-border/70 pt-4">
                <div>
                  {isEditMode && payload.actions.delete ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-danger/25 text-danger hover:bg-danger/10"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete physical data source
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
                    {isEditMode ? "Save changes" : "Create physical data source"}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <ActionConfirmationDialog
        title="Delete physical data source"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        tone="danger"
        actionLabel="delete"
        objectLabel="physical data source"
        confirmWord="DELETE PHYSICAL DATA SOURCE"
        confirmButtonLabel="Delete physical data source"
        description="This will remove the current physical data source."
        specialText="This action cannot be undone."
        objectSummary={
          <>
            <div className="font-medium">{editorTitle}</div>
            <div className="mt-1 text-muted-foreground">
              {physicalDataSourceId ? `Physical data source ID ${physicalDataSourceId}` : null}
            </div>
          </>
        }
        onConfirm={() => deleteMutation.mutateAsync()}
        errorToast={{
          title: "Physical data source deletion failed",
          description: (error) => formatMainSequenceError(error),
          variant: "error",
        }}
      />
    </div>
  );
}
