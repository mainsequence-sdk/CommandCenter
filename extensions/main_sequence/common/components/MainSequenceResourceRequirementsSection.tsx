import type { ReactNode } from "react";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  estimateBillingCost,
  formatMainSequenceError,
  type BillingEstimateResources,
} from "../api";

type CostEstimateSource = "job-run" | "autopilot";

export interface MainSequenceCostEstimateConfig {
  clusterId?: number | null;
  disabled?: boolean;
  resources: BillingEstimateResources | null;
  source?: CostEstimateSource;
}

function parseNumberLike(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCpuRequest(value: string | number | null | undefined) {
  if (typeof value === "string" && value.trim().toLowerCase().endsWith("m")) {
    const parsed = parseNumberLike(value.trim().slice(0, -1));
    return parsed === null ? null : parsed / 1000;
  }

  return parseNumberLike(value);
}

function parseMemoryRequest(value: string | number | null | undefined) {
  if (typeof value !== "string") {
    return parseNumberLike(value);
  }

  const normalized = value.trim().replace(",", ".").toLowerCase();
  const unitMatch = normalized.match(/^(-?\d+(?:\.\d+)?)\s*(mib|mi|mb|m|gib|gi|gb|g)?$/);

  if (!unitMatch) {
    return parseNumberLike(value);
  }

  const parsed = Number(unitMatch[1]);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const unit = unitMatch[2];
  if (unit === "mib" || unit === "mi" || unit === "mb" || unit === "m") {
    return parsed / 1024;
  }

  return parsed;
}

function parseGpuRequest(value: string | number | null | undefined) {
  const parsed = parseNumberLike(value);
  return parsed === null || parsed < 0 ? 0 : parsed;
}

export function buildMainSequenceCostEstimateResources({
  cpuRequest,
  gpuRequest,
  gpuType,
  memoryRequest,
  spot,
}: {
  cpuRequest?: string | number | null;
  gpuRequest?: string | number | null;
  gpuType?: string | null;
  memoryRequest?: string | number | null;
  spot?: boolean | null;
}): BillingEstimateResources | null {
  const cpu = parseCpuRequest(cpuRequest);
  const memory = parseMemoryRequest(memoryRequest);

  if (cpu === null || cpu < 0 || memory === null || memory < 0) {
    return null;
  }

  return {
    cpu,
    memory,
    gpu_request: parseGpuRequest(gpuRequest),
    gpu_type: gpuType?.trim() || null,
    spot: Boolean(spot),
  };
}

function formatEstimateValue(value: number | string | null | undefined) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return String(value ?? "0");
  }

  return parsed.toLocaleString(undefined, {
    maximumFractionDigits: 5,
    minimumFractionDigits: parsed === 0 ? 2 : 0,
  });
}

export function MainSequenceResourceRequirementsSection({
  children,
  className,
  costEstimate,
  description,
  gridClassName,
  title = "Resources",
}: {
  children: ReactNode;
  className?: string;
  costEstimate?: MainSequenceCostEstimateConfig;
  description?: string;
  gridClassName?: string;
  title?: string;
}) {
  const estimateCostMutation = useMutation({
    mutationFn: () => {
      if (!costEstimate?.resources) {
        throw new Error("Enter valid CPU and memory resources before estimating cost.");
      }

      const source =
        costEstimate.source ?? (costEstimate.clusterId ? "job-run" : "autopilot");

      return estimateBillingCost({
        source,
        source_details: {
          ...(source === "job-run" ? { cluster_id: costEstimate.clusterId ?? null } : {}),
          resources: costEstimate.resources,
        },
      });
    },
  });
  const estimate = estimateCostMutation.data;
  const units = estimate?.details?.units || "USD/hour";

  return (
    <section className={cn("rounded-[24px] border border-border/70 bg-background/18 p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </div>
          {description ? (
            <div className="mt-1 text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {costEstimate ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={
              costEstimate.disabled ||
              !costEstimate.resources ||
              estimateCostMutation.isPending
            }
            onClick={() => {
              estimateCostMutation.reset();
              estimateCostMutation.mutate();
            }}
          >
            {estimateCostMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Estimate cost
          </Button>
        ) : null}
      </div>
      <div className={cn("grid gap-4 md:grid-cols-2", gridClassName)}>{children}</div>
      {estimate ? (
        <div className="mt-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-foreground">Estimated total</div>
            <div className="text-lg font-semibold tracking-tight text-foreground">
              {formatEstimateValue(estimate.total_estimate)} {units}
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                CPU
              </div>
              <div className="mt-1 text-sm text-foreground">
                {formatEstimateValue(estimate.rates.cpu)} {units}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Memory
              </div>
              <div className="mt-1 text-sm text-foreground">
                {formatEstimateValue(estimate.rates.mem)} {units}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                GPU
              </div>
              <div className="mt-1 text-sm text-foreground">
                {formatEstimateValue(estimate.rates.gpu)} {units}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {estimateCostMutation.isError ? (
        <div className="mt-4 rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(estimateCostMutation.error)}
        </div>
      ) : null}
    </section>
  );
}

export function MainSequenceResourceField({
  children,
  className,
  helperText,
  label,
}: {
  children: ReactNode;
  className?: string;
  helperText?: string;
  label: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </label>
      {children}
      {helperText ? <div className="text-xs text-muted-foreground">{helperText}</div> : null}
    </div>
  );
}

export function MainSequenceCapacityToggle({
  onChange,
  spot,
}: {
  onChange: (spot: boolean) => void;
  spot: boolean | null;
}) {
  return (
    <div className="flex h-11 items-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-1">
      <button
        type="button"
        className={
          spot === true
            ? "flex-1 rounded-[calc(var(--radius)-8px)] bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            : "flex-1 rounded-[calc(var(--radius)-8px)] px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        }
        onClick={() => onChange(true)}
      >
        Spot
      </button>
      <button
        type="button"
        className={
          spot === false
            ? "flex-1 rounded-[calc(var(--radius)-8px)] bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            : "flex-1 rounded-[calc(var(--radius)-8px)] px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        }
        onClick={() => onChange(false)}
      >
        Standard
      </button>
    </div>
  );
}
