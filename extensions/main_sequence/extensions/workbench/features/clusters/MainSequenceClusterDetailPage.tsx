import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogTable, type LogTableEntry } from "@/components/ui/log-table";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchClusterPodLogs,
  fetchClusterSummary,
  formatMainSequenceError,
  listClusterDeployments,
  listClusterServiceRuntimes,
  listClusterNamespaces,
  listClusterNodePools,
  listClusterNodes,
  listClusterPods,
  listClusterServices,
  listClusterStorage,
  type ClusterDeploymentRow,
  type ClusterDetailTabDefinition,
  type ClusterDetailTabId,
  type ClusterServiceRuntimeRow,
  type ClusterNamespaceRow,
  type ClusterNodePoolRow,
  type ClusterNodeRow,
  type ClusterPodRow,
  type ClusterSummaryResponse,
  type ClusterServiceRow,
  type ClusterStorageRow,
} from "../../../../common/api";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";

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
export const mainSequenceClusterUidParam = "msClusterUid";
export const mainSequenceClusterTabParam = "msClusterTab";
const mainSequenceClusterPodNameParam = "msClusterPodName";
const mainSequenceClusterPodNamespaceParam = "msClusterPodNamespace";
const mainSequenceClusterPodContainerParam = "msClusterPodContainer";
const legacyClusterTabParam = "tab";

const clusterTabLabels: Record<ClusterDetailTabId, string> = {
  node_pools: "Node Pools",
  nodes: "Nodes",
  namespaces: "Namespaces",
  pods: "Pods",
  deployments: "Deployments",
  services: "Services",
  storage: "Storage",
  knative: "Service Runtimes",
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
    title: "No service runtimes found",
    description: "No service runtimes matched the current namespace filter.",
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

function splitLogLine(line: string) {
  const trimmed = line.trimEnd();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2}T[^\s]+)\s+(.*)$/);

  if (!match) {
    return {
      timestamp: null,
      message: trimmed,
    };
  }

  return {
    timestamp: match[1] ?? null,
    message: match[2] ?? trimmed,
  };
}

function inferLogLevel(line: string) {
  const normalized = line.toLowerCase();

  if (/\b(error|exception|failed|fatal)\b/.test(normalized)) {
    return "error";
  }

  if (/\b(warn|warning)\b/.test(normalized)) {
    return "warning";
  }

  if (/\b(debug|trace)\b/.test(normalized)) {
    return "debug";
  }

  return "info";
}

function mapClusterPodLogsToEntries({
  clusterUid,
  namespace,
  pod,
  container,
  logs,
}: {
  clusterUid: string;
  namespace: string;
  pod: string;
  container: string | null;
  logs: string;
}) {
  return logs
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line, index): LogTableEntry => {
      const parsed = splitLogLine(line);

      return {
        id: `${clusterUid}-${namespace}-${pod}-${container ?? "default"}-${index}`,
        timestamp: parsed.timestamp,
        level: inferLogLevel(parsed.message),
        source: container ?? pod,
        message: parsed.message,
        durationMs: null,
        status: null,
        summary: `${namespace}/${pod}`,
        tags: container ? [namespace, pod, container] : [namespace, pod],
        context: {
          cluster_uid: clusterUid,
          namespace,
          pod,
          container,
          raw_line: line,
        },
        children: null,
      };
    });
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

function resolveRenderedTabs(summary: ClusterSummaryResponse | null): ClusterRenderedTab[] {
  const seen = new Set<ClusterDetailTabId>();
  const summaryTabs = Array.isArray(summary?.extensions?.tabs) ? summary.extensions.tabs : [];
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

export function MainSequenceClusterDetailPage({ clusterUid: providedClusterUid }: { clusterUid?: string } = {}) {
  const { clusterUid: rawRouteClusterUid } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const rawQueryClusterUid = searchParams.get(mainSequenceClusterUidParam)?.trim() ?? "";
  const clusterUid = (providedClusterUid ?? rawRouteClusterUid ?? rawQueryClusterUid).trim();
  const isClusterUidValid = clusterUid.length > 0;
  const activeTabParam = searchParams.get(mainSequenceClusterTabParam);
  const legacyTabParam = searchParams.get(legacyClusterTabParam);
  const rawTab = activeTabParam ?? legacyTabParam;
  const activeTab = normalizeClusterDetailTab(rawTab);
  const namespaceFilter = normalizeQueryParam(searchParams.get("namespace"));
  const nodePoolFilter = normalizeQueryParam(searchParams.get("node_pool"));
  const selectedPodName = normalizeQueryParam(searchParams.get(mainSequenceClusterPodNameParam));
  const selectedPodNamespace = normalizeQueryParam(
    searchParams.get(mainSequenceClusterPodNamespaceParam),
  );
  const selectedPodContainer = normalizeQueryParam(
    searchParams.get(mainSequenceClusterPodContainerParam),
  );
  const [logFilterValue, setLogFilterValue] = useState("");
  const deferredLogFilterValue = useDeferredValue(logFilterValue);

  const summaryQuery = useQuery({
    queryKey: ["main_sequence", "clusters", "summary", clusterUid, namespaceFilter ?? "", nodePoolFilter ?? ""],
    queryFn: () =>
      fetchClusterSummary(clusterUid, {
        namespace: namespaceFilter ?? undefined,
        nodePool: nodePoolFilter ?? undefined,
      }),
    enabled: isClusterUidValid,
    staleTime: 30_000,
  });

  const activeTabQuery = useQuery({
    queryKey: [
      "main_sequence",
      "clusters",
      "tab",
      clusterUid,
      activeTab,
      namespaceFilter ?? "",
      nodePoolFilter ?? "",
    ],
    queryFn: async () => {
      switch (activeTab) {
        case "node_pools":
          return listClusterNodePools(clusterUid);
        case "nodes":
          return listClusterNodes(clusterUid, {
            nodePool: nodePoolFilter ?? undefined,
          });
        case "namespaces":
          return listClusterNamespaces(clusterUid);
        case "pods":
          return listClusterPods(clusterUid, {
            namespace: namespaceFilter ?? undefined,
            nodePool: nodePoolFilter ?? undefined,
          });
        case "deployments":
          return listClusterDeployments(clusterUid, {
            namespace: namespaceFilter ?? undefined,
          });
        case "services":
          return listClusterServices(clusterUid, {
            namespace: namespaceFilter ?? undefined,
          });
        case "storage":
          return listClusterStorage(clusterUid, {
            namespace: namespaceFilter ?? undefined,
          });
        case "knative":
          return listClusterServiceRuntimes(clusterUid, {
            namespace: namespaceFilter ?? undefined,
          });
        default:
          return listClusterNodePools(clusterUid);
      }
    },
    enabled: isClusterUidValid && summaryQuery.isSuccess,
  });

  const podLogsSelected =
    activeTab === "pods" && Boolean(selectedPodName) && Boolean(selectedPodNamespace);

  const podLogsQuery = useQuery({
    queryKey: [
      "main_sequence",
      "clusters",
      "pod_logs",
      clusterUid,
      selectedPodNamespace ?? "",
      selectedPodName ?? "",
      selectedPodContainer ?? "",
    ],
    queryFn: () =>
      fetchClusterPodLogs(clusterUid, {
        namespace: selectedPodNamespace ?? "",
        pod: selectedPodName ?? "",
        container: selectedPodContainer,
        tail_lines: 500,
        timestamps: true,
      }),
    enabled:
      isClusterUidValid &&
      summaryQuery.isSuccess &&
      activeTab === "pods" &&
      Boolean(selectedPodNamespace) &&
      Boolean(selectedPodName),
  });

  const filteredPodLogEntries = useMemo(() => {
    const data = podLogsQuery.data;

    if (!data) {
      return [];
    }

    const needle = deferredLogFilterValue.trim().toLowerCase();
    const entries = mapClusterPodLogsToEntries({
      clusterUid: data.cluster_uid,
      namespace: data.namespace,
      pod: data.pod,
      container: data.container,
      logs: data.logs,
    });

    if (!needle) {
      return entries;
    }

    return entries.filter((entry) => JSON.stringify(entry).toLowerCase().includes(needle));
  }, [deferredLogFilterValue, podLogsQuery.data]);

  useEffect(() => {
    if (!isClusterUidValid) {
      return;
    }

    if (activeTabParam === activeTab && !legacyTabParam) {
      return;
    }

    const nextParams = new URLSearchParams(location.search);
    nextParams.set(mainSequenceClusterTabParam, activeTab);
    nextParams.delete(legacyClusterTabParam);

    navigate(
      {
        pathname: location.pathname,
        search: `?${nextParams.toString()}`,
      },
      { replace: true },
    );
  }, [activeTab, activeTabParam, isClusterUidValid, legacyTabParam, location.pathname, location.search, navigate]);

  const summary = summaryQuery.data ?? null;
  const renderedTabs = useMemo(() => resolveRenderedTabs(summary), [summary]);
  const clusterName = summary?.entity.title?.trim() || summary?.extensions?.cluster?.cluster_name?.trim() || `Cluster ${clusterUid}`;
  const resolvedClusterUid =
    summary?.extensions?.cluster?.uid?.trim() ||
    (typeof summary?.entity.id === "string" && summary.entity.id.trim() ? summary.entity.id.trim() : clusterUid);
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
      nextParams.set(mainSequenceClusterTabParam, tabId);
      nextParams.delete(legacyClusterTabParam);
      if (tabId !== "pods") {
        nextParams.delete(mainSequenceClusterPodNameParam);
        nextParams.delete(mainSequenceClusterPodNamespaceParam);
        nextParams.delete(mainSequenceClusterPodContainerParam);
      }
    });
  }

  function clearFilters() {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceClusterTabParam, activeTab);
      nextParams.delete(legacyClusterTabParam);
      nextParams.delete("namespace");
      nextParams.delete("node_pool");
      nextParams.delete(mainSequenceClusterPodNameParam);
      nextParams.delete(mainSequenceClusterPodNamespaceParam);
      nextParams.delete(mainSequenceClusterPodContainerParam);
    });
  }

  function openNodePool(name: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceClusterTabParam, "nodes");
      nextParams.delete(legacyClusterTabParam);
      nextParams.set("node_pool", name);
      nextParams.delete("namespace");
      nextParams.delete(mainSequenceClusterPodNameParam);
      nextParams.delete(mainSequenceClusterPodNamespaceParam);
      nextParams.delete(mainSequenceClusterPodContainerParam);
    });
  }

  function openNamespacePods(name: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceClusterTabParam, "pods");
      nextParams.delete(legacyClusterTabParam);
      nextParams.set("namespace", name);
      nextParams.delete("node_pool");
      nextParams.delete(mainSequenceClusterPodNameParam);
      nextParams.delete(mainSequenceClusterPodNamespaceParam);
      nextParams.delete(mainSequenceClusterPodContainerParam);
    });
  }

  function openNamespaceDeployments(name: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceClusterTabParam, "deployments");
      nextParams.delete(legacyClusterTabParam);
      nextParams.set("namespace", name);
      nextParams.delete("node_pool");
      nextParams.delete(mainSequenceClusterPodNameParam);
      nextParams.delete(mainSequenceClusterPodNamespaceParam);
      nextParams.delete(mainSequenceClusterPodContainerParam);
    });
  }

  function openPodLogs(row: ClusterPodRow) {
    const namespace = row.namespace?.trim() || namespaceFilter;

    if (!resolvedClusterUid || !namespace) {
      return;
    }

    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceClusterTabParam, "pods");
      nextParams.delete(legacyClusterTabParam);
      nextParams.set(mainSequenceClusterPodNamespaceParam, namespace);
      nextParams.set(mainSequenceClusterPodNameParam, row.name);
      nextParams.delete(mainSequenceClusterPodContainerParam);
    });
  }

  function closePodLogs() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceClusterPodNameParam);
      nextParams.delete(mainSequenceClusterPodNamespaceParam);
      nextParams.delete(mainSequenceClusterPodContainerParam);
    });
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
      label: "Service runtimes",
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
          onClick={() => openPodLogs(row)}
          disabled={!resolvedClusterUid || !(row.namespace?.trim() || namespaceFilter)}
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

  const serviceRuntimeColumns: ClusterTableColumn<ClusterServiceRuntimeRow>[] = [
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
            columns={serviceRuntimeColumns}
            minWidthClassName="min-w-[1080px]"
            rowKey={(row) => `${row.namespace ?? "default"}-${row.name}`}
            rows={rows as ClusterServiceRuntimeRow[]}
          />
        );
      default:
        return null;
    }
  }

  function renderPodLogsPanel() {
    if (!podLogsSelected || !selectedPodName || !selectedPodNamespace) {
      return null;
    }

    return (
      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>Pod logs</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Logs for {selectedPodNamespace}/{selectedPodName}
                {selectedPodContainer ? ` · container ${selectedPodContainer}` : ""}.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <MainSequenceRegistrySearch
                accessory={<Badge variant="neutral">{`${podLogsQuery.data?.logs ? filteredPodLogEntries.length : 0} logs`}</Badge>}
                value={logFilterValue}
                onChange={(event) => setLogFilterValue(event.target.value)}
                placeholder="Filter logs by content"
                searchClassName="min-w-72"
              />
              <Button type="button" variant="ghost" size="sm" onClick={closePodLogs}>
                Close logs
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {podLogsQuery.isLoading ? (
            <div className="flex min-h-56 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading pod logs
              </div>
            </div>
          ) : null}

          {podLogsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(podLogsQuery.error)}
            </div>
          ) : null}

          {!podLogsQuery.isLoading && !podLogsQuery.isError && filteredPodLogEntries.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No logs found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                This pod has no logs matching the current filter.
              </p>
            </div>
          ) : null}

          {!podLogsQuery.isLoading && !podLogsQuery.isError && filteredPodLogEntries.length > 0 ? (
            <LogTable logs={filteredPodLogEntries} />
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (!isClusterUidValid) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => navigate(getAppPath("main-sequence-foundry", "clusters"))}>
          <ArrowLeft className="h-4 w-4" />
          Back to clusters
        </Button>
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              Cluster uid is required.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (summaryQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => navigate(getAppPath("main-sequence-foundry", "clusters"))}>
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
        <Button variant="outline" size="sm" onClick={() => navigate(getAppPath("main-sequence-foundry", "clusters"))}>
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
            onClick={() => navigate(getAppPath("main-sequence-foundry", "clusters"))}
          >
            Clusters
          </button>
          <span>/</span>
          <span className="text-foreground">{clusterName}</span>
        </div>
      </div>

      <PageHeader
        eyebrow="Main Sequence"
        title={clusterName}
        description="Detail view for the selected cluster."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate(getAppPath("main-sequence-foundry", "clusters"))}>
            <ArrowLeft className="h-4 w-4" />
            Back to clusters
          </Button>
        }
      />

      <MainSequenceEntitySummaryCard summary={summary} />

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

      {renderPodLogsPanel()}
    </div>
  );
}
