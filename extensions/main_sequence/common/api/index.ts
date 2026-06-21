import { useAuthStore } from "@/auth/auth-store";
import { applySessionAuthHeaders } from "@/auth/session-headers";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import {
  startDashboardRequestTrace,
  type DashboardRequestTraceMeta,
} from "@/dashboards/dashboard-request-trace";
import { isWidgetPreviewMode } from "@/features/widgets/widget-explorer";

import {
  buildMainSequenceMarketsConnectionRequest,
  MainSequenceMarketsConnectionTransportError,
  requestMainSequenceMarketsConnectionJson,
} from "./marketsConnectionTransport";

const devAuthProxyPrefix = "/__command_center_auth__";
const devMainSequenceMarketsProxyPrefix = "/__main_sequence_markets__";
const defaultMainSequenceAssetsRoot = "/api/v1/";
const dynamicTableDataSourceEndpoint = "/orm/api/ts_manager/dynamic_table_data_source/";
const dynamicTableMetadataEndpoint = "/orm/api/ts_manager/dynamic_table/";
const sourceTableConfigurationEndpoint = "/orm/api/ts_manager/source_table_config/";
const metaTableEndpoint = "/orm/api/ts_manager/meta_table/";
const namespaceEndpoint = "/orm/api/ts_manager/namespace/";
const localTimeSerieEndpoint = "/orm/api/ts_manager/local_time_serie/";
const availableGpuTypesEndpoint = "/orm/api/pods/billing/available-gpu-types/";
const billingEstimateEndpoint = "/orm/api/pods/billing/estimate-runtime-cost/";
const mainSequenceConnectionsEndpoint = "/orm/api/connections/";
const mainSequenceConnectionDataSourceEndpoint = "/orm/api/connections/data_source/";
const mainSequenceAssetsRoot = buildMainSequenceAssetsRoot(env.debugMainSequence);
const debugMainSequenceOrigin = readUrlOrigin(env.debugMainSequence);
const assetEndpoint = buildMainSequenceAssetEndpoint("asset/");
const catalogEndpoint = buildMainSequenceAssetEndpoint("catalog/");
const calendarEndpoint = buildMainSequenceAssetEndpoint("calendar/");
const pricingMarketDataEndpoint = buildMainSequenceAssetEndpoint("pricing/market_data/");
const pricingCurvesEndpoint = buildMainSequenceAssetEndpoint("pricing/curves/");
const marketsSettingsEndpoint = buildMainSequenceAssetEndpoint("settings/");
const indexEndpoint = buildMainSequenceAssetEndpoint("index/");
const assetCategoryEndpoint = buildMainSequenceAssetEndpoint("asset-category/");
const instrumentsConfigurationEndpoint = buildMainSequenceAssetEndpoint(
  "instruments-configuration/",
);
const virtualFundEndpoint = buildMainSequenceAssetEndpoint("virtualfund/");
const managedAccountEndpoint = buildMainSequenceAssetEndpoint("account/");
const portfolioGroupEndpoint = buildMainSequenceAssetEndpoint("portfolio-group/");
const targetPortfolioEndpoint = buildMainSequenceAssetEndpoint("portfolio/");
const portfolioSignalEndpoint = buildMainSequenceAssetEndpoint("portfolio-signal/");
export const mainSequenceRegistryPageSize = 25;
const DATA_NODE_DETAIL_CACHE_TTL_MS = 300_000;
const dataNodeUidSearchPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DataNodeDetailCacheEntry {
  expiresAt: number;
  promise?: Promise<DataNodeDetail>;
  value?: DataNodeDetail;
}

const dataNodeDetailCache = new Map<string, DataNodeDetailCacheEntry>();

function normalizeDataNodeUidSearch(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && dataNodeUidSearchPattern.test(trimmed) ? trimmed : undefined;
}

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

export interface MainSequenceBulkDeleteResponse {
  detail?: string;
  deleted_count: number;
}

export interface DynamicTableDataSourceOption {
  id: number;
  uid: string;
  related_resource: {
    id: string;
    uid?: string | null;
    display_name?: string | null;
    name?: string | null;
    organization: number;
    class_type: string;
    status: string;
  } | null;
  related_resource_class_type: string;
}

export interface ProjectDataSourceListRelatedResource {
  id: string | null;
  uid?: string | null;
  label: string;
  class_type: string;
  status: string;
}

export interface ProjectDataSourceListRow {
  id: number;
  uid: string;
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
  uids?: string[];
  selectAll?: boolean;
  search?: string;
}

export interface ProjectDataSourceBulkDeleteResponse {
  detail: string;
  deleted_count: number;
}

export interface ProjectDataSourceEditorEntity {
  id?: number;
  uid?: string | null;
  type: string;
  title: string;
}

export interface ProjectDataSourceEditorField {
  key: "display_name" | "related_resource_uid" | "is_default_data_source";
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
  id: string;
  uid?: string | null;
  label: string;
  class_type: string;
  status: string;
}

export interface ProjectDataSourceEditorInput {
  display_name: string;
  related_resource_uid: string;
  is_default_data_source: boolean;
}

export interface ProjectDataSourceEditorWriteResponse {
  detail: string;
  id: number;
  uid: string;
  display_name: string;
  redirect_path: string;
}

export interface ProjectDataSourceDeleteResponse {
  detail: string;
  uid: string;
  redirect_path: string;
}

export interface PhysicalDataSourceListRow {
  id: number;
  uid: string;
  display_name: string;
  source_logo: string;
  class_type: string;
  class_type_label: string;
  status: string;
  status_label: string;
  status_tone: "success" | "warning" | "danger" | "neutral" | "info";
  storage_access_mode?: PhysicalDataSourceStorageAccessMode | null;
  provisioned_size_gb?: number | null;
  creation_date: string | null;
  creation_date_display: string;
  [key: string]: unknown;
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
  uids?: string[];
  selectAll?: boolean;
  search?: string;
  classType?: string;
}

export interface PhysicalDataSourceBulkDeleteResponse {
  detail: string;
  deleted_count: number;
}

export type PhysicalDataSourceStorageAccessMode =
  | "read_write"
  | "read_only"
  | "disabled";

export interface PhysicalDataSourceEditorFieldOption {
  value: string | number | boolean;
  label: string;
  description?: string;
  disabled?: boolean;
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
    | "status"
    | "storage_access_mode";
  label: string;
  editor: "text" | "password" | "number" | "textarea" | "select";
  required: boolean;
  value?: string | number | boolean | null;
  read_only?: boolean;
  placeholder?: string;
  help_text?: string;
  options?:
    | Array<PhysicalDataSourceEditorFieldOption | string | number | boolean>
    | null;
  choices?:
    | Array<PhysicalDataSourceEditorFieldOption | string | number | boolean>
    | null;
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
    uid?: string | null;
    type: string;
    title: string;
  } | null;
  title: string;
  source_type?: "duck_db" | "timescale_db" | "timescale_db_remote" | "";
  source_type_label?: string;
  fields: PhysicalDataSourceEditorField[];
  actions: PhysicalDataSourceEditorActions;
}

export interface PhysicalDataSourceEditorCreateInput {
  source_type: "duck_db" | "timescale_db" | "timescale_db_remote";
  display_name?: string;
  file_path?: string;
  database_user?: string;
  password?: string;
  host?: string;
  port?: number;
  database_name?: string;
  description?: string;
  tags?: string;
  storage_access_mode?: PhysicalDataSourceStorageAccessMode;
}

export interface PhysicalDataSourceEditorUpdateInput {
  display_name?: string;
  description?: string;
  internal_code?: string;
  storage_access_mode?: PhysicalDataSourceStorageAccessMode;
}

export interface PhysicalDataSourceEditorWriteResponse {
  detail: string;
  id: number;
  uid: string;
  display_name: string;
  redirect_path: string;
}

export interface PhysicalDataSourceDeleteResponse {
  detail: string;
  id: number;
  uid?: string | null;
  redirect_path: string;
}

export interface PhysicalDataSourceConnectionRow extends Record<string, unknown> {
  uid?: string | null;
  connection_uid?: string | null;
  display_name?: string | null;
  name?: string | null;
  unique_identifier?: string | null;
  type_id?: string | null;
  typeId?: string | null;
  connection_type?: string | null;
  class_type?: string | null;
  status?: string | null;
  status_label?: string | null;
  status_tone?: string | null;
  created_at?: string | null;
  creation_date?: string | null;
  creation_date_display?: string | null;
}

export type PhysicalDataSourceConnectionsResponse =
  | PhysicalDataSourceConnectionRow[]
  | {
      rows?: PhysicalDataSourceConnectionRow[];
      results?: PhysicalDataSourceConnectionRow[];
      connections?: PhysicalDataSourceConnectionRow[];
      count?: number;
      [key: string]: unknown;
    };

export interface TimeScaleDBServiceRecord {
  id: number;
  uid: string;
  namespace: string | null;
  release_name: string | null;
  helm_release_info: unknown;
  persistence_size: string | null;
  backup_bucket: string | null;
  load_balancer_ip: string | null;
  created_at: string | null;
  updated_at: string | null;
  creation_date: string | null;
  created_by_user: unknown;
  organization_owner: unknown;
  open_for_everyone: boolean;
  has_postgres_password: boolean;
  linked_data_sources_count: number;
}

export interface TimeScaleDBServiceDataSourceListResponse {
  service: {
    id: number;
    uid: string;
    release_name: string;
    namespace: string;
  };
  search: string;
  class_type: string;
  rows: PhysicalDataSourceListRow[];
  pagination: PhysicalDataSourceListPagination;
}

export interface ScalableServiceRecord extends Record<string, unknown> {
  id: number;
  uid: string;
  name?: string | null;
  display_name?: string | null;
  release_name?: string | null;
  service_name?: string | null;
  namespace?: string | null;
  kubernetes_namespace?: string | null;
  status?: string | null;
  status_label?: string | null;
  service_type?: string | null;
  scalable_service_type?: string | null;
  class_type?: string | null;
  public_url?: string | null;
  service_url?: string | null;
  url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  creation_date?: string | null;
}

export interface ScalableServiceRevisionRecord extends Record<string, unknown> {
  id?: number | string | null;
  name?: string | null;
  revision_name?: string | null;
  display_name?: string | null;
  uid?: string | null;
  ready?: string | boolean | null;
  ready_reason?: string | null;
  ready_message?: string | null;
  first_seen_at?: string | null;
  ready_at?: string | null;
  last_seen_at?: string | null;
  retired_at?: string | null;
}

export interface AssetListRow {
  id?: number | null;
  uid: string;
  unique_identifier: string | null;
  asset_type?: string | null;
  figi: string | null;
  name: string | null;
  ticker: string | null;
  exchange_code: string | null;
  security_market_sector: string | null;
  security_type: string | null;
  is_custom_by_organization: boolean;
}

export interface AssetBulkDeleteInput {
  uids: string[];
}

export interface AssetBulkDeleteResponse {
  detail: string;
  deleted_count?: number;
}

export type CalendarType =
  | "TRADING"
  | "SETTLEMENT"
  | "FIXING"
  | "BUSINESS"
  | "HOLIDAY"
  | "EVENT"
  | "CUSTOM";

export interface CalendarRecord extends Record<string, unknown> {
  uid: string;
  unique_identifier: string;
  display_name: string | null;
  calendar_type: CalendarType | string;
  timezone: string | null;
  source: string | null;
  source_identifier: string | null;
  valid_from: string | null;
  valid_to: string | null;
  metadata_json: Record<string, unknown> | null;
}

export interface CalendarListFilters {
  search?: string;
  limit?: number;
  offset?: number;
  uniqueIdentifier?: string;
  uniqueIdentifierContains?: string;
  calendarType?: string;
  source?: string;
  sourceIdentifier?: string;
}

export interface CalendarDateRecord extends Record<string, unknown> {
  uid: string;
  calendar_uid: string;
  local_date: string;
  is_business_day: boolean;
  is_holiday: boolean;
  is_weekend: boolean;
  is_early_close: boolean;
  holiday_name: string | null;
  metadata_json: Record<string, unknown> | null;
}

export interface CalendarDateListFilters {
  startDate?: string;
  endDate?: string;
  isBusinessDay?: boolean;
  isHoliday?: boolean;
  isWeekend?: boolean;
  isEarlyClose?: boolean;
  limit?: number;
  offset?: number;
}

export interface CalendarSessionRecord extends Record<string, unknown> {
  uid: string;
  calendar_uid: string;
  local_date: string;
  session_label: string;
  opens_at: string | null;
  closes_at: string | null;
  timezone: string | null;
  is_primary: boolean;
  metadata_json: Record<string, unknown> | null;
}

export interface CalendarSessionListFilters {
  startDate?: string;
  endDate?: string;
  sessionLabel?: string;
  isPrimary?: boolean;
  limit?: number;
  offset?: number;
}

export interface CalendarEventRecord extends Record<string, unknown> {
  uid: string;
  calendar_uid: string;
  event_date: string | null;
  event_time: string | null;
  event_type: string;
  event_label: string;
  target_type: string | null;
  target_uid: string | null;
  target_identifier: string | null;
  metadata_json: Record<string, unknown> | null;
}

export interface CalendarEventListFilters {
  startDate?: string;
  endDate?: string;
  eventType?: string;
  eventLabel?: string;
  targetType?: string;
  targetUid?: string;
  targetIdentifier?: string;
  limit?: number;
  offset?: number;
}

export interface PricingMarketDataResourceLink {
  key: "sets" | "bindings" | string;
  model: string;
  list_url: string;
  create_url: string;
  upsert_url: string;
}

export interface PricingMarketDataApiCard {
  resource: string;
  description: string;
  resources: PricingMarketDataResourceLink[];
}

export interface MarketsSettingsAssumption {
  key: string;
  label: string;
  value: string;
  source: string;
  description: string;
}

export interface MarketsSettingsResponse {
  app: {
    name: string;
    scope: string;
    version: string;
  };
  runtime: {
    namespace: string;
    namespace_source: string;
    default_namespace: string;
    auto_register_enabled: boolean;
    management_mode: string;
    schema_mutation_allowed: boolean;
    requires_migrations: boolean;
  };
  documentation: {
    openapi_url: string;
    swagger_url: string;
    redoc_url: string;
  };
  assumptions: MarketsSettingsAssumption[];
}

export interface PricingMarketDataSet extends Record<string, unknown> {
  uid: string;
  set_key: string;
  display_name: string;
  description: string | null;
  status: string;
  metadata_json: Record<string, unknown> | null;
}

export interface PricingMarketDataSetFilters {
  limit?: number;
  offset?: number;
  status?: string;
  setKey?: string;
}

export interface PricingMarketDataSetInput {
  set_key: string;
  display_name: string;
  description?: string | null;
  status?: string;
  metadata_json?: Record<string, unknown> | null;
}

export interface PricingMarketDataSetUpdateInput {
  display_name?: string;
  description?: string | null;
  status?: string;
  metadata_json?: Record<string, unknown> | null;
}

export interface PricingMarketDataDeleteResponse {
  detail: string;
  uid: string;
  deleted_count: number;
}

export interface PricingMarketDataSetBinding extends Record<string, unknown> {
  uid: string;
  market_data_set_uid: string;
  concept_key: string;
  data_node_uid: string;
  storage_table_identifier: string;
  source: string;
  metadata_json: Record<string, unknown> | null;
}

export interface PricingMarketDataBindingFilters {
  limit?: number;
  offset?: number;
  marketDataSetUid?: string;
  conceptKey?: string;
}

export interface PricingMarketDataSetBindingFilters {
  limit?: number;
  offset?: number;
}

export interface PricingMarketDataBindingInput {
  market_data_set_uid: string;
  concept_key: string;
  data_node_uid: string;
  storage_table_identifier: string;
  source: string;
  metadata_json?: Record<string, unknown> | null;
}

export interface PricingMarketDataBindingUpdateInput {
  data_node_uid?: string;
  storage_table_identifier?: string;
  source?: string;
  metadata_json?: Record<string, unknown> | null;
}

export interface PricingMarketDataBindingResolveFilters {
  conceptKey: string;
  marketDataSet?: string;
}

export interface PricingMarketDataBindingResolveResponse {
  market_data_set: string;
  concept_key: string;
  data_node_uid: string;
}

export interface PricingCurveRow extends Record<string, unknown> {
  uid: string;
  unique_identifier: string;
  display_name: string;
  curve_type: string;
  index_uid: string | null;
  interpolation_method: string | null;
  compounding: string | null;
  source: string | null;
  metadata_json: Record<string, unknown> | null;
}

export interface PricingCurveFilters {
  limit?: number;
  offset?: number;
  search?: string;
  curveType?: string;
  indexUid?: string;
  source?: string;
}

export interface PricingCurveDiscountCurveFilters {
  marketDataSet: string;
  valuationDate?: string;
}

export interface PricingCurveDiscountCurveNode {
  days_to_maturity: number;
  zero: number;
}

export interface PricingCurveDiscountCurveMarketDataSet {
  uid: string;
  set_key: string;
  display_name: string;
}

export interface PricingCurveDiscountCurveBinding {
  uid: string;
  concept_key: string;
  data_node_uid: string;
  storage_table_identifier: string;
}

export interface PricingCurveDiscountCurveResponse {
  curve_uid: string;
  curve_identifier: string;
  curve: PricingCurveRow;
  market_data_set: PricingCurveDiscountCurveMarketDataSet;
  binding: PricingCurveDiscountCurveBinding;
  valuation_date: string;
  effective_date: string;
  request_mode: string;
  nodes: PricingCurveDiscountCurveNode[];
}

export interface AssetCategoryListRow {
  uid: string;
  unique_identifier: string;
  display_name: string;
  description: string;
  number_of_assets: number;
}

export interface AssetCategoryListResponse extends FrontendRowsResponse<AssetCategoryListRow> {}

export interface AssetCategoryDetailSelectedCategory {
  uid: string;
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
  uid: string;
  title: string;
  selected_category: AssetCategoryDetailSelectedCategory;
  details: AssetCategoryDetailField[];
  actions: AssetCategoryDetailActions;
  assets_list: AssetCategoryDetailAssetsListConfig;
}

export interface AssetCategoryRecord {
  uid: string;
  unique_identifier: string;
  display_name: string;
  description: string;
  assets: string[];
}

export interface CreateAssetCategoryInput {
  display_name: string;
  description: string;
  unique_identifier: string;
  assets: string[];
}

export interface UpdateAssetCategoryInput {
  display_name?: string;
  description?: string;
  assets?: string[];
}

export interface AssetCategoryBulkDeleteInput {
  uids?: string[];
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

export interface VirtualFundListRow extends Record<string, unknown> {
  uid: string;
  unique_identifier: string;
  account_uid?: string | null;
  target_portfolio_uid?: string | null;
}

export interface VirtualFundRecord extends VirtualFundListRow {}

export interface VirtualFundDetailResponse extends Record<string, unknown> {
  virtual_fund: VirtualFundRecord | null;
  tabs?: Array<{
    key?: string | null;
    label?: string | null;
    url?: string | null;
    [key: string]: unknown;
  }>;
  links?: {
    summary?: string | null;
    holdings?: string | null;
    latest_holdings?: string | null;
    account?: string | null;
    portfolio?: string | null;
    [key: string]: unknown;
  } | null;
}

export interface VirtualFundHoldingsResponse extends Record<string, unknown> {
  virtual_fund_uid: string | null;
  virtual_fund_unique_identifier: string | null;
  holdings_set_uid: string | null;
  source_account_holdings_set_uid: string | null;
  holdings_date: string | null;
  holdings: Array<Record<string, unknown>>;
}

export interface CreateVirtualFundInput extends Record<string, unknown> {}

export interface UpdateVirtualFundInput extends Record<string, unknown> {}

export interface ManagedAccountListRow extends Record<string, unknown> {
  uid: string;
  account_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  is_paper?: boolean | null;
  account_is_active?: boolean | null;
  creation_date?: string | null;
  created_at?: string | null;
}

export interface ManagedAccountRecord extends ManagedAccountListRow {}
export type ManagedAccountSummaryResponse = SummaryResponse<MainSequenceSummaryExtensions>;

export interface ManagedAccountListFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export type ManagedAccountTargetAllocationTargetType = "all" | "asset" | "portfolio";

export interface ManagedAccountTargetAllocationTargetRow extends Record<string, unknown> {
  target_type: "asset" | "portfolio" | string;
  target_uid: string;
  asset_uid: string | null;
  portfolio_uid: string | null;
  identifier: string;
  display_label: string;
  secondary_label: string | null;
  current_snapshot: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

export interface ManagedAccountTargetAllocationTargetFilters {
  search?: string;
  targetType?: ManagedAccountTargetAllocationTargetType;
  limit?: number;
  offset?: number;
}

export interface InstrumentsConfigurationNodeOption {
  id: number;
  uid?: string | null;
  label: string;
}

export interface InstrumentsConfigurationCurrentResponse {
  id: number;
  discount_curves_storage_node: string | null;
  reference_rates_fixings_storage_node: string | null;
  discount_nodes: InstrumentsConfigurationNodeOption[];
  fixings_nodes: InstrumentsConfigurationNodeOption[];
  can_edit: boolean;
}

export interface PortfolioGroupListRow extends Record<string, unknown> {
  id?: number;
  uid: string;
  name?: string | null;
  display_name?: string | null;
  portfolio_group_name?: string | null;
  unique_identifier?: string | null;
  description?: string | null;
  metadata_json?: Record<string, unknown> | null;
  portfolios?: string[] | null;
  portfolio_uids?: string[] | null;
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
  description?: string;
  metadata_json?: Record<string, unknown>;
}

export interface UpdatePortfolioGroupInput {
  display_name?: string;
  description?: string;
  metadata_json?: Record<string, unknown>;
}

export interface PortfolioGroupBulkDeleteInput {
  uids?: string[];
  unique_identifiers?: string[];
}

export interface PortfolioGroupBulkDeleteResponse {
  detail: string;
  deleted_count?: number;
}

export interface PortfolioGroupPortfolioMutationInput {
  portfolio_uid?: string;
  portfolio_unique_identifier?: string;
}

export interface PortfolioGroupMembershipRecord extends Record<string, unknown> {
  uid?: string;
  portfolio_group_uid?: string;
  portfolio_uid?: string;
  portfolio_unique_identifier?: string;
}

export interface PortfolioGroupPortfolioListRow extends Record<string, unknown> {
  uid: string;
  unique_identifier: string;
  calendar_uid?: string | null;
  published_index_uid?: string | null;
  portfolio_weights_data_node_uid?: string | null;
  signal_weights_data_node_uid?: string | null;
  signal_uid?: string | null;
  portfolio_data_node_uid?: string | null;
}

export interface PortfolioGroupMembershipBulkDeleteInput {
  uids?: string[];
  portfolio_group_uids?: string[];
  portfolio_uids?: string[];
}

export interface TargetPortfolioListRow extends Record<string, unknown> {
  uid: string;
  unique_identifier: string;
  calendar_name?: string | null;
  calendar_uid?: string | null;
  portfolio_index_uid?: string | null;
  portfolio_weights_data_node_uid?: string | null;
  signal_weights_data_node_uid?: string | null;
  portfolio_data_node_uid?: string | null;
  backtest_table_price_column_name?: string | null;
}

export interface TargetPortfolioBulkDeleteInput {
  uids?: string[];
}

export interface TargetPortfolioBulkDeleteResponse {
  detail: string;
  deleted_count?: number;
  failed?: Array<{
    uid?: string | null;
    reason?: string | null;
  }>;
}

export interface TargetPortfolioSearchOption {
  uid: string;
  unique_identifier: string;
  calendar_name?: string | null;
  calendar_uid?: string | null;
  portfolio_index_uid?: string | null;
}

export interface TargetPortfolioDetailResponse extends Record<string, unknown> {
  portfolio: TargetPortfolioListRow | null;
  metadata: {
    uid?: string | null;
    unique_identifier?: string | null;
    description?: string | null;
    [key: string]: unknown;
  } | null;
  tabs?: Array<{
    key?: string | null;
    label?: string | null;
    url?: string | null;
    [key: string]: unknown;
  }>;
  links?: {
    summary?: string | null;
    latest_weights?: string | null;
    delete?: string | null;
    [key: string]: unknown;
  } | null;
}

export interface TargetPortfolioWeightsResponse extends Record<string, unknown> {
  portfolio_uid: string | null;
  portfolio_unique_identifier: string | null;
  portfolio_index_uid: string | null;
  portfolio_index_identifier: string | null;
  weights_date: string | null;
  resolution_warning: string | null;
  weights: Array<Record<string, unknown>>;
}

export interface TargetPortfolioWeightsDeleteInput {
  weightsDate?: string | null;
}

export interface TargetPortfolioWeightsDeleteResponse extends Record<string, unknown> {
  detail: string;
  portfolio_uid: string | null;
  portfolio_index_identifier: string | null;
  weights_date: string | null;
  deleted_count: number;
}

export interface TargetPortfolioTabularFrameFilters {
  startDate?: string;
  endDate?: string;
  order?: "asc" | "desc";
  limit?: number;
}

export interface PortfolioSignalRecord extends Record<string, unknown> {
  uid: string;
  signal_uid: string;
  signal_description: string | null;
}

export interface PortfolioSignalListFilters {
  search?: string;
  signalUid?: string;
  limit?: number;
  offset?: number;
}

export interface CreatePortfolioSignalInput {
  signal_uid: string;
  signal_description: string;
}

export interface UpdatePortfolioSignalInput {
  signal_description: string;
}

export interface PortfolioSignalWeightsDeleteInput {
  weightsDate?: string | null;
}

export interface PortfolioSignalWeightsDeleteResponse extends Record<string, unknown> {
  detail: string;
  signal_metadata_uid: string | null;
  signal_uid: string | null;
  weights_date: string | null;
  deleted_count: number;
}

export interface PortfolioSignalDeleteResponse extends Record<string, unknown> {
  detail: string;
  signal_metadata_uid: string | null;
  signal_uid: string | null;
  deleted_count: number;
  deleted_weights_count: number;
}

export interface SummaryExtensions {
  [key: string]: unknown;
}

export interface MainSequenceSummaryExtensions extends SummaryExtensions {
  resource_usage_chart_data?: ResourceUsageChartPoint[];
  generated_search_document?: string;
  agent_capabilities?: boolean;
}

export interface ClusterSummaryFilters {
  namespace?: string | null;
  node_pool?: string | null;
}

export type VirtualFundSummaryResponse = SummaryResponse<MainSequenceSummaryExtensions>;

export interface TargetPortfolioSummaryExtensions extends MainSequenceSummaryExtensions {
  description?: string;
  signal_name?: string;
  signal_description?: string;
  rebalance_strategy_name?: string;
  rebalance_strategy_description?: string;
  weights?: unknown;
  portfolio_weights?: unknown;
  target_weights?: unknown;
  weight_rows?: unknown;
}

export interface PositionDetailColumnDef {
  field: string;
  headerName?: string;
  [key: string]: unknown;
}

export interface PositionDetailResponse {
  weights: unknown;
  position_columns: unknown[];
  rows: Array<Record<string, unknown>>;
  columnDefs: PositionDetailColumnDef[];
  summaryColumnDefs: PositionDetailColumnDef[];
  position_map: Record<string, unknown> | null;
  weights_date: string | null;
  resolution_warning?: string | null;
}

export type TargetPortfolioWeightsPositionColumnDef = PositionDetailColumnDef;
export type TargetPortfolioWeightsPositionDetailsResponse = PositionDetailResponse;
export type TargetPositionDetailPositionColumnDef = PositionDetailColumnDef;
export type TargetPositionDetailPositionDetailsResponse = PositionDetailResponse;

export interface ManagedAccountHoldingRow {
  time_index: string | null;
  asset_identifier: string | null;
  asset: Record<string, unknown> | null;
  asset_uid: string | null;
  position_type: string | null;
  price: string | number | null;
  quantity: string | number | null;
  direction: number | null;
  signed_quantity: string | number | null;
  missing_price: boolean;
  target_trade_time: string | null;
  extra_details: Record<string, unknown>;
  allocation?: Record<string, unknown> | null;
  virtual_fund_holdings_set_uid?: string | null;
  source_account_holdings_set_uid?: string | null;
}

export interface ManagedAccountHoldingsSnapshotResponse {
  holdings_set_uid: string | null;
  holdings_date: string | null;
  holdings: ManagedAccountHoldingRow[];
}

export interface ManagedAccountHoldingsByFundResidualRow {
  asset_identifier: string | null;
  source_signed_quantity: string | number | null;
  allocated_signed_quantity: string | number | null;
  residual_signed_quantity: string | number | null;
  asset: Record<string, unknown> | null;
}

export interface ManagedAccountHoldingsByFundResponse {
  account_uid: string | null;
  source_account_holdings_set_uid: string | null;
  holdings_date: string | null;
  funds: Array<{
    virtual_fund_uid: string | null;
    virtual_fund_unique_identifier: string | null;
    target_portfolio_uid: string | null;
    holdings_set_uid: string | null;
    holdings: ManagedAccountHoldingRow[];
  }>;
  residuals: ManagedAccountHoldingsByFundResidualRow[];
  allocation_warnings: unknown[];
}

export interface ManagedAccountHoldingsByFundPositionDetailsResponse
  extends Omit<ManagedAccountHoldingsByFundResponse, "funds"> {
  funds: Array<
    ManagedAccountHoldingsByFundResponse["funds"][number] & {
      position_details: PositionDetailResponse;
    }
  >;
}

export interface ManagedAccountHoldingsWritePositionInput {
  asset_identifier: string;
  asset_uid: string;
  position_type: string;
  quantity: string;
  direction: 1 | -1;
  target_trade_time: string;
  extra_details: Record<string, unknown>;
}

export interface ManagedAccountHoldingsWriteInput {
  holdings_date: string;
  overwrite?: boolean;
  positions: ManagedAccountHoldingsWritePositionInput[];
}

export type ManagedAccountHoldingsWriteResponse = ManagedAccountHoldingsSnapshotResponse;

export type ManagedAccountTargetPositionsWritePositionInput = {
  target_type: "asset" | "portfolio";
  target_uid: string;
  metadata_json: Record<string, unknown>;
} & (
  | {
      target_type: "asset";
      asset_uid: string;
      portfolio_uid?: never;
      single_asset_quantity?: string;
    }
  | {
      target_type: "portfolio";
      portfolio_uid: string;
      asset_uid?: never;
      single_asset_quantity?: never;
    }
) & {
  weight_notional_exposure?: string;
  constant_notional_exposure?: string;
};

export interface ManagedAccountTargetPositionsWriteInput {
  target_positions_date: string;
  overwrite?: boolean;
  positions: ManagedAccountTargetPositionsWritePositionInput[];
}

export interface ManagedAccountSavedTargetPositionRow {
  target_type: string | null;
  target_uid: string | null;
  asset_uid: string | null;
  portfolio_uid: string | null;
  unique_identifier: string | null;
  weight_notional_exposure: string | number | null;
  constant_notional_exposure: string | number | null;
  single_asset_quantity: string | number | null;
  asset: Record<string, unknown> | null;
  portfolio: Record<string, unknown> | null;
}

export interface ManagedAccountTargetPositionsWriteResponse {
  related_account_uid: string | null;
  target_positions_date: string | null;
  position_set_uid: string | null;
  positions: ManagedAccountSavedTargetPositionRow[];
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

function resolveMainSequenceUidPath(uid: string, label: string) {
  const resolved = uid.trim();

  if (!resolved) {
    throw new Error(`Missing ${label} uid.`);
  }

  return encodePathSegment(resolved);
}

export type TsManagerPathIdentifier = string;

type TsManagerIdentifiableRecord = {
  uid?: string | null;
};

function readTsManagerIdentifier(value: TsManagerPathIdentifier | TsManagerIdentifiableRecord) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value && typeof value === "object") {
    if (typeof value.uid === "string" && value.uid.trim()) {
      return value.uid.trim();
    }
  }

  return "";
}

export function getTsManagerRecordIdentifier(
  value?: TsManagerIdentifiableRecord | TsManagerPathIdentifier | null,
) {
  if (value === null || value === undefined) {
    return null;
  }

  const identifier = readTsManagerIdentifier(value);
  return identifier ? identifier : null;
}

function resolveTsManagerPath(identifier: TsManagerPathIdentifier | TsManagerIdentifiableRecord) {
  const resolved = readTsManagerIdentifier(identifier);

  if (!resolved) {
    throw new Error("Missing ts_manager resource identifier.");
  }

  return encodePathSegment(resolved);
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

export interface AssetCurrentSnapshot {
  time_index?: string | null;
  asset_identifier?: string | null;
  name?: string | null;
  ticker?: string | null;
  exchange_code?: string | null;
  asset_ticker_group_id?: string | number | null;
  [key: string]: unknown;
}

export interface AssetDetailResponse {
  uid?: string | null;
  unique_identifier?: string | null;
  asset_type?: string | null;
  current_snapshot?: AssetCurrentSnapshot | null;
  details?: AssetDetailField[] | null;
  trading_view?: AssetTradingViewConfig | null;
  order_form?: AssetOrderFormConfig | null;
  // Legacy fields are kept for existing asset consumers while the backend
  // finishes moving display fields under `current_snapshot`.
  id?: number | null;
  name?: string | null;
  ticker?: string | null;
  figi?: string | null;
  exchange_code?: string | null;
  security_market_sector?: string | null;
  security_type?: string | null;
  is_custom_by_organization?: boolean;
  [key: string]: unknown;
}

export interface AssetPricingDetailsResponse {
  asset_uid: string;
  instrument_type: string;
  instrument_dump: Record<string, unknown>;
  pricing_details_date: string;
  serialization_format: string;
  pricing_package_version: string | null;
  source: string | null;
  metadata_json: Record<string, unknown> | null;
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
  uid: string;
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
  uid: string;
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

export interface ClusterSummaryExtensions extends MainSequenceSummaryExtensions {
  cluster?: ClusterDetailEntity;
  cluster_status?: ClusterDetailStatus;
  tabs?: ClusterDetailTabDefinition[];
  filters?: ClusterSummaryFilters;
}

export type ClusterSummaryResponse = SummaryResponse<ClusterSummaryExtensions>;

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

export interface ScalableServicePodRow {
  id: number;
  uid: string;
  service_runtime: number | null;
  revision_runtime: number | null;
  pod_uid: string;
  gke_pod_name: string;
  status: string | null;
  pod_events?: {
    labels?: Record<string, string>;
  } | null;
  creation_date: string | null;
  deleted_at: string | null;
  last_seen_at: string | null;
}

export interface KnativePodRuntimeLogsResponse {
  pod_runtime_uid: string;
  status: string;
  rows: JobRunLogEntry[];
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
  uid: string;
  project_name: string;
  data_source: DynamicTableDataSourceOption | null;
  git_ssh_url: string | null;
  is_initialized: boolean;
  agent_capabilities?: boolean;
  created_by: string;
}

export interface ProjectDetail extends ProjectSummary {
  repository_branch?: string | null;
  default_base_image?: ProjectBaseImageOption | null;
  github_organization?: GithubOrganizationOption | null;
}

export interface ConstantRecord {
  id: number;
  uid: string;
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
  uid: string;
  name: string;
  value: string;
}

export interface ProjectSecretRecord {
  id: number;
  uid: string;
  project: string;
  project_name: string;
  secret: string;
  secret_name: string;
  alias: string;
  created_at: string;
}

export interface CreateProjectSecretInput {
  project: string;
  secret: string;
  alias?: string;
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
  uid: string;
  name: string;
}

export interface CreateBucketInput {
  name: string;
}

export interface BucketBulkDeleteInput {
  uids?: string[];
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

export interface MetaTableRecord {
  id?: number | string;
  uid: string;
  storage_hash?: string;
  creation_date?: string | null;
  source_class_name?: string | null;
  identifier?: string | null;
  table_name?: string | null;
  meta_table_name?: string | null;
  description?: string | null;
  namespace?: string | null;
  labels?: string[];
  management_mode?: string | null;
  physical_table_name?: string | null;
  contract_version?: string | null;
  data_frequency_id?: string | number | null;
  data_source?: DynamicTableDataSourceOption | null;
  data_source_uid?: string | null;
  protect_from_deletion?: boolean;
  open_for_everyone?: boolean;
  [key: string]: unknown;
}

export interface MainSequenceNamespaceRecord {
  uid: string;
  name: string;
  description: string | null;
  creation_date: string | null;
  created_by_user_uid: string | null;
  organization_owner_uid: string | null;
  open_for_everyone: boolean;
  meta_table_count: number;
  dynamic_table_metadata_count: number;
}

export interface MainSequenceNamespaceOptionRecord {
  namespace_uid: string;
  namespace: string;
  display_name: string;
  table_count: number;
  filters: {
    namespace: string;
    namespace_uid: string;
  };
}

export interface MainSequenceNamespaceOption extends MainSequenceNamespaceOptionRecord {
  value: string;
}

export interface MainSequenceNamespaceDetail extends MainSequenceNamespaceRecord {
  [key: string]: unknown;
}

export type MainSequenceNamespaceTableKind = "meta_table" | "dynamic_table" | "unknown";

export interface MainSequenceNamespaceTableRecord {
  uid: string;
  kind: MainSequenceNamespaceTableKind;
  storage_hash: string | null;
  identifier: string | null;
  creation_date: string | null;
  namespace: string | null;
  raw: Record<string, unknown>;
}

export interface MetaTableColumnRecord {
  id?: number | null;
  name: string;
  label?: string | null;
  logical_name?: string | null;
  data_type?: string | null;
  backend_type?: string | null;
  nullable: boolean;
  primary_key: boolean;
  unique: boolean;
  ordinal_position?: number | null;
  description?: string | null;
  contract_fragment?: Record<string, unknown> | null;
}

export interface MetaTableForeignKeyRecord {
  id?: number | null;
  name: string;
  source_columns: string[];
  target_table_uid?: string | null;
  target_table_storage_hash?: string | null;
  target_columns: string[];
  on_delete?: string | null;
  contract_fragment?: Record<string, unknown> | null;
}

export interface MetaTableIndexRecord {
  name: string;
  columns: string[];
  unique?: boolean;
  method?: string | null;
  expression?: string | null;
  contract_fragment?: Record<string, unknown> | null;
}

export interface MetaTableSchemaGraphColumnRecord {
  id: number;
  attr_name: string;
  column_name: string;
  db_type: string;
  nullable: boolean;
  is_primary_key: boolean;
  is_unique: boolean;
}

export interface MetaTableSchemaGraphIndexRecord {
  id: number;
  name: string;
  columns: string[];
}

export interface MetaTableSchemaGraphTableRecord {
  id: number;
  uid: string;
  identifier: string;
  namespace: string | null;
  physical_table_name: string;
  storage_hash: string;
  source_class_name: string | null;
  data_source_id: number | null;
  columns: MetaTableSchemaGraphColumnRecord[];
  indexes: MetaTableSchemaGraphIndexRecord[];
}

export interface MetaTableSchemaGraphRelationshipRecord {
  id: number;
  name: string;
  source_table_id: number;
  source_table_uid: string;
  source_table_storage_hash: string | null;
  source_columns: string[];
  source_column: string;
  target_table_id: number;
  target_table_uid: string;
  target_table_storage_hash: string | null;
  target_columns: string[];
  target_column: string;
  on_delete: string | null;
  source_to_target_multiplicity: string | null;
  target_to_source_multiplicity: string | null;
}

export interface MetaTableSchemaGraphResponse {
  root_table_id: number;
  tables: MetaTableSchemaGraphTableRecord[];
  relationships: MetaTableSchemaGraphRelationshipRecord[];
}

export interface MetaTableDetail extends MetaTableRecord {
  schema?: unknown;
  sourcetableconfiguration?: DataNodeSourceTableConfiguration | null;
  table_contract?: unknown;
  introspection_snapshot?: unknown;
  build_configuration?: unknown;
  build_configuration_json_schema?: unknown;
  created_by_user?: number | null;
  created_by_user_uid?: string | null;
  organization_owner?: number | null;
  organization_owner_uid?: string | null;
  columns?: MetaTableColumnRecord[];
  foreign_keys?: MetaTableForeignKeyRecord[];
  incoming_fks?: MetaTableForeignKeyRecord[];
  indexes_meta?: MetaTableIndexRecord[];
}

export interface MetaTableBulkDeleteInput {
  uids: string[];
}

export interface MetaTableDeleteWithCascadeInput {
  uids: string[];
  confirm_cascade_delete: true;
  delete_referencing_meta_tables?: boolean;
  delete_referencing_dynamic_tables?: boolean;
  drop_platform_managed_physical_tables?: boolean;
}

export interface MetaTableDeleteWithCascadeResponse {
  ok: boolean;
  action?: string;
  root_meta_table_uid?: string;
  root_meta_table_uids?: string[];
  deleted_meta_tables?: string[];
  deleted_dynamic_tables?: string[];
  deleted_meta_table_count?: number;
  deleted_dynamic_table_count?: number;
  blocking_edges?: unknown[];
}

export interface MetaTableBulkRefreshResult {
  ok: boolean;
  meta_table_uid: string;
  search_index_updated: boolean;
  embedding_model?: string | null;
}

export interface MetaTableBulkRefreshResponse {
  results: MetaTableBulkRefreshResult[];
}

export interface MetaTableSyncFromPhysicalResponse {
  ok?: boolean;
  detail?: string;
  [key: string]: unknown;
}

export type MetaTableImportIdentifierStrategy =
  | "none"
  | "table_name"
  | "namespace_table_name";

export interface MetaTableImportFromDataSourceInput {
  data_source_uid: string;
  namespace?: string | null;
  dry_run: boolean;
  include_views?: boolean;
  follow_foreign_keys?: boolean;
  refresh_existing?: boolean;
  strict?: boolean;
  identifier_strategy?: MetaTableImportIdentifierStrategy;
  relation_names?: string[];
  exclude_relation_names?: string[];
  stale_policy?: "report_only";
}

export interface MetaTableImportFromDataSourceCounts {
  discovered: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  stale: number;
}

export interface MetaTableImportFromDataSourceRelation {
  physical_table_name: string;
  relation_kind: string;
  status: string;
  meta_table_uid?: string | null;
  columns?: number | null;
  indexes?: number | null;
  foreign_keys?: number | null;
  warnings?: string[];
  error?: string | null;
  [key: string]: unknown;
}

export interface MetaTableImportFromDataSourceStaleRecord {
  meta_table_uid?: string | null;
  physical_table_name: string;
  reason: string;
}

export interface MetaTableImportFromDataSourceResponse {
  ok: boolean;
  dry_run: boolean;
  data_source_uid: string;
  physical_data_source_uid?: string | null;
  class_type?: string | null;
  schema?: string | null;
  namespace?: string | null;
  counts: MetaTableImportFromDataSourceCounts;
  relations: MetaTableImportFromDataSourceRelation[];
  stale: MetaTableImportFromDataSourceStaleRecord[];
  warnings: string[];
}

function normalizeMetaTableImportText(value: unknown, fallback = "") {
  if (typeof value === "string") {
    return value.trim() || fallback;
  }

  const message = readMessageFromPayload(value);
  return message || fallback;
}

function normalizeMetaTableImportTextList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeMetaTableImportText(entry))
      .filter((entry) => entry.length > 0);
  }

  const single = normalizeMetaTableImportText(value);
  return single ? [single] : [];
}

function normalizeMetaTableImportFromDataSourceResponse(
  response: MetaTableImportFromDataSourceResponse,
): MetaTableImportFromDataSourceResponse {
  return {
    ...response,
    warnings: normalizeMetaTableImportTextList(response.warnings),
    relations: Array.isArray(response.relations)
      ? response.relations.map((relation) => ({
          ...relation,
          warnings: normalizeMetaTableImportTextList(relation.warnings),
          error:
            relation.error === null || relation.error === undefined
              ? null
              : normalizeMetaTableImportText(
                  relation.error,
                  "The relation import failed.",
                ),
        }))
      : [],
    stale: Array.isArray(response.stale)
      ? response.stale.map((staleRecord) => ({
          ...staleRecord,
          reason: normalizeMetaTableImportText(staleRecord.reason),
        }))
      : [],
  };
}

export interface ColumnarDataSnapshot {
  columns: string[];
  rows: DataNodeRemoteDataRow[];
}

export interface DataNodeSummary {
  id: number;
  uid?: string | null;
  storage_hash: string;
  creation_date: string;
  namespace?: string | null;
  source_class_name: string | null;
  protect_from_deletion: boolean;
  time_serie_source_code_git_hash: string | null;
  created_by_user: number | null;
  open_for_everyone: boolean;
  data_source: DynamicTableDataSourceOption | null;
  table_index_names?: string[] | null;
  index_names?: string[] | null;
  sourcetableconfiguration?: Pick<DataNodeSourceTableConfiguration, "index_names"> | null;
  data_source_open_for_everyone: boolean;
  identifier: string | null;
  table_name?: string | null;
  meta_table_name?: string | null;
  physical_table_name?: string | null;
  provisioning_status?: string | null;
  description: string | null;
  data_frequency_id: string | number | null;
}

export interface DataNodeQuickSearchRecord {
  id: number;
  uid?: string | null;
  storage_hash: string;
  identifier: string | null;
}

export interface ProjectQuickSearchRecord {
  id: number;
  uid: string;
  project_name: string;
  repository_branch: string;
  cluster_id?: number | null;
}

export interface LocalTimeSerieQuickSearchRecord {
  id: number;
  uid?: string | null;
  update_hash: string;
  project_uid?: string | null;
  data_node_storage: {
    id: number;
    uid?: string | null;
    storage_hash: string;
    identifier: string | null;
  } | null;
}

export interface DataNodeColumnMetadata {
  source_config_id: number | null;
  source_config_uid?: string | null;
  column_name: string;
  dtype: string | null;
  label: string | null;
  description: string | null;
}

export interface DataNodeSourceTableConfiguration {
  id?: number | null;
  uid?: string | null;
  related_table_uid: string | null;
  time_index_name: string | null;
  column_dtypes_map: Record<string, string> | null;
  index_names: string[] | null;
  last_time_index_value: string | null;
  earliest_index_value: string | null;
  table_partition: unknown;
  open_for_everyone: boolean;
  columns_metadata: DataNodeColumnMetadata[];
}

export interface DataNodeForeignKeyRecord {
  source_columns: string[];
  target_meta_table_uid: string | null;
  target_columns: string[];
  on_delete: string | null;
}

export interface DataNodeDetail extends DataNodeSummary {
  build_configuration: unknown;
  build_meta_data: unknown;
  sourcetableconfiguration: DataNodeSourceTableConfiguration | null;
  table_contract?: unknown;
  introspection_snapshot?: unknown;
  columns?: MetaTableColumnRecord[];
  indexes_meta?: MetaTableIndexRecord[];
  foreign_keys?: MetaTableForeignKeyRecord[];
  incoming_fks?: MetaTableForeignKeyRecord[];
  labels?: string[];
  management_mode?: string | null;
  contract_version?: string | null;
}

export interface SourceTableConfigurationStatsResponse {
  multi_index_stats: {
    max_per_asset_symbol: Record<string, string>;
    min_per_asset_symbol: Record<string, string>;
  } | null;
  multi_index_column_stats: unknown;
}

export interface DataNodeStatsResponse {
  multi_index_stats: Record<string, unknown> | null;
  multi_index_column_stats: unknown;
}

export interface DataNodeTailDeleteInput {
  after_date: string;
  unique_identifier_list?: string[];
}

export interface DataNodeTailDeleteResponse {
  ok: boolean;
  dynamic_table_id: number;
  deleted_count: number;
  table_empty: boolean;
  unique_identifier_list?: string[];
  stats: {
    last_time_index_value: string | null;
    earliest_index_value: string | null;
    multi_index_stats: {
      max_per_asset_symbol: Record<string, string>;
      min_per_asset_symbol: Record<string, string>;
    } | null;
    multi_index_column_stats: unknown;
  };
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
  dynamic_table_metadata_uid: string;
  storage_hash: string;
  ok: boolean;
  detail?: string;
}

export interface DynamicTableBulkActionResponse {
  ok: boolean;
  action: string;
  requested_uids: string[];
  requested_count: number;
  select_all: boolean;
  matched_count: number;
  success_count: number;
  failed_count: number;
  results: DynamicTableBulkActionItemResult[];
}

export interface DynamicTableBulkDeleteInput {
  selectedUids: string[];
  fullDeleteSelected?: boolean;
  fullDeleteDownstreamTables?: boolean;
  deleteWithNoTable?: boolean;
  overrideProtection?: boolean;
}

export interface DynamicTableBulkDeleteResponse {
  ok: boolean;
  requested_uids: string[];
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
  related_table_uid: string | null;
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
  uid?: string | null;
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
  related_table_uid: string | null;
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
  node_type?: string;
  remote_table_type?: string;
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

function tryBuildDependencyGraphPayload(value: unknown): LocalTimeSerieDependencyGraphResponse | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    return null;
  }

  return {
    nodes: candidate.nodes as LocalTimeSerieDependencyGraphNode[],
    edges: candidate.edges as LocalTimeSerieDependencyGraphEdge[],
    groups: Array.isArray(candidate.groups)
      ? (candidate.groups as LocalTimeSerieDependencyGraphGroup[])
      : [],
  };
}

function normalizeDependencyGraphPayload(
  payload: unknown,
  endpointLabel: string,
): LocalTimeSerieDependencyGraphResponse {
  const normalizedTopLevel = tryBuildDependencyGraphPayload(payload);

  if (normalizedTopLevel) {
    return normalizedTopLevel;
  }

  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    const nestedKeys = ["graph", "data", "payload", "result", "elements"] as const;

    for (const key of nestedKeys) {
      const normalizedNested = tryBuildDependencyGraphPayload(candidate[key]);

      if (normalizedNested) {
        return normalizedNested;
      }
    }
  }

  throw new MainSequenceApiError(
    `The ${endpointLabel} endpoint did not return a dependency graph payload.`,
    200,
    payload,
  );
}

function buildWidgetPreviewIsoTimestamp(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function buildWidgetPreviewPositionDetailResponse(
  targetPortfolioId: number,
): PositionDetailResponse {
  const rows = [
    {
      id: 1,
      asset_name: "US 2Y Note",
      asset_ticker: "UST2Y",
      unique_identifier: "US91282CJR34",
      figi: "BBG00JX7S9H4",
      sector: "Rates",
      rebalance_bucket: "Front End",
      position_type: "weight_notional_exposure",
      position_value: 0.184,
    },
    {
      id: 2,
      asset_name: "US 5Y Note",
      asset_ticker: "UST5Y",
      unique_identifier: "US91282CKL45",
      figi: "BBG00K6R7X31",
      sector: "Rates",
      rebalance_bucket: "Belly",
      position_type: "weight_notional_exposure",
      position_value: 0.227,
    },
    {
      id: 3,
      asset_name: "US 10Y Note",
      asset_ticker: "UST10Y",
      unique_identifier: "US91282CLM67",
      figi: "BBG00L0J2D82",
      sector: "Rates",
      rebalance_bucket: "Benchmark",
      position_type: "weight_notional_exposure",
      position_value: 0.311,
    },
    {
      id: 4,
      asset_name: "US 30Y Bond",
      asset_ticker: "UST30Y",
      unique_identifier: "US912810TW80",
      figi: "BBG00M2P5V57",
      sector: "Rates",
      rebalance_bucket: "Long End",
      position_type: "weight_notional_exposure",
      position_value: 0.278,
    },
  ] satisfies Array<Record<string, unknown>>;

  const positionMap = Object.fromEntries(
    rows.map((row) => [
      String(row.unique_identifier),
      {
        position_type: row.position_type,
        position_value: row.position_value,
      },
    ]),
  );

  return {
    weights: [
      { label: "Rates", value: 0.57 },
      { label: "Credit", value: 0.18 },
      { label: "Equities", value: 0.14 },
      { label: "Liquidity", value: 0.11 },
    ],
    position_columns: [],
    rows,
    columnDefs: [
      { field: "asset_ticker", headerName: "Ticker" },
      { field: "asset_name", headerName: "Asset" },
      { field: "sector", headerName: "Sector" },
      { field: "rebalance_bucket", headerName: "Bucket" },
      { field: "position_value", headerName: "Target Weight" },
    ],
    summaryColumnDefs: [
      { field: "label", headerName: "Bucket" },
      { field: "value", headerName: "Weight" },
    ],
    position_map: {
      ...positionMap,
      [`portfolio-${targetPortfolioId}`]: {
        position_type: "weight_notional_exposure",
        position_value: 1,
      },
    },
    weights_date: buildWidgetPreviewIsoTimestamp(),
  };
}

function buildEmptyPositionDetailResponse(
  weightsDate: string | null = null,
): PositionDetailResponse {
  return {
    weights: null,
    position_columns: [],
    rows: [],
    columnDefs: [],
    summaryColumnDefs: [],
    position_map: null,
    weights_date: weightsDate,
  };
}

function extractFirstCollectionRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return (
      value.find((entry) => entry && typeof entry === "object" && !Array.isArray(entry)) as
        | Record<string, unknown>
        | undefined
    ) ?? null;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.results)) {
      return (
        record.results.find(
          (entry) => entry && typeof entry === "object" && !Array.isArray(entry),
        ) as Record<string, unknown> | undefined
      ) ?? null;
    }

    return record;
  }

  return null;
}

function normalizeManagedAccountHoldingsSnapshot(
  value: unknown,
): ManagedAccountHoldingsSnapshotResponse {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  const holdings = Array.isArray(record.holdings)
    ? record.holdings
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => {
          const row = entry as Record<string, unknown>;
          const asset =
            row.asset && typeof row.asset === "object" && !Array.isArray(row.asset)
                ? (row.asset as Record<string, unknown>)
                : null;
          const assetUidFromAssetObject =
            asset &&
            typeof asset.uid === "string" &&
            asset.uid.trim()
              ? asset.uid.trim()
              : null;
          const assetIdentifierFromAsset =
            asset &&
            typeof asset.asset_identifier === "string" &&
            asset.asset_identifier.trim()
              ? asset.asset_identifier.trim()
              : asset &&
                  typeof asset.unique_identifier === "string" &&
                  asset.unique_identifier.trim()
                ? asset.unique_identifier.trim()
                : null;
          const direction =
            typeof row.direction === "number"
              ? row.direction
              : typeof row.direction === "string" && row.direction.trim()
                ? Number(row.direction)
                : null;
          const quantity =
            typeof row.quantity === "string" || typeof row.quantity === "number"
              ? row.quantity
              : null;
          const signedQuantity =
            typeof row.signed_quantity === "string" || typeof row.signed_quantity === "number"
              ? row.signed_quantity
              : applyManagedAccountHoldingDirection(quantity, direction);

          return {
            time_index: typeof row.time_index === "string" ? row.time_index : null,
            asset_identifier:
              typeof row.asset_identifier === "string" && row.asset_identifier.trim()
                ? row.asset_identifier.trim()
                : typeof row.unique_identifier === "string" && row.unique_identifier.trim()
                  ? row.unique_identifier.trim()
                  : assetIdentifierFromAsset,
            asset,
            asset_uid:
              typeof row.asset_uid === "string" && row.asset_uid.trim()
                ? row.asset_uid.trim()
                : assetUidFromAssetObject,
            position_type:
              typeof row.position_type === "string" ? row.position_type : null,
            price:
              typeof row.price === "string" || typeof row.price === "number" ? row.price : null,
            quantity,
            direction,
            signed_quantity: signedQuantity,
            missing_price: typeof row.missing_price === "boolean" ? row.missing_price : false,
            target_trade_time:
              typeof row.target_trade_time === "string" ? row.target_trade_time : null,
            extra_details:
              row.extra_details && typeof row.extra_details === "object" && !Array.isArray(row.extra_details)
                ? (row.extra_details as Record<string, unknown>)
                : {},
            allocation:
              row.allocation && typeof row.allocation === "object" && !Array.isArray(row.allocation)
                ? (row.allocation as Record<string, unknown>)
                : null,
            virtual_fund_holdings_set_uid:
              typeof row.virtual_fund_holdings_set_uid === "string" && row.virtual_fund_holdings_set_uid.trim()
                ? row.virtual_fund_holdings_set_uid.trim()
                : null,
            source_account_holdings_set_uid:
              typeof row.source_account_holdings_set_uid === "string" && row.source_account_holdings_set_uid.trim()
                ? row.source_account_holdings_set_uid.trim()
                : null,
          } satisfies ManagedAccountHoldingRow;
        })
    : [];

  return {
    holdings_set_uid: typeof record.holdings_set_uid === "string" ? record.holdings_set_uid : null,
    holdings_date: typeof record.holdings_date === "string" ? record.holdings_date : null,
    holdings,
  };
}

function applyManagedAccountHoldingDirection(
  quantity: string | number | null,
  direction: number | null,
) {
  if (quantity === null) {
    return null;
  }

  const parsedQuantity = Number(quantity);

  if (!Number.isFinite(parsedQuantity)) {
    return quantity;
  }

  const normalizedDirection = direction !== null && direction < 0 ? -1 : 1;
  return Math.abs(parsedQuantity) * normalizedDirection;
}

function adaptManagedAccountHoldingsSnapshotToPositionDetails(
  snapshot: ManagedAccountHoldingsSnapshotResponse,
): PositionDetailResponse {
  if (snapshot.holdings.length === 0) {
    return buildEmptyPositionDetailResponse(snapshot.holdings_date);
  }

  return {
    weights: {
      holdings_set_uid: snapshot.holdings_set_uid,
    },
    position_columns: [],
    rows: snapshot.holdings.map((holding) => {
      const assetDetail =
        holding.asset && typeof holding.asset === "object" && !Array.isArray(holding.asset)
          ? holding.asset
          : null;
      const currentSnapshot =
        assetDetail?.current_snapshot &&
        typeof assetDetail.current_snapshot === "object" &&
        !Array.isArray(assetDetail.current_snapshot)
          ? (assetDetail.current_snapshot as Record<string, unknown>)
          : null;
      const assetName =
        typeof currentSnapshot?.name === "string" && currentSnapshot.name.trim()
          ? currentSnapshot.name.trim()
          : holding.asset_identifier;
      const assetTicker =
        typeof currentSnapshot?.ticker === "string" && currentSnapshot.ticker.trim()
          ? currentSnapshot.ticker.trim()
          : null;
      const figi =
        assetDetail && typeof assetDetail.figi === "string" && assetDetail.figi.trim()
          ? assetDetail.figi.trim()
          : holding.asset_identifier;
      const signedQuantity =
        holding.signed_quantity ??
        applyManagedAccountHoldingDirection(holding.quantity, holding.direction);

      return {
        ...(holding.asset_uid ? { asset_uid: holding.asset_uid } : {}),
        asset_identifier: holding.asset_identifier,
        asset_name: assetName,
        asset_ticker: assetTicker,
        unique_identifier: holding.asset_identifier,
        figi,
        date: snapshot.holdings_date,
        time_index: holding.time_index ?? snapshot.holdings_date,
        ...(holding.price !== null ? { price: holding.price } : {}),
        missing_price: holding.missing_price,
        quantity: holding.quantity,
        direction: holding.direction,
        signed_quantity: signedQuantity,
        position_value: signedQuantity,
        position_type: holding.position_type ?? "units",
        ...(holding.target_trade_time ? { target_trade_time: holding.target_trade_time } : {}),
        extra_details: holding.extra_details,
        ...(holding.allocation ? { allocation: holding.allocation } : {}),
        ...(holding.virtual_fund_holdings_set_uid
          ? { virtual_fund_holdings_set_uid: holding.virtual_fund_holdings_set_uid }
          : {}),
        ...(holding.source_account_holdings_set_uid
          ? { source_account_holdings_set_uid: holding.source_account_holdings_set_uid }
          : {}),
        ...(assetDetail ? { asset: assetDetail } : {}),
      };
    }),
    columnDefs: [
      { field: "asset_name", headerName: "Asset" },
      { field: "asset_ticker", headerName: "Ticker" },
      { field: "unique_identifier", headerName: "UID" },
      { field: "date", headerName: "Date" },
      { field: "position_value", headerName: "Quantity" },
    ],
    summaryColumnDefs: [],
    position_map: null,
    weights_date: snapshot.holdings_date,
  };
}

function normalizeManagedAccountHoldingsByFundScalar(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function normalizeManagedAccountHoldingsByFundResponse(
  value: unknown,
): ManagedAccountHoldingsByFundResponse {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const sourceAccountHoldingsSetUid = readPortfolioString(record.source_account_holdings_set_uid);
  const holdingsDate = readPortfolioString(record.holdings_date);
  const funds = Array.isArray(record.funds)
    ? record.funds
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => {
          const fund = entry as Record<string, unknown>;
          const holdingsSetUid = readPortfolioString(fund.holdings_set_uid);
          const holdings = Array.isArray(fund.holdings)
            ? fund.holdings
                .filter((holding) => holding && typeof holding === "object" && !Array.isArray(holding))
                .map((holding) => {
                  const row = holding as Record<string, unknown>;
                  return {
                    ...row,
                    virtual_fund_holdings_set_uid:
                      row.virtual_fund_holdings_set_uid ?? holdingsSetUid,
                    source_account_holdings_set_uid:
                      row.source_account_holdings_set_uid ?? sourceAccountHoldingsSetUid,
                  };
                })
            : [];

          return {
            virtual_fund_uid: readPortfolioString(fund.virtual_fund_uid),
            virtual_fund_unique_identifier: readPortfolioString(
              fund.virtual_fund_unique_identifier,
            ),
            target_portfolio_uid: readPortfolioString(fund.target_portfolio_uid),
            holdings_set_uid: holdingsSetUid,
            holdings: normalizeManagedAccountHoldingsSnapshot({
              holdings_set_uid: holdingsSetUid,
              holdings_date: holdingsDate,
              holdings,
            }).holdings,
          };
        })
    : [];
  const residuals = Array.isArray(record.residuals)
    ? record.residuals
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => {
          const row = entry as Record<string, unknown>;
          const asset =
            row.asset && typeof row.asset === "object" && !Array.isArray(row.asset)
              ? (row.asset as Record<string, unknown>)
              : null;

          return {
            asset_identifier: readPortfolioString(row.asset_identifier),
            source_signed_quantity: normalizeManagedAccountHoldingsByFundScalar(
              row.source_signed_quantity,
            ),
            allocated_signed_quantity: normalizeManagedAccountHoldingsByFundScalar(
              row.allocated_signed_quantity,
            ),
            residual_signed_quantity: normalizeManagedAccountHoldingsByFundScalar(
              row.residual_signed_quantity,
            ),
            asset,
          } satisfies ManagedAccountHoldingsByFundResidualRow;
        })
    : [];

  return {
    account_uid: readPortfolioString(record.account_uid),
    source_account_holdings_set_uid: sourceAccountHoldingsSetUid,
    holdings_date: holdingsDate,
    funds,
    residuals,
    allocation_warnings: Array.isArray(record.allocation_warnings)
      ? record.allocation_warnings
      : [],
  };
}

function adaptManagedAccountHoldingsByFundResponseToPositionDetails(
  snapshot: ManagedAccountHoldingsByFundResponse,
): ManagedAccountHoldingsByFundPositionDetailsResponse {
  return {
    ...snapshot,
    funds: snapshot.funds.map((fund) => ({
      ...fund,
      position_details: adaptManagedAccountHoldingsSnapshotToPositionDetails({
        holdings_set_uid: fund.holdings_set_uid,
        holdings_date: snapshot.holdings_date,
        holdings: fund.holdings,
      }),
    })),
  };
}

function normalizeManagedAccountHoldingsWriteResponse(
  value: unknown,
): ManagedAccountHoldingsWriteResponse {
  return normalizeManagedAccountHoldingsSnapshot(value);
}

function normalizeManagedAccountTargetPositionsWriteResponse(
  value: unknown,
): ManagedAccountTargetPositionsWriteResponse {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  const positions = Array.isArray(record.positions)
    ? record.positions
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => {
          const row = entry as Record<string, unknown>;
          const asset =
            row.asset && typeof row.asset === "object" && !Array.isArray(row.asset)
              ? (row.asset as Record<string, unknown>)
              : null;
          const portfolio =
            row.portfolio && typeof row.portfolio === "object" && !Array.isArray(row.portfolio)
              ? (row.portfolio as Record<string, unknown>)
              : null;
          return {
            target_type:
              typeof row.target_type === "string" && row.target_type.trim()
                ? row.target_type.trim()
                : null,
            target_uid:
              typeof row.target_uid === "string" && row.target_uid.trim()
                ? row.target_uid.trim()
                : null,
            asset_uid:
              typeof row.asset_uid === "string" && row.asset_uid.trim()
                ? row.asset_uid.trim()
                : null,
            portfolio_uid:
              typeof row.portfolio_uid === "string" && row.portfolio_uid.trim()
                ? row.portfolio_uid.trim()
                : null,
            unique_identifier:
              typeof row.unique_identifier === "string" ? row.unique_identifier : null,
            weight_notional_exposure:
              typeof row.weight_notional_exposure === "string" ||
              typeof row.weight_notional_exposure === "number"
                ? row.weight_notional_exposure
                : null,
            constant_notional_exposure:
              typeof row.constant_notional_exposure === "string" ||
              typeof row.constant_notional_exposure === "number"
                ? row.constant_notional_exposure
                : null,
            single_asset_quantity:
              typeof row.single_asset_quantity === "string" ||
              typeof row.single_asset_quantity === "number"
                ? row.single_asset_quantity
                : null,
            asset,
            portfolio,
          } satisfies ManagedAccountSavedTargetPositionRow;
        })
    : [];

  return {
    related_account_uid:
      typeof record.related_account_uid === "string" ? record.related_account_uid : null,
    target_positions_date:
      typeof record.target_positions_date === "string" ? record.target_positions_date : null,
    position_set_uid:
      typeof record.position_set_uid === "string" ? record.position_set_uid : null,
    positions,
  };
}

function adaptManagedAccountTargetPositionsResponseToPositionDetails(
  snapshot: ManagedAccountTargetPositionsWriteResponse,
): PositionDetailResponse {
  if (snapshot.positions.length === 0) {
    return buildEmptyPositionDetailResponse(snapshot.target_positions_date);
  }

  return {
    weights: {
      related_account_uid: snapshot.related_account_uid,
      position_set_uid: snapshot.position_set_uid,
    },
    position_columns: [],
    rows: snapshot.positions.map((position) => {
      const assetDetail = position.asset;
      const currentSnapshot =
        assetDetail?.current_snapshot &&
        typeof assetDetail.current_snapshot === "object" &&
        !Array.isArray(assetDetail.current_snapshot)
          ? (assetDetail.current_snapshot as Record<string, unknown>)
          : null;
      const assetUid =
        position.asset_uid ??
        (assetDetail && typeof assetDetail.uid === "string" && assetDetail.uid.trim()
          ? assetDetail.uid.trim()
          : null);
      const portfolioUid =
        position.portfolio_uid ??
        (position.portfolio &&
        typeof position.portfolio.uid === "string" &&
        position.portfolio.uid.trim()
          ? position.portfolio.uid.trim()
          : null);
      const targetType =
        position.target_type ?? (portfolioUid !== null ? "portfolio" : "asset");
      const targetUid =
        position.target_uid ?? (targetType === "portfolio" ? portfolioUid : assetUid);
      const assetUniqueIdentifier =
        assetDetail &&
        typeof assetDetail.unique_identifier === "string" &&
        assetDetail.unique_identifier.trim()
          ? assetDetail.unique_identifier.trim()
          : null;
      const assetName =
        typeof currentSnapshot?.name === "string" && currentSnapshot.name.trim()
          ? currentSnapshot.name.trim()
          : assetUniqueIdentifier ?? position.unique_identifier;
      const assetTicker =
        typeof currentSnapshot?.ticker === "string" && currentSnapshot.ticker.trim()
          ? currentSnapshot.ticker.trim()
          : null;
      const resolvedUniqueIdentifier = assetUniqueIdentifier ?? position.unique_identifier;
      const figi = resolvedUniqueIdentifier;

      const resolvedPosition = (() => {
        if (position.weight_notional_exposure !== null) {
          return {
            position_type: "weight_notional_exposure",
            position_value: position.weight_notional_exposure,
            weight_notional_exposure: position.weight_notional_exposure,
            constant_notional_exposure: null,
            single_asset_quantity: null,
          };
        }

        if (position.constant_notional_exposure !== null) {
          return {
            position_type: "constant_notional",
            position_value: position.constant_notional_exposure,
            weight_notional_exposure: null,
            constant_notional_exposure: position.constant_notional_exposure,
            single_asset_quantity: null,
          };
        }

        return {
          position_type: "units",
          position_value: position.single_asset_quantity,
          weight_notional_exposure: null,
          constant_notional_exposure: null,
          single_asset_quantity: position.single_asset_quantity,
        };
      })();

      return {
        target_type: targetType,
        ...(targetUid !== null ? { target_uid: targetUid } : {}),
        ...(assetUid !== null ? { asset_uid: assetUid } : {}),
        ...(portfolioUid !== null ? { portfolio_uid: portfolioUid } : {}),
        asset_name: assetName,
        asset_ticker: assetTicker,
        unique_identifier: resolvedUniqueIdentifier,
        figi,
        ...resolvedPosition,
        ...(assetDetail ? { asset: assetDetail } : {}),
        ...(position.portfolio ? { portfolio: position.portfolio } : {}),
      };
    }),
    columnDefs: [
      { field: "target_type", headerName: "Target Type" },
      { field: "asset_name", headerName: "Asset" },
      { field: "asset_ticker", headerName: "Ticker" },
      { field: "position_type", headerName: "Position Type" },
      { field: "position_value", headerName: "Position Value" },
    ],
    summaryColumnDefs: [],
    position_map: null,
    weights_date: snapshot.target_positions_date,
  };
}

function adaptManagedAccountHoldingsWriteResponseToPositionDetails(
  snapshot: ManagedAccountHoldingsWriteResponse,
): PositionDetailResponse {
  return adaptManagedAccountHoldingsSnapshotToPositionDetails(snapshot);
}

function buildWidgetPreviewDataNodeDetail(): DataNodeDetail {
  const previewRecordId = 0;
  return {
    id: previewRecordId,
    storage_hash: "preview-data-node",
    creation_date: buildWidgetPreviewIsoTimestamp(-14 * 24 * 60 * 60 * 1000),
    source_class_name: "widget.preview",
    protect_from_deletion: false,
    time_serie_source_code_git_hash: null,
    created_by_user: null,
    open_for_everyone: false,
    data_source: null,
    data_source_open_for_everyone: false,
    identifier: "UST Curve Preview Node",
    description: "Synthetic rates observations for widget preview data.",
    data_frequency_id: "daily",
    build_configuration: null,
    build_meta_data: null,
    sourcetableconfiguration: {
      related_table_uid: "preview-data-node",
      time_index_name: "time_index",
      column_dtypes_map: {
        time_index: "timestamp",
        unique_identifier: "text",
        mid_yield: "float",
        carry_bp: "float",
        dv01: "float",
      },
      index_names: ["time_index", "unique_identifier"],
      last_time_index_value: buildWidgetPreviewIsoTimestamp(),
      earliest_index_value: buildWidgetPreviewIsoTimestamp(-45 * 24 * 60 * 60 * 1000),
      table_partition: null,
      open_for_everyone: false,
      columns_metadata: [
        {
          source_config_id: previewRecordId,
          column_name: "time_index",
          dtype: "timestamp",
          label: "Time Index",
          description: "Synthetic observation timestamp.",
        },
        {
          source_config_id: previewRecordId,
          column_name: "unique_identifier",
          dtype: "text",
          label: "Series",
          description: "Curve point identifier.",
        },
        {
          source_config_id: previewRecordId,
          column_name: "mid_yield",
          dtype: "float",
          label: "Mid Yield",
          description: "Mock mid yield used by the chart preview.",
        },
        {
          source_config_id: previewRecordId,
          column_name: "carry_bp",
          dtype: "float",
          label: "Carry",
          description: "Carry estimate in basis points.",
        },
        {
          source_config_id: previewRecordId,
          column_name: "dv01",
          dtype: "float",
          label: "DV01",
          description: "Dollar value of a basis point.",
        },
      ],
    },
  };
}

function buildWidgetPreviewDataNodeRows(
  input: DataNodeRemoteDataRequest,
): DataNodeRemoteDataRow[] {
  const requestedColumns = new Set(input.columns.length > 0 ? input.columns : [
    "time_index",
    "unique_identifier",
    "mid_yield",
    "carry_bp",
    "dv01",
  ]);
  const baseSeries = {
    UST2Y: 4.26,
    UST5Y: 4.04,
    UST10Y: 3.88,
    UST30Y: 4.01,
  } as const;
  const identifiers =
    input.unique_identifier_list && input.unique_identifier_list.length > 0
      ? input.unique_identifier_list
      : Object.keys(baseSeries);
  const endDateMs = input.end_date * 1000;
  const rows: DataNodeRemoteDataRow[] = [];

  for (let dayIndex = 27; dayIndex >= 0; dayIndex -= 1) {
    const observationDateMs = endDateMs - dayIndex * 24 * 60 * 60 * 1000;

    identifiers.forEach((identifier, seriesIndex) => {
      const baseValue =
        baseSeries[identifier as keyof typeof baseSeries] ??
        3.7 + seriesIndex * 0.18;
      const wave = Math.sin((27 - dayIndex + seriesIndex) / 3.4) * 0.11;
      const drift = (27 - dayIndex) * 0.004;
      const row: Record<string, unknown> = {
        time_index: new Date(observationDateMs).toISOString(),
        unique_identifier: identifier,
        mid_yield: Number((baseValue + wave + drift).toFixed(4)),
        carry_bp: Number((12 + seriesIndex * 3 + Math.cos(dayIndex / 4) * 4).toFixed(2)),
        dv01: Number((820 + seriesIndex * 95 + (27 - dayIndex) * 6).toFixed(2)),
      };

      rows.push(
        Object.fromEntries(
          Object.entries(row).filter(([key]) => requestedColumns.has(key)),
        ),
      );
    });
  }

  return rows.slice(0, input.limit ?? rows.length);
}

function buildWidgetPreviewDependencyGraph(
  localTimeSerieId: number,
  direction: "downstream" | "upstream",
): LocalTimeSerieDependencyGraphResponse {
  const rootId = `lts-${localTimeSerieId}`;
  const upstreamNodes: LocalTimeSerieDependencyGraphNode[] = [
    {
      id: "bucket-us-rates",
      parent: "group-ingestion",
      depth: 0,
      card_title: "Rates Raw Bucket",
      card_subtitle: "Shared storage",
      color: "#0f766e",
      background_color: "#0f766e",
      badges: ["raw", "ok"],
      properties: {
        update_hash: "rates-raw-bucket",
        remote_table_id: 540,
        local_time_serie_id: 0,
        last_update: buildWidgetPreviewIsoTimestamp(-5 * 60 * 1000),
      },
    },
    {
      id: "parser-us-rates",
      parent: "group-ingestion",
      depth: 1,
      card_title: "Curve Parser",
      card_subtitle: "Normalization stage",
      color: "#2563eb",
      background_color: "#2563eb",
      badges: ["parser", "ok"],
      properties: {
        update_hash: "curve-parser",
        remote_table_id: 614,
        local_time_serie_id: 0,
        last_update: buildWidgetPreviewIsoTimestamp(-3 * 60 * 1000),
      },
    },
    {
      id: rootId,
      parent: "group-curation",
      depth: 2,
      card_title: "UST Curve Node",
      card_subtitle: direction === "upstream" ? "Current target" : "Source node",
      color: "#f59e0b",
      background_color: "#f59e0b",
      badges: ["widget", "active"],
      properties: {
        update_hash: `local-update-${localTimeSerieId}`,
        local_time_serie_id: localTimeSerieId,
        remote_table_id: 716,
        last_update: buildWidgetPreviewIsoTimestamp(-90 * 1000),
        next_update: buildWidgetPreviewIsoTimestamp(10 * 60 * 1000),
      },
    },
  ];
  const downstreamNodes: LocalTimeSerieDependencyGraphNode[] = [
    {
      id: rootId,
      parent: "group-curation",
      depth: 0,
      card_title: "UST Curve Node",
      card_subtitle: direction === "downstream" ? "Current source" : "Resolved dependency",
      color: "#f59e0b",
      background_color: "#f59e0b",
      badges: ["widget", "active"],
      properties: {
        update_hash: `local-update-${localTimeSerieId}`,
        local_time_serie_id: localTimeSerieId,
        remote_table_id: 716,
        last_update: buildWidgetPreviewIsoTimestamp(-90 * 1000),
        next_update: buildWidgetPreviewIsoTimestamp(10 * 60 * 1000),
      },
    },
    {
      id: "desk-curve-signal",
      parent: "group-desk",
      depth: 1,
      card_title: "Desk Curve Signal",
      card_subtitle: "Signal transform",
      color: "#8b5cf6",
      background_color: "#8b5cf6",
      badges: ["signal", "ok"],
      properties: {
        update_hash: "desk-curve-signal",
        local_time_serie_id: 903,
        remote_table_id: 812,
        last_update: buildWidgetPreviewIsoTimestamp(-60 * 1000),
      },
    },
    {
      id: "risk-summary-curve",
      parent: "group-desk",
      depth: 2,
      card_title: "Risk Summary",
      card_subtitle: "Dashboard aggregate",
      color: "#dc2626",
      background_color: "#dc2626",
      badges: ["aggregate", "warn"],
      properties: {
        update_hash: "risk-summary-curve",
        local_time_serie_id: 1182,
        remote_table_id: 915,
        last_update: buildWidgetPreviewIsoTimestamp(-30 * 1000),
        error_on_last_update: false,
      },
    },
  ];
  const nodes = direction === "upstream" ? upstreamNodes : downstreamNodes;

  return {
    nodes,
    edges:
      direction === "upstream"
        ? [
            { source: "parser-us-rates", target: "bucket-us-rates" },
            { source: rootId, target: "parser-us-rates" },
          ]
        : [
            { source: "desk-curve-signal", target: rootId },
            { source: "risk-summary-curve", target: "desk-curve-signal" },
          ],
    groups: [
      {
        data: {
          id: "group-ingestion",
          name: "Ingestion",
        },
      },
      {
        data: {
          id: "group-curation",
          name: "Curated node",
        },
      },
      {
        data: {
          id: "group-desk",
          name: "Desk outputs",
        },
      },
    ],
  };
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
  id: number | string;
  type: string;
  title: string;
}

export interface SummaryBadge {
  key: string;
  label: string;
  tone: string;
  link_url?: string | null;
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
  value: unknown;
  kind: string;
  meta?: string;
  icon?: string;
  image?: string;
  image_alt?: string;
  tone?: string;
  info?: string;
  link_url?: string | null;
  href?: string;
  edit?: SummaryEditConfig;
}

export interface SummaryStat {
  key: string;
  label: string;
  display: string;
  value: unknown;
  kind: string;
  info?: string;
  link_url?: string | null;
  edit?: SummaryEditConfig;
}

export interface SummaryLabelManagement {
  labels: string[];
  add_label_url: string | null;
  remove_label_url: string | null;
}

const EMPTY_SUMMARY_LABELS: string[] = [];

export interface ResourceUsageChartPoint {
  time: number;
  cpu_cores: number;
  memory_gib: number;
  disk_gib: number;
}

export interface SummaryResponse<
  TExtensions extends SummaryExtensions = MainSequenceSummaryExtensions,
> {
  entity: SummaryEntity;
  badges: SummaryBadge[];
  inline_fields: SummaryField[];
  highlight_fields: SummaryField[];
  label_management?: SummaryLabelManagement;
  // Legacy summary payload fields kept for compatibility while all summary
  // endpoints migrate to `label_management`.
  labels?: string[];
  labelable?: boolean;
  stats: SummaryStat[];
  extensions?: TExtensions;
  summary_warning?: string | null;
}

export type EntitySummaryHeader = SummaryResponse;
export type ProjectSummaryHeader = SummaryResponse;
export type DataNodeSummaryHeader = SummaryResponse;
export type LocalTimeSerieSummaryHeader = SummaryResponse;
export interface ProjectInfraGraphGroup {
  data: {
    id: string;
    name: string;
  };
}

export interface ProjectInfraGraphNodeLinks {
  detail_url?: string | null;
  summary_url?: string | null;
  graph_url?: string | null;
}

export interface ProjectInfraGraphNodeProperties extends Record<string, unknown> {
  links?: ProjectInfraGraphNodeLinks;
}

export interface ProjectInfraGraphNode {
  id: string;
  node_type: string;
  depth: number;
  card_title: string;
  card_subtitle: string | null;
  parent: string | null;
  detail_url: string | null;
  summary_url: string | null;
  graph_url: string | null;
  icon: string | null;
  color: string | null;
  background_color: string | null;
  badges: string[];
  properties: ProjectInfraGraphNodeProperties;
}

export interface ProjectInfraGraphEdge {
  source: string;
  target: string;
  kind: string;
  properties: Record<string, unknown>;
}

export interface ProjectInfraGraphResponse {
  nodes: ProjectInfraGraphNode[];
  edges: ProjectInfraGraphEdge[];
  groups: ProjectInfraGraphGroup[];
}
export interface ResourceReleaseSummaryExtensions extends MainSequenceSummaryExtensions {
  readme?: ResourceReleaseReadmeSummary;
}
export type ResourceReleaseSummaryResponse = SummaryResponse<ResourceReleaseSummaryExtensions>;
export type TargetPortfolioSummaryResponse = SummaryResponse<TargetPortfolioSummaryExtensions>;

export interface ProjectRepositoryBrowserResponse {
  project_uid: string;
  current_path: string;
  has_repository: boolean;
  message: string;
  breadcrumbs: ProjectRepositoryBreadcrumb[];
  folders: ProjectRepositoryFolder[];
  files: ProjectRepositoryFile[];
}

export interface ProjectResourceCodeResponse {
  project_uid: string;
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
  projectUid: string,
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
    project_uid: projectUid,
    path: readLooseObjectStringField(trimmed, "path") ?? path,
    name: readLooseObjectStringField(trimmed, "name") ?? fallbackName,
    language: readLooseObjectStringField(trimmed, "language") ?? null,
    content,
  };
}

export interface ProjectImageOption {
  id: number;
  uid: string;
  title?: string | null;
  project_repo_hash: string | null;
  related_project: string;
  related_project_uid?: string | null;
  base_image: ProjectBaseImageOption | null;
  is_ready: boolean;
  build_error?: boolean | null;
  creation_date?: string | null;
  creation_date_display?: string | null;
  tags?: string[] | null;
}

export interface CreateProjectImageInput {
  related_project: string;
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
  project_uid: string;
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
  uid: string;
  subdomain: string;
  resource: number;
  readme_resource: number | null;
  related_job: number;
  release_kind: string;
}

export interface ResourceReleaseGalleryRecord {
  id: number;
  uid: string;
  subdomain: string;
  release_kind: string;
  title: string;
  resource_uid: string;
  resource_name: string;
  project_uid: string;
  project_name: string;
  image_uid: string | null;
  project_repo_hash: string | null;
  public_url: string | null;
  exchange_launch_url?: string | null;
}

export interface ResourceReleaseExchangeLaunchUrlResponse {
  release_kind: string;
  mode: "url";
  url: string;
}

export interface ResourceReleaseExchangeLaunchTokenResponse {
  release_kind: string;
  mode: "token";
  token: string;
  rpc_url: string;
}

export type ResourceReleaseExchangeLaunchResponse =
  | ResourceReleaseExchangeLaunchUrlResponse
  | ResourceReleaseExchangeLaunchTokenResponse;

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
  uid: string;
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
  resource: string;
  related_image: string;
  release_kind?: string;
  cpu_request?: string;
  memory_request?: string;
  gpu_request?: string;
  gpu_type?: string;
  spot?: boolean;
}

export interface CreateProjectExecutorAgentServiceInput {
  project: string;
  project_related_image: string;
  cpu_request?: string;
  memory_request?: string;
  gpu_request?: string;
  gpu_type?: string;
  spot?: boolean;
}

export interface BillingEstimateResources {
  cpu: number;
  memory: number;
  gpu_request: number;
  gpu_type: string | null;
  spot: boolean;
}

export interface BillingEstimateInput {
  source: "job-run" | "autopilot";
  source_details?: {
    cluster_id?: number | null;
    resources: BillingEstimateResources;
  };
}

export interface BillingEstimateResponse {
  total_estimate: number | string;
  rates: {
    cpu?: number | string | null;
    mem?: number | string | null;
    gpu?: number | string | null;
    storage?: number | string | null;
  };
  details?: {
    units?: string | null;
  };
}

export interface ProjectExecutorAgentServiceRecord {
  id?: number;
  uid?: string;
  automatic_deployment?: boolean;
  agent_uid?: string | null;
  cpu_request?: string | null;
  cpu_limit?: string | null;
  memory_request?: string | null;
  memory_limit?: string | null;
  spot?: boolean | null;
  project?: string;
  project_uid?: string;
  llm_provider?: string | null;
  llm_model?: string | null;
  llm_thinking?: string | null;
  project_related_image?: string;
  project_related_image_uid?: string;
  runtime_image?: string;
  runtime_image_uid?: string;
  image_ready?: boolean;
  created_service?: boolean;
  created_backing_job?: boolean;
  runtime_access?: ProjectExecutorRuntimeAccess | null;
  image_building?: boolean;
  detail?: string;
  image?: string;
  image_uid?: string;
  image_status?: string | null;
  build_status?: string | null;
  log_url?: string | null;
  [key: string]: unknown;
}

export interface ProjectExecutorRuntimeAccess {
  coding_agent_service_id?: string | null;
  coding_agent_id?: string | null;
  mode?: string | null;
  rpc_url?: string | null;
  token?: string | null;
}

export interface ProjectExecutorAgentServiceSummary {
  id?: number;
  uid: string;
  agent_uid?: string | null;
  automatic_deployment?: boolean;
  cpu_request?: string | null;
  cpu_limit?: string | null;
  memory_request?: string | null;
  memory_limit?: string | null;
  spot?: boolean | null;
  is_ready: boolean;
  executor_bundle_image_has_drift?: boolean;
  image_drift?: unknown;
  project?: number | string | null;
  project_uid?: string | null;
  runtime_image?: string | null;
  runtime_image_uid?: string | null;
  related_job?: number | string | null;
  related_job_uid?: string | null;
  subdomain: string | null;
}

export type ProjectExecutorAutomaticDeploymentRunStatus =
  | "pending"
  | "running"
  | "waiting_sdk_update"
  | "waiting_project_image"
  | "waiting_executor_image"
  | "no_action"
  | "deployed"
  | "skipped"
  | "blocked"
  | "failed";

export type ProjectExecutorAutomaticDeploymentRunStep =
  | "resolve_eligibility"
  | "create_project_image"
  | "wait_project_image"
  | "create_executor_image"
  | "wait_executor_image"
  | "resolve_configuration"
  | "deploy_service"
  | "cleanup_previous_images"
  | "complete";

export interface ProjectExecutorAutomaticDeploymentRun {
  uid: string;
  agent_uid?: string | null;
  agent?: string | Record<string, unknown> | null;
  status: ProjectExecutorAutomaticDeploymentRunStatus | string;
  current_step?: ProjectExecutorAutomaticDeploymentRunStep | string | null;
  automatic_deployment_source?: "manual" | "repository_event" | string | null;
  revision_context?: Record<string, unknown> | null;
  trigger_context?: Record<string, unknown> | null;
  image_artifact_context?: Record<string, unknown> | null;
  cleanup_context?: Record<string, unknown> | null;
  attempts?: number | string | null;
  result?: Record<string, unknown> | null;
  error_code?: string | null;
  error_detail?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export type ProjectExecutorAgentServiceDeployStatus =
  | "deployed"
  | "waiting_sdk_update"
  | "waiting_project_image"
  | "waiting_executor_image"
  | "blocked"
  | "failed"
  | "no_action"
  | "running";

export interface ProjectExecutorAgentServiceDeployResponse {
  uid: string;
  status: ProjectExecutorAgentServiceDeployStatus | string;
  current_step?: string | null;
  result?: {
    service_uid?: string | null;
    runtime_ready?: boolean | null;
    [key: string]: unknown;
  } | null;
  error_code?: string | null;
  error_detail?: string | null;
  [key: string]: unknown;
}

export interface ProjectExecutorAgentServiceMaintenanceResult {
  service_uid: string;
  project_uid: string;
  task_performed: boolean;
  maintenance_state: string;
  runtime_image_uid: string | null;
  previous_runtime_image_uid: string | null;
  replacement_runtime_image_uid: string | null;
  image_building: boolean;
  image_status: string | null;
  build_status: string | null;
  detail: string | null;
  runtime_access?: ProjectExecutorRuntimeAccess | null;
}

export interface AvailableGpuTypeOption {
  value: string;
  label: string;
}

export interface JobRecord {
  id: number;
  uid: string;
  name: string;
  project: number;
  project_uid?: string | null;
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
  uid: string;
  name: string;
  unique_identifier: string;
  job: number;
  job_name: string;
  command_args: string[];
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
  uid?: string | null;
  job: number;
  job_uid?: string | null;
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
  event?: string | null;
  filename?: string | null;
  lineno?: number | null;
  func_name?: string | null;
  durationMs?: number | null;
  status?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  context?: Record<string, unknown> | null;
  children?: JobRunLogEntry[] | null;
  [key: string]: unknown;
}

export interface ProjectBaseImageOption {
  id: number;
  uid: string;
  latest_digest: string;
  description: string;
  title: string;
}

export interface GithubOrganizationOption {
  uid: string;
  login: string;
  display_name: string;
}

export interface CreateProjectInput {
  project_name: string;
  data_source_uid?: string;
  default_base_image?: string;
  github_organization?: string;
}

export interface UpdateProjectSettingsInput {
  projectUid: string;
  defaultDataSourceUid?: string | null;
  defaultBaseImageUid?: string | null;
}

export interface ProjectUpdateSdkResponse {
  message: string;
  job_run_uid: string;
}

export interface CreateJobInput {
  name: string;
  project: string;
  execution_path: string;
  cpu_request: string | number;
  memory_request: string | number;
  max_runtime_seconds: number;
  related_image?: string;
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
  categoryUid?: string;
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

export interface PortfolioGroupListFilters {
  search?: string;
  uniqueIdentifier?: string;
  displayName?: string;
  limit?: number;
  offset?: number;
}

export interface VirtualFundListFilters {
  search?: string;
  accountUid?: string;
  portfolioUid?: string;
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

export type ShareableAccessLevel = "view" | "edit";
export type ShareablePrincipalType = "user" | "team";
export type ShareableObjectId = number | string;

export interface UpdateShareablePermissionInput {
  objectUrl: string;
  objectId: ShareableObjectId;
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

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function readUrlOrigin(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function joinUrlPath(...parts: string[]) {
  const normalized = parts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");

  return normalized ? `/${normalized}/` : "/";
}

function buildMainSequenceAssetsRoot(debugMainSequenceRoot: string) {
  const trimmed = debugMainSequenceRoot.trim();

  if (!trimmed) {
    return defaultMainSequenceAssetsRoot;
  }

  try {
    const url = new URL(trimmed);
    const normalizedAssetsPath = defaultMainSequenceAssetsRoot.replace(/^\/+|\/+$/g, "");
    const currentPath = url.pathname.replace(/\/+$/, "");
    const nextPath = currentPath.endsWith(`/${normalizedAssetsPath}`)
      ? joinUrlPath(currentPath)
      : joinUrlPath(currentPath, normalizedAssetsPath);

    url.pathname = nextPath;
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return defaultMainSequenceAssetsRoot;
  }
}

function buildMainSequenceAssetEndpoint(path: string) {
  return `${mainSequenceAssetsRoot.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function getDevLoopbackProxyPrefix(root: URL) {
  if (!import.meta.env.DEV || !isLoopbackHostname(root.hostname)) {
    return null;
  }

  if (debugMainSequenceOrigin && root.origin === debugMainSequenceOrigin) {
    return devMainSequenceMarketsProxyPrefix;
  }

  return devAuthProxyPrefix;
}

function buildEndpointUrl(
  endpoint: string,
  path = "",
  search?: Record<string, QueryValue>,
) {
  const root = new URL(endpoint, env.apiBaseUrl);
  const requestUrl = new URL(path.replace(/^\/+/, ""), root);

  Object.entries(search ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    requestUrl.searchParams.set(key, String(value));
  });

  const proxyPrefix = getDevLoopbackProxyPrefix(root);

  if (proxyPrefix) {
    return `${proxyPrefix}${requestUrl.pathname}${requestUrl.search}`;
  }

  return requestUrl.toString();
}

function normalizeListResponse<T>(
  payload:
    | PaginatedResponse<T>
    | FrontendRowsResponse<T>
    | T[]
    | {
        rows?: T[];
        results?: T[];
        items?: T[];
        data?: T[];
      },
) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if ("results" in payload && Array.isArray(payload.results)) {
    return payload.results;
  }

  if ("rows" in payload && Array.isArray(payload.rows)) {
    return payload.rows;
  }

  if ("items" in payload && Array.isArray(payload.items)) {
    return payload.items;
  }

  if ("data" in payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

function normalizeOffsetPaginatedResponse<T>(
  payload: PaginatedResponse<T> | T[],
  limit: number,
  offset: number,
): OffsetPaginatedList<T> {
  if (Array.isArray(payload)) {
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.max(1, limit);
    const pagedResults = payload.slice(safeOffset, safeOffset + safeLimit);

    return {
      count: payload.length,
      next:
        safeOffset + safeLimit < payload.length
          ? `offset=${safeOffset + safeLimit}&limit=${safeLimit}`
          : null,
      previous:
        safeOffset > 0
          ? `offset=${Math.max(0, safeOffset - safeLimit)}&limit=${safeLimit}`
          : null,
      limit,
      offset,
      results: pagedResults,
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
    const rows = payload.rows;
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.max(1, limit);
    const hasBackendPagination = "pagination" in payload && Boolean(payload.pagination);

    return {
      search:
        "search" in payload && typeof payload.search === "string"
          ? payload.search
          : search?.trim() || "",
      rows: hasBackendPagination ? rows : rows.slice(safeOffset, safeOffset + safeLimit),
      pagination: hasBackendPagination
        ? payload.pagination
        : buildFrontendListPagination(rows.length, limit, offset),
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
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, limit);

  return {
    search: search?.trim() || "",
    rows: rows.slice(safeOffset, safeOffset + safeLimit),
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

function joinPermissionObjectPath(objectUrl: string, objectId: ShareableObjectId, suffix: string) {
  const normalizedObjectUrl = objectUrl.replace(/\/+$/, "");
  const normalizedObjectId = String(objectId).trim();
  const normalizedSuffix = suffix.replace(/^\/+/, "");

  return `${normalizedObjectUrl}/${normalizedObjectId}/${normalizedSuffix}`;
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

    const flattenedMessages = flattenErrorMessages(record).filter(Boolean);

    if (flattenedMessages.length > 0) {
      return flattenedMessages.join(" ");
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
  traceMeta?: DashboardRequestTraceMeta,
) {
  const requestUrl = buildEndpointUrl(endpoint, path, search);

  if (env.useMockData) {
    const { getMainSequenceMockResponse } = await import("./mockData");
    const mockPayload = getMainSequenceMockResponse<T>({
      requestUrl,
      init,
    });

    if (mockPayload !== undefined) {
      return mockPayload;
    }

    throw new MainSequenceApiError(
      `Main Sequence mock data is missing for ${(init?.method ?? "GET").toUpperCase()} ${requestUrl}.`,
      404,
      {
        endpoint,
        path,
        search,
      },
    );
  }

  const marketsConnectionRequest = buildMainSequenceMarketsConnectionRequest({
    baseUrl: env.apiBaseUrl,
    endpoint,
    path,
    init,
    search,
  });

  if (marketsConnectionRequest) {
    try {
      return await requestMainSequenceMarketsConnectionJson<T>(marketsConnectionRequest, {
        traceMeta,
        signal: init?.signal ?? undefined,
      });
    } catch (error) {
      if (error instanceof MainSequenceMarketsConnectionTransportError) {
        throw new MainSequenceApiError(error.message, error.status, error.details);
      }

      throw error;
    }
  }

  async function sendRequest() {
    const session = useAuthStore.getState().session;
    const headers = new Headers(init?.headers);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    applySessionAuthHeaders(headers, session);

    return fetch(requestUrl, {
      ...init,
      headers,
    });
  }

  let response: Response;
  const requestTrace = startDashboardRequestTrace(traceMeta, {
    method: init?.method,
    url: requestUrl,
  });

  try {
    response = await sendRequest();
  } catch (error) {
    requestTrace?.fail(
      error instanceof Error
        ? error.message
        : "The browser could not reach the Main Sequence API.",
    );
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
  requestTrace?.finish({
    status: response.status,
    ok: response.ok,
    error:
      response.ok
        ? undefined
        : readMessageFromPayload(payload) || `Main Sequence API request failed with ${response.status}.`,
  });

  if (!response.ok) {
    throw new MainSequenceApiError(
      readMessageFromPayload(payload) || `Main Sequence API request failed with ${response.status}.`,
      response.status,
      payload,
    );
  }

  return payload as T;
}

function buildAssetCategorySearchFilterValue(categoryUid?: string) {
  const normalized = categoryUid?.trim();
  return normalized || undefined;
}

function buildAssetCategoryBodyFilterValue(categoryUid?: string) {
  const normalized = categoryUid?.trim();
  return normalized || undefined;
}

function buildAssetListSearch(filters: AssetListFilters, includeResponseFormat = true) {
  return {
    ...(includeResponseFormat ? { response_format: "frontend_list" } : {}),
    search: filters.search?.trim() || undefined,
    limit: filters.limit,
    offset: filters.offset,
    categories__uid: buildAssetCategorySearchFilterValue(filters.categoryUid),
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
    categories__uid: buildAssetCategoryBodyFilterValue(filters.categoryUid),
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

function buildPortfolioGroupListSearch(filters: PortfolioGroupListFilters) {
  return {
    response_format: "frontend_list",
    search: filters.search?.trim() || undefined,
    unique_identifier: filters.uniqueIdentifier?.trim() || undefined,
    display_name: filters.displayName?.trim() || undefined,
    limit: filters.limit,
    offset: filters.offset,
  } satisfies Record<string, QueryValue>;
}

function buildTargetPortfolioListSearch(filters: TargetPortfolioListFilters) {
  return {
    response_format: "frontend_list",
    search: filters.search?.trim() || undefined,
    limit: filters.limit,
    offset: filters.offset,
  } satisfies Record<string, QueryValue>;
}

export async function listProjects({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
  search,
}: {
  limit?: number;
  offset?: number;
  search?: string;
} = {}) {
  const payload = await requestJson<PaginatedResponse<ProjectSummary> | ProjectSummary[]>(
    commandCenterConfig.mainSequence.endpoint,
    "projects/",
    undefined,
    {
      limit,
      offset,
      include: "created_by",
      search: search?.trim() || undefined,
    },
  );

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export async function quickSearchProjects({
  limit = 50,
  q,
}: {
  limit?: number;
  q: string;
}) {
  const payload = await requestJson<ProjectQuickSearchRecord[]>(
    commandCenterConfig.mainSequence.endpoint,
    "projects/quick-search/",
    undefined,
    {
      limit,
      q: q.trim(),
    },
  );

  return Array.isArray(payload) ? payload : [];
}

export async function listAssets({
  search,
  page = 1,
  pageSize = mainSequenceRegistryPageSize,
  limit = pageSize,
  offset = (page - 1) * pageSize,
  categoryUid,
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
    categoryUid,
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

export interface IndexListRow {
  uid: string;
  unique_identifier: string;
  display_name: string;
  description: string | null;
  provider: string | null;
}

export interface IndexDetailResponse extends IndexListRow {
  metadata_json: Record<string, unknown> | null;
}

export interface IndexListFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

function buildIndexListSearch({ search, limit, offset }: Pick<IndexListFilters, "search" | "limit" | "offset">) {
  return {
    response_format: "frontend_list",
    search: search?.trim() || "",
    limit: String(limit ?? mainSequenceRegistryPageSize),
    offset: String(offset ?? 0),
  };
}

export async function listIndices({
  search,
  page = 1,
  pageSize = mainSequenceRegistryPageSize,
  limit = pageSize,
  offset = (page - 1) * pageSize,
}: IndexListFilters = {}) {
  const payload = await requestJson<PaginatedResponse<IndexListRow> | IndexListRow[]>(
    indexEndpoint,
    "",
    undefined,
    buildIndexListSearch({ search, limit, offset }),
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function bulkDeleteAssets(input: AssetBulkDeleteInput) {
  return requestJson<AssetBulkDeleteResponse>(
    assetEndpoint,
    "bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        uids: input.uids,
      }),
    },
  );
}

function buildCalendarListSearch({
  search,
  limit = mainSequenceRegistryPageSize,
  offset = 0,
  uniqueIdentifier,
  uniqueIdentifierContains,
  calendarType,
  source,
  sourceIdentifier,
}: CalendarListFilters = {}) {
  return {
    response_format: "frontend_list",
    search: search?.trim() || undefined,
    limit,
    offset,
    unique_identifier: uniqueIdentifier?.trim() || undefined,
    unique_identifier_contains: uniqueIdentifierContains?.trim() || undefined,
    calendar_type: calendarType?.trim() || undefined,
    source: source?.trim() || undefined,
    source_identifier: sourceIdentifier?.trim() || undefined,
  } satisfies Record<string, QueryValue>;
}

export async function listCalendars(filters: CalendarListFilters = {}) {
  const limit = filters.limit ?? mainSequenceRegistryPageSize;
  const offset = filters.offset ?? 0;
  const payload = await requestJson<PaginatedResponse<CalendarRecord> | CalendarRecord[]>(
    calendarEndpoint,
    "",
    undefined,
    buildCalendarListSearch({ ...filters, limit, offset }),
  );

  if (Array.isArray(payload)) {
    return {
      count: offset + payload.length,
      next: payload.length >= limit ? `offset=${offset + limit}&limit=${limit}` : null,
      previous: offset > 0 ? `offset=${Math.max(0, offset - limit)}&limit=${limit}` : null,
      limit,
      offset,
      results: payload,
    } satisfies OffsetPaginatedList<CalendarRecord>;
  }

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function fetchCalendarDetail(calendarUid: string) {
  return requestJson<CalendarRecord>(
    calendarEndpoint,
    `${resolveMainSequenceUidPath(calendarUid, "calendar")}/`,
    undefined,
    { response_format: "frontend_detail" },
  );
}

export function fetchCalendarSummary(calendarUid: string) {
  return requestJson<SummaryResponse>(
    calendarEndpoint,
    `${resolveMainSequenceUidPath(calendarUid, "calendar")}/summary/`,
  );
}

function buildCalendarDateListSearch({
  startDate,
  endDate,
  isBusinessDay,
  isHoliday,
  isWeekend,
  isEarlyClose,
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: CalendarDateListFilters = {}) {
  return {
    start_date: startDate?.trim() || undefined,
    end_date: endDate?.trim() || undefined,
    is_business_day: isBusinessDay,
    is_holiday: isHoliday,
    is_weekend: isWeekend,
    is_early_close: isEarlyClose,
    limit,
    offset,
  } satisfies Record<string, QueryValue>;
}

function normalizeRelationshipUrl(relationshipUrl: string | null | undefined) {
  const normalized = relationshipUrl?.trim();

  if (!normalized) {
    return null;
  }

  return /^https?:\/\//.test(normalized) || normalized.startsWith("/") ? normalized : null;
}

function requestMainSequenceAssetRelationshipList<TRecord>(
  relationshipUrl: string,
  search: Record<string, QueryValue>,
) {
  if (relationshipUrl.startsWith("/api/v1/")) {
    return requestJson<PaginatedResponse<TRecord> | TRecord[]>(
      mainSequenceAssetsRoot,
      relationshipUrl.slice("/api/v1/".length),
      undefined,
      search,
    );
  }

  return requestJson<PaginatedResponse<TRecord> | TRecord[]>(
    relationshipUrl,
    "",
    undefined,
    search,
  );
}

async function requestCalendarRelationshipList<TRecord>(
  calendarUid: string,
  fallbackPath: "dates" | "sessions" | "events",
  relationshipUrl: string | null | undefined,
  search: Record<string, QueryValue>,
) {
  const normalizedRelationshipUrl = normalizeRelationshipUrl(relationshipUrl);

  if (normalizedRelationshipUrl) {
    const payload = await requestMainSequenceAssetRelationshipList<TRecord>(
      normalizedRelationshipUrl,
      search,
    );

    return normalizeListResponse(payload);
  }

  const payload = await requestJson<PaginatedResponse<TRecord> | TRecord[]>(
    calendarEndpoint,
    `${resolveMainSequenceUidPath(calendarUid, "calendar")}/${fallbackPath}/`,
    undefined,
    search,
  );

  return normalizeListResponse(payload);
}

export function listCalendarDates(
  calendarUid: string,
  filters: CalendarDateListFilters = {},
  relationshipUrl?: string | null,
) {
  return requestCalendarRelationshipList<CalendarDateRecord>(
    calendarUid,
    "dates",
    relationshipUrl,
    buildCalendarDateListSearch(filters),
  );
}

function buildCalendarSessionListSearch({
  startDate,
  endDate,
  sessionLabel,
  isPrimary,
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: CalendarSessionListFilters = {}) {
  return {
    start_date: startDate?.trim() || undefined,
    end_date: endDate?.trim() || undefined,
    session_label: sessionLabel?.trim() || undefined,
    is_primary: isPrimary,
    limit,
    offset,
  } satisfies Record<string, QueryValue>;
}

export function listCalendarSessions(
  calendarUid: string,
  filters: CalendarSessionListFilters = {},
  relationshipUrl?: string | null,
) {
  return requestCalendarRelationshipList<CalendarSessionRecord>(
    calendarUid,
    "sessions",
    relationshipUrl,
    buildCalendarSessionListSearch(filters),
  );
}

function buildCalendarEventListSearch({
  startDate,
  endDate,
  eventType,
  eventLabel,
  targetType,
  targetUid,
  targetIdentifier,
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: CalendarEventListFilters = {}) {
  return {
    start_date: startDate?.trim() || undefined,
    end_date: endDate?.trim() || undefined,
    event_type: eventType?.trim() || undefined,
    event_label: eventLabel?.trim() || undefined,
    target_type: targetType?.trim() || undefined,
    target_uid: targetUid?.trim() || undefined,
    target_identifier: targetIdentifier?.trim() || undefined,
    limit,
    offset,
  } satisfies Record<string, QueryValue>;
}

export function listCalendarEvents(
  calendarUid: string,
  filters: CalendarEventListFilters = {},
  relationshipUrl?: string | null,
) {
  return requestCalendarRelationshipList<CalendarEventRecord>(
    calendarUid,
    "events",
    relationshipUrl,
    buildCalendarEventListSearch(filters),
  );
}

export function fetchPricingMarketDataApiCard() {
  return requestJson<PricingMarketDataApiCard>(pricingMarketDataEndpoint);
}

export function fetchMarketsSettings() {
  return requestJson<MarketsSettingsResponse>(marketsSettingsEndpoint);
}

function buildPricingCurveSearch({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
  search,
  curveType,
  indexUid,
  source,
}: PricingCurveFilters = {}) {
  return {
    limit,
    offset,
    search: search?.trim() || undefined,
    curve_type: curveType?.trim() || undefined,
    index_uid: indexUid?.trim() || undefined,
    source: source?.trim() || undefined,
  } satisfies Record<string, QueryValue>;
}

export async function listPricingCurves(filters: PricingCurveFilters = {}) {
  const limit = filters.limit ?? mainSequenceRegistryPageSize;
  const offset = filters.offset ?? 0;
  const payload = await requestJson<PaginatedResponse<PricingCurveRow>>(
    pricingCurvesEndpoint,
    "",
    undefined,
    buildPricingCurveSearch({ ...filters, limit, offset }),
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function fetchPricingCurveSummary(curveUid: string) {
  return requestJson<EntitySummaryHeader>(
    pricingCurvesEndpoint,
    `${resolveMainSequenceUidPath(curveUid, "pricing curve")}/summary/`,
  );
}

export function fetchPricingCurveDiscountCurve(
  curveUid: string,
  filters: PricingCurveDiscountCurveFilters,
) {
  return requestJson<PricingCurveDiscountCurveResponse>(
    pricingCurvesEndpoint,
    `${resolveMainSequenceUidPath(curveUid, "pricing curve")}/discount-curve/`,
    undefined,
    {
      market_data_set: filters.marketDataSet.trim(),
      valuation_date: filters.valuationDate?.trim() || undefined,
    },
  );
}

function buildPricingMarketDataSetSearch({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
  status,
  setKey,
}: PricingMarketDataSetFilters = {}) {
  return {
    limit,
    offset,
    status: status?.trim() || undefined,
    set_key: setKey?.trim() || undefined,
  } satisfies Record<string, QueryValue>;
}

export async function listPricingMarketDataSets(
  filters: PricingMarketDataSetFilters = {},
) {
  const limit = filters.limit ?? mainSequenceRegistryPageSize;
  const offset = filters.offset ?? 0;
  const payload = await requestJson<PaginatedResponse<PricingMarketDataSet>>(
    pricingMarketDataEndpoint,
    "sets/",
    undefined,
    buildPricingMarketDataSetSearch({ ...filters, limit, offset }),
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function fetchPricingMarketDataSet(setUid: string) {
  return requestJson<PricingMarketDataSet>(
    pricingMarketDataEndpoint,
    `sets/${resolveMainSequenceUidPath(setUid, "pricing market data set")}/`,
  );
}

export function fetchPricingMarketDataSetByKey(setKey: string) {
  const normalizedSetKey = setKey.trim();

  if (!normalizedSetKey) {
    throw new Error("Missing pricing market data set key.");
  }

  return requestJson<PricingMarketDataSet>(
    pricingMarketDataEndpoint,
    `sets/by-key/${encodePathSegment(normalizedSetKey)}/`,
  );
}

export function createPricingMarketDataSet(input: PricingMarketDataSetInput) {
  return requestJson<PricingMarketDataSet>(pricingMarketDataEndpoint, "sets/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function upsertPricingMarketDataSet(input: PricingMarketDataSetInput) {
  return requestJson<PricingMarketDataSet>(pricingMarketDataEndpoint, "sets/upsert/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePricingMarketDataSet(
  setUid: string,
  input: PricingMarketDataSetUpdateInput,
) {
  return requestJson<PricingMarketDataSet>(
    pricingMarketDataEndpoint,
    `sets/${resolveMainSequenceUidPath(setUid, "pricing market data set")}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deletePricingMarketDataSet(setUid: string) {
  return requestJson<PricingMarketDataDeleteResponse>(
    pricingMarketDataEndpoint,
    `sets/${resolveMainSequenceUidPath(setUid, "pricing market data set")}/`,
    {
      method: "DELETE",
    },
  );
}

function buildPricingMarketDataBindingSearch({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
  marketDataSetUid,
  conceptKey,
}: PricingMarketDataBindingFilters = {}) {
  return {
    limit,
    offset,
    market_data_set_uid: marketDataSetUid?.trim() || undefined,
    concept_key: conceptKey?.trim() || undefined,
  } satisfies Record<string, QueryValue>;
}

export async function listPricingMarketDataBindings(
  filters: PricingMarketDataBindingFilters = {},
) {
  const limit = filters.limit ?? mainSequenceRegistryPageSize;
  const offset = filters.offset ?? 0;
  const payload = await requestJson<PaginatedResponse<PricingMarketDataSetBinding>>(
    pricingMarketDataEndpoint,
    "bindings/",
    undefined,
    buildPricingMarketDataBindingSearch({ ...filters, limit, offset }),
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

function buildPricingMarketDataSetBindingSearch({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: PricingMarketDataSetBindingFilters = {}) {
  return {
    limit,
    offset,
  } satisfies Record<string, QueryValue>;
}

export async function listPricingMarketDataSetBindings(
  marketDataSetUid: string,
  filters: PricingMarketDataSetBindingFilters = {},
) {
  const limit = filters.limit ?? mainSequenceRegistryPageSize;
  const offset = filters.offset ?? 0;
  const payload = await requestJson<PaginatedResponse<PricingMarketDataSetBinding>>(
    pricingMarketDataEndpoint,
    `sets/${resolveMainSequenceUidPath(marketDataSetUid, "pricing market data set")}/bindings/`,
    undefined,
    buildPricingMarketDataSetBindingSearch({ limit, offset }),
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function fetchPricingMarketDataBinding(bindingUid: string) {
  return requestJson<PricingMarketDataSetBinding>(
    pricingMarketDataEndpoint,
    `bindings/${resolveMainSequenceUidPath(bindingUid, "pricing market data binding")}/`,
  );
}

export function resolvePricingMarketDataBinding({
  conceptKey,
  marketDataSet,
}: PricingMarketDataBindingResolveFilters) {
  const normalizedConceptKey = conceptKey.trim();

  if (!normalizedConceptKey) {
    throw new Error("Missing pricing market data concept key.");
  }

  return requestJson<PricingMarketDataBindingResolveResponse>(
    pricingMarketDataEndpoint,
    "bindings/resolve/",
    undefined,
    {
      concept_key: normalizedConceptKey,
      market_data_set: marketDataSet?.trim() || undefined,
    },
  );
}

export function createPricingMarketDataBinding(input: PricingMarketDataBindingInput) {
  return requestJson<PricingMarketDataSetBinding>(pricingMarketDataEndpoint, "bindings/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function upsertPricingMarketDataBinding(input: PricingMarketDataBindingInput) {
  return requestJson<PricingMarketDataSetBinding>(pricingMarketDataEndpoint, "bindings/upsert/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePricingMarketDataBinding(
  bindingUid: string,
  input: PricingMarketDataBindingUpdateInput,
) {
  return requestJson<PricingMarketDataSetBinding>(
    pricingMarketDataEndpoint,
    `bindings/${resolveMainSequenceUidPath(bindingUid, "pricing market data binding")}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deletePricingMarketDataBinding(bindingUid: string) {
  return requestJson<PricingMarketDataDeleteResponse>(
    pricingMarketDataEndpoint,
    `bindings/${resolveMainSequenceUidPath(bindingUid, "pricing market data binding")}/`,
    {
      method: "DELETE",
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

export function fetchAssetCategoryDetail(assetCategoryUid: string) {
  return requestJson<AssetCategoryDetailResponse>(
    assetCategoryEndpoint,
    `${resolveMainSequenceUidPath(assetCategoryUid, "asset category")}/`,
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

export function updateAssetCategory(assetCategoryUid: string, input: UpdateAssetCategoryInput) {
  return requestJson<AssetCategoryRecord>(
    assetCategoryEndpoint,
    `${resolveMainSequenceUidPath(assetCategoryUid, "asset category")}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteAssetCategory(assetCategoryUid: string) {
  return requestJson<Record<string, unknown> | null>(
    assetCategoryEndpoint,
    `${resolveMainSequenceUidPath(assetCategoryUid, "asset category")}/`,
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
        uids: input.uids,
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

export async function listVirtualFunds({
  search,
  accountUid,
  portfolioUid,
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
      account_uid: accountUid,
      portfolio_uid: portfolioUid,
      limit,
      offset,
    },
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function fetchVirtualFundDetail(fundUid: string) {
  return requestJson<VirtualFundDetailResponse>(
    virtualFundEndpoint,
    `${resolveMainSequenceUidPath(fundUid, "virtual fund")}/`,
  );
}

export function fetchVirtualFundSummary(fundUid: string) {
  return requestJson<VirtualFundSummaryResponse>(
    virtualFundEndpoint,
    `${resolveMainSequenceUidPath(fundUid, "virtual fund")}/summary/`,
  );
}

export function createVirtualFund(input: CreateVirtualFundInput) {
  return requestJson<VirtualFundRecord>(virtualFundEndpoint, "", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateVirtualFund(
  fundUid: string,
  input: UpdateVirtualFundInput,
) {
  return requestJson<VirtualFundRecord>(
    virtualFundEndpoint,
    `${encodePathSegment(fundUid)}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function listManagedAccounts({
  search,
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: ManagedAccountListFilters = {}) {
  const payload = await requestJson<PaginatedResponse<ManagedAccountListRow> | ManagedAccountListRow[]>(
    managedAccountEndpoint,
    "",
    undefined,
    {
      search,
      limit,
      offset,
    },
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function fetchManagedAccountDetail(managedAccountUid: string) {
  return requestJson<ManagedAccountRecord>(
    managedAccountEndpoint,
    `${encodePathSegment(managedAccountUid)}/`,
  );
}

export function fetchManagedAccountSummary(managedAccountUid: string) {
  return requestJson<ManagedAccountSummaryResponse>(
    managedAccountEndpoint,
    `${encodePathSegment(managedAccountUid)}/summary/`,
  );
}

export function deleteManagedAccount(managedAccountUid: string) {
  return requestJson<Record<string, unknown> | null>(
    managedAccountEndpoint,
    `${encodePathSegment(managedAccountUid)}/`,
    {
      method: "DELETE",
    },
  );
}

export async function listManagedAccountTargetAllocationTargets({
  search,
  targetType = "all",
  limit = 25,
  offset = 0,
}: ManagedAccountTargetAllocationTargetFilters = {}) {
  const payload = await requestJson<
    | PaginatedResponse<ManagedAccountTargetAllocationTargetRow>
    | ManagedAccountTargetAllocationTargetRow[]
  >(
    managedAccountEndpoint,
    "target-allocation/targets/",
    undefined,
    {
      search,
      target_type: targetType,
      limit,
      offset,
    },
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function fetchCurrentInstrumentsConfiguration() {
  return requestJson<InstrumentsConfigurationCurrentResponse>(
    instrumentsConfigurationEndpoint,
    "current/",
  );
}

export function updateCurrentInstrumentsConfiguration({
  discountCurvesStorageNode,
  referenceRatesFixingsStorageNode,
}: {
  discountCurvesStorageNode: string | null;
  referenceRatesFixingsStorageNode: string | null;
}) {
  return requestJson<InstrumentsConfigurationCurrentResponse>(
    instrumentsConfigurationEndpoint,
    "current/",
    {
      method: "PATCH",
      body: JSON.stringify({
        discount_curves_storage_node: discountCurvesStorageNode,
        reference_rates_fixings_storage_node: referenceRatesFixingsStorageNode,
      }),
    },
  );
}

export async function listPortfolioGroups({
  search,
  uniqueIdentifier,
  displayName,
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: PortfolioGroupListFilters = {}) {
  const filters = {
    search,
    uniqueIdentifier,
    displayName,
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
        uids: input.uids,
        unique_identifiers: input.unique_identifiers,
      }),
    },
  );
}

export function createPortfolioGroup(input: CreatePortfolioGroupInput) {
  return requestJson<PortfolioGroupRecord>(portfolioGroupEndpoint, "", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePortfolioGroup(portfolioGroupUid: string, input: UpdatePortfolioGroupInput) {
  return requestJson<PortfolioGroupRecord>(
    portfolioGroupEndpoint,
    `${resolveMainSequenceUidPath(portfolioGroupUid, "portfolio group")}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function fetchPortfolioGroupDetail(portfolioGroupUid: string) {
  return requestJson<PortfolioGroupRecord>(
    portfolioGroupEndpoint,
    `${resolveMainSequenceUidPath(portfolioGroupUid, "portfolio group")}/`,
  );
}

export function deletePortfolioGroup(portfolioGroupUid: string) {
  return requestJson<PortfolioGroupBulkDeleteResponse>(
    portfolioGroupEndpoint,
    `${resolveMainSequenceUidPath(portfolioGroupUid, "portfolio group")}/`,
    {
      method: "DELETE",
    },
  );
}

export function addPortfolioGroupPortfolio(
  portfolioGroupUid: string,
  input: PortfolioGroupPortfolioMutationInput,
) {
  return requestJson<PortfolioGroupMembershipRecord>(
    portfolioGroupEndpoint,
    `${resolveMainSequenceUidPath(portfolioGroupUid, "portfolio group")}/portfolios/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function listPortfolioGroupPortfolios(
  portfolioGroupUid: string,
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  } = {},
) {
  const payload = await requestJson<
    PaginatedResponse<PortfolioGroupPortfolioListRow> | PortfolioGroupPortfolioListRow[]
  >(
    portfolioGroupEndpoint,
    `${resolveMainSequenceUidPath(portfolioGroupUid, "portfolio group")}/portfolios/`,
    undefined,
    {
      limit,
      offset,
    },
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export async function listPortfolioGroupsByPortfolio(
  portfolioUid: string,
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  } = {},
) {
  const payload = await requestJson<
    PaginatedResponse<PortfolioGroupListRow> | PortfolioGroupListRow[]
  >(
    portfolioGroupEndpoint,
    `by-portfolio/${resolveMainSequenceUidPath(portfolioUid, "portfolio")}/`,
    undefined,
    {
      limit,
      offset,
    },
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function removePortfolioGroupPortfolio(
  portfolioGroupUid: string,
  portfolioUid: string,
) {
  return requestJson<PortfolioGroupBulkDeleteResponse>(
    portfolioGroupEndpoint,
    `${resolveMainSequenceUidPath(portfolioGroupUid, "portfolio group")}/portfolios/${resolveMainSequenceUidPath(portfolioUid, "portfolio")}/`,
    {
      method: "DELETE",
    },
  );
}

export function bulkDeletePortfolioGroupMemberships(
  input: PortfolioGroupMembershipBulkDeleteInput,
) {
  return requestJson<PortfolioGroupBulkDeleteResponse>(
    portfolioGroupEndpoint,
    "membership/bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify(input),
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
      search: normalizedSearch,
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
        uids: input.uids,
      }),
    },
  );
}

export function fetchTargetPortfolioDetail(targetPortfolioUid: string) {
  return requestJson<TargetPortfolioDetailResponse>(
    targetPortfolioEndpoint,
    `${resolveMainSequenceUidPath(targetPortfolioUid, "portfolio")}/`,
  );
}

export function fetchTargetPortfolioSummary(targetPortfolioUid: string) {
  return requestJson<TargetPortfolioSummaryResponse>(
    targetPortfolioEndpoint,
    `${resolveMainSequenceUidPath(targetPortfolioUid, "portfolio")}/summary/`,
  );
}

export function deleteTargetPortfolioWeights(
  targetPortfolioUid: string,
  input: TargetPortfolioWeightsDeleteInput = {},
) {
  const weightsDate = input.weightsDate?.trim();

  return requestJson<TargetPortfolioWeightsDeleteResponse>(
    targetPortfolioEndpoint,
    `${resolveMainSequenceUidPath(targetPortfolioUid, "portfolio")}/weights/`,
    {
      method: "DELETE",
    },
    {
      weights_date: weightsDate || undefined,
    },
  );
}

function buildTargetPortfolioTabularFrameSearch({
  endDate,
  limit = 100,
  order = "desc",
  startDate,
}: TargetPortfolioTabularFrameFilters = {}) {
  return {
    start_date: startDate?.trim() || undefined,
    end_date: endDate?.trim() || undefined,
    order,
    limit,
  };
}

export function fetchTargetPortfolioSignalWeights(
  targetPortfolioUid: string,
  filters: TargetPortfolioTabularFrameFilters = {},
) {
  return requestJson<unknown>(
    targetPortfolioEndpoint,
    `${resolveMainSequenceUidPath(targetPortfolioUid, "portfolio")}/signals_weights/`,
    undefined,
    buildTargetPortfolioTabularFrameSearch(filters),
  );
}

export function fetchTargetPortfolioValues(
  targetPortfolioUid: string,
  filters: TargetPortfolioTabularFrameFilters = {},
) {
  return requestJson<unknown>(
    targetPortfolioEndpoint,
    `${resolveMainSequenceUidPath(targetPortfolioUid, "portfolio")}/portfolio_values/`,
    undefined,
    buildTargetPortfolioTabularFrameSearch(filters),
  );
}

function buildPortfolioSignalListSearch({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
  search,
  signalUid,
}: PortfolioSignalListFilters = {}) {
  return {
    search: search?.trim() || undefined,
    signal_uid: signalUid?.trim() || undefined,
    limit,
    offset,
  };
}

export async function listPortfolioSignals({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
  search,
  signalUid,
}: PortfolioSignalListFilters = {}) {
  const payload = await requestJson<
    PaginatedResponse<PortfolioSignalRecord> | PortfolioSignalRecord[]
  >(
    portfolioSignalEndpoint,
    "",
    undefined,
    buildPortfolioSignalListSearch({
      limit,
      offset,
      search,
      signalUid,
    }),
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export function fetchPortfolioSignal(signalMetadataUid: string) {
  return requestJson<PortfolioSignalRecord>(
    portfolioSignalEndpoint,
    `${resolveMainSequenceUidPath(signalMetadataUid, "portfolio signal")}/`,
  );
}

export function createPortfolioSignal(input: CreatePortfolioSignalInput) {
  return requestJson<PortfolioSignalRecord>(portfolioSignalEndpoint, "", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePortfolioSignal(
  signalMetadataUid: string,
  input: UpdatePortfolioSignalInput,
) {
  return requestJson<PortfolioSignalRecord>(
    portfolioSignalEndpoint,
    `${resolveMainSequenceUidPath(signalMetadataUid, "portfolio signal")}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deletePortfolioSignalWeights(
  signalMetadataUid: string,
  input: PortfolioSignalWeightsDeleteInput = {},
) {
  const weightsDate = input.weightsDate?.trim();

  return requestJson<PortfolioSignalWeightsDeleteResponse>(
    portfolioSignalEndpoint,
    `${resolveMainSequenceUidPath(signalMetadataUid, "portfolio signal")}/weights/`,
    {
      method: "DELETE",
    },
    {
      weights_date: weightsDate || undefined,
    },
  );
}

export function deletePortfolioSignal(signalMetadataUid: string) {
  return requestJson<PortfolioSignalDeleteResponse>(
    portfolioSignalEndpoint,
    `${resolveMainSequenceUidPath(signalMetadataUid, "portfolio signal")}/`,
    {
      method: "DELETE",
    },
  );
}

function readPortfolioString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeTargetPortfolioWeightsResponse(
  value: unknown,
): TargetPortfolioWeightsResponse {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  return {
    ...record,
    portfolio_uid: readPortfolioString(record.portfolio_uid),
    portfolio_unique_identifier: readPortfolioString(record.portfolio_unique_identifier),
    portfolio_index_uid: readPortfolioString(record.portfolio_index_uid),
    portfolio_index_identifier: readPortfolioString(record.portfolio_index_identifier),
    weights_date: readPortfolioString(record.weights_date),
    resolution_warning: readPortfolioString(record.resolution_warning),
    weights: Array.isArray(record.weights)
      ? record.weights.filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
        )
      : [],
  };
}

function adaptTargetPortfolioWeightsResponseToPositionDetails(
  snapshot: TargetPortfolioWeightsResponse,
): PositionDetailResponse {
  const rows = snapshot.weights.map((weightRow) => {
    const asset =
      weightRow.asset && typeof weightRow.asset === "object" && !Array.isArray(weightRow.asset)
        ? (weightRow.asset as Record<string, unknown>)
        : null;
    const currentSnapshot =
      asset?.current_snapshot &&
      typeof asset.current_snapshot === "object" &&
      !Array.isArray(asset.current_snapshot)
        ? (asset.current_snapshot as Record<string, unknown>)
        : null;
    const uniqueIdentifier =
      readPortfolioString(weightRow.asset_identifier) ??
      readPortfolioString(asset?.unique_identifier);
    const weight = weightRow.weight ?? null;

    return {
      time_index: weightRow.time_index ?? snapshot.weights_date,
      portfolio_index_identifier:
        weightRow.portfolio_index_identifier ?? snapshot.portfolio_index_identifier,
      asset_identifier: uniqueIdentifier,
      asset_uid: readPortfolioString(asset?.uid),
      asset_name: readPortfolioString(currentSnapshot?.name) ?? uniqueIdentifier,
      asset_ticker: readPortfolioString(currentSnapshot?.ticker),
      unique_identifier: uniqueIdentifier,
      figi: uniqueIdentifier,
      position_type: "weight_notional_exposure",
      position_value: weight,
      weight_notional_exposure: weight,
      weight,
      weight_before: weightRow.weight_before ?? null,
      price_current: weightRow.price_current ?? null,
      price_before: weightRow.price_before ?? null,
      volume_current: weightRow.volume_current ?? null,
      volume_before: weightRow.volume_before ?? null,
      asset,
    };
  });
  const positionMap = rows.reduce<Record<string, unknown>>((map, row) => {
    const key = readPortfolioString(row.unique_identifier) ?? readPortfolioString(row.asset_uid);

    if (key) {
      map[key] = row;
    }

    return map;
  }, {});

  return {
    weights: rows,
    position_columns: [],
    rows,
    columnDefs: [
      { field: "asset_name", headerName: "Asset" },
      { field: "asset_ticker", headerName: "Ticker" },
      { field: "position_type", headerName: "Position Type" },
      { field: "position_value", headerName: "Position Value" },
    ],
    summaryColumnDefs: [],
    position_map: positionMap,
    weights_date: snapshot.weights_date,
    resolution_warning: snapshot.resolution_warning,
  };
}

export function fetchTargetPositionDetailPositionDetails(
  targetPortfolioUid: string,
  traceMeta?: DashboardRequestTraceMeta,
) {
  if (isWidgetPreviewMode()) {
    return Promise.resolve(buildWidgetPreviewPositionDetailResponse(0));
  }

  return requestJson<TargetPortfolioWeightsResponse>(
    targetPortfolioEndpoint,
    `${resolveMainSequenceUidPath(targetPortfolioUid, "portfolio")}/weights/`,
    undefined,
    {
      order: "desc",
      limit: "1",
      include_asset_detail: "true",
    },
    traceMeta,
  ).then((payload) =>
    adaptTargetPortfolioWeightsResponseToPositionDetails(
      normalizeTargetPortfolioWeightsResponse(payload),
    ),
  );
}

export function fetchTargetPortfolioWeightsPositionDetails(
  targetPortfolioUid: string,
  traceMeta?: DashboardRequestTraceMeta,
) {
  return fetchTargetPositionDetailPositionDetails(targetPortfolioUid, traceMeta);
}

function readVirtualFundDirection(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 0 ? -1 : 1;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed < 0 ? -1 : 1;
    }
  }

  return null;
}

function applyVirtualFundHoldingDirection(
  quantity: unknown,
  direction: number | null,
) {
  if (typeof quantity !== "string" && typeof quantity !== "number") {
    return null;
  }

  const parsedQuantity = Number(quantity);

  if (!Number.isFinite(parsedQuantity)) {
    return quantity;
  }

  const normalizedDirection = direction !== null && direction < 0 ? -1 : 1;
  return Math.abs(parsedQuantity) * normalizedDirection;
}

function normalizeVirtualFundHoldingsResponse(value: unknown): VirtualFundHoldingsResponse {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  return {
    ...record,
    virtual_fund_uid: readPortfolioString(record.virtual_fund_uid),
    virtual_fund_unique_identifier: readPortfolioString(record.virtual_fund_unique_identifier),
    holdings_set_uid: readPortfolioString(record.holdings_set_uid),
    source_account_holdings_set_uid: readPortfolioString(record.source_account_holdings_set_uid),
    holdings_date: readPortfolioString(record.holdings_date),
    holdings: Array.isArray(record.holdings)
      ? record.holdings.filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
        )
      : [],
  };
}

function adaptVirtualFundHoldingsResponseToPositionDetails(
  snapshot: VirtualFundHoldingsResponse,
): PositionDetailResponse {
  if (snapshot.holdings.length === 0) {
    return buildEmptyPositionDetailResponse(snapshot.holdings_date);
  }

  const rows = snapshot.holdings.map((holding) => {
    const asset =
      holding.asset && typeof holding.asset === "object" && !Array.isArray(holding.asset)
        ? (holding.asset as Record<string, unknown>)
        : null;
    const currentSnapshot =
      asset?.current_snapshot &&
      typeof asset.current_snapshot === "object" &&
      !Array.isArray(asset.current_snapshot)
        ? (asset.current_snapshot as Record<string, unknown>)
        : null;
    const assetIdentifier =
      readPortfolioString(holding.asset_identifier) ??
      readPortfolioString(asset?.asset_identifier) ??
      readPortfolioString(asset?.unique_identifier);
    const direction = readVirtualFundDirection(holding.direction);
    const signedQuantity =
      holding.signed_quantity ??
      applyVirtualFundHoldingDirection(holding.quantity, direction);

    return {
      time_index: holding.time_index ?? snapshot.holdings_date,
      asset_identifier: assetIdentifier,
      virtual_fund_uid: snapshot.virtual_fund_uid,
      virtual_fund_unique_identifier: snapshot.virtual_fund_unique_identifier,
      virtual_fund_holdings_set_uid:
        readPortfolioString(holding.virtual_fund_holdings_set_uid) ?? snapshot.holdings_set_uid,
      source_account_holdings_set_uid:
        readPortfolioString(holding.source_account_holdings_set_uid) ??
        snapshot.source_account_holdings_set_uid,
      asset_uid: readPortfolioString(asset?.uid),
      asset_name: readPortfolioString(currentSnapshot?.name) ?? assetIdentifier,
      asset_ticker: readPortfolioString(currentSnapshot?.ticker),
      unique_identifier: assetIdentifier,
      figi: assetIdentifier,
      position_type: readPortfolioString(holding.position_type) ?? "units",
      position_value: signedQuantity,
      quantity: holding.quantity ?? signedQuantity,
      direction,
      signed_quantity: signedQuantity,
      target_trade_time: holding.target_trade_time ?? null,
      extra_details:
        holding.extra_details &&
        typeof holding.extra_details === "object" &&
        !Array.isArray(holding.extra_details)
          ? holding.extra_details
          : {},
      ...(asset ? { asset } : {}),
    };
  });
  const positionMap = rows.reduce<Record<string, unknown>>((map, row) => {
    const key =
      readPortfolioString(row.unique_identifier) ??
      readPortfolioString(row.asset_uid) ??
      readPortfolioString(row.asset_identifier);

    if (key) {
      map[key] = row;
    }

    return map;
  }, {});

  return {
    weights: {
      virtual_fund_uid: snapshot.virtual_fund_uid,
      virtual_fund_unique_identifier: snapshot.virtual_fund_unique_identifier,
      holdings_set_uid: snapshot.holdings_set_uid,
      source_account_holdings_set_uid: snapshot.source_account_holdings_set_uid,
    },
    position_columns: [],
    rows,
    columnDefs: [
      { field: "asset_name", headerName: "Asset" },
      { field: "asset_ticker", headerName: "Ticker" },
      { field: "position_value", headerName: "Quantity" },
    ],
    summaryColumnDefs: [],
    position_map: positionMap,
    weights_date: snapshot.holdings_date,
  };
}

export async function fetchVirtualFundHoldingsPositionDetails(
  fundUid: string,
  options: {
    holdingsDate?: string;
    traceMeta?: DashboardRequestTraceMeta;
  } = {},
) {
  if (isWidgetPreviewMode()) {
    return adaptVirtualFundHoldingsResponseToPositionDetails(
      normalizeVirtualFundHoldingsResponse({
        virtual_fund_uid: fundUid,
        virtual_fund_unique_identifier: "preview-virtual-fund",
        holdings_set_uid: "preview-virtual-fund-holdings",
        source_account_holdings_set_uid: "preview-account-holdings",
        holdings_date: buildWidgetPreviewIsoTimestamp(),
        holdings: [
          {
            time_index: buildWidgetPreviewIsoTimestamp(),
            asset_identifier: "btc_spot",
            virtual_fund_holdings_set_uid: "preview-virtual-fund-holdings",
            source_account_holdings_set_uid: "preview-account-holdings",
            quantity: "5.0",
            direction: -1,
            signed_quantity: "-5.0",
            target_trade_time: null,
            extra_details: {},
            asset: {
              uid: "preview-asset-btc",
              asset_identifier: "btc_spot",
              current_snapshot: {
                name: "Bitcoin spot",
                ticker: "BTC",
              },
            },
          },
        ],
      }),
    );
  }

  const payload = await requestJson<VirtualFundHoldingsResponse | Record<string, unknown>>(
    virtualFundEndpoint,
    `${resolveMainSequenceUidPath(fundUid, "virtual fund")}/holdings/`,
    undefined,
    {
      ...(options.holdingsDate
        ? {
            holdings_date: options.holdingsDate,
            limit: "1",
          }
        : {
            order: "desc",
            limit: "1",
          }),
      include_asset_detail: "true",
    },
    options.traceMeta,
  );

  return adaptVirtualFundHoldingsResponseToPositionDetails(
    normalizeVirtualFundHoldingsResponse(payload),
  );
}

export async function fetchManagedAccountHoldingsPositionDetails(
  accountUid: string,
  options: {
    holdingsDate?: string;
    traceMeta?: DashboardRequestTraceMeta;
  } = {},
) {
  if (isWidgetPreviewMode()) {
    return adaptManagedAccountHoldingsSnapshotToPositionDetails(
      normalizeManagedAccountHoldingsSnapshot({
        holdings_set_uid: "preview-managed-account-holdings",
        holdings_date: buildWidgetPreviewIsoTimestamp(),
        holdings: [
          {
            time_index: buildWidgetPreviewIsoTimestamp(),
            asset_identifier: "btc_spot",
            asset: {
              uid: "preview-asset-btc",
              asset_identifier: "btc_spot",
              current_snapshot: {
                name: "Bitcoin spot",
                ticker: "BTC",
              },
            },
            position_type: "units",
            price: "100.000000000000000000",
            quantity: "12.00000000",
            direction: 1,
            signed_quantity: "12.00000000",
            target_trade_time: buildWidgetPreviewIsoTimestamp(),
            missing_price: false,
            extra_details: {},
          },
        ],
      }),
    );
  }

  const payload = await requestJson<
    ManagedAccountHoldingsSnapshotResponse[] | ManagedAccountHoldingsSnapshotResponse | Record<string, unknown>
  >(
    managedAccountEndpoint,
    `${encodePathSegment(accountUid)}/holdings/`,
    undefined,
    {
      ...(options.holdingsDate
        ? {
            holdings_date: options.holdingsDate,
            limit: "1",
          }
        : {
            order: "desc",
            limit: "1",
          }),
      include_asset_detail: "true",
    },
    options.traceMeta,
  );

  return adaptManagedAccountHoldingsSnapshotToPositionDetails(
    normalizeManagedAccountHoldingsSnapshot(extractFirstCollectionRecord(payload) ?? {}),
  );
}

export async function fetchManagedAccountHoldingsByFundPositionDetails(
  accountUid: string,
  options: {
    order?: "asc" | "desc";
    holdingsDate?: string;
    includeAssetDetail?: boolean;
    traceMeta?: DashboardRequestTraceMeta;
  } = {},
) {
  if (isWidgetPreviewMode()) {
    return adaptManagedAccountHoldingsByFundResponseToPositionDetails(
      normalizeManagedAccountHoldingsByFundResponse({
        account_uid: accountUid,
        source_account_holdings_set_uid: "preview-account-holdings",
        holdings_date: buildWidgetPreviewIsoTimestamp(),
        funds: [
          {
            virtual_fund_uid: "preview-fund-core",
            virtual_fund_unique_identifier: "core-preview-fund",
            target_portfolio_uid: "preview-portfolio-core",
            holdings_set_uid: "preview-fund-holdings",
            holdings: [
              {
                time_index: buildWidgetPreviewIsoTimestamp(),
                asset_identifier: "btc_spot",
                asset: {
                  uid: "preview-asset-btc",
                  asset_identifier: "btc_spot",
                  current_snapshot: {
                    name: "Bitcoin spot",
                    ticker: "BTC",
                  },
                },
                quantity: "8.00000000",
                direction: 1,
                signed_quantity: "8.00000000",
                target_trade_time: null,
                extra_details: {
                  position_set_uid: "preview-target-position-set",
                  target_row_key: "preview-row-btc",
                  target_gap_signed_quantity: "0.0",
                  scale: "1.0",
                },
                allocation: {
                  position_set_uid: "preview-target-position-set",
                  target_row_key: "preview-row-btc",
                  target_gap_signed_quantity: "0.0",
                  scale: "1.0",
                },
              },
            ],
          },
        ],
        residuals: [],
        allocation_warnings: [],
      }),
    );
  }

  const payload = await requestJson<ManagedAccountHoldingsByFundResponse | Record<string, unknown>>(
    managedAccountEndpoint,
    `${encodePathSegment(accountUid)}/holdings/by-fund/`,
    undefined,
    {
      ...(options.holdingsDate
        ? {
            holdings_date: options.holdingsDate,
            limit: "1",
          }
        : {
            order: options.order ?? "desc",
            limit: "1",
          }),
      include_asset_detail: options.includeAssetDetail === false ? "false" : "true",
    },
    options.traceMeta,
  );

  return adaptManagedAccountHoldingsByFundResponseToPositionDetails(
    normalizeManagedAccountHoldingsByFundResponse(payload),
  );
}

export async function saveManagedAccountHoldings(
  accountUid: string,
  input: ManagedAccountHoldingsWriteInput,
) {
  const payload = await requestJson<ManagedAccountHoldingsWriteResponse | Record<string, unknown>>(
    managedAccountEndpoint,
    `${encodePathSegment(accountUid)}/add-holdings/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return adaptManagedAccountHoldingsWriteResponseToPositionDetails(
    normalizeManagedAccountHoldingsWriteResponse(payload),
  );
}

export async function fetchManagedAccountTargetPositionsPositionDetails(
  accountUid: string,
  options: {
    targetPositionsDate?: string;
    traceMeta?: DashboardRequestTraceMeta;
  } = {},
) {
  if (isWidgetPreviewMode()) {
    return adaptManagedAccountTargetPositionsResponseToPositionDetails(
      normalizeManagedAccountTargetPositionsWriteResponse({
        related_account_uid: accountUid,
        target_positions_date: buildWidgetPreviewIsoTimestamp(),
        position_set_uid: "preview-managed-account-target-positions",
        positions: [
          {
            target_type: "asset",
            target_uid: "preview-asset-btc",
            asset_uid: "preview-asset-btc",
            portfolio_uid: null,
            unique_identifier: "btc_spot",
            weight_notional_exposure: "0.550000000000000000",
            constant_notional_exposure: null,
            single_asset_quantity: null,
            asset: {
              uid: "preview-asset-btc",
              unique_identifier: "btc_spot",
              current_snapshot: {
                name: "Bitcoin spot",
                ticker: "BTC",
              },
            },
          },
          {
            target_type: "asset",
            target_uid: "preview-asset-eth",
            asset_uid: "preview-asset-eth",
            portfolio_uid: null,
            unique_identifier: "eth_spot",
            weight_notional_exposure: null,
            constant_notional_exposure: null,
            single_asset_quantity: "3.000000000000000000",
            asset: {
              uid: "preview-asset-eth",
              unique_identifier: "eth_spot",
              current_snapshot: {
                name: "Ethereum spot",
                ticker: "ETH",
              },
            },
          },
        ],
      }),
    );
  }

  const payload = await requestJson<
    ManagedAccountTargetPositionsWriteResponse[] | ManagedAccountTargetPositionsWriteResponse | Record<string, unknown>
  >(
    managedAccountEndpoint,
    `${encodePathSegment(accountUid)}/target-positions/`,
    undefined,
    {
      ...(options.targetPositionsDate
        ? {
            target_positions_date: options.targetPositionsDate,
            limit: "1",
          }
        : {
            order: "desc",
            limit: "1",
          }),
      include_asset_detail: "true",
    },
    options.traceMeta,
  );

  return adaptManagedAccountTargetPositionsResponseToPositionDetails(
    normalizeManagedAccountTargetPositionsWriteResponse(extractFirstCollectionRecord(payload) ?? {}),
  );
}

export async function saveManagedAccountTargetPositions(
  accountUid: string,
  input: ManagedAccountTargetPositionsWriteInput,
) {
  const payload = await requestJson<ManagedAccountTargetPositionsWriteResponse | Record<string, unknown>>(
    managedAccountEndpoint,
    `${encodePathSegment(accountUid)}/add-target-positions/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return adaptManagedAccountTargetPositionsResponseToPositionDetails(
    normalizeManagedAccountTargetPositionsWriteResponse(payload),
  );
}

export function fetchAssetDetail(assetUid: string) {
  return requestJson<AssetDetailResponse>(
    assetEndpoint,
    `${resolveMainSequenceUidPath(assetUid, "asset")}/`,
    undefined,
    { response_format: "frontend_detail" },
  );
}

export function fetchAssetSummary(assetUid: string) {
  return requestJson<EntitySummaryHeader>(
    assetEndpoint,
    `${resolveMainSequenceUidPath(assetUid, "asset")}/summary/`,
  );
}

export function fetchAssetPricingDetails(assetUid: string) {
  return requestJson<AssetPricingDetailsResponse>(
    assetEndpoint,
    `${resolveMainSequenceUidPath(assetUid, "asset")}/get_pricing_details/`,
  );
}

export function fetchIndexDetail(indexUid: string) {
  return requestJson<IndexDetailResponse>(
    indexEndpoint,
    `${resolveMainSequenceUidPath(indexUid, "index")}/`,
  );
}

export function deleteIndex(indexUid: string) {
  return requestJson<null>(
    indexEndpoint,
    `${resolveMainSequenceUidPath(indexUid, "index")}/`,
    { method: "DELETE" },
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

export async function fetchAssetOrderFormFields(assetUid: string, orderType: string) {
  const payload = await requestJson<AssetOrderFormFieldsResponse | AssetOrderFormField[]>(
    assetEndpoint,
    `${resolveMainSequenceUidPath(assetUid, "asset")}/order-form-fields/`,
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
        uids: input.uids,
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

export function fetchProjectDataSourceEditor(projectDataSourceUid: string) {
  return requestJson<ProjectDataSourceEditorPayload>(
    dynamicTableDataSourceEndpoint,
    `${resolveMainSequenceUidPath(projectDataSourceUid, "project data source")}/`,
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
  projectDataSourceUid: string,
  input: Partial<ProjectDataSourceEditorInput>,
) {
  return requestJson<ProjectDataSourceEditorWriteResponse>(
    dynamicTableDataSourceEndpoint,
    `${resolveMainSequenceUidPath(projectDataSourceUid, "project data source")}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    { request_format: "editor" },
  );
}

export function deleteProjectDataSourceEditor(projectDataSourceUid: string) {
  return requestJson<ProjectDataSourceDeleteResponse>(
    dynamicTableDataSourceEndpoint,
    `${resolveMainSequenceUidPath(projectDataSourceUid, "project data source")}/delete/`,
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
    mainSequenceConnectionsEndpoint,
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
    mainSequenceConnectionsEndpoint,
    "data_source/bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        uids: input.uids,
        select_all: input.selectAll ?? false,
        search: input.search?.trim() || undefined,
        class_type: input.classType?.trim() || undefined,
      }),
    },
  );
}

export function fetchPhysicalDataSourceEditorConfig(
  sourceType: "duck_db" | "timescale_db" | "timescale_db_remote",
) {
  return requestJson<PhysicalDataSourceEditorPayload>(
    mainSequenceConnectionsEndpoint,
    "data_source/editor-config/",
    undefined,
    { source_type: sourceType },
  );
}

export function fetchPhysicalDataSourceEditor(physicalDataSourceUid: string) {
  return requestJson<PhysicalDataSourceEditorPayload>(
    mainSequenceConnectionsEndpoint,
    `data_source/${resolveMainSequenceUidPath(physicalDataSourceUid, "physical data source")}/`,
    undefined,
    { response_format: "editor" },
  );
}

export function fetchPhysicalDataSourceSummary(physicalDataSourceUid: string) {
  return requestJson<SummaryResponse>(
    mainSequenceConnectionsEndpoint,
    `data_source/${resolveMainSequenceUidPath(physicalDataSourceUid, "physical data source")}/summary/`,
  );
}

export function fetchPhysicalDataSourceConnections(physicalDataSourceUid: string) {
  return requestJson<PhysicalDataSourceConnectionsResponse>(
    mainSequenceConnectionsEndpoint,
    `data_source/${resolveMainSequenceUidPath(physicalDataSourceUid, "physical data source")}/connections/`,
  );
}

export function createPhysicalDataSourceEditor(input: PhysicalDataSourceEditorCreateInput) {
  return requestJson<PhysicalDataSourceEditorWriteResponse>(
    mainSequenceConnectionsEndpoint,
    "data_source/",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    { request_format: "editor" },
  );
}

export function updatePhysicalDataSourceEditor(
  physicalDataSourceUid: string,
  input: PhysicalDataSourceEditorUpdateInput,
) {
  return requestJson<PhysicalDataSourceEditorWriteResponse>(
    mainSequenceConnectionsEndpoint,
    `data_source/${resolveMainSequenceUidPath(physicalDataSourceUid, "physical data source")}/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    { request_format: "editor" },
  );
}

export function deletePhysicalDataSourceEditor(physicalDataSourceUid: string) {
  return requestJson<PhysicalDataSourceDeleteResponse>(
    mainSequenceConnectionsEndpoint,
    `data_source/${resolveMainSequenceUidPath(physicalDataSourceUid, "physical data source")}/delete/`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function listTimeScaleDBServices({
  page = 1,
  pageSize = mainSequenceRegistryPageSize,
  search,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}) {
  const payload = await requestJson<
    PaginatedResponse<TimeScaleDBServiceRecord> | TimeScaleDBServiceRecord[]
  >(
    mainSequenceConnectionsEndpoint,
    "timescaledb-service/",
    undefined,
    {
      search: search?.trim() || undefined,
      page,
      page_size: pageSize,
    },
  );

  return normalizeOffsetPaginatedResponse(payload, pageSize, (page - 1) * pageSize);
}

export async function listScalableServices({
  page = 1,
  pageSize = mainSequenceRegistryPageSize,
  search,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}) {
  const payload = await requestJson<
    PaginatedResponse<ScalableServiceRecord> | ScalableServiceRecord[]
  >(
    commandCenterConfig.mainSequence.endpoint,
    "scalable-service/",
    undefined,
    {
      search: search?.trim() || undefined,
      page,
      page_size: pageSize,
    },
  );

  return normalizeOffsetPaginatedResponse(payload, pageSize, (page - 1) * pageSize);
}

export function fetchScalableServiceDetail(scalableServiceUid: string) {
  return requestJson<ScalableServiceRecord>(
    commandCenterConfig.mainSequence.endpoint,
    `scalable-service/${resolveMainSequenceUidPath(scalableServiceUid, "scalable service")}/`,
  );
}

export function fetchScalableServiceSummary(scalableServiceUid: string) {
  return requestJson<SummaryResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `scalable-service/${resolveMainSequenceUidPath(scalableServiceUid, "scalable service")}/summary/`,
  );
}

export async function listScalableServicePods(scalableServiceUid: string) {
  const payload = await requestJson<
    PaginatedResponse<ScalableServicePodRow> | ScalableServicePodRow[]
  >(
    commandCenterConfig.mainSequence.endpoint,
    `scalable-service/${resolveMainSequenceUidPath(scalableServiceUid, "scalable service")}/pods/`,
  );

  return normalizeListResponse(payload);
}

export async function listScalableServiceRevisions(scalableServiceUid: string) {
  const payload = await requestJson<
    PaginatedResponse<ScalableServiceRevisionRecord> | ScalableServiceRevisionRecord[]
  >(
    commandCenterConfig.mainSequence.endpoint,
    `scalable-service/${resolveMainSequenceUidPath(scalableServiceUid, "scalable service")}/revisions/`,
  );

  return normalizeListResponse(payload);
}

export function fetchKnativePodRuntimeLogs(knativePodRuntimeUid: string) {
  return requestJson<
    KnativePodRuntimeLogsResponse | JobRunLogEntry[] | { rows?: JobRunLogEntry[]; status?: string }
  >(
    commandCenterConfig.mainSequence.endpoint,
    `knative-pod-runtimes/${resolveMainSequenceUidPath(knativePodRuntimeUid, "knative pod runtime")}/logs/`,
  ).then((payload) => {
    if (Array.isArray(payload)) {
      return {
        pod_runtime_uid: knativePodRuntimeUid,
        status: "",
        rows: payload,
      } satisfies KnativePodRuntimeLogsResponse;
    }

    return {
      pod_runtime_uid: knativePodRuntimeUid,
      status: typeof payload?.status === "string" ? payload.status : "",
      rows: Array.isArray(payload?.rows) ? payload.rows : [],
    } satisfies KnativePodRuntimeLogsResponse;
  });
}

export async function fetchKnativePodRuntimeResourceUsage(knativePodRuntimeUid: string) {
  const payload = await requestJson<unknown>(
    commandCenterConfig.mainSequence.endpoint,
    `knative-pod-runtimes/${resolveMainSequenceUidPath(knativePodRuntimeUid, "knative pod runtime")}/resource-usage/`,
  );

  if (Array.isArray(payload)) {
    return payload as ResourceUsageChartPoint[];
  }

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const candidate = payload as Record<string, unknown>;
    const arrayPayload =
      (Array.isArray(candidate.resource_usage_chart_data)
        ? candidate.resource_usage_chart_data
        : Array.isArray(candidate.results)
          ? candidate.results
          : Array.isArray(candidate.rows)
            ? candidate.rows
            : null) ?? [];

    return arrayPayload as ResourceUsageChartPoint[];
  }

  return [];
}

export function fetchTimeScaleDBServiceDetail(timeScaleDBServiceUid: string) {
  return requestJson<TimeScaleDBServiceRecord>(
    mainSequenceConnectionsEndpoint,
    `timescaledb-service/${resolveMainSequenceUidPath(timeScaleDBServiceUid, "timescaledb service")}/`,
  );
}

export function fetchTimeScaleDBServiceSummary(timeScaleDBServiceUid: string) {
  return requestJson<SummaryResponse>(
    mainSequenceConnectionsEndpoint,
    `timescaledb-service/${resolveMainSequenceUidPath(timeScaleDBServiceUid, "timescaledb service")}/summary/`,
  );
}

export function listTimeScaleDBServiceDataSources(
  timeScaleDBServiceUid: string,
  {
    page = 1,
    pageSize = mainSequenceRegistryPageSize,
    search,
    classType,
  }: {
    page?: number;
    pageSize?: number;
    search?: string;
    classType?: string;
  } = {},
) {
  return requestJson<TimeScaleDBServiceDataSourceListResponse>(
    mainSequenceConnectionsEndpoint,
    `timescaledb-service/${resolveMainSequenceUidPath(timeScaleDBServiceUid, "timescaledb service")}/data-sources/`,
    undefined,
    {
      search: search?.trim() || undefined,
      class_type: classType?.trim() || undefined,
      page,
      page_size: pageSize,
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

export function fetchClusterSummary(
  clusterUid: string,
  {
    namespace,
    nodePool,
  }: {
    namespace?: string;
    nodePool?: string;
  } = {},
) {
  return requestJson<ClusterSummaryResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${resolveMainSequenceUidPath(clusterUid, "cluster")}/summary/`,
    undefined,
    {
      namespace: namespace?.trim() || undefined,
      node_pool: nodePool?.trim() || undefined,
    },
  );
}

export function fetchClusterDetail(clusterUid: string) {
  return fetchClusterSummary(clusterUid);
}

export async function listClusterNodePools(clusterUid: string) {
  const payload = await requestJson<
    PaginatedResponse<ClusterNodePoolRow> | ClusterNodePoolRow[]
  >(commandCenterConfig.mainSequence.endpoint, `cluster/${resolveMainSequenceUidPath(clusterUid, "cluster")}/node-pools/`);

  return normalizeListResponse(payload);
}

export async function listClusterNodes(
  clusterUid: string,
  {
    nodePool,
  }: {
    nodePool?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<ClusterNodeRow> | ClusterNodeRow[]>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${resolveMainSequenceUidPath(clusterUid, "cluster")}/nodes/`,
    undefined,
    {
      node_pool: nodePool?.trim() || undefined,
    },
  );

  return normalizeListResponse(payload);
}

export async function listClusterNamespaces(clusterUid: string) {
  const payload = await requestJson<
    PaginatedResponse<ClusterNamespaceRow> | ClusterNamespaceRow[]
  >(commandCenterConfig.mainSequence.endpoint, `cluster/${resolveMainSequenceUidPath(clusterUid, "cluster")}/namespaces/`);

  return normalizeListResponse(payload);
}

export async function listClusterPods(
  clusterUid: string,
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
    `cluster/${resolveMainSequenceUidPath(clusterUid, "cluster")}/pods/`,
    undefined,
    {
      namespace: namespace?.trim() || undefined,
      node_pool: nodePool?.trim() || undefined,
    },
  );

  return normalizeListResponse(payload);
}

export async function listClusterDeployments(
  clusterUid: string,
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
    `cluster/${resolveMainSequenceUidPath(clusterUid, "cluster")}/deployments/`,
    undefined,
    {
      namespace: namespace?.trim() || undefined,
    },
  );

  return normalizeListResponse(payload);
}

export async function listClusterServices(
  clusterUid: string,
  {
    namespace,
  }: {
    namespace?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<ClusterServiceRow> | ClusterServiceRow[]>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${resolveMainSequenceUidPath(clusterUid, "cluster")}/services/`,
    undefined,
    {
      namespace: namespace?.trim() || undefined,
    },
  );

  return normalizeListResponse(payload);
}

export async function listClusterStorage(
  clusterUid: string,
  {
    namespace,
  }: {
    namespace?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<ClusterStorageRow> | ClusterStorageRow[]>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${resolveMainSequenceUidPath(clusterUid, "cluster")}/storage/`,
    undefined,
    {
      namespace: namespace?.trim() || undefined,
    },
  );

  return normalizeListResponse(payload);
}

export async function listClusterKnative(
  clusterUid: string,
  {
    namespace,
  }: {
    namespace?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<ClusterKnativeRow> | ClusterKnativeRow[]>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${resolveMainSequenceUidPath(clusterUid, "cluster")}/knative/`,
    undefined,
    {
      namespace: namespace?.trim() || undefined,
    },
  );

  return normalizeListResponse(payload);
}

export function scaleCluster(
  clusterUid: string,
  {
    desiredNodeCount,
  }: {
    desiredNodeCount: number;
  },
) {
  return requestJson<ClusterScaleResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `cluster/${resolveMainSequenceUidPath(clusterUid, "cluster")}/scale/`,
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
  search,
}: {
  limit?: number;
  offset?: number;
  search?: string;
} = {}) {
  const payload = await requestJson<PaginatedResponse<ConstantRecord> | ConstantRecord[]>(
    commandCenterConfig.mainSequence.endpoint,
    "constant/",
    undefined,
    {
      limit,
      offset,
      search: search?.trim() || undefined,
    },
  );

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export function fetchConstant(constantUid: string) {
  return requestJson<ConstantRecord>(
    commandCenterConfig.mainSequence.endpoint,
    `constant/${resolveMainSequenceUidPath(constantUid, "constant")}/`,
  );
}

export function createConstant(input: CreateConstantInput) {
  return requestJson<ConstantRecord>(commandCenterConfig.mainSequence.endpoint, "constant/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteConstant(constantUid: string) {
  return requestJson<null>(commandCenterConfig.mainSequence.endpoint, `constant/${resolveMainSequenceUidPath(constantUid, "constant")}/`, {
    method: "DELETE",
  });
}

export function bulkDeleteConstants(uids: string[]) {
  return postMainSequenceBulkDelete("constant/bulk-delete/", uids);
}

export async function listSecrets({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
  search,
}: {
  limit?: number;
  offset?: number;
  search?: string;
} = {}) {
  const payload = await requestJson<PaginatedResponse<SecretRecord> | SecretRecord[]>(
    commandCenterConfig.mainSequence.endpoint,
    "secret/",
    undefined,
    { limit, offset, search: search?.trim() || undefined },
  );

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export async function listProjectSecrets(projectUid: string) {
  const payload = await requestJson<
    PaginatedResponse<ProjectSecretRecord> | ProjectSecretRecord[]
  >(commandCenterConfig.mainSequence.endpoint, "project-secret/", undefined, {
    limit: 200,
    project__uid: projectUid,
  });

  return normalizeListResponse(payload).sort((left, right) => right.id - left.id);
}

export function createProjectSecret(input: CreateProjectSecretInput) {
  return requestJson<ProjectSecretRecord>(commandCenterConfig.mainSequence.endpoint, "project-secret/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteProjectSecret(projectSecretUid: string) {
  return requestJson<null>(
    commandCenterConfig.mainSequence.endpoint,
    `project-secret/${resolveMainSequenceUidPath(projectSecretUid, "project secret")}/`,
    {
      method: "DELETE",
    },
  );
}

export function fetchSecret(secretUid: string) {
  return requestJson<SecretRecord>(
    commandCenterConfig.mainSequence.endpoint,
    `secret/${resolveMainSequenceUidPath(secretUid, "secret")}/`,
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

export function fetchBucketSummary(bucketUid: string) {
  return requestJson<BucketSummaryHeader>(
    commandCenterConfig.mainSequence.endpoint,
    `bucket/${resolveMainSequenceUidPath(bucketUid, "bucket")}/summary/`,
  );
}

export function fetchBucketBrowse(
  bucketUid: string,
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
    `bucket/${resolveMainSequenceUidPath(bucketUid, "bucket")}/browse/`,
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

export function createBucketFolder(bucketUid: string, input: CreateBucketFolderInput) {
  return requestJson<CreateBucketFolderResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `bucket/${resolveMainSequenceUidPath(bucketUid, "bucket")}/create-folder/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function uploadBucketArtifact(bucketUid: string, input: UploadBucketArtifactInput) {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("prefix", input.prefix);
  formData.append("filename", input.filename);

  return requestJson<UploadBucketArtifactResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `bucket/${resolveMainSequenceUidPath(bucketUid, "bucket")}/upload-artifact/`,
    {
      method: "POST",
      body: formData,
    },
  );
}

export function deleteBucket(bucketUid: string) {
  return requestJson<null>(commandCenterConfig.mainSequence.endpoint, `bucket/${resolveMainSequenceUidPath(bucketUid, "bucket")}/`, {
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
        uids: input.uids,
        select_all: input.selectAll ?? false,
        current_url: input.currentUrl,
        search: input.search,
        name: input.name,
        name__in: input.nameIn,
      }),
    },
  );
}

export async function listMetaTables({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
  namespace,
  namespaceUid,
  search,
}: {
  limit?: number;
  offset?: number;
  namespace?: string;
  namespaceUid?: string;
  search?: string;
} = {}) {
  const payload = await requestJson<PaginatedResponse<MetaTableRecord> | MetaTableRecord[]>(
    metaTableEndpoint,
    "",
    undefined,
    {
      limit,
      offset,
      namespace: namespace?.trim() || undefined,
      namespace_uid: namespaceUid?.trim() || undefined,
      search: search?.trim() || undefined,
    },
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export async function listNamespaces() {
  const payload = await requestJson<
    | FrontendRowsResponse<MainSequenceNamespaceRecord>
    | PaginatedResponse<MainSequenceNamespaceRecord>
    | MainSequenceNamespaceRecord[]
  >(namespaceEndpoint, "");

  return normalizeListResponse(payload)
    .map((record) => normalizeMainSequenceNamespaceRecord(record))
    .filter((record): record is MainSequenceNamespaceRecord => record !== null);
}

export function fetchNamespaceDetail(namespaceUid: string) {
  return requestJson<unknown>(
    namespaceEndpoint,
    `${resolveTsManagerPath(namespaceUid)}/`,
  ).then((payload) => normalizeMainSequenceNamespaceDetail(payload));
}

export async function fetchNamespaceTables(namespaceUid: string) {
  const payload = await requestJson<
    PaginatedResponse<MainSequenceNamespaceTableRecord> | MainSequenceNamespaceTableRecord[]
  >(namespaceEndpoint, `${resolveTsManagerPath(namespaceUid)}/tables/`);

  return normalizeListResponse(payload as PaginatedResponse<unknown> | unknown[])
    .map((record) => normalizeMainSequenceNamespaceTableRecord(record))
    .filter((record): record is MainSequenceNamespaceTableRecord => record !== null);
}

export function setNamespacePermissions(namespaceUid: string, assignments: {
  view: { userIds: Array<string | number>; teamIds: Array<string | number> };
  edit: { userIds: Array<string | number>; teamIds: Array<string | number> };
}) {
  return requestJson<Record<string, unknown> | null>(
    namespaceEndpoint,
    `${resolveTsManagerPath(namespaceUid)}/set-permissions/`,
    {
      method: "POST",
      body: JSON.stringify({
        assignments: {
          view: {
            user_ids: assignments.view.userIds,
            team_ids: assignments.view.teamIds,
          },
          edit: {
            user_ids: assignments.edit.userIds,
            team_ids: assignments.edit.teamIds,
          },
        },
      }),
    },
  );
}

export function propagateNamespacePermissions(namespaceUid: string) {
  return requestJson<Record<string, unknown> | null>(
    namespaceEndpoint,
    `${resolveTsManagerPath(namespaceUid)}/propagate-permissions/`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export function bulkDeleteNamespaces(uids: string[]) {
  return postMainSequenceBulkDelete("namespace/bulk-delete/", uids);
}

export async function listMetaTableNamespaces() {
  const payload = await requestJson<
    PaginatedResponse<MainSequenceNamespaceOptionRecord> | MainSequenceNamespaceOptionRecord[] | string[]
  >(metaTableEndpoint, "namespaces/");

  return normalizeNamespaceOptionListResponse(payload);
}

export async function listDataNodeNamespaces() {
  const payload = await requestJson<
    PaginatedResponse<MainSequenceNamespaceOptionRecord> | MainSequenceNamespaceOptionRecord[] | string[]
  >(dynamicTableMetadataEndpoint, "namespaces/");

  return normalizeNamespaceOptionListResponse(payload);
}

export function bulkDeleteMetaTables({
  uids,
}: MetaTableBulkDeleteInput) {
  return requestJson<MetaTableRecord[] | MainSequenceBulkDeleteResponse>(
    metaTableEndpoint,
    "bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({ uids }),
    },
  );
}

export function deleteMetaTable(metaTableIdentifier: TsManagerPathIdentifier) {
  return requestJson<Record<string, unknown> | null>(
    metaTableEndpoint,
    `${resolveTsManagerPath(metaTableIdentifier)}/`,
    {
      method: "DELETE",
    },
  );
}

export function bulkDeleteMetaTablesWithCascade(
  input: MetaTableDeleteWithCascadeInput,
) {
  return requestJson<MetaTableDeleteWithCascadeResponse>(
    metaTableEndpoint,
    "bulk-delete-with-cascade/",
    {
      method: "POST",
      body: JSON.stringify({
        uids: input.uids,
        confirm_cascade_delete: input.confirm_cascade_delete,
        delete_referencing_meta_tables: input.delete_referencing_meta_tables ?? true,
        delete_referencing_dynamic_tables: input.delete_referencing_dynamic_tables ?? true,
        drop_platform_managed_physical_tables:
          input.drop_platform_managed_physical_tables ?? true,
      }),
    },
  );
}

export function bulkRefreshMetaTableSearchIndex(uids: string[]) {
  return requestJson<MetaTableBulkRefreshResponse>(
    metaTableEndpoint,
    "bulk-refresh-table-search-index/",
    {
      method: "POST",
      body: JSON.stringify({ uids }),
    },
  );
}

export function syncMetaTableFromPhysical(metaTableIdentifier: TsManagerPathIdentifier) {
  return requestJson<MetaTableSyncFromPhysicalResponse>(
    metaTableEndpoint,
    `${resolveTsManagerPath(metaTableIdentifier)}/heal-from-physical/`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export function importMetaTablesFromDataSource(
  input: MetaTableImportFromDataSourceInput,
) {
  return requestJson<MetaTableImportFromDataSourceResponse>(
    metaTableEndpoint,
    "import-from-data-source/",
    {
      method: "POST",
      body: JSON.stringify({
        data_source_uid: input.data_source_uid,
        namespace: input.namespace ?? null,
        dry_run: input.dry_run,
        include_views: input.include_views ?? true,
        follow_foreign_keys: input.follow_foreign_keys ?? true,
        refresh_existing: input.refresh_existing ?? true,
        strict: input.strict ?? false,
        identifier_strategy: input.identifier_strategy ?? "none",
        relation_names: input.relation_names ?? [],
        exclude_relation_names: input.exclude_relation_names ?? [],
        stale_policy: input.stale_policy ?? "report_only",
      }),
    },
  ).then((response) => normalizeMetaTableImportFromDataSourceResponse(response));
}

export function fetchMetaTableSummary(metaTableIdentifier: TsManagerPathIdentifier) {
  return requestJson<SummaryResponse>(
    metaTableEndpoint,
    `${resolveTsManagerPath(metaTableIdentifier)}/summary/`,
  );
}

function normalizeGeneratedSearchDocumentPayload(payload: unknown) {
  if (typeof payload === "string") {
    return payload.trim() || null;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.generated_search_document,
    record.search_document,
    record.document,
    record.content,
    record.markdown,
    isObjectRecord(record.extensions) ? record.extensions.generated_search_document : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

export function fetchMetaTableGeneratedSearchDocument(metaTableIdentifier: TsManagerPathIdentifier) {
  return requestJson<unknown>(
    metaTableEndpoint,
    `${resolveTsManagerPath(metaTableIdentifier)}/generated-search-document/`,
  ).then((payload) => normalizeGeneratedSearchDocumentPayload(payload));
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry): entry is string => entry.length > 0)
    : [];
}

function readMetaTableSourceClassName(value: Record<string, unknown>) {
  const directValue = readOptionalString(value.source_class_name)?.trim();

  if (directValue) {
    return directValue;
  }

  if (!isObjectRecord(value.table_contract)) {
    return null;
  }

  const authoring = value.table_contract.authoring;

  if (!isObjectRecord(authoring) || !isObjectRecord(authoring.table_model)) {
    return null;
  }

  const moduleName = readOptionalString(authoring.table_model.module)?.trim();
  const qualname = readOptionalString(authoring.table_model.qualname)?.trim();

  if (moduleName && qualname) {
    return `${moduleName}.${qualname}`;
  }

  return qualname ?? moduleName ?? null;
}

function normalizeMetaTableColumn(value: unknown, index: number): MetaTableColumnRecord | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const name =
    readOptionalString(value.name)?.trim() ?? readOptionalString(value.column_name)?.trim();

  if (!name) {
    return null;
  }

  const label =
    readOptionalString(value.label)?.trim() ??
    readOptionalString(value.logical_name)?.trim() ??
    readOptionalString(value.attr_name)?.trim() ??
    null;
  const logicalName =
    readOptionalString(value.logical_name)?.trim() ??
    readOptionalString(value.attr_name)?.trim() ??
    label;
  const dataType = readOptionalString(value.data_type)?.trim() ?? null;
  const backendType =
    readOptionalString(value.backend_type)?.trim() ??
    readOptionalString(value.db_type)?.trim() ??
    null;

  return {
    id: readFiniteNumber(value.id) ?? index,
    name,
    label,
    logical_name: logicalName,
    data_type: dataType,
    backend_type: backendType,
    nullable: typeof value.nullable === "boolean" ? value.nullable : true,
    primary_key:
      value.primary_key === true || value.is_primary_key === true || value.is_pk === true,
    unique: value.unique === true || value.is_unique === true,
    ordinal_position: readFiniteNumber(value.ordinal_position),
    description: readOptionalString(value.description)?.trim() ?? null,
    contract_fragment: isObjectRecord(value.contract_fragment) ? value.contract_fragment : null,
  };
}

function normalizeMetaTableIndex(value: unknown): MetaTableIndexRecord | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const name = readOptionalString(value.name)?.trim();

  if (!name) {
    return null;
  }

  return {
    name,
    columns: readStringArray(value.columns),
    unique: typeof value.unique === "boolean" ? value.unique : undefined,
    method: readOptionalString(value.method)?.trim() ?? null,
    expression: readOptionalString(value.expression)?.trim() ?? null,
    contract_fragment: isObjectRecord(value.contract_fragment) ? value.contract_fragment : null,
  };
}

function normalizeMetaTableForeignKey(
  value: unknown,
  index: number,
): MetaTableForeignKeyRecord | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const name = readOptionalString(value.name)?.trim() || `fk_${index + 1}`;
  const sourceColumns = readStringArray(value.source_columns);
  const sourceColumn = readOptionalString(value.source_column)?.trim();
  const targetColumns = readStringArray(value.target_columns);
  const targetColumn = readOptionalString(value.target_column)?.trim();

  return {
    id: readFiniteNumber(value.id) ?? index,
    name,
    source_columns:
      sourceColumns.length > 0 ? sourceColumns : sourceColumn ? [sourceColumn] : [],
    target_table_uid:
      readOptionalString(value.target_table_uid)?.trim() ??
      readOptionalString(value.target_meta_table_uid)?.trim() ??
      null,
    target_table_storage_hash:
      readOptionalString(value.target_table_storage_hash)?.trim() ??
      readOptionalString(value.target_table_name)?.trim() ??
      null,
    target_columns:
      targetColumns.length > 0 ? targetColumns : targetColumn ? [targetColumn] : [],
    on_delete: readOptionalString(value.on_delete)?.trim() ?? null,
    contract_fragment: isObjectRecord(value.contract_fragment) ? value.contract_fragment : null,
  };
}

function normalizeMetaTableDetailPayload(payload: unknown): MetaTableDetail {
  if (!isObjectRecord(payload)) {
    throw new MainSequenceApiError(
      "The meta table detail endpoint did not return an object payload.",
      200,
      payload,
    );
  }

  const uid = readOptionalString(payload.uid)?.trim();

  if (!uid) {
    throw new MainSequenceApiError(
      "The meta table detail endpoint did not return a uid.",
      200,
      payload,
    );
  }

  const tableContract = isObjectRecord(payload.table_contract) ? payload.table_contract : undefined;
  const introspectionSnapshot = isObjectRecord(payload.introspection_snapshot)
    ? payload.introspection_snapshot
    : undefined;
  const topLevelColumns = Array.isArray(payload.columns) ? payload.columns : null;
  const contractColumns =
    tableContract && Array.isArray(tableContract.columns) ? tableContract.columns : null;
  const topLevelIndexes = Array.isArray(payload.indexes_meta) ? payload.indexes_meta : null;
  const contractIndexes =
    tableContract && Array.isArray(tableContract.indexes) ? tableContract.indexes : null;
  const introspectionIndexes =
    introspectionSnapshot && Array.isArray(introspectionSnapshot.indexes)
      ? introspectionSnapshot.indexes
      : null;
  const topLevelForeignKeys = Array.isArray(payload.foreign_keys) ? payload.foreign_keys : null;
  const contractForeignKeys =
    tableContract && Array.isArray(tableContract.foreign_keys) ? tableContract.foreign_keys : null;
  const introspectionForeignKeys =
    introspectionSnapshot && Array.isArray(introspectionSnapshot.foreign_keys)
      ? introspectionSnapshot.foreign_keys
      : null;
  const incomingForeignKeys = Array.isArray(payload.incoming_fks) ? payload.incoming_fks : null;

  return {
    ...payload,
    id: readFiniteNumber(payload.id) ?? uid,
    uid,
    storage_hash: readOptionalString(payload.storage_hash)?.trim() ?? undefined,
    creation_date: readOptionalString(payload.creation_date)?.trim() ?? null,
    source_class_name: readMetaTableSourceClassName(payload),
    identifier: readOptionalString(payload.identifier)?.trim() ?? null,
    description: readOptionalString(payload.description)?.trim() ?? null,
    namespace: readOptionalString(payload.namespace)?.trim() ?? null,
    labels: readStringArray(payload.labels),
    management_mode: readOptionalString(payload.management_mode)?.trim() ?? null,
    physical_table_name: readOptionalString(payload.physical_table_name)?.trim() ?? null,
    contract_version: readOptionalString(payload.contract_version)?.trim() ?? null,
    data_frequency_id:
      readOptionalString(payload.data_frequency_id)?.trim() ??
      readFiniteNumber(payload.data_frequency_id) ??
      null,
    data_source: isObjectRecord(payload.data_source)
      ? (payload.data_source as unknown as DynamicTableDataSourceOption)
      : null,
    data_source_uid:
      readOptionalString(payload.data_source_uid)?.trim() ??
      (isObjectRecord(payload.data_source)
        ? readOptionalString(payload.data_source.uid)?.trim() ?? null
        : null),
    protect_from_deletion: payload.protect_from_deletion === true,
    open_for_everyone: payload.open_for_everyone === true,
    table_contract: tableContract,
    introspection_snapshot: introspectionSnapshot,
    columns: (topLevelColumns ?? contractColumns ?? [])
      .map((column, index) => normalizeMetaTableColumn(column, index))
      .filter((column): column is MetaTableColumnRecord => column !== null),
    indexes_meta: (topLevelIndexes ?? contractIndexes ?? introspectionIndexes ?? [])
      .map((index) => normalizeMetaTableIndex(index))
      .filter((index): index is MetaTableIndexRecord => index !== null),
    foreign_keys: (topLevelForeignKeys ?? contractForeignKeys ?? introspectionForeignKeys ?? [])
      .map((foreignKey, index) => normalizeMetaTableForeignKey(foreignKey, index))
      .filter((foreignKey): foreignKey is MetaTableForeignKeyRecord => foreignKey !== null),
    incoming_fks: (incomingForeignKeys ?? [])
      .map((foreignKey, index) => normalizeMetaTableForeignKey(foreignKey, index))
      .filter((foreignKey): foreignKey is MetaTableForeignKeyRecord => foreignKey !== null),
    created_by_user_uid: readOptionalString(payload.created_by_user_uid)?.trim() ?? null,
    organization_owner_uid:
      readOptionalString(payload.organization_owner_uid)?.trim() ?? null,
    sourcetableconfiguration: isObjectRecord(payload.sourcetableconfiguration)
      ? (payload.sourcetableconfiguration as unknown as DataNodeSourceTableConfiguration)
      : null,
  };
}

export function fetchMetaTableDetail(metaTableIdentifier: TsManagerPathIdentifier) {
  return requestJson<unknown>(
    metaTableEndpoint,
    `${resolveTsManagerPath(metaTableIdentifier)}/`,
  ).then((payload) => normalizeMetaTableDetailPayload(payload));
}

function normalizeMainSequenceNamespaceRecord(
  value: unknown,
): MainSequenceNamespaceRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const uid = readOptionalString(record.uid)?.trim() ?? "";
  const name = readOptionalString(record.name)?.trim() ?? "";
  const metaTableCount = readFiniteNumber(record.meta_table_count);
  const dynamicTableMetadataCount = readFiniteNumber(record.dynamic_table_metadata_count);

  if (!uid || !name || metaTableCount === null || dynamicTableMetadataCount === null) {
    return null;
  }

  return {
    uid,
    name,
    description: readOptionalString(record.description)?.trim() ?? null,
    creation_date: readOptionalString(record.creation_date)?.trim() ?? null,
    created_by_user_uid: readOptionalString(record.created_by_user_uid)?.trim() ?? null,
    organization_owner_uid:
      readOptionalString(record.organization_owner_uid)?.trim() ?? null,
    open_for_everyone: record.open_for_everyone === true,
    meta_table_count: metaTableCount,
    dynamic_table_metadata_count: dynamicTableMetadataCount,
  };
}

function normalizeNamespaceOptionRecord(
  value: unknown,
): MainSequenceNamespaceOptionRecord | null {
  if (typeof value === "string") {
    const namespace = value.trim();

    if (!namespace) {
      return null;
    }

    return {
      namespace_uid: namespace,
      namespace,
      display_name: namespace,
      table_count: 0,
      filters: {
        namespace,
        namespace_uid: namespace,
      },
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const namespace = readOptionalString(record.namespace)?.trim() ?? "";
  const namespaceUid = readOptionalString(record.namespace_uid)?.trim() ?? "";
  const displayName =
    readOptionalString(record.display_name)?.trim() ||
    readOptionalString(record.label)?.trim() ||
    namespace;
  const tableCount =
    readFiniteNumber(record.table_count) ??
    readFiniteNumber(record.count) ??
    readFiniteNumber(record.meta_table_count) ??
    readFiniteNumber(record.dynamic_table_count);

  if (!namespace || !namespaceUid || !displayName || tableCount === null) {
    return null;
  }

  const filters =
    record.filters && typeof record.filters === "object" && !Array.isArray(record.filters)
      ? (record.filters as Record<string, unknown>)
      : {};

  return {
    namespace_uid: namespaceUid,
    namespace,
    display_name: displayName,
    table_count: tableCount,
    filters: {
      namespace: readOptionalString(filters.namespace)?.trim() || namespace,
      namespace_uid: readOptionalString(filters.namespace_uid)?.trim() || namespaceUid,
    },
  };
}

function normalizeNamespaceOptionListResponse(
  payload:
    | PaginatedResponse<MainSequenceNamespaceOptionRecord>
    | MainSequenceNamespaceOptionRecord[]
    | string[],
) {
  const rows = normalizeListResponse(payload as PaginatedResponse<unknown> | unknown[]);

  return rows
    .map((record) => normalizeNamespaceOptionRecord(record))
    .filter((record): record is MainSequenceNamespaceOptionRecord => record !== null)
    .sort((left, right) => left.display_name.localeCompare(right.display_name));
}

function normalizeMainSequenceNamespaceDetail(
  value: unknown,
): MainSequenceNamespaceDetail {
  const normalized = normalizeMainSequenceNamespaceRecord(value);

  if (!normalized) {
    throw new Error("The namespace detail endpoint did not return a valid namespace payload.");
  }

  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    ...record,
    ...normalized,
  };
}

function normalizeMainSequenceNamespaceTableKind(value: unknown): MainSequenceNamespaceTableKind {
  const rawValue = readOptionalString(value)?.trim().toLowerCase() ?? "";

  if (
    rawValue === "meta_table" ||
    rawValue === "meta-table" ||
    rawValue === "metatable" ||
    rawValue.includes("meta")
  ) {
    return "meta_table";
  }

  if (
    rawValue === "dynamic_table" ||
    rawValue === "dynamic-table" ||
    rawValue === "dynamic_table_metadata" ||
    rawValue === "dynamictablemetadata" ||
    rawValue === "data_node" ||
    rawValue === "data-node" ||
    rawValue.includes("dynamic") ||
    rawValue.includes("data_node")
  ) {
    return "dynamic_table";
  }

  return "unknown";
}

function normalizeMainSequenceNamespaceTableRecord(
  value: unknown,
): MainSequenceNamespaceTableRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const kind =
    normalizeMainSequenceNamespaceTableKind(record.kind) !== "unknown"
      ? normalizeMainSequenceNamespaceTableKind(record.kind)
      : normalizeMainSequenceNamespaceTableKind(record.table_type) !== "unknown"
        ? normalizeMainSequenceNamespaceTableKind(record.table_type)
        : normalizeMainSequenceNamespaceTableKind(record.object_type) !== "unknown"
          ? normalizeMainSequenceNamespaceTableKind(record.object_type)
          : record.meta_table_uid
            ? "meta_table"
            : record.dynamic_table_uid || record.dynamic_table_metadata_uid
              ? "dynamic_table"
              : "unknown";
  const uid =
    readOptionalString(record.uid)?.trim() ??
    readOptionalString(record.table_uid)?.trim() ??
    readOptionalString(record.meta_table_uid)?.trim() ??
    readOptionalString(record.dynamic_table_uid)?.trim() ??
    readOptionalString(record.dynamic_table_metadata_uid)?.trim() ??
    "";

  if (!uid) {
    return null;
  }

  return {
    uid,
    kind,
    storage_hash:
      readOptionalString(record.storage_hash)?.trim() ??
      readOptionalString(record.physical_table_name)?.trim() ??
      readOptionalString(record.table_name)?.trim() ??
      null,
    identifier:
      readOptionalString(record.identifier)?.trim() ??
      readOptionalString(record.display_name)?.trim() ??
      readOptionalString(record.name)?.trim() ??
      null,
    creation_date: readOptionalString(record.creation_date)?.trim() ?? null,
    namespace: readOptionalString(record.namespace)?.trim() ?? null,
    raw: record,
  };
}

function normalizeColumnarDataSnapshot(payload: unknown): ColumnarDataSnapshot {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      columns: [],
      rows: [],
    };
  }

  const columnEntries = Object.entries(payload).filter(([, value]) => Array.isArray(value));

  if (columnEntries.length === 0) {
    return {
      columns: [],
      rows: [],
    };
  }

  const columns = columnEntries.map(([columnName]) => columnName);
  const rowCount = Math.max(
    0,
    ...columnEntries.map(([, value]) => (Array.isArray(value) ? value.length : 0)),
  );
  const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
    Object.fromEntries(
      columnEntries.map(([columnName, value]) => [
        columnName,
        Array.isArray(value) ? value[rowIndex] ?? null : null,
      ]),
    ),
  ).filter(isDataNodeRemoteDataRow);

  return {
    columns,
    rows,
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeMetaTableSchemaGraphColumn(
  value: unknown,
  index = 0,
): MetaTableSchemaGraphColumnRecord | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const id = readFiniteNumber(value.id) ?? index;
  const columnName =
    readOptionalString(value.column_name)?.trim() ?? readOptionalString(value.name)?.trim();

  if (!columnName) {
    return null;
  }

  return {
    id,
    attr_name:
      readOptionalString(value.attr_name)?.trim() ??
      readOptionalString(value.logical_name)?.trim() ??
      readOptionalString(value.label)?.trim() ??
      columnName,
    column_name: columnName,
    db_type:
      readOptionalString(value.db_type)?.trim() ??
      readOptionalString(value.data_type)?.trim() ??
      readOptionalString(value.backend_type)?.trim() ??
      "unknown",
    nullable: value.nullable === true,
    is_primary_key: value.is_primary_key === true || value.primary_key === true,
    is_unique: value.is_unique === true,
  };
}

function normalizeMetaTableSchemaGraphIndex(
  value: unknown,
): MetaTableSchemaGraphIndexRecord | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const id = readFiniteNumber(value.id);
  const name = readOptionalString(value.name)?.trim();

  if (id === null || !name) {
    return null;
  }

  return {
    id,
    name,
    columns: Array.isArray(value.columns)
      ? value.columns
          .map((column) => (typeof column === "string" ? column.trim() : ""))
          .filter((column): column is string => column.length > 0)
      : [],
  };
}

function normalizeMetaTableSchemaGraphTable(
  value: unknown,
  index = 0,
): MetaTableSchemaGraphTableRecord | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const uid = readOptionalString(value.uid)?.trim();
  const id = readFiniteNumber(value.id) ?? index + 1;

  if (!uid) {
    return null;
  }

  return {
    id,
    uid,
    identifier: readOptionalString(value.identifier)?.trim() || `table_${id}`,
    namespace: readOptionalString(value.namespace)?.trim() || null,
    physical_table_name:
      readOptionalString(value.physical_table_name)?.trim() ||
      readOptionalString(value.storage_hash)?.trim() ||
      `table_${id}`,
    storage_hash: readOptionalString(value.storage_hash)?.trim() || `table_${id}`,
    source_class_name: readOptionalString(value.source_class_name)?.trim() || null,
    data_source_id: readFiniteNumber(value.data_source_id),
    columns: Array.isArray(value.columns)
      ? value.columns
          .map((column, columnIndex) => normalizeMetaTableSchemaGraphColumn(column, columnIndex))
          .filter((column): column is MetaTableSchemaGraphColumnRecord => column !== null)
      : [],
    indexes: Array.isArray(value.indexes)
      ? value.indexes
          .map((index) => normalizeMetaTableSchemaGraphIndex(index))
          .filter((index): index is MetaTableSchemaGraphIndexRecord => index !== null)
      : [],
  };
}

function normalizeMetaTableSchemaGraphRelationship(
  value: unknown,
  index: number,
  nodeIdByUid: Map<string, number>,
  storageHashByUid: Map<string, string>,
): MetaTableSchemaGraphRelationshipRecord | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const sourceTableUid =
    readOptionalString(value.source_uid)?.trim() ??
    readOptionalString(value.source_table_uid)?.trim();
  const targetTableUid =
    readOptionalString(value.target_uid)?.trim() ??
    readOptionalString(value.target_table_uid)?.trim();
  const sourceColumns = Array.isArray(value.source_columns)
    ? value.source_columns
        .map((column) => (typeof column === "string" ? column.trim() : ""))
        .filter((column): column is string => column.length > 0)
    : [];
  const targetColumns = Array.isArray(value.target_columns)
    ? value.target_columns
        .map((column) => (typeof column === "string" ? column.trim() : ""))
        .filter((column): column is string => column.length > 0)
    : [];
  const sourceTableId = sourceTableUid ? nodeIdByUid.get(sourceTableUid) ?? null : null;
  const targetTableId = targetTableUid ? nodeIdByUid.get(targetTableUid) ?? null : null;
  const sourceColumn =
    sourceColumns[0] ??
    readOptionalString(value.source_column)?.trim() ??
    null;
  const targetColumn =
    targetColumns[0] ??
    readOptionalString(value.target_column)?.trim() ??
    null;

  if (!sourceTableUid || !targetTableUid || sourceTableId === null || targetTableId === null) {
    return null;
  }

  return {
    id: readFiniteNumber(value.id) ?? index + 1,
    name: readOptionalString(value.name)?.trim() || `edge_${index + 1}`,
    source_table_id: sourceTableId,
    source_table_uid: sourceTableUid,
    source_table_storage_hash:
      readOptionalString(value.source_table_storage_hash)?.trim() ??
      storageHashByUid.get(sourceTableUid) ??
      null,
    source_columns: sourceColumns,
    source_column: sourceColumn ?? "",
    target_table_id: targetTableId,
    target_table_uid: targetTableUid,
    target_table_storage_hash:
      readOptionalString(value.target_table_storage_hash)?.trim() ??
      storageHashByUid.get(targetTableUid) ??
      null,
    target_columns: targetColumns,
    target_column: targetColumn ?? "",
    on_delete: readOptionalString(value.on_delete)?.trim() || null,
    source_to_target_multiplicity: null,
    target_to_source_multiplicity: null,
  };
}

function normalizeMetaTableSchemaGraphPayload(
  payload: unknown,
): MetaTableSchemaGraphResponse {
  if (!isObjectRecord(payload)) {
    throw new MainSequenceApiError(
      "The meta table schema graph endpoint did not return an object payload.",
      200,
      payload,
    );
  }

  const rootUid = readOptionalString(payload.root_uid)?.trim();
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : null;
  const edges = Array.isArray(payload.edges) ? payload.edges : null;

  if (!rootUid || !nodes || !edges) {
    throw new MainSequenceApiError(
      "The meta table schema graph endpoint did not return root_uid, nodes, and edges.",
      200,
      payload,
    );
  }

  const tables = nodes
    .map((table, tableIndex) => normalizeMetaTableSchemaGraphTable(table, tableIndex))
    .filter((table): table is MetaTableSchemaGraphTableRecord => table !== null);
  const nodeIdByUid = new Map(tables.map((table) => [table.uid, table.id]));
  const storageHashByUid = new Map(tables.map((table) => [table.uid, table.storage_hash]));
  const rootTableId = nodeIdByUid.get(rootUid);

  if (rootTableId === undefined) {
    throw new MainSequenceApiError(
      "The meta table schema graph endpoint did not include the root_uid inside nodes.",
      200,
      payload,
    );
  }

  return {
    root_table_id: rootTableId,
    tables,
    relationships: edges
      .map((relationship, relationshipIndex) =>
        normalizeMetaTableSchemaGraphRelationship(
          relationship,
          relationshipIndex,
          nodeIdByUid,
          storageHashByUid,
        ),
      )
      .filter(
        (relationship): relationship is MetaTableSchemaGraphRelationshipRecord =>
          relationship !== null,
      ),
  };
}

export async function fetchMetaTableDataSnapshot(
  metaTableIdentifier: TsManagerPathIdentifier,
  {
    limit = 100,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  } = {},
) {
  if (env.useMockData) {
    const detail = await fetchMetaTableDetail(metaTableIdentifier);
    const columns = Array.from(
      new Set(
        [
          ...(Array.isArray(detail?.columns)
            ? detail.columns.map((column) => column.name)
            : []),
          ...(Array.isArray(detail?.sourcetableconfiguration?.columns_metadata)
            ? detail.sourcetableconfiguration.columns_metadata.map((column) => column.column_name)
            : []),
        ].filter((columnName): columnName is string => typeof columnName === "string" && columnName.trim().length > 0),
      ),
    );

    return {
      columns,
      rows: [],
    } satisfies ColumnarDataSnapshot;
  }

  const payload = await requestJson<unknown>(
    metaTableEndpoint,
    `${resolveTsManagerPath(metaTableIdentifier)}/get-data-snapshot/`,
    undefined,
    {
      limit,
      offset: offset > 0 ? offset : undefined,
    },
  );

  return normalizeColumnarDataSnapshot(payload);
}

export function fetchMetaTableSchemaGraph(
  metaTableIdentifier: TsManagerPathIdentifier,
  {
    depth,
    includeIncoming = false,
  }: {
    depth?: number;
    includeIncoming?: boolean;
  } = {},
) {
  return requestJson<unknown>(
    metaTableEndpoint,
    `${resolveTsManagerPath(metaTableIdentifier)}/schema-graph/`,
    undefined,
    {
      depth,
      include_incoming: includeIncoming,
    },
  ).then((payload) => normalizeMetaTableSchemaGraphPayload(payload));
}

export function fetchDataNodeSchemaGraph(
  dataNodeIdentifier: TsManagerPathIdentifier,
  {
    depth,
    includeIncoming = false,
  }: {
    depth?: number;
    includeIncoming?: boolean;
  } = {},
) {
  return requestJson<unknown>(
    dynamicTableMetadataEndpoint,
    `${resolveTsManagerPath(dataNodeIdentifier)}/schema-graph/`,
    undefined,
    {
      depth,
      include_incoming: includeIncoming,
    },
  ).then((payload) => normalizeMetaTableSchemaGraphPayload(payload));
}

export async function listDataNodes({
  limit = mainSequenceRegistryPageSize,
  light = true,
  offset = 0,
  namespace,
  namespaceUid,
  q,
  uid,
}: {
  limit?: number;
  light?: boolean;
  offset?: number;
  namespace?: string;
  namespaceUid?: string;
  q?: string;
  uid?: string;
} = {}) {
  const trimmedQuery = q?.trim() || undefined;
  const requestedUid = uid?.trim() || normalizeDataNodeUidSearch(trimmedQuery);
  const payload = await requestJson<PaginatedResponse<DataNodeSummary> | DataNodeSummary[]>(
    dynamicTableMetadataEndpoint,
    "",
    undefined,
    {
      limit,
      light,
      offset,
      ordering: "storage_hash_id",
      namespace: namespace?.trim() || undefined,
      namespace_uid: namespaceUid?.trim() || undefined,
      q: requestedUid ? undefined : trimmedQuery,
      uid: requestedUid,
    },
  );

  return normalizeOffsetPaginatedResponse(payload, limit, offset);
}

export async function quickSearchDataNodes({
  limit = 50,
  q,
}: {
  limit?: number;
  q: string;
}) {
  const payload = await requestJson<DataNodeQuickSearchRecord[]>(
    dynamicTableMetadataEndpoint,
    "quick-search/",
    undefined,
    {
      limit,
      q: q.trim(),
    },
  );

  return Array.isArray(payload) ? payload : [];
}

export async function quickSearchLocalTimeSeries({
  limit = 50,
  q,
}: {
  limit?: number;
  q: string;
}) {
  const payload = await requestJson<
    PaginatedResponse<LocalTimeSerieRecord> | LocalTimeSerieRecord[]
  >(localTimeSerieEndpoint, "", undefined, {
    limit,
    q: q.trim(),
  });

  const rows = normalizeListResponse(payload);

  return rows.map<LocalTimeSerieQuickSearchRecord>((row) => ({
    id: row.id,
    uid: typeof row.uid === "string" ? row.uid : null,
    update_hash: row.update_hash,
    project_uid:
      "project_uid" in row && typeof row.project_uid === "string" && row.project_uid.trim()
        ? row.project_uid
        : null,
    data_node_storage: row.data_node_storage
        ? {
            id: row.data_node_storage.id,
            uid:
              typeof row.data_node_storage.uid === "string" ? row.data_node_storage.uid : null,
            storage_hash: row.data_node_storage.storage_hash,
            identifier: row.data_node_storage.identifier,
          }
      : null,
  }));
}

export async function listLocalTimeSeries(
  remoteTableUid: string,
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
    q,
    traceMeta,
  }: {
    limit?: number;
    offset?: number;
    q?: string;
    traceMeta?: DashboardRequestTraceMeta;
  } = {},
) {
  const payload = await requestJson<
    PaginatedResponse<LocalTimeSerieRecord> | LocalTimeSerieRecord[]
  >(localTimeSerieEndpoint, "", undefined, {
    limit,
    offset,
    remote_table__uid: remoteTableUid,
    q: q?.trim() || undefined,
  }, traceMeta);

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export async function listProjectLocalTimeSeries(
  projectUid: string,
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
    q,
  }: {
    limit?: number;
    offset?: number;
    q?: string;
  } = {},
) {
  const payload = await requestJson<
    PaginatedResponse<LocalTimeSerieRecord> | LocalTimeSerieRecord[]
  >(localTimeSerieEndpoint, "", undefined, {
    limit,
    offset,
    "project__uid": projectUid,
    q: q?.trim() || undefined,
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

function postMainSequenceBulkDelete(
  path: string,
  uids: string[],
  search?: Record<string, QueryValue>,
) {
  return requestJson<MainSequenceBulkDeleteResponse>(
    commandCenterConfig.mainSequence.endpoint,
    path,
    {
      method: "POST",
      body: JSON.stringify({ uids }),
    },
    search,
  );
}

export function bulkSetDataNodeIndexStatsFromTable(selectedUids: string[]) {
  return postDynamicTableBulkAction<DynamicTableBulkActionResponse>(
    "bulk-set-index-stats-from-table/",
    { selected_uids: selectedUids },
  );
}

export function bulkRefreshDataNodeTableSearchIndex(selectedUids: string[]) {
  return postDynamicTableBulkAction<DynamicTableBulkActionResponse>(
    "bulk-refresh-table-search-index/",
    { selected_uids: selectedUids },
  );
}

export function bulkDeleteDataNodes(input: DynamicTableBulkDeleteInput) {
  return postDynamicTableBulkAction<DynamicTableBulkDeleteResponse>("bulk-delete/", {
    selected_uids: input.selectedUids,
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
    .filter((option) => option.uid.trim().length > 0)
    .filter((option) => option.related_resource_class_type !== "duck_db")
    .filter(
      (option) =>
        option.related_resource !== null &&
        typeof option.related_resource.uid === "string" &&
        option.related_resource.uid.trim().length > 0,
    )
    .sort((left, right) => {
      const leftName =
        left.related_resource?.display_name?.trim() ||
        left.related_resource?.name?.trim() ||
        `Data source ${left.uid}`;
      const rightName =
        right.related_resource?.display_name?.trim() ||
        right.related_resource?.name?.trim() ||
        `Data source ${right.uid}`;
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

export function fetchProjectDetail(projectUid: string) {
  return requestJson<ProjectDetail>(
    commandCenterConfig.mainSequence.endpoint,
    `projects/${resolveMainSequenceUidPath(projectUid, "project")}/`,
  );
}

export function updateProjectSdk(projectUid: string) {
  return requestJson<ProjectUpdateSdkResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `projects/${resolveMainSequenceUidPath(projectUid, "project")}/update-sdk/`,
    {
      method: "POST",
    },
  );
}

export function fetchProjectInfraGraph(
  projectUid: string,
  {
    commitSha,
  }: {
    commitSha?: string;
  } = {},
) {
  return requestJson<ProjectInfraGraphResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `projects/${resolveMainSequenceUidPath(projectUid, "project")}/infra-graph/`,
    undefined,
    { commit_sha: commitSha },
  );
}

export function fetchProjectInfraGraphByUrl(graphUrl: string) {
  return requestJson<ProjectInfraGraphResponse>(graphUrl);
}

export function fetchMainSequenceSummaryByUrl(summaryUrl: string) {
  return requestJson<SummaryResponse>(summaryUrl);
}

export function updateProjectSettings({
  projectUid,
  defaultDataSourceUid,
  defaultBaseImageUid,
}: UpdateProjectSettingsInput) {
  return requestJson<ProjectDetail>(
    commandCenterConfig.mainSequence.endpoint,
    `projects/${resolveMainSequenceUidPath(projectUid, "project")}/`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...(defaultDataSourceUid !== undefined
          ? { default_data_source: defaultDataSourceUid }
          : {}),
        ...(defaultBaseImageUid !== undefined
          ? { default_base_image: defaultBaseImageUid }
          : {}),
      }),
    },
  );
}

export async function fetchProjectImages(
  projectUid: string,
  {
    catalogImagePrefix,
    catalogImagePrefixStartswith,
  }: {
    catalogImagePrefix?: string;
    catalogImagePrefixStartswith?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<ProjectImageOption> | ProjectImageOption[]>(
    commandCenterConfig.mainSequence.endpoint,
    "project-image/",
    undefined,
    {
      limit: 200,
      "related_project__uid__in": projectUid,
      ...(catalogImagePrefix ? { catalog_image_prefix: catalogImagePrefix } : {}),
      ...(catalogImagePrefixStartswith
        ? { "catalog_image_prefix__startswith": catalogImagePrefixStartswith }
        : {}),
    },
  );

  return normalizeListResponse(payload).sort((left, right) => right.id - left.id);
}

export async function listProjectImages(
  projectUid: string,
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
    search,
  }: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<ProjectImageOption> | ProjectImageOption[]>(
    commandCenterConfig.mainSequence.endpoint,
    "project-image/",
    undefined,
    {
      limit,
      offset,
      "related_project__uid__in": projectUid,
      search: search?.trim() || undefined,
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

export async function listResourceReleaseGallery({
  limit = 500,
  offset = 0,
  exclude,
}: {
  limit?: number;
  offset?: number;
  exclude?: string;
} = {}) {
  const payload = await requestJson<
    PaginatedResponse<ResourceReleaseGalleryRecord> | ResourceReleaseGalleryRecord[]
  >(commandCenterConfig.mainSequence.endpoint, "resource-release/gallery/", undefined, {
    limit,
    offset,
    exclude,
  });

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export async function fetchResourceReleaseExchangeLaunch(exchangeLaunchUrl: string) {
  return requestJson<ResourceReleaseExchangeLaunchResponse>(env.apiBaseUrl, exchangeLaunchUrl);
}

export async function listProjectResources(
  projectUid: string,
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
    "project__uid": projectUid,
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

export function estimateBillingCost(input: BillingEstimateInput) {
  return requestJson<BillingEstimateResponse>(billingEstimateEndpoint, "", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getOrCreateProjectExecutorAgentService(
  input: CreateProjectExecutorAgentServiceInput,
) {
  return requestJson<ProjectExecutorAgentServiceRecord>(
    "/orm/api/agents/v1/project-executor-agent-services/get_or_create/",
    "",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function deployProjectExecutorAgentService(input: {
  project_uid: string;
  llm_provider: string;
  llm_model: string;
  llm_thinking?: string;
  automatic_deployment?: boolean;
  cpu_request?: string;
  cpu_limit?: string;
  memory_request?: string;
  memory_limit?: string;
  gpu_request?: string;
  gpu_type?: string;
  spot?: boolean;
}) {
  console.log("POST /orm/api/agents/v1/project-executor-agent-services/deploy/", input);

  return requestJson<ProjectExecutorAgentServiceDeployResponse>(
    "/orm/api/agents/v1/project-executor-agent-services/deploy/",
    "",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function fetchProjectExecutorAgentServiceByProject(projectUid: string) {
  try {
    return await requestJson<ProjectExecutorAgentServiceSummary>(
      `/orm/api/agents/v1/project-executor-agent-services/by-project/${resolveMainSequenceUidPath(projectUid, "project")}/`,
      "",
    );
  } catch (error) {
    if (error instanceof MainSequenceApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function fetchProjectExecutorAutomaticDeploymentRuns({
  agentUid,
  limit = 20,
  ordering = "-created_at",
}: {
  agentUid?: string | null;
  limit?: number;
  ordering?: string;
} = {}) {
  const payload = await requestJson<
    | PaginatedResponse<ProjectExecutorAutomaticDeploymentRun>
    | ProjectExecutorAutomaticDeploymentRun[]
  >(
    "/orm/api/agents/v1/project-executor-automatic-deployment-runs/",
    "",
    undefined,
    {
      ...(agentUid?.trim() ? { agent_uid: agentUid.trim() } : {}),
      ordering,
      limit,
    },
  );

  return normalizeListResponse(payload);
}

export function maintainProjectExecutorAgentService(serviceUid: string) {
  return requestJson<ProjectExecutorAgentServiceMaintenanceResult>(
    `/orm/api/agents/v1/project-executor-agent-services/${resolveMainSequenceUidPath(serviceUid, "project executor agent service")}/maintain-runtime/`,
    "",
    {
      method: "POST",
    },
  );
}

export interface CodingAgentDeploymentDefaultsInput {
  global_active: boolean;
  llm_provider: string;
  llm_model: string;
  llm_thinking: string;
  cpu_request: string;
  cpu_limit: string;
  memory_request: string;
  memory_limit: string;
  gpu_request: string;
  gpu_type: string;
}

export interface CodingAgentDeploymentDefaultsRecord
  extends Partial<CodingAgentDeploymentDefaultsInput> {
  id?: number;
  uid?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export function fetchCodingAgentDeploymentDefaults() {
  return requestJson<CodingAgentDeploymentDefaultsRecord>(
    "/orm/api/agents/v1/coding-agent-deployment-defaults/",
    "",
  );
}

export function saveCodingAgentDeploymentDefaults(
  input: CodingAgentDeploymentDefaultsInput,
) {
  return requestJson<CodingAgentDeploymentDefaultsRecord>(
    "/orm/api/agents/v1/coding-agent-deployment-defaults/",
    "",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateProjectExecutorAgentServiceAutomation(
  serviceUid: string,
  automaticDeployment: boolean,
) {
  return requestJson<ProjectExecutorAgentServiceSummary>(
    `/orm/api/agents/v1/project-executor-agent-services/${resolveMainSequenceUidPath(serviceUid, "project executor agent service")}/`,
    "",
    {
      method: "PATCH",
      body: JSON.stringify({
        automatic_deployment: automaticDeployment,
      }),
    },
  );
}

export function deleteProjectExecutorAgentServiceByProject(projectUid: string) {
  return requestJson<null>(
    `/orm/api/agents/v1/project-executor-agent-services/by-project/${resolveMainSequenceUidPath(projectUid, "project")}/`,
    "",
    {
      method: "DELETE",
    },
  );
}

export function deleteResourceRelease(resourceReleaseUid: string) {
  return requestJson<null>(
    commandCenterConfig.mainSequence.endpoint,
    `resource-release/${resolveMainSequenceUidPath(resourceReleaseUid, "resource release")}/`,
    {
      method: "DELETE",
    },
  );
}

export function bulkDeleteResourceReleases(uids: string[]) {
  return postMainSequenceBulkDelete("resource-release/bulk-delete/", uids);
}

export function deleteProjectImage(imageUid: string) {
  return requestJson<{ detail?: string } | null>(
    commandCenterConfig.mainSequence.endpoint,
    `project-image/${resolveMainSequenceUidPath(imageUid, "project image")}/`,
    {
      method: "DELETE",
    },
  );
}

export function bulkDeleteProjectImages(uids: string[]) {
  return requestJson<MainSequenceBulkDeleteResponse>(
    commandCenterConfig.mainSequence.endpoint,
    "project-image/bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        selected_uids: uids,
        select_all: false,
      }),
    },
  );
}

export function fetchProjectImageCommitHashes(projectUid: string, limit = 100) {
  return requestJson<ProjectImageCommitHashListResponse>(
    commandCenterConfig.mainSequence.endpoint,
    "project-image/commit-hashes/",
    undefined,
    {
      project_uid: projectUid,
      limit,
    },
  );
}

export async function listProjectJobs(
  projectUid: string,
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
    search,
  }: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<JobRecord> | JobRecord[]>(
    commandCenterConfig.mainSequence.endpoint,
    "job/",
    undefined,
    {
      limit,
      offset,
      "project__uid": projectUid,
      search: search?.trim() || undefined,
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
    search,
  }: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<JobRecord> | JobRecord[]>(
    commandCenterConfig.mainSequence.endpoint,
    "job/",
    undefined,
    {
      limit,
      offset,
      search: search?.trim() || undefined,
    },
  );

  const page = normalizeOffsetPaginatedResponse(payload, limit, offset);

  return {
    ...page,
    results: [...page.results].sort((left, right) => right.id - left.id),
  };
}

export async function listJobRuns(
  jobUid: string,
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
    search,
  }: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {},
) {
  const payload = await requestJson<PaginatedResponse<JobRunRecord> | JobRunRecord[]>(
    commandCenterConfig.mainSequence.endpoint,
    "job-run/",
    undefined,
    {
      limit,
      offset,
      "job__uid": jobUid,
      search: search?.trim() || undefined,
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

export function fetchJob(jobUid: string) {
  return requestJson<JobRecord>(
    commandCenterConfig.mainSequence.endpoint,
    `job/${resolveMainSequenceUidPath(jobUid, "job")}/`,
  );
}

export interface RunJobInput {
  commandArgs?: string[];
}

export interface RunJobResponse {
  message?: string;
  command_args?: string[];
}

export function runJob(jobUid: string, input: RunJobInput = {}) {
  const commandArgs = input.commandArgs ?? [];
  const body = commandArgs.length > 0 ? { command_args: commandArgs } : {};

  return requestJson<RunJobResponse>(commandCenterConfig.mainSequence.endpoint, `job/${resolveMainSequenceUidPath(jobUid, "job")}/run_job/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
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

export function getSummaryLabels(
  summary: Pick<SummaryResponse, "label_management" | "labels">,
) {
  return summary.label_management?.labels ?? summary.labels ?? EMPTY_SUMMARY_LABELS;
}

export function canMutateSummaryLabels(
  summary: Pick<SummaryResponse, "label_management">,
) {
  return Boolean(
    summary.label_management?.add_label_url?.trim() &&
      summary.label_management?.remove_label_url?.trim(),
  );
}

export function addSummaryLabel(
  summary: Pick<SummaryResponse, "label_management">,
  label: string,
) {
  const addLabelUrl = summary.label_management?.add_label_url?.trim();

  if (!addLabelUrl) {
    throw new Error("Summary does not expose an add-label action.");
  }

  const requestTarget = resolveRequestTarget(addLabelUrl);

  return requestJson<unknown>(requestTarget.endpoint, requestTarget.path, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export function removeSummaryLabel(
  summary: Pick<SummaryResponse, "label_management">,
  label: string,
) {
  const removeLabelUrl = summary.label_management?.remove_label_url?.trim();

  if (!removeLabelUrl) {
    throw new Error("Summary does not expose a remove-label action.");
  }

  const requestTarget = resolveRequestTarget(removeLabelUrl);

  return requestJson<unknown>(requestTarget.endpoint, requestTarget.path, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export function deleteJob(jobUid: string) {
  return requestJson<null>(commandCenterConfig.mainSequence.endpoint, `job/${resolveMainSequenceUidPath(jobUid, "job")}/`, {
    method: "DELETE",
  });
}

export function bulkDeleteJobs(uids: string[]) {
  return requestJson<MainSequenceBulkDeleteResponse>(
    commandCenterConfig.mainSequence.endpoint,
    "job/bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        selected_uids: uids,
        select_all: false,
      }),
    },
  );
}

export function deleteProject(
  projectUid: string,
  {
    deleteRepositories = false,
  }: {
    deleteRepositories?: boolean;
  } = {},
) {
  return requestJson<{ message: string }>(
    commandCenterConfig.mainSequence.endpoint,
    `projects/${resolveMainSequenceUidPath(projectUid, "project")}/`,
    {
      method: "DELETE",
    },
    deleteRepositories ? { delete_repositories: "true" } : undefined,
  );
}

export function bulkDeleteProjects(
  uids: string[],
  {
    deleteRepositories = false,
  }: {
    deleteRepositories?: boolean;
  } = {},
) {
  return requestJson<MainSequenceBulkDeleteResponse>(
    commandCenterConfig.mainSequence.endpoint,
    "projects/bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        selected_uids: uids,
        select_all: false,
      }),
    },
    deleteRepositories ? { delete_repositories: "true" } : undefined,
  );
}

async function fetchShareablePrincipals(
  objectUrl: string,
  objectId: ShareableObjectId,
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
  objectId: ShareableObjectId,
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

export function fetchObjectCanView(objectUrl: string, objectId: ShareableObjectId) {
  return fetchShareablePrincipals(objectUrl, objectId, "view");
}

export function fetchObjectCanEdit(objectUrl: string, objectId: ShareableObjectId) {
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

export function fetchProjectSummary(projectUid: string) {
  return requestJson<ProjectSummaryHeader>(
    commandCenterConfig.mainSequence.endpoint,
    `projects/${resolveMainSequenceUidPath(projectUid, "project")}/summary/`,
  );
}

export function fetchDataNodeSummary(dataNodeIdentifier: TsManagerPathIdentifier) {
  return requestJson<DataNodeSummaryHeader>(
    dynamicTableMetadataEndpoint,
    `${resolveTsManagerPath(dataNodeIdentifier)}/summary/`,
  );
}

export function buildDataNodeDetailQueryKey(dataNodeIdentifier: TsManagerPathIdentifier) {
  return ["main_sequence", "data_node", "detail", String(dataNodeIdentifier)] as const;
}

function buildDataNodeDetailCacheKey(dataNodeIdentifier: TsManagerPathIdentifier) {
  const userId = useAuthStore.getState().session?.user.uid ?? "anonymous";
  return `${userId}:${String(dataNodeIdentifier)}`;
}

export function fetchDataNodeDetail(
  dataNodeIdentifier: TsManagerPathIdentifier,
  traceMeta?: DashboardRequestTraceMeta,
) {
  const resolvedIdentifier = resolveTsManagerPath(dataNodeIdentifier);

  if (isWidgetPreviewMode()) {
    return Promise.resolve(buildWidgetPreviewDataNodeDetail());
  }

  const cacheKey = buildDataNodeDetailCacheKey(dataNodeIdentifier);
  const now = Date.now();
  const cachedEntry = dataNodeDetailCache.get(cacheKey);
  const requestUrl = buildEndpointUrl(dynamicTableMetadataEndpoint, `${resolvedIdentifier}/`);

  if (cachedEntry?.value && cachedEntry.expiresAt > now) {
    startDashboardRequestTrace(traceMeta, {
      method: "GET",
      url: requestUrl,
    })?.finish({
      ok: true,
      status: 200,
      resolution: "cache-hit",
    });
    return Promise.resolve(cachedEntry.value);
  }

  if (cachedEntry?.promise) {
    startDashboardRequestTrace(traceMeta, {
      method: "GET",
      url: requestUrl,
    })?.finish({
      ok: true,
      status: 200,
      resolution: "shared-promise",
    });
    return cachedEntry.promise;
  }

  const requestPromise = requestJson<unknown>(
    dynamicTableMetadataEndpoint,
    `${resolvedIdentifier}/`,
    undefined,
    undefined,
    traceMeta,
  ).then((payload) => {
    const detail = normalizeDataNodeDetailPayload(payload);

    dataNodeDetailCache.set(cacheKey, {
      value: detail,
      expiresAt: Date.now() + DATA_NODE_DETAIL_CACHE_TTL_MS,
    });
    return detail;
  }).catch((error) => {
    dataNodeDetailCache.delete(cacheKey);
    throw error;
  });

  dataNodeDetailCache.set(cacheKey, {
    expiresAt: now + DATA_NODE_DETAIL_CACHE_TTL_MS,
    promise: requestPromise,
  });

  return requestPromise;
}

function normalizeDataNodeDetailPayload(payload: unknown): DataNodeDetail {
  const metaTableDetail = normalizeMetaTableDetailPayload(payload);
  const record = isObjectRecord(payload) ? payload : {};

  return {
    ...metaTableDetail,
    id: readFiniteNumber(record.id) ?? 0,
    uid: metaTableDetail.uid,
    storage_hash:
      metaTableDetail.storage_hash ??
      readOptionalString(record.storage_hash)?.trim() ??
      metaTableDetail.uid,
    creation_date: metaTableDetail.creation_date ?? "",
    source_class_name: metaTableDetail.source_class_name ?? null,
    protect_from_deletion: metaTableDetail.protect_from_deletion === true,
    time_serie_source_code_git_hash:
      readOptionalString(record.time_serie_source_code_git_hash)?.trim() ?? null,
    created_by_user: readFiniteNumber(record.created_by_user),
    open_for_everyone: metaTableDetail.open_for_everyone === true,
    data_source: metaTableDetail.data_source ?? null,
    data_source_open_for_everyone: record.data_source_open_for_everyone === true,
    identifier: metaTableDetail.identifier ?? null,
    description: metaTableDetail.description ?? null,
    data_frequency_id: metaTableDetail.data_frequency_id ?? null,
    build_configuration: metaTableDetail.build_configuration ?? null,
    build_meta_data: record.build_meta_data ?? null,
    sourcetableconfiguration: metaTableDetail.sourcetableconfiguration ?? null,
    table_contract: metaTableDetail.table_contract,
    introspection_snapshot: metaTableDetail.introspection_snapshot,
    columns: metaTableDetail.columns ?? [],
    indexes_meta: metaTableDetail.indexes_meta ?? [],
    foreign_keys: metaTableDetail.foreign_keys ?? [],
    incoming_fks: metaTableDetail.incoming_fks ?? [],
    labels: metaTableDetail.labels ?? [],
    management_mode: metaTableDetail.management_mode ?? null,
    physical_table_name: metaTableDetail.physical_table_name ?? null,
    contract_version: metaTableDetail.contract_version ?? null,
  };
}

export function fetchSourceTableConfigurationStats(sourceTableConfigurationUid: string) {
  return requestJson<SourceTableConfigurationStatsResponse>(
    sourceTableConfigurationEndpoint,
    `${resolveMainSequenceUidPath(sourceTableConfigurationUid, "source table configuration")}/get_stats/`,
  );
}

export function fetchDataNodeStats(dataNodeIdentifier: TsManagerPathIdentifier) {
  return requestJson<DataNodeStatsResponse>(
    dynamicTableMetadataEndpoint,
    `${resolveTsManagerPath(dataNodeIdentifier)}/get-stats/`,
  );
}

export function deleteDataNodeTail(
  dataNodeIdentifier: TsManagerPathIdentifier,
  input: DataNodeTailDeleteInput,
) {
  return requestJson<DataNodeTailDeleteResponse>(
    dynamicTableMetadataEndpoint,
    `${resolveTsManagerPath(dataNodeIdentifier)}/delete_after_date/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
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

export async function fetchDataNodeLastObservation(dataNodeIdentifier: TsManagerPathIdentifier) {
  const payload = await requestJson<unknown>(
    dynamicTableMetadataEndpoint,
    `${resolveTsManagerPath(dataNodeIdentifier)}/get_last_observation/`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  return normalizeDataNodeLastObservation(payload);
}

export async function fetchDataNodeTailObservations(
  dataNodeIdentifier: TsManagerPathIdentifier,
  input: { n?: number; order?: "asc" | "desc" } = {},
  traceMeta?: DashboardRequestTraceMeta,
) {
  const payload = await requestJson<unknown>(
    dynamicTableMetadataEndpoint,
    `${resolveTsManagerPath(dataNodeIdentifier)}/get-tail-observations/`,
    undefined,
    {
      n: input.n,
      order: input.order,
    },
    traceMeta,
  );

  return normalizeDataNodeRemoteDataRows(payload);
}

export async function fetchDataNodeDataBetweenDatesFromRemote(
  dataNodeIdentifier: TsManagerPathIdentifier,
  input: DataNodeRemoteDataRequest,
  traceMeta?: DashboardRequestTraceMeta,
) {
  if (isWidgetPreviewMode()) {
    return buildWidgetPreviewDataNodeRows(input);
  }

  const payload = await requestJson<unknown>(
    dynamicTableMetadataEndpoint,
    `${resolveTsManagerPath(dataNodeIdentifier)}/get_data_between_dates_from_remote/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    undefined,
    traceMeta,
  );

  return normalizeDataNodeRemoteDataRows(payload);
}

export function fetchLocalTimeSerieSummary(localTimeSerieIdentifier: TsManagerPathIdentifier) {
  return requestJson<LocalTimeSerieSummaryHeader>(
    localTimeSerieEndpoint,
    `${resolveTsManagerPath(localTimeSerieIdentifier)}/summary/`,
  );
}

export function fetchLocalTimeSerieDetail(localTimeSerieIdentifier: TsManagerPathIdentifier) {
  return requestJson<LocalTimeSerieRecord>(
    localTimeSerieEndpoint,
    `${resolveTsManagerPath(localTimeSerieIdentifier)}/`,
  );
}

export function fetchLocalTimeSerieRunConfiguration(
  localTimeSerieIdentifier: TsManagerPathIdentifier,
) {
  return requestJson<LocalTimeSerieRunConfiguration>(
    localTimeSerieEndpoint,
    `${resolveTsManagerPath(localTimeSerieIdentifier)}/run-configuration/`,
  );
}

export function updateLocalTimeSerieRunConfiguration(
  localTimeSerieIdentifier: TsManagerPathIdentifier,
  input: LocalTimeSerieRunConfigurationInput,
) {
  return requestJson<LocalTimeSerieRunConfiguration>(
    localTimeSerieEndpoint,
    `${resolveTsManagerPath(localTimeSerieIdentifier)}/run-configuration/`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function fetchLocalTimeSerieDependencyGraph(
  localTimeSerieIdentifier: TsManagerPathIdentifier,
  direction: "downstream" | "upstream",
  traceMeta?: DashboardRequestTraceMeta,
) {
  if (isWidgetPreviewMode()) {
    const previewId =
      typeof localTimeSerieIdentifier === "number"
        ? localTimeSerieIdentifier
        : Number(localTimeSerieIdentifier);
    return Promise.resolve(
      buildWidgetPreviewDependencyGraph(Number.isFinite(previewId) ? previewId : 0, direction),
    );
  }

  return requestJson<unknown>(
    localTimeSerieEndpoint,
    `${resolveTsManagerPath(localTimeSerieIdentifier)}/dependencies-graph/`,
    undefined,
    { direction },
    traceMeta,
  ).then((payload) =>
    normalizeDependencyGraphPayload(payload, "LocalTimeSerie dependency graph"),
  );
}

export function listLocalTimeSerieHistoricalUpdates(
  localTimeSerieIdentifier: TsManagerPathIdentifier,
  limit = 100,
) {
  return requestJson<LocalTimeSerieHistoricalUpdateRecord[]>(
    localTimeSerieEndpoint,
    `${resolveTsManagerPath(localTimeSerieIdentifier)}/historical-updates/`,
    undefined,
    { limit },
  );
}

export function fetchLocalTimeSerieLogs(
  localTimeSerieIdentifier: TsManagerPathIdentifier,
  level?: string,
) {
  return requestJson<LocalTimeSerieLogsGridResponse>(
    localTimeSerieEndpoint,
    `${resolveTsManagerPath(localTimeSerieIdentifier)}/logs/`,
    undefined,
    level ? { level } : undefined,
  );
}

export function fetchDataNodeCompressionPolicy(dataNodeIdentifier: TsManagerPathIdentifier) {
  return requestJson<DataNodePolicyState<DataNodeCompressionPolicyConfig>>(
    dynamicTableMetadataEndpoint,
    `${resolveTsManagerPath(dataNodeIdentifier)}/compression-policy/`,
  );
}

export function saveDataNodeCompressionPolicy(
  dataNodeIdentifier: TsManagerPathIdentifier,
  input: DataNodeCompressionPolicyInput,
) {
  return requestJson<DataNodePolicyState<DataNodeCompressionPolicyConfig>>(
    dynamicTableMetadataEndpoint,
    `${resolveTsManagerPath(dataNodeIdentifier)}/compression-policy/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function fetchDataNodeRetentionPolicy(dataNodeIdentifier: TsManagerPathIdentifier) {
  return requestJson<DataNodePolicyState<DataNodeRetentionPolicyConfig>>(
    dynamicTableMetadataEndpoint,
    `${resolveTsManagerPath(dataNodeIdentifier)}/retention-policy/`,
  );
}

export function saveDataNodeRetentionPolicy(
  dataNodeIdentifier: TsManagerPathIdentifier,
  input: DataNodeRetentionPolicyInput,
) {
  return requestJson<DataNodePolicyState<DataNodeRetentionPolicyConfig>>(
    dynamicTableMetadataEndpoint,
    `${resolveTsManagerPath(dataNodeIdentifier)}/retention-policy/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function fetchResourceReleaseSummary(resourceReleaseUid: string) {
  return requestJson<ResourceReleaseSummaryResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `resource-release/${resolveMainSequenceUidPath(resourceReleaseUid, "resource release")}/summary/`,
  );
}

export function fetchJobRunSummary(jobRunUid: string) {
  return requestJson<SummaryResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `job-run/${resolveMainSequenceUidPath(jobRunUid, "job run")}/summary/`,
  );
}

export function fetchJobRunLogs(jobRunUid: string) {
  return requestJson<JobRunLogsResponse | JobRunLogEntry[]>(
    commandCenterConfig.mainSequence.endpoint,
    `job-run/${resolveMainSequenceUidPath(jobRunUid, "job run")}/get_logs/`,
    undefined,
    { response_format: "tanstack" },
  ).then((payload) => {
    if (Array.isArray(payload)) {
      return {
        job_run_id: 0,
        status: "",
        rows: payload,
      } satisfies JobRunLogsResponse;
    }

    return payload;
  });
}

export function fetchProjectRepositoryBrowser(projectUid: string, path = "") {
  return requestJson<ProjectRepositoryBrowserResponse>(
    commandCenterConfig.mainSequence.endpoint,
    `projects/${resolveMainSequenceUidPath(projectUid, "project")}/browse-repository/`,
    undefined,
    { path },
  );
}

export async function fetchProjectResourceCode(projectUid: string, path = "") {
  const payload = await requestJson<ProjectResourceCodeResponse | string | null>(
    commandCenterConfig.mainSequence.endpoint,
    `projects/${resolveMainSequenceUidPath(projectUid, "project")}/resource-code/`,
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
      projectUid,
      path,
    );

    if (recoveredPayload) {
      return recoveredPayload;
    }

    const fallbackName = path.split("/").filter(Boolean).at(-1) ?? path;

    return {
      project_uid: projectUid,
      path,
      name: fallbackName,
      language: null,
      content: payload,
    } satisfies ProjectResourceCodeResponse;
  }

  if (payload === null) {
    const fallbackName = path.split("/").filter(Boolean).at(-1) ?? path;

    return {
      project_uid: projectUid,
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
    if (error.message.trim()) {
      return error.message.trim();
    }

    const detailMessages = flattenErrorMessages(error.details).filter(Boolean);

    return detailMessages.length > 0 ? detailMessages.join(" ") : "The request failed.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "The request failed.";
}

export interface CatalogueRecord {
  uid: string;
  namespace: string;
  identifier: string;
  description: string | null;
  model_name: string;
  resource_type: string | null;
  meta_table_uid: string;
  storage_hash: string;
  contract_hash: string;
  sdk_version: string | null;
  created_at: string;
  updated_at: string;
  supports_row_listing: boolean;
  supports_row_delete: boolean;
  rows_endpoint: string;
  delete_endpoint_template: string;
}

export interface CatalogueListResponse {
  results: CatalogueRecord[];
  limit: number;
  offset: number;
}

export interface CatalogueListFilters {
  limit?: number;
  offset?: number;
}

export interface CatalogueRowsCatalogSummary {
  uid: string;
  identifier: string;
  model_name: string;
  meta_table_uid: string;
  storage_hash: string;
}

export interface CatalogueColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  primary_key: boolean;
}

export interface CatalogueRowRecord {
  uid: string;
  values: Record<string, unknown>;
}

export interface CatalogueRowsResponse {
  catalog: CatalogueRowsCatalogSummary;
  columns: CatalogueColumnDefinition[];
  results: CatalogueRowRecord[];
  limit: number;
  offset: number;
}

export interface CatalogueRowsFilters {
  limit?: number;
  offset?: number;
}

export interface DeleteCatalogueRowResponse {
  detail: string;
  catalog_uid: string;
  meta_table_uid: string;
  uid: string;
  deleted_count: number;
  cascade: boolean;
}

export function listCatalogue({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: CatalogueListFilters = {}) {
  return requestJson<CatalogueListResponse>(
    catalogEndpoint,
    "",
    undefined,
    {
      limit: String(limit),
      offset: String(offset),
    },
  );
}

export function fetchCatalogueRows(
  catalogueUid: string,
  {
    limit = mainSequenceRegistryPageSize,
    offset = 0,
  }: CatalogueRowsFilters = {},
) {
  return requestJson<CatalogueRowsResponse>(
    catalogEndpoint,
    `${resolveMainSequenceUidPath(catalogueUid, "catalogue")}/rows/`,
    undefined,
    {
      limit: String(limit),
      offset: String(offset),
    },
  );
}

export function deleteCatalogueRow(catalogueUid: string, rowUid: string) {
  return requestJson<DeleteCatalogueRowResponse>(
    catalogEndpoint,
    `${resolveMainSequenceUidPath(catalogueUid, "catalogue")}/rows/${resolveMainSequenceUidPath(rowUid, "catalogue row")}/`,
    {
      method: "DELETE",
    },
  );
}
