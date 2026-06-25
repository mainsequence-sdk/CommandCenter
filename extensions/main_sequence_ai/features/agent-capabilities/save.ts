import {
  createCapabilityResource,
  updateCapabilityContent,
  updateCapabilityResource,
  type AgentCapabilityRecord,
} from "./api";
import {
  buildCapabilityContentPayload,
  buildCapabilityResourcePayload,
  getCapabilityDirtyState,
  type AgentCapabilityEditorDraft,
} from "./model";

export class AgentCapabilityPartialSaveError extends Error {
  readonly capability: AgentCapabilityRecord;
  readonly resourceSaved: boolean;
  readonly contentSaved: boolean;
  readonly causeError: unknown;

  constructor({
    message,
    capability,
    resourceSaved,
    contentSaved,
    causeError,
  }: {
    message: string;
    capability: AgentCapabilityRecord;
    resourceSaved: boolean;
    contentSaved: boolean;
    causeError: unknown;
  }) {
    super(message);
    this.name = "AgentCapabilityPartialSaveError";
    this.capability = capability;
    this.resourceSaved = resourceSaved;
    this.contentSaved = contentSaved;
    this.causeError = causeError;
  }
}

export async function createCapabilityWithContent({
  draft,
  token,
  tokenType = "Bearer",
}: {
  draft: AgentCapabilityEditorDraft;
  token?: string | null;
  tokenType?: string;
}) {
  const capability = await createCapabilityResource({
    payload: buildCapabilityResourcePayload(draft),
    token,
    tokenType,
  });

  try {
    await updateCapabilityContent({
      capabilityUid: capability.uid,
      payload: buildCapabilityContentPayload(draft),
      token,
      tokenType,
    });
  } catch (error) {
    throw new AgentCapabilityPartialSaveError({
      message:
        error instanceof Error
          ? `Capability configuration saved, but content upload failed. ${error.message}`
          : "Capability configuration saved, but content upload failed.",
      capability,
      resourceSaved: true,
      contentSaved: false,
      causeError: error,
    });
  }

  return capability;
}

export async function saveExistingCapabilityDraft({
  capabilityUid,
  initialDraft,
  currentDraft,
  token,
  tokenType = "Bearer",
}: {
  capabilityUid: string;
  initialDraft: AgentCapabilityEditorDraft;
  currentDraft: AgentCapabilityEditorDraft;
  token?: string | null;
  tokenType?: string;
}) {
  const dirtyState = getCapabilityDirtyState(initialDraft, currentDraft);

  let capability: AgentCapabilityRecord | null = null;

  if (dirtyState.resourceChanged) {
    capability = await updateCapabilityResource({
      capabilityUid,
      payload: buildCapabilityResourcePayload(currentDraft),
      token,
      tokenType,
    });
  }

  if (dirtyState.contentChanged) {
    try {
      await updateCapabilityContent({
        capabilityUid,
        payload: buildCapabilityContentPayload(currentDraft),
        token,
        tokenType,
      });
    } catch (error) {
      if (capability) {
        throw new AgentCapabilityPartialSaveError({
          message:
            error instanceof Error
              ? `Capability configuration saved, but content upload failed. ${error.message}`
              : "Capability configuration saved, but content upload failed.",
          capability,
          resourceSaved: true,
          contentSaved: false,
          causeError: error,
        });
      }

      throw error;
    }
  }

  return {
    dirtyState,
    capability,
  };
}
