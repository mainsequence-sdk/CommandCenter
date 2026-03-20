import { useEffect, useMemo, useState } from "react";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { getRoleLabel } from "@/auth/permissions";
import { builtinAppRoles, type BuiltinAppRole } from "@/auth/types";
import { env } from "@/config/env";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Badge } from "@/components/ui/badge";
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

  const highlights = useMemo(
    () => [
      "Extension-first widget registry",
      "Theme system built for deep customization",
      "Community-friendly component reuse",
    ],
    [],
  );

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
    <div className="relative min-h-screen overflow-hidden bg-background px-6 py-10 text-foreground md:py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(79,140,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_25%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1440px] items-center pb-6">
        <div className="grid w-full items-start gap-8 lg:grid-cols-[minmax(360px,420px)_minmax(0,1fr)] xl:gap-12">
          <div className="order-2 hidden w-full rounded-[calc(var(--radius)+10px)] border border-border/80 bg-card/70 p-8 shadow-[var(--shadow-panel)] backdrop-blur lg:flex lg:flex-col lg:justify-between lg:gap-6">
            <div className="space-y-5">
              <div>
                <BrandWordmark className="mb-4" imageClassName="h-8" />
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Open-source command center
                </div>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                  Built for data-driven enterprises that expect more than dashboards.
                </h1>
              </div>

              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                {app.name} is the open-source command center for data-driven enterprises. It is
                designed to make extensibility, deep customization, and reusable community
                components the default, so teams can compose a tailored operating surface instead
                of rebuilding the same shell from scratch.
              </p>

              <div className="grid gap-3 lg:grid-cols-3">
                {highlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="flex h-full items-start gap-2.5 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-muted/40 px-4 py-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-sm leading-5 text-foreground">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[calc(var(--radius)+2px)] border border-border/80 bg-background/70 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Base shell preview</div>
                  <div className="text-xs text-muted-foreground">Small rail + slim top bar</div>
                </div>
                <Badge variant="primary">open source</Badge>
              </div>
              <div className="grid h-72 grid-cols-[60px_1fr] overflow-hidden rounded-[calc(var(--radius)-4px)] border border-border/70 bg-card/70">
                <div className="border-r border-border/70 bg-sidebar/90 p-3">
                  <div className="mb-4 h-10 rounded-xl border border-border/70 bg-card/80" />
                  <div className="space-y-2">
                    <div className="h-10 rounded-xl bg-primary/12" />
                    <div className="h-10 rounded-xl bg-muted/70" />
                    <div className="h-10 rounded-xl bg-muted/70" />
                  </div>
                </div>
                <div className="grid grid-rows-[44px_1fr]">
                  <div className="border-b border-border/70 bg-topbar/80 px-4 py-3">
                    <div className="h-5 w-48 rounded bg-muted/70" />
                  </div>
                  <div className="grid grid-cols-12 gap-3 p-4">
                    <div className="col-span-4 rounded-2xl border border-border/70 bg-card/80" />
                    <div className="col-span-8 rounded-2xl border border-border/70 bg-card/80" />
                    <div className="col-span-7 rounded-2xl border border-border/70 bg-card/80" />
                    <div className="col-span-5 rounded-2xl border border-border/70 bg-card/80" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Card className="order-1 mb-6 w-full max-w-[420px] self-start justify-self-start lg:mb-10">
            <CardHeader className="space-y-4">
              <div>
                <div className="text-sm font-semibold">Sign in</div>
                <CardDescription>
                  {isBypassAuth
                    ? `Bypass auth for local development in ${app.shortName}.`
                    : `Access the ${app.shortName} command center.`}
                </CardDescription>
              </div>
              {isBypassAuth ? (
                <div className="flex flex-wrap gap-2">
                  {builtinAppRoles.map((option) => (
                    <Badge
                      key={option}
                      variant={option === role ? "primary" : "neutral"}
                      className="cursor-pointer"
                      onClick={() => {
                        setRole(option);
                        setIdentifier(`${option}@mainsequence.local`);
                      }}
                    >
                      {getRoleLabel(option)}
                    </Badge>
                  ))}
                </div>
              ) : null}
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
                    <label className="text-sm font-medium text-foreground">Role</label>
                    <select
                      value={role}
                      onChange={(event) => setRole(event.target.value as BuiltinAppRole)}
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
                  enabled. Authentication is bypassed locally and the selected built-in role is
                  used for RBAC.
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
    </div>
  );
}
