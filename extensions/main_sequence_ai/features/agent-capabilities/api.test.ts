import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchAgentCapabilityBindings,
  fetchCapabilityContent,
} from "./api";

describe("agent capabilities api", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("normalizes agent capability bindings with nested reusable capability data", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              uid: "binding-uid-1",
              agent_uid: "agent-uid-1",
              capability_uid: "capability-uid-1",
              role: "rebalance",
              sort_order: 3,
              is_enabled: true,
              is_locked: false,
              configuration: { exposure: "target" },
              source_type: "inline",
              source_ref: "",
              updated_at: "2026-06-14T10:00:00Z",
              capability: {
                uid: "capability-uid-1",
                name: "Rebalance",
                kind: "skill",
                source_type: "inline",
                source_ref: "",
                capability_path: "skills/rebalance/SKILL.md",
                is_editable: true,
                description: "Rebalance workflow",
                metadata: {},
                content_sha256: "abc",
                content_mime_type: "text/markdown",
                content_size: 128,
                has_content: true,
                created_by_user_uid: "user-uid-1",
                updated_at: "2026-06-14T10:00:00Z",
              },
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

    const result = await fetchAgentCapabilityBindings({ agentUid: "agent-uid-1" });

    expect(result).toEqual([
      {
        uid: "binding-uid-1",
        agentUid: "agent-uid-1",
        capabilityUid: "capability-uid-1",
        role: "rebalance",
        sortOrder: 3,
        isEnabled: true,
        isLocked: false,
        configuration: { exposure: "target" },
        sourceType: "inline",
        sourceRef: null,
        updatedAt: "2026-06-14T10:00:00Z",
        capability: {
          uid: "capability-uid-1",
          name: "Rebalance",
          kind: "skill",
          sourceType: "inline",
          sourceRef: null,
          capabilityPath: "skills/rebalance/SKILL.md",
          isEditable: true,
          description: "Rebalance workflow",
          metadata: {},
          contentFile: null,
          contentSha256: "abc",
          contentMimeType: "text/markdown",
          contentSize: 128,
          hasContent: true,
          createdByUserUid: "user-uid-1",
          updatedAt: "2026-06-14T10:00:00Z",
        },
      },
    ]);
  });

  it("supports plain-text capability content responses", async () => {
    fetchMock.mockResolvedValue(
      new Response("# Markdown skill\n", {
        status: 200,
        headers: {
          "Content-Type": "text/markdown",
        },
      }),
    );

    const result = await fetchCapabilityContent({ capabilityUid: "capability-uid-1" });

    expect(result).toEqual({
      content: "# Markdown skill\n",
      filename: null,
      contentMimeType: "text/markdown",
      updatedAt: null,
    });
  });

  it("treats missing capability content as an empty markdown draft when allowMissing is enabled", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Capability content file was not found." }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const result = await fetchCapabilityContent({
      capabilityUid: "capability-uid-1",
      allowMissing: true,
    });

    expect(result).toEqual({
      content: "",
      filename: null,
      contentMimeType: "text/markdown",
      updatedAt: null,
    });
  });
});
