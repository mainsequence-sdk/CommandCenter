import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type {
  WidgetRegistryRefreshPolicy,
  WidgetWorkspaceRuntimeMode,
} from "./types";

interface RuntimeArchitectureExpectation {
  definitionPath: string;
  mode: WidgetWorkspaceRuntimeMode;
  refreshPolicy?: WidgetRegistryRefreshPolicy;
  supportsExecution: boolean;
}

function readDefinitionSource(definitionPath: string) {
  return fs.readFileSync(fileURLToPath(new URL(definitionPath, import.meta.url)), "utf8");
}

function expectRuntimeArchitecture(expectation: RuntimeArchitectureExpectation) {
  const source = readDefinitionSource(expectation.definitionPath);

  expect(source, `${expectation.definitionPath} runtime mode`).toMatch(
    new RegExp(`workspaceRuntimeMode:\\s*"${expectation.mode}"`),
  );
  expect(
    /^\s*execution:\s*/m.test(source),
    `${expectation.definitionPath} execution`,
  ).toBe(expectation.supportsExecution);

  if (expectation.refreshPolicy) {
    expect(source, `${expectation.definitionPath} refresh policy`).toMatch(
      new RegExp(`refreshPolicy:\\s*"${expectation.refreshPolicy}"`),
    );
  }
}

describe("widget runtime architecture", () => {
  it("keeps finite execution owners refreshable through the finite planner", () => {
    [
      "./core/app-component/definition.ts",
      "./core/connection-query/definition.ts",
      "./core/tabular-transform/definition.ts",
      "../../extensions/main_sequence/extensions/markets/widgets/position-detail/definition.ts",
      "../../extensions/main_sequence/extensions/workbench/widgets/dependency-graph/definition.ts",
    ].forEach((definitionPath) => {
      expectRuntimeArchitecture({
        definitionPath,
        mode: "execution-owner",
        refreshPolicy: "allow-refresh",
        supportsExecution: true,
      });
    });
  });

  it("keeps WebSocket streams out of dashboard refresh execution", () => {
    expectRuntimeArchitecture({
      definitionPath: "./core/connection-stream-query/definition.ts",
      mode: "execution-owner",
      refreshPolicy: "not-applicable",
      supportsExecution: false,
    });
    expect(readDefinitionSource("./core/connection-stream-query/definition.ts")).toMatch(
      /executionTriggers:\s*\[\]/,
    );
  });

  it("keeps passive presentation consumers out of direct refresh execution", () => {
    [
      "./core/debug-stream/definition.ts",
      "./core/graph/definition.ts",
      "./core/statistic/definition.ts",
      "./core/table/definition.shared.ts",
      "../../extensions/main_sequence/extensions/markets/widgets/asset-screener/definition.ts",
      "../../extensions/main_sequence/extensions/markets/widgets/curve-plot/definition.ts",
      "../../extensions/main_sequence/extensions/markets/widgets/ohlc-bars/definition.ts",
      "../../extensions/main_sequence/extensions/markets/widgets/zero-curve/definition.ts",
    ].forEach((definitionPath) => {
      expectRuntimeArchitecture({
        definitionPath,
        mode: "consumer",
        refreshPolicy: "not-applicable",
        supportsExecution: false,
      });
    });
  });

  it("keeps static and self-contained canvas widgets local to the UI layer", () => {
    [
      "./core/markdown-note/definition.ts",
      "./core/rich-text-note/definition.ts",
      "./core/workspace-row/definition.ts",
      "./core/workspace-slide/definition.ts",
      "./extensions/echarts/definition.ts",
      "./extensions/lightweight-charts/definition.ts",
      "../../extensions/main_sequence/extensions/workbench/widgets/project-infra-graph/definition.ts",
    ].forEach((definitionPath) => {
      expectRuntimeArchitecture({
        definitionPath,
        mode: "local-ui",
        supportsExecution: false,
      });
    });
  });
});
