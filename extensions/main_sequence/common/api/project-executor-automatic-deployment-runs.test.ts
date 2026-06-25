import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({
  env: {
    apiBaseUrl: "http://main-sequence.test",
    debugMainSequence: "",
    useMockData: false,
    bypassAuth: false,
    debugChat: false,
    includeAui: true,
    includeWorkspaces: true,
  },
}));

vi.mock("@/dashboards/dashboard-request-trace", () => ({
  startDashboardRequestTrace: () => ({
    fail: vi.fn(),
    finish: vi.fn(),
  }),
}));

import {
  bulkDeleteJobs,
  deployAstroCommandCenterAgentService,
  deployProjectExecutorAgentService,
  fetchAstroCommandCenterAgentServiceByUser,
  fetchProjectExecutorAgentServiceByProject,
  fetchProjectExecutorAutomaticDeploymentRuns,
  updateProjectSdk,
} from "./index";

describe("project executor automatic deployment runs api", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ count: 0, next: null, previous: null, results: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches user-scoped deployment runs without created-by query params", async () => {
    await fetchProjectExecutorAutomaticDeploymentRuns({
      ordering: "-created_at",
      limit: 20,
    });

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = String(requestUrl);

    expect(url).toContain(
      "/orm/api/agents/v1/project-executor-automatic-deployment-runs/",
    );
    expect(url).toContain("ordering=-created_at");
    expect(url).toContain("limit=20");
    expect(url).not.toContain("created_by_user_uid=");
    expect(url).not.toContain("created_by_user=");
  });

  it("uses only public agent_uid when an agent filter is supplied", async () => {
    await fetchProjectExecutorAutomaticDeploymentRuns({
      agentUid: "agent-public-uid",
      ordering: "-created_at",
      limit: 20,
    });

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = String(requestUrl);

    expect(url).toContain("agent_uid=agent-public-uid");
    expect(url).not.toContain("created_by_user_uid=");
    expect(url).not.toContain("created_by_user=");
  });

  it("preserves top-level agent_uid from deployment run responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              uid: "run-public-uid",
              agent_uid: "agent-public-uid",
              status: "waiting_project_image",
              current_step: "wait_project_image",
              result: {},
              error_code: "",
              error_detail: "",
            },
          ],
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );

    const runs = await fetchProjectExecutorAutomaticDeploymentRuns();

    expect(runs[0]?.agent_uid).toBe("agent-public-uid");
  });

  it("deploys project executor agents through the generic coding service deploy endpoint", async () => {
    await deployProjectExecutorAgentService({
      project_uid: "project-public-uid",
      llm_provider: "openai",
      llm_model: "gpt-5.1",
      llm_thinking: "medium",
      cpu_request: "250m",
      cpu_limit: "1000m",
      memory_request: "512Mi",
      memory_limit: "2Gi",
      gpu_request: "0",
      gpu_type: "",
      automatic_deployment: true,
      spot: true,
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as Record<string, unknown>;

    expect(String(requestUrl)).toContain("/orm/api/agents/v1/coding-agent-services/deploy/");
    expect(body.agent_type).toBe("project-executor");
    expect(body.scope).toEqual({
      kind: "project",
      project_uid: "project-public-uid",
    });
    expect(body.llm_provider).toBe("openai");
    expect(body.llm_model).toBe("gpt-5.1");
    expect(body.llm_thinking).toBe("medium");
    expect(body.cpu_request).toBe("250m");
    expect(body.cpu_limit).toBe("1000m");
    expect(body.memory_request).toBe("512Mi");
    expect(body.memory_limit).toBe("2Gi");
    expect(body.gpu_request).toBe("0");
    expect(body.gpu_type).toBe("");
    expect(body.automatic_deployment).toBe(true);
    expect(body.spot).toBe(true);
    expect(body.project_uid).toBeUndefined();
    expect(body.runtime_image_uid).toBeUndefined();
    expect(body.project).toBeUndefined();
    expect(body.runtime_image).toBeUndefined();
  });

  it("deploys Astro through the generic coding service deploy endpoint with user scope", async () => {
    await deployAstroCommandCenterAgentService({
      llm_provider: "openai",
      llm_model: "gpt-5",
      llm_thinking: "medium",
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as Record<string, unknown>;

    expect(String(requestUrl)).toContain("/orm/api/agents/v1/coding-agent-services/deploy/");
    expect(body).toEqual({
      agent_type: "astro-orchestrator",
      scope: {
        kind: "user",
      },
      llm_provider: "openai",
      llm_model: "gpt-5",
      llm_thinking: "medium",
    });
  });

  it("omits Astro model configuration from deploy when defaults are unavailable", async () => {
    await deployAstroCommandCenterAgentService();

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as Record<string, unknown>;

    expect(body).toEqual({
      agent_type: "astro-orchestrator",
      scope: {
        kind: "user",
      },
    });
  });

  it("looks up Astro deployment through the filtered coding-agent service list", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              uid: "coding-agent-service-uid",
              agent_uid: "astro-agent-uid",
              agent_type: "astro-orchestrator",
              scope: {
                kind: "user",
                user_uid: "e2a4f38a-1b5f-40a3-974f-70bc8f065b3f",
              },
              knative_service_runtime_uid: "runtime-uid",
              is_ready: true,
              image_drift: {},
              automatic_deployment: true,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const service = await fetchAstroCommandCenterAgentServiceByUser(
      "e2a4f38a-1b5f-40a3-974f-70bc8f065b3f",
    );

    expect(service?.agent_uid).toBe("astro-agent-uid");
    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(requestUrl));
    expect(url.pathname).toBe("/orm/api/agents/v1/coding-agent-services/");
    expect(url.searchParams.get("agent_type")).toBe("astro-orchestrator");
    expect(url.searchParams.get("scope_kind")).toBe("user");
    expect(url.searchParams.get("user_uid")).toBe(
      "e2a4f38a-1b5f-40a3-974f-70bc8f065b3f",
    );
  });

  it("returns null when the Astro deployment list is empty", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ count: 0, next: null, previous: null, results: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    await expect(
      fetchAstroCommandCenterAgentServiceByUser("e2a4f38a-1b5f-40a3-974f-70bc8f065b3f"),
    ).resolves.toBeNull();
  });

  it("looks up project executor deployment through the filtered coding-agent service list", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              uid: "coding-agent-service-uid",
              agent_uid: "project-agent-uid",
              agent_type: "project-executor",
              scope: {
                kind: "project",
                project_uid: "8c316329-c9ea-4c52-a13b-73979f86af4f",
              },
              cpu_request: "500m",
              memory_request: "1Gi",
              automatic_deployment: true,
              is_ready: true,
              subdomain: "project-agent",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const service = await fetchProjectExecutorAgentServiceByProject(
      "8c316329-c9ea-4c52-a13b-73979f86af4f",
    );

    expect(service?.agent_uid).toBe("project-agent-uid");
    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(requestUrl));
    expect(url.pathname).toBe("/orm/api/agents/v1/coding-agent-services/");
    expect(url.searchParams.get("agent_type")).toBe("project-executor");
    expect(url.searchParams.get("scope_kind")).toBe("project");
    expect(url.searchParams.get("project_uid")).toBe(
      "8c316329-c9ea-4c52-a13b-73979f86af4f",
    );
  });

  it("posts project SDK updates without duplicating the pods path segment", async () => {
    const projectUid = "8c316329-c9ea-4c52-a13b-73979f86af4f";

    await updateProjectSdk(projectUid);

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = String(requestUrl);

    expect(url).toContain(`/orm/api/pods/projects/${projectUid}/update-sdk/`);
    expect(url).not.toContain("/orm/api/pods/pods/");
  });

  it("bulk deletes jobs with selected_uids instead of the legacy uids body", async () => {
    await bulkDeleteJobs(["job-uid-1", "job-uid-2"]);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as Record<string, unknown>;

    expect(String(requestUrl)).toContain("/orm/api/pods/job/bulk-delete/");
    expect(body.selected_uids).toEqual(["job-uid-1", "job-uid-2"]);
    expect(body.select_all).toBe(false);
    expect(body.uids).toBeUndefined();
  });
});
