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
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeleteJobs,
  fetchJob,
  formatMainSequenceError,
  listProjectJobs,
  mainSequenceRegistryPageSize,
  runJob,
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

function parseCommandArgs(input: string) {
  const args: string[] = [];
  let current = "";
  let quote: "\"" | "'" | null = null;
  let escaped = false;

  for (const char of input.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }

    if ((char === "\"" || char === "'") && quote === null) {
      quote = char;
      continue;
    }

    if (char === quote) {
      quote = null;
      continue;
    }

    if (quote === null && /\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaped) {
    current += "\\";
  }

  if (current) {
    args.push(current);
  }

  return args;
}

export function MainSequenceProjectJobsTab({
  onCloseJobDetail,
  onCloseJobRunDetail,
  onOpenProjectDetail,
  onOpenJobDetail,
  onOpenJobRunDetail,
  projectUid,
  projectTitle,
  selectedJobUid,
  selectedJobRunUid,
}: {
  onCloseJobDetail: () => void;
  onCloseJobRunDetail: () => void;
  onOpenProjectDetail: (projectUid: string) => void;
  onOpenJobDetail: (jobUid: string) => void;
  onOpenJobRunDetail: (jobRunUid: string) => void;
  projectUid: string;
  projectTitle: string;
  selectedJobUid: string | null;
  selectedJobRunUid: string | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterValue, setFilterValue] = useState("");
  const [jobsPageIndex, setJobsPageIndex] = useState(0);
  const [jobsPendingDelete, setJobsPendingDelete] = useState<JobRecord[]>([]);
  const [runCommandValue, setRunCommandValue] = useState("");
  const deferredFilterValue = useDeferredValue(filterValue);

  const jobsQuery = useQuery({
    queryKey: [
      "main_sequence",
      "projects",
      "jobs",
      projectUid,
      jobsPageIndex,
      deferredFilterValue.trim(),
    ],
    queryFn: () =>
      listProjectJobs(projectUid, {
        limit: mainSequenceRegistryPageSize,
        offset: jobsPageIndex * mainSequenceRegistryPageSize,
        search: deferredFilterValue.trim() || undefined,
      }),
    enabled: Boolean(projectUid),
  });

  const selectedJobFromList = useMemo(
    () => (jobsQuery.data?.results ?? []).find((job) => job.uid === selectedJobUid) ?? null,
    [jobsQuery.data?.results, selectedJobUid],
  );

  const jobDetailQuery = useQuery({
    queryKey: ["main_sequence", "projects", "jobs", "detail", projectUid, selectedJobUid],
    queryFn: () => fetchJob(selectedJobUid ?? ""),
    enabled: Boolean(projectUid && selectedJobUid),
  });

  useEffect(() => {
    setJobsPageIndex(0);
  }, [deferredFilterValue]);

  useEffect(() => {
    setRunCommandValue("");
  }, [selectedJobUid]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((jobsQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (jobsPageIndex > totalPages - 1) {
      setJobsPageIndex(totalPages - 1);
    }
  }, [jobsPageIndex, jobsQuery.data?.count]);

  const filteredJobs = jobsQuery.data?.results ?? [];
  const jobSelection = useRegistrySelection(filteredJobs, (job) => job.uid);
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
    mutationFn: async (jobs: JobRecord[]) => bulkDeleteJobs(jobs.map((job) => job.uid)),
    onSuccess: async (result, jobs) => {
      const deletedCount = result.deleted_count ?? jobs.length;
      setJobsPendingDelete([]);
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "jobs", projectUid],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", projectUid],
      });

      if (deletedCount > 0) {
        toast({
          variant: "success",
          title: deletedCount === 1 ? "Job deleted" : "Jobs deleted",
          description:
            deletedCount === 1
              ? `${jobs[0]?.name ?? "Job"} was deleted.`
              : `${deletedCount} jobs were deleted.`,
        });
      }

      jobSelection.clearSelection();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Job deletion failed",
        description: formatMainSequenceError(error),
      });
    },
  });
  const runJobMutation = useMutation({
    mutationFn: async ({
      commandArgs,
      jobUid,
    }: {
      commandArgs: string[];
      jobUid: string;
    }) => runJob(jobUid, { commandArgs }),
    onSuccess: async (_, { commandArgs, jobUid }) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "jobs", "detail", projectUid, jobUid],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "jobs", projectUid],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "jobs", "runs", jobUid],
      });

      toast({
        title: "Job started",
        description:
            commandArgs.length > 0
            ? `Triggered ${selectedJob?.name ?? `Job ${jobUid}`} with ${commandArgs.length} command args.`
            : `Triggered ${selectedJob?.name ?? `Job ${jobUid}`}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Job start failed",
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
    (selectedJobUid ? `Job ${selectedJobUid}` : "Job");

  if (selectedJobUid) {
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
          <form
            className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();

              if (!selectedJobUid || runJobMutation.isPending) {
                return;
              }

              void runJobMutation.mutateAsync({
                commandArgs: parseCommandArgs(runCommandValue),
                jobUid: selectedJobUid,
              });
            }}
          >
            <Input
              aria-label="Command arguments"
              className="min-w-52 max-w-md flex-1"
              disabled={runJobMutation.isPending}
              onChange={(event) => setRunCommandValue(event.target.value)}
              placeholder="sync --prices"
              value={runCommandValue}
            />
            <Button
              type="submit"
              size="sm"
              disabled={runJobMutation.isPending}
            >
              {runJobMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Run Job
            </Button>
            <Button variant="outline" size="sm" onClick={onCloseJobDetail}>
              <ArrowLeft className="h-4 w-4" />
              Back to jobs
            </Button>
          </form>
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
                  queryKey: ["main_sequence", "projects", "jobs", "detail", projectUid, selectedJobUid],
                });
                await queryClient.invalidateQueries({
                  queryKey: ["main_sequence", "projects", "jobs", projectUid],
                });
                await queryClient.invalidateQueries({
                  queryKey: ["main_sequence", "projects", "summary", projectUid],
                });
              }}
            />

            <Card>
              <CardContent className="pt-5">
                {selectedJobUid ? (
                  <MainSequenceJobRunsTab
                    jobUid={selectedJobUid}
                    onCloseJobRunDetail={onCloseJobRunDetail}
                    onOpenProjectDetail={onOpenProjectDetail}
                    onOpenJobDetail={onOpenJobDetail}
                    onOpenJobRunDetail={onOpenJobRunDetail}
                    selectedJobRunUid={selectedJobRunUid}
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
          placeholder="Filter by name, UID, execution path, or compute"
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
                const selected = jobSelection.isSelected(job.uid);

                return (
                  <tr key={job.uid}>
                    <td className={getRegistryTableCellClassName(selected, "left")}>
                      <MainSequenceSelectionCheckbox
                        ariaLabel={`Select ${job.name}`}
                        checked={selected}
                        onChange={() => jobSelection.toggleSelection(job.uid)}
                      />
                    </td>
                    <td className={getRegistryTableCellClassName(selected)}>
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="group inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:text-primary"
                          onClick={() => onOpenJobDetail(job.uid)}
                          title={`Open ${job.name}`}
                        >
                          <span className="font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors group-hover:decoration-primary group-focus-visible:decoration-primary">
                            {job.name}
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary group-focus-visible:text-primary" />
                        </button>
                        <div className="mt-1 text-xs text-muted-foreground">UID {job.uid}</div>
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
                {jobsPendingDelete[0] ? `Job UID ${jobsPendingDelete[0].uid}` : null}
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
