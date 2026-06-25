import type { ReactNode } from "react";

export function AgentDeploymentConfigurationForm({
  actions,
  automation,
  children,
  description,
  llm,
  resources,
}: {
  actions?: ReactNode;
  automation?: ReactNode;
  children?: ReactNode;
  description: string;
  llm?: ReactNode;
  resources?: ReactNode;
}) {
  const hasStructuredSections =
    llm !== undefined || resources !== undefined || automation !== undefined;

  return (
    <div className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-4 py-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">Agent configuration</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {hasStructuredSections ? (
        <div className="space-y-4">
          {llm !== undefined ? (
            <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/22 p-3">
              <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                LLM
              </div>
              {llm}
            </div>
          ) : null}

          {resources}
          {automation}
        </div>
      ) : null}

      {children}
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
