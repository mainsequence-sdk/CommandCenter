import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  deleteIndex,
  fetchIndexDetail,
  formatMainSequenceError,
} from "../../../../common/api";

function formatIndexText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function DetailField({
  label,
  monospace = false,
  value,
}: {
  label: string;
  monospace?: boolean;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className={monospace ? "font-mono text-sm text-foreground" : "text-sm text-foreground"}>
        {value}
      </div>
    </div>
  );
}

export function MainSequenceIndexDetailView({
  indexUid,
  onBack,
  onDeleted,
}: {
  indexUid: string;
  onBack: () => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const indexDetailQuery = useQuery({
    queryKey: ["main_sequence", "indices", "detail", indexUid],
    queryFn: () => fetchIndexDetail(indexUid),
    enabled: Boolean(indexUid),
  });

  const deleteIndexMutation = useMutation({
    mutationFn: () => deleteIndex(indexUid),
  });

  const indexTitle = formatIndexText(
    indexDetailQuery.data?.display_name,
    formatIndexText(indexDetailQuery.data?.unique_identifier, `Index ${indexUid}`),
  );
  const metadataJson = useMemo(() => {
    if (!indexDetailQuery.data?.metadata_json) {
      return null;
    }

    return JSON.stringify(indexDetailQuery.data.metadata_json, null, 2);
  }, [indexDetailQuery.data?.metadata_json]);

  if (!indexUid.trim()) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Main Sequence Markets"
          title="Index"
          description="The requested index uid is invalid."
          actions={
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back to indices
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={indexTitle}
        description={`UID ${indexUid}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back to indices
            </Button>
            {indexDetailQuery.data ? (
              <Button type="button" variant="danger" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </div>
        }
      />

      {indexDetailQuery.isLoading ? (
        <Card>
          <CardContent className="flex min-h-56 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading index detail
            </div>
          </CardContent>
        </Card>
      ) : null}

      {indexDetailQuery.isError ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(indexDetailQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {indexDetailQuery.data ? (
        <>
          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Index detail</CardTitle>
                  <CardDescription>
                    Review the canonical registry fields before using or deleting this record.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">
                    {formatIndexText(indexDetailQuery.data.provider, "Provider unavailable")}
                  </Badge>
                  <Badge variant="neutral">{indexUid}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-6 md:grid-cols-2">
                <DetailField label="Display name" value={formatIndexText(indexDetailQuery.data.display_name, "Not set")} />
                <DetailField
                  label="Unique identifier"
                  value={formatIndexText(indexDetailQuery.data.unique_identifier, "Not set")}
                />
                <DetailField
                  label="Provider"
                  value={formatIndexText(indexDetailQuery.data.provider, "Not set")}
                />
                <DetailField label="UID" monospace value={indexUid} />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Description
                </div>
                <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {formatIndexText(indexDetailQuery.data.description, "No description provided.")}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle>Metadata JSON</CardTitle>
              <CardDescription>
                Raw backend metadata payload returned by the index detail endpoint.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {metadataJson ? (
                <pre className="overflow-x-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/60 p-4 text-xs leading-6 text-foreground">
                  {metadataJson}
                </pre>
              ) : (
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 px-4 py-3 text-sm text-muted-foreground">
                  This index does not include metadata JSON.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <ActionConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete index"
        actionLabel="delete"
        confirmButtonLabel="Delete index"
        confirmWord="DELETE"
        objectLabel="index"
        description="This removes the index registry record from the Markets backend."
        objectSummary={
          <div className="space-y-1">
            <div className="font-medium text-foreground">{indexTitle}</div>
            <div className="font-mono text-xs text-muted-foreground">{indexUid}</div>
          </div>
        }
        error={deleteIndexMutation.isError ? formatMainSequenceError(deleteIndexMutation.error) : undefined}
        isPending={deleteIndexMutation.isPending}
        onConfirm={() => deleteIndexMutation.mutateAsync()}
        onSuccess={async () => {
          await queryClient.invalidateQueries({
            queryKey: ["main_sequence", "indices"],
          });

          toast({
            variant: "success",
            title: "Index deleted",
            description: `${indexTitle} was deleted.`,
          });

          setDeleteDialogOpen(false);
          onDeleted?.();
        }}
        tone="danger"
      />
    </div>
  );
}
