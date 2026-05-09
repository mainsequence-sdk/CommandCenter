import { useEffect, useState } from "react";

import { MarkdownContent } from "@/components/ui/markdown-content";
import { Textarea } from "@/components/ui/textarea";
import type {
  WidgetController,
  WidgetFieldCanvasRendererProps,
  WidgetFieldSettingsRendererProps,
  WidgetSettingsSchema,
} from "@/widgets/types";

import {
  normalizeAgentTerminalWidgetProps,
  resolveAgentTerminalEffectiveRefreshPrompt,
  type AgentTerminalResolvedRefreshPrompt,
  type AgentTerminalWidgetProps,
} from "./agentTerminalModel";

export const AGENT_TERMINAL_REFRESH_PROMPT_FIELD_ID = "promptOnRefresh";

const refreshPromptPlaceholder =
  "## Refresh instruction\n\nSummarize what changed since the last refresh.";

export interface AgentTerminalControllerContext {
  resolvedRefreshPrompt: AgentTerminalResolvedRefreshPrompt;
}

function PromptOverrideNote({
  source,
}: {
  source: AgentTerminalResolvedRefreshPrompt["source"];
}) {
  if (source !== "bound") {
    return null;
  }

  return (
    <p className="text-xs leading-5 text-muted-foreground">
      This widget is currently using a bound <code>Prompt markdown</code> input. Edit the upstream
      source or remove the binding to change the effective refresh prompt shown on canvas.
    </p>
  );
}

function AgentTerminalRefreshPromptSettingsField({
  draftProps,
  onDraftPropsChange,
  editable,
  context,
}: WidgetFieldSettingsRendererProps<AgentTerminalWidgetProps, AgentTerminalControllerContext>) {
  const normalizedProps = normalizeAgentTerminalWidgetProps(draftProps);
  const savedPrompt = normalizedProps.promptOnRefresh ?? "";

  return (
    <div className="space-y-3">
      <PromptOverrideNote source={context.resolvedRefreshPrompt.source} />
      <Textarea
        value={savedPrompt}
        readOnly={!editable}
        spellCheck={false}
        placeholder={refreshPromptPlaceholder}
        className="min-h-[220px] font-mono text-xs leading-6"
        onChange={(event) => {
          onDraftPropsChange(
            normalizeAgentTerminalWidgetProps({
              ...normalizedProps,
              promptOnRefresh: event.target.value,
            }),
          );
        }}
      />
    </div>
  );
}

function AgentTerminalRefreshPromptCanvasField({
  props,
  onPropsChange,
  editable,
  context,
}: WidgetFieldCanvasRendererProps<AgentTerminalWidgetProps, AgentTerminalControllerContext>) {
  const normalizedProps = normalizeAgentTerminalWidgetProps(props);
  const savedPrompt = normalizedProps.promptOnRefresh ?? "";
  const { source, effectivePrompt } = context.resolvedRefreshPrompt;
  const visiblePrompt = source === "bound" ? (effectivePrompt ?? "") : savedPrompt;
  const isBound = source === "bound";
  const renderedContent = visiblePrompt.trim();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!editable || isBound) {
      setIsEditing(false);
    }
  }, [editable, isBound]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Prompt On Refresh
          </div>
          <div className="text-sm text-foreground">
            Automated refresh sends this instruction before appended upstream context.
          </div>
        </div>
      </div>

      {editable && !isBound && isEditing ? (
        <Textarea
          value={visiblePrompt}
          readOnly={false}
          autoFocus
          spellCheck={false}
          placeholder={refreshPromptPlaceholder}
          className="min-h-[220px] resize-none font-mono text-xs leading-6"
          onBlur={() => {
            setIsEditing(false);
          }}
          onChange={(event) => {
            onPropsChange(
              normalizeAgentTerminalWidgetProps({
                ...normalizedProps,
                promptOnRefresh: event.target.value,
              }),
            );
          }}
        />
      ) : (
        <button
          type="button"
          disabled={!editable || isBound}
          className="block min-h-[220px] w-full rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/20 px-4 py-3 text-left transition-colors hover:border-primary/35 hover:bg-background/26 disabled:cursor-default disabled:hover:border-border/70 disabled:hover:bg-background/20"
          onClick={() => {
            if (!editable || isBound) {
              return;
            }
            setIsEditing(true);
          }}
        >
          {renderedContent ? (
            <div className="max-h-[320px] overflow-auto">
              <MarkdownContent content={renderedContent} openLinksInNewTab />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Click to author the Markdown refresh prompt.
            </div>
          )}
        </button>
      )}
    </div>
  );
}

export const agentTerminalWidgetController: WidgetController<
  AgentTerminalWidgetProps,
  AgentTerminalControllerContext
> = {
  normalizeProps: (props) => normalizeAgentTerminalWidgetProps(props),
  useContext: ({ props, resolvedInputs }) => ({
    resolvedRefreshPrompt: resolveAgentTerminalEffectiveRefreshPrompt({
      props,
      resolvedInputs,
    }),
  }),
};

export const agentTerminalSettingsSchema: WidgetSettingsSchema<
  AgentTerminalWidgetProps,
  AgentTerminalControllerContext
> = {
  sections: [
    {
      id: "automation",
      title: "Automation prompt",
      description:
        "Configure the saved automated refresh prompt and control whether its companion card stays visible on the workspace canvas.",
    },
  ],
  fields: [
    {
      id: AGENT_TERMINAL_REFRESH_PROMPT_FIELD_ID,
      label: "Prompt on refresh",
      description:
        "Saved Markdown instruction used during automated refresh. When a Prompt markdown input is bound, that bound value becomes the effective prompt preview on the floating companion card.",
      sectionId: "automation",
      settingsColumnSpan: 2,
      pop: {
        canPop: true,
        defaultPopped: true,
        anchor: "top",
        mode: "panel",
        defaultWidth: 460,
        defaultHeight: 420,
      },
      renderSettings: AgentTerminalRefreshPromptSettingsField,
      renderCanvas: AgentTerminalRefreshPromptCanvasField,
    },
  ],
};
