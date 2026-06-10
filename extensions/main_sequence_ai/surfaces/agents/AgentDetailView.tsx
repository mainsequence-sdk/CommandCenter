import { useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  HighlightStyle,
  LanguageDescription,
  syntaxHighlighting,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useMutation, useQuery } from "@tanstack/react-query";
import CodeMirror from "@uiw/react-codemirror";
import { tags } from "@lezer/highlight";
import { ArrowLeft, ArrowUpRight, Bot, Loader2, RefreshCcw, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import {
  formatMainSequenceError,
  type EntitySummaryHeader,
} from "../../../main_sequence/common/api";
import { MainSequenceEntitySummaryCard } from "../../../main_sequence/common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistrySearch } from "../../../main_sequence/common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../main_sequence/common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../main_sequence/common/components/registryTable";
import { useRegistrySelection } from "../../../main_sequence/common/hooks/useRegistrySelection";
import {
  fetchAgentDetail,
  fetchAgentRuntimeId,
  fetchAgentSummary,
  type AgentImageDriftCheckRecord,
  type AgentImageDriftRecord,
  type AgentSearchResult,
  type AgentSummaryResponse,
} from "../../agent-search";
import { getAgentSessionDetailPath } from "../../agent-session-detail/routes";
import { useChatFeature } from "../../assistant-ui/ChatProvider";
import { CHAT_PAGE_PATH } from "../../assistant-ui/chat-ui-store";
import {
  deleteAgentSessionRequest,
  fetchLatestAgentSessions,
  getAgentSessionRecordSessionId,
  getAgentSessionRecordSummary,
  getAgentSessionRecordTitle,
  type AgentSessionApiRecord,
} from "../../runtime/agent-sessions-api";

const agentDetailTabs = [
  {
    id: "overview",
    label: "Overview",
    title: "Overview",
    body: "",
  },
  {
    id: "agent-card",
    label: "Agent Card",
    title: "Agent Card",
    body: "",
  },
  {
    id: "sessions",
    label: "Sessions",
    title: "Sessions",
    body: "",
  },
] as const;

export type AgentDetailTabId = (typeof agentDetailTabs)[number]["id"];

export const defaultAgentDetailTabId: AgentDetailTabId = "overview";

export function isAgentDetailTabId(value: string | null): value is AgentDetailTabId {
  return agentDetailTabs.some((tab) => tab.id === value);
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeOptionalObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeImageDriftCheck(
  value: AgentImageDriftCheckRecord | null | undefined,
) {
  const label = normalizeOptionalString(value?.label);

  if (!label) {
    return null;
  }

  return {
    key: normalizeOptionalString(value?.key) || label.toLowerCase().replace(/\s+/g, "_"),
    label,
    hasDrift: value?.has_drift === true,
    reason: normalizeOptionalString(value?.reason),
  };
}

type NormalizedImageDriftCheck = NonNullable<ReturnType<typeof normalizeImageDriftCheck>>;

function isNormalizedImageDriftCheck(
  value: ReturnType<typeof normalizeImageDriftCheck>,
): value is NormalizedImageDriftCheck {
  return value !== null;
}

function normalizeImageDrift(value: AgentImageDriftRecord | null | undefined) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const checks = Array.isArray(value.checks)
    ? value.checks
        .map((entry) => normalizeImageDriftCheck(entry))
        .filter(isNormalizedImageDriftCheck)
    : [];

  return {
    available: value.available === true,
    hasDrift: value.has_drift === true,
    detail: normalizeOptionalString(value.detail),
    checks,
  };
}

function resolveAgentImageDrift({
  detail,
  summary,
}: {
  detail: { image_drift?: AgentImageDriftRecord | null } | null | undefined;
  summary: AgentSummaryResponse | null | undefined;
}) {
  const summaryRecord = summary as Record<string, unknown> | null | undefined;
  const summaryExtensions = normalizeOptionalObject(summaryRecord?.extensions);

  return normalizeImageDrift(
    detail?.image_drift ??
      (summaryRecord?.image_drift as AgentImageDriftRecord | null | undefined) ??
      (summaryExtensions?.image_drift as AgentImageDriftRecord | null | undefined),
  );
}

function formatDateTime(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return "Not available";
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function renderJsonBlock(title: string, value: Record<string, unknown> | null) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <pre className="mt-3 overflow-x-auto rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/50 p-3 text-xs leading-6 text-muted-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

const structuredValueTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--foreground)",
    fontSize: "0.78rem",
  },
  ".cm-content": {
    caretColor: "var(--foreground)",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
    fontSize: "0.78rem",
    lineHeight: "1.55rem",
    padding: "0.75rem 0",
  },
  ".cm-line": {
    padding: "0 0.875rem",
  },
  ".cm-scroller": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
  },
  ".cm-gutters": {
    minWidth: "48px",
    backgroundColor: "color-mix(in srgb, var(--muted) 22%, transparent)",
    borderRight: "1px solid color-mix(in srgb, var(--border) 70%, transparent)",
    color: "var(--muted-foreground)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--muted) 14%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in srgb, var(--muted) 22%, transparent)",
    color: "var(--foreground)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--primary) 24%, transparent)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--primary)",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

const structuredValueHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--primary)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--success)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--warning)" },
  { tag: [tags.separator, tags.punctuation, tags.bracket], color: "var(--muted-foreground)" },
]);

function StructuredValuePreview({
  content,
  fileName,
  height,
}: {
  content: string;
  fileName: string;
  height: string;
}) {
  const [languageSupport, setLanguageSupport] = useState<Extension | null>(null);
  const languageDescription = useMemo(
    () => LanguageDescription.matchFilename(languages, fileName),
    [fileName],
  );

  const editorExtensions = useMemo<Extension[]>(
    () => [
      structuredValueTheme,
      EditorView.lineWrapping,
      syntaxHighlighting(structuredValueHighlightStyle, { fallback: true }),
      ...(languageSupport ? [languageSupport] : []),
    ],
    [languageSupport],
  );

  useEffect(() => {
    let cancelled = false;

    setLanguageSupport(languageDescription?.support ?? null);

    if (!languageDescription) {
      return;
    }

    void languageDescription
      .load()
      .then((support) => {
        if (!cancelled) {
          setLanguageSupport(support);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLanguageSupport(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [languageDescription]);

  return (
    <CodeMirror
      value={content}
      theme="none"
      height={height}
      readOnly
      editable={false}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        autocompletion: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        highlightSelectionMatches: false,
        searchKeymap: false,
        lintKeymap: false,
      }}
      extensions={editorExtensions}
      aria-label={`${fileName} preview`}
    />
  );
}

function renderStructuredBlock(title: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  let content = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  let path = "agent-card.txt";
  let language: string | null = null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      content = JSON.stringify(parsed, null, 2);
      path = "agent-card.json";
      language = "json";
    } catch {
      content = value;
    }
  } else {
    path = "agent-card.json";
    language = "json";
  }

  const lineCount = content.split("\n").length;
  const previewHeight = `${Math.min(Math.max(lineCount * 24 + 32, 240), 720)}px`;

  return (
    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-3 overflow-hidden rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/50">
        <StructuredValuePreview content={content} fileName={path} height={previewHeight} />
      </div>
    </div>
  );
}

function hasSummaryBadge(summary: EntitySummaryHeader, key: string) {
  return summary.badges.some((badge) => badge.key === key);
}

function hasSummaryField(summary: EntitySummaryHeader, key: string) {
  return [...summary.inline_fields, ...summary.highlight_fields].some((field) => field.key === key);
}

function hasSummaryStat(summary: EntitySummaryHeader, key: string) {
  return summary.stats.some((stat) => stat.key === key);
}

function augmentAgentSummary({
  summary,
  imageDrift,
  recentSessionsCount,
  activeSessionsCount,
}: {
  summary: EntitySummaryHeader;
  imageDrift: ReturnType<typeof normalizeImageDrift>;
  recentSessionsCount: number;
  activeSessionsCount: number;
}) {
  const badges = [...summary.badges];
  const inlineFields = [...summary.inline_fields];
  const highlightFields = [...summary.highlight_fields];
  const stats = [...summary.stats];

  if (!hasSummaryField(summary, "agent_id")) {
    inlineFields.unshift({
      key: "agent_id",
      label: "ID",
      value: String(summary.entity.id),
      kind: "code",
      icon: "fingerprint",
    });
  }

  if (activeSessionsCount > 0 && !hasSummaryBadge(summary, "active_sessions")) {
    badges.push({
      key: "active_sessions",
      label: `${activeSessionsCount} active sessions`,
      tone: "warning",
    });
  }

  if (imageDrift?.available) {
    if (!hasSummaryBadge(summary, "image_drift_status")) {
      badges.push({
        key: "image_drift_status",
        label: imageDrift.hasDrift ? "Image drift detected" : "Images in sync",
        tone: imageDrift.hasDrift ? "warning" : "success",
      });
    }

    imageDrift.checks.forEach((check) => {
      const key = `image_drift_${check.key}`;

      if (hasSummaryField(summary, key)) {
        return;
      }

      highlightFields.push({
        key,
        label: check.label,
        value: check.hasDrift ? "Drift" : "No drift",
        kind: "text",
        icon: "package",
        tone: check.hasDrift ? "warning" : "success",
        meta: check.reason || undefined,
      });
    });
  } else if (imageDrift?.detail) {
    if (!hasSummaryBadge(summary, "image_drift_unavailable")) {
      badges.push({
        key: "image_drift_unavailable",
        label: "Runtime service not deployed",
        tone: "secondary",
      });
    }

    if (!hasSummaryField(summary, "image_drift_detail")) {
      highlightFields.push({
        key: "image_drift_detail",
        label: "Image drift",
        value: "Not deployed",
        kind: "text",
        icon: "package",
        tone: "warning",
        meta: imageDrift.detail,
      });
    }
  }

  if (!hasSummaryStat(summary, "recent_sessions")) {
    stats.push({
      key: "recent_sessions",
      label: "Recent Sessions",
      display: String(recentSessionsCount),
      value: recentSessionsCount,
      kind: "number",
      info: "Recent AgentSession records loaded for this agent.",
    });
  }

  if (!hasSummaryStat(summary, "active_sessions_count")) {
    stats.push({
      key: "active_sessions_count",
      label: "Working",
      display: String(activeSessionsCount),
      value: activeSessionsCount,
      kind: "number",
      info: "Recent sessions still marked as working.",
    });
  }

  return {
    ...summary,
    badges,
    inline_fields: inlineFields,
    highlight_fields: highlightFields,
    stats,
  } satisfies EntitySummaryHeader;
}

function AgentSessionsTable({
  selection,
  records,
}: {
  selection: ReturnType<typeof useRegistrySelection<AgentSessionApiRecord, string>>;
  records: AgentSessionApiRecord[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="w-12 px-3 pb-2">
              <MainSequenceSelectionCheckbox
                ariaLabel="Select all visible sessions"
                checked={selection.allSelected}
                indeterminate={selection.someSelected}
                onChange={selection.toggleAll}
              />
            </th>
            <th className="px-4 pb-2">Session</th>
            <th className="px-4 pb-2">Status</th>
            <th className="px-4 pb-2">Model</th>
            <th className="px-4 pb-2">Started</th>
            <th className="px-4 pb-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const sessionId = getAgentSessionRecordSessionId(record);
            const detailPath = getAgentSessionDetailPath(sessionId);
            const selected = selection.isSelected(sessionId);
            const modelSummary =
              record.llm_provider?.trim() && record.llm_model?.trim()
                ? `${record.llm_provider} / ${record.llm_model}`
                : "Not configured";

            return (
              <tr key={sessionId}>
                <td className={getRegistryTableCellClassName(selected, "left")}>
                  <MainSequenceSelectionCheckbox
                    ariaLabel={`Select ${getAgentSessionRecordTitle(record)}`}
                    checked={selected}
                    onChange={() => selection.toggleSelection(sessionId)}
                  />
                </td>
                <td className={getRegistryTableCellClassName(selected)}>
                  <Link
                    to={detailPath}
                    className="group inline-flex items-center gap-1.5 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:text-primary"
                  >
                    <span className="font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors group-hover:decoration-primary group-focus-visible:decoration-primary">
                      {getAgentSessionRecordTitle(record)}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary group-focus-visible:text-primary" />
                  </Link>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {getAgentSessionRecordSummary(record) || `Session ${sessionId}`}
                  </div>
                </td>
                <td className={getRegistryTableCellClassName(selected)}>
                  <div className="inline-flex items-center gap-2 text-foreground">
                    {record.working ? <Loader2 className="h-3.5 w-3.5 animate-spin text-warning" /> : null}
                    <span>{record.status || "Unknown"}</span>
                  </div>
                </td>
                <td className={getRegistryTableCellClassName(selected)}>
                  <div className="text-foreground">{modelSummary}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {record.engine_name?.trim() || "Unknown engine"}
                  </div>
                </td>
                <td className={getRegistryTableCellClassName(selected)}>
                  <div className="text-foreground">{formatDateTime(record.started_at)}</div>
                </td>
                <td className={getRegistryTableCellClassName(selected, "right")}>
                  <div className="flex justify-end">
                    <Link to={detailPath}>
                      <Button size="sm" variant="outline">
                        Open session
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AgentDetailView({
  activeTabId,
  agentId,
  initialAgent,
  onBack,
  onSelectTab,
}: {
  activeTabId: AgentDetailTabId;
  agentId: number;
  initialAgent: AgentSearchResult | null;
  onBack: () => void;
  onSelectTab: (tabId: AgentDetailTabId) => void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const {
    hasActiveChatStream,
    isActiveSessionLoading,
    isCreatingAgentSession,
    startAgentSessionById,
  } = useChatFeature();

  const detailQuery = useQuery({
    queryKey: ["main_sequence_ai", "agents", "detail", agentId],
    queryFn: ({ signal }) =>
      fetchAgentDetail({
        agentId,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: agentId > 0,
    staleTime: 30_000,
  });
  const summaryQuery = useQuery({
    queryKey: ["main_sequence_ai", "agents", "summary", agentId],
    queryFn: ({ signal }) =>
      fetchAgentSummary({
        agentId,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: agentId > 0,
    staleTime: 30_000,
  });

  const sessionsQuery = useQuery({
    queryKey: ["main_sequence_ai", "agents", "sessions", agentId],
    queryFn: ({ signal }) =>
      fetchLatestAgentSessions({
        agentId,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    enabled: agentId > 0,
    staleTime: 10_000,
  });

  const detail = detailQuery.data ?? null;
  const [sessionFilterValue, setSessionFilterValue] = useState("");
  const [sessionsPendingDelete, setSessionsPendingDelete] = useState<AgentSessionApiRecord[]>([]);
  const deferredSessionFilterValue = useDeferredValue(sessionFilterValue);
  const title =
    normalizeOptionalString(detail?.displayLabel) ||
    initialAgent?.displayLabel?.trim() ||
    `Agent ${agentId}`;
  const uniqueId =
    normalizeOptionalString(detail?.agent_unique_id) ||
    initialAgent?.agent_unique_id?.trim() ||
    null;
  const description =
    normalizeOptionalString(detail?.description) ||
    initialAgent?.description?.trim() ||
    null;
  const llmProvider =
    normalizeOptionalString(detail?.llm_provider) ||
    initialAgent?.llm_provider?.trim() ||
    null;
  const llmModel =
    normalizeOptionalString(detail?.llm_model) ||
    initialAgent?.llm_model?.trim() ||
    null;
  const imageDrift = useMemo(
    () =>
      resolveAgentImageDrift({
        detail,
        summary: summaryQuery.data ?? null,
      }),
    [detail, summaryQuery.data],
  );
  const metadata = normalizeOptionalObject(detail?.metadata);
  const runtimeConfigOverride = normalizeOptionalObject(detail?.runtime_config_override);
  const runtimeConfigSnapshot = normalizeOptionalObject(detail?.runtime_config_snapshot);
  const agentCard = detail?.agent_card;
  const sessionRecords = sessionsQuery.data ?? [];
  const filteredSessionRecords = useMemo(() => {
    const needle = deferredSessionFilterValue.trim().toLowerCase();

    return sessionRecords.filter((record) => {
      if (!needle) {
        return true;
      }

      return [
        getAgentSessionRecordTitle(record),
        getAgentSessionRecordSummary(record) ?? "",
        getAgentSessionRecordSessionId(record),
        record.status ?? "",
        record.llm_provider ?? "",
        record.llm_model ?? "",
        record.engine_name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [deferredSessionFilterValue, sessionRecords]);
  const sessionSelection = useRegistrySelection<AgentSessionApiRecord, string>(
    filteredSessionRecords,
    getAgentSessionRecordSessionId,
  );
  const activeSessionsCount = sessionRecords.filter((record) => record.working).length;
  const summary = useMemo(
    () => {
      if (!summaryQuery.data) {
        return null;
      }

      return augmentAgentSummary({
        summary: summaryQuery.data as AgentSummaryResponse,
        imageDrift,
        recentSessionsCount: sessionRecords.length,
        activeSessionsCount,
      });
    },
    [
      activeSessionsCount,
      imageDrift,
      sessionRecords.length,
      summaryQuery.data,
    ],
  );
  const sessionMutationBusy =
    hasActiveChatStream || isActiveSessionLoading || isCreatingAgentSession;
  const activeTab =
    agentDetailTabs.find((tab) => tab.id === activeTabId) ??
    agentDetailTabs.find((tab) => tab.id === defaultAgentDetailTabId) ??
    agentDetailTabs[0];
  const deleteSessionsMutation = useMutation({
    mutationFn: async (records: AgentSessionApiRecord[]) => {
      await Promise.all(
        records.map((record) =>
          deleteAgentSessionRequest({
            sessionId: getAgentSessionRecordSessionId(record),
            token: sessionToken,
            tokenType: sessionTokenType,
          }),
        ),
      );
      return records;
    },
    onSuccess: async (records) => {
      await sessionsQuery.refetch();
      setSessionsPendingDelete([]);
      sessionSelection.clearSelection();
    },
  });
  const openRuntimeMutation = useMutation({
    mutationFn: ({ signal }: { signal?: AbortSignal } = {}) =>
      fetchAgentRuntimeId({
        agentId,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    onSuccess: (payload) => {
      const runtimeId = payload.runtime_id;

      if (!Number.isFinite(runtimeId) || !runtimeId || runtimeId <= 0) {
        toast({
          title: "Runtime unavailable",
          description: "This agent doesn't have a runtime.",
          variant: "info",
        });
        return;
      }

      const searchParams = new URLSearchParams();
      searchParams.set("msScalableServiceId", String(runtimeId));
      searchParams.set("msScalableServiceTab", "pods");
      navigate(`${getAppPath("main_sequence_workbench", "scalable-services")}?${searchParams.toString()}`);
    },
    onError: (error) => {
      toast({
        title: "Runtime lookup failed",
        description: formatMainSequenceError(error),
        variant: "error",
      });
    },
  });
  const sessionBulkActions =
    sessionSelection.selectedCount > 0
      ? [
          {
            id: "delete-sessions",
            label:
              sessionSelection.selectedCount > 1 ? "Delete Sessions" : "Delete Session",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => {
              setSessionsPendingDelete(sessionSelection.selectedItems);
            },
          },
        ]
      : [];

  async function handleStartSession() {
    await startAgentSessionById({
      agentId,
      label: title,
    });
    navigate(CHAT_PAGE_PATH);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            className="transition-colors hover:text-foreground"
            onClick={onBack}
          >
            Agents
          </button>
          <span>/</span>
          <span className="text-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void detailQuery.refetch();
              void sessionsQuery.refetch();
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={openRuntimeMutation.isPending}
            onClick={() => {
              void openRuntimeMutation.mutateAsync({});
            }}
          >
            {openRuntimeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpRight className="h-4 w-4" />
            )}
            Runtime
          </Button>
          <Button
            size="sm"
            disabled={sessionMutationBusy}
            onClick={() => {
              void handleStartSession();
            }}
          >
            <Bot className="h-4 w-4" />
            Start session
          </Button>
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to agents
          </Button>
        </div>
      </div>

      {summaryQuery.isLoading && !summary ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading agent summary
          </CardContent>
        </Card>
      ) : null}

      {summaryQuery.isError && !summary ? (
        <Card>
          <CardContent className="py-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(summaryQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary ? <MainSequenceEntitySummaryCard summary={summary} /> : null}

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap gap-2">
            {agentDetailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  tab.id === activeTab.id
                    ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                    : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground",
                )}
                onClick={() => onSelectTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {activeTab.id === "overview" ? (
            <div className="space-y-5">
              {detailQuery.isLoading && !initialAgent ? (
                <div className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading agent details
                </div>
              ) : null}

              {detailQuery.isError && !initialAgent ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(detailQuery.error)}
                </div>
              ) : null}

              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-4">
                <div className="text-sm font-medium text-foreground">Description</div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {description || "No description provided."}
                </p>
              </div>

              {renderJsonBlock("Runtime Configuration Override", runtimeConfigOverride)}
              {renderJsonBlock("Runtime Configuration Snapshot", runtimeConfigSnapshot)}
              {renderJsonBlock("Metadata", metadata)}

              {!runtimeConfigOverride && !runtimeConfigSnapshot && !metadata ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/12 px-4 py-4 text-sm text-muted-foreground">
                  No additional backend detail fields are available for this agent.
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab.id === "agent-card" ? (
            <div className="space-y-5">
              {detailQuery.isLoading && !initialAgent ? (
                <div className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading agent card
                </div>
              ) : null}

              {detailQuery.isError && !initialAgent ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(detailQuery.error)}
                </div>
              ) : null}

              {renderStructuredBlock("Agent Card", agentCard)}

              {agentCard === null || agentCard === undefined || agentCard === "" ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/12 px-4 py-4 text-sm text-muted-foreground">
                  No agent card is available for this agent.
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab.id === "sessions" ? (
            <div className="space-y-4">
              <MainSequenceRegistrySearch
                actionMenuLabel="Session actions"
                accessory={<Badge variant="neutral">{`${sessionRecords.length} sessions`}</Badge>}
                bulkActions={sessionBulkActions}
                clearSelectionLabel="Clear sessions"
                onClearSelection={sessionSelection.clearSelection}
                renderSelectionSummary={(selectionCount) => `${selectionCount} sessions selected`}
                value={sessionFilterValue}
                onChange={(event) => setSessionFilterValue(event.target.value)}
                placeholder="Filter by title, UID, status, provider, model, or engine"
                searchClassName="max-w-lg"
                selectionCount={sessionSelection.selectedCount}
              />

              {sessionsQuery.isLoading ? (
                <div className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading related sessions
                </div>
              ) : null}

              {sessionsQuery.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(sessionsQuery.error)}
                </div>
              ) : null}

              {!sessionsQuery.isLoading && !sessionsQuery.isError && filteredSessionRecords.length === 0 ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/12 px-4 py-4 text-sm text-muted-foreground">
                  {deferredSessionFilterValue.trim()
                    ? "Clear the current filter or try another search term."
                    : "No recent AgentSession rows were returned for this agent."}
                </div>
              ) : null}

              {!sessionsQuery.isLoading && !sessionsQuery.isError && filteredSessionRecords.length > 0 ? (
                <AgentSessionsTable records={filteredSessionRecords} selection={sessionSelection} />
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ActionConfirmationDialog
        title={sessionsPendingDelete.length > 1 ? "Delete sessions" : "Delete session"}
        open={sessionsPendingDelete.length > 0}
        onClose={() => {
          if (!deleteSessionsMutation.isPending) {
            setSessionsPendingDelete([]);
          }
        }}
        tone="danger"
        actionLabel="delete"
        objectLabel={sessionsPendingDelete.length > 1 ? "sessions" : "session"}
        confirmWord={sessionsPendingDelete.length > 1 ? "DELETE SESSIONS" : "DELETE SESSION"}
        confirmButtonLabel={sessionsPendingDelete.length > 1 ? "Delete sessions" : "Delete session"}
        description="This action removes the selected AgentSession records."
        specialText="This action cannot be undone."
        objectSummary={
          sessionsPendingDelete.length === 1 ? (
            <>
              <div className="font-medium">
                {sessionsPendingDelete[0] ? getAgentSessionRecordTitle(sessionsPendingDelete[0]) : null}
              </div>
              <div className="mt-1 text-muted-foreground">
                {sessionsPendingDelete[0]
                  ? `Session ID ${getAgentSessionRecordSessionId(sessionsPendingDelete[0])}`
                  : null}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">{sessionsPendingDelete.length} sessions selected</div>
              <div className="mt-1 text-muted-foreground">
                {sessionsPendingDelete
                  .slice(0, 3)
                  .map((record) => getAgentSessionRecordTitle(record))
                  .join(", ")}
                {sessionsPendingDelete.length > 3 ? ", ..." : ""}
              </div>
            </>
          )
        }
        error={
          deleteSessionsMutation.isError
            ? formatMainSequenceError(deleteSessionsMutation.error)
            : undefined
        }
        isPending={deleteSessionsMutation.isPending}
        onConfirm={() => {
          if (sessionsPendingDelete.length === 0) {
            return;
          }

          void deleteSessionsMutation.mutateAsync(sessionsPendingDelete);
        }}
      />
    </div>
  );
}
