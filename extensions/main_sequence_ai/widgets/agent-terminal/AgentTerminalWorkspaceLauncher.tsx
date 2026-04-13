import { useState } from "react";

import { Bot, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { WorkspaceToolbarButton } from "@/features/dashboards/WorkspaceChrome";
import { useCustomWorkspaceStudio } from "@/features/dashboards/useCustomWorkspaceStudio";

import { createAgentMonitorWorkspaceDefinition } from "../../agent-monitor-workspaces";
import { AgentSessionCatalogPicker } from "../../features/chat/AgentSessionCatalogPicker";
import { getAgentSessionRecordSessionId } from "../../runtime/agent-sessions-api";
import {
  findAgentTerminalWidgetForSession,
  upsertAgentTerminalWidgetForSession,
} from "./agentTerminalWorkspace";

export function AgentTerminalWorkspaceLauncher({
  buttonLabel = "Launch session",
  createWorkspaceWhenMissing = false,
  mode = "button",
}: {
  buttonLabel?: string;
  createWorkspaceWhenMissing?: boolean;
  mode?: "button" | "toolbar";
}) {
  const { toast } = useToast();
  const {
    createWorkspaceFromDefinition,
    selectedDashboard,
    setSelectedWorkspaceEditing,
    updateSelectedWorkspace,
  } = useCustomWorkspaceStudio();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedWorkspaceAvailable = Boolean(selectedDashboard);

  async function handleSessionSelect({
    agentName,
    sessionId,
  }: {
    agentName: string;
    sessionId: string;
  }) {
    if (!sessionId || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (selectedWorkspaceAvailable) {
        const created = selectedDashboard
          ? !findAgentTerminalWidgetForSession(selectedDashboard, sessionId)
          : false;

        setSelectedWorkspaceEditing(true);
        updateSelectedWorkspace((dashboard) => {
          return upsertAgentTerminalWidgetForSession(dashboard, {
            agentName,
            sessionId,
          }).dashboard;
        });

        toast({
          title: created ? "Agent terminal added" : "Agent terminal already present",
          description: created
            ? `${agentName} session ${sessionId} was added to the current workspace.`
            : `${agentName} session ${sessionId} is already on this workspace canvas.`,
          variant: "success",
        });
      } else if (createWorkspaceWhenMissing) {
        const createdDashboard = await createWorkspaceFromDefinition(
          createAgentMonitorWorkspaceDefinition({
            agentName,
            sessionId,
          }),
        );

        if (!createdDashboard) {
          throw new Error("Unable to create the agent monitor workspace.");
        }

        toast({
          title: "Agent monitor created",
          description: `${agentName} session ${sessionId} opened in a new monitor workspace.`,
          variant: "success",
        });
      } else {
        throw new Error("No workspace is selected.");
      }

      setOpen(false);
    } catch (error) {
      toast({
        title: "Agent terminal action failed",
        description: error instanceof Error ? error.message : "Unable to apply the selected session.",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {mode === "toolbar" ? (
        <WorkspaceToolbarButton
          active={open}
          title="Add agent terminal"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Bot className="h-3.5 w-3.5" />
        </WorkspaceToolbarButton>
      ) : (
        <Button
          variant={selectedWorkspaceAvailable ? "outline" : "default"}
          onClick={() => {
            setOpen(true);
          }}
        >
          <Bot className="h-4 w-4" />
          {buttonLabel}
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => {
          if (!isSubmitting) {
            setOpen(false);
          }
        }}
        title={selectedWorkspaceAvailable ? "Add Agent Terminal" : "Create Agent Monitor"}
        description={
          selectedWorkspaceAvailable
            ? "Pick an agent session and the terminal widget will be inserted into the current workspace."
            : "Pick an agent session and a new monitor workspace will be created automatically."
        }
        closeOnBackdropClick={!isSubmitting}
        className="max-w-[880px]"
        contentClassName="p-0"
        headerClassName="px-5 py-4 md:px-6"
      >
        <div className="border-t border-border/60 px-5 py-5 md:px-6">
          {isSubmitting ? (
            <div className="mb-4 flex items-center gap-2 rounded-[16px] border border-border/70 bg-background/35 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Applying session selection
            </div>
          ) : null}

          <AgentSessionCatalogPicker
            editable={!isSubmitting}
            onSelect={({ agent, session }) => {
              void handleSessionSelect({
                agentName: agent.name,
                sessionId: getAgentSessionRecordSessionId(session),
              });
            }}
          />
        </div>
      </Dialog>
    </>
  );
}
