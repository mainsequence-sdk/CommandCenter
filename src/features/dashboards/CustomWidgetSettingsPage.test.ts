import { describe, expect, it } from "vitest";

import { buildWidgetReferencePropInputId } from "@/dashboards/widget-instance-references";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import type { WidgetInstanceBindings } from "@/widgets/types";

import { buildWidgetSettingsDependencyPreview } from "./CustomWidgetSettingsPage";

describe("buildWidgetSettingsDependencyPreview", () => {
  it("uses draft props and bindings on the settings tab so removed references do not rehydrate", () => {
    const referenceInputId = buildWidgetReferencePropInputId(["query", "symbols"]);
    const savedBindings = {
      [referenceInputId]: {
        sourceWidgetId: "table-1",
        sourceOutputId: "activeCellValue",
      },
    } satisfies WidgetInstanceBindings;
    const sourceWidget = {
      id: "table-1",
      widgetId: "table",
      props: {},
      layout: { w: 4, h: 4 },
    } satisfies DashboardWidgetInstance;
    const staleSavedWidget = {
      id: "connection-query-1",
      widgetId: "connection-query",
      title: "Price query",
      props: {
        query: {
          kind: "binance-usdm-futures-ohlc",
          symbols: ["$(table-1).activeCellValue"],
        },
      },
      bindings: savedBindings,
      layout: { w: 4, h: 4 },
      presentation: {},
    } satisfies DashboardWidgetInstance;
    const draftProps = {
      query: {
        kind: "binance-usdm-futures-ohlc",
        symbols: [],
      },
    };

    const preview = buildWidgetSettingsDependencyPreview({
      activeTab: "settings",
      draftState: {
        bindings: undefined,
        presentation: {},
        props: draftProps,
        title: "Price query",
      },
      instance: staleSavedWidget,
      widgets: [sourceWidget, staleSavedWidget],
    });

    expect(preview.previewInstance?.props).toEqual(draftProps);
    expect(preview.previewInstance?.bindings).toBeUndefined();
    expect(preview.previewWidgets).toEqual([
      sourceWidget,
      {
        ...staleSavedWidget,
        bindings: undefined,
        props: draftProps,
      },
    ]);
  });
});
