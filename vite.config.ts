import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type PluginOption } from "vite";

const devAuthProxyPrefix = "/__command_center_auth__";
const appComponentProxyPrefix = "/__app_component_proxy__";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const cloudflareMode = "cloudflare";

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
    return "http://127.0.0.1:8000";
  }

  return "http://127.0.0.1:8000";
}

const loopbackAuthProxyTarget = readLoopbackAuthProxyTarget();

export default defineConfig(async ({ mode }) => {
  const cloudflarePlugin = mode === cloudflareMode ? await loadOptionalCloudflarePlugin() : null;

  return {
    plugins: [
      createAppComponentProxyPlugin(),
      react(),
      tailwindcss(),
      ...(cloudflarePlugin ? [cloudflarePlugin] : []),
    ],
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
          rewrite: (requestPath: string) => requestPath.replace(new RegExp(`^${devAuthProxyPrefix}`), ""),
        },
      },
    },
  };
});
