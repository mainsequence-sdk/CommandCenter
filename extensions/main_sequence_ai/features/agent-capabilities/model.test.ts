import { describe, expect, it } from "vitest";

import {
  buildCapabilityContentPayload,
  buildCapabilityEditorDraft,
  buildCapabilityResourcePayload,
  getCapabilityDirtyState,
  normalizeCapabilityPath,
  parseCapabilityMetadataText,
  synchronizeCapabilityDraft,
} from "./model";

describe("agent capability editor model", () => {
  it("locks skill paths and filenames to SKILL.md", () => {
    const draft = synchronizeCapabilityDraft(
      buildCapabilityEditorDraft({
        kind: "skill",
      }),
    );

    draft.resource.name = "Rebalance Skill";
    draft.resource.capabilityPath = "skills/trading/rebalance/custom.md";

    const synchronized = synchronizeCapabilityDraft(draft);

    expect(normalizeCapabilityPath("skill", synchronized.resource.capabilityPath, synchronized.resource.name)).toBe(
      "skills/trading/rebalance/SKILL.md",
    );
    expect(buildCapabilityContentPayload(synchronized)).toEqual({
      content: "",
      filename: "SKILL.md",
      content_mime_type: "text/markdown",
    });
  });

  it("derives prompt filenames from capability path", () => {
    const draft = buildCapabilityEditorDraft({
      kind: "prompt",
    });

    draft.resource.name = "Portfolio Review Prompt";
    draft.resource.capabilityPath = "prompts/portfolio/review";

    const synchronized = synchronizeCapabilityDraft(draft);

    expect(buildCapabilityContentPayload(synchronized)).toEqual({
      content: "",
      filename: "review.md",
      content_mime_type: "text/markdown",
    });
  });

  it("tracks resource and content dirty domains separately", () => {
    const initialDraft = buildCapabilityEditorDraft({
      kind: "prompt",
    });
    const currentDraft = buildCapabilityEditorDraft({
      kind: "prompt",
    });

    currentDraft.resource.name = "Portfolio Review";
    currentDraft.resource.metadataText = JSON.stringify({ scope: "portfolio" }, null, 2);
    currentDraft.content.content = "# Prompt\n";

    const dirtyState = getCapabilityDirtyState(initialDraft, currentDraft);

    expect(dirtyState).toEqual({
      resourceChanged: true,
      contentChanged: true,
      hasChanges: true,
    });
  });

  it("parses metadata as a JSON object only", () => {
    expect(parseCapabilityMetadataText("")).toEqual({});
    expect(parseCapabilityMetadataText('{"scope":"portfolio"}')).toEqual({
      scope: "portfolio",
    });
    expect(() => parseCapabilityMetadataText("[]")).toThrow(
      "Metadata must be a JSON object.",
    );
  });

  it("builds the resource payload with normalized capability path", () => {
    const draft = buildCapabilityEditorDraft({
      kind: "prompt",
    });

    draft.resource.name = "Portfolio Review Prompt";
    draft.resource.capabilityPath = "prompts/portfolio/review";
    draft.resource.description = "Prompt template";
    draft.resource.metadataText = JSON.stringify({ scope: "portfolio" });

    expect(buildCapabilityResourcePayload(draft)).toEqual({
      name: "Portfolio Review Prompt",
      kind: "prompt",
      description: "Prompt template",
      source_type: "inline",
      source_ref: "",
      capability_path: "prompts/portfolio/review.md",
      metadata: {
        scope: "portfolio",
      },
    });
  });
});
