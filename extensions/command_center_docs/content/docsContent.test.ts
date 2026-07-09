import { describe, expect, it } from "vitest";

import type { AppSurfaceDefinition } from "@/apps/types";

import {
  createGeneratedSurfaceGroupId,
  createGeneratedSurfacePageId,
} from "./generatedSurfaceIds";

function surface(id: string, sectionId?: string) {
  return {
    id,
    title: id,
    description: id,
    kind: "page",
    navigationSection: sectionId
      ? {
          id: sectionId,
          label: sectionId,
        }
      : undefined,
    component: () => null,
  } as AppSurfaceDefinition;
}

describe("documentation content catalog", () => {
  it("uses nested section-aware IDs for generated surface pages", () => {
    expect(createGeneratedSurfacePageId("foundry", surface("projects", "workspace"))).toBe(
      "foundry.workspace.projects",
    );
    expect(createGeneratedSurfacePageId("foundry", surface("jobs", "operations"))).toBe(
      "foundry.operations.jobs",
    );
    expect(createGeneratedSurfacePageId("foundry", surface("streamlit", "resources"))).toBe(
      "foundry.resources.streamlit",
    );
    expect(
      createGeneratedSurfacePageId(
        "foundry",
        surface("timescaledb-services", "tenancy-infrastructure"),
      ),
    ).toBe("foundry.tenancy-infrastructure.timescaledb-services");
    expect(createGeneratedSurfacePageId("foundry", surface("meta-tables", "data"))).toBe(
      "foundry.data.meta-tables",
    );
    expect(createGeneratedSurfacePageId("main-sequence-ai", surface("chat", "conversation"))).toBe(
      "main-sequence-ai.conversation.chat",
    );
    expect(createGeneratedSurfacePageId("main-sequence-ai", surface("agents", "agents"))).toBe(
      "main-sequence-ai.agents",
    );
    expect(
      createGeneratedSurfacePageId("main-sequence-ai", surface("capabilities", "capabilities")),
    ).toBe("main-sequence-ai.capabilities");
    expect(
      createGeneratedSurfacePageId(
        "main-sequence-ai",
        surface("project-agent-deployment-logs", "agents"),
      ),
    ).toBe("main-sequence-ai.agents.project-agent-deployment-logs");
  });

  it("uses nested section-aware IDs for generated navigation groups", () => {
    expect(createGeneratedSurfaceGroupId("foundry", "workspace")).toBe("foundry.workspace");
    expect(createGeneratedSurfaceGroupId("foundry", "operations")).toBe("foundry.operations");
    expect(createGeneratedSurfaceGroupId("foundry", "resources")).toBe("foundry.resources");
    expect(createGeneratedSurfaceGroupId("foundry", "tenancy-infrastructure")).toBe(
      "foundry.tenancy-infrastructure",
    );
    expect(createGeneratedSurfaceGroupId("main-sequence-ai", "conversation")).toBe(
      "main-sequence-ai.conversation",
    );
    expect(createGeneratedSurfaceGroupId("main-sequence-ai", "agents")).toBe(
      "main-sequence-ai.agents",
    );
  });
});
