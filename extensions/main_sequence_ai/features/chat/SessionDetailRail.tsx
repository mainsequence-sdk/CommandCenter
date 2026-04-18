import { useEffect, useMemo, useState } from "react";

import { ChevronDown, Loader2, Wrench } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useChatFeature } from "../../assistant-ui/ChatProvider";
import { resolveMainSequenceAiAssistantEndpoint } from "../../runtime/assistant-endpoint";
import {
  patchSessionConfig,
  SessionConfigApiError,
} from "../../runtime/session-config-api";
import { getSessionInsightsInfoNode } from "../../assistant-ui/session-insights";
import { RepoDiffTool } from "./components/RepoDiffTool";

function formatSessionTimestamp(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return `${value}%`;
}

function formatBoolean(value: boolean | null) {
  if (value === null) {
    return null;
  }

  return value ? "Enabled" : "Disabled";
}

function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

function SessionField({
  label,
  description,
  value,
  mono = false,
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

function SessionInsightsContent({
  onSessionMissing,
}: {
  onSessionMissing: () => void;
}) {
  const { activeSessionSummary, refreshSessionInsights } = useChatFeature();
  const assistantEndpoint = resolveMainSequenceAiAssistantEndpoint();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const sessionInsights = activeSessionSummary?.sessionInsights ?? null;
  const usageTokens = sessionInsights?.usage?.tokens ?? null;
  const lastTurnTokens = sessionInsights?.lastTurn?.tokens ?? null;
  const [compactionEnabledInput, setCompactionEnabledInput] = useState(false);
  const [reserveTokensInput, setReserveTokensInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const editableCompaction = sessionInsights?.editable?.config?.compaction ?? null;
  const currentCompactionConfig = sessionInsights?.config?.compaction ?? null;
  const sessionLookupId =
    activeSessionSummary?.runtimeSessionId || activeSessionSummary?.sessionDisplayId || null;
  const getInfo = (path: readonly string[]) => getSessionInsightsInfoNode(sessionInsights, path);
  const fieldLabel = (path: readonly string[], fallback: string) => getInfo(path)?.label || fallback;
  const fieldDescription = (path: readonly string[]) => getInfo(path)?.description || null;

  useEffect(() => {
    setCompactionEnabledInput(currentCompactionConfig?.enabled ?? false);
    setReserveTokensInput(
      currentCompactionConfig?.reserveTokens !== null &&
        currentCompactionConfig?.reserveTokens !== undefined
        ? String(currentCompactionConfig.reserveTokens)
        : "",
    );
    setSaveError(null);
    setSaveSuccess(null);
  }, [
    currentCompactionConfig?.enabled,
    currentCompactionConfig?.reserveTokens,
    sessionLookupId,
  ]);

  const parsedReserveTokens = useMemo(() => {
    const trimmed = reserveTokensInput.trim();

    if (!trimmed) {
      return null;
    }

    if (!/^-?\d+$/.test(trimmed)) {
      return Number.NaN;
    }

    return Number(trimmed);
  }, [reserveTokensInput]);

  const reserveTokensValidationError = useMemo(() => {
    const field = editableCompaction?.reserveTokens;
    const nextReserveTokens =
      parsedReserveTokens !== null && Number.isFinite(parsedReserveTokens)
        ? parsedReserveTokens
        : null;

    if (!field?.editable) {
      return null;
    }

    if (reserveTokensInput.trim() === "") {
      return "Reserve tokens is required.";
    }

    if (nextReserveTokens === null) {
      return "Reserve tokens must be an integer.";
    }

    if (field.min !== null && nextReserveTokens < field.min) {
      return `Reserve tokens must be at least ${field.min}.`;
    }

    if (field.max !== null && nextReserveTokens > field.max) {
      return `Reserve tokens must be at most ${field.max}.`;
    }

    if (field.step !== null && field.step > 0) {
      const base = field.min ?? 0;
      const offset = nextReserveTokens - base;

      if (offset % field.step !== 0) {
        return `Reserve tokens must change in steps of ${field.step}.`;
      }
    }

    return null;
  }, [editableCompaction?.reserveTokens, parsedReserveTokens, reserveTokensInput]);

  const changedCompactionPatch = useMemo(() => {
    const patch: { enabled?: boolean; reserveTokens?: number } = {};
    const nextReserveTokens =
      parsedReserveTokens !== null && Number.isFinite(parsedReserveTokens)
        ? parsedReserveTokens
        : null;

    if (
      editableCompaction?.enabled?.editable &&
      currentCompactionConfig?.enabled !== compactionEnabledInput
    ) {
      patch.enabled = compactionEnabledInput;
    }

    if (
      editableCompaction?.reserveTokens?.editable &&
      !reserveTokensValidationError &&
      nextReserveTokens !== null &&
      currentCompactionConfig?.reserveTokens !== nextReserveTokens
    ) {
      patch.reserveTokens = nextReserveTokens;
    }

    return patch;
  }, [
    compactionEnabledInput,
    currentCompactionConfig?.enabled,
    currentCompactionConfig?.reserveTokens,
    editableCompaction?.enabled?.editable,
    editableCompaction?.reserveTokens?.editable,
    parsedReserveTokens,
    reserveTokensValidationError,
  ]);

  const hasConfigChanges = Object.keys(changedCompactionPatch).length > 0;

  if (!activeSessionSummary) {
    return null;
  }

  return (
    <div className="space-y-5">
      {activeSessionSummary.isLoadingInsights ? (
        <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading session insights
        </div>
      ) : null}

      {!activeSessionSummary.isLoadingInsights && activeSessionSummary.insightsError ? (
        <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
          <div className="font-medium">Failed to load session insights.</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">
            {activeSessionSummary.insightsError}
          </div>
        </div>
      ) : null}

      {!activeSessionSummary.isLoadingInsights &&
      !activeSessionSummary.insightsError &&
      !sessionInsights ? (
        <div className="rounded-[16px] border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">
          No session insights available for this session.
        </div>
      ) : null}

      {!activeSessionSummary.isLoadingInsights &&
      !activeSessionSummary.insightsError &&
      sessionInsights ? (
        <>
          <div className="space-y-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Session Config
            </div>
            <div className="space-y-4 rounded-[16px] border border-border/60 bg-background/35 px-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">
                    {fieldLabel(["config", "compaction", "enabled"], "Compaction Enabled")}
                  </div>
                  {editableCompaction?.enabled?.editable ? (
                    <label className="flex items-center gap-3 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={compactionEnabledInput}
                        onChange={(event) => {
                          setCompactionEnabledInput(event.target.checked);
                          setSaveError(null);
                          setSaveSuccess(null);
                        }}
                      />
                      Enable compaction for future turns
                    </label>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {formatBoolean(sessionInsights.context?.compactionEnabled ?? null)}
                    </div>
                  )}
                  {fieldDescription(["config", "compaction", "enabled"]) ? (
                    <div className="text-xs leading-5 text-muted-foreground">
                      {fieldDescription(["config", "compaction", "enabled"])}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">
                    {fieldLabel(["config", "compaction", "reserveTokens"], "Reserve Tokens")}
                  </div>
                  {editableCompaction?.reserveTokens?.editable ? (
                    <>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={editableCompaction.reserveTokens.min ?? undefined}
                        max={editableCompaction.reserveTokens.max ?? undefined}
                        step={editableCompaction.reserveTokens.step ?? undefined}
                        value={reserveTokensInput}
                        onChange={(event) => {
                          setReserveTokensInput(event.target.value);
                          setSaveError(null);
                          setSaveSuccess(null);
                        }}
                      />
                      <div className="text-xs text-muted-foreground">
                        {[
                          editableCompaction.reserveTokens.unit,
                          editableCompaction.reserveTokens.min !== null
                            ? `min ${editableCompaction.reserveTokens.min}`
                            : null,
                          editableCompaction.reserveTokens.max !== null
                            ? `max ${editableCompaction.reserveTokens.max}`
                            : null,
                          editableCompaction.reserveTokens.step !== null
                            ? `step ${editableCompaction.reserveTokens.step}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                      {reserveTokensValidationError ? (
                        <div className="text-xs text-danger">{reserveTokensValidationError}</div>
                      ) : null}
                      {fieldDescription(["config", "compaction", "reserveTokens"]) ? (
                        <div className="text-xs leading-5 text-muted-foreground">
                          {fieldDescription(["config", "compaction", "reserveTokens"])}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground font-mono">
                      {formatNumber(sessionInsights.context?.compactionReserveTokens ?? null)}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SessionField
                  label={fieldLabel(["config", "compaction", "thresholdTokens"], "Threshold Tokens")}
                  description={fieldDescription(["config", "compaction", "thresholdTokens"])}
                  value={formatNumber(sessionInsights.context?.compactionThresholdTokens ?? null)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["config", "compaction", "thresholdPercent"], "Threshold Percent")}
                  description={fieldDescription(["config", "compaction", "thresholdPercent"])}
                  value={formatPercent(sessionInsights.context?.compactionThresholdPercent ?? null)}
                />
              </div>

              {saveError ? (
                <div className="rounded-[14px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
                  {saveError}
                </div>
              ) : null}

              {saveSuccess ? (
                <div className="rounded-[14px] border border-primary/20 bg-primary/8 px-3 py-3 text-sm text-foreground">
                  {saveSuccess}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => {
                    setCompactionEnabledInput(currentCompactionConfig?.enabled ?? false);
                    setReserveTokensInput(
                      currentCompactionConfig?.reserveTokens !== null &&
                        currentCompactionConfig?.reserveTokens !== undefined
                        ? String(currentCompactionConfig.reserveTokens)
                        : "",
                    );
                    setSaveError(null);
                    setSaveSuccess(null);
                  }}
                >
                  Reset
                </Button>
                <Button
                  disabled={
                    isSaving ||
                    !sessionLookupId ||
                    !hasConfigChanges ||
                    Boolean(reserveTokensValidationError)
                  }
                  onClick={async () => {
                    if (!sessionLookupId || !hasConfigChanges) {
                      return;
                    }

                    setIsSaving(true);
                    setSaveError(null);
                    setSaveSuccess(null);

                    try {
                      const response = await patchSessionConfig({
                        assistantEndpoint,
                        body: {
                          sessionId: sessionLookupId,
                          config: {
                            compaction: changedCompactionPatch,
                          },
                        },
                        token: sessionToken,
                        tokenType: sessionTokenType,
                      });

                      setSaveSuccess(
                        response.updatedFields.length > 0
                          ? `Updated ${response.updatedFields.join(", ")}.`
                          : "Session config updated.",
                      );
                      refreshSessionInsights();
                    } catch (error) {
                      if (
                        error instanceof SessionConfigApiError &&
                        (error.code === "session_not_found" ||
                          error.code === "session_metadata_missing")
                      ) {
                        setSaveError("Session config is no longer available. Refreshing session state.");
                        refreshSessionInsights();
                        onSessionMissing();
                        return;
                      }

                      setSaveError(
                        error instanceof Error
                          ? error.message
                          : "Session config update failed.",
                      );
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save changes
                </Button>
              </div>
            </div>
          </div>

          {sessionInsights.model ? (
            <div className="space-y-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Model
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <SessionField label="Provider" value={sessionInsights.model.provider} />
                <SessionField
                  label={fieldLabel(["config", "model", "provider"], "Provider")}
                  description={fieldDescription(["config", "model", "provider"])}
                  value={sessionInsights.model.provider}
                />
                <SessionField
                  label={fieldLabel(["config", "model", "model"], "Model")}
                  description={fieldDescription(["config", "model", "model"])}
                  value={sessionInsights.model.model}
                  mono
                />
                <SessionField
                  label={fieldLabel(["config", "model", "reasoningEffort"], "Reasoning Effort")}
                  description={fieldDescription(["config", "model", "reasoningEffort"])}
                  value={sessionInsights.model.reasoningEffort}
                />
                <SessionField
                  label={fieldLabel(["config", "model", "contextWindow"], "Context Window")}
                  description={fieldDescription(["config", "model", "contextWindow"])}
                  value={formatNumber(sessionInsights.model.contextWindow)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["config", "model", "maxOutputTokens"], "Max Output Tokens")}
                  description={fieldDescription(["config", "model", "maxOutputTokens"])}
                  value={formatNumber(sessionInsights.model.maxOutputTokens)}
                  mono
                />
              </div>
            </div>
          ) : null}

          {sessionInsights.usage ? (
            <div className="space-y-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Usage
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <SessionField
                  label={fieldLabel(["usage", "userMessages"], "User Messages")}
                  description={fieldDescription(["usage", "userMessages"])}
                  value={formatNumber(sessionInsights.usage.userMessages)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["usage", "assistantMessages"], "Assistant Messages")}
                  description={fieldDescription(["usage", "assistantMessages"])}
                  value={formatNumber(sessionInsights.usage.assistantMessages)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["usage", "assistantTurns"], "Assistant Turns")}
                  description={fieldDescription(["usage", "assistantTurns"])}
                  value={formatNumber(sessionInsights.usage.assistantTurns)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["usage", "toolCalls"], "Tool Calls")}
                  description={fieldDescription(["usage", "toolCalls"])}
                  value={formatNumber(sessionInsights.usage.toolCalls)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["usage", "toolResults"], "Tool Results")}
                  description={fieldDescription(["usage", "toolResults"])}
                  value={formatNumber(sessionInsights.usage.toolResults)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["usage", "totalMessages"], "Total Messages")}
                  description={fieldDescription(["usage", "totalMessages"])}
                  value={formatNumber(sessionInsights.usage.totalMessages)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["usage", "estimatedCostUsd"], "Estimated Cost")}
                  description={fieldDescription(["usage", "estimatedCostUsd"])}
                  value={formatCurrency(sessionInsights.usage.estimatedCostUsd)}
                />
              </div>

              {usageTokens ? (
                <div className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Cumulative Tokens
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <SessionField
                      label={fieldLabel(["usage", "tokens", "input"], "Input")}
                      description={fieldDescription(["usage", "tokens", "input"])}
                      value={formatNumber(usageTokens.input)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["usage", "tokens", "output"], "Output")}
                      description={fieldDescription(["usage", "tokens", "output"])}
                      value={formatNumber(usageTokens.output)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["usage", "tokens", "cacheRead"], "Cache Read")}
                      description={fieldDescription(["usage", "tokens", "cacheRead"])}
                      value={formatNumber(usageTokens.cacheRead)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["usage", "tokens", "cacheWrite"], "Cache Write")}
                      description={fieldDescription(["usage", "tokens", "cacheWrite"])}
                      value={formatNumber(usageTokens.cacheWrite)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["usage", "tokens", "total"], "Total")}
                      description={fieldDescription(["usage", "tokens", "total"])}
                      value={formatNumber(usageTokens.total)}
                      mono
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {sessionInsights.context ? (
            <div className="space-y-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Context
              </div>

              {sessionInsights.context.status === "unknown_after_compaction" ? (
                <div className="rounded-[14px] border border-warning/30 bg-warning/8 px-3 py-3 text-sm text-warning-foreground">
                  Context usage was compacted recently. The current context estimate is not trusted yet.
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <SessionField
                  label={fieldLabel(["context", "status"], "Status")}
                  description={fieldDescription(["context", "status"])}
                  value={sessionInsights.context.status}
                />
                <SessionField
                  label={fieldLabel(["context", "source"], "Source")}
                  description={fieldDescription(["context", "source"])}
                  value={sessionInsights.context.source}
                />
                <SessionField
                  label={fieldLabel(["context", "tokens"], "Context Tokens")}
                  description={fieldDescription(["context", "tokens"])}
                  value={formatNumber(sessionInsights.context.tokens)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["context", "contextWindow"], "Context Window")}
                  description={fieldDescription(["context", "contextWindow"])}
                  value={formatNumber(sessionInsights.context.contextWindow)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["context", "percentOfContextWindow"], "Window Used")}
                  description={fieldDescription(["context", "percentOfContextWindow"])}
                  value={formatPercent(sessionInsights.context.percentOfContextWindow)}
                />
                <SessionField
                  label={fieldLabel(["context", "compactionEnabled"], "Compaction")}
                  description={fieldDescription(["context", "compactionEnabled"])}
                  value={formatBoolean(sessionInsights.context.compactionEnabled)}
                />
                <SessionField
                  label={fieldLabel(["context", "compactionReserveTokens"], "Reserve Tokens")}
                  description={fieldDescription(["context", "compactionReserveTokens"])}
                  value={formatNumber(sessionInsights.context.compactionReserveTokens)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["context", "compactionThresholdTokens"], "Threshold Tokens")}
                  description={fieldDescription(["context", "compactionThresholdTokens"])}
                  value={formatNumber(sessionInsights.context.compactionThresholdTokens)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["context", "compactionThresholdPercent"], "Threshold Percent")}
                  description={fieldDescription(["context", "compactionThresholdPercent"])}
                  value={formatPercent(sessionInsights.context.compactionThresholdPercent)}
                />
                <SessionField
                  label={fieldLabel(["context", "tokensRemainingBeforeCompaction"], "Remaining Before Compaction")}
                  description={fieldDescription(["context", "tokensRemainingBeforeCompaction"])}
                  value={formatNumber(sessionInsights.context.tokensRemainingBeforeCompaction)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["context", "tokensRemainingBeforeContextLimit"], "Remaining Before Limit")}
                  description={fieldDescription(["context", "tokensRemainingBeforeContextLimit"])}
                  value={formatNumber(sessionInsights.context.tokensRemainingBeforeContextLimit)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["context", "latestCompaction"], "Latest Compaction")}
                  description={fieldDescription(["context", "latestCompaction"])}
                  value={sessionInsights.context.latestCompaction}
                  mono
                />
              </div>
            </div>
          ) : null}

          {sessionInsights.lastTurn ? (
            <div className="space-y-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Last Turn
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <SessionField
                  label={fieldLabel(["lastTurn", "completedAt"], "Completed At")}
                  description={fieldDescription(["lastTurn", "completedAt"])}
                  value={formatSessionTimestamp(sessionInsights.lastTurn.completedAt)}
                />
                <SessionField
                  label={fieldLabel(["lastTurn", "finishReason"], "Finish Reason")}
                  description={fieldDescription(["lastTurn", "finishReason"])}
                  value={sessionInsights.lastTurn.finishReason}
                />
                <SessionField
                  label={fieldLabel(["lastTurn", "errorMessage"], "Error")}
                  description={fieldDescription(["lastTurn", "errorMessage"])}
                  value={sessionInsights.lastTurn.errorMessage}
                />
                <SessionField
                  label={fieldLabel(["lastTurn", "model", "provider"], "Provider")}
                  description={fieldDescription(["lastTurn", "model", "provider"])}
                  value={sessionInsights.lastTurn.model.provider}
                />
                <SessionField
                  label={fieldLabel(["lastTurn", "model", "model"], "Model")}
                  description={fieldDescription(["lastTurn", "model", "model"])}
                  value={sessionInsights.lastTurn.model.model}
                  mono
                />
              </div>

              {lastTurnTokens ? (
                <div className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Last-Turn Tokens
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <SessionField
                      label={fieldLabel(["lastTurn", "tokens", "input"], "Input")}
                      description={fieldDescription(["lastTurn", "tokens", "input"])}
                      value={formatNumber(lastTurnTokens.input)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["lastTurn", "tokens", "output"], "Output")}
                      description={fieldDescription(["lastTurn", "tokens", "output"])}
                      value={formatNumber(lastTurnTokens.output)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["lastTurn", "tokens", "cacheRead"], "Cache Read")}
                      description={fieldDescription(["lastTurn", "tokens", "cacheRead"])}
                      value={formatNumber(lastTurnTokens.cacheRead)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["lastTurn", "tokens", "cacheWrite"], "Cache Write")}
                      description={fieldDescription(["lastTurn", "tokens", "cacheWrite"])}
                      value={formatNumber(lastTurnTokens.cacheWrite)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["lastTurn", "tokens", "total"], "Total")}
                      description={fieldDescription(["lastTurn", "tokens", "total"])}
                      value={formatNumber(lastTurnTokens.total)}
                      mono
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function SessionDetailRail() {
  const { activeSessionSummary } = useChatFeature();
  const [sessionDetailsOpen, setSessionDetailsOpen] = useState(false);
  const [sessionInsightsModalOpen, setSessionInsightsModalOpen] = useState(false);
  const hasBackendSession = Boolean(
    activeSessionSummary?.sessionDisplayId || activeSessionSummary?.runtimeSessionId,
  );

  if (!activeSessionSummary || !hasBackendSession) {
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
        <div className="border-b border-border/60 px-4 py-4">
          <div className="text-sm font-semibold text-foreground">Session Details</div>
          <div className="text-xs text-muted-foreground">
            Inspect the currently selected conversation session.
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 text-sm text-muted-foreground">
          No active session. The next conversation will start with the orchestrator.
        </div>
      </section>
    );
  }

  const lastActivity = formatSessionTimestamp(activeSessionSummary.updatedAt);
  const sessionInsights = activeSessionSummary.sessionInsights;
  const insightsSummary = activeSessionSummary.isLoadingInsights
    ? "Loading insights"
    : activeSessionSummary.insightsError
      ? "Insights unavailable"
      : sessionInsights?.model?.model || sessionInsights?.context?.status || "Open model, usage, and context details";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="border-b border-border/60 px-4 py-4">
        <div className="text-sm font-semibold text-foreground">Session Details</div>
        <div className="text-xs text-muted-foreground">
          Inspect the current conversation session.
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Conversation With
            </div>
            <div className="font-mono text-sm font-semibold text-primary">
              {activeSessionSummary.requestName}
            </div>
            {activeSessionSummary.agentUniqueId ? (
              <div className="font-mono text-xs text-muted-foreground">
                {activeSessionSummary.agentUniqueId}
              </div>
            ) : null}
          </div>

          <section className="rounded-[16px] border border-border/60 bg-background/35">
            <button
              type="button"
              aria-expanded={sessionDetailsOpen}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
              onClick={() => {
                setSessionDetailsOpen((current) => !current);
              }}
            >
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Session Metadata
                </div>
                <div className="mt-1 text-sm text-foreground">
                  Session ids, runtime state, and working context.
                </div>
              </div>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", sessionDetailsOpen && "rotate-180")}
              />
            </button>

            {sessionDetailsOpen ? (
              <div className="space-y-5 border-t border-border/60 px-3 py-3">
                <SessionField
                  label="Session ID"
                  value={activeSessionSummary.sessionDisplayId}
                  mono
                />
                <SessionField label="Handle" value={activeSessionSummary.handleUniqueId} mono />
                <SessionField label="Agent ID" value={activeSessionSummary.agentId} mono />
                <SessionField label="Last Activity" value={lastActivity || null} />
                <SessionField label="Project ID" value={activeSessionSummary.projectId} mono />
                <SessionField
                  label="Runtime Session ID"
                  value={activeSessionSummary.runtimeSessionId}
                  mono
                />
                <SessionField label="Thread ID" value={activeSessionSummary.threadId} mono />
                <SessionField label="Session Key" value={activeSessionSummary.sessionKey} mono />
                <SessionField label="Working Directory" value={activeSessionSummary.cwd} mono />

                {activeSessionSummary.preview ? (
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Summary
                    </div>
                    <div className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3 text-sm leading-6 text-foreground">
                      {activeSessionSummary.preview}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-[16px] border border-border/60 bg-background/35">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-background/25"
              onClick={() => {
                setSessionInsightsModalOpen(true);
              }}
            >
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Session Insights
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {insightsSummary}
                </div>
              </div>
              <div className="text-xs text-primary">Open</div>
            </button>
          </section>

          <div className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Available Tools
            </div>

            {activeSessionSummary.isLoadingTools ? (
              <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading session tools
              </div>
            ) : null}

            {!activeSessionSummary.isLoadingTools && activeSessionSummary.toolsError ? (
              <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
                <div className="font-medium">Failed to load available tools.</div>
                <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">
                  {activeSessionSummary.toolsError}
                </div>
              </div>
            ) : null}

            {!activeSessionSummary.isLoadingTools &&
            !activeSessionSummary.toolsError &&
            activeSessionSummary.availableTools.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">
                No tools available for this session.
              </div>
            ) : null}

            {!activeSessionSummary.isLoadingTools &&
            !activeSessionSummary.toolsError &&
            activeSessionSummary.availableTools.length > 0
              ? activeSessionSummary.availableTools.map((tool) => (
                  tool.kind === "repo_diff" ? (
                    <RepoDiffTool key={`${tool.toolKey}:${tool.url}`} tool={tool} />
                  ) : (
                    <div
                      key={`${tool.toolKey}:${tool.url}`}
                      className="rounded-[16px] border border-border/60 bg-background/45 px-3 py-3"
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Wrench className="h-4 w-4 text-primary" />
                        <span className="font-mono">{tool.toolKey}</span>
                      </div>
                      <div className="mt-2 break-all font-mono text-[11px] leading-5 text-muted-foreground">
                        {tool.url}
                      </div>
                    </div>
                  )
                ))
              : null}
          </div>
        </div>
      </div>

      <Dialog
        open={sessionInsightsModalOpen}
        onClose={() => {
          setSessionInsightsModalOpen(false);
        }}
        title="Session Insights"
        description="Model, usage, context pressure, and last-turn stats for the current session."
        className="max-w-[min(980px,calc(100vw-24px))]"
      >
        <SessionInsightsContent
          onSessionMissing={() => {
            setSessionInsightsModalOpen(false);
          }}
        />
      </Dialog>
    </section>
  );
}
