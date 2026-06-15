import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FilePenLine,
  Link2Off,
  Loader2,
  Plus,
  RefreshCcw,
} from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { MainSequenceRegistrySearch } from "../../../main_sequence/common/components/MainSequenceRegistrySearch";
import {
  bindCapabilityToAgent,
  createCapabilityResource,
  fetchAgentCapabilityBindings,
  fetchCapabilityContent,
  fetchCapabilityDetail,
  fetchReusableCapabilities,
  unbindCapabilityFromAgent,
  updateCapabilityContent,
  updateCapabilityResource,
  type AgentCapabilityBindingRecord,
  type AgentCapabilityKind,
  type AgentCapabilityRecord,
  type AgentCapabilitySourceType,
} from "./api";

type CapabilityFilter = "all" | AgentCapabilityKind;
type AddCapabilityMode = "create" | "bind-existing";

interface CapabilityBindingDraft {
  role: string;
  sortOrder: string;
  isEnabled: boolean;
  isLocked: boolean;
  sourceType: AgentCapabilitySourceType;
  sourceRef: string;
}

interface CapabilityResourceDraft {
  name: string;
  kind: AgentCapabilityKind;
  description: string;
  sourceType: AgentCapabilitySourceType;
  sourceRef: string;
  capabilityPath: string;
  content: string;
  filename: string;
}

const capabilityKindOptions: Array<{ value: AgentCapabilityKind; label: string }> = [
  { value: "prompt", label: "Prompt" },
  { value: "skill", label: "Skill" },
];

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

function normalizeString(value: string) {
  const trimmed = value.trim();
  return trimmed;
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

function formatCapabilitySize(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat().format(value);
}

function buildBindingDraft(binding: AgentCapabilityBindingRecord): CapabilityBindingDraft {
  return {
    role: binding.role ?? "",
    sortOrder:
      binding.sortOrder !== null && Number.isFinite(binding.sortOrder)
        ? String(binding.sortOrder)
        : "0",
    isEnabled: binding.isEnabled,
    isLocked: binding.isLocked,
    sourceType: binding.sourceType ?? binding.capability?.sourceType ?? "inline",
    sourceRef: binding.sourceRef ?? "",
  };
}

function buildResourceDraft(
  capability: AgentCapabilityRecord,
  content: string,
  filename: string | null,
): CapabilityResourceDraft {
  return {
    name: capability.name,
    kind: capability.kind,
    description: capability.description ?? "",
    sourceType: capability.sourceType,
    sourceRef: capability.sourceRef ?? "",
    capabilityPath: capability.capabilityPath ?? "",
    content,
    filename:
      filename ??
      capability.capabilityPath?.split("/").pop() ??
      (capability.kind === "prompt" ? "PROMPT.md" : "SKILL.md"),
  };
}

function buildCreateDraft(kind: AgentCapabilityKind): CapabilityResourceDraft {
  return {
    name: "",
    kind,
    description: "",
    sourceType: "inline",
    sourceRef: "",
    capabilityPath: kind === "prompt" ? "prompts/new-prompt/PROMPT.md" : "skills/new-skill/SKILL.md",
    content: "",
    filename: kind === "prompt" ? "PROMPT.md" : "SKILL.md",
  };
}

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
      <Badge variant={binding.capability?.isEditable === false ? "secondary" : "primary"}>
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

function CapabilityMarkdownComposer({
  content,
  disabled,
  onChange,
}: {
  content: string;
  disabled: boolean;
  onChange: (nextValue: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card variant="nested">
        <CardHeader>
          <CardTitle>Markdown</CardTitle>
          <CardDescription>
            Author the reusable capability body. Preview updates as you type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            className="min-h-[420px] bg-card/70 font-mono text-[13px] leading-6"
            disabled={disabled}
            value={content}
            onChange={(event) => onChange(event.target.value)}
            placeholder="# Capability content"
          />
        </CardContent>
      </Card>

      <Card variant="nested">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Rendered markdown preview for the current draft.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-h-[420px] rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/45 px-4 py-4">
            {content.trim() ? (
              <MarkdownContent content={content} />
            ) : (
              <div className="text-sm text-muted-foreground">No markdown content yet.</div>
            )}
          </div>
        </CardContent>
      </Card>
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
        <CardTitle>Binding Metadata</CardTitle>
        <CardDescription>
          Agent-scoped binding state. The current backend contract exposes bind and unbind, not
          in-place binding updates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CapabilityStateBadges binding={binding} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CapabilityField label="Role" value={binding.role} mono />
          <CapabilityField
            label="Sort Order"
            value={binding.sortOrder !== null ? String(binding.sortOrder) : null}
            mono
          />
          <CapabilityField
            label="Binding Source"
            value={formatCapabilitySourceType(binding.sourceType)}
          />
          <CapabilityField label="Binding Source Ref" value={binding.sourceRef} mono />
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const [filterValue, setFilterValue] = useState("");
  const [kindFilter, setKindFilter] = useState<CapabilityFilter>("all");
  const [selectedBinding, setSelectedBinding] = useState<AgentCapabilityBindingRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorBindingDraft, setEditorBindingDraft] = useState<CapabilityBindingDraft | null>(null);
  const [editorResourceDraft, setEditorResourceDraft] = useState<CapabilityResourceDraft | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddCapabilityMode>("create");
  const [createBindingDraft, setCreateBindingDraft] = useState<CapabilityBindingDraft>(
    buildDefaultBindingDraft(),
  );
  const [createResourceDraft, setCreateResourceDraft] = useState<CapabilityResourceDraft>(
    buildCreateDraft("skill"),
  );
  const [existingCapabilitySearch, setExistingCapabilitySearch] = useState("");
  const [selectedExistingCapabilityUid, setSelectedExistingCapabilityUid] = useState<string>("");

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
    enabled: addDialogOpen,
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
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: editorOpen && Boolean(selectedCapabilityUid),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!editorOpen || !selectedBinding || !capabilityDetailQuery.data) {
      return;
    }

    setEditorBindingDraft(buildBindingDraft(selectedBinding));
    setEditorResourceDraft(
      buildResourceDraft(
        capabilityDetailQuery.data,
        capabilityContentQuery.data?.content ?? "",
        capabilityContentQuery.data?.filename ?? null,
      ),
    );
  }, [capabilityContentQuery.data, capabilityDetailQuery.data, editorOpen, selectedBinding]);

  useEffect(() => {
    if (!addDialogOpen) {
      setAddMode("create");
      setCreateBindingDraft(buildDefaultBindingDraft());
      setCreateResourceDraft(buildCreateDraft("skill"));
      setExistingCapabilitySearch("");
      setSelectedExistingCapabilityUid("");
    }
  }, [addDialogOpen]);

  const saveCapabilityMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBinding || !editorResourceDraft) {
        throw new Error("No capability binding is selected.");
      }

      const capability = capabilityDetailQuery.data;
      if (!capability) {
        throw new Error("Capability detail is not loaded yet.");
      }

      const normalizedName = normalizeString(editorResourceDraft.name);
      if (!normalizedName) {
        throw new Error("Capability name is required.");
      }

      const normalizedContent = editorResourceDraft.content;

      const updatedCapability = await updateCapabilityResource({
        capabilityUid: selectedBinding.capabilityUid,
        payload: {
          name: normalizedName,
          kind: editorResourceDraft.kind,
          description: editorResourceDraft.description.trim(),
          source_type: editorResourceDraft.sourceType,
          source_ref: editorResourceDraft.sourceRef.trim(),
          capability_path: editorResourceDraft.capabilityPath.trim(),
          metadata: capability.metadata,
        },
        token: sessionToken,
        tokenType: sessionTokenType,
      });

      const updatedContent = await updateCapabilityContent({
        capabilityUid: selectedBinding.capabilityUid,
        payload: {
          content: normalizedContent,
          filename: editorResourceDraft.filename.trim() || undefined,
          content_mime_type: "text/markdown",
        },
        token: sessionToken,
        tokenType: sessionTokenType,
      });

      return { updatedCapability, updatedContent };
    },
    onSuccess: async () => {
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
        description: "Reusable capability metadata and markdown content were saved.",
        variant: "success",
      });
    },
    onError: (error) => {
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

  const createOrBindMutation = useMutation({
    mutationFn: async () => {
      const normalizedRole = createBindingDraft.role.trim();
      const normalizedSortOrder = Number.parseInt(createBindingDraft.sortOrder, 10);
      const bindingPayload = {
        role: normalizedRole || undefined,
        sort_order: Number.isFinite(normalizedSortOrder) ? normalizedSortOrder : 0,
        is_enabled: createBindingDraft.isEnabled,
        is_locked: createBindingDraft.isLocked,
        configuration: {},
        source_type: createBindingDraft.sourceType,
        source_ref: createBindingDraft.sourceRef.trim(),
      };

      if (addMode === "bind-existing") {
        const capabilityUid = selectedExistingCapabilityUid.trim();

        if (!capabilityUid) {
          throw new Error("Select a reusable capability first.");
        }

        await bindCapabilityToAgent({
          agentUid,
          payload: {
            capability_uid: capabilityUid,
            ...bindingPayload,
          },
          token: sessionToken,
          tokenType: sessionTokenType,
        });
        return;
      }

      const normalizedName = createResourceDraft.name.trim();
      if (!normalizedName) {
        throw new Error("Capability name is required.");
      }

      const createdCapability = await createCapabilityResource({
        payload: {
          name: normalizedName,
          kind: createResourceDraft.kind,
          description: createResourceDraft.description.trim(),
          source_type: createResourceDraft.sourceType,
          source_ref: createResourceDraft.sourceRef.trim(),
          capability_path: createResourceDraft.capabilityPath.trim(),
          metadata: {},
        },
        token: sessionToken,
        tokenType: sessionTokenType,
      });

      if (createResourceDraft.content.trim()) {
        await updateCapabilityContent({
          capabilityUid: createdCapability.uid,
          payload: {
            content: createResourceDraft.content,
            filename: createResourceDraft.filename.trim() || undefined,
            content_mime_type: "text/markdown",
          },
          token: sessionToken,
          tokenType: sessionTokenType,
        });
      }

      await bindCapabilityToAgent({
        agentUid,
        payload: {
          capability_uid: createdCapability.uid,
          ...bindingPayload,
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
      setAddDialogOpen(false);
      toast({
        title: addMode === "create" ? "Capability created" : "Capability bound",
        description:
          addMode === "create"
            ? "The reusable capability was created and bound to this agent."
            : "The reusable capability was bound to this agent.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: addMode === "create" ? "Capability create failed" : "Capability bind failed",
        description: buildApiErrorMessage(
          error,
          addMode === "create"
            ? "Unable to create and bind this capability."
            : "Unable to bind the selected reusable capability.",
        ),
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
        capability?.sourceRef ?? "",
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
      if (needle) {
        const haystack = [
          capability.name,
          capability.description ?? "",
          capability.capabilityPath ?? "",
          capability.sourceRef ?? "",
          capability.kind,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(needle)) {
          return false;
        }
      }

      return capability.kind === "prompt" || capability.kind === "skill";
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
          <Button
            size="sm"
            onClick={() => {
              setAddDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Capability
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
            ? `${agentTitle} does not have any bound prompt or skill capabilities yet.`
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
                    label="Capability Source"
                    value={formatCapabilitySourceType(binding.capability?.sourceType ?? null)}
                  />
                  <CapabilityField
                    label="Binding Source"
                    value={formatCapabilitySourceType(binding.sourceType)}
                  />
                  <CapabilityField
                    label="Capability Path"
                    value={binding.capability?.capabilityPath ?? null}
                    mono
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
          if (
            !saveCapabilityMutation.isPending &&
            !unbindMutation.isPending
          ) {
            setEditorOpen(false);
            setSelectedBinding(null);
          }
        }}
        closeOnBackdropClick
        title={selectedBinding?.capability?.name || "Capability"}
        description="Reusable capability metadata and markdown content"
        className="max-w-[min(1280px,calc(100vw-24px))]"
      >
        {selectedBinding ? (
          <div className="space-y-5">
            {capabilityDetailQuery.isLoading || capabilityContentQuery.isLoading || !editorResourceDraft || !editorBindingDraft ? (
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

            {editorResourceDraft && editorBindingDraft ? (
              <>
                <CapabilityBindingSummary binding={selectedBinding} />

                <Card variant="nested">
                  <CardHeader>
                    <CardTitle>Reusable Capability</CardTitle>
                    <CardDescription>
                      Resource metadata for the shared capability. Binding metadata stays separate.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editorCapabilityIsReadonly ? (
                      <div className="rounded-[calc(var(--radius)-8px)] border border-warning/35 bg-warning/10 px-3 py-3 text-sm text-warning">
                        This reusable capability is marked read only by the backend. Metadata and
                        markdown content are shown for inspection only.
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Name</label>
                        <Input
                          className="h-11 bg-card/70"
                          disabled={editorCapabilityIsReadonly || saveCapabilityMutation.isPending}
                          value={editorResourceDraft.name}
                          onChange={(event) =>
                            setEditorResourceDraft((current) =>
                              current ? { ...current, name: event.target.value } : current,
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Kind</label>
                        <Select
                          className="h-11 w-full bg-card/70"
                          disabled={editorCapabilityIsReadonly || saveCapabilityMutation.isPending}
                          value={editorResourceDraft.kind}
                          onChange={(event) =>
                            setEditorResourceDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    kind: event.target.value as AgentCapabilityKind,
                                  }
                                : current,
                            )
                          }
                        >
                          {capabilityKindOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Source Type</label>
                        <Select
                          className="h-11 w-full bg-card/70"
                          disabled={editorCapabilityIsReadonly || saveCapabilityMutation.isPending}
                          value={editorResourceDraft.sourceType}
                          onChange={(event) =>
                            setEditorResourceDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    sourceType: event.target.value as AgentCapabilitySourceType,
                                  }
                                : current,
                            )
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
                        <label className="text-xs text-muted-foreground">Source Ref</label>
                        <Input
                          className="h-11 bg-card/70"
                          disabled={editorCapabilityIsReadonly || saveCapabilityMutation.isPending}
                          value={editorResourceDraft.sourceRef}
                          onChange={(event) =>
                            setEditorResourceDraft((current) =>
                              current ? { ...current, sourceRef: event.target.value } : current,
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs text-muted-foreground">Capability Path</label>
                        <Input
                          className="h-11 bg-card/70 font-mono text-[13px]"
                          disabled={editorCapabilityIsReadonly || saveCapabilityMutation.isPending}
                          value={editorResourceDraft.capabilityPath}
                          onChange={(event) =>
                            setEditorResourceDraft((current) =>
                              current ? { ...current, capabilityPath: event.target.value } : current,
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Description</label>
                      <Textarea
                        className="min-h-[132px] bg-card/70"
                        disabled={editorCapabilityIsReadonly || saveCapabilityMutation.isPending}
                        value={editorResourceDraft.description}
                        onChange={(event) =>
                          setEditorResourceDraft((current) =>
                            current ? { ...current, description: event.target.value } : current,
                          )
                        }
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <CapabilityField label="Capability UID" value={selectedBinding.capabilityUid} mono />
                      <CapabilityField
                        label="Has Content"
                        value={capabilityDetailQuery.data?.hasContent ? "Yes" : "No"}
                      />
                      <CapabilityField
                        label="Content MIME Type"
                        value={capabilityDetailQuery.data?.contentMimeType ?? null}
                        mono
                      />
                      <CapabilityField
                        label="Content Size"
                        value={formatCapabilitySize(capabilityDetailQuery.data?.contentSize ?? null)}
                        mono
                      />
                      <CapabilityField
                        label="Content SHA256"
                        value={capabilityDetailQuery.data?.contentSha256 ?? null}
                        mono
                      />
                      <CapabilityField
                        label="Updated"
                        value={formatCapabilityDateTime(capabilityDetailQuery.data?.updatedAt ?? null)}
                      />
                      <CapabilityField
                        label="Created By User"
                        value={capabilityDetailQuery.data?.createdByUserUid ?? null}
                        mono
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card variant="nested">
                  <CardHeader>
                    <CardTitle>Content File</CardTitle>
                    <CardDescription>
                      Content updates use the dedicated capability content endpoint.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 space-y-1.5">
                      <label className="text-xs text-muted-foreground">Filename</label>
                      <Input
                        className="h-11 bg-card/70 font-mono text-[13px]"
                        disabled={editorCapabilityIsReadonly || saveCapabilityMutation.isPending}
                        value={editorResourceDraft.filename}
                        onChange={(event) =>
                          setEditorResourceDraft((current) =>
                            current ? { ...current, filename: event.target.value } : current,
                          )
                        }
                      />
                    </div>
                    <CapabilityMarkdownComposer
                      content={editorResourceDraft.content}
                      disabled={editorCapabilityIsReadonly || saveCapabilityMutation.isPending}
                      onChange={(nextContent) =>
                        setEditorResourceDraft((current) =>
                          current ? { ...current, content: nextContent } : current,
                        )
                      }
                    />
                  </CardContent>
                </Card>

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
                        setEditorOpen(false);
                        setSelectedBinding(null);
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      disabled={
                        editorCapabilityIsReadonly ||
                        saveCapabilityMutation.isPending ||
                        unbindMutation.isPending
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
        open={addDialogOpen}
        onClose={() => {
          if (!createOrBindMutation.isPending) {
            setAddDialogOpen(false);
          }
        }}
        closeOnBackdropClick
        title="Add Capability"
        description={agentTitle}
        className="max-w-[min(1180px,calc(100vw-24px))]"
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={addMode === "create" ? "default" : "outline"}
              onClick={() => setAddMode("create")}
            >
              Create New
            </Button>
            <Button
              size="sm"
              variant={addMode === "bind-existing" ? "default" : "outline"}
              onClick={() => setAddMode("bind-existing")}
            >
              Bind Existing
            </Button>
          </div>

          <Card variant="nested">
            <CardHeader>
              <CardTitle>Agent Binding</CardTitle>
              <CardDescription>
                This binding metadata is sent during the bind operation.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Role</label>
                <Input
                  className="h-11 bg-card/70"
                  disabled={createOrBindMutation.isPending}
                  value={createBindingDraft.role}
                  onChange={(event) =>
                    setCreateBindingDraft((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Sort Order</label>
                <Input
                  className="h-11 bg-card/70"
                  disabled={createOrBindMutation.isPending}
                  value={createBindingDraft.sortOrder}
                  onChange={(event) =>
                    setCreateBindingDraft((current) => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Binding Source Type</label>
                <Select
                  className="h-11 w-full bg-card/70"
                  disabled={createOrBindMutation.isPending}
                  value={createBindingDraft.sourceType}
                  onChange={(event) =>
                    setCreateBindingDraft((current) => ({
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
                <label className="text-xs text-muted-foreground">Binding Source Ref</label>
                <Input
                  className="h-11 bg-card/70"
                  disabled={createOrBindMutation.isPending}
                  value={createBindingDraft.sourceRef}
                  onChange={(event) =>
                    setCreateBindingDraft((current) => ({
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
                  checked={createBindingDraft.isEnabled}
                  onChange={(event) =>
                    setCreateBindingDraft((current) => ({
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
                  checked={createBindingDraft.isLocked}
                  onChange={(event) =>
                    setCreateBindingDraft((current) => ({
                      ...current,
                      isLocked: event.target.checked,
                    }))
                  }
                />
                Locked
              </label>
            </CardContent>
          </Card>

          {addMode === "create" ? (
            <>
              <Card variant="nested">
                <CardHeader>
                  <CardTitle>Reusable Capability Metadata</CardTitle>
                  <CardDescription>
                    Create a reusable prompt or skill resource first, then bind it to this agent.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Name</label>
                      <Input
                        className="h-11 bg-card/70"
                        disabled={createOrBindMutation.isPending}
                        value={createResourceDraft.name}
                        onChange={(event) =>
                          setCreateResourceDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Kind</label>
                      <Select
                        className="h-11 w-full bg-card/70"
                        disabled={createOrBindMutation.isPending}
                        value={createResourceDraft.kind}
                        onChange={(event) => {
                          const nextKind = event.target.value as AgentCapabilityKind;
                          setCreateResourceDraft((current) => ({
                            ...current,
                            kind: nextKind,
                            capabilityPath:
                              nextKind === "prompt"
                                ? "prompts/new-prompt/PROMPT.md"
                                : "skills/new-skill/SKILL.md",
                            filename: nextKind === "prompt" ? "PROMPT.md" : "SKILL.md",
                          }));
                        }}
                      >
                        {capabilityKindOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Source Type</label>
                      <Select
                        className="h-11 w-full bg-card/70"
                        disabled={createOrBindMutation.isPending}
                        value={createResourceDraft.sourceType}
                        onChange={(event) =>
                          setCreateResourceDraft((current) => ({
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
                      <label className="text-xs text-muted-foreground">Source Ref</label>
                      <Input
                        className="h-11 bg-card/70"
                        disabled={createOrBindMutation.isPending}
                        value={createResourceDraft.sourceRef}
                        onChange={(event) =>
                          setCreateResourceDraft((current) => ({
                            ...current,
                            sourceRef: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs text-muted-foreground">Capability Path</label>
                      <Input
                        className="h-11 bg-card/70 font-mono text-[13px]"
                        disabled={createOrBindMutation.isPending}
                        value={createResourceDraft.capabilityPath}
                        onChange={(event) =>
                          setCreateResourceDraft((current) => ({
                            ...current,
                            capabilityPath: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Description</label>
                    <Textarea
                      className="min-h-[120px] bg-card/70"
                      disabled={createOrBindMutation.isPending}
                      value={createResourceDraft.description}
                      onChange={(event) =>
                        setCreateResourceDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Filename</label>
                    <Input
                      className="h-11 bg-card/70 font-mono text-[13px]"
                      disabled={createOrBindMutation.isPending}
                      value={createResourceDraft.filename}
                      onChange={(event) =>
                        setCreateResourceDraft((current) => ({
                          ...current,
                          filename: event.target.value,
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <CapabilityMarkdownComposer
                content={createResourceDraft.content}
                disabled={createOrBindMutation.isPending}
                onChange={(nextContent) =>
                  setCreateResourceDraft((current) => ({
                    ...current,
                    content: nextContent,
                  }))
                }
              />
            </>
          ) : (
            <Card variant="nested">
              <CardHeader>
                <CardTitle>Reusable Capability Registry</CardTitle>
                <CardDescription>
                  Bind an existing reusable prompt or skill resource to this agent.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MainSequenceRegistrySearch
                  accessory={
                    <Badge variant="neutral">{`${reusableCapabilities.length} capabilities`}</Badge>
                  }
                  selectionCount={0}
                  value={existingCapabilitySearch}
                  onChange={(event) => setExistingCapabilitySearch(event.target.value)}
                  placeholder="Filter by name, path, source, or description"
                  searchClassName="max-w-xl"
                />

                {reusableCapabilitiesQuery.isLoading ? (
                  <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading reusable capabilities
                  </div>
                ) : null}

                {reusableCapabilitiesQuery.isError ? (
                  <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
                    {buildApiErrorMessage(
                      reusableCapabilitiesQuery.error,
                      "Unable to load reusable capabilities.",
                    )}
                  </div>
                ) : null}

                {!reusableCapabilitiesQuery.isLoading &&
                !reusableCapabilitiesQuery.isError &&
                reusableCapabilities.length === 0 ? (
                  <div className="rounded-[16px] border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                    No reusable prompt or skill capabilities were returned.
                  </div>
                ) : null}

                {!reusableCapabilitiesQuery.isLoading &&
                !reusableCapabilitiesQuery.isError &&
                reusableCapabilities.length > 0 ? (
                  <div className="space-y-2">
                    {reusableCapabilities.map((capability) => {
                      const selected = selectedExistingCapabilityUid === capability.uid;
                      const alreadyBound = boundCapabilityUids.has(capability.uid);

                      return (
                        <button
                          key={capability.uid}
                          type="button"
                          disabled={alreadyBound}
                          className={cn(
                            "flex w-full items-start justify-between gap-3 rounded-[16px] border px-4 py-4 text-left transition-colors",
                            selected
                              ? "border-primary/35 bg-primary/10"
                              : "border-border/70 bg-background/35 hover:bg-background/55",
                            alreadyBound && "cursor-not-allowed opacity-60",
                          )}
                          onClick={() => setSelectedExistingCapabilityUid(capability.uid)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-medium text-foreground">{capability.name}</div>
                              <Badge variant="neutral">{formatCapabilityKind(capability.kind)}</Badge>
                              {alreadyBound ? <Badge variant="warning">Already bound</Badge> : null}
                            </div>
                            {capability.description ? (
                              <div className="mt-2 text-sm leading-6 text-muted-foreground">
                                {capability.description}
                              </div>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {capability.capabilityPath ? (
                                <span className="font-mono">{capability.capabilityPath}</span>
                              ) : null}
                              <span>{formatCapabilitySourceType(capability.sourceType)}</span>
                              {capability.hasContent ? <span>Has content</span> : <span>No content</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {selectedExistingCapability ? (
                  <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
                    Selected reusable capability:{" "}
                    <span className="font-medium text-foreground">{selectedExistingCapability.name}</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {selectedCapabilityAlreadyBound && addMode === "bind-existing" ? (
            <div className="rounded-[16px] border border-warning/35 bg-warning/10 px-3 py-3 text-sm text-warning">
              This reusable capability is already bound to the current agent.
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={createOrBindMutation.isPending}
              onClick={() => setAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                createOrBindMutation.isPending ||
                (addMode === "bind-existing" &&
                  (!selectedExistingCapabilityUid || selectedCapabilityAlreadyBound))
              }
              onClick={() => {
                void createOrBindMutation.mutateAsync();
              }}
            >
              {createOrBindMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {addMode === "create" ? "Create And Bind" : "Bind Capability"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
