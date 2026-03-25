import { useMemo, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import {
  confirmPasswordReset,
  requestPasswordReset,
  validatePasswordResetLink,
} from "@/auth/api";
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
import { env } from "@/config/env";

function formatAuthError(error: unknown) {
  return error instanceof Error ? error.message : "The request failed.";
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const uidb64 = searchParams.get("uidb64")?.trim() || "";
  const token = searchParams.get("token")?.trim() || "";
  const hasResetToken = Boolean(uidb64 && token);
  const isBypassAuth = env.bypassAuth;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const canSubmitPasswordReset = Boolean(password.trim() && confirmPassword.trim());

  const validateResetQuery = useQuery({
    queryKey: ["auth", "password-reset", "validate", uidb64, token],
    queryFn: () => validatePasswordResetLink({ uidb64, token }),
    enabled: hasResetToken && !isBypassAuth,
    retry: false,
  });

  const requestResetMutation = useMutation({
    mutationFn: requestPasswordReset,
  });

  const confirmResetMutation = useMutation({
    mutationFn: confirmPasswordReset,
  });

  const resetLinkValid = useMemo(() => {
    if (!hasResetToken) {
      return false;
    }

    return validateResetQuery.data?.valid ?? false;
  }, [hasResetToken, validateResetQuery.data?.valid]);

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[460px] items-center justify-center">
        <Card className="w-full">
          <CardHeader className="space-y-6 text-center">
            <BrandWordmark className="justify-center" imageClassName="h-12 w-auto sm:h-14" />
            <div className="space-y-2">
              <div className="flex justify-center">
                <Badge variant="neutral">
                  {hasResetToken ? "Reset password" : "Forgot password"}
                </Badge>
              </div>
              <CardTitle className="text-2xl">
                {hasResetToken ? "Choose a new password" : "Reset your password"}
              </CardTitle>
              <CardDescription>
                {hasResetToken
                  ? "Enter your new password to finish resetting your account."
                  : "Enter your email and we will send you a password reset link."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {isBypassAuth ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                Password reset is unavailable while <span className="font-mono text-foreground">VITE_BYPASS_AUTH=true</span>.
              </div>
            ) : null}

            {!hasResetToken ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();

                  if (!normalizedEmail || isBypassAuth) {
                    return;
                  }

                  requestResetMutation.mutate({ email: normalizedEmail });
                }}
              >
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                    disabled={requestResetMutation.isPending || isBypassAuth}
                    autoFocus
                  />
                </div>

                {requestResetMutation.isError ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                    {formatAuthError(requestResetMutation.error)}
                  </div>
                ) : null}

                {requestResetMutation.isSuccess ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-success/35 bg-success/10 px-4 py-3 text-sm text-success">
                    {requestResetMutation.data.detail}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!normalizedEmail || requestResetMutation.isPending || isBypassAuth}
                >
                  {requestResetMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Send reset email
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                {validateResetQuery.isLoading ? (
                  <div className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validating password reset link
                  </div>
                ) : null}

                {validateResetQuery.isError ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                    {formatAuthError(validateResetQuery.error)}
                  </div>
                ) : null}

                {resetLinkValid ? (
                  <div className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-success/35 bg-success/10 px-4 py-3 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    {validateResetQuery.data?.detail}
                  </div>
                ) : null}

                {confirmResetMutation.isSuccess ? (
                  <div className="space-y-4">
                    <div className="rounded-[calc(var(--radius)-6px)] border border-success/35 bg-success/10 px-4 py-3 text-sm text-success">
                      {confirmResetMutation.data.detail}
                    </div>
                    <Link
                      to="/login"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-[calc(var(--radius)-4px)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90"
                    >
                        Back to sign in
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : resetLinkValid ? (
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();

                      if (!canSubmitPasswordReset) {
                        return;
                      }

                      confirmResetMutation.mutate({
                        uidb64,
                        token,
                        password: password.trim(),
                        confirm_password: confirmPassword.trim(),
                      });
                    }}
                  >
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">New password</label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="NewStrongPass123!"
                        autoComplete="new-password"
                        disabled={confirmResetMutation.isPending}
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Confirm password</label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="NewStrongPass123!"
                        autoComplete="new-password"
                        disabled={confirmResetMutation.isPending}
                      />
                    </div>

                    {confirmResetMutation.isError ? (
                      <div className="rounded-[calc(var(--radius)-6px)] border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                        {formatAuthError(confirmResetMutation.error)}
                      </div>
                    ) : null}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={!canSubmitPasswordReset || confirmResetMutation.isPending}
                    >
                      {confirmResetMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Change password
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                ) : null}
              </div>
            )}

            <div className="flex justify-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
