import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, Loader2, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";

import {
  createSecret,
  fetchSecret,
  formatMainSequenceError,
  listSecrets,
  mainSequenceRegistryPageSize,
  type SecretRecord,
} from "../../api";
import { MainSequencePermissionsTab } from "../../components/MainSequencePermissionsTab";
import { MainSequenceRegistryPagination } from "../../components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../components/MainSequenceRegistrySearch";

const mainSequenceSecretIdParam = "msSecretId";
type SecretDetailTabId = "overview" | "permissions";
const secretDetailTabs = [
  { id: "overview", label: "Overview" },
  { id: "permissions", label: "Permissions" },
] as const;

export function MainSequenceSecretsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [filterValue, setFilterValue] = useState("");
  const [secretsPageIndex, setSecretsPageIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [selectedDetailTabId, setSelectedDetailTabId] = useState<SecretDetailTabId>("overview");
  const deferredFilterValue = useDeferredValue(filterValue);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedSecretId = Number(searchParams.get(mainSequenceSecretIdParam) ?? "");
  const isSecretDetailOpen = Number.isFinite(selectedSecretId) && selectedSecretId > 0;

  const secretsQuery = useQuery({
    queryKey: ["main_sequence", "secrets", "list", secretsPageIndex],
    queryFn: () =>
      listSecrets({
        limit: mainSequenceRegistryPageSize,
        offset: secretsPageIndex * mainSequenceRegistryPageSize,
      }),
  });

  const secretDetailQuery = useQuery({
    queryKey: ["main_sequence", "secrets", "detail", selectedSecretId],
    queryFn: () => fetchSecret(selectedSecretId),
    enabled: isSecretDetailOpen,
  });

  useEffect(() => {
    setSecretsPageIndex(0);
  }, [deferredFilterValue]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((secretsQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (secretsPageIndex > totalPages - 1) {
      setSecretsPageIndex(totalPages - 1);
    }
  }, [secretsPageIndex, secretsQuery.data?.count]);

  const filteredSecrets = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return (secretsQuery.data?.results ?? []).filter((secret) => {
      if (!needle) {
        return true;
      }

      return [String(secret.id), secret.name].join(" ").toLowerCase().includes(needle);
    });
  }, [deferredFilterValue, secretsQuery.data?.results]);

  const selectedSecretFromList = useMemo(
    () => filteredSecrets.find((secret) => secret.id === selectedSecretId) ?? null,
    [filteredSecrets, selectedSecretId],
  );
  const selectedSecret = secretDetailQuery.data ?? selectedSecretFromList;
  const secretTitle =
    selectedSecret?.name ?? (isSecretDetailOpen ? `Secret ${selectedSecretId}` : "Secret");

  useEffect(() => {
    setSelectedDetailTabId("overview");
  }, [selectedSecretId]);

  const createSecretMutation = useMutation({
    mutationFn: createSecret,
    onSuccess: async (secret) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "secrets"],
      });

      toast({
        variant: "success",
        title: "Secret created",
        description: `${secret.name} is now available.`,
      });

      setCreateDialogOpen(false);
      setSecretName("");
      setSecretValue("");
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Secret creation failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  function updateSearchParams(update: (nextParams: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);
    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: false },
    );
  }

  function openSecretDetail(secretId: number) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceSecretIdParam, String(secretId));
    });
  }

  function closeSecretDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceSecretIdParam);
    });
  }

  if (isSecretDetailOpen) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={closeSecretDetail}
            >
              Secrets
            </button>
            <span>/</span>
            <span className="text-foreground">{secretTitle}</span>
          </div>
          <Button variant="outline" size="sm" onClick={closeSecretDetail}>
            <ArrowLeft className="h-4 w-4" />
            Back to secrets
          </Button>
        </div>

        {secretDetailQuery.isLoading && !selectedSecret ? (
          <Card>
            <CardContent className="flex min-h-48 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading secret details
              </div>
            </CardContent>
          </Card>
        ) : null}

        {secretDetailQuery.isError ? (
          <Card>
            <CardContent className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(secretDetailQuery.error)}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {selectedSecret ? (
          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-wrap items-center gap-2">
                {secretDetailTabs.map((tab) => {
                  const active = tab.id === selectedDetailTabId;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={
                        active
                          ? "rounded-full border border-primary/40 bg-primary/12 px-3 py-1.5 text-xs font-medium text-primary"
                          : "rounded-full border border-border/70 bg-background/35 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      }
                      onClick={() => setSelectedDetailTabId(tab.id)}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {selectedDetailTabId === "overview" ? (
                <div className="space-y-1">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Name
                  </div>
                  <div className="text-base font-medium text-foreground">{selectedSecret.name}</div>
                </div>
              ) : (
                <MainSequencePermissionsTab
                  objectUrl="secret"
                  objectId={selectedSecret.id}
                  entityLabel="Secret"
                  enabled={selectedDetailTabId === "permissions"}
                />
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title="Secrets Search"
        description="Search and create organization secrets."
        actions={<Badge variant="neutral">{`${secretsQuery.data?.count ?? 0} secrets`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>Secrets registry</CardTitle>
              <CardDescription>
                Search across secret names and open the secret detail view.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              accessory={
                <Button
                  size="sm"
                  onClick={() => {
                    createSecretMutation.reset();
                    setSecretName("");
                    setSecretValue("");
                    setCreateDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Create secret
                </Button>
              }
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              placeholder="Filter by name or id"
              searchClassName="max-w-lg"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {secretsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading secrets
              </div>
            </div>
          ) : null}

          {secretsQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(secretsQuery.error)}
              </div>
            </div>
          ) : null}

          {!secretsQuery.isLoading && !secretsQuery.isError && filteredSecrets.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <KeyRound className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No secrets found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a secret or clear the current filter.
              </p>
            </div>
          ) : null}

          {!secretsQuery.isLoading && !secretsQuery.isError && filteredSecrets.length > 0 ? (
            <div className="overflow-x-auto px-4 py-4">
              <table className="w-full min-w-[640px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 pb-2">Name</th>
                    <th className="px-4 pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSecrets.map((secret) => (
                    <tr key={secret.id}>
                      <td className="rounded-l-[calc(var(--radius)-2px)] border border-border/70 bg-background/24 px-4 py-4">
                        <div className="font-medium text-foreground">{secret.name}</div>
                      </td>
                      <td className="rounded-r-[calc(var(--radius)-2px)] border border-border/70 bg-background/24 px-4 py-4 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openSecretDetail(secret.id)}
                        >
                          View Secret
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!secretsQuery.isLoading && !secretsQuery.isError && (secretsQuery.data?.count ?? 0) > 0 ? (
            <MainSequenceRegistryPagination
              count={secretsQuery.data?.count ?? 0}
              itemLabel="secrets"
              pageIndex={secretsPageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setSecretsPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        title="Create secret"
        open={createDialogOpen}
        onClose={() => {
          if (!createSecretMutation.isPending) {
            setCreateDialogOpen(false);
          }
        }}
        className="max-w-[min(720px,calc(100vw-24px))]"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Name
            </label>
            <Input
              autoFocus
              value={secretName}
              onChange={(event) => setSecretName(event.target.value)}
              placeholder="SECRET_NAME"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Value
            </label>
            <Textarea
              value={secretValue}
              onChange={(event) => setSecretValue(event.target.value)}
              placeholder="Secret value"
              className="min-h-44 font-mono text-xs"
            />
          </div>

          {createSecretMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(createSecretMutation.error)}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createSecretMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!secretName.trim()) {
                  toast({
                    variant: "error",
                    title: "Secret creation failed",
                    description: "Name is required.",
                  });
                  return;
                }

                if (!secretValue.trim()) {
                  toast({
                    variant: "error",
                    title: "Secret creation failed",
                    description: "Value is required.",
                  });
                  return;
                }

                createSecretMutation.mutate({
                  name: secretName.trim(),
                  value: secretValue,
                });
              }}
              disabled={createSecretMutation.isPending || !secretName.trim() || !secretValue.trim()}
            >
              {createSecretMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create secret
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
