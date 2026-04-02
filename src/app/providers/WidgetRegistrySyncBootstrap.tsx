import { useEffect } from "react";

import { syncWidgetTypesOnceForSession } from "@/app/registry/widget-type-sync";
import { useAuthStore } from "@/auth/auth-store";

export function WidgetRegistrySyncBootstrap() {
  const status = useAuthStore((state) => state.status);
  const sessionId = useAuthStore((state) => state.session?.user.id ?? null);
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);

  useEffect(() => {
    if (status !== "authenticated" || !sessionId || !sessionToken) {
      return;
    }

    void syncWidgetTypesOnceForSession();
  }, [sessionId, sessionToken, status]);

  return null;
}
