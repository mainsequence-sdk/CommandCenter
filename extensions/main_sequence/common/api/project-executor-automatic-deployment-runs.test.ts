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
  deployProjectExecutorAgentService,
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

  it("deploys project executor agents with public project uid and no runtime image field", async () => {
    await deployProjectExecutorAgentService({
      project_uid: "project-public-uid",
      llm_provider: "openai",
      llm_model: "gpt-5.1",
      llm_thinking: "",
      cpu_request: "250m",
      cpu_limit: "1000m",
      memory_request: "512Mi",
      memory_limit: "2Gi",
      automatic_deployment: true,
      spot: true,
    });

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as Record<string, unknown>;

    expect(body.project_uid).toBe("project-public-uid");
    expect(body.runtime_image_uid).toBeUndefined();
    expect(body.project).toBeUndefined();
    expect(body.runtime_image).toBeUndefined();
  });

  it("posts project SDK updates without duplicating the pods path segment", async () => {
    const projectUid = "8c316329-c9ea-4c52-a13b-73979f86af4f";

    await updateProjectSdk(projectUid);

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = String(requestUrl);

    expect(url).toContain(`/orm/api/pods/projects/${projectUid}/update-sdk/`);
    expect(url).not.toContain("/orm/api/pods/pods/");
  });
});
