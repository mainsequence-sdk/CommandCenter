import {
  listAccessRbacUsersPage,
  type AccessRbacUsersPage,
} from "@/extensions/core/apps/access-rbac/api";
import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import type { EntitySummaryHeader } from "../../../../../extensions/main_sequence/common/api";

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

    if (session?.token) {
      headers.set("Authorization", `${session.tokenType ?? "Bearer"} ${session.token}`);
    }

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
  groups: string[];
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
  id: number;
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

export interface GithubOrganizationImportProjectsResponse {
  detail: string;
  matched_count: number;
  created_count: number;
  project_names: string[];
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

export type BillingSummaryResponse = EntitySummaryHeader;

export interface BillingUsageRow {
  usage_start_time: string;
  usage_end_time: string;
  source_type: string;
  source_object: string;
  total_cost: string;
  is_estimate_state: boolean;
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
    id?: number;
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

export function getBillingSummary() {
  return requestAdminJson<BillingSummaryResponse>(
    "/orm/api/pods/billing/summary/",
    {
      method: "GET",
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

export async function fetchCurrentOrganizationId() {
  const payload = await requestAdminJson<CurrentUserDetailsPayload>("/user/api/user/get_user_details/");
  const organizationId = payload.organization?.id;

  if (typeof organizationId !== "number" || !Number.isFinite(organizationId) || organizationId <= 0) {
    throw new Error("Current organization id is not available.");
  }

  return organizationId;
}

export function listOrganizationActivePlans(organizationId: number) {
  return requestAdminJson<OrganizationActivePlansResponse>(
    `/user/api/organization/${encodeURIComponent(String(organizationId))}/active-plans/`,
    {
      method: "GET",
    },
  );
}

export function listOrganizationSubscriptionSeats(organizationId: number) {
  return requestAdminJson<OrganizationSubscriptionSeatsResponse>(
    `/user/api/organization/${encodeURIComponent(String(organizationId))}/subscription-seats/`,
    {
      method: "GET",
    },
  );
}

export function buildOrganizationCreditsPath(organizationId: number) {
  return `/user/api/organization/${encodeURIComponent(String(organizationId))}/credits/`;
}

export function buildOrganizationCreditsCheckoutPath(organizationId: number) {
  return `/user/api/organization/${encodeURIComponent(String(organizationId))}/credits/checkout/`;
}

export function buildOrganizationCreditsAutoReloadPath(organizationId: number) {
  return `/user/api/organization/${encodeURIComponent(String(organizationId))}/credits/auto-reload/`;
}

export function buildOrganizationCreditsUsersPath(organizationId: number) {
  return `/user/api/organization/${encodeURIComponent(String(organizationId))}/credits/users/`;
}

export function buildOrganizationCreditUserPolicyPath(
  organizationId: number,
  userId: number,
) {
  return `/user/api/organization/${encodeURIComponent(String(organizationId))}/credits/users/${encodeURIComponent(String(userId))}/policy/`;
}

export function buildOrganizationCreditUserAllocatePath(
  organizationId: number,
  userId: number,
) {
  return `/user/api/organization/${encodeURIComponent(String(organizationId))}/credits/users/${encodeURIComponent(String(userId))}/allocate/`;
}

export function getOrganizationCredits(organizationId: number) {
  return requestAdminJson<OrganizationCreditsResponse>(
    buildOrganizationCreditsPath(organizationId),
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
  organizationId: number,
  userId: number,
  payload: OrganizationCreditsUserPolicyUpdateInput,
) {
  return requestAdminJson<OrganizationCreditsPolicy>(
    buildOrganizationCreditUserPolicyPath(organizationId, userId),
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export function allocateOrganizationUserCredits(
  organizationId: number,
  userId: number,
  payload: OrganizationCreditsUserAllocateInput,
) {
  return requestAdminJson<UserCreditsState>(
    buildOrganizationCreditUserAllocatePath(organizationId, userId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function submitOrganizationSubscriptionSeatsUpdate({
  organizationId,
  seatTotals,
  successUrl,
  cancelUrl,
}: {
  organizationId: number;
  seatTotals: Record<string, number>;
  successUrl: string;
  cancelUrl: string;
}) {
  return requestAdminJson<OrganizationSubscriptionSeatsUpdateResponse>(
    `/user/api/organization/${encodeURIComponent(String(organizationId))}/subscription-seats/`,
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
  organizationId: number,
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
    `/user/api/organization/${encodeURIComponent(String(organizationId))}/active-plans/${encodeURIComponent(
      String(userId),
    )}/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function listOrganizationLoginSessions(
  organizationId: number,
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
    `/user/api/organization/${encodeURIComponent(String(organizationId))}/login-sessions/`,
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
  organizationId: number,
  sessionId: number,
) {
  return requestAdminJson<OrganizationLoginSessionRecord>(
    `/user/api/organization/${encodeURIComponent(String(organizationId))}/login-sessions/${encodeURIComponent(String(sessionId))}/revoke/`,
    {
      method: "POST",
    },
  );
}

export function startGithubOrganizationConnect(orgId: number) {
  return requestAdminJson<GithubOrganizationConnectStartResponse>(
    `/orm/api/pods/github-organization/connect/start/${encodeURIComponent(String(orgId))}/`,
    {
      method: "GET",
    },
  );
}

export function bulkDeleteGithubOrganizations(selectedIds: number[]) {
  return requestAdminJson<GithubOrganizationBulkDeleteResponse>(
    "/orm/api/pods/github-organization/bulk-delete/",
    {
      method: "POST",
      body: JSON.stringify({
        ids: selectedIds,
      }),
    },
  );
}

export function importGithubOrganizationProjects(selectedIds: number[]) {
  return requestAdminJson<GithubOrganizationImportProjectsResponse>(
    "/orm/api/pods/github-organization/import-projects/",
    {
      method: "POST",
      body: JSON.stringify({
        ids: selectedIds,
      }),
    },
  );
}

export function createOrganizationUser(
  organizationId: number,
  payload: OrganizationUserCreateInput,
) {
  return requestAdminJson<OrganizationUserCreateResponse>(
    `/user/api/organization/${encodeURIComponent(String(organizationId))}/users/add/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function bulkDeleteUsers(selectedIds: number[]) {
  return requestAdminJson<UserBulkDeleteResponse>("/user/api/user/bulk-delete/", {
    method: "POST",
    body: JSON.stringify({
      selected_ids: selectedIds,
    }),
  });
}

export function makeSelectedUsersAdministrators(selectedIds: number[]) {
  return requestAdminJson<UserBulkOrgAdminActionResponse>("/user/api/user/make-org-admins/", {
    method: "POST",
    body: JSON.stringify({
      selected_ids: selectedIds,
    }),
  });
}

export function removeSelectedUsersAsAdministrators(selectedIds: number[]) {
  return requestAdminJson<UserBulkOrgAdminActionResponse>("/user/api/user/remove-org-admins/", {
    method: "POST",
    body: JSON.stringify({
      selected_ids: selectedIds,
    }),
  });
}
