import {
  type EntitySummaryHeader,
  type JobRecord,
} from "../../api";

export function formatExecutionTarget(job: JobRecord) {
  if (job.execution_path?.trim()) {
    return job.execution_path.trim();
  }

  if (job.app_name?.trim()) {
    return job.app_name.trim();
  }

  return "No execution target";
}

export function formatComputeSummary(job: JobRecord) {
  const parts = [
    job.cpu_request ? `CPU ${job.cpu_request}` : null,
    job.memory_request ? `Memory ${job.memory_request}` : null,
    job.gpu_request ? `GPU ${job.gpu_request}${job.gpu_type ? ` · ${job.gpu_type}` : ""}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "No resource requests";
}

export function formatRuntime(job: JobRecord) {
  if (job.max_runtime_seconds === null || job.max_runtime_seconds === undefined) {
    return "No limit";
  }

  return `${job.max_runtime_seconds}s`;
}

export function formatSchedule(job: JobRecord) {
  const schedule = job.task_schedule?.schedule as
    | {
        type?: string;
        expression?: string;
        every?: number;
        period?: string;
      }
    | undefined;

  if (!schedule?.type) {
    return "Manual";
  }

  if (schedule.type === "crontab") {
    return schedule.expression || "Crontab";
  }

  if (schedule.type === "interval" && schedule.every && schedule.period) {
    return `Every ${schedule.every} ${schedule.period}`;
  }

  return schedule.type;
}

export function getTaskScheduleName(job: JobRecord) {
  const rawName =
    job.task_schedule && typeof job.task_schedule === "object" && "name" in job.task_schedule
      ? job.task_schedule.name
      : null;

  return typeof rawName === "string" && rawName.trim() ? rawName.trim() : "No schedule";
}

export function formatImageLabel(job: JobRecord) {
  return job.related_image ? `Image ${job.related_image}` : "Dynamic image";
}

export function formatImageMeta(job: JobRecord) {
  return job.related_image ? "Pinned image" : "Latest commit";
}

export function formatCapacity(job: JobRecord) {
  return job.spot ? "Spot" : "Standard";
}

export function buildJobSummary(
  job: JobRecord,
  {
    projectTitle,
    projectHref,
  }: {
    projectTitle: string;
    projectHref?: string;
  },
): EntitySummaryHeader {
  return {
    entity: {
      id: job.id,
      type: "job",
      title: job.name,
    },
    badges: [
      {
        key: "capacity",
        label: formatCapacity(job),
        tone: job.spot ? "warning" : "secondary",
      },
      {
        key: "job-type",
        label: job.app_name ? "Application job" : "File job",
        tone: "neutral",
      },
    ],
    inline_fields: [
      {
        key: "project",
        label: "Project",
        value: projectTitle,
        kind: "text",
        href: projectHref,
      },
      {
        key: "execution",
        label: "Execution",
        value: formatExecutionTarget(job),
        kind: job.execution_path ? "code" : "text",
        icon: "play-square",
      },
      {
        key: "schedule",
        label: "Schedule",
        value: formatSchedule(job),
        meta: getTaskScheduleName(job),
        kind: "text",
        icon: "timer-reset",
      },
      {
        key: "image",
        label: "Image",
        value: formatImageLabel(job),
        meta: formatImageMeta(job),
        kind: "text",
        icon: "package",
      },
    ],
    highlight_fields: [
      {
        key: "name",
        label: "Job name",
        value: job.name,
        kind: "text",
        edit: {
          enabled: true,
          editor: "text",
          submit: {
            method: "PATCH",
            path: `job/${job.id}/`,
            field: "name",
          },
          required: true,
          placeholder: "Job name",
        },
      },
      {
        key: "capacity",
        label: "Capacity",
        value: formatCapacity(job),
        meta: job.spot ? "Interruptible compute capacity." : "Standard compute capacity.",
        kind: "text",
        tone: job.spot ? "warning" : undefined,
        edit: {
          enabled: true,
          editor: "toggle",
          submit: {
            method: "PATCH",
            path: `job/${job.id}/`,
            field: "spot",
          },
          trueLabel: "Spot",
          falseLabel: "Standard",
          trueValue: true,
          falseValue: false,
        },
      },
      {
        key: "runtime",
        label: "Runtime",
        value: formatRuntime(job),
        meta: job.max_runtime_seconds ? "Timed job" : "Unlimited",
        kind: "text",
        icon: "timer-reset",
        edit: {
          enabled: true,
          editor: "number",
          submit: {
            method: "PATCH",
            path: `job/${job.id}/`,
            field: "max_runtime_seconds",
          },
          placeholder: "Max runtime in seconds",
        },
      },
    ],
    stats: [
      {
        key: "cpu_request",
        label: "CPU",
        display: job.cpu_request ?? "Not set",
        value: job.cpu_request ?? null,
        kind: "text",
        info: "Requested CPU allocation.",
        edit: {
          enabled: true,
          editor: "number",
          submit: {
            method: "PATCH",
            path: `job/${job.id}/`,
            field: "cpu_request",
          },
          placeholder: "CPU request",
        },
      },
      {
        key: "memory_request",
        label: "Memory",
        display: job.memory_request ?? "Not set",
        value: job.memory_request ?? null,
        kind: "text",
        info: "Requested memory allocation.",
        edit: {
          enabled: true,
          editor: "number",
          submit: {
            method: "PATCH",
            path: `job/${job.id}/`,
            field: "memory_request",
          },
          placeholder: "Memory request",
        },
      },
      {
        key: "gpu_request",
        label: "GPU count",
        display: job.gpu_request ? String(job.gpu_request) : "0",
        value: job.gpu_request ?? null,
        kind: "text",
        info: "Requested GPU count.",
        edit: {
          enabled: true,
          editor: "number",
          submit: {
            method: "PATCH",
            path: `job/${job.id}/`,
            field: "gpu_request",
          },
          placeholder: "GPU count",
        },
      },
      {
        key: "gpu_type",
        label: "GPU type",
        display: job.gpu_type ?? "None",
        value: job.gpu_type ?? null,
        kind: "text",
        info: "Requested GPU type.",
        edit: {
          enabled: true,
          editor: "select",
          submit: {
            method: "PATCH",
            path: `job/${job.id}/`,
            field: "gpu_type",
          },
          choices: {
            type: "remote",
            endpoint: "/orm/api/pods/billing/available-gpu-types/",
            valueKey: "value",
            labelKey: "label",
          },
          placeholder: "Select a GPU type",
        },
      },
    ],
  };
}
