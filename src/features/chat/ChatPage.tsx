import { ArrowLeft, Minimize2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChatFeature } from "@/features/chat/ChatProvider";
import { ChatThread } from "@/features/chat/components/ChatThread";

export function ChatPage() {
  const navigate = useNavigate();
  const { actionDefinitions, context, minimizeToOverlay } = useChatFeature();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="flex min-h-[calc(100vh-120px)] flex-col overflow-hidden">
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle>Assistant Workspace</CardTitle>
              <CardDescription>
                Full-page chat surface sharing the same runtime as the overlay shell.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/70 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
                onClick={() => {
                  navigate(-1);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[calc(var(--radius)-6px)] bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                onClick={minimizeToOverlay}
              >
                <Minimize2 className="h-4 w-4" />
                Minimize To Overlay
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-5">
          <ChatThread />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Visible Context</CardTitle>
            <CardDescription>Read-only context bridge collected from the current shell.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Path</div>
              <div className="mt-1 break-all">{context.currentPath}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">App: {context.appId ?? "none"}</Badge>
              <Badge variant="neutral">Surface: {context.surfaceId ?? "none"}</Badge>
              <Badge variant="neutral">Role: {context.role ?? "unknown"}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              User: {context.userName ?? "Unknown"} ({context.userEmail ?? "no-email"}) with{" "}
              {context.permissionCount} permissions.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action Bridge</CardTitle>
            <CardDescription>
              Placeholder catalog for app mutations the assistant may eventually trigger.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionDefinitions.map((action) => (
              <div
                key={action.id}
                className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/70 px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-foreground">{action.label}</div>
                  <Badge variant={action.status === "planned" ? "primary" : "warning"}>
                    {action.status === "planned" ? "Planned" : "Bridge Needed"}
                  </Badge>
                </div>
                <div className="mt-2 text-xs leading-5 text-muted-foreground">
                  {action.description}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
