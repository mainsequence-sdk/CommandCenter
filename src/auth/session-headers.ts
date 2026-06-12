import type { Session } from "@/auth/types";

export function applySessionAuthHeaders(headers: Headers, session: Session | null | undefined) {
  if (!session?.token) {
    return false;
  }

  headers.set("Authorization", `${session.tokenType ?? "Bearer"} ${session.token}`);

  if (session.user.uid) {
    headers.set("X-User-UID", session.user.uid);
  }

  return true;
}

export function buildSessionAuthHeaderRecord(session: Session): Record<string, string> {
  return {
    Authorization: `${session.tokenType ?? "Bearer"} ${session.token}`,
    ...(session.user.uid ? { "X-User-UID": session.user.uid } : {}),
  };
}
