import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Loader2, PencilLine, Trash2 } from "lucide-react";

import { appRegistry } from "@/app/registry";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import {
  createOrganizationWidgetTypeConfiguration,
  deleteOrganizationWidgetTypeConfiguration,
  fetchOrganizationWidgetTypeConfigurations,
  hasConfiguredOrganizationWidgetTypeConfigurationsEndpoint,
  patchOrganizationWidgetTypeConfiguration,
  type OrganizationWidgetTypeConfigurationRecord,
} from "@/widgets/organization-config-api";
import {
  useRegisteredWidgetTypesCatalog,
  type RegisteredWidgetTypeRecord,
} from "@/widgets/registered-widget-types-api";
import type { WidgetDefinition } from "@/widgets/types";

import { AdminSurfaceLayout } from "./shared";

function formatPageError(error: unknown) {
  return error instanceof Error ? error.message : "The widget configuration registry request failed.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyJson(value: Record<string, unknown> | null | undefined) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseEditorJson(value: string) {
  const parsed = JSON.parse(value) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("Config JSON must be a JSON object.");
  }

  return parsed;
}

const ECHARTS_WIDGET_ID = "echarts-spec";
const ECHARTS_CAPABILITY_MODE_OPTIONS = [
  { value: "safe-json", label: "Safe JSON" },
  { value: "safe-html-tooltips", label: "Safe HTML Tooltips" },
  { value: "trusted-snippets", label: "Trusted Snippets" },
  { value: "unsafe-custom-js", label: "Unsafe Custom JS" },
] as const;

function readEChartsCapabilityMode(value: Record<string, unknown> | null | undefined) {
  const candidate = value?.capabilityMode;

  return candidate === "safe-html-tooltips" ||
    candidate === "trusted-snippets" ||
    candidate === "unsafe-custom-js"
    ? candidate
    : "safe-json";
}

type ConfigurableWidgetRow = {
  backendRegistered: boolean;
  backendHasPrimaryKey: boolean;
  backendRow: RegisteredWidgetTypeRecord | null;
  overrideRecord: OrganizationWidgetTypeConfigurationRecord | null;
  widget: WidgetDefinition;
};

function JsonPreviewCard({
  emptyCopy,
  title,
  value,
}: {
  emptyCopy: string;
  title: string;
  value: Record<string, unknown> | null | undefined;
}) {
  const hasValue = Boolean(value) && Object.keys(value ?? {}).length > 0;

  return (
    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/25">
      <div className="border-b border-border/70 px-4 py-3 text-sm font-medium text-foreground">
        {title}
      </div>
      {hasValue ? (
        <pre className="overflow-x-auto px-4 py-3 text-xs leading-6 text-muted-foreground">
          {stringifyJson(value)}
        </pre>
      ) : (
        <div className="px-4 py-3 text-xs leading-6 text-muted-foreground">{emptyCopy}</div>
      )}
    </div>
  );
}

export function AdminWidgetConfigurationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const registeredWidgetTypes = useRegisteredWidgetTypesCatalog();
  const overridesQuery = useQuery({
    queryKey: ["admin", "org-widget-type-configurations", "list"],
    queryFn: () => fetchOrganizationWidgetTypeConfigurations(),
    enabled: hasConfiguredOrganizationWidgetTypeConfigurationsEndpoint(),
    staleTime: 60_000,
  });
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("{}");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const configurableWidgets = useMemo(
    () =>
      [...appRegistry.widgets]
        .filter((widget) => Boolean(widget.organizationConfiguration))
        .sort((left, right) => left.title.localeCompare(right.title)),
    [],
  );
  const overridesByWidgetId = useMemo(
    () =>
      new Map(
        (overridesQuery.data ?? []).map((record) => [
          record.registeredWidgetTypeWidgetId,
          record,
        ]),
      ),
    [overridesQuery.data],
  );
  const backendRowsByWidgetId = useMemo(
    () =>
      new Map(
        (registeredWidgetTypes.data ?? []).map((row) => [row.widgetId, row]),
      ),
    [registeredWidgetTypes.data],
  );
  const configurableRows = useMemo<ConfigurableWidgetRow[]>(
    () =>
      configurableWidgets.map((widget) => {
        const backendRow = backendRowsByWidgetId.get(widget.id) ?? null;
        const backendHasPrimaryKey =
          backendRow?.id !== null &&
          backendRow?.id !== undefined &&
          String(backendRow.id).trim().length > 0;

        return {
          widget,
          backendRow,
          backendRegistered: Boolean(backendRow),
          backendHasPrimaryKey,
          overrideRecord: overridesByWidgetId.get(widget.id) ?? null,
        };
      }),
    [backendRowsByWidgetId, configurableWidgets, overridesByWidgetId],
  );
  const activeRegisteredCount = useMemo(
    () => configurableRows.filter((row) => row.backendRow?.isActive).length,
    [configurableRows],
  );
  const overrideCount = useMemo(
    () => configurableRows.filter((row) => Boolean(row.overrideRecord)).length,
    [configurableRows],
  );
  const editingRow = useMemo(
    () => configurableRows.find((row) => row.widget.id === editingWidgetId) ?? null,
    [configurableRows, editingWidgetId],
  );
  const editorObject = useMemo(() => {
    try {
      return parseEditorJson(editorValue);
    } catch {
      return null;
    }
  }, [editorValue]);
  const echartsCapabilityMode = useMemo(
    () =>
      readEChartsCapabilityMode(
        editorObject
        ?? editingRow?.overrideRecord?.configJson
        ?? editingRow?.widget.organizationConfiguration?.defaultConfig,
      ),
    [editingRow?.overrideRecord?.configJson, editingRow?.widget.organizationConfiguration?.defaultConfig, editorObject],
  );

  useEffect(() => {
    if (!editingRow) {
      return;
    }

    setEditorValue(
      stringifyJson(
        editingRow.overrideRecord?.configJson
        ?? editingRow.widget.organizationConfiguration?.defaultConfig
        ?? {},
      ),
    );
    setEditorError(null);
  }, [editingRow]);

  const saveMutation = useMutation({
    mutationFn: async (input: {
      configJson: Record<string, unknown>;
      overrideId?: string;
      registeredWidgetType: string | number;
    }) => {
      if (input.overrideId) {
        return patchOrganizationWidgetTypeConfiguration(input.overrideId, {
          configJson: input.configJson,
        });
      }

      return createOrganizationWidgetTypeConfiguration({
        registeredWidgetType: input.registeredWidgetType,
        configJson: input.configJson,
      });
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "org-widget-type-configurations"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["widget-organization-configurations"],
        }),
      ]);

      toast({
        variant: "success",
        title: "Widget configuration saved",
        description: result.registeredWidgetTypeTitle || result.registeredWidgetTypeWidgetId,
      });

      setEditingWidgetId(null);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Widget configuration save failed",
        description: formatPageError(error),
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteOrganizationWidgetTypeConfiguration(id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "org-widget-type-configurations"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["widget-organization-configurations"],
        }),
      ]);

      toast({
        variant: "success",
        title: "Widget override deleted",
        description: editingRow?.widget.title ?? undefined,
      });

      setDeleteDialogOpen(false);
      setEditingWidgetId(null);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Widget override delete failed",
        description: formatPageError(error),
      });
    },
  });

  async function handleSaveConfiguration() {
    if (!editingRow) {
      return;
    }

    if (!editingRow.backendRow) {
      const message =
        "This widget type is not registered in the backend yet, so an organization override row cannot be saved.";
      setEditorError(message);
      toast({
        variant: "error",
        title: "Cannot create widget override",
        description: message,
      });
      return;
    }

    if (!editingRow.backendHasPrimaryKey) {
      const message =
        "The backend widget-types list returned this widget without its primary key id. The override API needs that id in registered_widget_type, so this widget cannot be configured until the list serializer includes id.";
      setEditorError(message);
      toast({
        variant: "error",
        title: "Cannot create widget override",
        description: message,
      });
      return;
    }

    try {
      const configJson = parseEditorJson(editorValue);
      const registeredWidgetTypeId = editingRow.backendRow.id;

      if (registeredWidgetTypeId === null || registeredWidgetTypeId === undefined) {
        const message = "The backend widget-type primary key is missing from the list response.";
        setEditorError(message);
        toast({
          variant: "error",
          title: "Cannot create widget override",
          description: message,
        });
        return;
      }

      setEditorError(null);
      await saveMutation.mutateAsync({
        overrideId: editingRow.overrideRecord?.id,
        registeredWidgetType: registeredWidgetTypeId,
        configJson,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Config JSON is invalid.";
      setEditorError(message);
    }
  }

  function updateEditorConfig(mutator: (current: Record<string, unknown>) => Record<string, unknown>) {
    const base =
      editorObject
      ?? editingRow?.overrideRecord?.configJson
      ?? editingRow?.widget.organizationConfiguration?.defaultConfig
      ?? {};

    setEditorValue(stringifyJson(mutator(base)));
    setEditorError(null);
  }

  return (
    <AdminSurfaceLayout
      title="Widget Configurations"
      description="Review configurable widget types in the current frontend build, inspect backend registration state, and create or replace organization-scoped widget configuration overrides."
    >
      {!registeredWidgetTypes.endpointConfigured ? (
        <Card>
          <CardContent className="flex items-start gap-3 pt-5 text-sm text-muted-foreground">
            <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              The registered widget-type list endpoint is not configured, so this surface cannot
              inspect backend widget availability or create new override rows for unsynced widget
              types.
            </div>
          </CardContent>
        </Card>
      ) : null}

      {registeredWidgetTypes.isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-3 pt-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading backend-registered widget types.
          </CardContent>
        </Card>
      ) : null}

      {registeredWidgetTypes.error ? (
        <Card>
          <CardContent className="pt-5 text-sm text-danger">
            {formatPageError(registeredWidgetTypes.error)}
          </CardContent>
        </Card>
      ) : null}

      {overridesQuery.error ? (
        <Card>
          <CardContent className="pt-5 text-sm text-danger">
            {formatPageError(overridesQuery.error)}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configurable Widget Types</CardTitle>
            <CardDescription>
              Widget definitions in the current frontend build that expose organization
              configuration capability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {configurableWidgets.length.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active Backend Registrations</CardTitle>
            <CardDescription>
              Configurable widget types that are active in the backend widget registry and available
              in gated workspace widget pickers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {activeRegisteredCount.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Organization Overrides</CardTitle>
            <CardDescription>
              Existing org-specific override rows for configurable widgets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {overrideCount.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurable Widget Types</CardTitle>
          <CardDescription>
            Widget configurability comes from the local widget definition. Saving an override here
            replaces the entire stored <code>config_json</code> object for the selected widget type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configurableWidgets.length === 0 ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-8 text-center">
              <div className="text-sm font-medium text-foreground">
                No configurable widget types are available
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                No widget in the current frontend build advertises organization-scoped
                configuration.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[calc(var(--radius)-6px)] border border-border/70">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-background/55 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Widget</th>
                    <th className="px-4 py-3 font-medium">Capability</th>
                    <th className="px-4 py-3 font-medium">Registration</th>
                    <th className="px-4 py-3 font-medium">Override</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {configurableRows.map((row) => {
                    const { backendRow, backendRegistered, overrideRecord, widget } = row;

                    return (
                      <tr key={widget.id} className="border-t border-border/70">
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-foreground">{widget.title}</div>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">
                            {widget.id}
                          </div>
                          {widget.description ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {widget.description}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="success">supported</Badge>
                            <Badge variant="neutral">
                              v{widget.organizationConfiguration?.version ?? 1}
                            </Badge>
                            {widget.organizationConfiguration?.defaultConfig ? (
                              <Badge variant="secondary">default config</Badge>
                            ) : (
                              <Badge variant="neutral">no default</Badge>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {widget.source || "unknown"} / {widget.kind || "unknown"} /{" "}
                            {widget.category || "Uncategorized"}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {backendRegistered ? (
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="success">registered</Badge>
                                {backendRow?.isActive ? (
                                  <Badge variant="primary">active</Badge>
                                ) : (
                                  <Badge variant="warning">inactive</Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {row.backendHasPrimaryKey
                                  ? `backend row ${String(backendRow?.id)}`
                                  : "backend row is missing id in list payload"}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Badge variant="warning">missing row</Badge>
                              <div className="text-xs text-muted-foreground">
                                register this widget type before saving org overrides
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {overrideRecord ? (
                            <div className="space-y-1">
                              <Badge variant="primary">row {overrideRecord.id}</Badge>
                              <div className="text-xs text-muted-foreground">
                                org override present
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Badge variant="neutral">none</Badge>
                              <div className="text-xs text-muted-foreground">
                                widget default applies
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingWidgetId(widget.id)}
                          >
                            <PencilLine className="h-4 w-4" />
                            {overrideRecord ? "Edit" : "Configure"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editingRow)}
        onClose={() => {
          if (saveMutation.isPending) {
            return;
          }

          setEditingWidgetId(null);
        }}
        title={editingRow ? `Configure ${editingRow.widget.title}` : "Configure widget"}
        description={
          editingRow
            ? "Save replaces the entire stored config_json value for this widget type. It does not deep-merge with the existing override."
            : undefined
        }
        className="max-w-[min(1240px,calc(100vw-24px))]"
        contentClassName="px-0 py-0"
      >
        {editingRow ? (
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
            <div className="space-y-5 border-b border-border/70 px-5 py-5 xl:border-b-0 xl:border-r xl:px-6 xl:py-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">organization config supported</Badge>
                <Badge
                  variant={
                    editingRow.backendRegistered
                      ? editingRow.backendHasPrimaryKey
                        ? "primary"
                        : "warning"
                      : "warning"
                  }
                >
                  {editingRow.backendRegistered
                    ? editingRow.backendHasPrimaryKey
                      ? "backend registered"
                      : "backend id missing"
                    : "backend row missing"}
                </Badge>
                {editingRow.overrideRecord ? (
                  <Badge variant="secondary">editing override row {editingRow.overrideRecord.id}</Badge>
                ) : (
                  <Badge variant="neutral">creating first override</Badge>
                )}
              </div>

              {!editingRow.backendRegistered ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                  This widget is configurable in the frontend build, but no backend registered
                  widget-type row is available yet. Register the widget type first, then create the
                  organization override.
                </div>
              ) : null}

              {editingRow.backendRegistered && !editingRow.backendHasPrimaryKey ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                  The backend widget-types list returned this widget without its primary key
                  <code>id</code>. Creating an org override requires that id as{" "}
                  <code>registered_widget_type</code>, so save is blocked until the backend list
                  serializer includes it.
                </div>
              ) : null}

              {editingRow.widget.id === ECHARTS_WIDGET_ID ? (
                <section className="space-y-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/20 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-topbar-foreground">
                      ECharts capability mode
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This is the main organization-level control for the ECharts widget. Changing
                      it updates the stored <code>config_json.capabilityMode</code> value directly.
                    </p>
                  </div>

                  <Select
                    value={echartsCapabilityMode}
                    onChange={(event) => {
                      const nextMode = event.target.value;

                      updateEditorConfig((current) => ({
                        ...current,
                        capabilityMode: nextMode,
                      }));
                    }}
                  >
                    {ECHARTS_CAPABILITY_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>

                  <div className="text-xs text-muted-foreground">
                    Use <strong>safe-json</strong> for strict JSON-only options,{" "}
                    <strong>safe-html-tooltips</strong> to allow sanitized HTML tooltip rendering,{" "}
                    <strong>trusted-snippets</strong> for approved local formatter ids, or{" "}
                    <strong>unsafe-custom-js</strong> to permit JavaScript builders.
                  </div>
                </section>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      setEditorValue(stringifyJson(parseEditorJson(editorValue)));
                      setEditorError(null);
                    } catch (error) {
                      setEditorError(
                        error instanceof Error ? error.message : "Config JSON is invalid.",
                      );
                    }
                  }}
                >
                  Format JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditorValue(
                      stringifyJson(editingRow.widget.organizationConfiguration?.defaultConfig ?? {}),
                    );
                    setEditorError(null);
                  }}
                >
                  Load Widget Default
                </Button>
                {editingRow.overrideRecord ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditorValue(stringifyJson(editingRow.overrideRecord?.configJson));
                      setEditorError(null);
                    }}
                  >
                    Load Current Override
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="widget-organization-config-editor"
                  className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Config JSON
                </label>
                <Textarea
                  id="widget-organization-config-editor"
                  value={editorValue}
                  onChange={(event) => {
                    setEditorValue(event.target.value);
                    setEditorError(null);
                  }}
                  spellCheck={false}
                  className="min-h-[420px] font-mono text-xs leading-6"
                />
                <div className="text-xs text-muted-foreground">
                  Submit a single JSON object. Saving replaces the full stored override object.
                </div>
                {editorError ? (
                  <div className="text-sm text-danger">{editorError}</div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
                <div className="text-xs text-muted-foreground">
                  Widget id <span className="font-mono text-foreground">{editingRow.widget.id}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editingRow.overrideRecord ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={saveMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Override
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={() => setEditingWidgetId(null)}
                    disabled={saveMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveConfiguration}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving
                      </>
                    ) : editingRow.overrideRecord ? (
                      "Replace Override"
                    ) : (
                      "Create Override"
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-5 py-5 xl:px-6 xl:py-6">
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/25 px-4 py-3">
                <div className="text-sm font-medium text-foreground">Backend Registration</div>
                <div className="mt-2 text-xs leading-6 text-muted-foreground">
                  {editingRow.backendRegistered ? (
                    <>
                      Registered
                      {editingRow.backendHasPrimaryKey ? (
                        <>
                          {" "}as row <span className="font-mono text-foreground">{String(editingRow.backendRow?.id)}</span>.
                        </>
                      ) : (
                        <> but the list payload did not include its primary key id.</>
                      )}
                      {" "}Status is{" "}
                      <span className="font-medium text-foreground">
                        {editingRow.backendRow?.isActive ? "active" : "inactive"}
                      </span>
                      .
                    </>
                  ) : (
                    "No backend registered widget-type row is available for this widget id yet."
                  )}
                </div>
                {!editingRow.backendRegistered || !editingRow.backendHasPrimaryKey ? (
                  <div className="mt-3 rounded-[calc(var(--radius)-8px)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-6 text-warning">
                    Save is available so the error can be shown directly, but create will fail until
                    the backend widget-types list exposes a real registered widget type <code>id</code>.
                  </div>
                ) : null}
              </div>

              <JsonPreviewCard
                title="Widget Default"
                value={editingRow.widget.organizationConfiguration?.defaultConfig}
                emptyCopy="This widget does not define a default organization configuration."
              />

              <JsonPreviewCard
                title="Current Override"
                value={editingRow.overrideRecord?.configJson}
                emptyCopy="No organization override row exists yet. Saving will create the first one."
              />

              <JsonPreviewCard
                title="Schema"
                value={editingRow.widget.organizationConfiguration?.schema}
                emptyCopy="This widget did not publish a schema for organization configuration."
              />
            </div>
          </div>
        ) : null}
      </Dialog>

      <ActionConfirmationDialog
        open={deleteDialogOpen && Boolean(editingRow?.overrideRecord)}
        onClose={() => {
          if (deleteMutation.isPending) {
            return;
          }

          setDeleteDialogOpen(false);
        }}
        onConfirm={async () => {
          if (!editingRow?.overrideRecord) {
            throw new Error("No override row is selected.");
          }

          await deleteMutation.mutateAsync(editingRow.overrideRecord.id);
        }}
        title="Delete Widget Override"
        actionLabel="delete"
        confirmButtonLabel="Delete override"
        confirmWord="DELETE"
        objectLabel="widget configuration override"
        objectSummary={
          editingRow ? (
            <div className="space-y-1">
              <div className="font-medium text-foreground">{editingRow.widget.title}</div>
              <div className="font-mono text-xs text-muted-foreground">{editingRow.widget.id}</div>
              {editingRow.overrideRecord ? (
                <div className="text-xs text-muted-foreground">
                  Override row {editingRow.overrideRecord.id}
                </div>
              ) : null}
            </div>
          ) : null
        }
        description="Deleting the override removes the organization-specific row and reverts this widget type back to its built-in default organization configuration."
        tone="danger"
      />
    </AdminSurfaceLayout>
  );
}
