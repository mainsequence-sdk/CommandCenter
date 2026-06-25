import { useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  FilePenLine,
  Link2Off,
  Loader2,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { MainSequenceRegistrySearch } from "../../../main_sequence/common/components/MainSequenceRegistrySearch";
import { AgentCapabilityEditor } from "./AgentCapabilityEditor";
import {
  bindCapabilityToAgent,
  fetchAgentCapabilityBindings,
  fetchCapabilityContent,
  fetchCapabilityDetail,
  fetchReusableCapabilities,
  unbindCapabilityFromAgent,
  type AgentCapabilityBindingRecord,
  type AgentCapabilityKind,
  type AgentCapabilitySourceType,
} from "./api";
import {
  getCapabilityDirtyState,
  buildCapabilityEditorDraft,
  parseCapabilityMetadataText,
  synchronizeCapabilityDraft,
  type AgentCapabilityEditorDraft,
} from "./model";
import {
  AgentCapabilityPartialSaveError,
  saveExistingCapabilityDraft,
} from "./save";

type CapabilityFilter = "all" | AgentCapabilityKind;

interface CapabilityBindingDraft {
  role: string;
  sortOrder: string;
  isEnabled: boolean;
  isLocked: boolean;
  sourceType: AgentCapabilitySourceType;
  sourceRef: string;
}

const capabilitySourceTypeOptions: Array<{
  value: AgentCapabilitySourceType;
  label: string;
}> = [
  { value: "inline", label: "Inline" },
  { value: "registry", label: "Registry" },
  { value: "repository", label: "Repository" },
  { value: "api", label: "API" },
  { value: "external", label: "External" },
];

function buildDefaultBindingDraft(): CapabilityBindingDraft {
  return {
    role: "",
    sortOrder: "0",
    isEnabled: true,
    isLocked: false,
    sourceType: "inline",
    sourceRef: "",
  };
}

function buildApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatCapabilityKind(kind: string) {
  return kind === "prompt" ? "Prompt" : "Skill";
}

function formatCapabilitySourceType(sourceType: string | null) {
  if (!sourceType) {
    return "Not set";
  }

  switch (sourceType) {
    case "inline":
      return "Inline";
    case "registry":
      return "Registry";
    case "repository":
      return "Repository";
    case "api":
      return "API";
    case "external":
      return "External";
    default:
      return sourceType;
  }
}

function formatCapabilityDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function CapabilityStateBadges({
  binding,
}: {
  binding: AgentCapabilityBindingRecord;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="neutral">{formatCapabilityKind(binding.capability?.kind ?? "skill")}</Badge>
      <Badge variant={binding.isEnabled ? "success" : "secondary"}>
        {binding.isEnabled ? "Enabled" : "Disabled"}
      </Badge>
      <Badge variant={binding.isLocked ? "warning" : "neutral"}>
        {binding.isLocked ? "Locked" : "Unlocked"}
      </Badge>
      <Badge variant={binding.capability?.isEditable === false ? "warning" : "primary"}>
        {binding.capability?.isEditable === false ? "Read only" : "Editable"}
      </Badge>
    </div>
  );
}

function CapabilityField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-sm text-foreground", mono && "font-mono text-[13px]")}>{value}</div>
    </div>
  );
}

function CapabilityBindingSummary({
  binding,
}: {
  binding: AgentCapabilityBindingRecord;
}) {
  return (
    <Card variant="nested">
      <CardHeader>
        <CardTitle>Binding metadata</CardTitle>
        <CardDescription>
          Agent-scoped binding state stays local to this tab. Resource authoring is shared through
          the capability editor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CapabilityStateBadges binding={binding} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CapabilityField label="Role" value={binding.role} mono />
          <CapabilityField
            label="Sort order"
            value={binding.sortOrder !== null ? String(binding.sortOrder) : null}
            mono
          />
          <CapabilityField
            label="Binding source"
            value={formatCapabilitySourceType(binding.sourceType)}
          />
          <CapabilityField label="Binding source ref" value={binding.sourceRef} mono />
          <CapabilityField label="Capability UID" value={binding.capabilityUid} mono />
          <CapabilityField label="Binding UID" value={binding.uid} mono />
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentCapabilitiesTab({
  agentUid,
  agentTitle,
}: {
  agentUid: string;
  agentTitle: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const [filterValue, setFilterValue] = useState("");
  const [kindFilter, setKindFilter] = useState<CapabilityFilter>("all");
  const [selectedBinding, setSelectedBinding] = useState<AgentCapabilityBindingRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [initialDraft, setInitialDraft] = useState<AgentCapabilityEditorDraft | null>(null);
  const [draft, setDraft] = useState<AgentCapabilityEditorDraft | null>(null);
  const [bindDialogOpen, setBindDialogOpen] = useState(false);
  const [bindingDraft, setBindingDraft] = useState<CapabilityBindingDraft>(buildDefaultBindingDraft());
  const [existingCapabilitySearch, setExistingCapabilitySearch] = useState("");
  const [selectedExistingCapabilityUid, setSelectedExistingCapabilityUid] = useState("");
  const initializedCapabilityUidRef = useRef<string | null>(null);

  const bindingsQuery = useQuery({
    queryKey: ["main_sequence_ai", "agents", "capabilities", agentUid],
    queryFn: ({ signal }) =>
      fetchAgentCapabilityBindings({
        agentUid,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: Boolean(agentUid),
    staleTime: 30_000,
  });

  const reusableCapabilitiesQuery = useQuery({
    queryKey: ["main_sequence_ai", "capabilities", "registry"],
    queryFn: ({ signal }) =>
      fetchReusableCapabilities({
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: bindDialogOpen,
    staleTime: 60_000,
  });

  const selectedCapabilityUid = selectedBinding?.capabilityUid ?? null;
  const capabilityDetailQuery = useQuery({
    queryKey: ["main_sequence_ai", "capabilities", "detail", selectedCapabilityUid],
    queryFn: ({ signal }) =>
      fetchCapabilityDetail({
        capabilityUid: selectedCapabilityUid ?? "",
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: editorOpen && Boolean(selectedCapabilityUid),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const capabilityContentQuery = useQuery({
    queryKey: ["main_sequence_ai", "capabilities", "content", selectedCapabilityUid],
    queryFn: ({ signal }) =>
      fetchCapabilityContent({
        capabilityUid: selectedCapabilityUid ?? "",
        allowMissing: true,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: editorOpen && Boolean(selectedCapabilityUid),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!editorOpen || !selectedBinding || !capabilityDetailQuery.data || !capabilityContentQuery.data) {
      return;
    }

    if (initializedCapabilityUidRef.current === selectedBinding.capabilityUid) {
      return;
    }

    const nextDraft = buildCapabilityEditorDraft({
      capability: capabilityDetailQuery.data,
      content: capabilityContentQuery.data,
    });

    initializedCapabilityUidRef.current = selectedBinding.capabilityUid;
    setInitialDraft(nextDraft);
    setDraft(nextDraft);
  }, [
    capabilityContentQuery.data,
    capabilityDetailQuery.data,
    editorOpen,
    selectedBinding,
  ]);

  useEffect(() => {
    if (!bindDialogOpen) {
      setBindingDraft(buildDefaultBindingDraft());
      setExistingCapabilitySearch("");
      setSelectedExistingCapabilityUid("");
    }
  }, [bindDialogOpen]);

  const dirtyState = useMemo(() => {
    if (!initialDraft || !draft) {
      return {
        resourceChanged: false,
        contentChanged: false,
        hasChanges: false,
      };
    }

    return getCapabilityDirtyState(initialDraft, draft);
  }, [draft, initialDraft]);

  const metadataError = useMemo(() => {
    if (!draft) {
      return null;
    }

    try {
      parseCapabilityMetadataText(draft.resource.metadataText);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Metadata must be valid JSON.";
    }
  }, [draft]);

  const saveCapabilityMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBinding || !initialDraft || !draft) {
        throw new Error("No bound capability is selected.");
      }

      if (metadataError) {
        throw new Error(metadataError);
      }

      return saveExistingCapabilityDraft({
        capabilityUid: selectedBinding.capabilityUid,
        initialDraft,
        currentDraft: draft,
        token: sessionToken,
        tokenType: sessionTokenType,
      });
    },
    onSuccess: async (result) => {
      if (draft) {
        const synchronizedDraft = synchronizeCapabilityDraft(draft);
        setInitialDraft(synchronizedDraft);
        setDraft(synchronizedDraft);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence_ai", "agents", "capabilities", agentUid],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence_ai", "capabilities", "detail", selectedCapabilityUid],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence_ai", "capabilities", "content", selectedCapabilityUid],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence_ai", "capabilities", "registry"],
        }),
      ]);
      toast({
        title: "Capability updated",
        description:
          result.dirtyState.resourceChanged && result.dirtyState.contentChanged
            ? "Reusable capability configuration and markdown content were saved."
            : result.dirtyState.resourceChanged
              ? "Reusable capability configuration was saved."
              : "Reusable capability markdown content was saved.",
        variant: "success",
      });
    },
    onError: (error) => {
      if (error instanceof AgentCapabilityPartialSaveError && draft) {
        const synchronizedDraft = synchronizeCapabilityDraft(draft);
        setInitialDraft((current) =>
          current
            ? {
                ...current,
                resource: synchronizedDraft.resource,
              }
            : synchronizedDraft,
        );
        setDraft(synchronizedDraft);
      }

      toast({
        title: "Capability update failed",
        description: buildApiErrorMessage(error, "Unable to update this capability."),
        variant: "error",
      });
    },
  });

  const unbindMutation = useMutation({
    mutationFn: async (binding: AgentCapabilityBindingRecord) => {
      await unbindCapabilityFromAgent({
        agentUid,
        capabilityUid: binding.capabilityUid,
        token: sessionToken,
        tokenType: sessionTokenType,
      });
      return binding;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence_ai", "agents", "capabilities", agentUid],
      });
      setEditorOpen(false);
      setSelectedBinding(null);
      setInitialDraft(null);
      setDraft(null);
      initializedCapabilityUidRef.current = null;
      toast({
        title: "Capability unbound",
        description: "The capability was removed from this agent without deleting the reusable resource.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Capability unbind failed",
        description: buildApiErrorMessage(error, "Unable to unbind this capability."),
        variant: "error",
      });
    },
  });

  const bindExistingMutation = useMutation({
    mutationFn: async () => {
      const capabilityUid = selectedExistingCapabilityUid.trim();

      if (!capabilityUid) {
        throw new Error("Select a reusable capability first.");
      }

      const normalizedSortOrder = Number.parseInt(bindingDraft.sortOrder, 10);

      await bindCapabilityToAgent({
        agentUid,
        payload: {
          capability_uid: capabilityUid,
          role: bindingDraft.role.trim() || undefined,
          sort_order: Number.isFinite(normalizedSortOrder) ? normalizedSortOrder : 0,
          is_enabled: bindingDraft.isEnabled,
          is_locked: bindingDraft.isLocked,
          configuration: {},
          source_type: bindingDraft.sourceType,
          source_ref: bindingDraft.sourceRef.trim(),
        },
        token: sessionToken,
        tokenType: sessionTokenType,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence_ai", "agents", "capabilities", agentUid],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence_ai", "capabilities", "registry"],
        }),
      ]);
      setBindDialogOpen(false);
      toast({
        title: "Capability bound",
        description: "The selected reusable capability was bound to this agent.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Capability bind failed",
        description: buildApiErrorMessage(error, "Unable to bind the selected capability."),
        variant: "error",
      });
    },
  });

  const bindings = bindingsQuery.data ?? [];
  const visibleBindings = useMemo(() => {
    const needle = filterValue.trim().toLowerCase();

    return bindings.filter((binding) => {
      const capability = binding.capability;
      if (kindFilter !== "all" && capability?.kind !== kindFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        capability?.name ?? "",
        capability?.description ?? "",
        capability?.capabilityPath ?? "",
        binding.role ?? "",
        binding.sourceRef ?? "",
        capability?.kind ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [bindings, filterValue, kindFilter]);

  const boundCapabilityUids = useMemo(
    () => new Set(bindings.map((binding) => binding.capabilityUid)),
    [bindings],
  );

  const reusableCapabilities = useMemo(() => {
    const needle = existingCapabilitySearch.trim().toLowerCase();
    const allCapabilities = reusableCapabilitiesQuery.data ?? [];

    return allCapabilities.filter((capability) => {
      if (capability.kind !== "prompt" && capability.kind !== "skill") {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        capability.name,
        capability.description ?? "",
        capability.capabilityPath ?? "",
        capability.uid,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [existingCapabilitySearch, reusableCapabilitiesQuery.data]);

  const selectedExistingCapability = reusableCapabilities.find(
    (capability) => capability.uid === selectedExistingCapabilityUid,
  );
  const selectedCapabilityAlreadyBound = selectedExistingCapability
    ? boundCapabilityUids.has(selectedExistingCapability.uid)
    : false;
  const editorCapabilityIsReadonly = capabilityDetailQuery.data?.isEditable === false;

  return (
    <div className="space-y-5">
      <MainSequenceRegistrySearch
        accessory={<Badge variant="neutral">{`${bindings.length} bindings`}</Badge>}
        selectionCount={0}
        value={filterValue}
        onChange={(event) => setFilterValue(event.target.value)}
        placeholder="Filter by name, description, role, source, or path"
        searchClassName="max-w-xl"
      />

      <div className="flex flex-wrap items-center gap-2">
        {([
          { id: "all", label: "All" },
          { id: "prompt", label: "Prompts" },
          { id: "skill", label: "Skills" },
        ] as const).map((filter) => (
          <Button
            key={filter.id}
            size="sm"
            variant={kindFilter === filter.id ? "default" : "outline"}
            onClick={() => setKindFilter(filter.id)}
          >
            {filter.label}
          </Button>
        ))}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(getAppPath("main_sequence_ai", "capabilities"))}
          >
            <ArrowUpRight className="h-4 w-4" />
            Open Registry
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bindingsQuery.isFetching}
            onClick={() => {
              void bindingsQuery.refetch();
            }}
          >
            {bindingsQuery.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button size="sm" onClick={() => setBindDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Bind Existing
          </Button>
        </div>
      </div>

      {bindingsQuery.isLoading ? (
        <div className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading agent capability bindings
        </div>
      ) : null}

      {bindingsQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {buildApiErrorMessage(bindingsQuery.error, "Unable to load capability bindings.")}
        </div>
      ) : null}

      {!bindingsQuery.isLoading && !bindingsQuery.isError && visibleBindings.length === 0 ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/12 px-4 py-4 text-sm text-muted-foreground">
          {bindings.length === 0
            ? `${agentTitle} does not have any bound prompt or skill capabilities yet. Create or edit reusable resources in Capabilities, then bind them here.`
            : "No bound capabilities match the current filter."}
        </div>
      ) : null}

      {!bindingsQuery.isLoading && !bindingsQuery.isError && visibleBindings.length > 0 ? (
        <div className="grid gap-4">
          {visibleBindings.map((binding) => (
            <Card key={binding.uid} variant="nested">
              <CardHeader className="gap-4 border-b border-border/60 pb-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{binding.capability?.name ?? "Untitled capability"}</CardTitle>
                    <CapabilityStateBadges binding={binding} />
                  </div>
                  <CardDescription>
                    {binding.capability?.description ||
                      "No reusable capability description was provided."}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    initializedCapabilityUidRef.current = null;
                    setInitialDraft(null);
                    setDraft(null);
                    setSelectedBinding(binding);
                    setEditorOpen(true);
                  }}
                >
                  <FilePenLine className="h-4 w-4" />
                  Open Editor
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <CapabilityField label="Role" value={binding.role} mono />
                  <CapabilityField
                    label="Kind"
                    value={formatCapabilityKind(binding.capability?.kind ?? "skill")}
                  />
                  <CapabilityField
                    label="Capability path"
                    value={binding.capability?.capabilityPath ?? null}
                    mono
                  />
                  <CapabilityField
                    label="Binding source"
                    value={formatCapabilitySourceType(binding.sourceType)}
                  />
                  <CapabilityField label="Capability UID" value={binding.capabilityUid} mono />
                  <CapabilityField label="Binding UID" value={binding.uid} mono />
                  <CapabilityField
                    label="Updated"
                    value={formatCapabilityDateTime(
                      binding.capability?.updatedAt ?? binding.updatedAt,
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Dialog
        open={editorOpen}
        onClose={() => {
          if (!saveCapabilityMutation.isPending && !unbindMutation.isPending) {
            setEditorOpen(false);
            setSelectedBinding(null);
            setInitialDraft(null);
            setDraft(null);
            initializedCapabilityUidRef.current = null;
          }
        }}
        closeOnBackdropClick
        title={selectedBinding?.capability?.name || "Capability"}
        description="Reusable capability metadata and markdown content"
        className="max-w-[min(1280px,calc(100vw-24px))]"
      >
        {selectedBinding ? (
          <div className="space-y-5">
            {capabilityDetailQuery.isLoading || capabilityContentQuery.isLoading || !draft ? (
              <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading reusable capability detail
              </div>
            ) : null}

            {capabilityDetailQuery.isError || capabilityContentQuery.isError ? (
              <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
                {buildApiErrorMessage(
                  capabilityDetailQuery.error ?? capabilityContentQuery.error,
                  "Unable to load reusable capability detail.",
                )}
              </div>
            ) : null}

            {draft ? (
              <>
                <CapabilityBindingSummary binding={selectedBinding} />

                <AgentCapabilityEditor
                  capability={capabilityDetailQuery.data ?? selectedBinding.capability}
                  draft={draft}
                  mode="edit"
                  readOnly={editorCapabilityIsReadonly}
                  disabled={saveCapabilityMutation.isPending || unbindMutation.isPending}
                  resourceDirty={dirtyState.resourceChanged}
                  contentDirty={dirtyState.contentChanged}
                  metadataError={metadataError}
                  onChange={setDraft}
                />

                <div className="flex flex-wrap justify-between gap-2 border-t border-border/60 pt-4">
                  <Button
                    variant="danger"
                    disabled={unbindMutation.isPending || saveCapabilityMutation.isPending}
                    onClick={() => {
                      void unbindMutation.mutateAsync(selectedBinding);
                    }}
                  >
                    {unbindMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2Off className="h-4 w-4" />
                    )}
                    Unbind From Agent
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={unbindMutation.isPending || saveCapabilityMutation.isPending}
                      onClick={() => {
                        if (initialDraft) {
                          setDraft(initialDraft);
                        }
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={unbindMutation.isPending || saveCapabilityMutation.isPending}
                      onClick={() => {
                        setEditorOpen(false);
                        setSelectedBinding(null);
                        setInitialDraft(null);
                        setDraft(null);
                        initializedCapabilityUidRef.current = null;
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      disabled={
                        editorCapabilityIsReadonly ||
                        saveCapabilityMutation.isPending ||
                        unbindMutation.isPending ||
                        Boolean(metadataError) ||
                        !dirtyState.hasChanges
                      }
                      onClick={() => {
                        void saveCapabilityMutation.mutateAsync();
                      }}
                    >
                      {saveCapabilityMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FilePenLine className="h-4 w-4" />
                      )}
                      Save Capability
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={bindDialogOpen}
        onClose={() => {
          if (!bindExistingMutation.isPending) {
            setBindDialogOpen(false);
          }
        }}
        closeOnBackdropClick
        title="Bind Existing Capability"
        description={agentTitle}
        className="max-w-[min(1180px,calc(100vw-24px))]"
      >
        <div className="space-y-5">
          <Card variant="nested">
            <CardHeader>
              <CardTitle>Agent binding</CardTitle>
              <CardDescription>
                This binding metadata is sent during POST /orm/api/agents/v1/agents/{`{agent_uid}`}/capabilities/bind/.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Role</label>
                <Input
                  className="h-11 bg-card/70"
                  disabled={bindExistingMutation.isPending}
                  value={bindingDraft.role}
                  onChange={(event) =>
                    setBindingDraft((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Sort order</label>
                <Input
                  className="h-11 bg-card/70"
                  disabled={bindExistingMutation.isPending}
                  value={bindingDraft.sortOrder}
                  onChange={(event) =>
                    setBindingDraft((current) => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Binding source type</label>
                <Select
                  className="h-11 w-full bg-card/70"
                  disabled={bindExistingMutation.isPending}
                  value={bindingDraft.sourceType}
                  onChange={(event) =>
                    setBindingDraft((current) => ({
                      ...current,
                      sourceType: event.target.value as AgentCapabilitySourceType,
                    }))
                  }
                >
                  {capabilitySourceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Binding source ref</label>
                <Input
                  className="h-11 bg-card/70"
                  disabled={bindExistingMutation.isPending}
                  value={bindingDraft.sourceRef}
                  onChange={(event) =>
                    setBindingDraft((current) => ({
                      ...current,
                      sourceRef: event.target.value,
                    }))
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border/70"
                  checked={bindingDraft.isEnabled}
                  onChange={(event) =>
                    setBindingDraft((current) => ({
                      ...current,
                      isEnabled: event.target.checked,
                    }))
                  }
                />
                Enabled
              </label>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border/70"
                  checked={bindingDraft.isLocked}
                  onChange={(event) =>
                    setBindingDraft((current) => ({
                      ...current,
                      isLocked: event.target.checked,
                    }))
                  }
                />
                Locked
              </label>
            </CardContent>
          </Card>

          <Card variant="nested">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle>Reusable capability registry</CardTitle>
                  <CardDescription>
                    Bind one existing prompt or skill. New resource creation lives on the top-level
                    Capabilities surface.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(getAppPath("main_sequence_ai", "capabilities"))}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Open Registry
                  </Button>
                  <MainSequenceRegistrySearch
                    accessory={
                      <Badge variant="neutral">{`${reusableCapabilities.length} available`}</Badge>
                    }
                    selectionCount={0}
                    value={existingCapabilitySearch}
                    onChange={(event) => setExistingCapabilitySearch(event.target.value)}
                    placeholder="Filter by name, path, UID, or description"
                    searchClassName="max-w-md"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {reusableCapabilitiesQuery.isLoading ? (
                <div className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/24 px-4 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading reusable capabilities
                </div>
              ) : null}

              {reusableCapabilitiesQuery.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {buildApiErrorMessage(
                    reusableCapabilitiesQuery.error,
                    "Unable to load reusable capabilities.",
                  )}
                </div>
              ) : null}

              {!reusableCapabilitiesQuery.isLoading &&
              !reusableCapabilitiesQuery.isError &&
              reusableCapabilities.length === 0 ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/12 px-4 py-4 text-sm text-muted-foreground">
                  No reusable prompt or skill capabilities matched the current filter.
                </div>
              ) : null}

              {!reusableCapabilitiesQuery.isLoading &&
              !reusableCapabilitiesQuery.isError &&
              reusableCapabilities.length > 0 ? (
                <div className="grid gap-3">
                  {reusableCapabilities.map((capability) => {
                    const selected = capability.uid === selectedExistingCapabilityUid;
                    const alreadyBound = boundCapabilityUids.has(capability.uid);

                    return (
                      <button
                        key={capability.uid}
                        type="button"
                        className={cn(
                          "rounded-[calc(var(--radius)-8px)] border px-4 py-4 text-left transition-colors",
                          selected
                            ? "border-primary/40 bg-primary/10"
                            : "border-border/70 bg-background/24 hover:bg-background/36",
                        )}
                        onClick={() => setSelectedExistingCapabilityUid(capability.uid)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-foreground">{capability.name}</div>
                          <Badge variant="neutral">{formatCapabilityKind(capability.kind)}</Badge>
                          <Badge variant={capability.hasContent ? "primary" : "secondary"}>
                            {capability.hasContent ? "Has content" : "Empty"}
                          </Badge>
                          <Badge variant={capability.isEditable ? "success" : "warning"}>
                            {capability.isEditable ? "Editable" : "Read only"}
                          </Badge>
                          {alreadyBound ? <Badge variant="warning">Already bound</Badge> : null}
                        </div>
                        <div className="mt-2 font-mono text-[13px] text-muted-foreground">
                          {capability.capabilityPath ?? capability.uid}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {capability.description?.trim() || "No description provided."}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {selectedExistingCapability ? (
            <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">{formatCapabilityKind(selectedExistingCapability.kind)}</Badge>
                <Badge variant={selectedExistingCapability.hasContent ? "primary" : "secondary"}>
                  {selectedExistingCapability.hasContent ? "Has content" : "Empty"}
                </Badge>
                <Badge variant={selectedExistingCapability.isEditable ? "success" : "warning"}>
                  {selectedExistingCapability.isEditable ? "Editable" : "Read only"}
                </Badge>
              </div>
              <div className="mt-3 font-mono text-[13px] text-foreground">
                {selectedExistingCapability.uid}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {selectedExistingCapability.description?.trim() || "No description provided."}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
            <Button
              variant="ghost"
              disabled={bindExistingMutation.isPending}
              onClick={() => setBindDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                bindExistingMutation.isPending ||
                !selectedExistingCapabilityUid.trim() ||
                selectedCapabilityAlreadyBound
              }
              onClick={() => {
                void bindExistingMutation.mutateAsync();
              }}
            >
              {bindExistingMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Bind Capability
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
