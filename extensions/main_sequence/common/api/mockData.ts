import { commandCenterConfig } from "@/config/command-center";

const mockJsonModules = import.meta.glob("/mock_data/mainsequence/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const defaultPageSize = 25;
const devAuthProxyPrefix = "/__command_center_auth__";
const devMainSequenceMarketsProxyPrefix = "/__main_sequence_markets__";
const mainSequencePodsRoot = "/orm/api/pods/";
const mainSequenceConnectionsRoot = "/orm/api/connections/";
const mainSequenceTsManagerRoot = "/orm/api/ts_manager/";
const mainSequenceAssetsRoot = "/api/v1/";

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readDataset<T>(name: string): T {
  const path = `/mock_data/mainsequence/${name}.json`;
  const dataset = mockJsonModules[path];

  if (dataset === undefined) {
    throw new Error(`Missing Main Sequence mock dataset: ${path}`);
  }

  return cloneValue(dataset as T);
}

function readOptionalDataset<T>(name: string): T | undefined {
  const path = `/mock_data/mainsequence/${name}.json`;
  const dataset = mockJsonModules[path];

  if (dataset === undefined) {
    return undefined;
  }

  return cloneValue(dataset as T);
}

function readCollectionDataset(name: string): Array<Record<string, unknown>> {
  const dataset = readDataset<unknown>(name);

  if (Array.isArray(dataset)) {
    return dataset as Array<Record<string, unknown>>;
  }

  if (
    dataset &&
    typeof dataset === "object" &&
    "results" in dataset &&
    Array.isArray((dataset as { results?: unknown }).results)
  ) {
    return cloneValue((dataset as { results: Array<Record<string, unknown>> }).results);
  }

  throw new Error(
    `Main Sequence mock dataset /mock_data/mainsequence/${name}.json must be an array or a paginated object with results.`,
  );
}

type MockState = {
  assets: Array<Record<string, unknown>>;
  indexes: Array<Record<string, unknown>>;
  assetCategories: Array<Record<string, unknown>>;
  virtualFunds: Array<Record<string, unknown>>;
  managedAccounts: Array<Record<string, unknown>>;
  managedAccountTargetPositionsByAccountUid: Record<string, Record<string, unknown>>;
  portfolioGroups: Array<Record<string, unknown>>;
  targetPortfolios: Array<Record<string, unknown>>;
  portfolioSignals: Array<Record<string, unknown>>;
  instrumentsConfiguration: Record<string, unknown>;
  projects: Array<Record<string, unknown>>;
  projectBaseImages: Array<Record<string, unknown>>;
  githubOrganizations: Array<Record<string, unknown>>;
  projectImages: Array<Record<string, unknown>>;
  projectResources: Array<Record<string, unknown>>;
  resourceReleases: Array<Record<string, unknown>>;
  resourceReleaseGallery: Array<Record<string, unknown>>;
  deploymentRuns: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  jobRuns: Array<Record<string, unknown>>;
  jobRunLogs: Record<string, Array<Record<string, unknown>>>;
  constants: Array<Record<string, unknown>>;
  secrets: Array<Record<string, unknown>>;
  buckets: Array<Record<string, unknown>>;
  bucketObjects: Array<Record<string, unknown>>;
  clusters: Array<Record<string, unknown>>;
  projectDataSources: Array<Record<string, unknown>>;
  physicalDataSources: Array<Record<string, unknown>>;
  dataNodes: Array<Record<string, unknown>>;
  localTimeSeries: Array<Record<string, unknown>>;
  simpleTables: Array<Record<string, unknown>>;
  permissionCandidateUsers: Array<Record<string, unknown>>;
  teams: Array<Record<string, unknown>>;
  availableGpuTypes: Array<Record<string, unknown>>;
  projectRepositories: Array<Record<string, unknown>>;
  dataNodeRowsByEndpoint?: unknown;
  dataNodeLastObservationByEndpoint?: unknown;
  sourceTableConfigStatsByEndpoint?: unknown;
  dependencyGraphsByEndpoint?: unknown;
};

function createMockState(): MockState {
  return {
    assets: readDataset("assets"),
    indexes: readOptionalDataset<Array<Record<string, unknown>>>("indexes") ?? [],
    assetCategories: readDataset("asset_categories"),
    virtualFunds: readDataset("virtual_funds"),
    managedAccounts: readDataset("managed_accounts"),
    managedAccountTargetPositionsByAccountUid: {},
    portfolioGroups: readDataset("portfolio_groups"),
    targetPortfolios: readDataset("target_portfolios"),
    portfolioSignals: buildDefaultPortfolioSignals(),
    instrumentsConfiguration: readDataset("instruments_configuration"),
    projects: readDataset("projects"),
    projectBaseImages: readDataset("project_base_images"),
    githubOrganizations: readDataset("github_organizations"),
    projectImages: readDataset("project_images"),
    projectResources: readDataset("project_resources"),
    resourceReleases: readDataset("resource_releases"),
    resourceReleaseGallery: readDataset("resource_release_gallery"),
    deploymentRuns:
      readOptionalDataset<Array<Record<string, unknown>>>("deployment_runs") ?? [],
    jobs: readDataset("jobs"),
    jobRuns: readDataset("job_runs"),
    jobRunLogs: readDataset("job_run_logs"),
    constants: readDataset("constants"),
    secrets: readDataset("secrets"),
    buckets: readDataset("buckets"),
    bucketObjects: readDataset("bucket_objects"),
    clusters: readDataset("clusters"),
    projectDataSources: readDataset("project_data_sources"),
    physicalDataSources: readDataset("physical_data_sources"),
    dataNodes: readCollectionDataset("data_nodes"),
    localTimeSeries: readCollectionDataset("local_time_series"),
    simpleTables: readCollectionDataset("simple_tables"),
    permissionCandidateUsers: readDataset("permission_candidate_users"),
    teams: readDataset("teams"),
    availableGpuTypes: readDataset("available_gpu_types"),
    projectRepositories: readDataset("project_repositories"),
    dataNodeRowsByEndpoint: readOptionalDataset("get_data_between_dates_from_remote"),
    dataNodeLastObservationByEndpoint: readOptionalDataset("get_last_observation"),
    sourceTableConfigStatsByEndpoint: readOptionalDataset("source_table_config_get_stats"),
    dependencyGraphsByEndpoint: readOptionalDataset("dependencies-graph"),
  };
}

let state = createMockState();

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function buildDefaultPortfolioSignals() {
  const dataset = readOptionalDataset<Array<Record<string, unknown>>>("portfolio_signals");

  if (dataset) {
    return dataset;
  }

  return [
    {
      id: 1,
      uid: "signal-metadata-momentum",
      signal_uid: "mock-momentum-signal",
      signal_description: "Momentum signal metadata seeded for local Markets mock data.",
    },
    {
      id: 2,
      uid: "signal-metadata-quality",
      signal_uid: "mock-quality-signal",
      signal_description: "Quality signal metadata seeded for local Markets mock data.",
    },
  ];
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function readArray<T = Record<string, unknown>>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRecordArrayPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [] as Array<Record<string, unknown>>;
  }

  for (const key of ["results", "rows", "data", "items"]) {
    const candidate = payload[key];

    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
  }

  return [] as Array<Record<string, unknown>>;
}

function normalizeSingleRecordPayload(payload: unknown) {
  if (isRecord(payload)) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.find(isRecord) ?? null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  for (const key of ["last_observation", "observation", "row", "result", "data"]) {
    const candidate = (payload as Record<string, unknown>)[key];

    if (isRecord(candidate)) {
      return candidate;
    }

    if (Array.isArray(candidate)) {
      return candidate.find(isRecord) ?? null;
    }
  }

  return null;
}

function hasSingleMatchingMockDataNode(dataNodeUid: string) {
  return (
    state.dataNodes.length === 1 &&
    readString(state.dataNodes[0]?.uid) === dataNodeUid
  );
}

function getLatestRecordByTimeIndex(rows: Array<Record<string, unknown>>) {
  let latestRow: Record<string, unknown> | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    const rawTimeIndex = row.time_index;
    const parsedTime = typeof rawTimeIndex === "string" ? Date.parse(rawTimeIndex) : Number.NaN;

    if (Number.isNaN(parsedTime)) {
      continue;
    }

    if (parsedTime >= latestTime) {
      latestTime = parsedTime;
      latestRow = row;
    }
  }

  return latestRow;
}

function isDependencyGraphPayload(payload: unknown): payload is Record<string, unknown> {
  return (
    isRecord(payload) &&
    Array.isArray(payload.nodes) &&
    Array.isArray(payload.edges)
  );
}

function resolveMockDependencyGraph(input: {
  sourceKind: "local_time_serie";
  sourceId: string;
  direction?: string | null;
}) {
  const payload = state.dependencyGraphsByEndpoint;

  if (isDependencyGraphPayload(payload)) {
    return cloneValue(payload);
  }

  if (!isRecord(payload)) {
    return null;
  }

  const direction = input.direction?.trim() || "";
  const candidatePath = [
    payload[input.sourceKind],
    payload[input.sourceId],
    direction ? payload[direction] : undefined,
    direction ? payload[`${input.sourceKind}:${direction}`] : undefined,
    payload[`${input.sourceKind}:${input.sourceId}`],
    direction ? payload[`${input.sourceKind}:${input.sourceId}:${direction}`] : undefined,
  ];

  for (const candidate of candidatePath) {
    if (isDependencyGraphPayload(candidate)) {
      return cloneValue(candidate);
    }

    if (!isRecord(candidate)) {
      continue;
    }

    const nestedCandidates = [
      candidate[input.sourceId],
      direction ? candidate[direction] : undefined,
      direction ? candidate[`${input.sourceId}:${direction}`] : undefined,
    ];

    for (const nestedCandidate of nestedCandidates) {
      if (isDependencyGraphPayload(nestedCandidate)) {
        return cloneValue(nestedCandidate);
      }
    }
  }

  return null;
}

function resolveMockDataNodeRemoteRows(dataNodeUid: string) {
  const endpointPayload = state.dataNodeRowsByEndpoint;

  if (isRecord(endpointPayload) && dataNodeUid in endpointPayload) {
    const keyedPayload = endpointPayload[dataNodeUid];
    const keyedPayloadRows = normalizeRecordArrayPayload(keyedPayload);

    if (keyedPayloadRows.length > 0) {
      return keyedPayloadRows;
    }
  }

  if (hasSingleMatchingMockDataNode(dataNodeUid)) {
    return normalizeRecordArrayPayload(endpointPayload);
  }

  return [];
}

function replaceMockDataNodeRemoteRows(dataNodeUid: string, rows: Array<Record<string, unknown>>) {
  if (isRecord(state.dataNodeRowsByEndpoint)) {
    state.dataNodeRowsByEndpoint[dataNodeUid] = cloneValue(rows);
    return;
  }

  if (hasSingleMatchingMockDataNode(dataNodeUid)) {
    state.dataNodeRowsByEndpoint = cloneValue(rows);
  }
}

function resolveMockDataNodeLastObservation(dataNodeUid: string) {
  const endpointPayload = state.dataNodeLastObservationByEndpoint;

  if (isRecord(endpointPayload) && dataNodeUid in endpointPayload) {
    const keyedPayload = endpointPayload[dataNodeUid];
    const keyedObservation = normalizeSingleRecordPayload(keyedPayload);

    if (keyedObservation) {
      return keyedObservation;
    }
  }

  const explicitObservation = normalizeSingleRecordPayload(endpointPayload);

  if (explicitObservation && !isRecord(endpointPayload) && hasSingleMatchingMockDataNode(dataNodeUid)) {
    return explicitObservation;
  }

  if (hasSingleMatchingMockDataNode(dataNodeUid)) {
    const endpointRows = normalizeRecordArrayPayload(endpointPayload);
    const latestEndpointRow = getLatestRecordByTimeIndex(endpointRows);

    if (latestEndpointRow) {
      return latestEndpointRow;
    }
  }

  const rows = resolveMockDataNodeRemoteRows(dataNodeUid);
  return getLatestRecordByTimeIndex(rows) ?? rows.at(-1) ?? null;
}

function replaceMockDataNodeLastObservation(
  dataNodeUid: string,
  row: Record<string, unknown> | null,
) {
  if (isRecord(state.dataNodeLastObservationByEndpoint)) {
    if (row) {
      state.dataNodeLastObservationByEndpoint[dataNodeUid] = cloneValue(row);
    } else {
      delete state.dataNodeLastObservationByEndpoint[dataNodeUid];
    }
    return;
  }

  if (hasSingleMatchingMockDataNode(dataNodeUid)) {
    state.dataNodeLastObservationByEndpoint = row ? cloneValue(row) : null;
  }
}

function getDataNodeSourceConfigUids(node: Record<string, unknown>) {
  const sourceConfigUids = new Set<string>();
  const sourceTableConfiguration = isRecord(node.sourcetableconfiguration)
    ? node.sourcetableconfiguration
    : null;
  const explicitUid = readString(sourceTableConfiguration?.uid);

  if (explicitUid) {
    sourceConfigUids.add(explicitUid);
  }

  for (const column of readArray<Record<string, unknown>>(sourceTableConfiguration?.columns_metadata)) {
    const sourceConfigUid = readString(column.source_config_uid);

    if (sourceConfigUid) {
      sourceConfigUids.add(sourceConfigUid);
    }
  }

  const relatedTableUid = readString(sourceTableConfiguration?.related_table_uid);

  if (relatedTableUid) {
    sourceConfigUids.add(relatedTableUid);
  }

  return [...sourceConfigUids];
}

function getDataNodeIndexContext(node: Record<string, unknown>) {
  const sourceTableConfiguration = isRecord(node.sourcetableconfiguration)
    ? node.sourcetableconfiguration
    : null;
  const timeIndexName = readString(sourceTableConfiguration?.time_index_name) || "time_index";
  const indexNames = readArray<string>(sourceTableConfiguration?.index_names).filter(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  const secondaryIndexName =
    indexNames.find((value) => value !== timeIndexName) ?? null;

  return {
    indexNames,
    secondaryIndexName,
    sourceTableConfiguration,
    timeIndexName,
  };
}

function buildMockSourceTableConfigStatsFromRows(
  node: Record<string, unknown>,
  rows: Array<Record<string, unknown>>,
) {
  const { secondaryIndexName, timeIndexName } = getDataNodeIndexContext(node);

  if (!secondaryIndexName) {
    return {
      multi_index_stats: {
        max_per_asset_symbol: {},
        min_per_asset_symbol: {},
      },
      multi_index_column_stats: null,
    };
  }

  const maxPerAssetSymbol: Record<string, string> = {};
  const minPerAssetSymbol: Record<string, string> = {};

  for (const row of rows) {
    const identifier = readString(row[secondaryIndexName]);
    const rawTimeIndex = readString(row[timeIndexName]);
    const parsedTimeIndex = Date.parse(rawTimeIndex);

    if (!identifier || Number.isNaN(parsedTimeIndex)) {
      continue;
    }

    const previousMax = maxPerAssetSymbol[identifier];
    const previousMin = minPerAssetSymbol[identifier];

    if (!previousMax || parsedTimeIndex > Date.parse(previousMax)) {
      maxPerAssetSymbol[identifier] = rawTimeIndex;
    }

    if (!previousMin || parsedTimeIndex < Date.parse(previousMin)) {
      minPerAssetSymbol[identifier] = rawTimeIndex;
    }
  }

  return {
    multi_index_stats: {
      max_per_asset_symbol: maxPerAssetSymbol,
      min_per_asset_symbol: minPerAssetSymbol,
    },
    multi_index_column_stats: null,
  };
}

function resolveMockSourceTableConfigStats(sourceTableConfigId: string) {
  const endpointPayload = state.sourceTableConfigStatsByEndpoint;

  if (isRecord(endpointPayload) && sourceTableConfigId in endpointPayload) {
    return cloneValue(endpointPayload[sourceTableConfigId]);
  }

  const node = state.dataNodes.find((candidate) =>
    getDataNodeSourceConfigUids(candidate).includes(sourceTableConfigId),
  );

  if (!node) {
    return {
      multi_index_stats: {
        max_per_asset_symbol: {},
        min_per_asset_symbol: {},
      },
      multi_index_column_stats: null,
    };
  }

  return buildMockSourceTableConfigStatsFromRows(
    node,
    resolveMockDataNodeRemoteRows(readString(node.uid)),
  );
}

function resolveMockDataNodeStats(dataNodeUid: string) {
  const node = state.dataNodes.find((candidate) => readString(candidate.uid) === dataNodeUid);

  if (!node) {
    return {
      multi_index_stats: {},
      multi_index_column_stats: {},
    };
  }

  const stats = buildMockSourceTableConfigStatsFromRows(
    node,
    resolveMockDataNodeRemoteRows(dataNodeUid),
  );

  return {
    multi_index_stats: stats.multi_index_stats ?? {},
    multi_index_column_stats: stats.multi_index_column_stats ?? {},
  };
}

function updateMockDataNodeIndexStats(dataNodeUid: string) {
  const node = state.dataNodes.find((candidate) => readString(candidate.uid) === dataNodeUid);

  if (!node || !isRecord(node.sourcetableconfiguration)) {
    return {
      earliest_index_value: null,
      last_time_index_value: null,
      multi_index_column_stats: null,
      multi_index_stats: null,
    };
  }

  const rows = resolveMockDataNodeRemoteRows(dataNodeUid);
  const { timeIndexName } = getDataNodeIndexContext(node);
  const parsedRows = rows
    .map((row) => {
      const rawTimeIndex = readString(row[timeIndexName]);
      const parsedTimeIndex = Date.parse(rawTimeIndex);

      return {
        parsedTimeIndex,
        rawTimeIndex,
      };
    })
    .filter((row) => !Number.isNaN(row.parsedTimeIndex))
    .sort((left, right) => left.parsedTimeIndex - right.parsedTimeIndex);

  const lastTimeIndexValue = parsedRows.length > 0 ? parsedRows[parsedRows.length - 1]?.rawTimeIndex ?? null : null;
  const earliestIndexValue = parsedRows.length > 0 ? parsedRows[0]?.rawTimeIndex ?? null : null;

  node.sourcetableconfiguration.last_time_index_value = lastTimeIndexValue;
  node.sourcetableconfiguration.earliest_index_value = earliestIndexValue;

  const stats = buildMockSourceTableConfigStatsFromRows(node, rows);

  return {
    earliest_index_value: earliestIndexValue,
    last_time_index_value: lastTimeIndexValue,
    multi_index_column_stats: stats.multi_index_column_stats,
    multi_index_stats: stats.multi_index_stats,
  };
}

function lowerNeedle(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function matchesSearch(values: unknown[], search: string | null | undefined) {
  const needle = lowerNeedle(search);

  if (!needle) {
    return true;
  }

  return values
    .map((value) => {
      if (value === null || value === undefined) {
        return "";
      }

      if (typeof value === "string") {
        return value;
      }

      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }

      return JSON.stringify(value);
    })
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function inferMockTabularFrameFieldType(values: unknown[]) {
  const nonNullValues = values.filter((value) => value !== null && value !== undefined);

  if (nonNullValues.length === 0) {
    return "string";
  }

  if (nonNullValues.every((value) => typeof value === "number")) {
    return "number";
  }

  if (nonNullValues.every((value) => typeof value === "boolean")) {
    return "boolean";
  }

  if (nonNullValues.every((value) => typeof value === "string")) {
    return "string";
  }

  return "json";
}

function buildMockTabularFrameResponse(name: string, rows: Array<Record<string, unknown>>) {
  const columns = Array.from(
    rows.reduce<Set<string>>((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set<string>()),
  );

  return {
    frames: [
      {
        name,
        contract: "core.tabular_frame@v1",
        fields: columns.map((column) => {
          const values = rows.map((row) => row[column] ?? null);

          return {
            name: column,
            type: inferMockTabularFrameFieldType(values),
            values,
          };
        }),
      },
    ],
    warnings: [],
    traceId: `mock-${Date.now().toString(36)}`,
  };
}

function applyMockTabularFrameFilters(
  rows: Array<Record<string, unknown>>,
  searchParams: URLSearchParams,
) {
  const startDateMs = Date.parse(searchParams.get("start_date") ?? "");
  const endDateMs = Date.parse(searchParams.get("end_date") ?? "");
  const hasStartDate = Number.isFinite(startDateMs);
  const hasEndDate = Number.isFinite(endDateMs);
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const limitValue = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitValue) && limitValue > 0
    ? Math.trunc(limitValue)
    : rows.length;

  return [...rows]
    .filter((row) => {
      const rowDateMs = Date.parse(readString(row.time_index) ?? "");

      if (!Number.isFinite(rowDateMs)) {
        return !hasStartDate && !hasEndDate;
      }

      if (hasStartDate && rowDateMs < startDateMs) {
        return false;
      }

      if (hasEndDate && rowDateMs > endDateMs) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      const leftDateMs = Date.parse(readString(left.time_index) ?? "");
      const rightDateMs = Date.parse(readString(right.time_index) ?? "");
      const leftValue = Number.isFinite(leftDateMs) ? leftDateMs : 0;
      const rightValue = Number.isFinite(rightDateMs) ? rightDateMs : 0;

      return order === "asc" ? leftValue - rightValue : rightValue - leftValue;
    })
    .slice(0, limit);
}

function sortDescendingById<T extends Record<string, unknown>>(rows: T[]) {
  return [...rows].sort((left, right) => readNumber(right.id) - readNumber(left.id));
}

function buildMockNamespaceRows(rows: Array<Record<string, unknown>>) {
  const groupedNamespaces = new Map<
    string,
    {
      namespace_uid: string;
      namespace: string;
      display_name: string;
      table_count: number;
      filters: {
        namespace: string;
        namespace_uid: string;
      };
    }
  >();

  for (const row of rows) {
    const namespace = readOptionalString(row.namespace)?.trim();

    if (!namespace) {
      continue;
    }

    const existing = groupedNamespaces.get(namespace);

    if (existing) {
      existing.table_count += 1;
      continue;
    }

    const namespaceUid = `mock-namespace-${namespace}`;
    groupedNamespaces.set(namespace, {
      namespace_uid: namespaceUid,
      namespace,
      display_name: namespace,
      table_count: 1,
      filters: {
        namespace,
        namespace_uid: namespaceUid,
      },
    });
  }

  return Array.from(groupedNamespaces.values()).sort((left, right) =>
    left.namespace.localeCompare(right.namespace),
  );
}

function findMockNamespaceByUid(namespaceUid: string) {
  return buildMockNamespaceRows([...state.simpleTables, ...state.dataNodes]).find(
    (namespace) => namespace.namespace_uid === namespaceUid,
  );
}

function buildMockNamespaceTableRows(namespaceUid: string) {
  const namespace = findMockNamespaceByUid(namespaceUid);
  const namespaceName = namespace?.namespace ?? "";

  if (!namespaceName) {
    return [];
  }

  const metaTables = state.simpleTables
    .filter((table) => readOptionalString(table.namespace)?.trim() === namespaceName)
    .map((table) => ({
      kind: "meta_table",
      uid: readString(table.uid),
      storage_hash: readOptionalString(table.storage_hash) ?? null,
      identifier: readOptionalString(table.identifier) ?? null,
      creation_date: readOptionalString(table.creation_date) ?? null,
      namespace: namespaceName,
    }));

  const dataNodes = state.dataNodes
    .filter((table) => readOptionalString(table.namespace)?.trim() === namespaceName)
    .map((table) => ({
      kind: "dynamic_table",
      uid: readString(table.uid),
      storage_hash: readOptionalString(table.storage_hash) ?? null,
      identifier: readOptionalString(table.identifier) ?? null,
      creation_date: readOptionalString(table.creation_date) ?? null,
      namespace: namespaceName,
    }));

  return [...metaTables, ...dataNodes];
}

function paginate<T>(rows: T[], limitValue: string | null, offsetValue: string | null) {
  const limit = Math.max(1, Number(limitValue ?? defaultPageSize) || defaultPageSize);
  const offset = Math.max(0, Number(offsetValue ?? 0) || 0);

  return {
    count: rows.length,
    next: null,
    previous: null,
    results: rows.slice(offset, offset + limit),
  };
}

function buildFrontendPagination(totalItems: number, pageValue: string | null, pageSizeValue: string | null) {
  const pageSize = Math.max(1, Number(pageSizeValue ?? defaultPageSize) || defaultPageSize);
  const page = Math.max(1, Number(pageValue ?? 1) || 1);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = totalItems === 0 ? 0 : Math.min(totalItems, page * pageSize);

  return {
    page,
    page_size: pageSize,
    total_pages: totalPages,
    total_items: totalItems,
    has_next: page < totalPages,
    has_previous: page > 1,
    start_index: startIndex,
    end_index: endIndex,
  };
}

function frontendRowsResponse<T>(
  rows: T[],
  search: string | null,
  pageValue: string | null,
  pageSizeValue: string | null,
) {
  const pagination = buildFrontendPagination(rows.length, pageValue, pageSizeValue);
  const page = pagination.page;
  const pageSize = pagination.page_size;
  const start = (page - 1) * pageSize;

  return {
    search: search?.trim() || "",
    rows: rows.slice(start, start + pageSize),
    pagination,
  };
}

function nextId(rows: Array<Record<string, unknown>>) {
  return rows.reduce((max, row) => Math.max(max, readNumber(row.id)), 0) + 1;
}

function parseBody(init?: RequestInit) {
  if (!init?.body || typeof init.body !== "string") {
    return null;
  }

  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function detailMessage(message: string) {
  return { detail: message };
}

function findByUid(rows: Array<Record<string, unknown>>, uid: string) {
  const normalized = uid.trim();

  if (!normalized) {
    return null;
  }

  return rows.find((row) => readString(row.uid) === normalized) ?? null;
}

function isStaticSiteResourceRelease(release: Record<string, unknown> | null | undefined) {
  return lowerNeedle(readString(release?.release_kind)) === "static_site";
}

function findMockResourceRelease(resourceReleaseUid: string) {
  return (
    findByUid(state.resourceReleases, resourceReleaseUid) ??
    findByUid(state.resourceReleaseGallery, resourceReleaseUid)
  );
}

function updateMockResourceReleaseCopies(
  resourceReleaseUid: string,
  update: (release: Record<string, unknown>) => void,
) {
  for (const release of [...state.resourceReleases, ...state.resourceReleaseGallery]) {
    if (readString(release.uid) === resourceReleaseUid) {
      update(release);
    }
  }
}

function readProjectLatestCommitSha(project: Record<string, unknown> | null | undefined) {
  const latestCommit = isRecord(project?.latest_commit) ? project?.latest_commit : null;
  return (
    readOptionalString(latestCommit?.sha) ??
    readOptionalString(latestCommit?.short) ??
    "abcdef1234567890"
  );
}

function buildStaticSiteCapabilities(projectUid: string | null) {
  const pathConstraints = {
    format: "repository_relative_posix",
    allow_absolute: false,
    allow_backslash: false,
    allow_nul: false,
    forbidden_segments: ["", ".", ".."],
    forbidden_prefixes: [".mainsequence"],
    max_bytes: 1024,
  };

  return {
    creation: {
      fields: [
        {
          name: "release_kind",
          type: "choice",
          help_text: "Creates a static website release. This value is fixed to static_site.",
          required: true,
          nullable: false,
          default: "static_site",
          choices: [{ value: "static_site", label: "Static site" }],
        },
        {
          name: "project_uid",
          type: "uuid",
          help_text:
            "The current Project. It identifies the repository and branch to deploy and is filled automatically.",
          required: true,
          nullable: false,
          default: projectUid,
        },
        {
          name: "name",
          type: "string",
          help_text:
            "A user-facing name for this static-site release, for example Documentation.",
          required: true,
          nullable: false,
          default: "",
          constraints: {
            max_length: 255,
          },
        },
        {
          name: "automatic_deployment",
          type: "boolean",
          help_text:
            "When enabled, a repository push received for this Project automatically creates a new deployment.",
          required: false,
          nullable: false,
          default: true,
        },
        {
          name: "root_directory",
          type: "repository_path",
          help_text:
            "The repository-relative directory containing the Vite project. Leave it empty when package.json is at the repository root; for example, enter frontend when the file is frontend/package.json.",
          required: false,
          nullable: false,
          default: "",
          constraints: {
            ...pathConstraints,
            allow_empty: true,
          },
        },
        {
          name: "framework",
          type: "choice",
          help_text: "The framework used to build the website. This phase supports only Vite.",
          required: false,
          nullable: false,
          default: "vite",
          choices: [{ value: "vite", label: "Vite" }],
        },
        {
          name: "node_version",
          type: "choice",
          help_text: "The Node.js version used to install dependencies and build the Vite website.",
          required: false,
          nullable: true,
          default: "24",
          choices: [{ value: "24", label: "Node.js 24" }],
          conditions: [
            {
              when: { framework: "vite" },
              enabled: true,
              required: false,
              default: "24",
              choices: [{ value: "24", label: "Node.js 24" }],
            },
          ],
        },
        {
          name: "output_directory",
          type: "repository_path",
          help_text:
            "The directory produced by the build and published as the website, relative to the selected root directory; Vite normally uses dist.",
          required: false,
          nullable: true,
          default: "dist",
          constraints: {
            ...pathConstraints,
            allow_empty: false,
          },
          conditions: [
            { when: { framework: "vite" }, enabled: true, required: true, default: "dist" },
          ],
        },
        {
          name: "routing_mode",
          type: "choice",
          help_text:
            "How requests without an exact generated file are handled. SPA uses the SPA entry file; Static returns a not-found response.",
          required: false,
          nullable: true,
          default: "spa",
          choices: [
            { value: "static", label: "Static" },
            { value: "spa", label: "SPA" },
          ],
          conditions: [
            {
              when: { framework: "vite" },
              enabled: true,
              required: true,
              default: "spa",
              choices: [
                { value: "static", label: "Static" },
                { value: "spa", label: "SPA" },
              ],
            },
          ],
        },
        {
          name: "spa_entry_file",
          type: "url_path",
          help_text:
            "For SPA routing, this generated file is served when a requested path has no matching file, normally /index.html, so the Vite client-side router can handle the URL. It is omitted for Static routing.",
          required: false,
          nullable: true,
          default: "/index.html",
          constraints: {
            max_bytes: 1024,
          },
          conditions: [
            { when: { routing_mode: "static" }, enabled: false, required: false, default: null },
            { when: { routing_mode: "spa" }, enabled: true, required: true, default: "/index.html" },
          ],
        },
        {
          name: "build_environment",
          type: "string_map",
          help_text:
            "String environment variables provided to the Vite build commands, for example VITE_API_URL=https://api.example.com.",
          required: false,
          nullable: false,
          default: {},
          constraints: {
            allow_blank_values: true,
            key_pattern: "^[A-Za-z_][A-Za-z0-9_]*$",
            reserved_key_prefixes: ["MAINSEQUENCE_"],
            reserved_prefix_case_sensitive: false,
            max_entries: 100,
            max_key_length: 128,
            max_value_length: 8192,
            max_total_bytes: 65536,
          },
        },
      ],
    },
  };
}

function syncMockReleaseDeploymentPointer(
  resourceReleaseUid: string,
  run: Record<string, unknown>,
  pointer: "active" | "desired",
) {
  const summary = {
    uid: readString(run.uid),
    state: readString(run.state),
    status: readString(run.state),
    source: readString(run.source),
    commit_sha: readString(run.commit_sha),
    queued_at: readOptionalString(run.created_at),
    activated_at: readOptionalString(run.finished_at),
    finished_at: readOptionalString(run.finished_at),
    error: run.error ?? null,
  };

  updateMockResourceReleaseCopies(resourceReleaseUid, (release) => {
    if (pointer === "active") {
      release.active_deployment = summary;
    }

    release.desired_deployment = summary;
  });
}

function createMockDeploymentRun(
  release: Record<string, unknown>,
  source: "create" | "manual" | "repository_event",
  options: {
    operation?: string;
    phase?: string | null;
    state?: string;
    syncPointer?: "active" | "desired" | null;
  } = {},
) {
  const releaseUid = readString(release.uid);
  const projectUid = readString(release.project_uid);
  const project = findByUid(state.projects, projectUid);
  const now = new Date().toISOString();
  const nextIdValue = nextId(state.deploymentRuns);
  const releaseKind = readString(release.release_kind) || "streamlit_dashboard";
  const targetType = isStaticSiteResourceRelease(release)
    ? "static_site"
    : "resource_release";
  const stateValue = options.state ?? "running";
  const phase = options.phase ?? "waiting_project_image";
  const commitSha =
    readOptionalString(release.project_repo_hash) ??
    readProjectLatestCommitSha(project);
  const run = {
    id: nextIdValue,
    uid: `mock-deployment-run-${nextIdValue}`,
    target_type: targetType,
    target: {
      uid: releaseUid,
      name:
        readString(release.name) ||
        readString(release.subdomain) ||
        `Release ${releaseUid}`,
      kind: releaseKind,
    },
    project_uid: projectUid,
    operation: options.operation ?? "build_and_deploy",
    source,
    commit_sha: commitSha,
    configuration_revision: readNumber(release.configuration_revision) || 1,
    state: stateValue,
    phase,
    outcome: ["deployed", "no_action"].includes(stateValue) ? "success" : "",
    created_at: now,
    started_at: stateValue === "pending" ? null : now,
    finished_at: ["deployed", "no_action", "skipped", "blocked", "failed"].includes(stateValue)
      ? now
      : null,
    logs: {
      state: "available",
      url: `/orm/api/pods/deployment-runs/mock-deployment-run-${nextIdValue}/logs/`,
      retention_expires_at: null,
    },
    error: null,
    revision_context: {
      project_uid: projectUid || "mock-project-uid",
      current_commit_sha: commitSha,
      release_kind: releaseKind,
      resource_path:
        readString(release.resource_path) ||
        readString(release.root_directory) ||
        readString(release.resource_name) ||
        "mock/resource.py",
      resource_release_uid: releaseUid,
    },
    trigger_context: {},
    artifact_context: {},
    cleanup_context: {},
    result: {},
    steps: [],
    log_entries: [
      {
        sequence: 1,
        timestamp: now,
        stream: "stdout",
        text: "Deployment run created in local mock mode.",
      },
    ],
  };

  state.deploymentRuns.unshift(run);

  if (options.syncPointer) {
    syncMockReleaseDeploymentPointer(releaseUid, run, options.syncPointer);
  }

  return run;
}

function filterDeploymentRuns(searchParams: URLSearchParams) {
  const projectUidFilter = lowerNeedle(searchParams.get("project_uid"));
  const targetTypeFilter = lowerNeedle(searchParams.get("target_type"));

  return sortDescendingById(state.deploymentRuns.filter((run) => {
    if (projectUidFilter && lowerNeedle(readString(run.project_uid)) !== projectUidFilter) {
      return false;
    }

    if (targetTypeFilter && lowerNeedle(readString(run.target_type)) !== targetTypeFilter) {
      return false;
    }

    return true;
  }));
}

function filterAssets(searchParams: URLSearchParams, body: Record<string, unknown> | null) {
  const search = searchParams.get("search") ?? readOptionalString(body?.search);
  const ticker = searchParams.get("ticker") ?? readOptionalString(body?.ticker);
  const name = searchParams.get("name") ?? readOptionalString(body?.name);
  const exchangeCode =
    searchParams.get("exchange_code") ?? readOptionalString(body?.exchange_code);
  const categoryUid =
    searchParams.get("categories__uid") ?? readOptionalString(body?.categories__uid) ?? null;

  return sortDescendingById(
    state.assets.filter((asset) => {
      const currentSnapshot = asset.current_snapshot as Record<string, unknown> | undefined;

      if (
        ticker &&
        !matchesSearch([asset.ticker, currentSnapshot?.ticker], ticker)
      ) {
        return false;
      }

      if (
        name &&
        !matchesSearch([asset.name, currentSnapshot?.name], name)
      ) {
        return false;
      }

      if (exchangeCode && !matchesSearch([asset.exchange_code], exchangeCode)) {
        return false;
      }

      if (categoryUid && !readArray<string>(asset.category_uids).includes(categoryUid)) {
        return false;
      }

      return matchesSearch(
        [
          asset.id,
          asset.uid,
          asset.unique_identifier,
          asset.figi,
          asset.name,
          asset.ticker,
          asset.exchange_code,
          asset.security_market_sector,
          asset.security_type,
          currentSnapshot?.name,
          currentSnapshot?.ticker,
        ],
        search,
      );
    }),
  );
}

function buildAssetDetail(asset: Record<string, unknown>, fallbackUid: string) {
  const currentSnapshot = isRecord(asset.current_snapshot) ? asset.current_snapshot : {};
  const uid = readString(asset.uid) || fallbackUid;
  const uniqueIdentifier = readOptionalString(asset.unique_identifier);

  return {
    uid,
    unique_identifier: uniqueIdentifier,
    asset_type: readOptionalString(asset.asset_type) ?? readOptionalString(asset.security_type),
    current_snapshot: {
      time_index: readOptionalString(currentSnapshot.time_index) ?? "2026-06-08T10:30:00Z",
      asset_identifier:
        readOptionalString(currentSnapshot.asset_identifier) ?? uniqueIdentifier,
      name: readOptionalString(currentSnapshot.name) ?? readOptionalString(asset.name),
      ticker: readOptionalString(currentSnapshot.ticker) ?? readOptionalString(asset.ticker),
      exchange_code:
        readOptionalString(currentSnapshot.exchange_code) ?? readOptionalString(asset.exchange_code),
      asset_ticker_group_id: currentSnapshot.asset_ticker_group_id ?? null,
    },
    details: readArray(asset.details),
    trading_view: null,
    order_form: null,
  };
}

function buildAssetSummary(asset: Record<string, unknown>, fallbackUid: string) {
  const detail = buildAssetDetail(asset, fallbackUid);
  const snapshot = detail.current_snapshot;
  const title =
    readOptionalString(snapshot.name) ??
    readOptionalString(snapshot.ticker) ??
    detail.unique_identifier ??
    detail.uid;
  const assetType = readOptionalString(detail.asset_type);
  const marketSector = readOptionalString(asset.security_market_sector);

  return {
    entity: {
      id: detail.uid,
      type: "asset",
      title,
    },
    badges: [
      ...(assetType
        ? [
            {
              key: "security_type",
              label: assetType,
              tone: "neutral",
            },
          ]
        : []),
      ...(marketSector
        ? [
            {
              key: "security_market_sector",
              label: marketSector,
              tone: "info",
            },
          ]
        : []),
    ],
    inline_fields: [
      {
        key: "uid",
        label: "UID",
        value: detail.uid,
        kind: "code",
      },
      {
        key: "figi",
        label: "FIGI",
        value: readOptionalString(asset.figi),
        kind: "code",
      },
      {
        key: "exchange_code",
        label: "Exchange",
        value: snapshot.exchange_code,
        kind: "text",
      },
    ],
    highlight_fields: [
      {
        key: "name",
        label: "Name",
        value: snapshot.name,
        kind: "text",
        icon: "database",
      },
      {
        key: "unique_identifier",
        label: "Identifier",
        value: detail.unique_identifier,
        kind: "code",
        icon: "database",
      },
      {
        key: "ticker",
        label: "Ticker",
        value: snapshot.ticker,
        kind: "code",
        icon: "tag",
      },
    ],
    stats: [],
    label_management: {
      labels: [],
      add_label_url: null,
      remove_label_url: null,
    },
    summary_warning: null,
    extensions: {
      asset_type: detail.asset_type,
      is_custom_by_organization: readBoolean(asset.is_custom_by_organization),
    },
  };
}

function buildAssetPricingDetails(asset: Record<string, unknown>, fallbackUid: string) {
  const detail = buildAssetDetail(asset, fallbackUid);

  return {
    asset_uid: detail.uid,
    instrument_type: detail.asset_type ?? "unknown",
    instrument_dump: {
      unique_identifier: detail.unique_identifier,
      ticker: detail.current_snapshot.ticker,
      exchange_code: detail.current_snapshot.exchange_code,
    },
    pricing_details_date: detail.current_snapshot.time_index,
    serialization_format: "json",
    pricing_package_version: "1.0.0",
    source: "mock",
    metadata_json: {},
  };
}

function buildMockPricingCurves() {
  return [
    {
      uid: "mock-pricing-curve-usd-sofr-discount",
      unique_identifier: "USD-SOFR-3M-DISCOUNT",
      display_name: "USD SOFR 3M Discount Curve",
      curve_type: "discount",
      interpolation_method: "log_linear_discount",
      compounding: "compounded_annual",
      source: "mock",
      metadata_json: {},
    },
    {
      uid: "mock-pricing-curve-eur-estr-discount",
      unique_identifier: "EUR-ESTR-OIS-DISCOUNT",
      display_name: "EUR ESTR OIS Discount Curve",
      curve_type: "discount",
      interpolation_method: "linear_zero",
      compounding: "continuous",
      source: "mock",
      metadata_json: {},
    },
  ];
}

function buildPricingCurveSummary(curveUid: string) {
  const curve = buildMockPricingCurves().find((row) => row.uid === curveUid);

  if (!curve) {
    throw new Error(`Mock pricing curve ${curveUid} was not found.`);
  }

  return {
    entity: {
      id: curve.uid,
      type: "pricing_curve",
      title: curve.display_name || curve.unique_identifier || curve.uid,
    },
    badges: [
      {
        key: "curve_type",
        label: curve.curve_type,
        tone: "neutral",
      },
      ...(curve.source
        ? [
            {
              key: "source",
              label: curve.source,
              tone: "info",
            },
          ]
        : []),
    ],
    inline_fields: [
      {
        key: "uid",
        label: "UID",
        value: curve.uid,
        kind: "code",
      },
      {
        key: "unique_identifier",
        label: "Identifier",
        value: curve.unique_identifier,
        kind: "code",
      },
    ],
    highlight_fields: [
      {
        key: "display_name",
        label: "Curve",
        value: curve.display_name,
        kind: "text",
        icon: "database",
      },
      {
        key: "interpolation_method",
        label: "Interpolation",
        value: curve.interpolation_method,
        kind: "code",
        icon: "database",
      },
      {
        key: "compounding",
        label: "Compounding",
        value: curve.compounding,
        kind: "code",
        icon: "database",
      },
    ],
    stats: [],
    label_management: {
      labels: [],
      add_label_url: null,
      remove_label_url: null,
    },
    summary_warning: null,
    extensions: {
      detail_url: `/api/v1/pricing/curves/${curve.uid}/`,
      curve_selection_count: 1,
      curve_selections_url: `/api/v1/pricing/curves/${curve.uid}/curve-selections/`,
      metadata_json: curve.metadata_json,
    },
  };
}

function buildMockPricingCurveSelections(curveUid: string) {
  const curve = buildMockPricingCurves().find((row) => row.uid === curveUid);

  if (!curve) {
    throw new Error(`Mock pricing curve ${curveUid} was not found.`);
  }

  const isUsdCurve = curve.uid.includes("usd");
  const selectorKey = isUsdCurve ? "mock-index-usd-sofr-3m" : "mock-index-eur-estr";
  const selectorIdentifier = isUsdCurve ? "USD-SOFR" : "EUR-ESTR";
  const marketDataSet = buildMockPricingMarketDataSets()[0]!;

  return {
    curve: {
      uid: curve.uid,
      unique_identifier: curve.unique_identifier,
      display_name: curve.display_name,
      curve_type: curve.curve_type,
    },
    count: 1,
    results: [
      {
        binding_uid: `mock-curve-selection-binding-${curve.uid}`,
        market_data_set: {
          uid: marketDataSet.uid,
          set_key: marketDataSet.set_key,
          display_name: marketDataSet.display_name,
        },
        role_key: "z_spread_base",
        quote_side: "offer",
        selector: {
          type: "index",
          selector_key: selectorKey,
          index_uid: selectorKey,
          index_identifier: selectorIdentifier,
          display_name: selectorIdentifier,
        },
        status: "ACTIVE",
        source: curve.source,
      },
    ],
  };
}

function buildMockPricingCurveDeleteImpact(
  curveUid: string,
  deleteValues: boolean,
  deleteCurveSelections: boolean,
) {
  const curve = buildMockPricingCurves().find((row) => row.uid === curveUid);

  if (!curve) {
    throw new Error(`Mock pricing curve ${curveUid} was not found.`);
  }

  const valueCount = 128;
  const selectionCount = 1;
  const relationships = [
    {
      key: "discount_curve_values",
      label: "Discount curve observations",
      model: "DiscountCurvesStorage",
      column: "curve_identifier",
      relationship_type: "derived",
      on_delete: deleteValues ? "delete values" : "blocked unless delete_values=true",
      count: valueCount,
      effect: deleteValues
        ? "Discount curve observations for this curve identifier will be deleted."
        : "Stored observations still reference this curve identifier.",
      severity: deleteValues ? "destructive" : "blocking",
      blocks_delete: !deleteValues,
      description:
        "Historical discount-curve observations are keyed by curve identifier in bound DataNode storage.",
    },
    {
      key: "curve_selections",
      label: "Curve selections",
      model: "PricingMarketDataSetCurveBindingTable",
      column: "curve_uid",
      relationship_type: "direct",
      on_delete: deleteCurveSelections
        ? "delete curve selections"
        : "blocked unless delete_curve_selections=true",
      count: selectionCount,
      effect: deleteCurveSelections
        ? "Market-data-set curve-selection rows pointing to this curve will be deleted."
        : "Market-data-set curve selections still point to this curve.",
      severity: deleteCurveSelections ? "destructive" : "blocking",
      blocks_delete: !deleteCurveSelections,
      description:
        "Curve selections define where this curve is used by pricing market-data sets.",
    },
  ] as const;
  const blockingRelationships = relationships.filter((relationship) => relationship.blocks_delete);

  return {
    resource_type: "pricing_curve",
    uid: curve.uid,
    identifier: curve.unique_identifier,
    display_name: curve.display_name,
    can_delete: blockingRelationships.length === 0,
    blocking_count: blockingRelationships.reduce(
      (count, relationship) => count + relationship.count,
      0,
    ),
    affected_count:
      1 + (deleteValues ? valueCount : 0) + (deleteCurveSelections ? selectionCount : 0),
    delete_endpoint: `/api/v1/pricing/curves/${curve.uid}/`,
    relationships,
    warnings: [
      ...(deleteValues
        ? ["Discount curve observations for this curve identifier will be permanently deleted."]
        : []),
      ...(deleteCurveSelections
        ? ["Market-data-set curve-selection rows pointing to this curve will be permanently deleted."]
        : []),
    ],
  };
}

function buildMockPricingCurveDeleteResponse(
  curveUid: string,
  deleteValues: boolean,
  deleteCurveSelections: boolean,
) {
  const curve = buildMockPricingCurves().find((row) => row.uid === curveUid);

  if (!curve) {
    throw new Error(`Mock pricing curve ${curveUid} was not found.`);
  }

  return {
    detail: "Pricing curve deleted from mock state.",
    uid: curve.uid,
    curve_identifier: curve.unique_identifier,
    deleted_count: 1,
    deleted_values_count: deleteValues ? 128 : 0,
    deleted_curve_selections_count: deleteCurveSelections ? 1 : 0,
    deleted_curve_building_details_count: 1,
    delete_values: deleteValues,
    delete_curve_selections: deleteCurveSelections,
    storage_cleanups: deleteValues
      ? [
          {
            data_node_uid: `mock-data-node-${curve.uid}`,
            storage_table_identifier: "DiscountCurvesStorage",
            deleted_count: 128,
            table_empty: false,
          },
        ]
      : [],
  };
}

function buildMockPricingCurveDiscountCurve(
  curveUid: string,
  marketDataSetValue: string | null,
  valuationDateValue: string | null,
) {
  const curve = buildMockPricingCurves().find((row) => row.uid === curveUid);

  if (!curve) {
    throw new Error(`Mock pricing curve ${curveUid} was not found.`);
  }

  const marketDataSets = buildMockPricingMarketDataSets();
  const marketDataSet =
    marketDataSets.find(
      (set) => set.uid === marketDataSetValue || set.set_key === marketDataSetValue,
    ) ?? marketDataSets[0]!;
  const valuationDate = readString(valuationDateValue) || "2026-06-01T00:00:00Z";

  return {
    curve_uid: curve.uid,
    curve_identifier: curve.unique_identifier,
    curve,
    market_data_set: {
      uid: marketDataSet.uid,
      set_key: marketDataSet.set_key,
      display_name: marketDataSet.display_name,
    },
    binding: {
      uid: `mock-binding-${curve.uid}`,
      concept_key: "discount_curves",
      data_node_uid: `mock-data-node-${curve.uid}`,
      storage_table_identifier: "DiscountCurvesStorage",
    },
    valuation_date: valuationDate,
    effective_date: valuationDate,
    request_mode: "historical",
    nodes: [
      {
        days_to_maturity: 28,
        zero: curve.uid.includes("eur") ? 0.021 : 0.051,
      },
      {
        days_to_maturity: 91,
        zero: curve.uid.includes("eur") ? 0.0225 : 0.0495,
      },
      {
        days_to_maturity: 182,
        zero: curve.uid.includes("eur") ? 0.023 : 0.047,
      },
      {
        days_to_maturity: 365,
        zero: curve.uid.includes("eur") ? 0.024 : 0.044,
      },
      {
        days_to_maturity: 730,
        zero: curve.uid.includes("eur") ? 0.0255 : 0.041,
      },
    ],
  };
}

function buildMockPricingMarketDataSets() {
  return [
    {
      uid: "mock-pricing-market-data-set-default",
      set_key: "default",
      display_name: "Default pricing market data",
      description: "Mock default market-data set for curve inspection.",
      status: "ACTIVE",
      metadata_json: {},
    },
    {
      uid: "mock-pricing-market-data-set-research",
      set_key: "research",
      display_name: "Research pricing market data",
      description: "Mock research market-data set for scenario inspection.",
      status: "ACTIVE",
      metadata_json: {},
    },
  ];
}

function filterMockPricingMarketDataSets(searchParams: URLSearchParams) {
  const status = searchParams.get("status");
  const setKey = searchParams.get("set_key");

  return buildMockPricingMarketDataSets().filter((set) => {
    if (status && set.status !== status) {
      return false;
    }

    if (setKey && set.set_key !== setKey) {
      return false;
    }

    return true;
  });
}

function filterMockPricingCurves(searchParams: URLSearchParams) {
  const search = searchParams.get("search");
  const curveType = searchParams.get("curve_type");
  const source = searchParams.get("source");

  return buildMockPricingCurves().filter((curve) => {
    if (curveType && curve.curve_type !== curveType) {
      return false;
    }

    if (source && curve.source !== source) {
      return false;
    }

    return matchesSearch([curve.unique_identifier], search);
  });
}

function buildEntitySummary(
  id: number | string,
  type: string,
  title: string,
  {
    badges = [],
    inlineFields = [],
    highlightFields = [],
    stats = [],
    extra,
    extensions,
    readme,
    summaryWarning,
  }: {
    badges?: Array<Record<string, unknown>>;
    inlineFields?: Array<Record<string, unknown>>;
    highlightFields?: Array<Record<string, unknown>>;
    stats?: Array<Record<string, unknown>>;
    extra?: Record<string, unknown>;
    extensions?: Record<string, unknown>;
    readme?: Record<string, unknown>;
    summaryWarning?: string | null;
  } = {},
) {
  return {
    entity: {
      id,
      type,
      title,
    },
    badges,
    inline_fields: inlineFields,
    highlight_fields: highlightFields,
    stats,
    ...(extra ? { extra } : {}),
    ...(extensions ? { extensions } : {}),
    ...(readme ? { readme } : {}),
    ...(summaryWarning ? { summary_warning: summaryWarning } : {}),
  };
}

function buildProjectSummary(project: Record<string, unknown>) {
  const latestCommit = (project.latest_commit ?? {}) as Record<string, unknown>;
  const baseImage = (project.base_image ?? {}) as Record<string, unknown>;
  const stats = (project.stats ?? {}) as Record<string, unknown>;

  return buildEntitySummary(readString(project.uid), "project", readString(project.project_name), {
    badges: [
      {
        key: "init",
        label: readBoolean(project.is_initialized) ? "Initialized" : "Pending",
        tone: readBoolean(project.is_initialized) ? "success" : "warning",
      },
    ],
    inlineFields: [
      {
        key: "created_by",
        label: "Created by",
        value: readString(project.created_by),
        kind: "text",
      },
      {
        key: "git_ssh_url",
        label: "Repository",
        value: readString(project.git_ssh_url),
        kind: "text",
      },
      {
        key: "branch",
        label: "Branch",
        value: readString(latestCommit.branch) || "main",
        kind: "text",
      },
    ],
    highlightFields: [
      {
        key: "description",
        label: "Description",
        value: readString(project.description) || "Mock project seeded from local JSON.",
        kind: "text",
      },
      {
        key: "base_image",
        label: "Base image",
        value: readString(baseImage.title) || "Python 3.11",
        kind: "text",
      },
    ],
    stats: [
      {
        key: "jobs",
        label: "Jobs",
        display: String(readNumber(stats.jobs) || 0),
        value: readNumber(stats.jobs) || 0,
        kind: "number",
      },
      {
        key: "images",
        label: "Images",
        display: String(readNumber(stats.images) || 0),
        value: readNumber(stats.images) || 0,
        kind: "number",
      },
      {
        key: "releases",
        label: "Releases",
        display: String(readNumber(stats.releases) || 0),
        value: readNumber(stats.releases) || 0,
        kind: "number",
      },
    ],
    extra: {
      resource_usage_chart_data: readArray(project.resource_usage_chart_data),
    },
  });
}

function buildTargetPortfolioSummary(portfolio: Record<string, unknown>) {
  const portfolioRow = buildPortfolioApiRow(portfolio);
  const description = readString(portfolio.description);

  return buildEntitySummary(
    readString(portfolioRow.uid),
    "portfolio",
    readString(portfolioRow.unique_identifier),
    {
      badges: [
        {
          key: "portfolio_index",
          label: readString(portfolioRow.portfolio_index_uid) ? "Indexed" : "Portfolio",
          tone: "info",
        },
      ],
      inlineFields: [
        {
          key: "calendar_name",
          label: "Calendar",
          value: readString(portfolioRow.calendar_name),
          kind: "text",
        },
        {
          key: "portfolio_index_uid",
          label: "Portfolio Index UID",
          value: readString(portfolioRow.portfolio_index_uid),
          kind: "code",
        },
      ],
      highlightFields: [
        {
          key: "unique_identifier",
          label: "Identifier",
          value: readString(portfolioRow.unique_identifier),
          kind: "text",
        },
      ],
      stats: [],
      extra: {
        description,
        detail_url: `/api/v1/portfolio/${readString(portfolioRow.uid)}/`,
        latest_weights_url: `/api/v1/portfolio/${readString(portfolioRow.uid)}/weights/`,
        delete_url: `/api/v1/portfolio/${readString(portfolioRow.uid)}/`,
      },
    },
  );
}

function buildResourceReleaseSummary(release: Record<string, unknown>) {
  if (isStaticSiteResourceRelease(release)) {
    const releaseUid = readString(release.uid);
    const deploymentCount = state.deploymentRuns.filter(
      (run) =>
        readString(run.target_type) === "static_site" &&
        isRecord(run.target) &&
        readString(run.target.uid) === releaseUid,
    ).length;
    const lifecycleStatus = readString(release.lifecycle_status) || "active";
    const activeDeployment = isRecord(release.active_deployment)
      ? release.active_deployment
      : null;
    const desiredDeployment = isRecord(release.desired_deployment)
      ? release.desired_deployment
      : null;

    return buildEntitySummary(
      releaseUid,
      "resource_release",
      readString(release.name) || readString(release.subdomain) || "Static site",
      {
        badges: [
          {
            key: "release_kind",
            label: "Static site",
            tone: "secondary",
          },
          {
            key: "lifecycle_status",
            label: lifecycleStatus.replaceAll("_", " "),
            tone: lifecycleStatus === "active" ? "success" : "warning",
          },
          {
            key: "deployment_policy",
            label: readBoolean(release.automatic_deployment)
              ? "CI/CD release"
              : "Manual frozen release",
            tone: readBoolean(release.automatic_deployment) ? "success" : "neutral",
          },
        ],
        inlineFields: [
          {
            key: "resource_type",
            label: "Resource type",
            value: "static_site",
            kind: "text",
          },
          {
            key: "project_uid",
            label: "Project",
            value: readString(release.project_uid),
            kind: "code",
          },
          {
            key: "public_url",
            label: "Public URL",
            value: readString(release.public_url),
            kind: "link",
            href: `/orm/api/pods/resource-release/${releaseUid}/exchange-launch/`,
            iframe: true,
          },
        ],
        highlightFields: [
          {
            key: "subdomain",
            label: "Subdomain",
            value: readString(release.subdomain),
            kind: "text",
          },
          {
            key: "active_commit",
            label: "Active commit",
            value: readString(activeDeployment?.commit_sha),
            kind: "code",
          },
          {
            key: "desired_commit",
            label: "Desired commit",
            value: readString(desiredDeployment?.commit_sha),
            kind: "code",
          },
        ],
        stats: [
          {
            key: "deployments",
            label: "Deployments",
            display: String(deploymentCount),
            value: deploymentCount,
            kind: "number",
          },
          {
            key: "configuration_revision",
            label: "Configuration",
            display: `r${readNumber(release.configuration_revision) || 1}`,
            value: readNumber(release.configuration_revision) || 1,
            kind: "number",
          },
        ],
        readme: {
          path: "Static site",
          html: `<p>${readString(release.name) || "Static site"} is served from the project repository.</p>`,
          last_modified: null,
        },
      },
    );
  }

  return buildEntitySummary(
    readString(release.uid),
    "resource_release",
    readString(release.title) || readString(release.subdomain),
    {
      badges: [
        {
          key: "release_kind",
          label: readString(release.release_kind) || "resource",
          tone: "info",
        },
        {
          key: "deployment_policy",
          label: readBoolean(release.automatic_deployment)
            ? "CI/CD release"
            : "Manual frozen release",
          tone: readBoolean(release.automatic_deployment) ? "success" : "neutral",
        },
      ],
      inlineFields: [
        {
          key: "project_name",
          label: "Project",
          value: readString(release.project_name),
          kind: "text",
        },
        {
          key: "resource_uid",
          label: "Resource",
          value:
            readOptionalString(release.resource_uid) ??
            readOptionalString(release.resource_name) ??
            readString(release.resource),
          kind: "text",
        },
        {
          key: "related_job_uid",
          label: "Job",
          value:
            readOptionalString(release.related_job_uid) ??
            readOptionalString(release.related_job),
          kind: "text",
        },
        {
          key: "public_url",
          label: "Public URL",
          value: readString(release.public_url),
          kind: "text",
        },
      ],
      highlightFields: [
        {
          key: "repo_hash",
          label: "Repo hash",
          value: readString(release.project_repo_hash),
          kind: "code",
        },
      ],
      stats: [
        {
          key: "image_uid",
          label: "Image UID",
          display: readString(release.image_uid),
          value: readString(release.image_uid),
          kind: "code",
        },
      ],
      readme: {
        path: "README.md",
        html: `<p>${readString(release.readme_html) || "Mock release seeded from local JSON."}</p>`,
        last_modified: readString(release.last_modified) || null,
      },
    },
  );
}

function buildDataNodeSummary(dataNode: Record<string, unknown>) {
  const sourceTable = (dataNode.sourcetableconfiguration ?? {}) as Record<string, unknown>;

  return buildEntitySummary(readNumber(dataNode.id), "data_node", readString(dataNode.identifier), {
    badges: [
      {
        key: "visibility",
        label: readBoolean(dataNode.open_for_everyone) ? "Public" : "Private",
        tone: readBoolean(dataNode.open_for_everyone) ? "success" : "neutral",
      },
    ],
    inlineFields: [
      {
        key: "frequency",
        label: "Frequency",
        value: String(dataNode.data_frequency_id ?? "Not set"),
        kind: "text",
      },
      {
        key: "last_index",
        label: "Last index",
        value: readString(sourceTable.last_time_index_value) || "Not set",
        kind: "datetime",
      },
    ],
    highlightFields: [
      {
        key: "description",
        label: "Description",
        value: readString(dataNode.description) || "No description",
        kind: "text",
      },
    ],
    stats: [
      {
        key: "columns",
        label: "Columns",
        display: String(readArray(sourceTable.columns_metadata).length),
        value: readArray(sourceTable.columns_metadata).length,
        kind: "number",
      },
    ],
  });
}

function buildMetaTableSummary(metaTable: Record<string, unknown>) {
  const columns = readArray(metaTable.columns);
  const foreignKeys = readArray(metaTable.foreign_keys);

  return buildEntitySummary(
    readString(metaTable.uid),
    "meta_table",
    readString(metaTable.identifier) ||
      readString(metaTable.uid) ||
      `Meta Table ${readString(metaTable.uid)}`,
    {
      badges: [
        {
          key: "visibility",
          label: readBoolean(metaTable.open_for_everyone) ? "Public" : "Private",
          tone: readBoolean(metaTable.open_for_everyone) ? "success" : "neutral",
        },
      ],
      inlineFields: [
        {
          key: "identifier",
          label: "Identifier",
          value: readString(metaTable.identifier) || "Not set",
          kind: "text",
        },
        {
          key: "description",
          label: "Description",
          value: readString(metaTable.description) || "No description",
          kind: "text",
        },
      ],
      stats: [
        {
          key: "columns",
          label: "Columns",
          display: String(columns.length),
          value: columns.length,
          kind: "number",
        },
        {
          key: "foreign_keys",
          label: "Foreign Keys",
          display: String(foreignKeys.length),
          value: foreignKeys.length,
          kind: "number",
        },
      ],
    },
  );
}

function buildMetaTableGeneratedSearchDocument(
  metaTable: Record<string, unknown> | null | undefined,
  fallbackUid: string,
) {
  const title =
    readString(metaTable?.identifier) ||
    readString(metaTable?.meta_table_name) ||
    readString(metaTable?.table_name) ||
    readString(metaTable?.uid) ||
    fallbackUid;
  const description = readString(metaTable?.description) || "No stored description is available.";
  const columns = readArray(metaTable?.columns);
  const columnNames = columns
    .map((column) => readString((column as Record<string, unknown>)?.name))
    .filter(Boolean);

  return [
    `# ${title}`,
    "",
    description,
    "",
    columnNames.length > 0
      ? `Columns: ${columnNames.join(", ")}`
      : "No column metadata is available.",
  ].join("\n");
}

function buildBucketSummary(bucket: Record<string, unknown>) {
  const objects = state.bucketObjects.filter(
    (entry) => readNumber(entry.bucket_id) === readNumber(bucket.id),
  );
  const folders = objects.filter((entry) => readString(entry.kind) === "folder");
  const files = objects.filter((entry) => readString(entry.kind) === "file");
  const sizeBytes = files.reduce((sum, entry) => sum + readNumber(entry.size_bytes), 0);

  return buildEntitySummary(readNumber(bucket.id), "bucket", readString(bucket.name), {
    inlineFields: [
      {
        key: "bucket_name",
        label: "Bucket",
        value: readString(bucket.name),
        kind: "text",
      },
    ],
    stats: [
      {
        key: "folders",
        label: "Folders",
        display: String(folders.length),
        value: folders.length,
        kind: "number",
      },
      {
        key: "files",
        label: "Files",
        display: String(files.length),
        value: files.length,
        kind: "number",
      },
      {
        key: "size",
        label: "Size",
        display: `${Math.max(1, Math.round(sizeBytes / 1024 / 1024))} MB`,
        value: sizeBytes,
        kind: "number",
      },
    ],
  });
}

function buildProjectRepositoryBrowser(projectUid: string, currentPath: string) {
  const normalizedPath = currentPath.replace(/^\/+|\/+$/g, "");
  const prefix = normalizedPath ? `${normalizedPath}/` : "";
  const entries = state.projectRepositories.filter(
    (entry) =>
      readString(entry.project_uid) === projectUid &&
      readString(entry.path).startsWith(prefix) &&
      readString(entry.path) !== normalizedPath,
  );

  const folderSet = new Set<string>();
  const fileSet = new Set<string>();

  entries.forEach((entry) => {
    const relativePath = readString(entry.path).slice(prefix.length);

    if (!relativePath) {
      return;
    }

    const [firstSegment] = relativePath.split("/");

    if (!firstSegment) {
      return;
    }

    if (relativePath.includes("/")) {
      folderSet.add(firstSegment);
      return;
    }

    if (readString(entry.type) === "file") {
      fileSet.add(firstSegment);
      return;
    }

    folderSet.add(firstSegment);
  });

  const breadcrumbs = normalizedPath
    ? normalizedPath.split("/").reduce<Array<Record<string, unknown>>>((accumulator, segment) => {
        const previousPath = readString(accumulator.at(-1)?.path);
        const nextPath = previousPath ? `${previousPath}/${segment}` : segment;
        accumulator.push({
          name: segment,
          path: nextPath,
        });
        return accumulator;
      }, [])
    : [];

  return {
    project_uid: projectUid,
    current_path: normalizedPath,
    has_repository: true,
    message: "",
    breadcrumbs,
    folders: [...folderSet].sort().map((name) => ({
      name,
      path: prefix ? `${prefix}${name}` : name,
    })),
    files: [...fileSet].sort().map((name) => ({
      name,
      path: prefix ? `${prefix}${name}` : name,
      allowed_types: true,
    })),
  };
}

function buildProjectResourceCode(projectUid: string, path: string) {
  const normalizedPath = path.replace(/^\/+/, "");
  const entry = state.projectRepositories.find(
    (candidate) =>
      readString(candidate.project_uid) === projectUid &&
      readString(candidate.path) === normalizedPath &&
      readString(candidate.type) === "file",
  );

  const fallbackName = normalizedPath.split("/").at(-1) ?? normalizedPath;

  return {
    project_uid: projectUid,
    path: normalizedPath,
    name: fallbackName,
    language: fallbackName.endsWith(".py") ? "python" : fallbackName.endsWith(".sql") ? "sql" : "text",
    content: readString(entry?.content) || "# Mock content\n",
  };
}

function buildBucketBrowse(bucketUid: string, searchParams: URLSearchParams) {
  const prefix = readString(searchParams.get("prefix"));
  const search = readString(searchParams.get("search"));
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = 25;
  const bucket = findByUid(state.buckets, bucketUid);
  const bucketId = readNumber(bucket?.id);
  const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const effectivePrefix = normalizedPrefix ? `${normalizedPrefix}/` : "";

  const matchingEntries = state.bucketObjects.filter((entry) => {
    if (readNumber(entry.bucket_id) !== bucketId) {
      return false;
    }

    const entryPrefix = readString(entry.prefix);

    if (effectivePrefix && !entryPrefix.startsWith(effectivePrefix)) {
      return false;
    }

    const label = readString(entry.display_name) || readString(entry.name);

    return matchesSearch([label, entryPrefix], search);
  });

  const immediateFolders = new Map<string, Record<string, unknown>>();
  const files = matchingEntries.filter((entry) => readString(entry.kind) === "file");

  matchingEntries
    .filter((entry) => readString(entry.kind) === "folder")
    .forEach((entry) => {
      immediateFolders.set(readString(entry.prefix), {
        name: readString(entry.name),
        prefix: readString(entry.prefix),
        row_id: readString(entry.prefix),
        count_files: readNumber(entry.count_files),
        count_subfolders: readNumber(entry.count_subfolders),
      });
    });

  const paginatedFiles = files.slice((page - 1) * pageSize, page * pageSize);

  return {
    bucket_uid: bucketUid,
    bucket_name: readString(bucket?.name) || `Bucket ${bucketUid}`,
    current_prefix: normalizedPrefix,
    search,
    sort: readString(searchParams.get("sort")) || "name",
    dir: searchParams.get("dir") === "desc" ? "desc" : "asc",
    breadcrumbs: normalizedPrefix
      ? normalizedPrefix.split("/").reduce<Array<Record<string, unknown>>>((items, segment) => {
          const nextPrefix = items.length > 0
            ? `${readString(items.at(-1)?.prefix)}/${segment}`
            : segment;
          items.push({
            name: segment,
            prefix: nextPrefix,
          });
          return items;
        }, [])
      : [],
    stats: {
      artifact_count: files.length,
      folder_count: immediateFolders.size,
      file_count: files.length,
      bucket_size_bytes: files.reduce((sum, entry) => sum + readNumber(entry.size_bytes), 0),
      bucket_size_display: `${Math.max(
        1,
        Math.round(files.reduce((sum, entry) => sum + readNumber(entry.size_bytes), 0) / 1024 / 1024),
      )} MB`,
    },
    folders: [...immediateFolders.values()],
    files: paginatedFiles.map((entry) => ({
      id: readNumber(entry.id),
      name: readString(entry.name),
      display_name: readString(entry.display_name) || readString(entry.name),
      created_by_pod: readOptionalString(entry.created_by_pod),
      created_by_resource_name: readOptionalString(entry.created_by_resource_name),
      creation_date: readOptionalString(entry.creation_date),
      creation_date_display: readString(entry.creation_date_display),
      size_bytes: readNumber(entry.size_bytes),
      size_display: readString(entry.size_display),
      content_url: readOptionalString(entry.content_url),
    })),
    pagination: buildFrontendPagination(files.length, String(page), String(pageSize)),
  };
}

function buildClusterList(searchParams: URLSearchParams) {
  const filtered = state.clusters.filter((cluster) =>
    matchesSearch([cluster.id, cluster.uid, cluster.uuid, cluster.cluster_name], searchParams.get("search")),
  );

  return {
    search: searchParams.get("search") ?? "",
    rows: filtered.map((cluster) => ({
      uid: readString(cluster.uid) || readString(cluster.uuid),
      cluster_name: readString(cluster.cluster_name),
    })),
    pagination: buildFrontendPagination(
      filtered.length,
      searchParams.get("page"),
      searchParams.get("page_size"),
    ),
  };
}

function buildClusterSummary(cluster: Record<string, unknown>, searchParams: URLSearchParams) {
  const clusterUid = readString(cluster.uid) || readString(cluster.uuid);
  const status = readString(cluster.cluster_status) || "UNKNOWN";
  const tone = readString(cluster.cluster_status_color) || "neutral";
  const namespace = searchParams.get("namespace") ?? "";
  const nodePool = searchParams.get("node_pool") ?? "";

  return buildEntitySummary(clusterUid, "cluster", readString(cluster.cluster_name) || `Cluster ${clusterUid}`, {
    badges: [
      {
        key: "cluster_status",
        label: status,
        tone,
      },
    ],
    inlineFields: [
      {
        key: "uid",
        label: "Cluster UID",
        value: clusterUid,
        kind: "code",
      },
      {
        key: "location",
        label: "Location",
        value: readString(cluster.location) || "Unavailable",
        kind: "text",
      },
      {
        key: "provider",
        label: "Provider",
        value: readString(cluster.cloud_provider_label) || "Unknown",
        kind: "text",
      },
      {
        key: "active_namespace_filter",
        label: "Namespace filter",
        value: namespace || "All namespaces",
        kind: "text",
      },
      {
        key: "active_node_pool_filter",
        label: "Node pool filter",
        value: nodePool || "All node pools",
        kind: "text",
      },
    ],
    highlightFields: [
      {
        key: "cluster_name",
        label: "Cluster name",
        value: readString(cluster.cluster_name) || `Cluster ${clusterUid}`,
        kind: "text",
      },
      {
        key: "description",
        label: "Description",
        value: readString(cluster.cluster_description) || "No description",
        kind: "text",
      },
    ],
    stats: [
      {
        key: "node_pools",
        label: "Node Pools",
        display: String(readArray(cluster.node_pools).length),
        value: readArray(cluster.node_pools).length,
        kind: "number",
        info: "GKE node pools available in this cluster.",
      },
      {
        key: "nodes",
        label: "Nodes",
        display: String(readArray(cluster.nodes).length),
        value: readArray(cluster.nodes).length,
        kind: "number",
        info: "Kubernetes nodes currently registered in the cluster.",
      },
      {
        key: "namespaces",
        label: "Namespaces",
        display: String(readArray(cluster.namespaces).length),
        value: readArray(cluster.namespaces).length,
        kind: "number",
        info: "Namespaces discovered through the Kubernetes API.",
      },
      {
        key: "pods",
        label: "Pods",
        display: String(readArray(cluster.pods).length),
        value: readArray(cluster.pods).length,
        kind: "number",
        info: "Pods across all namespaces.",
      },
      {
        key: "deployments",
        label: "Deployments",
        display: String(readArray(cluster.deployments).length),
        value: readArray(cluster.deployments).length,
        kind: "number",
        info: "Deployments across all namespaces.",
      },
      {
        key: "services",
        label: "Services",
        display: String(readArray(cluster.services).length),
        value: readArray(cluster.services).length,
        kind: "number",
        info: "ClusterIP / NodePort / LoadBalancer services.",
      },
      {
        key: "pvcs",
        label: "PVCs",
        display: String(readArray(cluster.storage).length),
        value: readArray(cluster.storage).length,
        kind: "number",
        info: "PersistentVolumeClaims in the cluster.",
      },
      {
        key: "knative_services",
        label: "Service Runtimes",
        display: String(readArray(cluster.knative).length),
        value: readArray(cluster.knative).length,
        kind: "number",
        info: "Service runtime resources in the cluster.",
      },
    ],
    extensions: {
      cluster: {
        uid: clusterUid,
        cluster_name: readString(cluster.cluster_name),
        cluster_description: readString(cluster.cluster_description),
        location: readString(cluster.location),
        allow_to_run_data_sources: readBoolean(cluster.allow_to_run_data_sources),
        is_auto_pilot_cluster: readBoolean(cluster.is_auto_pilot_cluster),
      },
      cluster_status: {
        status,
        color: tone,
      },
      tabs: [
        "node_pools",
        "nodes",
        "namespaces",
        "pods",
        "deployments",
        "services",
        "storage",
        "knative",
      ].map((tabId) => ({
        key: tabId,
        label: tabId.replace(/_/g, " "),
        count: String(readArray(cluster[tabId]).length),
      })),
      filters: {
        namespace,
        node_pool: nodePool,
      },
    },
    summaryWarning: readOptionalString(cluster.summary_warning),
  });
}

function buildPermissionResponse(objectId: number | string, accessLevel: "view" | "edit") {
  const users = readArray<Record<string, unknown>>(
    accessLevel === "view" ? state.permissionCandidateUsers.slice(0, 2) : state.permissionCandidateUsers.slice(2, 3),
  );
  const teams = readArray<Record<string, unknown>>(accessLevel === "view" ? state.teams.slice(0, 1) : state.teams.slice(1, 2));

  return {
    object_id: objectId,
    object_uid: typeof objectId === "string" ? objectId : String(objectId),
    object_type: "resource",
    access_level: accessLevel,
    users,
    teams,
  };
}

function handleProjects(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/projects/" && method === "GET") {
    return paginate(sortDescendingById(state.projects), searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/projects/quick-search/" && method === "GET") {
    const q = readString(searchParams.get("q")).trim().toLowerCase();

    if (q.length < 3) {
      return {
        error: "Query must contain at least 3 characters.",
        field: "q",
      };
    }

    const requestedLimit = readNumber(searchParams.get("limit"));
    const limit = Math.max(1, Math.min(50, requestedLimit > 0 ? requestedLimit : 50));

    return state.projects
      .filter((project) => {
        const uid = readString(project.uid);
        const projectName = readString(project.project_name);
        return projectName.toLowerCase().includes(q) || uid.toLowerCase().includes(q);
      })
      .slice(0, limit)
      .map((project) => ({
        id: readNumber(project.id),
        uid: readString(project.uid),
        project_name: readString(project.project_name),
        repository_branch: isRecord(project.latest_commit)
          ? readString(project.latest_commit.branch)
          : "",
        cluster_id: null,
      }));
  }

  if (route === "/projects/" && method === "POST") {
    const body = parseBody(init);
    const id = nextId(state.projects);
    const record = {
      id,
      uid: `mock-project-${id}`,
      project_name: readString(body?.project_name) || "New Mock Project",
      data_source: state.projectDataSources[0] ?? null,
      git_ssh_url: "git@github.com:mainsequence/new-mock-project.git",
      is_initialized: false,
      created_by: "jose@main-sequence.io",
      description: "Created in mock mode.",
      latest_commit: {
        branch: readString(body?.repository_branch) || "main",
      },
      stats: {
        jobs: 0,
        images: 0,
        releases: 0,
      },
    };
    state.projects.unshift(record);
    return record;
  }

  if (route === "/projects/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const before = state.projects.length;
    state.projects = state.projects.filter((project) => !uids.has(readString(project.uid)));
    return {
      deleted_count: before - state.projects.length,
      detail: "Projects removed from mock state.",
    };
  }

  const summaryMatch = route.match(/^\/projects\/([^/]+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const projectUid = summaryMatch[1] ?? "";
    const project = findByUid(state.projects, projectUid);
    return buildProjectSummary(project ?? { uid: projectUid, project_name: `Project ${projectUid}` });
  }

  const deleteMatch = route.match(/^\/projects\/([^/]+)\/$/);
  if (deleteMatch && method === "DELETE") {
    const projectUid = deleteMatch[1] ?? "";
    state.projects = state.projects.filter((project) => readString(project.uid) !== projectUid);
    return detailMessage("Project deleted from mock state.");
  }

  const browseMatch = route.match(/^\/projects\/([^/]+)\/browse-repository\/$/);
  if (browseMatch && method === "GET") {
    return buildProjectRepositoryBrowser(browseMatch[1] ?? "", searchParams.get("path") ?? "");
  }

  const codeMatch = route.match(/^\/projects\/([^/]+)\/resource-code\/$/);
  if (codeMatch && method === "GET") {
    return buildProjectResourceCode(codeMatch[1] ?? "", searchParams.get("path") ?? "");
  }

  return undefined;
}

function handleAssets(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/api/v1/settings/" && method === "GET") {
    return {
      app: {
        name: "MainSequence Markets Public API",
        scope: "apps/v1",
        version: "4.3.14",
      },
      runtime: {
        namespace: "mainsequence.examples",
        namespace_source: "MSM_AUTO_REGISTER_NAMESPACE",
        default_namespace: "mainsequence.markets",
        auto_register_enabled: true,
        management_mode: "platform_managed",
        schema_mutation_allowed: false,
        requires_migrations: true,
      },
      documentation: {
        openapi_url: "/openapi.json",
        swagger_url: "/docs",
        redoc_url: "/redoc",
      },
      assumptions: [
        {
          key: "namespace",
          label: "Markets namespace",
          value: "mainsequence.examples",
          source: "MSM_AUTO_REGISTER_NAMESPACE",
          description: "Runtime MetaTables and DataNodes resolve against this namespace.",
        },
        {
          key: "runtime_bootstrap",
          label: "Runtime bootstrap",
          value: "startup_attachment",
          source: "apps/v1 runtime bootstrap",
          description:
            "The API attaches markets and pricing runtime tables during application startup when auto-registration namespace is configured.",
        },
        {
          key: "schema_management",
          label: "Schema management",
          value: "migrations_required",
          source: "apps/v1 runtime bootstrap",
          description:
            "Schema mutation is not performed by this API; required MetaTable migrations must already be applied.",
        },
      ],
    };
  }

  if (route === "/api/v1/asset/" && method === "GET") {
    return paginate(filterAssets(searchParams, null), searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/api/v1/asset/query/" && method === "POST") {
    const body = parseBody(init);
    return paginate(filterAssets(searchParams, body), String(body?.limit ?? defaultPageSize), String(body?.offset ?? 0));
  }

  const summaryMatch = route.match(/^\/api\/v1\/asset\/([^/]+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const assetUid = summaryMatch[1] ?? "";
    const asset = findByUid(state.assets, assetUid);
    return buildAssetSummary(asset ?? { uid: assetUid }, assetUid);
  }

  const pricingDetailsMatch = route.match(/^\/api\/v1\/asset\/([^/]+)\/get_pricing_details\/$/);
  if (pricingDetailsMatch && method === "GET") {
    const assetUid = pricingDetailsMatch[1] ?? "";
    const asset = findByUid(state.assets, assetUid);
    return buildAssetPricingDetails(asset ?? { uid: assetUid }, assetUid);
  }

  const detailMatch = route.match(/^\/api\/v1\/asset\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    const assetUid = detailMatch[1] ?? "";
    const asset = findByUid(state.assets, assetUid);
    return asset ? buildAssetDetail(asset, assetUid) : null;
  }

  const orderFieldsMatch = route.match(/^\/api\/v1\/asset\/([^/]+)\/order-form-fields\/$/);
  if (orderFieldsMatch && method === "GET") {
    const asset = findByUid(state.assets, orderFieldsMatch[1] ?? "");
    const orderFieldsByType = (asset?.order_form_fields ?? {}) as Record<string, unknown>;
    const orderType = searchParams.get("order_type") ?? "";
    return readArray(orderFieldsByType[orderType]) || readArray(asset?.order_form_default_fields);
  }

  if (route === "/api/v1/asset/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const before = state.assets.length;
    state.assets = state.assets.filter((asset) => !uids.has(readString(asset.uid)));
    return {
      detail: "Assets removed from mock state.",
      deleted_count: before - state.assets.length,
    };
  }

  return undefined;
}

function handlePricingMarketData(route: string, method: string, searchParams: URLSearchParams) {
  if (route === "/api/v1/pricing/market_data/sets/" && method === "GET") {
    return paginate(
      filterMockPricingMarketDataSets(searchParams),
      searchParams.get("limit"),
      searchParams.get("offset"),
    );
  }

  return undefined;
}

function handlePricingCurves(route: string, method: string, searchParams: URLSearchParams) {
  const summaryMatch = route.match(/^\/api\/v1\/pricing\/curves\/([^/]+)\/summary\/$/);

  if (summaryMatch && method === "GET") {
    return buildPricingCurveSummary(decodeURIComponent(summaryMatch[1] ?? ""));
  }

  const deleteImpactMatch = route.match(
    /^\/api\/v1\/pricing\/curves\/([^/]+)\/delete-impact\/$/,
  );

  if (deleteImpactMatch && method === "GET") {
    return buildMockPricingCurveDeleteImpact(
      decodeURIComponent(deleteImpactMatch[1] ?? ""),
      searchParams.get("delete_values") === "true",
      searchParams.get("delete_curve_selections") === "true",
    );
  }

  const curveSelectionsMatch = route.match(
    /^\/api\/v1\/pricing\/curves\/([^/]+)\/curve-selections\/$/,
  );

  if (curveSelectionsMatch && method === "GET") {
    return buildMockPricingCurveSelections(decodeURIComponent(curveSelectionsMatch[1] ?? ""));
  }

  const discountCurveMatch = route.match(/^\/api\/v1\/pricing\/curves\/([^/]+)\/discount-curve\/$/);

  if (discountCurveMatch && method === "GET") {
    return buildMockPricingCurveDiscountCurve(
      decodeURIComponent(discountCurveMatch[1] ?? ""),
      searchParams.get("market_data_set"),
      searchParams.get("valuation_date"),
    );
  }

  const detailMatch = route.match(/^\/api\/v1\/pricing\/curves\/([^/]+)\/$/);

  if (detailMatch && method === "DELETE") {
    return buildMockPricingCurveDeleteResponse(
      decodeURIComponent(detailMatch[1] ?? ""),
      searchParams.get("delete_values") === "true",
      searchParams.get("delete_curve_selections") === "true",
    );
  }

  if (route === "/api/v1/pricing/curves/" && method === "GET") {
    return paginate(
      filterMockPricingCurves(searchParams),
      searchParams.get("limit"),
      searchParams.get("offset"),
    );
  }

  return undefined;
}

function handleIndexes(route: string, method: string, searchParams: URLSearchParams) {
  if (route === "/api/v1/index/" && method === "GET") {
    const normalizedSearch = (searchParams.get("search") ?? "").trim().toLowerCase();
    const filtered = !normalizedSearch
      ? state.indexes
      : state.indexes.filter((indexRecord) =>
          [
            readString(indexRecord.uid),
            readString(indexRecord.unique_identifier),
            readString(indexRecord.display_name),
            readString(indexRecord.description),
            readString(indexRecord.provider),
          ].some((value) => value.toLowerCase().includes(normalizedSearch)),
        );

    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  const detailMatch = route.match(/^\/api\/v1\/index\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    return findByUid(state.indexes, detailMatch[1] ?? "");
  }

  if (detailMatch && method === "DELETE") {
    const normalizedUid = (detailMatch[1] ?? "").trim();
    const before = state.indexes.length;

    state.indexes = state.indexes.filter((indexRecord) => readString(indexRecord.uid) !== normalizedUid);

    return before === state.indexes.length ? detailMessage("Index not found.") : null;
  }

  return undefined;
}

function handleAssetCategories(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  function serializeCategory(category: Record<string, unknown> | null | undefined) {
    return {
      uid: readString(category?.uid),
      unique_identifier: readString(category?.unique_identifier),
      display_name: readString(category?.display_name),
      description: readString(category?.description),
      assets: readArray<string>(category?.assets),
    };
  }

  function serializeCategoryListRow(category: Record<string, unknown>) {
    const serialized = serializeCategory(category);

    return {
      uid: serialized.uid,
      unique_identifier: serialized.unique_identifier,
      display_name: serialized.display_name,
      description: serialized.description,
      number_of_assets: serialized.assets.length,
    };
  }

  function frontendRowsResponseFromLimitOffset<T>(
    rows: T[],
    search: string | null,
    limitValue: string | null,
    offsetValue: string | null,
  ) {
    const pageSize = Math.max(1, Number(limitValue ?? defaultPageSize) || defaultPageSize);
    const offset = Math.max(0, Number(offsetValue ?? 0) || 0);
    const page = Math.floor(offset / pageSize) + 1;

    return frontendRowsResponse(rows, search, String(page), String(pageSize));
  }

  function matchesOptionalExact(value: unknown, filter: unknown) {
    const normalized = readString(filter).trim();

    return !normalized || readString(value) === normalized;
  }

  function matchesOptionalContains(value: unknown, filter: unknown) {
    const needle = readString(filter).trim().toLowerCase();

    return !needle || readString(value).toLowerCase().includes(needle);
  }

  function matchesBulkDeleteFilters(category: Record<string, unknown>, body: Record<string, unknown> | null) {
    return (
      matchesSearch(
        [category.uid, category.unique_identifier, category.display_name, category.description],
        readString(body?.search),
      ) &&
      matchesOptionalExact(category.display_name, body?.display_name) &&
      matchesOptionalContains(category.display_name, body?.display_name__contains) &&
      matchesOptionalExact(category.unique_identifier, body?.unique_identifier) &&
      matchesOptionalContains(category.unique_identifier, body?.unique_identifier__contains) &&
      matchesOptionalExact(category.description, body?.description) &&
      matchesOptionalContains(category.description, body?.description__contains)
    );
  }

  if (route === "/api/v1/asset-category/" && method === "GET") {
    const filtered = state.assetCategories.filter((category) =>
      matchesSearch(
        [category.uid, category.unique_identifier, category.display_name, category.description],
        searchParams.get("search"),
      ),
    );
    return frontendRowsResponseFromLimitOffset(
      filtered.map(serializeCategoryListRow),
      searchParams.get("search"),
      searchParams.get("limit"),
      searchParams.get("offset"),
    );
  }

  if (route === "/api/v1/asset-category/" && method === "POST") {
    const body = parseBody(init);
    const fallbackUid = `mock-asset-category-${Date.now()}`;
    const record = {
      uid: fallbackUid,
      unique_identifier: readString(body?.unique_identifier) || `category_${Date.now()}`,
      display_name: readString(body?.display_name) || "New Category",
      description: readString(body?.description),
      assets: readArray<string>(body?.assets),
    };
    state.assetCategories.unshift(record);
    return serializeCategory(record);
  }

  if (route === "/api/v1/asset-category/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const selectAll = readBoolean(body?.select_all);
    const before = state.assetCategories.length;
    state.assetCategories = state.assetCategories.filter((category) => {
      if (selectAll) {
        return !matchesBulkDeleteFilters(category, body);
      }

      return !uids.has(readString(category.uid));
    });
    return {
      detail: "Asset categories removed from mock state.",
      deleted_count: before - state.assetCategories.length,
    };
  }

  const detailMatch = route.match(/^\/api\/v1\/asset-category\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    const categoryUid = detailMatch[1] ?? "";
    const category = findByUid(state.assetCategories, categoryUid);
    return {
      uid: categoryUid,
      title: readString(category?.display_name) || `Category ${categoryUid}`,
      selected_category: {
        uid: categoryUid,
        text: readString(category?.display_name),
        sub_text: readString(category?.unique_identifier),
      },
      details: [
        {
          name: "display_name",
          label: "Display name",
          value_type: "text",
          value: readString(category?.display_name),
        },
        {
          name: "unique_identifier",
          label: "Identifier",
          value_type: "text",
          value: readString(category?.unique_identifier),
        },
        {
          name: "description",
          label: "Description",
          value_type: "text",
          value: readString(category?.description),
        },
        {
          name: "number_of_assets",
          label: "Assets",
          value_type: "number",
          value: readArray(category?.assets).length,
        },
      ],
      actions: {
        can_edit: true,
        can_delete: true,
        update_endpoint: `/api/v1/asset-category/${categoryUid}/`,
        delete_endpoint: `/api/v1/asset-category/${categoryUid}/`,
      },
      assets_list: {
        list_endpoint: "/api/v1/asset/",
        query_endpoint: "/api/v1/asset/query/",
        response_format: "frontend_list",
        default_filters: {
          categories__uid: categoryUid,
        },
      },
    };
  }

  if (detailMatch && method === "PATCH") {
    const category = findByUid(state.assetCategories, detailMatch[1] ?? "");
    const body = parseBody(init);

    if (category) {
      Object.assign(category, body ?? {});
    }

    return serializeCategory(category);
  }

  if (detailMatch && method === "DELETE") {
    const categoryUid = detailMatch[1] ?? "";
    state.assetCategories = state.assetCategories.filter((category) => readString(category.uid) !== categoryUid);
    return null;
  }

  return undefined;
}

function handlePortfolioGroups(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  const isListRoute = route === "/api/v1/portfolio-group/" || route === "/api/v1/portfolio_group/";

  if (isListRoute && method === "GET") {
    const filtered = state.portfolioGroups.filter((group) =>
      matchesSearch(
        [group.id, group.name, group.display_name, group.unique_identifier, group.description],
        searchParams.get("search"),
      ),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (
    (route === "/api/v1/portfolio-group/" ||
      route === "/api/v1/portfolio_group/get_or_create/") &&
    method === "POST"
  ) {
    const body = parseBody(init);
    const uniqueIdentifier = readString(body?.unique_identifier) || `pg_${Date.now()}`;
    const existingGroup = state.portfolioGroups.find(
      (group) => readString(group.unique_identifier) === uniqueIdentifier,
    );

    if (existingGroup) {
      Object.assign(existingGroup, {
        display_name: readString(body?.display_name) || readString(existingGroup.display_name),
        portfolio_group_name:
          readString(body?.display_name) || readString(existingGroup.portfolio_group_name),
        description: readString(body?.description),
        metadata_json: isRecord(body?.metadata_json) ? body?.metadata_json : {},
      });
      return existingGroup;
    }

    const record = {
      id: nextId(state.portfolioGroups),
      uid: `mock-portfolio-group-${nextId(state.portfolioGroups)}`,
      name: readString(body?.display_name) || uniqueIdentifier || "Portfolio Group",
      display_name: readString(body?.display_name) || "Portfolio Group",
      portfolio_group_name: readString(body?.display_name) || "Portfolio Group",
      unique_identifier: uniqueIdentifier,
      description: readString(body?.description),
      metadata_json: isRecord(body?.metadata_json) ? body?.metadata_json : {},
      portfolio_uids: [],
      creation_date: new Date().toISOString(),
    };
    state.portfolioGroups.unshift(record);
    return record;
  }

  if (
    (route === "/api/v1/portfolio-group/bulk-delete/" ||
      route === "/api/v1/portfolio_group/bulk-delete/") &&
    method === "POST"
  ) {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const uniqueIdentifiers = new Set(readArray<string>(body?.unique_identifiers));
    const before = state.portfolioGroups.length;
    state.portfolioGroups = state.portfolioGroups.filter(
      (group) =>
        !uids.has(readString(group.uid)) &&
        !uniqueIdentifiers.has(readString(group.unique_identifier)),
    );
    return {
      detail: "Portfolio groups removed from mock state.",
      deleted_count: before - state.portfolioGroups.length,
    };
  }

  const byPortfolioMatch = route.match(/^\/api\/v1\/portfolio-group\/by-portfolio\/([^/]+)\/$/);
  if (byPortfolioMatch && method === "GET") {
    const portfolioUid = byPortfolioMatch[1] ?? "";
    const filtered = state.portfolioGroups.filter((group) =>
      readArray<string>(group.portfolio_uids).includes(portfolioUid),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  const membershipBulkDeleteMatch =
    route === "/api/v1/portfolio-group/membership/bulk-delete/";
  if (membershipBulkDeleteMatch && method === "POST") {
    const body = parseBody(init);
    const groupUids = new Set(readArray<string>(body?.portfolio_group_uids));
    const portfolioUids = new Set(readArray<string>(body?.portfolio_uids));
    let deletedCount = 0;

    state.portfolioGroups.forEach((group) => {
      if (groupUids.size > 0 && !groupUids.has(readString(group.uid))) {
        return;
      }

      const current = readArray<string>(group.portfolio_uids);
      const next = current.filter(
        (portfolioUid) => portfolioUids.size > 0 && !portfolioUids.has(portfolioUid),
      );
      deletedCount += current.length - next.length;
      group.portfolio_uids = next;
    });

    return {
      detail: "Portfolio group memberships removed from mock state.",
      deleted_count: deletedCount,
    };
  }

  const membershipDeleteMatch = route.match(
    /^\/api\/v1\/portfolio-group\/([^/]+)\/portfolios\/([^/]+)\/$/,
  );
  if (membershipDeleteMatch && method === "DELETE") {
    const group = findByUid(state.portfolioGroups, membershipDeleteMatch[1] ?? "");
    const portfolioUid = membershipDeleteMatch[2] ?? "";
    const current = readArray<string>(group?.portfolio_uids);

    if (group) {
      group.portfolio_uids = current.filter((memberUid) => memberUid !== portfolioUid);
    }

    return {
      detail: "Deleted 1 portfolio group membership.",
      deleted_count: current.includes(portfolioUid) ? 1 : 0,
    };
  }

  const membershipsMatch = route.match(/^\/api\/v1\/portfolio-group\/([^/]+)\/portfolios\/$/);
  if (membershipsMatch && method === "GET") {
    const group = findByUid(state.portfolioGroups, membershipsMatch[1] ?? "");
    const portfolioUids = new Set(readArray<string>(group?.portfolio_uids));
    const rows = state.targetPortfolios
      .filter((portfolio) => portfolioUids.has(readString(portfolio.uid)))
      .map((portfolio) => buildPortfolioApiRow(portfolio));

    return paginate(rows, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (membershipsMatch && method === "POST") {
    const group = findByUid(state.portfolioGroups, membershipsMatch[1] ?? "");
    const body = parseBody(init);
    const explicitPortfolioUid = readString(body?.portfolio_uid);
    const portfolioUniqueIdentifier = readString(body?.portfolio_unique_identifier);
    const portfolio =
      explicitPortfolioUid
        ? findByUid(state.targetPortfolios, explicitPortfolioUid)
        : state.targetPortfolios.find(
            (row) => readString(row.unique_identifier) === portfolioUniqueIdentifier,
          );
    const portfolioUid = readString(portfolio?.uid) || explicitPortfolioUid;
    const existing = new Set(readArray<string>(group?.portfolio_uids));

    if (group && portfolioUid) {
      existing.add(portfolioUid);
      group.portfolio_uids = [...existing];
    }

    return {
      uid: `${readString(group?.uid)}:${portfolioUid}`,
      portfolio_group_uid: readString(group?.uid),
      portfolio_uid: portfolioUid,
      portfolio_unique_identifier: readString(portfolio?.unique_identifier),
    };
  }

  const detailMatch = route.match(/^\/api\/v1\/portfolio[-_]group\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    return findByUid(state.portfolioGroups, detailMatch[1] ?? "");
  }

  if (detailMatch && method === "PATCH") {
    const group = findByUid(state.portfolioGroups, detailMatch[1] ?? "");
    const body = parseBody(init);

    if (group) {
      Object.assign(group, {
        display_name:
          typeof body?.display_name === "string" ? body.display_name : group.display_name,
        portfolio_group_name:
          typeof body?.display_name === "string" ? body.display_name : group.portfolio_group_name,
        description: typeof body?.description === "string" ? body.description : group.description,
        metadata_json: isRecord(body?.metadata_json) ? body.metadata_json : group.metadata_json,
      });
    }

    return group;
  }

  if (detailMatch && method === "DELETE") {
    const groupUid = detailMatch[1] ?? "";
    const before = state.portfolioGroups.length;
    state.portfolioGroups = state.portfolioGroups.filter(
      (group) => readString(group.uid) !== groupUid,
    );
    return {
      detail: "Deleted 1 portfolio group.",
      deleted_count: before - state.portfolioGroups.length,
    };
  }

  const appendMatch = route.match(/^\/api\/v1\/portfolio_group\/([^/]+)\/append-portfolios\/$/);
  if (appendMatch && method === "POST") {
    const group = findByUid(state.portfolioGroups, appendMatch[1] ?? "");
    const body = parseBody(init);
    const existing = new Set(readArray<string>(group?.portfolio_uids));
    readArray<string>(body?.portfolios).forEach((portfolioUid) => existing.add(portfolioUid));
    if (group) {
      group.portfolio_uids = [...existing];
    }
    return group;
  }

  const removeMatch = route.match(/^\/api\/v1\/portfolio_group\/([^/]+)\/remove-portfolios\/$/);
  if (removeMatch && method === "POST") {
    const group = findByUid(state.portfolioGroups, removeMatch[1] ?? "");
    const body = parseBody(init);
    const removing = new Set(readArray<string>(body?.portfolios));
    if (group) {
      group.portfolio_uids = readArray<string>(group.portfolio_uids).filter((portfolioUid) => !removing.has(portfolioUid));
    }
    return group;
  }

  return undefined;
}

function buildPortfolioApiRow(portfolio: Record<string, unknown>) {
  const indexAsset = (portfolio.index_asset ?? {}) as Record<string, unknown>;
  const currentSnapshot = (indexAsset.current_snapshot ?? {}) as Record<string, unknown>;
  const uid = readString(portfolio.uid) || `mock-portfolio-${readString(portfolio.id)}`;
  const uniqueIdentifier =
    readString(portfolio.unique_identifier) ||
    readString(portfolio.portfolio_name) ||
    readString(currentSnapshot.name) ||
    uid;

  return {
    uid,
    unique_identifier: uniqueIdentifier,
    calendar_name: readString(portfolio.calendar_name) || "CRYPTO_24_7",
    calendar_uid: readString(portfolio.calendar_uid) || null,
    portfolio_index_uid:
      readString(portfolio.portfolio_index_uid) || readString(indexAsset.uid) || null,
    portfolio_weights_data_node_uid:
      readString(portfolio.portfolio_weights_data_node_uid) || null,
    signal_weights_data_node_uid: readString(portfolio.signal_weights_data_node_uid) || null,
    portfolio_data_node_uid: readString(portfolio.portfolio_data_node_uid) || null,
    backtest_table_price_column_name:
      readString(portfolio.backtest_table_price_column_name) || "close",
  };
}

function buildPortfolioWeightsApiResponse(portfolio: Record<string, unknown> | undefined) {
  const portfolioRow = buildPortfolioApiRow(portfolio ?? {});
  const weightsDate = readString(portfolio?.weights_date) || null;
  const portfolioIndexIdentifier =
    readString(portfolio?.portfolio_index_identifier) ||
    (readString(portfolioRow.portfolio_index_uid)
      ? `${readString(portfolioRow.unique_identifier)}-index`
      : null);
  const rows = readArray<Record<string, unknown>>(portfolio?.weight_rows).map((row) => {
    const assetIdentifier =
      readString(row.asset_identifier) ||
      readString(row.unique_identifier) ||
      readString(row.asset_name) ||
      readString(row.asset_ticker);

    return {
      time_index: readString(row.time_index) || weightsDate,
      portfolio_index_identifier: portfolioIndexIdentifier,
      asset_identifier: assetIdentifier,
      weight:
        row.weight ??
        row.weight_notional_exposure ??
        row.position_value ??
        null,
      weight_before: row.weight_before ?? null,
      price_current: row.price_current ?? null,
      price_before: row.price_before ?? null,
      volume_current: row.volume_current ?? null,
      volume_before: row.volume_before ?? null,
      asset: {
        uid: readString(row.asset_uid) || readString(row.uid) || assetIdentifier,
        unique_identifier: assetIdentifier,
        current_snapshot: {
          name: readString(row.asset_name) || assetIdentifier,
          ticker: readString(row.asset_ticker),
        },
      },
    };
  });

  return {
    portfolio_uid: readString(portfolioRow.uid),
    portfolio_unique_identifier: readString(portfolioRow.unique_identifier),
    portfolio_index_uid: readString(portfolioRow.portfolio_index_uid),
    portfolio_index_identifier: portfolioIndexIdentifier,
    weights_date: rows.length > 0 ? weightsDate : null,
    resolution_warning:
      readString(portfolioRow.portfolio_index_uid) ? null : "Portfolio has no portfolio_index_uid; latest weights cannot be resolved.",
    weights: rows,
  };
}

function handleTargetPortfolios(route: string, method: string, searchParams: URLSearchParams) {
  if (route === "/api/v1/portfolio/" && method === "GET") {
    const filtered = state.targetPortfolios.map(buildPortfolioApiRow).filter((portfolio) =>
      matchesSearch(
        [
          portfolio.uid,
          portfolio.unique_identifier,
          portfolio.calendar_name,
          portfolio.portfolio_index_uid,
        ],
        searchParams.get("search"),
      ),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/api/v1/portfolio/bulk-delete/" && method === "POST") {
    return {
      detail: "Deleted 0 portfolios from mock state.",
      deleted_count: 0,
      failed: [],
    };
  }

  const detailMatch = route.match(/^\/api\/v1\/portfolio\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    const portfolioUid = detailMatch[1] ?? "";
    const portfolio = findByUid(state.targetPortfolios, portfolioUid) ?? { uid: portfolioUid };
    const portfolioRow = buildPortfolioApiRow(portfolio);
    return {
      portfolio: portfolioRow,
      metadata: {
        uid: `metadata-${portfolioUid}`,
        unique_identifier: readString(portfolioRow.unique_identifier),
        description: readString(portfolio.description),
      },
      tabs: [
        {
          key: "latest_weights",
          label: "Latest Weights",
          url: `/api/v1/portfolio/${portfolioUid}/weights/?order=desc&limit=1&include_asset_detail=true`,
        },
      ],
      links: {
        summary: `/api/v1/portfolio/${portfolioUid}/summary/`,
        latest_weights: `/api/v1/portfolio/${portfolioUid}/weights/`,
        delete: `/api/v1/portfolio/${portfolioUid}/`,
      },
    };
  }

  const summaryMatch = route.match(/^\/api\/v1\/portfolio\/([^/]+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const portfolioUid = summaryMatch[1] ?? "";
    const portfolio = findByUid(state.targetPortfolios, portfolioUid);
    return buildTargetPortfolioSummary(portfolio ?? { uid: portfolioUid, portfolio_name: `Portfolio ${portfolioUid}` });
  }

  const weightsMatch = route.match(/^\/api\/v1\/portfolio\/([^/]+)\/weights\/$/);
  if (weightsMatch && method === "GET") {
    const portfolio = findByUid(state.targetPortfolios, weightsMatch[1] ?? "");
    return buildPortfolioWeightsApiResponse(portfolio ?? undefined);
  }

  if (weightsMatch && method === "DELETE") {
    const portfolioUid = weightsMatch[1] ?? "";
    const portfolio = findByUid(state.targetPortfolios, portfolioUid);
    const snapshot = buildPortfolioWeightsApiResponse(portfolio ?? { uid: portfolioUid });
    const weightsDate = readString(searchParams.get("weights_date"));
    const currentRows = readArray<Record<string, unknown>>(portfolio?.weight_rows);
    const nextRows = weightsDate
      ? currentRows.filter((row) => {
          const rowDate = readString(row.time_index) || readString(portfolio?.weights_date);
          return rowDate !== weightsDate;
        })
      : [];

    if (portfolio) {
      portfolio.weight_rows = nextRows;
    }

    return {
      detail: "Portfolio weights deleted.",
      portfolio_uid: portfolioUid,
      portfolio_index_identifier: snapshot.portfolio_index_identifier,
      weights_date: weightsDate || null,
      deleted_count: currentRows.length - nextRows.length,
    };
  }

  const signalWeightsMatch = route.match(/^\/api\/v1\/portfolio\/([^/]+)\/signals_weights\/$/);
  if (signalWeightsMatch && method === "GET") {
    const portfolioUid = signalWeightsMatch[1] ?? "";
    const portfolio = findByUid(state.targetPortfolios, portfolioUid);
    const snapshot = buildPortfolioWeightsApiResponse(portfolio ?? { uid: portfolioUid });
    const rows = snapshot.weights.map((row, index) => ({
      time_index: row.time_index ?? snapshot.weights_date,
      portfolio_uid: portfolioUid,
      signal_uid: readString(portfolio?.signal_uid) ?? `mock-signal-${portfolioUid}`,
      asset_identifier: row.asset_identifier,
      weight: row.weight,
      rank: index + 1,
    }));

    return buildMockTabularFrameResponse(
      "Signal Weights",
      applyMockTabularFrameFilters(rows, searchParams),
    );
  }

  const portfolioValuesMatch = route.match(/^\/api\/v1\/portfolio\/([^/]+)\/portfolio_values\/$/);
  if (portfolioValuesMatch && method === "GET") {
    const portfolioUid = portfolioValuesMatch[1] ?? "";
    const portfolio = findByUid(state.targetPortfolios, portfolioUid);
    const portfolioRow = buildPortfolioApiRow(portfolio ?? { uid: portfolioUid });
    const weightsDate = readString(portfolio?.weights_date) ?? new Date().toISOString();
    const rows = [
      {
        time_index: weightsDate,
        portfolio_uid: portfolioUid,
        unique_identifier: portfolioRow.unique_identifier,
        portfolio_value: readNumber(portfolio?.portfolio_value) || 1_000_000,
        currency: readString(portfolio?.currency) ?? "USD",
      },
    ];

    return buildMockTabularFrameResponse(
      "Portfolio Values",
      applyMockTabularFrameFilters(rows, searchParams),
    );
  }

  return undefined;
}

function buildPortfolioSignalApiRow(signal: Record<string, unknown>) {
  const uid = readString(signal.uid) || `mock-portfolio-signal-${readString(signal.id)}`;
  const signalUid = readString(signal.signal_uid) || uid;

  return {
    ...signal,
    uid,
    signal_uid: signalUid,
    signal_description: readOptionalString(signal.signal_description),
  };
}

function deleteMockSignalWeightRows(signalUid: string, weightsDate: string | null) {
  let deletedCount = 0;

  state.targetPortfolios.forEach((portfolio) => {
    const portfolioSignalUid = readString(portfolio.signal_uid);
    const currentRows = readArray<Record<string, unknown>>(portfolio.weight_rows);
    const nextRows = currentRows.filter((row) => {
      const rowSignalUid = readString(row.signal_uid) || portfolioSignalUid;

      if (rowSignalUid !== signalUid) {
        return true;
      }

      const rowDate = readString(row.time_index);
      if (weightsDate && rowDate !== weightsDate) {
        return true;
      }

      deletedCount += 1;
      return false;
    });

    if (nextRows.length !== currentRows.length) {
      portfolio.weight_rows = nextRows;
    }
  });

  return deletedCount;
}

function handlePortfolioSignals(
  route: string,
  method: string,
  searchParams: URLSearchParams,
  init?: RequestInit,
) {
  if (route === "/api/v1/portfolio-signal/" && method === "GET") {
    const signalUidFilter = readOptionalString(searchParams.get("signal_uid"));
    const filtered = state.portfolioSignals.map(buildPortfolioSignalApiRow).filter((signal) => {
      if (signalUidFilter && signal.signal_uid !== signalUidFilter) {
        return false;
      }

      return matchesSearch(
        [signal.uid, signal.signal_uid, signal.signal_description],
        searchParams.get("search"),
      );
    });

    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/api/v1/portfolio-signal/" && method === "POST") {
    const body = parseBody(init);
    const signalUid = readString(body?.signal_uid).trim();
    const row = {
      id: nextId(state.portfolioSignals),
      uid: `signal-metadata-${Date.now()}`,
      signal_uid: signalUid || "mock-signal",
      signal_description: readString(body?.signal_description).trim(),
    };

    state.portfolioSignals.unshift(row);
    return buildPortfolioSignalApiRow(row);
  }

  const weightsMatch = route.match(/^\/api\/v1\/portfolio-signal\/([^/]+)\/weights\/$/);
  if (weightsMatch && method === "DELETE") {
    const signal = findByUid(state.portfolioSignals, weightsMatch[1] ?? "");
    if (!signal) {
      return undefined;
    }

    const row = buildPortfolioSignalApiRow(signal);
    const weightsDate = readOptionalString(searchParams.get("weights_date"));
    const deletedCount = deleteMockSignalWeightRows(row.signal_uid, weightsDate);

    return {
      detail: "Signal values deleted.",
      signal_metadata_uid: row.uid,
      signal_uid: row.signal_uid,
      weights_date: weightsDate,
      deleted_count: deletedCount,
    };
  }

  const detailMatch = route.match(/^\/api\/v1\/portfolio-signal\/([^/]+)\/$/);
  if (!detailMatch) {
    return undefined;
  }

  const signal = findByUid(state.portfolioSignals, detailMatch[1] ?? "");
  if (!signal) {
    return undefined;
  }

  if (method === "GET") {
    return buildPortfolioSignalApiRow(signal);
  }

  if (method === "PATCH") {
    const body = parseBody(init);
    signal.signal_description = readString(body?.signal_description).trim();
    return buildPortfolioSignalApiRow(signal);
  }

  if (method === "DELETE") {
    const row = buildPortfolioSignalApiRow(signal);
    const deletedWeightsCount = deleteMockSignalWeightRows(row.signal_uid, null);
    state.portfolioSignals = state.portfolioSignals.filter((entry) => readString(entry.uid) !== row.uid);

    return {
      detail: "Signal metadata deleted.",
      signal_metadata_uid: row.uid,
      signal_uid: row.signal_uid,
      deleted_count: 1,
      deleted_weights_count: deletedWeightsCount,
    };
  }

  return undefined;
}

function handleInstrumentsConfiguration(route: string, method: string, init?: RequestInit) {
  if (route === "/api/v1/instruments-configuration/current/" && method === "GET") {
    return state.instrumentsConfiguration;
  }

  if (route === "/api/v1/instruments-configuration/current/" && method === "PATCH") {
    Object.assign(state.instrumentsConfiguration, parseBody(init) ?? {});
    return state.instrumentsConfiguration;
  }

  return undefined;
}

function handleVirtualFunds(
  route: string,
  method: string,
  searchParams: URLSearchParams,
  init?: RequestInit,
) {
  const buildVirtualFundApiRow = (fund: Record<string, unknown>) => {
    const uid = readOptionalString(fund.uid) || `virtual-fund-${readString(fund.id)}`;
    const accountUid = readOptionalString(fund.account_uid ?? fund.account);
    const portfolioUid = readOptionalString(fund.target_portfolio_uid ?? fund.portfolio_uid);
    const uniqueIdentifier =
      readOptionalString(fund.unique_identifier) ||
      [accountUid, portfolioUid].filter(Boolean).join("__") ||
      uid;

    return {
      uid,
      unique_identifier: uniqueIdentifier,
      account_uid: accountUid,
      target_portfolio_uid: portfolioUid,
    };
  };

  const buildVirtualFundDetail = (fundUid: string) => {
    const fund = state.virtualFunds.find((row) => readOptionalString(row.uid) === fundUid) ?? {
      uid: fundUid,
    };
    const row = buildVirtualFundApiRow(fund);

    return {
      virtual_fund: row,
      tabs: [
        {
          key: "holdings",
          label: "Holdings",
          url: `/api/v1/virtualfund/${row.uid}/holdings/?order=desc&limit=1&include_asset_detail=true`,
        },
      ],
      links: {
        summary: `/api/v1/virtualfund/${row.uid}/summary/`,
        holdings: `/api/v1/virtualfund/${row.uid}/holdings/`,
        latest_holdings: `/api/v1/virtualfund/${row.uid}/holdings/`,
        account: row.account_uid ? `/api/v1/account/${row.account_uid}/summary/` : null,
        portfolio: row.target_portfolio_uid ? `/api/v1/portfolio/${row.target_portfolio_uid}/` : null,
      },
    };
  };

  const buildVirtualFundSummary = (fundUid: string) => {
    const detail = buildVirtualFundDetail(fundUid);
    const fund = detail.virtual_fund;

    return {
      entity: {
        id: fund.uid,
        type: "virtual_fund",
        title: fund.unique_identifier,
      },
      badges: [],
      inline_fields: [
        {
          key: "uid",
          label: "UID",
          value: fund.uid,
          kind: "code",
        },
        {
          key: "unique_identifier",
          label: "Identifier",
          value: fund.unique_identifier,
          kind: "code",
        },
        {
          key: "account_uid",
          label: "Account UID",
          value: fund.account_uid,
          kind: "code",
        },
        {
          key: "target_portfolio_uid",
          label: "Portfolio UID",
          value: fund.target_portfolio_uid,
          kind: "code",
        },
      ],
      highlight_fields: [],
      stats: [],
      label_management: {
        labels: [],
        add_label_url: null,
        remove_label_url: null,
      },
      summary_warning: null,
      extensions: {
        detail_url: `/api/v1/virtualfund/${fund.uid}/`,
        holdings_url: `/api/v1/virtualfund/${fund.uid}/holdings/`,
        latest_holdings_url: `/api/v1/virtualfund/${fund.uid}/holdings/`,
        account_summary_url: fund.account_uid ? `/api/v1/account/${fund.account_uid}/summary/` : null,
        portfolio_detail_url: fund.target_portfolio_uid ? `/api/v1/portfolio/${fund.target_portfolio_uid}/` : null,
      },
    };
  };

  const buildVirtualFundHoldings = (fundUid: string) => {
    const fund = buildVirtualFundDetail(fundUid).virtual_fund;
    const holdingsDate = "2026-06-08T10:30:00Z";
    const holdingsSetUid = `${fund.uid}-holdings-set`;
    const sourceHoldingsSetUid = `${fund.account_uid ?? "account"}-holdings-set`;
    const assetRows = state.assets.slice(0, 2);
    const holdings = assetRows.map((asset, index) => {
      const currentSnapshot =
        asset.current_snapshot && typeof asset.current_snapshot === "object"
          ? (asset.current_snapshot as Record<string, unknown>)
          : {};
      const uniqueIdentifier =
        readOptionalString(asset.unique_identifier) ||
        readOptionalString(asset.ticker) ||
        `mock-asset-${index + 1}`;
      const allocatedQuantity = index === 0 ? "5.0" : "2.0";
      const direction = index === 0 ? -1 : 1;

      return {
        time_index: holdingsDate,
        asset_identifier: uniqueIdentifier,
        virtual_fund_holdings_set_uid: holdingsSetUid,
        source_account_holdings_set_uid: sourceHoldingsSetUid,
        quantity: allocatedQuantity,
        direction,
        signed_quantity: String(Number(allocatedQuantity) * direction),
        target_trade_time: null,
        extra_details: {},
        asset: {
          uid: readOptionalString(asset.uid) || uniqueIdentifier,
          asset_identifier: uniqueIdentifier,
          current_snapshot: {
            name: readOptionalString(currentSnapshot.name) || readOptionalString(asset.name) || uniqueIdentifier,
            ticker: readOptionalString(currentSnapshot.ticker) || readOptionalString(asset.ticker),
          },
        },
      };
    });

    return {
      virtual_fund_uid: fund.uid,
      virtual_fund_unique_identifier: fund.unique_identifier,
      holdings_set_uid: holdings.length > 0 ? holdingsSetUid : null,
      source_account_holdings_set_uid: holdings.length > 0 ? sourceHoldingsSetUid : null,
      holdings_date: holdings.length > 0 ? holdingsDate : null,
      holdings,
    };
  };

  if (route === "/api/v1/virtualfund/" && method === "GET") {
    const accountUid = readOptionalString(searchParams.get("account_uid"));
    const portfolioUid = readOptionalString(searchParams.get("portfolio_uid"));
    const filtered = state.virtualFunds.map(buildVirtualFundApiRow).filter((fund) => {
      if (accountUid && fund.account_uid !== accountUid) {
        return false;
      }

      if (portfolioUid && fund.target_portfolio_uid !== portfolioUid) {
        return false;
      }

      return matchesSearch(
        [fund.uid, fund.unique_identifier, fund.account_uid, fund.target_portfolio_uid],
        searchParams.get("search"),
      );
    });
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/api/v1/virtualfund/" && method === "POST") {
    const body = parseBody(init);
    const record = {
      uid: readOptionalString(body?.uid) || `virtual-fund-${Date.now()}`,
      id: nextId(state.virtualFunds),
      unique_identifier:
        readOptionalString(body?.unique_identifier) ||
        `${readOptionalString(body?.account_uid ?? body?.related_account ?? body?.account) ?? "account"}__${readOptionalString(body?.target_portfolio_uid ?? body?.target_portfolio) ?? "portfolio"}`,
      target_portfolio_uid: readOptionalString(body?.target_portfolio_uid ?? body?.target_portfolio) || null,
      account_uid: readOptionalString(body?.account_uid ?? body?.related_account ?? body?.account) || null,
      ...((body as Record<string, unknown> | null) ?? {}),
    };
    state.virtualFunds.unshift(record);
    return buildVirtualFundApiRow(record);
  }

  const summaryMatch = route.match(/^\/api\/v1\/virtualfund\/([^/]+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    return buildVirtualFundSummary(decodeURIComponent(summaryMatch[1] ?? ""));
  }

  const holdingsMatch = route.match(/^\/api\/v1\/virtualfund\/([^/]+)\/holdings\/$/);
  if (holdingsMatch && method === "GET") {
    return buildVirtualFundHoldings(decodeURIComponent(holdingsMatch[1] ?? ""));
  }

  const detailMatch = route.match(/^\/api\/v1\/virtualfund\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    const fundUid = decodeURIComponent(detailMatch[1]);
    return buildVirtualFundDetail(fundUid);
  }

  if (detailMatch && method === "PATCH") {
    const fundUid = decodeURIComponent(detailMatch[1]);
    const record = state.virtualFunds.find((fund) => readOptionalString(fund.uid) === fundUid);
    Object.assign(record ?? {}, parseBody(init) ?? {});
    return record ? buildVirtualFundApiRow(record) : null;
  }

  return undefined;
}

function normalizeManagedAccountUid(value: unknown) {
  return readOptionalString(value);
}

function findManagedAccountByUid(accountUid: string) {
  return state.managedAccounts.find(
    (account) => normalizeManagedAccountUid(account.uid) === accountUid,
  );
}

function findAssetByUniqueIdentifier(uniqueIdentifier: string) {
  return state.assets.find(
    (asset) => readOptionalString(asset.unique_identifier) === uniqueIdentifier,
  );
}

function handleManagedAccounts(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/api/v1/account/" && method === "GET") {
    const filtered = state.managedAccounts.filter((account) =>
      matchesSearch(
        [
          account.uid,
          account.account_name,
          account.display_name,
          account.name,
          account.account_is_active,
        ],
        searchParams.get("search"),
      ),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/api/v1/account/target-allocation/targets/" && method === "GET") {
    const targetType = readOptionalString(searchParams.get("target_type")) ?? "all";
    const assetTargets = state.assets.map((asset) => {
      const currentSnapshot =
        asset.current_snapshot && typeof asset.current_snapshot === "object"
          ? (asset.current_snapshot as Record<string, unknown>)
          : null;
      const assetUid = readOptionalString(asset.uid) ?? readOptionalString(asset.unique_identifier) ?? "";
      const identifier = readOptionalString(asset.unique_identifier) ?? assetUid;
      const displayLabel =
        readOptionalString(currentSnapshot?.name) ??
        readOptionalString(asset.name) ??
        identifier;
      const secondaryLabel =
        readOptionalString(currentSnapshot?.ticker) ??
        readOptionalString(asset.ticker);

      return {
        target_type: "asset",
        target_uid: assetUid,
        asset_uid: assetUid,
        portfolio_uid: null,
        identifier,
        display_label: displayLabel,
        secondary_label: secondaryLabel,
        current_snapshot: currentSnapshot
          ? {
              name: readOptionalString(currentSnapshot.name) ?? displayLabel,
              ticker: readOptionalString(currentSnapshot.ticker) ?? secondaryLabel,
            }
          : null,
        metadata: {
          asset_type:
            readOptionalString(asset.asset_type) ??
            readOptionalString(asset.security_type) ??
            null,
        },
      };
    });
    const portfolioTargets = state.targetPortfolios.map((portfolio) => {
      const portfolioUid = readOptionalString(portfolio.uid) ?? readOptionalString(portfolio.unique_identifier) ?? "";
      const identifier = readOptionalString(portfolio.unique_identifier) ?? portfolioUid;

      return {
        target_type: "portfolio",
        target_uid: portfolioUid,
        asset_uid: null,
        portfolio_uid: portfolioUid,
        identifier,
        display_label:
          readOptionalString(portfolio.display_name) ??
          readOptionalString(portfolio.portfolio_name) ??
          identifier,
        secondary_label: null,
        current_snapshot: null,
        metadata: {
          portfolio_index_uid: readOptionalString(portfolio.portfolio_index_uid),
        },
      };
    });
    const targets = [
      ...(targetType === "all" || targetType === "asset" ? assetTargets : []),
      ...(targetType === "all" || targetType === "portfolio" ? portfolioTargets : []),
    ].filter((target) =>
      matchesSearch(
        [
          target.target_type,
          target.target_uid,
          target.asset_uid,
          target.portfolio_uid,
          target.identifier,
          target.display_label,
          target.secondary_label,
        ],
        searchParams.get("search"),
      ),
    );

    return paginate(targets, searchParams.get("limit"), searchParams.get("offset"));
  }

  const detailMatch = route.match(/^\/api\/v1\/account\/([^/]+)\/$/);

  if (detailMatch && method === "GET") {
    return findManagedAccountByUid(decodeURIComponent(detailMatch[1]));
  }

  if (detailMatch && method === "DELETE") {
    const accountUid = decodeURIComponent(detailMatch[1]);
    state.managedAccounts = state.managedAccounts.filter(
      (account) => normalizeManagedAccountUid(account.uid) !== accountUid,
    );
    return {
      detail: "Managed account removed from mock state.",
      deleted_count: 1,
    };
  }

  const summaryMatch = route.match(/^\/api\/v1\/account\/([^/]+)\/summary\/$/);

  if (summaryMatch && method === "GET") {
    const accountUid = decodeURIComponent(summaryMatch[1]);
    const account = findManagedAccountByUid(accountUid);

    if (!account) {
      return undefined;
    }

    return {
      entity: {
        id: 0,
        type: "managed_account",
        title:
          readString(account.display_name) ||
          readString(account.account_name) ||
          readString(account.name) ||
          "Managed account",
      },
      badges: [
        {
          key: "account-type",
          label: "Managed Account",
          tone: "neutral",
        },
        ...(typeof account.account_is_active === "boolean"
          ? [
              {
                key: "account-status",
                label: readBoolean(account.account_is_active) ? "Active" : "Inactive",
                tone: readBoolean(account.account_is_active) ? "success" : "warning",
              },
            ]
          : []),
      ],
      inline_fields: [
        ...(readString(account.creation_date)
          ? [
              {
                key: "creation_date",
                label: "Created",
                value: readString(account.creation_date),
                kind: "text",
              },
            ]
          : []),
      ],
      highlight_fields: [
        {
          key: "holdings_data_source_name",
          label: "Holdings Data Source",
          value: readString(account.holdings_data_source_name) || "Not available",
          kind: "text",
        },
        {
          key: "valuation_translation_table_name",
          label: "Translation Table",
          value: readString(account.valuation_translation_table_name) || "Not available",
          kind: "text",
        },
      ],
      stats: [
        {
          key: "is_paper",
          label: "Paper",
          display: readBoolean(account.is_paper) ? "Yes" : "No",
          value: readBoolean(account.is_paper),
          kind: "text",
        },
      ],
      extensions: {},
    };
  }

  const holdingsByFundMatch = route.match(/^\/api\/v1\/account\/([^/]+)\/holdings\/by-fund\/$/);

  if (holdingsByFundMatch && method === "GET") {
    const accountUid = decodeURIComponent(holdingsByFundMatch[1]);
    const account = findManagedAccountByUid(accountUid);
    const holdingsDate = searchParams.get("holdings_date") || "2026-05-18T09:30:00Z";
    const sourceHoldingsSetUid = `mock-holdings-set-${accountUid}`;
    const relatedFunds = state.virtualFunds.filter(
      (fund) => readOptionalString(fund.account_uid) === accountUid,
    );
    const fallbackFunds =
      relatedFunds.length > 0
        ? relatedFunds
        : state.virtualFunds.slice(0, account ? 1 : 0);
    const assetRows = state.assets.slice(0, Math.max(fallbackFunds.length, 1));

    if (!account) {
      return {
        account_uid: accountUid,
        source_account_holdings_set_uid: null,
        holdings_date: null,
        funds: [],
        residuals: [],
        allocation_warnings: [],
      };
    }

    return {
      account_uid: accountUid,
      source_account_holdings_set_uid: sourceHoldingsSetUid,
      holdings_date: holdingsDate,
      funds: fallbackFunds.map((fund, index) => {
        const asset = assetRows.length > 0 ? assetRows[index % assetRows.length] : undefined;
        const currentSnapshot =
          asset?.current_snapshot && typeof asset.current_snapshot === "object"
            ? (asset.current_snapshot as Record<string, unknown>)
            : {};
        const assetIdentifier =
          readOptionalString(asset?.unique_identifier) ||
          readOptionalString(asset?.ticker) ||
          `mock-asset-${index + 1}`;
        const holdingsSetUid = `mock-fund-holdings-${readOptionalString(fund.uid) || index + 1}`;

        return {
          virtual_fund_uid: readOptionalString(fund.uid) || `mock-fund-${index + 1}`,
          virtual_fund_unique_identifier:
            readOptionalString(fund.unique_identifier) || `mock-fund-${index + 1}`,
          target_portfolio_uid: readOptionalString(fund.target_portfolio_uid),
          holdings_set_uid: holdingsSetUid,
          holdings: [
            {
              time_index: holdingsDate,
              asset_identifier: assetIdentifier,
              asset: {
                uid: readOptionalString(asset?.uid) || assetIdentifier,
                asset_identifier: assetIdentifier,
                current_snapshot: {
                  name:
                    readOptionalString(currentSnapshot.name) ||
                    readOptionalString(asset?.name) ||
                    assetIdentifier,
                  ticker: readOptionalString(currentSnapshot.ticker) || readOptionalString(asset?.ticker),
                },
              },
              quantity: String(10 + index),
              direction: 1,
              signed_quantity: String(10 + index),
              target_trade_time: null,
              extra_details: {
                position_set_uid: `mock-target-position-set-${accountUid}`,
                target_row_key: `mock-row-${index + 1}`,
                target_gap_signed_quantity: "0.0",
                scale: "1.0",
              },
              allocation: {
                position_set_uid: `mock-target-position-set-${accountUid}`,
                target_row_key: `mock-row-${index + 1}`,
                target_gap_signed_quantity: "0.0",
                scale: "1.0",
              },
            },
          ],
        };
      }),
      residuals: [],
      allocation_warnings: [],
    };
  }

  const holdingsMatch = route.match(/^\/api\/v1\/account\/([^/]+)\/holdings\/$/);

  if (holdingsMatch && method === "GET") {
    const accountUid = decodeURIComponent(holdingsMatch[1]);
    const account = findManagedAccountByUid(accountUid);

    if (!account) {
      return {
        holdings_set_uid: null,
        holdings_date: null,
        holdings: [],
      };
    }

    const holdingsDate = searchParams.get("holdings_date") || "2026-05-18T09:30:00Z";
    const asset = state.assets[0];
    const currentSnapshot =
      asset?.current_snapshot && typeof asset.current_snapshot === "object"
        ? (asset.current_snapshot as Record<string, unknown>)
        : {};
    const assetIdentifier =
      readOptionalString(asset?.unique_identifier) ||
      readOptionalString(asset?.ticker) ||
      "btc_spot";

    return {
      holdings_set_uid: `mock-holdings-set-${accountUid}`,
      holdings_date: holdingsDate,
      holdings: [
        {
          time_index: holdingsDate,
          asset_identifier: assetIdentifier,
          asset: {
            uid: readOptionalString(asset?.uid) || assetIdentifier,
            asset_identifier: assetIdentifier,
            current_snapshot: {
              name: readOptionalString(currentSnapshot.name) || readOptionalString(asset?.name) || assetIdentifier,
              ticker: readOptionalString(currentSnapshot.ticker) || readOptionalString(asset?.ticker),
            },
          },
          quantity: "12.00000000",
          direction: 1,
          signed_quantity: "12.00000000",
          target_trade_time: holdingsDate,
          extra_details: {},
          position_type: "units",
          price: null,
          missing_price: true,
        },
      ],
    };
  }

  const addHoldingsMatch = route.match(/^\/api\/v1\/account\/([^/]+)\/add-holdings\/$/);

  if (addHoldingsMatch && method === "POST") {
    const accountUid = decodeURIComponent(addHoldingsMatch[1]);
    const account = findManagedAccountByUid(accountUid);
    const body = parseBody(init) ?? {};
    const positions = readArray<Record<string, unknown>>(body.positions);

    if (!account) {
      return {};
    }

    const holdingsDate = readString(body.holdings_date) || new Date().toISOString();

    return {
      holdings_date: holdingsDate,
      holdings_set_uid: `mock-holdings-set-${accountUid}`,
      holdings: positions.map((position) => {
        const assetIdentifier =
          readString(position.asset_identifier) ||
          readString(position.unique_identifier) ||
          null;
        const assetUid = readString(position.asset_uid) || null;
        const asset = assetUid
          ? state.assets.find((candidate) => readString(candidate.uid) === assetUid) ?? null
          : assetIdentifier
            ? findAssetByUniqueIdentifier(assetIdentifier)
            : null;
        const currentSnapshot =
          asset?.current_snapshot && typeof asset.current_snapshot === "object"
            ? (asset.current_snapshot as Record<string, unknown>)
            : {};
        const quantity = readString(position.quantity) || "0";
        const direction = readNumber(position.direction) < 0 ? -1 : 1;

        return {
          time_index: holdingsDate,
          asset_identifier: assetIdentifier,
          asset: asset
            ? {
                uid: readString(asset.uid) || assetUid,
                asset_identifier:
                  readString(asset.unique_identifier) || assetIdentifier,
                current_snapshot: {
                  name: readString(currentSnapshot.name) || readString(asset.name) || assetIdentifier,
                  ticker: readString(currentSnapshot.ticker) || readString(asset.ticker),
                },
              }
            : null,
          quantity,
          direction,
          signed_quantity: String(Number(quantity) * direction),
          target_trade_time: readString(position.target_trade_time) || null,
          extra_details:
            isRecord(position.extra_details) ? position.extra_details : {},
          position_type: readString(position.position_type) || "units",
          price: null,
          missing_price: true,
        };
      }),
    };
  }

  const addTargetPositionsMatch = route.match(
    /^\/api\/v1\/account\/([^/]+)\/add-target-positions\/$/,
  );

  const targetPositionsMatch = route.match(
    /^\/api\/v1\/account\/([^/]+)\/target-positions\/$/,
  );

  if (targetPositionsMatch && method === "GET") {
    const accountUid = decodeURIComponent(targetPositionsMatch[1]);
    const account = findManagedAccountByUid(accountUid);

    if (!account) {
      return [];
    }

    const targetPositions = state.managedAccountTargetPositionsByAccountUid[accountUid];
    if (!isRecord(targetPositions)) {
      return [];
    }

    const requestedDate = searchParams.get("target_positions_date");
    const storedDate = readOptionalString(targetPositions.target_positions_date);
    if (requestedDate && storedDate !== requestedDate) {
      return [];
    }

    const includeAssetDetail = searchParams.get("include_asset_detail") === "true";
    const positions = readArray<Record<string, unknown>>(targetPositions.positions).map((position) => {
      if (!includeAssetDetail) {
        return position;
      }

      const uniqueIdentifier = readOptionalString(position.unique_identifier);
      const assetUid = readOptionalString(position.asset_uid);
      const asset = assetUid
        ? state.assets.find((candidate) => readString(candidate.uid) === assetUid) ?? null
        : uniqueIdentifier
          ? findAssetByUniqueIdentifier(uniqueIdentifier)
          : null;
      return {
        ...position,
        asset: asset ? cloneValue(asset) : null,
      };
    });

    return [
      {
        ...cloneValue(targetPositions),
        positions,
      },
    ];
  }

  if (addTargetPositionsMatch && method === "POST") {
    const accountUid = decodeURIComponent(addTargetPositionsMatch[1]);
    const account = findManagedAccountByUid(accountUid);
    const body = parseBody(init) ?? {};
    const positions = readArray<Record<string, unknown>>(body.positions);

    if (!account) {
      return {};
    }

    const targetPositions = {
      related_account_uid: accountUid,
      target_positions_date: readString(body.target_positions_date) || new Date().toISOString(),
      position_set_uid: `mock-target-positions-set-${accountUid}-${Date.now()}`,
      positions: positions.map((position) => ({
        target_type: readString(position.target_type) || "asset",
        target_uid:
          readString(position.target_uid) ||
          readString(position.asset_uid) ||
          readString(position.portfolio_uid) ||
          null,
        asset_uid: readString(position.asset_uid) || null,
        portfolio_uid: readString(position.portfolio_uid) || null,
        unique_identifier: readString(position.unique_identifier) || null,
        weight_notional_exposure:
          readString(position.weight_notional_exposure) || null,
        constant_notional_exposure:
          readString(position.constant_notional_exposure) || null,
        single_asset_quantity:
          readString(position.single_asset_quantity) || null,
      })),
    };

    state.managedAccountTargetPositionsByAccountUid[accountUid] = cloneValue(targetPositions);

    return targetPositions;
  }

  return undefined;
}

function handleProjectDataSources(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/orm/api/ts_manager/dynamic_table_data_source/" && method === "GET") {
    if (searchParams.get("response_format") === "project_data_sources_list") {
      const filtered = state.projectDataSources.filter((source) =>
        matchesSearch([source.id, source.display_name], searchParams.get("search")),
      );
      return frontendRowsResponse(filtered, searchParams.get("search"), searchParams.get("page"), searchParams.get("page_size"));
    }

    const options = state.projectDataSources.map((source) => ({
      id: readString(source.uid),
      uid: readString(source.uid),
      related_resource: source.related_resource
        ? {
            id: readString((source.related_resource as Record<string, unknown>).uid),
            uid: readString((source.related_resource as Record<string, unknown>).uid),
            display_name: readString((source.related_resource as Record<string, unknown>).label),
            name: readString((source.related_resource as Record<string, unknown>).label),
            organization: 1,
            class_type: readString((source.related_resource as Record<string, unknown>).class_type),
            status: readString((source.related_resource as Record<string, unknown>).status),
            source_logo: readString((source.related_resource as Record<string, unknown>).source_logo),
          }
        : null,
      related_resource_class_type: readString(
        (source.related_resource as Record<string, unknown> | null)?.class_type,
      ),
    }));

    return paginate(options, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/orm/api/ts_manager/dynamic_table_data_source/editor-config/" && method === "GET") {
    return {
      mode: "create",
      entity: null,
      fields: [
        {
          key: "display_name",
          label: "Display name",
          editor: "text",
          required: true,
          value: "",
        },
        {
          key: "related_resource_uid",
          label: "Related resource",
          editor: "remote_select",
          required: true,
          value: null,
          choices_path: "/orm/api/ts_manager/dynamic_table_data_source/related-resource-options/",
        },
        {
          key: "is_default_data_source",
          label: "Default",
          editor: "checkbox",
          required: false,
          value: false,
        },
      ],
      actions: {
        submit: {
          method: "POST",
          path: "/orm/api/ts_manager/dynamic_table_data_source/",
        },
        cancel_path: "/app/main-sequence-foundry/project-data-sources",
      },
    };
  }

  if (route === "/orm/api/ts_manager/dynamic_table_data_source/related-resource-options/" && method === "GET") {
    return state.physicalDataSources.map((source) => ({
      id: readString(source.uid),
      uid: readString(source.uid),
      label: readString(source.display_name),
      class_type: readString(source.class_type),
      status: readString(source.status),
      source_logo: readString(source.source_logo),
    }));
  }

  if (route === "/orm/api/ts_manager/dynamic_table_data_source/" && method === "POST") {
    const body = parseBody(init);
    const id = nextId(state.projectDataSources);
    const record = {
      id,
      uid: `mock-project-data-source-${id}`,
      display_name: readString(body?.display_name) || "New Project Data Source",
      is_default_data_source: readBoolean(body?.is_default_data_source),
      related_resource: state.physicalDataSources.find(
        (source) => readString(source.uid) === readString(body?.related_resource_uid),
      ) ?? null,
      creation_date: new Date().toISOString(),
      creation_date_display: "Just now",
    };
    state.projectDataSources.unshift(record);
    return {
      detail: "Project data source created.",
      id: readNumber(record.id),
      uid: readString(record.uid),
      display_name: readString(record.display_name),
      redirect_path: `/app/main-sequence-foundry/project-data-sources?msProjectDataSourceUid=${record.uid}&msProjectDataSourceView=edit`,
    };
  }

  if (route === "/orm/api/ts_manager/dynamic_table_data_source/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.selected_uids));
    const before = state.projectDataSources.length;
    state.projectDataSources = state.projectDataSources.filter((item) => !uids.has(readString(item.uid)));
    return {
      detail: "Project data sources removed from mock state.",
      deleted_count: before - state.projectDataSources.length,
    };
  }

  const editMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table_data_source\/([^/]+)\/$/);
  if (editMatch && method === "GET" && searchParams.get("response_format") === "editor") {
    const record = findByUid(state.projectDataSources, editMatch[1] ?? "");
    return {
      mode: "edit",
      entity: {
        id: readNumber(record?.id),
        uid: readString(record?.uid),
        type: "project_data_source",
        title: readString(record?.display_name),
      },
      fields: [
        {
          key: "display_name",
          label: "Display name",
          editor: "text",
          required: true,
          value: readString(record?.display_name),
        },
        {
          key: "related_resource_uid",
          label: "Related resource",
          editor: "remote_select",
          required: true,
          value: readString((record?.related_resource as Record<string, unknown> | null)?.uid) || null,
          display_value: readString((record?.related_resource as Record<string, unknown> | null)?.label),
          choices_path: "/orm/api/ts_manager/dynamic_table_data_source/related-resource-options/",
        },
        {
          key: "is_default_data_source",
          label: "Default",
          editor: "checkbox",
          required: false,
          value: readBoolean(record?.is_default_data_source),
        },
      ],
      actions: {
        submit: {
          method: "PATCH",
          path: `/orm/api/ts_manager/dynamic_table_data_source/${editMatch[1]}/`,
        },
        cancel_path: "/app/main-sequence-foundry/project-data-sources",
        delete: {
          method: "POST",
          path: `/orm/api/ts_manager/dynamic_table_data_source/${editMatch[1]}/delete/`,
          redirect_path: "/app/main-sequence-foundry/project-data-sources",
        },
      },
    };
  }

  if (editMatch && method === "PATCH") {
    const record = findByUid(state.projectDataSources, editMatch[1] ?? "");
    const body = parseBody(init);
    if (record) {
      record.display_name = readString(body?.display_name) || record.display_name;
      record.is_default_data_source = readBoolean(body?.is_default_data_source);
      record.related_resource =
        state.physicalDataSources.find((source) => readString(source.uid) === readString(body?.related_resource_uid)) ??
        record.related_resource;
    }

    return {
      detail: "Project data source updated.",
      id: readNumber(record?.id),
      uid: readString(record?.uid),
      display_name: readString(record?.display_name),
      redirect_path: `/app/main-sequence-foundry/project-data-sources?msProjectDataSourceUid=${editMatch[1]}&msProjectDataSourceView=edit`,
    };
  }

  const deleteMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table_data_source\/([^/]+)\/delete\/$/);
  if (deleteMatch && method === "POST") {
    const uid = deleteMatch[1] ?? "";
    state.projectDataSources = state.projectDataSources.filter((item) => readString(item.uid) !== uid);
    return {
      detail: "Project data source deleted.",
      uid,
      redirect_path: "/app/main-sequence-foundry/project-data-sources",
    };
  }

  return undefined;
}

function handlePhysicalDataSources(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/data_source/" && method === "GET") {
    const responseFormat = searchParams.get("response_format");

    if (responseFormat === "physical_data_sources_list") {
      const filtered = state.physicalDataSources.filter((source) => {
        const classType = searchParams.get("class_type");

        if (classType && readString(source.class_type) !== classType) {
          return false;
        }

        return matchesSearch(
          [source.id, source.display_name, source.class_type_label, source.status_label],
          searchParams.get("search"),
        );
      });
      return frontendRowsResponse(filtered, searchParams.get("search"), searchParams.get("page"), searchParams.get("page_size"));
    }
  }

  if (route === "/data_source/editor-config/" && method === "GET") {
    const sourceType = searchParams.get("source_type") ?? "duck_db";
    return {
      mode: "create",
      entity: null,
      fields: [
        {
          key: "display_name",
          label: "Display name",
          editor: "text",
          required: true,
          value: "",
        },
        {
          key: "source_type",
          label: "Source type",
          editor: "text",
          required: true,
          value: sourceType,
        },
        {
          key: "storage_access_mode",
          label: "Storage access",
          editor: "select",
          required: false,
          value: "read_write",
          options: [
            { value: "read_write", label: "Read/write" },
            { value: "read_only", label: "Read-only" },
            { value: "disabled", label: "Disabled" },
          ],
        },
      ],
      actions: {
        submit: {
          method: "POST",
          path: "/data_source/",
        },
        cancel_path: "/app/main-sequence-foundry/physical-data-sources",
      },
    };
  }

  if (route === "/data_source/" && method === "POST") {
    const body = parseBody(init);
    const id = nextId(state.physicalDataSources);
    const record = {
      id,
      uid: `mock-physical-data-source-${id}`,
      display_name: readString(body?.display_name) || "New Physical Data Source",
      source_logo: "database",
      class_type: readString(body?.source_type) || "duck_db",
      class_type_label: readString(body?.source_type) || "duck_db",
      status: "healthy",
      status_label: "Healthy",
      status_tone: "success",
      storage_access_mode: readString(body?.storage_access_mode) || "read_write",
      creation_date: new Date().toISOString(),
      creation_date_display: "Just now",
    };
    state.physicalDataSources.unshift(record);
    return {
      detail: "Physical data source created.",
      id: readNumber(record.id),
      uid: readString(record.uid),
      display_name: readString(record.display_name),
      redirect_path: `/app/main-sequence-foundry/physical-data-sources?msPhysicalDataSourceUid=${record.uid}&msPhysicalDataSourceView=edit`,
    };
  }

  if (route === "/data_source/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const before = state.physicalDataSources.length;
    state.physicalDataSources = state.physicalDataSources.filter((source) => !uids.has(readString(source.uid)));
    return {
      detail: "Physical data sources removed from mock state.",
      deleted_count: before - state.physicalDataSources.length,
    };
  }

  const connectionsMatch = route.match(/^\/data_source\/([^/]+)\/connections\/$/);
  if (connectionsMatch && method === "GET") {
    const uid = connectionsMatch[1] ?? "";
    const record = findByUid(state.physicalDataSources, uid);

    if (!record) {
      return [];
    }

    return [
      {
        uid: `${uid}__connection`,
        display_name: `${readString(record.display_name) || "Physical data source"} connection`,
        type_id: readString(record.class_type) || "database",
        status: readString(record.status) || "healthy",
        status_label: readString(record.status_label) || "Healthy",
        status_tone: readString(record.status_tone) || "success",
        creation_date: readString(record.creation_date) || null,
        creation_date_display: readString(record.creation_date_display) || null,
      },
    ];
  }

  const editMatch = route.match(/^\/data_source\/([^/]+)\/$/);
  if (editMatch && method === "GET" && searchParams.get("response_format") === "editor") {
    const record = findByUid(state.physicalDataSources, editMatch[1] ?? "");
    return {
      mode: "edit",
      entity: {
        id: readNumber(record?.id),
        uid: readString(record?.uid),
        type: "physical_data_source",
        title: readString(record?.display_name),
      },
      fields: [
        {
          key: "display_name",
          label: "Display name",
          editor: "text",
          required: true,
          value: readString(record?.display_name),
        },
        {
          key: "storage_access_mode",
          label: "Storage access",
          editor: "select",
          required: false,
          value: readString(record?.storage_access_mode) || "read_write",
          options: [
            { value: "read_write", label: "Read/write" },
            { value: "read_only", label: "Read-only" },
            { value: "disabled", label: "Disabled" },
          ],
        },
      ],
      actions: {
        submit: {
          method: "PATCH",
          path: `/data_source/${editMatch[1]}/`,
        },
        cancel_path: "/app/main-sequence-foundry/physical-data-sources",
        delete: {
          method: "POST",
          path: `/data_source/${editMatch[1]}/delete/`,
          redirect_path: "/app/main-sequence-foundry/physical-data-sources",
        },
      },
    };
  }

  if (editMatch && method === "PATCH") {
    const record = findByUid(state.physicalDataSources, editMatch[1] ?? "");
    Object.assign(record ?? {}, parseBody(init) ?? {});
    return {
      detail: "Physical data source updated.",
      id: readNumber(record?.id),
      uid: readString(record?.uid),
      display_name: readString(record?.display_name),
      redirect_path: `/app/main-sequence-foundry/physical-data-sources?msPhysicalDataSourceUid=${editMatch[1]}&msPhysicalDataSourceView=edit`,
    };
  }

  const deleteMatch = route.match(/^\/data_source\/([^/]+)\/delete\/$/);
  if (deleteMatch && method === "POST") {
    const uid = deleteMatch[1] ?? "";
    state.physicalDataSources = state.physicalDataSources.filter((source) => readString(source.uid) !== uid);
    return {
      detail: "Physical data source deleted.",
      uid,
      redirect_path: "/app/main-sequence-foundry/physical-data-sources",
    };
  }

  return undefined;
}

function handleClusters(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/cluster/" && method === "GET" && searchParams.get("response_format") === "clusters_list") {
    return buildClusterList(searchParams);
  }

  const summaryMatch = route.match(/^\/cluster\/([^/]+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const clusterUid = summaryMatch[1] ?? "";
    const cluster =
      state.clusters.find(
        (candidate) =>
          (readString(candidate.uid) || readString(candidate.uuid)) === clusterUid,
      ) ?? null;
    return buildClusterSummary(cluster ?? { uid: clusterUid, cluster_name: `Cluster ${clusterUid}` }, searchParams);
  }

  const detailMatch = route.match(/^\/cluster\/([^/]+)\/$/);
  if (detailMatch && method === "GET" && searchParams.get("response_format") === "cluster_detail") {
    const clusterUid = detailMatch[1] ?? "";
    const cluster =
      state.clusters.find(
        (candidate) =>
          (readString(candidate.uid) || readString(candidate.uuid)) === clusterUid,
      ) ?? null;
    return buildClusterSummary(cluster ?? { uid: clusterUid, cluster_name: `Cluster ${clusterUid}` }, searchParams);
  }

  const scaleMatch = route.match(/^\/cluster\/([^/]+)\/scale\/$/);
  if (scaleMatch && method === "POST") {
    const body = parseBody(init);
    return {
      detail: `Cluster ${scaleMatch[1]} scale accepted.`,
      message: `Desired node count set to ${readNumber(body?.desired_node_count)} in mock mode.`,
    };
  }

  const podLogsMatch = route.match(/^\/cluster\/([^/]+)\/pod-logs\/$/);
  if (podLogsMatch && method === "GET") {
    const clusterUid = podLogsMatch[1] ?? "";
    const namespace = searchParams.get("namespace") ?? "";
    const pod = searchParams.get("pod") ?? "";
    const tailLines = Number(searchParams.get("tail_lines") ?? 500);

    return {
      cluster_uid: clusterUid,
      namespace,
      pod,
      container: searchParams.get("container"),
      tail_lines: Number.isFinite(tailLines) ? tailLines : 500,
      since_seconds: searchParams.get("since_seconds")
        ? Number(searchParams.get("since_seconds"))
        : null,
      previous: searchParams.get("previous") === "true",
      timestamps: searchParams.get("timestamps") !== "false",
      logs: [
        `${new Date().toISOString()} Mock pod log stream for ${namespace}/${pod}.`,
        `${new Date().toISOString()} Request reached the cluster pod logs endpoint.`,
      ].join("\n"),
    };
  }

  const clusterTabMatch = route.match(/^\/cluster\/([^/]+)\/(node-pools|nodes|namespaces|pods|deployments|services|storage|knative)\/$/);
  if (clusterTabMatch && method === "GET") {
    const cluster =
      state.clusters.find(
        (candidate) =>
          (readString(candidate.uid) || readString(candidate.uuid)) === (clusterTabMatch[1] ?? ""),
      ) ?? null;
    const key = (clusterTabMatch[2] ?? "").replace(/-/g, "_");
    const rows = readArray(cluster?.[key]);

    if (key === "nodes" && searchParams.get("node_pool")) {
      return rows.filter((row) => readString((row as Record<string, unknown>).node_pool) === searchParams.get("node_pool"));
    }

    if (key === "pods") {
      return rows.filter((row) => {
        const record = row as Record<string, unknown>;
        const namespace = searchParams.get("namespace");
        const nodePool = searchParams.get("node_pool");
        if (namespace && readString(record.namespace) !== namespace) {
          return false;
        }
        if (nodePool && readString(record.node_pool) !== nodePool) {
          return false;
        }
        return true;
      });
    }

    if (["deployments", "services", "storage", "knative"].includes(key) && searchParams.get("namespace")) {
      return rows.filter((row) => readString((row as Record<string, unknown>).namespace) === searchParams.get("namespace"));
    }

    return rows;
  }

  return undefined;
}

function handleConstants(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/constant/" && method === "GET") {
    return paginate(sortDescendingById(state.constants), searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/constant/" && method === "POST") {
    const body = parseBody(init);
    const id = nextId(state.constants);
    const record = {
      id,
      uid: `mock-constant-${id}`,
      name: readString(body?.name) || "NEW_CONSTANT",
      value: body?.value ?? "",
      category: null,
    };
    state.constants.unshift(record);
    return record;
  }

  if (route === "/constant/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const before = state.constants.length;
    state.constants = state.constants.filter((item) => !uids.has(readString(item.uid)));
    return {
      deleted_count: before - state.constants.length,
    };
  }

  const detailMatch = route.match(/^\/constant\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    return findByUid(state.constants, detailMatch[1] ?? "");
  }

  if (detailMatch && method === "DELETE") {
    const uid = detailMatch[1] ?? "";
    state.constants = state.constants.filter((item) => readString(item.uid) !== uid);
    return null;
  }

  return undefined;
}

function handleSecrets(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/secret/" && method === "GET") {
    return paginate(sortDescendingById(state.secrets), searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/secret/" && method === "POST") {
    const body = parseBody(init);
    const id = nextId(state.secrets);
    const record = {
      id,
      uid: `mock-secret-${id}`,
      name: readString(body?.name) || "NEW_SECRET",
      value: readString(body?.value) || "********",
    };
    state.secrets.unshift(record);
    return {
      name: readString(record.name),
    };
  }

  const detailMatch = route.match(/^\/secret\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    return findByUid(state.secrets, detailMatch[1] ?? "");
  }

  if (detailMatch && method === "DELETE") {
    const uid = detailMatch[1] ?? "";
    state.secrets = state.secrets.filter((item) => readString(item.uid) !== uid);
    return null;
  }

  return undefined;
}

function handleBuckets(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/bucket/" && method === "GET") {
    const filtered = state.buckets.filter((bucket) =>
      matchesSearch([bucket.id, bucket.name], searchParams.get("search") ?? searchParams.get("name")),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/bucket/" && method === "POST") {
    const body = parseBody(init);
    const id = nextId(state.buckets);
    const record = {
      id,
      uid: `mock-bucket-${id}`,
      name: readString(body?.name) || `mock-bucket-${Date.now()}`,
    };
    state.buckets.unshift(record);
    return record;
  }

  if (route === "/bucket/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const deletedBucketIds = new Set(
      state.buckets
        .filter((bucket) => uids.has(readString(bucket.uid)))
        .map((bucket) => readNumber(bucket.id)),
    );
    const before = state.buckets.length;
    state.buckets = state.buckets.filter((bucket) => !uids.has(readString(bucket.uid)));
    state.bucketObjects = state.bucketObjects.filter((entry) => !deletedBucketIds.has(readNumber(entry.bucket_id)));
    return {
      detail: "Buckets removed from mock state.",
      deleted_count: before - state.buckets.length,
    };
  }

  const detailMatch = route.match(/^\/bucket\/([^/]+)\/$/);
  if (detailMatch && method === "DELETE") {
    const uid = detailMatch[1] ?? "";
    const bucket = findByUid(state.buckets, uid);
    const bucketId = readNumber(bucket?.id);
    state.buckets = state.buckets.filter((item) => readString(item.uid) !== uid);
    state.bucketObjects = state.bucketObjects.filter((entry) => readNumber(entry.bucket_id) !== bucketId);
    return null;
  }

  const summaryMatch = route.match(/^\/bucket\/([^/]+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const bucketUid = summaryMatch[1] ?? "";
    const bucket = findByUid(state.buckets, bucketUid);
    return buildBucketSummary(bucket ?? { uid: bucketUid, name: `Bucket ${bucketUid}` });
  }

  const browseMatch = route.match(/^\/bucket\/([^/]+)\/browse\/$/);
  if (browseMatch && method === "GET") {
    return buildBucketBrowse(browseMatch[1] ?? "", searchParams);
  }

  const createFolderMatch = route.match(/^\/bucket\/([^/]+)\/create-folder\/$/);
  if (createFolderMatch && method === "POST") {
    const bucketUid = createFolderMatch[1] ?? "";
    const bucket = findByUid(state.buckets, bucketUid);
    const bucketId = readNumber(bucket?.id);
    const body = parseBody(init);
    const prefix = readString(body?.prefix);
    const name = readString(body?.name) || "folder";
    const entry = {
      id: Date.now(),
      bucket_id: bucketId,
      kind: "folder",
      name,
      prefix: prefix ? `${prefix.replace(/\/+$/, "")}/${name}` : name,
      count_files: 0,
      count_subfolders: 0,
    };
    state.bucketObjects.push(entry);
    return {
      detail: "Folder created in mock state.",
      bucket_id: bucketId,
      prefix: readString(entry.prefix),
      marker_artifact_id: readNumber(entry.id),
    };
  }

  return undefined;
}

function handleSimpleTables(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/orm/api/ts_manager/namespace/" && method === "GET") {
    return buildMockNamespaceRows([...state.simpleTables, ...state.dataNodes]);
  }

  if (route === "/orm/api/ts_manager/meta_table/namespaces/" && method === "GET") {
    return buildMockNamespaceRows(state.simpleTables);
  }

  const namespaceDetailMatch = route.match(/^\/orm\/api\/ts_manager\/namespace\/([^/]+)\/$/);
  if (namespaceDetailMatch && method === "GET") {
    const namespace = findMockNamespaceByUid(namespaceDetailMatch[1] ?? "");

    return namespace
      ? {
          ...namespace,
          description: `Mock namespace detail for ${namespace.namespace}.`,
        }
      : undefined;
  }

  const namespaceTablesMatch = route.match(/^\/orm\/api\/ts_manager\/namespace\/([^/]+)\/tables\/$/);
  if (namespaceTablesMatch && method === "GET") {
    return buildMockNamespaceTableRows(namespaceTablesMatch[1] ?? "");
  }

  const namespaceSetPermissionsMatch = route.match(
    /^\/orm\/api\/ts_manager\/namespace\/([^/]+)\/set-permissions\/$/,
  );
  if (namespaceSetPermissionsMatch && method === "POST") {
    parseBody(init);
    return detailMessage("Namespace permissions updated in mock mode.");
  }

  const namespacePropagatePermissionsMatch = route.match(
    /^\/orm\/api\/ts_manager\/namespace\/([^/]+)\/propagate-permissions\/$/,
  );
  if (namespacePropagatePermissionsMatch && method === "POST") {
    parseBody(init);
    return detailMessage("Namespace permissions propagated in mock mode.");
  }

  if (route === "/orm/api/ts_manager/meta_table/" && method === "GET") {
    const namespace = readString(searchParams.get("namespace")).trim();
    const filtered = sortDescendingById(
      state.simpleTables.filter((table) =>
        namespace ? readOptionalString(table.namespace)?.trim() === namespace : true,
      ),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/orm/api/ts_manager/meta_table/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const before = state.simpleTables.length;
    state.simpleTables = state.simpleTables.filter((table) => !uids.has(readString(table.uid)));
    return {
      deleted_count: before - state.simpleTables.length,
    };
  }

  if (route === "/orm/api/ts_manager/meta_table/bulk-clear-data/" && method === "POST") {
    const body = parseBody(init);

    if (body?.confirm_clear_data !== true) {
      throw new Error("confirm_clear_data must be true.");
    }

    const selectAll = readBoolean(body?.select_all);
    const uids = new Set(
      readArray<string>(body?.uids).concat(readArray<string>(body?.selected_uids)),
    );
    const clearedCount = selectAll
      ? state.simpleTables.length
      : state.simpleTables.filter((table) => uids.has(readString(table.uid))).length;

    return {
      detail: "Cleared MetaTable data in mock mode.",
      cleared_count: clearedCount,
      selected_count: clearedCount,
      select_all: selectAll,
      override_protection: readBoolean(body?.override_protection),
    };
  }

  if (route === "/orm/api/ts_manager/meta_table/bulk-delete-with-cascade/" && method === "POST") {
    const body = parseBody(init);

    if (body?.confirm_cascade_delete !== true) {
      throw new Error("confirm_cascade_delete must be true.");
    }

    const deletedMetaTableUids = new Set(readArray<string>(body?.uids));
    let changed = true;

    while (changed) {
      changed = false;

      for (const table of state.simpleTables) {
        const tableUid = readString(table.uid);
        if (!tableUid || deletedMetaTableUids.has(tableUid)) {
          continue;
        }

        const referencesDeletedTable = readArray<Record<string, unknown>>(table.foreign_keys).some(
          (foreignKey) =>
            deletedMetaTableUids.has(
              readOptionalString(foreignKey.target_table_uid)?.trim() ?? "",
            ),
        );

        if (referencesDeletedTable) {
          deletedMetaTableUids.add(tableUid);
          changed = true;
        }
      }
    }

    const deletedMetaTables = state.simpleTables
      .filter((table) => deletedMetaTableUids.has(readString(table.uid)))
      .map((table) => readString(table.uid))
      .filter(Boolean);

    state.simpleTables = state.simpleTables.filter(
      (table) => !deletedMetaTableUids.has(readString(table.uid)),
    );

    return {
      ok: true,
      action: "bulk_delete_with_cascade",
      root_meta_table_uids: readArray<string>(body?.uids),
      deleted_meta_tables: deletedMetaTables,
      deleted_dynamic_tables: [],
      deleted_meta_table_count: deletedMetaTables.length,
      deleted_dynamic_table_count: 0,
      blocking_edges: [],
    };
  }

  if (route === "/orm/api/ts_manager/meta_table/bulk-refresh-table-search-index/" && method === "POST") {
    const body = parseBody(init);
    return {
      results: readArray<string>(body?.uids).map((uid) => ({
        meta_table_uid: uid,
        ok: true,
        detail: "Search index refreshed in mock mode.",
      })),
    };
  }

  if (route === "/orm/api/ts_manager/meta_table/import-from-data-source/" && method === "POST") {
    const body = parseBody(init);
    const dataSourceUid = readString(body?.data_source_uid).trim();
    const dryRun = body?.dry_run === true;
    const includeViews = body?.include_views !== false;
    const refreshExisting = body?.refresh_existing !== false;
    const requestedNamespace = readOptionalString(body?.namespace)?.trim() ?? null;
    const relationNames = new Set(
      readArray<string>(body?.relation_names)
        .map((value) => readString(value).trim())
        .filter(Boolean),
    );
    const excludedRelationNames = new Set(
      readArray<string>(body?.exclude_relation_names)
        .map((value) => readString(value).trim())
        .filter(Boolean),
    );

    const dataSource = findByUid(state.projectDataSources, dataSourceUid);

    if (!dataSourceUid || !dataSource) {
      throw new Error("DynamicTable Data Source not found.");
    }

    const physicalDataSource = isRecord(dataSource.related_resource)
      ? (dataSource.related_resource as Record<string, unknown>)
      : null;
    const namespaceSeed =
      readString(dataSource.display_name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "external-source";
    const namespace = requestedNamespace ?? `${namespaceSeed}-${dataSourceUid.slice(0, 8)}-external`;
    const baseRelations = [
      { physical_table_name: "orders", relation_kind: "table", columns: 12, indexes: 3, foreign_keys: 2 },
      { physical_table_name: "customers", relation_kind: "table", columns: 8, indexes: 2, foreign_keys: 0 },
      { physical_table_name: "fills", relation_kind: "table", columns: 10, indexes: 2, foreign_keys: 1 },
      ...(includeViews
        ? [{ physical_table_name: "orders_latest", relation_kind: "view", columns: 12, indexes: 0, foreign_keys: 0 }]
        : []),
    ];
    const filteredRelations = baseRelations
      .filter((relation) => relationNames.size === 0 || relationNames.has(relation.physical_table_name))
      .filter((relation) => !excludedRelationNames.has(relation.physical_table_name));
    const existingTables = state.simpleTables.filter(
      (table) => readOptionalString(table.namespace)?.trim() === namespace,
    );
    const stale = existingTables
      .filter((table) => {
        const physicalTableName =
          readOptionalString(table.physical_table_name)?.trim() ||
          readOptionalString(table.table_name)?.trim() ||
          readOptionalString(table.identifier)?.trim();

        return physicalTableName ? !filteredRelations.some((relation) => relation.physical_table_name === physicalTableName) : false;
      })
      .map((table) => ({
        meta_table_uid: readOptionalString(table.uid)?.trim() ?? null,
        physical_table_name:
          readOptionalString(table.physical_table_name)?.trim() ||
          readOptionalString(table.table_name)?.trim() ||
          "unknown_table",
        reason: "not_found_in_current_scan",
      }));

    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    const relations = filteredRelations.map((relation) => {
      const existingTable = existingTables.find((table) => {
        const physicalTableName =
          readOptionalString(table.physical_table_name)?.trim() ||
          readOptionalString(table.table_name)?.trim() ||
          readOptionalString(table.identifier)?.trim();

        return physicalTableName === relation.physical_table_name;
      });

      const warnings =
        relation.relation_kind === "view"
          ? ["Views are imported as read-only metadata."]
          : [];
      const status = existingTable
        ? refreshExisting
          ? "updated"
          : "unchanged"
        : "created";

      if (status === "created") {
        createdCount += 1;
      } else if (status === "updated") {
        updatedCount += 1;
      } else {
        unchangedCount += 1;
      }

      let metaTableUid = readOptionalString(existingTable?.uid)?.trim() ?? null;

      if (!dryRun && !existingTable) {
        const nextMetaTableId = nextId(state.simpleTables);
        metaTableUid = `mock-imported-meta-table-${nextMetaTableId}`;
        state.simpleTables.unshift({
          id: nextMetaTableId,
          uid: metaTableUid,
          identifier: relation.physical_table_name,
          display_name: relation.physical_table_name,
          title: relation.physical_table_name,
          table_name: relation.physical_table_name,
          meta_table_name: relation.physical_table_name,
          physical_table_name: relation.physical_table_name,
          namespace,
          description: `Imported from ${readString(dataSource.display_name).trim() || "DynamicTable Data Source"}`,
          creation_date: new Date().toISOString(),
          open_for_everyone: false,
          protect_from_deletion: false,
          data_source: {
            uid: dataSourceUid,
            related_resource: physicalDataSource
              ? {
                  uid: readOptionalString(physicalDataSource.uid)?.trim() ?? null,
                  display_name:
                    readOptionalString(physicalDataSource.label)?.trim() ||
                    readOptionalString(physicalDataSource.display_name)?.trim() ||
                    "Physical data source",
                  class_type: readOptionalString(physicalDataSource.class_type)?.trim() ?? null,
                  status: readOptionalString(physicalDataSource.status)?.trim() ?? null,
                }
              : null,
            related_resource_class_type:
              readOptionalString(physicalDataSource?.class_type)?.trim() ?? null,
          },
          columns: [
            {
              name: "uid",
              logical_name: "UID",
              data_type: "uuid",
              backend_type: "uuid",
              nullable: false,
              primary_key: true,
              unique: true,
              ordinal_position: 0,
              description: "Primary key",
              label: "UID",
            },
          ],
          indexes_meta: [],
          foreign_keys: [],
          incoming_fks: [],
        });
      }

      if (!dryRun && existingTable && refreshExisting) {
        existingTable.description = `Refreshed from ${readString(dataSource.display_name).trim() || "DynamicTable Data Source"}`;
      }

      return {
        physical_table_name: relation.physical_table_name,
        relation_kind: relation.relation_kind,
        status,
        meta_table_uid: metaTableUid,
        columns: relation.columns,
        indexes: relation.indexes,
        foreign_keys: relation.foreign_keys,
        warnings,
      };
    });

    const warnings = includeViews
      ? ["Views are included in this import preview and are treated as read-only metadata."]
      : [];

    return {
      ok: true,
      dry_run: dryRun,
      data_source_uid: dataSourceUid,
      physical_data_source_uid: readOptionalString(physicalDataSource?.uid)?.trim() ?? null,
      class_type: readOptionalString(physicalDataSource?.class_type)?.trim() ?? null,
      schema: "public",
      namespace,
      counts: {
        discovered: filteredRelations.length,
        created: createdCount,
        updated: updatedCount,
        unchanged: unchangedCount,
        skipped: 0,
        failed: 0,
        stale: stale.length,
      },
      relations,
      stale,
      warnings,
    };
  }

  const healFromPhysicalMatch = route.match(
    /^\/orm\/api\/ts_manager\/meta_table\/([^/]+)\/heal-from-physical\/$/,
  );
  if (healFromPhysicalMatch && method === "POST") {
    const targetUid = healFromPhysicalMatch[1] ?? "";
    const table = findByUid(state.simpleTables, targetUid);

    if (!table) {
      throw new Error("MetaTable not found.");
    }

    return {
      ok: true,
      meta_table_uid: targetUid,
      detail: "MetaTable projection details synced from the physical table in mock mode.",
    };
  }

  const detailMatch = route.match(/^\/orm\/api\/ts_manager\/meta_table\/([^/]+)\/$/);
  if (detailMatch && method === "DELETE") {
    const targetUid = detailMatch[1] ?? "";
    const blockingMetaTables = state.simpleTables.filter((table) =>
      readArray<Record<string, unknown>>(table.foreign_keys).some(
        (foreignKey) => readOptionalString(foreignKey.target_table_uid)?.trim() === targetUid,
      ),
    );

    if (blockingMetaTables.length > 0) {
      throw new Error(
        "MetaTable has inbound foreign-key references and cannot be deleted without cascade.",
      );
    }

    state.simpleTables = state.simpleTables.filter((table) => readString(table.uid) !== targetUid);
    return null;
  }

  if (detailMatch && method === "GET") {
    return findByUid(state.simpleTables, detailMatch[1] ?? "");
  }

  const cascadeDeleteMatch = route.match(
    /^\/orm\/api\/ts_manager\/meta_table\/([^/]+)\/delete-with-cascade\/$/,
  );
  if (cascadeDeleteMatch && method === "POST") {
    const targetUid = cascadeDeleteMatch[1] ?? "";
    const body = parseBody(init);

    if (body?.confirm_cascade_delete !== true) {
      throw new Error("confirm_cascade_delete must be true.");
    }

    const deletedMetaTableUids = new Set<string>([targetUid]);
    let changed = true;

    while (changed) {
      changed = false;

      for (const table of state.simpleTables) {
        const tableUid = readString(table.uid);
        if (!tableUid || deletedMetaTableUids.has(tableUid)) {
          continue;
        }

        const referencesDeletedTable = readArray<Record<string, unknown>>(table.foreign_keys).some(
          (foreignKey) =>
            deletedMetaTableUids.has(
              readOptionalString(foreignKey.target_table_uid)?.trim() ?? "",
            ),
        );

        if (referencesDeletedTable) {
          deletedMetaTableUids.add(tableUid);
          changed = true;
        }
      }
    }

    const deletedMetaTables = state.simpleTables
      .filter((table) => deletedMetaTableUids.has(readString(table.uid)))
      .map((table) => readString(table.uid))
      .filter(Boolean);

    state.simpleTables = state.simpleTables.filter(
      (table) => !deletedMetaTableUids.has(readString(table.uid)),
    );

    return {
      ok: true,
      action: "delete_with_cascade",
      root_meta_table_uid: targetUid,
      deleted_meta_tables: deletedMetaTables,
      deleted_dynamic_tables: [],
      deleted_meta_table_count: deletedMetaTables.length,
      deleted_dynamic_table_count: 0,
      blocking_edges: [],
    };
  }

  const summaryMatch = route.match(/^\/orm\/api\/ts_manager\/meta_table\/([^/]+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const table = findByUid(state.simpleTables, summaryMatch[1] ?? "");
    return buildMetaTableSummary(
      table ?? { id: Number(summaryMatch[1]), uid: summaryMatch[1], storage_hash: `table_${summaryMatch[1]}` },
    );
  }

  const generatedSearchDocumentMatch = route.match(
    /^\/orm\/api\/ts_manager\/meta_table\/([^/]+)\/generated-search-document\/$/,
  );
  if (generatedSearchDocumentMatch && method === "GET") {
    const uid = generatedSearchDocumentMatch[1] ?? "";
    const table = findByUid(state.simpleTables, uid);

    return {
      generated_search_document: buildMetaTableGeneratedSearchDocument(table, uid),
    };
  }

  const schemaMatch = route.match(/^\/orm\/api\/ts_manager\/meta_table\/([^/]+)\/schema-graph\/$/);
  if (schemaMatch && method === "GET") {
    const table = findByUid(state.simpleTables, schemaMatch[1] ?? "");
    return {
      root_uid: readString(table?.uid) || schemaMatch[1] || "",
      depth: Number(searchParams.get("depth") ?? 1) || 1,
      include_incoming: ["1", "true", "yes", "on"].includes(
        readString(searchParams.get("include_incoming")).toLowerCase(),
      ),
      nodes: [
        {
          uid: readString(table?.uid) || schemaMatch[1] || "",
          identifier: readString(table?.identifier) || `table_${schemaMatch[1]}`,
          namespace: readOptionalString(table?.namespace),
          physical_table_name: readString(table?.storage_hash) || `table_${schemaMatch[1]}`,
          storage_hash: readString(table?.storage_hash) || `table_${schemaMatch[1]}`,
          columns: [],
        },
      ],
      edges: [],
    };
  }

  const dynamicTableSchemaMatch = route.match(
    /^\/orm\/api\/ts_manager\/dynamic_table\/([^/]+)\/schema-graph\/$/,
  );
  if (dynamicTableSchemaMatch && method === "GET") {
    const table = findByUid(state.dataNodes, dynamicTableSchemaMatch[1] ?? "");
    const columnsMetadata = readArray<Record<string, unknown>>(
      isRecord(table?.sourcetableconfiguration)
        ? table.sourcetableconfiguration.columns_metadata
        : [],
    );

    return {
      root_uid: readString(table?.uid) || dynamicTableSchemaMatch[1] || "",
      depth: Number(searchParams.get("depth") ?? 1) || 1,
      include_incoming: ["1", "true", "yes", "on"].includes(
        readString(searchParams.get("include_incoming")).toLowerCase(),
      ),
      nodes: [
        {
          uid: readString(table?.uid) || dynamicTableSchemaMatch[1] || "",
          identifier:
            readOptionalString(table?.identifier)?.trim() ||
            readString(table?.storage_hash) ||
            `dynamic_table_${dynamicTableSchemaMatch[1]}`,
          namespace: readOptionalString(table?.namespace),
          physical_table_name:
            readString(table?.storage_hash) || `dynamic_table_${dynamicTableSchemaMatch[1]}`,
          storage_hash:
            readString(table?.storage_hash) || `dynamic_table_${dynamicTableSchemaMatch[1]}`,
          columns: columnsMetadata.map((column) => ({
            name: readString(column.column_name),
            data_type: readOptionalString(column.dtype) ?? "unknown",
            nullable: true,
            primary_key: false,
          })),
        },
      ],
      edges: [],
    };
  }

  return undefined;
}

function handleDataNodes(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  const sourceTableConfigStatsMatch = route.match(
    /^\/orm\/api\/ts_manager\/source_table_config\/(\d+)\/get_stats\/$/,
  );
  if (sourceTableConfigStatsMatch && method === "GET") {
    return resolveMockSourceTableConfigStats(sourceTableConfigStatsMatch[1] ?? "");
  }

  const dynamicTableStatsMatch = route.match(
    /^\/orm\/api\/ts_manager\/dynamic_table\/([^/]+)\/get-stats\/$/,
  );
  if (dynamicTableStatsMatch && method === "GET") {
    return resolveMockDataNodeStats(dynamicTableStatsMatch[1] ?? "");
  }

  if (route === "/orm/api/ts_manager/dynamic_table/namespaces/" && method === "GET") {
    return buildMockNamespaceRows(state.dataNodes);
  }

  if (route === "/orm/api/ts_manager/dynamic_table/" && method === "GET") {
    const query = searchParams.get("q");
    const uid = readString(searchParams.get("uid")).trim();
    const namespace = readString(searchParams.get("namespace")).trim();
    const filtered = sortDescendingById(
      state.dataNodes.filter((node) => {
        if (namespace && readOptionalString(node.namespace)?.trim() !== namespace) {
          return false;
        }

        if (uid && readOptionalString(node.uid)?.trim() !== uid) {
          return false;
        }

        return matchesSearch(
          [node.uid, node.id, node.identifier, node.description],
          query,
        );
      }),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/orm/api/ts_manager/dynamic_table/quick-search/" && method === "GET") {
    return state.dataNodes
      .filter((node) =>
        matchesSearch([node.uid, node.identifier], searchParams.get("q")),
      )
      .slice(0, Number(searchParams.get("limit") ?? 50))
      .map((node) => ({
        id: readNumber(node.id),
        uid: readOptionalString(node.uid),
        storage_hash: readString(node.storage_hash),
        identifier: readOptionalString(node.identifier),
      }));
  }

  const summaryMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/([^/]+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const node = findByUid(state.dataNodes, summaryMatch[1] ?? "");
    return buildDataNodeSummary(
      node ?? { id: Number(summaryMatch[1]), uid: summaryMatch[1], identifier: `Data Node ${summaryMatch[1]}` },
    );
  }

  const detailMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    return findByUid(state.dataNodes, detailMatch[1] ?? "");
  }

  const lastObservationMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/([^/]+)\/get_last_observation\/$/);
  if (lastObservationMatch && method === "POST") {
    return resolveMockDataNodeLastObservation(lastObservationMatch[1] ?? "");
  }

  const tailObservationsMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/([^/]+)\/get-tail-observations\/$/);
  if (tailObservationsMatch && method === "GET") {
    const dataNodeUid = tailObservationsMatch[1] ?? "";
    const node = findByUid(state.dataNodes, dataNodeUid);
    const { timeIndexName } = node ? getDataNodeIndexContext(node) : { timeIndexName: "" };
    const requestedOrder = readString(searchParams.get("order")).toLowerCase() === "asc" ? "asc" : "desc";
    const requestedCount = Math.max(0, Number(searchParams.get("n") ?? "") || 100);
    const rows = [...resolveMockDataNodeRemoteRows(dataNodeUid)].sort((left, right) => {
      const leftValue = Date.parse(readString(left[timeIndexName]));
      const rightValue = Date.parse(readString(right[timeIndexName]));

      if (Number.isNaN(leftValue) || Number.isNaN(rightValue)) {
        return 0;
      }

      return requestedOrder === "asc" ? leftValue - rightValue : rightValue - leftValue;
    });

    return rows.slice(0, requestedCount);
  }

  const dataBetweenDatesMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/([^/]+)\/get_data_between_dates_from_remote\/$/);
  if (dataBetweenDatesMatch && method === "POST") {
    const body = parseBody(init);
    const columns = new Set(readArray<string>(body?.columns));
    const rows = resolveMockDataNodeRemoteRows(dataBetweenDatesMatch[1] ?? "").map((row) =>
      columns.size === 0
        ? row
        : Object.fromEntries(Object.entries(row).filter(([key]) => columns.has(key))),
    );
    return rows.slice(0, Number(body?.limit ?? rows.length));
  }

  const deleteAfterDateMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/([^/]+)\/delete_after_date\/$/);
  if (deleteAfterDateMatch && method === "POST") {
    const dataNodeUid = deleteAfterDateMatch[1] ?? "";
    const body = parseBody(init);
    const afterDate = readString(body?.after_date);
    const parsedAfterDate = Date.parse(afterDate);

    if (Number.isNaN(parsedAfterDate)) {
      throw new Error("Invalid after_date.");
    }

    const node = findByUid(state.dataNodes, dataNodeUid);

    if (!node) {
      throw new Error(`Dynamic table ${dataNodeUid} was not found.`);
    }

    const { indexNames, secondaryIndexName, timeIndexName } = getDataNodeIndexContext(node);
    const uniqueIdentifierList = readArray<string>(body?.unique_identifier_list).filter(
      (value) => typeof value === "string" && value.trim().length > 0,
    );
    const isMultiIndex = indexNames.length > 1;

    if (uniqueIdentifierList.length > 0 && !isMultiIndex) {
      throw new Error("unique_identifier filters are only supported for multi-index tables.");
    }

    const previousRows = resolveMockDataNodeRemoteRows(dataNodeUid);
    const nextRows = previousRows.filter((row) => {
      const parsedTimeIndex = Date.parse(readString(row[timeIndexName]));

      if (Number.isNaN(parsedTimeIndex)) {
        return true;
      }

      if (parsedTimeIndex < parsedAfterDate) {
        return true;
      }

      if (uniqueIdentifierList.length === 0 || !secondaryIndexName) {
        return false;
      }

      const identifier = readString(row[secondaryIndexName]);

      return !uniqueIdentifierList.includes(identifier);
    });

    replaceMockDataNodeRemoteRows(dataNodeUid, nextRows);
    replaceMockDataNodeLastObservation(dataNodeUid, getLatestRecordByTimeIndex(nextRows));
    const stats = updateMockDataNodeIndexStats(dataNodeUid);

    return {
      ok: true,
      dynamic_table_uid: dataNodeUid,
      deleted_count: previousRows.length - nextRows.length,
      table_empty: nextRows.length === 0,
      unique_identifier_list: uniqueIdentifierList.length > 0 ? uniqueIdentifierList : undefined,
      stats: {
        last_time_index_value: stats.last_time_index_value,
        earliest_index_value: stats.earliest_index_value,
        multi_index_stats: stats?.multi_index_stats ?? null,
        multi_index_column_stats: stats?.multi_index_column_stats ?? null,
      },
    };
  }

  if (route === "/orm/api/ts_manager/dynamic_table/bulk-refresh-table-search-index/" && method === "POST") {
    const body = parseBody(init);
    const selectedUids = readArray<string>(body?.selected_uids);
    return {
      ok: true,
      action: "refresh_search_index",
      requested_uids: selectedUids,
      requested_count: selectedUids.length,
      select_all: false,
      matched_count: selectedUids.length,
      success_count: selectedUids.length,
      failed_count: 0,
      results: selectedUids.map((uid) => ({
        dynamic_table_metadata_uid: uid,
        storage_hash: readString(findByUid(state.dataNodes, uid)?.storage_hash),
        ok: true,
        detail: "Search index refreshed in mock mode.",
      })),
    };
  }

  if (route === "/orm/api/ts_manager/dynamic_table/bulk-set-index-stats-from-table/" && method === "POST") {
    const body = parseBody(init);
    const selectedUids = readArray<string>(body?.selected_uids);
    return {
      ok: true,
      action: "set_index_stats",
      requested_uids: selectedUids,
      requested_count: selectedUids.length,
      select_all: false,
      matched_count: selectedUids.length,
      success_count: selectedUids.length,
      failed_count: 0,
      results: selectedUids.map((uid) => ({
        dynamic_table_metadata_uid: uid,
        storage_hash: readString(findByUid(state.dataNodes, uid)?.storage_hash),
        ok: true,
        detail: "Index stats refreshed in mock mode.",
      })),
    };
  }

  if (route === "/orm/api/ts_manager/dynamic_table/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const selectedUids = new Set(readArray<string>(body?.selected_uids));
    const before = state.dataNodes.length;
    state.dataNodes = state.dataNodes.filter((node) => !selectedUids.has(readString(node.uid)));
    return {
      ok: true,
      requested_uids: [...selectedUids],
      requested_count: selectedUids.size,
      select_all: false,
      matched_count: selectedUids.size,
      selected_deleted: before - state.dataNodes.length,
      downstream_deleted: 0,
      missing_table_deleted: 0,
    };
  }

  const compressionMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/([^/]+)\/compression-policy\/$/);
  if (compressionMatch && method === "GET") {
    const node = findByUid(state.dataNodes, compressionMatch[1] ?? "");
    return {
      policy_type: "compression",
      supported: true,
      exists: Boolean(node?.compression_policy),
      detail: "Compression policy available in mock mode.",
      config: (node?.compression_policy as Record<string, unknown> | null) ?? null,
    };
  }

  if (compressionMatch && method === "POST") {
    const node = findByUid(state.dataNodes, compressionMatch[1] ?? "");
    if (node) {
      node.compression_policy = parseBody(init);
    }
    return {
      policy_type: "compression",
      supported: true,
      exists: true,
      detail: "Compression policy saved in mock mode.",
      config: (node?.compression_policy as Record<string, unknown> | null) ?? null,
    };
  }

  const retentionMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/([^/]+)\/retention-policy\/$/);
  if (retentionMatch && method === "GET") {
    const node = findByUid(state.dataNodes, retentionMatch[1] ?? "");
    return {
      policy_type: "retention",
      supported: true,
      exists: Boolean(node?.retention_policy),
      detail: "Retention policy available in mock mode.",
      config: (node?.retention_policy as Record<string, unknown> | null) ?? null,
    };
  }

  if (retentionMatch && method === "POST") {
    const node = findByUid(state.dataNodes, retentionMatch[1] ?? "");
    if (node) {
      node.retention_policy = parseBody(init);
    }
    return {
      policy_type: "retention",
      supported: true,
      exists: true,
      detail: "Retention policy saved in mock mode.",
      config: (node?.retention_policy as Record<string, unknown> | null) ?? null,
    };
  }

  return undefined;
}

function handleLocalTimeSeries(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/orm/api/ts_manager/local_time_serie/" && method === "GET") {
    const remoteTableUid = searchParams.get("remote_table__uid") ?? "";
    const projectUid = searchParams.get("project__uid") ?? "";
    const query = searchParams.get("q");
    const filtered = sortDescendingById(
      state.localTimeSeries.filter((update) => {
        if (remoteTableUid) {
          if (readString((update.data_node_storage as Record<string, unknown> | null)?.uid) !== remoteTableUid) {
            return false;
          }
        }

        if (projectUid) {
          if (readString(update.project_uid) !== projectUid) {
            return false;
          }
        }

        return matchesSearch(
          [
            update.id,
            update.update_hash,
            update.project_uid,
            (update.data_node_storage as Record<string, unknown> | null)?.uid,
            (update.data_node_storage as Record<string, unknown> | null)?.storage_hash,
            (update.data_node_storage as Record<string, unknown> | null)?.identifier,
          ],
          query,
        );
      }),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  const summaryMatch = route.match(/^\/orm\/api\/ts_manager\/local_time_serie\/([^/]+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const update = findByUid(state.localTimeSeries, summaryMatch[1] ?? "");
    return buildEntitySummary(
      summaryMatch[1] ?? "",
      "local_time_serie",
      readString(update?.update_hash) || `Local Update ${summaryMatch[1]}`,
      {
        inlineFields: [
          {
            key: "next_update",
            label: "Next update",
            value: readString((update?.update_details as Record<string, unknown> | null)?.next_update),
            kind: "datetime",
          },
        ],
        stats: [
          {
            key: "active",
            label: "Active",
            display: readBoolean((update?.update_details as Record<string, unknown> | null)?.active_update) ? "Yes" : "No",
            value: readBoolean((update?.update_details as Record<string, unknown> | null)?.active_update),
            kind: "boolean",
          },
        ],
      },
    );
  }

  const detailMatch = route.match(/^\/orm\/api\/ts_manager\/local_time_serie\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    return findByUid(state.localTimeSeries, detailMatch[1] ?? "");
  }

  const configMatch = route.match(/^\/orm\/api\/ts_manager\/local_time_serie\/([^/]+)\/run-configuration\/$/);
  if (configMatch && method === "GET") {
    const update = findByUid(state.localTimeSeries, configMatch[1] ?? "");
    return update?.run_configuration ?? null;
  }

  if (configMatch && method === "PATCH") {
    const update = findByUid(state.localTimeSeries, configMatch[1] ?? "");
    if (update) {
      update.run_configuration = {
        ...(update.run_configuration as Record<string, unknown> | null ?? {}),
        ...(parseBody(init) ?? {}),
      };
    }
    return update?.run_configuration ?? null;
  }

  const graphMatch = route.match(/^\/orm\/api\/ts_manager\/local_time_serie\/([^/]+)\/dependencies-graph\/$/);
  if (graphMatch && method === "GET") {
    const graph = resolveMockDependencyGraph({
      sourceKind: "local_time_serie",
      sourceId: graphMatch[1] ?? "",
      direction: searchParams.get("direction"),
    });

    if (!graph) {
      throw new Error(
        `Missing Main Sequence mock dependency graph payload for local_time_serie/${graphMatch[1]}.`,
      );
    }

    return graph;
  }

  const historicalMatch = route.match(/^\/orm\/api\/ts_manager\/local_time_serie\/([^/]+)\/historical-updates\/$/);
  if (historicalMatch && method === "GET") {
    const update = findByUid(state.localTimeSeries, historicalMatch[1] ?? "");
    return readArray(update?.historical_updates).slice(0, Number(searchParams.get("limit") ?? 100));
  }

  const logsMatch = route.match(/^\/orm\/api\/ts_manager\/local_time_serie\/([^/]+)\/logs\/$/);
  if (logsMatch && method === "GET") {
    const update = findByUid(state.localTimeSeries, logsMatch[1] ?? "");
    const rows = readArray<Record<string, unknown>>(update?.logs);
    return {
      rows,
      columnDefs: [
        { field: "timestamp", headerName: "Timestamp" },
        { field: "level", headerName: "Level" },
        { field: "event", headerName: "Event" },
      ],
      detailColumnDefs: [
        { field: "message", headerName: "Message" },
      ],
    };
  }

  return undefined;
}

function handleResources(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/project-base-image/" && method === "GET") {
    return paginate(state.projectBaseImages, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/github-organization/" && method === "GET") {
    return paginate(state.githubOrganizations, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/project-image/" && method === "GET") {
    const projectUid = searchParams.get("related_project__uid__in") ?? "";
    const filtered = sortDescendingById(
      state.projectImages.filter((image) =>
        projectUid ? readString(image.related_project_uid) === projectUid : true,
      ),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/project-image/" && method === "POST") {
    const body = parseBody(init);
    const baseImage = state.projectBaseImages[0] ?? null;
    const id = nextId(state.projectImages);
    const record = {
      id,
      uid: `mock-project-image-${id}`,
      project_repo_hash: readString(body?.project_repo_hash) || "newmockhash00000000",
      related_project_uid: readString(body?.related_project),
      base_image: baseImage,
      is_ready: false,
    };
    state.projectImages.unshift(record);
    return record;
  }

  const projectImageDeleteMatch = route.match(/^\/project-image\/([^/]+)\/$/);
  if (projectImageDeleteMatch && method === "DELETE") {
    const imageUid = projectImageDeleteMatch[1] ?? "";
    state.projectImages = state.projectImages.filter((image) => readString(image.uid) !== imageUid);
    return detailMessage("Project image deleted from mock state.");
  }

  if (route === "/project-image/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const selectAll = readBoolean(body?.select_all);
    const uids = new Set(
      readArray<string>(body?.selected_uids).concat(readArray<string>(body?.uids)),
    );
    const before = state.projectImages.length;
    state.projectImages = state.projectImages.filter((image) =>
      selectAll ? false : !uids.has(readString(image.uid)),
    );
    return {
      deleted_count: before - state.projectImages.length,
    };
  }

  if (route === "/project-image/commit-hashes/" && method === "GET") {
    const projectUid = searchParams.get("project_uid") ?? "";
    const images = state.projectImages.filter((image) => readString(image.related_project_uid) === projectUid);
    return {
      project_uid: projectUid,
      commits: images.map((image) => {
        const hash = readString(image.project_repo_hash);
        return {
          value: hash,
          commit_hash: hash,
          short_hash: hash.slice(0, 7),
          label: hash.slice(0, 7),
          created_at: "2026-03-20T09:00:00Z",
          created_display: "Mar 20, 2026",
          has_image: true,
          image_count: 1,
          is_dynamic: false,
        };
      }),
    };
  }

  if (route === "/project-resource/" && method === "GET") {
    const projectUid = searchParams.get("project__uid") ?? "";
    const resourceType = searchParams.get("resource_type");
    const repoCommitSha = searchParams.get("repo_commit_sha");
    const filtered = sortDescendingById(
      state.projectResources.filter((resource) => {
        if (projectUid && readString(resource.project_uid) !== projectUid) {
          return false;
        }
        if (resourceType && readString(resource.resource_type) !== resourceType) {
          return false;
        }
        if (repoCommitSha && readString(resource.repo_commit_sha) !== repoCommitSha) {
          return false;
        }
        return true;
      }),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/resource-release/static-site-capabilities/" && method === "GET") {
    return buildStaticSiteCapabilities(readOptionalString(searchParams.get("project_uid")));
  }

  if (route === "/deployment-runs/" && method === "GET") {
    return paginate(
      filterDeploymentRuns(searchParams),
      searchParams.get("limit"),
      searchParams.get("offset"),
    );
  }

  const deploymentRunLogsMatch = route.match(/^\/deployment-runs\/([^/]+)\/logs\/$/);
  if (deploymentRunLogsMatch && method === "GET") {
    const runUid = deploymentRunLogsMatch[1] ?? "";
    const run = findByUid(state.deploymentRuns, runUid);
    const entries = readArray<Record<string, unknown>>(run?.log_entries);

    return {
      run_uid: runUid,
      entries:
        entries.length > 0
          ? entries
          : [
              {
                sequence: 1,
                timestamp: readOptionalString(run?.created_at),
                stream: "stdout",
                text: `Mock logs for deployment run ${runUid}.`,
              },
            ],
      sources: [],
      next_cursor: null,
      complete: true,
      retention_expires_at: null,
    };
  }

  const deploymentRunDetailMatch = route.match(/^\/deployment-runs\/([^/]+)\/$/);
  if (deploymentRunDetailMatch && method === "GET") {
    return findByUid(state.deploymentRuns, deploymentRunDetailMatch[1] ?? "");
  }

  if (route === "/resource-release/" && method === "GET") {
    const releaseKindFilter = lowerNeedle(searchParams.get("release_kind"));
    const projectUidFilter = lowerNeedle(searchParams.get("project_uid"));
    const search = searchParams.get("search");
    const filtered = sortDescendingById(
      state.resourceReleases.filter((release) => {
        if (releaseKindFilter && lowerNeedle(readString(release.release_kind)) !== releaseKindFilter) {
          return false;
        }

        if (projectUidFilter && lowerNeedle(readString(release.project_uid)) !== projectUidFilter) {
          return false;
        }

        return matchesSearch(
          [
            release.uid,
            release.subdomain,
            release.name,
            release.title,
            release.release_kind,
            release.project_uid,
            release.project_name,
            release.resource_uid,
            release.resource_name,
            release.public_url,
          ],
          search,
        );
      }),
    );

    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/resource-release/" && method === "POST") {
    const body = parseBody(init);
    const releaseKind = readString(body?.release_kind) || "streamlit_dashboard";

    if (releaseKind === "static_site") {
      const projectUid = readString(body?.project_uid);
      const project = findByUid(state.projects, projectUid) ?? state.projects[0] ?? null;
      const nextIdValue = nextId(state.resourceReleases);
      const name = readString(body?.name) || `Static site ${nextIdValue}`;
      const subdomainSlug = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
      const subdomain = `${subdomainSlug || "static-site"}-${nextIdValue}`;
      const buildEnvironment = isRecord(body?.build_environment) ? body?.build_environment : {};
      const record = {
        id: nextIdValue,
        uid: `mock-static-site-release-${nextIdValue}`,
        subdomain,
        resource: null,
        resource_uid: null,
        readme_resource: null,
        readme_resource_uid: null,
        related_job: null,
        related_job_uid: null,
        release_kind: "static_site",
        automatic_deployment: readBoolean(body?.automatic_deployment),
        title: name,
        name,
        project_id: readNumber(project?.id),
        project_uid: readString(project?.uid) || projectUid,
        project_name: readString(project?.project_name),
        project_repo_hash: readProjectLatestCommitSha(project),
        public_url: `https://${subdomain}.sites.main-sequence.app`,
        exchange_launch_url: `/orm/api/pods/resource-release/mock-static-site-release-${nextIdValue}/exchange-launch/`,
        lifecycle_status: "active",
        configuration_revision: 1,
        active_deployment: null,
        desired_deployment: null,
        build_environment_keys: Object.keys(buildEnvironment),
        root_directory: readOptionalString(body?.root_directory) ?? "",
        framework: readOptionalString(body?.framework),
        node_version: readOptionalString(body?.node_version),
        output_directory: readOptionalString(body?.output_directory),
        routing_mode: readOptionalString(body?.routing_mode),
        spa_entry_file: readOptionalString(body?.spa_entry_file),
        readme_html: "Static-site release created in local state.",
      };

      state.resourceReleases.unshift(record);
      state.resourceReleaseGallery.unshift(cloneValue(record));
      createMockDeploymentRun(record, "create", {
        phase: "waiting_project_image",
        state: "running",
        syncPointer: "desired",
      });

      return findMockResourceRelease(readString(record.uid)) ?? record;
    }

    const resourceUid =
      readOptionalString(body?.resource_uid) ?? readOptionalString(body?.resource) ?? "";
    const imageUid =
      readOptionalString(body?.related_image_uid) ??
      readOptionalString(body?.related_image) ??
      "";
    const resource = state.projectResources.find((item) => readString(item.uid) === resourceUid);
    const image = state.projectImages.find((item) => readString(item.uid) === imageUid);
    const job =
      state.jobs.find((item) => readString(item.related_image_uid) === readString(image?.uid)) ??
      state.jobs[0];
    const project =
      state.projects.find((item) => readString(item.uid) === readString(resource?.project_uid)) ??
      state.projects[0];
    const nextIdValue = nextId(state.resourceReleases);
    const subdomain = `${readString(resource?.name).replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "release"}-${nextIdValue}`;
    const record = {
      id: nextIdValue,
      uid: `mock-resource-release-${nextIdValue}`,
      subdomain,
      resource: readNumber(resource?.id) || resourceUid,
      resource_uid: resourceUid,
      readme_resource: null,
      readme_resource_uid: null,
      related_job: readNumber(job?.id),
      related_job_uid: readString(job?.uid),
      release_kind: releaseKind,
      automatic_deployment: readBoolean(body?.automatic_deployment),
      title: readString(resource?.name),
      resource_name: readString(resource?.name),
      resource_path: readString(resource?.path),
      project_uid: readString(project?.uid),
      project_name: readString(project?.project_name),
      image_uid: imageUid,
      project_repo_hash: readString(image?.project_repo_hash),
      public_url: `https://${subdomain}.dash.main-sequence.app`,
      exchange_launch_url: `/orm/api/pods/resource-release/mock-resource-release-${nextIdValue}/exchange-launch/`,
      readme_html: "Mock release created in local state.",
    };
    state.resourceReleases.unshift(record);
    state.resourceReleaseGallery.unshift(record);
    return record;
  }

  if (route === "/resource-release/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const before = state.resourceReleases.length;
    state.resourceReleases = state.resourceReleases.filter((release) => !uids.has(readString(release.uid)));
    state.resourceReleaseGallery = state.resourceReleaseGallery.filter((release) => !uids.has(readString(release.uid)));
    return {
      deleted_count: before - state.resourceReleases.length,
    };
  }

  if (route === "/resource-release/gallery/" && method === "GET") {
    const exclude = lowerNeedle(searchParams.get("exclude"));
    const releaseKindFilter = lowerNeedle(searchParams.get("release_kind"));
    const projectUidFilter = lowerNeedle(searchParams.get("project_uid"));
    const search = lowerNeedle(searchParams.get("search"));
    const filtered = sortDescendingById(
      state.resourceReleaseGallery.filter((release) => {
        const releaseKind = lowerNeedle(readString(release.release_kind));

        if (releaseKindFilter && releaseKind !== releaseKindFilter) {
          return false;
        }

        if (projectUidFilter && lowerNeedle(readString(release.project_uid)) !== projectUidFilter) {
          return false;
        }

        if (exclude && (releaseKind === exclude || `${releaseKind}s` === exclude)) {
          return false;
        }

        if (!search) {
          return true;
        }

        const searchable = [
          release.title,
          release.resource_name,
          release.project_name,
          release.name,
          release.lifecycle_status,
          release.root_directory,
          release.framework,
          release.subdomain,
          release.public_url,
          release.uid,
          release.project_uid,
          release.resource_uid,
          isRecord(release.active_deployment)
            ? release.active_deployment.commit_sha
            : null,
          isRecord(release.desired_deployment)
            ? release.desired_deployment.commit_sha
            : null,
        ].map((value) => lowerNeedle(readString(value))).join(" ");

        return searchable.includes(search);
      }),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  const releaseSummaryMatch = route.match(/^\/resource-release\/([^/]+)\/summary\/$/);
  if (releaseSummaryMatch && method === "GET") {
    const releaseUid = releaseSummaryMatch[1] ?? "";
    const release =
      findByUid(state.resourceReleases, releaseUid) ??
      findByUid(state.resourceReleaseGallery, releaseUid);
    return buildResourceReleaseSummary(release ?? { uid: releaseUid, title: `Release ${releaseUid}` });
  }

  const deployCurrentReleaseMatch = route.match(
    /^\/resource-release\/([^/]+)\/deploy-current-version\/$/,
  );
  if (deployCurrentReleaseMatch && method === "POST") {
    const releaseUid = deployCurrentReleaseMatch[1] ?? "";
    const release =
      findByUid(state.resourceReleases, releaseUid) ??
      findByUid(state.resourceReleaseGallery, releaseUid);

    return createMockDeploymentRun(release ?? { uid: releaseUid }, "manual", {
      phase: "waiting_project_image",
      state: "running",
      syncPointer: release && isStaticSiteResourceRelease(release) ? "desired" : null,
    });
  }

  const activateDeploymentMatch = route.match(
    /^\/resource-release\/([^/]+)\/activate-deployment\/$/,
  );
  if (activateDeploymentMatch && method === "POST") {
    const releaseUid = activateDeploymentMatch[1] ?? "";
    const release =
      findByUid(state.resourceReleases, releaseUid) ??
      findByUid(state.resourceReleaseGallery, releaseUid) ??
      { uid: releaseUid };

    return createMockDeploymentRun(release, "manual", {
      operation: "activate_deployment",
      phase: null,
      state: "deployed",
      syncPointer: "active",
    });
  }

  const releaseDetailMatch = route.match(/^\/resource-release\/([^/]+)\/$/);
  if (releaseDetailMatch && method === "GET") {
    const releaseUid = releaseDetailMatch[1] ?? "";
    return (
      findByUid(state.resourceReleases, releaseUid) ??
      findByUid(state.resourceReleaseGallery, releaseUid)
    );
  }

  if (releaseDetailMatch && method === "PATCH") {
    const releaseUid = releaseDetailMatch[1] ?? "";
    const body = parseBody(init);
    const automaticDeployment = readBoolean(body?.automatic_deployment);

    for (const release of [
      ...state.resourceReleases,
      ...state.resourceReleaseGallery,
    ]) {
      if (readString(release.uid) === releaseUid) {
        release.automatic_deployment = automaticDeployment;
      }
    }

    return (
      findByUid(state.resourceReleases, releaseUid) ??
      findByUid(state.resourceReleaseGallery, releaseUid)
    );
  }

  if (releaseDetailMatch && method === "DELETE") {
    const releaseUid = releaseDetailMatch[1] ?? "";
    const release = findMockResourceRelease(releaseUid);

    if (isStaticSiteResourceRelease(release)) {
      updateMockResourceReleaseCopies(releaseUid, (item) => {
        item.lifecycle_status = "deleting";
      });

      return findMockResourceRelease(releaseUid);
    }

    state.resourceReleases = state.resourceReleases.filter((release) => readString(release.uid) !== releaseUid);
    state.resourceReleaseGallery = state.resourceReleaseGallery.filter((release) => readString(release.uid) !== releaseUid);
    return null;
  }

  const launchMatch = route.match(/^\/resource-release\/([^/]+)\/exchange-launch\/$/);
  if (launchMatch && method === "GET") {
    const release = findByUid(state.resourceReleaseGallery, launchMatch[1] ?? "");
    if (isStaticSiteResourceRelease(release)) {
      const publicUrl = readString(release?.public_url).replace(/\/$/, "");

      return {
        release_kind: "static_site",
        mode: "url",
        url: `${publicUrl}/.mainsequence/launch#token=mock-static-site-launch-token`,
      };
    }

    if (lowerNeedle(readString(release?.release_kind)) === "agent") {
      return {
        release_kind: "agent",
        mode: "token",
        token: "mock-agent-token",
        rpc_url: readString(release?.public_url) || "https://agent.main-sequence.app/",
      };
    }
    return {
      release_kind: readString(release?.release_kind) || "streamlit_dashboard",
      mode: "url",
      url: `${readString(release?.public_url)}${readString(release?.public_url).includes("#") ? "" : "/dash/_launch#token=mock-streamlit-token"}`,
    };
  }

  return undefined;
}

function handleJobs(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/job/" && method === "GET") {
    const projectUid = searchParams.get("project__uid") ?? "";
    const filtered = sortDescendingById(
      state.jobs.filter((job) => (projectUid ? readString(job.project_uid) === projectUid : true)),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/job/" && method === "POST") {
    const body = parseBody(init);
    const id = nextId(state.jobs);
    const record = {
      id,
      uid: `mock-job-${id}`,
      name: readString(body?.name) || "new-job",
      project_uid: readString(body?.project),
      execution_path: readString(body?.execution_path),
      app_name: "python",
      task_schedule: null,
      cpu_request: String(body?.cpu_request ?? "1"),
      cpu_limit: String(body?.cpu_request ?? "1"),
      memory_request: String(body?.memory_request ?? "2Gi"),
      memory_limit: String(body?.memory_request ?? "2Gi"),
      gpu_request: body?.gpu_request ? String(body.gpu_request) : null,
      gpu_type: readOptionalString(body?.gpu_type),
      spot: readBoolean(body?.spot),
      max_runtime_seconds: readNumber(body?.max_runtime_seconds) || 3600,
      related_image_uid: readOptionalString(body?.related_image),
    };
    state.jobs.unshift(record);
    return record;
  }

  if (route === "/job/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const before = state.jobs.length;
    state.jobs = state.jobs.filter((job) => !uids.has(readString(job.uid)));
    return {
      deleted_count: before - state.jobs.length,
    };
  }

  const detailMatch = route.match(/^\/job\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    return findByUid(state.jobs, detailMatch[1] ?? "");
  }

  if (detailMatch && method === "DELETE") {
    const jobUid = detailMatch[1] ?? "";
    state.jobs = state.jobs.filter((job) => readString(job.uid) !== jobUid);
    return null;
  }

  if (route === "/job-run/" && method === "GET") {
    const jobUid = searchParams.get("job__uid") ?? "";
    const filtered = sortDescendingById(
      state.jobRuns.filter((run) => (jobUid ? readString(run.job_uid) === jobUid : true)),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/job-run/historical-overview/" && method === "GET") {
    return sortDescendingById(state.jobRuns)
      .slice(0, 6)
      .map((run) => ({
        row_id: `historical-${run.id}`,
        kind: "historical",
        id: readNumber(run.id),
        uid: readString(run.uid),
        job_uid: readString(run.job_uid),
        job_name: readString(run.job_name),
        name: readString(run.name),
        execution_start: readString(run.execution_start),
        execution_end: readOptionalString(run.execution_end),
        execution_time: readString(run.execution_time) || "9m",
        status: readString(run.status),
        cluster_name: readString(run.cluster_name) || "gke-analytics-prod",
        cluster_uuid: readString(run.cluster_uuid) || "cluster-prod-1",
        response_status: readOptionalString(run.response_status),
        job_detail_url: `/app/main-sequence-foundry/jobs?msJobUid=${run.job_uid}`,
        job_run_detail_url: `/app/main-sequence-foundry/jobs?msJobUid=${run.job_uid}&msJobRunUid=${run.uid}`,
      }));
  }

  if (route === "/job-run/upcoming-overview/" && method === "GET") {
    return state.jobs.slice(0, 4).map((job, index) => ({
      row_id: `upcoming-${job.id}`,
      kind: "upcoming",
      id: null,
      job_uid: readString(job.uid),
      job_name: readString(job.name),
      name: `${readString(job.name)} next run`,
      execution_start: new Date(Date.now() + (index + 1) * 60 * 60 * 1000).toISOString(),
      execution_end: null,
      execution_time: "scheduled",
      status: "scheduled",
      cluster_name: "gke-analytics-prod",
      cluster_uuid: "cluster-prod-1",
      response_status: null,
      job_detail_url: `/app/main-sequence-foundry/jobs?msJobUid=${job.uid}`,
      job_run_detail_url: null,
    }));
  }

  const runSummaryMatch = route.match(/^\/job-run\/([^/]+)\/summary\/$/);
  if (runSummaryMatch && method === "GET") {
    const runUid = runSummaryMatch[1] ?? "";
    const run = findByUid(state.jobRuns, runUid);
    return buildEntitySummary(
      runUid,
      "job_run",
      readString(run?.name) || `Run ${runUid}`,
      {
        badges: [
          {
            key: "status",
            label: readString(run?.status) || "unknown",
            tone: lowerNeedle(readString(run?.status)) === "success" ? "success" : "warning",
          },
        ],
        inlineFields: [
          {
            key: "job",
            label: "Job",
            value: readString(run?.job_name),
            kind: "text",
          },
          {
            key: "commit_hash",
            label: "Commit",
            value: readString(run?.commit_hash),
            kind: "code",
          },
        ],
      },
    );
  }

  const logsMatch = route.match(/^\/job-run\/([^/]+)\/get_logs\/$/);
  if (logsMatch && method === "GET") {
    const runUid = logsMatch[1] ?? "";
    return {
      job_run_uid: runUid,
      status: "ok",
      rows: readArray(state.jobRunLogs[runUid]),
    };
  }

  return undefined;
}

function handlePermissions(route: string, method: string, init?: RequestInit) {
  const normalizedSuffixes = {
    candidateUsers: commandCenterConfig.mainSequence.permissions.candidateUsersSuffix.replace(/\/+$/g, ""),
    canView: commandCenterConfig.mainSequence.permissions.canViewSuffix.replace(/\/+$/g, ""),
    canEdit: commandCenterConfig.mainSequence.permissions.canEditSuffix.replace(/\/+$/g, ""),
    addToView: commandCenterConfig.mainSequence.permissions.addToViewSuffix.replace(/\/+$/g, ""),
    addToEdit: commandCenterConfig.mainSequence.permissions.addToEditSuffix.replace(/\/+$/g, ""),
    removeFromView: commandCenterConfig.mainSequence.permissions.removeFromViewSuffix.replace(/\/+$/g, ""),
    removeFromEdit: commandCenterConfig.mainSequence.permissions.removeFromEditSuffix.replace(/\/+$/g, ""),
    addTeamToView: commandCenterConfig.mainSequence.permissions.addTeamToViewSuffix.replace(/\/+$/g, ""),
    addTeamToEdit: commandCenterConfig.mainSequence.permissions.addTeamToEditSuffix.replace(/\/+$/g, ""),
    removeTeamFromView: commandCenterConfig.mainSequence.permissions.removeTeamFromViewSuffix.replace(/\/+$/g, ""),
    removeTeamFromEdit: commandCenterConfig.mainSequence.permissions.removeTeamFromEditSuffix.replace(/\/+$/g, ""),
  };

  const segments = route.replace(/^\/+|\/+$/g, "").split("/");
  if (segments.length < 2) {
    return undefined;
  }

  const last = segments.at(-1) ?? "";
  const rawObjectId = (segments.at(-2) ?? "").trim();

  if (!rawObjectId) {
    return undefined;
  }

  const objectId =
    /^-?\d+$/.test(rawObjectId) && Number.isSafeInteger(Number(rawObjectId))
      ? Number(rawObjectId)
      : rawObjectId;

  if (method === "GET" && last === normalizedSuffixes.candidateUsers) {
    return state.permissionCandidateUsers;
  }

  if (method === "GET" && last === normalizedSuffixes.canView) {
    return buildPermissionResponse(objectId, "view");
  }

  if (method === "GET" && last === normalizedSuffixes.canEdit) {
    return buildPermissionResponse(objectId, "edit");
  }

  if (
    method === "POST" &&
    [
      normalizedSuffixes.addToView,
      normalizedSuffixes.addToEdit,
      normalizedSuffixes.removeFromView,
      normalizedSuffixes.removeFromEdit,
      normalizedSuffixes.addTeamToView,
      normalizedSuffixes.addTeamToEdit,
      normalizedSuffixes.removeTeamFromView,
      normalizedSuffixes.removeTeamFromEdit,
    ].includes(last)
  ) {
    parseBody(init);
    return detailMessage("Permission updated in mock mode.");
  }

  return undefined;
}

function handleSharedResources(
  route: string,
  method: string,
  searchParams: URLSearchParams,
  init?: RequestInit,
) {
  if (route === "/billing/available-gpu-types/" && method === "GET") {
    return paginate(state.availableGpuTypes, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/billing/estimate-runtime-cost/" && method === "POST") {
    const body = parseBody(init) as
      | {
          source_details?: {
            resources?: {
              cpu?: unknown;
              memory?: unknown;
              gpu_request?: unknown;
            };
          };
        }
      | null;
    const resources = body?.source_details?.resources ?? {};
    const cpu = readNumber(resources.cpu);
    const memory = readNumber(resources.memory);
    const gpuRequest = readNumber(resources.gpu_request);
    const rates = {
      cpu: Number((cpu * 0.04).toFixed(5)),
      mem: Number((memory * 0.006).toFixed(5)),
      gpu: Number((gpuRequest * 1.2).toFixed(5)),
      storage: 0,
    };

    return {
      total_estimate: Number((rates.cpu + rates.mem + rates.gpu + rates.storage).toFixed(5)),
      rates,
      details: {
        units: "USD/hour",
      },
    };
  }

  return undefined;
}

function normalizeMainSequenceRoute(pathname: string) {
  const proxyPrefix = [devAuthProxyPrefix, devMainSequenceMarketsProxyPrefix].find((prefix) =>
    pathname.startsWith(prefix),
  );
  const normalizedPathname = proxyPrefix ? pathname.slice(proxyPrefix.length) || "/" : pathname;
  const route = normalizedPathname.replace(/\/+$/, "");
  const normalized = route ? `${route}/` : "/";

  if (normalized.startsWith(mainSequencePodsRoot)) {
    return normalized.slice(mainSequencePodsRoot.slice(0, -1).length);
  }

  if (normalized.startsWith(mainSequenceConnectionsRoot)) {
    return normalized.slice(mainSequenceConnectionsRoot.slice(0, -1).length);
  }

  if (
    normalized.startsWith(mainSequenceTsManagerRoot) ||
    normalized.startsWith(mainSequenceAssetsRoot)
  ) {
    return normalized;
  }

  return normalized;
}

export function getMainSequenceMockResponse<T>({
  requestUrl,
  init,
}: {
  requestUrl: string;
  init?: RequestInit;
}): T | undefined {
  const url = new URL(requestUrl, window.location.origin);
  const route = normalizeMainSequenceRoute(url.pathname);
  const method = (init?.method ?? "GET").toUpperCase();

  return (
    handleProjects(route, method, url.searchParams, init) ??
    handleAssets(route, method, url.searchParams, init) ??
    handlePricingMarketData(route, method, url.searchParams) ??
    handlePricingCurves(route, method, url.searchParams) ??
    handleIndexes(route, method, url.searchParams) ??
    handleAssetCategories(route, method, url.searchParams, init) ??
    handlePortfolioGroups(route, method, url.searchParams, init) ??
    handleTargetPortfolios(route, method, url.searchParams) ??
    handlePortfolioSignals(route, method, url.searchParams, init) ??
    handleInstrumentsConfiguration(route, method, init) ??
    handleVirtualFunds(route, method, url.searchParams, init) ??
    handleManagedAccounts(route, method, url.searchParams, init) ??
    handleProjectDataSources(route, method, url.searchParams, init) ??
    handlePhysicalDataSources(route, method, url.searchParams, init) ??
    handleClusters(route, method, url.searchParams, init) ??
    handleConstants(route, method, url.searchParams, init) ??
    handleSecrets(route, method, url.searchParams, init) ??
    handleBuckets(route, method, url.searchParams, init) ??
    handleSimpleTables(route, method, url.searchParams, init) ??
    handleDataNodes(route, method, url.searchParams, init) ??
    handleLocalTimeSeries(route, method, url.searchParams, init) ??
    handleResources(route, method, url.searchParams, init) ??
    handleJobs(route, method, url.searchParams, init) ??
    handlePermissions(route, method, init) ??
    handleSharedResources(route, method, url.searchParams, init) ??
    undefined
  ) as T | undefined;
}
