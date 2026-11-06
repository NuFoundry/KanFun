// The website (landing page, legal pages): static HTML, no JavaScript of its own. The app lives on
// its own domain (DOMAIN, e.g. app.example.com); the site on WEB_DOMAIN (example.com).
// SITE_URL sets canonical and social URLs; deploys pass https://<WEB_DOMAIN>.
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL || "https://example.com",
  server: { port: Number(process.env.WEB_PORT || 4321) },
  // Stylesheets as files: the Content-Security-Policy allows styles from this origin only.
  build: { inlineStylesheets: "never" },
  devToolbar: { enabled: false },
  vite: { plugins: [tailwindcss()] },
});
