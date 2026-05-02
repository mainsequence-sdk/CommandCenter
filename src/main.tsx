import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { router } from "@/app/router";
import { AppProviders } from "@/app/providers/AppProviders";
import { commandCenterConfig } from "@/config/command-center";
import "@/i18n";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "@/styles/globals.css";
import { initializeDocumentTheme } from "@/themes/ThemeProvider";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

initializeDocumentTheme();
document.title = commandCenterConfig.app.name;

const googleTagId = (import.meta.env.VITE_GOOGLE_TAG_ID ?? "").trim();

if (googleTagId) {
  const script = document.createElement("script");
  script.async = true;
  script.src =
    "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(googleTagId);
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function (...args: unknown[]) {
      window.dataLayer.push(args);
    };
  window.gtag("js", new Date());
  window.gtag("config", googleTagId);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </React.StrictMode>,
);
