import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import type { AgentSessionDetailSnapshot } from "./model";
import { SessionField, formatSessionTimestamp, formatNumber } from "./sessionDetailUi";

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
          label: "Session Metadata",
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
      <Card variant="nested">
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>
            Canonical session identity, lifecycle state, and agent-facing labels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SessionField label="Session UID" value={core.sessionId} mono />
            <SessionField label="Display Session UID" value={detail.context.sessionDisplayId} mono />
            <SessionField label="Status" value={core.status} />
            <SessionField
              label="Working"
              value={core.working || detail.context.working ? "Yes" : "No"}
            />
            <SessionField label="Agent Type" value={core.agentType} />
            <SessionField label="Actor Name" value={core.actorName} />
            <SessionField label="Request Agent Type" value={detail.context.requestAgentType} mono />
            <SessionField label="Agent Unique Identifier" value={detail.context.agentUniqueId} mono />
          </div>

          {core.title ? (
            <div className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Title
              </div>
              <div className="mt-2 text-sm leading-6 text-foreground">{core.title}</div>
            </div>
          ) : null}

          {core.summary || detail.context.preview ? (
            <div className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Summary
              </div>
              <div className="mt-2 text-sm leading-6 text-foreground">
                {core.summary || detail.context.preview}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card variant="nested">
        <CardHeader>
          <CardTitle>Lifecycle</CardTitle>
          <CardDescription>Execution timing and backend-owned session state fields.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SessionField label="Started At" value={formatSessionTimestamp(core.startedAt)} />
            <SessionField label="Ended At" value={formatSessionTimestamp(core.endedAt)} />
            <SessionField
              label="Last Activity"
              value={formatSessionTimestamp(core.lastActivityAt || detail.context.updatedAt)}
            />
            <SessionField label="Step Type" value={core.stepType} />
            <SessionField label="Actor Type" value={core.actorType} />
            <SessionField label="Sequence" value={formatNumber(core.sequence)} mono />
            <SessionField label="Parent Session" value={core.parentStepId} mono />
            <SessionField label="Created By User" value={core.createdByUserId} mono />
          </div>
        </CardContent>
      </Card>

      <Card variant="nested">
        <CardHeader>
          <CardTitle>Runtime</CardTitle>
          <CardDescription>Session runtime identifiers and execution context.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SessionField label="Runtime State" value={core.runtimeState || detail.context.runtimeState} mono />
            <SessionField label="Runtime Session UID" value={detail.context.runtimeSessionId} mono />
            <SessionField label="Thread UID" value={detail.context.threadId} mono />
            <SessionField label="Session Key" value={detail.context.sessionKey} mono />
            <SessionField label="Project UID" value={detail.context.projectId} mono />
            <SessionField label="Working Directory" value={detail.context.cwd} mono />
            <SessionField
              label="Handle"
              value={core.boundHandle?.handleUniqueId ?? detail.context.handleUniqueId}
              mono
            />
            <SessionField label="External Step Key" value={core.externalStepId} mono />
          </div>
        </CardContent>
      </Card>

      <Card variant="nested">
        <CardHeader>
          <CardTitle>Model</CardTitle>
          <CardDescription>Provider, model, and runtime engine settings currently attached.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SessionField label="Agent UID" value={core.agentId || detail.context.agentId} mono />
            <SessionField label="Provider" value={core.llmProvider} />
            <SessionField label="Model" value={core.llmModel} mono />
            <SessionField label="Engine" value={core.engineName} />
          </div>
        </CardContent>
      </Card>

      {core.boundHandle ? (
        <Card variant="nested">
          <CardHeader>
            <CardTitle>Bound Handle</CardTitle>
            <CardDescription>The canonical handle returned by the AgentSession serializer.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SessionField label="Handle UID" value={core.boundHandle.id} mono />
              <SessionField label="Unique Identifier" value={core.boundHandle.handleUniqueId} mono />
              <SessionField label="Owner User" value={core.boundHandle.ownerUserId} mono />
              <SessionField label="Locked" value={core.boundHandle.isLocked ? "Yes" : "No"} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {core.errorDetail ? (
        <Card variant="nested">
          <CardHeader>
            <CardTitle>Error Detail</CardTitle>
            <CardDescription>Backend execution error returned on the session serializer.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-[14px] border border-danger/30 bg-danger/8 px-3 py-3 font-mono text-xs leading-6 text-danger">
              {core.errorDetail}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {rawPayloads.length > 0 ? (
        <Card variant="nested">
          <CardHeader>
            <CardTitle>Raw Payloads</CardTitle>
            <CardDescription>Large JSON fields are opened on demand instead of always rendered inline.</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
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
