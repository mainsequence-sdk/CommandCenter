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
  const sessionUserUid = useAuthStore((state) => state.session?.user.uid ?? null);
  const accessQuery = useQuery({
    queryKey: [
      "main-sequence-ai",
      "assistant-runtime-access",
      "command-center-base",
      configuredAssistantEndpoint,
      sessionToken,
      sessionTokenType,
      sessionUserUid,
    ],
    enabled: Boolean(sessionToken && sessionUserUid),
    staleTime: 30_000,
    queryFn: () =>
      resolveMainSequenceAiAssistantAccess({
        assistantEndpoint: configuredAssistantEndpoint ?? undefined,
        runtimeTarget: "command-center-base",
        sessionToken,
        sessionTokenType,
        sessionUserUid,
      }),
  });

  return {
    assistantEndpoint: accessQuery.data?.assistantEndpoint ?? null,
    configuredAssistantEndpoint,
    error: accessQuery.error,
    isError: accessQuery.isError,
    isLoading: accessQuery.isLoading,
    isReady: Boolean(accessQuery.data?.assistantEndpoint),
    isRuntimeStarting: accessQuery.data?.isReady === false,
    mode: accessQuery.data?.mode ?? null,
    refetch: accessQuery.refetch,
    runtimeIsReady: accessQuery.data?.isReady ?? null,
    runtimeAccessMode: accessQuery.data?.runtimeAccessMode ?? null,
    sessionToken,
    sessionTokenType,
    sessionUserUid,
  };
}
