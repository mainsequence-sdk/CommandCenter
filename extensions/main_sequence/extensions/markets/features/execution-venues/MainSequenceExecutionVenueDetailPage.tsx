import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, PencilLine, Trash2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  deleteExecutionVenue,
  fetchExecutionVenueDetail,
  updateExecutionVenue,
} from "../../../../common/api";
import {
  ExecutionVenueEditorDialog,
  buildExecutionVenueDeleteSummary,
  buildExecutionVenueInitialValues,
  buildExecutionVenueListRow,
  buildExecutionVenueUpdatePayload,
  formatExecutionVenueValue,
  getExecutionVenuesListPath,
  type ExecutionVenueEditorValues,
} from "./executionVenueShared";

function readPositiveInt(value: string | null | undefined) {
  const parsed = Number(value ?? "");

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readDeleteDetail(result: unknown, fallback: string) {
  if (result && typeof result === "object" && "detail" in result) {
    const detail = (result as { detail?: unknown }).detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail.trim();
    }
  }

  return fallback;
}

export function MainSequenceExecutionVenueDetailPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const executionVenueId = readPositiveInt(params.venueId);
  const backPath =
    ((location.state as { from?: string } | null)?.from || "").trim() ||
    getExecutionVenuesListPath();

  const executionVenueDetailQuery = useQuery({
    queryKey: ["main_sequence", "execution_venues", "detail", executionVenueId],
    queryFn: () => fetchExecutionVenueDetail(executionVenueId as number),
    enabled: executionVenueId !== null,
  });

  const updateExecutionVenueMutation = useMutation({
    mutationFn: (values: ExecutionVenueEditorValues) =>
      updateExecutionVenue(executionVenueId as number, buildExecutionVenueUpdatePayload(values)),
    onSuccess: async (executionVenue) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "execution_venues"],
      });

      toast({
        variant: "success",
        title: "Execution venue updated",
        description: `${executionVenue.name || executionVenue.symbol || `Venue ${executionVenue.id}`} was updated.`,
      });

      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Execution venue update failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });

  const selectedExecutionVenueRow = executionVenueDetailQuery.data
    ? buildExecutionVenueListRow(executionVenueDetailQuery.data)
    : null;

  function submitUpdate(values: ExecutionVenueEditorValues) {
    if (executionVenueId === null) {
      return;
    }

    try {
      updateExecutionVenueMutation.mutate(values);
    } catch (error) {
      toast({
        variant: "error",
        title: "Execution venue update failed",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    }
  }

  async function handleDeleteSuccess() {
    await queryClient.invalidateQueries({
      queryKey: ["main_sequence", "execution_venues"],
    });

    navigate(backPath, { replace: true });
  }

  if (executionVenueId === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Main Sequence Markets"
          title="Execution Venue"
          description="The requested execution venue id is invalid."
          actions={
            <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" />
              Back to execution venues
            </Button>
          }
        />
      </div>
    );
  }

  const executionVenueTitle =
    executionVenueDetailQuery.data?.name?.trim() ||
    executionVenueDetailQuery.data?.symbol?.trim() ||
    `Execution Venue ${executionVenueId}`;
  const executionVenueSubtitle = executionVenueDetailQuery.data?.symbol?.trim() || "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={executionVenueTitle}
        description={
          executionVenueSubtitle
            ? `Execution venue symbol ${executionVenueSubtitle}`
            : "Review and edit execution venue metadata."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{`ID ${executionVenueId}`}</Badge>
            <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" />
              Back to execution venues
            </Button>
            {executionVenueDetailQuery.data ? (
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(true)}>
                <PencilLine className="h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {executionVenueDetailQuery.data ? (
              <Button type="button" variant="danger" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </div>
        }
      />

      {executionVenueDetailQuery.isLoading ? (
        <Card>
          <CardContent className="flex min-h-56 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading execution venue detail
            </div>
          </CardContent>
        </Card>
      ) : null}

      {executionVenueDetailQuery.isError ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {executionVenueDetailQuery.error instanceof Error
                ? executionVenueDetailQuery.error.message
                : "The request failed."}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {executionVenueDetailQuery.data ? (
        <>
          <Card>
            <CardHeader className="border-b border-border/70">
              <div>
                <CardTitle>Execution venue details</CardTitle>
                <CardDescription>
                  These fields come from the standard DRF detail payload for the current venue.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pt-6 md:grid-cols-2">
              <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Symbol
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {formatExecutionVenueValue(executionVenueDetailQuery.data.symbol)}
                </div>
              </div>
              <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Name
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {formatExecutionVenueValue(executionVenueDetailQuery.data.name)}
                </div>
              </div>
            </CardContent>
          </Card>

          <ExecutionVenueEditorDialog
            mode="edit"
            open={editDialogOpen}
            onClose={() => {
              if (!updateExecutionVenueMutation.isPending) {
                setEditDialogOpen(false);
              }
            }}
            onSubmit={submitUpdate}
            isPending={updateExecutionVenueMutation.isPending}
            error={updateExecutionVenueMutation.error}
            initialValues={buildExecutionVenueInitialValues(executionVenueDetailQuery.data)}
          />

          <ActionConfirmationDialog
            actionLabel="delete the selected execution venue"
            confirmButtonLabel="Delete venue"
            confirmWord="DELETE"
            description="This uses the execution-venue DELETE endpoint from the dedicated detail page."
            errorToast={{
              title: "Execution venue deletion failed",
              description: (error) =>
                error instanceof Error ? error.message : "The request failed.",
            }}
            objectLabel="execution venue"
            objectSummary={
              selectedExecutionVenueRow
                ? buildExecutionVenueDeleteSummary([selectedExecutionVenueRow])
                : null
            }
            onClose={() => setDeleteDialogOpen(false)}
            onConfirm={() => deleteExecutionVenue(executionVenueId)}
            onSuccess={handleDeleteSuccess}
            open={deleteDialogOpen}
            successToast={{
              title: "Execution venue deleted",
              description: (result) =>
                readDeleteDetail(result, `${executionVenueTitle} was deleted.`),
            }}
            title="Delete execution venue"
            tone="danger"
          />
        </>
      ) : null}
    </div>
  );
}
