/** @vitest-environment jsdom */

import { act, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardWidgetDependenciesProvider } from "@/dashboards/DashboardWidgetDependencies";
import { WIDGET_REFERENCE_TITLE_INPUT_ID } from "@/dashboards/widget-instance-references";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import { QueryStringListField } from "@/connections/components/ConnectionQueryEditorFields";
import { CORE_VALUE_JSON_CONTRACT } from "@/widgets/shared/value-contracts";
import type {
  WidgetDefinition,
  WidgetInstanceBindings,
  WidgetInstancePresentation,
} from "@/widgets/types";

import { WidgetSettingsPanel } from "./widget-settings";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function flushEffects() {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 0);
  });
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
}

const sourceWidgetDefinition: WidgetDefinition = {
  id: "table",
  widgetVersion: "test",
  title: "Table",
  description: "Test table",
  category: "Core",
  kind: "table",
  source: "core",
  defaultSize: { w: 4, h: 4 },
  io: {
    outputs: [
      {
        id: "activeRow",
        label: "Active row",
        contract: CORE_VALUE_JSON_CONTRACT,
        valueDescriptor: {
          kind: "object",
          contract: CORE_VALUE_JSON_CONTRACT,
          fields: [
            {
              key: "symbol",
              label: "Symbol",
              value: {
                kind: "primitive",
                contract: "core.value.string@v1",
                primitive: "string",
              },
            },
          ],
        },
        resolveValue: () => ({
          symbol: "BTCUSDT",
        }),
      },
      {
        id: "activeCellValue",
        label: "Active cell value",
        contract: CORE_VALUE_JSON_CONTRACT,
        resolveValue: () => "BTCUSDT",
      },
    ],
  },
  component: () => null,
};

const targetWidgetDefinition: WidgetDefinition = {
  id: "card",
  widgetVersion: "test",
  title: "Card",
  description: "Test card",
  category: "Core",
  kind: "custom",
  source: "core",
  defaultSize: { w: 4, h: 4 },
  settingsPreviewMode: "none",
  showRawPropsEditor: false,
  component: () => null,
};

const bufferedSymbolsWidgetDefinition: WidgetDefinition<{ symbols?: string[] }> = {
  id: "buffered-symbols-card",
  widgetVersion: "test",
  title: "Buffered symbols",
  description: "Buffered string-list settings field",
  category: "Core",
  kind: "custom",
  source: "core",
  defaultSize: { w: 4, h: 4 },
  settingsPreviewMode: "none",
  showRawPropsEditor: false,
  component: () => null,
  settingsComponent: ({ draftProps, editable, onDraftPropsChange }) => (
    <QueryStringListField
      label="Symbols"
      value={draftProps.symbols}
      onChange={(symbols) => {
        onDraftPropsChange({
          ...draftProps,
          symbols,
        });
      }}
      disabled={!editable}
      placeholder="AAPL, MSFT"
    />
  ),
};

const rawPropsDraftWidgetDefinition: WidgetDefinition<{ value?: string }> = {
  id: "raw-props-draft-card",
  widgetVersion: "test",
  title: "Raw props draft",
  description: "Raw props synchronization test widget",
  category: "Core",
  kind: "custom",
  source: "core",
  defaultSize: { w: 4, h: 4 },
  settingsPreviewMode: "none",
  component: () => null,
  settingsComponent: ({ draftProps, editable, onDraftPropsChange }) => (
    <label>
      <span>Value</span>
      <input
        placeholder="Widget value"
        value={draftProps.value ?? ""}
        disabled={!editable}
        onChange={(event) => {
          onDraftPropsChange({
            ...draftProps,
            value: event.currentTarget.value,
          });
        }}
      />
    </label>
  ),
};

const sourceInstance: DashboardWidgetInstance = {
  id: "table-1",
  widgetId: "table",
  title: "Prices table",
  props: {},
  layout: { w: 4, h: 4 },
};

const targetPresentation: WidgetInstancePresentation = {};

describe("WidgetSettingsPanel variable references", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(performance.now()), 0),
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: (id: number) => {
        window.clearTimeout(id);
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("hydrates expression-authored title bindings into the draft so settings can be saved", async () => {
    const onDraftBindingsChange = vi.fn();
    let latestBindings: WidgetInstanceBindings | undefined;

    function Harness() {
      const [bindings, setBindings] = useState<WidgetInstanceBindings | undefined>(undefined);
      const handleDraftBindingsChange = useCallback((nextBindings: WidgetInstanceBindings | undefined) => {
        latestBindings = nextBindings;
        onDraftBindingsChange(nextBindings);
        setBindings(nextBindings);
      }, []);
      const targetInstance: DashboardWidgetInstance = {
        id: "card-1",
        widgetId: "card",
        title: "$(table-1).activeCellValue",
        props: {},
        bindings,
        layout: { w: 4, h: 4 },
        presentation: targetPresentation,
      };

      return (
        <DashboardWidgetDependenciesProvider
          widgets={[sourceInstance, targetInstance]}
          resolveWidgetDefinition={(widgetId) => {
            if (widgetId === "table") {
              return sourceWidgetDefinition;
            }

            if (widgetId === "card") {
              return targetWidgetDefinition;
            }

            return undefined;
          }}
        >
          <WidgetSettingsPanel
            widget={targetWidgetDefinition}
            instance={targetInstance}
            draftBindings={bindings}
            draftPresentation={targetPresentation}
            draftProps={{}}
            draftTitle="$(table-1).activeCellValue"
            onClose={() => {}}
            onDraftBindingsChange={handleDraftBindingsChange}
            onDraftPresentationChange={() => {}}
            onDraftPropsChange={() => {}}
            onDraftTitleChange={() => {}}
          />
        </DashboardWidgetDependenciesProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
      await flushEffects();
    });

    expect(onDraftBindingsChange).toHaveBeenCalledWith({
      [WIDGET_REFERENCE_TITLE_INPUT_ID]: {
        sourceWidgetId: "table-1",
        sourceOutputId: "activeCellValue",
      },
    });
    expect(latestBindings).toEqual({
      [WIDGET_REFERENCE_TITLE_INPUT_ID]: {
        sourceWidgetId: "table-1",
        sourceOutputId: "activeCellValue",
      },
    });

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save settings",
    );

    expect(saveButton).not.toBeUndefined();
    expect(saveButton?.disabled).toBe(false);
  });

  it("enables Save settings when a buffered list field commits a variable reference", async () => {
    function Harness() {
      const [draftProps, setDraftProps] = useState<{ symbols?: string[] }>({});
      const targetInstance: DashboardWidgetInstance = {
        id: "card-2",
        widgetId: "buffered-symbols-card",
        title: "Buffered symbols",
        props: {},
        bindings: undefined,
        layout: { w: 4, h: 4 },
        presentation: targetPresentation,
      };

      return (
        <DashboardWidgetDependenciesProvider
          widgets={[sourceInstance, targetInstance]}
          resolveWidgetDefinition={(widgetId) => {
            if (widgetId === "table") {
              return sourceWidgetDefinition;
            }

            if (widgetId === "buffered-symbols-card") {
              return bufferedSymbolsWidgetDefinition;
            }

            return undefined;
          }}
        >
          <WidgetSettingsPanel
            widget={bufferedSymbolsWidgetDefinition}
            instance={targetInstance}
            draftBindings={undefined}
            draftPresentation={targetPresentation}
            draftProps={draftProps}
            draftTitle="Buffered symbols"
            onClose={() => {}}
            onDraftBindingsChange={() => {}}
            onDraftPresentationChange={() => {}}
            onDraftPropsChange={setDraftProps}
            onDraftTitleChange={() => {}}
          />
        </DashboardWidgetDependenciesProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
      await flushEffects();
    });

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save settings",
    );
    const input = container.querySelector("input");

    expect(saveButton).not.toBeUndefined();
    expect(input).not.toBeNull();

    await act(async () => {
      input!.focus();
      setNativeInputValue(input!, "$(table-1).activeRow.symbol");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      await flushEffects();
    });

    await act(async () => {
      input!.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
        }),
      );
      await flushEffects();
      await flushEffects();
    });

    expect(saveButton?.disabled).toBe(false);
  });

  it("saves the current draft props instead of stale raw JSON text", async () => {
    const onSave = vi.fn();

    function Harness() {
      const [draftProps, setDraftProps] = useState<{ value?: string }>({
        value: "initial",
      });
      const targetInstance: DashboardWidgetInstance = {
        id: "card-3",
        widgetId: "raw-props-draft-card",
        title: "Raw props draft",
        props: {
          value: "initial",
        },
        bindings: undefined,
        layout: { w: 4, h: 4 },
        presentation: targetPresentation,
      };

      return (
        <DashboardWidgetDependenciesProvider
          widgets={[targetInstance]}
          resolveWidgetDefinition={(widgetId) => {
            if (widgetId === "raw-props-draft-card") {
              return rawPropsDraftWidgetDefinition;
            }

            return undefined;
          }}
        >
          <WidgetSettingsPanel
            widget={rawPropsDraftWidgetDefinition}
            instance={targetInstance}
            draftBindings={undefined}
            draftPresentation={targetPresentation}
            draftProps={draftProps}
            draftTitle="Raw props draft"
            onClose={() => {}}
            onDraftBindingsChange={() => {}}
            onDraftPresentationChange={() => {}}
            onDraftPropsChange={setDraftProps}
            onDraftTitleChange={() => {}}
            onSave={onSave}
          />
        </DashboardWidgetDependenciesProvider>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await flushEffects();
      await flushEffects();
    });

    const rawToggleButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Show Props JSON",
    );

    expect(rawToggleButton).not.toBeUndefined();

    await act(async () => {
      rawToggleButton!.click();
      await flushEffects();
      await flushEffects();
      await flushEffects();
    });

    const draftInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Widget value"]',
    );

    expect(draftInput).not.toBeNull();

    await act(async () => {
      setNativeInputValue(draftInput!, "from-ui");
      draftInput!.dispatchEvent(new Event("input", { bubbles: true }));
      await flushEffects();
      await flushEffects();
    });

    const rawPropsTextarea = container.querySelector("textarea");
    expect(rawPropsTextarea?.value).toContain('"value": "from-ui"');

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save settings",
    );

    expect(saveButton).not.toBeUndefined();

    await act(async () => {
      saveButton!.click();
      await flushEffects();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        props: {
          value: "from-ui",
        },
      }),
    );
  });
});
