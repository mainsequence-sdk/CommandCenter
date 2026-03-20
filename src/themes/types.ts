export const themeTokenKeys = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "sidebar",
  "sidebar-foreground",
  "topbar",
  "topbar-foreground",
  "muted",
  "muted-foreground",
  "border",
  "input",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "danger",
  "danger-foreground",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "positive",
  "negative",
  "ring",
  "chart-grid",
  "radius",
] as const;

export type ThemeTokenKey = (typeof themeTokenKeys)[number];

export type ThemeTokens = Record<ThemeTokenKey, string>;

export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  source: string;
  mode: "light" | "dark";
  tokens: ThemeTokens;
}

export const themeTokenMetadata: Array<{
  key: ThemeTokenKey;
  label: string;
  group: string;
  kind: "color" | "text";
}> = [
  { key: "background", label: "Background", group: "Surfaces", kind: "color" },
  { key: "foreground", label: "Foreground", group: "Surfaces", kind: "color" },
  { key: "card", label: "Card", group: "Surfaces", kind: "color" },
  { key: "card-foreground", label: "Card Foreground", group: "Surfaces", kind: "color" },
  { key: "popover", label: "Popover", group: "Surfaces", kind: "color" },
  { key: "popover-foreground", label: "Popover Foreground", group: "Surfaces", kind: "color" },
  { key: "sidebar", label: "Sidebar", group: "Navigation", kind: "color" },
  { key: "sidebar-foreground", label: "Sidebar Foreground", group: "Navigation", kind: "color" },
  { key: "topbar", label: "Topbar", group: "Navigation", kind: "color" },
  { key: "topbar-foreground", label: "Topbar Foreground", group: "Navigation", kind: "color" },
  { key: "muted", label: "Muted", group: "Neutral", kind: "color" },
  { key: "muted-foreground", label: "Muted Foreground", group: "Neutral", kind: "color" },
  { key: "border", label: "Border", group: "Neutral", kind: "color" },
  { key: "input", label: "Input", group: "Neutral", kind: "color" },
  { key: "primary", label: "Primary", group: "Brand", kind: "color" },
  { key: "primary-foreground", label: "Primary Foreground", group: "Brand", kind: "color" },
  { key: "secondary", label: "Secondary", group: "Brand", kind: "color" },
  { key: "secondary-foreground", label: "Secondary Foreground", group: "Brand", kind: "color" },
  { key: "accent", label: "Accent", group: "Brand", kind: "color" },
  { key: "accent-foreground", label: "Accent Foreground", group: "Brand", kind: "color" },
  { key: "danger", label: "Danger", group: "Status", kind: "color" },
  { key: "danger-foreground", label: "Danger Foreground", group: "Status", kind: "color" },
  { key: "success", label: "Success", group: "Status", kind: "color" },
  { key: "success-foreground", label: "Success Foreground", group: "Status", kind: "color" },
  { key: "warning", label: "Warning", group: "Status", kind: "color" },
  { key: "warning-foreground", label: "Warning Foreground", group: "Status", kind: "color" },
  { key: "positive", label: "Positive", group: "Status", kind: "color" },
  { key: "negative", label: "Negative", group: "Status", kind: "color" },
  { key: "ring", label: "Ring", group: "Status", kind: "color" },
  { key: "chart-grid", label: "Chart Grid", group: "Status", kind: "color" },
  { key: "radius", label: "Radius", group: "Layout", kind: "text" },
];
