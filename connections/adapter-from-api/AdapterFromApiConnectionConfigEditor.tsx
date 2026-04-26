import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ConnectionConfigEditorProps } from "@/connections/types";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";

import type {
  AdapterFromApiCompiledContract,
  AdapterFromApiFieldType,
  AdapterFromApiPublicConfig,
  AdapterFromApiVariableDefinition,
} from "./index";

function updateConfig(
  value: AdapterFromApiPublicConfig,
  onChange: (value: AdapterFromApiPublicConfig) => void,
  patch: Partial<AdapterFromApiPublicConfig>,
) {
  onChange({ ...value, ...patch });
}

function readOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

const WELL_KNOWN_CONTRACT_PATH = "/.well-known/command-center/connection-contract";
const DEFAULT_OPENAPI_PATH = "/openapi.json";

function isBareUrlScheme(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\/$/i.test(value.trim());
}

function stripKnownApiDiscoverySuffix(value: string) {
  const trimmedValue = value.trim();

  if (isBareUrlScheme(trimmedValue)) {
    return trimmedValue;
  }

  const normalizedValue = trimmedValue.replace(/\/+$/, "");

  for (const suffix of [WELL_KNOWN_CONTRACT_PATH, DEFAULT_OPENAPI_PATH]) {
    if (normalizedValue.endsWith(suffix)) {
      return normalizedValue.slice(0, -suffix.length);
    }
  }

  return normalizedValue;
}

function normalizeApiRootUrl(value: string) {
  const normalizedValue = stripKnownApiDiscoverySuffix(value);
  return normalizedValue || "";
}

function buildDerivedDiscoveryConfig(apiRootUrl: string) {
  const normalizedRoot = normalizeApiRootUrl(apiRootUrl);

  if (!normalizedRoot || isBareUrlScheme(normalizedRoot)) {
    return {
      apiBaseUrl: normalizedRoot || undefined,
      contractDefinitionUrl: undefined,
      openApiUrl: undefined,
    } satisfies Partial<AdapterFromApiPublicConfig>;
  }

  return {
    apiBaseUrl: normalizedRoot,
    contractDefinitionUrl: `${normalizedRoot}${WELL_KNOWN_CONTRACT_PATH}`,
    openApiUrl: `${normalizedRoot}${DEFAULT_OPENAPI_PATH}`,
  } satisfies Partial<AdapterFromApiPublicConfig>;
}

function readContract(value: AdapterFromApiPublicConfig): AdapterFromApiCompiledContract | undefined {
  return isRecord(value.compiledContract)
    ? (value.compiledContract as unknown as AdapterFromApiCompiledContract)
    : undefined;
}

function readApiRootUrl(value: AdapterFromApiPublicConfig) {
  return normalizeApiRootUrl(
    value.apiBaseUrl ?? value.contractDefinitionUrl ?? value.openApiUrl ?? "",
  );
}

function Field({
  children,
  help,
  label,
  required,
}: {
  children: ReactNode;
  help: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <WidgetSettingFieldLabel
        className="text-xs font-medium text-muted-foreground"
        help={help}
        required={required}
      >
        {label}
      </WidgetSettingFieldLabel>
      {children}
    </label>
  );
}

function JsonEditor({
  disabled,
  help,
  label,
  onChange,
  value,
}: {
  disabled?: boolean;
  help: string;
  label: string;
  onChange: (value: Record<string, unknown> | undefined) => void;
  value?: unknown;
}) {
  const externalValue = useMemo(() => formatJson(value), [value]);
  const [draft, setDraft] = useState(externalValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(externalValue);
    setError(null);
  }, [externalValue]);

  function commit(nextDraft = draft) {
    if (!nextDraft.trim()) {
      setError(null);
      onChange(undefined);
      return;
    }

    try {
      const parsed = JSON.parse(nextDraft) as unknown;

      if (!isRecord(parsed)) {
        throw new Error("JSON value must be an object.");
      }

      setError(null);
      onChange(parsed);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Invalid JSON object.");
    }
  }

  return (
    <Field label={label} help={help}>
      <Textarea
        className="min-h-36 font-mono text-xs"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit()}
        disabled={disabled}
        spellCheck={false}
      />
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </Field>
  );
}

function coerceDynamicValue(type: AdapterFromApiFieldType, rawValue: string): unknown {
  if (!rawValue.trim()) {
    return undefined;
  }

  if (type === "number") {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (type === "boolean") {
    return rawValue === "true";
  }

  if (type === "json") {
    try {
      return JSON.parse(rawValue) as unknown;
    } catch {
      return rawValue;
    }
  }

  return rawValue;
}

function formatDynamicValue(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function DynamicConfigField({
  disabled,
  field,
  onChange,
  value,
}: {
  disabled?: boolean;
  field: AdapterFromApiVariableDefinition;
  onChange: (value: unknown) => void;
  value: unknown;
}) {
  const formattedValue = formatDynamicValue(value ?? field.defaultValue);

  if (field.type === "select") {
    return (
      <Field
        label={field.label}
        help={field.description ?? `Dynamic config value ${field.key}.`}
        required={field.required}
      >
        <Select
          value={formattedValue}
          onChange={(event) => onChange(event.target.value || undefined)}
          disabled={disabled}
        >
          <option value="">Select {field.label.toLowerCase()}</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  if (field.type === "boolean") {
    return (
      <Field
        label={field.label}
        help={field.description ?? `Dynamic config value ${field.key}.`}
        required={field.required}
      >
        <Select
          value={formattedValue}
          onChange={(event) => onChange(coerceDynamicValue(field.type, event.target.value))}
          disabled={disabled}
        >
          <option value="">Not set</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </Select>
      </Field>
    );
  }

  if (field.type === "json") {
    return (
      <Field
        label={field.label}
        help={field.description ?? `Dynamic config value ${field.key}.`}
        required={field.required}
      >
        <Textarea
          className="min-h-28 font-mono text-xs"
          value={formattedValue}
          onChange={(event) => onChange(coerceDynamicValue(field.type, event.target.value))}
          disabled={disabled}
          spellCheck={false}
          placeholder={String(field.example ?? '{"key": "value"}')}
        />
      </Field>
    );
  }

  return (
    <Field
      label={field.label}
      help={field.description ?? `Dynamic config value ${field.key}.`}
      required={field.required}
    >
      <Input
        type={field.type === "number" ? "number" : "text"}
        value={formattedValue}
        onChange={(event) => onChange(coerceDynamicValue(field.type, event.target.value))}
        disabled={disabled}
        placeholder={field.example === undefined ? field.label : String(field.example)}
      />
    </Field>
  );
}

export function AdapterFromApiConnectionConfigEditor({
  disabled = false,
  onChange,
  value,
}: ConnectionConfigEditorProps<AdapterFromApiPublicConfig>) {
  const compiledContract = readContract(value);
  const configVariables = compiledContract?.configVariables ?? [];
  const secretVariables = compiledContract?.secretVariables ?? [];
  const operationCount = compiledContract?.availableOperations?.length ?? 0;
  const configValues = isRecord(value.configValues) ? value.configValues : {};
  const apiRootUrl = readApiRootUrl(value);
  const derivedDiscoveryConfig = buildDerivedDiscoveryConfig(apiRootUrl);

  useEffect(() => {
    if (!apiRootUrl) {
      return;
    }

    if (
      value.apiBaseUrl === derivedDiscoveryConfig.apiBaseUrl &&
      value.openApiUrl === derivedDiscoveryConfig.openApiUrl &&
      value.contractDefinitionUrl === derivedDiscoveryConfig.contractDefinitionUrl
    ) {
      return;
    }

    updateConfig(value, onChange, derivedDiscoveryConfig);
  }, [
    apiRootUrl,
    derivedDiscoveryConfig,
    onChange,
    value,
    value.apiBaseUrl,
    value.contractDefinitionUrl,
    value.openApiUrl,
  ]);

  function updateConfigValue(key: string, nextValue: unknown) {
    updateConfig(value, onChange, {
      configValues: {
        ...configValues,
        [key]: nextValue,
      },
    });
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-2">
        <Field
          label="API root URL"
          required
          help="Root URL for the upstream API. This editor derives the OpenAPI URL as /openapi.json and the Command Center contract URL as /.well-known/command-center/connection-contract."
        >
          <div className="space-y-2">
            <Input
              value={apiRootUrl}
              onChange={(event) =>
                updateConfig(value, onChange, buildDerivedDiscoveryConfig(event.target.value))
              }
              disabled={disabled}
              placeholder="https://api.example.com"
            />
            <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/40 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
              <div>
                OpenAPI:{" "}
                {derivedDiscoveryConfig.openApiUrl ?? "https://api.example.com/openapi.json"}
              </div>
              <div>
                Contract:{" "}
                {derivedDiscoveryConfig.contractDefinitionUrl ??
                  "https://api.example.com/.well-known/command-center/connection-contract"}
              </div>
            </div>
          </div>
        </Field>

        <Field
          label="Contract version pin"
          help="Optional version, tag, or checksum marker used by the backend to pin contract discovery."
        >
          <Input
            value={value.contractVersion ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, { contractVersion: event.target.value })
            }
            disabled={disabled}
            placeholder="latest"
          />
        </Field>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Field
          label="Request timeout ms"
          help="Backend timeout for upstream API calls in milliseconds."
        >
          <Input
            type="number"
            min={100}
            value={value.requestTimeoutMs ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, {
                requestTimeoutMs: readOptionalNumber(event.target.value),
              })
            }
            disabled={disabled}
            placeholder="30000"
          />
        </Field>

        <Field
          label="Query cache policy"
          help="Backend result cache policy for successful safe API operations."
        >
          <Select
            value={value.queryCachePolicy ?? "safe"}
            onChange={(event) =>
              updateConfig(value, onChange, {
                queryCachePolicy: event.target.value === "disabled" ? "disabled" : "safe",
              })
            }
            disabled={disabled}
          >
            <option value="safe">safe</option>
            <option value="disabled">disabled</option>
          </Select>
        </Field>

        <Field
          label="Query cache TTL ms"
          help="Backend cache lifetime for successful API operation responses in milliseconds."
        >
          <Input
            type="number"
            min={0}
            value={value.queryCacheTtlMs ?? ""}
            onChange={(event) =>
              updateConfig(value, onChange, {
                queryCacheTtlMs: readOptionalNumber(event.target.value),
              })
            }
            disabled={disabled}
            placeholder="300000"
          />
        </Field>

        <Field
          label="Dedupe in-flight identical queries"
          help="When enabled, the backend shares one in-flight request for identical safe API operations."
        >
          <Select
            value={value.dedupeInFlight === false ? "false" : "true"}
            onChange={(event) =>
              updateConfig(value, onChange, { dedupeInFlight: event.target.value !== "false" })
            }
            disabled={disabled}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </Select>
        </Field>
      </section>

      <section className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-xs leading-5 text-muted-foreground">
        <div className="font-medium text-foreground">Compiled contract</div>
        {compiledContract ? (
          <div className="mt-1">
            {compiledContract.adapter?.title ?? compiledContract.adapter?.id ?? "API contract"} ·{" "}
            {operationCount} operation{operationCount === 1 ? "" : "s"} ·{" "}
            {configVariables.length} public variable
            {configVariables.length === 1 ? "" : "s"} · {secretVariables.length} secret
            {secretVariables.length === 1 ? "" : "s"}
          </div>
        ) : (
          <div className="mt-1">
            No compiled contract is present yet. Backend support must fetch the contract definition,
            validate the derived OpenAPI and well-known contract URLs, and save a sanitized
            compiledContract snapshot on this connection.
          </div>
        )}
      </section>

      {configVariables.length > 0 ? (
        <section className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Dynamic public variables</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              These fields come from the backend-compiled API contract. The backend validates them
              before saving and before execution.
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {configVariables.map((field) => (
              <DynamicConfigField
                key={field.key}
                field={field}
                value={configValues[field.key]}
                onChange={(nextValue) => updateConfigValue(field.key, nextValue)}
                disabled={disabled}
              />
            ))}
          </div>
        </section>
      ) : null}

      {secretVariables.length > 0 ? (
        <section className="rounded-[calc(var(--radius)-6px)] border border-warning/35 bg-warning/10 px-4 py-3 text-xs leading-5 text-warning">
          <div className="font-medium">Secret variables required</div>
          <div className="mt-1">
            Enter secret values in the Secrets section as a JSON object keyed by contract secret
            variable name: {secretVariables.map((field) => field.key).join(", ")}.
          </div>
        </section>
      ) : null}

      <details className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Advanced contract JSON
        </summary>
        <div className="mt-4 grid gap-4">
          <JsonEditor
            label="Config values JSON"
            help="Dynamic public config values keyed by the compiled contract's configVariables."
            value={value.configValues}
            onChange={(configValues) => updateConfig(value, onChange, { configValues })}
            disabled={disabled}
          />
          <JsonEditor
            label="Compiled contract JSON"
            help="Sanitized compiled contract snapshot. Normally written by the backend after discovery."
            value={value.compiledContract}
            onChange={(compiledContract) =>
              updateConfig(value, onChange, {
                compiledContract: compiledContract as AdapterFromApiCompiledContract | undefined,
              })
            }
            disabled={disabled}
          />
        </div>
      </details>
    </div>
  );
}
