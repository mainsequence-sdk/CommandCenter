import { useEffect, useMemo, useState } from "react";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { getRoleLabel } from "@/auth/permissions";
import { builtinAppRoles, type BuiltinAppRole } from "@/auth/types";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCommandCenterConfig } from "@/config/CommandCenterConfigProvider";
import { env } from "@/config/env";
import { withAlpha } from "@/lib/color";
import { useTheme } from "@/themes/ThemeProvider";

type Tone = "primary" | "accent" | "warning" | "danger";

interface SignalNode {
  id: string;
  label: string;
  subtitle: string;
  value: string;
  x: number;
  y: number;
  tone: Tone;
}

interface SignalLink {
  from: string;
  to: string;
  weight: number;
  tone: Tone;
  negative?: boolean;
}

const heroHighlights = [
  "Causal propagation across rates, flow, and microstructure",
  "Distribution diagnostics and stress paths in one operating surface",
  "Built for data-driven enterprises, not brochure dashboards",
] as const;

const heroMetrics = [
  { label: "Signal density", value: "184", detail: "tracked factors" },
  { label: "Regime drift", value: "+1.7σ", detail: "live transition score" },
  { label: "Tail pressure", value: "23%", detail: "stress-path probability" },
] as const;

const signalNodes: SignalNode[] = [
  {
    id: "liquidity",
    label: "Liquidity Pulse",
    subtitle: "dealer balance",
    value: "+2.4σ",
    x: 0.12,
    y: 0.22,
    tone: "accent",
  },
  {
    id: "systematic",
    label: "Systematic Flow",
    subtitle: "cta pressure",
    value: "+1.9σ",
    x: 0.15,
    y: 0.72,
    tone: "primary",
  },
  {
    id: "rates",
    label: "Real Rates",
    subtitle: "macro drag",
    value: "-0.8σ",
    x: 0.46,
    y: 0.14,
    tone: "warning",
  },
  {
    id: "semis",
    label: "Semis Breadth",
    subtitle: "lead basket",
    value: "+2.1σ",
    x: 0.33,
    y: 0.45,
    tone: "primary",
  },
  {
    id: "dispersion",
    label: "Dispersion",
    subtitle: "single-name spread",
    value: "+1.0σ",
    x: 0.6,
    y: 0.42,
    tone: "danger",
  },
  {
    id: "vol",
    label: "Vol-of-Vol",
    subtitle: "tail reflexivity",
    value: "+1.3σ",
    x: 0.82,
    y: 0.66,
    tone: "danger",
  },
  {
    id: "growth",
    label: "Growth Beta",
    subtitle: "risk receiver",
    value: "+1.6σ",
    x: 0.52,
    y: 0.8,
    tone: "accent",
  },
];

const signalLinks: SignalLink[] = [
  { from: "liquidity", to: "semis", weight: 0.78, tone: "accent" },
  { from: "systematic", to: "growth", weight: 0.72, tone: "primary" },
  { from: "systematic", to: "semis", weight: 0.61, tone: "primary" },
  { from: "rates", to: "growth", weight: 0.68, tone: "warning", negative: true },
  { from: "rates", to: "dispersion", weight: 0.49, tone: "warning", negative: true },
  { from: "semis", to: "growth", weight: 0.83, tone: "primary" },
  { from: "dispersion", to: "vol", weight: 0.86, tone: "danger" },
  { from: "growth", to: "vol", weight: 0.44, tone: "danger" },
];

const distributionBase = [10, 18, 24, 37, 54, 66, 74, 68, 56, 39, 24, 14];
const distributionLive = [8, 14, 20, 29, 43, 56, 64, 58, 49, 33, 20, 12];
const distributionStress = [18, 24, 30, 36, 39, 35, 28, 22, 17, 12, 8, 5];

const heatmapRows = ["Rates", "Liquidity", "Credit", "Gamma", "Energy"] as const;
const heatmapColumns = ["Semis", "Quality", "Value", "Small Cap", "Vol"] as const;
const heatmapValues = [
  [-0.62, -0.21, 0.42, -0.54, 0.71],
  [0.88, 0.55, 0.19, 0.62, -0.34],
  [-0.48, -0.72, 0.31, -0.44, 0.83],
  [0.69, 0.42, -0.18, 0.74, -0.91],
  [0.24, -0.12, 0.58, 0.33, 0.17],
] as const;

const scenarioCards = [
  {
    label: "Rates Relief",
    probability: "43%",
    move: "+1.4σ",
    tone: "primary" as const,
  },
  {
    label: "Liquidity Whipsaw",
    probability: "31%",
    move: "-0.9σ",
    tone: "warning" as const,
  },
  {
    label: "Credit Breakout",
    probability: "18%",
    move: "-2.1σ",
    tone: "danger" as const,
  },
] as const;

function distributionPath(values: readonly number[], width: number, height: number) {
  const paddingX = 18;
  const paddingY = 14;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  const max = Math.max(...distributionBase, ...distributionLive, ...distributionStress);
  const step = usableWidth / (values.length - 1);

  const line = values
    .map((value, index) => {
      const x = paddingX + index * step;
      const y = height - paddingY - (value / max) * usableHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return `${line} L ${paddingX + usableWidth} ${height - paddingY} L ${paddingX} ${
    height - paddingY
  } Z`;
}

function toneColor(
  tone: Tone,
  tokens: ReturnType<typeof useTheme>["resolvedTokens"],
) {
  if (tone === "accent") return tokens.accent;
  return tokens[tone];
}

function NetworkShowcase({ phase }: { phase: number }) {
  const { resolvedTokens } = useTheme();
  const width = 760;
  const height = 400;
  const activeNode = signalNodes[phase % signalNodes.length];
  const nodeMap = new Map(signalNodes.map((node) => [node.id, node]));

  return (
    <div
      className="relative overflow-hidden rounded-[26px] border border-white/10 p-5"
      style={{
        background: `linear-gradient(160deg, ${withAlpha(
          resolvedTokens.card,
          0.94,
        )} 0%, ${withAlpha(resolvedTokens.background, 0.92)} 64%, ${withAlpha(
          resolvedTokens.primary,
          0.12,
        )} 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 w-28"
        style={{
          left: `${10 + (phase % 6) * 13}%`,
          background: `linear-gradient(90deg, transparent 0%, ${withAlpha(
            resolvedTokens.primary,
            0.14,
          )} 48%, transparent 100%)`,
          filter: "blur(14px)",
        }}
      />

      <div className="relative mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Regime Transmission
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-card-foreground">
            Propagation Lattice
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Mock causal mesh showing which factors are carrying the market state right now.
          </div>
        </div>
        <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-primary">
          live mock feed
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[22px] border border-white/8 bg-black/15">
        <div
          className="absolute inset-0 opacity-35"
          style={{
            backgroundImage: `linear-gradient(${withAlpha(
              resolvedTokens.border,
              0.28,
            )} 1px, transparent 1px), linear-gradient(90deg, ${withAlpha(
              resolvedTokens.border,
              0.28,
            )} 1px, transparent 1px)`,
            backgroundSize: "42px 42px, 42px 42px",
          }}
        />
        <svg className="relative h-[400px] w-full" viewBox={`0 0 ${width} ${height}`}>
          {signalLinks.map((link) => {
            const from = nodeMap.get(link.from);
            const to = nodeMap.get(link.to);

            if (!from || !to) {
              return null;
            }

            const x1 = from.x * width;
            const y1 = from.y * height;
            const x2 = to.x * width;
            const y2 = to.y * height;
            const curve = Math.max(54, Math.abs(x2 - x1) * 0.4);
            const path = `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
            const tone = toneColor(link.tone, resolvedTokens);
            const connected = link.from === activeNode.id || link.to === activeNode.id;

            return (
              <g key={`${link.from}-${link.to}`}>
                <path
                  d={path}
                  fill="none"
                  stroke={withAlpha(tone, connected ? 0.18 : 0.08)}
                  strokeWidth={8 + link.weight * 2}
                  strokeLinecap="round"
                />
                <path
                  d={path}
                  fill="none"
                  stroke={withAlpha(tone, connected ? 0.95 : 0.48)}
                  strokeWidth={1.2 + link.weight * 2.8}
                  strokeLinecap="round"
                  strokeDasharray={link.negative ? "10 10" : undefined}
                />
              </g>
            );
          })}
        </svg>

        {signalNodes.map((node) => {
          const tone = toneColor(node.tone, resolvedTokens);
          const isActive = node.id === activeNode.id;

          return (
            <div
              key={node.id}
              className="absolute w-[154px] rounded-[18px] border p-3 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur"
              style={{
                left: `calc(${node.x * 100}% - 77px)`,
                top: `calc(${node.y * 100}% - 46px)`,
                borderColor: withAlpha(tone, isActive ? 0.52 : 0.22),
                background: `linear-gradient(160deg, ${withAlpha(
                  tone,
                  isActive ? 0.18 : 0.1,
                )} 0%, ${withAlpha(resolvedTokens.card, 0.92)} 55%, ${withAlpha(
                  resolvedTokens.background,
                  0.96,
                )} 100%)`,
                transform: isActive ? "scale(1.03)" : "scale(1)",
              }}
            >
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {node.subtitle}
              </div>
              <div className="mt-1 text-sm font-semibold text-card-foreground">{node.label}</div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="text-xl font-semibold text-card-foreground">{node.value}</div>
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: tone,
                    boxShadow: `0 0 18px ${withAlpha(tone, 0.9)}`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsShowcase({ phase }: { phase: number }) {
  const { resolvedTokens } = useTheme();
  const width = 420;
  const height = 180;
  const highlightedColumn = phase % heatmapColumns.length;

  return (
    <div className="grid gap-4 xl:grid-rows-[1.1fr_0.9fr]">
      <div
        className="rounded-[26px] border border-white/10 p-5"
        style={{
          background: `linear-gradient(180deg, ${withAlpha(
            resolvedTokens.card,
            0.94,
          )} 0%, ${withAlpha(resolvedTokens.background, 0.92)} 100%)`,
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Distribution Diagnostics
            </div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-card-foreground">
              Density Stack
            </div>
          </div>
          <Badge variant="warning">stress-aware</Badge>
        </div>

        <div className="relative overflow-hidden rounded-[18px] border border-white/8 bg-black/15">
          <svg className="h-[180px] w-full" viewBox={`0 0 ${width} ${height}`}>
            <path
              d={distributionPath(distributionStress, width, height)}
              fill={withAlpha(resolvedTokens.warning, 0.18)}
              stroke={withAlpha(resolvedTokens.warning, 0.92)}
              strokeWidth="2"
            />
            <path
              d={distributionPath(distributionBase, width, height)}
              fill={withAlpha(resolvedTokens.foreground, 0.05)}
              stroke={withAlpha(resolvedTokens.foreground, 0.42)}
              strokeWidth="2"
            />
            <path
              d={distributionPath(distributionLive, width, height)}
              fill={withAlpha(resolvedTokens.primary, 0.16)}
              stroke={withAlpha(resolvedTokens.primary, 0.96)}
              strokeWidth="2.5"
            />
            <line
              x1={50 + (phase % distributionLive.length) * 28}
              x2={50 + (phase % distributionLive.length) * 28}
              y1="16"
              y2="164"
              stroke={withAlpha(resolvedTokens.accent, 0.8)}
              strokeDasharray="8 8"
            />
          </svg>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-[16px] border border-border/60 bg-background/35 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Skew
            </div>
            <div className="mt-1 text-lg font-semibold text-card-foreground">-0.41</div>
          </div>
          <div className="rounded-[16px] border border-border/60 bg-background/35 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              VaR 99
            </div>
            <div className="mt-1 text-lg font-semibold text-card-foreground">-2.34σ</div>
          </div>
          <div className="rounded-[16px] border border-border/60 bg-background/35 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Tail mass
            </div>
            <div className="mt-1 text-lg font-semibold text-card-foreground">18.6%</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div
          className="rounded-[26px] border border-white/10 p-5"
          style={{
            background: `linear-gradient(180deg, ${withAlpha(
              resolvedTokens.card,
              0.94,
            )} 0%, ${withAlpha(resolvedTokens.background, 0.92)} 100%)`,
          }}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Lead / Lag
              </div>
              <div className="mt-2 text-xl font-semibold tracking-tight text-card-foreground">
                Cross-Impact Matrix
              </div>
            </div>
            <Badge variant="secondary">{heatmapColumns[highlightedColumn]}</Badge>
          </div>

          <div className="grid grid-cols-[84px_repeat(5,minmax(0,1fr))] gap-1.5">
            <div />
            {heatmapColumns.map((column, index) => (
              <div
                key={column}
                className="rounded-[14px] border px-2 py-2 text-center text-[10px] font-medium uppercase tracking-[0.14em]"
                style={{
                  borderColor: withAlpha(
                    resolvedTokens.border,
                    index === highlightedColumn ? 0.48 : 0.18,
                  ),
                  backgroundColor:
                    index === highlightedColumn
                      ? withAlpha(resolvedTokens.primary, 0.16)
                      : withAlpha(resolvedTokens.background, 0.28),
                  color:
                    index === highlightedColumn
                      ? resolvedTokens["topbar-foreground"]
                      : resolvedTokens["muted-foreground"],
                }}
              >
                {column}
              </div>
            ))}

            {heatmapRows.map((row, rowIndex) => (
              <div key={row} className="contents">
                <div className="flex items-center rounded-[14px] border border-border/50 bg-background/28 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {row}
                </div>
                {heatmapValues[rowIndex].map((value, columnIndex) => {
                  const positive = value >= 0;
                  const tone = positive ? resolvedTokens.primary : resolvedTokens.danger;
                  const active = columnIndex === highlightedColumn;

                  return (
                    <div
                      key={`${row}-${heatmapColumns[columnIndex]}`}
                      className="flex min-h-[54px] items-center justify-center rounded-[14px] border text-sm font-semibold"
                      style={{
                        borderColor: withAlpha(tone, active ? 0.42 : 0.26),
                        background: `linear-gradient(180deg, ${withAlpha(
                          tone,
                          0.1 + Math.abs(value) * (active ? 0.36 : 0.24),
                        )} 0%, ${withAlpha(resolvedTokens.card, 0.84)} 100%)`,
                        color: resolvedTokens["card-foreground"],
                      }}
                    >
                      {value > 0 ? "+" : ""}
                      {value.toFixed(2)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          {scenarioCards.map((card) => {
            const tone =
              card.tone === "primary"
                ? resolvedTokens.primary
                : card.tone === "warning"
                  ? resolvedTokens.warning
                  : resolvedTokens.danger;

            return (
              <div
                key={card.label}
                className="rounded-[22px] border border-white/10 p-4"
                style={{
                  background: `linear-gradient(160deg, ${withAlpha(
                    tone,
                    0.14,
                  )} 0%, ${withAlpha(resolvedTokens.card, 0.9)} 60%, ${withAlpha(
                    resolvedTokens.background,
                    0.92,
                  )} 100%)`,
                }}
              >
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {card.label}
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-2xl font-semibold tracking-tight text-card-foreground">
                    {card.probability}
                  </div>
                  <div
                    className="rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.14em]"
                    style={{
                      backgroundColor: withAlpha(tone, 0.18),
                      color: tone,
                    }}
                  >
                    {card.move}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LoginPageV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const { app, auth } = useCommandCenterConfig();
  const { resolvedTokens } = useTheme();
  const isBypassAuth = env.bypassAuth;
  const [phase, setPhase] = useState(0);

  const [identifier, setIdentifier] = useState(
    isBypassAuth ? "admin@mainsequence.local" : "",
  );
  const [password, setPassword] = useState(isBypassAuth ? "demo" : "");
  const [role, setRole] = useState<BuiltinAppRole>("admin");

  const redirectTarget =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/app";
  const isSubmitting = status === "authenticating" || status === "resolving";

  const glowPoint = useMemo(() => [18, 26, 38, 52, 66, 58][phase % 6], [phase]);

  useEffect(() => {
    if (status === "authenticated") {
      navigate(redirectTarget, { replace: true });
    }
  }, [navigate, redirectTarget, status]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPhase((current) => (current + 1) % 12);
    }, 1400);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

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
    <div
      className="relative min-h-screen overflow-hidden px-6 py-10 text-foreground md:px-8 md:py-12"
      style={{
        background: `radial-gradient(circle at ${glowPoint}% 12%, ${withAlpha(
          resolvedTokens.primary,
          0.18,
        )} 0%, transparent 24%), radial-gradient(circle at 82% 78%, ${withAlpha(
          resolvedTokens.accent,
          0.14,
        )} 0%, transparent 24%), linear-gradient(145deg, ${withAlpha(
          resolvedTokens.background,
          0.98,
        )} 0%, ${withAlpha(resolvedTokens.topbar, 0.96)} 48%, ${withAlpha(
          resolvedTokens.sidebar,
          0.98,
        )} 100%)`,
      }}
    >
      <div className="absolute inset-0 opacity-30">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `linear-gradient(${withAlpha(
              resolvedTokens.border,
              0.18,
            )} 1px, transparent 1px), linear-gradient(90deg, ${withAlpha(
              resolvedTokens.border,
              0.18,
            )} 1px, transparent 1px)`,
            backgroundSize: "56px 56px, 56px 56px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1560px] items-start pb-6">
        <div className="grid w-full items-start gap-8 lg:grid-cols-[420px_minmax(0,1fr)] xl:gap-12">
          <Card className="relative z-10 mb-6 w-full border-white/10 bg-[linear-gradient(180deg,rgba(10,16,27,0.92)_0%,rgba(7,12,21,0.88)_100%)] shadow-[0_28px_80px_rgba(0,0,0,0.36)]">
            <CardHeader className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="primary">v2 preview</Badge>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  operator entry
                </div>
              </div>

              <div className="space-y-3">
                <BrandWordmark imageClassName="h-5" />
                <div className="text-3xl font-semibold tracking-tight text-topbar-foreground">
                  Enter the command center.
                </div>
                <CardDescription className="max-w-sm text-sm leading-6">
                  Experimental login concept with a more theatrical quant-driven hero.
                  The current production login remains untouched.
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
                    className="bg-background/50"
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
                    className="bg-background/50"
                  />
                </div>

                {isBypassAuth ? (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Role</label>
                    <select
                      value={role}
                      onChange={(event) => setRole(event.target.value as BuiltinAppRole)}
                      className="h-10 w-full rounded-[calc(var(--radius)-6px)] border border-input bg-background/50 px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                  <div className="rounded-[calc(var(--radius)-6px)] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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

              <div className="mt-5 space-y-3 rounded-[calc(var(--radius)-6px)] border border-white/8 bg-white/[0.03] p-4">
                {heroHighlights.map((highlight) => (
                  <div key={highlight} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[calc(var(--radius)-6px)] border border-white/8 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                {isBypassAuth ? (
                  <>
                    <span className="font-mono text-foreground">VITE_BYPASS_AUTH=true</span> is
                    enabled. This `v2` route still follows the same local bypass behavior.
                  </>
                ) : (
                  <>Use your organization credentials to access the command center.</>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="hidden min-h-[780px] flex-col gap-6 lg:flex">
            <div className="flex items-end justify-between gap-6">
              <div className="max-w-3xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Live quant concept
                </div>
                <h1 className="mt-3 text-5xl font-semibold tracking-tight text-topbar-foreground">
                  See the market as a living system.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  A more cinematic login experiment: causal propagation, live densities,
                  cross-impact heatmaps, and scenario paths assembled into one dramatic
                  entrance surface for {app.shortName}.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {heroMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="min-w-[136px] rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur"
                  >
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {metric.label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-topbar-foreground">
                      {metric.value}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{metric.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid flex-1 gap-5 xl:grid-cols-[1.16fr_0.84fr]">
              <NetworkShowcase phase={phase} />
              <AnalyticsShowcase phase={phase} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
