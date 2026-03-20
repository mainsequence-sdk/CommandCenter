import type { ThemePreset, ThemeTokens } from "@/themes/types";

function toIdentifier(value: string) {
  const clean = value.replace(/[^a-zA-Z0-9]+/g, " ");
  const parts = clean
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "customTheme";
  }

  const [first, ...rest] = parts;
  return `${first.toLowerCase()}${rest
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join("")}Theme`;
}

export function buildThemeSnippet({
  id,
  label,
  description,
  source,
  mode,
  tightness,
  surfaceHierarchy,
  tokens,
}: ThemePreset) {
  const tokenLines = Object.entries(tokens)
    .map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join("\n");

  return `import type { ThemePreset } from "@/themes/types";\n\nexport const ${toIdentifier(
    id,
  )}: ThemePreset = {\n  id: ${JSON.stringify(id)},\n  label: ${JSON.stringify(
    label,
  )},\n  description: ${JSON.stringify(
    description,
  )},\n  source: ${JSON.stringify(source)},\n  mode: ${JSON.stringify(
    mode,
  )},\n  tightness: ${JSON.stringify(tightness)},\n  surfaceHierarchy: ${JSON.stringify(surfaceHierarchy)},\n  tokens: {\n${tokenLines}\n  },\n};`;
}

export function buildCustomPreset(
  base: ThemePreset,
  overrides: Partial<ThemeTokens>,
): ThemePreset {
  return {
    ...base,
    tokens: {
      ...base.tokens,
      ...overrides,
    },
  };
}
