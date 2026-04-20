import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/auth/auth-store";
import {
  resolveMainSequenceAiAssistantAccess,
  resolveMainSequenceAiAssistantEndpoint,
} from "../../runtime/assistant-endpoint";

export function useAssistantRuntimeAccess() {
  const configuredAssistantEndpoint = resolveMainSequenceAiAssistantEndpoint();
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
        assistantEndpoint: configuredAssistantEndpoint,
        runtimeTarget: "agent-runtime",
        sessionToken,
        sessionTokenType,
      }),
  });

  return {
    assistantEndpoint: accessQuery.data?.assistantEndpoint ?? configuredAssistantEndpoint,
    configuredAssistantEndpoint,
    error: accessQuery.error,
    isError: accessQuery.isError,
    isLoading: accessQuery.isLoading,
    isReady: Boolean(accessQuery.data),
    refetch: accessQuery.refetch,
    sessionToken,
    sessionTokenType,
  };
}
