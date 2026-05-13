import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { listSocialLoginProviders } from "@/auth/api";
import { useAuthStore } from "@/auth/auth-store";
import { getMockAuthHint } from "@/auth/mock-jwt-auth";
import { getRoleLabel } from "@/auth/permissions";
import { createSocialAuthStartRequest } from "@/auth/social-auth";
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
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";
import { useCommandCenterConfig } from "@/config/CommandCenterConfigProvider";
import { env } from "@/config/env";
import {
  SocialProviderIcon,
  formatSocialProviderName,
} from "@/features/auth/socialProviderPresentation";

function normalizeMfaCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function resolveRedirectTarget(
  locationState: { from?: { pathname?: string; search?: string; hash?: string } } | null,
) {
  const pathname = locationState?.from?.pathname?.trim() || "/app";
  const search = locationState?.from?.search?.trim() || "";
  const hash = locationState?.from?.hash?.trim() || "";

  return `${pathname}${search}${hash}` || "/app";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const completeMfaSetup = useAuthStore((state) => state.completeMfaSetup);
  const challenge = useAuthStore((state) => state.challenge);
  const resetLoginState = useAuthStore((state) => state.resetLoginState);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const { app, auth } = useCommandCenterConfig();
  const isBypassAuth = env.bypassAuth;
  const isMockAuth = env.useMockData && !isBypassAuth;
  const mockAuthHint = getMockAuthHint();

  const [identifier, setIdentifier] = useState(
    isBypassAuth
      ? "org_admin@mainsequence.local"
      : isMockAuth
        ? mockAuthHint?.identifier ?? ""
        : "",
  );
  const [password, setPassword] = useState(
    isBypassAuth ? "demo" : isMockAuth ? mockAuthHint?.password ?? "" : "",
  );
  const [role, setRole] = useState<BuiltinAppRole>("org_admin");
  const [mfaCode, setMfaCode] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [socialAuthError, setSocialAuthError] = useState<string | null>(null);
  const [activeSocialProviderId, setActiveSocialProviderId] = useState<string | null>(null);
  const accountDeleted = useMemo(
    () => new URLSearchParams(location.search).get("account_deleted") === "1",
    [location.search],
  );

  const redirectTarget = resolveRedirectTarget(
    (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null) ??
      null,
  );
  const loginUiState: "password_login" | "mfa_verify" | "mfa_setup" =
    challenge?.type === "mfa_setup_required"
      ? "mfa_setup"
      : challenge?.type === "mfa_required"
        ? "mfa_verify"
        : "password_login";
  const mfaVerifyChallenge = challenge?.type === "mfa_required" ? challenge : null;
  const mfaSetupChallenge = challenge?.type === "mfa_setup_required" ? challenge : null;
  const isMfaRequired = loginUiState === "mfa_verify";
  const isMfaSetupRequired = loginUiState === "mfa_setup";
  const isSubmitting = status === "authenticating" || status === "resolving";
  const showSocialLoginSection =
    !isBypassAuth && !isMockAuth && loginUiState === "password_login";
  const submitLabel =
    status === "resolving"
      ? "Authorizing..."
      : isSubmitting
        ? isMfaSetupRequired
          ? "Enabling MFA..."
          : isMfaRequired
            ? "Verifying code..."
            : "Signing in..."
        : isMfaSetupRequired
          ? "Enable MFA and sign in"
          : isMfaRequired
            ? "Verify code"
            : "Sign in";
  const visibleError = socialAuthError ?? error;

  const socialProvidersQuery = useQuery({
    queryKey: ["auth", "social-providers"],
    queryFn: listSocialLoginProviders,
    enabled: showSocialLoginSection,
    retry: false,
    staleTime: 60_000,
  });
  const visibleSocialProviders = socialProvidersQuery.data ?? [];

  useEffect(() => {
    if (status === "authenticated") {
      navigate(redirectTarget, { replace: true });
    }
  }, [navigate, redirectTarget, status]);

  useEffect(() => {
    if (!isMfaRequired) {
      setMfaCode("");
    }

    if (!isMfaSetupRequired) {
      setSetupCode("");
    }
  }, [isMfaRequired, isMfaSetupRequired]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSocialAuthError(null);
    const didLogin = isMfaSetupRequired
      ? await completeMfaSetup({
          setupToken: mfaSetupChallenge?.setupToken ?? "",
          setupVerifyUrl: mfaSetupChallenge?.setupVerifyUrl ?? "",
          mfaCode: setupCode,
        })
      : await login({
          identifier,
          password,
          mfaCode: isMfaRequired ? mfaCode : undefined,
          role: isBypassAuth ? role : undefined,
        });

    if (didLogin) {
      navigate(redirectTarget, { replace: true });
    }
  }

  async function startSocialLogin(provider: { id: string; startUrl: string }) {
    setSocialAuthError(null);
    resetLoginState();
    setActiveSocialProviderId(provider.id);

    try {
      const { startUrl } = await createSocialAuthStartRequest({
        providerId: provider.id,
        providerStartUrl: provider.startUrl,
        redirectTarget,
      });
      window.location.assign(startUrl);
    } catch (error) {
      setActiveSocialProviderId(null);
      setSocialAuthError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to start social sign-in.",
      );
    }
  }

  function resetChallengeAndInputs() {
    resetLoginState();
    setMfaCode("");
    setSetupCode("");
    setSocialAuthError(null);
    setActiveSocialProviderId(null);
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[440px] items-center justify-center">
        <Card className="w-full">
          <CardHeader className="space-y-6 text-center">
            <BrandWordmark className="justify-center" imageClassName="h-12 w-auto sm:h-14" />
            <div className="space-y-2">
              <CardTitle className="text-2xl">Sign in</CardTitle>
              {isBypassAuth ? (
                <CardDescription>
                  {`Bypass auth for local development in ${app.shortName}.`}
                </CardDescription>
              ) : isMockAuth ? (
                <CardDescription>Demo version of {app.shortName}.</CardDescription>
              ) : null}
            </div>
          </CardHeader>

          <CardContent>
            {accountDeleted ? (
              <div className="mb-4 rounded-[calc(var(--radius)-6px)] border border-success/30 bg-success/10 px-3 py-3 text-sm text-foreground">
                <div className="font-medium text-foreground">Account deleted</div>
                <div className="mt-1 text-muted-foreground">
                  Your account was deleted successfully.
                </div>
              </div>
            ) : null}
            <form className="space-y-4" autoComplete="off" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {auth.identifierLabel}
                </label>
                <Input
                  name="auth-identifier"
                  value={identifier}
                  onChange={(event) => {
                    if (challenge) {
                      resetChallengeAndInputs();
                    }
                    setSocialAuthError(null);
                    setIdentifier(event.target.value);
                  }}
                  placeholder={auth.identifierPlaceholder}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Password</label>
                <PasswordInput
                  name="auth-password"
                  value={password}
                  onChange={(event) => {
                    if (challenge) {
                      resetChallengeAndInputs();
                    }
                    setSocialAuthError(null);
                    setPassword(event.target.value);
                  }}
                  placeholder={isBypassAuth ? "demo" : "Enter your password"}
                  autoComplete="new-password"
                  data-1p-ignore="true"
                  data-form-type="other"
                  data-lpignore="true"
                />
              </div>

              {isMfaRequired ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-primary/25 bg-primary/8 px-3 py-3 text-sm text-foreground">
                  <div className="font-medium">Authenticator code required</div>
                  <div className="mt-1 text-muted-foreground">{mfaVerifyChallenge?.detail}</div>
                </div>
              ) : null}

              {isMfaSetupRequired ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-primary/25 bg-primary/8 p-4">
                  <div className="text-sm font-medium text-foreground">
                    Multi-factor setup required
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{mfaSetupChallenge?.detail}</div>
                  {mfaSetupChallenge?.qrPngBase64 ? (
                    <img
                      src={`data:image/png;base64,${mfaSetupChallenge.qrPngBase64}`}
                      alt="MFA setup QR code"
                      className="mt-4 h-40 w-40 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-white p-2"
                    />
                  ) : null}
                  {mfaSetupChallenge?.manualEntryKey ? (
                    <div className="mt-4">
                      <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Manual entry key
                      </div>
                      <div className="mt-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/80 px-3 py-2 font-mono text-sm text-foreground">
                        {mfaSetupChallenge.manualEntryKey}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isMfaRequired ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Authenticator code</label>
                  <Input
                    name="auth-mfa-code"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(normalizeMfaCode(event.target.value))}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>
              ) : null}

              {isMfaSetupRequired ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    First authenticator code
                  </label>
                  <Input
                    name="auth-mfa-setup-code"
                    value={setupCode}
                    onChange={(event) => setSetupCode(normalizeMfaCode(event.target.value))}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>
              ) : null}

              {!isBypassAuth && !isMfaSetupRequired ? (
                <div className="flex justify-end">
                  <Link
                    to="/reset-password"
                    className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Change your password
                  </Link>
                </div>
              ) : null}

              {isBypassAuth ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Access class</label>
                  <select
                    value={role}
                    onChange={(event) => {
                      const nextRole = event.target.value as BuiltinAppRole;
                      resetChallengeAndInputs();
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

              {visibleError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                  {visibleError}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {submitLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>

              {challenge ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={resetChallengeAndInputs}
                >
                  Start over
                </Button>
              ) : null}

              {showSocialLoginSection && visibleSocialProviders.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 py-1">
                    <Separator className="flex-1" />
                    <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Or continue with
                    </span>
                    <Separator className="flex-1" />
                  </div>

                  <div className="space-y-2">
                    {visibleSocialProviders.map((provider) => {
                      const isActive = activeSocialProviderId === provider.id;
                      const providerName = provider.name || formatSocialProviderName(provider.id);

                      return (
                        <Button
                          key={provider.id}
                          type="button"
                          variant="outline"
                          className="w-full justify-start"
                          disabled={isSubmitting || activeSocialProviderId !== null}
                          onClick={() => {
                            void startSocialLogin(provider);
                          }}
                        >
                          {isActive ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SocialProviderIcon providerId={provider.id} className="h-4 w-4" />
                          )}
                          <span>{isActive ? `Connecting to ${providerName}...` : `Continue with ${providerName}`}</span>
                        </Button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </form>

            {isBypassAuth ? (
              <div className="mt-5 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                <span className="font-mono text-foreground">VITE_BYPASS_AUTH=true</span> is
                enabled. Authentication is bypassed locally and the selected built-in role is used
                for RBAC.
              </div>
            ) : isMockAuth && mockAuthHint ? (
              <div className="mt-5 rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                <span className="font-semibold uppercase tracking-[0.16em]">Demo version</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
