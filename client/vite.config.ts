import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// The single .env lives at the repo root and is shared by every workspace.
const rootDir = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const pocketbaseUrl = env.POCKETBASE_URL || "http://127.0.0.1:8090";
  const aiUrl = `http://${env.AI_HOST || "127.0.0.1"}:${env.AI_PORT || "8787"}`;
  const mailUrl = `http://${env.MAIL_HOST || "127.0.0.1"}:${env.MAIL_PORT || "8788"}`;
  const mcpUrl = `http://${env.MCP_HOST || "127.0.0.1"}:${env.MCP_PORT || "8791"}`;
  const port = Number(env.CLIENT_PORT || 5173);

  // Same-origin in dev (proxy) and in prod (Caddy) so the client never needs absolute URLs.
  const proxy = {
    "^/api/": { target: pocketbaseUrl, changeOrigin: true },
    "^/_/": { target: pocketbaseUrl, changeOrigin: true },
    "^/ai/": { target: aiUrl, changeOrigin: true },
    "^/mail/": { target: mailUrl, changeOrigin: true },
    // The MCP server: its endpoint, OAuth routes and discovery documents (deploy/Caddyfile too).
    "^/mcp(/|$)": { target: mcpUrl, changeOrigin: true },
    "^/\\.well-known/oauth-(protected-resource|authorization-server)": {
      target: mcpUrl,
      changeOrigin: true,
    },
  };

  return {
    envDir: rootDir,
    plugins: [
      react(),
      tailwindcss(),
      // Installable app (PWA): the manifest (name, icons from `pnpm brand`, standalone window) and a
      // service worker that precaches the built app shell, so a home-screen app starts at once and
      // updates itself after a deploy (the new version loads on the next start). Data is never
      // cached: PocketBase, the services and analytics always go to the network. Off in `pnpm dev`.
      VitePWA({
        registerType: "autoUpdate",
        // A file, not an inline script: the CSP allows scripts from this origin only.
        injectRegister: "script",
        includeAssets: ["favicon.svg", "apple-touch-icon.png", "robots.txt"],
        manifest: {
          name: env.VITE_APP_NAME || "KanFun",
          short_name: env.VITE_APP_NAME || "KanFun",
          start_url: "/",
          scope: "/",
          display: "standalone",
          // The light theme's --background (client/src/styles.css); index.html and theme.js agree.
          background_color: "#fbfaf8",
          theme_color: "#fbfaf8",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          // pdf.js's worker (1 MB) loads only when a PDF is attached, KaTeX only when a reply has a
          // formula; both stay out of the precache.
          globIgnores: ["**/pdf.worker*", "**/katex*", "**/KaTeX_*"],
          navigateFallback: "/index.html",
          // Server paths, not app routes: never answer them with the cached app shell.
          navigateFallbackDenylist: [/^\/(api|_|ai|mail|billing|pdf|mcp|\.well-known|ph|pl)(\/|$)/],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: { port, strictPort: true, proxy },
    preview: { port, strictPort: true, proxy },
    // "hidden": maps are written for the Sentry upload but not referenced from the bundle, and
    // deploy/Dockerfile.web deletes them, so production never serves the source.
    build: { outDir: "dist", sourcemap: "hidden" },
    // pdf.js loads only once a PDF is attached. Bundled at startup, it cannot make the dev server
    // re-optimise mid-session and break that first read.
    optimizeDeps: { include: ["pdfjs-dist"] },
  };
});
