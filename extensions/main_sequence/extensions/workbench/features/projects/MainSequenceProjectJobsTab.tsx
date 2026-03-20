import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Loader2,
  Package,
  PlaySquare,
  TimerReset,
  Trash2,
} from "lucide-react";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";

import {
  deleteJob,
  fetchJob,
  formatMainSequenceError,
  listProjectJobs,
  mainSequenceRegistryPageSize,
  type JobRecord,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";
import {
  buildJobSummary,
  formatComputeSummary,
  formatExecutionTarget,
  formatImageLabel,
  formatImageMeta,
  formatRuntime,
  formatSchedule,
  getTaskScheduleName,
} from "../jobs/jobPresentation";
import { MainSequenceJobRunsTab } from "./MainSequenceJobRunsTab";

export function MainSequenceProjectJobsTab({
  onCloseJobDetail,
  onCloseJobRunDetail,
  onOpenProjectDetail,
  onOpenJobDetail,
  onOpenJobRunDetail,
  projectId,
  projectTitle,
  selectedJobId,
  selectedJobRunId,
}: {
  onCloseJobDetail: () => void;
  onCloseJobRunDetail: () => void;
  onOpenProjectDetail: (projectId: number) => void;
  onOpenJobDetail: (jobId: number) => void;
  onOpenJobRunDetail: (jobRunId: number) => void;
  projectId: number;
  projectTitle: string;
  selectedJobId: number | null;
  selectedJobRunId: number | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterValue, setFilterValue] = useState("");
  const [jobsPageIndex, setJobsPageIndex] = useState(0);
  const [jobsPendingDelete, setJobsPendingDelete] = useState<JobRecord[]>([]);
  const deferredFilterValue = useDeferredValue(filterValue);

  const jobsQuery = useQuery({
    queryKey: ["main_sequence", "projects", "jobs", projectId, jobsPageIndex],
    queryFn: () =>
      listProjectJobs(projectId, {
        limit: mainSequenceRegistryPageSize,
        offset: jobsPageIndex * mainSequenceRegistryPageSize,
      }),
    enabled: projectId > 0,
  });

  const selectedJobFromList = useMemo(
    () => (jobsQuery.data?.results ?? []).find((job) => job.id === selectedJobId) ?? null,
    [jobsQuery.data?.results, selectedJobId],
  );

  const jobDetailQuery = useQuery({
    queryKey: ["main_sequence", "projects", "jobs", "detail", projectId, selectedJobId],
    queryFn: () => fetchJob(selectedJobId ?? 0),
    enabled: projectId > 0 && Boolean(selectedJobId),
  });

  useEffect(() => {
    setJobsPageIndex(0);
  }, [deferredFilterValue]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((jobsQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (jobsPageIndex > totalPages - 1) {
      setJobsPageIndex(totalPages - 1);
    }
  }, [jobsPageIndex, jobsQuery.data?.count]);

  const filteredJobs = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return (jobsQuery.data?.results ?? []).filter((job) => {
      if (!needle) {
        return true;
      }

      return [
        job.name,
        String(job.id),
        job.execution_path ?? "",
        job.app_name ?? "",
        job.cpu_request ?? "",
        job.memory_request ?? "",
        job.gpu_request ?? "",
        job.gpu_type ?? "",
        formatSchedule(job),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [deferredFilterValue, jobsQuery.data?.results]);
  const jobSelection = useRegistrySelection(filteredJobs);
  const jobBulkActions =
    jobSelection.selectedCount > 0
      ? [
          {
            id: "delete-jobs",
            label:
              jobSelection.selectedCount === 1 ? "Delete selected job" : "Delete selected jobs",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => {
              deleteJobMutation.reset();
              setJobsPendingDelete(jobSelection.selectedItems);
            },
          },
        ]
      : [];

  const deleteJobMutation = useMutation({
    mutationFn: async (jobs: JobRecord[]) =>
      Promise.allSettled(jobs.map((job) => deleteJob(job.id))),
    onSuccess: async (results, jobs) => {
      const failedJobs = jobs.filter((_, index) => results[index]?.status === "rejected");
      const deletedCount = jobs.length - failedJobs.length;

      setJobsPendingDelete([]);
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "jobs", projectId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", projectId],
      });

      if (failedJobs.length > 0) {
        toast({
          variant: "error",
          title:
            failedJobs.length === jobs.length
              ? "Job deletion failed"
              : "Some jobs could not be deleted",
          description:
            failedJobs.length === jobs.length
              ? "No selected jobs were deleted."
              : `${failedJobs.length} of ${jobs.length} selected jobs could not be deleted.`,
        });
      }

      if (deletedCount > 0) {
        toast({
          variant: "success",
          title: deletedCount === 1 ? "Job deleted" : "Jobs deleted",
          description:
            deletedCount === 1
              ? `${jobs.find((job) => !failedJobs.some((failed) => failed.id === job.id))?.name ?? "Job"} was deleted.`
              : `${deletedCount} jobs were deleted.`,
        });
      }

      jobSelection.setSelection(failedJobs.map((job) => job.id));
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Job deletion failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const selectedJob = jobDetailQuery.data ?? selectedJobFromList;
  const jobSummary = selectedJob
    ? buildJobSummary(selectedJob, { projectTitle })
    : null;
  const jobTitle =
    selectedJob?.name ??
    selectedJobFromList?.name ??
    (selectedJobId ? `Job ${selectedJobId}` : "Job");

  if (selectedJobId) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={onCloseJobDetail}
            >
              Jobs
            </button>
            <span>/</span>
            <span className="text-foreground">{jobTitle}</span>
          </div>
          <Button variant="outline" size="sm" onClick={onCloseJobDetail}>
            <ArrowLeft className="h-4 w-4" />
            Back to jobs
          </Button>
        </div>

        {jobDetailQuery.isLoading && !jobSummary ? (
          <Card>
            <CardContent className="flex min-h-48 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading job details
              </div>
            </CardContent>
          </Card>
        ) : null}

        {jobDetailQuery.isError ? (
          <Card>
            <CardContent className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(jobDetailQuery.error)}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {jobSummary ? (
          <>
            <MainSequenceEntitySummaryCard
              summary={jobSummary}
              onSummaryUpdated={async () => {
                await queryClient.invalidateQueries({
                  queryKey: ["main_sequence", "projects", "jobs", "detail", projectId, selectedJobId],
                });
                await queryClient.invalidateQueries({
                  queryKey: ["main_sequence", "projects", "jobs", projectId],
                });
                await queryClient.invalidateQueries({
                  queryKey: ["main_sequence", "projects", "summary", projectId],
                });
              }}
            />

            <Card>
              <CardContent className="pt-5">
                {selectedJobId ? (
                  <MainSequenceJobRunsTab
                    jobId={selectedJobId}
                    onCloseJobRunDetail={onCloseJobRunDetail}
                    onOpenProjectDetail={onOpenProjectDetail}
                    onOpenJobDetail={onOpenJobDetail}
                    onOpenJobRunDetail={onOpenJobRunDetail}
                    selectedJobRunId={selectedJobRunId}
                  />
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">Project jobs</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse execution paths, runtime settings, schedules, and resource requests.
          </p>
        </div>
        <MainSequenceRegistrySearch
          actionMenuLabel="Job actions"
          accessory={<Badge variant="neutral">{`${jobsQuery.data?.count ?? 0} jobs`}</Badge>}
          bulkActions={jobBulkActions}
          clearSelectionLabel="Clear jobs"
          onClearSelection={jobSelection.clearSelection}
          renderSelectionSummary={(selectionCount) => `${selectionCount} jobs selected`}
          value={filterValue}
          onChange={(event) => setFilterValue(event.target.value)}
          placeholder="Filter by name, id, execution path, or compute"
          searchClassName="max-w-lg"
          selectionCount={jobSelection.selectedCount}
        />
      </div>

      {jobsQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading jobs
          </div>
        </div>
      ) : null}

      {jobsQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(jobsQuery.error)}
        </div>
      ) : null}

      {!jobsQuery.isLoading && !jobsQuery.isError && filteredJobs.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
            <PlaySquare className="h-6 w-6" />
          </div>
          <div className="mt-4 text-sm font-medium text-foreground">No jobs found</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a job from the Code tab, or clear the current filter.
          </p>
        </div>
      ) : null}

      {!jobsQuery.isLoading && !jobsQuery.isError && filteredJobs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1260px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="w-12 px-3 pb-2">
                  <MainSequenceSelectionCheckbox
                    ariaLabel="Select all visible jobs"
                    checked={jobSelection.allSelected}
                    indeterminate={jobSelection.someSelected}
                    onChange={jobSelection.toggleAll}
                  />
                </th>
                <th className="px-4 pb-2">Job</th>
                <th className="px-4 pb-2">Execution</th>
                <th className="px-4 pb-2">Compute</th>
                <th className="px-4 pb-2">Runtime</th>
                <th className="px-4 pb-2">Schedule</th>
                <th className="px-4 pb-2">Image</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => {
                const selected = jobSelection.isSelected(job.id);

                return (
                  <tr key={job.id}>
                    <td className={getRegistryTableCellClassName(selected, "left")}>
                      <MainSequenceSelectionCheckbox
                        ariaLabel={`Select ${job.name}`}
                        checked={selected}
                        onChange={() => jobSelection.toggleSelection(job.id)}
                      />
                    </td>
                    <td className={getRegistryTableCellClassName(selected)}>
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="group inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:text-primary"
                          onClick={() => onOpenJobDetail(job.id)}
                          title={`Open ${job.name}`}
                        >
                          <span className="font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors group-hover:decoration-primary group-focus-visible:decoration-primary">
                            {job.name}
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary group-focus-visible:text-primary" />
                        </button>
                        <div className="mt-1 text-xs text-muted-foreground">ID {job.id}</div>
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(selected)}>
                      <div className="min-w-0">
                        <div
                          className="max-w-[260px] truncate font-mono text-xs text-foreground"
                          title={formatExecutionTarget(job)}
                        >
                          {formatExecutionTarget(job)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {job.app_name ? "Application job" : "File job"}
                        </div>
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(selected)}>
                      <div
                        className="max-w-[260px] text-foreground"
                        title={formatComputeSummary(job)}
                      >
                        {formatComputeSummary(job)}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant={job.spot ? "warning" : "neutral"}>
                          {job.spot ? "Spot" : "Standard"}
                        </Badge>
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(selected)}>
                      <div className="flex items-start gap-2">
                        <TimerReset className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-foreground">{formatRuntime(job)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {job.max_runtime_seconds ? "Timed job" : "Unlimited"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(selected)}>
                      <div className="text-foreground">{formatSchedule(job)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {getTaskScheduleName(job)}
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(selected, "right")}>
                      <div className="flex items-start gap-2">
                        <Package className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-foreground">{formatImageLabel(job)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatImageMeta(job)}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!jobsQuery.isLoading && !jobsQuery.isError && (jobsQuery.data?.count ?? 0) > 0 ? (
        <MainSequenceRegistryPagination
          count={jobsQuery.data?.count ?? 0}
          itemLabel="jobs"
          pageIndex={jobsPageIndex}
          pageSize={mainSequenceRegistryPageSize}
          onPageChange={setJobsPageIndex}
        />
      ) : null}

      <ActionConfirmationDialog
        title={jobsPendingDelete.length > 1 ? "Delete jobs" : "Delete job"}
        open={jobsPendingDelete.length > 0}
        onClose={() => {
          if (!deleteJobMutation.isPending) {
            setJobsPendingDelete([]);
          }
        }}
        tone="danger"
        actionLabel="delete"
        objectLabel={jobsPendingDelete.length > 1 ? "jobs" : "job"}
        confirmWord={jobsPendingDelete.length > 1 ? "DELETE JOBS" : "DELETE JOB"}
        confirmButtonLabel={jobsPendingDelete.length > 1 ? "Delete jobs" : "Delete job"}
        description="This action removes the selected jobs from the project."
        specialText="This action cannot be undone."
        objectSummary={
          jobsPendingDelete.length === 1 ? (
            <>
              <div className="font-medium">{jobsPendingDelete[0]?.name}</div>
              <div className="mt-1 text-muted-foreground">
                {jobsPendingDelete[0] ? `Job ID ${jobsPendingDelete[0].id}` : null}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">{jobsPendingDelete.length} jobs selected</div>
              <div className="mt-1 text-muted-foreground">
                {jobsPendingDelete
                  .slice(0, 3)
                  .map((job) => job.name)
                  .join(", ")}
                {jobsPendingDelete.length > 3 ? ", ..." : ""}
              </div>
            </>
          )
        }
        error={
          deleteJobMutation.isError ? formatMainSequenceError(deleteJobMutation.error) : undefined
        }
        isPending={deleteJobMutation.isPending}
        onConfirm={() => {
          if (jobsPendingDelete.length === 0) {
            return;
          }

          void deleteJobMutation.mutateAsync(jobsPendingDelete);
        }}
      />
    </div>
  );
}
