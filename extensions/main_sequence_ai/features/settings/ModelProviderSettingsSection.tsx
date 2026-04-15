import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Loader2 } from "lucide-react";

import type { AppShellMenuRenderProps } from "@/apps/types";
import { useAuthStore } from "@/auth/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fetchModelCatalog, type ModelCatalogItem } from "../../runtime/model-catalog-api";
import {
  cancelModelProviderSignIn,
  fetchModelProviderAuthStates,
  fetchModelProviderSignInAttempt,
  ModelProviderApiError,
  signOffModelProvider,
  startModelProviderSignIn,
  submitModelProviderManualSignIn,
  type ProviderAuthStatus,
  type SignInAttempt,
} from "../../runtime/model-provider-auth-api";
import { resolveMainSequenceAiAssistantEndpoint } from "../../runtime/assistant-endpoint";

function formatProviderLabel(provider: string) {
  return provider
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function isTerminalAttemptStatus(status: SignInAttempt["status"]) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function getAttemptStateMessage(attempt: SignInAttempt) {
  switch (attempt.status) {
    case "pending":
      return "Starting sign-in...";
    case "awaiting_browser":
      return "Open the sign-in page and complete login in your browser.";
    case "awaiting_manual_input":
      return "After login, if the browser lands on a localhost page or an error page, copy the full URL from the browser address bar and paste it here.";
    case "running":
      return "We received your callback URL and are finishing sign-in.";
    case "completed":
      return "Provider is signed in.";
    case "cancelled":
      return "Sign-in cancelled.";
    case "failed":
      return attempt.error ?? "Provider sign-in failed.";
    default:
      return "Waiting for the provider sign-in flow to continue.";
  }
}

function ModelCatalogRow({
  model,
}: {
  model: ModelCatalogItem;
}) {
  const statusLabel = !model.auth
    ? "No auth"
    : model.auth.usable
      ? "Usable"
      : "Not authenticated";
  const statusVariant = !model.auth ? "neutral" : model.auth.usable ? "success" : "warning";

  return (
    <div className="flex items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-white/8 bg-black/10 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm text-topbar-foreground">{model.label}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">{model.model}</div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>
    </div>
  );
}

function ProviderAuthCard({
  authState,
  models,
  onSignIn,
  onSignOff,
  pendingProvider,
}: {
  authState: ProviderAuthStatus;
  models: ModelCatalogItem[];
  onSignIn: () => void;
  onSignOff: () => void;
  pendingProvider: string | null;
}) {
  const pending = pendingProvider === authState.provider;
  const validatedAt = formatTimestamp(authState.lastValidatedAt);
  const [modelsOpen, setModelsOpen] = useState(false);

  return (
    <section className="rounded-[calc(var(--radius)-2px)] border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-topbar-foreground">
            {formatProviderLabel(authState.provider)}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={authState.authenticated ? "success" : "warning"}>
              {authState.authenticated ? "Signed in" : "Not signed in"}
            </Badge>
            <Badge variant="neutral">{authState.authKind}</Badge>
            <Badge variant="neutral">Known: {authState.knownModelCount}</Badge>
            <Badge variant="neutral">Usable: {authState.usableModelCount}</Badge>
            {!authState.authenticated && !authState.signInAvailable ? (
              <Badge variant="neutral">Sign in not available</Badge>
            ) : null}
          </div>
          {validatedAt ? (
            <div className="mt-2 text-xs text-muted-foreground">Last validated: {validatedAt}</div>
          ) : null}
        </div>

        {authState.authenticated ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={onSignOff}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign off
          </Button>
        ) : authState.signInAvailable ? (
          <Button size="sm" disabled={pending} onClick={onSignIn}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-[calc(var(--radius)-6px)] border border-white/8 bg-black/10 px-3 py-2 text-left text-sm text-topbar-foreground transition-colors hover:bg-white/[0.04]"
          onClick={() => {
            setModelsOpen((current) => !current);
          }}
        >
          <span>
            Models
            <span className="ml-2 text-muted-foreground">({models.length})</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", modelsOpen && "rotate-180")} />
        </button>

        {modelsOpen ? (
          <div className="mt-2 space-y-2">
            {models.length > 0 ? (
              models.map((model) => (
                <ModelCatalogRow key={`${model.provider}:${model.model}`} model={model} />
              ))
            ) : (
              <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-white/10 px-3 py-3 text-sm text-muted-foreground">
                No models available for this provider.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProviderSignInModal({
  attempt,
  errorMessage,
  inputValue,
  isSubmittingInput,
  isCancelling,
  onCancel,
  onClose,
  onInputChange,
  onRetry,
  onSubmitInput,
}: {
  attempt: SignInAttempt;
  errorMessage: string | null;
  inputValue: string;
  isSubmittingInput: boolean;
  isCancelling: boolean;
  onCancel: () => void;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onRetry: () => void;
  onSubmitInput: () => void;
}) {
  const providerLabel = formatProviderLabel(attempt.provider);
  const isTerminal = isTerminalAttemptStatus(attempt.status);
  const nextAction = attempt.nextAction;
  const stateMessage = getAttemptStateMessage(attempt);

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${providerLabel} sign-in`}
      description="This flow is driven by the provider sign-in attempt state returned by the backend."
      className="max-w-[min(760px,calc(100vw-24px))]"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant={attempt.status === "completed" ? "success" : attempt.status === "failed" ? "danger" : "warning"}>
            {attempt.status}
          </Badge>
          <Badge variant="neutral">{attempt.authKind}</Badge>
        </div>

        <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
          {stateMessage}
        </div>

        {attempt.authUrl ? (
          <div className="space-y-3 rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
            <div className="text-sm font-medium text-topbar-foreground">Sign-in link</div>
            {attempt.authInstructions ? (
              <div className="text-sm text-muted-foreground">{attempt.authInstructions}</div>
            ) : null}
            <div className="rounded-[calc(var(--radius)-6px)] border border-white/8 bg-black/10 px-3 py-2 font-mono text-xs text-muted-foreground">
              {attempt.authUrl}
            </div>
            <Button
              type="button"
              onClick={() => {
                window.open(attempt.authUrl!, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Open sign-in page
            </Button>
          </div>
        ) : null}

        {nextAction.type === "open_url" ? (
          <div className="space-y-3 rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
            <div className="text-sm font-medium text-topbar-foreground">Open sign-in page</div>
            {nextAction.instructions ? (
              <div className="text-sm text-muted-foreground">{nextAction.instructions}</div>
            ) : null}
            <div className="rounded-[calc(var(--radius)-6px)] border border-white/8 bg-black/10 px-3 py-2 font-mono text-xs text-muted-foreground">
              {nextAction.url}
            </div>
            <Button
              type="button"
              onClick={() => {
                window.open(nextAction.url, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Open sign-in page
            </Button>
          </div>
        ) : null}

        {nextAction.type === "enter_callback_url" ? (
          <div className="space-y-3 rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
            <div className="text-sm font-medium text-topbar-foreground">{nextAction.prompt}</div>
            {nextAction.instructions ? (
              <div className="text-sm text-muted-foreground">{nextAction.instructions}</div>
            ) : null}
            <Textarea
              value={inputValue}
              rows={4}
              onChange={(event) => {
                onInputChange(event.target.value);
              }}
              placeholder="Paste the full callback URL from the browser address bar here."
            />
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" disabled={isSubmittingInput} onClick={onCancel}>
                Cancel
              </Button>
              <Button type="button" disabled={isSubmittingInput} onClick={onSubmitInput}>
                {isSubmittingInput ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit
              </Button>
            </div>
          </div>
        ) : null}

        {nextAction.type === "wait" ? (
          <div className="flex items-center gap-3 rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {nextAction.message}
          </div>
        ) : null}

        {!isTerminal && nextAction.type === "none" ? (
          <div className="flex items-center gap-3 rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for the provider sign-in flow to continue.
          </div>
        ) : null}

        {attempt.progress.length > 0 ? (
          <div className="space-y-2 rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
            <div className="text-sm font-medium text-topbar-foreground">Progress</div>
            <div className="space-y-2">
              {attempt.progress.map((entry) => (
                <div key={`${entry.at}-${entry.message}`} className="text-sm text-muted-foreground">
                  <span className="font-mono text-[11px]">{formatTimestamp(entry.at) ?? entry.at}</span>
                  <span className="ml-2">{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-[calc(var(--radius)-4px)] border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          {!isTerminal ? (
            <Button type="button" variant="outline" disabled={isCancelling} onClick={onCancel}>
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cancel
            </Button>
          ) : null}
          {attempt.status === "failed" ? (
            <Button type="button" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function ModelProviderSettingsSection(_props: AppShellMenuRenderProps) {
  const queryClient = useQueryClient();
  const assistantEndpoint = resolveMainSequenceAiAssistantEndpoint();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const [activeAttempt, setActiveAttempt] = useState<SignInAttempt | null>(null);
  const [manualInputValue, setManualInputValue] = useState("");
  const [attemptError, setAttemptError] = useState<string | null>(null);

  const providerQueryKey = ["main-sequence-ai", "model-providers", assistantEndpoint, sessionToken];
  const catalogQueryKey = ["main-sequence-ai", "model-catalog", assistantEndpoint, sessionToken];

  const providerAuthQuery = useQuery({
    queryKey: providerQueryKey,
    queryFn: () =>
      fetchModelProviderAuthStates({
        assistantEndpoint,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
  });

  const modelsQuery = useQuery({
    queryKey: catalogQueryKey,
    queryFn: () =>
      fetchModelCatalog({
        assistantEndpoint,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: providerQueryKey }),
      queryClient.invalidateQueries({ queryKey: catalogQueryKey }),
    ]);
  };

  const attemptQuery = useQuery({
    queryKey: [
      "main-sequence-ai",
      "model-provider-signin-attempt",
      assistantEndpoint,
      sessionToken,
      activeAttempt?.provider,
      activeAttempt?.id,
    ],
    enabled: Boolean(activeAttempt),
    queryFn: () =>
      fetchModelProviderSignInAttempt({
        assistantEndpoint,
        provider: activeAttempt?.provider ?? "",
        attemptId: activeAttempt?.id ?? "",
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    refetchInterval: (query) => {
      const nextAttempt = query.state.data;

      if (!nextAttempt || isTerminalAttemptStatus(nextAttempt.status)) {
        return false;
      }

      return 1500;
    },
  });

  const signInMutation = useMutation({
    mutationFn: async (provider: string) =>
      startModelProviderSignIn({
        assistantEndpoint,
        provider,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    onSuccess: async (result) => {
      setAttemptError(null);
      setManualInputValue("");

      if (result.statusCode === 202) {
        setActiveAttempt(result.attempt);
        return;
      }

      setActiveAttempt(null);
      await refresh();
    },
    onError: (error) => {
      if (error instanceof ModelProviderApiError && error.code === "provider_signin_in_progress" && error.attempt) {
        setAttemptError(null);
        setManualInputValue("");
        setActiveAttempt(error.attempt);
        return;
      }

      setAttemptError(error instanceof Error ? error.message : "Unable to start provider sign-in.");
    },
  });

  const signOffMutation = useMutation({
    mutationFn: async (provider: string) =>
      signOffModelProvider({
        assistantEndpoint,
        provider,
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    onSuccess: async () => {
      await refresh();
    },
  });

  const submitManualMutation = useMutation({
    mutationFn: async () => {
      if (!activeAttempt) {
        return null;
      }

      return submitModelProviderManualSignIn({
        assistantEndpoint,
        provider: activeAttempt.provider,
        attemptId: activeAttempt.id,
        input: manualInputValue,
        token: sessionToken,
        tokenType: sessionTokenType,
      });
    },
    onSuccess: (attempt) => {
      setAttemptError(null);

      if (attempt) {
        setActiveAttempt(attempt);
      }
    },
    onError: (error) => {
      setAttemptError(error instanceof Error ? error.message : "Unable to submit provider sign-in input.");
    },
  });

  const cancelAttemptMutation = useMutation({
    mutationFn: async () => {
      if (!activeAttempt) {
        return;
      }

      await cancelModelProviderSignIn({
        assistantEndpoint,
        provider: activeAttempt.provider,
        attemptId: activeAttempt.id,
        token: sessionToken,
        tokenType: sessionTokenType,
      });
    },
    onSuccess: async () => {
      setActiveAttempt(null);
      setAttemptError(null);
      setManualInputValue("");
      await refresh();
    },
    onError: (error) => {
      setAttemptError(error instanceof Error ? error.message : "Unable to cancel provider sign-in.");
    },
  });

  useEffect(() => {
    if (!attemptQuery.data) {
      return;
    }

    setActiveAttempt(attemptQuery.data);
  }, [attemptQuery.data]);

  useEffect(() => {
    if (!activeAttempt) {
      return;
    }

    if (activeAttempt.status === "completed") {
      setActiveAttempt(null);
      setAttemptError(null);
      setManualInputValue("");
      void refresh();
      return;
    }

    if (activeAttempt.status === "cancelled") {
      setActiveAttempt(null);
      setAttemptError(null);
      setManualInputValue("");
      void refresh();
      return;
    }

    if (activeAttempt.status === "failed") {
      setAttemptError(activeAttempt.error ?? "Provider sign-in failed.");
    }
  }, [activeAttempt]);

  useEffect(() => {
    if (!(attemptQuery.error instanceof ModelProviderApiError)) {
      return;
    }

    const error = attemptQuery.error;

    if (error.code === "signin_attempt_not_found" || error.code === "signin_attempt_not_active") {
      setActiveAttempt(null);
      setAttemptError(null);
      setManualInputValue("");
      void refresh();
      return;
    }

    setAttemptError(error.message);
  }, [attemptQuery.error]);

  const modelsByProvider = useMemo(() => {
    const grouped = new Map<string, ModelCatalogItem[]>();

    for (const model of modelsQuery.data ?? []) {
      const provider = model.provider;

      if (!grouped.has(provider)) {
        grouped.set(provider, []);
      }

      grouped.get(provider)?.push(model);
    }

    return grouped;
  }, [modelsQuery.data]);

  const providerOrder = useMemo(() => {
    const names = new Set<string>();

    for (const provider of providerAuthQuery.data ?? []) {
      names.add(provider.provider);
    }

    for (const provider of modelsByProvider.keys()) {
      names.add(provider);
    }

    return [...names].sort((left, right) => left.localeCompare(right));
  }, [modelsByProvider, providerAuthQuery.data]);

  const providerMap = useMemo(
    () => new Map((providerAuthQuery.data ?? []).map((entry) => [entry.provider, entry])),
    [providerAuthQuery.data],
  );
  const pendingProvider =
    (signInMutation.isPending && signInMutation.variables) ||
    (signOffMutation.isPending && signOffMutation.variables) ||
    null;

  return (
    <div className="space-y-4 py-4">
      <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
        <div className="text-sm font-medium text-topbar-foreground">Model providers</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Manage global provider authentication and inspect the full known model catalog. This
          screen is not the chat runtime picker.
        </div>
      </div>

      {providerAuthQuery.isLoading || modelsQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading provider auth and model catalog
        </div>
      ) : null}

      {providerAuthQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-4px)] border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {providerAuthQuery.error instanceof Error
            ? providerAuthQuery.error.message
            : "Unable to load provider auth state."}
        </div>
      ) : null}

      {modelsQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-4px)] border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {modelsQuery.error instanceof Error
            ? modelsQuery.error.message
            : "Unable to load model catalog."}
        </div>
      ) : null}

      {attemptError && !activeAttempt ? (
        <div className="rounded-[calc(var(--radius)-4px)] border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {attemptError}
        </div>
      ) : null}

      {!providerAuthQuery.isLoading &&
      !modelsQuery.isLoading &&
      !providerAuthQuery.isError &&
      !modelsQuery.isError &&
      providerOrder.length === 0 ? (
        <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
          No model providers or models are available.
        </div>
      ) : null}

      {!providerAuthQuery.isLoading &&
      !modelsQuery.isLoading &&
      !providerAuthQuery.isError &&
      !modelsQuery.isError ? (
        <div className="space-y-4">
          {providerOrder.map((provider) => {
            const authState = providerMap.get(provider);

            if (!authState) {
              return null;
            }

            return (
              <ProviderAuthCard
                key={provider}
                authState={authState}
                models={modelsByProvider.get(provider) ?? []}
                pendingProvider={pendingProvider}
                onSignIn={() => {
                  setAttemptError(null);
                  setManualInputValue("");
                  signInMutation.mutate(provider);
                }}
                onSignOff={() => {
                  setAttemptError(null);
                  signOffMutation.mutate(provider);
                }}
              />
            );
          })}
        </div>
      ) : null}

      {activeAttempt ? (
        <ProviderSignInModal
          attempt={activeAttempt}
          errorMessage={attemptError}
          inputValue={manualInputValue}
          isSubmittingInput={submitManualMutation.isPending}
          isCancelling={cancelAttemptMutation.isPending}
          onCancel={() => {
            if (isTerminalAttemptStatus(activeAttempt.status)) {
              setActiveAttempt(null);
              setAttemptError(null);
              setManualInputValue("");
              void refresh();
              return;
            }

            cancelAttemptMutation.mutate();
          }}
          onClose={() => {
            if (!isTerminalAttemptStatus(activeAttempt.status)) {
              cancelAttemptMutation.mutate();
              return;
            }

            setActiveAttempt(null);
            setAttemptError(null);
            setManualInputValue("");
          }}
          onInputChange={setManualInputValue}
          onRetry={() => {
            setAttemptError(null);
            setManualInputValue("");
            signInMutation.mutate(activeAttempt.provider);
          }}
          onSubmitInput={() => {
            if (!manualInputValue.trim()) {
              setAttemptError("Paste the full callback URL from the browser address bar.");
              return;
            }

            setAttemptError(null);
            submitManualMutation.mutate();
          }}
        />
      ) : null}
    </div>
  );
}
