import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  AgentCapabilityKind,
  AgentCapabilityRecord,
} from "./api";
import {
  deriveCapabilityFilename,
  normalizeCapabilityPath,
  synchronizeCapabilityDraft,
  type AgentCapabilityEditorDraft,
} from "./model";

const capabilityKindOptions: Array<{ value: AgentCapabilityKind; label: string }> = [
  { value: "prompt", label: "Prompt" },
  { value: "skill", label: "Skill" },
];

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

function formatCapabilitySize(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  return new Intl.NumberFormat().format(value);
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
      <div className={mono ? "font-mono text-[13px] text-foreground" : "text-sm text-foreground"}>
        {value}
      </div>
    </div>
  );
}

export function AgentCapabilityEditor({
  capability,
  draft,
  mode,
  readOnly = false,
  disabled = false,
  resourceDirty = false,
  contentDirty = false,
  metadataError = null,
  onChange,
}: {
  capability?: AgentCapabilityRecord | null;
  draft: AgentCapabilityEditorDraft;
  mode: "create" | "edit";
  readOnly?: boolean;
  disabled?: boolean;
  resourceDirty?: boolean;
  contentDirty?: boolean;
  metadataError?: string | null;
  onChange: (nextDraft: AgentCapabilityEditorDraft) => void;
}) {
  const filename = deriveCapabilityFilename(
    draft.resource.kind,
    draft.resource.capabilityPath,
    draft.resource.name,
  );
  const controlsDisabled = readOnly || disabled;

  function commit(nextDraft: AgentCapabilityEditorDraft) {
    onChange(synchronizeCapabilityDraft(nextDraft));
  }

  function updateResourceField<K extends keyof AgentCapabilityEditorDraft["resource"]>(
    key: K,
    value: AgentCapabilityEditorDraft["resource"][K],
  ) {
    const currentDefaultPath = normalizeCapabilityPath(
      draft.resource.kind,
      draft.resource.capabilityPath,
      draft.resource.name,
    );
    const nextResource = {
      ...draft.resource,
      [key]: value,
    };

    if (key === "name") {
      const pathWasAutoDerived =
        draft.resource.capabilityPath.trim() === currentDefaultPath ||
        draft.resource.capabilityPath.trim().length === 0;

      if (pathWasAutoDerived) {
        nextResource.capabilityPath = normalizeCapabilityPath(
          nextResource.kind,
          nextResource.capabilityPath,
          String(value),
        );
      }
    }

    if (key === "kind" && mode === "create") {
      nextResource.capabilityPath = normalizeCapabilityPath(
        value as AgentCapabilityKind,
        draft.resource.capabilityPath,
        draft.resource.name,
      );
    }

    commit({
      resource: nextResource,
      content: {
        ...draft.content,
        filename,
      },
    });
  }

  return (
    <div className="space-y-5">
      <Card variant="nested">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Capability configuration</CardTitle>
              <CardDescription>
                Resource metadata saved through
                {" "}
                {mode === "create"
                  ? "POST /orm/api/agents/v1/capabilities/"
                  : "PATCH /orm/api/agents/v1/capabilities/{capability_uid}/"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">{formatCapabilityKind(draft.resource.kind)}</Badge>
              <Badge variant={resourceDirty ? "primary" : "secondary"}>
                {resourceDirty ? "Config changed" : "Config saved"}
              </Badge>
              <Badge variant={contentDirty ? "primary" : "secondary"}>
                {contentDirty ? "Content changed" : "Content saved"}
              </Badge>
              {capability ? (
                <Badge variant={capability.isEditable ? "success" : "warning"}>
                  {capability.isEditable ? "Editable" : "Read only"}
                </Badge>
              ) : null}
              {capability ? (
                <Badge variant={capability.hasContent ? "primary" : "neutral"}>
                  {capability.hasContent ? "Has content" : "No content"}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {readOnly ? (
            <div className="rounded-[calc(var(--radius)-8px)] border border-warning/35 bg-warning/10 px-3 py-3 text-sm text-warning">
              This capability is marked read only by the backend. Configuration and content are
              shown for inspection only.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                className="h-11 bg-card/70"
                disabled={controlsDisabled}
                value={draft.resource.name}
                onChange={(event) => updateResourceField("name", event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Kind</label>
              <Select
                className="h-11 w-full bg-card/70"
                disabled={controlsDisabled || mode === "edit"}
                value={draft.resource.kind}
                onChange={(event) =>
                  updateResourceField("kind", event.target.value as AgentCapabilityKind)
                }
              >
                {capabilityKindOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {mode === "edit" ? (
                <div className="text-xs text-muted-foreground">
                  Kind is locked after the capability resource exists.
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-muted-foreground">Capability path</label>
              <Input
                className="h-11 bg-card/70 font-mono text-[13px]"
                disabled={controlsDisabled}
                value={draft.resource.capabilityPath}
                onChange={(event) => updateResourceField("capabilityPath", event.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                {draft.resource.kind === "skill"
                  ? "Skill paths are normalized to end in SKILL.md."
                  : "Prompt filenames are derived from the last markdown segment in this path."}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Description</label>
            <Textarea
              className="min-h-[132px] bg-card/70"
              disabled={controlsDisabled}
              value={draft.resource.description}
              onChange={(event) => updateResourceField("description", event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Metadata (JSON object)</label>
            <Textarea
              className="min-h-[160px] bg-card/70 font-mono text-[13px] leading-6"
              disabled={controlsDisabled}
              value={draft.resource.metadataText}
              onChange={(event) => updateResourceField("metadataText", event.target.value)}
              placeholder="{}"
            />
            {metadataError ? (
              <div className="text-sm text-danger">{metadataError}</div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Metadata is submitted as JSON in the resource payload.
              </div>
            )}
          </div>

          {capability ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CapabilityField label="Capability UID" value={capability.uid} mono />
              <CapabilityField label="Source type" value={capability.sourceType} />
              <CapabilityField label="Source ref" value={capability.sourceRef} mono />
              <CapabilityField label="Created by user" value={capability.createdByUserUid} mono />
              <CapabilityField
                label="Updated"
                value={formatCapabilityDateTime(capability.updatedAt)}
              />
              <CapabilityField
                label="Content size"
                value={formatCapabilitySize(capability.contentSize)}
                mono
              />
              <CapabilityField label="Content SHA256" value={capability.contentSha256} mono />
              <CapabilityField label="Content MIME type" value={capability.contentMimeType} mono />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card variant="nested">
        <CardHeader>
          <CardTitle>Capability content</CardTitle>
          <CardDescription>
            Markdown content saved through PUT /orm/api/agents/v1/capabilities/{`{capability_uid}`}/content/
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Filename</label>
              <Input
                className="h-11 bg-card/70 font-mono text-[13px]"
                disabled
                value={filename}
              />
              <div className="text-xs text-muted-foreground">
                {draft.resource.kind === "skill"
                  ? "Skills always submit SKILL.md."
                  : "Prompts derive their filename from capability path and still submit it explicitly."}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Content MIME type</label>
              <Input
                className="h-11 bg-card/70 font-mono text-[13px]"
                disabled
                value={draft.content.contentMimeType}
              />
              <div className="text-xs text-muted-foreground">
                Content writes always submit text/markdown explicitly.
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card variant="nested">
              <CardHeader>
                <CardTitle>Markdown</CardTitle>
                <CardDescription>
                  Author the reusable prompt or skill content.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-[420px] bg-card/70 font-mono text-[13px] leading-6"
                  disabled={controlsDisabled}
                  value={draft.content.content}
                  onChange={(event) =>
                    commit({
                      ...draft,
                      content: {
                        ...draft.content,
                        content: event.target.value,
                      },
                    })
                  }
                  placeholder="# Capability content"
                />
              </CardContent>
            </Card>

            <Card variant="nested">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>Rendered markdown preview for the current content draft.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="min-h-[420px] rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/45 px-4 py-4">
                  {draft.content.content.trim() ? (
                    <MarkdownContent content={draft.content.content} />
                  ) : (
                    <div className="text-sm text-muted-foreground">No markdown content yet.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
