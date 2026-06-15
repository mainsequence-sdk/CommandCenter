import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ConnectionConfigEditorProps } from "@/connections/types";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";

import {
  buildAdapterFromApiDiscoveryUrls,
  discoverAdapterFromApiDirectContract,
  readAdapterFromApiDirectDiscoverySessionCache,
  writeAdapterFromApiDirectDiscoverySessionCache,
  type AdapterFromApiDirectDiscoveryResult,
} from "./directTransport";
import type {
  AdapterFromApiCompiledContract,
  AdapterFromApiFieldType,
  AdapterFromApiPublicConfig,
  AdapterFromApiTransportMode,
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
const MAIN_SEQUENCE_MARKETS_APP_ID = "main_sequence_markets";
const MAIN_SEQUENCE_MARKETS_API_BINDING_ROLE = "primary-api";

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

function buildDerivedDiscoveryConfig(
  apiRootUrl: string,
  transportMode: AdapterFromApiTransportMode,
) {
  const normalizedRoot = normalizeApiRootUrl(apiRootUrl);

  if (!normalizedRoot || isBareUrlScheme(normalizedRoot)) {
    if (transportMode === "direct") {
      return {
        debugApiBaseUrl: normalizedRoot || undefined,
        contractDefinitionUrl: undefined,
        openApiUrl: undefined,
      } satisfies Partial<AdapterFromApiPublicConfig>;
    }

    return {
      apiBaseUrl: normalizedRoot || undefined,
      contractDefinitionUrl: undefined,
      openApiUrl: undefined,
    } satisfies Partial<AdapterFromApiPublicConfig>;
  }

  if (transportMode === "direct") {
    try {
      return {
        ...buildAdapterFromApiDiscoveryUrls(normalizedRoot),
        apiBaseUrl: undefined,
        debugApiBaseUrl: normalizedRoot,
      } satisfies Partial<AdapterFromApiPublicConfig>;
    } catch {
      return {
        debugApiBaseUrl: normalizedRoot,
        contractDefinitionUrl: undefined,
        openApiUrl: undefined,
      } satisfies Partial<AdapterFromApiPublicConfig>;
    }
  }

  try {
    return buildAdapterFromApiDiscoveryUrls(normalizedRoot);
  } catch {
    return {
      apiBaseUrl: normalizedRoot,
      contractDefinitionUrl: undefined,
      openApiUrl: undefined,
    } satisfies Partial<AdapterFromApiPublicConfig>;
  }
}

function readContract(value: AdapterFromApiPublicConfig): AdapterFromApiCompiledContract | undefined {
  return isRecord(value.compiledContract)
    ? (value.compiledContract as unknown as AdapterFromApiCompiledContract)
    : undefined;
}

function isMainSequenceMarketsBinding(value: unknown) {
  return (
    isRecord(value) &&
    value.appId === MAIN_SEQUENCE_MARKETS_APP_ID &&
    value.role === MAIN_SEQUENCE_MARKETS_API_BINDING_ROLE
  );
}

function readApplicationBindings(value: AdapterFromApiPublicConfig) {
  return Array.isArray(value.applicationBindings) ? value.applicationBindings : [];
}

function hasMainSequenceMarketsBinding(value: AdapterFromApiPublicConfig) {
  return readApplicationBindings(value).some(isMainSequenceMarketsBinding);
}

function readCompiledContractLogoUrl(value: AdapterFromApiCompiledContract | undefined) {
  const openapi = isRecord(value?.openapi) ? value.openapi : undefined;
  const logo = isRecord(openapi?.logo) ? openapi.logo : undefined;
  return typeof logo?.url === "string" && logo.url.trim() ? logo.url.trim() : undefined;
}

function setMainSequenceMarketsBinding(
  value: AdapterFromApiPublicConfig,
  enabled: boolean,
): AdapterFromApiPublicConfig["applicationBindings"] {
  const otherBindings = readApplicationBindings(value).filter(
    (binding) => !isMainSequenceMarketsBinding(binding),
  );

  if (!enabled) {
    return otherBindings;
  }

  return [
    ...otherBindings,
    {
      appId: MAIN_SEQUENCE_MARKETS_APP_ID,
      role: MAIN_SEQUENCE_MARKETS_API_BINDING_ROLE,
    },
  ];
}

function readTransportMode(value: AdapterFromApiPublicConfig): AdapterFromApiTransportMode {
  return value.transportMode === "direct" ? "direct" : "backend";
}

function readApiRootUrl(
  value: AdapterFromApiPublicConfig,
  transportMode: AdapterFromApiTransportMode,
) {
  if (transportMode === "direct") {
    return normalizeApiRootUrl(
      value.debugApiBaseUrl ?? value.contractDefinitionUrl ?? value.openApiUrl ?? "",
    );
  }

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
  expectedKind = "object",
  help,
  label,
  onChange,
  value,
}: {
  disabled?: boolean;
  expectedKind?: "array" | "object";
  help: string;
  label: string;
  onChange: (value: unknown | undefined) => void;
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

      if (expectedKind === "object" && !isRecord(parsed)) {
        throw new Error("JSON value must be an object.");
      }

      if (expectedKind === "array" && !Array.isArray(parsed)) {
        throw new Error("JSON value must be an array.");
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
  connectionInstance,
  disabled = false,
  onChange,
  value,
}: ConnectionConfigEditorProps<AdapterFromApiPublicConfig>) {
  const [directDiscoveryState, setDirectDiscoveryState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ status: "idle" });
  const transportMode = readTransportMode(value);
  const isDirectMode = transportMode === "direct";
  const compiledContract = readContract(value);
  const configVariables = compiledContract?.configVariables ?? [];
  const secretVariables = compiledContract?.secretVariables ?? [];
  const operationCount = compiledContract?.availableOperations?.length ?? 0;
  const configValues = isRecord(value.configValues) ? value.configValues : {};
  const apiRootUrl = readApiRootUrl(value, transportMode);
  const [apiRootDraft, setApiRootDraft] = useState(apiRootUrl);
  const derivedDiscoveryConfig = buildDerivedDiscoveryConfig(apiRootDraft, transportMode);
  const boundToMainSequenceMarkets = hasMainSequenceMarketsBinding(value);
  const directDiscoveryCacheEntry = connectionInstance?.id
    ? readAdapterFromApiDirectDiscoverySessionCache(connectionInstance.id, {
        apiBaseUrl: apiRootDraft,
        contractVersion: value.contractVersion,
      })
    : undefined;

  useEffect(() => {
    setApiRootDraft(apiRootUrl);
  }, [apiRootUrl, transportMode]);

  function updateConfigValue(key: string, nextValue: unknown) {
    updateConfig(value, onChange, {
      configValues: {
        ...configValues,
        [key]: nextValue,
      },
    });
  }

  function selectTransportMode(nextMode: AdapterFromApiTransportMode) {
    const nextRoot =
      nextMode === "direct"
        ? value.debugApiBaseUrl ?? value.apiBaseUrl ?? apiRootUrl
        : value.apiBaseUrl ?? value.debugApiBaseUrl ?? apiRootUrl;

    setDirectDiscoveryState({ status: "idle" });
    setApiRootDraft(nextRoot ?? "");
    updateConfig(value, onChange, {
      transportMode: nextMode,
      ...buildDerivedDiscoveryConfig(nextRoot ?? "", nextMode),
    });
  }

  function applyDirectDiscoveryResult(
    result: AdapterFromApiDirectDiscoveryResult,
    input: {
      source: "cache" | "remote";
    },
  ) {
    const operationLabel = `${result.compiledContract.availableOperations?.length ?? 0} operation${
      result.compiledContract.availableOperations?.length === 1 ? "" : "s"
    }`;
    const logoUrl = readCompiledContractLogoUrl(result.compiledContract);

    updateConfig(value, onChange, {
      transportMode: "direct",
      debugApiBaseUrl: result.apiBaseUrl,
      contractDefinitionUrl: result.contractDefinitionUrl,
      openApiUrl: result.openApiUrl,
      compiledContract: result.compiledContract,
      compiledContractSource: "direct",
      compiledContractSourceUrl: result.contractDefinitionUrl,
    });
    setDirectDiscoveryState({
      status: "success",
      message:
        input.source === "cache"
          ? `Loaded cached direct contract with ${operationLabel}${
              logoUrl ? " and OpenAPI logo" : ""
            }. Use Discover contract to fetch the API again.`
          : `Discovered ${operationLabel}${
              logoUrl
                ? " and OpenAPI logo."
                : ". No OpenAPI info.x-logo was readable from the derived OpenAPI URL."
            }`,
    });
  }

  function loadCachedDirectDiscovery() {
    if (directDiscoveryCacheEntry) {
      applyDirectDiscoveryResult(directDiscoveryCacheEntry, { source: "cache" });
    }
  }

  async function runDirectDiscovery() {
    setDirectDiscoveryState({ status: "loading" });

    try {
      const result = await discoverAdapterFromApiDirectContract(apiRootDraft);

      writeAdapterFromApiDirectDiscoverySessionCache(connectionInstance?.id, result);
      applyDirectDiscoveryResult(result, { source: "remote" });
    } catch (error) {
      setDirectDiscoveryState({
        status: "error",
        message: error instanceof Error ? error.message : "Direct discovery failed.",
      });
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Field
          label="Transport mode"
          help="Backend proxy mode sends queries through Command Center. Direct debug mode sends browser requests to the debug API root with credentials omitted and no Command Center-managed auth."
        >
          <Select
            value={transportMode}
            onChange={(event) =>
              selectTransportMode(event.target.value === "direct" ? "direct" : "backend")
            }
            disabled={disabled}
          >
            <option value="backend">Backend proxy</option>
            <option value="direct">Direct debug</option>
          </Select>
        </Field>
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-xs leading-5 text-muted-foreground">
          {isDirectMode
            ? "Direct debug mode is a transport override for local development. It keeps the same connection id, query payloads, compiled contract, and output frames, but browser fetch calls the debug API root directly with no auth."
            : "Backend proxy mode is the shared production transport. Command Center discovers the contract, applies URL policy, stores configured secrets, and executes queries through the backend adapter."}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Field
          label={isDirectMode ? "Direct debug API root URL" : "Backend API root URL"}
          required
          help={
            isDirectMode
              ? "Browser-only debug API root such as http://127.0.0.1:8021. Direct mode fetches this root from the browser with credentials omitted."
              : "Backend-routed API root URL. This editor derives the OpenAPI URL as /openapi.json and the Command Center contract URL as /.well-known/command-center/connection-contract."
          }
        >
          <div className="space-y-2">
            <Input
              value={apiRootDraft}
              onChange={(event) => setApiRootDraft(event.target.value)}
              onBlur={() =>
                updateConfig(
                  value,
                  onChange,
                  buildDerivedDiscoveryConfig(apiRootDraft, transportMode),
                )
              }
              disabled={disabled}
              placeholder={isDirectMode ? "http://127.0.0.1:8021" : "https://api.example.com"}
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
            {isDirectMode ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={
                    disabled || directDiscoveryState.status === "loading" || !apiRootDraft.trim()
                  }
                  onClick={() => void runDirectDiscovery()}
                >
                  {directDiscoveryState.status === "loading"
                    ? compiledContract
                      ? "Refreshing..."
                      : "Discovering..."
                    : compiledContract
                      ? "Refresh contract"
                      : "Discover contract"}
                </Button>
                {directDiscoveryCacheEntry ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || directDiscoveryState.status === "loading"}
                    onClick={loadCachedDirectDiscovery}
                  >
                    Use cached contract
                  </Button>
                ) : null}
                {directDiscoveryState.message ? (
                  <span
                    className={
                      directDiscoveryState.status === "error"
                        ? "text-xs text-destructive"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {directDiscoveryState.message}
                  </span>
                ) : null}
              </div>
            ) : null}
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
          help="Backend timeout for upstream API calls in milliseconds. Direct debug mode bypasses the backend and does not use this value."
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
          help="Backend result cache policy for successful safe API operations. Direct debug mode bypasses backend caching."
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
          help="Backend cache lifetime for successful API operation responses in milliseconds. Direct debug mode bypasses backend caching."
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
          help="When enabled, the backend shares one in-flight request for identical safe API operations. Direct debug mode bypasses backend dedupe."
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Field
          label="Main Sequence Markets binding"
          help="Marks this data source as the Main Sequence Markets primary API connection. Use Organization Admin > Main Sequence Markets when you need duplicate bindings cleared from other data sources."
        >
          <Select
            value={boundToMainSequenceMarkets ? "bound" : "not-bound"}
            onChange={(event) =>
              updateConfig(value, onChange, {
                applicationBindings: setMainSequenceMarketsBinding(
                  value,
                  event.target.value === "bound",
                ),
              })
            }
            disabled={disabled}
          >
            <option value="not-bound">Not bound</option>
            <option value="bound">Bind to Main Sequence Markets</option>
          </Select>
        </Field>
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-xs leading-5 text-muted-foreground">
          <div className="font-medium text-foreground">
            {boundToMainSequenceMarkets ? "Bound" : "Not bound"}
          </div>
          <div className="mt-1">
            This stores the Main Sequence Markets marker on this Adapter From API data source. It
            does not create a new connection type.
          </div>
        </div>
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
            {value.compiledContractSource ? ` · ${value.compiledContractSource} discovery` : ""}
          </div>
        ) : (
          <div className="mt-1">
            {isDirectMode
              ? "No compiled contract is present yet. Use Discover contract to fetch the well-known contract from the browser and save a sanitized compiledContract snapshot on this connection."
              : "No compiled contract is present yet. Backend support must fetch the contract definition, validate the derived OpenAPI and well-known contract URLs, and save a sanitized compiledContract snapshot on this connection."}
          </div>
        )}
      </section>

      {configVariables.length > 0 ? (
        <section className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Dynamic public variables</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              These fields come from the compiled API contract. The backend validates them when
              saving; direct debug execution validates them in the browser before dispatch.
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
          <div className="font-medium">Secret variables declared</div>
          <div className="mt-1">
            {isDirectMode
              ? "Direct debug mode never injects Command Center-managed secrets or auth headers. Switch to backend proxy mode to use secret variables: "
              : "Enter secret values in the Secrets section as a JSON object keyed by contract secret variable name: "}
            {secretVariables.map((field) => field.key).join(", ")}.
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
            onChange={(configValues) =>
              updateConfig(value, onChange, {
                configValues: configValues as Record<string, unknown> | undefined,
              })
            }
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
