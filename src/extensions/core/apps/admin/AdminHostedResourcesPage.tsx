import { useEffect, useState } from "react";

import {
  Database,
  ExternalLink,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { getRegistryTableCellClassName } from "../../../../../extensions/main_sequence/common/components/registryTable";
import { resolvePhysicalDataSourceIcon } from "../../../../../extensions/main_sequence/common/components/physicalDataSourceIcons";

import {
  AdminRequestError,
  cancelHostedManagedDatabaseAtPeriodEnd,
  cancelHostedManagedDatabaseNow,
  createHostedManagedDatabase,
  getHostedManagedDatabase,
  listHostedManagedDatabasePlans,
  listHostedManagedDatabases,
  revealHostedManagedDatabaseCredentials,
  rotateHostedManagedDatabaseCredentials,
  type HostedManagedDatabaseAllocation,
  type HostedManagedDatabaseCatalogResponse,
  type HostedManagedDatabaseCreateInput,
  type HostedManagedDatabaseCredentialsRevealResponse,
  type HostedManagedDatabaseExtensionOption,
  type HostedManagedDatabasePatchInput,
  type HostedManagedDatabaseProvisioningFailedErrorPayload,
  updateHostedManagedDatabase,
} from "./api";
import { AdminSurfaceLayout } from "./shared";

const hostedDatabaseQueryKeys = {
  catalog: ["admin", "billing", "hosted-resources", "databases", "catalog"] as const,
  databases: ["admin", "billing", "hosted-resources", "databases", "list"] as const,
  detail: (allocationUid: string) =>
    ["admin", "billing", "hosted-resources", "databases", "detail", allocationUid] as const,
};

const postgresIcon = resolvePhysicalDataSourceIcon({ classType: "postgresql" });
const timescaleIcon = resolvePhysicalDataSourceIcon({ classType: "timescale_db" });

interface ManagedDatabaseFormState {
  displayName: string;
  description: string;
  extensions: string[];
  postgresVersion: string;
  computeTierId: string;
  computeShapeId: string;
  storageGib: string;
  backupRetentionDays: string;
  highAvailabilityMode: string;
  maintenanceWindowDayOfWeek: string;
  maintenanceWindowStartHour: string;
  maintenanceWindowStartMinute: string;
}

interface ManagedDatabasePriceEstimate {
  computeAmountCents: number;
  storageAmountCents: number;
  backupAmountCents: number;
  highAvailabilityAmountCents: number;
  monthlyTotalAmountCents: number;
  dueNowAmountCents: number;
  currency: string;
  billingInterval: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  periodSeconds: number | null;
  remainingPeriodSeconds: number | null;
  prorationFactor: number | null;
}

interface ManagedDatabasePatchPreview {
  currentMonthlyAmountCents: number;
  newMonthlyAmountCents: number;
  deltaMonthlyAmountCents: number;
  deltaDueNowAmountCents: number;
  dueNowAmountCents: number;
  currency: string;
  billingInterval: string;
  currentPeriodEnd: string | null;
}

type ManagedDatabaseDialogMode = "create" | "summary" | "edit";
type ManagedDatabaseConfirmationAction =
  | {
      kind: "cancel_at_period_end";
      path: string;
    }
  | {
      kind: "cancel_now";
      path: string;
    };

const emptyFormState: ManagedDatabaseFormState = {
  displayName: "",
  description: "",
  extensions: [],
  postgresVersion: "",
  computeTierId: "",
  computeShapeId: "",
  storageGib: "",
  backupRetentionDays: "",
  highAvailabilityMode: "",
  maintenanceWindowDayOfWeek: "",
  maintenanceWindowStartHour: "",
  maintenanceWindowStartMinute: "",
};

function formatAdminError(error: unknown) {
  return error instanceof Error ? error.message : "The hosted resource request failed.";
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatCents(amountCents?: number | null, currency = "USD") {
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

function readAllocationUid(record: HostedManagedDatabaseAllocation) {
  return record.allocation_uid ?? "";
}

function readDatabaseTitle(record: HostedManagedDatabaseAllocation) {
  const candidates = [record.display_name, record.resource?.display_name];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return "Managed database";
}

function readDatabaseTypeLabel(record: HostedManagedDatabaseAllocation) {
  const extensions = safeArray(record.extensions);

  if (extensions.includes("timescaledb")) {
    return "PostgreSQL + TimescaleDB";
  }

  return "PostgreSQL";
}

function readStatus(record: HostedManagedDatabaseAllocation) {
  const billingStatus = String(record.billing_status ?? "").toLowerCase();
  const status = String(record.status ?? "").toLowerCase();

  if (billingStatus === "past_due") {
    return {
      label: "Payment required",
      variant: "warning" as const,
      detail: "The database is stopped until the next period is paid.",
    };
  }

  if (status === "suspended") {
    return {
      label: "Suspended",
      variant: "warning" as const,
      detail: "Add credits to resume this database.",
    };
  }

  if (status === "cancel_pending" || record.cancel_at_period_end) {
    return {
      label: "Cancels at period end",
      variant: "warning" as const,
      detail: `Paid through ${formatDateTime(record.current_period_end)}.`,
    };
  }

  if (status === "cancelled") {
    return { label: "Cancelled", variant: "neutral" as const, detail: "Cancelled." };
  }

  if (status === "failed") {
    return { label: "Failed", variant: "danger" as const, detail: "Provisioning failed." };
  }

  if (status === "active" && billingStatus === "paid") {
    return {
      label: "Active",
      variant: "success" as const,
      detail: `Paid through ${formatDateTime(record.current_period_end)}. Renews monthly using organization credits.`,
    };
  }

  return {
    label: record.status ?? "Unknown",
    variant: "neutral" as const,
    detail: record.billing_status ? `Billing status: ${record.billing_status}` : "Billing status unavailable.",
  };
}

function readResourceSummary(record: HostedManagedDatabaseAllocation) {
  const shape = record.physical_resource?.shape;
  const parts = [
    typeof shape?.vcpus === "number" ? `${shape.vcpus} vCPU` : null,
    typeof shape?.memory_gib === "number" ? `${shape.memory_gib} GiB RAM` : null,
    typeof shape?.storage_gib === "number" ? `${shape.storage_gib} GiB storage` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" / ") : "—";
}

function readMonthlyPrice(record: HostedManagedDatabaseAllocation) {
  if (typeof record.price_amount_cents === "number") {
    return `${formatCents(record.price_amount_cents, record.currency ?? "USD")} / ${record.billing_interval ?? "month"}`;
  }

  if (typeof record.price_amount === "string" && record.price_amount.trim()) {
    return `${record.currency ?? "USD"} ${record.price_amount} / ${record.billing_interval ?? "month"}`;
  }

  return "—";
}

function readDataSourceUid(record: HostedManagedDatabaseAllocation | null | undefined) {
  if (!record) {
    return "";
  }

  return record.dynamic_table_data_source_uid ?? record.data_source_uid ?? "";
}

function readPostgresVersion(record: HostedManagedDatabaseAllocation | null | undefined) {
  const version = record?.physical_resource?.shape?.postgres_version;
  return typeof version === "string" && version.trim().length > 0 ? version : "—";
}

function readComputeTierLabel(record: HostedManagedDatabaseAllocation | null | undefined) {
  const tierLabel = record?.physical_resource?.shape?.compute_tier_label;

  if (typeof tierLabel === "string" && tierLabel.trim().length > 0) {
    return tierLabel;
  }

  const tier = record?.physical_resource?.shape?.compute_tier;
  return typeof tier === "string" && tier.trim().length > 0 ? tier : "—";
}

function readComputeShapeLabelFromAllocation(record: HostedManagedDatabaseAllocation | null | undefined) {
  const shapeLabel = record?.physical_resource?.shape?.compute_shape_label;

  if (typeof shapeLabel === "string" && shapeLabel.trim().length > 0) {
    return shapeLabel;
  }

  return readResourceSummary(record ?? {});
}

function formatMaintenanceWindow(
  maintenanceWindow?: {
    day_of_week?: number;
    start_hour?: number;
    start_minute?: number;
  } | null,
) {
  if (!maintenanceWindow) {
    return "—";
  }

  const { day_of_week, start_hour, start_minute } = maintenanceWindow;

  if (
    typeof day_of_week !== "number" ||
    typeof start_hour !== "number" ||
    typeof start_minute !== "number"
  ) {
    return "—";
  }

  return `Day ${day_of_week} · ${String(start_hour).padStart(2, "0")}:${String(start_minute).padStart(2, "0")}`;
}

function readNetworkingMode(record: HostedManagedDatabaseAllocation | null | undefined) {
  const networkingAccess = record?.network_access?.access_mode;

  if (typeof networkingAccess === "string" && networkingAccess.trim().length > 0) {
    return networkingAccess;
  }

  return "—";
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}

function readDescription(record: HostedManagedDatabaseAllocation | null | undefined) {
  const description = record?.resource?.description;
  return typeof description === "string" ? description : "";
}

function safeArray<T>(value: T[] | undefined | null) {
  return Array.isArray(value) ? value : [];
}

function readComputeShapeId(shape: { id?: string; code?: string }) {
  return shape.id ?? shape.code ?? "";
}

function readComputeShapeLabel(shape: {
  label?: string;
  memory_gib: number;
  vcpus: number;
}) {
  return shape.label ?? `${shape.vcpus} vCPU / ${shape.memory_gib} GiB RAM`;
}

function readComputeShapeDescription(shape: {
  memory_gib: number;
  vcpus: number;
}) {
  return [`${shape.vcpus} vCPU`, `${shape.memory_gib} GiB RAM`].join(" · ");
}

function resolveExtensionIcon(extension: HostedManagedDatabaseExtensionOption) {
  const code = extension.code.trim().toLowerCase();

  if (code === "timescaledb" || code === "timescale_db") {
    return timescaleIcon;
  }

  return null;
}

function computeTierOptions(catalog: HostedManagedDatabaseCatalogResponse | undefined) {
  return safeArray(catalog?.configuration_options?.compute_tiers);
}

function buildSuggestedDisplayName(extensions: string[]) {
  return extensions.includes("timescaledb") ? "TimescaleDB database" : "PostgreSQL database";
}

function readTierShapes(
  catalog: HostedManagedDatabaseCatalogResponse | undefined,
  tierId: string,
) {
  const tier = computeTierOptions(catalog).find((item) => item.id === tierId) ?? null;
  return safeArray(tier?.compute_shapes).filter(
    (shape) => readComputeShapeId(shape).length > 0 && shape.available !== false,
  );
}

function parseFiniteNumber(value: unknown) {
  if (typeof value === "string" && value.trim().length === 0) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFiniteInteger(value: unknown) {
  const parsed = parseFiniteNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function readProrationFactor(catalog: HostedManagedDatabaseCatalogResponse | undefined) {
  const billing = catalog?.billing;
  const periodSeconds = parseFiniteInteger(billing?.period_seconds);
  const remainingPeriodSeconds = parseFiniteInteger(billing?.remaining_period_seconds);

  if (
    periodSeconds !== null &&
    remainingPeriodSeconds !== null &&
    periodSeconds > 0 &&
    remainingPeriodSeconds >= 0
  ) {
    return {
      periodSeconds,
      remainingPeriodSeconds,
      prorationFactor: remainingPeriodSeconds / periodSeconds,
    };
  }

  const prorationFactor = parseFiniteNumber(billing?.proration_factor);
  return {
    periodSeconds,
    remainingPeriodSeconds,
    prorationFactor,
  };
}

function calculatePriceEstimate(
  catalog: HostedManagedDatabaseCatalogResponse | undefined,
  form: ManagedDatabaseFormState,
): ManagedDatabasePriceEstimate | null {
  const pricing = catalog?.pricing;

  if (!pricing?.available) {
    return null;
  }

  const computeAmountCents = parseFiniteNumber(
    pricing.compute?.[form.computeShapeId]?.monthly_amount_cents,
  );
  const storageAmountCentsPerGib =
    parseFiniteNumber(pricing.storage?.monthly_amount_cents_per_gib) ?? 0;
  const backupAmountCentsPerGib = parseFiniteNumber(
    pricing.backup?.monthly_amount_cents_per_gib,
  );
  const storageGib = parseFiniteNumber(form.storageGib);
  const includedBackupDays = parseFiniteNumber(
    catalog?.configuration_options?.backup_retention_days?.included_days ??
      catalog?.configuration_options?.backup_retention_days?.min ??
      0,
  );
  const backupRetentionDays =
    parseFiniteNumber(form.backupRetentionDays) ??
    (backupAmountCentsPerGib === null || backupAmountCentsPerGib === 0 ? includedBackupDays : null);

  if (
    computeAmountCents === null ||
    storageGib === null ||
    backupRetentionDays === null ||
    includedBackupDays === null
  ) {
    return null;
  }

  const highAvailabilityMultiplierRaw = parseFiniteNumber(
    pricing.high_availability?.compute_multipliers?.[form.highAvailabilityMode],
  );
  const disabledHighAvailabilityMultiplier = parseFiniteNumber(
    pricing.high_availability?.compute_multipliers?.Disabled,
  );
  const effectiveComputeMultiplier =
    highAvailabilityMultiplierRaw === null
      ? 1
      : disabledHighAvailabilityMultiplier === 0
        ? 1 + highAvailabilityMultiplierRaw
        : highAvailabilityMultiplierRaw;
  const storageAmountCents = storageGib * storageAmountCentsPerGib;
  const extraBackupDays = Math.max(0, backupRetentionDays - includedBackupDays);
  const backupAmountCents = backupAmountCentsPerGib !== null
    ? Math.round((storageGib * extraBackupDays * backupAmountCentsPerGib) / 30)
    : 0;
  const highAvailabilityAmountCents = Math.round(
    computeAmountCents * Math.max(0, effectiveComputeMultiplier - 1),
  );
  const monthlyTotalAmountCents = Math.round(
    computeAmountCents * effectiveComputeMultiplier + storageAmountCents + backupAmountCents,
  );
  const proration = readProrationFactor(catalog);

  return {
    computeAmountCents: Math.round(computeAmountCents),
    storageAmountCents: Math.round(storageAmountCents),
    backupAmountCents: Math.round(backupAmountCents),
    highAvailabilityAmountCents: Math.round(highAvailabilityAmountCents),
    monthlyTotalAmountCents,
    dueNowAmountCents:
      proration.prorationFactor === null
        ? monthlyTotalAmountCents
        : Math.round(monthlyTotalAmountCents * proration.prorationFactor),
    currency: pricing.currency ?? pricing.compute?.[form.computeShapeId]?.currency ?? "USD",
    billingInterval: pricing.billing_interval ?? "month",
    currentPeriodStart: catalog?.billing?.current_period_start ?? null,
    currentPeriodEnd: catalog?.billing?.current_period_end ?? null,
    periodSeconds: proration.periodSeconds,
    remainingPeriodSeconds: proration.remainingPeriodSeconds,
    prorationFactor: proration.prorationFactor,
  };
}

function readCurrentMonthlyAmount(record: HostedManagedDatabaseAllocation | null | undefined) {
  return parseFiniteInteger(record?.price_amount_cents);
}

function readCurrentComputeShapeId(record: HostedManagedDatabaseAllocation | null | undefined) {
  const shapeId = record?.physical_resource?.shape?.compute_shape_id;
  return typeof shapeId === "string" ? shapeId : "";
}

function readCurrentStorageGib(record: HostedManagedDatabaseAllocation | null | undefined) {
  const storageGib = record?.physical_resource?.shape?.storage_gib;
  return typeof storageGib === "number" && Number.isFinite(storageGib) ? storageGib : null;
}

function readCurrentHighAvailabilityMode(record: HostedManagedDatabaseAllocation | null | undefined) {
  const mode = record?.physical_resource?.shape?.high_availability?.mode;
  return typeof mode === "string" ? mode : "";
}

function readCurrentBackupRetentionDays(
  record: HostedManagedDatabaseAllocation | null | undefined,
) {
  return parseFiniteInteger(record?.physical_resource?.shape?.backup_retention_days);
}

function calculatePatchPreview(
  catalog: HostedManagedDatabaseCatalogResponse | undefined,
  currentRecord: HostedManagedDatabaseAllocation | null | undefined,
  nextEstimate: ManagedDatabasePriceEstimate | null,
): ManagedDatabasePatchPreview | null {
  if (!catalog || !currentRecord || !nextEstimate) {
    return null;
  }

  const currentMonthlyAmountCents = readCurrentMonthlyAmount(currentRecord);
  if (currentMonthlyAmountCents === null) {
    return null;
  }

  const deltaMonthlyAmountCents = nextEstimate.monthlyTotalAmountCents - currentMonthlyAmountCents;
  const prorationFactor = readProrationFactor(catalog).prorationFactor;
  const deltaDueNowAmountCents =
    prorationFactor === null
      ? deltaMonthlyAmountCents
      : Math.round(deltaMonthlyAmountCents * prorationFactor);

  return {
    currentMonthlyAmountCents,
    newMonthlyAmountCents: nextEstimate.monthlyTotalAmountCents,
    deltaMonthlyAmountCents,
    deltaDueNowAmountCents,
    dueNowAmountCents: nextEstimate.dueNowAmountCents,
    currency: nextEstimate.currency,
    billingInterval: nextEstimate.billingInterval,
    currentPeriodEnd: nextEstimate.currentPeriodEnd,
  };
}

function makeEditForm(
  record: HostedManagedDatabaseAllocation,
  catalog?: HostedManagedDatabaseCatalogResponse,
): ManagedDatabaseFormState {
  const fallback = makeInitialForm(catalog);
  const currentShapeId = readCurrentComputeShapeId(record);
  const tierOptions = computeTierOptions(catalog);
  const selectedTier =
    tierOptions.find((tier) =>
      safeArray(tier.compute_shapes).some((shape) => readComputeShapeId(shape) === currentShapeId),
    ) ?? tierOptions[0] ?? null;
  const currentStorageGib = readCurrentStorageGib(record);
  const currentBackupRetentionDays = readCurrentBackupRetentionDays(record);
  const highAvailabilityMode = readCurrentHighAvailabilityMode(record);
  const maintenanceWindow = record.physical_resource?.maintenance_window;

  return {
    ...fallback,
    displayName: readDatabaseTitle(record),
    description: readDescription(record),
    extensions: safeArray(record.extensions).length > 0 ? safeArray(record.extensions) : fallback.extensions,
    postgresVersion: readPostgresVersion(record) !== "—" ? readPostgresVersion(record) : fallback.postgresVersion,
    computeTierId: selectedTier?.id ?? fallback.computeTierId,
    computeShapeId: currentShapeId || fallback.computeShapeId,
    storageGib: currentStorageGib === null ? fallback.storageGib : String(currentStorageGib),
    backupRetentionDays:
      currentBackupRetentionDays === null ? "" : String(currentBackupRetentionDays),
    highAvailabilityMode: highAvailabilityMode || fallback.highAvailabilityMode,
    maintenanceWindowDayOfWeek:
      typeof maintenanceWindow?.day_of_week === "number"
        ? String(maintenanceWindow.day_of_week)
        : fallback.maintenanceWindowDayOfWeek,
    maintenanceWindowStartHour:
      typeof maintenanceWindow?.start_hour === "number"
        ? String(maintenanceWindow.start_hour)
        : fallback.maintenanceWindowStartHour,
    maintenanceWindowStartMinute:
      typeof maintenanceWindow?.start_minute === "number"
        ? String(maintenanceWindow.start_minute)
        : fallback.maintenanceWindowStartMinute,
  };
}

function makeInitialForm(catalog?: HostedManagedDatabaseCatalogResponse): ManagedDatabaseFormState {
  const options = catalog?.configuration_options;
  const storageMin = parseFiniteNumber(options?.storage?.min_gib);
  const backupMin = parseFiniteNumber(options?.backup_retention_days?.min);
  const extensions = safeArray(catalog?.extensions)
    .filter((extension) => extension.available !== false)
    .map((extension) => extension.code);
  const tierOptions = computeTierOptions(catalog);
  const selectedTier = tierOptions[0] ?? null;
  const selectedTierShapes = safeArray(selectedTier?.compute_shapes).filter(
    (shape) => shape.available !== false && readComputeShapeId(shape).length > 0,
  );
  const availableShape = selectedTierShapes[0] ?? null;
  const highAvailabilityDefaultMode =
    options?.high_availability?.default?.mode ??
    safeArray(options?.high_availability?.modes)[0]?.id ??
    "";
  const maintenanceWindowDefault = options?.maintenance_window?.default;

  return {
    ...emptyFormState,
    displayName: buildSuggestedDisplayName(extensions),
    extensions,
    postgresVersion: safeArray(options?.postgres_versions)[0] ?? "",
    computeTierId: selectedTier?.id ?? "",
    computeShapeId: readComputeShapeId(availableShape ?? {}),
    storageGib: storageMin === null ? "" : String(storageMin),
    backupRetentionDays: backupMin === null ? "" : String(backupMin),
    highAvailabilityMode: highAvailabilityDefaultMode,
    maintenanceWindowDayOfWeek: String(
      maintenanceWindowDefault?.day_of_week ?? options?.maintenance_window?.day_of_week?.min ?? "",
    ),
    maintenanceWindowStartHour: String(
      maintenanceWindowDefault?.start_hour ?? options?.maintenance_window?.start_hour?.min ?? "",
    ),
    maintenanceWindowStartMinute: String(
      maintenanceWindowDefault?.start_minute ?? options?.maintenance_window?.start_minute?.min ?? "",
    ),
  };
}

function buildCreateInput(
  form: ManagedDatabaseFormState,
  estimate: ManagedDatabasePriceEstimate,
): HostedManagedDatabaseCreateInput {
  return {
    display_name: form.displayName.trim(),
    description: form.description.trim() || null,
    extensions: form.extensions,
    configuration: {
      postgres_version: form.postgresVersion,
      compute_shape_id: form.computeShapeId,
      storage_gib: Number(form.storageGib),
      ...(form.backupRetentionDays.trim().length > 0
        ? { backup_retention_days: Number(form.backupRetentionDays) }
        : {}),
      ...(form.highAvailabilityMode.trim().length > 0
        ? {
            high_availability: {
              mode: form.highAvailabilityMode,
            },
          }
        : {}),
      ...(
        form.maintenanceWindowDayOfWeek.trim().length > 0 ||
        form.maintenanceWindowStartHour.trim().length > 0 ||
        form.maintenanceWindowStartMinute.trim().length > 0
          ? {
              maintenance_window: {
                ...(form.maintenanceWindowDayOfWeek.trim().length > 0
                  ? { day_of_week: Number(form.maintenanceWindowDayOfWeek) }
                  : {}),
                ...(form.maintenanceWindowStartHour.trim().length > 0
                  ? { start_hour: Number(form.maintenanceWindowStartHour) }
                  : {}),
                ...(form.maintenanceWindowStartMinute.trim().length > 0
                  ? { start_minute: Number(form.maintenanceWindowStartMinute) }
                  : {}),
              },
            }
          : {}
      ),
    },
    expected_total_amount_cents: estimate.dueNowAmountCents,
  };
}

function buildPatchInput(form: ManagedDatabaseFormState): HostedManagedDatabasePatchInput {
  return {
    display_name: form.displayName.trim(),
    ...(form.description.trim().length > 0 ? { description: form.description.trim() } : {}),
    configuration: {
      compute_shape_id: form.computeShapeId,
      storage_gib: Number(form.storageGib),
      ...(form.backupRetentionDays.trim().length > 0
        ? { backup_retention_days: Number(form.backupRetentionDays) }
        : {}),
      ...(form.highAvailabilityMode.trim().length > 0
        ? {
            high_availability: {
              mode: form.highAvailabilityMode,
            },
          }
        : {}),
      ...(
        form.maintenanceWindowDayOfWeek.trim().length > 0 ||
        form.maintenanceWindowStartHour.trim().length > 0 ||
        form.maintenanceWindowStartMinute.trim().length > 0
          ? {
              maintenance_window: {
                ...(form.maintenanceWindowDayOfWeek.trim().length > 0
                  ? { day_of_week: Number(form.maintenanceWindowDayOfWeek) }
                  : {}),
                ...(form.maintenanceWindowStartHour.trim().length > 0
                  ? { start_hour: Number(form.maintenanceWindowStartHour) }
                  : {}),
                ...(form.maintenanceWindowStartMinute.trim().length > 0
                  ? { start_minute: Number(form.maintenanceWindowStartMinute) }
                  : {}),
              },
            }
          : {}
      ),
    },
  };
}

function getFormSubmitDisabledReason(
  form: ManagedDatabaseFormState,
  estimate: ManagedDatabasePriceEstimate | null,
  pricingAvailable: boolean,
) {
  if (!pricingAvailable) {
    return "Managed database pricing is temporarily unavailable.";
  }

  if (form.displayName.trim().length === 0) {
    return "Enter a database name.";
  }

  if (form.extensions.length === 0) {
    return "Select at least one extension.";
  }

  if (form.postgresVersion.trim().length === 0) {
    return "Select a PostgreSQL version.";
  }

  if (form.computeTierId.trim().length === 0) {
    return "Select a compute tier.";
  }

  if (form.computeShapeId.trim().length === 0) {
    return "Select a compute shape.";
  }

  if (parseFiniteNumber(form.storageGib) === null) {
    return "Enter a valid storage size.";
  }

  if (
    form.backupRetentionDays.trim().length > 0 &&
    parseFiniteNumber(form.backupRetentionDays) === null
  ) {
    return "Enter a valid backup retention period.";
  }

  if (
    form.maintenanceWindowDayOfWeek.trim().length > 0 &&
    parseFiniteNumber(form.maintenanceWindowDayOfWeek) === null
  ) {
    return "Enter a valid maintenance day of week.";
  }

  if (
    form.maintenanceWindowStartHour.trim().length > 0 &&
    parseFiniteNumber(form.maintenanceWindowStartHour) === null
  ) {
    return "Enter a valid maintenance start hour.";
  }

  if (
    form.maintenanceWindowStartMinute.trim().length > 0 &&
    parseFiniteNumber(form.maintenanceWindowStartMinute) === null
  ) {
    return "Enter a valid maintenance start minute.";
  }

  if (estimate === null) {
    return "Price estimate is unavailable for the current configuration.";
  }

  return "";
}

function readMaintenanceWindowMinuteOptions(
  catalog: HostedManagedDatabaseCatalogResponse | undefined,
) {
  return safeArray(catalog?.configuration_options?.maintenance_window?.start_minute?.values).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}

function canRemediateFailure(record: HostedManagedDatabaseAllocation | null | undefined) {
  return record?.failure?.remediable === true && Boolean(record.actions?.update?.path);
}

function canUpdateAllocation(record: HostedManagedDatabaseAllocation | null | undefined) {
  return Boolean(record?.actions?.update?.path);
}

function readConfigurationActionLabel(record: HostedManagedDatabaseAllocation | null | undefined) {
  const normalizedStatus = String(record?.status ?? "").trim().toLowerCase();

  if (normalizedStatus === "failed" || record?.failure?.remediable === true) {
    return "Fix and redeploy";
  }

  return "Edit configuration";
}

function readEditSubmitLabel(record: HostedManagedDatabaseAllocation | null | undefined) {
  const normalizedStatus = String(record?.status ?? "").trim().toLowerCase();

  if (normalizedStatus === "failed" || record?.failure?.remediable === true) {
    return "Redeploy database";
  }

  return "Save changes";
}

function formatCancellationState(record: HostedManagedDatabaseAllocation | null | undefined) {
  if (!record) {
    return "—";
  }

  if (record.cancel_at_period_end) {
    return `Scheduled for ${formatDateTime(record.current_period_end)}`;
  }

  if (String(record.status ?? "").trim().toLowerCase() === "cancelled") {
    return "Cancelled";
  }

  return "Active";
}

function isTransitionalHostedStatus(status: string | undefined | null) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return [
    "provisioning",
    "creating",
    "updating",
    "pending",
    "retrying",
    "resizing",
    "reconfiguring",
  ].includes(normalized);
}

function CreatePriceEstimatePanel({ estimate }: { estimate: ManagedDatabasePriceEstimate | null }) {
  if (!estimate) {
    return (
      <div className="rounded-[calc(var(--radius)-5px)] border border-warning/35 bg-warning/10 p-4 text-sm text-warning">
        Managed database pricing is temporarily unavailable.
      </div>
    );
  }

  return (
    <div className="rounded-[calc(var(--radius)-5px)] border border-primary/35 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">Price preview</div>
          <div className="mt-1 text-sm text-muted-foreground">
            The backend validates the prorated charge again when creating the database.
          </div>
        </div>
        <div className="grid gap-1 text-left lg:text-right">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Due now</div>
          <div className="text-lg font-semibold text-foreground">
            {formatCents(estimate.dueNowAmountCents, estimate.currency)}
          </div>
          <div className="text-xs text-muted-foreground">
            through {formatDateTime(estimate.currentPeriodEnd)}
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Monthly renewal
          </div>
          <div className="text-sm font-medium text-foreground">
            {formatCents(estimate.monthlyTotalAmountCents, estimate.currency)} / {estimate.billingInterval}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35">
        <PriceEstimateRow
          label="Compute"
          value={formatCents(estimate.computeAmountCents, estimate.currency)}
        />
        <PriceEstimateRow
          label="Storage"
          value={formatCents(estimate.storageAmountCents, estimate.currency)}
        />
        <PriceEstimateRow
          label="Backup retention"
          value={formatCents(estimate.backupAmountCents, estimate.currency)}
        />
        <PriceEstimateRow
          label="High availability"
          value={formatCents(estimate.highAvailabilityAmountCents, estimate.currency)}
        />
      </div>
    </div>
  );
}

function PatchPriceEstimatePanel({
  preview,
}: {
  preview: ManagedDatabasePatchPreview | null;
}) {
  if (!preview) {
    return (
      <div className="rounded-[calc(var(--radius)-5px)] border border-warning/35 bg-warning/10 p-4 text-sm text-warning">
        Update pricing preview is unavailable for the current configuration.
      </div>
    );
  }

  const dueNowLabel =
    preview.deltaDueNowAmountCents > 0
      ? "Estimated charge now"
      : preview.deltaDueNowAmountCents < 0
        ? "Estimated credit now"
        : "Estimated charge now";

  return (
    <div className="rounded-[calc(var(--radius)-5px)] border border-primary/35 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">Update preview</div>
          <div className="mt-1 text-sm text-muted-foreground">
            This preview uses the current managed database pricing catalog and current-period proration.
          </div>
        </div>
        <div className="grid gap-1 text-left lg:text-right">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{dueNowLabel}</div>
          <div className="text-lg font-semibold text-foreground">
            {formatCents(preview.deltaDueNowAmountCents, preview.currency)}
          </div>
          <div className="text-xs text-muted-foreground">
            until {formatDateTime(preview.currentPeriodEnd)}
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            New monthly renewal
          </div>
          <div className="text-sm font-medium text-foreground">
            {formatCents(preview.newMonthlyAmountCents, preview.currency)} / {preview.billingInterval}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35">
        <PriceEstimateRow
          label="Current monthly renewal"
          value={formatCents(preview.currentMonthlyAmountCents, preview.currency)}
        />
        <PriceEstimateRow
          label="New monthly renewal"
          value={formatCents(preview.newMonthlyAmountCents, preview.currency)}
        />
        <PriceEstimateRow
          label="Monthly delta"
          value={formatCents(preview.deltaMonthlyAmountCents, preview.currency)}
        />
      </div>
    </div>
  );
}

function PriceEstimateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-b-0">
      <div className="font-medium text-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}

export function AdminHostedResourcesPage() {
  const [databaseDialogOpen, setDatabaseDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<ManagedDatabaseDialogMode>("create");
  const [selectedAllocationUid, setSelectedAllocationUid] = useState<string | null>(null);
  const [form, setForm] = useState<ManagedDatabaseFormState>(emptyFormState);
  const [revealedCredentials, setRevealedCredentials] =
    useState<HostedManagedDatabaseCredentialsRevealResponse | null>(null);
  const [confirmationAction, setConfirmationAction] =
    useState<ManagedDatabaseConfirmationAction | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const catalogQuery = useQuery({
    queryKey: hostedDatabaseQueryKeys.catalog,
    queryFn: () => listHostedManagedDatabasePlans(),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const databasesQuery = useQuery({
    queryKey: hostedDatabaseQueryKeys.databases,
    queryFn: () => listHostedManagedDatabases(),
    retry: false,
  });
  const databases = databasesQuery.data?.results ?? [];
  const selectedListRecord =
    selectedAllocationUid
      ? databases.find((record) => readAllocationUid(record) === selectedAllocationUid) ?? null
      : null;
  const detailQuery = useQuery({
    queryKey: hostedDatabaseQueryKeys.detail(selectedAllocationUid ?? ""),
    queryFn: () => getHostedManagedDatabase(selectedAllocationUid ?? ""),
    enabled: databaseDialogOpen && dialogMode !== "create" && typeof selectedAllocationUid === "string",
    retry: false,
    refetchInterval: (query) =>
      databaseDialogOpen && isTransitionalHostedStatus(query.state.data?.status) ? 5000 : false,
  });

  const catalog = catalogQuery.data;
  const configurationOptions = catalog?.configuration_options;
  const availableExtensions = safeArray(catalog?.extensions);
  const selectableExtensions = availableExtensions.filter((extension) => extension.available !== false);
  const tierOptions = computeTierOptions(catalog);
  const computeShapes = readTierShapes(catalog, form.computeTierId);
  const selectedTier = tierOptions.find((tier) => tier.id === form.computeTierId) ?? null;
  const highAvailabilityModes = safeArray(configurationOptions?.high_availability?.modes);
  const maintenanceWindowMinuteOptions = readMaintenanceWindowMinuteOptions(catalog);
  const selectedHighAvailabilityMode =
    highAvailabilityModes.find((mode) => mode.id === form.highAvailabilityMode) ?? null;
  const selectedShape =
    computeShapes.find((shape) => readComputeShapeId(shape) === form.computeShapeId) ?? null;
  const managedTimescaleSelected = form.extensions.includes("timescaledb");
  const databaseTypeLabel = managedTimescaleSelected ? "PostgreSQL + TimescaleDB" : "PostgreSQL";
  const priceEstimate = calculatePriceEstimate(catalog, form);
  const detailRecord = detailQuery.data ?? selectedListRecord;
  const detailStatus = detailRecord ? readStatus(detailRecord) : null;
  const detailDataSourceUid = readDataSourceUid(detailRecord);
  const detailDataSourceHref = detailDataSourceUid
    ? `/app/main-sequence-foundry/physical-data-sources?msPhysicalDataSourceUid=${encodeURIComponent(detailDataSourceUid)}`
    : "";
  const patchPreview = calculatePatchPreview(catalog, detailRecord, priceEstimate);
  const pricingAvailable = catalog?.pricing?.available === true;
  const formSubmitDisabledReason = getFormSubmitDisabledReason(
    form,
    priceEstimate,
    pricingAvailable,
  );
  const catalogStatusMessage = catalogQuery.isLoading
    ? "Loading managed database catalog."
    : selectableExtensions.length === 0
      ? "No managed database product available."
      : !pricingAvailable
        ? "Managed database pricing is temporarily unavailable."
        : catalog
          ? ""
          : "Managed database catalog did not return any plan data.";
  const openCreateDisabledReason = catalogQuery.isLoading
    ? "Loading managed database catalog."
    : selectableExtensions.length === 0
      ? "No managed database product available."
      : !pricingAvailable
        ? "Managed database pricing is temporarily unavailable."
        : catalog
          ? ""
          : "Managed database catalog did not return any plan data.";

  useEffect(() => {
    if (!databaseDialogOpen) {
      setRevealedCredentials(null);
      setConfirmationAction(null);
      return;
    }

    setRevealedCredentials(null);
    setConfirmationAction(null);
  }, [databaseDialogOpen, selectedAllocationUid]);

  const createMutation = useMutation({
    mutationFn: (payload: HostedManagedDatabaseCreateInput) => createHostedManagedDatabase(payload),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: hostedDatabaseQueryKeys.databases }),
        queryClient.invalidateQueries({ queryKey: hostedDatabaseQueryKeys.catalog }),
      ]);
      setDialogMode("summary");
      setSelectedAllocationUid(result.allocation_uid);
      toast({
        variant: "success",
        title: "Database created",
        description: result.display_name || result.detail,
      });
    },
    onError: async (error) => {
      await queryClient.invalidateQueries({ queryKey: hostedDatabaseQueryKeys.catalog });
      if (error instanceof AdminRequestError) {
        const payload = error.payload as HostedManagedDatabaseProvisioningFailedErrorPayload | null;
        if (
          payload &&
          payload.code === "managed_database_provisioning_failed" &&
          typeof payload.allocation_uid === "string" &&
          payload.allocation_uid.trim().length > 0
        ) {
          setDialogMode("summary");
          setSelectedAllocationUid(payload.allocation_uid);
          setDatabaseDialogOpen(true);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: hostedDatabaseQueryKeys.databases }),
            queryClient.invalidateQueries({
              queryKey: hostedDatabaseQueryKeys.detail(payload.allocation_uid),
            }),
          ]);
          toast({
            variant: "error",
            title: "Provisioning failed",
            description: payload.detail,
          });
          return;
        }
      }
      toast({
        variant: "error",
        title: "Database creation failed",
        description: formatAdminError(error),
      });
    },
  });
  const updateMutation = useMutation({
    mutationFn: (payload: HostedManagedDatabasePatchInput) => {
      if (!selectedAllocationUid) {
        throw new Error("Managed database allocation uid is required.");
      }

      return updateHostedManagedDatabase(selectedAllocationUid, payload);
    },
    onSuccess: async () => {
      if (selectedAllocationUid) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: hostedDatabaseQueryKeys.databases }),
          queryClient.invalidateQueries({
            queryKey: hostedDatabaseQueryKeys.detail(selectedAllocationUid),
          }),
        ]);
      } else {
        await queryClient.invalidateQueries({ queryKey: hostedDatabaseQueryKeys.databases });
      }
      setDialogMode("summary");
      toast({
        variant: "success",
        title: "Database updated",
        description: "Managed database configuration updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Database update failed",
        description: formatAdminError(error),
      });
    },
  });
  const revealCredentialsMutation = useMutation({
    mutationFn: (path: string) => revealHostedManagedDatabaseCredentials(path),
    onSuccess: async (result) => {
      setRevealedCredentials(result);
      toast({
        variant: "success",
        title: "Credentials revealed",
        description: "The managed database password is shown below until you close this dialog.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Credential reveal failed",
        description: formatAdminError(error),
      });
    },
  });
  const rotateCredentialsMutation = useMutation({
    mutationFn: (path: string) => rotateHostedManagedDatabaseCredentials(path),
    onSuccess: async (result) => {
      setRevealedCredentials(result);
      if (selectedAllocationUid) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: hostedDatabaseQueryKeys.databases }),
          queryClient.invalidateQueries({
            queryKey: hostedDatabaseQueryKeys.detail(selectedAllocationUid),
          }),
        ]);
      }
      toast({
        variant: "success",
        title: "Credentials rotated",
        description: "A new password was generated and is shown below.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Credential rotation failed",
        description: formatAdminError(error),
      });
    },
  });
  const cancelAtPeriodEndMutation = useMutation({
    mutationFn: (path: string) => cancelHostedManagedDatabaseAtPeriodEnd(path),
    onSuccess: async () => {
      if (selectedAllocationUid) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: hostedDatabaseQueryKeys.databases }),
          queryClient.invalidateQueries({
            queryKey: hostedDatabaseQueryKeys.detail(selectedAllocationUid),
          }),
        ]);
      } else {
        await queryClient.invalidateQueries({ queryKey: hostedDatabaseQueryKeys.databases });
      }
      setConfirmationAction(null);
      toast({
        variant: "success",
        title: "Cancellation scheduled",
        description: "The managed database will cancel at the current period end.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Cancellation failed",
        description: formatAdminError(error),
      });
    },
  });
  const cancelNowMutation = useMutation({
    mutationFn: (path: string) => cancelHostedManagedDatabaseNow(path),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: hostedDatabaseQueryKeys.databases });
      if (selectedAllocationUid) {
        await queryClient.invalidateQueries({
          queryKey: hostedDatabaseQueryKeys.detail(selectedAllocationUid),
        });
      }
      setConfirmationAction(null);
      resetDialogState();
      toast({
        variant: "success",
        title: "Database deleted",
        description: "The managed database cancellation was submitted immediately.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Delete failed",
        description: formatAdminError(error),
      });
    },
  });
  const anyMutationPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    revealCredentialsMutation.isPending ||
    rotateCredentialsMutation.isPending ||
    cancelAtPeriodEndMutation.isPending ||
    cancelNowMutation.isPending;

  function updateForm(patch: Partial<ManagedDatabaseFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function resetDialogState() {
    setDatabaseDialogOpen(false);
    setDialogMode("create");
    setSelectedAllocationUid(null);
    setForm(emptyFormState);
    setRevealedCredentials(null);
    setConfirmationAction(null);
  }

  function closeDialog() {
    if (anyMutationPending) {
      return;
    }

    resetDialogState();
  }

  function openCreateDialog() {
    setDialogMode("create");
    setSelectedAllocationUid(null);
    setForm(makeInitialForm(catalog));
    setDatabaseDialogOpen(true);
  }

  function openDetailDialog(allocationUid: string) {
    setDialogMode("summary");
    setSelectedAllocationUid(allocationUid);
    setDatabaseDialogOpen(true);
  }

  function openEditDialog() {
    if (!detailRecord) {
      return;
    }

    setForm(makeEditForm(detailRecord, catalog));
    setDialogMode("edit");
  }

  function renderDetailDialogBody() {
    if (detailQuery.isLoading && !detailRecord) {
      return (
        <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading managed database details
        </div>
      );
    }

    if (detailQuery.isError && !detailRecord) {
      return (
        <div className="space-y-4">
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatAdminError(detailQuery.error)}
          </div>
          <div className="flex justify-end border-t border-border/70 pt-4">
            <Button variant="ghost" onClick={closeDialog}>
              Close
            </Button>
          </div>
        </div>
      );
    }

    if (!detailRecord) {
      return (
        <div className="space-y-4">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-sm text-muted-foreground">
            Hosted resource details are not available.
          </div>
          <div className="flex justify-end border-t border-border/70 pt-4">
            <Button variant="ghost" onClick={closeDialog}>
              Close
            </Button>
          </div>
        </div>
      );
    }

    const updateActionLabel = readConfigurationActionLabel(detailRecord);
    const revealCredentialsPath = detailRecord.actions?.reveal_credentials?.path ?? "";
    const rotateCredentialsPath = detailRecord.actions?.rotate_credentials?.path ?? "";
    const cancelAtPeriodEndPath = detailRecord.actions?.cancel_at_period_end?.path ?? "";
    const cancelNowPath = detailRecord.actions?.cancel_now?.path ?? "";

    return (
      <div className="space-y-5">
        {detailRecord.failure?.detail ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">Provisioning status</div>
                <div className="mt-1">{detailRecord.failure.detail}</div>
                {canRemediateFailure(detailRecord) ? (
                  <div className="mt-2 text-xs text-danger/90">
                    Update the configuration and submit it again to redeploy this allocation.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <div className="text-lg font-semibold text-foreground">{readDatabaseTitle(detailRecord)}</div>
              <div className="text-sm text-muted-foreground">
                {readDatabaseTypeLabel(detailRecord)}
              </div>
            </div>
            {detailStatus ? (
              <div className="space-y-1 md:text-right">
                <Badge variant={detailStatus.variant}>{detailStatus.label}</Badge>
                <div className="max-w-[320px] text-xs text-muted-foreground">{detailStatus.detail}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">Identifiers</div>
          <div className="grid gap-3 md:grid-cols-2">
            <DetailField label="Allocation UID" value={readAllocationUid(detailRecord) || "—"} />
            <DetailField label="Resource UID" value={detailRecord.resource?.uid ?? "—"} />
            <DetailField label="Connection UID" value={detailRecord.connection_uid ?? "—"} />
            <DetailField label="Secret UID" value={detailRecord.secret_uid ?? "—"} />
            <DetailField label="Data source UID" value={detailRecord.data_source_uid ?? "—"} />
            <DetailField
              label="Wrapper data source UID"
              value={detailRecord.dynamic_table_data_source_uid ?? "—"}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">Configuration</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <DetailField label="Extensions" value={safeArray(detailRecord.extensions).join(", ") || "—"} />
            <DetailField label="PostgreSQL version" value={readPostgresVersion(detailRecord)} />
            <DetailField label="Compute tier" value={readComputeTierLabel(detailRecord)} />
            <DetailField label="Compute shape" value={readComputeShapeLabelFromAllocation(detailRecord)} />
            <DetailField
              label="Backup retention"
              value={
                typeof detailRecord.physical_resource?.shape?.backup_retention_days === "number"
                  ? `${detailRecord.physical_resource.shape.backup_retention_days} days`
                  : "—"
              }
            />
            <DetailField
              label="High availability"
              value={detailRecord.physical_resource?.shape?.high_availability?.mode ?? "—"}
            />
            <DetailField label="Network access" value={readNetworkingMode(detailRecord)} />
            <DetailField
              label="Maintenance window"
              value={formatMaintenanceWindow(detailRecord.physical_resource?.maintenance_window)}
            />
          </div>
        </div>

        {detailRecord.connection ? (
          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground">Connection</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <DetailField label="Host" value={detailRecord.connection.host ?? "—"} />
              <DetailField
                label="Port"
                value={
                  typeof detailRecord.connection.port === "number"
                    ? String(detailRecord.connection.port)
                    : "—"
                }
              />
              <DetailField label="Database" value={detailRecord.connection.database ?? "—"} />
              <DetailField label="Username" value={detailRecord.connection.username ?? "—"} />
              <DetailField label="SSL mode" value={detailRecord.connection.ssl_mode ?? "—"} />
              <DetailField label="Default schema" value={detailRecord.connection.default_schema ?? "—"} />
              <DetailField
                label="Connection URL"
                value={detailRecord.connection.connection_url ?? "—"}
              />
            </div>
          </div>
        ) : null}

        {revealedCredentials ? (
          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground">Revealed credentials</div>
            <div className="rounded-[calc(var(--radius)-6px)] border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
              The password is only shown after an explicit reveal or rotation request. Close this
              dialog when you are done.
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <DetailField label="Host" value={revealedCredentials.host} />
              <DetailField label="Port" value={String(revealedCredentials.port)} />
              <DetailField label="Database" value={revealedCredentials.database} />
              <DetailField label="Username" value={revealedCredentials.username} />
              <DetailField label="SSL mode" value={revealedCredentials.ssl_mode} />
              <DetailField label="Default schema" value={revealedCredentials.default_schema} />
              <DetailField label="Password" value={revealedCredentials.password} />
              <DetailField label="Connection URL" value={revealedCredentials.connection_url} />
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">Allocation</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <DetailField label="Operational status" value={detailRecord.status ?? "—"} />
            <DetailField label="Billing status" value={detailRecord.billing_status ?? "—"} />
            <DetailField label="Monthly price" value={readMonthlyPrice(detailRecord)} />
            <DetailField label="Paid through" value={formatDateTime(detailRecord.current_period_end)} />
            <DetailField label="Cancellation" value={formatCancellationState(detailRecord)} />
            <DetailField label="Current period start" value={formatDateTime(detailRecord.current_period_start)} />
            <DetailField label="Current period end" value={formatDateTime(detailRecord.current_period_end)} />
            <DetailField
              label="Power state"
              value={detailRecord.physical_resource?.power_state ?? "—"}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
          {canUpdateAllocation(detailRecord) ? (
            <Button
              variant="outline"
              onClick={openEditDialog}
              disabled={anyMutationPending}
            >
              <Pencil className="h-4 w-4" />
              {updateActionLabel}
            </Button>
          ) : null}
          {revealCredentialsPath ? (
            <Button
              variant="outline"
              onClick={() => {
                revealCredentialsMutation.mutate(revealCredentialsPath);
              }}
              disabled={anyMutationPending}
            >
              {revealCredentialsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Reveal password
            </Button>
          ) : null}
          {rotateCredentialsPath ? (
            <Button
              variant="outline"
              onClick={() => {
                rotateCredentialsMutation.mutate(rotateCredentialsPath);
              }}
              disabled={anyMutationPending}
            >
              {rotateCredentialsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Rotate password
            </Button>
          ) : null}
          {detailDataSourceUid ? (
            <a
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[calc(var(--radius)-5px)] border border-border bg-card/80 px-3 py-1.5 text-sm font-medium text-card-foreground transition-all hover:bg-muted/60"
              href={detailDataSourceHref}
            >
              Open data source
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {cancelAtPeriodEndPath && !detailRecord.cancel_at_period_end ? (
            <Button
              variant="outline"
              onClick={() => {
                setConfirmationAction({
                  kind: "cancel_at_period_end",
                  path: cancelAtPeriodEndPath,
                });
              }}
              disabled={anyMutationPending}
            >
              <XCircle className="h-4 w-4" />
              Cancel at period end
            </Button>
          ) : null}
          {cancelNowPath ? (
            <Button
              variant="danger"
              onClick={() => {
                setConfirmationAction({
                  kind: "cancel_now",
                  path: cancelNowPath,
                });
              }}
              disabled={anyMutationPending}
            >
              <Trash2 className="h-4 w-4" />
              Delete database
            </Button>
          ) : null}
          <Button variant="ghost" onClick={closeDialog}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  function renderDatabaseDialog() {
    const isEditMode = dialogMode === "edit";

    return (
      <Dialog
        open={databaseDialogOpen}
        onClose={closeDialog}
        title={
          dialogMode === "summary" || dialogMode === "edit"
            ? readDatabaseTitle(detailRecord ?? selectedListRecord ?? {})
            : "Create managed database"
        }
        description={
          dialogMode === "summary"
            ? "Review the hosted managed database allocation, billing state, and linked data-source details."
            : dialogMode === "edit"
              ? "Update the hosted managed database configuration and review the prorated change before submitting."
              : "Choose the database type, select available extensions, configure resources, and review the monthly price before creation."
        }
      >
        {dialogMode === "summary" ? renderDetailDialogBody() : null}
        {dialogMode !== "summary" ? (
        <div className="space-y-5">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-4">
            <div className="mb-4 text-sm font-medium text-foreground">Database type</div>
            <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Database
                </div>
                <div className="flex h-8 items-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 text-sm text-foreground">
                  PostgreSQL
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Extensions</div>
                <div className="flex min-h-8 flex-wrap items-center gap-2">
                  {availableExtensions.map((extension) => {
                    const checked = form.extensions.includes(extension.code);
                    const available = extension.available !== false;
                    const extensionIcon = resolveExtensionIcon(extension);

                    return (
                      <div key={extension.code} className="space-y-1">
                        <button
                          type="button"
                          className={[
                            "rounded-[calc(var(--radius)-6px)] border px-3 py-1.5 text-sm transition-colors",
                            checked
                              ? "border-primary/50 bg-primary/10 text-foreground"
                              : "border-border/70 bg-background/35 text-muted-foreground hover:text-foreground",
                            !available ? "cursor-not-allowed opacity-55" : "",
                          ].join(" ")}
                          disabled={!available || anyMutationPending || isEditMode}
                          onClick={() => {
                            updateForm({
                              extensions: checked
                                ? form.extensions.filter((code) => code !== extension.code)
                                : [...form.extensions, extension.code],
                            });
                          }}
                        >
                          {extensionIcon ? (
                            <img src={extensionIcon} alt="" className="mr-1.5 inline h-4 w-4 object-contain" />
                          ) : null}
                          {extension.label}
                        </button>
                        {!available && (extension.unavailable_reason || extension.unavailable_detail) ? (
                          <div className="max-w-xs text-xs text-muted-foreground">
                            {extension.unavailable_detail ?? extension.unavailable_reason}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {availableExtensions.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No extensions available.</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Name</span>
              <Input
                value={form.displayName}
                onChange={(event) => updateForm({ displayName: event.target.value })}
                placeholder="Research Tick Store"
                disabled={anyMutationPending}
              />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">PostgreSQL version</span>
              {safeArray(configurationOptions?.postgres_versions).length <= 1 ? (
                <div className="flex h-8 items-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 text-sm text-foreground">
                  {form.postgresVersion || "—"}
                </div>
              ) : (
                <Select
                  value={form.postgresVersion}
                  onChange={(event) => updateForm({ postgresVersion: event.target.value })}
                  disabled={anyMutationPending || isEditMode}
                >
                  {safeArray(configurationOptions?.postgres_versions).map((version) => (
                    <option key={version} value={version}>
                      {version}
                    </option>
                  ))}
                </Select>
              )}
            </label>
            <label className="space-y-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Compute tier</span>
              {tierOptions.length <= 1 ? (
                <div className="flex h-8 items-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 text-sm text-foreground">
                  {selectedTier?.label ?? "—"}
                </div>
              ) : (
                <Select
                  value={form.computeTierId}
                  onChange={(event) => {
                    const nextTierId = event.target.value;
                    const nextShapes = readTierShapes(catalog, nextTierId);
                    const currentShapeStillValid = nextShapes.some(
                      (shape) => readComputeShapeId(shape) === form.computeShapeId,
                    );

                    updateForm({
                      computeTierId: nextTierId,
                      computeShapeId: currentShapeStillValid
                        ? form.computeShapeId
                        : readComputeShapeId(nextShapes[0] ?? {}),
                    });
                  }}
                  disabled={anyMutationPending}
                >
                  {tierOptions.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.label}
                    </option>
                  ))}
                </Select>
              )}
              {selectedTier?.description ? (
                <div className="text-xs text-muted-foreground">{selectedTier.description}</div>
              ) : null}
            </label>
            <label className="space-y-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Compute shape</span>
              {computeShapes.length <= 1 ? (
                <div className="flex h-8 items-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 text-sm text-foreground">
                  {selectedShape ? readComputeShapeLabel(selectedShape) : "—"}
                </div>
              ) : (
                <Select
                  value={form.computeShapeId}
                  onChange={(event) => updateForm({ computeShapeId: event.target.value })}
                  disabled={anyMutationPending}
                  searchable
                  searchPlaceholder="Search compute sizes"
                >
                  {computeShapes.map((shape) => {
                    const shapeId = readComputeShapeId(shape);

                    return (
                      <option
                        key={shapeId}
                        value={shapeId}
                        disabled={shape.available === false}
                        data-description={readComputeShapeDescription(shape)}
                      >
                        {readComputeShapeLabel(shape)}
                      </option>
                    );
                  })}
                </Select>
              )}
              {selectedShape ? (
                <div className="text-xs text-muted-foreground">
                  {readComputeShapeDescription(selectedShape)}
                </div>
              ) : null}
            </label>
            <label className="space-y-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Storage GiB</span>
              <Input
                type="number"
                min={configurationOptions?.storage?.min_gib}
                max={configurationOptions?.storage?.max_gib}
                step={configurationOptions?.storage?.step_gib}
                value={form.storageGib}
                onChange={(event) => updateForm({ storageGib: event.target.value })}
                disabled={anyMutationPending}
              />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Backup retention days</span>
              <Input
                type="number"
                min={configurationOptions?.backup_retention_days?.min}
                max={configurationOptions?.backup_retention_days?.max}
                value={form.backupRetentionDays}
                onChange={(event) => updateForm({ backupRetentionDays: event.target.value })}
                disabled={anyMutationPending}
              />
              {isEditMode && form.backupRetentionDays.trim().length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  The backend detail does not expose the current backup retention setting. Leave this
                  blank to keep it unchanged, or enter a new value to update it.
                </div>
              ) : null}
            </label>
            <label className="space-y-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">High availability</span>
              {highAvailabilityModes.length <= 1 ? (
                <div className="flex h-8 items-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 text-sm text-foreground">
                  {selectedHighAvailabilityMode?.label || form.highAvailabilityMode || "—"}
                </div>
              ) : (
                <Select
                  value={form.highAvailabilityMode}
                  onChange={(event) => updateForm({ highAvailabilityMode: event.target.value })}
                  disabled={anyMutationPending}
                >
                  {highAvailabilityModes.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.label}
                    </option>
                  ))}
                </Select>
              )}
              {configurationOptions?.high_availability?.description ? (
                <div className="text-xs text-muted-foreground">
                  {configurationOptions.high_availability.description}
                </div>
              ) : null}
              {selectedHighAvailabilityMode?.description ? (
                <div className="text-xs text-muted-foreground">
                  {selectedHighAvailabilityMode.description}
                </div>
              ) : null}
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Maintenance window</div>
            {configurationOptions?.maintenance_window?.description ? (
              <div className="text-xs text-muted-foreground">
                {configurationOptions.maintenance_window.description}
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-xs text-muted-foreground">Day of week</span>
                <Input
                  type="number"
                  min={configurationOptions?.maintenance_window?.day_of_week?.min}
                  max={configurationOptions?.maintenance_window?.day_of_week?.max}
                  value={form.maintenanceWindowDayOfWeek}
                  onChange={(event) => updateForm({ maintenanceWindowDayOfWeek: event.target.value })}
                  disabled={anyMutationPending}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs text-muted-foreground">Start hour</span>
                <Input
                  type="number"
                  min={configurationOptions?.maintenance_window?.start_hour?.min}
                  max={configurationOptions?.maintenance_window?.start_hour?.max}
                  value={form.maintenanceWindowStartHour}
                  onChange={(event) => updateForm({ maintenanceWindowStartHour: event.target.value })}
                  disabled={anyMutationPending}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs text-muted-foreground">Start minute</span>
                {maintenanceWindowMinuteOptions.length > 0 ? (
                  <Select
                    value={form.maintenanceWindowStartMinute}
                    onChange={(event) =>
                      updateForm({ maintenanceWindowStartMinute: event.target.value })
                    }
                    disabled={anyMutationPending}
                  >
                    {maintenanceWindowMinuteOptions.map((minute) => (
                      <option key={minute} value={String(minute)}>
                        {String(minute).padStart(2, "0")}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    type="number"
                    min={configurationOptions?.maintenance_window?.start_minute?.min}
                    max={configurationOptions?.maintenance_window?.start_minute?.max}
                    value={form.maintenanceWindowStartMinute}
                    onChange={(event) =>
                      updateForm({ maintenanceWindowStartMinute: event.target.value })
                    }
                    disabled={anyMutationPending}
                  />
                )}
              </label>
            </div>
          </div>

          <label className="space-y-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Description</span>
            <Textarea
              value={form.description}
              onChange={(event) => updateForm({ description: event.target.value })}
              placeholder="Optional description"
              className="min-h-[88px]"
              disabled={anyMutationPending}
            />
          </label>

          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3 text-sm text-muted-foreground">
            Database: <span className="font-medium text-foreground">{databaseTypeLabel}</span>
            {selectedShape ? (
              <span>{` · ${selectedShape.vcpus} vCPU · ${selectedShape.memory_gib} GiB RAM`}</span>
            ) : null}
          </div>

          {isEditMode ? (
            <PatchPriceEstimatePanel preview={patchPreview} />
          ) : (
            <CreatePriceEstimatePanel estimate={priceEstimate} />
          )}

          <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
            {formSubmitDisabledReason ? (
              <div className="mr-auto self-center text-xs text-muted-foreground">
                {formSubmitDisabledReason}
              </div>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => {
                if (isEditMode) {
                  setDialogMode("summary");
                  return;
                }

                closeDialog();
              }}
              disabled={anyMutationPending}
            >
              {isEditMode ? "Back" : "Cancel"}
            </Button>
            <Button
              onClick={() => {
                if (!isEditMode && priceEstimate) {
                  createMutation.mutate(buildCreateInput(form, priceEstimate));
                }
                if (isEditMode) {
                  updateMutation.mutate(buildPatchInput(form));
                }
              }}
              disabled={formSubmitDisabledReason.length > 0 || anyMutationPending}
              title={formSubmitDisabledReason || undefined}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEditMode ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isEditMode ? readEditSubmitLabel(detailRecord) : "Create database"}
            </Button>
          </div>
        </div>
        ) : null}
      </Dialog>
    );
  }

  function renderConfirmationDialog() {
    if (!confirmationAction) {
      return null;
    }

    const currentRecord = detailRecord ?? selectedListRecord;
    const databaseName = readDatabaseTitle(currentRecord ?? {});

    if (confirmationAction.kind === "cancel_at_period_end") {
      return (
        <ActionConfirmationDialog
          open
          tone="warning"
          title="Cancel at period end"
          actionLabel="cancel this database at period end"
          confirmButtonLabel="Schedule cancellation"
          confirmWord="CANCEL"
          objectLabel="managed database"
          objectSummary={databaseName}
          description="The database stays active until the current billing period ends."
          specialText={`Billing remains active through ${formatDateTime(currentRecord?.current_period_end)} unless the backend changes the allocation state earlier.`}
          onClose={() => setConfirmationAction(null)}
          onConfirm={() => cancelAtPeriodEndMutation.mutateAsync(confirmationAction.path)}
        />
      );
    }

    return (
      <ActionConfirmationDialog
        open
        tone="danger"
        title="Delete database"
        actionLabel="delete this database immediately"
        confirmButtonLabel="Delete database"
        confirmWord="DELETE"
        objectLabel="managed database"
        objectSummary={databaseName}
        description="This submits the backend immediate cancellation path for the hosted database allocation."
        specialText="Use this when you want the managed database deprovisioned now instead of waiting until the current billing period ends."
        onClose={() => setConfirmationAction(null)}
        onConfirm={() => cancelNowMutation.mutateAsync(confirmationAction.path)}
      />
    );
  }

  return (
    <AdminSurfaceLayout
      title="Managed Databases"
      description="Create and review organization-hosted managed database allocations."
    >
      <div className="space-y-4">
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45">
                  {postgresIcon ? (
                    <img src={postgresIcon} alt="" className="h-5 w-5 object-contain" />
                  ) : (
                    <Database className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <CardTitle>Managed Databases</CardTitle>
                  <CardDescription>
                    Choose a database type, add supported extensions, configure resources, and
                    review the monthly price before creation.
                  </CardDescription>
                </div>
              </div>
              <Button
                onClick={openCreateDialog}
                disabled={openCreateDisabledReason.length > 0}
                title={openCreateDisabledReason || undefined}
              >
                <Plus className="h-4 w-4" />
                Create database
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {catalogQuery.isLoading ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading managed database catalog
              </div>
            ) : null}
            {catalogQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatAdminError(catalogQuery.error)}
              </div>
            ) : null}
            {!catalogQuery.isLoading && !catalogQuery.isError ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Available extensions:</span>
                  {availableExtensions.length > 0 ? (
                    availableExtensions.map((extension) => {
                      const extensionIcon = resolveExtensionIcon(extension);

                      return (
                        <Badge key={extension.code} variant={extension.available === false ? "neutral" : "secondary"}>
                          {extensionIcon ? (
                            <img src={extensionIcon} alt="" className="mr-1.5 inline h-3.5 w-3.5 object-contain" />
                          ) : null}
                          {extension.label}
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-sm text-muted-foreground">None available</span>
                  )}
                </div>
                {catalogStatusMessage ? (
                  <div className="text-sm text-muted-foreground">{catalogStatusMessage}</div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Databases</CardTitle>
                <CardDescription>
                  Hosted managed database allocations billed through organization credits.
                </CardDescription>
              </div>
              <Badge variant="neutral">{`${databases.length} records`}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {databasesQuery.isLoading ? (
              <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                Loading databases
              </div>
            ) : null}

            {databasesQuery.isError ? (
              <div className="p-5">
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatAdminError(databasesQuery.error)}
                </div>
              </div>
            ) : null}

            {!databasesQuery.isLoading && !databasesQuery.isError && databases.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                  <Database className="h-5 w-5" />
                </div>
                <div className="mt-4 text-sm font-medium text-foreground">No managed databases found</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create the first database from the managed database catalog.
                </p>
              </div>
            ) : null}

            {!databasesQuery.isLoading && !databasesQuery.isError && databases.length > 0 ? (
              <div className="overflow-x-auto px-4 py-4">
                <table
                  className="w-full min-w-[1180px] border-separate text-sm"
                  style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
                >
                  <thead>
                    <tr
                      className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                      style={{ fontSize: "var(--table-meta-font-size)" }}
                    >
                      <th className="min-w-[220px] px-4 py-[var(--table-standard-header-padding-y)]">
                        Name
                      </th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Database</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Status</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Billing</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Paid through</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Monthly cost</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">CPU / RAM / Storage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {databases.map((record, index) => {
                      const allocationUid = readAllocationUid(record);
                      const status = readStatus(record);

                      return (
                        <tr key={`${allocationUid || index}-${index}`}>
                          <td
                            className={`${getRegistryTableCellClassName(false, "left")} min-w-[220px]`}
                          >
                            <button
                              type="button"
                              className="min-w-[220px] text-left font-medium text-primary hover:underline"
                              onClick={() => {
                                if (allocationUid) {
                                  openDetailDialog(allocationUid);
                                }
                              }}
                              disabled={!allocationUid}
                            >
                              {readDatabaseTitle(record)}
                            </button>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="text-foreground">{readDatabaseTypeLabel(record)}</span>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <div className="space-y-1">
                              <Badge variant={status.variant}>{status.label}</Badge>
                              <div className="max-w-[260px] text-xs text-muted-foreground">{status.detail}</div>
                            </div>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="text-foreground">{record.billing_status ?? "—"}</span>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="text-foreground">{formatDateTime(record.current_period_end)}</span>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="text-foreground">{readMonthlyPrice(record)}</span>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="text-foreground">{readResourceSummary(record)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {renderDatabaseDialog()}
        {renderConfirmationDialog()}
      </div>
    </AdminSurfaceLayout>
  );
}
