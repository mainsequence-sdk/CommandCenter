import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Database, Search } from "lucide-react";

import {
  getConnectionRuntimeDefinition,
  hydrateConnectionRuntime,
} from "@/app/registry/connection-runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createConnectionInstance,
  queryConnection,
  testConnection,
  updateConnectionInstance,
} from "@/connections/api";
import { ConnectionPicker } from "@/connections/components/ConnectionPicker";
import { ConnectionTypeIcon } from "@/connections/components/ConnectionTypeIcon";
import { useConnectionInstances, useConnectionTypes } from "@/connections/hooks";
import type {
  AnyConnectionTypeDefinition,
  ConnectionConfigSchema,
  ConnectionInstance,
  ConnectionQueryModel,
} from "@/connections/types";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";

type ConnectionsPageMode = "add-new" | "data-sources" | "explore";
const dataSourceRowGridClass =
  "lg:grid-cols-[minmax(260px,1.35fr)_minmax(160px,0.9fr)_minmax(180px,1fr)_120px_150px_90px_220px]";

function formatInstanceStatus(instance: ConnectionInstance) {
  if (instance.status === "ok") return "Healthy";
  if (instance.status === "error") return "Error";
  if (instance.status === "disabled") return "Disabled";
  return "Unknown";
}

function EmptyCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function isActiveBackendType(connection: AnyConnectionTypeDefinition) {
  return (connection as { isActive?: unknown }).isActive !== false;
}

function getConnectionIconUrl(connection: AnyConnectionTypeDefinition | undefined) {
  if (!connection) {
    return undefined;
  }

  return connection.iconUrl ?? getConnectionRuntimeDefinition(connection)?.iconUrl;
}

function getNewerRuntimeConnectionDefinition(
  connection: AnyConnectionTypeDefinition | undefined,
) {
  const runtimeDefinition = getConnectionRuntimeDefinition(connection);

  if (!connection || !runtimeDefinition || runtimeDefinition.version <= connection.version) {
    return undefined;
  }

  return runtimeDefinition;
}

function BackendRegistryVersionWarning({
  connection,
}: {
  connection: AnyConnectionTypeDefinition;
}) {
  const newerRuntimeDefinition = getNewerRuntimeConnectionDefinition(connection);

  if (!newerRuntimeDefinition) {
    return null;
  }

  return (
    <div className="rounded-[calc(var(--radius)-6px)] border border-warning/35 bg-warning/10 px-4 py-3 text-sm leading-6 text-warning">
      Backend registry is still serving {connection.id}@v{connection.version}; this frontend has
      v{newerRuntimeDefinition.version}. Publish the Connection Registry in Admin Settings before
      saving this data source so the backend accepts the new configuration contract.
    </div>
  );
}

function getConnectionTypeForInstance(
  typesById: Map<string, AnyConnectionTypeDefinition>,
  instance: ConnectionInstance,
) {
  const directMatch = typesById.get(instance.typeId);

  if (directMatch) {
    return directMatch;
  }

  const runtimeDefinition = getConnectionRuntimeDefinition(instance.typeId);

  if (!runtimeDefinition) {
    return undefined;
  }

  return (
    [...typesById.values()].find(
      (connectionType) =>
        getConnectionRuntimeDefinition(connectionType)?.id === runtimeDefinition.id,
    ) ?? runtimeDefinition
  );
}

function getTypeSearchText(connection: AnyConnectionTypeDefinition) {
  return [
    connection.title,
    connection.description,
    connection.id,
    connection.source,
    connection.category,
    ...(connection.tags ?? []),
  ].join(" ").toLowerCase();
}

function toFormString(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value, null, 2);
}

function createInitialValues(schema?: ConnectionConfigSchema) {
  return Object.fromEntries(
    (schema?.fields ?? []).map((field) => [field.id, toFormString(field.defaultValue)]),
  );
}

function createValuesFromConfig(
  schema: ConnectionConfigSchema | undefined,
  config: Record<string, unknown>,
) {
  const values = createInitialValues(schema);

  for (const field of schema?.fields ?? []) {
    if (Object.prototype.hasOwnProperty.call(config, field.id)) {
      values[field.id] = toFormString(config[field.id]);
    }
  }

  return values;
}

function createEmptyValues(schema?: ConnectionConfigSchema) {
  return Object.fromEntries((schema?.fields ?? []).map((field) => [field.id, ""]));
}

function parseConfigEditorValue(
  schema: ConnectionConfigSchema | undefined,
  values: Record<string, string>,
) {
  try {
    return parseSchemaValues(schema, values, {
      omitEmpty: true,
      allowEmptyRequired: true,
    });
  } catch {
    return {};
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function parseSchemaValues(
  schema: ConnectionConfigSchema | undefined,
  values: Record<string, string>,
  options: { omitEmpty: boolean; allowEmptyRequired?: boolean },
) {
  const output: Record<string, unknown> = {};

  for (const field of schema?.fields ?? []) {
    const rawValue = values[field.id]?.trim() ?? "";

    if (!rawValue && field.required && !options.allowEmptyRequired) {
      throw new Error(`${field.label} is required.`);
    }

    if (!rawValue && options.omitEmpty) {
      continue;
    }

    if (!rawValue) {
      output[field.id] = "";
      continue;
    }

    if (field.type === "number") {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        throw new Error(`${field.label} must be a valid number.`);
      }
      output[field.id] = parsed;
      continue;
    }

    if (field.type === "boolean") {
      output[field.id] = rawValue === "true";
      continue;
    }

    if (field.type === "json") {
      output[field.id] = JSON.parse(rawValue) as unknown;
      continue;
    }

    output[field.id] = rawValue;
  }

  return output;
}

function ConfigFieldInput({
  field,
  value,
  onChange,
  secret = false,
}: {
  field: ConnectionConfigSchema["fields"][number];
  value: string;
  onChange: (value: string) => void;
  secret?: boolean;
}) {
  if (field.type === "select") {
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select {field.label.toLowerCase()}</option>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  }

  if (field.type === "boolean") {
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Not set</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </Select>
    );
  }

  if (field.type === "json") {
    return (
      <Textarea
        className="min-h-28 font-mono text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder='{"key": "value"}'
      />
    );
  }

  return (
    <Input
      type={secret || field.type === "secret" ? "password" : field.type === "number" ? "number" : "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.label}
    />
  );
}

function getSchemaFieldGroups(schema?: ConnectionConfigSchema) {
  const fields = schema?.fields ?? [];
  const sections = schema?.sections ?? [];
  const sectionIds = new Set(sections.map((section) => section.id));
  const groups = sections
    .map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      fields: fields.filter((field) => field.sectionId === section.id),
    }))
    .filter((section) => section.fields.length > 0);
  const ungroupedFields = fields.filter(
    (field) => !field.sectionId || !sectionIds.has(field.sectionId),
  );

  if (ungroupedFields.length > 0) {
    groups.push({
      id: "__default",
      title: "Configuration",
      description: undefined,
      fields: ungroupedFields,
    });
  }

  return groups;
}

function SchemaFieldsForm({
  title,
  schema,
  values,
  onFieldChange,
  secret = false,
  secureFields,
}: {
  title: string;
  schema?: ConnectionConfigSchema;
  values: Record<string, string>;
  onFieldChange: (fieldId: string, value: string) => void;
  secret?: boolean;
  secureFields?: Record<string, boolean>;
}) {
  const groups = getSchemaFieldGroups(schema);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5 border-t border-border/70 pt-5">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </div>
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.id} className="space-y-3">
            {groups.length > 1 || group.id !== "__default" ? (
              <div>
                <div className="text-sm font-semibold text-foreground">{group.title}</div>
                {group.description ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {group.description}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-4 xl:grid-cols-2">
              {group.fields.map((field) => (
                <div key={field.id} className="block space-y-1.5">
                  <WidgetSettingFieldLabel
                    className="text-xs font-medium text-muted-foreground"
                    help={field.description}
                    required={field.required}
                  >
                    {field.label}
                  </WidgetSettingFieldLabel>
                  <ConfigFieldInput
                    field={field}
                    value={values[field.id] ?? ""}
                    secret={secret}
                    onChange={(value) => onFieldChange(field.id, value)}
                  />
                  {secret && secureFields?.[field.id] ? (
                    <span className="block text-[11px] leading-4 text-muted-foreground">
                      Existing value is configured. Leave blank to keep it unchanged.
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ConnectionTypeListItem({
  connection,
  selected,
  onSelect,
}: {
  connection: AnyConnectionTypeDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex min-h-20 w-full items-center gap-4 rounded-[calc(var(--radius)-4px)] border p-4 text-left transition-colors ${
        selected
          ? "border-primary/60 bg-primary/10"
          : "border-border/70 bg-card/70 hover:border-primary/40 hover:bg-card"
      }`}
      onClick={onSelect}
    >
      <ConnectionTypeIcon title={connection.title} iconUrl={getConnectionIconUrl(connection)} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">
          {connection.title}
        </span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
          {connection.description}
        </span>
      </span>
    </button>
  );
}

function CreateConnectionPanel({
  selectedType,
  onBack,
}: {
  selectedType: AnyConnectionTypeDefinition;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const ConfigEditor = selectedType.configEditor;
  const newerRuntimeDefinition = getNewerRuntimeConnectionDefinition(selectedType);
  const [name, setName] = useState("");
  const [uid, setUid] = useState("");
  const [description, setDescription] = useState("");
  const [publicValues, setPublicValues] = useState<Record<string, string>>({});
  const [secureValues, setSecureValues] = useState<Record<string, string>>({});
  const [lastCreatedUid, setLastCreatedUid] = useState("");

  useEffect(() => {
    setName(selectedType.title);
    setUid(slugify(selectedType.title));
    setDescription("");
    setPublicValues(createInitialValues(selectedType.publicConfigSchema));
    setSecureValues(createInitialValues(selectedType.secureConfigSchema));
    setLastCreatedUid("");
  }, [selectedType]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const trimmedUid = uid.trim();

      if (!trimmedName) {
        throw new Error("Connection name is required.");
      }

      if (!trimmedUid) {
        throw new Error("Connection UID is required.");
      }

      return createConnectionInstance({
        uid: trimmedUid,
        typeId: selectedType.id,
        typeVersion: selectedType.version,
        name: trimmedName,
        description: description.trim() || undefined,
        workspaceId: null,
        publicConfig: parseSchemaValues(selectedType.publicConfigSchema, publicValues, {
          omitEmpty: false,
        }),
        secureConfig: parseSchemaValues(selectedType.secureConfigSchema, secureValues, {
          omitEmpty: true,
        }),
      });
    },
    onSuccess: (instance) => {
      setLastCreatedUid(instance.uid);
      void queryClient.invalidateQueries({ queryKey: ["connections", "instances"] });
    },
  });

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" className="px-0" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Connection types
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <ConnectionTypeIcon
                title={selectedType.title}
                iconUrl={getConnectionIconUrl(selectedType)}
              />
              <div className="min-w-0 space-y-2">
                <CardTitle>Create data source</CardTitle>
                <CardDescription>{selectedType.title}</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <BackendRegistryVersionWarning connection={selectedType} />

          <div className="grid gap-4 xl:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">UID</span>
              <Input
                className="font-mono text-xs"
                value={uid}
                onChange={(event) => setUid(slugify(event.target.value) || event.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          {ConfigEditor ? (
            <ConfigEditor
              value={parseConfigEditorValue(selectedType.publicConfigSchema, publicValues)}
              onChange={(nextValue) => {
                setPublicValues(createValuesFromConfig(selectedType.publicConfigSchema, nextValue));
              }}
              disabled={createMutation.isPending}
            />
          ) : (
            <SchemaFieldsForm
              title="Configuration"
              schema={selectedType.publicConfigSchema}
              values={publicValues}
              onFieldChange={(fieldId, value) =>
                setPublicValues((current) => ({ ...current, [fieldId]: value }))
              }
            />
          )}

          <SchemaFieldsForm
            title="Secrets"
            schema={selectedType.secureConfigSchema}
            values={secureValues}
            secret
            onFieldChange={(fieldId, value) =>
              setSecureValues((current) => ({ ...current, [fieldId]: value }))
            }
          />

          <div className="flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center">
            <Button
              type="button"
              disabled={createMutation.isPending || Boolean(newerRuntimeDefinition)}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Creating" : "Create data source"}
            </Button>
            <Button type="button" variant="outline" onClick={onBack}>
              Cancel
            </Button>
          </div>
          {lastCreatedUid ? (
            <p className="text-sm text-muted-foreground">
              Created data source <span className="font-mono">{lastCreatedUid}</span>.
            </p>
          ) : null}
          {createMutation.error ? (
            <p className="text-sm text-destructive">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Unable to create data source."}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function EditConnectionPanel({
  instance,
  selectedType,
  onBack,
}: {
  instance: ConnectionInstance;
  selectedType: AnyConnectionTypeDefinition;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const ConfigEditor = selectedType.configEditor;
  const newerRuntimeDefinition = getNewerRuntimeConnectionDefinition(selectedType);
  const [name, setName] = useState(instance.name);
  const [description, setDescription] = useState(instance.description ?? "");
  const [publicValues, setPublicValues] = useState<Record<string, string>>({});
  const [secureValues, setSecureValues] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    setName(instance.name);
    setDescription(instance.description ?? "");
    setPublicValues(createValuesFromConfig(selectedType.publicConfigSchema, instance.publicConfig));
    setSecureValues(createEmptyValues(selectedType.secureConfigSchema));
    setSavedAt("");
  }, [instance, selectedType]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        throw new Error("Connection name is required.");
      }

      return updateConnectionInstance(instance.uid, {
        name: trimmedName,
        description: description.trim(),
        publicConfig: parseSchemaValues(selectedType.publicConfigSchema, publicValues, {
          omitEmpty: false,
        }),
        secureConfig: parseSchemaValues(selectedType.secureConfigSchema, secureValues, {
          omitEmpty: true,
          allowEmptyRequired: true,
        }),
      });
    },
    onSuccess: () => {
      setSecureValues(createEmptyValues(selectedType.secureConfigSchema));
      setSavedAt(new Date().toLocaleTimeString());
      void queryClient.invalidateQueries({ queryKey: ["connections", "instances"] });
    },
  });

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" className="px-0" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Data sources
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <ConnectionTypeIcon
                title={selectedType.title}
                iconUrl={getConnectionIconUrl(selectedType)}
              />
              <div className="min-w-0 space-y-2">
                <CardTitle>Edit data source</CardTitle>
                <CardDescription>
                  {instance.name} · <span className="font-mono">{instance.uid}</span>
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <BackendRegistryVersionWarning connection={selectedType} />

          <div className="grid gap-4 xl:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">UID</span>
              <Input className="font-mono text-xs" value={instance.uid} disabled />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          {ConfigEditor ? (
            <ConfigEditor
              value={parseConfigEditorValue(selectedType.publicConfigSchema, publicValues)}
              onChange={(nextValue) => {
                setPublicValues(createValuesFromConfig(selectedType.publicConfigSchema, nextValue));
              }}
              disabled={updateMutation.isPending}
            />
          ) : (
            <SchemaFieldsForm
              title="Configuration"
              schema={selectedType.publicConfigSchema}
              values={publicValues}
              onFieldChange={(fieldId, value) =>
                setPublicValues((current) => ({ ...current, [fieldId]: value }))
              }
            />
          )}

          <SchemaFieldsForm
            title="Secrets"
            schema={selectedType.secureConfigSchema}
            values={secureValues}
            secret
            secureFields={instance.secureFields}
            onFieldChange={(fieldId, value) =>
              setSecureValues((current) => ({ ...current, [fieldId]: value }))
            }
          />

          <div className="flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center">
            <Button
              type="button"
              disabled={updateMutation.isPending || Boolean(newerRuntimeDefinition)}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? "Saving" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" onClick={onBack}>
              Cancel
            </Button>
          </div>
          {savedAt ? (
            <p className="text-sm text-muted-foreground">Saved changes at {savedAt}.</p>
          ) : null}
          {updateMutation.error ? (
            <p className="text-sm text-destructive">
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : "Unable to update data source."}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionInstanceRow({
  instance,
  connectionType,
  onEdit,
}: {
  instance: ConnectionInstance;
  connectionType?: AnyConnectionTypeDefinition;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const testMutation = useMutation({
    mutationFn: () => testConnection(instance.uid),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["connections", "instances"] });
    },
  });
  const secureFieldCount = Object.keys(instance.secureFields).length;

  return (
    <div
      className={`grid gap-3 border-b border-border/70 px-4 py-3 text-sm last:border-b-0 lg:items-center ${dataSourceRowGridClass}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ConnectionTypeIcon
          title={connectionType?.title ?? instance.typeId}
          iconUrl={getConnectionIconUrl(connectionType)}
          className="h-9 w-9"
        />
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{instance.name}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {instance.description ?? connectionType?.title ?? "No description"}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          UID
        </div>
        <div className="truncate font-mono text-xs text-foreground">{instance.uid}</div>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          Type
        </div>
        <div className="truncate font-mono text-xs text-foreground">
          {instance.typeId}@v{instance.typeVersion}
        </div>
      </div>
      <div>
        <Badge variant={instance.status === "ok" ? "primary" : "neutral"}>
          {formatInstanceStatus(instance)}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          Last health
        </div>
        {instance.lastHealthCheckAt ?? "Never"}
      </div>
      <div className="text-xs text-muted-foreground">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          Secrets
        </div>
        {secureFieldCount || "None"}
      </div>
      <div className="flex items-center justify-start gap-2 lg:justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-w-[4rem] whitespace-nowrap"
          onClick={onEdit}
        >
          Edit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-w-[7rem] whitespace-nowrap"
          disabled={testMutation.isPending}
          onClick={() => testMutation.mutate()}
        >
          {testMutation.isPending ? "Testing" : "Test"}
        </Button>
      </div>
      {instance.statusMessage || testMutation.error ? (
        <div className="text-xs text-muted-foreground lg:col-span-7">
          {testMutation.error instanceof Error
            ? testMutation.error.message
            : instance.statusMessage}
        </div>
      ) : null}
    </div>
  );
}

function buildExploreQueryTemplate(
  selectedType: AnyConnectionTypeDefinition | undefined,
  queryModel: ConnectionQueryModel | undefined,
) {
  const exampleQuery = selectedType?.examples?.find((example) => example.query)?.query;

  if (exampleQuery) {
    return JSON.stringify(exampleQuery, null, 2);
  }

  if (queryModel) {
    return JSON.stringify({ kind: queryModel.id }, null, 2);
  }

  return "{}";
}

function AddNewConnectionContent() {
  const typesQuery = useConnectionTypes();
  const [searchValue, setSearchValue] = useState("");
  const [configuringTypeId, setConfiguringTypeId] = useState("");

  const backendTypes = useMemo(
    () =>
      (typesQuery.data ?? [])
        .filter(isActiveBackendType)
        .map(hydrateConnectionRuntime)
        .sort((left, right) => left.title.localeCompare(right.title)),
    [typesQuery.data],
  );
  const filteredTypes = useMemo(() => {
    const needle = searchValue.trim().toLowerCase();

    if (!needle) {
      return backendTypes;
    }

    return backendTypes.filter((connection) => getTypeSearchText(connection).includes(needle));
  }, [backendTypes, searchValue]);
  const configuringType = useMemo(
    () => backendTypes.find((connection) => connection.id === configuringTypeId),
    [backendTypes, configuringTypeId],
  );

  useEffect(() => {
    if (!configuringTypeId) {
      return;
    }

    if (!backendTypes.some((connection) => connection.id === configuringTypeId)) {
      setConfiguringTypeId("");
    }
  }, [backendTypes, configuringTypeId]);

  if (configuringType) {
    return (
      <CreateConnectionPanel
        selectedType={configuringType}
        onBack={() => setConfiguringTypeId("")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search synced connection types"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={typesQuery.isFetching}
          onClick={() => {
            void typesQuery.refetch();
          }}
        >
          {typesQuery.isFetching ? "Refreshing" : "Refresh catalog"}
        </Button>
      </div>

      {typesQuery.isLoading ? (
        <EmptyCard title="Loading catalog" description="Fetching backend-synced connection types." />
      ) : null}

      {typesQuery.isError ? (
        <EmptyCard
          title="Catalog unavailable"
          description={
            typesQuery.error instanceof Error
              ? typesQuery.error.message
              : "Unable to fetch backend-synced connection types."
          }
        />
      ) : null}

      {!typesQuery.isLoading && !typesQuery.isError && backendTypes.length === 0 ? (
        <EmptyCard
          title="No synced connection types"
          description="Publish connection types from Admin Settings before users can create data sources."
        />
      ) : null}

      {backendTypes.length > 0 && filteredTypes.length === 0 ? (
        <EmptyCard title="No matches" description="No synced connection type matches that search." />
      ) : null}

      {filteredTypes.length > 0 ? (
        <div className="grid content-start gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTypes.map((connection) => (
            <ConnectionTypeListItem
              key={connection.id}
              connection={connection}
              selected={false}
              onSelect={() => setConfiguringTypeId(connection.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DataSourcesContent({
  typesById,
}: {
  typesById: Map<string, AnyConnectionTypeDefinition>;
}) {
  const instancesQuery = useConnectionInstances();
  const [editingUid, setEditingUid] = useState("");
  const instances = instancesQuery.data ?? [];
  const editingInstance = instances.find((instance) => instance.uid === editingUid);
  const editingType = editingInstance ? typesById.get(editingInstance.typeId) : undefined;

  if (editingInstance && editingType) {
    return (
      <EditConnectionPanel
        instance={editingInstance}
        selectedType={editingType}
        onBack={() => setEditingUid("")}
      />
    );
  }

  if (editingInstance && !editingType) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" className="px-0" onClick={() => setEditingUid("")}>
          <ArrowLeft className="h-4 w-4" />
          Data sources
        </Button>
        <EmptyCard
          title="Connection type unavailable"
          description="This data source references a connection type that is not active in the backend catalog. Publish the connection registry before editing this instance."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {instancesQuery.isLoading ? (
        <EmptyCard title="Loading instances" description="Fetching configured data sources." />
      ) : null}
      {instances.length ? (
        <div className="overflow-hidden rounded-[calc(var(--radius)-4px)] border border-border/70 bg-card/70">
          <div
            className={`hidden border-b border-border/70 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground lg:grid ${dataSourceRowGridClass}`}
          >
            <div>Name</div>
            <div>UID</div>
            <div>Type</div>
            <div>Status</div>
            <div>Last health</div>
            <div>Secrets</div>
            <div className="text-right">Actions</div>
          </div>
          {instances.map((instance) => (
            <ConnectionInstanceRow
              key={instance.uid}
              instance={instance}
              connectionType={getConnectionTypeForInstance(typesById, instance)}
              onEdit={() => setEditingUid(instance.uid)}
            />
          ))}
        </div>
      ) : null}
      {instancesQuery.data && instances.length === 0 ? (
        <EmptyCard
          title="No data sources"
          description="Create or provision a backend-owned connection instance before widgets can query it."
        />
      ) : null}

      {instances.some((instance) => !getConnectionTypeForInstance(typesById, instance)) ? (
        <Card>
          <CardHeader>
            <CardTitle>Unsynced Instance Types</CardTitle>
            <CardDescription>
              Some data sources reference connection types that are not active in the backend type
              catalog. Publish the connection registry from Admin Settings or verify the extension
              is installed.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}

function ExploreContent({
  typesById,
}: {
  typesById: Map<string, AnyConnectionTypeDefinition>;
}) {
  const instancesQuery = useConnectionInstances();
  const instances = instancesQuery.data ?? [];
  const [selectedUid, setSelectedUid] = useState("");
  const [queryModelId, setQueryModelId] = useState("");
  const [queryText, setQueryText] = useState("{}");
  const [resultText, setResultText] = useState("");

  const selectedInstance = instances.find((instance) => instance.uid === selectedUid);
  const selectedType = selectedInstance
    ? getConnectionTypeForInstance(typesById, selectedInstance)
    : undefined;
  const queryModels = useMemo(() => selectedType?.queryModels ?? [], [selectedType]);
  const selectedQueryModel =
    queryModels.find((model) => model.id === queryModelId) ?? queryModels[0];
  const CustomExplore = selectedType?.exploreComponent;

  useEffect(() => {
    if (!selectedUid && instances.length > 0) {
      setSelectedUid(instances[0]!.uid);
    }
  }, [instances, selectedUid]);

  useEffect(() => {
    setQueryModelId(queryModels[0]?.id ?? "");
  }, [selectedInstance?.uid, selectedType?.id, queryModels]);

  useEffect(() => {
    setQueryText(buildExploreQueryTemplate(selectedType, selectedQueryModel));
    setResultText("");
  }, [selectedInstance?.uid, selectedQueryModel?.id, selectedType]);

  const queryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUid) {
        throw new Error("Select a data source first.");
      }

      const parsedQuery = queryText.trim() ? JSON.parse(queryText) as Record<string, unknown> : {};
      return queryConnection({
        connectionUid: selectedUid,
        query: parsedQuery,
      });
    },
    onSuccess: (result) => {
      setResultText(JSON.stringify(result, null, 2));
    },
  });

  return (
    <div className="space-y-4">
      {instancesQuery.isLoading ? (
        <EmptyCard title="Loading data sources" description="Fetching configured data sources." />
      ) : null}

      {instances.length === 0 && !instancesQuery.isLoading ? (
        <EmptyCard
          title="No data sources"
          description="Create or provision a data source before exploring connection queries."
        />
      ) : null}

      {instances.length > 0 ? (
        <div className="space-y-4">
          <Card className="relative z-30 overflow-visible">
            <CardContent className="pt-5">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Data source</span>
                <ConnectionPicker
                  value={
                    selectedInstance
                      ? { uid: selectedInstance.uid, typeId: selectedInstance.typeId }
                      : undefined
                  }
                  onChange={(nextRef) => setSelectedUid(nextRef?.uid ?? "")}
                  accepts={{ capabilities: ["query"] }}
                  placeholder="Select a data source"
                />
              </div>
            </CardContent>
          </Card>

          {CustomExplore && selectedInstance && selectedType ? (
            <CustomExplore connectionInstance={selectedInstance} connectionType={selectedType} />
          ) : (
            <div className="relative z-0 grid gap-4 xl:grid-cols-[minmax(0,520px)_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Explore connection</CardTitle>
                  <CardDescription>
                    Send a live query request to a configured data source.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Query model</span>
                    <Select
                      value={selectedQueryModel?.id ?? ""}
                      onChange={(event) => setQueryModelId(event.target.value)}
                      disabled={queryModels.length === 0}
                    >
                      {queryModels.length > 0 ? (
                        queryModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                          </option>
                        ))
                      ) : (
                        <option value="">Raw query</option>
                      )}
                    </Select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Query JSON</span>
                    <Textarea
                      className="min-h-56 font-mono text-xs"
                      value={queryText}
                      onChange={(event) => setQueryText(event.target.value)}
                    />
                  </label>

                  <Button
                    type="button"
                    disabled={queryMutation.isPending || !selectedUid}
                    onClick={() => queryMutation.mutate()}
                  >
                    {queryMutation.isPending ? "Running query" : "Run query"}
                  </Button>
                  {queryMutation.error ? (
                    <p className="text-sm text-destructive">
                      {queryMutation.error instanceof Error
                        ? queryMutation.error.message
                        : "Connection query failed."}
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Result</CardTitle>
                  <CardDescription>
                    Normalized connection response returned by the backend.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="max-h-[620px] overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/50 p-4 font-mono text-xs leading-6 text-foreground">
                    <code>{resultText || "Run a query to see the response."}</code>
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ConnectionsAddNewPage() {
  return <ConnectionsPage mode="add-new" />;
}

export function ConnectionDataSourcesPage() {
  return <ConnectionsPage mode="data-sources" />;
}

export function ConnectionsExplorePage() {
  return <ConnectionsPage mode="explore" />;
}

function ConnectionsPage({ mode }: { mode: ConnectionsPageMode }) {
  const typesQuery = useConnectionTypes();
  const backendTypes = useMemo(
    () =>
      (typesQuery.data ?? [])
        .filter(isActiveBackendType)
        .map(hydrateConnectionRuntime)
        .sort((left, right) => left.title.localeCompare(right.title)),
    [typesQuery.data],
  );
  const typesById = useMemo(
    () => new Map(backendTypes.map((type) => [type.id, type])),
    [backendTypes],
  );
  const title =
    mode === "add-new"
      ? "Add A New Connection"
      : mode === "explore"
        ? "Explore"
        : "Data Sources";
  const description =
    mode === "add-new"
      ? "Search backend-synced connection types and create configured data-source instances."
      : mode === "explore"
        ? "Run live query requests against configured data sources."
        : "Review backend-owned configured data-source instances available to widgets.";

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 border-b border-border/60 pb-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Database className="h-4 w-4" />
              Connections
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
          </div>
          {mode === "add-new" ? (
            <Badge variant="neutral">{backendTypes.length} synced types</Badge>
          ) : null}
        </header>

        {mode === "add-new" ? <AddNewConnectionContent /> : null}
        {mode === "data-sources" ? <DataSourcesContent typesById={typesById} /> : null}
        {mode === "explore" ? <ExploreContent typesById={typesById} /> : null}
      </div>
    </div>
  );
}
