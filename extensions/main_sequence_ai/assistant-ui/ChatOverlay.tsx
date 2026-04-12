import { Expand, Sparkles, X } from "lucide-react";

import { ChatThread } from "./components/ChatThread";
import { useChatFeature } from "./ChatProvider";

export function ChatOverlay() {
  const { closeOverlay, expandToPage } = useChatFeature();

  return (
    <section className="fixed inset-y-0 right-0 z-[110] flex w-[min(540px,calc(100vw-10px))] flex-col overflow-hidden border-l border-border/70 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_84%,transparent)_0%,color-mix(in_srgb,var(--card)_90%,transparent)_28%,color-mix(in_srgb,var(--background)_86%,transparent)_100%)] text-card-foreground shadow-[-26px_0_80px_rgba(0,0,0,0.28)] backdrop-blur-3xl">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_24%,transparent_100%)]" />
        <div className="absolute inset-y-0 left-0 w-8 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--primary)_18%,transparent)_0%,transparent_100%)]" />
        <div className="absolute -left-24 top-[-60px] h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[-140px] top-1/3 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[15%] h-72 w-72 rounded-full bg-topbar-foreground/6 blur-3xl" />
      </div>

      <div className="relative flex items-start justify-between gap-4 border-b border-border/70 px-6 pt-6 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/55 px-3.5 text-xs font-medium uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-muted/60"
            onClick={expandToPage}
          >
            <Expand className="h-3.5 w-3.5" />
            Expand
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/55 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="Close chat overlay"
            onClick={closeOverlay}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-5 py-5">
        <ChatThread />
      </div>
    </section>
  );
}
