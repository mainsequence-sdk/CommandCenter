import { useEffect, useMemo, useState } from "react";

import { useAuthStore } from "@/auth/auth-store";
import { useCustomWorkspaceStudioStore } from "@/features/dashboards/custom-workspace-studio-store";
import { loadPersistedWorkspaceListSummaries } from "@/features/dashboards/workspace-persistence";
import type { WorkspaceListItemSummary } from "@/features/dashboards/workspace-list-summary";
import { CORE_VALUE_STRING_CONTRACT } from "@/widgets/shared/value-contracts";
import type { WidgetValueDescriptor } from "@/widgets/types";

export const MAIN_SEQUENCE_AI_WORKSPACE_REFERENCE_CONTRACT =
  "main-sequence-ai.workspace-reference@v1" as const;
export const WORKSPACE_REFERENCE_OUTPUT_ID = "workspace-reference";
export const WORKSPACE_REFERENCE_OUTPUT_LABEL = "Workspace reference";
export const WORKSPACE_REFERENCE_RUNTIME_STATUS_KEY = "referenceStatus";
export const WORKSPACE_REFERENCE_RUNTIME_ID_KEY = "resolvedWorkspaceId";
export const WORKSPACE_REFERENCE_RUNTIME_TITLE_KEY = "resolvedWorkspaceTitle";

export type WorkspaceReferenceStatus =
  | "empty"
  | "loading"
  | "valid"
  | "self-reference"
  | "missing"
  | "error";

export type WorkspaceWidgetProps = Record<string, unknown> & {
  workspaceId?: string;
};

export interface WorkspaceReferenceValue {
  id: string;
}

export interface WorkspaceReferenceResolvedSelection {
  currentWorkspaceId: string | null;
  currentWorkspaceTitle: string | null;
  targetWorkspace: WorkspaceListItemSummary | null;
  targetWorkspaceId: string | null;
  error: string | null;
  loading: boolean;
  status: WorkspaceReferenceStatus;
  workspaceOptions: WorkspaceListItemSummary[];
}

export const WORKSPACE_REFERENCE_VALUE_DESCRIPTOR: WidgetValueDescriptor = {
  kind: "object",
  contract: MAIN_SEQUENCE_AI_WORKSPACE_REFERENCE_CONTRACT,
  description:
    "Minimal workspace reference payload intended for agent-facing bindings and workspace selection flows.",
  fields: [
    {
      key: "id",
      label: "Workspace id",
      required: true,
      value: {
        kind: "primitive",
        contract: CORE_VALUE_STRING_CONTRACT,
        primitive: "string",
        description: "Selected workspace identifier.",
      },
    },
  ],
};

function normalizeWorkspaceId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeWorkspaceWidgetProps(
  props: WorkspaceWidgetProps,
): WorkspaceWidgetProps {
  const workspaceId = normalizeWorkspaceId(props.workspaceId);

  return workspaceId ? { workspaceId } : {};
}

export function isWorkspaceReferenceValue(value: unknown): value is WorkspaceReferenceValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "string" &&
    Boolean((value as { id: string }).id.trim())
  );
}

export function normalizeWorkspaceReferenceRuntimeState(
  runtimeState?: Record<string, unknown>,
) {
  const statusValue = runtimeState?.[WORKSPACE_REFERENCE_RUNTIME_STATUS_KEY];
  const resolvedWorkspaceId = normalizeWorkspaceId(runtimeState?.[WORKSPACE_REFERENCE_RUNTIME_ID_KEY]);
  const resolvedWorkspaceTitle =
    typeof runtimeState?.[WORKSPACE_REFERENCE_RUNTIME_TITLE_KEY] === "string" &&
    runtimeState[WORKSPACE_REFERENCE_RUNTIME_TITLE_KEY].trim()
      ? runtimeState[WORKSPACE_REFERENCE_RUNTIME_TITLE_KEY].trim()
      : undefined;

  const status: WorkspaceReferenceStatus =
    statusValue === "loading" ||
    statusValue === "valid" ||
    statusValue === "self-reference" ||
    statusValue === "missing" ||
    statusValue === "error"
      ? statusValue
      : "empty";

  return {
    resolvedWorkspaceId,
    resolvedWorkspaceTitle,
    status,
  };
}

export function buildWorkspaceReferenceRuntimeState(
  selection: Pick<WorkspaceReferenceResolvedSelection, "status" | "targetWorkspace" | "targetWorkspaceId">,
) {
  if (selection.status === "valid" && selection.targetWorkspaceId && selection.targetWorkspace) {
    return {
      [WORKSPACE_REFERENCE_RUNTIME_STATUS_KEY]: "valid",
      [WORKSPACE_REFERENCE_RUNTIME_ID_KEY]: selection.targetWorkspaceId,
      [WORKSPACE_REFERENCE_RUNTIME_TITLE_KEY]: selection.targetWorkspace.title,
    } satisfies Record<string, unknown>;
  }

  if (selection.status === "empty") {
    return undefined;
  }

  return {
    [WORKSPACE_REFERENCE_RUNTIME_STATUS_KEY]: selection.status,
    [WORKSPACE_REFERENCE_RUNTIME_ID_KEY]: undefined,
    [WORKSPACE_REFERENCE_RUNTIME_TITLE_KEY]: undefined,
  } satisfies Record<string, unknown>;
}

export function resolveWorkspaceReferenceOutputValue(
  runtimeState?: Record<string, unknown>,
): WorkspaceReferenceValue | undefined {
  const normalizedRuntimeState = normalizeWorkspaceReferenceRuntimeState(runtimeState);

  if (
    normalizedRuntimeState.status !== "valid" ||
    !normalizedRuntimeState.resolvedWorkspaceId
  ) {
    return undefined;
  }

  return {
    id: normalizedRuntimeState.resolvedWorkspaceId,
  };
}

export function useWorkspaceReferenceCatalog() {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const selectedWorkspaceId = useCustomWorkspaceStudioStore((state) => state.selectedWorkspaceId);
  const draftWorkspaceById = useCustomWorkspaceStudioStore((state) => state.draftWorkspaceById);
  const workspaceListItems = useCustomWorkspaceStudioStore((state) => state.workspaceListItems);
  const workspaceListHydrated = useCustomWorkspaceStudioStore((state) => state.workspaceListHydrated);
  const [fetchedWorkspaceListItems, setFetchedWorkspaceListItems] = useState<WorkspaceListItemSummary[]>([]);
  const [workspaceListLoading, setWorkspaceListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || workspaceListHydrated || workspaceListItems.length > 0) {
      setWorkspaceListLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setWorkspaceListLoading(true);
    setError(null);

    void loadPersistedWorkspaceListSummaries(userId)
      .then((nextItems) => {
        if (cancelled) {
          return;
        }

        setFetchedWorkspaceListItems(nextItems);
        setWorkspaceListLoading(false);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }

        setFetchedWorkspaceListItems([]);
        setWorkspaceListLoading(false);
        setError(nextError instanceof Error ? nextError.message : "Unable to load workspaces.");
      });

    return () => {
      cancelled = true;
    };
  }, [userId, workspaceListHydrated, workspaceListItems]);

  const workspaceOptions =
    workspaceListItems.length > 0 || workspaceListHydrated
      ? workspaceListItems
      : fetchedWorkspaceListItems;
  const workspaceMap = useMemo(
    () => new Map(workspaceOptions.map((workspace) => [workspace.id, workspace])),
    [workspaceOptions],
  );

  return {
    currentWorkspaceId: selectedWorkspaceId,
    currentWorkspaceTitle: selectedWorkspaceId
      ? draftWorkspaceById[selectedWorkspaceId]?.title ?? workspaceMap.get(selectedWorkspaceId)?.title ?? null
      : null,
    error,
    workspaceListLoading,
    workspaceListReady:
      workspaceListHydrated || workspaceListItems.length > 0 || fetchedWorkspaceListItems.length > 0,
    workspaceMap,
    workspaceOptions,
  };
}

export function resolveWorkspaceReferenceSelection({
  currentWorkspaceId,
  currentWorkspaceTitle,
  error,
  workspaceId,
  workspaceListLoading,
  workspaceListReady,
  workspaceMap,
  workspaceOptions,
}: {
  currentWorkspaceId: string | null;
  currentWorkspaceTitle: string | null;
  error: string | null;
  workspaceId: unknown;
  workspaceListLoading: boolean;
  workspaceListReady: boolean;
  workspaceMap: Map<string, WorkspaceListItemSummary>;
  workspaceOptions: WorkspaceListItemSummary[];
}): WorkspaceReferenceResolvedSelection {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId) ?? null;

  if (!normalizedWorkspaceId) {
    return {
      currentWorkspaceId,
      currentWorkspaceTitle,
      targetWorkspace: null,
      targetWorkspaceId: null,
      error,
      loading: workspaceListLoading,
      status: "empty",
      workspaceOptions,
    };
  }

  if (currentWorkspaceId && normalizedWorkspaceId === currentWorkspaceId) {
    return {
      currentWorkspaceId,
      currentWorkspaceTitle,
      targetWorkspace: null,
      targetWorkspaceId: normalizedWorkspaceId,
      error,
      loading: false,
      status: "self-reference",
      workspaceOptions,
    };
  }

  if (workspaceListLoading && !workspaceListReady) {
    return {
      currentWorkspaceId,
      currentWorkspaceTitle,
      targetWorkspace: null,
      targetWorkspaceId: normalizedWorkspaceId,
      error,
      loading: true,
      status: "loading",
      workspaceOptions,
    };
  }

  const targetWorkspace = workspaceMap.get(normalizedWorkspaceId) ?? null;

  if (targetWorkspace) {
    return {
      currentWorkspaceId,
      currentWorkspaceTitle,
      targetWorkspace,
      targetWorkspaceId: normalizedWorkspaceId,
      error,
      loading: false,
      status: "valid",
      workspaceOptions,
    };
  }

  return {
    currentWorkspaceId,
    currentWorkspaceTitle,
    targetWorkspace: null,
    targetWorkspaceId: normalizedWorkspaceId,
    error,
    loading: false,
    status: error ? "error" : "missing",
    workspaceOptions,
  };
}
