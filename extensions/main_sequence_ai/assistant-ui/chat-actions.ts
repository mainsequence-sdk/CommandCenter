export interface ChatActionDefinition {
  id: string;
  label: string;
  status: "planned" | "bridge-needed";
  description: string;
}

export const chatActionDefinitions: ChatActionDefinition[] = [
  {
    id: "workspace-open",
    label: "Open workspace",
    status: "bridge-needed",
    description:
      "Navigate to an existing workspace or surface using the same routing and selection logic as the rest of the app.",
  },
  {
    id: "workspace-refresh",
    label: "Refresh visible data",
    status: "planned",
    description:
      "Invalidate the same TanStack Query keys or local stores already used by the active surface so changes show up live under the overlay.",
  },
  {
    id: "dashboard-update",
    label: "Update workspace state",
    status: "bridge-needed",
    description:
      "Route assistant-triggered changes through the same workspace/dashboard actions already used by the UI instead of adding a chat-only mutation path.",
  },
];
