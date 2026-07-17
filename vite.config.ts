import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type PluginOption } from "vite";

const devAuthProxyPrefix = "/__command_center_auth__";
const mainSequenceMarketsProxyPrefix = "/__main_sequence_markets__";
const appComponentProxyPrefix = "/__app_component_proxy__";
const assistantProxyPrefix = "/__assistant__";
const assistantExecutorProxyPrefix = "/__assistant_executor__";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const cloudflareMode = "cloudflare";
const defaultAppTitle = "Main Sequence";
const defaultAppDescription =
  "Main Sequence brings the power of data, automation, and artificial intelligence into a unified workbench. From controlled and standardized development workflows to no-code dashboards and application builders for non-technical users, Main Sequence reshapes how the enterprise works and operates.";
const defaultAppOgImagePath = "/mainsequence-logo.png";
const defaultTwitterCard = "summary";

async function loadOptionalCloudflarePlugin(): Promise<PluginOption | null> {
  try {
    const moduleName = "@cloudflare/vite-plugin";
    const { cloudflare } = (await import(moduleName)) as {
      cloudflare: () => PluginOption;
    };
    return cloudflare();
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function normalizePublicAssetPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function toAbsoluteAssetUrl(appUrl: string, assetPath: string) {
  if (!assetPath) {
    return "";
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }

  if (!appUrl) {
    return assetPath;
  }

  try {
    return new URL(assetPath, `${trimTrailingSlash(appUrl)}/`).toString();
  } catch {
    return assetPath;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function createIndexMetadataPlugin(env: Record<string, string>) {
  const appTitle = env.VITE_APP_TITLE?.trim() || defaultAppTitle;
  const appDescription = env.VITE_APP_DESCRIPTION?.trim() || defaultAppDescription;
  const appUrl = env.VITE_APP_URL?.trim() || "";
  const ogImagePath = normalizePublicAssetPath(
    env.VITE_APP_OG_IMAGE_PATH?.trim() || defaultAppOgImagePath,
  );
  const ogImageUrl = toAbsoluteAssetUrl(appUrl, ogImagePath);
  const replacements = new Map<string, string>([
    ["__COMMAND_CENTER_APP_TITLE__", escapeHtml(appTitle)],
    ["__COMMAND_CENTER_APP_DESCRIPTION__", escapeHtml(appDescription)],
    ["__COMMAND_CENTER_APP_URL__", escapeHtml(appUrl)],
    ["__COMMAND_CENTER_APP_OG_IMAGE_URL__", escapeHtml(ogImageUrl)],
    ["__COMMAND_CENTER_APP_TWITTER_CARD__", defaultTwitterCard],
  ]);

  return {
    name: "command-center-index-metadata",
    transformIndexHtml(html: string) {
      let transformedHtml = html;

      replacements.forEach((replacement, token) => {
        transformedHtml = transformedHtml.replaceAll(token, replacement);
      });

      return transformedHtml;
    },
  } satisfies PluginOption;
}

function createAppComponentProxyPlugin(): PluginOption {
  return {
    name: "app-component-loopback-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const request = req as any;

        if (!request.url?.startsWith(appComponentProxyPrefix)) {
          next();
          return;
        }

        const requestUrl = new URL(request.url, "http://localhost");
        const target = requestUrl.searchParams.get("target");

        if (!target) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Missing target URL.");
          return;
        }

        let targetUrl: URL;

        try {
          targetUrl = new URL(target);
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Invalid target URL.");
          return;
        }

        if (!isLoopbackHostname(targetUrl.hostname)) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("AppComponent proxy only supports loopback hosts.");
          return;
        }

        void (async () => {
          try {
            const proxyInit = {
              method: request.method,
              headers: {
                ...request.headers,
                host: targetUrl.host,
              } as HeadersInit,
              body:
                request.method === "GET" || request.method === "HEAD"
                  ? undefined
                  : (request as BodyInit),
              duplex: "half",
            } as RequestInit & { duplex?: string };

            const response = await fetch(targetUrl.toString(), proxyInit);

            res.statusCode = response.status;

            response.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });

            const body = new Uint8Array(await response.arrayBuffer());
            res.end(body);
          } catch (error) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(error instanceof Error ? error.message : "Proxy request failed.");
          }
        })();
      });
    },
  };
}

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
    return "http://localhost:8000";
  }

  return "http://localhost:8000";
}

function readOptionalProxyTargetOrigin(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

const loopbackAuthProxyTarget = readLoopbackAuthProxyTarget();

export default defineConfig(async ({ mode }) => {
  const cloudflarePlugin = mode === cloudflareMode ? await loadOptionalCloudflarePlugin() : null;
  const env = loadEnv(mode, projectRoot, "");
  const manualReload = env.VITE_MANUAL_RELOAD === "true";
  const assistantProxyTarget =
    env.VITE_ASSISTANT_UI_PROXY_TARGET ||
    env.VITE_ASSISTANT_UI_ENDPOINT ||
    "http://192.168.1.253:8787";
  const assistantExecutorProxyTarget = env.VITE_ASSISTANT_UI_EXECUTOR_TARGET?.trim() || null;
  const mainSequenceMarketsProxyTarget = readOptionalProxyTargetOrigin(
    env.VITE_DEBUG_MAIN_SEQUENCE,
  );
  const createProxyEntry = (target: string, prefix: string) => ({
    target,
    changeOrigin: true,
    secure: false,
    rewrite: (requestPath: string) => requestPath.replace(new RegExp(`^${prefix}`), ""),
  });
  const proxy = {
    [devAuthProxyPrefix]: createProxyEntry(loopbackAuthProxyTarget, devAuthProxyPrefix),
    [assistantProxyPrefix]: createProxyEntry(assistantProxyTarget, assistantProxyPrefix),
  } as Record<string, ReturnType<typeof createProxyEntry>>;

  if (assistantExecutorProxyTarget) {
    proxy[assistantExecutorProxyPrefix] = createProxyEntry(
      assistantExecutorProxyTarget,
      assistantExecutorProxyPrefix,
    );
  }

  if (mainSequenceMarketsProxyTarget) {
    proxy[mainSequenceMarketsProxyPrefix] = createProxyEntry(
      mainSequenceMarketsProxyTarget,
      mainSequenceMarketsProxyPrefix,
    );
  }

  return {
    plugins: [
      createAppComponentProxyPlugin(),
      createIndexMetadataPlugin(env),
      react(),
      tailwindcss(),
      ...(cloudflarePlugin ? [cloudflarePlugin] : []),
    ],
    resolve: {
      alias: {
        "@mainsequence/command-center-themes/data-viz": new URL(
          "./packages/command-center-themes/src/chart-palettes.ts",
          import.meta.url,
        ).pathname,
        "@mainsequence/command-center-themes/presets": new URL(
          "./packages/command-center-themes/src/presets/index.ts",
          import.meta.url,
        ).pathname,
        "@mainsequence/command-center-themes": new URL(
          "./packages/command-center-themes/src/index.ts",
          import.meta.url,
        ).pathname,
        "@": new URL("./src", import.meta.url).pathname,
      },
    },
    server: {
      port: 5173,
      hmr: manualReload ? false : undefined,
      proxy,
    },
  };
});
