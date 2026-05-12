import { useEffect, useState } from "react";

import { ArrowRight, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  getSocialMfaSetup,
  verifyBrowserMfaChallenge,
  verifySocialMfaSetup,
} from "@/auth/api";
import {
  clearPendingSocialAuthSession,
  parseSocialAuthCallback,
  readPendingSocialAuthSession,
  type PendingSocialAuthSession,
} from "@/auth/social-auth";
import { useAuthStore } from "@/auth/auth-store";
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
import { formatSocialProviderName } from "@/features/auth/socialProviderPresentation";

type CallbackUiState = "resolving" | "mfa_verify" | "mfa_setup" | "error";

interface SocialMfaSetupChallenge {
  detail: string;
  setupToken: string;
  setupUrl: string;
  setupVerifyUrl: string;
  qrPngBase64?: string;
  manualEntryKey?: string;
}

function normalizeMfaCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Unable to continue social sign-in.";
}

export function SocialAuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { app } = useCommandCenterConfig();
  const completeSocialLogin = useAuthStore((state) => state.completeSocialLogin);
  const applyJwtResponse = useAuthStore((state) => state.applyJwtResponse);

  const [uiState, setUiState] = useState<CallbackUiState>("resolving");
  const [pendingSession, setPendingSession] = useState<PendingSocialAuthSession | null>(null);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaVerifyUrl, setMfaVerifyUrl] = useState("");
  const [mfaSetupChallenge, setMfaSetupChallenge] = useState<SocialMfaSetupChallenge | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveCallback() {
      const callbackPayload = parseSocialAuthCallback(new URLSearchParams(location.search));

      if (callbackPayload.type === "invalid") {
        setCallbackError(callbackPayload.detail);
        setUiState("error");
        return;
      }

      const pending = readPendingSocialAuthSession();

      if (!pending || pending.state !== callbackPayload.state) {
        clearPendingSocialAuthSession();
        setCallbackError("Social sign-in state is missing or expired. Start again from the login page.");
        setUiState("error");
        return;
      }

      setPendingSession(pending);

      if (callbackPayload.type === "error") {
        clearPendingSocialAuthSession();
        setCallbackError(callbackPayload.detail);
        setUiState("error");
        return;
      }

      if (callbackPayload.type === "code") {
        const didLogin = await completeSocialLogin({
          code: callbackPayload.code,
          code_verifier: pending.codeVerifier,
          redirect_uri: pending.redirectUri,
        });

        if (cancelled) {
          return;
        }

        if (didLogin) {
          clearPendingSocialAuthSession();
          navigate(pending.redirectTarget, { replace: true });
          return;
        }

        clearPendingSocialAuthSession();
        setCallbackError(
          useAuthStore.getState().error || "Unable to complete social sign-in.",
        );
        setUiState("error");
        return;
      }

      if (callbackPayload.type === "mfa_required") {
        setMfaVerifyUrl(callbackPayload.mfaVerifyUrl);
        setUiState("mfa_verify");
        return;
      }

      try {
        const setupPayload = await getSocialMfaSetup(callbackPayload.setupUrl);

        if (cancelled) {
          return;
        }

        setMfaSetupChallenge({
          detail:
            setupPayload.detail || "Multi-factor setup is required before sign-in can complete.",
          setupToken: callbackPayload.setupToken,
          setupUrl: callbackPayload.setupUrl,
          setupVerifyUrl: callbackPayload.setupVerifyUrl,
          qrPngBase64: setupPayload.qr_png_base64 || undefined,
          manualEntryKey: setupPayload.manual_entry_key || undefined,
        });
        setUiState("mfa_setup");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCallbackError(readErrorMessage(error));
        setUiState("error");
      }
    }

    void resolveCallback();

    return () => {
      cancelled = true;
    };
  }, [completeSocialLogin, location.search, navigate]);

  async function handleMfaVerifySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!mfaVerifyUrl) {
      setCallbackError("MFA verification URL is missing.");
      setUiState("error");
      return;
    }

    setIsSubmitting(true);
    setCallbackError(null);

    try {
      const response = await verifyBrowserMfaChallenge(mfaVerifyUrl, {
        mfa_code: mfaCode.trim(),
      });
      window.location.assign(response.redirect_url);
    } catch (error) {
      setCallbackError(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMfaSetupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!mfaSetupChallenge) {
      setCallbackError("MFA setup context is missing.");
      setUiState("error");
      return;
    }

    setIsSubmitting(true);
    setCallbackError(null);

    try {
      const response = await verifySocialMfaSetup(mfaSetupChallenge.setupVerifyUrl, {
        mfa_code: mfaCode.trim(),
        setup_token: mfaSetupChallenge.setupToken,
      });

      if (response.redirect_url) {
        window.location.assign(response.redirect_url);
        return;
      }

      if (response.access) {
        const didApply = await applyJwtResponse(response as unknown as Record<string, unknown>);

        if (didApply && pendingSession) {
          clearPendingSocialAuthSession();
          navigate(pendingSession.redirectTarget, { replace: true });
          return;
        }

        setCallbackError(
          useAuthStore.getState().error || "Unable to finalize MFA setup for social sign-in.",
        );
        return;
      }

      setCallbackError(
        "MFA setup verification did not return a redirect URL or token response.",
      );
    } catch (error) {
      setCallbackError(readErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function returnToLogin() {
    clearPendingSocialAuthSession();
    navigate("/login", { replace: true });
  }

  const providerName = pendingSession
    ? formatSocialProviderName(pendingSession.providerId)
    : "social provider";

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[440px] items-center justify-center">
        <Card className="w-full">
          <CardHeader className="space-y-6 text-center">
            <BrandWordmark className="justify-center" imageClassName="h-12 w-auto sm:h-14" />
            <div className="space-y-2">
              <CardTitle className="text-2xl">
                {uiState === "mfa_verify"
                  ? "Verify sign-in"
                  : uiState === "mfa_setup"
                    ? "Set up MFA"
                    : uiState === "error"
                      ? "Sign-in unavailable"
                      : "Completing sign-in"}
              </CardTitle>
              <CardDescription>
                {uiState === "mfa_verify"
                  ? `Enter the authenticator code for your ${app.shortName} account.`
                  : uiState === "mfa_setup"
                    ? `Finish multi-factor setup before ${providerName} sign-in can complete.`
                    : uiState === "error"
                      ? "The browser could not complete the social login callback."
                      : `Finalizing ${providerName} sign-in for ${app.shortName}.`}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {uiState === "resolving" ? (
              <div className="flex items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authorizing social login...</span>
              </div>
            ) : null}

            {uiState === "mfa_verify" ? (
              <form className="space-y-4" onSubmit={handleMfaVerifySubmit}>
                <div className="rounded-[calc(var(--radius)-6px)] border border-primary/25 bg-primary/8 px-3 py-3 text-sm text-foreground">
                  <div className="font-medium">Authenticator code required</div>
                  <div className="mt-1 text-muted-foreground">
                    Your browser session is waiting for MFA verification before social sign-in can continue.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Authenticator code</label>
                  <Input
                    name="social-auth-mfa-code"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(normalizeMfaCode(event.target.value))}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>

                {callbackError ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                    {callbackError}
                  </div>
                ) : null}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Verifying..." : "Verify code"}
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </Button>

                <Button type="button" variant="outline" className="w-full" onClick={returnToLogin}>
                  Back to sign in
                </Button>
              </form>
            ) : null}

            {uiState === "mfa_setup" ? (
              <form className="space-y-4" onSubmit={handleMfaSetupSubmit}>
                <div className="rounded-[calc(var(--radius)-6px)] border border-primary/25 bg-primary/8 p-4">
                  <div className="text-sm font-medium text-foreground">Multi-factor setup required</div>
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

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    First authenticator code
                  </label>
                  <Input
                    name="social-auth-mfa-setup-code"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(normalizeMfaCode(event.target.value))}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>

                {callbackError ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                    {callbackError}
                  </div>
                ) : null}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Completing setup..." : "Enable MFA and continue"}
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </Button>

                <Button type="button" variant="outline" className="w-full" onClick={returnToLogin}>
                  Back to sign in
                </Button>
              </form>
            ) : null}

            {uiState === "error" ? (
              <>
                <div className="rounded-[calc(var(--radius)-6px)] border border-destructive/40 bg-destructive/8 px-3 py-3 text-sm text-destructive">
                  {callbackError || "The social login callback could not be completed."}
                </div>
                <Button type="button" className="w-full" onClick={returnToLogin}>
                  Back to sign in
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
