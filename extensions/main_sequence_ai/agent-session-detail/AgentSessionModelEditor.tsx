import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Loader2 } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { Select } from "@/components/ui/select";
import type {
  AvailableChatModelOption,
  AvailableChatProviderOption,
} from "../runtime/available-models-api";
import { fetchAvailableRunConfigOptions } from "../runtime/available-models-api";
import { patchAgentSessionModelConfig } from "../runtime/agent-sessions-api";
import type { AgentSessionDetailSnapshot } from "./model";
import { SessionField, SessionSection } from "./sessionDetailUi";

function normalizeCatalogKey(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

function findProviderValueBySessionProvider(
  providers: readonly AvailableChatProviderOption[],
  provider: string | null | undefined,
) {
  const normalizedProvider = normalizeCatalogKey(provider);

  if (!normalizedProvider) {
    return null;
  }

  const match = providers.find((entry) => normalizeCatalogKey(entry.value) === normalizedProvider);
  return match?.value ?? null;
}

function findModelIdBySessionModel(
  models: readonly AvailableChatModelOption[],
  {
    model,
    provider,
  }: {
    model: string | null | undefined;
    provider?: string | null;
  },
) {
  const normalizedModel = normalizeCatalogKey(model);

  if (!normalizedModel) {
    return null;
  }

  const normalizedProvider = normalizeCatalogKey(provider);
  const scopedModels = normalizedProvider
    ? models.filter((entry) => normalizeCatalogKey(entry.provider) === normalizedProvider)
    : models;
  const match =
    scopedModels.find((entry) => normalizeCatalogKey(entry.value) === normalizedModel) ??
    scopedModels.find((entry) => normalizeCatalogKey(entry.label) === normalizedModel);

  return match?.id ?? null;
}

export function AgentSessionModelEditor({
  detail,
  refreshSessionDetail,
  refreshSessionInsights,
}: {
  detail: AgentSessionDetailSnapshot | null;
  refreshSessionDetail: () => void;
  refreshSessionInsights: () => void;
}) {
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const [availableModels, setAvailableModels] = useState<AvailableChatModelOption[]>([]);
  const [availableModelsError, setAvailableModelsError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<AvailableChatProviderOption[]>([]);
  const [isLoadingAvailableModels, setIsLoadingAvailableModels] = useState(false);
  const [selectedProviderValue, setSelectedProviderValue] = useState<string | null>(null);
  const [selectedModelValue, setSelectedModelValue] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const availableModelsRequestRef = useRef<AbortController | null>(null);
  const sessionModelPatchRequestRef = useRef<AbortController | null>(null);
  const core = detail?.core ?? null;
  const providerOptions = useMemo(
    () => availableProviders.map((entry) => ({ label: entry.label, value: entry.value })),
    [availableProviders],
  );
  const modelOptions = useMemo(() => {
    const scopedModels = selectedProviderValue
      ? availableModels.filter((entry) => entry.provider === selectedProviderValue)
      : availableModels;

    return scopedModels.map((entry) => {
      const unusable = Boolean(entry.auth?.required && !entry.auth?.usable);

      return {
        disabled: unusable,
        label: unusable ? `${entry.label} (Not authenticated)` : entry.label,
        provider: entry.provider,
        value: entry.id,
        modelValue: entry.value,
      };
    });
  }, [availableModels, selectedProviderValue]);
  const selectedProvider = selectedProviderValue ?? providerOptions[0]?.value ?? "";
  const selectedModel = selectedModelValue ?? modelOptions[0]?.value ?? "";
  const showModelControls =
    isLoadingAvailableModels ||
    Boolean(availableModelsError) ||
    Boolean(updateError) ||
    providerOptions.length > 0 ||
    modelOptions.length > 0;

  useEffect(() => {
    availableModelsRequestRef.current?.abort();
    const controller = new AbortController();
    availableModelsRequestRef.current = controller;
    setIsLoadingAvailableModels(true);
    setAvailableModelsError(null);

    void (async () => {
      try {
        const options = await fetchAvailableRunConfigOptions({
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        setAvailableModels(options.models);
        setAvailableProviders(options.providers);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setAvailableModels([]);
        setAvailableProviders([]);
        setAvailableModelsError(
          error instanceof Error ? error.message : "Failed to load available models.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingAvailableModels(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [sessionToken, sessionTokenType]);

  useEffect(() => {
    if (!core || availableProviders.length === 0 || availableModels.length === 0) {
      return;
    }

    const matchedProviderValue = findProviderValueBySessionProvider(
      availableProviders,
      core.llmProvider,
    );
    const matchedModelId = findModelIdBySessionModel(availableModels, {
      model: core.llmModel,
      provider: matchedProviderValue ?? core.llmProvider,
    });
    const matchedModel = availableModels.find((model) => model.id === matchedModelId) ?? null;
    const fallbackProvider = matchedProviderValue ?? availableProviders[0]?.value ?? null;
    const fallbackModels = fallbackProvider
      ? availableModels.filter((model) => model.provider === fallbackProvider)
      : availableModels;
    const fallbackModelId = fallbackModels[0]?.id ?? availableModels[0]?.id ?? null;

    setSelectedProviderValue(matchedProviderValue ?? fallbackProvider);
    setSelectedModelValue(matchedModel?.id ?? fallbackModelId);
  }, [availableModels, availableProviders, core]);

  const persistSelectedSessionModelConfig = useCallback(
    async ({ model, provider }: { model: string | null; provider: string | null }) => {
      const normalizedProvider = provider?.trim();
      const normalizedModel = model?.trim();
      const sessionId = detail?.sessionId ?? null;

      if (!sessionId || !normalizedProvider || !normalizedModel) {
        return;
      }

      sessionModelPatchRequestRef.current?.abort();
      const controller = new AbortController();
      sessionModelPatchRequestRef.current = controller;
      setIsUpdating(true);
      setUpdateError(null);

      try {
        await patchAgentSessionModelConfig({
          llmModel: normalizedModel,
          llmProvider: normalizedProvider,
          sessionId,
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        refreshSessionDetail();
        refreshSessionInsights();
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setUpdateError(
          error instanceof Error
            ? `Failed to update session model: ${error.message}`
            : "Failed to update session model.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsUpdating(false);
        }

        if (sessionModelPatchRequestRef.current === controller) {
          sessionModelPatchRequestRef.current = null;
        }
      }
    },
    [detail?.sessionId, refreshSessionDetail, refreshSessionInsights, sessionToken, sessionTokenType],
  );

  if (!core || !showModelControls) {
    return null;
  }

  return (
    <SessionSection title="Session Model">
      {isLoadingAvailableModels ? (
        <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading available models
        </div>
      ) : null}

      {!isLoadingAvailableModels && availableModelsError ? (
        <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
          <div className="font-medium">Failed to load available models.</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">
            {availableModelsError}
          </div>
        </div>
      ) : null}

      {updateError ? (
        <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
          <div className="font-medium">Failed to update session model.</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">{updateError}</div>
        </div>
      ) : null}

      {!isLoadingAvailableModels &&
      !availableModelsError &&
      (providerOptions.length > 0 || modelOptions.length > 0) ? (
        <div className="grid gap-4 md:grid-cols-2">
          {providerOptions.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Provider</div>
              <Select
                aria-label="Provider"
                className="h-10 w-full bg-card/70"
                disabled={isUpdating}
                value={selectedProvider}
                onChange={(event) => {
                  const provider = event.target.value || null;
                  const currentModel =
                    availableModels.find((model) => model.id === selectedModelValue) ?? null;
                  const nextModel =
                    currentModel?.provider === provider
                      ? currentModel
                      : availableModels.find((model) => model.provider === provider) ?? null;

                  setSelectedProviderValue(provider);
                  setSelectedModelValue(nextModel?.id ?? null);
                  void persistSelectedSessionModelConfig({
                    provider,
                    model: nextModel?.value ?? currentModel?.value ?? null,
                  });
                }}
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {modelOptions.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Model</div>
              <Select
                aria-label="Model"
                className="h-10 w-full bg-card/70"
                disabled={isUpdating}
                value={selectedModel}
                onChange={(event) => {
                  const modelId = event.target.value || null;
                  const selectedOption = availableModels.find((model) => model.id === modelId) ?? null;

                  setSelectedModelValue(modelId);
                  if (selectedOption?.provider && selectedOption.provider !== selectedProviderValue) {
                    setSelectedProviderValue(selectedOption.provider);
                  }
                  void persistSelectedSessionModelConfig({
                    provider: selectedOption?.provider ?? selectedProviderValue,
                    model: selectedOption?.value ?? null,
                  });
                }}
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <SessionField label="Current Provider" value={core.llmProvider} />
        <SessionField label="Current Model" value={core.llmModel} mono />
        <SessionField label="Engine" value={core.engineName} />
      </div>
    </SessionSection>
  );
}
