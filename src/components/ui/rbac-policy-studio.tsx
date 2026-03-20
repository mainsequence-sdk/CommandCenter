import { useEffect, useMemo, useState } from "react";

import { Plus, RotateCcw, Save, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STORAGE_VERSION = 4;

export interface RbacPolicyStudioPermissionOption {
  id: string;
  label: string;
  description?: string;
  category?: string;
}

export interface RbacPolicyStudioPolicy {
  id: string;
  label: string;
  description: string;
  backendGroups: string[];
  permissions: string[];
  locked?: boolean;
}

export interface RbacPolicyStudioDraft {
  version: number;
  policies: RbacPolicyStudioPolicy[];
  savedAt: string | null;
  lastPublishedAt: string | null;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function slugifyPolicyId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "policy";
}

function createPolicyId() {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) {
    return `policy-${uuid.slice(0, 8)}`;
  }

  return `policy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizePolicy(policy: RbacPolicyStudioPolicy): RbacPolicyStudioPolicy {
  return {
    ...policy,
    id: slugifyPolicyId(policy.id),
    label: policy.label.trim() || policy.id,
    description: policy.description.trim(),
    backendGroups: dedupeStrings(policy.backendGroups),
    permissions: dedupeStrings(policy.permissions),
    locked: policy.locked ?? false,
  };
}

function mergePoliciesWithInitial(
  initialPolicies: RbacPolicyStudioPolicy[],
  persistedPolicies: RbacPolicyStudioPolicy[],
) {
  const persistedById = new Map(
    persistedPolicies.map((policy) => [policy.id, normalizePolicy(policy)]),
  );

  const mergedInitialPolicies = initialPolicies.map((initialPolicy) => {
    const normalizedInitialPolicy = normalizePolicy(initialPolicy);
    const persistedPolicy = persistedById.get(normalizedInitialPolicy.id);

    if (!persistedPolicy) {
      return normalizedInitialPolicy;
    }

    persistedById.delete(normalizedInitialPolicy.id);

    if (normalizedInitialPolicy.locked) {
      return normalizePolicy({
        ...normalizedInitialPolicy,
        backendGroups: dedupeStrings([
          ...normalizedInitialPolicy.backendGroups,
          ...persistedPolicy.backendGroups,
        ]),
        permissions: dedupeStrings([
          ...normalizedInitialPolicy.permissions,
          ...persistedPolicy.permissions,
        ]),
      });
    }

    return normalizePolicy(persistedPolicy);
  });

  return [
    ...mergedInitialPolicies,
    ...Array.from(persistedById.values()).map((policy) => normalizePolicy(policy)),
  ];
}

function buildDraft(
  initialPolicies: RbacPolicyStudioPolicy[],
  persisted?: Partial<RbacPolicyStudioDraft>,
): RbacPolicyStudioDraft {
  return {
    version: STORAGE_VERSION,
    policies: mergePoliciesWithInitial(initialPolicies, persisted?.policies ?? []),
    savedAt: persisted?.savedAt ?? null,
    lastPublishedAt: persisted?.lastPublishedAt ?? null,
  };
}

function loadDraft(
  storageKey: string,
  initialPolicies: RbacPolicyStudioPolicy[],
): RbacPolicyStudioDraft {
  const fallback = buildDraft(initialPolicies);

  if (!storageKey || !canUseLocalStorage()) {
    return fallback;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return fallback;
    }

    const parsed = JSON.parse(rawValue) as Partial<RbacPolicyStudioDraft>;

    if (!Array.isArray(parsed.policies)) {
      return fallback;
    }

    return buildDraft(initialPolicies, {
      version: STORAGE_VERSION,
      policies: parsed.policies,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
      lastPublishedAt:
        typeof parsed.lastPublishedAt === "string" ? parsed.lastPublishedAt : null,
    });
  } catch {
    return fallback;
  }
}

function persistDraft(storageKey: string, draft: RbacPolicyStudioDraft) {
  if (!storageKey || !canUseLocalStorage()) {
    throw new Error("Local storage is not available.");
  }

  window.localStorage.setItem(storageKey, JSON.stringify(draft));
}

function buildPermissionGroups(options: RbacPolicyStudioPermissionOption[]) {
  const groups = new Map<string, RbacPolicyStudioPermissionOption[]>();

  options.forEach((option) => {
    const category = option.category?.trim() || "General";
    const existing = groups.get(category) ?? [];
    existing.push(option);
    groups.set(category, existing);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }));
}

export function RbacPolicyStudio({
  storageKey,
  initialPolicies,
  permissionOptions,
  availableGroups = [],
  groupsLoading = false,
  groupsError = null,
  lockedGroupPolicyIds = [],
}: {
  storageKey: string;
  initialPolicies: RbacPolicyStudioPolicy[];
  permissionOptions: RbacPolicyStudioPermissionOption[];
  availableGroups?: string[];
  groupsLoading?: boolean;
  groupsError?: string | null;
  lockedGroupPolicyIds?: string[];
}) {
  const [draft, setDraft] = useState<RbacPolicyStudioDraft>(() =>
    loadDraft(storageKey, initialPolicies),
  );
  const [selectedPolicyId, setSelectedPolicyId] = useState(() => initialPolicies[0]?.id ?? "");
  const [groupFilterValue, setGroupFilterValue] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<{
    status: "idle" | "saving" | "saved" | "error";
    message: string | null;
  }>({
    status: "idle",
    message: null,
  });

  const permissionGroups = useMemo(
    () => buildPermissionGroups(permissionOptions),
    [permissionOptions],
  );

  const selectedPolicy =
    draft.policies.find((policy) => policy.id === selectedPolicyId) ?? draft.policies[0] ?? null;
  const groupAssignmentLocked = selectedPolicy
    ? lockedGroupPolicyIds.includes(selectedPolicy.id)
    : false;
  const groupOptions = useMemo(
    () =>
      dedupeStrings([
        ...(selectedPolicy?.backendGroups ?? []),
        ...availableGroups,
      ]),
    [availableGroups, selectedPolicy?.backendGroups],
  );
  const filteredGroupOptions = useMemo(() => {
    const normalizedFilter = groupFilterValue.trim().toLowerCase();

    if (!normalizedFilter) {
      return groupOptions;
    }

    return groupOptions.filter((group) => group.toLowerCase().includes(normalizedFilter));
  }, [groupFilterValue, groupOptions]);

  useEffect(() => {
    setDraft(loadDraft(storageKey, initialPolicies));
    setSelectedPolicyId((current) => current || initialPolicies[0]?.id || "");
    setGroupFilterValue("");
    setIsDirty(false);
    setSaveState({ status: "idle", message: null });
  }, [initialPolicies, storageKey]);

  useEffect(() => {
    if (!selectedPolicy && draft.policies[0]) {
      setSelectedPolicyId(draft.policies[0].id);
    }
  }, [draft.policies, selectedPolicy]);

  function updateDraftPolicies(
    updater: (currentPolicies: RbacPolicyStudioPolicy[]) => RbacPolicyStudioPolicy[],
  ) {
    setDraft((current) => ({
      ...current,
      policies: updater(current.policies).map((policy) => normalizePolicy(policy)),
    }));
    setIsDirty(true);
    setSaveState({ status: "idle", message: null });
  }

  function handleResetDraft() {
    setDraft(buildDraft(initialPolicies));
    setSelectedPolicyId(initialPolicies[0]?.id ?? "");
    setGroupFilterValue("");
    setIsDirty(true);
    setSaveState({ status: "idle", message: null });
  }

  function handleAddPolicy() {
    const nextPolicy: RbacPolicyStudioPolicy = {
      id: createPolicyId(),
      label: "New policy",
      description: "Describe what this policy should unlock in the shell.",
      backendGroups: [],
      permissions: [],
      locked: false,
    };

    updateDraftPolicies((currentPolicies) => [...currentPolicies, nextPolicy]);
    setSelectedPolicyId(nextPolicy.id);
  }

  function handleDeletePolicy(policyId: string) {
    const targetPolicy = draft.policies.find((policy) => policy.id === policyId);

    if (!targetPolicy || targetPolicy.locked) {
      return;
    }

    updateDraftPolicies((currentPolicies) =>
      currentPolicies.filter((policy) => policy.id !== policyId),
    );

    if (selectedPolicyId === policyId) {
      const fallbackPolicy = draft.policies.find((policy) => policy.id !== policyId);
      setSelectedPolicyId(fallbackPolicy?.id ?? "");
    }
  }

  function updateSelectedPolicy(
    updater: (policy: RbacPolicyStudioPolicy) => RbacPolicyStudioPolicy,
  ) {
    if (!selectedPolicy) {
      return;
    }

    updateDraftPolicies((currentPolicies) =>
      currentPolicies.map((policy) =>
        policy.id === selectedPolicy.id ? updater(policy) : policy,
      ),
    );
  }

  function handleToggleGroup(group: string) {
    if (!selectedPolicy || groupAssignmentLocked) {
      return;
    }

    updateSelectedPolicy((policy) => {
      const enabled = policy.backendGroups.includes(group);

      return {
        ...policy,
        backendGroups: enabled
          ? policy.backendGroups.filter((entry) => entry !== group)
          : dedupeStrings([...policy.backendGroups, group]),
      };
    });
  }

  function handleSave() {
    setSaveState({
      status: "saving",
      message: null,
    });

    try {
      const nextDraft: RbacPolicyStudioDraft = {
        ...draft,
        savedAt: new Date().toISOString(),
      };

      persistDraft(storageKey, nextDraft);
      setDraft(nextDraft);
      setIsDirty(false);
      setSaveState({
        status: "saved",
        message: "Saved.",
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to save policies.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Shell policy studio</CardTitle>
            <CardDescription>
              Define shell policies as permission bundles, then assign RBAC groups to the policies
              that should activate them in the shell.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleAddPolicy}>
              <Plus className="h-4 w-4" />
              Add policy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleResetDraft}>
              <RotateCcw className="h-4 w-4" />
              Reset draft
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!isDirty || saveState.status === "saving"}
              onClick={handleSave}
            >
              <Save className="h-4 w-4" />
              {saveState.status === "saving"
                ? "Saving..."
                : saveState.status === "saved" && !isDirty
                  ? "Saved"
                  : "Save"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 border-t border-border/60 pt-5">
          <div
            className={cn(
              "text-sm",
              saveState.status === "error"
                ? "text-danger"
                : saveState.status === "saved"
                  ? "text-success"
                  : "text-muted-foreground",
            )}
          >
            {saveState.message ?? (isDirty ? "You have unsaved changes." : "No unsaved changes.")}
          </div>
          <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3 text-sm text-muted-foreground">
            If a user matches several RBAC groups and therefore several policies, the highest
            precedence policy wins and permission grants merge. The configured Admin mapping stays
            fixed.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Access classes</CardTitle>
            <CardDescription>
              Select a policy class to manage its RBAC group assignment and shell permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.policies.map((policy) => {
              const active = policy.id === selectedPolicy?.id;

              return (
                <button
                  key={policy.id}
                  type="button"
                  className={cn(
                    "w-full rounded-[calc(var(--radius)-6px)] border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-primary/40 bg-primary/8 text-foreground"
                      : "border-border/70 bg-background/40 text-foreground hover:border-primary/20 hover:bg-background/70",
                  )}
                  onClick={() => {
                    setSelectedPolicyId(policy.id);
                    setGroupFilterValue("");
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{policy.label}</div>
                      <div className="truncate text-xs text-muted-foreground">{policy.id}</div>
                    </div>
                    <Badge variant={policy.locked ? "secondary" : "neutral"}>
                      {policy.locked ? "Built-in" : "Draft"}
                    </Badge>
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {policy.description || "No description yet."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <span>{policy.backendGroups.length} groups</span>
                    <span>{policy.permissions.length} permissions</span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {selectedPolicy ? (
          <div className="space-y-6">
            <Card>
              <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1.5">
                  <CardTitle>{selectedPolicy.label}</CardTitle>
                  <CardDescription>
                    Update the shell-facing policy for this access class and save when ready.
                  </CardDescription>
                </div>
                {!selectedPolicy.locked ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleDeletePolicy(selectedPolicy.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove policy
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Policy key
                    </div>
                    <Input
                      value={selectedPolicy.id}
                      disabled={selectedPolicy.locked}
                      onChange={(event) => {
                        updateSelectedPolicy((policy) => ({
                          ...policy,
                          id: event.target.value,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Display label
                    </div>
                    <Input
                      value={selectedPolicy.label}
                      onChange={(event) => {
                        updateSelectedPolicy((policy) => ({
                          ...policy,
                          label: event.target.value,
                        }));
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Description
                  </div>
                  <Textarea
                    value={selectedPolicy.description}
                    className="min-h-28"
                    onChange={(event) => {
                      updateSelectedPolicy((policy) => ({
                        ...policy,
                        description: event.target.value,
                      }));
                    }}
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Backend RBAC groups
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Choose which backend RBAC groups activate this policy in the shell.
                    </div>
                  </div>
                  {groupAssignmentLocked ? (
                    <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3 text-sm text-muted-foreground">
                      This policy uses a fixed RBAC group mapping from configuration and cannot be
                      reassigned here.
                    </div>
                  ) : null}
                  <Input
                    value={groupFilterValue}
                    placeholder="Filter available RBAC groups"
                    onChange={(event) => {
                      setGroupFilterValue(event.target.value);
                    }}
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    {groupsLoading ? (
                      <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3 text-sm text-muted-foreground">
                        Loading RBAC groups...
                      </div>
                    ) : groupsError ? (
                      <div className="rounded-[calc(var(--radius)-8px)] border border-danger/30 bg-danger/5 px-3 py-3 text-sm text-danger">
                        {groupsError}
                      </div>
                    ) : filteredGroupOptions.length ? (
                      filteredGroupOptions.map((group) => {
                        const enabled = selectedPolicy.backendGroups.includes(group);

                        return (
                          <label
                            key={group}
                            className={cn(
                              "flex items-start gap-3 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3",
                              enabled && "border-primary/40 bg-primary/8",
                              groupAssignmentLocked && "opacity-75",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-border text-primary"
                              checked={enabled}
                              disabled={groupAssignmentLocked}
                              onChange={() => {
                                handleToggleGroup(group);
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground">{group}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {enabled ? "Assigned to this policy." : "Available for assignment."}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3 text-sm text-muted-foreground">
                        No RBAC groups are available from the configured endpoint.
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPolicy.backendGroups.length ? (
                      selectedPolicy.backendGroups.map((group) => (
                        <button
                          key={group}
                          type="button"
                          disabled={groupAssignmentLocked}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/55 px-2.5 py-1 text-xs text-foreground",
                            !groupAssignmentLocked &&
                              "transition-colors hover:border-danger/30 hover:text-danger",
                          )}
                          onClick={() => {
                            handleToggleGroup(group);
                          }}
                        >
                          {group}
                          {!groupAssignmentLocked ? <X className="h-3 w-3" /> : null}
                        </button>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No backend groups mapped yet.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Permission grants</CardTitle>
                <CardDescription>
                  Choose which shell permissions this policy should carry when the backend resolves a
                  user into this access class.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-2">
                {permissionGroups.map((group) => (
                  <Card key={group.label} variant="nested">
                    <CardHeader className="p-4 pb-0">
                      <CardTitle>{group.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4 pt-4">
                      {group.items.map((option) => {
                        const enabled = selectedPolicy.permissions.includes(option.id);

                        return (
                          <label
                            key={option.id}
                            className="flex items-start gap-3 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-border text-primary"
                              checked={enabled}
                              onChange={() => {
                                updateSelectedPolicy((policy) => ({
                                  ...policy,
                                  permissions: enabled
                                    ? policy.permissions.filter((permission) => permission !== option.id)
                                    : [...policy.permissions, option.id],
                                }));
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground">
                                {option.label}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {option.description ?? option.id}
                              </div>
                              <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                                {option.id}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Draft preview</CardTitle>
                <CardDescription>This is the current policy payload shape.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/55 p-4 text-xs leading-6 text-foreground">
                  {JSON.stringify(selectedPolicy, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Add a policy to start editing.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
