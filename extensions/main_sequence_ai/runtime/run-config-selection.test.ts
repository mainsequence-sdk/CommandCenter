import { describe, expect, it } from "vitest";

import {
  parseCurrentModelOptionId,
  resolveRunConfigSelection,
} from "./run-config-selection";

describe("run config selection", () => {
  it("parses current model option ids", () => {
    expect(parseCurrentModelOptionId("current::openai-codex::gpt-5.3-codex-spark")).toEqual({
      provider: "openai-codex",
      model: "gpt-5.3-codex-spark",
    });
    expect(parseCurrentModelOptionId("gpt-5.3-codex-spark")).toBeNull();
  });

  it("renders fallback current models by model label instead of internal current id", () => {
    const selection = resolveRunConfigSelection({
      availableModels: [],
      availableProviders: [],
      currentModel: "current::openai-codex::gpt-5.3-codex-spark",
      currentProvider: "openai-codex",
    });

    expect(selection.resolvedProvider).toBe("openai-codex");
    expect(selection.resolvedModel).toBe("gpt-5.3-codex-spark");
    expect(selection.effectiveModelId).toBe("current::openai-codex::gpt-5.3-codex-spark");
    expect(selection.modelOptions).toEqual([
      {
        disabled: false,
        label: "gpt-5.3-codex-spark",
        modelValue: "gpt-5.3-codex-spark",
        provider: "openai-codex",
        value: "current::openai-codex::gpt-5.3-codex-spark",
      },
    ]);
  });

  it("hydrates stale current model option ids to catalog model ids when options arrive", () => {
    const selection = resolveRunConfigSelection({
      availableModels: [
        {
          auth: null,
          defaultReasoningEffort: "high",
          id: "openai-codex::catalog::gpt-5.3-codex-spark",
          label: "GPT-5.3 Codex Spark",
          provider: "openai-codex",
          reasoningEfforts: [
            {
              label: "High",
              value: "high",
            },
          ],
          source: "catalog",
          value: "gpt-5.3-codex-spark",
        },
      ],
      availableProviders: [
        {
          label: "OpenAI Codex",
          value: "openai-codex",
        },
      ],
      currentModel: "gpt-5.3-codex-spark",
      currentProvider: "openai-codex",
      selectedModelId: "current::openai-codex::gpt-5.3-codex-spark",
      selectedProvider: "openai-codex",
    });

    expect(selection.effectiveModelId).toBe("openai-codex::catalog::gpt-5.3-codex-spark");
    expect(selection.resolvedModel).toBe("gpt-5.3-codex-spark");
    expect(selection.modelOptions).toHaveLength(1);
    expect(selection.modelOptions[0]?.label).toBe("GPT-5.3 Codex Spark");
    expect(selection.reasoningOptions).toEqual([
      {
        label: "High",
        value: "high",
      },
    ]);
  });
});
