import { Activity, AlertTriangle, CheckCircle2, DatabaseZap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogTable, type LogTableEntry } from "@/components/ui/log-table";
import { PageHeader } from "@/components/ui/page-header";

const mockAdminLogs: LogTableEntry[] = [
  {
    id: "deploy-rollout-42",
    timestamp: "2026-03-19T09:41:12Z",
    level: "info",
    source: "orchestrator.rollout",
    message: "Rolled out image revision 42 to execution workers",
    durationMs: 428,
    status: "Completed",
    summary:
      "The execution worker pool accepted the new image revision without restarting the scheduler or invalidating current queues.",
    tags: ["rollout", "workers", "image"],
    context: {
      region: "eu-central",
      image: "ghcr.io/main-sequence/execution-worker:42",
      workers_updated: 8,
      scheduler_restart_required: false,
    },
    children: [
      {
        id: "deploy-rollout-42-pull",
        timestamp: "2026-03-19T09:41:13Z",
        level: "debug",
        source: "orchestrator.image-puller",
        message: "Pulled container layers to worker nodes",
        durationMs: 188,
        status: "Completed",
        summary: "Layers were already cached on 5 nodes. Three nodes required a delta pull.",
      },
      {
        id: "deploy-rollout-42-health",
        timestamp: "2026-03-19T09:41:15Z",
        level: "info",
        source: "orchestrator.health",
        message: "Post-rollout probes passed",
        durationMs: 81,
        status: "Healthy",
        children: [
          {
            id: "deploy-rollout-42-health-api",
            timestamp: "2026-03-19T09:41:16Z",
            level: "debug",
            source: "probe.api",
            message: "API health endpoint returned 200",
            durationMs: 14,
          },
          {
            id: "deploy-rollout-42-health-queue",
            timestamp: "2026-03-19T09:41:16Z",
            level: "debug",
            source: "probe.queue",
            message: "Queue consumer lag remained below threshold",
            durationMs: 9,
          },
        ],
      },
    ],
  },
  {
    id: "job-batch-991",
    timestamp: "2026-03-19T09:43:58Z",
    level: "warning",
    source: "scheduler.batch",
    message: "Batch job 991 retried after upstream dataset timeout",
    durationMs: 1652,
    status: "Retried",
    summary:
      "The first execution attempt exhausted the remote dataset timeout budget. The scheduler re-queued the job on a warm worker with the same image and context.",
    tags: ["scheduler", "retry", "dataset-timeout"],
    context: {
      job_id: 991,
      project: "Alpha Risk",
      first_attempt_worker: "exec-w-17",
      retry_worker: "exec-w-08",
      timeout_seconds: 120,
    },
    children: [
      {
        id: "job-batch-991-fetch",
        timestamp: "2026-03-19T09:44:01Z",
        level: "error",
        source: "loader.dataset",
        message: "Upstream snapshot service exceeded response threshold",
        durationMs: 120034,
        status: "Timed out",
        summary: "No partial payload was committed. The retry reused the exact request fingerprint.",
      },
      {
        id: "job-batch-991-requeue",
        timestamp: "2026-03-19T09:44:04Z",
        level: "info",
        source: "scheduler.requeue",
        message: "Retry scheduled on alternate worker",
        durationMs: 27,
        status: "Queued",
      },
    ],
  },
  {
    id: "audit-access-7b2",
    timestamp: "2026-03-19T09:48:22Z",
    level: "notice",
    source: "audit.access",
    message: "Permission grant applied to project-maintainers group",
    durationMs: 33,
    status: "Applied",
    summary:
      "The admin console granted job execution and repository browse permissions to the project-maintainers group after policy evaluation succeeded.",
    tags: ["rbac", "audit"],
    context: {
      actor: "jose@main-sequence.io",
      group: "project-maintainers",
      permissions_added: ["project.jobs:run", "project.repository:view"],
    },
  },
];

const operationalSignals = [
  {
    label: "Healthy workers",
    value: "8 / 8",
    detail: "No degraded nodes after the last rollout.",
    icon: CheckCircle2,
    tone: "success" as const,
  },
  {
    label: "Retry queue",
    value: "3 jobs",
    detail: "Two scheduler retries and one manual replay are pending.",
    icon: AlertTriangle,
    tone: "warning" as const,
  },
  {
    label: "Audit throughput",
    value: "126 events",
    detail: "Policy and access changes captured in the last hour.",
    icon: Activity,
    tone: "primary" as const,
  },
  {
    label: "Storage sync",
    value: "14 ms p95",
    detail: "Registry metadata reads remain inside the target budget.",
    icon: DatabaseZap,
    tone: "secondary" as const,
  },
];

function getStatusBadgeVariant(status: string | null | undefined) {
  switch ((status ?? "").toLowerCase()) {
    case "completed":
    case "healthy":
    case "applied":
      return "success" as const;
    case "retried":
    case "queued":
      return "warning" as const;
    case "timed out":
      return "danger" as const;
    default:
      return "secondary" as const;
  }
}

export function AdminPanelPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Admin event stream"
        description="Recent control-plane events, scheduler retries, and audit activity."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {operationalSignals.map((signal) => {
          const Icon = signal.icon;

          return (
            <Card key={signal.label} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {signal.label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                      {signal.value}
                    </div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/50 text-foreground">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">{signal.detail}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform logs</CardTitle>
          <CardDescription>Control-plane, scheduler, and audit events.</CardDescription>
        </CardHeader>
        <CardContent>
          <LogTable
            logs={mockAdminLogs}
            renderRowActions={(entry) =>
              entry.status ? (
                <Badge variant={getStatusBadgeVariant(entry.status)}>{entry.status}</Badge>
              ) : null
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
