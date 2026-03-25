import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";

const devAuthProxyPrefix = "/__command_center_auth__";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface TeamMemberRecord {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface TeamListRecord {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  organization: {
    id: number;
    name: string;
  } | null;
  created_by: TeamMemberRecord | null;
  member_count: number;
}

export interface TeamDetailRecord extends TeamListRecord {
  members: TeamMemberRecord[];
}

export interface CreateTeamInput {
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface ManageTeamMembersInput {
  action: "add" | "remove";
  user_ids: number[];
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

async function requestTeamJson<T>(
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
    throw new Error(readErrorMessage(payload) || `Team request failed with ${response.status}.`);
  }

  return payload as T;
}

function normalizeListPayload<T>(payload: PaginatedResponse<T> | T[]) {
  return Array.isArray(payload) ? payload : payload.results;
}

export async function listTeams({
  limit = 200,
  offset = 0,
  search,
}: {
  limit?: number;
  offset?: number;
  search?: string;
} = {}) {
  const payload = await requestTeamJson<PaginatedResponse<TeamListRecord> | TeamListRecord[]>(
    "/user/api/team/",
    undefined,
    { limit, offset, search },
  );

  return normalizeListPayload(payload);
}

export function fetchTeam(teamId: number) {
  return requestTeamJson<TeamDetailRecord>(`/user/api/team/${teamId}/`);
}

export function createTeam(input: CreateTeamInput) {
  return requestTeamJson<TeamDetailRecord>("/user/api/team/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteTeam(teamId: number) {
  return requestTeamJson<null>(`/user/api/team/${teamId}/`, {
    method: "DELETE",
  });
}

export async function fetchTeamMembers(teamId: number) {
  const payload = await requestTeamJson<PaginatedResponse<TeamMemberRecord> | TeamMemberRecord[]>(
    `/user/api/team/${teamId}/members/`,
  );

  return normalizeListPayload(payload);
}

export async function fetchTeamCandidateMembers(teamId: number) {
  const payload = await requestTeamJson<PaginatedResponse<TeamMemberRecord> | TeamMemberRecord[]>(
    `/user/api/team/${teamId}/candidate-members/`,
  );

  return normalizeListPayload(payload);
}

export function manageTeamMembers(teamId: number, input: ManageTeamMembersInput) {
  return requestTeamJson<{ team_id: number; member_count: number }>(
    `/user/api/team/${teamId}/manage-members/`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
