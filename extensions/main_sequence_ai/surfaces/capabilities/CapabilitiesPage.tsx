import { useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, FilePenLine, Loader2, Plus, RefreshCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";
import { MainSequenceRegistrySearch } from "../../../main_sequence/common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../main_sequence/common/components/registryTable";
import { AgentCapabilityEditor } from "../../features/agent-capabilities/AgentCapabilityEditor";
import {
  fetchCapabilityContent,
  fetchCapabilityDetail,
  fetchReusableCapabilities,
  type AgentCapabilityKind,
  type AgentCapabilityRecord,
} from "../../features/agent-capabilities/api";
import {
  buildCapabilityEditorDraft,
  getCapabilityDirtyState,
  parseCapabilityMetadataText,
  synchronizeCapabilityDraft,
  type AgentCapabilityEditorDraft,
} from "../../features/agent-capabilities/model";
import {
  AgentCapabilityPartialSaveError,
  createCapabilityWithContent,
  saveExistingCapabilityDraft,
} from "../../features/agent-capabilities/save";

const capabilityUidParam = "msCapabilityUid";
const capabilityCreateKindParam = "msCapabilityCreateKind";

type CapabilityFilter = "all" | AgentCapabilityKind;

interface CapabilityDraftOverride {
  baselineDraft: AgentCapabilityEditorDraft;
  capabilityUid: string;
  draft: AgentCapabilityEditorDraft;
  version: number;
}

function isCapabilityKind(value: string | null): value is AgentCapabilityKind {
  return value === "prompt" || value === "skill";
}

function buildApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatCapabilityKind(kind: AgentCapabilityKind) {
  return kind === "prompt" ? "Prompt" : "Skill";
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

export function CapabilitiesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedCapabilityUid = searchParams.get(capabilityUidParam)?.trim() ?? "";
  const requestedCreateKind = searchParams.get(capabilityCreateKindParam);
  const selectedCreateKind = isCapabilityKind(requestedCreateKind) ? requestedCreateKind : null;
  const [filterValue, setFilterValue] = useState("");
  const [kindFilter, setKindFilter] = useState<CapabilityFilter>("all");
  const [draftOverride, setDraftOverride] = useState<CapabilityDraftOverride | null>(null);
  const capabilitiesQuery = useQuery({
    queryKey: ["main_sequence_ai", "capabilities", "registry"],
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      fetchReusableCapabilities({
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
  });

  const capabilities = useMemo(
    () =>
      (capabilitiesQuery.data ?? []).filter(
        (capability) => capability.kind === "prompt" || capability.kind === "skill",
      ),
    [capabilitiesQuery.data],
  );
  const selectedCapabilityFromList = useMemo(
    () => capabilities.find((capability) => capability.uid === selectedCapabilityUid) ?? null,
    [capabilities, selectedCapabilityUid],
  );
  const filteredCapabilities = useMemo(() => {
    const needle = filterValue.trim().toLowerCase();

    return capabilities.filter((capability) => {
      if (kindFilter !== "all" && capability.kind !== kindFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        capability.name,
        capability.kind,
        capability.uid,
        capability.capabilityPath ?? "",
        capability.description ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [capabilities, filterValue, kindFilter]);

  useEffect(() => {
    if (draftOverride && draftOverride.capabilityUid !== selectedCapabilityUid) {
      setDraftOverride(null);
    }
  }, [draftOverride, selectedCapabilityUid]);

  function updateSearchParams(
    update: (nextParams: URLSearchParams) => void,
    { replace = false }: { replace?: boolean } = {},
  ) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);

    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace },
    );
  }

  function openCapabilityDetail(capabilityUid: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(capabilityUidParam, capabilityUid);
      nextParams.delete(capabilityCreateKindParam);
    });
  }

  function openCreateCapability(kind: AgentCapabilityKind) {
    setDraftOverride(null);
    updateSearchParams((nextParams) => {
      nextParams.delete(capabilityUidParam);
      nextParams.set(capabilityCreateKindParam, kind);
    });
  }

  function closeCapabilityDetail() {
    setDraftOverride(null);
    updateSearchParams((nextParams) => {
      nextParams.delete(capabilityUidParam);
      nextParams.delete(capabilityCreateKindParam);
    });
  }

  if (selectedCapabilityUid || selectedCreateKind) {
    return (
      <CapabilityDetailView
        capabilityUid={selectedCapabilityUid || null}
        createKind={selectedCreateKind}
        draftOverride={draftOverride}
        initialCapability={selectedCapabilityFromList}
        onBack={closeCapabilityDetail}
        onOpenCapability={openCapabilityDetail}
        onSetDraftOverride={setDraftOverride}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence AI"
        title="Capabilities"
        description="Browse reusable prompt and skill resources, then open one editor for configuration and markdown content."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{`${capabilities.length} capabilities`}</Badge>
            <Button size="sm" variant="outline" onClick={() => openCreateCapability("skill")}>
              <Plus className="h-4 w-4" />
              Create Skill
            </Button>
            <Button size="sm" onClick={() => openCreateCapability("prompt")}>
              <Plus className="h-4 w-4" />
              Create Prompt
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>Capability registry</CardTitle>
              <CardDescription>
                Reusable capability resources are listed from GET /orm/api/agents/v1/capabilities/.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              accessory={<Badge variant="neutral">{`${capabilities.length} results`}</Badge>}
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              placeholder="Filter by name, kind, UID, path, or description"
              selectionCount={0}
              searchClassName="max-w-[32rem]"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
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

            <div className="ml-auto">
              <Button
                size="sm"
                variant="outline"
                disabled={capabilitiesQuery.isFetching}
                onClick={() => {
                  void capabilitiesQuery.refetch();
                }}
              >
                {capabilitiesQuery.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          {capabilitiesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading capability registry
              </div>
            </div>
          ) : null}

          {capabilitiesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {buildApiErrorMessage(capabilitiesQuery.error, "Unable to load capabilities.")}
            </div>
          ) : null}

          {!capabilitiesQuery.isLoading &&
          !capabilitiesQuery.isError &&
          filteredCapabilities.length === 0 ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/12 px-4 py-5 text-sm text-muted-foreground">
              {capabilities.length === 0
                ? "No prompt or skill capabilities were returned by the registry endpoint."
                : "No capabilities match the current filter."}
            </div>
          ) : null}

          {!capabilitiesQuery.isLoading &&
          !capabilitiesQuery.isError &&
          filteredCapabilities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 pb-2">Capability</th>
                    <th className="px-4 pb-2">Kind</th>
                    <th className="px-4 pb-2">Path</th>
                    <th className="px-4 pb-2">Content</th>
                    <th className="px-4 pb-2">Editable</th>
                    <th className="px-4 pb-2">Updated</th>
                    <th className="px-4 pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCapabilities.map((capability) => (
                    <CapabilityRegistryRow
                      key={capability.uid}
                      capability={capability}
                      onOpen={() => openCapabilityDetail(capability.uid)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function CapabilityRegistryRow({
  capability,
  onOpen,
}: {
  capability: AgentCapabilityRecord;
  onOpen: () => void;
}) {
  return (
    <tr>
      <td className={getRegistryTableCellClassName(false, "left")}>
        <div className="min-w-0">
          <button
            type="button"
            className="group inline-flex items-center gap-1.5 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:text-primary"
            onClick={onOpen}
            title={`Open ${capability.name}`}
          >
            <span className="font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors group-hover:decoration-primary group-focus-visible:decoration-primary">
              {capability.name}
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary group-focus-visible:text-primary" />
          </button>
          <div
            className="mt-0.5 line-clamp-2 text-muted-foreground"
            style={{ fontSize: "var(--table-meta-font-size)" }}
            title={capability.description ?? ""}
          >
            {capability.description?.trim() || "No description provided."}
          </div>
        </div>
      </td>
      <td className={getRegistryTableCellClassName(false)}>
        <Badge variant="neutral">{formatCapabilityKind(capability.kind)}</Badge>
      </td>
      <td className={getRegistryTableCellClassName(false)}>
        <div className="font-mono text-[13px] text-foreground">
          {capability.capabilityPath ?? "Not set"}
        </div>
      </td>
      <td className={getRegistryTableCellClassName(false)}>
        <Badge variant={capability.hasContent ? "primary" : "secondary"}>
          {capability.hasContent ? "Has content" : "Empty"}
        </Badge>
      </td>
      <td className={getRegistryTableCellClassName(false)}>
        <Badge variant={capability.isEditable ? "success" : "warning"}>
          {capability.isEditable ? "Editable" : "Read only"}
        </Badge>
      </td>
      <td className={getRegistryTableCellClassName(false)}>
        <div className="text-foreground">{formatCapabilityDateTime(capability.updatedAt)}</div>
      </td>
      <td className={getRegistryTableCellClassName(false, "right")}>
        <Button size="sm" variant="outline" onClick={onOpen}>
          <FilePenLine className="h-4 w-4" />
          Open
        </Button>
      </td>
    </tr>
  );
}

function CapabilityDetailView({
  capabilityUid,
  createKind,
  draftOverride,
  initialCapability,
  onBack,
  onOpenCapability,
  onSetDraftOverride,
}: {
  capabilityUid: string | null;
  createKind: AgentCapabilityKind | null;
  draftOverride: CapabilityDraftOverride | null;
  initialCapability: AgentCapabilityRecord | null;
  onBack: () => void;
  onOpenCapability: (capabilityUid: string) => void;
  onSetDraftOverride: (override: CapabilityDraftOverride | null) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const [initialDraft, setInitialDraft] = useState<AgentCapabilityEditorDraft | null>(null);
  const [draft, setDraft] = useState<AgentCapabilityEditorDraft | null>(null);
  const initializedDraftKeyRef = useRef<string | null>(null);
  const appliedOverrideVersionRef = useRef<number | null>(null);
  const mode = capabilityUid ? "edit" : "create";
  const draftKey = capabilityUid ? `edit:${capabilityUid}` : `create:${createKind ?? "skill"}`;
  const detailQuery = useQuery({
    queryKey: ["main_sequence_ai", "capabilities", "detail", capabilityUid],
    enabled: Boolean(capabilityUid),
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      fetchCapabilityDetail({
        capabilityUid: capabilityUid ?? "",
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
  });
  const contentQuery = useQuery({
    queryKey: ["main_sequence_ai", "capabilities", "content", capabilityUid],
    enabled: Boolean(capabilityUid),
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      fetchCapabilityContent({
        capabilityUid: capabilityUid ?? "",
        allowMissing: true,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
  });

  useEffect(() => {
    if (mode !== "create") {
      return;
    }

    if (initializedDraftKeyRef.current === draftKey) {
      return;
    }

    const nextDraft = buildCapabilityEditorDraft({
      kind: createKind ?? "skill",
    });

    initializedDraftKeyRef.current = draftKey;
    appliedOverrideVersionRef.current = null;
    setInitialDraft(nextDraft);
    setDraft(nextDraft);
  }, [createKind, draftKey, mode]);

  useEffect(() => {
    if (mode !== "edit" || !capabilityUid || !detailQuery.data || !contentQuery.data) {
      return;
    }

    if (
      draftOverride &&
      draftOverride.capabilityUid === capabilityUid &&
      appliedOverrideVersionRef.current !== draftOverride.version
    ) {
      appliedOverrideVersionRef.current = draftOverride.version;
      initializedDraftKeyRef.current = draftKey;
      setInitialDraft(draftOverride.baselineDraft);
      setDraft(draftOverride.draft);
      return;
    }

    if (initializedDraftKeyRef.current === draftKey) {
      return;
    }

    const nextDraft = buildCapabilityEditorDraft({
      capability: detailQuery.data,
      content: contentQuery.data,
    });

    initializedDraftKeyRef.current = draftKey;
    appliedOverrideVersionRef.current = null;
    setInitialDraft(nextDraft);
    setDraft(nextDraft);
  }, [
    capabilityUid,
    contentQuery.data,
    detailQuery.data,
    draftKey,
    draftOverride,
    mode,
  ]);

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

  const capability = detailQuery.data ?? initialCapability ?? null;
  const capabilityReadOnly = capability?.isEditable === false;
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) {
        throw new Error("Capability editor draft is not ready.");
      }

      if (metadataError) {
        throw new Error(metadataError);
      }

      if (mode === "create") {
        const createdCapability = await createCapabilityWithContent({
          draft,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        return {
          kind: "create" as const,
          createdCapability,
        };
      }

      if (!capabilityUid || !initialDraft) {
        throw new Error("Capability detail is not ready.");
      }

      const result = await saveExistingCapabilityDraft({
        capabilityUid,
        initialDraft,
        currentDraft: draft,
        token: sessionToken,
        tokenType: sessionTokenType,
      });

      return {
        kind: "edit" as const,
        ...result,
      };
    },
    onSuccess: async (result) => {
      if (result.kind === "create") {
        onSetDraftOverride(null);
        await queryClient.invalidateQueries({
          queryKey: ["main_sequence_ai", "capabilities", "registry"],
        });
        onOpenCapability(result.createdCapability.uid);
        toast({
          title: "Capability created",
          description: "Capability configuration and markdown content were saved.",
          variant: "success",
        });
        return;
      }

      if (draft) {
        const synchronizedDraft = synchronizeCapabilityDraft(draft);
        setInitialDraft(synchronizedDraft);
        setDraft(synchronizedDraft);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence_ai", "capabilities", "registry"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence_ai", "capabilities", "detail", capabilityUid],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence_ai", "capabilities", "content", capabilityUid],
        }),
      ]);
      onSetDraftOverride(null);
      toast({
        title: "Capability updated",
        description:
          result.dirtyState.resourceChanged && result.dirtyState.contentChanged
            ? "Configuration and markdown content were saved."
            : result.dirtyState.resourceChanged
              ? "Configuration was saved."
              : "Markdown content was saved.",
        variant: "success",
      });
    },
    onError: (error) => {
      if (error instanceof AgentCapabilityPartialSaveError && draft) {
        const synchronizedDraft = synchronizeCapabilityDraft(draft);

        if (mode === "create") {
          onSetDraftOverride({
            capabilityUid: error.capability.uid,
            version: Date.now(),
            baselineDraft: {
              ...synchronizedDraft,
              resource: {
                ...synchronizedDraft.resource,
                name: error.capability.name,
                capabilityPath: error.capability.capabilityPath ?? synchronizedDraft.resource.capabilityPath,
                description: error.capability.description ?? synchronizedDraft.resource.description,
                sourceType: error.capability.sourceType,
                sourceRef: error.capability.sourceRef ?? synchronizedDraft.resource.sourceRef,
              },
              content: {
                ...synchronizedDraft.content,
                content: "",
              },
            },
            draft: synchronizedDraft,
          });
          onOpenCapability(error.capability.uid);
        } else {
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
      }

      toast({
        title: mode === "create" ? "Capability create failed" : "Capability save failed",
        description: buildApiErrorMessage(
          error,
          mode === "create"
            ? "Unable to create this capability."
            : "Unable to save this capability.",
        ),
        variant: "error",
      });
    },
  });

  const title =
    mode === "create"
      ? createKind === "prompt"
        ? "Create Prompt"
        : "Create Skill"
      : capability?.name || "Capability";

  const saveDisabled =
    !draft ||
    capabilityReadOnly ||
    saveMutation.isPending ||
    Boolean(metadataError) ||
    (mode === "edit" && !dirtyState.hasChanges);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            className="transition-colors hover:text-foreground"
            onClick={onBack}
          >
            Capabilities
          </button>
          <span>/</span>
          <span className="text-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={detailQuery.isFetching || contentQuery.isFetching}
              onClick={() => {
                void Promise.all([detailQuery.refetch(), contentQuery.refetch()]);
              }}
            >
              {detailQuery.isFetching || contentQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to capabilities
          </Button>
        </div>
      </div>

      {mode === "edit" && (detailQuery.isLoading || contentQuery.isLoading) && !draft ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading capability detail
          </CardContent>
        </Card>
      ) : null}

      {mode === "edit" && (detailQuery.isError || contentQuery.isError) && !draft ? (
        <Card>
          <CardContent className="py-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {buildApiErrorMessage(
                detailQuery.error ?? contentQuery.error,
                "Unable to load capability detail.",
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {draft ? (
        <>
          <AgentCapabilityEditor
            capability={capability}
            draft={draft}
            mode={mode}
            readOnly={capabilityReadOnly}
            disabled={saveMutation.isPending}
            resourceDirty={dirtyState.resourceChanged}
            contentDirty={dirtyState.contentChanged}
            metadataError={metadataError}
            onChange={setDraft}
          />

          <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
            <Button
              variant="ghost"
              disabled={saveMutation.isPending}
              onClick={() => {
                if (initialDraft) {
                  setDraft(initialDraft);
                }
              }}
            >
              Reset
            </Button>
            <Button
              disabled={saveDisabled}
              onClick={() => {
                void saveMutation.mutateAsync();
              }}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FilePenLine className="h-4 w-4" />
              )}
              {mode === "create" ? "Create capability" : "Save capability"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
