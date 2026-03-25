import { useEffect, useState } from "react";

import { ArrowRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { getRoleLabel } from "@/auth/permissions";
import { builtinAppRoles, type BuiltinAppRole } from "@/auth/types";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCommandCenterConfig } from "@/config/CommandCenterConfigProvider";
import { env } from "@/config/env";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const { app, auth } = useCommandCenterConfig();
  const isBypassAuth = env.bypassAuth;

  const [identifier, setIdentifier] = useState(
    isBypassAuth ? "admin@mainsequence.local" : "",
  );
  const [password, setPassword] = useState(isBypassAuth ? "demo" : "");
  const [role, setRole] = useState<BuiltinAppRole>("admin");

  const redirectTarget =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    "/app";

  const isSubmitting = status === "authenticating" || status === "resolving";

  useEffect(() => {
    if (status === "authenticated") {
      navigate(redirectTarget, { replace: true });
    }
  }, [navigate, redirectTarget, status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const didLogin = await login({
      identifier,
      password,
      role: isBypassAuth ? role : undefined,
    });

    if (didLogin) {
      navigate(redirectTarget, { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[440px] items-center justify-center">
        <Card className="w-full">
          <CardHeader className="space-y-6 text-center">
            <BrandWordmark className="justify-center" imageClassName="h-12 w-auto sm:h-14" />
            <div className="space-y-2">
              <CardTitle className="text-2xl">Sign in</CardTitle>
              <CardDescription>
                {isBypassAuth
                  ? `Bypass auth for local development in ${app.shortName}.`
                  : `Access the ${app.shortName} command center.`}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" autoComplete="off" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {auth.identifierLabel}
                </label>
                <Input
                  name="auth-identifier"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder={auth.identifierPlaceholder}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Input
                  name="auth-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isBypassAuth ? "demo" : "Enter your password"}
                  autoComplete="new-password"
                  data-1p-ignore="true"
                  data-form-type="other"
                  data-lpignore="true"
                />
              </div>

              {isBypassAuth ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Access class</label>
                  <select
                    value={role}
                    onChange={(event) => {
                      const nextRole = event.target.value as BuiltinAppRole;
                      setRole(nextRole);
                      setIdentifier(`${nextRole}@mainsequence.local`);
                    }}
                    className="h-10 w-full rounded-[calc(var(--radius)-6px)] border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {builtinAppRoles.map((option) => (
                      <option key={option} value={option}>
                        {getRoleLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {status === "resolving"
                  ? "Authorizing..."
                  : isSubmitting
                    ? "Signing in..."
                    : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            {isBypassAuth ? (
              <div className="mt-5 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                <span className="font-mono text-foreground">VITE_BYPASS_AUTH=true</span> is
                enabled. Authentication is bypassed locally and the selected built-in role is used
                for RBAC.
              </div>
            ) : (
              <div className="mt-5 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                Use your organization credentials to access the command center.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
