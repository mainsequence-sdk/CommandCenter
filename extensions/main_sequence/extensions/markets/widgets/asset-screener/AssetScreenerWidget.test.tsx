/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";

import { mainSequenceAssetScreenerWidget } from "./definition";
import { AssetScreenerWidget } from "./AssetScreenerWidget";
import {
  assetScreenerDefaultProps,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }

  host?.remove();
  root = null;
  host = null;
});

function frame(rows: Array<Record<string, unknown>>): TabularFrameSourceV1 {
  return {
    status: "ready",
    columns: Object.keys(rows[0] ?? {}),
    rows,
  };
}

function renderWidget(
  props: MainSequenceAssetScreenerWidgetProps,
  frames: {
    seedData: TabularFrameSourceV1;
    referenceData?: TabularFrameSourceV1;
  },
) {
  host = document.createElement("div");
  host.style.height = "420px";
  document.body.appendChild(host);
  root = createRoot(host);

  act(() => {
    root!.render(
      <AssetScreenerWidget
        widget={mainSequenceAssetScreenerWidget}
        props={props}
        runtimeState={{
          marketAssetScreenerDemoFrames: {
            ...frames,
          },
        }}
      />,
    );
  });

  return host;
}

describe("AssetScreenerWidget", () => {
  it("renders a bounded virtual window for large generic tabular universes", () => {
    const rows = Array.from({ length: 1_000 }, (_, index) => ({
      asset_id: `asset:${index}`,
      symbol: `SYM${index.toString().padStart(4, "0")}`,
      time: "2026-05-16T12:00:00.000Z",
      last_price: 100 + index,
    }));
    const props = {
      ...assetScreenerDefaultProps,
      columns: [
        {
          id: "symbol",
          kind: "asset-field",
          label: "Symbol",
          field: "symbol",
          width: 120,
        },
        {
          id: "last",
          kind: "latest-value",
          label: "Last",
          valueField: "price",
          width: 96,
        },
      ],
      groupBy: undefined,
      maxRenderedRows: 1_000,
      fieldMappings: {
        seed: {
          assetKeyField: "asset_id",
          symbolField: "symbol",
          observedAtField: "time",
          valueFields: {
            price: "last_price",
          },
        },
      },
    } satisfies MainSequenceAssetScreenerWidgetProps;

    const container = renderWidget(props, { seedData: frame(rows) });

    expect(container.textContent).toContain("1,000 of 1,000 assets");
    expect(container.textContent).toContain("SYM0000");
    expect(container.textContent).not.toContain("SYM0999");
  });

  it("renders trend sparklines from reference points plus latest values", () => {
    const props = {
      ...assetScreenerDefaultProps,
      groupBy: undefined,
      sort: undefined,
      fieldMappings: {
        seed: {
          assetKeyField: "asset_id",
          symbolField: "symbol",
          observedAtField: "time",
          valueFields: {
            price: "last_price",
          },
        },
        reference: {
          assetKeyField: "asset_id",
          referenceKeyField: "reference_key",
          observedAtField: "observed_at",
          valueFields: {
            price: "close",
          },
        },
      },
    } satisfies MainSequenceAssetScreenerWidgetProps;

    const container = renderWidget(props, {
      seedData: frame([
        {
          asset_id: "asset:AAPL",
          symbol: "AAPL",
          time: "2026-05-16T13:00:00.000Z",
          last_price: 110,
        },
      ]),
      referenceData: frame([
        {
          asset_id: "asset:AAPL",
          reference_key: "oneYearAgo",
          observed_at: "2025-05-16T20:00:00.000Z",
          close: 82,
        },
        {
          asset_id: "asset:AAPL",
          reference_key: "oneMonthAgo",
          observed_at: "2026-04-16T20:00:00.000Z",
          close: 96,
        },
        {
          asset_id: "asset:AAPL",
          reference_key: "previousClose",
          observed_at: "2026-05-15T20:00:00.000Z",
          close: 100,
        },
      ]),
    });
    const trendPath = Array.from(container.querySelectorAll("svg path"))
      .find((path) => path.getAttribute("d")?.startsWith("M"));

    expect(trendPath?.getAttribute("d")).toContain("L");
  });
});
