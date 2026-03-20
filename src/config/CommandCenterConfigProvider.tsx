import { createContext, useContext, useEffect, type ReactNode } from "react";

import { commandCenterConfig, type CommandCenterConfig } from "@/config/command-center";

const CommandCenterConfigContext = createContext<CommandCenterConfig | null>(null);

export function CommandCenterConfigProvider({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = commandCenterConfig.app.name;
  }, []);

  return (
    <CommandCenterConfigContext.Provider value={commandCenterConfig}>
      {children}
    </CommandCenterConfigContext.Provider>
  );
}

export function useCommandCenterConfig() {
  const context = useContext(CommandCenterConfigContext);

  if (!context) {
    throw new Error("useCommandCenterConfig must be used inside CommandCenterConfigProvider.");
  }

  return context;
}
