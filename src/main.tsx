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

initializeDocumentTheme();
document.title = commandCenterConfig.app.name;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </React.StrictMode>,
);
