import { commandCenterConfig } from "@/config/command-center";

const mockJsonModules = import.meta.glob("/mock_data/mainsequence/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const defaultPageSize = 25;
const devAuthProxyPrefix = "/__command_center_auth__";
const mainSequencePodsRoot = "/orm/api/pods/";
const mainSequenceTsManagerRoot = "/orm/api/ts_manager/";
const mainSequenceAssetsRoot = "/orm/api/assets/";

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
  executionVenues: Array<Record<string, unknown>>;
  virtualFunds: Array<Record<string, unknown>>;
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
  simpleTableUpdates: Array<Record<string, unknown>>;
  permissionCandidateUsers: Array<Record<string, unknown>>;
  teams: Array<Record<string, unknown>>;
  availableGpuTypes: Array<Record<string, unknown>>;
  projectRepositories: Array<Record<string, unknown>>;
  dataNodeRowsByEndpoint?: unknown;
  dataNodeLastObservationByEndpoint?: unknown;
  dependencyGraphsByEndpoint?: unknown;
};

function createMockState(): MockState {
  return {
    assets: readDataset("assets"),
    assetCategories: readDataset("asset_categories"),
    executionVenues: readDataset("execution_venues"),
    virtualFunds: readDataset("virtual_funds"),
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
    simpleTableUpdates: readCollectionDataset("simple_table_updates"),
    permissionCandidateUsers: readDataset("permission_candidate_users"),
    teams: readDataset("teams"),
    availableGpuTypes: readDataset("available_gpu_types"),
    projectRepositories: readDataset("project_repositories"),
    dataNodeRowsByEndpoint: readOptionalDataset("get_data_between_dates_from_remote"),
    dataNodeLastObservationByEndpoint: readOptionalDataset("get_last_observation"),
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

function hasSingleMatchingMockDataNode(dataNodeId: string) {
  return (
    state.dataNodes.length === 1 &&
    String(readNumber(state.dataNodes[0]?.id)) === dataNodeId
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
  sourceKind: "local_time_serie" | "simple_table_update";
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

function resolveMockDataNodeRemoteRows(dataNodeId: string) {
  const endpointPayload = state.dataNodeRowsByEndpoint;

  if (isRecord(endpointPayload) && dataNodeId in endpointPayload) {
    const keyedPayload = endpointPayload[dataNodeId];
    const keyedPayloadRows = normalizeRecordArrayPayload(keyedPayload);

    if (keyedPayloadRows.length > 0) {
      return keyedPayloadRows;
    }
  }

  if (hasSingleMatchingMockDataNode(dataNodeId)) {
    return normalizeRecordArrayPayload(endpointPayload);
  }

  return [];
}

function resolveMockDataNodeLastObservation(dataNodeId: string) {
  const endpointPayload = state.dataNodeLastObservationByEndpoint;

  if (isRecord(endpointPayload) && dataNodeId in endpointPayload) {
    const keyedPayload = endpointPayload[dataNodeId];
    const keyedObservation = normalizeSingleRecordPayload(keyedPayload);

    if (keyedObservation) {
      return keyedObservation;
    }
  }

  const explicitObservation = normalizeSingleRecordPayload(endpointPayload);

  if (explicitObservation && !isRecord(endpointPayload) && hasSingleMatchingMockDataNode(dataNodeId)) {
    return explicitObservation;
  }

  if (hasSingleMatchingMockDataNode(dataNodeId)) {
    const endpointRows = normalizeRecordArrayPayload(endpointPayload);
    const latestEndpointRow = getLatestRecordByTimeIndex(endpointRows);

    if (latestEndpointRow) {
      return latestEndpointRow;
    }
  }

  const rows = resolveMockDataNodeRemoteRows(dataNodeId);
  return getLatestRecordByTimeIndex(rows) ?? rows.at(-1) ?? null;
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

function findById(rows: Array<Record<string, unknown>>, id: number) {
  return rows.find((row) => readNumber(row.id) === id) ?? null;
}

function filterAssets(searchParams: URLSearchParams, body: Record<string, unknown> | null) {
  const search = searchParams.get("search") ?? readOptionalString(body?.search);
  const ticker = searchParams.get("ticker") ?? readOptionalString(body?.ticker);
  const name = searchParams.get("name") ?? readOptionalString(body?.name);
  const exchangeCode =
    searchParams.get("exchange_code") ?? readOptionalString(body?.exchange_code);
  const categoryId =
    Number(searchParams.get("categories__id") ?? body?.categories__id ?? "") || null;

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

      if (
        categoryId &&
        !readArray<number>(asset.category_ids).includes(categoryId)
      ) {
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
  id: number,
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

  return buildEntitySummary(readNumber(project.id), "project", readString(project.project_name), {
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
    readNumber(release.id),
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
          key: "image_id",
          label: "Image ID",
          display: String(readNumber(release.image_id) || 0),
          value: readNumber(release.image_id) || 0,
          kind: "number",
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

function buildSimpleTableSummary(simpleTable: Record<string, unknown>) {
  const columns = readArray(simpleTable.columns);
  const foreignKeys = readArray(simpleTable.foreign_keys);
  const updates = state.simpleTableUpdates.filter(
    (update) =>
      readNumber((update.remote_table as Record<string, unknown> | null)?.id) ===
      readNumber(simpleTable.id),
  );

  return buildEntitySummary(
    readNumber(simpleTable.id),
    "simple_table",
    readString(simpleTable.storage_hash) || `Simple Table ${simpleTable.id}`,
    {
      badges: [
        {
          key: "visibility",
          label: readBoolean(simpleTable.open_for_everyone) ? "Public" : "Private",
          tone: readBoolean(simpleTable.open_for_everyone) ? "success" : "neutral",
        },
      ],
      inlineFields: [
        {
          key: "identifier",
          label: "Identifier",
          value: readString(simpleTable.identifier) || "Not set",
          kind: "text",
        },
        {
          key: "description",
          label: "Description",
          value: readString(simpleTable.description) || "No description",
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
        {
          key: "updates",
          label: "Updates",
          display: String(updates.length),
          value: updates.length,
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

function buildProjectRepositoryBrowser(projectId: number, currentPath: string) {
  const normalizedPath = currentPath.replace(/^\/+|\/+$/g, "");
  const prefix = normalizedPath ? `${normalizedPath}/` : "";
  const entries = state.projectRepositories.filter(
    (entry) =>
      readNumber(entry.project_id) === projectId &&
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
    project_id: projectId,
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

function buildProjectResourceCode(projectId: number, path: string) {
  const normalizedPath = path.replace(/^\/+/, "");
  const entry = state.projectRepositories.find(
    (candidate) =>
      readNumber(candidate.project_id) === projectId &&
      readString(candidate.path) === normalizedPath &&
      readString(candidate.type) === "file",
  );

  const fallbackName = normalizedPath.split("/").at(-1) ?? normalizedPath;

  return {
    project_id: projectId,
    path: normalizedPath,
    name: fallbackName,
    language: fallbackName.endsWith(".py") ? "python" : fallbackName.endsWith(".sql") ? "sql" : "text",
    content: readString(entry?.content) || "# Mock content\n",
  };
}

function buildBucketBrowse(bucketId: number, searchParams: URLSearchParams) {
  const prefix = readString(searchParams.get("prefix"));
  const search = readString(searchParams.get("search"));
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = 25;
  const bucket = findById(state.buckets, bucketId);
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
    bucket_id: bucketId,
    bucket_name: readString(bucket?.name) || `Bucket ${bucketId}`,
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

function buildPermissionResponse(objectId: number, accessLevel: "view" | "edit") {
  const users = readArray<Record<string, unknown>>(
    accessLevel === "view" ? state.permissionCandidateUsers.slice(0, 2) : state.permissionCandidateUsers.slice(2, 3),
  );
  const teams = readArray<Record<string, unknown>>(accessLevel === "view" ? state.teams.slice(0, 1) : state.teams.slice(1, 2));

  return {
    object_id: objectId,
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

  if (route === "/projects/" && method === "POST") {
    const body = parseBody(init);
    const record = {
      id: nextId(state.projects),
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
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.projects.length;
    state.projects = state.projects.filter((project) => !ids.has(readNumber(project.id)));
    return {
      deleted_count: before - state.projects.length,
      detail: "Projects removed from mock state.",
    };
  }

  const summaryMatch = route.match(/^\/projects\/(\d+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const project = findById(state.projects, Number(summaryMatch[1]));
    return buildProjectSummary(project ?? { id: Number(summaryMatch[1]), project_name: `Project ${summaryMatch[1]}` });
  }

  const deleteMatch = route.match(/^\/projects\/(\d+)\/$/);
  if (deleteMatch && method === "DELETE") {
    const id = Number(deleteMatch[1]);
    state.projects = state.projects.filter((project) => readNumber(project.id) !== id);
    return detailMessage("Project deleted from mock state.");
  }

  const browseMatch = route.match(/^\/projects\/(\d+)\/browse-repository\/$/);
  if (browseMatch && method === "GET") {
    return buildProjectRepositoryBrowser(Number(browseMatch[1]), searchParams.get("path") ?? "");
  }

  const codeMatch = route.match(/^\/projects\/(\d+)\/resource-code\/$/);
  if (codeMatch && method === "GET") {
    return buildProjectResourceCode(Number(codeMatch[1]), searchParams.get("path") ?? "");
  }

  return undefined;
}

function handleAssets(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/orm/api/assets/asset/" && method === "GET") {
    return paginate(filterAssets(searchParams, null), searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/orm/api/assets/asset/query/" && method === "POST") {
    const body = parseBody(init);
    return paginate(filterAssets(searchParams, body), String(body?.limit ?? defaultPageSize), String(body?.offset ?? 0));
  }

  if (route === "/orm/api/assets/asset/summary/" && method === "GET") {
    const filtered = filterAssets(searchParams, null);
    return buildEntitySummary(0, "asset_registry", "Assets", {
      inlineFields: [
        {
          key: "search",
          label: "Search",
          value: searchParams.get("search") || "All assets",
          kind: "text",
        },
      ],
      stats: [
        {
          key: "assets",
          label: "Assets",
          display: String(filtered.length),
          value: filtered.length,
          kind: "number",
        },
      ],
    });
  }

  const detailMatch = route.match(/^\/orm\/api\/assets\/asset\/(\d+)\/$/);
  if (detailMatch && method === "GET") {
    return findById(state.assets, Number(detailMatch[1]));
  }

  const orderFieldsMatch = route.match(/^\/orm\/api\/assets\/asset\/(\d+)\/order-form-fields\/$/);
  if (orderFieldsMatch && method === "GET") {
    const asset = findById(state.assets, Number(orderFieldsMatch[1]));
    const orderFieldsByType = (asset?.order_form_fields ?? {}) as Record<string, unknown>;
    const orderType = searchParams.get("order_type") ?? "";
    return readArray(orderFieldsByType[orderType]) || readArray(asset?.order_form_default_fields);
  }

  if (route === "/orm/api/assets/asset/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.assets.length;
    state.assets = state.assets.filter((asset) => !ids.has(readNumber(asset.id)));
    return {
      detail: "Assets removed from mock state.",
      deleted_count: before - state.assets.length,
    };
  }

  return undefined;
}

function handleAssetCategories(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/orm/api/assets/asset-category/" && method === "GET") {
    const filtered = state.assetCategories.filter((category) =>
      matchesSearch(
        [category.id, category.unique_identifier, category.display_name, category.description],
        searchParams.get("search"),
      ),
    );
    return frontendRowsResponse(
      filtered.map((category) => ({
        id: readNumber(category.id),
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

  if (route === "/orm/api/assets/asset-category/" && method === "POST") {
    const body = parseBody(init);
    const record = {
      id: nextId(state.assetCategories),
      unique_identifier: readString(body?.unique_identifier) || `category_${Date.now()}`,
      display_name: readString(body?.display_name) || "New Category",
      description: readString(body?.description),
      assets: readArray<number>(body?.assets),
    };
    state.assetCategories.unshift(record);
    return record;
  }

  if (route === "/orm/api/assets/asset-category/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.assetCategories.length;
    state.assetCategories = state.assetCategories.filter((category) => !ids.has(readNumber(category.id)));
    return {
      detail: "Asset categories removed from mock state.",
      deleted_count: before - state.assetCategories.length,
    };
  }

  const detailMatch = route.match(/^\/orm\/api\/assets\/asset-category\/(\d+)\/$/);
  if (detailMatch && method === "GET") {
    const categoryId = Number(detailMatch[1]);
    const category = findById(state.assetCategories, categoryId);
    return {
      id: categoryId,
      title: readString(category?.display_name) || `Category ${categoryId}`,
      selected_category: {
        id: categoryId,
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
        update_endpoint: `/orm/api/assets/asset-category/${categoryId}/`,
        delete_endpoint: `/orm/api/assets/asset-category/${categoryId}/`,
      },
      assets_list: {
        list_endpoint: "/orm/api/assets/asset/",
        query_endpoint: "/orm/api/assets/asset/query/",
        response_format: "frontend_list",
        default_filters: {
          categories__id: categoryId,
        },
      },
    };
  }

  if (detailMatch && method === "PATCH") {
    const categoryId = Number(detailMatch[1]);
    const category = findById(state.assetCategories, categoryId);
    const body = parseBody(init);

    if (category) {
      Object.assign(category, body ?? {});
    }

    return category;
  }

  if (detailMatch && method === "DELETE") {
    const categoryId = Number(detailMatch[1]);
    state.assetCategories = state.assetCategories.filter((category) => readNumber(category.id) !== categoryId);
    return null;
  }

  return undefined;
}

function handleExecutionVenues(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/orm/api/assets/execution_venue/" && method === "GET") {
    const filtered = state.executionVenues.filter((venue) =>
      matchesSearch([venue.id, venue.symbol, venue.name], searchParams.get("search")),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/orm/api/assets/execution_venue/" && method === "POST") {
    const body = parseBody(init);
    const record = {
      id: nextId(state.executionVenues),
      symbol: readString(body?.symbol) || "NEW",
      name: readString(body?.name) || "New Venue",
    };
    state.executionVenues.unshift(record);
    return record;
  }

  const detailMatch = route.match(/^\/orm\/api\/assets\/execution_venue\/(\d+)\/$/);
  if (detailMatch && method === "GET") {
    return findById(state.executionVenues, Number(detailMatch[1]));
  }

  if (detailMatch && method === "PATCH") {
    const record = findById(state.executionVenues, Number(detailMatch[1]));
    Object.assign(record ?? {}, parseBody(init) ?? {});
    return record;
  }

  if (detailMatch && method === "DELETE") {
    const id = Number(detailMatch[1]);
    state.executionVenues = state.executionVenues.filter((venue) => readNumber(venue.id) !== id);
    return null;
  }

  return undefined;
}

function handlePortfolioGroups(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/orm/api/assets/portfolio_group/" && method === "GET") {
    const filtered = state.portfolioGroups.filter((group) =>
      matchesSearch(
        [group.id, group.name, group.display_name, group.unique_identifier, group.description],
        searchParams.get("search"),
      ),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/orm/api/assets/portfolio_group/get_or_create/" && method === "POST") {
    const body = parseBody(init);
    const record = {
      id: nextId(state.portfolioGroups),
      name: readString(body?.display_name) || readString(body?.unique_identifier) || "Portfolio Group",
      display_name: readString(body?.display_name) || "Portfolio Group",
      portfolio_group_name: readString(body?.display_name) || "Portfolio Group",
      unique_identifier: readString(body?.unique_identifier) || `pg_${Date.now()}`,
      description: readString(body?.description),
      portfolios: readArray<number>(body?.portfolios),
      creation_date: new Date().toISOString(),
    };
    state.portfolioGroups.unshift(record);
    return record;
  }

  if (route === "/orm/api/assets/portfolio_group/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.portfolioGroups.length;
    state.portfolioGroups = state.portfolioGroups.filter((group) => !ids.has(readNumber(group.id)));
    return {
      detail: "Portfolio groups removed from mock state.",
      deleted_count: before - state.portfolioGroups.length,
    };
  }

  const detailMatch = route.match(/^\/orm\/api\/assets\/portfolio_group\/(\d+)\/$/);
  if (detailMatch && method === "GET") {
    return findById(state.portfolioGroups, Number(detailMatch[1]));
  }

  const appendMatch = route.match(/^\/orm\/api\/assets\/portfolio_group\/(\d+)\/append-portfolios\/$/);
  if (appendMatch && method === "POST") {
    const group = findById(state.portfolioGroups, Number(appendMatch[1]));
    const body = parseBody(init);
    const existing = new Set(readArray<number>(group?.portfolios));
    readArray<number>(body?.portfolios).forEach((portfolioId) => existing.add(portfolioId));
    if (group) {
      group.portfolios = [...existing];
    }
    return group;
  }

  const removeMatch = route.match(/^\/orm\/api\/assets\/portfolio_group\/(\d+)\/remove-portfolios\/$/);
  if (removeMatch && method === "POST") {
    const group = findById(state.portfolioGroups, Number(removeMatch[1]));
    const body = parseBody(init);
    const removing = new Set(readArray<number>(body?.portfolios));
    if (group) {
      group.portfolios = readArray<number>(group.portfolios).filter((portfolioId) => !removing.has(portfolioId));
    }
    return group;
  }

  return undefined;
}

function handleTargetPortfolios(route: string, method: string, searchParams: URLSearchParams) {
  if (route === "/orm/api/assets/target_portfolio/" && method === "GET") {
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

  if (route === "/orm/api/assets/target_portfolio/bulk-delete/" && method === "POST") {
    return {
      detail: "Target portfolios removed from mock state.",
      deleted_count: 0,
    };
  }

  const summaryMatch = route.match(/^\/orm\/api\/assets\/target_portfolio\/(\d+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const portfolio = findById(state.targetPortfolios, Number(summaryMatch[1]));
    return buildTargetPortfolioSummary(portfolio ?? { id: Number(summaryMatch[1]), portfolio_name: `Portfolio ${summaryMatch[1]}` });
  }

  const weightsMatch = route.match(/^\/orm\/api\/assets\/target_portfolio\/(\d+)\/weights-position-details\/$/);
  if (weightsMatch && method === "GET") {
    const portfolio = findById(state.targetPortfolios, Number(weightsMatch[1]));
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
    (route === "/orm/api/assets/asset-translation-tables/" && method === "GET") ||
    (route === "/orm/api/assets/asset-translation-tables/query/" && method === "POST")
  ) {
    const body = parseBody(init);
    const search = searchParams.get("search") ?? readOptionalString(body?.search);
    const filtered = state.assetTranslationTables.filter((table) =>
      matchesSearch([table.id, table.unique_identifier], search),
    );
    return frontendRowsResponse(
      filtered.map((table) => ({
        id: readNumber(table.id),
        unique_identifier: readString(table.unique_identifier),
        rules_number: state.assetTranslationTableRules.filter(
          (rule) => readNumber(rule.table_id) === readNumber(table.id),
        ).length,
        creation_date: readString(table.creation_date),
      })),
      search,
      searchParams.get("page") ?? String(body?.page ?? 1),
      searchParams.get("page_size") ?? String(body?.page_size ?? defaultPageSize),
    );
  }

  if (route === "/orm/api/assets/asset-translation-tables/" && method === "POST") {
    const body = parseBody(init);
    const record = {
      id: nextId(state.assetTranslationTables),
      unique_identifier: readString(body?.unique_identifier) || `translation_${Date.now()}`,
      creation_date: new Date().toISOString(),
    };
    state.assetTranslationTables.unshift(record);
    return record;
  }

  if (route === "/orm/api/assets/asset-translation-tables/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.assetTranslationTables.length;
    state.assetTranslationTables = state.assetTranslationTables.filter((table) => !ids.has(readNumber(table.id)));
    state.assetTranslationTableRules = state.assetTranslationTableRules.filter((rule) => !ids.has(readNumber(rule.table_id)));
    return {
      detail: "Asset translation tables removed from mock state.",
      deleted_count: before - state.assetTranslationTables.length,
    };
  }

  const detailMatch = route.match(/^\/orm\/api\/assets\/asset-translation-tables\/(\d+)\/$/);
  if (detailMatch && method === "GET") {
    const tableId = Number(detailMatch[1]);
    const table = findById(state.assetTranslationTables, tableId);
    return {
      id: tableId,
      title: readString(table?.unique_identifier) || `Table ${tableId}`,
      selected_table: {
        id: tableId,
        text: readString(table?.unique_identifier),
        sub_text: `Rules: ${state.assetTranslationTableRules.filter((rule) => readNumber(rule.table_id) === tableId).length}`,
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
        update_endpoint: `/orm/api/assets/asset-translation-tables/${tableId}/`,
        delete_endpoint: `/orm/api/assets/asset-translation-tables/${tableId}/`,
      },
      rules_list: {
        list_endpoint: `/orm/api/assets/asset-translation-tables/${tableId}/rules/`,
        response_format: "frontend_list",
        create_endpoint: `/orm/api/assets/asset-translation-tables/${tableId}/rules/`,
      },
    };
  }

  if (detailMatch && method === "PATCH") {
    const table = findById(state.assetTranslationTables, Number(detailMatch[1]));
    Object.assign(table ?? {}, parseBody(init) ?? {});
    return table;
  }

  if (detailMatch && method === "DELETE") {
    const tableId = Number(detailMatch[1]);
    state.assetTranslationTables = state.assetTranslationTables.filter((table) => readNumber(table.id) !== tableId);
    state.assetTranslationTableRules = state.assetTranslationTableRules.filter((rule) => readNumber(rule.table_id) !== tableId);
    return null;
  }

  const rulesMatch = route.match(/^\/orm\/api\/assets\/asset-translation-tables\/(\d+)\/rules\/$/);
  if (rulesMatch && method === "GET") {
    const tableId = Number(rulesMatch[1]);
    const filtered = state.assetTranslationTableRules.filter(
      (rule) =>
        readNumber(rule.table_id) === tableId &&
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
    const tableId = Number(rulesMatch[1]);
    const body = parseBody(init);
    const assetFilter = (body?.asset_filter ?? {}) as Record<string, unknown>;
    const record = {
      id: nextId(state.assetTranslationTableRules),
      table_id: tableId,
      security_type: readOptionalString(assetFilter.security_type),
      security_market_sector: readOptionalString(assetFilter.security_market_sector),
      markets_time_serie_unique_identifier: readString(body?.markets_time_serie_unique_identifier),
      target_exchange_code: readOptionalString(body?.target_exchange_code),
      default_column_name: readOptionalString(body?.default_column_name),
      creation_date: new Date().toISOString(),
      detail_endpoint: `/orm/api/assets/asset-translation-tables/${tableId}/rules/${Date.now()}/`,
      update_endpoint: `/orm/api/assets/asset-translation-tables/${tableId}/rules/${Date.now()}/`,
      delete_endpoint: `/orm/api/assets/asset-translation-tables/${tableId}/rules/${Date.now()}/`,
    };
    state.assetTranslationTableRules.unshift(record);
    return record;
  }

  const ruleDetailMatch = route.match(/^\/orm\/api\/assets\/asset-translation-tables\/(\d+)\/rules\/(\d+)\/$/);
  if (ruleDetailMatch && method === "PATCH") {
    const rule = findById(state.assetTranslationTableRules, Number(ruleDetailMatch[2]));
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
    const ruleId = Number(ruleDetailMatch[2]);
    state.assetTranslationTableRules = state.assetTranslationTableRules.filter((rule) => readNumber(rule.id) !== ruleId);
    return {
      detail: "Translation rule deleted from mock state.",
      deleted_rule: true,
    };
  }

  return undefined;
}

function handleInstrumentsConfiguration(route: string, method: string, init?: RequestInit) {
  if (route === "/orm/api/assets/instruments-configuration/current/" && method === "GET") {
    return state.instrumentsConfiguration;
  }

  if (route === "/orm/api/assets/instruments-configuration/current/" && method === "PATCH") {
    Object.assign(state.instrumentsConfiguration, parseBody(init) ?? {});
    return state.instrumentsConfiguration;
  }

  return undefined;
}

function handleVirtualFunds(route: string, method: string, searchParams: URLSearchParams) {
  if (route === "/orm/api/assets/virtualfund/" && method === "GET") {
    const filtered = state.virtualFunds.filter((fund) =>
      matchesSearch(
        [fund.id, fund.target_portfolio_name, fund.account_name],
        searchParams.get("search"),
      ),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
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
      id: readNumber(source.id),
      related_resource: source.related_resource
        ? {
            id: readNumber((source.related_resource as Record<string, unknown>).id),
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
      id: readNumber(source.id),
      label: readString(source.display_name),
      class_type: readString(source.class_type),
      status: readString(source.status),
    }));
  }

  if (route === "/orm/api/ts_manager/dynamic_table_data_source/" && method === "POST") {
    const body = parseBody(init);
    const record = {
      id: nextId(state.projectDataSources),
      display_name: readString(body?.display_name) || "New Project Data Source",
      is_default_data_source: readBoolean(body?.is_default_data_source),
      related_resource: state.physicalDataSources.find(
        (source) => readNumber(source.id) === readNumber(body?.related_resource),
      ) ?? null,
      creation_date: new Date().toISOString(),
      creation_date_display: "Just now",
    };
    state.projectDataSources.unshift(record);
    return {
      detail: "Project data source created.",
      id: readNumber(record.id),
      display_name: readString(record.display_name),
      redirect_path: `/app/main_sequence_workbench/project-data-sources?msProjectDataSourceId=${record.id}&msProjectDataSourceView=edit`,
    };
  }

  if (route === "/orm/api/ts_manager/dynamic_table_data_source/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.projectDataSources.length;
    state.projectDataSources = state.projectDataSources.filter((item) => !ids.has(readNumber(item.id)));
    return {
      detail: "Project data sources removed from mock state.",
      deleted_count: before - state.projectDataSources.length,
    };
  }

  const editMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table_data_source\/(\d+)\/$/);
  if (editMatch && method === "GET" && searchParams.get("response_format") === "editor") {
    const record = findById(state.projectDataSources, Number(editMatch[1]));
    return {
      mode: "edit",
      entity: {
        id: readNumber(record?.id),
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
          value: readNumber((record?.related_resource as Record<string, unknown> | null)?.id) || null,
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
    const record = findById(state.projectDataSources, Number(editMatch[1]));
    const body = parseBody(init);
    if (record) {
      record.display_name = readString(body?.display_name) || record.display_name;
      record.is_default_data_source = readBoolean(body?.is_default_data_source);
      record.related_resource =
        state.physicalDataSources.find((source) => readNumber(source.id) === readNumber(body?.related_resource)) ??
        record.related_resource;
    }

    return {
      detail: "Project data source updated.",
      id: readNumber(record?.id),
      display_name: readString(record?.display_name),
      redirect_path: `/app/main_sequence_workbench/project-data-sources?msProjectDataSourceId=${editMatch[1]}&msProjectDataSourceView=edit`,
    };
  }

  const deleteMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table_data_source\/(\d+)\/delete\/$/);
  if (deleteMatch && method === "POST") {
    const id = Number(deleteMatch[1]);
    state.projectDataSources = state.projectDataSources.filter((item) => readNumber(item.id) !== id);
    return {
      detail: "Project data source deleted.",
      id,
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
    const record = {
      id: nextId(state.physicalDataSources),
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
      display_name: readString(record.display_name),
      redirect_path: `/app/main_sequence_workbench/physical-data-sources?msPhysicalDataSourceId=${record.id}&msPhysicalDataSourceView=edit`,
    };
  }

  if (route === "/data_source/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.physicalDataSources.length;
    state.physicalDataSources = state.physicalDataSources.filter((source) => !ids.has(readNumber(source.id)));
    return {
      detail: "Physical data sources removed from mock state.",
      deleted_count: before - state.physicalDataSources.length,
    };
  }

  const editMatch = route.match(/^\/data_source\/(\d+)\/$/);
  if (editMatch && method === "GET" && searchParams.get("response_format") === "editor") {
    const record = findById(state.physicalDataSources, Number(editMatch[1]));
    return {
      mode: "edit",
      entity: {
        id: readNumber(record?.id),
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
    const record = findById(state.physicalDataSources, Number(editMatch[1]));
    Object.assign(record ?? {}, parseBody(init) ?? {});
    return {
      detail: "Physical data source updated.",
      id: readNumber(record?.id),
      display_name: readString(record?.display_name),
      redirect_path: `/app/main_sequence_workbench/physical-data-sources?msPhysicalDataSourceId=${editMatch[1]}&msPhysicalDataSourceView=edit`,
    };
  }

  const deleteMatch = route.match(/^\/data_source\/(\d+)\/delete\/$/);
  if (deleteMatch && method === "POST") {
    const id = Number(deleteMatch[1]);
    state.physicalDataSources = state.physicalDataSources.filter((source) => readNumber(source.id) !== id);
    return {
      detail: "Physical data source deleted.",
      id,
      redirect_path: "/app/main_sequence_workbench/physical-data-sources",
    };
  }

  return undefined;
}

function handleClusters(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/cluster/" && method === "GET" && searchParams.get("response_format") === "clusters_list") {
    return buildClusterList(searchParams);
  }

  const detailMatch = route.match(/^\/cluster\/(\d+)\/$/);
  if (detailMatch && method === "GET" && searchParams.get("response_format") === "cluster_detail") {
    const cluster = findById(state.clusters, Number(detailMatch[1]));
    return buildClusterDetail(cluster ?? { id: Number(detailMatch[1]), uuid: `cluster-${detailMatch[1]}`, cluster_name: `Cluster ${detailMatch[1]}` });
  }

  const scaleMatch = route.match(/^\/cluster\/(\d+)\/scale\/$/);
  if (scaleMatch && method === "POST") {
    const body = parseBody(init);
    return {
      detail: `Cluster ${scaleMatch[1]} scale accepted.`,
      message: `Desired node count set to ${readNumber(body?.desired_node_count)} in mock mode.`,
    };
  }

  const clusterTabMatch = route.match(/^\/cluster\/(\d+)\/(node-pools|nodes|namespaces|pods|deployments|services|storage|knative)\/$/);
  if (clusterTabMatch && method === "GET") {
    const cluster = findById(state.clusters, Number(clusterTabMatch[1]));
    const key = clusterTabMatch[2].replace(/-/g, "_");
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
    const record = {
      id: nextId(state.constants),
      name: readString(body?.name) || "NEW_CONSTANT",
      value: body?.value ?? "",
      category: null,
    };
    state.constants.unshift(record);
    return record;
  }

  if (route === "/constant/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.constants.length;
    state.constants = state.constants.filter((item) => !ids.has(readNumber(item.id)));
    return {
      deleted_count: before - state.constants.length,
    };
  }

  const detailMatch = route.match(/^\/constant\/(\d+)\/$/);
  if (detailMatch && method === "GET") {
    return findById(state.constants, Number(detailMatch[1]));
  }

  if (detailMatch && method === "DELETE") {
    const id = Number(detailMatch[1]);
    state.constants = state.constants.filter((item) => readNumber(item.id) !== id);
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
    const record = {
      id: nextId(state.secrets),
      name: readString(body?.name) || "NEW_SECRET",
      value: readString(body?.value) || "********",
    };
    state.secrets.unshift(record);
    return {
      name: readString(record.name),
    };
  }

  const detailMatch = route.match(/^\/secret\/(\d+)\/$/);
  if (detailMatch && method === "GET") {
    return findById(state.secrets, Number(detailMatch[1]));
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
    const record = {
      id: nextId(state.buckets),
      name: readString(body?.name) || `mock-bucket-${Date.now()}`,
    };
    state.buckets.unshift(record);
    return record;
  }

  if (route === "/bucket/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.buckets.length;
    state.buckets = state.buckets.filter((bucket) => !ids.has(readNumber(bucket.id)));
    state.bucketObjects = state.bucketObjects.filter((entry) => !ids.has(readNumber(entry.bucket_id)));
    return {
      detail: "Buckets removed from mock state.",
      deleted_count: before - state.buckets.length,
    };
  }

  const detailMatch = route.match(/^\/bucket\/(\d+)\/$/);
  if (detailMatch && method === "DELETE") {
    const id = Number(detailMatch[1]);
    state.buckets = state.buckets.filter((bucket) => readNumber(bucket.id) !== id);
    state.bucketObjects = state.bucketObjects.filter((entry) => readNumber(entry.bucket_id) !== id);
    return null;
  }

  const summaryMatch = route.match(/^\/bucket\/(\d+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const bucket = findById(state.buckets, Number(summaryMatch[1]));
    return buildBucketSummary(bucket ?? { id: Number(summaryMatch[1]), name: `Bucket ${summaryMatch[1]}` });
  }

  const browseMatch = route.match(/^\/bucket\/(\d+)\/browse\/$/);
  if (browseMatch && method === "GET") {
    return buildBucketBrowse(Number(browseMatch[1]), searchParams);
  }

  const createFolderMatch = route.match(/^\/bucket\/(\d+)\/create-folder\/$/);
  if (createFolderMatch && method === "POST") {
    const bucketId = Number(createFolderMatch[1]);
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
  if (route === "/orm/api/ts_manager/simple_table/" && method === "GET") {
    return paginate(sortDescendingById(state.simpleTables), searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/orm/api/ts_manager/simple_table/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.simpleTables.length;
    state.simpleTables = state.simpleTables.filter((table) => !ids.has(readNumber(table.id)));
    return {
      deleted_count: before - state.simpleTables.length,
    };
  }

  if (route === "/orm/api/ts_manager/simple_table/bulk-refresh-table-search-index/" && method === "POST") {
    const body = parseBody(init);
    return {
      results: readArray<number>(body?.ids).map((id) => ({
        simple_table_id: id,
        ok: true,
        detail: "Search index refreshed in mock mode.",
      })),
    };
  }

  const detailMatch = route.match(/^\/orm\/api\/ts_manager\/simple_table\/(\d+)\/$/);
  if (detailMatch && method === "GET") {
    return findById(state.simpleTables, Number(detailMatch[1]));
  }

  const summaryMatch = route.match(/^\/orm\/api\/ts_manager\/simple_table\/(\d+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const table = findById(state.simpleTables, Number(summaryMatch[1]));
    return buildSimpleTableSummary(table ?? { id: Number(summaryMatch[1]), storage_hash: `table_${summaryMatch[1]}` });
  }

  const schemaMatch = route.match(/^\/orm\/api\/ts_manager\/simple_table\/(\d+)\/schema-graph\/$/);
  if (schemaMatch && method === "GET") {
    const table = findById(state.simpleTables, Number(schemaMatch[1]));
    return {
      nodes: [
        {
          id: `table-${schemaMatch[1]}`,
          label: readString(table?.storage_hash) || `table_${schemaMatch[1]}`,
          kind: "table",
        },
      ],
      edges: [],
      metadata: {
        depth: Number(searchParams.get("depth") ?? 2),
      },
    };
  }

  if (route === "/orm/api/ts_manager/simple_table/update/" && method === "GET") {
    const simpleTableId = Number(searchParams.get("remote_table") ?? "");
    const query = searchParams.get("q");
    const filtered = sortDescendingById(
      state.simpleTableUpdates.filter(
        (update) =>
          (Number.isFinite(simpleTableId) && simpleTableId > 0
            ? readNumber((update.remote_table as Record<string, unknown> | null)?.id) === simpleTableId
            : true) &&
          matchesSearch(
            [
              update.id,
              update.update_hash,
              (update.remote_table as Record<string, unknown> | null)?.id,
              (update.remote_table as Record<string, unknown> | null)?.storage_hash,
              (update.remote_table as Record<string, unknown> | null)?.identifier,
            ],
            query,
          ),
      ),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  const updateMatch = route.match(/^\/orm\/api\/ts_manager\/simple_table\/update\/(\d+)\/$/);
  if (updateMatch && method === "GET") {
    return findById(state.simpleTableUpdates, Number(updateMatch[1]));
  }

  const updateConfigMatch = route.match(/^\/orm\/api\/ts_manager\/simple_table\/update\/(\d+)\/run-configuration\/$/);
  if (updateConfigMatch && method === "GET") {
    const update = findById(state.simpleTableUpdates, Number(updateConfigMatch[1]));
    return update?.run_configuration ?? { update_schedule: null };
  }

  if (updateConfigMatch && method === "PATCH") {
    const update = findById(state.simpleTableUpdates, Number(updateConfigMatch[1]));
    update && (update.run_configuration = { ...(update.run_configuration as Record<string, unknown> ?? {}), ...(parseBody(init) ?? {}) });
    return update?.run_configuration ?? { update_schedule: null };
  }

  const updateHistoryMatch = route.match(/^\/orm\/api\/ts_manager\/simple_table\/update\/(\d+)\/historical-updates\/$/);
  if (updateHistoryMatch && method === "GET") {
    const update = findById(state.simpleTableUpdates, Number(updateHistoryMatch[1]));
    return readArray(update?.historical_updates).slice(0, Number(searchParams.get("limit") ?? 100));
  }

  const updateGraphMatch = route.match(/^\/orm\/api\/ts_manager\/simple_table\/update\/(\d+)\/dependencies-graph\/$/);
  if (updateGraphMatch && method === "GET") {
    const graph = resolveMockDependencyGraph({
      sourceKind: "simple_table_update",
      sourceId: updateGraphMatch[1] ?? "",
      direction: searchParams.get("direction"),
    });

    if (!graph) {
      throw new Error(
        `Missing Main Sequence mock dependency graph payload for simple_table_update/${updateGraphMatch[1]}.`,
      );
    }

    return graph;
  }

  return undefined;
}

function handleDataNodes(route: string, method: string, searchParams: URLSearchParams, init?: RequestInit) {
  if (route === "/orm/api/ts_manager/dynamic_table/" && method === "GET") {
    const query = searchParams.get("q");
    const filtered = sortDescendingById(
      state.dataNodes.filter((node) =>
        matchesSearch([node.id, node.storage_hash, node.identifier, node.description], query),
      ),
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
        storage_hash: readString(node.storage_hash),
        identifier: readOptionalString(node.identifier),
      }));
  }

  const summaryMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/(\d+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const node = findById(state.dataNodes, Number(summaryMatch[1]));
    return buildDataNodeSummary(node ?? { id: Number(summaryMatch[1]), identifier: `Data Node ${summaryMatch[1]}` });
  }

  const detailMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/(\d+)\/$/);
  if (detailMatch && method === "GET") {
    return findById(state.dataNodes, Number(detailMatch[1]));
  }

  const lastObservationMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/(\d+)\/get_last_observation\/$/);
  if (lastObservationMatch && method === "POST") {
    return resolveMockDataNodeLastObservation(lastObservationMatch[1] ?? "");
  }

  const dataBetweenDatesMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/(\d+)\/get_data_between_dates_from_remote\/$/);
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

  if (route === "/orm/api/ts_manager/dynamic_table/bulk-refresh-table-search-index/" && method === "POST") {
    const body = parseBody(init);
    const selectedIds = readArray<number>(body?.selected_ids);
    return {
      ok: true,
      action: "refresh_search_index",
      requested_ids: selectedIds,
      requested_count: selectedIds.length,
      select_all: false,
      matched_count: selectedIds.length,
      success_count: selectedIds.length,
      failed_count: 0,
      results: selectedIds.map((id) => ({
        dynamic_table_metadata_id: id,
        storage_hash: readString(findById(state.dataNodes, id)?.storage_hash),
        ok: true,
        detail: "Search index refreshed in mock mode.",
      })),
    };
  }

  if (route === "/orm/api/ts_manager/dynamic_table/bulk-set-next-update-from-last-index-value/" && method === "POST") {
    const body = parseBody(init);
    const selectedIds = readArray<number>(body?.selected_ids);
    return {
      ok: true,
      action: "set_next_update",
      requested_ids: selectedIds,
      requested_count: selectedIds.length,
      select_all: false,
      matched_count: selectedIds.length,
      success_count: selectedIds.length,
      failed_count: 0,
      results: selectedIds.map((id) => ({
        dynamic_table_metadata_id: id,
        storage_hash: readString(findById(state.dataNodes, id)?.storage_hash),
        ok: true,
        detail: "Next update aligned to last index value in mock mode.",
      })),
    };
  }

  if (route === "/orm/api/ts_manager/dynamic_table/bulk-set-index-stats-from-table/" && method === "POST") {
    const body = parseBody(init);
    const selectedIds = readArray<number>(body?.selected_ids);
    return {
      ok: true,
      action: "set_index_stats",
      requested_ids: selectedIds,
      requested_count: selectedIds.length,
      select_all: false,
      matched_count: selectedIds.length,
      success_count: selectedIds.length,
      failed_count: 0,
      results: selectedIds.map((id) => ({
        dynamic_table_metadata_id: id,
        storage_hash: readString(findById(state.dataNodes, id)?.storage_hash),
        ok: true,
        detail: "Index stats refreshed in mock mode.",
      })),
    };
  }

  if (route === "/orm/api/ts_manager/dynamic_table/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const selectedIds = new Set(readArray<number>(body?.selected_ids));
    const before = state.dataNodes.length;
    state.dataNodes = state.dataNodes.filter((node) => !selectedIds.has(readNumber(node.id)));
    return {
      ok: true,
      requested_ids: [...selectedIds],
      requested_count: selectedIds.size,
      select_all: false,
      matched_count: selectedIds.size,
      selected_deleted: before - state.dataNodes.length,
      downstream_deleted: 0,
      missing_table_deleted: 0,
    };
  }

  const compressionMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/(\d+)\/compression-policy\/$/);
  if (compressionMatch && method === "GET") {
    const node = findById(state.dataNodes, Number(compressionMatch[1]));
    return {
      policy_type: "compression",
      supported: true,
      exists: Boolean(node?.compression_policy),
      detail: "Compression policy available in mock mode.",
      config: (node?.compression_policy as Record<string, unknown> | null) ?? null,
    };
  }

  if (compressionMatch && method === "POST") {
    const node = findById(state.dataNodes, Number(compressionMatch[1]));
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

  const retentionMatch = route.match(/^\/orm\/api\/ts_manager\/dynamic_table\/(\d+)\/retention-policy\/$/);
  if (retentionMatch && method === "GET") {
    const node = findById(state.dataNodes, Number(retentionMatch[1]));
    return {
      policy_type: "retention",
      supported: true,
      exists: Boolean(node?.retention_policy),
      detail: "Retention policy available in mock mode.",
      config: (node?.retention_policy as Record<string, unknown> | null) ?? null,
    };
  }

  if (retentionMatch && method === "POST") {
    const node = findById(state.dataNodes, Number(retentionMatch[1]));
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
    const remoteTableId = Number(searchParams.get("remote_table") ?? "");
    const projectId = Number(searchParams.get("project__id") ?? "");
    const query = searchParams.get("q");
    const filtered = sortDescendingById(
      state.localTimeSeries.filter((update) => {
        if (remoteTableId > 0) {
          if (readNumber((update.data_node_storage as Record<string, unknown> | null)?.id) !== remoteTableId) {
            return false;
          }
        }

        if (projectId > 0) {
          if (readNumber(update.project_id) !== projectId) {
            return false;
          }
        }

        return matchesSearch(
          [
            update.id,
            update.update_hash,
            update.project_id,
            (update.data_node_storage as Record<string, unknown> | null)?.id,
            (update.data_node_storage as Record<string, unknown> | null)?.storage_hash,
            (update.data_node_storage as Record<string, unknown> | null)?.identifier,
          ],
          query,
        );
      }),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  const summaryMatch = route.match(/^\/orm\/api\/ts_manager\/local_time_serie\/(\d+)\/summary\/$/);
  if (summaryMatch && method === "GET") {
    const update = findById(state.localTimeSeries, Number(summaryMatch[1]));
    return buildEntitySummary(
      Number(summaryMatch[1]),
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

  const detailMatch = route.match(/^\/orm\/api\/ts_manager\/local_time_serie\/(\d+)\/$/);
  if (detailMatch && method === "GET") {
    return findById(state.localTimeSeries, Number(detailMatch[1]));
  }

  const configMatch = route.match(/^\/orm\/api\/ts_manager\/local_time_serie\/(\d+)\/run-configuration\/$/);
  if (configMatch && method === "GET") {
    const update = findById(state.localTimeSeries, Number(configMatch[1]));
    return update?.run_configuration ?? null;
  }

  if (configMatch && method === "PATCH") {
    const update = findById(state.localTimeSeries, Number(configMatch[1]));
    if (update) {
      update.run_configuration = {
        ...(update.run_configuration as Record<string, unknown> | null ?? {}),
        ...(parseBody(init) ?? {}),
      };
    }
    return update?.run_configuration ?? null;
  }

  const graphMatch = route.match(/^\/orm\/api\/ts_manager\/local_time_serie\/(\d+)\/dependencies-graph\/$/);
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

  const historicalMatch = route.match(/^\/orm\/api\/ts_manager\/local_time_serie\/(\d+)\/historical-updates\/$/);
  if (historicalMatch && method === "GET") {
    const update = findById(state.localTimeSeries, Number(historicalMatch[1]));
    return readArray(update?.historical_updates).slice(0, Number(searchParams.get("limit") ?? 100));
  }

  const logsMatch = route.match(/^\/orm\/api\/ts_manager\/local_time_serie\/(\d+)\/logs\/$/);
  if (logsMatch && method === "GET") {
    const update = findById(state.localTimeSeries, Number(logsMatch[1]));
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
    const projectId = Number(searchParams.get("related_project__id__in") ?? "");
    const filtered = sortDescendingById(
      state.projectImages.filter((image) =>
        projectId > 0 ? readNumber(image.related_project) === projectId : true,
      ),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/project-image/" && method === "POST") {
    const body = parseBody(init);
    const baseImage = state.projectBaseImages[0] ?? null;
    const record = {
      id: nextId(state.projectImages),
      project_repo_hash: readString(body?.project_repo_hash) || "newmockhash00000000",
      related_project: readNumber(body?.related_project_id),
      base_image: baseImage,
      is_ready: false,
    };
    state.projectImages.unshift(record);
    return record;
  }

  const projectImageDeleteMatch = route.match(/^\/project-image\/(\d+)\/$/);
  if (projectImageDeleteMatch && method === "DELETE") {
    const id = Number(projectImageDeleteMatch[1]);
    state.projectImages = state.projectImages.filter((image) => readNumber(image.id) !== id);
    return detailMessage("Project image deleted from mock state.");
  }

  if (route === "/project-image/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.projectImages.length;
    state.projectImages = state.projectImages.filter((image) => !ids.has(readNumber(image.id)));
    return {
      deleted_count: before - state.projectImages.length,
    };
  }

  if (route === "/project-image/commit-hashes/" && method === "GET") {
    const projectId = Number(searchParams.get("project_id") ?? "");
    const images = state.projectImages.filter((image) => readNumber(image.related_project) === projectId);
    return {
      project_id: projectId,
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
    const projectId = Number(searchParams.get("project__id") ?? "");
    const resourceType = searchParams.get("resource_type");
    const repoCommitSha = searchParams.get("repo_commit_sha");
    const filtered = sortDescendingById(
      state.projectResources.filter((resource) => {
        if (projectId > 0 && readNumber(resource.project) !== projectId) {
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
    const resource = state.projectResources.find((item) => readNumber(item.id) === readNumber(body?.resource));
    const image = state.projectImages.find((item) => readNumber(item.id) === readNumber(body?.related_image));
    const job = state.jobs.find((item) => readNumber(item.related_image) === readNumber(image?.id)) ?? state.jobs[0];
    const project = state.projects.find((item) => readNumber(item.id) === readNumber(resource?.project)) ?? state.projects[0];
    const nextIdValue = nextId(state.resourceReleases);
    const subdomain = `${readString(resource?.name).replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "release"}-${nextIdValue}`;
    const record = {
      id: nextIdValue,
      subdomain,
      resource: readNumber(body?.resource),
      readme_resource: null,
      related_job: readNumber(job?.id),
      release_kind: readString(body?.release_kind) || "streamlit_dashboard",
      title: readString(resource?.name),
      resource_id: readNumber(resource?.id),
      resource_name: readString(resource?.name),
      project_id: readNumber(project?.id),
      project_name: readString(project?.project_name),
      image_id: readNumber(image?.id),
      project_repo_hash: readString(image?.project_repo_hash),
      public_url: `https://${subdomain}.dash.main-sequence.app`,
      exchange_launch_url: `/orm/api/pods/resource-release/${nextIdValue}/exchange-launch/`,
      readme_html: "Mock release created in local state.",
    };
    state.resourceReleases.unshift(record);
    state.resourceReleaseGallery.unshift(record);
    return record;
  }

  if (route === "/resource-release/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.resourceReleases.length;
    state.resourceReleases = state.resourceReleases.filter((release) => !ids.has(readNumber(release.id)));
    state.resourceReleaseGallery = state.resourceReleaseGallery.filter((release) => !ids.has(readNumber(release.id)));
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

  const releaseSummaryMatch = route.match(/^\/resource-release\/(\d+)\/summary\/$/);
  if (releaseSummaryMatch && method === "GET") {
    const release = findById(state.resourceReleaseGallery, Number(releaseSummaryMatch[1])) ??
      findById(state.resourceReleases, Number(releaseSummaryMatch[1]));
    return buildResourceReleaseSummary(release ?? { id: Number(releaseSummaryMatch[1]), title: `Release ${releaseSummaryMatch[1]}` });
  }

  const releaseDeleteMatch = route.match(/^\/resource-release\/(\d+)\/$/);
  if (releaseDeleteMatch && method === "DELETE") {
    const id = Number(releaseDeleteMatch[1]);
    state.resourceReleases = state.resourceReleases.filter((release) => readNumber(release.id) !== id);
    state.resourceReleaseGallery = state.resourceReleaseGallery.filter((release) => readNumber(release.id) !== id);
    return null;
  }

  const launchMatch = route.match(/^\/resource-release\/(\d+)\/exchange-launch\/$/);
  if (launchMatch && method === "GET") {
    const release = findById(state.resourceReleaseGallery, Number(launchMatch[1]));
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
    const projectId = Number(searchParams.get("project__id") ?? "");
    const filtered = sortDescendingById(
      state.jobs.filter((job) => (projectId > 0 ? readNumber(job.project) === projectId : true)),
    );
    return paginate(filtered, searchParams.get("limit"), searchParams.get("offset"));
  }

  if (route === "/job/" && method === "POST") {
    const body = parseBody(init);
    const record = {
      id: nextId(state.jobs),
      name: readString(body?.name) || "new-job",
      project: readNumber(body?.project),
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
      related_image: readNumber(body?.related_image) || null,
    };
    state.jobs.unshift(record);
    return record;
  }

  if (route === "/job/bulk-delete/" && method === "POST") {
    const body = parseBody(init);
    const ids = new Set(readArray<number>(body?.ids));
    const before = state.jobs.length;
    state.jobs = state.jobs.filter((job) => !ids.has(readNumber(job.id)));
    return {
      deleted_count: before - state.jobs.length,
    };
  }

  const detailMatch = route.match(/^\/job\/(\d+)\/$/);
  if (detailMatch && method === "GET") {
    return findById(state.jobs, Number(detailMatch[1]));
  }

  if (detailMatch && method === "DELETE") {
    const id = Number(detailMatch[1]);
    state.jobs = state.jobs.filter((job) => readNumber(job.id) !== id);
    return null;
  }

  if (route === "/job-run/" && method === "GET") {
    const jobId = Number(searchParams.get("job__id") ?? "");
    const filtered = sortDescendingById(
      state.jobRuns.filter((run) => (jobId > 0 ? readNumber(run.job) === jobId : true)),
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
        job: readNumber(run.job),
        job_name: readString(run.job_name),
        name: readString(run.name),
        execution_start: readString(run.execution_start),
        execution_end: readOptionalString(run.execution_end),
        execution_time: readString(run.execution_time) || "9m",
        status: readString(run.status),
        cluster_name: readString(run.cluster_name) || "gke-analytics-prod",
        cluster_uuid: readString(run.cluster_uuid) || "cluster-prod-1",
        response_status: readOptionalString(run.response_status),
        job_detail_url: `/app/main_sequence_workbench/jobs?msJobId=${run.job}`,
        job_run_detail_url: `/app/main_sequence_workbench/jobs?msJobId=${run.job}&msJobRunId=${run.id}`,
      }));
  }

  if (route === "/job-run/upcoming-overview/" && method === "GET") {
    return state.jobs.slice(0, 4).map((job, index) => ({
      row_id: `upcoming-${job.id}`,
      kind: "upcoming",
      id: null,
      job: readNumber(job.id),
      job_name: readString(job.name),
      name: `${readString(job.name)} next run`,
      execution_start: new Date(Date.now() + (index + 1) * 60 * 60 * 1000).toISOString(),
      execution_end: null,
      execution_time: "scheduled",
      status: "scheduled",
      cluster_name: "gke-analytics-prod",
      cluster_uuid: "cluster-prod-1",
      response_status: null,
      job_detail_url: `/app/main_sequence_workbench/jobs?msJobId=${job.id}`,
      job_run_detail_url: null,
    }));
  }

  const runSummaryMatch = route.match(/^\/job-run\/(\d+)\/summary\/$/);
  if (runSummaryMatch && method === "GET") {
    const run = findById(state.jobRuns, Number(runSummaryMatch[1]));
    return buildEntitySummary(
      Number(runSummaryMatch[1]),
      "job_run",
      readString(run?.name) || `Run ${runSummaryMatch[1]}`,
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

  const logsMatch = route.match(/^\/job-run\/(\d+)\/get_logs\/$/);
  if (logsMatch && method === "GET") {
    return {
      job_run_id: Number(logsMatch[1]),
      status: "ok",
      rows: readArray(state.jobRunLogs[logsMatch[1]]),
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
  const objectId = Number(segments.at(-2) ?? "");

  if (!Number.isFinite(objectId) || objectId <= 0) {
    return undefined;
  }

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

function handleSharedResources(route: string, method: string, searchParams: URLSearchParams) {
  if (route === "/billing/available-gpu-types/" && method === "GET") {
    return paginate(state.availableGpuTypes, searchParams.get("limit"), searchParams.get("offset"));
  }

  return undefined;
}

function normalizeMainSequenceRoute(pathname: string) {
  const normalizedPathname = pathname.startsWith(devAuthProxyPrefix)
    ? pathname.slice(devAuthProxyPrefix.length) || "/"
    : pathname;
  const route = normalizedPathname.replace(/\/+$/, "");
  const normalized = route ? `${route}/` : "/";

  if (normalized.startsWith(mainSequencePodsRoot)) {
    return normalized.slice(mainSequencePodsRoot.slice(0, -1).length);
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
    handleExecutionVenues(route, method, url.searchParams, init) ??
    handlePortfolioGroups(route, method, url.searchParams, init) ??
    handleTargetPortfolios(route, method, url.searchParams) ??
    handleTranslationTables(route, method, url.searchParams, init) ??
    handleInstrumentsConfiguration(route, method, init) ??
    handleVirtualFunds(route, method, url.searchParams) ??
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
    handleSharedResources(route, method, url.searchParams) ??
    undefined
  ) as T | undefined;
}
