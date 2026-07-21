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
  bulkDeleteProjectDataSources,
  bulkDeleteJobs,
  deployAstroCommandCenterAgentService,
  deployProjectExecutorAgentService,
  fetchAstroCommandCenterAgentServiceByUser,
  fetchProjectExecutorAgentServiceByProject,
  listDeploymentRuns,
  updateProjectSdk,
} from "./index";

describe("project executor deployment api", () => {
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

  it("fetches project-executor deployment runs through the unified pods endpoint", async () => {
    await listDeploymentRuns({
      targetType: "project_executor",
      limit: 20,
    });

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toBe("/orm/api/pods/deployment-runs/");
    expect(url.searchParams.get("target_type")).toBe("project_executor");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("ordering")).toBeNull();
    expect(url.searchParams.get("agent_uid")).toBeNull();
    expect(url.searchParams.get("created_by_user_uid")).toBeNull();
    expect(url.searchParams.get("created_by_user")).toBeNull();
  });

  it("fetches global deployment history without project or target filters", async () => {
    await listDeploymentRuns({
      limit: 25,
      offset: 50,
    });

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toBe("/orm/api/pods/deployment-runs/");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("offset")).toBe("50");
    expect(url.searchParams.get("project_uid")).toBeNull();
    expect(url.searchParams.get("target_type")).toBeNull();
    expect(url.searchParams.get("ordering")).toBeNull();
  });

  it("fetches project-scoped deployment runs with project_uid and target_type", async () => {
    await listDeploymentRuns({
      projectUid: "project-public-uid",
      targetType: "project_executor",
      limit: 20,
    });

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toBe("/orm/api/pods/deployment-runs/");
    expect(url.searchParams.get("project_uid")).toBe("project-public-uid");
    expect(url.searchParams.get("target_type")).toBe("project_executor");
    expect(url.searchParams.get("agent_uid")).toBeNull();
  });

  it("preserves unified target metadata from deployment run responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              uid: "run-public-uid",
              target_type: "project_executor",
              target: {
                uid: "agent-public-uid",
                name: "Project agent",
                kind: "project_executor",
              },
              project_uid: "project-public-uid",
              operation: "build_and_deploy",
              source: "manual",
              state: "running",
              phase: "waiting_project_image",
              error: null,
            },
          ],
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );

    const runs = await listDeploymentRuns({
      targetType: "project_executor",
      limit: 20,
    });

    expect(runs.results[0]?.target.uid).toBe("agent-public-uid");
    expect(runs.results[0]?.state).toBe("running");
    expect(runs.results[0]?.phase).toBe("waiting_project_image");
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
              service_runtime_uid: "runtime-uid",
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

  it("bulk deletes project data sources with selected_uids instead of the legacy uids body", async () => {
    await bulkDeleteProjectDataSources({
      uids: ["project-data-source-uid-1", "project-data-source-uid-2"],
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as Record<string, unknown>;

    expect(String(requestUrl)).toContain("/orm/api/ts_manager/dynamic_table_data_source/bulk-delete/");
    expect(body.selected_uids).toEqual([
      "project-data-source-uid-1",
      "project-data-source-uid-2",
    ]);
    expect(body.select_all).toBe(false);
    expect(body.uids).toBeUndefined();
  });
});
