import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/auth/auth-store";
import {
  resolveMainSequenceAiAssistantAccess,
  resolveMainSequenceAiConfiguredAssistantEndpoint,
} from "../../runtime/assistant-endpoint";

export function useAssistantRuntimeAccess() {
  const configuredAssistantEndpoint = resolveMainSequenceAiConfiguredAssistantEndpoint();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const accessQuery = useQuery({
    queryKey: [
      "main-sequence-ai",
      "assistant-runtime-access",
      configuredAssistantEndpoint,
      sessionToken,
      sessionTokenType,
    ],
    enabled: Boolean(sessionToken),
    staleTime: 30_000,
    queryFn: () =>
      resolveMainSequenceAiAssistantAccess({
        runtimeTarget: "agent-runtime",
        sessionToken,
        sessionTokenType,
      }),
  });

  return {
    assistantEndpoint: accessQuery.data?.assistantEndpoint ?? null,
    configuredAssistantEndpoint,
    error: accessQuery.error,
    isError: accessQuery.isError,
    isLoading: accessQuery.isLoading,
    isReady: Boolean(accessQuery.data?.assistantEndpoint),
    mode: accessQuery.data?.mode ?? null,
    refetch: accessQuery.refetch,
    runtimeAccessMode: accessQuery.data?.runtimeAccessMode ?? null,
    sessionToken,
    sessionTokenType,
  };
}
