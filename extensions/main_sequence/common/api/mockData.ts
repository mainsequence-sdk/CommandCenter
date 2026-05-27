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
  assetCategories: Array<Record<string, unknown>>;
  virtualFunds: Array<Record<string, unknown>>;
  managedAccounts: Array<Record<string, unknown>>;
  managedAccountTargetPositionsByAccountUid: Record<string, Record<string, unknown>>;
  portfolioGroups: Array<Record<string, unknown>>;
  targetPortfolios: Array<Record<string, unknown>>;
  assetTranslationTables: Array<Record<string, unknown>>;
  assetTranslationTableRules: Array<Record<string, unknown>>;
  instrumentsConfiguration: Record<string, unknown>;
  projects: Array<Record<string, unknown>>;
  projectBaseImages: Array<Record<string, unknown>>;
  githubOrganizations: Array<Record<string, unknown>>;
  projectImages: Array<Record<string, unknown>>;
  projectResources: Array<Record<string, unknown>>;
  resourceReleases: Array<Record<string, unknown>>;
  resourceReleaseGallery: Array<Record<string, unknown>>;
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
    assetCategories: readDataset("asset_categories"),
    virtualFunds: readDataset("virtual_funds"),
    managedAccounts: readDataset("managed_accounts"),
    managedAccountTargetPositionsByAccountUid: {},
    portfolioGroups: readDataset("portfolio_groups"),
    targetPortfolios: readDataset("target_portfolios"),
    assetTranslationTables: readDataset("asset_translation_tables"),
    assetTranslationTableRules: readDataset("asset_translation_table_rules"),
    instrumentsConfiguration: readDataset("instruments_configuration"),
    projects: readDataset("projects"),
    projectBaseImages: readDataset("project_base_images"),
    githubOrganizations: readDataset("github_organizations"),
    projectImages: readDataset("project_images"),
    projectResources: readDataset("project_resources"),
    resourceReleases: readDataset("resource_releases"),
    resourceReleaseGallery: readDataset("resource_release_gallery"),
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
    readme,
  }: {
    badges?: Array<Record<string, unknown>>;
    inlineFields?: Array<Record<string, unknown>>;
    highlightFields?: Array<Record<string, unknown>>;
    stats?: Array<Record<string, unknown>>;
    extra?: Record<string, unknown>;
    readme?: Record<string, unknown>;
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
    ...(readme ? { readme } : {}),
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
  const indexAsset = (portfolio.index_asset ?? {}) as Record<string, unknown>;
  const currentSnapshot = (indexAsset.current_snapshot ?? {}) as Record<string, unknown>;

  return buildEntitySummary(
    readNumber(portfolio.id),
    "target_portfolio",
    readString(portfolio.portfolio_name),
    {
      inlineFields: [
        {
          key: "creation_date",
          label: "Created",
          value: readString(portfolio.creation_date),
          kind: "datetime",
        },
        {
          key: "index_asset",
          label: "Index asset",
          value: readString(currentSnapshot.name) || readString(currentSnapshot.ticker) || "Not set",
          kind: "text",
        },
      ],
      highlightFields: [
        {
          key: "strategy",
          label: "Rebalance strategy",
          value: readString(portfolio.rebalance_strategy_name) || "Signal-weighted allocation",
          kind: "text",
        },
        {
          key: "signal",
          label: "Signal",
          value: readString(portfolio.signal_name) || "Cross-asset momentum",
          kind: "text",
        },
      ],
      stats: [
        {
          key: "positions",
          label: "Positions",
          display: String(readArray(portfolio.weight_rows).length),
          value: readArray(portfolio.weight_rows).length,
          kind: "number",
        },
      ],
      extra: {
        description: readString(portfolio.description),
        signal_name: readString(portfolio.signal_name),
        rebalance_strategy_name: readString(portfolio.rebalance_strategy_name),
        weight_rows: readArray(portfolio.weight_rows),
        portfolio_weights: readArray(portfolio.weights),
      },
    },
  );
}

function buildResourceReleaseSummary(release: Record<string, unknown>) {
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
      ],
      inlineFields: [
        {
          key: "project_name",
          label: "Project",
          value: readString(release.project_name),
          kind: "text",
        },
        {
          key: "resource_name",
          label: "Resource",
          value: readString(release.resource_name),
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
        key: "storage_hash",
        label: "Storage hash",
        value: readString(dataNode.storage_hash),
        kind: "code",
      },
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
    readString(metaTable.storage_hash) || `Meta Table ${readString(metaTable.uid)}`,
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
    matchesSearch([cluster.id, cluster.uuid, cluster.cluster_name], searchParams.get("search")),
  );

  return {
    search: searchParams.get("search") ?? "",
    rows: filtered.map((cluster) => ({
      id: readNumber(cluster.id),
      uuid: readString(cluster.uuid),
      cluster_name: readString(cluster.cluster_name),
    })),
    pagination: buildFrontendPagination(
      filtered.length,
      searchParams.get("page"),
      searchParams.get("page_size"),
    ),
  };
}

function buildClusterDetail(cluster: Record<string, unknown>) {
  return {
    cluster: {
      id: readNumber(cluster.id),
      uuid: readString(cluster.uuid),
      cluster_name: readString(cluster.cluster_name),
      cluster_description: readString(cluster.cluster_description),
    },
    cluster_status: {
      status: readString(cluster.cluster_status),
      color: readString(cluster.cluster_status_color),
    },
    cloud_provider_label: readString(cluster.cloud_provider_label),
    location: readString(cluster.location),
    cluster_configuration_name: readString(cluster.cluster_configuration_name),
    allow_to_run_jupyter_hub: readBoolean(cluster.allow_to_run_jupyter_hub),
    allow_to_run_data_sources: readBoolean(cluster.allow_to_run_data_sources),
    is_auto_pilot_cluster: readBoolean(cluster.is_auto_pilot_cluster),
    stats_items: readArray(cluster.stats_items),
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
      id: tabId,
      label: tabId.replace(/_/g, " "),
      count: String(readArray(cluster[tabId]).length),
    })),
    summary_warning: readOptionalString(cluster.summary_warning),
  };
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
  if (route === "/api/v1/asset/" && method === "GET") {
    return paginate(filterAssets(searchParams, null), searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/api/v1/asset/query/" && method === "POST") {
    const body = parseBody(init);
    return paginate(filterAssets(searchParams, body), String(body?.limit ?? defaultPageSize), String(body?.offset ?? 0));
  }

  const detailMatch = route.match(/^\/api\/v1\/asset\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    return findByUid(state.assets, detailMatch[1] ?? "");
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

function handleAssetCategories(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/api/v1/asset-category/" && method === "GET") {
    const filtered = state.assetCategories.filter((category) =>
      matchesSearch(
        [category.id, category.unique_identifier, category.display_name, category.description],
        searchParams.get("search"),
      ),
    );
    return frontendRowsResponse(
      filtered.map((category) => ({
        id: readNumber(category.id),
        uid: readString(category.uid),
        unique_identifier: readString(category.unique_identifier),
        display_name: readString(category.display_name),
        description: readString(category.description),
        number_of_assets: readArray<number>(category.assets).length,
      })),
      searchParams.get("search"),
      searchParams.get("page"),
      searchParams.get("page_size"),
    );
  }

  if (route === "/api/v1/asset-category/" && method === "POST") {
    const body = parseBody(init);
    const id = nextId(state.assetCategories);
    const record = {
      id,
      uid: `mock-asset-category-${id}`,
      unique_identifier: readString(body?.unique_identifier) || `category_${Date.now()}`,
      display_name: readString(body?.display_name) || "New Category",
      description: readString(body?.description),
      assets: readArray<string>(body?.assets),
    };
    state.assetCategories.unshift(record);
    return record;
  }

  if (route === "/api/v1/asset-category/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const before = state.assetCategories.length;
    state.assetCategories = state.assetCategories.filter((category) => !uids.has(readString(category.uid)));
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
        id: categoryUid,
        text: readString(category?.display_name),
        sub_text: readString(category?.unique_identifier),
      },
      details: [
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

    return category;
  }

  if (detailMatch && method === "DELETE") {
    const categoryUid = detailMatch[1] ?? "";
    state.assetCategories = state.assetCategories.filter((category) => readString(category.uid) !== categoryUid);
    return null;
  }

  return undefined;
}

function handlePortfolioGroups(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/api/v1/portfolio_group/" && method === "GET") {
    const filtered = state.portfolioGroups.filter((group) =>
      matchesSearch(
        [group.id, group.name, group.display_name, group.unique_identifier, group.description],
        searchParams.get("search"),
      ),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/api/v1/portfolio_group/get_or_create/" && method === "POST") {
    const body = parseBody(init);
    const record = {
      id: nextId(state.portfolioGroups),
      uid: `mock-portfolio-group-${nextId(state.portfolioGroups)}`,
      name: readString(body?.display_name) || readString(body?.unique_identifier) || "Portfolio Group",
      display_name: readString(body?.display_name) || "Portfolio Group",
      portfolio_group_name: readString(body?.display_name) || "Portfolio Group",
      unique_identifier: readString(body?.unique_identifier) || `pg_${Date.now()}`,
      description: readString(body?.description),
      portfolio_uids: readArray<string>(body?.portfolios),
      creation_date: new Date().toISOString(),
    };
    state.portfolioGroups.unshift(record);
    return record;
  }

  if (route === "/api/v1/portfolio_group/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const before = state.portfolioGroups.length;
    state.portfolioGroups = state.portfolioGroups.filter((group) => !uids.has(readString(group.uid)));
    return {
      detail: "Portfolio groups removed from mock state.",
      deleted_count: before - state.portfolioGroups.length,
    };
  }

  const detailMatch = route.match(/^\/api\/v1\/portfolio_group\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    return findByUid(state.portfolioGroups, detailMatch[1] ?? "");
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

function handleTargetPortfolios(route: string, method: string, searchParams: URLSearchParams) {
  if (route === "/api/v1/target_portfolio/" && method === "GET") {
    const filtered = state.targetPortfolios.filter((portfolio) =>
      matchesSearch(
        [
          portfolio.id,
          portfolio.portfolio_name,
          (portfolio.index_asset as Record<string, unknown> | undefined)?.current_snapshot,
        ],
        searchParams.get("search") ?? searchParams.get("index_asset__current_snapshot__name"),
      ),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/api/v1/target_portfolio/bulk-delete/" && method === "POST") {
    return {
      detail: "Target portfolios removed from mock state.",
      deleted_count: 0,
    };
  }

  const summaryMatch = route.match(/^\/api\/v1\/target_portfolio\/([^/]+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const portfolioUid = summaryMatch[1] ?? "";
    const portfolio = findByUid(state.targetPortfolios, portfolioUid);
    return buildTargetPortfolioSummary(portfolio ?? { uid: portfolioUid, portfolio_name: `Portfolio ${portfolioUid}` });
  }

  const weightsMatch = route.match(/^\/api\/v1\/target_portfolio\/([^/]+)\/weights-position-details\/$/);
  if (weightsMatch && method === "GET") {
    const portfolio = findByUid(state.targetPortfolios, weightsMatch[1] ?? "");
    return {
      weights: readArray(portfolio?.weights),
      position_columns: [],
      rows: readArray(portfolio?.weight_rows),
      columnDefs: [
        { field: "asset_ticker", headerName: "Ticker" },
        { field: "asset_name", headerName: "Asset" },
        { field: "position_value", headerName: "Weight" },
      ],
      summaryColumnDefs: [
        { field: "label", headerName: "Bucket" },
        { field: "value", headerName: "Weight" },
      ],
      position_map: null,
      weights_date: readString(portfolio?.weights_date) || new Date().toISOString(),
    };
  }

  return undefined;
}

function handleTranslationTables(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (
    (route === "/api/v1/asset-translation-tables/" && method === "GET") ||
    (route === "/api/v1/asset-translation-tables/query/" && method === "POST")
  ) {
    const body = parseBody(init);
    const search = searchParams.get("search") ?? readOptionalString(body?.search);
    const filtered = state.assetTranslationTables.filter((table) =>
      matchesSearch([table.id, table.unique_identifier], search),
    );
    return frontendRowsResponse(
      filtered.map((table) => ({
        id: readNumber(table.id),
        uid: readString(table.uid),
        unique_identifier: readString(table.unique_identifier),
        rules_number: state.assetTranslationTableRules.filter(
          (rule) => readString(rule.table_uid) === readString(table.uid),
        ).length,
        creation_date: readString(table.creation_date),
      })),
      search,
      searchParams.get("page") ?? String(body?.page ?? 1),
      searchParams.get("page_size") ?? String(body?.page_size ?? defaultPageSize),
    );
  }

  if (route === "/api/v1/asset-translation-tables/" && method === "POST") {
    const body = parseBody(init);
    const id = nextId(state.assetTranslationTables);
    const record = {
      id,
      uid: `mock-asset-translation-table-${id}`,
      unique_identifier: readString(body?.unique_identifier) || `translation_${Date.now()}`,
      creation_date: new Date().toISOString(),
    };
    state.assetTranslationTables.unshift(record);
    return record;
  }

  if (route === "/api/v1/asset-translation-tables/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
    const before = state.assetTranslationTables.length;
    state.assetTranslationTables = state.assetTranslationTables.filter((table) => !uids.has(readString(table.uid)));
    state.assetTranslationTableRules = state.assetTranslationTableRules.filter((rule) => !uids.has(readString(rule.table_uid)));
    return {
      detail: "Asset translation tables removed from mock state.",
      deleted_count: before - state.assetTranslationTables.length,
    };
  }

  const detailMatch = route.match(/^\/api\/v1\/asset-translation-tables\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    const tableUid = detailMatch[1] ?? "";
    const table = findByUid(state.assetTranslationTables, tableUid);
    return {
      uid: tableUid,
      title: readString(table?.unique_identifier) || `Table ${tableUid}`,
      selected_table: {
        id: tableUid,
        text: readString(table?.unique_identifier),
        sub_text: `Rules: ${state.assetTranslationTableRules.filter((rule) => readString(rule.table_uid) === tableUid).length}`,
      },
      details: [
        {
          name: "unique_identifier",
          label: "Identifier",
          value_type: "text",
          value: readString(table?.unique_identifier),
        },
        {
          name: "creation_date",
          label: "Created",
          value_type: "datetime",
          value: readString(table?.creation_date),
        },
      ],
      actions: {
        can_edit: true,
        can_delete: true,
        update_endpoint: `/api/v1/asset-translation-tables/${tableUid}/`,
        delete_endpoint: `/api/v1/asset-translation-tables/${tableUid}/`,
      },
      rules_list: {
        list_endpoint: `/api/v1/asset-translation-tables/${tableUid}/rules/`,
        response_format: "frontend_list",
        create_endpoint: `/api/v1/asset-translation-tables/${tableUid}/rules/`,
      },
    };
  }

  if (detailMatch && method === "PATCH") {
    const table = findByUid(state.assetTranslationTables, detailMatch[1] ?? "");
    Object.assign(table ?? {}, parseBody(init) ?? {});
    return table;
  }

  if (detailMatch && method === "DELETE") {
    const tableUid = detailMatch[1] ?? "";
    state.assetTranslationTables = state.assetTranslationTables.filter((table) => readString(table.uid) !== tableUid);
    state.assetTranslationTableRules = state.assetTranslationTableRules.filter((rule) => readString(rule.table_uid) !== tableUid);
    return null;
  }

  const rulesMatch = route.match(/^\/api\/v1\/asset-translation-tables\/([^/]+)\/rules\/$/);
  if (rulesMatch && method === "GET") {
    const tableUid = rulesMatch[1] ?? "";
    const filtered = state.assetTranslationTableRules.filter(
      (rule) =>
        readString(rule.table_uid) === tableUid &&
        matchesSearch(
          [
            rule.id,
            rule.security_type,
            rule.security_market_sector,
            rule.markets_time_serie_unique_identifier,
            rule.target_exchange_code,
            rule.default_column_name,
          ],
          searchParams.get("search"),
        ),
    );
    return frontendRowsResponse(filtered, searchParams.get("search"), searchParams.get("page"), searchParams.get("page_size"));
  }

  if (rulesMatch && method === "POST") {
    const tableUid = rulesMatch[1] ?? "";
    const body = parseBody(init);
    const assetFilter = (body?.asset_filter ?? {}) as Record<string, unknown>;
    const ruleUid = `mock-asset-translation-rule-${Date.now()}`;
    const record = {
      id: nextId(state.assetTranslationTableRules),
      uid: ruleUid,
      table_uid: tableUid,
      security_type: readOptionalString(assetFilter.security_type),
      security_market_sector: readOptionalString(assetFilter.security_market_sector),
      markets_time_serie_unique_identifier: readString(body?.markets_time_serie_unique_identifier),
      target_exchange_code: readOptionalString(body?.target_exchange_code),
      default_column_name: readOptionalString(body?.default_column_name),
      creation_date: new Date().toISOString(),
      detail_endpoint: `/api/v1/asset-translation-tables/${tableUid}/rules/${ruleUid}/`,
      update_endpoint: `/api/v1/asset-translation-tables/${tableUid}/rules/${ruleUid}/`,
      delete_endpoint: `/api/v1/asset-translation-tables/${tableUid}/rules/${ruleUid}/`,
    };
    state.assetTranslationTableRules.unshift(record);
    return record;
  }

  const ruleDetailMatch = route.match(/^\/api\/v1\/asset-translation-tables\/([^/]+)\/rules\/([^/]+)\/$/);
  if (ruleDetailMatch && method === "PATCH") {
    const rule = findByUid(state.assetTranslationTableRules, ruleDetailMatch[2] ?? "");
    const body = parseBody(init);
    const assetFilter = (body?.asset_filter ?? {}) as Record<string, unknown>;

    if (rule) {
      rule.security_type = readOptionalString(assetFilter.security_type);
      rule.security_market_sector = readOptionalString(assetFilter.security_market_sector);
      rule.markets_time_serie_unique_identifier = readString(body?.markets_time_serie_unique_identifier);
      rule.target_exchange_code = readOptionalString(body?.target_exchange_code);
      rule.default_column_name = readOptionalString(body?.default_column_name);
    }

    return rule;
  }

  if (ruleDetailMatch && method === "DELETE") {
    const ruleUid = ruleDetailMatch[2] ?? "";
    state.assetTranslationTableRules = state.assetTranslationTableRules.filter((rule) => readString(rule.uid) !== ruleUid);
    return {
      detail: "Translation rule deleted from mock state.",
      deleted_rule: true,
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
  if (route === "/api/v1/virtualfund/" && method === "GET") {
    const filtered = state.virtualFunds.filter((fund) =>
      matchesSearch(
        [fund.uid, fund.id, fund.target_portfolio_name, fund.account_name],
        searchParams.get("search"),
      ),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/api/v1/virtualfund/" && method === "POST") {
    const body = parseBody(init);
    const record = {
      uid: readOptionalString(body?.uid) || `virtual-fund-${Date.now()}`,
      id: nextId(state.virtualFunds),
      target_portfolio_uid: readOptionalString(body?.target_portfolio_uid ?? body?.target_portfolio) || null,
      target_portfolio_name:
        readString(body?.target_portfolio_name) || "Virtual Fund Portfolio",
      account_uid: readOptionalString(body?.account_uid ?? body?.related_account ?? body?.account) || null,
      account_name: readString(body?.account_name) || "Managed Account",
      ...((body as Record<string, unknown> | null) ?? {}),
    };
    state.virtualFunds.unshift(record);
    return record;
  }

  const detailMatch = route.match(/^\/api\/v1\/virtualfund\/([^/]+)\/$/);
  if (detailMatch && method === "GET") {
    const fundUid = decodeURIComponent(detailMatch[1]);
    return state.virtualFunds.find((fund) => readOptionalString(fund.uid) === fundUid);
  }

  if (detailMatch && method === "PATCH") {
    const fundUid = decodeURIComponent(detailMatch[1]);
    const record = state.virtualFunds.find((fund) => readOptionalString(fund.uid) === fundUid);
    Object.assign(record ?? {}, parseBody(init) ?? {});
    return record;
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

  const holdingsMatch = route.match(/^\/api\/v1\/account\/([^/]+)\/holdings\/$/);

  if (holdingsMatch && method === "GET") {
    const accountUid = decodeURIComponent(holdingsMatch[1]);
    const account = findManagedAccountByUid(accountUid);

    if (!account) {
      return [];
    }

    const holdingsDate = searchParams.get("holdings_date") || "2026-05-18T09:30:00Z";

    return [
      {
        id: 0,
        snapshot_uid: `mock-holdings-snapshot-${accountUid}`,
        holdings_set_uid: `mock-holdings-set-${accountUid}`,
        holdings_date: holdingsDate,
        nav: "1250.25000000",
        related_account: 0,
        is_trade_snapshot: false,
        target_trade_time: null,
        related_expected_asset_exposure_df: [],
        holdings: [
          {
            time_index: holdingsDate,
            unique_identifier: "btc_spot",
            asset: 101,
            asset_id: 101,
            price: "100.000000000000000000",
            quantity: "12.00000000",
            missing_price: false,
            extra_details: {},
          },
        ],
      },
    ];
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

    return {
      related_account: 0,
      holdings_date: readString(body.holdings_date) || new Date().toISOString(),
      holdings_set_uid: `mock-holdings-set-${accountUid}`,
      positions: positions.map((position) => ({
        unique_identifier: readString(position.unique_identifier) || null,
        asset_id: readNumber(position.asset_id) || null,
        position_type: readString(position.position_type) || "units",
        price: readString(position.price) || "0",
        quantity: readString(position.quantity) || "0",
        missing_price: readBoolean(position.missing_price),
        target_trade_time: readString(position.target_trade_time) || null,
        extra_details:
          isRecord(position.extra_details) ? position.extra_details : {},
      })),
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
      const asset = uniqueIdentifier ? findAssetByUniqueIdentifier(uniqueIdentifier) : null;
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
          key: "related_resource",
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
        cancel_path: "/app/main_sequence_workbench/project-data-sources",
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
        (source) => readString(source.uid) === readString(body?.related_resource),
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
      redirect_path: `/app/main_sequence_workbench/project-data-sources?msProjectDataSourceUid=${record.uid}&msProjectDataSourceView=edit`,
    };
  }

  if (route === "/orm/api/ts_manager/dynamic_table_data_source/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const uids = new Set(readArray<string>(body?.uids));
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
          key: "related_resource",
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
        cancel_path: "/app/main_sequence_workbench/project-data-sources",
        delete: {
          method: "POST",
          path: `/orm/api/ts_manager/dynamic_table_data_source/${editMatch[1]}/delete/`,
          redirect_path: "/app/main_sequence_workbench/project-data-sources",
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
        state.physicalDataSources.find((source) => readString(source.uid) === readString(body?.related_resource)) ??
        record.related_resource;
    }

    return {
      detail: "Project data source updated.",
      id: readNumber(record?.id),
      uid: readString(record?.uid),
      display_name: readString(record?.display_name),
      redirect_path: `/app/main_sequence_workbench/project-data-sources?msProjectDataSourceUid=${editMatch[1]}&msProjectDataSourceView=edit`,
    };
  }

  const deleteMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table_data_source\/([^/]+)\/delete\/$/);
  if (deleteMatch && method === "POST") {
    const uid = deleteMatch[1] ?? "";
    state.projectDataSources = state.projectDataSources.filter((item) => readString(item.uid) !== uid);
    return {
      detail: "Project data source deleted.",
      uid,
      redirect_path: "/app/main_sequence_workbench/project-data-sources",
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
      ],
      actions: {
        submit: {
          method: "POST",
          path: "/data_source/",
        },
        cancel_path: "/app/main_sequence_workbench/physical-data-sources",
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
      creation_date: new Date().toISOString(),
      creation_date_display: "Just now",
    };
    state.physicalDataSources.unshift(record);
    return {
      detail: "Physical data source created.",
      id: readNumber(record.id),
      uid: readString(record.uid),
      display_name: readString(record.display_name),
      redirect_path: `/app/main_sequence_workbench/physical-data-sources?msPhysicalDataSourceUid=${record.uid}&msPhysicalDataSourceView=edit`,
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
      ],
      actions: {
        submit: {
          method: "PATCH",
          path: `/data_source/${editMatch[1]}/`,
        },
        cancel_path: "/app/main_sequence_workbench/physical-data-sources",
        delete: {
          method: "POST",
          path: `/data_source/${editMatch[1]}/delete/`,
          redirect_path: "/app/main_sequence_workbench/physical-data-sources",
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
      redirect_path: `/app/main_sequence_workbench/physical-data-sources?msPhysicalDataSourceUid=${editMatch[1]}&msPhysicalDataSourceView=edit`,
    };
  }

  const deleteMatch = route.match(/^\/data_source\/([^/]+)\/delete\/$/);
  if (deleteMatch && method === "POST") {
    const uid = deleteMatch[1] ?? "";
    state.physicalDataSources = state.physicalDataSources.filter((source) => readString(source.uid) !== uid);
    return {
      detail: "Physical data source deleted.",
      uid,
      redirect_path: "/app/main_sequence_workbench/physical-data-sources",
    };
  }

  return undefined;
}

function handleClusters(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/cluster/" && method === "GET" && searchParams.get("response_format") === "clusters_list") {
    return buildClusterList(searchParams);
  }

  const detailMatch = route.match(/^\/cluster\/([^/]+)\/$/);
  if (detailMatch && method === "GET" && searchParams.get("response_format") === "cluster_detail") {
    const clusterUid = detailMatch[1] ?? "";
    const cluster = state.clusters.find((candidate) => readString(candidate.uuid) === clusterUid) ?? null;
    return buildClusterDetail(cluster ?? { uuid: clusterUid, cluster_name: `Cluster ${clusterUid}` });
  }

  const scaleMatch = route.match(/^\/cluster\/([^/]+)\/scale\/$/);
  if (scaleMatch && method === "POST") {
    const body = parseBody(init);
    return {
      detail: `Cluster ${scaleMatch[1]} scale accepted.`,
      message: `Desired node count set to ${readNumber(body?.desired_node_count)} in mock mode.`,
    };
  }

  const clusterTabMatch = route.match(/^\/cluster\/([^/]+)\/(node-pools|nodes|namespaces|pods|deployments|services|storage|knative)\/$/);
  if (clusterTabMatch && method === "GET") {
    const cluster = state.clusters.find((candidate) => readString(candidate.uuid) === (clusterTabMatch[1] ?? "")) ?? null;
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

  if (route === "/orm/api/ts_manager/dynamic_table/namespaces/" && method === "GET") {
    return buildMockNamespaceRows(state.dataNodes);
  }

  if (route === "/orm/api/ts_manager/dynamic_table/" && method === "GET") {
    const query = searchParams.get("q");
    const namespace = readString(searchParams.get("namespace")).trim();
    const filtered = sortDescendingById(
      state.dataNodes.filter((node) => {
        if (namespace && readOptionalString(node.namespace)?.trim() !== namespace) {
          return false;
        }

        return matchesSearch([node.id, node.storage_hash, node.identifier, node.description], query);
      }),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/orm/api/ts_manager/dynamic_table/quick-search/" && method === "GET") {
    return state.dataNodes
      .filter((node) =>
        matchesSearch([node.storage_hash, node.identifier], searchParams.get("q")),
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

  if (route === "/orm/api/ts_manager/dynamic_table/bulk-set-next-update-from-last-index-value/" && method === "POST") {
    const body = parseBody(init);
    const selectedUids = readArray<string>(body?.selected_uids);
    return {
      ok: true,
      action: "set_next_update",
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
        detail: "Next update aligned to last index value in mock mode.",
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
    const uids = new Set(readArray<string>(body?.uids));
    const before = state.projectImages.length;
    state.projectImages = state.projectImages.filter((image) => !uids.has(readString(image.uid)));
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

  if (route === "/resource-release/" && method === "GET") {
    return paginate(sortDescendingById(state.resourceReleases), searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/resource-release/" && method === "POST") {
    const body = parseBody(init);
    const resource = state.projectResources.find((item) => readString(item.uid) === readString(body?.resource));
    const image = state.projectImages.find((item) => readString(item.uid) === readString(body?.related_image));
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
      resource: readString(body?.resource),
      readme_resource: null,
      related_job: readNumber(job?.id),
      release_kind: readString(body?.release_kind) || "streamlit_dashboard",
      title: readString(resource?.name),
      resource_uid: readString(resource?.uid),
      resource_name: readString(resource?.name),
      project_uid: readString(project?.uid),
      project_name: readString(project?.project_name),
      image_uid: readString(image?.uid),
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
    const filtered = sortDescendingById(
      state.resourceReleaseGallery.filter((release) => {
        if (!exclude) {
          return true;
        }

        const releaseKind = lowerNeedle(readString(release.release_kind));
        return releaseKind !== exclude && `${releaseKind}s` !== exclude;
      }),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  const releaseSummaryMatch = route.match(/^\/resource-release\/([^/]+)\/summary\/$/);
  if (releaseSummaryMatch && method === "GET") {
    const releaseUid = releaseSummaryMatch[1] ?? "";
    const release = findByUid(state.resourceReleaseGallery, releaseUid) ??
      findByUid(state.resourceReleases, releaseUid);
    return buildResourceReleaseSummary(release ?? { uid: releaseUid, title: `Release ${releaseUid}` });
  }

  const releaseDeleteMatch = route.match(/^\/resource-release\/([^/]+)\/$/);
  if (releaseDeleteMatch && method === "DELETE") {
    const releaseUid = releaseDeleteMatch[1] ?? "";
    state.resourceReleases = state.resourceReleases.filter((release) => readString(release.uid) !== releaseUid);
    state.resourceReleaseGallery = state.resourceReleaseGallery.filter((release) => readString(release.uid) !== releaseUid);
    return null;
  }

  const launchMatch = route.match(/^\/resource-release\/([^/]+)\/exchange-launch\/$/);
  if (launchMatch && method === "GET") {
    const release = findByUid(state.resourceReleaseGallery, launchMatch[1] ?? "");
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
        job_detail_url: `/app/main_sequence_workbench/jobs?msJobUid=${run.job_uid}`,
        job_run_detail_url: `/app/main_sequence_workbench/jobs?msJobUid=${run.job_uid}&msJobRunUid=${run.uid}`,
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
      job_detail_url: `/app/main_sequence_workbench/jobs?msJobUid=${job.uid}`,
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
    handleAssetCategories(route, method, url.searchParams, init) ??
    handlePortfolioGroups(route, method, url.searchParams, init) ??
    handleTargetPortfolios(route, method, url.searchParams) ??
    handleTranslationTables(route, method, url.searchParams, init) ??
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
