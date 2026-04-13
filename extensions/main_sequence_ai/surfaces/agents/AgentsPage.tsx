import { useState } from "react";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgentSessionExplorer } from "../../features/chat/AgentSessionExplorer";

export function AgentsPage() {
  const [explorerOpen, setExplorerOpen] = useState(false);

  return (
    <div
      className="relative h-full min-h-full overflow-hidden"
      style={{ backgroundColor: "var(--workspace-canvas-base-color)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--workspace-canvas-background)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--workspace-canvas-overlay)" }}
      />

      <div className="relative h-full min-h-full">
        <div
          className="absolute inset-0 overflow-auto pb-4 pt-0"
          style={{ scrollbarGutter: "stable" }}
        >
          <div
            className={cn(
              "grid h-full min-h-[calc(100vh-3.5rem)] min-w-0 gap-0",
              explorerOpen
                ? "grid-cols-[64px_320px_minmax(0,1fr)]"
                : "grid-cols-[64px_minmax(0,1fr)]",
            )}
          >
            <aside className="flex h-full min-h-0 flex-col items-center gap-2 border-r border-border/60 px-2 py-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-[calc(var(--radius)-6px)] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                aria-expanded={explorerOpen}
                aria-label={explorerOpen ? "Close sessions" : "Open sessions"}
                title={explorerOpen ? "Close sessions" : "Open sessions"}
                onClick={() => {
                  setExplorerOpen((current) => !current);
                }}
              >
                {explorerOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </Button>
            </aside>

            {explorerOpen ? (
              <aside className="h-full min-h-0 overflow-hidden border-r border-border/60">
                <AgentSessionExplorer layout="rail" />
              </aside>
            ) : null}

            <section className="min-h-0 min-w-0" />
          </div>
        </div>
      </div>
    </div>
  );
}
