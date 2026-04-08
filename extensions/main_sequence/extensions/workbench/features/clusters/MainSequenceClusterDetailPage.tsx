import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import { hasOrganizationAdminAccess } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  fetchClusterDetail,
  formatMainSequenceError,
  listClusterDeployments,
  listClusterKnative,
  listClusterNamespaces,
  listClusterNodePools,
  listClusterNodes,
  listClusterPods,
  listClusterServices,
  listClusterStorage,
  scaleCluster,
  type ClusterDeploymentRow,
  type ClusterDetailStatItem,
  type ClusterDetailSummary,
  type ClusterDetailTabDefinition,
  type ClusterDetailTabId,
  type ClusterKnativeRow,
  type ClusterNamespaceRow,
  type ClusterNodePoolRow,
  type ClusterNodeRow,
  type ClusterPodRow,
  type ClusterServiceRow,
  type ClusterStorageRow,
} from "../../../../common/api";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";

const clusterDetailTabs = [
  "node_pools",
  "nodes",
  "namespaces",
  "pods",
  "deployments",
  "services",
  "storage",
  "knative",
] as const satisfies ClusterDetailTabId[];

const defaultClusterDetailTab: ClusterDetailTabId = "node_pools";

const clusterTabLabels: Record<ClusterDetailTabId, string> = {
  node_pools: "Node Pools",
  nodes: "Nodes",
  namespaces: "Namespaces",
  pods: "Pods",
  deployments: "Deployments",
  services: "Services",
  storage: "Storage",
  knative: "Knative",
};

const tabEmptyStateCopy: Record<
  ClusterDetailTabId,
  {
    title: string;
    description: string;
  }
> = {
  node_pools: {
    title: "No node pools found",
    description: "This cluster does not currently expose any node pools.",
  },
  nodes: {
    title: "No nodes found",
    description: "No nodes matched the current cluster filters.",
  },
  namespaces: {
    title: "No namespaces found",
    description: "This cluster does not currently expose any namespaces.",
  },
  pods: {
    title: "No pods found",
    description: "No pods matched the current namespace and node-pool filters.",
  },
  deployments: {
    title: "No deployments found",
    description: "No deployments matched the current namespace filter.",
  },
  services: {
    title: "No services found",
    description: "No services matched the current namespace filter.",
  },
  storage: {
    title: "No storage resources found",
    description: "No storage resources matched the current namespace filter.",
  },
  knative: {
    title: "No Knative services found",
    description: "No Knative services matched the current namespace filter.",
  },
};

type ClusterRenderedTab = {
  id: ClusterDetailTabId;
  label: string;
  count?: string | number | null;
};

type ClusterTableColumn<Row> = {
  id: string;
  label: string;
  render: (row: Row) => ReactNode;
};

function normalizeQueryParam(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function isClusterDetailTabId(value: string | null): value is ClusterDetailTabId {
  return clusterDetailTabs.some((tab) => tab === value);
}

function normalizeClusterDetailTab(value: string | null): ClusterDetailTabId {
  return isClusterDetailTabId(value) ? value : defaultClusterDetailTab;
}

function normalizeOptionalClusterDetailTab(value: string | null) {
  return isClusterDetailTabId(value) ? value : null;
}

function extractTabId(tab: ClusterDetailTabDefinition) {
  return normalizeOptionalClusterDetailTab(
    String(tab.id ?? tab.key ?? tab.slug ?? tab.value ?? tab.name ?? "").trim() || null,
  );
}

function extractTabLabel(tab: ClusterDetailTabDefinition, id: ClusterDetailTabId) {
  const rawLabel = String(tab.label ?? tab.title ?? tab.name ?? "").trim();
  return rawLabel || clusterTabLabels[id];
}

function resolveRenderedTabs(summary: ClusterDetailSummary | null): ClusterRenderedTab[] {
  const seen = new Set<ClusterDetailTabId>();
  const summaryTabs = Array.isArray(summary?.tabs) ? summary.tabs : [];
  const renderedTabs = summaryTabs.flatMap((tab) => {
    const id = extractTabId(tab);

    if (!id || seen.has(id)) {
      return [];
    }

    seen.add(id);

    return [
      {
        id,
        label: extractTabLabel(tab, id),
        count: tab.count ?? null,
      },
    ];
  });

  return renderedTabs.length > 0
    ? renderedTabs
    : clusterDetailTabs.map((tabId) => ({
        id: tabId,
        label: clusterTabLabels[tabId],
      }));
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    const rendered = value
      .map((entry) => {
        if (entry === null || entry === undefined || entry === "") {
          return null;
        }

        if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
          return String(entry);
        }

        if (typeof entry === "object") {
          const record = entry as Record<string, unknown>;
          const label = record.label ?? record.name ?? record.port ?? record.value;
          return label !== null && label !== undefined ? String(label) : JSON.stringify(record);
        }

        return String(entry);
      })
      .filter((entry): entry is string => Boolean(entry && entry.trim()));

    return rendered.length > 0 ? rendered.join(", ") : "Not available";
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferredValue = record.label ?? record.name ?? record.value ?? record.title;
    return preferredValue !== null && preferredValue !== undefined
      ? String(preferredValue)
      : JSON.stringify(record);
  }

  return String(value);
}

function getClusterSummaryString(summary: ClusterDetailSummary, key: string) {
  const topLevelValue = (summary as Record<string, unknown>)[key];

  if (typeof topLevelValue === "string" && topLevelValue.trim()) {
    return topLevelValue.trim();
  }

  const nestedValue = summary.cluster?.[key];
  return typeof nestedValue === "string" && nestedValue.trim() ? nestedValue.trim() : null;
}

function getClusterSummaryBoolean(summary: ClusterDetailSummary, key: string) {
  const topLevelValue = (summary as Record<string, unknown>)[key];

  if (typeof topLevelValue === "boolean") {
    return topLevelValue;
  }

  const nestedValue = summary.cluster?.[key];
  return typeof nestedValue === "boolean" ? nestedValue : false;
}

function getClusterStatLabel(stat: ClusterDetailStatItem) {
  return String(stat.label ?? stat.title ?? stat.name ?? "Metric").trim() || "Metric";
}

function getClusterStatValue(stat: ClusterDetailStatItem) {
  return formatCellValue(stat.display ?? stat.value ?? null);
}

function getClusterStatMeta(stat: ClusterDetailStatItem) {
  const value = String(stat.info ?? stat.description ?? "").trim();
  return value || null;
}

function alphaColor(color: string | null | undefined, alpha = "1f") {
  const trimmed = color?.trim() ?? "";

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `${trimmed}${alpha}`;
  }

  return undefined;
}

function ClusterStatusPill({
  color,
  status,
}: {
  color?: string | null;
  status?: string | null;
}) {
  const resolvedStatus = status?.trim() || "Unknown";
  const resolvedColor = color?.trim() || "var(--muted-foreground)";

  return (
    <div
      className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium"
      style={{
        color: resolvedColor,
        borderColor: alphaColor(color, "4d") ?? "color-mix(in srgb, var(--border) 70%, transparent)",
        backgroundColor: alphaColor(color, "1f") ?? "color-mix(in srgb, var(--background) 80%, transparent)",
      }}
    >
      {resolvedStatus}
    </div>
  );
}

function ClusterDetailTable<Row>({
  columns,
  minWidthClassName,
  rowKey,
  rows,
}: {
  columns: ClusterTableColumn<Row>[];
  minWidthClassName: string;
  rowKey: (row: Row, index: number) => string;
  rows: Row[];
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full border-separate text-sm ${minWidthClassName}`}
        style={{
          borderSpacing: "0 var(--table-row-gap-y)",
          fontSize: "var(--table-font-size)",
        }}
      >
        <thead>
          <tr
            className="text-left uppercase tracking-[0.18em] text-muted-foreground"
            style={{ fontSize: "var(--table-meta-font-size)" }}
          >
            {columns.map((column, index) => (
              <th
                key={column.id}
                className={
                  index === 0
                    ? "px-4 py-[var(--table-standard-header-padding-y)]"
                    : "px-4 py-[var(--table-standard-header-padding-y)]"
                }
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((column, columnIndex) => (
                <td
                  key={column.id}
                  className={getRegistryTableCellClassName(
                    false,
                    columnIndex === 0 ? "left" : columnIndex === columns.length - 1 ? "right" : "middle",
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildScaleConfirmationMessage(result: { detail?: string; message?: string; confirmation?: string }) {
  const value = result.confirmation ?? result.message ?? result.detail ?? "";
  const trimmed = value.trim();
  return trimmed || "Cluster scale request submitted.";
}

export function MainSequenceClusterDetailPage() {
  const { clusterId: rawClusterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = useAuthStore((state) => state.session?.user ?? null);
  const clusterId = Number(rawClusterId ?? "");
  const isClusterIdValid = Number.isFinite(clusterId) && clusterId > 0;
  const [desiredNodeCountValue, setDesiredNodeCountValue] = useState("");
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const rawTab = searchParams.get("tab");
  const activeTab = normalizeClusterDetailTab(rawTab);
  const namespaceFilter = normalizeQueryParam(searchParams.get("namespace"));
  const nodePoolFilter = normalizeQueryParam(searchParams.get("node_pool"));
  const showScaleControl = user ? hasOrganizationAdminAccess(user) : true;
  const desiredNodeCountInput = desiredNodeCountValue.trim();
  const scaleValidationError = useMemo(() => {
    if (!desiredNodeCountInput) {
      return null;
    }

    const parsedValue = Number(desiredNodeCountInput);

    if (!Number.isInteger(parsedValue) || parsedValue < 0) {
      return "Desired node count must be an integer greater than or equal to 0.";
    }

    return null;
  }, [desiredNodeCountInput]);

  const summaryQuery = useQuery({
    queryKey: ["main_sequence", "clusters", "detail", clusterId],
    queryFn: () => fetchClusterDetail(clusterId),
    enabled: isClusterIdValid,
    staleTime: 30_000,
  });

  const activeTabQuery = useQuery({
    queryKey: [
      "main_sequence",
      "clusters",
      "tab",
      clusterId,
      activeTab,
      namespaceFilter ?? "",
      nodePoolFilter ?? "",
    ],
    queryFn: async () => {
      switch (activeTab) {
        case "node_pools":
          return listClusterNodePools(clusterId);
        case "nodes":
          return listClusterNodes(clusterId, {
            nodePool: nodePoolFilter ?? undefined,
          });
        case "namespaces":
          return listClusterNamespaces(clusterId);
        case "pods":
          return listClusterPods(clusterId, {
            namespace: namespaceFilter ?? undefined,
            nodePool: nodePoolFilter ?? undefined,
          });
        case "deployments":
          return listClusterDeployments(clusterId, {
            namespace: namespaceFilter ?? undefined,
          });
        case "services":
          return listClusterServices(clusterId, {
            namespace: namespaceFilter ?? undefined,
          });
        case "storage":
          return listClusterStorage(clusterId, {
            namespace: namespaceFilter ?? undefined,
          });
        case "knative":
          return listClusterKnative(clusterId, {
            namespace: namespaceFilter ?? undefined,
          });
        default:
          return listClusterNodePools(clusterId);
      }
    },
    enabled: isClusterIdValid && summaryQuery.isSuccess,
  });

  const scaleMutation = useMutation({
    mutationFn: (desiredNodeCount: number) =>
      scaleCluster(clusterId, {
        desiredNodeCount,
      }),
    onSuccess: async (result) => {
      toast({
        variant: "success",
        title: "Cluster scale submitted",
        description: buildScaleConfirmationMessage(result),
      });

      await Promise.all([summaryQuery.refetch(), activeTabQuery.refetch()]);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Cluster scale failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  useEffect(() => {
    if (!isClusterIdValid) {
      return;
    }

    if (rawTab === activeTab) {
      return;
    }

    const nextParams = new URLSearchParams(location.search);
    nextParams.set("tab", activeTab);

    navigate(
      {
        pathname: location.pathname,
        search: `?${nextParams.toString()}`,
      },
      { replace: true },
    );
  }, [activeTab, isClusterIdValid, location.pathname, location.search, navigate, rawTab]);

  const summary = summaryQuery.data ?? null;
  const renderedTabs = useMemo(() => resolveRenderedTabs(summary), [summary]);
  const clusterName = summary?.cluster.cluster_name?.trim() || `Cluster ${clusterId}`;
  const clusterDescription = summary?.cluster.cluster_description?.trim() || "";
  const clusterUuid = summary?.cluster.uuid?.trim() || "";
  const metadataItems = summary
    ? [
        {
          label: "Cloud provider",
          value: getClusterSummaryString(summary, "cloud_provider_label"),
        },
        {
          label: "Location",
          value: getClusterSummaryString(summary, "location"),
        },
        {
          label: "Configuration",
          value: getClusterSummaryString(summary, "cluster_configuration_name"),
        },
      ]
    : [];
  const capabilityItems = summary
    ? [
        {
          key: "allow_to_run_jupyter_hub",
          label: "Jupyter Hub",
          enabled: getClusterSummaryBoolean(summary, "allow_to_run_jupyter_hub"),
        },
        {
          key: "allow_to_run_data_sources",
          label: "Data Sources",
          enabled: getClusterSummaryBoolean(summary, "allow_to_run_data_sources"),
        },
        {
          key: "is_auto_pilot_cluster",
          label: "Autopilot",
          enabled: getClusterSummaryBoolean(summary, "is_auto_pilot_cluster"),
        },
      ]
    : [];
  const statsItems = Array.isArray(summary?.stats_items) ? summary.stats_items : [];
  const hasActiveFilters = Boolean(namespaceFilter || nodePoolFilter);

  function updateSearchParams(
    update: (nextParams: URLSearchParams) => void,
    { replace = false }: { replace?: boolean } = {},
  ) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);
    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace },
    );
  }

  function selectTab(tabId: ClusterDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set("tab", tabId);
    });
  }

  function clearFilters() {
    updateSearchParams((nextParams) => {
      nextParams.set("tab", activeTab);
      nextParams.delete("namespace");
      nextParams.delete("node_pool");
    });
  }

  function openNodePool(name: string) {
    updateSearchParams((nextParams) => {
      nextParams.set("tab", "nodes");
      nextParams.set("node_pool", name);
      nextParams.delete("namespace");
    });
  }

  function openNamespacePods(name: string) {
    updateSearchParams((nextParams) => {
      nextParams.set("tab", "pods");
      nextParams.set("namespace", name);
      nextParams.delete("node_pool");
    });
  }

  function openNamespaceDeployments(name: string) {
    updateSearchParams((nextParams) => {
      nextParams.set("tab", "deployments");
      nextParams.set("namespace", name);
      nextParams.delete("node_pool");
    });
  }

  function openPodLogs(podName: string) {
    if (!clusterUuid) {
      return;
    }

    window.location.assign(`/clusters/${clusterUuid}/pods/${encodeURIComponent(podName)}/logs/`);
  }

  async function handleScaleCluster() {
    if (!desiredNodeCountInput) {
      toast({
        variant: "error",
        title: "Cluster scale failed",
        description: "Enter a desired node count.",
      });
      return;
    }

    if (scaleValidationError) {
      toast({
        variant: "error",
        title: "Cluster scale failed",
        description: scaleValidationError,
      });
      return;
    }

    await scaleMutation.mutateAsync(Number(desiredNodeCountInput));
  }

  const nodePoolColumns: ClusterTableColumn<ClusterNodePoolRow>[] = [
    {
      id: "name",
      label: "Name",
      render: (row) => (
        <button
          type="button"
          className="group inline-flex items-center gap-1.5 rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
          onClick={() => openNodePool(row.name)}
        >
          <span>{row.name}</span>
        </button>
      ),
    },
    { id: "status", label: "Status", render: (row) => formatCellValue(row.status) },
    { id: "version", label: "Version", render: (row) => formatCellValue(row.version) },
    { id: "machine_type", label: "Machine type", render: (row) => formatCellValue(row.machine_type) },
    { id: "disk_size_gb", label: "Disk size (GB)", render: (row) => formatCellValue(row.disk_size_gb) },
    { id: "spot", label: "Spot", render: (row) => formatCellValue(row.spot) },
    { id: "nodes", label: "Nodes", render: (row) => formatCellValue(row.nodes) },
    { id: "pods", label: "Pods", render: (row) => formatCellValue(row.pods) },
    { id: "min_nodes", label: "Min nodes", render: (row) => formatCellValue(row.min_nodes) },
    { id: "max_nodes", label: "Max nodes", render: (row) => formatCellValue(row.max_nodes) },
    { id: "image_type", label: "Image type", render: (row) => formatCellValue(row.image_type) },
    { id: "auto_upgrade", label: "Auto upgrade", render: (row) => formatCellValue(row.auto_upgrade) },
    { id: "auto_repair", label: "Auto repair", render: (row) => formatCellValue(row.auto_repair) },
  ];

  const nodeColumns: ClusterTableColumn<ClusterNodeRow>[] = [
    { id: "name", label: "Name", render: (row) => formatCellValue(row.name) },
    { id: "status", label: "Status", render: (row) => formatCellValue(row.status) },
    { id: "node_pool", label: "Node pool", render: (row) => formatCellValue(row.node_pool) },
    { id: "machine_type", label: "Machine type", render: (row) => formatCellValue(row.machine_type) },
    { id: "zone", label: "Zone", render: (row) => formatCellValue(row.zone) },
    { id: "version", label: "Version", render: (row) => formatCellValue(row.version) },
    { id: "cpu_allocatable", label: "CPU allocatable", render: (row) => formatCellValue(row.cpu_allocatable) },
    {
      id: "memory_allocatable_gib",
      label: "Memory allocatable (GiB)",
      render: (row) => formatCellValue(row.memory_allocatable_gib),
    },
    {
      id: "ephemeral_storage_gib",
      label: "Ephemeral storage (GiB)",
      render: (row) => formatCellValue(row.ephemeral_storage_gib),
    },
    { id: "pod_cidr", label: "Pod CIDR", render: (row) => formatCellValue(row.pod_cidr) },
    { id: "age", label: "Age", render: (row) => formatCellValue(row.age) },
  ];

  const namespaceColumns: ClusterTableColumn<ClusterNamespaceRow>[] = [
    {
      id: "name",
      label: "Name",
      render: (row) => (
        <button
          type="button"
          className="group inline-flex items-center gap-1.5 rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
          onClick={() => openNamespacePods(row.name)}
        >
          <span>{row.name}</span>
        </button>
      ),
    },
    { id: "status", label: "Status", render: (row) => formatCellValue(row.status) },
    { id: "pods", label: "Pods", render: (row) => formatCellValue(row.pods) },
    {
      id: "deployments",
      label: "Deployments",
      render: (row) => (
        <button
          type="button"
          className="inline-flex rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
          onClick={() => openNamespaceDeployments(row.name)}
        >
          {formatCellValue(row.deployments)}
        </button>
      ),
    },
    { id: "services", label: "Services", render: (row) => formatCellValue(row.services) },
    { id: "pvcs", label: "PVCs", render: (row) => formatCellValue(row.pvcs) },
    {
      id: "knative_services",
      label: "Knative services",
      render: (row) => formatCellValue(row.knative_services),
    },
    { id: "age", label: "Age", render: (row) => formatCellValue(row.age) },
  ];

  const podColumns: ClusterTableColumn<ClusterPodRow>[] = [
    {
      id: "name",
      label: "Name",
      render: (row) => (
        <button
          type="button"
          className="group inline-flex items-center gap-1.5 rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
          onClick={() => openPodLogs(row.name)}
          disabled={!clusterUuid}
        >
          <span>{row.name}</span>
        </button>
      ),
    },
    { id: "namespace", label: "Namespace", render: (row) => formatCellValue(row.namespace) },
    { id: "status", label: "Status", render: (row) => formatCellValue(row.status) },
    { id: "node_pool", label: "Node pool", render: (row) => formatCellValue(row.node_pool) },
    { id: "node", label: "Node", render: (row) => formatCellValue(row.node) },
    { id: "pod_ip", label: "Pod IP", render: (row) => formatCellValue(row.pod_ip) },
    { id: "host_ip", label: "Host IP", render: (row) => formatCellValue(row.host_ip) },
    { id: "qos_class", label: "QoS class", render: (row) => formatCellValue(row.qos_class) },
    { id: "restarts", label: "Restarts", render: (row) => formatCellValue(row.restarts) },
    { id: "owner_kind", label: "Owner kind", render: (row) => formatCellValue(row.owner_kind) },
    { id: "owner_name", label: "Owner name", render: (row) => formatCellValue(row.owner_name) },
    { id: "age", label: "Age", render: (row) => formatCellValue(row.age) },
  ];

  const deploymentColumns: ClusterTableColumn<ClusterDeploymentRow>[] = [
    { id: "name", label: "Name", render: (row) => formatCellValue(row.name) },
    { id: "namespace", label: "Namespace", render: (row) => formatCellValue(row.namespace) },
    { id: "ready", label: "Ready", render: (row) => formatCellValue(row.ready) },
    { id: "up_to_date", label: "Up to date", render: (row) => formatCellValue(row.up_to_date) },
    { id: "available", label: "Available", render: (row) => formatCellValue(row.available) },
    { id: "strategy", label: "Strategy", render: (row) => formatCellValue(row.strategy) },
    { id: "age", label: "Age", render: (row) => formatCellValue(row.age) },
  ];

  const serviceColumns: ClusterTableColumn<ClusterServiceRow>[] = [
    { id: "name", label: "Name", render: (row) => formatCellValue(row.name) },
    { id: "namespace", label: "Namespace", render: (row) => formatCellValue(row.namespace) },
    { id: "type", label: "Type", render: (row) => formatCellValue(row.type) },
    { id: "cluster_ip", label: "Cluster IP", render: (row) => formatCellValue(row.cluster_ip) },
    { id: "external_ip", label: "External IP", render: (row) => formatCellValue(row.external_ip) },
    { id: "ports", label: "Ports", render: (row) => formatCellValue(row.ports) },
    { id: "age", label: "Age", render: (row) => formatCellValue(row.age) },
  ];

  const storageColumns: ClusterTableColumn<ClusterStorageRow>[] = [
    { id: "kind", label: "Kind", render: (row) => formatCellValue(row.kind) },
    { id: "name", label: "Name", render: (row) => formatCellValue(row.name) },
    { id: "namespace", label: "Namespace", render: (row) => formatCellValue(row.namespace) },
    { id: "status", label: "Status", render: (row) => formatCellValue(row.status) },
    { id: "storage_class", label: "Storage class", render: (row) => formatCellValue(row.storage_class) },
    { id: "size_gib", label: "Size (GiB)", render: (row) => formatCellValue(row.size_gib) },
    { id: "volume", label: "Volume", render: (row) => formatCellValue(row.volume) },
    { id: "access_modes", label: "Access modes", render: (row) => formatCellValue(row.access_modes) },
    { id: "age", label: "Age", render: (row) => formatCellValue(row.age) },
  ];

  const knativeColumns: ClusterTableColumn<ClusterKnativeRow>[] = [
    { id: "name", label: "Name", render: (row) => formatCellValue(row.name) },
    { id: "namespace", label: "Namespace", render: (row) => formatCellValue(row.namespace) },
    { id: "ready", label: "Ready", render: (row) => formatCellValue(row.ready) },
    { id: "url", label: "URL", render: (row) => formatCellValue(row.url) },
    {
      id: "latest_created_revision",
      label: "Latest created revision",
      render: (row) => formatCellValue(row.latest_created_revision),
    },
    {
      id: "latest_ready_revision",
      label: "Latest ready revision",
      render: (row) => formatCellValue(row.latest_ready_revision),
    },
    { id: "age", label: "Age", render: (row) => formatCellValue(row.age) },
  ];

  function renderActiveTabContent() {
    if (activeTabQuery.isLoading) {
      return (
        <div className="flex min-h-56 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading {clusterTabLabels[activeTab].toLowerCase()}
          </div>
        </div>
      );
    }

    if (activeTabQuery.isError) {
      return (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(activeTabQuery.error)}
        </div>
      );
    }

    const rows = activeTabQuery.data ?? [];

    if (rows.length === 0) {
      return (
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-5 py-10 text-center">
          <div className="text-sm font-medium text-foreground">{tabEmptyStateCopy[activeTab].title}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            {tabEmptyStateCopy[activeTab].description}
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case "node_pools":
        return (
          <ClusterDetailTable
            columns={nodePoolColumns}
            minWidthClassName="min-w-[1480px]"
            rowKey={(row) => row.name}
            rows={rows as ClusterNodePoolRow[]}
          />
        );
      case "nodes":
        return (
          <ClusterDetailTable
            columns={nodeColumns}
            minWidthClassName="min-w-[1380px]"
            rowKey={(row) => row.name}
            rows={rows as ClusterNodeRow[]}
          />
        );
      case "namespaces":
        return (
          <ClusterDetailTable
            columns={namespaceColumns}
            minWidthClassName="min-w-[1040px]"
            rowKey={(row) => row.name}
            rows={rows as ClusterNamespaceRow[]}
          />
        );
      case "pods":
        return (
          <ClusterDetailTable
            columns={podColumns}
            minWidthClassName="min-w-[1540px]"
            rowKey={(row) => `${row.namespace ?? "default"}-${row.name}`}
            rows={rows as ClusterPodRow[]}
          />
        );
      case "deployments":
        return (
          <ClusterDetailTable
            columns={deploymentColumns}
            minWidthClassName="min-w-[980px]"
            rowKey={(row) => `${row.namespace ?? "default"}-${row.name}`}
            rows={rows as ClusterDeploymentRow[]}
          />
        );
      case "services":
        return (
          <ClusterDetailTable
            columns={serviceColumns}
            minWidthClassName="min-w-[1120px]"
            rowKey={(row) => `${row.namespace ?? "default"}-${row.name}`}
            rows={rows as ClusterServiceRow[]}
          />
        );
      case "storage":
        return (
          <ClusterDetailTable
            columns={storageColumns}
            minWidthClassName="min-w-[1220px]"
            rowKey={(row) => `${row.namespace ?? "default"}-${row.kind ?? "resource"}-${row.name}`}
            rows={rows as ClusterStorageRow[]}
          />
        );
      case "knative":
        return (
          <ClusterDetailTable
            columns={knativeColumns}
            minWidthClassName="min-w-[1080px]"
            rowKey={(row) => `${row.namespace ?? "default"}-${row.name}`}
            rows={rows as ClusterKnativeRow[]}
          />
        );
      default:
        return null;
    }
  }

  if (!isClusterIdValid) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => navigate(getAppPath("main_sequence_workbench", "clusters"))}>
          <ArrowLeft className="h-4 w-4" />
          Back to clusters
        </Button>
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              Cluster id must be a positive integer.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (summaryQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => navigate(getAppPath("main_sequence_workbench", "clusters"))}>
          <ArrowLeft className="h-4 w-4" />
          Back to clusters
        </Button>
        <Card>
          <CardContent className="flex min-h-72 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading cluster details
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (summaryQuery.isError || !summary) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => navigate(getAppPath("main_sequence_workbench", "clusters"))}>
          <ArrowLeft className="h-4 w-4" />
          Back to clusters
        </Button>
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {summaryQuery.isError
                ? formatMainSequenceError(summaryQuery.error)
                : "The cluster detail screen could not be loaded."}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            className="transition-colors hover:text-foreground"
            onClick={() => navigate(getAppPath("main_sequence_workbench", "clusters"))}
          >
            Clusters
          </button>
          <span>/</span>
          <span className="text-foreground">{clusterName}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(getAppPath("main_sequence_workbench", "clusters"))}>
          <ArrowLeft className="h-4 w-4" />
          Back to clusters
        </Button>
      </div>

      <PageHeader
        eyebrow="Main Sequence"
        title={clusterName}
        description={clusterDescription || undefined}
        actions={
          <>
            <ClusterStatusPill
              status={summary.cluster_status?.status ?? "Unknown"}
              color={summary.cluster_status?.color ?? undefined}
            />
            {showScaleControl ? (
              <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/36 px-3 py-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Scale cluster
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={desiredNodeCountValue}
                    onChange={(event) => setDesiredNodeCountValue(event.target.value)}
                    className="w-28"
                    placeholder="0"
                    disabled={scaleMutation.isPending}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      void handleScaleCluster();
                    }}
                    disabled={
                      scaleMutation.isPending ||
                      !desiredNodeCountInput ||
                      Boolean(scaleValidationError)
                    }
                  >
                    {scaleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Scale
                  </Button>
                </div>
                <div
                  className={`mt-1 text-xs ${scaleValidationError ? "text-danger" : "text-muted-foreground"}`}
                >
                  {scaleValidationError ?? "Desired node count"}
                </div>
              </div>
            ) : null}
          </>
        }
      />

      {summary.summary_warning ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {summary.summary_warning}
        </div>
      ) : null}

      <Card variant="nested">
        <CardContent className="grid gap-4 pt-5 md:grid-cols-3">
          {metadataItems.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </div>
              <div className="text-sm font-medium text-foreground">
                {item.value || "Not available"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {capabilityItems.map((capability) => (
          <Badge key={capability.key} variant={capability.enabled ? "success" : "neutral"}>
            {capability.label}: {capability.enabled ? "Enabled" : "Disabled"}
          </Badge>
        ))}
      </div>

      {statsItems.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statsItems.map((item, index) => (
            <Card key={`${getClusterStatLabel(item)}-${index}`} variant="nested">
              <CardContent className="space-y-2 pt-5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {getClusterStatLabel(item)}
                </div>
                <div className="text-2xl font-semibold tracking-tight text-foreground">
                  {getClusterStatValue(item)}
                </div>
                {getClusterStatMeta(item) ? (
                  <div className="text-sm text-muted-foreground">{getClusterStatMeta(item)}</div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {renderedTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={
                    tab.id === activeTab
                      ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                      : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
                  }
                  onClick={() => selectTab(tab.id)}
                >
                  {tab.label}
                  {tab.count !== null && tab.count !== undefined ? ` (${tab.count})` : ""}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {namespaceFilter ? <Badge variant="neutral">{`Namespace: ${namespaceFilter}`}</Badge> : null}
              {nodePoolFilter ? <Badge variant="neutral">{`Node pool: ${nodePoolFilter}`}</Badge> : null}
              {hasActiveFilters ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">{renderActiveTabContent()}</CardContent>
      </Card>
    </div>
  );
}
