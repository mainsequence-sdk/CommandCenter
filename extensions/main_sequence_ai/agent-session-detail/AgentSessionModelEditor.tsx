import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Loader2 } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/button";
import { RunConfigFields } from "../components/RunConfigFields";
import type {
  AvailableChatModelOption,
  AvailableChatProviderOption,
} from "../runtime/available-models-api";
import {
  buildAvailableRunConfigCacheKey,
  fetchAvailableRunConfigOptions,
} from "../runtime/available-models-api";
import { patchAgentSessionModelConfig } from "../runtime/agent-sessions-api";
import { resolveMainSequenceAiAssistantEndpointForAgentType } from "../runtime/assistant-endpoint";
import {
  normalizeRunConfigKey,
  resolveRunConfigSelection,
} from "../runtime/run-config-selection";
import type { AgentSessionDetailSnapshot } from "./model";
import { SessionField, SessionSection } from "./sessionDetailUi";

function isAbortLikeError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.trim().toLowerCase().includes("abort");
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
  const sessionUserId = useAuthStore((state) => state.session?.user.uid ?? null);
  const [availableModels, setAvailableModels] = useState<AvailableChatModelOption[]>([]);
  const [availableModelsError, setAvailableModelsError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<AvailableChatProviderOption[]>([]);
  const [isLoadingAvailableModels, setIsLoadingAvailableModels] = useState(false);
  const [selectedProviderValue, setSelectedProviderValue] = useState<string | null>(null);
  const [selectedModelValue, setSelectedModelValue] = useState<string | null>(null);
  const [selectedThinkingValue, setSelectedThinkingValue] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const availableModelsRequestRef = useRef<AbortController | null>(null);
  const sessionModelPatchRequestRef = useRef<AbortController | null>(null);
  const core = detail?.core ?? null;
  const runConfigSelection = useMemo(
    () =>
      resolveRunConfigSelection({
        availableModels,
        availableProviders,
        currentModel: core?.llmModel ?? "",
        currentProvider: core?.llmProvider ?? "",
        currentThinking: core?.llmThinking ?? "",
        selectedModelId: selectedModelValue ?? "",
        selectedProvider: selectedProviderValue ?? "",
        selectedThinking: selectedThinkingValue ?? "",
      }),
    [
      availableModels,
      availableProviders,
      core?.llmModel,
      core?.llmProvider,
      core?.llmThinking,
      selectedModelValue,
      selectedProviderValue,
      selectedThinkingValue,
    ],
  );
  const showModelControls =
    isLoadingAvailableModels ||
    Boolean(availableModelsError) ||
    Boolean(updateError) ||
    runConfigSelection.providerOptions.length > 0 ||
    runConfigSelection.modelOptions.length > 0;
  const resolvedProvider = runConfigSelection.resolvedProvider.trim();
  const resolvedModel = runConfigSelection.resolvedModel.trim();
  const resolvedThinking = runConfigSelection.resolvedThinking.trim();
  const runConfigHasChanges =
    normalizeRunConfigKey(resolvedProvider) !== normalizeRunConfigKey(core?.llmProvider) ||
    normalizeRunConfigKey(resolvedModel) !== normalizeRunConfigKey(core?.llmModel) ||
    normalizeRunConfigKey(resolvedThinking) !== normalizeRunConfigKey(core?.llmThinking);
  const canUpdateSessionModel = Boolean(
    detail?.sessionId &&
      resolvedProvider &&
      resolvedModel &&
      runConfigSelection.selectedCatalogModelIsUsable &&
      runConfigHasChanges &&
      !isLoadingAvailableModels &&
      !availableModelsError &&
      !isUpdating,
  );

  useEffect(() => {
    availableModelsRequestRef.current?.abort();
    const controller = new AbortController();
    availableModelsRequestRef.current = controller;
    setIsLoadingAvailableModels(true);
    setAvailableModelsError(null);

    void (async () => {
      try {
        const options = await fetchAvailableRunConfigOptions({
          assistantEndpoint: resolveMainSequenceAiAssistantEndpointForAgentType(
            detail?.context.requestAgentType ?? null,
          ),
          cacheKey: buildAvailableRunConfigCacheKey({
            agentType: detail?.context.requestAgentType ?? null,
            userId: sessionUserId,
          }),
          createdByUserUid: sessionUserId,
          sessionId: detail?.sessionId ?? null,
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
        if (controller.signal.aborted || isAbortLikeError(error)) {
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
  }, [detail?.context.requestAgentType, detail?.sessionId, sessionToken, sessionTokenType, sessionUserId]);

  const persistSelectedSessionModelConfig = useCallback(
    async () => {
      const sessionId = detail?.sessionId ?? null;

      if (!sessionId || !resolvedProvider || !resolvedModel) {
        return;
      }

      sessionModelPatchRequestRef.current?.abort();
      const controller = new AbortController();
      sessionModelPatchRequestRef.current = controller;
      setIsUpdating(true);
      setUpdateError(null);

      try {
        await patchAgentSessionModelConfig({
          llmModel: resolvedModel,
          llmProvider: resolvedProvider,
          llmThinking: resolvedThinking,
          sessionId,
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        setSelectedProviderValue(null);
        setSelectedModelValue(null);
        setSelectedThinkingValue(null);
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
    [
      detail?.sessionId,
      refreshSessionDetail,
      refreshSessionInsights,
      resolvedModel,
      resolvedProvider,
      resolvedThinking,
      sessionToken,
      sessionTokenType,
    ],
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
      (runConfigSelection.providerOptions.length > 0 || runConfigSelection.modelOptions.length > 0) ? (
        <div className="space-y-4">
          <RunConfigFields
            disabled={isUpdating}
            selection={runConfigSelection}
            onProviderChange={(provider) => {
              const nextModel =
                availableModels
                  .filter(
                    (model) =>
                      normalizeRunConfigKey(model.provider) === normalizeRunConfigKey(provider),
                  )
                  .find((model) => !(model.auth?.required && !model.auth.usable)) ??
                availableModels.find(
                  (model) =>
                    normalizeRunConfigKey(model.provider) === normalizeRunConfigKey(provider),
                ) ??
                null;

              setSelectedProviderValue(provider);
              setSelectedModelValue(nextModel?.id ?? null);
              setSelectedThinkingValue(
                nextModel?.defaultReasoningEffort ?? nextModel?.reasoningEfforts[0]?.value ?? null,
              );
            }}
            onModelChange={(modelId) => {
              const nextModel = availableModels.find((model) => model.id === modelId) ?? null;

              setSelectedModelValue(modelId);
              if (nextModel?.provider) {
                setSelectedProviderValue(nextModel.provider);
              }
              setSelectedThinkingValue(
                nextModel?.defaultReasoningEffort ?? nextModel?.reasoningEfforts[0]?.value ?? null,
              );
            }}
            onThinkingChange={setSelectedThinkingValue}
          />

          {runConfigSelection.currentModelMissingFromCatalog ? (
            <div className="rounded-[calc(var(--radius)-8px)] border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning">
              The current session model is not in the available model catalog. Keeping the backend
              session configuration until you select a different model.
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={!canUpdateSessionModel}
              onClick={() => {
                void persistSelectedSessionModelConfig();
              }}
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Update Session Model
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <SessionField label="Current Provider" value={core.llmProvider} />
        <SessionField label="Current Model" value={core.llmModel} mono />
        <SessionField label="Current Thinking" value={core.llmThinking} />
        <SessionField label="Engine" value={core.engineName} />
      </div>
    </SessionSection>
  );
}
