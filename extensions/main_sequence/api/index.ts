import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";

const devAuthProxyPrefix = "/__command_center_auth__";
const dynamicTableDataSourceEndpoint = "/orm/api/ts_manager/dynamic_table_data_source/";
const dynamicTableMetadataEndpoint = "/orm/api/ts_manager/dynamic_table/";
const localTimeSerieEndpoint = "/orm/api/ts_manager/local_time_serie/";
const availableGpuTypesEndpoint = "/orm/api/pods/billing/available-gpu-types/";
export const mainSequenceRegistryPageSize = 25;

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface OffsetPaginatedList<T> {
  count: number;
  next: string | null;
  previous: string | null;
  limit: number;
  offset: number;
  results: T[];
}

export interface DynamicTableDataSourceOption {
  id: number;
  related_resource: {
    id: number;
    display_name?: string | null;
    name?: string | null;
    organization: number;
    class_type: string;
    status: string;
  } | null;
  related_resource_class_type: string;
}

export interface ProjectSummary {
  id: number;
  project_name: string;
  data_source: DynamicTableDataSourceOption | null;
  git_ssh_url: string | null;
  is_initialized: boolean;
  created_by: string;
}

export interface ConstantRecord {
  id: number;
  name: string;
  value: unknown;
  category: string | null;
}

export interface CreateConstantInput {
  name: string;
  value: unknown;
}

export interface SecretRecord {
  id: number;
  name: string;
  value: string;
}

export interface CreateSecretInput {
  name: string;
  value: string;
}

export interface CreatedSecretRecord {
  name: string;
}

export interface DataNodeSummary {
  id: number;
  storage_hash: string;
  creation_date: string;
  source_class_name: string | null;
  protect_from_deletion: boolean;
  time_serie_source_code_git_hash: string | null;
  created_by_user: number | null;
  open_for_everyone: boolean;
  data_source: DynamicTableDataSourceOption | null;
  table_index_names: string[] | null;
  data_source_open_for_everyone: boolean;
  identifier: string | null;
  description: string | null;
  data_frequency_id: string | number | null;
}

export interface DataNodeColumnMetadata {
  source_config_id: number | null;
  column_name: string;
  dtype: string | null;
  label: string | null;
  description: string | null;
}

export interface DataNodeSourceTableConfiguration {
  related_table: number;
  time_index_name: string | null;
  column_dtypes_map: Record<string, string> | null;
  index_names: string[] | null;
  last_time_index_value: string | null;
  earliest_index_value: string | null;
  table_partition: unknown;
  open_for_everyone: boolean;
  columns_metadata: DataNodeColumnMetadata[];
}

export interface DataNodeDetail extends DataNodeSummary {
  build_configuration: unknown;
  build_meta_data: unknown;
  sourcetableconfiguration: DataNodeSourceTableConfiguration | null;
}

export interface LocalTimeSerieRunConfiguration {
  local_time_serie_update_details: number;
  retry_on_error: boolean;
  seconds_wait_on_retry: number | null;
  required_cpus: string | number | null;
  required_gpus: string | number | null;
  execution_time_out_seconds: number | null;
  update_schedule: unknown;
}

export interface LocalTimeSerieUpdateDetails {
  related_table: number;
  active_update: boolean;
  update_pid: number | null;
  error_on_last_update: boolean;
  last_update: string | null;
  next_update: string | null;
  update_statistics: unknown;
  active_update_status: string | null;
  active_update_scheduler: number | null;
  update_priority: number | null;
  last_updated_by_user: number | null;
  run_configuration: LocalTimeSerieRunConfiguration | null;
}

export interface LocalTimeSerieRecord {
  id: number;
  update_hash: string;
  build_configuration: unknown;
  update_details: LocalTimeSerieUpdateDetails | null;
  ogm_dependencies_linked: boolean;
  data_node_storage: DataNodeDetail | DataNodeSummary | null;
  run_configuration: LocalTimeSerieRunConfiguration | null;
  open_for_everyone: boolean;
}

export interface DataNodePolicyConfigBase {
  schedule_interval?: string | null;
  initial_start?: string | null;
  timezone?: string | null;
  last_modified?: string | null;
}

export interface DataNodeCompressionPolicyConfig extends DataNodePolicyConfigBase {
  compress_after?: string | null;
}

export interface DataNodeRetentionPolicyConfig extends DataNodePolicyConfigBase {
  drop_after?: string | null;
}

export interface DataNodePolicyState<TConfig> {
  policy_type: string;
  supported: boolean;
  exists: boolean;
  detail: string;
  config: TConfig | null;
}

export interface DataNodeCompressionPolicyInput {
  compress_after: string;
  schedule_interval?: string | null;
  initial_start?: string | null;
  timezone?: string | null;
}

export interface DataNodeRetentionPolicyInput {
  drop_after: string;
  schedule_interval?: string | null;
  initial_start?: string | null;
  timezone?: string | null;
}

export interface ProjectSummaryStatItem {
  value: number | string;
  change: string;
  value_type: string;
  prefix: string;
  info: string;
}

export interface ProjectSummaryBaseImage {
  title: string;
  description: string;
  is_default: boolean;
  badge_class: string;
}

export interface ProjectSummaryLatestCommit {
  sha: string;
  short: string;
  date: string;
  ago: string;
  branch: string;
}

export interface ProjectSummaryForkedFrom {
  id: number;
  project_name: string;
  url: string;
}

export interface ProjectRepositoryBreadcrumb {
  name: string;
  path: string;
}

export interface ProjectRepositoryFolder {
  name: string;
  path: string;
}

export interface ProjectRepositoryFile {
  name: string;
  path: string;
  allowed_types: boolean;
}

export interface SummaryEntity {
  id: number;
  type: string;
  title: string;
}

export interface SummaryBadge {
  key: string;
  label: string;
  tone: string;
}

export interface SummaryEditChoiceOption {
  value: string | number | boolean;
  label: string;
  description?: string;
}

export interface SummaryEditSubmitConfig {
  method: "PATCH" | "POST" | "PUT";
  path: string;
  field?: string;
}

export interface SummaryEditChoicesConfig {
  type: "static" | "remote";
  options?: SummaryEditChoiceOption[];
  endpoint?: string;
  valueKey?: string;
  labelKey?: string;
  descriptionKey?: string;
}

export interface SummaryEditConfig {
  enabled: boolean;
  editor: "text" | "textarea" | "number" | "toggle" | "select" | "picker";
  mode?: "inline" | "dialog";
  placeholder?: string;
  description?: string;
  required?: boolean;
  trueLabel?: string;
  falseLabel?: string;
  trueValue?: string | number | boolean;
  falseValue?: string | number | boolean;
  submit: SummaryEditSubmitConfig;
  choices?: SummaryEditChoicesConfig;
}

export interface SummaryField {
  key: string;
  label: string;
  value: string | number | boolean | Array<string | number> | null;
  kind: string;
  meta?: string;
  icon?: string;
  tone?: string;
  info?: string;
  href?: string;
  edit?: SummaryEditConfig;
}

export interface SummaryStat {
  key: string;
  label: string;
  display: string;
  value: string | number | boolean | null;
  kind: string;
  info?: string;
  edit?: SummaryEditConfig;
}

export interface ResourceUsageChartPoint {
  time: number;
  cpu_cores: number;
  memory_gib: number;
  disk_gib: number;
}

export interface EntitySummaryExtra {
  resource_usage_chart_data?: ResourceUsageChartPoint[];
}

export interface EntitySummaryHeader {
  entity: SummaryEntity;
  badges: SummaryBadge[];
  inline_fields: SummaryField[];
  highlight_fields: SummaryField[];
  stats: SummaryStat[];
  extra?: EntitySummaryExtra;
}

export type ProjectSummaryHeader = EntitySummaryHeader;
export type DataNodeSummaryHeader = EntitySummaryHeader;
export interface ResourceReleaseSummaryHeader extends EntitySummaryHeader {
  readme?: ResourceReleaseReadmeSummary;
}

export interface ProjectRepositoryBrowserResponse {
  project_id: number;
  current_path: string;
  has_repository: boolean;
  message: string;
  breadcrumbs: ProjectRepositoryBreadcrumb[];
  folders: ProjectRepositoryFolder[];
  files: ProjectRepositoryFile[];
}

export interface ProjectResourceCodeResponse {
  project_id: number;
  path: string;
  name: string;
  language: string | null;
  content: string;
}

function parseLooseQuotedString(value: string) {
  if (value.startsWith("\"")) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }

  return value
    .slice(1, -1)
    .replace(/\\\\/g, "\\")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, "\"")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

function readLooseObjectStringField(raw: string, key: string) {
  const match = raw.match(
    new RegExp(
      `['"]${key}['"]\\s*:\\s*("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')`,
      "s",
    ),
  );

  if (!match) {
    return undefined;
  }

  return parseLooseQuotedString(match[1]);
}

function tryParseLooseProjectResourceCodeResponse(
  payload: string,
  projectId: number,
  path: string,
): ProjectResourceCodeResponse | null {
  const trimmed = payload.trim();

  if (!trimmed.startsWith("{") || !trimmed.includes("content")) {
    return null;
  }

  const content = readLooseObjectStringField(trimmed, "content");
  if (content === undefined) {
    return null;
  }

  const fallbackName = path.split("/").filter(Boolean).at(-1) ?? path;

  return {
    project_id: projectId,
    path: readLooseObjectStringField(trimmed, "path") ?? path,
    name: readLooseObjectStringField(trimmed, "name") ?? fallbackName,
    language: readLooseObjectStringField(trimmed, "language") ?? null,
    content,
  };
}

export interface ProjectImageOption {
  id: number;
  project_repo_hash: string | null;
  related_project: number;
  base_image: ProjectBaseImageOption | null;
  is_ready: boolean;
}

export interface CreateProjectImageInput {
  related_project_id: number;
  project_repo_hash?: string;
}

export interface ProjectImageCommitHashOption {
  value: string;
  commit_hash: string | null;
  short_hash: string;
  label: string;
  created_at: string | null;
  created_display: string;
  has_image: boolean;
  image_count: number;
  is_dynamic: boolean;
}

export interface ProjectImageCommitHashListResponse {
  project_id: number;
  commits: ProjectImageCommitHashOption[];
}

export interface ResourceReleaseReadmeSummary {
  path?: string;
  html?: string;
  last_modified?: string | null;
  last_modified_display?: string;
  filesize?: number | null;
  notice?: string;
  empty_message?: string;
}

export interface ResourceReleaseRecord {
  id: number;
  subdomain: string;
  resource: number;
  readme_resource: number | null;
  related_job: number;
  release_kind: string;
}

export interface ShareablePermissionUserRecord {
  id: number | string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface ShareablePermissionTeamRecord {
  id: number | string;
  name: string;
  description?: string;
  member_count?: number;
}

export interface ShareablePrincipalsResponse {
  object_id: number | string;
  object_type: string;
  access_level: string;
  users: ShareablePermissionUserRecord[];
  teams: ShareablePermissionTeamRecord[];
}

export interface PermissionCandidateUserRecord {
  id: number | string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface ProjectResourceRecord {
  id: number;
  project: number;
  name: string;
  resource_type: string;
  path: string;
  last_modified: string | null;
  created_at: string | null;
  updated_at: string | null;
  repo_commit_sha: string | null;
}

export interface CreateResourceReleaseInput {
  resource: number;
  related_image: number;
  release_kind?: string;
  cpu_request?: string;
  memory_request?: string;
  gpu_request?: string;
  gpu_type?: string;
  spot?: boolean;
}

export interface AvailableGpuTypeOption {
  value: string;
  label: string;
}

export interface JobRecord {
  id: number;
  name: string;
  project: number;
  execution_path: string | null;
  app_name: string | null;
  task_schedule: Record<string, unknown> | null;
  cpu_request: string | null;
  cpu_limit: string | null;
  memory_request: string | null;
  memory_limit: string | null;
  gpu_request: string | null;
  gpu_type: string | null;
  spot: boolean;
  max_runtime_seconds: number | null;
  related_image: number | null;
}

export interface JobRunRecord {
  id: number;
  name: string;
  unique_identifier: string;
  job: number;
  job_name: string;
  execution_start: string | null;
  execution_end: string | null;
  response_status: string | null;
  status: string;
  cpu_usage: string | number | null;
  memory_usage: string | number | null;
  cpu_limit: string | number | null;
  memory_limit: string | number | null;
  triggered_by: string | null;
  triggered_by_id: number | null;
  commit_hash: string | null;
}

export interface JobRunOverviewRow {
  row_id: string;
  kind: string;
  id: number | null;
  job: number;
  job_name: string;
  name: string;
  execution_start: string;
  execution_end: string | null;
  execution_time: string;
  status: string;
  cluster_name: string;
  cluster_uuid: unknown;
  response_status: string | null;
  job_detail_url: string;
  job_run_detail_url: string | null;
}

export interface JobRunLogsResponse {
  job_run_id: number;
  status: string;
  rows: JobRunLogEntry[];
}

export interface JobRunLogEntry {
  id: string;
  timestamp?: string | number | Date | null;
  level?: string | null;
  source?: string | null;
  message: string;
  durationMs?: number | null;
  status?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  context?: Record<string, unknown> | null;
  children?: JobRunLogEntry[] | null;
}

export interface ProjectBaseImageOption {
  id: number;
  latest_digest: string;
  description: string;
  title: string;
}

export interface GithubOrganizationOption {
  id: number;
  login: string;
  display_name: string;
}

export interface CreateProjectInput {
  project_name: string;
  repository_branch?: string;
  data_source_id?: number;
  default_base_image_id?: number;
  github_org_id?: number;
}

export interface CreateJobInput {
  name: string;
  project: number;
  execution_path: string;
  cpu_request: string | number;
  memory_request: string | number;
  max_runtime_seconds: number;
  related_image?: number;
  gpu_request?: number;
  gpu_type?: string;
  is_long_running?: boolean;
  spot?: boolean;
}

export interface ProjectFormOptions {
  dataSources: DynamicTableDataSourceOption[];
  githubOrganizations: GithubOrganizationOption[];
  projectBaseImages: ProjectBaseImageOption[];
}

type QueryValue = string | number | boolean | null | undefined;
export type ShareableAccessLevel = "view" | "edit";
export type ShareablePrincipalType = "user" | "team";

export interface UpdateShareablePermissionInput {
  objectUrl: string;
  objectId: number;
  principalType: ShareablePrincipalType;
  accessLevel: ShareableAccessLevel;
  operation: "add" | "remove";
  principalId: number | string;
}

export class MainSequenceApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "MainSequenceApiError";
    this.status = status;
    this.details = details;
  }
}

function getConfiguredBaseUrl() {
  const configuredBaseUrl = commandCenterConfig.auth.baseUrl.trim();
  return configuredBaseUrl || env.apiBaseUrl;
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function buildEndpointUrl(
  endpoint: string,
  path = "",
  search?: Record<string, QueryValue>,
) {
  const root = new URL(endpoint, getConfiguredBaseUrl());
  const requestUrl = new URL(path.replace(/^\/+/, ""), root);

  Object.entries(search ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    requestUrl.searchParams.set(key, String(value));
  });

  if (import.meta.env.DEV && isLoopbackHostname(root.hostname)) {
    return `${devAuthProxyPrefix}${requestUrl.pathname}${requestUrl.search}`;
  }

  return requestUrl.toString();
}

function normalizeListResponse<T>(payload: PaginatedResponse<T> | T[]) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.results;
}

function normalizeOffsetPaginatedResponse<T>(
  payload: PaginatedResponse<T> | T[],
  limit: number,
  offset: number,
): OffsetPaginatedList<T> {
  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      next: null,
      previous: null,
      limit,
      offset,
      results: payload,
    };
  }

  return {
    count: payload.count,
    next: payload.next,
    previous: payload.previous,
    limit,
    offset,
    results: payload.results,
  };
}

function getNestedRecordValue(record: unknown, key: string | undefined) {
  if (!key) {
    return undefined;
  }

  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, record);
}

function resolveRequestTarget(path: string) {
  if (/^https?:\/\//.test(path) || path.startsWith("/")) {
    return {
      endpoint: path,
      path: "",
    };
  }

  return {
    endpoint: commandCenterConfig.mainSequence.endpoint,
    path,
  };
}

function joinPermissionObjectPath(objectUrl: string, objectId: number, suffix: string) {
  const normalizedObjectUrl = objectUrl.replace(/\/+$/, "");
  const normalizedSuffix = suffix.replace(/^\/+/, "");

  return `${normalizedObjectUrl}/${objectId}/${normalizedSuffix}`;
}

function getPermissionSuffix(
  principalType: ShareablePrincipalType,
  accessLevel: ShareableAccessLevel,
  operation: "add" | "remove",
) {
  const permissionsConfig = commandCenterConfig.mainSequence.permissions;

  if (principalType === "user") {
    if (operation === "add") {
      return accessLevel === "view"
        ? permissionsConfig.addToViewSuffix
        : permissionsConfig.addToEditSuffix;
    }

    return accessLevel === "view"
      ? permissionsConfig.removeFromViewSuffix
      : permissionsConfig.removeFromEditSuffix;
  }

  if (operation === "add") {
    return accessLevel === "view"
      ? permissionsConfig.addTeamToViewSuffix
      : permissionsConfig.addTeamToEditSuffix;
  }

  return accessLevel === "view"
    ? permissionsConfig.removeTeamFromViewSuffix
    : permissionsConfig.removeTeamFromEditSuffix;
}

function readMessageFromPayload(payload: unknown): string {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (Array.isArray(payload)) {
    const messages = payload.flatMap((entry) => {
      if (typeof entry === "string" && entry.trim()) {
        return [entry.trim()];
      }

      return [];
    });

    return messages.join(", ");
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (typeof record.detail === "string" && record.detail.trim()) {
      return record.detail.trim();
    }

    for (const value of Object.values(record)) {
      const nested = readMessageFromPayload(value);

      if (nested) {
        return nested;
      }
    }
  }

  return "";
}

async function readResponsePayload(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  let rawText: string | null = null;

  async function readTextOnce() {
    if (rawText !== null) {
      return rawText;
    }

    try {
      rawText = await response.text();
    } catch {
      rawText = null;
    }

    return rawText;
  }

  if (contentType.includes("application/json")) {
    try {
      const text = await readTextOnce();

      if (text === null || !text.trim()) {
        return null;
      }

      return JSON.parse(text);
    } catch {
      return await readTextOnce();
    }
  }

  return await readTextOnce();
}

async function requestJson<T>(
  endpoint: string,
  path = "",
  init?: RequestInit,
  search?: Record<string, QueryValue>,
) {
  const requestUrl = buildEndpointUrl(endpoint, path, search);

  async function sendRequest() {
    const session = useAuthStore.getState().session;
    const headers = new Headers(init?.headers);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (session?.token) {
      headers.set("Authorization", `${session.tokenType ?? "Bearer"} ${session.token}`);
    }

    return fetch(requestUrl, {
      ...init,
      headers,
    });
  }

  let response: Response;

  try {
    response = await sendRequest();
  } catch (error) {
    throw new MainSequenceApiError(
      "The browser could not reach the Main Sequence API.",
      0,
      error,
    );
  }

  if (response.status === 401) {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      response = await sendRequest();
    }
  }

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new MainSequenceApiError(
      readMessageFromPayload(payload) || `Main Sequence API request failed with ${response.status}.`,
      response.status,
      payload,
    );
  }

  return payload as T;
}

export async function listProjects({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}) {
  const payload = await requestJson<PaginatedResponse<ProjectSummary> | ProjectSummary[]>(
    commandCenterConfig.mainSequence.endpoint,
    "projects/",
    undefined,
    { limit, offset, include: "created_by" },
  );

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export async function listConstants({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}) {
  const payload = await requestJson<PaginatedResponse<ConstantRecord> | ConstantRecord[]>(
    commandCenterConfig.mainSequence.endpoint,
    "constant/",
    undefined,
    { limit, offset },
  );

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export function fetchConstant(constantId: number) {
  return requestJson<ConstantRecord>(
    commandCenterConfig.mainSequence.endpoint,
    `constant/${constantId}/`,
  );
}

export function createConstant(input: CreateConstantInput) {
  return requestJson<ConstantRecord>(commandCenterConfig.mainSequence.endpoint, "constant/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteConstant(constantId: number) {
  return requestJson<null>(commandCenterConfig.mainSequence.endpoint, `constant/${constantId}/`, {
    method: "DELETE",
  });
}

export async function listSecrets({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}) {
  const payload = await requestJson<PaginatedResponse<SecretRecord> | SecretRecord[]>(
    commandCenterConfig.mainSequence.endpoint,
    "secret/",
    undefined,
    { limit, offset },
  );

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export function fetchSecret(secretId: number) {
  return requestJson<SecretRecord>(
    commandCenterConfig.mainSequence.endpoint,
    `secret/${secretId}/`,
  );
}

export function createSecret(input: CreateSecretInput) {
  return requestJson<CreatedSecretRecord>(commandCenterConfig.mainSequence.endpoint, "secret/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listDataNodes({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}) {
  const payload = await requestJson<PaginatedResponse<DataNodeSummary> | DataNodeSummary[]>(
    dynamicTableMetadataEndpoint,
    "",
    undefined,
    { limit, offset, ordering: "storage_hash_id" },
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export async function listLocalTimeSeries(
  remoteTableId: number,
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  } = {},
) {
  const payload = await requestJson<
    PaginatedResponse<LocalTimeSerieRecord> | LocalTimeSerieRecord[]
  >(localTimeSerieEndpoint, "", undefined, {
    limit,
    offset,
    remote_table: remoteTableId,
  });

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export async function fetchProjectFormOptions(): Promise<ProjectFormOptions> {
  const [dataSourcePayload, projectBaseImagePayload, githubOrganizationPayload] = await Promise.all([
    requestJson<
      PaginatedResponse<DynamicTableDataSourceOption> | DynamicTableDataSourceOption[]
    >(dynamicTableDataSourceEndpoint, "", undefined, { limit: 200 }),
    requestJson<PaginatedResponse<ProjectBaseImageOption> | ProjectBaseImageOption[]>(
      commandCenterConfig.mainSequence.endpoint,
      "project-base-image/",
      undefined,
      { limit: 200 },
    ),
    requestJson<PaginatedResponse<GithubOrganizationOption> | GithubOrganizationOption[]>(
      commandCenterConfig.mainSequence.endpoint,
      "github-organization/",
      undefined,
      { limit: 200 },
    ),
  ]);

  const dataSources = normalizeListResponse(dataSourcePayload)
    .filter((option) => option.related_resource_class_type !== "duck_db")
    .sort((left, right) => {
      const leftName = left.related_resource?.display_name ?? "";
      const rightName = right.related_resource?.display_name ?? "";
      return leftName.localeCompare(rightName);
    });
  const projectBaseImages = normalizeListResponse(projectBaseImagePayload).sort((left, right) =>
    left.title.localeCompare(right.title),
  );
  const githubOrganizations = normalizeListResponse(githubOrganizationPayload).sort((left, right) =>
    left.login.localeCompare(right.login),
  );

  return {
    dataSources,
    githubOrganizations,
    projectBaseImages,
  };
}

export function createProject(input: CreateProjectInput) {
  return requestJson<ProjectSummary>(commandCenterConfig.mainSequence.endpoint, "projects/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchProjectImages(projectId: number) {
  const payload = await requestJson<PaginatedResponse<ProjectImageOption> | ProjectImageOption[]>(
    commandCenterConfig.mainSequence.endpoint,
    "project-image/",
    undefined,
    {
      limit: 200,
      "related_project__id__in": projectId,
    },
  );

  return normalizeListResponse(payload).sort((left, right) => right.id - left.id);
}

export async function listProjectImages(
  projectId: number,
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<ProjectImageOption> | ProjectImageOption[]>(
    commandCenterConfig.mainSequence.endpoint,
    "project-image/",
    undefined,
    {
      limit,
      offset,
      "related_project__id__in": projectId,
    },
  );

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export async function listResourceReleases({
  limit = 500,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}) {
  const payload = await requestJson<
    PaginatedResponse<ResourceReleaseRecord> | ResourceReleaseRecord[]
  >(commandCenterConfig.mainSequence.endpoint, "resource-release/", undefined, {
    limit,
    offset,
  });

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export async function listProjectResources(
  projectId: number,
  {
    limit = 200,
    offset = 0,
    repoCommitSha,
    resourceType,
  }: {
    limit?: number;
    offset?: number;
    repoCommitSha?: string;
    resourceType?: string;
  } = {},
) {
  const payload = await requestJson<
    PaginatedResponse<ProjectResourceRecord> | ProjectResourceRecord[]
  >(commandCenterConfig.mainSequence.endpoint, "project-resource/", undefined, {
    limit,
    offset,
    "project__id": projectId,
    repo_commit_sha: repoCommitSha,
    resource_type: resourceType,
  });

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export function createProjectImage(input: CreateProjectImageInput) {
  return requestJson<ProjectImageOption>(commandCenterConfig.mainSequence.endpoint, "project-image/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createResourceRelease(input: CreateResourceReleaseInput) {
  return requestJson<ResourceReleaseRecord>(commandCenterConfig.mainSequence.endpoint, "resource-release/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteResourceRelease(resourceReleaseId: number) {
  return requestJson<null>(
    commandCenterConfig.mainSequence.endpoint,
    `resource-release/${resourceReleaseId}/`,
    {
      method: "DELETE",
    },
  );
}

export function deleteProjectImage(imageId: number) {
  return requestJson<{ detail?: string } | null>(
    commandCenterConfig.mainSequence.endpoint,
    `project-image/${imageId}/`,
    {
      method: "DELETE",
    },
  );
}

export function fetchProjectImageCommitHashes(projectId: number, limit = 100) {
  return requestJson<ProjectImageCommitHashListResponse>(
    commandCenterConfig.mainSequence.endpoint,
    "project-image/commit-hashes/",
    undefined,
    {
      project_id: projectId,
      limit,
    },
  );
}

export async function listProjectJobs(
  projectId: number,
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<JobRecord> | JobRecord[]>(
    commandCenterConfig.mainSequence.endpoint,
    "job/",
    undefined,
    {
      limit,
      offset,
      "project__id": projectId,
    },
  );

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export async function listJobs(
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<JobRecord> | JobRecord[]>(
    commandCenterConfig.mainSequence.endpoint,
    "job/",
    undefined,
    {
      limit,
      offset,
    },
  );

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export async function listJobRuns(
  jobId: number,
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<JobRunRecord> | JobRunRecord[]>(
    commandCenterConfig.mainSequence.endpoint,
    "job-run/",
    undefined,
    {
      limit,
      offset,
      "job__id": jobId,
    },
  );

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export function listHistoricalJobRunOverview({
  start,
  end,
}: {
  start?: string;
  end?: string;
} = {}) {
  return requestJson<JobRunOverviewRow[]>(
    commandCenterConfig.mainSequence.endpoint,
    "job-run/historical-overview/",
    undefined,
    {
      start,
      end,
    },
  );
}

export function listUpcomingJobRunOverview({
  start,
  end,
  hours,
}: {
  start?: string;
  end?: string;
  hours?: number;
} = {}) {
  return requestJson<JobRunOverviewRow[]>(
    commandCenterConfig.mainSequence.endpoint,
    "job-run/upcoming-overview/",
    undefined,
    {
      start,
      end,
      hours,
    },
  );
}

export async function fetchAvailableGpuTypes() {
  const payload = await requestJson<
    PaginatedResponse<AvailableGpuTypeOption> | AvailableGpuTypeOption[]
  >(availableGpuTypesEndpoint, "", undefined, { limit: 200 });

  return normalizeListResponse(payload).sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export function createJob(input: CreateJobInput) {
  return requestJson<JobRecord>(commandCenterConfig.mainSequence.endpoint, "job/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchJob(jobId: number) {
  return requestJson<JobRecord>(commandCenterConfig.mainSequence.endpoint, `job/${jobId}/`);
}

export async function fetchSummaryEditOptions(edit: SummaryEditConfig) {
  if (!edit.choices) {
    return [];
  }

  if (edit.choices.type === "static") {
    return edit.choices.options ?? [];
  }

  if (!edit.choices.endpoint) {
    return [];
  }

  const requestTarget = resolveRequestTarget(edit.choices.endpoint);
  const payload = await requestJson<PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[]>(
    requestTarget.endpoint,
    requestTarget.path,
  );

  return normalizeListResponse(payload).map((option, index) => {
    const rawValue =
      getNestedRecordValue(option, edit.choices?.valueKey ?? "value") ??
      getNestedRecordValue(option, "id") ??
      index;
    const rawLabel =
      getNestedRecordValue(option, edit.choices?.labelKey ?? "label") ?? rawValue;
    const rawDescription = getNestedRecordValue(
      option,
      edit.choices?.descriptionKey ?? "description",
    );

    return {
      value:
        typeof rawValue === "string" ||
        typeof rawValue === "number" ||
        typeof rawValue === "boolean"
          ? rawValue
          : String(rawValue ?? ""),
      label: String(rawLabel ?? rawValue ?? `Option ${index + 1}`),
      description:
        rawDescription === undefined || rawDescription === null || rawDescription === ""
          ? undefined
          : String(rawDescription),
    } satisfies SummaryEditChoiceOption;
  });
}

export function submitSummaryEdit(
  edit: SummaryEditConfig,
  value: string | number | boolean | null,
) {
  const requestTarget = resolveRequestTarget(edit.submit.path);
  const payload = edit.submit.field ? { [edit.submit.field]: value } : value;

  return requestJson<unknown>(requestTarget.endpoint, requestTarget.path, {
    method: edit.submit.method,
    body: JSON.stringify(payload),
  });
}

export function deleteJob(jobId: number) {
  return requestJson<null>(commandCenterConfig.mainSequence.endpoint, `job/${jobId}/`, {
    method: "DELETE",
  });
}

export function deleteProject(
  projectId: number,
  {
    deleteRepositories = false,
  }: {
    deleteRepositories?: boolean;
  } = {},
) {
  return requestJson<{ message: string }>(
    commandCenterConfig.mainSequence.endpoint,
    `projects/${projectId}/`,
    {
      method: "DELETE",
    },
    deleteRepositories ? { delete_repositories: "true" } : undefined,
  );
}

async function fetchShareablePrincipals(
  objectUrl: string,
  objectId: number,
  accessLevel: ShareableAccessLevel,
) {
  const permissionsConfig = commandCenterConfig.mainSequence.permissions;
  const requestTarget = resolveRequestTarget(
    joinPermissionObjectPath(
      objectUrl,
      objectId,
      accessLevel === "view"
        ? permissionsConfig.canViewSuffix
        : permissionsConfig.canEditSuffix,
    ),
  );

  return requestJson<ShareablePrincipalsResponse>(
    requestTarget.endpoint,
    requestTarget.path,
  );
}

export async function listPermissionCandidateUsers(
  objectUrl: string,
  objectId: number,
  {
  limit = 200,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {},
) {
  const requestTarget = resolveRequestTarget(
    joinPermissionObjectPath(
      objectUrl,
      objectId,
      commandCenterConfig.mainSequence.permissions.candidateUsersSuffix,
    ),
  );
  const payload = await requestJson<
    PaginatedResponse<PermissionCandidateUserRecord> | PermissionCandidateUserRecord[]
  >(requestTarget.endpoint, requestTarget.path, undefined, {
    limit,
    offset,
  });

  return normalizeListResponse(payload).sort((left, right) =>
    `${left.email} ${left.username}`.localeCompare(`${right.email} ${right.username}`),
  );
}

export function fetchObjectCanView(objectUrl: string, objectId: number) {
  return fetchShareablePrincipals(objectUrl, objectId, "view");
}

export function fetchObjectCanEdit(objectUrl: string, objectId: number) {
  return fetchShareablePrincipals(objectUrl, objectId, "edit");
}

export function updateShareableObjectPermission({
  objectUrl,
  objectId,
  principalType,
  accessLevel,
  operation,
  principalId,
}: UpdateShareablePermissionInput) {
  const requestTarget = resolveRequestTarget(
    joinPermissionObjectPath(
      objectUrl,
      objectId,
      getPermissionSuffix(principalType, accessLevel, operation),
    ),
  );
  const body =
    principalType === "user"
      ? { user_id: principalId }
      : { team_id: principalId };

  return requestJson<Record<string, unknown> | null>(
    requestTarget.endpoint,
    requestTarget.path,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function fetchProjectSummary(projectId: number) {
  return requestJson<ProjectSummaryHeader>(
    commandCenterConfig.mainSequence.endpoint,
    `projects/${projectId}/summary/`,
  );
}

export function fetchDataNodeSummary(dataNodeId: number) {
  return requestJson<DataNodeSummaryHeader>(
    dynamicTableMetadataEndpoint,
    `${dataNodeId}/summary/`,
  );
}

export function fetchDataNodeDetail(dataNodeId: number) {
  return requestJson<DataNodeDetail>(
    dynamicTableMetadataEndpoint,
    `${dataNodeId}/`,
  );
}

export function fetchDataNodeCompressionPolicy(dataNodeId: number) {
  return requestJson<DataNodePolicyState<DataNodeCompressionPolicyConfig>>(
    dynamicTableMetadataEndpoint,
    `${dataNodeId}/compression-policy/`,
  );
}

export function saveDataNodeCompressionPolicy(
  dataNodeId: number,
  input: DataNodeCompressionPolicyInput,
) {
  return requestJson<DataNodePolicyState<DataNodeCompressionPolicyConfig>>(
    dynamicTableMetadataEndpoint,
    `${dataNodeId}/compression-policy/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function fetchDataNodeRetentionPolicy(dataNodeId: number) {
  return requestJson<DataNodePolicyState<DataNodeRetentionPolicyConfig>>(
    dynamicTableMetadataEndpoint,
    `${dataNodeId}/retention-policy/`,
  );
}

export function saveDataNodeRetentionPolicy(
  dataNodeId: number,
  input: DataNodeRetentionPolicyInput,
) {
  return requestJson<DataNodePolicyState<DataNodeRetentionPolicyConfig>>(
    dynamicTableMetadataEndpoint,
    `${dataNodeId}/retention-policy/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function fetchResourceReleaseSummary(resourceReleaseId: number) {
  return requestJson<ResourceReleaseSummaryHeader>(
    commandCenterConfig.mainSequence.endpoint,
    `resource-release/${resourceReleaseId}/summary/`,
  );
}

export function fetchJobRunSummary(jobRunId: number) {
  return requestJson<EntitySummaryHeader>(
    commandCenterConfig.mainSequence.endpoint,
    `job-run/${jobRunId}/summary/`,
  );
}

export function fetchJobRunLogs(jobRunId: number) {
  return requestJson<JobRunLogsResponse | JobRunLogEntry[]>(
    commandCenterConfig.mainSequence.endpoint,
    `job-run/${jobRunId}/get_logs/`,
    undefined,
    { response_format: "tanstack" },
  ).then((payload) => {
    if (Array.isArray(payload)) {
      return {
        job_run_id: jobRunId,
        status: "",
        rows: payload,
      } satisfies JobRunLogsResponse;
    }

    return payload;
  });
}

export function fetchProjectRepositoryBrowser(projectId: number, path = "") {
  return requestJson<ProjectRepositoryBrowserResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `projects/${projectId}/browse-repository/`,
    undefined,
    { path },
  );
}

export async function fetchProjectResourceCode(projectId: number, path = "") {
  const payload = await requestJson<ProjectResourceCodeResponse | string | null>(
    commandCenterConfig.mainSequence.endpoint,
    `projects/${projectId}/resource-code/`,
    {
      headers: {
        Accept: "text/plain, application/json",
      },
    },
    { path },
  );

  if (typeof payload === "string") {
    const recoveredPayload = tryParseLooseProjectResourceCodeResponse(
      payload,
      projectId,
      path,
    );

    if (recoveredPayload) {
      return recoveredPayload;
    }

    const fallbackName = path.split("/").filter(Boolean).at(-1) ?? path;

    return {
      project_id: projectId,
      path,
      name: fallbackName,
      language: null,
      content: payload,
    } satisfies ProjectResourceCodeResponse;
  }

  if (payload === null) {
    const fallbackName = path.split("/").filter(Boolean).at(-1) ?? path;

    return {
      project_id: projectId,
      path,
      name: fallbackName,
      language: null,
      content: "",
    } satisfies ProjectResourceCodeResponse;
  }

  return {
    ...payload,
    path: payload.path || path,
    name: payload.name || path.split("/").filter(Boolean).at(-1) || path,
    language: payload.language ?? null,
    content: payload.content ?? "",
  } satisfies ProjectResourceCodeResponse;
}

function prettifyFieldName(field: string) {
  return field.replace(/_/g, " ");
}

function flattenErrorMessages(payload: unknown, parentKey?: string): string[] {
  if (typeof payload === "string" && payload.trim()) {
    return [parentKey ? `${prettifyFieldName(parentKey)}: ${payload.trim()}` : payload.trim()];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => flattenErrorMessages(entry, parentKey));
  }

  if (payload && typeof payload === "object") {
    return Object.entries(payload as Record<string, unknown>).flatMap(([key, value]) =>
      flattenErrorMessages(value, key),
    );
  }

  return [];
}

export function formatMainSequenceError(error: unknown) {
  if (error instanceof MainSequenceApiError) {
    const detailMessages = flattenErrorMessages(error.details).filter(Boolean);

    return detailMessages.length > 0 ? detailMessages.join(" ") : error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "The request failed.";
}
