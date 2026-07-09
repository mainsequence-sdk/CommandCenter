import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  getEmailSignupConstructionMaterial,
  joinWaitlistEmail,
  listSocialLoginProviders,
  resendEmailSignup,
  submitEmailSignup,
  verifyEmailSignup,
} from "@/auth/api";
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

type AuthView = "signin" | "signup";
type EmailSignupPhase = "signup" | "verify";

const authFieldLabelClass =
  "text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/92";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const completeMfaSetup = useAuthStore((state) => state.completeMfaSetup);
  const applyJwtResponse = useAuthStore((state) => state.applyJwtResponse);
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
  const [authView, setAuthView] = useState<AuthView>("signin");
  const [emailSignupPhase, setEmailSignupPhase] = useState<EmailSignupPhase>("signup");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");
  const [signupFirstName, setSignupFirstName] = useState("");
  const [signupLastName, setSignupLastName] = useState("");
  const [signupVerificationToken, setSignupVerificationToken] = useState("");
  const [signupPendingEmail, setSignupPendingEmail] = useState("");
  const [signupNotice, setSignupNotice] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistNotice, setWaitlistNotice] = useState<string | null>(null);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
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
  const canJoinWaitlist = Boolean(waitlistEmail.trim());

  const socialProvidersQuery = useQuery({
    queryKey: ["auth", "social-providers"],
    queryFn: listSocialLoginProviders,
    enabled: showSocialLoginSection,
    retry: false,
    staleTime: 60_000,
  });
  const discoveredProviders = socialProvidersQuery.data ?? [];
  const emailSignupProvider = useMemo(
    () =>
      discoveredProviders.find(
        (provider) =>
          provider.id === "email" &&
          provider.kind === "email_signup" &&
          Boolean(provider.submitAction?.url) &&
          Boolean(provider.verifyAction?.url) &&
          Boolean(provider.resendAction?.url),
      ) ?? null,
    [discoveredProviders],
  );
  const visibleSocialProviders = useMemo(
    () =>
      discoveredProviders.filter(
        (provider) => !(provider.id === "email" || provider.kind === "email_signup"),
      ),
    [discoveredProviders],
  );
  const emailSignupConstructionUrl = useMemo(() => {
    if (!emailSignupProvider) {
      return "";
    }

    return emailSignupProvider.startAction?.url?.trim() || emailSignupProvider.startUrl.trim();
  }, [emailSignupProvider]);
  const isAuthBootstrapLoading = showSocialLoginSection && socialProvidersQuery.isLoading;
  const emailSignupConstructionQuery = useQuery({
    queryKey: ["auth", "email-signup", emailSignupConstructionUrl],
    queryFn: () => getEmailSignupConstructionMaterial(emailSignupConstructionUrl),
    enabled: authView === "signup" && Boolean(emailSignupConstructionUrl),
    retry: false,
    staleTime: 60_000,
  });
  const emailSignupMutation = useMutation({
    mutationFn: () =>
      submitEmailSignup(emailSignupProvider?.submitAction?.url ?? "", {
        email: signupEmail.trim(),
        password: signupPassword,
        first_name: signupFirstName.trim(),
        last_name: signupLastName.trim(),
      }),
    onSuccess: (result) => {
      setSignupPendingEmail(result.email);
      setSignupNotice(result.detail);
      setSignupError(null);
      setSignupVerificationToken("");
      setEmailSignupPhase("verify");
    },
    onError: (error) => {
      setSignupError(
        error instanceof Error ? error.message : "Unable to start email signup.",
      );
    },
  });
  const verifyEmailSignupMutation = useMutation({
    mutationFn: () =>
      verifyEmailSignup(emailSignupProvider?.verifyAction?.url ?? "", {
        token: signupVerificationToken.trim(),
      }),
    onSuccess: async (result) => {
      setSignupError(null);
      const didApply = await applyJwtResponse({
        access: result.tokens.access,
        refresh: result.tokens.refresh,
      });

      if (didApply) {
        navigate(redirectTarget, { replace: true });
        return;
      }

      setSignupError("Signup completed, but the session could not be started.");
    },
    onError: (error) => {
      setSignupError(
        error instanceof Error ? error.message : "Unable to verify the signup token.",
      );
    },
  });
  const resendEmailSignupMutation = useMutation({
    mutationFn: () =>
      resendEmailSignup(emailSignupProvider?.resendAction?.url ?? "", {
        email: signupPendingEmail.trim() || signupEmail.trim(),
      }),
    onSuccess: (result) => {
      setSignupNotice(result.detail || "Verification email sent.");
      setSignupError(null);
    },
    onError: (error) => {
      setSignupError(
        error instanceof Error ? error.message : "Unable to resend the verification email.",
      );
    },
  });
  const waitlistEmailMutation = useMutation({
    mutationFn: () =>
      joinWaitlistEmail({
        email: waitlistEmail.trim(),
      }),
    onSuccess: (result) => {
      setWaitlistNotice(
        result.message?.trim() ||
          (result.created
            ? "You are on the waitlist."
            : "That email is already on the waitlist."),
      );
      setWaitlistError(null);
    },
    onError: (error) => {
      setWaitlistNotice(null);
      setWaitlistError(
        error instanceof Error ? error.message : "Unable to join the waitlist.",
      );
    },
  });

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

  useEffect(() => {
    if (authView === "signup" && !emailSignupProvider) {
      setAuthView("signin");
    }
  }, [authView, emailSignupProvider]);

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

  async function startSocialLogin(provider: { id: string; startUrl: string; tokenExchangeUrl?: string }) {
    setSocialAuthError(null);
    resetLoginState();
    setActiveSocialProviderId(provider.id);

    try {
      const { startUrl } = await createSocialAuthStartRequest({
        providerId: provider.id,
        providerStartUrl: provider.startUrl,
        redirectTarget,
        tokenExchangeUrl: provider.tokenExchangeUrl,
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

  function submitWaitlistEmail() {
    if (!canJoinWaitlist || waitlistEmailMutation.isPending) {
      return;
    }

    void waitlistEmailMutation.mutateAsync();
  }

  function resetChallengeAndInputs() {
    resetLoginState();
    setMfaCode("");
    setSetupCode("");
    setSocialAuthError(null);
    setActiveSocialProviderId(null);
  }

  function resetSignupState() {
    setEmailSignupPhase("signup");
    setSignupEmail("");
    setSignupPassword("");
    setSignupPasswordConfirm("");
    setSignupFirstName("");
    setSignupLastName("");
    setSignupVerificationToken("");
    setSignupPendingEmail("");
    setSignupNotice(null);
    setSignupError(null);
    emailSignupMutation.reset();
    verifyEmailSignupMutation.reset();
    resendEmailSignupMutation.reset();
  }

  function openSignupView() {
    resetChallengeAndInputs();
    setSocialAuthError(null);
    setAuthView("signup");
    setEmailSignupPhase("signup");
    setSignupNotice(null);
    setSignupError(null);
  }

  function openSignInView() {
    setSocialAuthError(null);
    resetLoginState();
    resetSignupState();
    setAuthView("signin");
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[440px] items-center justify-center">
        <Card className="w-full">
          <CardHeader className="space-y-6 text-center">
            <BrandWordmark className="justify-center" imageClassName="h-12 w-auto sm:h-14" />
            <div className="space-y-2">
              <CardTitle className="text-2xl">
                {authView === "signup"
                  ? emailSignupPhase === "verify"
                    ? "Verify your email"
                    : "Create account"
                  : "Sign in"}
              </CardTitle>
              {isBypassAuth ? (
                <CardDescription>
                  {`Bypass auth for local development in ${app.shortName}.`}
                </CardDescription>
              ) : isMockAuth ? (
                <CardDescription>Demo version of {app.shortName}.</CardDescription>
              ) : authView === "signup" && emailSignupPhase === "verify" ? (
                <CardDescription>
                  Finish email verification to activate your Starter Workspace.
                </CardDescription>
              ) : null}
            </div>
          </CardHeader>

          <CardContent>
            {isAuthBootstrapLoading ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="text-sm font-medium text-foreground">Loading Command Center</div>
              </div>
            ) : (
              <>
                {accountDeleted && authView === "signin" ? (
                  <div className="mb-4 rounded-[calc(var(--radius)-6px)] border border-success/30 bg-success/10 px-3 py-3 text-sm text-foreground">
                    <div className="font-medium text-foreground">Account deleted</div>
                    <div className="mt-1 text-muted-foreground">
                      Your account was deleted successfully.
                    </div>
                  </div>
                ) : null}
                {authView === "signin" ? (
                  <form className="space-y-4" autoComplete="off" onSubmit={handleSubmit}>
                    <div className="space-y-1.5">
                      <label className={authFieldLabelClass}>
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
                      <label className={authFieldLabelClass}>Password</label>
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
                        <label className={authFieldLabelClass}>Authenticator code</label>
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
                        <label className={authFieldLabelClass}>
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
                        <label className={authFieldLabelClass}>Access class</label>
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

                    {showSocialLoginSection &&
                    (visibleSocialProviders.length > 0 || emailSignupProvider) ? (
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

                          {emailSignupProvider ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start"
                              disabled={isSubmitting || activeSocialProviderId !== null}
                              onClick={openSignupView}
                            >
                              <SocialProviderIcon providerId="email" className="h-4 w-4" />
                              <span>Create Account with email</span>
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : null}

                    {showSocialLoginSection ? (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-3 py-1">
                          <Separator className="flex-1" />
                          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Waitlist
                          </span>
                          <Separator className="flex-1" />
                        </div>

                        <div className="space-y-2">
                          <label className={authFieldLabelClass}>Waitlist email</label>
                          <Input
                            type="email"
                            value={waitlistEmail}
                            onChange={(event) => {
                              setWaitlistEmail(event.target.value);
                              setWaitlistNotice(null);
                              setWaitlistError(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                submitWaitlistEmail();
                              }
                            }}
                            placeholder="person@example.com"
                            autoCapitalize="none"
                            autoCorrect="off"
                            autoComplete="email"
                            spellCheck={false}
                            disabled={waitlistEmailMutation.isPending}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            disabled={!canJoinWaitlist || waitlistEmailMutation.isPending}
                            onClick={submitWaitlistEmail}
                          >
                            {waitlistEmailMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            Join the Waitlist!
                          </Button>
                        </div>

                        {waitlistNotice ? (
                          <div className="rounded-[calc(var(--radius)-6px)] border border-success/35 bg-success/10 px-3 py-2 text-sm text-success">
                            {waitlistNotice}
                          </div>
                        ) : null}

                        {waitlistError ? (
                          <div className="rounded-[calc(var(--radius)-6px)] border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                            {waitlistError}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </form>
                ) : (
                  <form
                    className="space-y-4"
                    autoComplete="off"
                    onSubmit={(event) => {
                      event.preventDefault();

                      if (emailSignupPhase === "signup") {
                        if (signupPassword !== signupPasswordConfirm) {
                          setSignupError("Passwords do not match.");
                          return;
                        }

                        void emailSignupMutation.mutateAsync();
                        return;
                      }

                      void verifyEmailSignupMutation.mutateAsync();
                    }}
                  >
                    {emailSignupConstructionQuery.isLoading ? (
                      <div className="rounded-[calc(var(--radius)-6px)] border border-primary/25 bg-primary/8 px-3 py-3 text-sm text-foreground">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading signup options
                        </div>
                      </div>
                    ) : null}

                    {emailSignupConstructionQuery.isError ? (
                      <div className="rounded-[calc(var(--radius)-6px)] border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                        {emailSignupConstructionQuery.error instanceof Error
                          ? emailSignupConstructionQuery.error.message
                          : "Email signup is not available right now."}
                      </div>
                    ) : null}

                    {signupNotice ? (
                      <div className="rounded-[calc(var(--radius)-6px)] border border-primary/25 bg-primary/8 px-3 py-3 text-sm text-foreground">
                        {signupNotice}
                      </div>
                    ) : null}

                    {signupError ? (
                      <div className="rounded-[calc(var(--radius)-6px)] border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                        {signupError}
                      </div>
                    ) : null}

                    {emailSignupPhase === "signup" ? (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className={authFieldLabelClass}>First name</label>
                            <Input
                              name="signup-first-name"
                              value={signupFirstName}
                              onChange={(event) => {
                                setSignupError(null);
                                setSignupFirstName(event.target.value);
                              }}
                              placeholder="Ada"
                              autoComplete="given-name"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className={authFieldLabelClass}>Last name</label>
                            <Input
                              name="signup-last-name"
                              value={signupLastName}
                              onChange={(event) => {
                                setSignupError(null);
                                setSignupLastName(event.target.value);
                              }}
                              placeholder="Lovelace"
                              autoComplete="family-name"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className={authFieldLabelClass}>Email</label>
                          <Input
                            name="signup-email"
                            value={signupEmail}
                            onChange={(event) => {
                              setSignupError(null);
                              setSignupEmail(event.target.value);
                            }}
                            placeholder="user@example.com"
                            autoCapitalize="none"
                            autoCorrect="off"
                            autoComplete="email"
                            spellCheck={false}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className={authFieldLabelClass}>Password</label>
                          <PasswordInput
                            name="signup-password"
                            value={signupPassword}
                            onChange={(event) => {
                              setSignupError(null);
                              setSignupPassword(event.target.value);
                            }}
                            placeholder="Create a password"
                            autoComplete="new-password"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className={authFieldLabelClass}>
                            Confirm password
                          </label>
                          <PasswordInput
                            name="signup-password-confirm"
                            value={signupPasswordConfirm}
                            onChange={(event) => {
                              setSignupError(null);
                              setSignupPasswordConfirm(event.target.value);
                            }}
                            placeholder="Write your password again"
                            autoComplete="new-password"
                          />
                        </div>

                        <Button
                          type="submit"
                          className="w-full"
                          disabled={
                            emailSignupMutation.isPending ||
                            emailSignupConstructionQuery.isLoading ||
                            emailSignupConstructionQuery.isError ||
                            !signupEmail.trim() ||
                            !signupPassword.trim() ||
                            !signupPasswordConfirm.trim() ||
                            signupPassword !== signupPasswordConfirm ||
                            !signupFirstName.trim() ||
                            !signupLastName.trim()
                          }
                        >
                          {emailSignupMutation.isPending ? "Creating account..." : "Create account"}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                          Verifying <span className="font-medium text-foreground">{signupPendingEmail || signupEmail}</span>
                        </div>

                        <div className="space-y-1.5">
                          <label className={authFieldLabelClass}>Verification token</label>
                          <Input
                            name="signup-verification-token"
                            value={signupVerificationToken}
                            onChange={(event) => {
                              setSignupError(null);
                              setSignupVerificationToken(event.target.value);
                            }}
                            placeholder="Paste the email verification token"
                            autoCapitalize="none"
                            autoCorrect="off"
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>

                        <Button
                          type="submit"
                          className="w-full"
                          disabled={
                            verifyEmailSignupMutation.isPending ||
                            !signupVerificationToken.trim()
                          }
                        >
                          {verifyEmailSignupMutation.isPending ? "Verifying..." : "Verify email"}
                          <ArrowRight className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={
                            resendEmailSignupMutation.isPending ||
                            !(signupPendingEmail.trim() || signupEmail.trim())
                          }
                          onClick={() => {
                            void resendEmailSignupMutation.mutateAsync();
                          }}
                        >
                          {resendEmailSignupMutation.isPending ? "Resending..." : "Resend verification email"}
                        </Button>
                      </>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      disabled={
                        emailSignupMutation.isPending ||
                        verifyEmailSignupMutation.isPending ||
                        resendEmailSignupMutation.isPending
                      }
                      onClick={openSignInView}
                    >
                      Back to sign in
                    </Button>
                  </form>
                )}

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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
