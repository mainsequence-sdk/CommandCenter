import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";

import {
  createPhysicalDataSourceEditor,
  deletePhysicalDataSourceEditor,
  fetchPhysicalDataSourceConnections,
  fetchPhysicalDataSourceEditor,
  fetchPhysicalDataSourceEditorConfig,
  fetchPhysicalDataSourceSummary,
  formatMainSequenceError,
  updatePhysicalDataSourceEditor,
  type PhysicalDataSourceConnectionRow,
  type PhysicalDataSourceConnectionsResponse,
  type PhysicalDataSourceEditorField,
  type PhysicalDataSourceEditorFieldOption,
  type PhysicalDataSourceEditorPayload,
  type PhysicalDataSourceStorageAccessMode,
  type PhysicalDataSourceEditorWriteResponse,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";

type PhysicalDataSourceCreateSourceType =
  | "duck_db"
  | "timescale_db"
  | "timescale_db_remote";

const physicalDataSourceDetailTabParam = "msPhysicalDataSourceTab";
const physicalDataSourceDetailTabs = [
  { id: "details", label: "Details" },
  { id: "connections", label: "Connections" },
] as const;
const connectionInstanceUidSearchParam = "connectionUid";

type PhysicalDataSourceDetailTabId = (typeof physicalDataSourceDetailTabs)[number]["id"];

function isPhysicalDataSourceDetailTabId(value: string | null): value is PhysicalDataSourceDetailTabId {
  return physicalDataSourceDetailTabs.some((tab) => tab.id === value);
}

function normalizePhysicalDataSourceDetailTabId(value: string | null): PhysicalDataSourceDetailTabId {
  return isPhysicalDataSourceDetailTabId(value) ? value : "details";
}

function extractPhysicalDataSourceUidFromRedirectPath(redirectPath: string | undefined) {
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

function formatStorageAccessModeLabel(value: string) {
  if (value === "read_write") {
    return "Read/write";
  }

  if (value === "read_only") {
    return "Read-only";
  }

  if (value === "disabled") {
    return "Disabled";
  }

  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function normalizeSelectOption(
  option: PhysicalDataSourceEditorFieldOption | string | number | boolean,
): PhysicalDataSourceEditorFieldOption {
  if (
    option !== null &&
    typeof option === "object" &&
    "value" in option &&
    "label" in option
  ) {
    return option;
  }

  const value = String(option);

  return {
    value,
    label: formatStorageAccessModeLabel(value),
  };
}

function getFieldOptions(field: PhysicalDataSourceEditorField) {
  const rawOptions = field.options ?? field.choices ?? [];

  return rawOptions.map((option) => normalizeSelectOption(option));
}

function normalizePhysicalDataSourceStorageAccessMode(value: string | undefined) {
  if (value === "read_write" || value === "read_only" || value === "disabled") {
    return value as PhysicalDataSourceStorageAccessMode;
  }

  return undefined;
}

function getField(
  payload: PhysicalDataSourceEditorPayload | undefined,
  key: PhysicalDataSourceEditorField["key"],
) {
  return payload?.fields.find((field) => field.key === key);
}

function extractPhysicalDataSourceConnectionRows(
  response: PhysicalDataSourceConnectionsResponse | undefined,
) {
  if (!response) {
    return [];
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.results)) {
    return response.results;
  }

  if (Array.isArray(response.rows)) {
    return response.rows;
  }

  if (Array.isArray(response.connections)) {
    return response.connections;
  }

  return [];
}

function readConnectionString(
  row: PhysicalDataSourceConnectionRow,
  keys: string[],
) {
  for (const key of keys) {
    const value = row[key];

    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  return null;
}

function readConnectionName(row: PhysicalDataSourceConnectionRow) {
  return (
    readConnectionString(row, [
      "display_name",
      "name",
      "label",
      "title",
      "unique_identifier",
      "connection_uid",
      "uid",
    ]) ?? "Unnamed connection"
  );
}

function readConnectionUid(row: PhysicalDataSourceConnectionRow) {
  return readConnectionString(row, ["uid", "connection_uid", "connectionUid", "id"]);
}

function readConnectionType(row: PhysicalDataSourceConnectionRow) {
  return (
    readConnectionString(row, [
      "type_id",
      "typeId",
      "connection_type",
      "connectionType",
      "class_type",
      "source_type",
    ]) ?? "Not available"
  );
}

function readConnectionStatus(row: PhysicalDataSourceConnectionRow) {
  return readConnectionString(row, ["status_label", "status"]) ?? "Not available";
}

function readConnectionCreatedAt(row: PhysicalDataSourceConnectionRow) {
  const displayValue = readConnectionString(row, ["creation_date_display"]);

  if (displayValue) {
    return displayValue;
  }

  const rawValue = readConnectionString(row, ["created_at", "creation_date"]);

  if (!rawValue) {
    return "Not available";
  }

  const parsedDate = new Date(rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return rawValue;
  }

  return parsedDate.toLocaleString();
}

function resolveConnectionStatusVariant(row: PhysicalDataSourceConnectionRow) {
  const explicitTone = readConnectionString(row, ["status_tone"])?.toLowerCase();

  if (
    explicitTone === "success" ||
    explicitTone === "warning" ||
    explicitTone === "danger" ||
    explicitTone === "neutral" ||
    explicitTone === "primary" ||
    explicitTone === "secondary"
  ) {
    return explicitTone;
  }

  const status = readConnectionStatus(row).toLowerCase();

  if (status.includes("healthy") || status.includes("active") || status.includes("available")) {
    return "success";
  }

  if (status.includes("warn") || status.includes("pending")) {
    return "warning";
  }

  if (status.includes("error") || status.includes("fail") || status.includes("unavailable")) {
    return "danger";
  }

  return "neutral";
}

function buildConnectionDetailPath(connectionUid: string) {
  const params = new URLSearchParams({
    [connectionInstanceUidSearchParam]: connectionUid,
  });

  return `${getAppPath("connections", "data-sources")}?${params.toString()}`;
}

export function MainSequencePhysicalDataSourceEditor({
  createSourceType,
  mode,
  onBack,
  onOpenPhysicalDataSourceDetail,
  physicalDataSourceUid,
}: {
  createSourceType?: PhysicalDataSourceCreateSourceType;
  mode: "create" | "edit";
  onBack: () => void;
  onOpenPhysicalDataSourceDetail: (physicalDataSourceUid: string) => void;
  physicalDataSourceUid?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isEditMode = mode === "edit";
  const routeSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedTabId = isEditMode
    ? normalizePhysicalDataSourceDetailTabId(routeSearchParams.get(physicalDataSourceDetailTabParam))
    : "details";
  const editorQueryKey = useMemo(
    () => [
      "main_sequence",
      "physical_data_sources",
      "editor",
      mode,
      isEditMode ? physicalDataSourceUid ?? null : createSourceType ?? null,
    ],
    [createSourceType, isEditMode, mode, physicalDataSourceUid],
  );

  const editorQuery = useQuery({
    queryKey: editorQueryKey,
    queryFn: () => {
      if (isEditMode) {
        return fetchPhysicalDataSourceEditor(physicalDataSourceUid!);
      }

      return fetchPhysicalDataSourceEditorConfig(createSourceType!);
    },
    enabled: isEditMode ? Boolean(physicalDataSourceUid) : !!createSourceType,
  });
  const summaryQueryKey = useMemo(
    () => ["main_sequence", "physical_data_sources", "summary", physicalDataSourceUid ?? null],
    [physicalDataSourceUid],
  );
  const summaryQuery = useQuery({
    queryKey: summaryQueryKey,
    queryFn: () => fetchPhysicalDataSourceSummary(physicalDataSourceUid!),
    enabled: isEditMode && Boolean(physicalDataSourceUid),
  });
  const connectionsQueryKey = useMemo(
    () => ["main_sequence", "physical_data_sources", "connections", physicalDataSourceUid ?? null],
    [physicalDataSourceUid],
  );
  const connectionsQuery = useQuery({
    queryKey: connectionsQueryKey,
    queryFn: () => fetchPhysicalDataSourceConnections(physicalDataSourceUid!),
    enabled: isEditMode && selectedTabId === "connections" && Boolean(physicalDataSourceUid),
  });
  const connectionRows = useMemo(
    () => extractPhysicalDataSourceConnectionRows(connectionsQuery.data),
    [connectionsQuery.data],
  );

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

  function selectDetailTab(tabId: PhysicalDataSourceDetailTabId) {
    const nextParams = new URLSearchParams(location.search);

    if (tabId === "details") {
      nextParams.delete(physicalDataSourceDetailTabParam);
    } else {
      nextParams.set(physicalDataSourceDetailTabParam, tabId);
    }

    navigate({
      pathname: location.pathname,
      search: nextParams.toString() ? `?${nextParams.toString()}` : "",
      hash: location.hash,
    });
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = editorQuery.data;

      if (!payload) {
        throw new Error("Editor payload is not available.");
      }

      if (isEditMode) {
        return updatePhysicalDataSourceEditor(physicalDataSourceUid!, {
          display_name: formState.display_name ?? "",
          description: formState.description ?? "",
          internal_code: formState.internal_code ?? "",
          storage_access_mode: normalizePhysicalDataSourceStorageAccessMode(
            formState.storage_access_mode,
          ),
        });
      }

      if (!createSourceType) {
        throw new Error("Source type is required.");
      }

      const storageAccessMode = normalizePhysicalDataSourceStorageAccessMode(
        formState.storage_access_mode,
      );

      if (createSourceType === "duck_db") {
        return createPhysicalDataSourceEditor({
          source_type: createSourceType,
          display_name: formState.display_name ?? "",
          file_path: formState.file_path ?? "",
          storage_access_mode: storageAccessMode,
        });
      }

      if (createSourceType === "timescale_db" || createSourceType === "timescale_db_remote") {
        return createPhysicalDataSourceEditor({
          source_type: createSourceType,
          display_name: formState.display_name ?? "",
          database_user: formState.database_user ?? "",
          password: formState.password ?? "",
          host: formState.host ?? "",
          port: Number(formState.port ?? ""),
          database_name: formState.database_name ?? "",
          storage_access_mode: storageAccessMode,
        });
      }

      return createPhysicalDataSourceEditor({
        source_type: createSourceType,
        display_name: formState.display_name ?? "",
        description: formState.description ?? "",
        tags: formState.tags ?? "",
        storage_access_mode: storageAccessMode,
      });
    },
    onSuccess: async (result: PhysicalDataSourceEditorWriteResponse) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "physical_data_sources"],
      });

      if (isEditMode) {
        await queryClient.invalidateQueries({
          queryKey: summaryQueryKey,
        });
        await queryClient.invalidateQueries({
          queryKey: editorQueryKey,
        });
        await Promise.all([editorQuery.refetch(), summaryQuery.refetch()]);

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

      const redirectUid = extractPhysicalDataSourceUidFromRedirectPath(result.redirect_path) ?? result.uid;
      onOpenPhysicalDataSourceDetail(redirectUid);
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
      if (!physicalDataSourceUid) {
        throw new Error("Physical data source uid is required.");
      }

      return deletePhysicalDataSourceEditor(physicalDataSourceUid);
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
    (isEditMode ? `Physical data source ${physicalDataSourceUid}` : "Create physical data source");
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

    if (field.editor === "select") {
      const options = getFieldOptions(field);

      return (
        <Select
          value={value}
          onChange={(event) => setFieldValue(field.key, event.target.value)}
          disabled={readOnly}
        >
          {options.map((option) => (
            <option
              key={String(option.value)}
              value={String(option.value)}
              disabled={option.disabled}
              data-description={option.description}
            >
              {option.label}
            </option>
          ))}
        </Select>
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

      {isEditMode ? (
        summaryQuery.isError && !summaryQuery.data ? (
          <Card>
            <CardContent className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(summaryQuery.error)}
              </div>
            </CardContent>
          </Card>
        ) : summaryQuery.data ? (
          <MainSequenceEntitySummaryCard
            summary={summaryQuery.data}
            onSummaryUpdated={async () => {
              await Promise.all([summaryQuery.refetch(), editorQuery.refetch()]);
            }}
          />
        ) : (
          <Card>
            <CardContent className="flex min-h-40 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading physical data source summary
              </div>
            </CardContent>
          </Card>
        )
      ) : null}

      {isEditMode ? (
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap gap-2">
              {physicalDataSourceDetailTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedTabId === tab.id
                      ? "border-primary/50 bg-primary/12 text-primary"
                      : "border-border/70 bg-background/35 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                  }`}
                  onClick={() => selectDetailTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>
        </Card>
      ) : null}

      {selectedTabId === "details" ? (
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
      ) : null}

      {selectedTabId === "connections" && isEditMode ? (
        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Connections</CardTitle>
            <CardDescription>
              Connections registered for this physical data source.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {connectionsQuery.isLoading ? (
              <div className="flex min-h-56 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading connections
                </div>
              </div>
            ) : null}

            {connectionsQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(connectionsQuery.error)}
              </div>
            ) : null}

            {!connectionsQuery.isLoading && !connectionsQuery.isError ? (
              connectionRows.length > 0 ? (
                <div className="overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70">
                  <table className="min-w-full divide-y divide-border/70 text-sm">
                    <thead className="bg-muted/35 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Connection</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {connectionRows.map((row, index) => {
                        const uid = readConnectionUid(row);
                        const key = uid ?? `${readConnectionName(row)}-${index}`;

                        return (
                          <tr key={key} className="bg-background/20">
                            <td className="px-4 py-3">
                              {uid ? (
                                <Link
                                  to={buildConnectionDetailPath(uid)}
                                  className="font-medium text-primary underline-offset-4 hover:underline"
                                >
                                  {readConnectionName(row)}
                                </Link>
                              ) : (
                                <div className="font-medium text-foreground">
                                  {readConnectionName(row)}
                                </div>
                              )}
                              {uid ? (
                                <div className="mt-1 font-mono text-xs text-muted-foreground">
                                  {uid}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {readConnectionType(row)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={resolveConnectionStatusVariant(row)}>
                                {readConnectionStatus(row)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {readConnectionCreatedAt(row)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                  No connections are registered for this physical data source.
                </div>
              )
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
              {physicalDataSourceUid ? `Physical data source UID ${physicalDataSourceUid}` : null}
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
