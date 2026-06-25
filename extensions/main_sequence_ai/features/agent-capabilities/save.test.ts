import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCapabilityResource: vi.fn(),
  updateCapabilityResource: vi.fn(),
  updateCapabilityContent: vi.fn(),
}));

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");

  return {
    ...actual,
    createCapabilityResource: mocks.createCapabilityResource,
    updateCapabilityResource: mocks.updateCapabilityResource,
    updateCapabilityContent: mocks.updateCapabilityContent,
  };
});

import {
  buildCapabilityEditorDraft,
  synchronizeCapabilityDraft,
} from "./model";
import {
  AgentCapabilityPartialSaveError,
  createCapabilityWithContent,
  saveExistingCapabilityDraft,
} from "./save";

function buildCapabilityRecord(overrides: Partial<Awaited<ReturnType<typeof createCapabilityWithContent>>> = {}) {
  return {
    uid: "capability-uid-1",
    name: "Rebalance Skill",
    kind: "skill" as const,
    sourceType: "inline" as const,
    sourceRef: null,
    capabilityPath: "skills/trading/rebalance/SKILL.md",
    isEditable: true,
    description: "Rules for rebalance analysis",
    metadata: {},
    contentFile: null,
    contentSha256: null,
    contentMimeType: "text/markdown",
    contentSize: null,
    hasContent: true,
    createdByUserUid: "user-uid-1",
    updatedAt: "2026-06-24T09:00:00Z",
    ...overrides,
  };
}

describe("agent capability save orchestration", () => {
  beforeEach(() => {
    mocks.createCapabilityResource.mockReset();
    mocks.updateCapabilityResource.mockReset();
    mocks.updateCapabilityContent.mockReset();
  });

  it("creates a capability resource first and then uploads markdown content", async () => {
    const draft = synchronizeCapabilityDraft(
      buildCapabilityEditorDraft({
        kind: "skill",
      }),
    );
    draft.resource.name = "Rebalance Skill";
    draft.resource.capabilityPath = "skills/trading/rebalance/custom.md";
    draft.resource.description = "Rules for rebalance analysis";
    draft.content.content = "# Rebalance Skill\n\n...";

    mocks.createCapabilityResource.mockResolvedValue(buildCapabilityRecord());
    mocks.updateCapabilityContent.mockResolvedValue({
      content: "# Rebalance Skill\n\n...",
      filename: "SKILL.md",
      contentMimeType: "text/markdown",
      updatedAt: "2026-06-24T09:01:00Z",
    });

    const result = await createCapabilityWithContent({ draft });

    expect(mocks.createCapabilityResource).toHaveBeenCalledWith({
      payload: {
        name: "Rebalance Skill",
        kind: "skill",
        description: "Rules for rebalance analysis",
        source_type: "inline",
        source_ref: "",
        capability_path: "skills/trading/rebalance/SKILL.md",
        metadata: {},
      },
      token: undefined,
      tokenType: "Bearer",
    });
    expect(mocks.updateCapabilityContent).toHaveBeenCalledWith({
      capabilityUid: "capability-uid-1",
      payload: {
        content: "# Rebalance Skill\n\n...",
        filename: "SKILL.md",
        content_mime_type: "text/markdown",
      },
      token: undefined,
      tokenType: "Bearer",
    });
    expect(result).toEqual(buildCapabilityRecord());
  });

  it("surfaces a partial save error when content upload fails after create", async () => {
    const draft = synchronizeCapabilityDraft(
      buildCapabilityEditorDraft({
        kind: "prompt",
      }),
    );
    draft.resource.name = "Portfolio Review Prompt";
    draft.resource.capabilityPath = "prompts/portfolio/review.md";
    draft.content.content = "# Portfolio Review";
    const createdCapability = buildCapabilityRecord({
      uid: "capability-uid-2",
      kind: "prompt",
      name: "Portfolio Review Prompt",
      capabilityPath: "prompts/portfolio/review.md",
    });

    mocks.createCapabilityResource.mockResolvedValue(createdCapability);
    mocks.updateCapabilityContent.mockRejectedValue(new Error("Upload failed."));

    await expect(createCapabilityWithContent({ draft })).rejects.toMatchObject({
      name: "AgentCapabilityPartialSaveError",
      message: "Capability configuration saved, but content upload failed. Upload failed.",
      capability: createdCapability,
      resourceSaved: true,
      contentSaved: false,
    });
  });

  it("patches only the resource payload when configuration changed", async () => {
    const initialDraft = buildCapabilityEditorDraft({
      kind: "prompt",
    });
    const currentDraft = buildCapabilityEditorDraft({
      kind: "prompt",
    });
    currentDraft.resource.name = "Portfolio Review Prompt";
    currentDraft.resource.description = "Prompt template";

    mocks.updateCapabilityResource.mockResolvedValue(
      buildCapabilityRecord({
        uid: "capability-uid-3",
        kind: "prompt",
        name: "Portfolio Review Prompt",
        capabilityPath: "prompts/new-capability.md",
        description: "Prompt template",
      }),
    );

    const result = await saveExistingCapabilityDraft({
      capabilityUid: "capability-uid-3",
      initialDraft,
      currentDraft,
    });

    expect(mocks.updateCapabilityResource).toHaveBeenCalledTimes(1);
    expect(mocks.updateCapabilityContent).not.toHaveBeenCalled();
    expect(result.dirtyState).toEqual({
      resourceChanged: true,
      contentChanged: false,
      hasChanges: true,
    });
  });

  it("updates only markdown content when content changed", async () => {
    const initialDraft = buildCapabilityEditorDraft({
      kind: "prompt",
    });
    const currentDraft = buildCapabilityEditorDraft({
      kind: "prompt",
    });
    currentDraft.content.content = "# Portfolio Review\n";

    mocks.updateCapabilityContent.mockResolvedValue({
      content: "# Portfolio Review\n",
      filename: "new-capability.md",
      contentMimeType: "text/markdown",
      updatedAt: "2026-06-24T09:02:00Z",
    });

    const result = await saveExistingCapabilityDraft({
      capabilityUid: "capability-uid-4",
      initialDraft,
      currentDraft,
    });

    expect(mocks.updateCapabilityResource).not.toHaveBeenCalled();
    expect(mocks.updateCapabilityContent).toHaveBeenCalledWith({
      capabilityUid: "capability-uid-4",
      payload: {
        content: "# Portfolio Review\n",
        filename: "new-capability.md",
        content_mime_type: "text/markdown",
      },
      token: undefined,
      tokenType: "Bearer",
    });
    expect(result).toEqual({
      dirtyState: {
        resourceChanged: false,
        contentChanged: true,
        hasChanges: true,
      },
      capability: null,
    });
  });

  it("saves resource first and then content when both dirty domains changed", async () => {
    const initialDraft = buildCapabilityEditorDraft({
      kind: "prompt",
    });
    const currentDraft = buildCapabilityEditorDraft({
      kind: "prompt",
    });
    currentDraft.resource.name = "Portfolio Review Prompt";
    currentDraft.resource.description = "Prompt template";
    currentDraft.content.content = "# Portfolio Review\n";

    mocks.updateCapabilityResource.mockResolvedValue(
      buildCapabilityRecord({
        uid: "capability-uid-5",
        kind: "prompt",
        name: "Portfolio Review Prompt",
        capabilityPath: "prompts/new-capability.md",
        description: "Prompt template",
      }),
    );
    mocks.updateCapabilityContent.mockResolvedValue({
      content: "# Portfolio Review\n",
      filename: "new-capability.md",
      contentMimeType: "text/markdown",
      updatedAt: "2026-06-24T09:03:00Z",
    });

    const result = await saveExistingCapabilityDraft({
      capabilityUid: "capability-uid-5",
      initialDraft,
      currentDraft,
    });

    expect(mocks.updateCapabilityResource).toHaveBeenCalledTimes(1);
    expect(mocks.updateCapabilityContent).toHaveBeenCalledTimes(1);
    expect(
      mocks.updateCapabilityResource.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.updateCapabilityContent.mock.invocationCallOrder[0] ?? 0);
    expect(result.dirtyState).toEqual({
      resourceChanged: true,
      contentChanged: true,
      hasChanges: true,
    });
  });

  it("surfaces a partial save error when content upload fails after patch", async () => {
    const initialDraft = buildCapabilityEditorDraft({
      kind: "prompt",
    });
    const currentDraft = buildCapabilityEditorDraft({
      kind: "prompt",
    });
    currentDraft.resource.name = "Portfolio Review Prompt";
    currentDraft.content.content = "# Portfolio Review\n";
    const updatedCapability = buildCapabilityRecord({
      uid: "capability-uid-6",
      kind: "prompt",
      name: "Portfolio Review Prompt",
      capabilityPath: "prompts/new-capability.md",
    });

    mocks.updateCapabilityResource.mockResolvedValue(updatedCapability);
    mocks.updateCapabilityContent.mockRejectedValue(new Error("Upload failed."));

    try {
      await saveExistingCapabilityDraft({
        capabilityUid: "capability-uid-6",
        initialDraft,
        currentDraft,
      });
      throw new Error("Expected saveExistingCapabilityDraft to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(AgentCapabilityPartialSaveError);
      expect(error).toMatchObject({
        capability: updatedCapability,
        resourceSaved: true,
        contentSaved: false,
      });
    }
  });
});
