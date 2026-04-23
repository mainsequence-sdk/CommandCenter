import { getAppPath } from "@/apps/utils";

export const AGENT_SESSION_DETAIL_SURFACE_ID = "session";
export const AGENT_SESSION_DETAIL_PAGE_PATH = getAppPath(
  "main_sequence_ai",
  AGENT_SESSION_DETAIL_SURFACE_ID,
);

export function getAgentSessionDetailPath(sessionId: string | number) {
  const params = new URLSearchParams({
    session: String(sessionId),
  });

  return `${AGENT_SESSION_DETAIL_PAGE_PATH}?${params.toString()}`;
}
