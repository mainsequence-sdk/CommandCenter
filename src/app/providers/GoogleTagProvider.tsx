import { useEffect, type ReactNode } from "react";

import { useCommandCenterConfig } from "@/config/CommandCenterConfigProvider";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
    __commandCenterGoogleTagMeasurementId?: string;
  }
}

const GOOGLE_TAG_SCRIPT_ID = "command-center-google-tag";
const GOOGLE_TAG_SRC = "https://www.googletagmanager.com/gtag/js?id=";

function ensureGoogleTagScript(measurementId: string) {
  const nextSrc = `${GOOGLE_TAG_SRC}${encodeURIComponent(measurementId)}`;
  const existingScript = document.getElementById(GOOGLE_TAG_SCRIPT_ID);

  if (existingScript instanceof HTMLScriptElement) {
    if (existingScript.src === nextSrc) {
      return;
    }

    existingScript.remove();
  }

  const script = document.createElement("script");
  script.id = GOOGLE_TAG_SCRIPT_ID;
  script.async = true;
  script.src = nextSrc;
  document.head.appendChild(script);
}

function ensureGoogleTagFunction() {
  window.dataLayer = window.dataLayer ?? [];

  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }

  return window.gtag;
}

export function GoogleTagProvider({ children }: { children: ReactNode }) {
  const {
    analytics: {
      googleTag: { enabled, measurementId },
    },
  } = useCommandCenterConfig();

  useEffect(() => {
    const normalizedMeasurementId = measurementId.trim();

    if (
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      !enabled ||
      !normalizedMeasurementId
    ) {
      return;
    }

    ensureGoogleTagScript(normalizedMeasurementId);

    if (window.__commandCenterGoogleTagMeasurementId === normalizedMeasurementId) {
      return;
    }

    const gtag = ensureGoogleTagFunction();
    gtag("js", new Date());
    gtag("config", normalizedMeasurementId);
    window.__commandCenterGoogleTagMeasurementId = normalizedMeasurementId;
  }, [enabled, measurementId]);

  return <>{children}</>;
}
