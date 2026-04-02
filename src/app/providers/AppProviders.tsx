import type { ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { CommandCenterConfigProvider } from "@/config/CommandCenterConfigProvider";
import { queryClient } from "@/data/query-client";
import { CommandCenterPreferencesProvider } from "@/preferences/CommandCenterPreferencesProvider";
import { ThemeProvider } from "@/themes/ThemeProvider";
import { WidgetRegistrySyncBootstrap } from "./WidgetRegistrySyncBootstrap";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <CommandCenterConfigProvider>
        <ThemeProvider>
          <CommandCenterPreferencesProvider>
            <WidgetRegistrySyncBootstrap />
            {children}
            <Toaster />
          </CommandCenterPreferencesProvider>
        </ThemeProvider>
      </CommandCenterConfigProvider>
    </QueryClientProvider>
  );
}
