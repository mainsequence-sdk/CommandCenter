import { AgentSessionExplorer } from "../../features/chat/AgentSessionExplorer";

export function AgentsPage() {
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
          <div className="grid h-full min-h-[calc(100vh-3.5rem)] min-w-0 grid-cols-1 gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="h-full min-h-0 overflow-hidden border-r border-border/60 pr-4">
              <AgentSessionExplorer
                layout="rail"
                navigateToChatOnSessionChange
              />
            </aside>

            <section className="min-h-0 min-w-0 overflow-hidden px-4 py-4">
              <div className="relative h-full min-h-[calc(100vh-7rem)] rounded-[calc(var(--radius)+8px)] border border-border/40 bg-background/10 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_3%,transparent)]">
                <div className="absolute left-4 top-4 rounded-full border border-border/70 bg-card/82 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground shadow-[var(--shadow-panel)] backdrop-blur-xl">
                  Agent canvas
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
