import type { ButtonHTMLAttributes } from "react";

import { DitheredWaves } from "ditherwave";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { useOptionalTheme } from "@/themes/ThemeContext";

import "./AutomationButton.css";

type AutomationButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "type"> & {
  ariaLabel?: string;
  className?: string;
  label: string;
};

function normalizeHexColor(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmed) || /^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed;
  }

  return fallback;
}

export function AutomationDitherWaveLayer({
  className,
  mode = "bayer",
}: {
  className?: string;
  mode?: "bayer" | "floyd" | "dots" | "ascii";
}) {
  const theme = useOptionalTheme();
  const baseColor = normalizeHexColor(theme?.resolvedTokens.primary, "#536DE8");
  const waveColor = "#FFFFFF";

  return (
    <DitheredWaves
      className={cn("main-sequence-ai-automation-ditherwave", className)}
      mode={mode}
      waveColor={waveColor}
      baseColor={baseColor}
      pixelSize={4}
      colorNum={3}
      matrixSize={8}
      waveSpeed={0.038}
      waveFrequency={2.4}
      waveAmplitude={0.18}
      enableMouseInteraction={false}
      mouseRadius={0.45}
      fallback={<div className="main-sequence-ai-automation-ditherwave__fallback" />}
    />
  );
}

export function AutomationButton({
  ariaLabel,
  className,
  label,
  ...buttonProps
}: AutomationButtonProps) {
  return (
    <button
      {...buttonProps}
      type="button"
      className={cn("main-sequence-ai-automation-button", className)}
      aria-label={ariaLabel ?? label}
    >
      <AutomationDitherWaveLayer />
      <span className="main-sequence-ai-automation-button__content">
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    </button>
  );
}
