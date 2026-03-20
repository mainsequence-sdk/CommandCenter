import type { ReactNode } from "react";

import { Navigate, useLocation } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const session = useAuthStore((state) => state.session);
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === "resolving") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/80 px-5 py-4 text-sm text-muted-foreground shadow-[var(--shadow-panel)]">
          Authorizing session...
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
