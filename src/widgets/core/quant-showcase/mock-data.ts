export interface QuantSummaryMetric {
  label: string;
  value: string;
  detail: string;
  tone: "primary" | "accent" | "warning";
}

export interface QuantCausalNode {
  id: string;
  label: string;
  cluster: "Flow" | "Rates" | "Micro" | "Risk";
  x: number;
  y: number;
  impulse: number;
  confidence: number;
  score: string;
  detail: string;
}

export interface QuantCausalEdge {
  from: string;
  to: string;
  weight: number;
  polarity: "positive" | "negative";
  label: string;
}

export interface DistributionStat {
  label: string;
  value: string;
  detail: string;
}

export interface DistributionMarker {
  label: string;
  x: number;
  value: string;
}

export interface ScenarioCone {
  name: string;
  tone: "primary" | "warning" | "danger";
  probability: number;
  horizon: string;
  expectedMove: string;
  halfLife: string;
  drivers: string[];
  center: number[];
  upper: number[];
  lower: number[];
}

export const quantSummaryMetrics: QuantSummaryMetric[] = [
  {
    label: "Activated edges",
    value: "18 / 24",
    detail: "Causal links above the propagation threshold",
    tone: "primary",
  },
  {
    label: "Mean elasticity",
    value: "+0.62",
    detail: "Impulse passed between upstream and downstream factors",
    tone: "accent",
  },
  {
    label: "Tail trigger odds",
    value: "27%",
    detail: "Probability that the current graph tips into a stress cascade",
    tone: "warning",
  },
];

export const quantCausalNodes: QuantCausalNode[] = [
  {
    id: "systematic-flow",
    label: "Systematic Flow",
    cluster: "Flow",
    x: 0.12,
    y: 0.72,
    impulse: 1.8,
    confidence: 0.93,
    score: "+1.8z",
    detail: "CTA demand remains bid above the rebalance band",
  },
  {
    id: "liquidity",
    label: "Cross-Asset Liquidity",
    cluster: "Flow",
    x: 0.16,
    y: 0.2,
    impulse: 2.4,
    confidence: 0.9,
    score: "+2.4z",
    detail: "Dealer depth expands into the cash close",
  },
  {
    id: "rates",
    label: "Real Rates",
    cluster: "Rates",
    x: 0.48,
    y: 0.16,
    impulse: -1.2,
    confidence: 0.77,
    score: "-1.2z",
    detail: "Terminal-rate drift is easing but still restrictive",
  },
  {
    id: "semis",
    label: "Semis Breadth",
    cluster: "Micro",
    x: 0.3,
    y: 0.46,
    impulse: 1.5,
    confidence: 0.86,
    score: "+1.5z",
    detail: "Participation widens beyond the largest AI names",
  },
  {
    id: "dispersion",
    label: "Index Dispersion",
    cluster: "Risk",
    x: 0.58,
    y: 0.4,
    impulse: 0.9,
    confidence: 0.72,
    score: "+0.9z",
    detail: "Single-name spread remains elevated versus index vol",
  },
  {
    id: "credit",
    label: "Credit Stress",
    cluster: "Risk",
    x: 0.8,
    y: 0.26,
    impulse: -0.8,
    confidence: 0.68,
    score: "-0.8z",
    detail: "HY breadth stays calm but primary spreads are drifting wider",
  },
  {
    id: "volvol",
    label: "Vol-of-Vol",
    cluster: "Risk",
    x: 0.8,
    y: 0.68,
    impulse: 1.1,
    confidence: 0.81,
    score: "+1.1z",
    detail: "Gamma supply is thinner into macro event risk",
  },
  {
    id: "growth-beta",
    label: "Growth Beta",
    cluster: "Micro",
    x: 0.48,
    y: 0.78,
    impulse: 1.9,
    confidence: 0.88,
    score: "+1.9z",
    detail: "Higher-beta quality names still absorb the incremental flow",
  },
];

export const quantCausalEdges: QuantCausalEdge[] = [
  { from: "systematic-flow", to: "semis", weight: 0.82, polarity: "positive", label: "+0.82" },
  { from: "liquidity", to: "semis", weight: 0.71, polarity: "positive", label: "+0.71" },
  { from: "liquidity", to: "credit", weight: 0.42, polarity: "negative", label: "-0.42" },
  { from: "rates", to: "dispersion", weight: 0.64, polarity: "negative", label: "-0.64" },
  { from: "rates", to: "growth-beta", weight: 0.58, polarity: "negative", label: "-0.58" },
  { from: "semis", to: "growth-beta", weight: 0.77, polarity: "positive", label: "+0.77" },
  { from: "dispersion", to: "volvol", weight: 0.79, polarity: "positive", label: "+0.79" },
  { from: "credit", to: "volvol", weight: 0.66, polarity: "positive", label: "+0.66" },
  { from: "credit", to: "growth-beta", weight: 0.61, polarity: "negative", label: "-0.61" },
  { from: "systematic-flow", to: "growth-beta", weight: 0.54, polarity: "positive", label: "+0.54" },
];

export const heatmapRows = [
  "Rates",
  "USD",
  "Energy",
  "Credit",
  "Dealer Gamma",
  "Liquidity",
] as const;

export const heatmapColumns = [
  "Semis",
  "Quality",
  "Small Cap",
  "Value",
  "Index Vol",
  "EM FX",
] as const;

export const heatmapValues = [
  [-0.84, -0.48, -0.71, 0.36, 0.65, -0.44],
  [0.22, 0.58, -0.31, 0.49, -0.57, -0.78],
  [0.74, -0.18, 0.42, 0.67, 0.39, 0.28],
  [-0.41, -0.63, -0.7, 0.33, 0.81, -0.55],
  [0.68, 0.35, 0.77, -0.22, -0.86, 0.18],
  [0.91, 0.72, 0.84, 0.44, -0.37, 0.51],
] as const;

export const distributionBuckets = [
  "-3.5",
  "-3.0",
  "-2.5",
  "-2.0",
  "-1.5",
  "-1.0",
  "-0.5",
  "0.0",
  "+0.5",
  "+1.0",
  "+1.5",
  "+2.0",
  "+2.5",
  "+3.0",
] as const;

export const distributionBaseline = [2, 5, 11, 18, 29, 43, 58, 64, 57, 41, 26, 15, 8, 3];
export const distributionActive = [3, 9, 15, 22, 31, 39, 48, 52, 46, 37, 24, 14, 9, 5];
export const distributionStress = [8, 14, 21, 26, 29, 31, 28, 23, 17, 11, 8, 5, 3, 1];

export const distributionMarkers: DistributionMarker[] = [
  { label: "P05", x: 0.14, value: "-2.2σ" },
  { label: "Mode", x: 0.52, value: "+0.1σ" },
  { label: "P95", x: 0.84, value: "+2.0σ" },
];

export const distributionStats: DistributionStat[] = [
  { label: "Skew", value: "-0.41", detail: "Left tail remains thicker than the long-run baseline" },
  { label: "Kurtosis", value: "3.87", detail: "Fourth moment still elevated versus calm regimes" },
  { label: "1d VaR 99", value: "-2.34σ", detail: "Loss threshold implied by the active density" },
  { label: "Tail mass", value: "18.6%", detail: "Probability beyond ±2σ under the stress blend" },
];

export const scenarioCones: ScenarioCone[] = [
  {
    name: "Rates Relief",
    tone: "primary",
    probability: 0.43,
    horizon: "3d",
    expectedMove: "+1.4σ",
    halfLife: "1.8d",
    drivers: ["Semis breadth", "Dealer gamma", "Treasury drift"],
    center: [0.12, 0.2, 0.31, 0.38, 0.46, 0.54],
    upper: [0.28, 0.39, 0.53, 0.66, 0.74, 0.82],
    lower: [0.03, 0.08, 0.12, 0.16, 0.2, 0.24],
  },
  {
    name: "Liquidity Whipsaw",
    tone: "warning",
    probability: 0.31,
    horizon: "5d",
    expectedMove: "-0.9σ",
    halfLife: "0.9d",
    drivers: ["Cross-asset depth", "Macro event risk", "Systematic unwind"],
    center: [0.08, 0.17, 0.09, 0.22, 0.11, 0.18],
    upper: [0.25, 0.41, 0.32, 0.49, 0.38, 0.44],
    lower: [-0.06, -0.09, -0.14, -0.11, -0.18, -0.12],
  },
  {
    name: "Credit Breakout",
    tone: "danger",
    probability: 0.18,
    horizon: "8d",
    expectedMove: "-2.1σ",
    halfLife: "3.6d",
    drivers: ["HY spread shock", "Vol-of-vol", "Growth beta compression"],
    center: [-0.12, -0.2, -0.35, -0.51, -0.67, -0.84],
    upper: [0.06, 0.03, -0.05, -0.17, -0.27, -0.36],
    lower: [-0.28, -0.41, -0.58, -0.73, -0.88, -1],
  },
];
