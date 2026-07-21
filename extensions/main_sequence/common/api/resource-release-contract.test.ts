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
  createResourceRelease,
  deployResourceReleaseCurrentVersion,
  deployStaticSiteCurrentVersion,
  fetchDeploymentRun,
  fetchDeploymentRunLogs,
  fetchResourceReleaseExchangeLaunch,
  fetchStaticSiteCapabilities,
  listDeploymentRuns,
  listResourceReleases,
  requireStaticSiteExchangeLaunchUrl,
  updateResourceRelease,
} from "./index";

describe("resource release contract api", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          uid: "2f4c4c3d-5669-4da5-9d86-b84633c1e6ed",
          subdomain: "analytics-123",
          resource_uid: "857bec7b-dd77-4272-aecd-13fc2138eacc",
          readme_resource_uid: null,
          related_job_uid: "7d0ab07c-d1c0-4b7f-9c69-3c1a41c0a4da",
          release_kind: "streamlit_dashboard",
          automatic_deployment: true,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates resource releases with uid fields and the boolean deployment policy", async () => {
    await createResourceRelease({
      release_kind: "streamlit_dashboard",
      resource_uid: "857bec7b-dd77-4272-aecd-13fc2138eacc",
      related_image_uid: "6cfdb152-923e-45b9-a150-c4541c68b0d1",
      cpu_request: "500m",
      memory_request: "1Gi",
      spot: false,
      automatic_deployment: true,
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as Record<string, unknown>;

    expect(String(requestUrl)).toContain("/orm/api/pods/resource-release/");
    expect(requestInit?.method).toBe("POST");
    expect(body).toEqual({
      release_kind: "streamlit_dashboard",
      resource_uid: "857bec7b-dd77-4272-aecd-13fc2138eacc",
      related_image_uid: "6cfdb152-923e-45b9-a150-c4541c68b0d1",
      cpu_request: "500m",
      memory_request: "1Gi",
      gpu_request: null,
      gpu_type: null,
      spot: false,
      automatic_deployment: true,
    });
    expect(body.resource).toBeUndefined();
    expect(body.related_image).toBeUndefined();
  });

  it("lists resource releases with the project_uid filter", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ count: 0, next: null, previous: null, results: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );

    await listResourceReleases({
      limit: 500,
      offset: 0,
      projectUid: "9d81d63f-b8c9-404d-9f1a-5f2ad29dbf16",
    });

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toBe("/orm/api/pods/resource-release/");
    expect(url.searchParams.get("limit")).toBe("500");
    expect(url.searchParams.get("offset")).toBe("0");
    expect(url.searchParams.get("project_uid")).toBe(
      "9d81d63f-b8c9-404d-9f1a-5f2ad29dbf16",
    );
  });

  it("patches only automatic_deployment on existing releases", async () => {
    await updateResourceRelease("2f4c4c3d-5669-4da5-9d86-b84633c1e6ed", {
      automatic_deployment: false,
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as Record<string, unknown>;

    expect(String(requestUrl)).toContain(
      "/orm/api/pods/resource-release/2f4c4c3d-5669-4da5-9d86-b84633c1e6ed/",
    );
    expect(requestInit?.method).toBe("PATCH");
    expect(body).toEqual({
      automatic_deployment: false,
    });
  });

  it("manually deploys the current version without a request body", async () => {
    await deployResourceReleaseCurrentVersion("2f4c4c3d-5669-4da5-9d86-b84633c1e6ed");

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];

    expect(String(requestUrl)).toContain(
      "/orm/api/pods/resource-release/2f4c4c3d-5669-4da5-9d86-b84633c1e6ed/deploy-current-version/",
    );
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.body).toBeUndefined();
  });

  it("lists resource-release deployment runs with project and target_type filters", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ count: 0, next: null, previous: null, results: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );

    await listDeploymentRuns({
      projectUid: "4ea95a4d-41c5-4ee5-9608-8cfaec72c2e9",
      targetType: "resource_release",
      limit: 20,
      offset: 0,
    });

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toBe("/orm/api/pods/deployment-runs/");
    expect(url.searchParams.get("project_uid")).toBe(
      "4ea95a4d-41c5-4ee5-9608-8cfaec72c2e9",
    );
    expect(url.searchParams.get("target_type")).toBe("resource_release");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("offset")).toBe("0");
    expect(url.searchParams.get("resource_release__uid")).toBeNull();
    expect(url.searchParams.get("resource_release_uid")).toBeNull();
    expect(url.searchParams.get("status")).toBeNull();
    expect(url.searchParams.get("release_kind")).toBeNull();
  });

  it("fetches deployment run details and logs by run uid", async () => {
    await fetchDeploymentRun("11111111-1111-4111-8111-111111111111");
    await fetchDeploymentRunLogs("11111111-1111-4111-8111-111111111111");

    const [detailRequestUrl] = fetchMock.mock.calls[0] ?? [];
    const [logsRequestUrl] = fetchMock.mock.calls[1] ?? [];

    expect(String(detailRequestUrl)).toContain(
      "/orm/api/pods/deployment-runs/11111111-1111-4111-8111-111111111111/",
    );
    expect(String(logsRequestUrl)).toContain(
      "/orm/api/pods/deployment-runs/11111111-1111-4111-8111-111111111111/logs/",
    );
  });

  it("creates static-site releases without runtime resource, image, or compute fields", async () => {
    await createResourceRelease({
      release_kind: "static_site",
      project_uid: "4ea95a4d-41c5-4ee5-9608-8cfaec72c2e9",
      name: "Documentation",
      automatic_deployment: true,
      root_directory: "frontend",
      framework: "vite",
      node_version: "24",
      output_directory: "dist",
      routing_mode: "spa",
      spa_entry_file: "/index.html",
      build_environment: {
        PUBLIC_API_URL: "https://api.example.com",
      },
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as Record<string, unknown>;

    expect(String(requestUrl)).toContain("/orm/api/pods/resource-release/");
    expect(requestInit?.method).toBe("POST");
    expect(body).toEqual({
      release_kind: "static_site",
      project_uid: "4ea95a4d-41c5-4ee5-9608-8cfaec72c2e9",
      name: "Documentation",
      automatic_deployment: true,
      root_directory: "frontend",
      framework: "vite",
      node_version: "24",
      output_directory: "dist",
      routing_mode: "spa",
      spa_entry_file: "/index.html",
      build_environment: {
        PUBLIC_API_URL: "https://api.example.com",
      },
    });
    expect(body.install_command).toBeUndefined();
    expect(body.build_command).toBeUndefined();
    expect(body.routing_fallback).toBeUndefined();
    expect(body.catalog_version).toBeUndefined();
    expect(body.schema_version).toBeUndefined();
    expect(body.availability).toBeUndefined();
    expect(body.features).toBeUndefined();
    expect(body.limits).toBeUndefined();
    expect(body.creation).toBeUndefined();
    expect(body.resource_uid).toBeUndefined();
    expect(body.related_image_uid).toBeUndefined();
    expect(body.cpu_request).toBeUndefined();
    expect(body.memory_request).toBeUndefined();
    expect(body.spot).toBeUndefined();
  });

  it("fetches and validates a fresh static-site exchange launch URL", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          release_kind: "static_site",
          mode: "url",
          url: "https://site.example.com/.mainsequence/launch#token=one-use-token",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );

    const response = await fetchResourceReleaseExchangeLaunch(
      "/orm/api/pods/resource-release/static-release-uid/exchange-launch/",
    );
    const launchUrl = requireStaticSiteExchangeLaunchUrl(response);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toBe(
      "/orm/api/pods/resource-release/static-release-uid/exchange-launch/",
    );
    expect(url.searchParams.get("redirect")).toBeNull();
    expect(requestInit?.method).toBeUndefined();
    expect(launchUrl).toBe(
      "https://site.example.com/.mainsequence/launch#token=one-use-token",
    );
  });

  it("rejects invalid static-site exchange launch responses", () => {
    expect(() =>
      requireStaticSiteExchangeLaunchUrl({
        release_kind: "fastapi",
        mode: "url",
        url: "https://site.example.com/",
      }),
    ).toThrow("not for a static-site release");

    expect(() =>
      requireStaticSiteExchangeLaunchUrl({
        release_kind: "static_site",
        mode: "token",
        token: "token",
        rpc_url: "https://site.example.com/",
      }),
    ).toThrow("must use URL mode");

    expect(() =>
      requireStaticSiteExchangeLaunchUrl({
        release_kind: "static_site",
        mode: "url",
        url: "",
      }),
    ).toThrow("did not include a launch URL");
  });

  it("fetches project-specific static-site capabilities", async () => {
    await fetchStaticSiteCapabilities("4ea95a4d-41c5-4ee5-9608-8cfaec72c2e9");

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toBe("/orm/api/pods/resource-release/static-site-capabilities/");
    expect(url.searchParams.get("project_uid")).toBe(
      "4ea95a4d-41c5-4ee5-9608-8cfaec72c2e9",
    );
  });

  it("reuses cached static-site capabilities when the endpoint returns 304", async () => {
    const capabilities = {
      creation: {
        fields: [
          {
            name: "release_kind",
            type: "choice",
            help_text: "Creates a static website release. This value is fixed to static_site.",
            required: true,
            nullable: false,
            default: "static_site",
            choices: [{ value: "static_site", label: "Static site" }],
          },
        ],
      },
    };

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(capabilities), {
          headers: { "Content-Type": "application/json", ETag: "\"capabilities-v1\"" },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    const first = await fetchStaticSiteCapabilities("etag-project-uid");
    const second = await fetchStaticSiteCapabilities("etag-project-uid");
    const [, secondRequestInit] = fetchMock.mock.calls[1] ?? [];
    const secondHeaders = new Headers(secondRequestInit?.headers);

    expect(first).toEqual(capabilities);
    expect(second).toEqual(capabilities);
    expect(secondHeaders.get("If-None-Match")).toBe("\"capabilities-v1\"");
  });

  it("lists static-site deployment runs with project and target_type filters", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ count: 0, next: null, previous: null, results: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );

    await listDeploymentRuns({
      projectUid: "4ea95a4d-41c5-4ee5-9608-8cfaec72c2e9",
      targetType: "static_site",
      limit: 25,
    });

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toBe("/orm/api/pods/deployment-runs/");
    expect(url.searchParams.get("project_uid")).toBe(
      "4ea95a4d-41c5-4ee5-9608-8cfaec72c2e9",
    );
    expect(url.searchParams.get("target_type")).toBe("static_site");
    expect(url.searchParams.get("ordering")).toBeNull();
    expect(url.searchParams.get("limit")).toBe("25");
  });

  it("manually deploys static-site releases with an idempotency key and empty body", async () => {
    await deployStaticSiteCurrentVersion(
      "2f4c4c3d-5669-4da5-9d86-b84633c1e6ed",
      "deploy-request-1",
    );

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];

    expect(String(requestUrl)).toContain(
      "/orm/api/pods/resource-release/2f4c4c3d-5669-4da5-9d86-b84633c1e6ed/deploy-current-version/",
    );
    expect(requestInit?.method).toBe("POST");
    expect(new Headers(requestInit?.headers).get("Idempotency-Key")).toBe("deploy-request-1");
    expect(JSON.parse(String(requestInit?.body))).toEqual({});
  });
});
