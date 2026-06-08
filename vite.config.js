import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  define: {
    // Cache-busting token for translation JSON requests — Vite copies public/locales
    // into build/client, where remix-serve serves it with a 1-year immutable
    // Cache-Control header. Without this, browsers never re-fetch updated
    // translations after a deploy. A new value is baked in on every build.
    __I18N_BUILD__: JSON.stringify(Date.now().toString(36)),
  },
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
  server: {
    port: 3000,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 64999,
      clientPort: 64999,
    },
    fs: {
      allow: ["app", "node_modules"],
    },
  },
  optimizeDeps: {
    include: ["@shopify/polaris"],
  },
});
