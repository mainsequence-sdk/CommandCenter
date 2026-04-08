import { useEffect, useMemo, useState } from "react";

import { Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface RbacPolicyStudioPermissionOption {
  id: string;
  label: string;
  description?: string;
  category?: string;
}

export interface RbacPolicyStudioPolicy {
  id: number;
  slugifiedName: string;
  label: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  isEditable: boolean;
}

interface EditablePolicyDraft {
  id: number | null;
  slugifiedName: string;
  label: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  isEditable: boolean;
  isNew: boolean;
}

function slugifyPolicyId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "policy";
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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

function toDraft(policy: RbacPolicyStudioPolicy): EditablePolicyDraft {
  return {
    id: policy.id,
    slugifiedName: policy.slugifiedName,
    label: policy.label,
    description: policy.description,
    permissions: dedupeStrings(policy.permissions),
    isSystem: policy.isSystem,
    isEditable: policy.isEditable,
    isNew: false,
  };
}

function createEmptyDraft(): EditablePolicyDraft {
  return {
    id: null,
    slugifiedName: "new-policy",
    label: "New policy",
    description: "Describe what this policy should unlock in the shell.",
    permissions: [],
    isSystem: false,
    isEditable: true,
    isNew: true,
  };
}

function normalizeDraft(draft: EditablePolicyDraft): EditablePolicyDraft {
  const slugifiedName = slugifyPolicyId(draft.slugifiedName || draft.label);

  return {
    ...draft,
    slugifiedName,
    label: draft.label.trim() || slugifiedName,
    description: draft.description.trim(),
    permissions: dedupeStrings(draft.permissions),
  };
}

function buildSavePayload(draft: EditablePolicyDraft) {
  const normalizedDraft = normalizeDraft(draft);

  return {
    slugifiedName: normalizedDraft.slugifiedName,
    label: normalizedDraft.label,
    description: normalizedDraft.description,
    permissions: normalizedDraft.permissions,
  };
}

function buildDraftPreview(draft: EditablePolicyDraft) {
  const normalizedDraft = normalizeDraft(draft);

  return {
    slugified_name: normalizedDraft.slugifiedName,
    label: normalizedDraft.label,
    description: normalizedDraft.description,
    permissions: normalizedDraft.permissions,
  };
}

export function RbacPolicyStudio({
  policies,
  permissionOptions,
  isLoading = false,
  error = null,
  onCreatePolicy,
  onUpdatePolicy,
  onDeletePolicy,
}: {
  policies: RbacPolicyStudioPolicy[];
  permissionOptions: RbacPolicyStudioPermissionOption[];
  isLoading?: boolean;
  error?: string | null;
  onCreatePolicy: (
    input: Pick<RbacPolicyStudioPolicy, "description" | "label" | "permissions" | "slugifiedName">,
  ) => Promise<RbacPolicyStudioPolicy>;
  onUpdatePolicy: (
    policyId: number,
    input: Pick<RbacPolicyStudioPolicy, "description" | "label" | "permissions" | "slugifiedName">,
  ) => Promise<RbacPolicyStudioPolicy>;
  onDeletePolicy: (policy: RbacPolicyStudioPolicy) => Promise<void>;
}) {
  const permissionGroups = useMemo(
    () => buildPermissionGroups(permissionOptions),
    [permissionOptions],
  );
  const [selectedPolicyKey, setSelectedPolicyKey] = useState(() => policies[0]?.slugifiedName ?? "");
  const [draft, setDraft] = useState<EditablePolicyDraft | null>(() =>
    policies[0] ? toDraft(policies[0]) : null,
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<{
    status: "idle" | "error" | "saved" | "saving";
    message: string | null;
  }>({
    status: "idle",
    message: null,
  });

  const displayedPolicies = useMemo(() => {
    if (!draft?.isNew) {
      return policies;
    }

    return [
      ...policies,
      {
        id: -1,
        slugifiedName: draft.slugifiedName,
        label: draft.label,
        description: draft.description,
        permissions: draft.permissions,
        isSystem: false,
        isEditable: true,
      },
    ];
  }, [draft, policies]);
  const selectedPolicy =
    displayedPolicies.find((policy) => policy.slugifiedName === selectedPolicyKey) ?? null;

  useEffect(() => {
    if (!policies.length) {
      if (!draft?.isNew) {
        setSelectedPolicyKey("");
        setDraft(null);
        setIsDirty(false);
      }
      return;
    }

    if (draft?.isNew) {
      return;
    }

    const matchedPolicy =
      policies.find((policy) => policy.slugifiedName === selectedPolicyKey) ?? policies[0];

    if (!matchedPolicy) {
      return;
    }

    setSelectedPolicyKey(matchedPolicy.slugifiedName);

    if (!isDirty) {
      setDraft(toDraft(matchedPolicy));
    }
  }, [draft?.isNew, isDirty, policies, selectedPolicyKey]);

  function selectPolicy(policy: RbacPolicyStudioPolicy) {
    setSelectedPolicyKey(policy.slugifiedName);
    setDraft(toDraft(policy));
    setIsDirty(false);
    setSaveState({ status: "idle", message: null });
  }

  function updateDraft(updater: (current: EditablePolicyDraft) => EditablePolicyDraft) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return normalizeDraft(updater(current));
    });
    setIsDirty(true);
    setSaveState({ status: "idle", message: null });
  }

  function handleAddPolicy() {
    const nextDraft = createEmptyDraft();
    setDraft(nextDraft);
    setSelectedPolicyKey(nextDraft.slugifiedName);
    setIsDirty(true);
    setSaveState({ status: "idle", message: null });
  }

  function handleResetDraft() {
    if (!draft) {
      return;
    }

    if (draft.isNew) {
      const fallback = policies[0] ?? null;
      setDraft(fallback ? toDraft(fallback) : null);
      setSelectedPolicyKey(fallback?.slugifiedName ?? "");
    } else {
      const matchedPolicy = policies.find((policy) => policy.id === draft.id);
      setDraft(matchedPolicy ? toDraft(matchedPolicy) : null);
      setSelectedPolicyKey(matchedPolicy?.slugifiedName ?? "");
    }

    setIsDirty(false);
    setSaveState({ status: "idle", message: null });
  }

  async function handleSave() {
    if (!draft) {
      return;
    }

    setSaveState({
      status: "saving",
      message: null,
    });

    try {
      const payload = buildSavePayload(draft);
      const savedPolicy = draft.isNew
        ? await onCreatePolicy(payload)
        : await onUpdatePolicy(draft.id!, payload);

      setDraft(toDraft(savedPolicy));
      setSelectedPolicyKey(savedPolicy.slugifiedName);
      setIsDirty(false);
      setSaveState({
        status: "saved",
        message: "Saved.",
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to save policy.",
      });
    }
  }

  async function handleDelete() {
    if (!draft || draft.isNew || !selectedPolicy || !draft.isEditable) {
      return;
    }

    setSaveState({
      status: "saving",
      message: null,
    });

    try {
      await onDeletePolicy(selectedPolicy);
      const fallbackPolicy = policies.find((policy) => policy.id !== selectedPolicy.id) ?? null;
      setDraft(fallbackPolicy ? toDraft(fallbackPolicy) : null);
      setSelectedPolicyKey(fallbackPolicy?.slugifiedName ?? "");
      setIsDirty(false);
      setSaveState({
        status: "saved",
        message: "Deleted.",
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to delete policy.",
      });
    }
  }

  const editingLocked = draft ? !draft.isEditable : true;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Shell policy studio</CardTitle>
            <CardDescription>
              Define reusable Command Center permission bundles. The built-in `light-user`,
              `dev-user`, and `org-admin-user` baselines are fixed and cannot be changed here.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleAddPolicy}>
              <Plus className="h-4 w-4" />
              Add policy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleResetDraft}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!draft || !isDirty || saveState.status === "saving" || editingLocked}
              onClick={() => {
                void handleSave();
              }}
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
            {saveState.message ??
              (editingLocked
                ? "This built-in policy is read-only."
                : isDirty
                  ? "You have unsaved changes."
                  : "No unsaved changes.")}
          </div>
          <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3 text-sm text-muted-foreground">
            Hidden system policies such as `admin` and `platform-admin` are not shown here. Those
            access classes stay backend-enforced.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Policies</CardTitle>
            <CardDescription>
              Select a policy to inspect or edit its shell permission bundle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading policies...
              </div>
            ) : error ? (
              <div className="rounded-[calc(var(--radius)-8px)] border border-danger/30 bg-danger/5 px-3 py-3 text-sm text-danger">
                {error}
              </div>
            ) : displayedPolicies.length ? (
              displayedPolicies.map((policy) => {
                const active = policy.slugifiedName === selectedPolicyKey;
                const draftPolicy = draft?.slugifiedName === policy.slugifiedName ? draft : null;
                const permissionCount = draftPolicy?.permissions.length ?? policy.permissions.length;
                const badgeLabel = draftPolicy?.isNew
                  ? "New"
                  : policy.isSystem
                    ? "Built-in"
                    : "Custom";

                return (
                  <button
                    key={`${policy.id}:${policy.slugifiedName}`}
                    type="button"
                    className={cn(
                      "w-full rounded-[calc(var(--radius)-6px)] border px-4 py-3 text-left transition-colors",
                      active
                        ? "border-primary/40 bg-primary/8 text-foreground"
                        : "border-border/70 bg-background/40 text-foreground hover:border-primary/20 hover:bg-background/70",
                    )}
                    onClick={() => {
                      if (draftPolicy?.isNew && draft?.slugifiedName === policy.slugifiedName) {
                        setSelectedPolicyKey(policy.slugifiedName);
                        return;
                      }

                      selectPolicy(policy);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{policy.label}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {policy.slugifiedName}
                        </div>
                      </div>
                      <Badge variant={policy.isSystem ? "secondary" : "neutral"}>{badgeLabel}</Badge>
                    </div>
                    <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {policy.description || "No description yet."}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      <span>{permissionCount} permissions</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3 text-sm text-muted-foreground">
                No visible policies were returned from the Command Center endpoint.
              </div>
            )}
          </CardContent>
        </Card>

        {draft ? (
          <div className="space-y-6">
            <Card>
              <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1.5">
                  <CardTitle>{draft.label}</CardTitle>
                  <CardDescription>
                    Update the shell-facing policy definition and save when ready.
                  </CardDescription>
                </div>
                {!draft.isNew && draft.isEditable ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void handleDelete();
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
                      value={draft.slugifiedName}
                      disabled={editingLocked}
                      onChange={(event) => {
                        updateDraft((current) => ({
                          ...current,
                          slugifiedName: event.target.value,
                        }));
                        setSelectedPolicyKey(slugifyPolicyId(event.target.value || draft.label));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Display label
                    </div>
                    <Input
                      value={draft.label}
                      disabled={editingLocked}
                      onChange={(event) => {
                        updateDraft((current) => ({
                          ...current,
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
                    value={draft.description}
                    className="min-h-28"
                    disabled={editingLocked}
                    onChange={(event) => {
                      updateDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }));
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Permission grants</CardTitle>
                <CardDescription>
                  Choose which shell permissions this policy carries when it is assigned to a user.
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
                        const enabled = draft.permissions.includes(option.id);

                        return (
                          <label
                            key={option.id}
                            className={cn(
                              "flex items-start gap-3 rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3",
                              editingLocked && "opacity-75",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-border text-primary"
                              checked={enabled}
                              disabled={editingLocked}
                              onChange={() => {
                                updateDraft((current) => ({
                                  ...current,
                                  permissions: enabled
                                    ? current.permissions.filter((permission) => permission !== option.id)
                                    : [...current.permissions, option.id],
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
                <CardTitle>Payload preview</CardTitle>
                <CardDescription>
                  This is the exact write shape sent to the Command Center policy endpoint.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/55 p-4 text-xs leading-6 text-foreground">
                  {JSON.stringify(buildDraftPreview(draft), null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Select or create a policy to start editing.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
