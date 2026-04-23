import { useState } from "react";

import { Bot, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { WorkspaceToolbarButton } from "@/features/dashboards/WorkspaceChrome";
import { useCustomWorkspaceStudio } from "@/features/dashboards/useCustomWorkspaceStudio";

import { createAgentMonitorWorkspaceDefinition } from "../../agent-monitor-workspaces";
import { useAuthStore } from "@/auth/auth-store";
import type { AgentSearchResult } from "../../agent-search";
import { startNewAgentSessionRequest } from "../../runtime/agent-sessions-api";
import { AgentTerminalAgentPicker } from "./AgentTerminalAgentPicker";
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
  const sessionUserId = useAuthStore((state) => state.session?.user.id ?? null);
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedWorkspaceAvailable = Boolean(selectedDashboard);

  async function handleAgentSelect(agent: AgentSearchResult) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { sessionId } = await startNewAgentSessionRequest({
        agentId: agent.id,
        createdByUser: sessionUserId ?? "",
        token: sessionToken,
        tokenType: sessionTokenType,
      });

      if (selectedWorkspaceAvailable) {
        const created = selectedDashboard
          ? !findAgentTerminalWidgetForSession(selectedDashboard, sessionId)
          : false;

        setSelectedWorkspaceEditing(true);
        updateSelectedWorkspace((dashboard) => {
          return upsertAgentTerminalWidgetForSession(dashboard, {
            agentId: agent.id,
            agentName: agent.name,
            sessionId,
          }).dashboard;
        });

        toast({
          title: created ? "Agent terminal added" : "Agent terminal already present",
          description: created
            ? `Created ${agent.name} session ${sessionId} and added it to the current workspace.`
            : `${agent.name} session ${sessionId} is already on this workspace canvas.`,
          variant: "success",
        });
      } else if (createWorkspaceWhenMissing) {
        const createdDashboard = await createWorkspaceFromDefinition(
          createAgentMonitorWorkspaceDefinition({
            agentId: agent.id,
            agentName: agent.name,
            sessionId,
          }),
        );

        if (!createdDashboard) {
          throw new Error("Unable to create the agent monitor workspace.");
        }

        toast({
          title: "Agent monitor created",
          description: `Created ${agent.name} session ${sessionId} and opened it in a new monitor workspace.`,
          variant: "success",
        });
      } else {
        throw new Error("No workspace is selected.");
      }

      setOpen(false);
    } catch (error) {
      toast({
        title: "Agent terminal action failed",
        description: error instanceof Error ? error.message : "Unable to create the selected session.",
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
            ? "Pick a supported agent. The launcher creates a fresh session automatically and inserts the terminal into the current workspace."
            : "Pick a supported agent. The launcher creates a fresh session automatically and opens it in a new monitor workspace."
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
              Creating a fresh agent session
            </div>
          ) : null}

          <AgentTerminalAgentPicker
            editable={!isSubmitting}
            onSelect={(agent) => {
              void handleAgentSelect(agent);
            }}
          />
        </div>
      </Dialog>
    </>
  );
}
