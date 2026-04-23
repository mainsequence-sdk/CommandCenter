import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AgentSessionDetailSnapshot } from "./model";

function formatSessionTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat().format(value);
}

function SessionField({
  description,
  label,
  mono = false,
  value,
}: {
  label: string;
  description?: string | null;
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
      {description ? <div className="text-xs leading-5 text-muted-foreground">{description}</div> : null}
    </div>
  );
}

export function AgentSessionDetailSections({
  detail,
}: {
  detail: AgentSessionDetailSnapshot;
}) {
  const [openPayloadKey, setOpenPayloadKey] = useState<string | null>(null);
  const core = detail.core;

  const rawPayloads = useMemo(
    () =>
      [
        {
          key: "metadata",
          label: "Metadata",
          value: core?.metadata ?? null,
        },
        {
          key: "runtime-config-override",
          label: "Runtime Config Override",
          value: core?.runtimeConfigOverride ?? null,
        },
        {
          key: "runtime-config-snapshot",
          label: "Runtime Config Snapshot",
          value: core?.runtimeConfigSnapshot ?? null,
        },
        {
          key: "input-payload",
          label: "Input Payload",
          value: core?.inputPayload ?? null,
        },
        {
          key: "output-payload",
          label: "Output Payload",
          value: core?.outputPayload ?? null,
        },
      ].filter(
        (entry): entry is { key: string; label: string; value: Record<string, unknown> } =>
          Boolean(entry.value && Object.keys(entry.value).length > 0),
      ),
    [core],
  );

  const openPayload = rawPayloads.find((entry) => entry.key === openPayloadKey) ?? null;

  if (!core) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Overview
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SessionField label="Session ID" value={core.sessionId} mono />
          <SessionField label="Display Session ID" value={detail.context.sessionDisplayId} mono />
          <SessionField label="Status" value={core.status} />
          <SessionField label="Working" value={formatBoolean(core.working || detail.context.working)} />
          <SessionField label="Agent Name" value={core.agentName || detail.context.requestName} />
          <SessionField label="Actor Name" value={core.actorName || detail.context.displayName} />
          <SessionField label="Request Name" value={detail.context.requestName} mono />
          <SessionField label="Agent Unique ID" value={detail.context.agentUniqueId} mono />
        </div>

        {core.title ? (
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Title
            </div>
            <div className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3 text-sm leading-6 text-foreground">
              {core.title}
            </div>
          </div>
        ) : null}

        {core.summary || detail.context.preview ? (
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Summary
            </div>
            <div className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3 text-sm leading-6 text-foreground">
              {core.summary || detail.context.preview}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Lifecycle
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SessionField label="Started At" value={formatSessionTimestamp(core.startedAt)} />
          <SessionField label="Ended At" value={formatSessionTimestamp(core.endedAt)} />
          <SessionField label="Last Activity" value={formatSessionTimestamp(core.lastActivityAt || detail.context.updatedAt)} />
          <SessionField label="Step Type" value={core.stepType} />
          <SessionField label="Actor Type" value={core.actorType} />
          <SessionField label="Sequence" value={formatNumber(core.sequence)} mono />
          <SessionField label="Parent Step" value={core.parentStepId} mono />
          <SessionField label="Created By User" value={core.createdByUserId} mono />
        </div>
      </div>

      <div className="space-y-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Runtime
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SessionField label="Runtime State" value={core.runtimeState || detail.context.runtimeState} mono />
          <SessionField label="Runtime Session ID" value={detail.context.runtimeSessionId} mono />
          <SessionField label="Thread ID" value={detail.context.threadId} mono />
          <SessionField label="Session Key" value={detail.context.sessionKey} mono />
          <SessionField label="Project ID" value={detail.context.projectId} mono />
          <SessionField label="Working Directory" value={detail.context.cwd} mono />
          <SessionField label="Handle" value={detail.context.handleUniqueId} mono />
          <SessionField label="External Step ID" value={core.externalStepId} mono />
        </div>
      </div>

      <div className="space-y-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Model
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SessionField label="Agent ID" value={core.agentId || detail.context.agentId} mono />
          <SessionField label="Provider" value={core.llmProvider} />
          <SessionField label="Model" value={core.llmModel} mono />
          <SessionField label="Engine" value={core.engineName} />
        </div>
      </div>

      {core.errorDetail ? (
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Error Detail
          </div>
          <div className="rounded-[14px] border border-danger/30 bg-danger/8 px-3 py-3 font-mono text-xs leading-6 text-danger">
            {core.errorDetail}
          </div>
        </div>
      ) : null}

      {core.boundHandles.length > 0 ? (
        <div className="space-y-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Bound Handles
          </div>
          <div className="space-y-2">
            {core.boundHandles.map((handle) => (
              <div
                key={handle.id}
                className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <SessionField label="Handle ID" value={handle.id} mono />
                  <SessionField label="Unique ID" value={handle.handleUniqueId} mono />
                  <SessionField label="Owner User" value={handle.ownerUserId} mono />
                  <SessionField label="Locked" value={formatBoolean(handle.isLocked)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {rawPayloads.length > 0 ? (
        <div className="space-y-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Raw Payloads
          </div>
          <div className="flex flex-wrap gap-2">
            {rawPayloads.map((entry) => (
              <Button
                key={entry.key}
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpenPayloadKey(entry.key);
                }}
              >
                {entry.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog
        open={openPayload !== null}
        onClose={() => {
          setOpenPayloadKey(null);
        }}
        title={openPayload?.label || "Raw Payload"}
        description="Raw JSON payload captured on the AgentSession detail serializer."
        className="max-w-[min(920px,calc(100vw-24px))]"
      >
        <pre className="max-h-[70vh] overflow-auto rounded-[16px] border border-border/60 bg-background/45 p-4 text-xs leading-6 text-foreground">
          {openPayload ? JSON.stringify(openPayload.value, null, 2) : ""}
        </pre>
      </Dialog>
    </div>
  );
}
