import { useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCcw } from "lucide-react";

import type { AppShellMenuRenderProps } from "@/apps/types";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import {
  buildMainSequenceCostEstimateResources,
  MainSequenceResourceField,
  MainSequenceResourceRequirementsSection,
} from "../../../main_sequence/common/components/MainSequenceResourceRequirementsSection";
import {
  fetchCodingAgentDeploymentDefaults,
  formatMainSequenceError,
  saveCodingAgentDeploymentDefaults,
} from "../../../main_sequence/common/api";
import { AutomationDitherWaveLayer } from "../../components/AutomationButton";
import { buildMainSequenceAiAssistantUrl } from "../../runtime/assistant-endpoint";
import { fetchAssistantHealth } from "../../runtime/assistant-health-api";
import { fetchModelCatalog, type ModelCatalogItem } from "../../runtime/model-catalog-api";
import { useAssistantRuntimeAccess } from "./useAssistantRuntimeAccess";

function createDefaultAutomationComputeState() {
  return {
    cpuRequest: "500m",
    cpuLimit: "2000m",
    memoryRequest: "1Gi",
    memoryLimit: "4Gi",
    gpuRequest: "",
    gpuType: "",
  };
}

function normalizeCatalogKey(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

function normalizeConfigValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatReasoningLabel(value: string) {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function isModelUsable(model: ModelCatalogItem | null) {
  return model ? model.auth?.usable !== false : false;
}

function getModelReasoningOptions(model: ModelCatalogItem | null) {
  if (!model?.capabilities.runConfig.reasoning_effort.supported) {
    return [];
  }

  const values = model.capabilities.runConfig.reasoning_effort.values;
  const seen = new Set<string>();

  return values
    .filter((value) => {
      const normalized = normalizeCatalogKey(value);
      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    })
    .map((value) => ({
      label: formatReasoningLabel(value),
      value,
    }));
}

interface DeploymentDefaultsModelOption {
  disabled: boolean;
  label: string;
  model: ModelCatalogItem | null;
  value: string;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/8 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="shrink-0 text-sm text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words text-right text-sm font-medium text-topbar-foreground">
        {value}
      </div>
    </div>
  );
}

function getHealthStatusClassName(ok: boolean) {
  return ok
    ? "border-success/25 bg-success/10 text-success"
    : "border-danger/30 bg-danger/10 text-danger";
}

export function AgentSettingsSection(_props: AppShellMenuRenderProps) {
  const { toast } = useToast();
  const assistantRuntime = useAssistantRuntimeAccess();
  const assistantEndpoint = assistantRuntime.assistantEndpoint;
  const sessionToken = assistantRuntime.sessionToken;
  const sessionTokenType = assistantRuntime.sessionTokenType;
  const sessionUserUid = useAuthStore((state) => state.session?.user.uid ?? null);
  const hasAssistantRuntimeEndpoint = assistantRuntime.isReady && Boolean(assistantEndpoint);
  const hasSessionUserUid = Boolean(sessionUserUid);
  const [globalAutomationEnabled, setGlobalAutomationEnabled] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModelValue, setSelectedModelValue] = useState("");
  const [selectedThinking, setSelectedThinking] = useState("");
  const [computeState, setComputeState] = useState(() => createDefaultAutomationComputeState());
  const hydratedDefaultsKeyRef = useRef<string | null>(null);

  const healthQuery = useQuery({
    queryKey: ["main-sequence-ai", "assistant-health", assistantEndpoint, sessionToken],
    enabled: hasAssistantRuntimeEndpoint,
    queryFn: ({ signal }) => {
      if (!assistantEndpoint) {
        throw new Error("Assistant runtime endpoint is not resolved.");
      }

      return fetchAssistantHealth({
        assistantEndpoint,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      });
    },
  });

  const modelCatalogQuery = useQuery({
    queryKey: [
      "main-sequence-ai",
      "agent-settings",
      "deployment-defaults-model-catalog",
      assistantEndpoint,
      sessionToken,
      sessionUserUid,
    ],
    enabled: globalAutomationEnabled && hasAssistantRuntimeEndpoint && hasSessionUserUid,
    queryFn: ({ signal }) => {
      if (!assistantEndpoint) {
        throw new Error("Assistant runtime endpoint is not resolved.");
      }

      return fetchModelCatalog({
        assistantEndpoint,
        createdByUserUid: sessionUserUid,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      });
    },
    staleTime: 300_000,
  });

  const deploymentDefaultsQuery = useQuery({
    queryKey: ["main-sequence-ai", "agent-settings", "coding-agent-deployment-defaults", sessionToken],
    enabled: Boolean(sessionToken),
    queryFn: () => fetchCodingAgentDeploymentDefaults(),
    staleTime: 30_000,
  });

  const modelCatalog = modelCatalogQuery.data ?? [];
  const providerOptions = useMemo(() => {
    const providers = new Map<string, string>();

    modelCatalog.forEach((model) => {
      if (!providers.has(model.provider)) {
        providers.set(model.provider, model.provider);
      }
    });

    if (selectedProvider && !providers.has(selectedProvider)) {
      providers.set(selectedProvider, `${selectedProvider} (current)`);
    }

    return [...providers.entries()].map(([value, label]) => ({ label, value }));
  }, [modelCatalog, selectedProvider]);
  const modelOptions = useMemo(() => {
    const options: DeploymentDefaultsModelOption[] = modelCatalog
      .filter(
        (model) =>
          !selectedProvider ||
          normalizeCatalogKey(model.provider) === normalizeCatalogKey(selectedProvider),
      )
      .map((model) => {
        const usable = isModelUsable(model);

        return {
          disabled: !usable,
          label: usable ? model.label : `${model.label} (Not authenticated)`,
          model,
          value: model.model,
        };
      });

    if (
      selectedProvider &&
      selectedModelValue &&
      !options.some(
        (option) =>
          option.model &&
          normalizeCatalogKey(option.model.provider) === normalizeCatalogKey(selectedProvider) &&
          normalizeCatalogKey(option.model.model) === normalizeCatalogKey(selectedModelValue),
      )
    ) {
      options.unshift({
        disabled: false,
        label: `${selectedModelValue} (current)`,
        model: null,
        value: selectedModelValue,
      });
    }

    return options;
  }, [modelCatalog, selectedModelValue, selectedProvider]);
  const selectedModel =
    modelOptions.find((option) => option.value === selectedModelValue)?.model ?? null;
  const reasoningOptions = useMemo(() => {
    const options = getModelReasoningOptions(selectedModel);
    const hasSelectedThinking =
      selectedThinking &&
      options.some((option) => normalizeCatalogKey(option.value) === normalizeCatalogKey(selectedThinking));

    return [
      {
        label: "Default",
        value: "",
      },
      ...(selectedThinking && !hasSelectedThinking
        ? [{ label: `${formatReasoningLabel(selectedThinking)} (current)`, value: selectedThinking }]
        : []),
      ...options,
    ];
  }, [selectedModel, selectedThinking]);
  const costEstimateResources = useMemo(
    () =>
      buildMainSequenceCostEstimateResources({
        cpuRequest: computeState.cpuRequest,
        gpuRequest: computeState.gpuRequest,
        gpuType: computeState.gpuType,
        memoryRequest: computeState.memoryRequest,
        spot: false,
      }),
    [computeState.cpuRequest, computeState.gpuRequest, computeState.gpuType, computeState.memoryRequest],
  );
  const defaultsReady = Boolean(
    globalAutomationEnabled &&
      selectedProvider.trim() &&
      selectedModelValue.trim() &&
      (!selectedModel || isModelUsable(selectedModel)) &&
      computeState.cpuRequest.trim() &&
      computeState.cpuLimit.trim() &&
      computeState.memoryRequest.trim() &&
      computeState.memoryLimit.trim(),
  );

  const saveDefaultsMutation = useMutation({
    mutationFn: (input?: { globalActive?: boolean }) => {
      const nextGlobalActive = input?.globalActive ?? globalAutomationEnabled;

      if (nextGlobalActive && !selectedProvider.trim()) {
        throw new Error("Select an LLM provider before confirming automation defaults.");
      }

      if (nextGlobalActive && !selectedModelValue.trim()) {
        throw new Error("Select an LLM model before confirming automation defaults.");
      }

      if (nextGlobalActive && selectedModel && !isModelUsable(selectedModel)) {
        throw new Error("Select an authenticated model before confirming automation defaults.");
      }

      return saveCodingAgentDeploymentDefaults({
        global_active: nextGlobalActive,
        llm_provider: selectedProvider.trim(),
        llm_model: selectedModelValue.trim(),
        llm_thinking: selectedThinking.trim(),
        cpu_request: computeState.cpuRequest.trim() || "500m",
        cpu_limit: computeState.cpuLimit.trim() || "2000m",
        memory_request: computeState.memoryRequest.trim() || "1Gi",
        memory_limit: computeState.memoryLimit.trim() || "4Gi",
        gpu_request: computeState.gpuRequest.trim(),
        gpu_type: computeState.gpuType.trim(),
      });
    },
    onSuccess: (record) => {
      hydratedDefaultsKeyRef.current = null;
      void deploymentDefaultsQuery.refetch();
      toast({
        variant: "success",
        title: record.global_active === false ? "Agent automation disabled" : "Agent automation defaults saved",
        description:
          record.global_active === false
            ? "Automatic deployment defaults are now disabled."
            : "All agent deployments will use these defaults when automation is enabled.",
      });
    },
    onError: (error, variables) => {
      if (variables?.globalActive === false) {
        setGlobalAutomationEnabled(true);
      }

      toast({
        variant: "error",
        title: "Agent automation defaults failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  useEffect(() => {
    const record = deploymentDefaultsQuery.data;

    if (!record) {
      return;
    }

    const nextComputeState = {
      cpuRequest: normalizeConfigValue(record.cpu_request, "500m"),
      cpuLimit: normalizeConfigValue(record.cpu_limit, "2000m"),
      memoryRequest: normalizeConfigValue(record.memory_request, "1Gi"),
      memoryLimit: normalizeConfigValue(record.memory_limit, "4Gi"),
      gpuRequest: normalizeConfigValue(record.gpu_request),
      gpuType: normalizeConfigValue(record.gpu_type),
    };
    const hydrationKey = [
      record.uid ?? "",
      record.global_active === true ? "active" : "inactive",
      normalizeConfigValue(record.llm_provider),
      normalizeConfigValue(record.llm_model),
      normalizeConfigValue(record.llm_thinking),
      nextComputeState.cpuRequest,
      nextComputeState.cpuLimit,
      nextComputeState.memoryRequest,
      nextComputeState.memoryLimit,
      nextComputeState.gpuRequest,
      nextComputeState.gpuType,
    ].join("::");

    if (hydratedDefaultsKeyRef.current === hydrationKey) {
      return;
    }

    setGlobalAutomationEnabled(record.global_active === true);
    setSelectedProvider(normalizeConfigValue(record.llm_provider));
    setSelectedModelValue(normalizeConfigValue(record.llm_model));
    setSelectedThinking(normalizeConfigValue(record.llm_thinking));
    setComputeState(nextComputeState);
    hydratedDefaultsKeyRef.current = hydrationKey;
  }, [deploymentDefaultsQuery.data]);

  useEffect(() => {
    if (!globalAutomationEnabled || providerOptions.length === 0) {
      return;
    }

    if (
      selectedProvider &&
      providerOptions.some(
        (provider) => normalizeCatalogKey(provider.value) === normalizeCatalogKey(selectedProvider),
      )
    ) {
      return;
    }

    setSelectedProvider(providerOptions[0]?.value ?? "");
  }, [globalAutomationEnabled, providerOptions, selectedProvider]);

  useEffect(() => {
    if (!globalAutomationEnabled || modelOptions.length === 0) {
      return;
    }

    if (selectedModelValue && modelOptions.some((option) => option.value === selectedModelValue)) {
      return;
    }

    const firstUsableModel = modelOptions.find((option) => !option.disabled) ?? modelOptions[0] ?? null;
    setSelectedModelValue(firstUsableModel?.value ?? "");
  }, [globalAutomationEnabled, modelOptions, selectedModelValue]);

  useEffect(() => {
    if (!globalAutomationEnabled) {
      return;
    }

    const selectedReasoningIsValid = reasoningOptions.some(
      (option) => option.value === selectedThinking,
    );

    if (selectedReasoningIsValid) {
      return;
    }

    setSelectedThinking("");
  }, [globalAutomationEnabled, reasoningOptions, selectedThinking]);

  const healthSnapshot = healthQuery.data ?? null;
  const healthEndpointUrl = assistantEndpoint
    ? buildMainSequenceAiAssistantUrl(assistantEndpoint, "/health")
    : null;
  const healthCapturedAt = formatTimestamp(healthSnapshot?.capturedAt ?? null);
  const settingsRefreshing =
    assistantRuntime.isLoading ||
    healthQuery.isFetching ||
    deploymentDefaultsQuery.isFetching;

  return (
    <div className="space-y-4 py-4">
      <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">Agents Settings</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Runtime diagnostics for Agents.
            </div>
            {assistantEndpoint ? (
              <div className="mt-2 break-all font-mono text-xs text-muted-foreground">
                Runtime root: {assistantEndpoint}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={settingsRefreshing}
              onClick={() => {
                if (!hasAssistantRuntimeEndpoint) {
                  void Promise.all([
                    assistantRuntime.refetch(),
                    deploymentDefaultsQuery.refetch(),
                  ]);
                  return;
                }

                void Promise.all([
                  assistantRuntime.refetch(),
                  healthQuery.refetch(),
                  deploymentDefaultsQuery.refetch(),
                ]);
              }}
            >
              {settingsRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <section
        className={
          globalAutomationEnabled
            ? "main-sequence-ai-automation-panel main-sequence-ai-automation-panel--active"
            : "main-sequence-ai-automation-panel"
        }
      >
        {globalAutomationEnabled ? (
          <AutomationDitherWaveLayer className="main-sequence-ai-automation-panel__wave" />
        ) : null}
        <div className="main-sequence-ai-automation-panel__content">
          <button
            type="button"
            role="switch"
            aria-checked={globalAutomationEnabled}
            aria-label="Toggle automation for all agents"
            className="main-sequence-ai-automation-toggle"
            disabled={deploymentDefaultsQuery.isLoading || saveDefaultsMutation.isPending}
            onClick={() => {
              const nextEnabled = !globalAutomationEnabled;
              setGlobalAutomationEnabled(nextEnabled);

              if (!nextEnabled) {
                saveDefaultsMutation.mutate({ globalActive: false });
              }
            }}
          >
            <span className="main-sequence-ai-automation-toggle__track">
              <span className="main-sequence-ai-automation-toggle__thumb" />
            </span>
          </button>
          <div className="main-sequence-ai-automation-panel__copy">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Agent deployment automation
            </div>
            <div className="mt-1 text-sm font-medium text-topbar-foreground">
              Automate All Agents
            </div>
            {globalAutomationEnabled ? (
              <p className="max-w-3xl text-sm text-muted-foreground">
                Configure defaults for automated coding-agent deployments.
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 px-4 py-4">
          <div className="rounded-[calc(var(--radius)-6px)] border border-primary/25 bg-primary/10 px-3 py-3 text-sm text-muted-foreground">
            When this is activated, all projects that have agent capabilities will be
            automatically deployed on each new version. You can always edit each individual
            project&apos;s resources after deployment.
          </div>
        </div>

        {globalAutomationEnabled ? (
          <div className="relative z-10 space-y-4 px-4 pb-4">
            <div className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Provider</label>
                <Select
                  aria-label="Default LLM provider"
                  className="h-11 w-full bg-card/70"
                  disabled={providerOptions.length === 0 || modelCatalogQuery.isLoading}
                  value={selectedProvider}
                  onChange={(event) => {
                    setSelectedProvider(event.target.value);
                    setSelectedModelValue("");
                    setSelectedThinking("");
                  }}
                >
                  {providerOptions.length === 0 ? (
                    <option value="">No providers available</option>
                  ) : null}
                  {providerOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Model</label>
                <Select
                  aria-label="Default LLM model"
                  className="h-11 w-full bg-card/70"
                  disabled={modelOptions.length === 0 || modelCatalogQuery.isLoading}
                  value={selectedModelValue}
                  onChange={(event) => {
                    setSelectedModelValue(event.target.value);
                    setSelectedThinking("");
                  }}
                >
                  {modelOptions.length === 0 ? (
                    <option value="">No models available</option>
                  ) : null}
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Reasoning</label>
                <Select
                  aria-label="Default LLM reasoning"
                  className="h-11 w-full bg-card/70"
                  disabled={!selectedModel || reasoningOptions.length <= 1}
                  value={selectedThinking}
                  onChange={(event) => {
                    setSelectedThinking(event.target.value);
                  }}
                >
                  {reasoningOptions.map((option) => (
                    <option key={option.value || "default"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {modelCatalogQuery.isLoading ? (
              <div className="flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-white/8 bg-black/10 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading model defaults
              </div>
            ) : null}

            {modelCatalogQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {modelCatalogQuery.error instanceof Error
                  ? modelCatalogQuery.error.message
                  : "Unable to load model defaults."}
              </div>
            ) : null}

            {selectedModel && !isModelUsable(selectedModel) ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-warning">
                Select an authenticated model before confirming automation defaults.
              </div>
            ) : null}

            <MainSequenceResourceRequirementsSection
              title="Default resources"
              description="Resources applied to automated coding-agent deployments."
              gridClassName="sm:grid-cols-2 xl:grid-cols-3"
              costEstimate={{ resources: costEstimateResources }}
              className="rounded-[calc(var(--radius)-8px)] border-white/10 bg-black/10 p-4"
            >
              <MainSequenceResourceField label="CPU request">
                <Input
                  value={computeState.cpuRequest}
                  onChange={(event) =>
                    setComputeState((current) => ({
                      ...current,
                      cpuRequest: event.target.value,
                    }))
                  }
                  placeholder="500m"
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="CPU limit">
                <Input
                  value={computeState.cpuLimit}
                  onChange={(event) =>
                    setComputeState((current) => ({
                      ...current,
                      cpuLimit: event.target.value,
                    }))
                  }
                  placeholder="2000m"
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="Memory request">
                <Input
                  value={computeState.memoryRequest}
                  onChange={(event) =>
                    setComputeState((current) => ({
                      ...current,
                      memoryRequest: event.target.value,
                    }))
                  }
                  placeholder="1Gi"
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="Memory limit">
                <Input
                  value={computeState.memoryLimit}
                  onChange={(event) =>
                    setComputeState((current) => ({
                      ...current,
                      memoryLimit: event.target.value,
                    }))
                  }
                  placeholder="4Gi"
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="GPU request">
                <Input
                  value={computeState.gpuRequest}
                  onChange={(event) =>
                    setComputeState((current) => ({
                      ...current,
                      gpuRequest: event.target.value,
                    }))
                  }
                  placeholder=""
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="GPU type">
                <Input
                  value={computeState.gpuType}
                  onChange={(event) =>
                    setComputeState((current) => ({
                      ...current,
                      gpuType: event.target.value,
                    }))
                  }
                  placeholder=""
                />
              </MainSequenceResourceField>
            </MainSequenceResourceRequirementsSection>

            <div className="flex justify-start">
              <Button
                type="button"
                disabled={!defaultsReady || saveDefaultsMutation.isPending}
                onClick={() => {
                  saveDefaultsMutation.mutate({ globalActive: true });
                }}
              >
                {saveDefaultsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Confirm
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {deploymentDefaultsQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading agent deployment defaults
        </div>
      ) : null}

      {deploymentDefaultsQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-4px)] border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {formatMainSequenceError(deploymentDefaultsQuery.error)}
        </div>
      ) : null}

      {assistantRuntime.isLoading ? (
        <div className="flex items-center gap-2 rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Resolving Command Center runtime access
        </div>
      ) : null}

      {assistantRuntime.isError ? (
        <div className="rounded-[calc(var(--radius)-4px)] border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {assistantRuntime.error instanceof Error
            ? assistantRuntime.error.message
            : "Unable to resolve Command Center runtime access."}
        </div>
      ) : null}

      <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">Health endpoint</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Raw response from <span className="font-mono">GET /health</span> on the assistant runtime.
            </div>
            {healthEndpointUrl ? (
              <div className="mt-2 break-all font-mono text-xs text-muted-foreground">
                {healthEndpointUrl}
              </div>
            ) : null}
          </div>
          {healthSnapshot ? (
            <div
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getHealthStatusClassName(healthSnapshot.ok)}`}
            >
              {healthSnapshot.status} {healthSnapshot.statusText || (healthSnapshot.ok ? "OK" : "Error")}
            </div>
          ) : null}
        </div>

        {healthQuery.isLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading health endpoint
          </div>
        ) : null}

        {healthQuery.isError ? (
          <div className="mt-4 rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {healthQuery.error instanceof Error
              ? healthQuery.error.message
              : "Health endpoint is unavailable right now."}
          </div>
        ) : null}

        {healthSnapshot ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailRow label="URL" value={healthSnapshot.url || healthEndpointUrl || "/health"} />
              <DetailRow label="Captured" value={healthCapturedAt ?? healthSnapshot.capturedAt} />
              <DetailRow
                label="Content type"
                value={healthSnapshot.contentType || "not provided"}
              />
              <DetailRow label="Fetch state" value={healthSnapshot.ok ? "Healthy" : "Unhealthy"} />
            </div>
            <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-words rounded-[calc(var(--radius)-6px)] border border-white/8 bg-black/20 p-3 font-mono text-xs leading-6 text-topbar-foreground">
              {healthSnapshot.bodyText || "(empty response)"}
            </pre>
          </div>
        ) : null}
      </div>

    </div>
  );
}
