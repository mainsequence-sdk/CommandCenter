import { describe, expect, it } from "vitest";

import type { DashboardDefinition } from "@/dashboards/types";

import {
  applyWorkspaceUserStateToDashboard,
  extractWorkspaceUserStateFromDashboard,
  normalizeWorkspaceUserStatePayload,
} from "./workspace-user-state";

function dashboard(controls: DashboardDefinition["controls"]): DashboardDefinition {
  return {
    id: "workspace-1",
    title: "Workspace",
    description: "",
    source: "test",
    controls,
    widgets: [],
  };
}

describe("workspace user state", () => {
  it("does not turn invalid selected control payload fields into null selections", () => {
    const normalized = normalizeWorkspaceUserStatePayload({
      selectedControls: {
        timeRangeKey: "custom",
        rangeStartMs: null,
        rangeEndMs: "bad",
        refreshIntervalMs: "bad",
      },
      widgetRuntimeState: {},
    });

    expect(normalized.selectedControls).toEqual({});

    const applied = applyWorkspaceUserStateToDashboard(
      dashboard({
        timeRange: {
          selectedRange: "24h",
          customStartMs: 100,
          customEndMs: 200,
        },
        refresh: {
          selectedIntervalMs: 60_000,
        },
      }),
      normalized,
    );

    expect(applied.controls?.timeRange?.selectedRange).toBe("24h");
    expect(applied.controls?.timeRange?.customStartMs).toBe(100);
    expect(applied.controls?.timeRange?.customEndMs).toBe(200);
    expect(applied.controls?.refresh?.selectedIntervalMs).toBe(60_000);
  });

  it("serializes preset range selections without fake null custom bounds", () => {
    const extracted = extractWorkspaceUserStateFromDashboard(
      dashboard({
        timeRange: {
          selectedRange: "15m",
          customStartMs: 100,
          customEndMs: 200,
        },
        refresh: {
          selectedIntervalMs: 30_000,
        },
      }),
    );

    expect(extracted.selectedControls).toEqual({
      timeRangeKey: "15m",
      refreshIntervalMs: 30_000,
    });
  });

  it("preserves explicit refresh off but ignores invalid refresh intervals", () => {
    expect(
      normalizeWorkspaceUserStatePayload({
        selectedControls: {
          refreshIntervalMs: null,
        },
      }).selectedControls,
    ).toEqual({
      refreshIntervalMs: null,
    });

    expect(
      normalizeWorkspaceUserStatePayload({
        selectedControls: {
          refreshIntervalMs: 0,
        },
      }).selectedControls,
    ).toEqual({});
  });
});
