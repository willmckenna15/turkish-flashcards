import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "autoUpdate" silently fetches a new service worker in the background
      // and activates it on the next load rather than forcing a prompt — we
      // still surface an optional "reload to update" banner via
      // src/components/PwaUpdatePrompt.tsx so a stale tab doesn't get stuck
      // serving an old build indefinitely, but nothing forces a reload.
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Türkçe Flashcards",
        short_name: "Türkçe",
        description: "Turkish vocab + grammar flashcards",
        start_url: "/",
        display: "standalone",
        background_color: "#fafaf9",
        theme_color: "#b91c1c",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache the built app shell (JS/CSS/HTML/icon) so the app can
        // load with zero connectivity, including a cold start with no tab
        // already open. Deliberately do NOT let the SPA "offline fallback"
        // apply to /api/* — those are live Vercel serverless calls (Gemini
        // sentence generation, sentence grading) that only make sense
        // online; Grammar Practice is allowed to fail/show an error there
        // rather than silently serve cached HTML for an API route.
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        // Service workers mostly don't activate under the plain Vite dev
        // server, so offline behavior needs to be tested against a
        // production-style build (`npm run build && npm run preview`) or the
        // deployed site, not `npm run dev`. Flip this to true temporarily if
        // you need to debug the SW itself during `npm run dev`.
        enabled: false,
      },
    }),
  ],
});
