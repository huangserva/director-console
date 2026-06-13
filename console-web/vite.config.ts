import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// API base defaults to the M0 console-api on 127.0.0.1:4099.
// The web app calls everything under /api and Vite proxies it, so the
// browser never makes a cross-origin request and we never depend on the
// API enabling CORS. Override with PASEO_CONSOLE_API when the API moves.
const API_TARGET = process.env.PASEO_CONSOLE_API || "http://127.0.0.1:4099";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
    // Allow importing the locked catalog.json from the sibling composer package
    // so the editor's scene_type constraints never drift from the source of truth.
    fs: { allow: [".."] },
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
