import {
  listAccessRbacUsersPage,
  type AccessRbacUsersPage,
} from "@/extensions/core/apps/access-rbac/api";
import { useAuthStore } from "@/auth/auth-store";
import { applySessionAuthHeaders } from "@/auth/session-headers";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";

const devAuthProxyPrefix = "/__command_center_auth__";

export class AdminRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "AdminRequestError";
    this.status = status;
    this.payload = payload;
  }
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function buildEndpointUrl(
  path: string,
  search?: Record<string, string | number | boolean | undefined>,
  baseUrl = env.apiBaseUrl,
) {
  const url = new URL(path, baseUrl);

  Object.entries(search ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  if (import.meta.env.DEV && isLoopbackHostname(url.hostname)) {
    return `${devAuthProxyPrefix}${url.pathname}${url.search}`;
  }

  return url.toString();
}

async function readResponsePayload(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.trim() ? text : null;
}

function readErrorMessage(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (!payload || typeof payload !== "object") {
    return "";
  }

  const detail = "detail" in payload ? payload.detail : undefined;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  for (const value of Object.values(payload)) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value)) {
      const joined = value.filter((entry): entry is string => typeof entry === "string").join(", ");
      if (joined) {
        return joined;
      }
    }
  }

  return "";
}

async function requestAdminJson<T>(
  path: string,
  init?: RequestInit,
  search?: Record<string, string | number | boolean | undefined>,
) {
  const requestUrl = buildEndpointUrl(path, search);

  async function sendRequest() {
    const session = useAuthStore.getState().session;
    const headers = new Headers(init?.headers);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    applySessionAuthHeaders(headers, session);

    return fetch(requestUrl, {
      ...init,
      headers,
    });
  }

  let response = await sendRequest();

  if (response.status === 401) {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      response = await sendRequest();
    }
  }

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      payload,
      readErrorMessage(payload) || `Admin request failed with ${response.status}.`,
    );
  }

  return payload as T;
}

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

export interface UserBulkDeleteResponse {
  detail: string;
  matched_count: number;
  deleted_count: number;
}

export interface UserBulkOrgAdminActionResponse {
  detail: string;
  action: "add" | "remove";
  matched_count: number;
  updated_count: number;
}

export interface OrganizationUserCreateResponse {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  plan: string;
  teams: Array<{
    id: number;
    name: string;
  }>;
}

export interface OrganizationUserCreateInput {
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface GithubOrganizationRecord {
  uid: string;
  login: string;
  display_name: string;
}

export interface GithubOrganizationsPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: GithubOrganizationRecord[];
}

export interface GithubOrganizationBulkDeleteResponse {
  detail: string;
  deleted_count: number;
}

export interface GithubOrganizationRepositoryRecord {
  github_repository_id: number;
  name: string;
  full_name?: string;
  clone_url?: string | null;
  ssh_url?: string | null;
  default_branch?: string | null;
  is_private?: boolean;
  existing_git_repository_uid?: string | null;
  existing_project_uid?: string | null;
  suggested_project_name?: string | null;
}

export interface GithubOrganizationRepositoryListResponse {
  repositories: GithubOrganizationRepositoryRecord[];
}

export interface GithubOrganizationImportRepositoryInput {
  github_repository_id: number;
  full_name: string;
  project_name: string;
}

export interface GithubOrganizationImportRepositoryResult {
  full_name: string;
  project_name: string;
  status: string;
  project_uid: string | null;
  git_repository_uid: string | null;
  detail?: string;
}

export interface GithubOrganizationImportRepositoriesResponse {
  results: GithubOrganizationImportRepositoryResult[];
}

export interface GithubOrganizationConnectStartResponse {
  redirect_url: string;
  state?: string;
}

export interface BillingInvoiceRecord {
  id: string;
  number: string | null;
  status: string | null;
  paid: boolean;
  created: string | null;
  currency: string | null;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  view_url: string;
  pdf_url: string;
}

export interface BillingInvoicesResponse {
  invoices: BillingInvoiceRecord[];
  has_more: boolean;
  next_starting_after: string | null;
}

export interface BillingUsageRow {
  usage_start_time: string;
  usage_end_time: string;
  source_type: string;
  source_object: string;
  total_cost: string;
}

export interface BillingUsageColumnDef {
  headerName: string;
  field: keyof BillingUsageRow | string;
  valueFormatter?: string;
}

export interface BillingUsageResponse {
  rows: BillingUsageRow[];
  columnDefs: BillingUsageColumnDef[];
}

export interface HostedManagedDatabaseExtensionOption {
  code: string;
  label: string;
  available: boolean;
  unavailable_reason?: string;
  unavailable_detail?: string;
}

export interface HostedManagedDatabaseComputeShape {
  id?: string;
  code?: string;
  label?: string;
  vcpus: number;
  memory_gib: number;
  available?: boolean;
}

export interface HostedManagedDatabaseComputeTier {
  id: string;
  label: string;
  description: string;
  compute_shapes: HostedManagedDatabaseComputeShape[];
}

export interface HostedManagedDatabaseConfigurationOptions {
  postgres_versions: string[];
  compute_tiers: HostedManagedDatabaseComputeTier[];
  storage: {
    min_gib: number;
    max_gib: number;
    step_gib: number;
  };
  backup_retention_days: {
    min: number;
    max: number;
    included_days?: number;
  };
  high_availability?: {
    description?: string;
    optional?: boolean;
    default?: {
      mode?: string;
    };
    modes?: Array<{
      id: string;
      label: string;
      description?: string;
    }>;
  };
  maintenance_window: {
    description?: string;
    optional?: boolean;
    default?: {
      day_of_week?: number;
      start_hour?: number;
      start_minute?: number;
    };
    day_of_week: {
      min: number;
      max: number;
    };
    start_hour: {
      min: number;
      max: number;
    };
    start_minute: {
      min?: number;
      max?: number;
      values?: number[];
    };
  };
}

export interface HostedManagedDatabaseCatalogResponse {
  extensions: HostedManagedDatabaseExtensionOption[];
  configuration_options: HostedManagedDatabaseConfigurationOptions;
  pricing: {
    available: boolean;
    currency?: string;
    billing_interval?: "month";
    refresh_interval_seconds?: number;
    compute?: Record<
      string,
      {
        monthly_amount_cents: number;
        currency: string;
      }
    >;
    storage?: {
      monthly_amount_cents_per_gib: number;
      currency: string;
    };
    backup?: {
      monthly_amount_cents_per_gib?: number;
      monthly_amount_cents_per_gib_day?: number;
      currency: string;
    };
    high_availability?: {
      compute_multipliers: Record<string, string>;
    };
  };
  billing: {
    mode: string;
    billing_interval: string;
    billing_anchor?: string;
    charge_timing: string;
    first_period_prorated?: boolean;
    configuration_change_proration?: boolean;
    price_validation_required?: boolean;
    current_period_start?: string;
    current_period_end?: string;
    period_seconds?: number;
    remaining_period_seconds?: number;
    proration_factor?: string;
  };
  endpoints: {
    create?: {
      method: string;
      path: string;
    };
    update?: {
      method: string;
      path: string;
    };
  };
}

export interface HostedManagedDatabaseActionSpec {
  method: string;
  path: string;
}

export interface HostedManagedDatabaseActions {
  update?: HostedManagedDatabaseActionSpec;
  cancel_now?: HostedManagedDatabaseActionSpec;
}

export interface HostedManagedDatabaseCredential {
  uid?: string | null;
  kind?: string | null;
  actions?: {
    reveal?: HostedManagedDatabaseActionSpec;
    rotate?: HostedManagedDatabaseActionSpec;
  };
}

export interface HostedManagedDatabaseFailure {
  code?: string;
  detail?: string;
  retryable?: boolean;
  remediable?: boolean;
}

export interface HostedManagedDatabaseAllocation extends Record<string, unknown> {
  allocation_uid?: string;
  data_source_uid?: string | null;
  dynamic_table_data_source_uid?: string | null;
  connection_uid?: string | null;
  credential?: HostedManagedDatabaseCredential | null;
  display_name?: string;
  status?: string;
  resource_plan_code?: string;
  extensions?: string[];
  billing_status?: string;
  price_amount?: string;
  price_amount_cents?: number;
  currency?: string;
  billing_interval?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancelled_at?: string | null;
  resource?: {
    uid?: string | null;
    display_name?: string;
    status?: string;
    storage_access_mode?: string;
    description?: string;
  };
  physical_resource?: {
    shape?: {
      compute_shape_id?: string | null;
      compute_shape_label?: string | null;
      compute_tier?: string | null;
      compute_tier_label?: string | null;
      vcpus?: number | null;
      memory_gib?: number | null;
      storage_gib?: number | null;
      backup_retention_days?: number | null;
      postgres_version?: string | null;
      high_availability?: {
        mode?: string | null;
      } | null;
      vms?: number | null;
      cpu_per_vm?: number | null;
      memory_per_vm_gb?: number | null;
      storage_gb?: number | null;
    };
    maintenance_window?: {
      day_of_week?: number;
      start_hour?: number;
      start_minute?: number;
    };
    power_state?: string;
  };
  connection?: {
    uid?: string | null;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    ssl_mode?: string;
    default_schema?: string;
    connection_url?: string;
  };
  network_access?: {
    public_access?: boolean | null;
    allowed_ip_ranges?: string[];
    access_mode?: string;
  };
  failure?: HostedManagedDatabaseFailure;
  actions?: HostedManagedDatabaseActions;
}

export interface HostedManagedDatabasesResponse {
  resource_kind?: string;
  count: number;
  results: HostedManagedDatabaseAllocation[];
}

export interface HostedManagedDatabaseCreateInput {
  display_name: string;
  description?: string | null;
  extensions: string[];
  configuration: {
    postgres_version: string;
    compute_shape_id: string;
    storage_gib: number;
    backup_retention_days?: number;
    geo_redundant_backup?: boolean;
    high_availability?: {
      mode: string;
    };
    maintenance_window?: {
      day_of_week?: number;
      start_hour?: number;
      start_minute?: number;
    };
  };
  expected_total_amount_cents: number;
}

export interface HostedManagedDatabaseCreateResponse {
  detail: string;
  allocation_uid: string;
  data_source_uid: string;
  connection_uid?: string | null;
  credential?: HostedManagedDatabaseCredential | null;
  display_name: string;
  extensions: string[];
  status: string;
  billing_status: string;
  resource_plan_code: string;
  dynamic_table_data_source_uid: string;
}

export interface HostedManagedDatabasePatchInput {
  display_name?: string;
  description?: string | null;
  configuration?: {
    compute_shape_id?: string;
    storage_gib?: number;
    backup_retention_days?: number;
    geo_redundant_backup?: boolean;
    high_availability?: {
      mode: string;
    };
    maintenance_window?: {
      day_of_week?: number;
      start_hour?: number;
      start_minute?: number;
    };
  };
}

export interface HostedManagedDatabaseProvisioningFailedErrorPayload {
  code: "managed_database_provisioning_failed";
  detail: string;
  retryable?: boolean;
  remediable?: boolean;
  allocation_uid?: string;
  actions?: HostedManagedDatabaseActions;
}

export interface HostedManagedDatabaseCredentialsRevealResponse {
  allocation_uid: string;
  connection_uid?: string | null;
  credential?: HostedManagedDatabaseCredential | null;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl_mode: string;
  default_schema: string;
  password: string;
  connection_url: string;
}

export interface OrganizationActivePlanItem {
  item_id: number;
  plan_type: string;
  plan_label: string;
  quantity: number;
  assigned: number;
  remaining: number;
  is_full: boolean;
}

export interface OrganizationActivePlanAssignment {
  item_id: number;
  label: string;
}

export interface OrganizationActivePlanUser {
  user_id: number;
  email: string;
  display_name: string;
  assigned: OrganizationActivePlanAssignment[];
}

export interface OrganizationActivePlansResponse {
  has_subscription: boolean;
  items: OrganizationActivePlanItem[];
  users: OrganizationActivePlanUser[];
}

export interface OrganizationActivePlanAssignmentUpdateResponse {
  detail: string;
  action: "assign" | "remove";
  user_id: number;
  item_id: number;
}

export interface OrganizationActivePlanAssignmentUpgradeRequiredErrorPayload {
  code: "organization_plan_assignment_upgrade_required";
  title: string;
  detail: string;
  action: string;
  required_entitlement: string;
  upgrade: OrganizationSubscriptionSeatsUpgradeInfo | null;
}

export interface OrganizationSubscriptionSeatsSubscription {
  stripe_subscription_id: string | null;
  status: string | null;
  status_display: string | null;
}

export interface OrganizationSubscriptionSeatsPlanRow {
  plan_type: string;
  label: string;
  current_qty: number;
  assigned_qty: number;
  min_qty: number;
}

export interface OrganizationSubscriptionSeatsResponse {
  has_subscription: boolean;
  subscription: OrganizationSubscriptionSeatsSubscription | null;
  plan_rows: OrganizationSubscriptionSeatsPlanRow[];
}

export interface OrganizationSubscriptionSeatsUpdateResponse {
  detail: string;
  mode: "redirect" | "updated";
  redirect_url: string | null;
}

export interface OrganizationSubscriptionSeatsUpgradeInfo {
  required: boolean;
  reason: string;
  message: string;
}

export interface OrganizationSubscriptionSeatsUpgradeRequiredErrorPayload {
  code: "organization_seat_management_upgrade_required";
  title: string;
  detail: string;
  action: string;
  required_entitlement: string;
  upgrade: OrganizationSubscriptionSeatsUpgradeInfo | null;
}

export interface OrganizationCreditsAutoReloadConfig {
  enabled: boolean;
  threshold_cents: number;
  reload_amount_cents: number;
  monthly_limit_cents: number;
  currency: string;
  has_payment_method: boolean;
}

export interface OrganizationCreditsActionDescriptor {
  method: string;
  url: string;
  label: string;
}

export interface OrganizationCreditsFormFieldChoice {
  value: string | number | boolean;
  label: string;
}

export interface OrganizationCreditsFormFieldDescriptor {
  name: string;
  label?: string;
  help_text?: string;
  required?: boolean;
  type?: string;
  initial?: unknown;
  choices?: OrganizationCreditsFormFieldChoice[];
}

export interface OrganizationCreditsFormDescriptor {
  method: string;
  url: string;
  fields: OrganizationCreditsFormFieldDescriptor[];
}

export interface OrganizationCreditsPolicy {
  id: number;
  organization_id: number;
  user_id: number;
  is_enabled: boolean;
  mode: "allocated" | "organization_pool" | "disabled" | string;
  monthly_limit_cents: number;
  allocated_cents: number;
  auto_reload_enabled: boolean;
  auto_reload_threshold_cents: number;
  auto_reload_amount_cents: number;
  auto_reload_monthly_limit_cents: number;
  currency: string;
}

export interface UserCreditsState {
  organization_id: number;
  user_id: number;
  user_balance_cents: number;
  organization_balance_cents: number;
  available_cents: number;
  currency: string;
  has_spendable_credits: boolean;
  policy: OrganizationCreditsPolicy | null;
}

export interface CreditPeriod {
  start: string;
  end: string;
  timezone: string;
}

export interface UserCreditSummaryBudget {
  spent_this_period_cents: number;
  monthly_limit_cents: number | null;
  remaining_monthly_limit_cents: number | null;
  available_cents: number;
  currency: string;
}

export interface OrganizationCreditConsumptionSummary {
  user_attributed_cents: number;
  organization_shared_cents: number;
  unresolved_cents: number;
  total_cents: number;
  consumer_count: number;
  currency: string;
}

export interface UserCreditSummary {
  period: CreditPeriod;
  user_budget: UserCreditSummaryBudget;
  organization_consumption?: OrganizationCreditConsumptionSummary;
}

export interface OrganizationCreditsCheckoutInput {
  amount_cents: number;
  success_url: string;
  cancel_url: string;
  idempotency_key: string;
}

export interface OrganizationCreditsCheckoutResponse {
  checkout_session_id: string;
  checkout_url: string;
  credit_transaction_id: number;
  amount_cents: number;
  currency: string;
  idempotent_replay: boolean;
}

export interface OrganizationCreditsAutoReloadUpdateInput {
  enabled: boolean;
  threshold_cents: number;
  reload_amount_cents: number;
  monthly_limit_cents: number;
  currency: string;
  stripe_payment_method_id?: string;
}

export interface OrganizationCreditsUserPolicyUpdateInput {
  is_enabled: boolean;
  mode: "allocated" | "organization_pool" | "disabled";
  monthly_limit_cents: number;
  auto_reload_enabled: boolean;
  auto_reload_threshold_cents: number;
  auto_reload_amount_cents: number;
  auto_reload_monthly_limit_cents: number;
  currency: string;
}

export interface OrganizationCreditsUserAllocateInput {
  amount_cents: number;
  reference?: string;
  description?: string;
}

export interface OrganizationCreditsResponse {
  organization_id: number;
  organization_uid?: string;
  balance_cents: number;
  currency: string;
  has_spendable_credits: boolean;
  auto_reload: OrganizationCreditsAutoReloadConfig;
  actions?: {
    refresh_balance?: OrganizationCreditsActionDescriptor;
    purchase_checkout?: OrganizationCreditsActionDescriptor;
    update_auto_reload?: OrganizationCreditsActionDescriptor;
    load_auto_reload?: OrganizationCreditsActionDescriptor;
    list_user_credits?: OrganizationCreditsActionDescriptor;
  };
  forms?: {
    purchase_checkout?: OrganizationCreditsFormDescriptor;
    auto_reload?: OrganizationCreditsFormDescriptor;
  };
}

export type OrganizationLoginSessionAuthSource = "django_session" | "jwt";

export interface OrganizationLoginSessionUserSummary {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface OrganizationLoginSessionRecord {
  id: number;
  user: OrganizationLoginSessionUserSummary;
  login_time: string;
  last_seen_at: string | null;
  last_refresh_at: string | null;
  logout_time: string | null;
  revoked_at: string | null;
  revoked_reason: string;
  ip_address: string | null;
  user_agent: string;
  device_label: string;
  auth_source: OrganizationLoginSessionAuthSource | string;
  is_active: boolean;
  is_revoked: boolean;
}

export interface OrganizationLoginSessionsPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: OrganizationLoginSessionRecord[];
}

interface CurrentUserDetailsPayload {
  organization?: {
    uid?: string;
  };
}

export function isAdminRequestError(error: unknown): error is AdminRequestError {
  return error instanceof AdminRequestError;
}

export async function listOrganizationUsers({
  limit,
  offset,
  search,
}: {
  limit?: number;
  offset?: number;
  search?: string;
} = {}): Promise<AccessRbacUsersPage> {
  return listAccessRbacUsersPage({
    limit,
    offset,
    search,
    excludePodUsers: true,
    frontEndList: true,
  });
}

export async function listGithubOrganizations({
  limit,
  offset,
  search,
}: {
  limit?: number;
  offset?: number;
  search?: string;
} = {}): Promise<GithubOrganizationsPage> {
  const payload = await requestAdminJson<
    PaginatedResponse<GithubOrganizationRecord> | GithubOrganizationRecord[]
  >("/orm/api/pods/github-organization/", undefined, {
    limit,
    offset,
    search,
  });

  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      next: null,
      previous: null,
      results: payload,
    };
  }

  return {
    count: typeof payload.count === "number" ? payload.count : (payload.results ?? []).length,
    next: payload.next ?? null,
    previous: payload.previous ?? null,
    results: payload.results ?? [],
  };
}

export function listBillingInvoices({
  startingAfter,
  originUrl,
}: {
  startingAfter?: string;
  originUrl?: string;
} = {}) {
  return requestAdminJson<BillingInvoicesResponse>(
    "/orm/api/pods/billing/invoices/",
    {
      method: "GET",
    },
    {
      starting_after: startingAfter,
      origin_url: originUrl,
    },
  );
}

export function listBillingUsage({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  return requestAdminJson<BillingUsageResponse>(
    "/orm/api/pods/billing/usage/",
    {
      method: "GET",
    },
    {
      start_date: startDate,
      end_date: endDate,
    },
  );
}

const hostedManagedDatabasesBasePath =
  "/orm/api/connections/mainsequence-hosted/billing/hosted-resources/databases/";

type HostedManagedDatabasesPayload =
  | HostedManagedDatabaseAllocation[]
  | (PaginatedResponse<HostedManagedDatabaseAllocation> & {
      resource_kind?: string;
      items?: HostedManagedDatabaseAllocation[];
      databases?: HostedManagedDatabaseAllocation[];
      rows?: HostedManagedDatabaseAllocation[];
    });

function normalizeHostedManagedDatabasesPayload(
  payload: HostedManagedDatabasesPayload,
): HostedManagedDatabasesResponse {
  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      results: payload,
    };
  }

  const results =
    payload.results ??
    payload.items ??
    payload.databases ??
    payload.rows ??
    [];

  return {
    resource_kind: payload.resource_kind,
    count: typeof payload.count === "number" ? payload.count : results.length,
    results,
  };
}

export function listHostedManagedDatabasePlans() {
  return requestAdminJson<HostedManagedDatabaseCatalogResponse>(
    `${hostedManagedDatabasesBasePath}plans/`,
    {
      method: "GET",
    },
  );
}

export function createHostedManagedDatabase(payload: HostedManagedDatabaseCreateInput) {
  return requestAdminJson<HostedManagedDatabaseCreateResponse>(hostedManagedDatabasesBasePath, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listHostedManagedDatabases() {
  const payload = await requestAdminJson<HostedManagedDatabasesPayload>(
    hostedManagedDatabasesBasePath,
    {
      method: "GET",
    },
  );

  return normalizeHostedManagedDatabasesPayload(payload);
}

export function getHostedManagedDatabase(allocationUid: string) {
  return requestAdminJson<HostedManagedDatabaseAllocation>(
    `${hostedManagedDatabasesBasePath}${encodeURIComponent(allocationUid)}/`,
    {
      method: "GET",
    },
  );
}

export function updateHostedManagedDatabase(
  allocationUid: string,
  payload: HostedManagedDatabasePatchInput,
) {
  return requestAdminJson<HostedManagedDatabaseAllocation>(
    `${hostedManagedDatabasesBasePath}${encodeURIComponent(allocationUid)}/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function buildHostedManagedDatabaseCancelNowPath(allocationUid: string) {
  return `${hostedManagedDatabasesBasePath}${encodeURIComponent(allocationUid)}/cancel-now/`;
}

export function revealHostedManagedDatabaseCredentials(path: string) {
  return requestAdminJson<HostedManagedDatabaseCredentialsRevealResponse>(path, {
    method: "POST",
  });
}

export function rotateHostedManagedDatabaseCredentials(path: string) {
  return requestAdminJson<HostedManagedDatabaseCredentialsRevealResponse>(path, {
    method: "POST",
  });
}

export function cancelHostedManagedDatabaseNow(path: string) {
  return requestAdminJson<unknown>(path, {
    method: "POST",
  });
}

export async function fetchCurrentOrganizationUid() {
  const payload = await requestAdminJson<CurrentUserDetailsPayload>("/user/api/user/get_user_details/");
  const organizationUid = payload.organization?.uid;

  if (typeof organizationUid !== "string" || !organizationUid.trim()) {
    throw new Error("Current organization uid is not available.");
  }

  return organizationUid.trim();
}

export function listOrganizationActivePlans(organizationUid: string) {
  return requestAdminJson<OrganizationActivePlansResponse>(
    `/user/api/organization/${encodeURIComponent(organizationUid)}/active-plans/`,
    {
      method: "GET",
    },
  );
}

export function listOrganizationSubscriptionSeats(organizationUid: string) {
  return requestAdminJson<OrganizationSubscriptionSeatsResponse>(
    `/user/api/organization/${encodeURIComponent(organizationUid)}/subscription-seats/`,
    {
      method: "GET",
    },
  );
}

export function buildOrganizationCreditsPath(organizationUid: string) {
  return `/user/api/organization/${encodeURIComponent(organizationUid)}/credits/`;
}

export function buildOrganizationCreditsCheckoutPath(organizationUid: string) {
  return `/user/api/organization/${encodeURIComponent(organizationUid)}/credits/checkout/`;
}

export function buildOrganizationCreditsAutoReloadPath(organizationUid: string) {
  return `/user/api/organization/${encodeURIComponent(organizationUid)}/credits/auto-reload/`;
}

export function buildOrganizationCreditsUsersPath(organizationUid: string) {
  return `/user/api/organization/${encodeURIComponent(organizationUid)}/credits/users/`;
}

export function buildOrganizationCreditUserPolicyPath(
  organizationUid: string,
  userId: number,
) {
  return `/user/api/organization/${encodeURIComponent(organizationUid)}/credits/users/${encodeURIComponent(String(userId))}/policy/`;
}

export function buildOrganizationCreditUserAllocatePath(
  organizationUid: string,
  userId: number,
) {
  return `/user/api/organization/${encodeURIComponent(organizationUid)}/credits/users/${encodeURIComponent(String(userId))}/allocate/`;
}

export function getOrganizationCredits(organizationUid: string) {
  return requestAdminJson<OrganizationCreditsResponse>(
    buildOrganizationCreditsPath(organizationUid),
    {
      method: "GET",
    },
  );
}

export function getCurrentUserCredits() {
  return requestAdminJson<UserCreditsState>("/user/api/user/credits/", {
    method: "GET",
  });
}

export function getCurrentUserCreditsSummary() {
  return requestAdminJson<UserCreditSummary>("/user/api/user/credits/summary/", {
    method: "GET",
  });
}

export function loadOrganizationCreditsAutoReload(path: string) {
  return requestAdminJson<OrganizationCreditsAutoReloadConfig>(path, {
    method: "GET",
  });
}

export function submitOrganizationCreditsCheckout(
  path: string,
  payload: OrganizationCreditsCheckoutInput,
) {
  return requestAdminJson<OrganizationCreditsCheckoutResponse>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateOrganizationCreditsAutoReload(
  path: string,
  payload: OrganizationCreditsAutoReloadUpdateInput,
) {
  return requestAdminJson<OrganizationCreditsAutoReloadConfig>(path, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function listOrganizationUserCredits(path: string) {
  return requestAdminJson<UserCreditsState[]>(path, {
    method: "GET",
  });
}

export function updateOrganizationUserCreditPolicy(
  organizationUid: string,
  userId: number,
  payload: OrganizationCreditsUserPolicyUpdateInput,
) {
  return requestAdminJson<OrganizationCreditsPolicy>(
    buildOrganizationCreditUserPolicyPath(organizationUid, userId),
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export function allocateOrganizationUserCredits(
  organizationUid: string,
  userId: number,
  payload: OrganizationCreditsUserAllocateInput,
) {
  return requestAdminJson<UserCreditsState>(
    buildOrganizationCreditUserAllocatePath(organizationUid, userId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function submitOrganizationSubscriptionSeatsUpdate({
  organizationUid,
  seatTotals,
  successUrl,
  cancelUrl,
}: {
  organizationUid: string;
  seatTotals: Record<string, number>;
  successUrl: string;
  cancelUrl: string;
}) {
  return requestAdminJson<OrganizationSubscriptionSeatsUpdateResponse>(
    `/user/api/organization/${encodeURIComponent(organizationUid)}/subscription-seats/`,
    {
      method: "POST",
      body: JSON.stringify({
        seat_totals: seatTotals,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    },
  );
}

export function resolveAdminBrowserUrl(path: string) {
  return buildEndpointUrl(path);
}

export function updateOrganizationActivePlanAssignment(
  organizationUid: string,
  userId: number,
  payload:
    | {
        assign_item_id: number;
      }
    | {
        remove_item_id: number;
      },
) {
  return requestAdminJson<OrganizationActivePlanAssignmentUpdateResponse>(
    `/user/api/organization/${encodeURIComponent(organizationUid)}/active-plans/${encodeURIComponent(
      String(userId),
    )}/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function listOrganizationLoginSessions(
  organizationUid: string,
  {
    limit,
    offset,
    search,
    userId,
    authSource,
    isActive,
    isRevoked,
  }: {
    limit?: number;
    offset?: number;
    search?: string;
    userId?: number;
    authSource?: OrganizationLoginSessionAuthSource;
    isActive?: boolean;
    isRevoked?: boolean;
  } = {},
) {
  return requestAdminJson<OrganizationLoginSessionsPage>(
    `/user/api/organization/${encodeURIComponent(organizationUid)}/login-sessions/`,
    {
      method: "GET",
    },
    {
      limit,
      offset,
      search,
      user_id: userId,
      auth_source: authSource,
      is_active: isActive,
      is_revoked: isRevoked,
    },
  );
}

export function revokeOrganizationLoginSession(
  organizationUid: string,
  sessionId: number,
) {
  return requestAdminJson<OrganizationLoginSessionRecord>(
    `/user/api/organization/${encodeURIComponent(organizationUid)}/login-sessions/${encodeURIComponent(String(sessionId))}/revoke/`,
    {
      method: "POST",
    },
  );
}

export function startGithubOrganizationConnect(organizationUid: string) {
  return requestAdminJson<GithubOrganizationConnectStartResponse>(
    `/orm/api/pods/github-organization/connect/start/${encodeURIComponent(organizationUid)}/`,
    {
      method: "GET",
    },
  );
}

export function bulkDeleteGithubOrganizations(selectedUids: string[]) {
  return requestAdminJson<GithubOrganizationBulkDeleteResponse>(
    "/orm/api/pods/github-organization/bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        selected_uids: selectedUids,
      }),
    },
  );
}

function normalizeGithubRepositoryRecord(value: unknown): GithubOrganizationRepositoryRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const githubRepositoryId =
    typeof record.github_repository_id === "number"
      ? record.github_repository_id
      : typeof record.github_repository_id === "string"
        ? Number(record.github_repository_id)
        : NaN;
  const fullName =
    (typeof record.full_name === "string" && record.full_name.trim()) ||
    (typeof record.fullName === "string" && record.fullName.trim()) ||
    "";
  const name =
    (typeof record.name === "string" && record.name.trim()) ||
    fullName.split("/").at(-1)?.trim() ||
    "";

  if (!name || !Number.isFinite(githubRepositoryId) || githubRepositoryId <= 0) {
    return null;
  }

  return {
    github_repository_id: githubRepositoryId,
    name,
    full_name: fullName || undefined,
    clone_url:
      typeof record.clone_url === "string" && record.clone_url.trim() ? record.clone_url.trim() : null,
    ssh_url: typeof record.ssh_url === "string" && record.ssh_url.trim() ? record.ssh_url.trim() : null,
    default_branch:
      typeof record.default_branch === "string" && record.default_branch.trim()
        ? record.default_branch.trim()
        : typeof record.defaultBranch === "string" && record.defaultBranch.trim()
          ? record.defaultBranch.trim()
          : null,
    is_private:
      typeof record.is_private === "boolean"
        ? record.is_private
        : typeof record.private === "boolean"
          ? record.private
          : false,
    existing_git_repository_uid:
      typeof record.existing_git_repository_uid === "string" &&
      record.existing_git_repository_uid.trim()
        ? record.existing_git_repository_uid.trim()
        : null,
    existing_project_uid:
      typeof record.existing_project_uid === "string" && record.existing_project_uid.trim()
        ? record.existing_project_uid.trim()
        : null,
    suggested_project_name:
      typeof record.suggested_project_name === "string" && record.suggested_project_name.trim()
        ? record.suggested_project_name.trim()
        : null,
  };
}

function normalizeGithubRepositoryPayload(payload: unknown): GithubOrganizationRepositoryListResponse {
  const candidates = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? [
          (payload as Record<string, unknown>).repositories,
          (payload as Record<string, unknown>).repos,
          (payload as Record<string, unknown>).results,
          (payload as Record<string, unknown>).items,
          (payload as Record<string, unknown>).project_names,
        ].find(Array.isArray) ?? []
      : [];

  const repositories = (Array.isArray(candidates) ? candidates : [])
    .map((entry) => normalizeGithubRepositoryRecord(entry))
    .filter((entry): entry is GithubOrganizationRepositoryRecord => entry !== null);

  return { repositories };
}

export async function listGithubOrganizationRepositories(organizationUid: string) {
  const payload = await requestAdminJson<unknown>(
    `/orm/api/pods/github-organization/${encodeURIComponent(organizationUid)}/repositories/`,
    {
      method: "GET",
    },
  );

  return normalizeGithubRepositoryPayload(payload);
}

export function importGithubOrganizationRepositories(
  organizationUid: string,
  repositories: GithubOrganizationImportRepositoryInput[],
) {
  return requestAdminJson<GithubOrganizationImportRepositoriesResponse>(
    `/orm/api/pods/github-organization/${encodeURIComponent(organizationUid)}/repositories/import/`,
    {
      method: "POST",
      body: JSON.stringify({
        repositories,
      }),
    },
  );
}

export function createOrganizationUser(
  organizationUid: string,
  payload: OrganizationUserCreateInput,
) {
  return requestAdminJson<OrganizationUserCreateResponse>(
    `/user/api/organization/${encodeURIComponent(organizationUid)}/users/add/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function bulkDeleteUsers(selectedUids: string[]) {
  return requestAdminJson<UserBulkDeleteResponse>("/user/api/user/bulk-delete/", {
    method: "POST",
    body: JSON.stringify({
      selected_uids: selectedUids,
    }),
  });
}

export function makeSelectedUsersAdministrators(selectedUids: string[]) {
  return requestAdminJson<UserBulkOrgAdminActionResponse>("/user/api/user/make-org-admins/", {
    method: "POST",
    body: JSON.stringify({
      selected_uids: selectedUids,
    }),
  });
}

export function removeSelectedUsersAsAdministrators(selectedUids: string[]) {
  return requestAdminJson<UserBulkOrgAdminActionResponse>("/user/api/user/remove-org-admins/", {
    method: "POST",
    body: JSON.stringify({
      selected_uids: selectedUids,
    }),
  });
}
