import type {
  AvailableChatModelOption,
  AvailableChatProviderOption,
  AvailableChatReasoningEffortOption,
} from "./available-models-api";

export interface RunConfigModelSelectOption {
  disabled: boolean;
  label: string;
  modelValue: string;
  provider: string;
  value: string;
}

export interface RunConfigSelectionInput {
  availableModels: AvailableChatModelOption[];
  availableProviders: AvailableChatProviderOption[];
  currentModel?: string | null;
  currentProvider?: string | null;
  currentThinking?: string | null;
  selectedModelId?: string | null;
  selectedProvider?: string | null;
  selectedThinking?: string | null;
}

export function normalizeRunConfigKey(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

export function normalizeRunConfigValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function buildCurrentModelOptionId(provider: string, model: string) {
  return ["current", provider.trim(), model.trim()].join("::");
}

function findCatalogModel(
  availableModels: AvailableChatModelOption[],
  provider: string,
  model: string,
) {
  return (
    availableModels.find(
      (entry) =>
        normalizeRunConfigKey(entry.value) === normalizeRunConfigKey(model) &&
        normalizeRunConfigKey(entry.provider) === normalizeRunConfigKey(provider),
    ) ?? null
  );
}

export function resolveRunConfigSelection({
  availableModels,
  availableProviders,
  currentModel,
  currentProvider,
  currentThinking,
  selectedModelId,
  selectedProvider,
  selectedThinking,
}: RunConfigSelectionInput) {
  const normalizedCurrentProvider = normalizeRunConfigValue(currentProvider);
  const normalizedCurrentModel = normalizeRunConfigValue(currentModel);
  const normalizedCurrentThinking = normalizeRunConfigValue(currentThinking);
  const currentCatalogModel =
    normalizedCurrentProvider && normalizedCurrentModel
      ? findCatalogModel(availableModels, normalizedCurrentProvider, normalizedCurrentModel)
      : null;
  const currentModelOptionId =
    currentCatalogModel?.id ||
    (normalizedCurrentProvider && normalizedCurrentModel
      ? buildCurrentModelOptionId(normalizedCurrentProvider, normalizedCurrentModel)
      : "");
  const effectiveProvider =
    normalizeRunConfigValue(selectedProvider) || normalizedCurrentProvider;
  const effectiveModelId =
    normalizeRunConfigValue(selectedModelId) || currentModelOptionId;
  const effectiveThinking =
    normalizeRunConfigValue(selectedThinking) || normalizedCurrentThinking;
  const providerOptions = availableProviders.map((entry) => ({
    label: entry.label,
    value: entry.value,
  }));
  const hasCurrentProvider =
    normalizedCurrentProvider &&
    providerOptions.some(
      (entry) =>
        normalizeRunConfigKey(entry.value) === normalizeRunConfigKey(normalizedCurrentProvider),
    );

  if (normalizedCurrentProvider && !hasCurrentProvider) {
    providerOptions.unshift({
      label: `${normalizedCurrentProvider} (current)`,
      value: normalizedCurrentProvider,
    });
  }

  const scopedModels = effectiveProvider
    ? availableModels.filter(
        (entry) => normalizeRunConfigKey(entry.provider) === normalizeRunConfigKey(effectiveProvider),
      )
    : availableModels;
  const modelOptions: RunConfigModelSelectOption[] = scopedModels.map((entry) => {
    const unusable = Boolean(entry.auth?.required && !entry.auth.usable);

    return {
      disabled: unusable,
      label: unusable ? `${entry.label} (Not authenticated)` : entry.label,
      provider: entry.provider ?? "",
      value: entry.id,
      modelValue: entry.value,
    };
  });

  if (normalizedCurrentProvider && normalizedCurrentModel) {
    const selectedProviderMatchesCurrent =
      !effectiveProvider ||
      normalizeRunConfigKey(effectiveProvider) === normalizeRunConfigKey(normalizedCurrentProvider);
    const hasCurrentModel = scopedModels.some(
      (model) =>
        normalizeRunConfigKey(model.value) === normalizeRunConfigKey(normalizedCurrentModel) &&
        normalizeRunConfigKey(model.provider) === normalizeRunConfigKey(normalizedCurrentProvider),
    );

    if (selectedProviderMatchesCurrent && !hasCurrentModel) {
      modelOptions.unshift({
        disabled: false,
        label: `${normalizedCurrentModel} (current)`,
        provider: normalizedCurrentProvider,
        value: buildCurrentModelOptionId(normalizedCurrentProvider, normalizedCurrentModel),
        modelValue: normalizedCurrentModel,
      });
    }
  }

  const selectedModelOption =
    modelOptions.find((entry) => entry.value === effectiveModelId) ?? null;
  const selectedCatalogModel =
    availableModels.find((entry) => entry.id === effectiveModelId) ?? null;
  const reasoningOptions: AvailableChatReasoningEffortOption[] =
    selectedCatalogModel?.reasoningEfforts.length
      ? [...selectedCatalogModel.reasoningEfforts]
      : [];
  const hasSelectedThinking =
    effectiveThinking &&
    reasoningOptions.some(
      (entry) => normalizeRunConfigKey(entry.value) === normalizeRunConfigKey(effectiveThinking),
    );

  if (effectiveThinking && !hasSelectedThinking) {
    reasoningOptions.unshift({
      label: `${effectiveThinking} (current)`,
      value: effectiveThinking,
    });
  }

  const resolvedProvider =
    selectedCatalogModel?.provider?.trim() ||
    selectedModelOption?.provider?.trim() ||
    effectiveProvider ||
    normalizedCurrentProvider;
  const resolvedModel =
    selectedCatalogModel?.value.trim() ||
    selectedModelOption?.modelValue?.trim() ||
    normalizedCurrentModel;
  const resolvedThinking = effectiveThinking || normalizedCurrentThinking;
  const selectedCatalogModelIsUsable = !(
    selectedCatalogModel?.auth?.required && !selectedCatalogModel.auth.usable
  );
  const currentModelMissingFromCatalog = Boolean(
    normalizedCurrentProvider &&
      normalizedCurrentModel &&
      availableModels.length > 0 &&
      !findCatalogModel(availableModels, normalizedCurrentProvider, normalizedCurrentModel),
  );

  return {
    currentCatalogModel,
    currentModelMissingFromCatalog,
    currentModelOptionId,
    effectiveModelId,
    effectiveProvider,
    effectiveThinking,
    modelOptions,
    providerOptions,
    reasoningOptions,
    resolvedModel,
    resolvedProvider,
    resolvedThinking,
    selectedCatalogModel,
    selectedCatalogModelIsUsable,
    selectedModelOption,
  };
}
