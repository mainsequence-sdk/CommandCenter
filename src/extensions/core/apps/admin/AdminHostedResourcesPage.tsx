import { useMemo, useState } from "react";

import { Database, HardDrive, Layers3, Loader2, Plus, Settings2 } from "lucide-react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { resolvePhysicalDataSourceIcon } from "../../../../../extensions/main_sequence/common/components/physicalDataSourceIcons";
import { getRegistryTableCellClassName } from "../../../../../extensions/main_sequence/common/components/registryTable";

import {
  createHostedTimescaleDatabase,
  listHostedTimescaleDatabasePlans,
  listHostedTimescaleDatabases,
  updateHostedTimescaleDatabase,
  type HostedTimescaleDatabasePlan,
  type HostedTimescaleDatabasePlanProvider,
  type HostedTimescaleDatabasePrice,
  type HostedTimescaleDatabaseRecord,
} from "./api";
import { AdminSurfaceLayout } from "./shared";

type HostedResourceTabId = "databases" | "caches" | "storage";

const hostedResourceQueryKeys = {
  databases: ["admin", "billing", "hosted-resources", "timescaledb", "databases"] as const,
  plans: ["admin", "billing", "hosted-resources", "timescaledb", "plans"] as const,
};

const hostedResourceTabs: Array<{
  id: HostedResourceTabId;
  label: string;
  description: string;
}> = [
  {
    id: "databases",
    label: "Databases",
    description: "Managed database inventory, ownership, and billing visibility.",
  },
  {
    id: "caches",
    label: "Caches",
    description: "Reserved for hosted cache services and their runtime allocations.",
  },
  {
    id: "storage",
    label: "Storage",
    description: "Reserved for hosted object and file storage resources.",
  },
];

const hostedResourceTabMeta: Record<
  HostedResourceTabId,
  {
    title: string;
    description: string;
    icon: typeof Database;
    summary: string;
    emptyTitle: string;
    emptyDescription: string;
  }
> = {
  databases: {
    title: "Databases",
    description:
      "Create hosted Timescale databases from the billing plans catalog and adjust their resources from the same registry.",
    icon: Database,
    summary: "Plan-driven Timescale database provisioning.",
    emptyTitle: "No hosted databases found",
    emptyDescription:
      "Create the first hosted database from one of the available Timescale plans.",
  },
  caches: {
    title: "Caches",
    description:
      "This tab is reserved for hosted cache services such as Redis-style runtime resources.",
    icon: Layers3,
    summary: "Cache resources will live here next.",
    emptyTitle: "No cache resources yet",
    emptyDescription:
      "Cache resource inventory and utilization details will appear here in a later billing iteration.",
  },
  storage: {
    title: "Storage",
    description:
      "This tab is reserved for hosted storage resources owned by the current organization.",
    icon: HardDrive,
    summary: "Storage inventory will follow the same billing surface pattern.",
    emptyTitle: "No storage resources yet",
    emptyDescription:
      "Hosted object and file storage inventory will appear here in a later billing iteration.",
  },
};

function HostedResourceTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className={cn(
        "rounded-[calc(var(--radius)-7px)] px-3",
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
      )}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

const timescaleIcon = resolvePhysicalDataSourceIcon({
  classType: "timescale_db",
});

type SelectableHostedTimescaleDatabasePlan = HostedTimescaleDatabasePlan & {
  providerCode: string;
  providerName: string;
};

type HostedTimescaleProviderSection = HostedTimescaleDatabasePlanProvider & {
  selectablePlans: SelectableHostedTimescaleDatabasePlan[];
};

function formatAdminError(error: unknown) {
  return error instanceof Error ? error.message : "The hosted resource request failed.";
}

function formatHostedMoney(price?: Partial<HostedTimescaleDatabasePrice> | null) {
  if (!price) {
    return "—";
  }

  if (typeof price.display === "string" && price.display.trim()) {
    const display = price.display.trim();
    return /month/i.test(display) ? display : `${display} / month`;
  }

  const amount = Number(price.amount ?? "");
  const currency = String(price.currency ?? "USD").toUpperCase();

  if (Number.isFinite(amount)) {
    try {
      return `${new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
      }).format(amount)} / month`;
    } catch {
      return `${amount.toFixed(2)} ${currency} / month`;
    }
  }

  return "—";
}

function readHostedDatabaseId(record: HostedTimescaleDatabaseRecord) {
  if (typeof record.id === "number" || typeof record.id === "string") {
    return record.id;
  }

  if (typeof record.uid === "string" && record.uid.trim()) {
    return record.uid.trim();
  }

  return null;
}

function readHostedDatabaseTitle(record: HostedTimescaleDatabaseRecord) {
  const candidates = [
    record.display_name,
    record.name,
    record.database_name,
    record.title,
    record.label,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const id = readHostedDatabaseId(record);
  return id === null ? "Hosted database" : `Hosted database ${String(id)}`;
}

function readHostedDatabaseStatus(record: HostedTimescaleDatabaseRecord) {
  const raw =
    (typeof record.status_label === "string" && record.status_label.trim()
      ? record.status_label
      : typeof record.status === "string" && record.status.trim()
        ? record.status
        : typeof record.state === "string" && record.state.trim()
          ? record.state
          : "Unknown") ?? "Unknown";

  const normalized = raw.toLowerCase();

  if (normalized.includes("active") || normalized.includes("ready") || normalized.includes("running")) {
    return { label: raw, variant: "success" as const };
  }

  if (normalized.includes("pending") || normalized.includes("creating") || normalized.includes("updating")) {
    return { label: raw, variant: "warning" as const };
  }

  if (normalized.includes("failed") || normalized.includes("error")) {
    return { label: raw, variant: "danger" as const };
  }

  return { label: raw, variant: "neutral" as const };
}

function readHostedDatabasePlanCode(record: HostedTimescaleDatabaseRecord) {
  if (typeof record.plan_code === "string" && record.plan_code.trim()) {
    return record.plan_code.trim();
  }

  if (typeof record.current_plan_code === "string" && record.current_plan_code.trim()) {
    return record.current_plan_code.trim();
  }

  if (record.plan && typeof record.plan === "object") {
    const planCode = record.plan.code;
    if (typeof planCode === "string" && planCode.trim()) {
      return planCode.trim();
    }
  }

  return "";
}

function readHostedDatabaseRegionLabel(
  record: HostedTimescaleDatabaseRecord,
  matchedPlan: HostedTimescaleDatabasePlan | undefined,
) {
  if (matchedPlan?.cloud_region?.label) {
    return matchedPlan.cloud_region.label;
  }

  const region = record.cloud_region;
  if (typeof region === "string" && region.trim()) {
    return region.trim();
  }

  if (region && typeof region === "object" && typeof region.label === "string" && region.label.trim()) {
    return region.label.trim();
  }

  if (typeof record.region === "string" && record.region.trim()) {
    return record.region.trim();
  }

  return "—";
}

function renderResourceSummary(
  record: HostedTimescaleDatabaseRecord,
  matchedPlan: HostedTimescaleDatabasePlan | undefined,
) {
  const vms =
    matchedPlan?.vms ??
    (typeof record.vms === "number" ? record.vms : null);
  const cpu =
    matchedPlan?.cpu_per_vm ??
    (typeof record.cpu_per_vm === "number" ? record.cpu_per_vm : null);
  const memory =
    matchedPlan?.memory_per_vm_gb ??
    (typeof record.memory_per_vm_gb === "number" ? record.memory_per_vm_gb : null);
  const storage =
    matchedPlan?.storage_gb ??
    (typeof record.storage_gb === "number" ? record.storage_gb : null);

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <div>{vms === null ? "—" : `${vms} VM${vms === 1 ? "" : "s"}`}</div>
      <div>{cpu === null ? "—" : `${cpu} vCPU / VM`}</div>
      <div>{memory === null ? "—" : `${memory} GiB / VM`}</div>
      <div>{storage === null ? "—" : `${storage} GB storage`}</div>
    </div>
  );
}

function PlanCard({
  active,
  onClick,
  plan,
}: {
  active: boolean;
  onClick: () => void;
  plan: SelectableHostedTimescaleDatabasePlan;
}) {
  return (
    <button
      type="button"
      disabled={!plan.available}
      className={cn(
        "w-full rounded-[calc(var(--radius)-6px)] border p-4 text-left transition-colors",
        active
          ? "border-primary/55 bg-primary/10"
          : "border-border/70 bg-background/35 hover:border-primary/30 hover:bg-background/55",
        !plan.available && "cursor-not-allowed opacity-55",
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-foreground">{plan.name}</div>
            {plan.recommended ? <Badge variant="success">Recommended</Badge> : null}
            {!plan.available ? <Badge variant="neutral">Unavailable</Badge> : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{plan.code}</div>
        </div>
        <div className="text-sm font-medium text-foreground">
          {formatHostedMoney(plan.monthly_price)}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Region
          </div>
          <div className="mt-1 text-sm text-foreground">{plan.cloud_region.label}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">CPU</div>
          <div className="mt-1 text-sm text-foreground">{`${plan.cpu_per_vm} vCPU / VM`}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Memory
          </div>
          <div className="mt-1 text-sm text-foreground">{`${plan.memory_per_vm_gb} GiB / VM`}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Storage
          </div>
          <div className="mt-1 text-sm text-foreground">{`${plan.storage_gb} GB`}</div>
        </div>
      </div>
    </button>
  );
}

function ProviderPlanSections({
  activePlanCode,
  onSelectPlan,
  providers,
}: {
  activePlanCode: string;
  onSelectPlan: (planCode: string) => void;
  providers: HostedTimescaleProviderSection[];
}) {
  return (
    <div className="space-y-4">
      {providers.map((provider) => (
        <div
          key={provider.code}
          className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 p-4"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium text-foreground">{provider.name}</div>
            <Badge variant="neutral">{provider.code}</Badge>
            <Badge variant="neutral">{`${provider.plans.length} plans`}</Badge>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {provider.selectablePlans.map((plan) => (
              <PlanCard
                key={`${provider.code}:${plan.code}`}
                active={plan.code === activePlanCode}
                plan={plan}
                onClick={() => onSelectPlan(plan.code)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HostedResourcesPlaceholderPanel({
  activeMeta,
  activeTab,
}: {
  activeMeta: (typeof hostedResourceTabMeta)[HostedResourceTabId];
  activeTab: (typeof hostedResourceTabs)[number];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <Card className="border-border/70 bg-background/20">
        <CardHeader>
          <CardTitle>{activeTab.label}</CardTitle>
          <CardDescription>{activeTab.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-8 text-center">
            <div className="text-sm font-medium text-foreground">{activeMeta.emptyTitle}</div>
            <div className="mt-2 text-sm text-muted-foreground">
              {activeMeta.emptyDescription}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-background/20">
        <CardHeader>
          <CardTitle>Scope</CardTitle>
          <CardDescription>
            Keep hosted infrastructure grouped by billing-relevant resource type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
            The first tab is <span className="font-medium text-foreground">Databases</span>.
          </div>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
            Add new hosted resource types here instead of mixing them into Billing Details.
          </div>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
            Keep resource inventory, ownership, and cost visibility in this section.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminHostedResourcesPage() {
  const [activeTabId, setActiveTabId] = useState<HostedResourceTabId>("databases");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCreatePlanCode, setSelectedCreatePlanCode] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [editingDatabaseId, setEditingDatabaseId] = useState<number | string | null>(null);
  const [selectedEditPlanCode, setSelectedEditPlanCode] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const activeTab = useMemo(
    () => hostedResourceTabs.find((tab) => tab.id === activeTabId) ?? hostedResourceTabs[0],
    [activeTabId],
  );

  const activeMeta = hostedResourceTabMeta[activeTab.id];
  const Icon = activeMeta.icon;
  const plansQuery = useQuery({
    queryKey: hostedResourceQueryKeys.plans,
    queryFn: () => listHostedTimescaleDatabasePlans(),
    retry: false,
    staleTime: 5 * 60_000,
    enabled: activeTab.id === "databases",
  });
  const databasesQuery = useQuery({
    queryKey: hostedResourceQueryKeys.databases,
    queryFn: () => listHostedTimescaleDatabases(),
    retry: false,
    enabled: activeTab.id === "databases",
  });

  const planProviders = useMemo(
    () => Object.values(plansQuery.data?.providers ?? {}) as HostedTimescaleDatabasePlanProvider[],
    [plansQuery.data?.providers],
  );
  const providerSections = useMemo<HostedTimescaleProviderSection[]>(
    () =>
      planProviders.map((provider) => ({
        ...provider,
        selectablePlans: provider.plans.map((plan) => ({
          ...plan,
          providerCode: provider.code,
          providerName: provider.name,
        })),
      })),
    [planProviders],
  );
  const providerNames = useMemo(
    () => planProviders.map((provider) => provider.name).filter((name) => name.trim().length > 0),
    [planProviders],
  );
  const flattenedPlans = useMemo<SelectableHostedTimescaleDatabasePlan[]>(
    () => providerSections.flatMap((provider) => provider.selectablePlans),
    [providerSections],
  );
  const availablePlans = useMemo(
    () => flattenedPlans.filter((plan) => plan.available),
    [flattenedPlans],
  );
  const fallbackPlanCode = useMemo(() => {
    const providerDefaults = planProviders
      .map((provider) => provider.default_plan_code)
      .filter((value) => value.trim().length > 0);

    for (const requestedDefault of providerDefaults) {
      if (availablePlans.some((plan) => plan.code === requestedDefault)) {
        return requestedDefault;
      }
    }

    const recommendedPlan = availablePlans.find((plan) => plan.recommended);
    return recommendedPlan?.code ?? availablePlans[0]?.code ?? "";
  }, [availablePlans, planProviders]);
  const createPlanCode = selectedCreatePlanCode || fallbackPlanCode;
  const normalizedCreateDisplayName = createDisplayName.trim();
  const normalizedCreateDescription = createDescription.trim();
  const planByCode = useMemo(
    () => new Map(flattenedPlans.map((plan) => [plan.code, plan] as const)),
    [flattenedPlans],
  );
  const databases = databasesQuery.data?.results ?? [];
  const editingRecord =
    editingDatabaseId === null
      ? null
      : databases.find((record) => readHostedDatabaseId(record) === editingDatabaseId) ?? null;

  const createMutation = useMutation({
    mutationFn: ({
      displayName,
      description,
      resourcePlanCode,
    }: {
      displayName: string;
      description: string;
      resourcePlanCode: string;
    }) =>
      createHostedTimescaleDatabase({
        display_name: displayName,
        description: description || null,
        resource_plan_code: resourcePlanCode,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: hostedResourceQueryKeys.databases });
      setCreateDialogOpen(false);
      setSelectedCreatePlanCode("");
      setCreateDisplayName("");
      setCreateDescription("");
      toast({
        variant: "success",
        title: "Database requested",
        description: "The hosted Timescale database request was submitted.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Database creation failed",
        description: formatAdminError(error),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ databaseId, planCode }: { databaseId: number | string; planCode: string }) =>
      updateHostedTimescaleDatabase(databaseId, { plan_code: planCode }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: hostedResourceQueryKeys.databases });
      setEditingDatabaseId(null);
      setSelectedEditPlanCode("");
      toast({
        variant: "success",
        title: "Resources updated",
        description: "The hosted database plan change was submitted.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Resource update failed",
        description: formatAdminError(error),
      });
    },
  });

  function openCreateDialog() {
    setSelectedCreatePlanCode(fallbackPlanCode);
    setCreateDisplayName("");
    setCreateDescription("");
    setCreateDialogOpen(true);
  }

  function openEditDialog(record: HostedTimescaleDatabaseRecord) {
    const databaseId = readHostedDatabaseId(record);
    if (databaseId === null) {
      toast({
        variant: "error",
        title: "Database id missing",
        description: "This hosted database record does not expose an id that can be updated.",
      });
      return;
    }

    setEditingDatabaseId(databaseId);
    setSelectedEditPlanCode(readHostedDatabasePlanCode(record) || fallbackPlanCode);
  }

  function closeEditDialog() {
    setEditingDatabaseId(null);
    setSelectedEditPlanCode("");
  }

  function renderDatabasesTab() {
    const headerTitle = plansQuery.data?.title?.trim() || activeMeta.title;

    return (
      <div className="space-y-4">
        <Card className="border-border/70 bg-background/20">
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45">
                    {timescaleIcon ? (
                      <img src={timescaleIcon} alt="" className="h-6 w-6 object-contain" />
                    ) : (
                      <Database className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <CardTitle>{headerTitle}</CardTitle>
                    <CardDescription>
                      Create hosted Timescale databases from the published billing plans catalog.
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {plansQuery.data?.resource_kind ? (
                    <Badge variant="neutral">{plansQuery.data.resource_kind}</Badge>
                  ) : null}
                  {providerNames.length === 1 ? <Badge variant="neutral">{providerNames[0]}</Badge> : null}
                  {providerNames.length > 1 ? (
                    <Badge variant="neutral">{`${providerNames.length} providers`}</Badge>
                  ) : null}
                  <Badge variant="neutral">{`${availablePlans.length} plans`}</Badge>
                  <Badge variant="neutral">{`${databases.length} databases`}</Badge>
                </div>
              </div>
              <Button onClick={openCreateDialog} disabled={plansQuery.isLoading || availablePlans.length === 0}>
                <Plus className="h-4 w-4" />
                Create database
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {plansQuery.isLoading ? (
              <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                Loading database plans
              </div>
            ) : null}

            {plansQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatAdminError(plansQuery.error)}
              </div>
            ) : null}

            {!plansQuery.isLoading && !plansQuery.isError ? (
              <ProviderPlanSections
                activePlanCode={createPlanCode}
                onSelectPlan={setSelectedCreatePlanCode}
                providers={providerSections}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Created databases</CardTitle>
                <CardDescription>
                  Review provisioned hosted databases and update their resource plan.
                </CardDescription>
              </div>
              <Badge variant="neutral">{`${databases.length} records`}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {databasesQuery.isLoading ? (
              <div className="flex min-h-64 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading hosted databases
                </div>
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
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                  {timescaleIcon ? (
                    <img src={timescaleIcon} alt="" className="h-7 w-7 object-contain" />
                  ) : (
                    <Database className="h-6 w-6" />
                  )}
                </div>
                <div className="mt-4 text-sm font-medium text-foreground">No hosted databases found</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a database from one of the Timescale plans to populate this registry.
                </p>
              </div>
            ) : null}

            {!databasesQuery.isLoading && !databasesQuery.isError && databases.length > 0 ? (
              <div className="overflow-x-auto px-4 py-4">
                <table
                  className="w-full min-w-[1080px] border-separate text-sm"
                  style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
                >
                  <thead>
                    <tr
                      className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                      style={{ fontSize: "var(--table-meta-font-size)" }}
                    >
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Database</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Status</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Region</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Plan</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Resources</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Monthly price</th>
                      <th className="px-4 py-[var(--table-standard-header-padding-y)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {databases.map((record, index) => {
                      const databaseId = readHostedDatabaseId(record);
                      const status = readHostedDatabaseStatus(record);
                      const planCode = readHostedDatabasePlanCode(record);
                      const matchedPlan = planCode ? planByCode.get(planCode) : undefined;
                      const planName =
                        matchedPlan?.name ||
                        (typeof record.plan_name === "string" && record.plan_name.trim()
                          ? record.plan_name.trim()
                          : typeof record.current_plan_name === "string" && record.current_plan_name.trim()
                            ? record.current_plan_name.trim()
                            : planCode || "—");
                      const monthlyPrice =
                        matchedPlan?.monthly_price ??
                        (record.monthly_price ?? null);

                      return (
                        <tr key={`${String(databaseId ?? index)}-${index}`}>
                          <td className={getRegistryTableCellClassName(false, "left")}>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/45">
                                {timescaleIcon ? (
                                  <img src={timescaleIcon} alt="" className="h-5 w-5 object-contain" />
                                ) : (
                                  <Database className="h-4 w-4 text-primary" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-foreground">
                                  {readHostedDatabaseTitle(record)}
                                </div>
                                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                                  {databaseId === null ? "No id" : String(databaseId)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="text-foreground">
                              {readHostedDatabaseRegionLabel(record, matchedPlan)}
                            </span>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <div className="font-medium text-foreground">{planName}</div>
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {planCode || "No plan code"}
                            </div>
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            {renderResourceSummary(record, matchedPlan)}
                          </td>
                          <td className={getRegistryTableCellClassName(false)}>
                            <span className="text-foreground">{formatHostedMoney(monthlyPrice)}</span>
                          </td>
                          <td className={getRegistryTableCellClassName(false, "right")}>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={databaseId === null || availablePlans.length === 0}
                                onClick={() => openEditDialog(record)}
                              >
                                <Settings2 className="h-4 w-4" />
                                Modify resources
                              </Button>
                            </div>
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

        <Dialog
          open={createDialogOpen}
          onClose={() => {
            if (!createMutation.isPending) {
              setCreateDialogOpen(false);
            }
          }}
          title="Create Timescale database"
          description="Select one of the published billing plans to request a new hosted database."
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Display name
                </label>
                <Input
                  value={createDisplayName}
                  onChange={(event) => setCreateDisplayName(event.target.value)}
                  placeholder="Research DB"
                  disabled={createMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Resource plan
                </label>
                <div className="flex h-10 items-center rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 text-sm text-foreground">
                  {createPlanCode || "Select a plan below"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Description
              </label>
              <Textarea
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                placeholder="Optional description"
                className="min-h-[120px]"
                disabled={createMutation.isPending}
              />
            </div>

            {availablePlans.length === 0 ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
                No available plans were returned by the hosted database catalog.
              </div>
            ) : (
              <ProviderPlanSections
                activePlanCode={createPlanCode}
                onSelectPlan={setSelectedCreatePlanCode}
                providers={providerSections}
              />
            )}
            <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
              <Button
                variant="ghost"
                onClick={() => setCreateDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    displayName: normalizedCreateDisplayName,
                    description: normalizedCreateDescription,
                    resourcePlanCode: createPlanCode,
                  })
                }
                disabled={!createPlanCode || !normalizedCreateDisplayName || createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create database
              </Button>
            </div>
          </div>
        </Dialog>

        <Dialog
          open={editingRecord !== null}
          onClose={() => {
            if (!updateMutation.isPending) {
              closeEditDialog();
            }
          }}
          title="Modify database resources"
          description={
            editingRecord
              ? `Change the hosted plan for ${readHostedDatabaseTitle(editingRecord)}.`
              : "Change the hosted database plan."
          }
        >
          <div className="space-y-4">
            {editingRecord ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-4">
                <div className="text-sm font-medium text-foreground">
                  {readHostedDatabaseTitle(editingRecord)}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {String(readHostedDatabaseId(editingRecord) ?? "")}
                </div>
              </div>
            ) : null}

            <ProviderPlanSections
              activePlanCode={selectedEditPlanCode}
              onSelectPlan={setSelectedEditPlanCode}
              providers={providerSections}
            />
            <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
              <Button variant="ghost" onClick={closeEditDialog} disabled={updateMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingRecord) {
                    const databaseId = readHostedDatabaseId(editingRecord);
                    if (databaseId !== null) {
                      updateMutation.mutate({
                        databaseId,
                        planCode: selectedEditPlanCode,
                      });
                    }
                  }
                }}
                disabled={!selectedEditPlanCode || updateMutation.isPending || editingRecord === null}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Settings2 className="h-4 w-4" />
                )}
                Save resources
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    );
  }

  return (
    <AdminSurfaceLayout
      title="Hosted Resources"
      description="Review organization-scoped hosted infrastructure in one billing section."
    >
      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle>Hosted resource catalog</CardTitle>
                <Badge variant="neutral">{activeMeta.summary}</Badge>
              </div>
              <CardDescription>
                Start with database resources here, then expand the same surface to other hosted
                infrastructure types.
              </CardDescription>
            </div>
            <div className="inline-flex flex-wrap items-center gap-1 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-1">
              {hostedResourceTabs.map((tab) => (
                <HostedResourceTabButton
                  key={tab.id}
                  active={tab.id === activeTab.id}
                  label={tab.label}
                  onClick={() => setActiveTabId(tab.id)}
                />
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/50 p-2 text-muted-foreground">
                {activeTab.id === "databases" && timescaleIcon ? (
                  <img src={timescaleIcon} alt="" className="h-4 w-4 object-contain" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">{activeMeta.title}</div>
                <div className="text-sm text-muted-foreground">{activeMeta.description}</div>
              </div>
            </div>
          </div>

          {activeTab.id === "databases" ? (
            renderDatabasesTab()
          ) : (
            <HostedResourcesPlaceholderPanel activeMeta={activeMeta} activeTab={activeTab} />
          )}
        </CardContent>
      </Card>
    </AdminSurfaceLayout>
  );
}
