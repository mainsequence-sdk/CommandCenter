import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";

const devAuthProxyPrefix = "/__command_center_auth__";
const dynamicTableDataSourceEndpoint = "/orm/api/ts_manager/dynamic_table_data_source/";
const dynamicTableMetadataEndpoint = "/orm/api/ts_manager/dynamic_table/";
const localTimeSerieEndpoint = "/orm/api/ts_manager/local_time_serie/";
const availableGpuTypesEndpoint = "/orm/api/pods/billing/available-gpu-types/";
const assetEndpoint = "/orm/api/assets/asset/";
const assetCategoryEndpoint = "/orm/api/assets/asset-category/";
const virtualFundEndpoint = "/orm/api/assets/virtualfund/";
const executionVenueEndpoint = "/orm/api/assets/execution_venue/";
const portfolioGroupEndpoint = "/orm/api/assets/portfolio_group/";
const targetPortfolioEndpoint = "/orm/api/assets/target_portfolio/";
const assetTranslationTableEndpoint = "/orm/api/assets/asset-translation-tables/";
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

export interface FrontendListPagination {
  page: number;
  page_size: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_previous: boolean;
  start_index: number;
  end_index: number;
}

export interface FrontendRowsResponse<T> {
  search: string;
  rows: T[];
  pagination: FrontendListPagination;
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

export interface ProjectDataSourceListRelatedResource {
  id: number | null;
  label: string;
  class_type: string;
  status: string;
}

export interface ProjectDataSourceListRow {
  id: number;
  display_name: string;
  is_default_data_source: boolean;
  related_resource: ProjectDataSourceListRelatedResource | null;
  creation_date: string | null;
  creation_date_display: string;
}

export interface ProjectDataSourceListPagination {
  page: number;
  page_size: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_previous: boolean;
  start_index: number;
  end_index: number;
}

export interface ProjectDataSourceListResponse {
  search: string;
  rows: ProjectDataSourceListRow[];
  pagination: ProjectDataSourceListPagination;
}

export interface ProjectDataSourceBulkDeleteInput {
  ids?: number[];
  selectAll?: boolean;
  search?: string;
}

export interface ProjectDataSourceBulkDeleteResponse {
  detail: string;
  deleted_count: number;
}

export interface ProjectDataSourceEditorEntity {
  id: number;
  type: string;
  title: string;
}

export interface ProjectDataSourceEditorField {
  key: "display_name" | "related_resource" | "is_default_data_source";
  label: string;
  editor: "text" | "remote_select" | "checkbox";
  required: boolean;
  value: string | number | boolean | null;
  display_value?: string;
  choices_path?: string;
}

export interface ProjectDataSourceEditorActions {
  submit: {
    method: "POST" | "PATCH";
    path: string;
  };
  cancel_path: string;
  delete?: {
    method: "POST";
    path: string;
    redirect_path: string;
  };
}

export interface ProjectDataSourceEditorPayload {
  mode: "create" | "edit";
  entity: ProjectDataSourceEditorEntity | null;
  fields: ProjectDataSourceEditorField[];
  actions: ProjectDataSourceEditorActions;
}

export interface ProjectDataSourceRelatedResourceOption {
  id: number;
  label: string;
  class_type: string;
  status: string;
}

export interface ProjectDataSourceEditorInput {
  display_name: string;
  related_resource: number;
  is_default_data_source: boolean;
}

export interface ProjectDataSourceEditorWriteResponse {
  detail: string;
  id: number;
  display_name: string;
  redirect_path: string;
}

export interface ProjectDataSourceDeleteResponse {
  detail: string;
  id: number;
  redirect_path: string;
}

export interface PhysicalDataSourceListRow {
  id: number;
  display_name: string;
  source_logo: string;
  class_type: string;
  class_type_label: string;
  status: string;
  status_label: string;
  status_tone: "success" | "warning" | "danger" | "neutral" | "info";
  creation_date: string | null;
  creation_date_display: string;
}

export interface PhysicalDataSourceListPagination {
  page: number;
  page_size: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_previous: boolean;
  start_index: number;
  end_index: number;
}

export interface PhysicalDataSourceListResponse {
  search: string;
  class_type: string;
  rows: PhysicalDataSourceListRow[];
  pagination: PhysicalDataSourceListPagination;
}

export interface PhysicalDataSourceBulkDeleteInput {
  ids?: number[];
  selectAll?: boolean;
  search?: string;
  classType?: string;
}

export interface PhysicalDataSourceBulkDeleteResponse {
  detail: string;
  deleted_count: number;
}

export interface PhysicalDataSourceEditorField {
  key:
    | "display_name"
    | "file_path"
    | "database_user"
    | "password"
    | "host"
    | "port"
    | "database_name"
    | "description"
    | "tags"
    | "internal_code"
    | "class_type"
    | "status";
  label: string;
  editor: "text" | "password" | "number" | "textarea";
  required: boolean;
  value?: string | number | boolean | null;
  read_only?: boolean;
  placeholder?: string;
  help_text?: string;
}

export interface PhysicalDataSourceEditorActions {
  submit: {
    method: "POST" | "PATCH";
    path: string;
  };
  delete?: {
    method: "POST";
    path: string;
    redirect_path: string;
  };
  cancel_path: string;
}

export interface PhysicalDataSourceEditorPayload {
  mode: "create" | "edit";
  entity?: {
    id: number;
    type: string;
    title: string;
  } | null;
  title: string;
  source_type?: "duck_db" | "timescale_db" | "timescale_db_gcp_cloud" | "";
  source_type_label?: string;
  fields: PhysicalDataSourceEditorField[];
  actions: PhysicalDataSourceEditorActions;
}

export interface PhysicalDataSourceEditorCreateInput {
  source_type: "duck_db" | "timescale_db" | "timescale_db_gcp_cloud";
  display_name?: string;
  file_path?: string;
  database_user?: string;
  password?: string;
  host?: string;
  port?: number;
  database_name?: string;
  description?: string;
  tags?: string;
}

export interface PhysicalDataSourceEditorUpdateInput {
  display_name?: string;
  description?: string;
  internal_code?: string;
}

export interface PhysicalDataSourceEditorWriteResponse {
  detail: string;
  id: number;
  display_name: string;
  redirect_path: string;
}

export interface PhysicalDataSourceDeleteResponse {
  detail: string;
  id: number;
  redirect_path: string;
}

export interface AssetListRow {
  id: number;
  unique_identifier: string | null;
  figi: string | null;
  name: string | null;
  ticker: string | null;
  exchange_code: string | null;
  security_market_sector: string | null;
  security_type: string | null;
  is_custom_by_organization: boolean;
}

export interface AssetBulkDeleteInput {
  ids: number[];
}

export interface AssetBulkDeleteResponse {
  detail: string;
  deleted_count?: number;
}

export interface AssetCategoryListRow {
  id: number;
  unique_identifier: string;
  display_name: string;
  description: string;
  number_of_assets: number;
}

export interface AssetCategoryListResponse extends FrontendRowsResponse<AssetCategoryListRow> {}

export interface AssetCategoryDetailSelectedCategory {
  id: number;
  text: string;
  sub_text: string;
}

export interface AssetCategoryDetailField {
  name: string;
  label: string;
  value_type: "text" | "number" | "boolean";
  value: string | number | boolean | null;
}

export interface AssetCategoryDetailActions {
  can_edit: boolean;
  can_delete: boolean;
  update_endpoint: string;
  delete_endpoint: string;
}

export interface AssetCategoryDetailAssetsListConfig {
  list_endpoint: string;
  query_endpoint: string;
  response_format: string;
  default_filters: Record<string, QueryValue>;
}

export interface AssetCategoryDetailResponse {
  id: number;
  title: string;
  selected_category: AssetCategoryDetailSelectedCategory;
  details: AssetCategoryDetailField[];
  actions: AssetCategoryDetailActions;
  assets_list: AssetCategoryDetailAssetsListConfig;
}

export interface AssetCategoryRecord {
  id: number;
  unique_identifier: string;
  display_name: string;
  description: string;
  assets: number[];
}

export interface CreateAssetCategoryInput {
  display_name: string;
  description?: string;
  unique_identifier?: string;
  assets?: number[];
}

export interface UpdateAssetCategoryInput {
  display_name?: string;
  description?: string;
  assets?: number[];
}

export interface AssetCategoryBulkDeleteInput {
  ids?: number[];
  selectAll?: boolean;
  currentUrl?: string;
  search?: string;
  displayName?: string;
  displayNameContains?: string;
  uniqueIdentifier?: string;
  uniqueIdentifierContains?: string;
  description?: string;
  descriptionContains?: string;
  organizationOwnerUid?: string;
}

export interface AssetCategoryBulkDeleteResponse {
  detail: string;
  deleted_count: number;
}

export interface ExecutionVenueListRow {
  id: number;
  symbol: string;
  name: string;
}

export interface ExecutionVenueRecord extends ExecutionVenueListRow {}

export interface CreateExecutionVenueInput {
  symbol: string;
  name: string;
}

export interface VirtualFundListRow {
  id: number;
  target_portfolio_id: number | null;
  target_portfolio_name: string;
  account_id: number | null;
  account_name: string;
}

export interface UpdateExecutionVenueInput {
  symbol: string;
  name: string;
}

export interface PortfolioGroupListRow extends Record<string, unknown> {
  id: number;
  name?: string | null;
  display_name?: string | null;
  portfolio_group_name?: string | null;
  unique_identifier?: string | null;
  description?: string | null;
  portfolios?: number[] | null;
  portfolio_ids?: number[] | null;
  creation_date?: string | null;
  creation_date_display?: string | null;
  created_at?: string | null;
  created_display?: string | null;
  created?: string | null;
}

export interface PortfolioGroupRecord extends PortfolioGroupListRow {}

export interface CreatePortfolioGroupInput {
  unique_identifier: string;
  display_name?: string;
  source?: string;
  description?: string;
  portfolios?: number[];
}

export interface PortfolioGroupBulkDeleteInput {
  ids?: number[];
}

export interface PortfolioGroupBulkDeleteResponse {
  detail: string;
  deleted_count?: number;
}

export interface PortfolioGroupPortfolioMutationInput {
  portfolios: number[];
}

export interface TargetPortfolioListRow extends Record<string, unknown> {
  id: number;
  portfolio_name?: string | null;
  creation_date?: string | null;
  index_asset?: {
    id?: number | null;
    current_snapshot?: {
      id?: number | null;
      name?: string | null;
      ticker?: string | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  portfolio_index_asset?: {
    id?: number | null;
    current_snapshot?: {
      id?: number | null;
      name?: string | null;
      ticker?: string | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
}

export interface TargetPortfolioBulkDeleteInput {
  ids?: number[];
  selectedItemsIds?: string;
  selectAll?: boolean;
  currentUrl?: string;
}

export interface TargetPortfolioBulkDeleteResponse {
  detail: string;
  deleted_count?: number;
}

export interface TargetPortfolioSearchOption {
  id: number;
  portfolio_name: string;
  creation_date?: string | null;
}

export interface TargetPortfolioSummaryExtra extends EntitySummaryExtra {
  description?: string;
  signal_name?: string;
  signal_description?: string;
  rebalance_strategy_name?: string;
  rebalance_strategy_description?: string;
  weights?: unknown;
  portfolio_weights?: unknown;
  target_weights?: unknown;
  weight_rows?: unknown;
  [key: string]: unknown;
}

export interface TargetPortfolioSummaryHeader extends EntitySummaryHeader {
  extra?: TargetPortfolioSummaryExtra;
  extras?: TargetPortfolioSummaryExtra;
}

export interface TargetPortfolioWeightsPositionColumnDef {
  field: string;
  headerName?: string;
  [key: string]: unknown;
}

export interface TargetPortfolioWeightsPositionDetailsResponse {
  weights: unknown;
  position_columns: unknown[];
  rows: Array<Record<string, unknown>>;
  columnDefs: TargetPortfolioWeightsPositionColumnDef[];
  summaryColumnDefs: TargetPortfolioWeightsPositionColumnDef[];
  position_map: Record<string, unknown> | null;
  weights_date: string | null;
}

export interface AssetTranslationTableListRow {
  id: number;
  unique_identifier: string;
  rules_number: number;
  creation_date: string | null;
}

export interface AssetTranslationTableListResponse
  extends FrontendRowsResponse<AssetTranslationTableListRow> {}

export interface AssetTranslationTableRecord {
  id: number;
  unique_identifier: string;
}

export interface CreateAssetTranslationTableInput {
  unique_identifier: string;
}

export interface UpdateAssetTranslationTableInput {
  unique_identifier: string;
}

export interface AssetTranslationTableBulkDeleteInput {
  ids?: number[];
  selectAll?: boolean;
  search?: string;
}

export interface AssetTranslationTableBulkDeleteResponse {
  detail: string;
  deleted_count: number;
}

export interface AssetTranslationTableDetailSelectedTable {
  id: number;
  text: string;
  sub_text: string;
}

export interface AssetTranslationTableDetailField {
  name: string;
  label: string;
  value_type: "text" | "number" | "boolean" | "datetime";
  value: string | number | boolean | null;
}

export interface AssetTranslationTableDetailActions {
  can_edit: boolean;
  can_delete: boolean;
  update_endpoint: string;
  delete_endpoint: string;
}

export interface AssetTranslationTableRulesListConfig {
  list_endpoint: string;
  response_format: string;
  create_endpoint: string;
}

export interface AssetTranslationTableDetailResponse {
  id: number;
  title: string;
  selected_table: AssetTranslationTableDetailSelectedTable;
  details: AssetTranslationTableDetailField[];
  actions: AssetTranslationTableDetailActions;
  rules_list: AssetTranslationTableRulesListConfig;
}

export interface AssetTranslationTableRuleListRow {
  id: number;
  security_type: string | null;
  security_market_sector: string | null;
  markets_time_serie_unique_identifier: string;
  target_exchange_code: string | null;
  default_column_name: string | null;
  creation_date: string | null;
  detail_endpoint: string;
  update_endpoint: string;
  delete_endpoint: string;
}

export interface AssetTranslationTableRuleListResponse
  extends FrontendRowsResponse<AssetTranslationTableRuleListRow> {}

export interface AssetTranslationTableRuleInput {
  asset_filter: {
    security_type?: string;
    security_market_sector?: string;
  };
  markets_time_serie_unique_identifier: string;
  target_exchange_code?: string;
  default_column_name?: string;
}

export interface AssetTranslationTableRuleDeleteResponse {
  detail: string;
  deleted_rule?: boolean;
  detached_only?: boolean;
}

export interface AssetDetailField {
  key?: string | null;
  label: string;
  value: unknown;
  value_type?: string | null;
  meta?: string | null;
  description?: string | null;
}

export interface AssetTradingViewAlert {
  id?: string | number | null;
  title?: string | null;
  label?: string | null;
  name?: string | null;
  message?: string | null;
  description?: string | null;
  condition?: string | null;
  severity?: string | null;
  [key: string]: unknown;
}

export interface AssetTradingViewConfig {
  enabled: boolean;
  symbol?: string | null;
  alerts?: Array<AssetTradingViewAlert | string> | null;
}

export interface AssetOrderFormConfig {
  order_types?: string[] | null;
  default_order_type?: string | null;
}

export interface AssetDetailResponse {
  id: number;
  name?: string | null;
  ticker?: string | null;
  unique_identifier?: string | null;
  figi?: string | null;
  exchange_code?: string | null;
  security_market_sector?: string | null;
  security_type?: string | null;
  is_custom_by_organization?: boolean;
  details?: AssetDetailField[] | null;
  trading_view?: AssetTradingViewConfig | null;
  order_form?: AssetOrderFormConfig | null;
  [key: string]: unknown;
}

export interface AssetOrderFormFieldChoice {
  value: string | number | boolean;
  label: string;
  description?: string;
}

export interface AssetOrderFormField {
  key?: string | null;
  name?: string | null;
  label?: string | null;
  editor?: string | null;
  type?: string | null;
  required?: boolean;
  value?: unknown;
  placeholder?: string | null;
  help_text?: string | null;
  description?: string | null;
  read_only?: boolean;
  choices?:
    | Array<AssetOrderFormFieldChoice | string | number | boolean>
    | null;
  options?:
    | Array<AssetOrderFormFieldChoice | string | number | boolean>
    | null;
  [key: string]: unknown;
}

export interface AssetOrderFormFieldsResponse {
  fields?: AssetOrderFormField[] | null;
}

export interface ClusterListRow {
  id: number;
  uuid: string;
  cluster_name: string;
}

export interface ClusterListPagination {
  page: number;
  page_size: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_previous: boolean;
  start_index: number;
  end_index: number;
}

export interface ClusterListResponse {
  search: string;
  rows: ClusterListRow[];
  pagination: ClusterListPagination;
}

export type ClusterDetailTabId =
  | "node_pools"
  | "nodes"
  | "namespaces"
  | "pods"
  | "deployments"
  | "services"
  | "storage"
  | "knative";

export interface ClusterDetailEntity {
  id: number;
  uuid: string;
  cluster_name: string;
  cluster_description?: string | null;
  [key: string]: unknown;
}

export interface ClusterDetailStatus {
  status: string;
  color?: string | null;
}

export interface ClusterDetailStatItem {
  key?: string | null;
  label?: string | null;
  title?: string | null;
  name?: string | null;
  display?: string | number | null;
  value?: string | number | null;
  info?: string | null;
  description?: string | null;
  tone?: string | null;
}

export interface ClusterDetailTabDefinition {
  id?: string | null;
  key?: string | null;
  slug?: string | null;
  value?: string | null;
  label?: string | null;
  title?: string | null;
  name?: string | null;
  count?: string | number | null;
}

export interface ClusterDetailSummary {
  cluster: ClusterDetailEntity;
  cluster_status: ClusterDetailStatus;
  cloud_provider_label?: string | null;
  location?: string | null;
  cluster_configuration_name?: string | null;
  allow_to_run_jupyter_hub?: boolean;
  allow_to_run_data_sources?: boolean;
  is_auto_pilot_cluster?: boolean;
  stats_items: ClusterDetailStatItem[];
  tabs: ClusterDetailTabDefinition[];
  summary_warning?: string | null;
  [key: string]: unknown;
}

export interface ClusterNodePoolRow {
  name: string;
  status?: string | null;
  version?: string | null;
  machine_type?: string | null;
  disk_size_gb?: number | string | null;
  spot?: boolean | null;
  nodes?: number | string | null;
  pods?: number | string | null;
  min_nodes?: number | string | null;
  max_nodes?: number | string | null;
  image_type?: string | null;
  auto_upgrade?: boolean | null;
  auto_repair?: boolean | null;
}

export interface ClusterNodeRow {
  name: string;
  status?: string | null;
  node_pool?: string | null;
  machine_type?: string | null;
  zone?: string | null;
  version?: string | null;
  cpu_allocatable?: number | string | null;
  memory_allocatable_gib?: number | string | null;
  ephemeral_storage_gib?: number | string | null;
  pod_cidr?: string | null;
  age?: string | null;
}

export interface ClusterNamespaceRow {
  name: string;
  status?: string | null;
  pods?: number | string | null;
  deployments?: number | string | null;
  services?: number | string | null;
  pvcs?: number | string | null;
  knative_services?: number | string | null;
  age?: string | null;
}

export interface ClusterPodRow {
  name: string;
  namespace?: string | null;
  status?: string | null;
  node_pool?: string | null;
  node?: string | null;
  pod_ip?: string | null;
  host_ip?: string | null;
  qos_class?: string | null;
  restarts?: number | string | null;
  owner_kind?: string | null;
  owner_name?: string | null;
  age?: string | null;
}

export interface ClusterDeploymentRow {
  name: string;
  namespace?: string | null;
  ready?: string | number | null;
  up_to_date?: string | number | null;
  available?: string | number | null;
  strategy?: string | null;
  age?: string | null;
}

export interface ClusterServiceRow {
  name: string;
  namespace?: string | null;
  type?: string | null;
  cluster_ip?: string | null;
  external_ip?: string | null;
  ports?: unknown;
  age?: string | null;
}

export interface ClusterStorageRow {
  kind?: string | null;
  name: string;
  namespace?: string | null;
  status?: string | null;
  storage_class?: string | null;
  size_gib?: string | number | null;
  volume?: string | null;
  access_modes?: unknown;
  age?: string | null;
}

export interface ClusterKnativeRow {
  name: string;
  namespace?: string | null;
  ready?: string | null;
  url?: string | null;
  latest_created_revision?: string | null;
  latest_ready_revision?: string | null;
  age?: string | null;
}

export interface ClusterScaleResponse {
  detail?: string;
  message?: string;
  confirmation?: string;
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

export interface BucketRecord {
  id: number;
  name: string;
}

export interface CreateBucketInput {
  name: string;
}

export interface BucketBulkDeleteInput {
  ids?: number[];
  selectAll?: boolean;
  currentUrl?: string;
  search?: string;
  name?: string;
  nameIn?: string;
}

export interface BucketBulkDeleteResponse {
  detail: string;
  deleted_count: number;
}

export type BucketSummaryHeader = EntitySummaryHeader;

export interface BucketBrowseBreadcrumb {
  name: string;
  prefix: string;
}

export interface BucketBrowseFolder {
  name: string;
  prefix: string;
  row_id: string;
  count_files: number;
  count_subfolders: number;
}

export interface BucketBrowseFile {
  id: number;
  name: string;
  display_name: string;
  created_by_pod?: string;
  created_by_resource_name?: string;
  creation_date?: string | null;
  creation_date_display?: string;
  size_bytes: number;
  size_display: string;
  content_url?: string;
}

export interface BucketBrowseStats {
  artifact_count: number;
  folder_count: number;
  file_count: number;
  bucket_size_bytes: number;
  bucket_size_display: string;
}

export interface BucketBrowsePagination {
  page: number;
  page_size: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_previous: boolean;
  start_index: number;
  end_index: number;
}

export interface BucketBrowseResponse {
  bucket_id: number;
  bucket_name: string;
  current_prefix: string;
  search: string;
  sort: string;
  dir: "asc" | "desc";
  breadcrumbs: BucketBrowseBreadcrumb[];
  stats: BucketBrowseStats;
  folders: BucketBrowseFolder[];
  files: BucketBrowseFile[];
  pagination: BucketBrowsePagination;
}

export interface CreateBucketFolderInput {
  prefix: string;
  name: string;
}

export interface CreateBucketFolderResponse {
  detail: string;
  bucket_id: number;
  prefix: string;
  marker_artifact_id: number;
}

export interface UploadBucketArtifactInput {
  file: File;
  prefix: string;
  filename: string;
}

export interface UploadBucketArtifactResponse {
  id: number;
  name: string;
  bucket_id: number;
  size_bytes: number;
  size_display: string;
  content_url: string;
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

export interface DataNodeRemoteDataRequest {
  start_date: number;
  end_date: number;
  columns: string[];
  unique_identifier_list?: string[];
  unique_identifier_range_map?: Record<string, [number, number]>;
  great_or_equal?: boolean;
  less_or_equal?: boolean;
  limit?: number;
  offset?: number;
}

export type DataNodeRemoteDataRow = Record<string, unknown>;
export type DataNodeLastObservation = DataNodeRemoteDataRow | null;

export interface DynamicTableBulkActionItemResult {
  dynamic_table_metadata_id: number;
  storage_hash: string;
  ok: boolean;
  detail?: string;
}

export interface DynamicTableBulkActionResponse {
  ok: boolean;
  action: string;
  requested_ids: number[];
  requested_count: number;
  select_all: boolean;
  matched_count: number;
  success_count: number;
  failed_count: number;
  results: DynamicTableBulkActionItemResult[];
}

export interface DynamicTableBulkDeleteInput {
  selectedIds: number[];
  fullDeleteSelected?: boolean;
  fullDeleteDownstreamTables?: boolean;
  deleteWithNoTable?: boolean;
  overrideProtection?: boolean;
}

export interface DynamicTableBulkDeleteResponse {
  ok: boolean;
  requested_ids: number[];
  requested_count: number;
  select_all: boolean;
  matched_count: number;
  selected_deleted: number;
  downstream_deleted: number;
  missing_table_deleted: number;
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

export interface LocalTimeSerieRunConfigurationInput {
  retry_on_error?: boolean;
  seconds_wait_on_retry?: number | null;
  required_cpus?: string | number | null;
  required_gpus?: string | number | null;
  execution_time_out_seconds?: number | null;
  update_schedule?: unknown;
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

export interface LocalTimeSerieHistoricalUpdateRecord {
  id: number;
  related_table: number;
  update_time_start: string | null;
  update_time_end: string | null;
  error_on_update: boolean;
  trace_id: string | null;
  updated_by_user: number | null;
}

export interface LocalTimeSerieDependencyGraphEdge {
  source: string | number;
  target: string | number;
}

export interface LocalTimeSerieDependencyGraphNode {
  id: string | number;
  update_hash?: string;
  card_title?: string;
  card_subtitle?: string;
  depth?: number;
  color?: string;
  background_color?: string;
  icon?: string;
  badges?: string[];
  properties?: Record<string, unknown>;
  parent?: string;
}

export interface LocalTimeSerieDependencyGraphGroup {
  group?: string;
  classes?: string;
  data?: Record<string, unknown>;
}

export interface LocalTimeSerieDependencyGraphResponse {
  nodes: LocalTimeSerieDependencyGraphNode[];
  edges: LocalTimeSerieDependencyGraphEdge[];
  groups: LocalTimeSerieDependencyGraphGroup[];
}

export interface LocalTimeSerieLogsGridRow {
  timestamp?: string | null;
  level?: string | null;
  event?: string | null;
  detail?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface LocalTimeSerieLogsGridResponse {
  rows: LocalTimeSerieLogsGridRow[];
  columnDefs: Array<Record<string, unknown>>;
  detailColumnDefs: Array<Record<string, unknown>>;
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
  generated_search_document?: string;
}

export interface EntitySummaryHeader {
  entity: SummaryEntity;
  badges: SummaryBadge[];
  inline_fields: SummaryField[];
  highlight_fields: SummaryField[];
  stats: SummaryStat[];
  extra?: EntitySummaryExtra;
  extras?: EntitySummaryExtra;
}

export type ProjectSummaryHeader = EntitySummaryHeader;
export type DataNodeSummaryHeader = EntitySummaryHeader;
export type LocalTimeSerieSummaryHeader = EntitySummaryHeader;
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

export interface AssetListFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
  categoryId?: number;
  ticker?: string;
  name?: string;
  exchangeCode?: string;
  isCustomByOrganization?: boolean;
  currentSnapshotFilters?: Record<string, QueryValue>;
}

export interface AssetCategoryListFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ExecutionVenueListFilters {
  search?: string;
  limit?: number;
  offset?: number;
  symbol?: string;
  symbolIn?: string[];
  name?: string;
  nameIn?: string[];
  nameContains?: string;
}

export interface PortfolioGroupListFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface VirtualFundListFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TargetPortfolioListFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TargetPortfolioSearchFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AssetTranslationTableListFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  usePostQuery?: boolean;
}

export interface AssetTranslationTableRuleListFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}
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

function buildFrontendListPagination(totalItems: number, limit: number, offset: number): FrontendListPagination {
  const safePageSize = Math.max(1, limit);
  const safeOffset = Math.max(0, offset);
  const page = Math.floor(safeOffset / safePageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const hasPrevious = safeOffset > 0;
  const hasNext = safeOffset + safePageSize < totalItems;
  const startIndex = totalItems === 0 ? 0 : safeOffset + 1;
  const endIndex = totalItems === 0 ? 0 : Math.min(totalItems, safeOffset + safePageSize);

  return {
    page,
    page_size: safePageSize,
    total_pages: totalPages,
    total_items: totalItems,
    has_next: hasNext,
    has_previous: hasPrevious,
    start_index: startIndex,
    end_index: endIndex,
  };
}

function normalizeFrontendRowsResponse<T>(
  payload: FrontendRowsResponse<T> | PaginatedResponse<T> | T[],
  {
    search,
    limit,
    offset,
  }: {
    search?: string;
    limit: number;
    offset: number;
  },
): FrontendRowsResponse<T> {
  if (!Array.isArray(payload) && "rows" in payload && Array.isArray(payload.rows)) {
    return {
      search:
        "search" in payload && typeof payload.search === "string"
          ? payload.search
          : search?.trim() || "",
      rows: payload.rows,
      pagination:
        "pagination" in payload && payload.pagination
          ? payload.pagination
          : buildFrontendListPagination(payload.rows.length, limit, offset),
    };
  }

  if (!Array.isArray(payload) && "results" in payload && Array.isArray(payload.results)) {
    return {
      search: search?.trim() || "",
      rows: payload.results,
      pagination: buildFrontendListPagination(payload.count, limit, offset),
    };
  }

  const rows = Array.isArray(payload) ? payload : [];

  return {
    search: search?.trim() || "",
    rows,
    pagination: buildFrontendListPagination(rows.length, limit, offset),
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

    if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
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

function isEntitySummaryHeaderPayload(payload: unknown): payload is EntitySummaryHeader {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    !!candidate.entity &&
    Array.isArray(candidate.badges) &&
    Array.isArray(candidate.inline_fields) &&
    Array.isArray(candidate.highlight_fields) &&
    Array.isArray(candidate.stats)
  );
}

function buildAssetCategorySearchFilterValue(categoryId?: number) {
  return typeof categoryId === "number" && Number.isFinite(categoryId) && categoryId > 0
    ? categoryId
    : undefined;
}

function buildAssetCategoryBodyFilterValue(categoryId?: number) {
  return typeof categoryId === "number" && Number.isFinite(categoryId) && categoryId > 0
    ? categoryId
    : undefined;
}

function buildAssetListSearch(filters: AssetListFilters, includeResponseFormat = true) {
  return {
    ...(includeResponseFormat ? { response_format: "frontend_list" } : {}),
    search: filters.search?.trim() || undefined,
    limit: filters.limit,
    offset: filters.offset,
    categories__id: buildAssetCategorySearchFilterValue(filters.categoryId),
    ticker: filters.ticker?.trim() || undefined,
    name: filters.name?.trim() || undefined,
    exchange_code: filters.exchangeCode?.trim() || undefined,
    is_custom_by_organization: filters.isCustomByOrganization,
    ...(filters.currentSnapshotFilters ?? {}),
  } satisfies Record<string, QueryValue>;
}

function shouldUseAssetQuery(filters: AssetListFilters) {
  return Boolean(
    filters.ticker?.trim() ||
      filters.name?.trim() ||
      filters.exchangeCode?.trim() ||
      Object.keys(filters.currentSnapshotFilters ?? {}).length > 0,
  );
}

function buildAssetQueryBody(filters: AssetListFilters) {
  return {
    search: filters.search?.trim() || undefined,
    limit: filters.limit,
    offset: filters.offset,
    categories__id: buildAssetCategoryBodyFilterValue(filters.categoryId),
    ticker: filters.ticker?.trim() || undefined,
    name: filters.name?.trim() || undefined,
    exchange_code: filters.exchangeCode?.trim() || undefined,
    is_custom_by_organization: filters.isCustomByOrganization,
    ...(filters.currentSnapshotFilters ?? {}),
  };
}

function buildAssetCategoryListSearch(
  filters: AssetCategoryListFilters,
  includeResponseFormat = true,
) {
  return {
    ...(includeResponseFormat ? { response_format: "frontend_list" } : {}),
    search: filters.search?.trim() || undefined,
    limit: filters.limit,
    offset: filters.offset,
  } satisfies Record<string, QueryValue>;
}

function buildDelimitedSearchValue(values?: string[]) {
  const normalizedValues =
    values?.map((value) => value.trim()).filter((value) => value.length > 0) ?? [];

  return normalizedValues.length > 0 ? normalizedValues.join(",") : undefined;
}

function buildExecutionVenueListSearch(filters: ExecutionVenueListFilters) {
  return {
    search: filters.search?.trim() || undefined,
    limit: filters.limit,
    offset: filters.offset,
    symbol: filters.symbol?.trim() || undefined,
    symbol__in: buildDelimitedSearchValue(filters.symbolIn),
    name: filters.name?.trim() || undefined,
    name__in: buildDelimitedSearchValue(filters.nameIn),
    name__contains: filters.nameContains?.trim() || undefined,
  } satisfies Record<string, QueryValue>;
}

function buildPortfolioGroupListSearch(filters: PortfolioGroupListFilters) {
  return {
    response_format: "frontend_list",
    search: filters.search?.trim() || undefined,
    limit: filters.limit,
    offset: filters.offset,
  } satisfies Record<string, QueryValue>;
}

function buildTargetPortfolioListSearch(filters: TargetPortfolioListFilters) {
  return {
    search: filters.search?.trim() || undefined,
    limit: filters.limit,
    offset: filters.offset,
    fields: "id,creation_date,index_asset",
  } satisfies Record<string, QueryValue>;
}

function buildAssetTranslationTableListSearch(
  filters: AssetTranslationTableListFilters,
  includeResponseFormat = true,
) {
  return {
    ...(includeResponseFormat ? { response_format: "frontend_list" } : {}),
    search: filters.search?.trim() || undefined,
    page: filters.page,
    page_size: filters.pageSize,
  } satisfies Record<string, QueryValue>;
}

function buildAssetTranslationTableQueryBody(filters: AssetTranslationTableListFilters) {
  return {
    search: filters.search?.trim() || undefined,
    page: filters.page,
    page_size: filters.pageSize,
  };
}

function buildAssetTranslationTableRulesListSearch(
  filters: AssetTranslationTableRuleListFilters,
  includeResponseFormat = true,
) {
  return {
    ...(includeResponseFormat ? { response_format: "frontend_list" } : {}),
    search: filters.search?.trim() || undefined,
    page: filters.page,
    page_size: filters.pageSize,
  } satisfies Record<string, QueryValue>;
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

export async function listAssets({
  search,
  page = 1,
  pageSize = mainSequenceRegistryPageSize,
  limit = pageSize,
  offset = (page - 1) * pageSize,
  categoryId,
  ticker,
  name,
  exchangeCode,
  isCustomByOrganization,
  currentSnapshotFilters,
}: AssetListFilters = {}) {
  const filters = {
    search,
    page,
    pageSize,
    limit,
    offset,
    categoryId,
    ticker,
    name,
    exchangeCode,
    isCustomByOrganization,
    currentSnapshotFilters,
  } satisfies AssetListFilters;

  if (shouldUseAssetQuery(filters)) {
    const payload = await requestJson<PaginatedResponse<AssetListRow> | AssetListRow[]>(
      assetEndpoint,
      "query/",
      {
        method: "POST",
        body: JSON.stringify(buildAssetQueryBody(filters)),
      },
      { response_format: "frontend_list" },
    );

    return normalizeOffsetPaginatedResponse(payload, limit, offset);
  }

  const payload = await requestJson<PaginatedResponse<AssetListRow> | AssetListRow[]>(
    assetEndpoint,
    "",
    undefined,
    buildAssetListSearch(filters),
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function fetchAssetSummary({
  search,
  page = 1,
  pageSize = mainSequenceRegistryPageSize,
  limit = pageSize,
  offset = (page - 1) * pageSize,
  categoryId,
  ticker,
  name,
  exchangeCode,
  isCustomByOrganization,
  currentSnapshotFilters,
}: AssetListFilters = {}) {
  return requestJson<EntitySummaryHeader>(
    assetEndpoint,
    "summary/",
    undefined,
    buildAssetListSearch(
      {
        search,
        page,
        pageSize,
        limit,
        offset,
        categoryId,
        ticker,
        name,
        exchangeCode,
        isCustomByOrganization,
        currentSnapshotFilters,
      },
      false,
    ),
  );
}

export function bulkDeleteAssets(input: AssetBulkDeleteInput) {
  return requestJson<AssetBulkDeleteResponse>(
    assetEndpoint,
    "bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        ids: input.ids,
      }),
    },
  );
}

export async function listAssetCategories({
  search,
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: AssetCategoryListFilters = {}) {
  const filters = {
    search,
    limit,
    offset,
  } satisfies AssetCategoryListFilters;

  const payload = await requestJson<
    AssetCategoryListResponse | PaginatedResponse<AssetCategoryListRow> | AssetCategoryListRow[]
  >(
    assetCategoryEndpoint,
    "",
    undefined,
    buildAssetCategoryListSearch(filters),
  );

  return normalizeFrontendRowsResponse(payload, {
    search,
    limit,
    offset,
  });
}

export function fetchAssetCategoryDetail(assetCategoryId: number) {
  return requestJson<AssetCategoryDetailResponse>(
    assetCategoryEndpoint,
    `${assetCategoryId}/`,
    undefined,
    { response_format: "frontend_detail" },
  );
}

export function createAssetCategory(input: CreateAssetCategoryInput) {
  return requestJson<AssetCategoryRecord>(assetCategoryEndpoint, "", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAssetCategory(assetCategoryId: number, input: UpdateAssetCategoryInput) {
  return requestJson<AssetCategoryRecord>(
    assetCategoryEndpoint,
    `${assetCategoryId}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteAssetCategory(assetCategoryId: number) {
  return requestJson<Record<string, unknown> | null>(
    assetCategoryEndpoint,
    `${assetCategoryId}/`,
    {
      method: "DELETE",
    },
  );
}

export function bulkDeleteAssetCategories(input: AssetCategoryBulkDeleteInput) {
  return requestJson<AssetCategoryBulkDeleteResponse>(
    assetCategoryEndpoint,
    "bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        ids: input.ids,
        select_all: input.selectAll,
        current_url: input.currentUrl,
        search: input.search,
        display_name: input.displayName,
        display_name__contains: input.displayNameContains,
        unique_identifier: input.uniqueIdentifier,
        unique_identifier__contains: input.uniqueIdentifierContains,
        description: input.description,
        description__contains: input.descriptionContains,
        organization_owner__uid: input.organizationOwnerUid,
      }),
    },
  );
}

export async function listExecutionVenues({
  search,
  limit = mainSequenceRegistryPageSize,
  offset = 0,
  symbol,
  symbolIn,
  name,
  nameIn,
  nameContains,
}: ExecutionVenueListFilters = {}) {
  const filters = {
    search,
    limit,
    offset,
    symbol,
    symbolIn,
    name,
    nameIn,
    nameContains,
  } satisfies ExecutionVenueListFilters;

  const payload = await requestJson<PaginatedResponse<ExecutionVenueListRow> | ExecutionVenueListRow[]>(
    executionVenueEndpoint,
    "",
    undefined,
    buildExecutionVenueListSearch(filters),
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export async function listVirtualFunds({
  search,
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: VirtualFundListFilters = {}) {
  const payload = await requestJson<PaginatedResponse<VirtualFundListRow> | VirtualFundListRow[]>(
    virtualFundEndpoint,
    "",
    undefined,
    {
      response_format: "frontend_list",
      search,
      limit,
      offset,
    },
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function fetchExecutionVenueDetail(executionVenueId: number) {
  return requestJson<ExecutionVenueRecord>(executionVenueEndpoint, `${executionVenueId}/`);
}

export async function listPortfolioGroups({
  search,
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: PortfolioGroupListFilters = {}) {
  const filters = {
    search,
    limit,
    offset,
  } satisfies PortfolioGroupListFilters;

  const payload = await requestJson<PaginatedResponse<PortfolioGroupListRow> | PortfolioGroupListRow[]>(
    portfolioGroupEndpoint,
    "",
    undefined,
    buildPortfolioGroupListSearch(filters),
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function bulkDeletePortfolioGroups(input: PortfolioGroupBulkDeleteInput) {
  return requestJson<PortfolioGroupBulkDeleteResponse>(
    portfolioGroupEndpoint,
    "bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        ids: input.ids,
      }),
    },
  );
}

export function createPortfolioGroup(input: CreatePortfolioGroupInput) {
  return requestJson<PortfolioGroupRecord>(portfolioGroupEndpoint, "get_or_create/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchPortfolioGroupDetail(portfolioGroupId: number) {
  return requestJson<PortfolioGroupRecord>(portfolioGroupEndpoint, `${portfolioGroupId}/`);
}

export function appendPortfolioGroupPortfolios(
  portfolioGroupId: number,
  input: PortfolioGroupPortfolioMutationInput,
) {
  return requestJson<PortfolioGroupRecord>(
    portfolioGroupEndpoint,
    `${portfolioGroupId}/append-portfolios/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function removePortfolioGroupPortfolios(
  portfolioGroupId: number,
  input: PortfolioGroupPortfolioMutationInput,
) {
  return requestJson<PortfolioGroupRecord>(
    portfolioGroupEndpoint,
    `${portfolioGroupId}/remove-portfolios/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function createExecutionVenue(input: CreateExecutionVenueInput) {
  return requestJson<ExecutionVenueRecord>(executionVenueEndpoint, "", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateExecutionVenue(
  executionVenueId: number,
  input: UpdateExecutionVenueInput,
) {
  return requestJson<ExecutionVenueRecord>(
    executionVenueEndpoint,
    `${executionVenueId}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteExecutionVenue(executionVenueId: number) {
  return requestJson<Record<string, unknown> | null>(
    executionVenueEndpoint,
    `${executionVenueId}/`,
    {
      method: "DELETE",
    },
  );
}

export async function listTargetPortfolios({
  search,
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: TargetPortfolioListFilters = {}) {
  const filters = {
    search,
    limit,
    offset,
  } satisfies TargetPortfolioListFilters;

  const payload = await requestJson<
    PaginatedResponse<TargetPortfolioListRow> | TargetPortfolioListRow[]
  >(
    targetPortfolioEndpoint,
    "",
    undefined,
    buildTargetPortfolioListSearch(filters),
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export async function searchTargetPortfolioOptions({
  search,
  limit = 10,
  offset = 0,
}: TargetPortfolioSearchFilters = {}) {
  const normalizedSearch = search?.trim() || undefined;

  const payload = await requestJson<
    PaginatedResponse<TargetPortfolioSearchOption> | TargetPortfolioSearchOption[]
  >(
    targetPortfolioEndpoint,
    "",
    undefined,
    {
      response_format: "frontend_list",
      index_asset__current_snapshot__name: normalizedSearch,
      limit,
      offset,
    },
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function bulkDeleteTargetPortfolios(input: TargetPortfolioBulkDeleteInput) {
  return requestJson<TargetPortfolioBulkDeleteResponse>(
    targetPortfolioEndpoint,
    "bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        ids: input.ids,
        selected_items_ids:
          input.selectedItemsIds ??
          (input.ids && input.ids.length > 0 ? input.ids.join(",") : undefined),
        select_all: input.selectAll,
        current_url: input.currentUrl,
      }),
    },
  );
}

export function fetchTargetPortfolioSummary(targetPortfolioId: number) {
  return requestJson<TargetPortfolioSummaryHeader>(
    targetPortfolioEndpoint,
    `${targetPortfolioId}/summary/`,
  );
}

export function fetchTargetPortfolioWeightsPositionDetails(targetPortfolioId: number) {
  return requestJson<TargetPortfolioWeightsPositionDetailsResponse>(
    targetPortfolioEndpoint,
    `${targetPortfolioId}/weights-position-details/`,
  );
}

export async function listAssetTranslationTables({
  search,
  page = 1,
  pageSize = 40,
  usePostQuery = false,
}: AssetTranslationTableListFilters = {}) {
  const filters = {
    search,
    page,
    pageSize,
    usePostQuery,
  } satisfies AssetTranslationTableListFilters;
  const offset = Math.max(0, (page - 1) * pageSize);

  const payload = usePostQuery
    ? await requestJson<
        | AssetTranslationTableListResponse
        | PaginatedResponse<AssetTranslationTableListRow>
        | AssetTranslationTableListRow[]
      >(
        assetTranslationTableEndpoint,
        "query/",
        {
          method: "POST",
          body: JSON.stringify(buildAssetTranslationTableQueryBody(filters)),
        },
        { response_format: "frontend_list" },
      )
    : await requestJson<
        | AssetTranslationTableListResponse
        | PaginatedResponse<AssetTranslationTableListRow>
        | AssetTranslationTableListRow[]
      >(
        assetTranslationTableEndpoint,
        "",
        undefined,
        buildAssetTranslationTableListSearch(filters),
      );

  return normalizeFrontendRowsResponse(payload, {
    search,
    limit: pageSize,
    offset,
  });
}

export function createAssetTranslationTable(input: CreateAssetTranslationTableInput) {
  return requestJson<AssetTranslationTableRecord>(assetTranslationTableEndpoint, "", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function bulkDeleteAssetTranslationTables(input: AssetTranslationTableBulkDeleteInput) {
  return requestJson<AssetTranslationTableBulkDeleteResponse>(
    assetTranslationTableEndpoint,
    "bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        ids: input.ids,
        select_all: input.selectAll,
        search: input.search?.trim() || undefined,
      }),
    },
  );
}

export function fetchAssetTranslationTableDetail(assetTranslationTableId: number) {
  return requestJson<AssetTranslationTableDetailResponse>(
    assetTranslationTableEndpoint,
    `${assetTranslationTableId}/`,
    undefined,
    { response_format: "frontend_detail" },
  );
}

export function updateAssetTranslationTable(
  assetTranslationTableId: number,
  input: UpdateAssetTranslationTableInput,
) {
  return requestJson<AssetTranslationTableRecord>(
    assetTranslationTableEndpoint,
    `${assetTranslationTableId}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteAssetTranslationTable(assetTranslationTableId: number) {
  return requestJson<Record<string, unknown> | null>(
    assetTranslationTableEndpoint,
    `${assetTranslationTableId}/`,
    {
      method: "DELETE",
    },
  );
}

export async function listAssetTranslationTableRules(
  assetTranslationTableId: number,
  {
    search,
    page = 1,
    pageSize = 20,
  }: AssetTranslationTableRuleListFilters = {},
) {
  const filters = {
    search,
    page,
    pageSize,
  } satisfies AssetTranslationTableRuleListFilters;

  const payload = await requestJson<
    | AssetTranslationTableRuleListResponse
    | PaginatedResponse<AssetTranslationTableRuleListRow>
    | AssetTranslationTableRuleListRow[]
  >(
    assetTranslationTableEndpoint,
    `${assetTranslationTableId}/rules/`,
    undefined,
    buildAssetTranslationTableRulesListSearch(filters),
  );

  return normalizeFrontendRowsResponse(payload, {
    search,
    limit: pageSize,
    offset: Math.max(0, (page - 1) * pageSize),
  });
}

export function createAssetTranslationTableRule(
  assetTranslationTableId: number,
  input: AssetTranslationTableRuleInput,
) {
  return requestJson<AssetTranslationTableRuleListRow>(
    assetTranslationTableEndpoint,
    `${assetTranslationTableId}/rules/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateAssetTranslationTableRule(
  assetTranslationTableId: number,
  ruleId: number,
  input: AssetTranslationTableRuleInput,
) {
  return requestJson<AssetTranslationTableRuleListRow>(
    assetTranslationTableEndpoint,
    `${assetTranslationTableId}/rules/${ruleId}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteAssetTranslationTableRule(assetTranslationTableId: number, ruleId: number) {
  return requestJson<AssetTranslationTableRuleDeleteResponse>(
    assetTranslationTableEndpoint,
    `${assetTranslationTableId}/rules/${ruleId}/`,
    {
      method: "DELETE",
    },
  );
}

export function fetchAssetDetail(assetId: number) {
  return requestJson<AssetDetailResponse>(
    assetEndpoint,
    `${assetId}/`,
    undefined,
    { response_format: "frontend_detail" },
  );
}

function normalizeAssetOrderFormFields(
  payload: AssetOrderFormFieldsResponse | AssetOrderFormField[] | null,
) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.fields)) {
    return payload.fields;
  }

  return [];
}

export async function fetchAssetOrderFormFields(assetId: number, orderType: string) {
  const payload = await requestJson<AssetOrderFormFieldsResponse | AssetOrderFormField[]>(
    assetEndpoint,
    `${assetId}/order-form-fields/`,
    undefined,
    { order_type: orderType },
  );

  return normalizeAssetOrderFormFields(payload);
}

export function listProjectDataSources({
  page = 1,
  pageSize = mainSequenceRegistryPageSize,
  search,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}) {
  return requestJson<ProjectDataSourceListResponse>(
    dynamicTableDataSourceEndpoint,
    "",
    undefined,
    {
      response_format: "project_data_sources_list",
      search: search?.trim() || undefined,
      page,
      page_size: pageSize,
    },
  );
}

export function bulkDeleteProjectDataSources(input: ProjectDataSourceBulkDeleteInput) {
  return requestJson<ProjectDataSourceBulkDeleteResponse>(
    dynamicTableDataSourceEndpoint,
    "bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        ids: input.ids,
        select_all: input.selectAll ?? false,
        search: input.search?.trim() || undefined,
      }),
    },
  );
}

export function fetchProjectDataSourceEditorConfig() {
  return requestJson<ProjectDataSourceEditorPayload>(
    dynamicTableDataSourceEndpoint,
    "editor-config/",
  );
}

export function fetchProjectDataSourceEditor(projectDataSourceId: number) {
  return requestJson<ProjectDataSourceEditorPayload>(
    dynamicTableDataSourceEndpoint,
    `${projectDataSourceId}/`,
    undefined,
    { response_format: "editor" },
  );
}

export function listProjectDataSourceRelatedResourceOptions(query?: string) {
  return requestJson<ProjectDataSourceRelatedResourceOption[]>(
    dynamicTableDataSourceEndpoint,
    "related-resource-options/",
    undefined,
    { q: query?.trim() || undefined },
  );
}

export function createProjectDataSourceEditor(input: ProjectDataSourceEditorInput) {
  return requestJson<ProjectDataSourceEditorWriteResponse>(
    dynamicTableDataSourceEndpoint,
    "",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    { request_format: "editor" },
  );
}

export function updateProjectDataSourceEditor(
  projectDataSourceId: number,
  input: Partial<ProjectDataSourceEditorInput>,
) {
  return requestJson<ProjectDataSourceEditorWriteResponse>(
    dynamicTableDataSourceEndpoint,
    `${projectDataSourceId}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    { request_format: "editor" },
  );
}

export function deleteProjectDataSourceEditor(projectDataSourceId: number) {
  return requestJson<ProjectDataSourceDeleteResponse>(
    dynamicTableDataSourceEndpoint,
    `${projectDataSourceId}/delete/`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export function listPhysicalDataSources({
  page = 1,
  pageSize = mainSequenceRegistryPageSize,
  search,
  classType,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
  classType?: string;
} = {}) {
  return requestJson<PhysicalDataSourceListResponse>(
    commandCenterConfig.mainSequence.endpoint,
    "data_source/",
    undefined,
    {
      response_format: "physical_data_sources_list",
      search: search?.trim() || undefined,
      class_type: classType?.trim() || undefined,
      page,
      page_size: pageSize,
    },
  );
}

export function bulkDeletePhysicalDataSources(input: PhysicalDataSourceBulkDeleteInput) {
  return requestJson<PhysicalDataSourceBulkDeleteResponse>(
    commandCenterConfig.mainSequence.endpoint,
    "data_source/bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        ids: input.ids,
        select_all: input.selectAll ?? false,
        search: input.search?.trim() || undefined,
        class_type: input.classType?.trim() || undefined,
      }),
    },
  );
}

export function fetchPhysicalDataSourceEditorConfig(
  sourceType: "duck_db" | "timescale_db" | "timescale_db_gcp_cloud",
) {
  return requestJson<PhysicalDataSourceEditorPayload>(
    commandCenterConfig.mainSequence.endpoint,
    "data_source/editor-config/",
    undefined,
    { source_type: sourceType },
  );
}

export function fetchPhysicalDataSourceEditor(physicalDataSourceId: number) {
  return requestJson<PhysicalDataSourceEditorPayload>(
    commandCenterConfig.mainSequence.endpoint,
    `data_source/${physicalDataSourceId}/`,
    undefined,
    { response_format: "editor" },
  );
}

export function createPhysicalDataSourceEditor(input: PhysicalDataSourceEditorCreateInput) {
  return requestJson<PhysicalDataSourceEditorWriteResponse>(
    commandCenterConfig.mainSequence.endpoint,
    "data_source/",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    { request_format: "editor" },
  );
}

export function updatePhysicalDataSourceEditor(
  physicalDataSourceId: number,
  input: PhysicalDataSourceEditorUpdateInput,
) {
  return requestJson<PhysicalDataSourceEditorWriteResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `data_source/${physicalDataSourceId}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    { request_format: "editor" },
  );
}

export function deletePhysicalDataSourceEditor(physicalDataSourceId: number) {
  return requestJson<PhysicalDataSourceDeleteResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `data_source/${physicalDataSourceId}/delete/`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export function listClusters({
  page = 1,
  pageSize = mainSequenceRegistryPageSize,
  search,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}) {
  return requestJson<ClusterListResponse>(
    commandCenterConfig.mainSequence.endpoint,
    "cluster/",
    undefined,
    {
      response_format: "clusters_list",
      search: search?.trim() || undefined,
      page,
      page_size: pageSize,
    },
  );
}

export function fetchClusterDetail(clusterId: number) {
  return requestJson<ClusterDetailSummary>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${clusterId}/`,
    undefined,
    { response_format: "cluster_detail" },
  );
}

export async function listClusterNodePools(clusterId: number) {
  const payload = await requestJson<
    PaginatedResponse<ClusterNodePoolRow> | ClusterNodePoolRow[]
  >(commandCenterConfig.mainSequence.endpoint, `cluster/${clusterId}/node-pools/`);

  return normalizeListResponse(payload);
}

export async function listClusterNodes(
  clusterId: number,
  {
    nodePool,
  }: {
    nodePool?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<ClusterNodeRow> | ClusterNodeRow[]>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${clusterId}/nodes/`,
    undefined,
    {
      node_pool: nodePool?.trim() || undefined,
    },
  );

  return normalizeListResponse(payload);
}

export async function listClusterNamespaces(clusterId: number) {
  const payload = await requestJson<
    PaginatedResponse<ClusterNamespaceRow> | ClusterNamespaceRow[]
  >(commandCenterConfig.mainSequence.endpoint, `cluster/${clusterId}/namespaces/`);

  return normalizeListResponse(payload);
}

export async function listClusterPods(
  clusterId: number,
  {
    namespace,
    nodePool,
  }: {
    namespace?: string;
    nodePool?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<ClusterPodRow> | ClusterPodRow[]>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${clusterId}/pods/`,
    undefined,
    {
      namespace: namespace?.trim() || undefined,
      node_pool: nodePool?.trim() || undefined,
    },
  );

  return normalizeListResponse(payload);
}

export async function listClusterDeployments(
  clusterId: number,
  {
    namespace,
  }: {
    namespace?: string;
  } = {},
) {
  const payload = await requestJson<
    PaginatedResponse<ClusterDeploymentRow> | ClusterDeploymentRow[]
  >(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${clusterId}/deployments/`,
    undefined,
    {
      namespace: namespace?.trim() || undefined,
    },
  );

  return normalizeListResponse(payload);
}

export async function listClusterServices(
  clusterId: number,
  {
    namespace,
  }: {
    namespace?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<ClusterServiceRow> | ClusterServiceRow[]>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${clusterId}/services/`,
    undefined,
    {
      namespace: namespace?.trim() || undefined,
    },
  );

  return normalizeListResponse(payload);
}

export async function listClusterStorage(
  clusterId: number,
  {
    namespace,
  }: {
    namespace?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<ClusterStorageRow> | ClusterStorageRow[]>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${clusterId}/storage/`,
    undefined,
    {
      namespace: namespace?.trim() || undefined,
    },
  );

  return normalizeListResponse(payload);
}

export async function listClusterKnative(
  clusterId: number,
  {
    namespace,
  }: {
    namespace?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<ClusterKnativeRow> | ClusterKnativeRow[]>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${clusterId}/knative/`,
    undefined,
    {
      namespace: namespace?.trim() || undefined,
    },
  );

  return normalizeListResponse(payload);
}

export function scaleCluster(
  clusterId: number,
  {
    desiredNodeCount,
  }: {
    desiredNodeCount: number;
  },
) {
  return requestJson<ClusterScaleResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${clusterId}/scale/`,
    {
      method: "POST",
      body: JSON.stringify({
        desired_node_count: desiredNodeCount,
      }),
    },
  );
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

export async function listBuckets({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
  search,
  name,
  nameIn,
}: {
  limit?: number;
  offset?: number;
  search?: string;
  name?: string;
  nameIn?: string;
} = {}) {
  const payload = await requestJson<PaginatedResponse<BucketRecord> | BucketRecord[]>(
    commandCenterConfig.mainSequence.endpoint,
    "bucket/",
    undefined,
    {
      limit,
      offset,
      search: search?.trim() || undefined,
      name: name?.trim() || undefined,
      "name__in": nameIn?.trim() || undefined,
    },
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function createBucket(input: CreateBucketInput) {
  return requestJson<BucketRecord>(commandCenterConfig.mainSequence.endpoint, "bucket/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchBucketSummary(bucketId: number) {
  return requestJson<BucketSummaryHeader>(
    commandCenterConfig.mainSequence.endpoint,
    `bucket/${bucketId}/summary/`,
  );
}

export function fetchBucketBrowse(
  bucketId: number,
  {
    prefix,
    search,
    sort,
    dir,
    page,
  }: {
    prefix?: string;
    search?: string;
    sort?: string;
    dir?: "asc" | "desc";
    page?: number;
  } = {},
) {
  return requestJson<BucketBrowseResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `bucket/${bucketId}/browse/`,
    undefined,
    {
      prefix: prefix || undefined,
      search: search?.trim() || undefined,
      sort: sort || undefined,
      dir: dir || undefined,
      page,
    },
  );
}

export function createBucketFolder(bucketId: number, input: CreateBucketFolderInput) {
  return requestJson<CreateBucketFolderResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `bucket/${bucketId}/create-folder/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function uploadBucketArtifact(bucketId: number, input: UploadBucketArtifactInput) {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("prefix", input.prefix);
  formData.append("filename", input.filename);

  return requestJson<UploadBucketArtifactResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `bucket/${bucketId}/upload-artifact/`,
    {
      method: "POST",
      body: formData,
    },
  );
}

export function deleteBucket(bucketId: number) {
  return requestJson<null>(commandCenterConfig.mainSequence.endpoint, `bucket/${bucketId}/`, {
    method: "DELETE",
  });
}

export function bulkDeleteBuckets(input: BucketBulkDeleteInput) {
  return requestJson<BucketBulkDeleteResponse>(
    commandCenterConfig.mainSequence.endpoint,
    "bucket/bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        ids: input.ids,
        select_all: input.selectAll ?? false,
        current_url: input.currentUrl,
        search: input.search,
        name: input.name,
        name__in: input.nameIn,
      }),
    },
  );
}

export async function listDataNodes({
  limit = mainSequenceRegistryPageSize,
  light = false,
  offset = 0,
  q,
}: {
  limit?: number;
  light?: boolean;
  offset?: number;
  q?: string;
} = {}) {
  const payload = await requestJson<PaginatedResponse<DataNodeSummary> | DataNodeSummary[]>(
    dynamicTableMetadataEndpoint,
    "",
    undefined,
    {
      limit,
      light,
      offset,
      ordering: "storage_hash_id",
      q: q?.trim() || undefined,
    },
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

export async function listProjectLocalTimeSeries(
  projectId: number,
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
    "project__id": projectId,
  });

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

async function postDynamicTableBulkAction<T>(
  path: string,
  body: Record<string, unknown>,
) {
  return requestJson<T>(dynamicTableMetadataEndpoint, path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function bulkSetDataNodeNextUpdateFromLastIndexValue(selectedIds: number[]) {
  return postDynamicTableBulkAction<DynamicTableBulkActionResponse>(
    "bulk-set-next-update-from-last-index-value/",
    { selected_ids: selectedIds },
  );
}

export function bulkSetDataNodeIndexStatsFromTable(selectedIds: number[]) {
  return postDynamicTableBulkAction<DynamicTableBulkActionResponse>(
    "bulk-set-index-stats-from-table/",
    { selected_ids: selectedIds },
  );
}

export function bulkRefreshDataNodeTableSearchIndex(selectedIds: number[]) {
  return postDynamicTableBulkAction<DynamicTableBulkActionResponse>(
    "bulk-refresh-table-search-index/",
    { selected_ids: selectedIds },
  );
}

export function bulkDeleteDataNodes(input: DynamicTableBulkDeleteInput) {
  return postDynamicTableBulkAction<DynamicTableBulkDeleteResponse>("bulk-delete/", {
    selected_ids: input.selectedIds,
    full_delete_selected: input.fullDeleteSelected ?? false,
    full_delete_downstream_tables: input.fullDeleteDownstreamTables ?? false,
    delete_with_no_table: input.deleteWithNoTable ?? false,
    override_protection: input.overrideProtection ?? false,
  });
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

function isDataNodeRemoteDataRow(value: unknown): value is DataNodeRemoteDataRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeDataNodeRemoteDataRows(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload.filter(isDataNodeRemoteDataRow);
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    for (const key of ["results", "rows", "data", "items"]) {
      const candidate = record[key];

      if (Array.isArray(candidate)) {
        return candidate.filter(isDataNodeRemoteDataRow);
      }
    }
  }

  return [];
}

function normalizeDataNodeLastObservation(payload: unknown): DataNodeLastObservation {
  if (isDataNodeRemoteDataRow(payload)) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.find(isDataNodeRemoteDataRow) ?? null;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    for (const key of ["last_observation", "observation", "row", "result", "data"]) {
      const candidate = record[key];

      if (isDataNodeRemoteDataRow(candidate)) {
        return candidate;
      }

      if (Array.isArray(candidate)) {
        return candidate.find(isDataNodeRemoteDataRow) ?? null;
      }
    }
  }

  return null;
}

export async function fetchDataNodeLastObservation(dataNodeId: number) {
  const payload = await requestJson<unknown>(
    dynamicTableMetadataEndpoint,
    `${dataNodeId}/get_last_observation/`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  return normalizeDataNodeLastObservation(payload);
}

export async function fetchDataNodeDataBetweenDatesFromRemote(
  dataNodeId: number,
  input: DataNodeRemoteDataRequest,
) {
  const payload = await requestJson<unknown>(
    dynamicTableMetadataEndpoint,
    `${dataNodeId}/get_data_between_dates_from_remote/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return normalizeDataNodeRemoteDataRows(payload);
}

export function fetchLocalTimeSerieSummary(localTimeSerieId: number) {
  async function requestStructuredSummary(search: Record<string, QueryValue>) {
    try {
      return await requestJson<unknown>(
        localTimeSerieEndpoint,
        `${localTimeSerieId}/summary/`,
        undefined,
        search,
      );
    } catch (error) {
      if (error instanceof MainSequenceApiError && error.status === 404) {
        return null;
      }

      throw error;
    }
  }

  return (async () => {
    const responseFormatPayload = await requestStructuredSummary({ response_format: "structured" });

    if (isEntitySummaryHeaderPayload(responseFormatPayload)) {
      return responseFormatPayload;
    }

    const formatPayload = await requestStructuredSummary({ format: "structured" });

    if (isEntitySummaryHeaderPayload(formatPayload)) {
      return formatPayload;
    }

    return null;
  })();
}

export function fetchLocalTimeSerieDetail(localTimeSerieId: number) {
  return requestJson<LocalTimeSerieRecord>(
    localTimeSerieEndpoint,
    `${localTimeSerieId}/`,
  );
}

export function fetchLocalTimeSerieRunConfiguration(localTimeSerieId: number) {
  return requestJson<LocalTimeSerieRunConfiguration>(
    localTimeSerieEndpoint,
    `${localTimeSerieId}/run-configuration/`,
  );
}

export function updateLocalTimeSerieRunConfiguration(
  localTimeSerieId: number,
  input: LocalTimeSerieRunConfigurationInput,
) {
  return requestJson<LocalTimeSerieRunConfiguration>(
    localTimeSerieEndpoint,
    `${localTimeSerieId}/run-configuration/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function fetchLocalTimeSerieDependencyGraph(
  localTimeSerieId: number,
  direction: "downstream" | "upstream",
) {
  return requestJson<LocalTimeSerieDependencyGraphResponse>(
    localTimeSerieEndpoint,
    `${localTimeSerieId}/dependencies-graph/`,
    undefined,
    { direction },
  );
}

export function listLocalTimeSerieHistoricalUpdates(
  localTimeSerieId: number,
  limit = 100,
) {
  return requestJson<LocalTimeSerieHistoricalUpdateRecord[]>(
    localTimeSerieEndpoint,
    `${localTimeSerieId}/historical-updates/`,
    undefined,
    { limit },
  );
}

export function fetchLocalTimeSerieLogs(localTimeSerieId: number, level?: string) {
  return requestJson<LocalTimeSerieLogsGridResponse>(
    localTimeSerieEndpoint,
    `${localTimeSerieId}/logs/`,
    undefined,
    level ? { level } : undefined,
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
