import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const devAuthProxyPrefix = "/__command_center_auth__";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function readLoopbackAuthProxyTarget() {
  const configPath = path.resolve(projectRoot, "config/command-center.yaml");

  try {
    const rawConfig = fs.readFileSync(configPath, "utf8");
    const match = rawConfig.match(/^\s*base_url:\s*(.+)\s*$/m);
    const configuredValue = match?.[1]?.trim().replace(/^['"]|['"]$/g, "");

    if (configuredValue) {
      return new URL(configuredValue).origin;
    }
  } catch {
    return "http://127.0.0.1:8000";
  }

  return "http://127.0.0.1:8000";
}

const loopbackAuthProxyTarget = readLoopbackAuthProxyTarget();

export default defineConfig({
  envPrefix: ["VITE_", "INCLUDE_"],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    proxy: {
      [devAuthProxyPrefix]: {
        target: loopbackAuthProxyTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (requestPath) => requestPath.replace(new RegExp(`^${devAuthProxyPrefix}`), ""),
      },
    },
  },
});
